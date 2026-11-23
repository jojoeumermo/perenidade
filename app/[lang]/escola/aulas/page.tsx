// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { textosDasAulasAbertas } from "@/i18n/escola/aulas";
import { type AreaSlug } from "@/lib/areas";
import { corDaCapa } from "@/lib/capas";
import { getTracks } from "@/lib/content";
import { GRUPOS_DA_ESCOLA_ABERTA, caminhoDaEstante } from "@/lib/escola/aulas-abertas";
import { preencher } from "@/lib/escola/textos";
import { paginaMeta } from "@/lib/seo";
import "@/styles/escola-aulas.css";

export async function generateMetadata({ params }: PageProps<"/[lang]/escola/aulas">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDasAulasAbertas(lang);
  return paginaMeta(lang, "/escola/aulas", s.metaTitulo, s.metaDescricao);
}

/**
 * /escola/aulas (P5, B2): as estantes de Teoria revolucionária e de Lutas do povo, que saíram do site do instituto e moram na
 * Escola, abertas para ler sem conta (lib/escola/aulas-abertas.ts). A porta deixa passar (publicaDaEscola) e a moldura é a da
 * porta pública, também para militante. Nada aqui é de militante: são as mesmas aulas públicas de sempre.
 */
export default async function AulasAbertas({ params }: PageProps<"/[lang]/escola/aulas">) {
  const { lang, t } = await loadLang(params);
  const s = textosDasAulasAbertas(lang);
  const trilhas = getTracks(lang);
  const prontas = (area: string) => trilhas.filter((tr) => tr.area === area).reduce((soma, tr) => soma + tr.lessons.length, 0);
  const grupos = (["teoria", "lutas"] as const).map((id) => ({ id, titulo: t.groups[id], areas: GRUPOS_DA_ESCOLA_ABERTA[id] as readonly AreaSlug[] }));
  return (
    <div className="efl-aulas" data-escola-escura="" data-aulas-abertas="">
      <header className="efl-cabeca">
        <span className="ef-t efl-olho">{s.olho}</span>
        <h1 className="ef-t efl-titulo">{s.titulo}</h1>
        <p className="efl-lead">{s.lead}</p>
        <p className="efl-nota">{s.semRastro}</p>
      </header>
      {grupos.map((g) => (
        <section key={g.id} aria-labelledby={`efl-${g.id}`} className="efl-grupo">
          <h2 id={`efl-${g.id}`} className="ef-t efl-grupo-titulo">
            <span aria-hidden>★</span> {g.titulo} <span className="efl-conta">{preencher(s.disciplinas, { n: g.areas.length })}</span>
          </h2>
          <ul className="efl-grade">
            {g.areas.map((area) => (
              <li key={area}>
                <Link href={localePath(lang, caminhoDaEstante(area))} className="efl-cartao" style={{ "--efl-cor": corDaCapa(area) } as React.CSSProperties}>
                  <span className="ef-t efl-nome">{t.areas[area][0]}</span>
                  <span className="efl-descricao">{t.areas[area][1]}</span>
                  <span className="efl-aulas-n">{preencher(s.contagem, { n: prontas(area) })} →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <aside aria-labelledby="efl-cadastro" className="efl-cadastro">
        <h2 id="efl-cadastro" className="ef-t">
          {s.cadastroTitulo}
        </h2>
        <p>{s.cadastroTexto}</p>
        <Link href={localePath(lang, "/escola")} className="ef-botao-ouro">
          {s.cadastroBotao}
        </Link>
      </aside>
    </div>
  );
}
