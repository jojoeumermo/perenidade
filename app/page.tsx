import Link from "next/link";
import { TrackCard } from "@/components/Cards";
import { ContinueCard } from "@/components/Progress";
import { areas } from "@/lib/areas";
import { getBooks, getTracks } from "@/lib/content";
import { getHistory } from "@/lib/history";
import { formatDate } from "@/lib/text";

const pillars = [
  ["Sem PDFs de terceiros", "O acervo indexa obras de domínio público e licenças abertas, apontando para fontes legítimas."],
  ["Moderação transparente", "Toda contribuição passa por revisão pública. Aprovar é aceitar uma mudança; tudo é revertível pelo Git."],
  ["Sem dados sensíveis", "Não há conta nem senha. Seu progresso fica só no seu navegador."],
];

export default function Home() {
  const tracks = getTracks();
  const books = getBooks();
  const lessons = tracks.reduce((sum, t) => sum + t.lessons.length, 0);
  const recent = getHistory().slice(0, 3);

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pt-16 pb-12 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Biblioteca de Alexandria · edição comunitária</p>
        <h1 className="mt-5 text-5xl font-semibold leading-[1.05] sm:text-7xl">
          Todo o conhecimento,<br />
          <span className="italic text-oxblood">para todos</span>, para sempre.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-xl text-ink-soft">
          Aprenda de graça. Contribua se quiser. Nada se perde: cada aula é versionada, revisada pela comunidade e preservada.
        </p>
        <form action="/busca" role="search" className="mx-auto mt-10 flex max-w-xl border-2 border-ink bg-parchment-deep">
          <input
            name="q"
            type="search"
            aria-label="Buscar em todo o acervo"
            placeholder="Busque em todo o acervo…"
            className="min-w-0 flex-1 bg-transparent px-4 py-3 font-mono text-sm outline-none placeholder:text-ink-soft"
          />
          <button className="cursor-pointer bg-ink px-6 font-sans text-sm font-medium text-parchment hover:bg-oxblood">Buscar</button>
        </form>
        <p className="mt-5 font-mono text-xs text-ink-soft">
          {tracks.length} trilhas · {lessons} aulas · {books.length} obras indexadas
        </p>
      </section>

      <ContinueCard />

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="border-b border-rule pb-3 text-3xl font-semibold">As estantes</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {areas.map((area) => {
            const areaLessons = tracks.filter((t) => t.area === area.slug).reduce((sum, t) => sum + t.lessons.length, 0);
            const areaBooks = books.filter((b) => b.area === area.slug).length;
            return (
              <Link
                key={area.slug}
                href={`/estantes/${area.slug}`}
                className="group border border-rule bg-parchment-deep p-6 transition hover:-translate-y-0.5 hover:border-gold"
              >
                <p className="font-mono text-xs text-gold">
                  {areaLessons} {areaLessons === 1 ? "aula" : "aulas"} · {areaBooks} {areaBooks === 1 ? "obra" : "obras"}
                </p>
                <h3 className="mt-2 text-2xl font-semibold group-hover:text-oxblood">{area.name}</h3>
                <p className="mt-1 text-ink-soft">{area.blurb}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule pb-3">
          <h2 className="text-3xl font-semibold">Comece por uma trilha</h2>
          <Link href="/trilhas" className="font-sans text-sm underline hover:text-oxblood">Ver todas</Link>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {tracks.slice(0, 3).map((track) => (
            <TrackCard key={track.slug} track={track} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="border border-rule bg-parchment-deep p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-3xl font-semibold">Linha do tempo do acervo</h2>
            <Link href="/historico" className="font-sans text-sm underline hover:text-oxblood">Histórico completo</Link>
          </div>
          <p className="mt-1 font-mono text-xs text-ink-soft">como o Wayback Machine: toda versão fica guardada</p>
          <ol className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-start">
            {recent.map((change) => (
              <li key={change.hash} className="flex-1 border-t-2 border-gold pt-3">
                <p className="font-mono text-sm text-gold">{formatDate(change.date)}</p>
                <p className="text-lg">{change.subject}</p>
              </li>
            ))}
            <li className="flex-1 border-t-2 border-dashed border-gold pt-3">
              <p className="font-mono text-sm text-gold">em breve</p>
              <p className="text-lg">
                <Link href="/contribuir" className="underline hover:text-oxblood">Sua contribuição entra aqui</Link>
              </p>
            </li>
          </ol>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-10 font-sans md:grid-cols-3">
        {pillars.map(([title, description]) => (
          <div key={title} className="border-l-2 border-gold pl-4">
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-ink-soft">{description}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 text-center">
        <h2 className="text-4xl font-semibold">Ajude a construir a biblioteca</h2>
        <p className="mx-auto mt-3 max-w-xl text-lg text-ink-soft">
          Escreva uma aula, indique uma obra livre ou corrija um erro. Tudo passa por revisão antes de entrar.
        </p>
        <Link href="/contribuir" className="mt-6 inline-block bg-oxblood px-8 py-3 font-sans text-sm font-medium text-parchment hover:bg-ink">
          Enviar uma contribuição
        </Link>
      </section>
    </>
  );
}
