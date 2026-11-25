# Potify ID • partner integration pilot

A member can use the same Potify account at the Community Greenhouse and at an event run by another organization. Greenhouse can ask to display the member’s chosen name. The organizer can recognize a returning guest and check their own RSVP using only a private member number. A volunteer can also choose to carry a reviewed crew badge from Greenhouse to the venue to access its crew check-in. Both experiences are examples in this kit. “Potify ID” is a working name.

## Run the example

Use Node.js 24 with its built-in SQLite module. From this folder run:

    node run.mjs

The program creates temporary signing keys and two in-memory databases, exercises the account and check-in flows, and prints eight results. It requires no package installs, network calls, wallet app, tokens or funds. The included transcript is from the November 23 run. The URLs ending in .example are reserved examples.

## What the member controls

| Action | What happens |
|---|---|
| Create or return | The identity service verifies a short-lived, single-use sign-in message signed by the wallet. The wallet address maps to a stable internal member ID. |
| Add a second address | Reauthenticate the current account, then sign a separate link request with the new wallet. A wallet linked to another account produces a conflict for explicit resolution. Both proven wallets then open the same profile. |
| Choose who sees what | Approve the Greenhouse’s request for the chosen handle, or allow only a private app-specific member number. The event client gets its own number by default. Choosing to reuse a recognizable handle across apps can connect those profiles publicly. |
| Carry a verified contribution | Suppose a Greenhouse moderator approves a member’s film captions. The pilot uses a synthetic review receipt. If the member also approves the crew field for the event, the venue sees only the yes/no claim while it is current. The receipt, task details and wallet list stay private. An absent, expired or withheld badge is omitted. |
| Attend the event | The organizer stores its own RSVP under the pair of issuer and subject. It issues a random pass for that booking, valid for 60 seconds and one use. A venue can put the pass in a QR code. The sample operates on the pass string. |
| Disconnect an app | The registry immediately stops new releases to that app until the member consents again. Other authorized apps keep working. A new grant restores the same app-specific identifier. A partner’s existing attendance record has its own retention lifecycle. |

## Where the data lives

The proposed issuer keeps member IDs, optional chosen handles, verified wallet links, registered app sectors, pairwise subjects and grants in an off-chain database. Each external organization gets its own sector. Only its scoped identifier leaves the registry by default. Use each app’s validated (issuer, subject) pair as its local account key. Keep aliases optional. Wallet addresses, balances, purchases, grow notes, past guest analytics and Seeds histories stay out of these partner claims. Use restricted access, encrypted storage/backups and retention limits for challenge and grant records. Let members view connected apps, disconnect them and request export or deletion of off-chain information. Explain any partner-retained records separately.

For the current site's member logins, confirm its active authentication provider and subject format. Link a legacy member only within a freshly authenticated legacy session and after a separate wallet proof. Backfill a mapping in staging, protect it with a uniqueness constraint, and preserve existing game progression. Do not silently merge accounts with a matching email or handle. For production recovery, enroll a separately proven second wallet or passkey before allowing removal of the final sign-in method. Revoke sessions for removed credentials and test recovery on an iPhone. This recovery and migration work is outside the local fixture.

## How a platform would add “Continue with Potify ID”

1. The platform operator opts in. Register a staging client, an exact HTTPS return URL, a contact, the fields it needs and a distinct sector. Use the partner’s existing support for a custom OpenID Connect provider if available. A platform that accepts a Solana wallet login still needs a Potify ID integration to receive persona information.
2. Provide a real HTTPS issuer and its discovery metadata when staging exists. The sample issuer is https://id.potify.example. Its planned discovery path is /.well-known/openid-configuration. Use a maintained OpenID Connect provider and client library. Register different client IDs, secrets where appropriate, and redirect URLs for staging and production.
3. Request the authorization-code flow with PKCE using S256, a fresh state and a fresh OIDC nonce. Use the openid scope. The optional proposed scope potify.alias releases preferred_username. The proposed potify.crew scope releases a current potify_crew: true claim. Both require an approved client and member consent. Use top-level authorization redirects. A native app uses the system browser and a registered app return route.
4. At the callback let the client library validate the original state, exchange the authorization code with its verifier, and validate the signed ID token against the pinned issuer’s discovery keys, permitted algorithms, audience, nonce and expiry. Create a local app session from (iss, sub). The production ID token also includes required protocol fields such as aud, iat and exp. The fields printed by the fixture are data projections, not signed tokens.
5. In the issuer, use a Solana Wallet Standard sign-in adapter where supported. Generate the challenge server-side, bind it to the expected domain, URI, purpose and short expiry, and consume it once after signature verification. Test the precise wallet feature and device handoff. Identity sign-in asks for an off-chain message. Any optional purchase has its own price, recipient and transaction approval.
6. The organizer collects any eligibility data its service requires and keeps its booking and check-in records. Its desk API must authenticate the operator, restrict scans to the operator’s event and redeem each booking atomically. The fixture calls the desk functions locally. The issuer learns nothing about attendance from the desk in this example.
7. Give members an app-specific disconnect control. Stop new authorization and refresh, revoke applicable tokens, and use short lifetimes for outstanding tokens. Specify partner logout and deletion behavior in the integration agreement. Report which previously issued tokens and local sessions can remain valid until expiry.

## What has been tested

run.mjs exercises Ed25519 verification using the archived Holder Hub’s pure signature helpers, single-use challenges, explicit linking, stable identities across two wallets, separate app identifiers, consented and expiring crew status, revoked consent and event pass redemption. The fixture’s moderator method supplies a synthetic reviewed contribution. A deployed service must authorize its review staff and verify who issued the receipt before asserting an entitlement. The current Holder Hub archive uses the wallet as the member table’s primary key. The new schema demonstrates the account mapping needed for two wallets to open the same member profile. The production site, Clerk sessions, Seeds ledger and wallet balances are outside this fixture.

## What establishes a live integration

On an iPhone, record the exact app and wallet versions. Complete a real off-chain sign-in in the proposed first-party staging site, link the second wallet deliberately, and return to the same member. Have a second separately registered app complete an actual OIDC redirect and code exchange. Verify consent and the returned fields, distinct subject values, disconnect and recovery. Capture redacted field lists and the build/date. Do not log raw tokens, signatures or wallet inventories. An outside platform counts as adopted only after its operator confirms a working integration under its own control.

A later partner that needs independently verifiable or offline membership proof could add a user-held credential. This is a different requirement from adding a website sign-in button. Validate demand with an operator before adding that layer. [OpenID Connect Core](https://openid.net/specs/openid-connect-core-1_0-errata2.html) · [Discovery](https://openid.net/specs/openid-connect-discovery-1_0.html) · [OAuth security practice](https://www.rfc-editor.org/rfc/rfc9700.html) · [Native apps](https://www.rfc-editor.org/rfc/rfc8252.html) · [Solana message authentication](https://solana.com/docs/frontend/messages-and-auth) · [Verifiable Credentials](https://www.w3.org/TR/vc-data-model-2.0/)

Included files: persona.sql (issuer schema), wallet-proof.mjs (only the archived signature and encoding helpers), pilot.mjs (local issuer data operations and a separate event desk), run.mjs (runnable walkthrough), TEST-RESULTS.txt (recorded output). Node 24 supplies all runtime dependencies.
