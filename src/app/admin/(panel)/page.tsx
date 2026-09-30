import Link from "next/link";
import s from "../admin.module.css";
import { PAGES } from "@/lib/content/fields";
import { getStore } from "@/lib/store";

export default async function Dashboard() {
  const content = await getStore().getContent();
  const updated = new Date(content.updatedAt);
  return (
    <>
      <h1 className={s.h1}>What would you like to change?</h1>
      <p className={s.lead}>
        Pick a page. Changes go live on the site as soon as you press Save. Last saved{" "}
        <time dateTime={content.updatedAt}>
          {updated.toLocaleString("en-US", { dateStyle: "long", timeStyle: "short", timeZone: "America/Los_Angeles" })}
        </time>{" "}
        (Pacific time).
      </p>
      <ul className={s.cards}>
        {PAGES.map((p) => (
          <li key={p.key}>
            <Link className={s.card} href={`/admin/${p.key}`}>
              <span className={s.cardTitle}>{p.title}</span>
              <p className={s.cardText}>
                {p.key === "portfolio" ? `${content.portfolio.artworks.length} paintings. ` : ""}
                {p.description}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
