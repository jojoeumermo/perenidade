// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "@/components/Link";
import { localePath, type Locale } from "@/i18n/config";
import type { TextosDaBiblioteca } from "@/i18n/escola/biblioteca";
import { preencher } from "@/lib/escola/textos";
import { EscolherFrente } from "./EscolherFrente";
import { type CartaoDaAssembleia, diaPorExtenso } from "./frentes";

/**
 * A tela A Frente (prancha Frente, 07/11), na ordem da prancha: o cartaz vermelho "A Escola forma. A Frente organiza."
 * com o manifesto e Quem foi Lúcia Maria (páginas da Onda 3, só linkadas), as frentes de atuação (a sua em destaque) e
 * os três cartões: Assembleia do semestre, Ouvidoria e "Seus dados, com cuidado" (LGPD). O que é do militante (a frente
 * dele e as somas) vem do banco no navegador (EscolherFrente); o servidor só manda texto público e a situação da
 * assembleia, que já é pública (content/escola/assembleia.json).
 */
export function TelaDaFrente({ lang, t, assembleia }: { lang: Locale; t: TextosDaBiblioteca["frente"]; assembleia: CartaoDaAssembleia }) {
  const a = t.assembleia;
  return (
    <div className="ef6-tela" data-escola-escura="" data-tela-da-escola="frente">
      <section aria-labelledby="ef6-frente-titulo" className="ef6-cartaz">
        <div className="ef6-cartaz-texto">
          <span className="ef-t ef6-cartaz-olho">{t.eyebrow}</span>
          <h1 id="ef6-frente-titulo" className="ef-t">
            {t.titulo}
          </h1>
        </div>
        <div className="ef6-cartaz-acoes">
          <Link href={localePath(lang, "/escola/manifesto")} className="ef6-cheio">
            {t.manifesto}
          </Link>
          <Link href={localePath(lang, "/escola/quem-foi-lucia-maria")} className="ef6-vazado">
            {t.quemFoi}
          </Link>
        </div>
      </section>

      <section aria-labelledby="ef6-frentes" className="ef6-secao">
        <h2 id="ef6-frentes" className="ef-t ef6-h2 ef6-h2-frentes">
          {t.frentesTitulo}
        </h2>
        <EscolherFrente t={t} />
      </section>

      <div className="ef6-cartoes">
        <section aria-labelledby="ef6-assembleia" className="ef6-cartao ef6-cartao-giz">
          <h2 id="ef6-assembleia" className="ef-t">
            {a.titulo}
          </h2>
          <p>
            {assembleia.situacao === "aberta"
              ? assembleia.ate
                ? preencher(a.aberta, { data: diaPorExtenso(lang, assembleia.ate) })
                : a.aConfirmar
              : assembleia.situacao === "fechada"
                ? a.fechada
                : a.semPauta}
            {assembleia.situacao === "aberta" && assembleia.aConfirmar && assembleia.ate && ` ${a.aConfirmar}`} {a.voto}
          </p>
          <Link href={localePath(lang, "/escola/assembleia")}>{a.ver}</Link>
        </section>
        <section aria-labelledby="ef6-ouvidoria" className="ef6-cartao ef6-cartao-borda">
          <h2 id="ef6-ouvidoria" className="ef-t">
            {t.ouvidoria.titulo}
          </h2>
          <p>{t.ouvidoria.texto}</p>
          <Link href={localePath(lang, "/escola/ouvidoria")}>{t.ouvidoria.botao}</Link>
        </section>
        <section aria-labelledby="ef6-dados" className="ef6-cartao ef6-cartao-fundo">
          <h2 id="ef6-dados" className="ef-t">
            {t.dados.titulo}
          </h2>
          <p>{t.dados.texto}</p>
        </section>
      </div>
    </div>
  );
}
