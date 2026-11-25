import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const memberWallets = pgTable(
  "potify_member_wallets",
  {
    address: text("address").primaryKey(),
    member: text("clerk_user_id").notNull(),
    linkedAt: timestamp("linked_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("potify_member_wallet_owner_idx").on(table.member)],
);

export const memberWalletChallenges = pgTable(
  "potify_member_wallet_challenges",
  {
    member: text("clerk_user_id").primaryKey(),
    session: text("clerk_session_id").notNull(),
    nonce: uuid("nonce").notNull(),
    address: text("address").notNull(),
    message: text("message").notNull(),
    expires: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
);
