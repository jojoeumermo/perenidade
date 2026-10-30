// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/Link";
import { PageHeading } from "@/components/PageHeading";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { fill, localePath } from "@/i18n/config";
import { type Fato, formatarFato } from "@/lib/enem";
import { edicaoDoEnem } from "@/lib/enem-conteudo";
import { ligado } from "@/lib/recursos";
import { paginaMeta } from "@/lib/seo";
import { textosDoEstudo } from "@/lib/textos-estudo";

export async function generateMetadata({ params }: PageProps<"/[lang]/enem/dia-da-prova">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const { s } = textosDoEstudo(lang);
  return paginaMeta(lang, "/enem/dia-da-prova", s.enem.diaDaProva.titulo, s.enem.diaDaProva.lead);
}

const GRUPOS: { titulo: "horarios" | "levar" | "naoValem" | "envelope" | "naSala" | "redacao" | "seAlgoDerErrado"; fatos: string[] }[] = [
  { titulo: "horarios", fatos: ["aplicacao-dia-1", "aplicacao-dia-2", "portoes-abertura", "portoes-fechamento", "porta-da-sala", "prova-inicio", "prova-fim-dia-1", "prova-fim-dia-2", "horario-de-brasilia"] },
  { titulo: "levar", fatos: ["documentos-aceitos", "caneta"] },
  { titulo: "naoValem", fatos: ["documentos-recusados"] },
  { titulo: "envelope", fatos: ["envelope-porta-objetos"] },
  { titulo: "naSala", fatos: ["saida-minima", "levar-caderno", "tres-ultimos", "rasura", "rascunho-nao-conta"] },
  { titulo: "redacao", fatos: ["redacao-linhas", "redacao-minimo", "redacao-zero"] },
  { titulo: "seAlgoDerErrado", fatos: ["reaplicacao-doencas", "reaplicacao-mal-estar", "reaplicacao-data", "gabarito-prazo", "resultado-data"] },
];

/** O dia da prova, todo lido de content/enem/edicao.yml, cada item com a fonte oficial e a data da conferência. */
export default async function Page({ params }: PageProps<"/[lang]/enem/dia-da-prova">) {
  if (!ligado("enem-curso")) notFound();
  const { lang, t } = await loadLang(params);
  const { s: todos, traduzido } = textosDoEstudo(lang);
  const s = todos.enem;
  const d = s.diaDaProva;
  const edicao = edicaoDoEnem();
  const data = (iso: string) => iso.split("-").reverse().join("/");
  const item = (f: Fato) => {
    const fonte = edicao.fontes[f.fonte];
    return (
      <li key={f.id} className="border-b border-rule py-3">
        <p className="font-semibold">{f.afirmacao}</p>
        {f.tipo === "lista" && Array.isArray(f.valor) ? (
          <ul className="mt-1 list-disc pl-5">
            {f.valor.map((v) => <li key={v}>{v}</li>)}
          </ul>
        ) : (
          <p className={f.valor === undefined ? "mt-1 text-oxblood" : "mt-1"}>{f.valor === undefined ? d.confirmar : formatarFato(f)}</p>
        )}
        {f.nota && <p className="mt-1 text-ink-soft">{f.nota}</p>}
        <p className="mt-1 font-mono text-[0.7rem] text-ink-soft">
          {d.fonte}: <a href={fonte.url} className="underline hover:text-oxblood" rel="noopener noreferrer">{fonte.titulo}</a>
          {f.item ? `, item ${f.item}` : ""} · {fill(d.conferido, { data: data(f.conferido) })}
        </p>
      </li>
    );
  };
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeading eyebrow={s.titulo} title={d.titulo} voltar={{ href: localePath(lang, "/enem"), texto: s.titulo }}>
        {d.lead}
      </PageHeading>
      <Untranslated lang={lang} t={t} show={!traduzido} />
      {GRUPOS.map((g) => (
        <section key={g.titulo} className="mt-8 font-sans text-sm">
          <h2 className="font-serif text-2xl font-semibold">{d[g.titulo]}</h2>
          <ul className="mt-2">{g.fatos.map((id) => edicao.fatos[id]).filter(Boolean).map(item)}</ul>
        </section>
      ))}
      <p className="mt-8 font-sans text-sm">
        <Link href={localePath(lang, "/trilhas/enem-reta-final/a-vespera-e-o-dia-da-prova")} className="underline hover:text-oxblood">{d.veja} →</Link>
      </p>
    </div>
  );
}
