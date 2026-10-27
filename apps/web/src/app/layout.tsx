import type { Metadata, Viewport } from "next";
import { Sora, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { ToastProvider } from "@/components/ui";
import { APP_URL } from "@/lib/env";
import "./globals.css";

const display = Sora({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Plus_Jakarta_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-body", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: { default: "oenodpay: send, spend, save and grow your money", template: "%s · oenodpay" },
  description: "Send money to 150+ countries, a metal card, bill pay, investing, credit and travel in one secure app. Built in Canada.",
  applicationName: "oenodpay",
  icons: { icon: "/brand/oenodpay-icon.svg", apple: "/brand/oenodpay-icon-1024.png" },
  openGraph: { siteName: "oenodpay", type: "website" },
};
export const viewport: Viewport = { themeColor: "#0B1020", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-dvh antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
