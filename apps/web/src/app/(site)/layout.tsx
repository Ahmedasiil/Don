import Link from "next/link";

// The public website: header and footer around the landing and legal pages.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-white text-[#0B1020]">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#080B14]/90 text-white backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-6 px-4 sm:px-6">
          <Link href="/" aria-label="oenodpay home"><img src="/brand/oenodpay-logo-white.svg" alt="oenodpay" className="h-6 w-auto" /></Link>
          <nav className="hidden flex-1 items-center gap-6 text-[13.5px] font-medium text-white/70 md:flex">
            <a href="/#send" className="hover:text-white">Send</a><a href="/#card" className="hover:text-white">Card</a><a href="/#grow" className="hover:text-white">Invest and credit</a><a href="/#travel" className="hover:text-white">Travel</a><a href="/#security" className="hover:text-white">Security</a><a href="/#pricing" className="hover:text-white">Pricing</a>
          </nav>
          <span className="flex-1 md:hidden" />
          <Link href="/signin" className="text-[13.5px] font-semibold text-white/80 hover:text-white">Sign in</Link>
          <Link href="/signup" className="rounded-full bg-white px-4 py-2 text-[13.5px] font-semibold text-[#0B1020] hover:bg-white/90">Open account</Link>
        </div>
      </header>
      {children}
      <footer className="bg-[#080B14] text-white/60">
        <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div><img src="/brand/oenodpay-logo-white.svg" alt="oenodpay" className="h-6 w-auto" /><p className="mt-4 max-w-xs text-[13px] leading-relaxed">One secure app to send, spend, save and grow your money. Launching in Canada and the United States.</p></div>
          {[["Product", [["Send money", "/#send"], ["Card", "/#card"], ["Bill pay", "/#bills"], ["Invest", "/#grow"], ["Travel", "/#travel"]]], ["Company", [["Security", "/#security"], ["Pricing", "/#pricing"], ["Help", "/signin?next=/app/help"]]], ["Legal", [["Privacy", "/legal/privacy"], ["Terms", "/legal/terms"]]]].map(([h, links]) => (
            <div key={h as string}><b className="text-[12px] uppercase tracking-[.14em] text-white/40">{h as string}</b><ul className="mt-3 space-y-2 text-[13.5px]">{(links as string[][]).map(([l, href]) => <li key={l}><a href={href} className="hover:text-white">{l}</a></li>)}</ul></div>
          ))}
        </div>
        <div className="mx-auto max-w-[1200px] border-t border-white/10 px-4 py-6 text-[11.5px] leading-relaxed text-white/40 sm:px-6">
          © {new Date().getFullYear()} oenodpay. oenodpay is a financial technology company, not a bank. Money services are provided with licensed partners. Investing involves risk, including loss of money. Loans subject to approval. Rewards terms apply.
        </div>
      </footer>
    </div>
  );
}
