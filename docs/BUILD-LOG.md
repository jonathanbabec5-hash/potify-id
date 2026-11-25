# November 25, 2026 · Potify ID

**Question.** Let someone carry credit for a contribution from the Greenhouse to a creator screening.

**Source and change.** POTIFY_ID_Partner_Pilot.zip, November 23. Portable two-app identity fixture. All example signing keys are generated in memory and discarded. Original account-linking route, page and schema are included as reference from the separate website release branch at a5ba9a17da0a481a60b9be02b8b5bd71d9207d7f. The local pilot and branch are distinct implementations. Deployment remains unverified.

**Observed result.** Eight local scenarios passed using disposable keys and two fixture applications. No partner-operated sign-in or physical-wallet check was performed.

```sh
node src/run.mjs
```

**Next acceptance check.** Complete both test apps, revoke one grant and confirm that a check-in pass cannot be redeemed twice.

**Owner and decision.** Chance owns the public release and approves campaign copy. Local two-app tests and actual website branch source are verified. A deployed issuer, recovery on iPhone and independent partner adoption remain outstanding.

This dated record describes the developer package. Verify remote commit and tree in the publication receipt before announcing a GitHub release.
