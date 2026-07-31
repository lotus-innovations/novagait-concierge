import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Novagait AI Concierge — Lotus Innovations demo",
  description:
    "AI patient concierge demo: grounded answers with citations, booking with a visible automation chain, human handoff, and an auditable admin panel. Fictional brand; all data synthetic.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
