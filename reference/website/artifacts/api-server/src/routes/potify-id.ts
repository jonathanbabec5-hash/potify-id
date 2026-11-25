import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { createPublicKey, randomUUID, verify } from "node:crypto";
import bs58 from "bs58";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  memberWallets as wallets,
  memberWalletChallenges as challenges,
} from "@workspace/db/schema";

const router: IRouter = Router();
const origin = "https://potifywebsite.com";
const ed25519Prefix = Buffer.from("302a300506032b6570032100", "hex");
const scope = "/potify-id/wallets";

function publicKey(address: unknown) {
  if (
    typeof address !== "string" ||
    !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
  )
    return null;
  const bytes = bs58.decode(address);
  if (bytes.length !== 32 || bs58.encode(bytes) !== address) return null;
  return createPublicKey({
    key: Buffer.concat([ed25519Prefix, bytes]),
    format: "der",
    type: "spki",
  });
}

router.use(scope, (req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  const { userId, sessionId } = getAuth(req);
  if (!userId || !sessionId) {
    res.status(401).json({ error: "Sign in to your POTIFY account first." });
    return;
  }
  const requestOrigin = req.get("origin");
  if (
    (requestOrigin && requestOrigin !== origin) ||
    (req.method !== "GET" && (!requestOrigin || !req.is("application/json")))
  ) {
    res.status(403).json({ error: "Use your account on potifywebsite.com." });
    return;
  }
  res.locals.memberId = userId;
  res.locals.memberSession = sessionId;
  next();
});

router.get(scope, async (_req, res) => {
  const list = await db
    .select({ address: wallets.address, linkedAt: wallets.linkedAt })
    .from(wallets)
    .where(eq(wallets.member, res.locals.memberId))
    .orderBy(wallets.linkedAt);
  res.json({ wallets: list });
});

router.post(scope + "/challenge", async (req, res) => {
  const address = req.body?.address;
  if (!publicKey(address)) {
    res.status(400).json({ error: "Choose a valid Solana account." });
    return;
  }
  const nonce = randomUUID();
  const now = new Date();
  const expires = new Date(now.getTime() + 5 * 60_000);
  const message = [
    "potifywebsite.com wants you to verify your Solana wallet:",
    address,
    "",
    "Link this wallet to your signed-in POTIFY ID. This message authorizes no transaction or payment.",
    "",
    "URI: " + origin + "/potify-id",
    "Version: 1",
    "Chain: solana:mainnet",
    "Nonce: " + nonce,
    "Issued At: " + now.toISOString(),
    "Expiration Time: " + expires.toISOString(),
  ].join("\n");
  const proof = {
    address,
    nonce,
    message,
    expires,
    session: res.locals.memberSession,
  };
  await db
    .insert(challenges)
    .values({ ...proof, member: res.locals.memberId })
    .onConflictDoUpdate({ target: challenges.member, set: proof });
  res.json({ nonce, message, expires: expires.toISOString() });
});

router.post(scope + "/verify", async (req, res) => {
  const { address, nonce, signature } = req.body ?? {};
  const key = publicKey(address);
  if (
    !key ||
    typeof nonce !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      nonce,
    ) ||
    typeof signature !== "string" ||
    !/^[A-Za-z0-9+/]{86}==$/.test(signature)
  ) {
    res.status(400).json({ error: "Invalid wallet proof." });
    return;
  }
  const member = res.locals.memberId as string;
  const result = await db.transaction(async (tx) => {
    const match = and(
      eq(challenges.member, member),
      eq(challenges.session, res.locals.memberSession),
      eq(challenges.nonce, nonce),
      eq(challenges.address, address),
      gt(challenges.expires, sql`clock_timestamp()`),
    );
    const [challenge] = await tx
      .select()
      .from(challenges)
      .where(match)
      .for("update");
    if (!challenge) return 410;
    if (
      !verify(
        null,
        Buffer.from(challenge.message),
        key,
        Buffer.from(signature, "base64"),
      )
    )
      return 403;
    await tx.delete(challenges).where(eq(challenges.member, member));
    await tx
      .insert(wallets)
      .values({ address, member })
      .onConflictDoNothing({ target: wallets.address });
    const [owner] = await tx
      .select({ member: wallets.member })
      .from(wallets)
      .where(eq(wallets.address, address));
    return owner?.member === member ? 200 : 409;
  });
  if (result === 200) {
    res.json({ address, verified: true });
    return;
  }
  const error =
    result === 410
      ? "This request expired or was replaced. Request a fresh message."
      : result === 409
        ? "This wallet is already linked to another POTIFY account."
        : "The wallet signature did not verify.";
  res.status(result).json({ error });
});

router.post(scope + "/unlink", async (req, res) => {
  const address = req.body?.address;
  if (!publicKey(address)) {
    res.status(400).json({ error: "Invalid wallet address." });
    return;
  }
  await db.transaction(async (tx) => {
    // Invalidate an outstanding request before changing ownership of this address.
    await tx
      .delete(challenges)
      .where(
        and(
          eq(challenges.member, res.locals.memberId),
          eq(challenges.address, address),
        ),
      );
    await tx
      .delete(wallets)
      .where(
        and(
          eq(wallets.member, res.locals.memberId),
          eq(wallets.address, address),
        ),
      );
  });
  res.json({ unlinked: true });
});
export default router;
