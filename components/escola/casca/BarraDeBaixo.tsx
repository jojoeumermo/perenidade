// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { usePathname } from "next/navigation";
import Link from "@/components/Link";
import { localePath, type Locale } from "@/i18n/config";
import type { TextosDaFormacaoBase } from "@/i18n/escola/formacao-base";
import { BARRA_DA_ESCOLA, telaAberta } from "@/lib/escola/rotas";
import { LogoDaEscola } from "./ColunaDaEscola";
import { SaidaDaEscola, VoltarAoSiteDaEscola } from "./SaidaDaEscola";

const semIdioma = (caminho: string) => caminho.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";

/** A cabeça da Escola no celular (prancha Cel-Hoje): o logo, "Site", "Sair" e o "?" que leva a "Tirar uma dúvida". */
export function CabecaDoCelular({ lang, t, discreto }: { lang: Locale; t: TextosDaFormacaoBase["casca"]; discreto: boolean }) {
  return (
    <header className="ef-cabeca-celular">
      <LogoDaEscola lang={lang} t={t} discreto={discreto} celular />
      <VoltarAoSiteDaEscola lang={lang} t={t} celular />
      <SaidaDaEscola lang={lang} t={t} celular />
      <Link href={localePath(lang, "/escola/duvida")} replace={discreto} aria-label={t.duvida} className="ef-botao-pergunta">
        ?
      </Link>
    </header>
  );
}

/** A barra de baixo no celular: Hoje · Formação · Núcleo · Biblioteca · Eu (Eu = Meu percurso). */
export function BarraDeBaixo({ lang, t, discreto }: { lang: Locale; t: TextosDaFormacaoBase["casca"]; discreto: boolean }) {
  const aberta = telaAberta(semIdioma(usePathname() ?? ""));
  return (
    <nav aria-label={t.rotulo} className="ef-barra">
      {BARRA_DA_ESCOLA.map((tela) => (
        <Link key={tela.chave} href={localePath(lang, tela.caminho)} replace={discreto} aria-current={aberta === tela.chave ? "page" : undefined} className="ef-barra-item">
          <span aria-hidden className="ef-barra-marca" style={{ background: aberta === tela.chave ? "#F2C94C" : tela.cor }} />
          {tela.chave === "percurso" ? t.nav.eu : t.nav[tela.chave as keyof typeof t.nav]}
        </Link>
      ))}
    </nav>
  );
}
