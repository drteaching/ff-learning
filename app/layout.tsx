import type { Metadata } from "next";
import "./globals.css";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: {
    default: "SCOLA",
    template: "%s · SCOLA",
  },
  description:
    "SCOLA — Structured Clinical Online Learning & Assessment. Multi-course clinical education for medical students, new-start doctors, and nurses.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col font-body">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
