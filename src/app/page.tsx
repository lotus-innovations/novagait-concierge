import Script from "next/script";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <h1>Novagait AI Concierge</h1>
      <p className={styles.lede}>
        An AI patient concierge for the Novagait Physical Therapy demo clinic.
        It gives grounded answers with citations, and books appointments through
        a visible automation chain. It also hands off to a human, and keeps an
        auditable admin panel.
      </p>
      <p>
        Try it with the chat launcher in the corner of this page, or use the{" "}
        <a href="/chat">standalone chat page</a>. The same widget is embedded
        cross-origin on the clinic site at{" "}
        <a href="https://demo.lotusinnovations.io">demo.lotusinnovations.io</a>.
      </p>
      <Script src="/widget.js" strategy="afterInteractive" data-ngc-auto="1" />
      <p className={styles.disclaimer}>
        Demonstration project by Lotus Innovations. &ldquo;Novagait&rdquo; is a
        fictional brand; all data is synthetic. Not affiliated with any real
        clinic or entity.
      </p>
    </main>
  );
}
