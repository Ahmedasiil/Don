import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of use" };

// A starting draft. Have counsel review before launch, and add each partner's required terms.
export default function Terms() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <article className="prose-op">
        <h1 className="font-display text-[36px] font-semibold tracking-[-.025em]">Terms of use</h1>
        <p className="text-[#667085]">Draft for review. Last updated {new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}.</p>
        <h2>About oenodpay</h2>
        <p>oenodpay is a financial technology company, not a bank. Money services, cards, investing and lending are provided with licensed partners, whose terms also apply when you use those features.</p>
        <h2>Your account</h2>
        <p>You must be of legal age where you live, verify your identity, and keep your password, PIN and authenticator codes secret. Tell us right away if you think someone else has used your account, and freeze it in the app.</p>
        <h2>Payments and transfers</h2>
        <p>We show the exchange rate, fees and expected delivery time before you confirm. We may hold or refuse a payment to protect you or to meet the law.</p>
        <h2>Investing</h2>
        <p>Investments can go down as well as up, and you may get back less than you put in. Nothing in the app is investment advice.</p>
        <h2>Loans</h2>
        <p>Loans are subject to approval. The rate, payment and total cost are shown before you apply. Missed payments can affect your oenodpay score.</p>
        <h2>Rewards</h2>
        <p>Cash back and referral bonuses clear after a short period and can be reversed if the purchase is refunded or the referral doesn't qualify.</p>
        <h2>Contact</h2>
        <p>Questions or complaints: help@oenodpay.com or the Help section of the app.</p>
      </article>
    </main>
  );
}
