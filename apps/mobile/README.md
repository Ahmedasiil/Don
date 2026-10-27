# oenodpay mobile app (iOS and Android)

The oenodpay app for iPhone and Android, built with Expo. It talks to the oenodpay web server's `/api` routes, so every feature (wallet, send, request, bills, cards, invest, credit, rewards, travel, eSIM, family, coach, security) uses the same rules, limits and ledger as the website.

## Run it

```sh
pnpm install           # from the repo root
pnpm --filter @oenodpay/mobile start
```

Scan the QR code with Expo Go, or press `i` / `a` for a simulator. Set `expo.extra.apiUrl` in `app.json` to your oenodpay web address (for local work, your machine's LAN address, e.g. `http://192.168.1.20:3000`).

## Ship it

1. `npx eas-cli@latest init` and paste the project id into `app.json` (`extra.eas.projectId`).
2. `pnpm --filter @oenodpay/mobile build:ios` and `build:android`.
3. `submit:ios` / `submit:android` send the builds to App Store Connect and Google Play.

Bundle id: `com.oenodpay.app`. Deep links use the `oenodpay://` scheme.
