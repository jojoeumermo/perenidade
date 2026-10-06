import Link from "next/link";
import { notFound } from "next/navigation";
import { defaultBody, lessonBodies, tracks } from "@/lib/data";

export function generateStaticParams() {
  return tracks.flatMap((t) => t.lessons.map((l) => ({ track: t.slug, lesson: l.slug })));
}

export default async function LessonPage({ params }: PageProps<"/trilhas/[track]/[lesson]">) {
  const { track, lesson } = await params;
  const t = tracks.find((x) => x.slug === track);
  const idx = t?.lessons.findIndex((l) => l.slug === lesson) ?? -1;
  if (!t || idx < 0) notFound();

  const current = t.lessons[idx];
  const prev = t.lessons[idx - 1];
  const next = t.lessons[idx + 1];
  const body = lessonBodies[lesson] ?? defaultBody;

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[16rem_1fr]">
      <aside className="font-sans text-sm md:sticky md:top-6 md:self-start">
        <Link href="/trilhas" className="text-ink-soft hover:text-oxblood">← Trilhas</Link>
        <h2 className="mt-3 text-xl font-semibold">{t.title}</h2>
        <ol className="mt-4 space-y-1 border-l border-rule">
          {t.lessons.map((l, i) => (
            <li key={l.slug}>
              <Link
                href={`/trilhas/${t.slug}/${l.slug}`}
                className={`-ml-px block border-l-2 py-1 pl-3 ${
                  i === idx ? "border-oxblood font-semibold text-oxblood" : "border-transparent hover:text-oxblood"
                }`}
              >
                {l.title}
              </Link>
            </li>
          ))}
        </ol>
      </aside>

      <article className="max-w-prose">
        <p className="font-mono text-xs text-gold">
          {t.area} · aula {idx + 1} de {t.lessons.length}
        </p>
        <h1 className="mt-2 text-5xl font-semibold">{current.title}</h1>
        <div className="mt-8 space-y-5 text-xl leading-relaxed">
          {body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <nav className="mt-12 flex justify-between border-t border-rule pt-6 font-sans text-sm">
          {prev ? <Link href={`/trilhas/${t.slug}/${prev.slug}`} className="hover:text-oxblood">← {prev.title}</Link> : <span />}
          {next ? <Link href={`/trilhas/${t.slug}/${next.slug}`} className="hover:text-oxblood">{next.title} →</Link> : <span />}
        </nav>
      </article>
    </div>
  );
}
