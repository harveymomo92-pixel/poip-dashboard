import { APP_TIMEZONE } from "@poip/domain";

export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Milestone 0 Foundation</p>
        <h1>PPIC Output Intelligence Platform</h1>
        <p>
          Production-grade command center foundation for output monitoring, target achievement,
          downtime, data quality, sync, and audit workflows.
        </p>
        <dl className="facts">
          <div>
            <dt>Timezone</dt>
            <dd>{APP_TIMEZONE}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>Foundation skeleton</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
