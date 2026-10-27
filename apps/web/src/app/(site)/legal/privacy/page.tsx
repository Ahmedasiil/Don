import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy policy" };

// A starting draft. Have counsel review before launch (PIPEDA, Quebec Law 25, CCPA, GLBA).
export default function Privacy() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <article className="prose-op">
        <h1 className="font-display text-[36px] font-semibold tracking-[-.025em]">Privacy policy</h1>
        <p className="text-[#667085]">Draft for review. Last updated {new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}.</p>
        <h2>What we collect</h2>
        <p>Your name, contact details, date of birth, address and government ID (to verify who you are, as the law requires); your transactions, recipients and devices (to run your account and keep it safe); and how you use the app (to improve it).</p>
        <h2>Why we use it</h2>
        <ul><li>To open and run your account, move your money and provide the services you ask for.</li><li>To meet our legal duties, including identity verification, sanctions screening and reporting to FINTRAC and other regulators.</li><li>To protect you and us from fraud.</li><li>To send you offers, only if you said yes. You can change that any time in Profile.</li></ul>
        <h2>Who we share it with</h2>
        <p>Only the partners we need to provide the service (payment, card, identity, investing, travel and messaging providers), regulators and law enforcement when the law requires it. We never sell your personal information.</p>
        <h2>How we protect it</h2>
        <p>Encryption in transit and at rest, two-step sign-in on every account, strict staff access with a full audit log, and card numbers that never touch our servers.</p>
        <h2>Your rights</h2>
        <p>You can ask to see, correct or delete your information, or withdraw consent, by writing to privacy@oenodpay.com. Some records must be kept for at least five years by law.</p>
      </article>
    </main>
  );
}
