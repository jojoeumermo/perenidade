// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { usePathname } from "next/navigation";
import Link from "@/components/Link";
import { localePath, type Locale } from "@/i18n/config";
import type { TextosDaFormacaoBase } from "@/i18n/escola/formacao-base";
import type { EscolaEuDentro } from "@/lib/escola/contratos";
import { preencher } from "@/lib/escola/textos";
import { COLUNA_DA_ESCOLA, TELAS_DA_FORMACAO, telaAberta } from "@/lib/escola/rotas";
import { Estrela } from "./FaixaDeCores";
import { CaixaDoModoDiscreto, type ModoDiscreto } from "./ModoDiscreto";
import { FecharCofre, useCofre } from "./CofreDaEscola";
import { SaidaDaEscola, VoltarAoSiteDaEscola } from "./SaidaDaEscola";

const semIdioma = (caminho: string) => caminho.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";

/** O logo da Escola: a estrela, "Escola Revolucionária / Lúcia Maria" e "Instituto Lúcia". Leva ao Hoje. */
export function LogoDaEscola({ lang, t, discreto, celular = false }: { lang: Locale; t: TextosDaFormacaoBase["casca"]; discreto: boolean; celular?: boolean }) {
  return (
    <Link href={localePath(lang, "/escola")} replace={discreto} className={celular ? "ef-logo ef-logo-celular" : "ef-logo"}>
      <Estrela tamanho={celular ? 28 : 36} traco={celular ? 3.6 : 3.4} />
      <span className="ef-logo-nome">
        <span className="ef-t ef-logo-olho">{t.escolaRev}</span>
        <span className="ef-t ef-logo-titulo">{t.luciaMaria}</span>
        {!celular && <span className="ef-logo-instituto">{t.instituto}</span>}
      </span>
    </Link>
  );
}

/**
 * A coluna lateral da Escola no computador (prancha Hoje): logo, Hoje, Formação, Núcleo, Biblioteca, Meu percurso,
 * A Frente, "Tirar uma dúvida", o modo discreto e, no pé, o codinome com o degrau e o núcleo. Logo abaixo do logo, o
 * "Voltar ao site"; no fim, o "Sair da escola", que encerra a sessão deste aparelho.
 */
export function ColunaDaEscola({ lang, t, eu, discreto }: { lang: Locale; t: TextosDaFormacaoBase["casca"]; eu: EscolaEuDentro; discreto: ModoDiscreto }) {
  const aberta = telaAberta(semIdioma(usePathname() ?? ""));
  const cofre = useCofre();
  const duvida = TELAS_DA_FORMACAO.find((x) => x.chave === "duvida")!;
  return (
    <nav aria-label={t.rotulo} className="ef-coluna">
      <LogoDaEscola lang={lang} t={t} discreto={discreto.ligado} />
      <VoltarAoSiteDaEscola lang={lang} t={t} />
      {COLUNA_DA_ESCOLA.map((tela) => (
        <Link
          key={tela.chave}
          href={localePath(lang, tela.caminho)}
          replace={discreto.ligado}
          aria-current={aberta === tela.chave ? "page" : undefined}
          className="ef-nav"
        >
          <span aria-hidden className="ef-nav-marca" style={{ background: tela.cor }} />
          {t.nav[tela.chave as keyof typeof t.nav]}
        </Link>
      ))}
      <Link href={localePath(lang, duvida.caminho)} replace={discreto.ligado} className="ef-botao-ouro ef-coluna-duvida" aria-current={aberta === "duvida" ? "page" : undefined}>
        {t.duvida}
      </Link>
      <CaixaDoModoDiscreto modo={discreto} rotulo={t.discreto} texto={t.discretoTexto} />
      <div className="ef-quem">
        {eu.codinome ? (
          <strong className="ef-quem-nome">{eu.codinome}</strong>
        ) : (
          <>
            <strong className="ef-quem-nome">{t.semCodinome}</strong>
            <Link href={localePath(lang, "/alumia/editar-perfil")} className="ef-quem-link">
              {t.escolherCodinome}
            </Link>
          </>
        )}
        <span className="ef-quem-linha">
          {preencher(t.degrau, { n: eu.degrau })} · {eu.nucleo?.nome ?? t.semNucleo}
        </span>
      </div>
      <FecharCofre t={t} estado={cofre} />
      <SaidaDaEscola lang={lang} t={t} />
    </nav>
  );
}
