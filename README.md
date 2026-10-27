# oenodpay

Send money worldwide, hold a card, pay bills, invest, build credit, earn rewards and book travel, in one secure app.

This repo holds all of oenodpay:

| Part | Where | What it is |
| --- | --- | --- |
| Website and customer app | `apps/web` (`/`, `/app`) | Next.js. Public landing page, sign-up, and the full customer app. |
| Super admin | `apps/web` (`/admin`) | Customers, compliance, payouts, bills, investing, credit, rewards, travel, audit log, pricing and the Plugin centre for provider keys. |
| API | `apps/web` (`/api`) | One API used by the website and the phone app. |
| Mobile app | `apps/mobile` | Expo app for iPhone and Android. A web preview is served at `/mobile`. |

## Features

- **Wallet:** add money (card or bank), send worldwide (bank, mobile wallets, InstaPay, Vodafone Cash, cash pickup), request money, statements and CSV export.
- **Cards:** virtual and physical cards, freeze, limits, cash back.
- **Bills:** billers by country, saved payees, scheduled and monthly payments.
- **Invest:** stocks, ETFs and crypto, with buy, sell, portfolio and a halal filter.
- **Credit:** a daily oenodpay score with tips, personal loans reviewed by a person, and repayments.
- **Rewards:** cash back and invite bonuses, moved to the wallet any time.
- **Travel:** an AI travel agent, flight and hotel search and booking, and travel eSIMs.
- **Family:** teen cards with rules. **Oeno coach:** an AI money coach.
- **Security:** two-step sign-in, ID verification, payment PIN, step-up codes for large amounts, new-device caps, sanctions screening and self-freeze.

## Run it locally

See [docs/INSTALL.md](docs/INSTALL.md).

Provider keys (Stripe, Airwallex, Thunes, Alpaca, Duffel, Airalo, Anthropic and others) are added by the super admin in **Admin, Plugin centre**. Pricing is set in **Admin, Plugin centre, Pricing**. Never commit keys.
