import { useEffect, useRef, useState } from "react";
import { SignInButton, SignUpButton, useAuth, useUser } from "@clerk/react";
import { getWallets } from "@wallet-standard/app";
import {
  addresses,
  connectAddress,
  features,
  supportsAddress,
  type Wallet,
} from "@/components/first-cycle-wallet";
import { basePath } from "@/components/auth/auth-pages";

type Account = Wallet["accounts"][number];
type SignFeature = {
  signMessage: (input: {
    account: Account;
    message: Uint8Array;
  }) => Promise<
    readonly { signedMessage: Uint8Array; signature: Uint8Array }[]
  >;
};
type Challenge = { nonce: string; message: string; expires: string };
const nativePath = basePath + "/potify-id";
const button =
  "min-h-11 rounded border border-primary/50 px-4 py-2 text-sm font-medium hover:border-primary disabled:opacity-50";
function signer(wallet: Wallet) {
  return wallet.features["solana:signMessage"] as SignFeature | undefined;
}

function MemberWallets() {
  const { getToken } = useAuth();
  const [linked, setLinked] = useState<string[] | null>(null);
  const [wallets, setWallets] = useState<readonly Wallet[]>([]);
  const [active, setActive] = useState<Wallet | null>(null);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [address, setAddress] = useState("");
  const [proof, setProof] = useState<Challenge | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const generation = useRef(0);
  async function request<T>(suffix = "", body?: object): Promise<T> {
    const token = await getToken();
    if (!token) throw Error("Sign in again to manage your wallets.");
    const result = await fetch(basePath + "/api/potify-id/wallets" + suffix, {
      method: body ? "POST" : "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Authorization: "Bearer " + token,
        ...(body && { "Content-Type": "application/json" }),
      },
      ...(body && { body: JSON.stringify(body) }),
    });
    if (!result.headers.get("content-type")?.includes("application/json"))
      throw Error("Wallet linking is unavailable on this deployment.");
    const data = await result.json();
    if (!result.ok)
      throw Error(data.error || "The account service is unavailable.");
    return data;
  }
  async function refresh() {
    const result = await request<{ wallets: { address: string }[] }>();
    setLinked(result.wallets.map((w) => w.address));
  }
  useEffect(() => {
    let mounted = true;
    request<{ wallets: { address: string }[] }>()
      .then((data) => {
        if (mounted) setLinked(data.wallets.map((w) => w.address));
      })
      .catch((e) => {
        if (mounted) setNotice(e.message);
      });
    const registry = getWallets();
    const list = () =>
      setWallets(
        registry
          .get()
          .filter((w) => supportsAddress(w) && !!signer(w)?.signMessage),
      );
    list();
    const add = registry.on("register", list),
      remove = registry.on("unregister", list);
    return () => {
      mounted = false;
      generation.current++;
      add();
      remove();
    };
  }, []);
  useEffect(() => {
    if (!active) return;
    const update = (next: readonly Account[]) => {
      generation.current++;
      setProof(null);
      setBusy(false);
      const values = addresses(
        next.filter((a) => a.features.includes("solana:signMessage")),
      );
      setAccounts(values);
      setAddress(values.length === 1 ? values[0] : "");
      if (!values.length) {
        setActive(null);
        setNotice("The wallet shared no account that can sign messages.");
      }
    };
    if (!wallets.includes(active)) {
      update([]);
      return;
    }
    update(active.accounts);
    return features(active)["standard:events"]?.on("change", (event) => {
      if (event.accounts) update(event.accounts);
    });
  }, [active, wallets]);
  async function action(fn: (version: number) => Promise<void>) {
    const version = ++generation.current;
    setBusy(true);
    setNotice("");
    try {
      await fn(version);
    } catch (e) {
      if (version === generation.current)
        setNotice(
          e instanceof Error ? e.message : "The request was cancelled.",
        );
    } finally {
      if (version === generation.current) setBusy(false);
    }
  }
  async function sign(version: number) {
    if (!proof || !active) return;
    const account = active.accounts.find((a) => a.address === address);
    const feature = signer(active);
    if (!account || !feature || Date.parse(proof.expires) <= Date.now()) {
      setProof(null);
      throw Error("Request a fresh verification message.");
    }
    const message = new TextEncoder().encode(proof.message);
    const [result] = await feature.signMessage({ account, message });
    if (version !== generation.current) return;
    if (
      !result ||
      result.signature.length !== 64 ||
      result.signedMessage.length !== message.length ||
      !result.signedMessage.every((byte, i) => byte === message[i]) ||
      !active.accounts.some((a) => a.address === address)
    ) {
      setProof(null);
      throw Error(
        "The wallet returned a different message or account. Request a new message.",
      );
    }
    const signature = btoa(String.fromCharCode(...result.signature));
    setProof(null);
    await request("/verify", { address, nonce: proof.nonce, signature });
    if (version === generation.current) {
      await refresh();
      setNotice("Your wallet is linked to your POTIFY ID.");
    }
  }
  return (
    <section className="mt-7 space-y-4" aria-labelledby="wallet-title">
      <h2 id="wallet-title" className="font-serif text-2xl">
        Your linked wallets
      </h2>
      {linked &&
        (linked.length ? (
          <ul className="space-y-3">
            {linked.map((a) => (
              <li key={a} className="rounded border border-border p-3">
                <span className="block break-all font-mono text-sm">{a}</span>
                <button
                  className="mt-1 min-h-11 underline"
                  disabled={busy}
                  onClick={() =>
                    action(async () => {
                      await request("/unlink", { address: a });
                      await refresh();
                      setProof(null);
                      setNotice("Wallet removed from this account.");
                    })
                  }
                >
                  Unlink wallet
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>You haven’t linked a wallet yet.</p>
        ))}
      <p className="text-sm text-muted-foreground">
        Choose a wallet to add to this account. You’ll see the full address and
        a one-time message before signing. Linking is free and keeps your wallet
        list private.
      </p>
      {linked === null ? (
        <button
          className={button}
          disabled={busy}
          onClick={() => action(refresh)}
        >
          Reload wallet list
        </button>
      ) : (
        <>
          {!active &&
            (wallets.length ? (
              <div className="flex flex-wrap gap-2">
                {wallets.map((w, i) => (
                  <button
                    className={button}
                    key={i}
                    disabled={busy}
                    onClick={() =>
                      action(async (version) => {
                        await connectAddress(w);
                        if (version === generation.current) setActive(w);
                      })
                    }
                  >
                    {"Connect " + w.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm">
                On iPhone, open potifywebsite.com in your Solflare or Phantom
                browser. On desktop, unlock a compatible Solana wallet.
              </p>
            ))}
          {active && (
            <div className="space-y-3">
              <p>{active.name}</p>
              <label className="block">
                Wallet address
                <select
                  className="mt-1 block w-full rounded border border-border bg-background p-2 text-sm"
                  value={address}
                  disabled={busy}
                  onChange={(e) => {
                    generation.current++;
                    setAddress(e.target.value);
                    setProof(null);
                  }}
                >
                  <option value="">Choose an address</option>
                  {accounts.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
              <p className="break-all font-mono text-sm">{address}</p>
              {address && !linked.includes(address) && !proof && (
                <button
                  className={button}
                  disabled={busy}
                  onClick={() =>
                    action(async (version) => {
                      const next = await request<Challenge>("/challenge", {
                        address,
                      });
                      if (version === generation.current) setProof(next);
                    })
                  }
                >
                  Review verification message
                </button>
              )}
              {proof && (
                <div className="space-y-3">
                  <pre className="whitespace-pre-wrap break-all rounded border border-border p-3 text-xs">
                    {proof.message}
                  </pre>
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() => action(sign)}
                  >
                    Sign message and link wallet
                  </button>
                </div>
              )}
              <button
                className="block min-h-11 underline"
                onClick={() => {
                  generation.current++;
                  setActive(null);
                  setAddress("");
                  setAccounts([]);
                  setProof(null);
                  setBusy(false);
                  setNotice("");
                }}
              >
                Close wallet selection
              </button>
            </div>
          )}
        </>
      )}
      <p role="status" className="text-sm">
        {notice}
      </p>
    </section>
  );
}

export default function PotifyId() {
  const { user, isLoaded } = useUser();
  return (
    <main className="min-h-screen bg-background px-5 py-12 text-foreground">
      <div className="mx-auto max-w-lg">
        <a className="text-sm text-primary underline" href={basePath + "/"}>
          POTIFY home
        </a>
        <h1 className="mb-3 mt-8 font-serif text-5xl">POTIFY ID</h1>
        {!isLoaded ? (
          <p role="status">Loading your account…</p>
        ) : user ? (
          <>
            <p>
              You’re signed in
              {user.primaryEmailAddress
                ? " as " + user.primaryEmailAddress.emailAddress
                : ""}
              .
            </p>
            <MemberWallets key={user.id} />
          </>
        ) : (
          <>
            <p>
              One account for your place in the POTIFY community. If you already
              use the Spin, sign in with that account to link your wallet.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <SignUpButton
                mode="modal"
                forceRedirectUrl={nativePath}
                signInForceRedirectUrl={nativePath}
              >
                <button className={button}>Create my POTIFY ID</button>
              </SignUpButton>
              <SignInButton
                mode="modal"
                forceRedirectUrl={nativePath}
                signUpForceRedirectUrl={nativePath}
              >
                <button className={button}>Sign in</button>
              </SignInButton>
            </div>
          </>
        )}
        <a
          className="mt-8 inline-block text-primary underline"
          href={basePath + "/first-cycle"}
        >
          Return to the First Cycle
        </a>
      </div>
    </main>
  );
}
