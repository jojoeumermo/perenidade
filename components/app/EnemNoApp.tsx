// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { FaltamDias } from "@/components/enem/FaltamDias";
import { L } from "@/components/I18n";
import { fill } from "@/i18n/config";
import type { Locale } from "@/i18n/config";
import { formatarFato } from "@/lib/enem";
import { classificacoesDoEnem, edicaoDoEnem, redacaoDoEnem, simuladosDoEnem } from "@/lib/enem-conteudo";
import { getTracks } from "@/lib/content";
import { textosDoEstudo } from "@/lib/textos-estudo";

/**
 * A porta do curso ENEM dentro do aplicativo: quanto falta, e os caminhos (comece, diagnóstico, plano, prática, provas,
 * simulados, redação, reta final, dia da prova). As trilhas abrem no leitor do app; as práticas e provas seguem nas
 * páginas do site (saída explícita, enquanto não têm tela própria). Mesmos dados e textos do site: nada é copiado.
 */
export function EnemNoApp({ lang }: { lang: Locale }) {
  const s = textosDoEstudo(lang).s.enem;
  const edicao = edicaoDoEnem();
  const f = edicao.fatos;
  const trilhas = getTracks(lang).filter((tr) => tr.area === "enem");
  const trilha = (slug: string) => trilhas.find((tr) => tr.slug === slug && tr.lessons.length > 0);
  const noApp = (slug: string) => `/app/estudar/enem/${slug}`;
  const itens: { titulo: string; texto: string; href?: string; extra?: string }[] = [
    { titulo: s.secoes.comece, texto: s.secoes.comeceTexto, href: trilha("enem-como-funciona") ? noApp("enem-como-funciona") : undefined },
    { titulo: s.secoes.diagnostico, texto: s.secoes.diagnosticoTexto, href: simuladosDoEnem() ? "/enem/diagnostico" : undefined },
    { titulo: s.secoes.plano, texto: s.secoes.planoTexto, href: "/enem/plano" },
    { titulo: s.secoes.praticar, texto: s.secoes.praticarTexto, href: classificacoesDoEnem().length ? "/enem/praticar" : undefined, extra: classificacoesDoEnem().length ? fill(s.classificadas, { n: classificacoesDoEnem().length }) : undefined },
    { titulo: s.secoes.provas, texto: s.secoes.provasTexto, href: "/enem/provas" },
    { titulo: s.secoes.simulados, texto: s.secoes.simuladosTexto, href: simuladosDoEnem() ? "/enem/simulados" : undefined },
    { titulo: s.secoes.redacao, texto: s.secoes.redacaoTexto, href: trilha("enem-redacao") ? noApp("enem-redacao") : undefined },
    { titulo: s.secoes.oficina, texto: s.secoes.oficinaTexto, href: redacaoDoEnem().propostas.length ? "/enem/redacao" : undefined },
    { titulo: s.secoes.retaFinal, texto: s.secoes.retaFinalTexto, href: trilha("enem-reta-final") ? noApp("enem-reta-final") : undefined },
    { titulo: s.secoes.diaDaProva, texto: s.secoes.diaDaProvaTexto, href: "/enem/dia-da-prova" },
  ];
  return (
    <>
      <section className="app-secao app-enem-contagem" aria-label={s.titulo}>
        <FaltamDias
          dia1={String(f["aplicacao-dia-1"].valor)}
          dia2={String(f["aplicacao-dia-2"].valor)}
          d={{ d1: formatarFato(f["aplicacao-dia-1"]), d2: formatarFato(f["aplicacao-dia-2"]), ano: edicao.edicao, gabarito: formatarFato(f["gabarito-prazo"]) }}
          s={s}
        />
        <p className="app-item-aux app-item-aux-livre">{fill(s.datasProva, { d1: formatarFato(f["aplicacao-dia-1"]), d2: formatarFato(f["aplicacao-dia-2"]) })}</p>
      </section>
      <section className="app-secao" aria-label={s.titulo}>
        <ul className="app-lista">
          {itens.map((i) => (
            <li key={i.titulo}>
              {i.href ? (
                <L href={i.href} className="app-item-lista">
                  <span className="app-item-texto">
                    <span className="app-item-titulo">{i.titulo}</span>
                    <span className="app-item-aux">{i.texto}</span>
                    {i.extra && <span className="app-item-aux app-item-aux-livre">{i.extra}</span>}
                  </span>
                  <span aria-hidden className="app-item-num">→</span>
                </L>
              ) : (
                <div className="app-item-lista app-item-em-breve">
                  <span className="app-item-texto">
                    <span className="app-item-titulo">{i.titulo}</span>
                    <span className="app-item-aux">{s.emBreve}</span>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
