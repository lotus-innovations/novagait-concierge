import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Novagait AI Concierge: a Lotus Innovations demo",
  description:
    "AI patient concierge demo. It gives grounded answers with citations, and books appointments through a visible automation chain. It also hands off to a human, and keeps an auditable admin panel. Fictional brand; all data synthetic.",
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
