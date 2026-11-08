// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/Link";
import { AcoesDoCaderno } from "@/components/escola/formacao/AcoesDoCaderno";
import { LadoAeB, type LadoDoCaderno } from "@/components/escola/formacao/LadoAeB";
import { linksDaTrilha, MaterialDoCaderno, type LinkDoMaterial } from "@/components/escola/formacao/MaterialDoCaderno";
import { RodaDoCaderno } from "@/components/escola/formacao/RodaDoCaderno";
import { TarefaDoCaderno } from "@/components/escola/formacao/TarefaDoCaderno";
import { cadernoVisto, tempoSomado, type CadernoVisto } from "@/components/escola/formacao/vista";
import { originalLang } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { defaultLocale, localePath, type Locale } from "@/i18n/config";
import { textosDaFormacao, type TextosDaFormacao } from "@/i18n/escola/formacao";
import { textosDaFormacaoBase } from "@/i18n/escola/formacao-base";
import { getTrack } from "@/lib/content";
import { CADERNOS_DA_ESCOLA, TELAS_DA_ESCOLA } from "@/lib/escola/contratos";
import { preencher } from "@/lib/escola/textos";
import { paginaMeta } from "@/lib/seo";
import "@/components/escola/formacao/formacao.css";

type Props = PageProps<"/[lang]/escola/formacao/[caderno]">;

export const dynamicParams = false;

