import Link from "next/link";
import { tracks } from "@/lib/data";

export const metadata = { title: "Trilhas — Perenidade" };

export default function Trilhas() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Aprendizado guiado</p>
      <h1 className="mt-2 text-5xl font-semibold">Trilhas</h1>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {tracks.map((t) => (
          <section key={t.slug} className="border border-rule bg-parchment-deep p-6">
            <p className="font-mono text-xs text-gold">
              {t.area} · {t.level}
            </p>
            <h2 className="mt-2 text-3xl font-semibold">{t.title}</h2>
            <p className="mt-1 text-ink-soft">{t.summary}</p>
            <ol className="mt-5 space-y-2 font-sans text-sm">
              {t.lessons.map((l, i) => (
                <li key={l.slug}>
                  <Link href={`/trilhas/${t.slug}/${l.slug}`} className="flex gap-3 hover:text-oxblood">
                    <span className="font-mono text-gold">{String(i + 1).padStart(2, "0")}</span>
                    {l.title}
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
