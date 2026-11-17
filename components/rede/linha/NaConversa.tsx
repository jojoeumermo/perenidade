// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "@/components/Link";
import { linhaAberta } from "@/lib/rede/cliente-linha";
import type { OrdemDoFio } from "@/lib/rede/linha-aberta";
import { preencher } from "@/lib/rede/preencher";
import { faltaFuncaoNoBanco } from "@/lib/rede/reserva";
import type { TextosDaLinha } from "@/lib/rede/textos-linha";
import type { NoDaArvore } from "@/lib/rede/tipos-conversa";
import { previa } from "./base";

/**
 * As duas ordens a mais das respostas ("Úteis" e "Sem resposta"), ao lado de "Mais antigas" e "Mais novas" que a conversa já
 * tinha. Entram dentro do mesmo grupo de botões; a regra de cada uma fica escrita logo abaixo (RegraDaOrdem).
 */
export function OrdensAMais({ t, ordem, aoMudar }: { t: TextosDaLinha; ordem: OrdemDoFio; aoMudar: (o: OrdemDoFio) => void }) {
  return (
    <>
      <button type="button" aria-pressed={ordem === "uteis"} onClick={() => aoMudar("uteis")}>{t.conversa.uteis}</button>
      <button type="button" aria-pressed={ordem === "sem_resposta"} onClick={() => aoMudar("sem_resposta")}>{t.conversa.semResposta}</button>
    </>
  );
}

/** A regra da ordem escolhida, por extenso (só as duas ordens novas têm regra a explicar). */
export function RegraDaOrdem({ t, ordem }: { t: TextosDaLinha; ordem: OrdemDoFio }) {
  if (ordem !== "uteis" && ordem !== "sem_resposta") return null;
  return <p className="ro-ordem-regra" role="note">{ordem === "uteis" ? t.conversa.regraUteis : t.conversa.regraSemResposta}</p>;
}

export interface Ocultas {
  ids: ReadonlySet<string>;
  /** Quem está vendo abriu a conversa (só ela oculta e devolve). */
  pode: boolean;
  /** Oculta (ou devolve) uma resposta. Rejeita com o erro do banco. */
  mudar: (resposta: string, sim: boolean) => Promise<void>;
}

const NENHUMA: ReadonlySet<string> = new Set();

/**
 * As respostas que quem abriu a conversa tirou do fio (supabase/migracoes/20261113-alumia-o7-linha.sql, rede_roda_ocultas).
 * Desligado, banco sem a migração ou falha de rede: nenhuma (o fio aparece inteiro, como sempre). Na prévia, tudo fica só na
 * memória da página e `podeNaPrevia` diz se o post de exemplo é da pessoa.
 */
export function useOcultas(post: string, versao: number, ligada: boolean, podeNaPrevia: boolean): Ocultas {
  const [estado, setEstado] = useState<{ post: string; ids: ReadonlySet<string>; pode: boolean }>({ post, ids: NENHUMA, pode: false });
  useEffect(() => {
    if (!ligada || previa()) return;
    let vivo = true;
    linhaAberta.ocultas(post).then(
      (r) => vivo && setEstado({ post, ids: new Set(r.ids), pode: r.pode }),
      (e) => {
        if (vivo && !faltaFuncaoNoBanco(e)) setEstado({ post, ids: NENHUMA, pode: false });
      },
    );
    return () => {
      vivo = false;
    };
  }, [post, versao, ligada]);
  const mudar = useCallback(
    async (resposta: string, sim: boolean) => {
      if (!previa()) await linhaAberta.ocultar(resposta, sim);
      setEstado((e) => {
        const ids = new Set(e.post === post ? e.ids : NENHUMA);
        if (sim) ids.add(resposta);
        else ids.delete(resposta);
        return { post, ids, pode: e.post === post ? e.pode : false };
      });
    },
    [post],
  );
  const vale = ligada && estado.post === post;
  return { ids: vale ? estado.ids : NENHUMA, pode: ligada && (previa() ? podeNaPrevia : vale && estado.pode), mudar };
}

/** Tira do fio as respostas ocultadas (cada uma leva junto as respostas a ela) e devolve as duas partes. */
export function separarOcultas(nos: readonly NoDaArvore[], ocultas: ReadonlySet<string>): { fio: NoDaArvore[]; fora: NoDaArvore[] } {
  if (ocultas.size === 0) return { fio: nos as NoDaArvore[], fora: [] };
  const fora: NoDaArvore[] = [];
  const limpar = (lista: readonly NoDaArvore[]): NoDaArvore[] =>
    lista.flatMap((no) => {
      if (ocultas.has(no.post.id)) {
        fora.push(no);
        return [];
      }
      return [{ ...no, filhos: limpar(no.filhos) }];
    });
  return { fio: limpar(nos), fora };
}

/**
 * "Respostas ocultadas": o que quem abriu a conversa tirou do fio fica aqui, fechado, e qualquer pessoa pode abrir. Nada foi
 * apagado e ninguém foi avisado. Quem abriu a conversa devolve a resposta ao fio daqui mesmo.
 */
export function RespostasOcultadas({
  t,
  lang,
  nos,
  pode,
  aoDevolver,
}: {
  t: TextosDaLinha;
  lang: string;
  nos: readonly NoDaArvore[];
  pode: boolean;
  aoDevolver: (resposta: string) => void;
}) {
  if (nos.length === 0) return null;
  return (
    <details className="ro-ocultas">
      <summary>{nos.length === 1 ? t.conversa.ocultadasUma : preencher(t.conversa.ocultadas, { n: nos.length })}</summary>
      <p className="ro-ocultas-regra">{t.conversa.ocultadasRegra}</p>
      <ol className="ro-ocultas-lista">
        {nos.map((no) => (
          <li key={no.post.id} className="ro-oculta">
            <p className="ro-oculta-cabeca">
              <strong>{no.post.autor.codinome}</strong>
              {no.post.autor.handle && <span>@{no.post.autor.handle}</span>}
            </p>
            <p className="ro-oculta-texto">{no.post.texto}</p>
            <div className="ro-oculta-acoes">
              <Link href={`/${lang}/alumia/p/${no.post.id}`} className="ro-acao">{t.fora.abrir}</Link>
              {pode && (
                <button type="button" className="ro-acao" onClick={() => aoDevolver(no.post.id)}>{t.conversa.mostrar}</button>
              )}
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}
