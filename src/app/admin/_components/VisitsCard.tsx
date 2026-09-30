import s from "../admin.module.css";
import { accessTokenShape, fetchVisitStats, statsConfig, type StatRow, type VisitStats } from "@/lib/stats/goatcounter";

const fmt = (n: number) => n.toLocaleString("en-US");

/** Site visitors from GoatCounter. Never breaks the dashboard: any failure shows a short note. */
export async function VisitsCard() {
  const cfg = statsConfig();
  let stats: VisitStats | null = null;
  if (cfg) {
    try {
      stats = await fetchVisitStats(cfg);
    } catch (err) {
      console.error("Visit stats unavailable:", err instanceof Error ? err.message : err, JSON.stringify(accessTokenShape(cfg)));
    }
  }
  return (
    <section className={s.section} aria-labelledby="visits-title">
      <h2 id="visits-title" className={s.sectionTitle}>
        Visitors
      </h2>
      {stats ? <VisitsBody stats={stats} /> : <p className={s.cardText}>Stats unavailable right now.</p>}
    </section>
  );
}

export function VisitsBody({ stats }: Readonly<{ stats: VisitStats }>) {
  return (
    <>
      <dl className={s.statTotals}>
        <div>
          <dt>Last 7 days</dt>
          <dd>{fmt(stats.last7)}</dd>
        </div>
        <div>
          <dt>Last 30 days</dt>
          <dd>{fmt(stats.last30)}</dd>
        </div>
        <div>
          <dt>All time</dt>
          <dd>{fmt(stats.allTime)}</dd>
        </div>
      </dl>
      <div className={s.statLists}>
        <TopList title="Top pages" rows={stats.pages} />
        <TopList title="Coming from" rows={stats.referrers} />
        <TopList title="Countries" rows={stats.countries} />
      </div>
      <p className={s.cardText}>Lists cover the last 30 days. Your own visits are not counted.</p>
    </>
  );
}

function TopList({ title, rows }: Readonly<{ title: string; rows: StatRow[] }>) {
  return (
    <div>
      <h3 className={s.statListTitle}>{title}</h3>
      {rows.length ? (
        <ol className={s.statList}>
          {rows.map((r) => (
            <li key={r.name}>
              <span>{r.name}</span>
              <span>{fmt(r.count)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className={s.cardText}>None yet.</p>
      )}
    </div>
  );
}
