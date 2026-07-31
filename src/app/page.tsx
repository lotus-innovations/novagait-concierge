import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <h1>Novagait AI Concierge</h1>
      <p className={styles.lede}>
        An AI patient concierge for the Novagait Physical Therapy demo clinic:
        grounded answers with citations, appointment booking with a visible
        automation chain, human handoff, and an auditable admin panel.
      </p>
      <p>
        The chat experience is under construction — this skeleton proves the
        deploy path. The finished widget will also be embedded on the clinic
        site at{" "}
        <a href="https://demo.lotusinnovations.io">demo.lotusinnovations.io</a>.
      </p>
      <p className={styles.disclaimer}>
        Demonstration project by Lotus Innovations. &ldquo;Novagait&rdquo; is a
        fictional brand; all data is synthetic. Not affiliated with any real
        clinic or entity.
      </p>
    </main>
  );
}
