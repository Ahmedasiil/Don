import Link from "next/link";

/** The oenodpay wordmark. tone "white" on ink backgrounds. */
export function Logo({ className = "h-7 w-auto", tone = "ink", href }: { className?: string; tone?: "ink" | "white"; href?: string }) {
  const img = <img src={tone === "white" ? "/brand/oenodpay-logo-white.svg" : "/brand/oenodpay-logo.svg"} alt="oenodpay" className={className} />;
  return href ? <Link href={href} aria-label="oenodpay home" className="inline-flex shrink-0 items-center">{img}</Link> : img;
}
