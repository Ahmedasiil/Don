"use client";
import Link from "next/link";
import { GROUPS } from "../shell";

// Everything in the app, for the phone's "More" tab.
export default function More() {
  return (
    <div className="space-y-6">
      {GROUPS.map((g) => (
        <section key={g.label}>
          <div className="pay-label mb-2 px-1">{g.label}</div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {g.items.map(([href, label, I]) => (
              <Link key={href} href={href} className="card flex flex-col items-center gap-2 px-2 py-4 text-center hover:border-[#CDD2DC]">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-[#F2F4F7]"><I className="h-5 w-5" strokeWidth={1.9} /></span>
                <span className="text-[12.5px] font-semibold leading-tight">{label}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
