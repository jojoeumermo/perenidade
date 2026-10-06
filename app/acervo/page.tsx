import Link from "next/link";
import { areas, books } from "@/lib/data";

export const metadata = { title: "Acervo — Perenidade" };

export default async function Acervo({ searchParams }: PageProps<"/acervo">) {
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().toLowerCase();
  const area = typeof sp.area === "string" ? sp.area : "";

  const results = books.filter(
    (b) =>
      (!area || b.area === area) &&
      (!q || `${b.title} ${b.author} ${b.synopsis}`.toLowerCase().includes(q)),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Índice de obras</p>
      <h1 className="mt-2 text-5xl font-semibold">Acervo</h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-soft">
        Apenas metadados e links para fontes legítimas. Não hospedamos arquivos de terceiros.
      </p>

      <form className="mt-8 flex flex-wrap gap-3 font-sans text-sm">
        <input
          name="q"
          defaultValue={q}
          placeholder="Título, autor…"
          className="min-w-60 flex-1 border-2 border-ink bg-parchment-deep px-3 py-2 font-mono outline-none"
        />
        <select name="area" defaultValue={area} className="border-2 border-ink bg-parchment-deep px-3 py-2">
          <option value="">Todas as áreas</option>
          {areas.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <button className="bg-ink px-6 py-2 text-parchment hover:bg-oxblood">Filtrar</button>
      </form>

      <p className="mt-6 font-mono text-xs text-ink-soft">{results.length} resultado(s)</p>
      <ul className="mt-4 grid gap-5 md:grid-cols-2">
        {results.map((b) => (
          <li key={b.id} className="border border-rule bg-parchment-deep p-6">
            <p className="font-mono text-xs text-gold">
              {b.area} · {b.license}
            </p>
            <h2 className="mt-2 text-2xl font-semibold">{b.title}</h2>
            <p className="italic text-ink-soft">{b.author}</p>
            <p className="mt-3">{b.synopsis}</p>
            <div className="mt-4 flex items-center justify-between font-sans text-sm">
              <a href={b.externalUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-oxblood">
                Ler em {b.source} ↗
              </a>
              <Link href={`/denunciar?item=${b.id}`} className="text-ink-soft hover:text-oxblood">
                Denunciar
              </Link>
            </div>
          </li>
        ))}
      </ul>
      {results.length === 0 && <p className="mt-8 text-xl text-ink-soft">Nada encontrado. Tente outro termo.</p>}
    </div>
  );
}