export function generateStaticParams() {
  return CADERNOS_DA_ESCOLA.map((c) => ({ caderno: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const { caderno } = await params;
  const c = CADERNOS_DA_ESCOLA.find((x) => x.slug === caderno);
  if (!c) return {};
  const t = textosDaFormacao(lang);
  const nome = textosDaFormacaoBase(lang).hoje.cadernos[c.numero - 1];
  return { ...paginaMeta(lang, `/escola/formacao/${c.slug}`, preencher(t.meta.caderno, { n: String(c.numero).padStart(2, "0"), nome }), t.meta.formacaoDescricao), robots: { index: false } };
}

/** Os dois lados do caderno, com o resumo de cada um ("6 aulas · ~1h20" ou "10 partes · 80 aulas"). */
function ladosDe(c: CadernoVisto, t: TextosDaFormacao["caderno"]): LadoDoCaderno[] {
  const curso = c.contagem.tipo === "curso";
  return (["A", "B"] as const).map((lado) => {
    const titulo = curso ? (lado === "A" ? t.semestre1 : t.semestre2) : lado === "A" ? t.ladoA : t.ladoB;
    if (c.forma === "grupos") {
      const grupos = c.grupos.filter((g) => g.lado === lado);
      return { lado, titulo, resumo: preencher(t.resumoGrupos, { grupos: grupos.length, n: grupos.reduce((s, g) => s + g.aulas.length, 0) }), aulas: [], grupos };
    }
    const aulas = c.plano.filter((a) => a.lado === lado);
    const prontas = aulas.filter((a) => a.href);
    const minutos = prontas.reduce((s, a) => s + (a.minutos ?? 0), 0);
    return { lado, titulo, resumo: preencher(t.resumoLado, { n: aulas.length, tempo: tempoSomado(minutos, t.minutos) }), aulas, grupos: [] };
  });
}

function materialDe(lang: Locale, c: CadernoVisto): LinkDoMaterial[] {
  if (c.trilha) {
    const pt = getTrack(c.trilha, defaultLocale);
    const temProva = (pt?.lessons ?? []).reduce((s, l) => s + l.quiz.length, 0) >= 10;
    return linksDaTrilha(c.trilha, c.prontas[0]?.id ?? null, temProva);
  }
  return [{ chave: "biblioteca", href: TELAS_DA_ESCOLA.biblioteca }, { chave: "aberta", href: c.contagem.tipo === "etapas" ? "/consciencia" : "/cursos/ano-de-formacao-politica" }].filter((l) => l.href) as LinkDoMaterial[];
}

/**
 * /escola/formacao/[caderno] (pranchas Caderno e Cel-Caderno): o caderno aberto, em papel, com o patrono (quando há), o
 * selo da contagem real, o lado A e o lado B, continuar, ouvir, baixar e imprimir; ao lado, a tarefa no mundo com a ficha
 * de registro, a roda no núcleo, o material e o "Travou?". Só militante vê (a porta do layout decide); o servidor manda
 * só conteúdo público (as mesmas aulas de /trilhas).
 */
export default async function Caderno({ params }: Props) {
  const { lang, t: site } = await loadLang(params);
  const { caderno: slug } = await params;
  const t = textosDaFormacao(lang);
  const base = textosDaFormacaoBase(lang);
  const c = cadernoVisto(lang, slug, base.hoje.cadernos, site.despertar.lead);
  if (!c) notFound();
  const n = String(c.numero).padStart(2, "0");
  const g = t.formacao.degraus[c.degrau - 1];
  const tc = t.caderno;
  const selo =
    c.contagem.tipo === "trilha"
      ? [preencher(tc.seloLinha1, { prontas: c.contagem.prontas, previstas: c.contagem.previstas }), tc.seloLinha2]
      : [c.contagem.tipo === "etapas" ? preencher(t.formacao.conta.etapas, { n: c.contagem.etapas }) : t.formacao.conta.curso];
  const contaCurta = c.contagem.tipo === "trilha" ? `${selo[0]} ${selo[1]}` : selo[0];

  return (
    <div className="eff-caderno" data-escola-escura="" data-tela-da-escola="caderno">
      <nav aria-label={tc.caminho} className="eff-migalhas ef-so-computador">
        <Link href={localePath(lang, TELAS_DA_ESCOLA.hoje)}>{tc.escola}</Link> / <Link href={localePath(lang, TELAS_DA_ESCOLA.formacao)}>{tc.formacao}</Link> / {g.rotulo} · {g.nome}
      </nav>
      <div className="eff-voltar-celular">
        <Link href={localePath(lang, TELAS_DA_ESCOLA.formacao)} aria-label={tc.voltar} className="eff-voltar-seta">
          <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <span>
          {g.rotulo} · {g.nome}
        </span>
      </div>

      <div className="eff-caderno-grade">
        <article className="eff-papel">
          <div aria-hidden className="eff-espiral" />
          <div className="eff-papel-corpo">
            <div className="eff-papel-cabeca">
              <div>
                <span className="eff-olho ef-so-computador">{preencher(tc.olho, { n, d: c.degrau, degrau: g.nome.toLocaleUpperCase(lang) })}</span>
                <span className="eff-olho ef-so-celular">{preencher(tc.olhoCurto, { n, conta: contaCurta.toLocaleUpperCase(lang) })}</span>
                <h1 className="ef-t eff-papel-titulo">{c.nome}</h1>
                {c.patrono && <p className="eff-patrono">{preencher(tc.patrono, { nome: c.patrono })}</p>}
                {c.resumo && (
                  <p className="eff-resumo" {...originalLang(c.resumoTraduzido)}>
                    {c.resumo}
                  </p>
                )}
              </div>
              <span className="eff-carimbo ef-so-computador">
                {selo.map((linha, i) => (
                  <span key={i}>{linha}</span>
                ))}
              </span>
            </div>

            {c.prontas.length === 0 && <p className="eff-sem-aulas">{tc.semAulas}</p>}
            <LadoAeB lang={lang} lados={ladosDe(c, tc)} prontas={c.prontas} t={tc} />
            <AcoesDoCaderno lang={lang} nome={c.nome} numero={c.numero} prontas={c.prontas} t={tc} />
          </div>
        </article>

        <aside aria-label={tc.pratica} className="eff-lado-direito">
          <TarefaDoCaderno lang={lang} caderno={c.slug} texto={tc.tarefa.lista[c.numero - 1]} t={tc.tarefa} />
          <RodaDoCaderno lang={lang} t={tc.roda} />
          <MaterialDoCaderno lang={lang} links={materialDe(lang, c)} t={tc.material} />
          <section aria-labelledby="eff-travou" className="eff-cartao eff-travou">
            <h2 id="eff-travou" className="ef-t">
              {tc.travou.titulo}
            </h2>
            <p>{tc.travou.texto}</p>
            <Link href={localePath(lang, TELAS_DA_ESCOLA.duvida)}>{tc.travou.link}</Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
