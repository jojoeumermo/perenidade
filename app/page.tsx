import Link from "next/link";

const shelves = [
  { name: "Inglês", count: 42, blurb: "Do alfabeto à conversação." },
  { name: "História", count: 38, blurb: "Da Antiguidade ao mundo atual." },
  { name: "Informática", count: 27, blurb: "Como os computadores funcionam." },
  { name: "Programação", count: 61, blurb: "Lógica, web e além." },
  { name: "Matemática", count: 19, blurb: "Do básico ao raciocínio formal." },
  { name: "Literatura", count: 54, blurb: "Clássicos em domínio público." },
];

const snapshots = [
  ["2026", "Fundação do acervo"],
  ["2026", "Primeiras trilhas da comunidade"],
  ["—", "Sua contribuição entra aqui"],
];

const pillars = [
  ["Sem PDFs de terceiros", "O acervo indexa obras de domínio público e licenças abertas, apontando para fontes legítimas."],
  ["Moderação imutável", "Contribuições viram rascunhos. Aprovar é só mudar um status; tudo é revertível pelo Git."],
  ["Sem dados sensíveis", "Login social, sem senhas. O que não guardamos, ninguém pode vazar."],
];

export default function Home() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pt-16 pb-12 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Biblioteca de Alexandria · edição comunitária</p>
        <h1 className="mt-5 text-5xl sm:text-7xl font-semibold leading-[1.05]">
          Todo o conhecimento,<br />
          <span className="text-oxblood italic">para todos</span>, para sempre.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-xl text-ink-soft">
          Aprenda de graça. Contribua se quiser. Nada se perde: cada aula é versionada, revisada pela comunidade e preservada.
        </p>
        <form action="/acervo" className="mx-auto mt-10 flex max-w-xl border-2 border-ink bg-parchment-deep">
          <input
            name="q"
            placeholder="Busque em todo o acervo…"
            className="flex-1 bg-transparent px-4 py-3 font-mono text-sm outline-none placeholder:text-ink-soft"
          />
          <button className="bg-ink px-6 font-sans text-sm font-medium text-parchment hover:bg-oxblood">Buscar</button>
        </form>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="text-3xl font-semibold border-b border-rule pb-3">As estantes</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shelves.map((s) => (
            <Link
              key={s.name}
              href={`/acervo?area=${encodeURIComponent(s.name)}`}
              className="group border border-rule bg-parchment-deep p-6 transition hover:-translate-y-0.5 hover:border-gold"
            >
              <p className="font-mono text-xs text-gold">{s.count} itens</p>
              <h3 className="mt-2 text-2xl font-semibold group-hover:text-oxblood">{s.name}</h3>
              <p className="mt-1 text-ink-soft">{s.blurb}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="border border-rule bg-parchment-deep p-8">
          <h2 className="text-3xl font-semibold">Linha do tempo do acervo</h2>
          <p className="mt-1 font-mono text-xs text-ink-soft">como o Wayback Machine: toda versão fica guardada</p>
          <ol className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-start">
            {snapshots.map(([year, label], i) => (
              <li key={i} className="flex-1 border-t-2 border-gold pt-3">
                <p className="font-mono text-sm text-gold">{year}</p>
                <p className="text-lg">{label}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 grid gap-6 md:grid-cols-3 font-sans">
        {pillars.map(([t, d]) => (
          <div key={t} className="border-l-2 border-gold pl-4">
            <h3 className="font-semibold">{t}</h3>
            <p className="mt-1 text-sm text-ink-soft">{d}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 text-center">
        <h2 className="text-4xl font-semibold">Ajude a construir a biblioteca</h2>
        <Link href="/contribuir" className="mt-6 inline-block bg-oxblood px-8 py-3 font-sans text-sm font-medium text-parchment hover:bg-ink">
          Enviar uma aula
        </Link>
      </section>
    </>
  );
}
