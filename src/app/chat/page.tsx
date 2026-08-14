import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Chat: Novagait AI Concierge",
  description:
    "Standalone chat page for the Novagait AI concierge demo. It gives grounded answers with citations, booking, and human handoff. Fictional brand; all data synthetic.",
};

/**
 * Standalone chat page (spec 01 task 6): mounts the same widget bundle the
 * clinic site embeds, in inline mode filling the page.
 */
export default function ChatPage() {
  return (
    <main className={styles.main}>
      <h1 className={styles.heading}>Novagait AI Concierge</h1>
      <p className={styles.hint}>
        Standalone chat for the{" "}
        <Link href="/">Novagait Physical Therapy demo clinic</Link>. The same
        widget is embedded on the clinic site at{" "}
        <a href="https://demo.lotusinnovations.io">demo.lotusinnovations.io</a>.
      </p>
      <div id="chat-root" className={styles.chatRoot} />
      <Script
        src="/widget.js"
        strategy="afterInteractive"
        data-ngc-auto="1"
        data-ngc-mode="inline"
        data-ngc-target="#chat-root"
      />
    </main>
  );
}
