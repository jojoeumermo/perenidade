// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import type { LinhaMontada, ModoDaLinha } from "@/lib/rede/linha-aberta";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaLinha } from "@/lib/rede/textos-linha";
import { Icone } from "../publicar/alumia2/icones";
import { descreverLinha, TrocaDeModo } from "./base";

/** O caminho para "Como a linha é montada" (na barra, ou ao lado do "Abrir sempre nesta aba"). */
export function LinkDaRegra({ lang, t }: { lang: string; t: TextosDaLinha }) {
  return (
    <Link href={`/${lang}/alumia/como-a-linha`} className="ro-barra-regra">
      <Icone nome="ajuda" className="h-4 w-4" />
      {t.modo.comoMontada}
    </Link>
  );
}

/**
 * A barra que fica entre as abas e os posts do Início: a troca "Em roda / Ordem de chegada" (a escolha fica só no aparelho), o
 * caminho para "Como a linha é montada" e as linhas que a pessoa fixou. Com uma linha aberta, a barra diz por extenso o que
 * entra nela (o filtro nunca fica escondido) e como voltar para a aba. Com `semRegra`, o caminho fica ao lado do "Abrir sempre
 * nesta aba" (Rede.tsx), em vez de ocupar uma linha sozinho.
 */
export function BarraDaLinha({
  lang,
  t,
  modo,
  aoModo,
  linhas,
  ativa,
  aoLinha,
  nomeDaAba,
  semRegra = false,
}: {
  lang: string;
  t: TextosDaLinha;
  modo: ModoDaLinha;
  aoModo: (m: ModoDaLinha) => void;
  linhas: LinhaMontada[];
  /** A linha montada aberta agora (nulo = a aba de sempre). */
  ativa: LinhaMontada | null;
  aoLinha: (l: LinhaMontada | null) => void;
  nomeDaAba: string;
  /** O "Como a linha é montada" vai para a linha do "Abrir sempre nesta aba" (Rede.tsx), e não fica aqui sozinho. */
  semRegra?: boolean;
}) {
  const naBarra = linhas.filter((l) => l.fixada);
  return (
    <div className="ro-barra">
      {/* Uma faixa só: a ordem, as linhas fixadas (e o atalho para montar) e, no fim, como a linha é montada. */}
      <div className="ro-barra-faixa">
        <TrocaDeModo t={t} modo={modo} aoMudar={aoModo} />
        <div className="ro-barra-linhas" role="group" aria-label={t.barra.rotulo}>
          {naBarra.map((l) => (
            <button key={l.id} type="button" className="ro-ficha" aria-pressed={ativa?.id === l.id} onClick={() => aoLinha(ativa?.id === l.id ? null : l)}>
              <span className="ro-ficha-ponto" aria-hidden />
              {l.nome}
            </button>
          ))}
          <Link href={`/${lang}/alumia/linhas`} className="ro-ficha ro-ficha-montar">
            <Icone nome={naBarra.length ? "pontos" : "mais"} className="h-4 w-4" />
            {naBarra.length ? t.barra.todas : t.barra.montar}
          </Link>
        </div>
        {!semRegra && <LinkDaRegra lang={lang} t={t} />}
      </div>
      {ativa && (
        <p className="ro-barra-aberta" role="status">
          <span>
            <strong>{preencher(t.barra.naLinha, { nome: ativa.nome })}</strong> {descreverLinha(t, ativa.base, ativa.filtro)}
          </span>
          <button type="button" className="ro-barra-sair" onClick={() => aoLinha(null)}>
            <Icone nome="fechar" className="h-4 w-4" />
            {preencher(t.barra.sair, { aba: nomeDaAba })}
          </button>
        </p>
      )}
    </div>
  );
}
