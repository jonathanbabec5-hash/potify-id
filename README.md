# Potify ID

## Find your way in

| If you are… | Start here | Try this |
| --- | --- | --- |
| A community organizer | [Run the two-app pilot](#setup-and-usage) | See a fixture for contribution credit and a screening pass. |
| A developer | [Read the pilot](src/pilot.mjs) | Trace the permission and pass through issue and redemption. |
| A community builder | [Explore the Greenhouse beta](https://github.com/jonathanbabec5-hash/potify-holder-hub) | Compare the separate beta’s data model with this identity pilot. |

[Complete repository directory tree](docs/DIRECTORY.md)

## Credit that can travel without carrying a whole identity

Someone tends a community project and later turns up at a screening. The organizer might need to know they earned a badge. They do not need every address the person has used. Potify ID makes that distinction concrete in two small fixture apps.

In the [two-app pilot](src/pilot.mjs), a member can have different identifiers in different apps. The [local demonstration](src/run.mjs) generates disposable keys, grants a particular disclosure and exercises an attendance pass. That lets a developer follow what the organizer actually sees without recruiting a real attendee.

Trace a pass from issue to redemption and then look at a second redemption attempt. Write down what each app learned and which permission made that possible. Eight local scenarios were recorded; a deployed issuer, physical-device recovery and independent adoption still need their own evidence.

**Two-app pilot and website integration source.** Let someone carry credit for a contribution from the Greenhouse to a creator screening.

### Setup and usage

Use Node.js 24 for the included checks.

```sh
node src/run.mjs
```

Run the two-app example. 

### Developer entry points

A fixture maps proven wallets to a single member, derives app-specific subjects, tracks grants and redeems a single-use attendance pass. Explore `reference/`, `src/` in the full tree.

### Verification

Eight local scenarios passed using disposable keys and two fixture applications. No partner-operated sign-in or physical-wallet check was performed.

```sh
node src/run.mjs
```

### Release scope

Local two-app tests and actual website branch source are verified. A deployed issuer, recovery on iPhone and independent partner adoption remain outstanding. POTIFY_ID_Partner_Pilot.zip, November 23. Portable two-app identity fixture. All example signing keys are generated in memory and discarded. Original account-linking route, page and schema are included as reference from the separate website release branch at a5ba9a17da0a481a60b9be02b8b5bd71d9207d7f. The local pilot and branch are distinct implementations. Deployment remains unverified.

[Technical whitepaper](docs/WHITEPAPER.md) · [Marketing and sales plan](docs/MARKETING.md) · [Dated developer log](docs/BUILD-LOG.md)

Existing asset and code terms remain applicable. Public access to a recording, illustration, brand or manuscript does not itself grant commercial reuse rights.
