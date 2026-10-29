// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { hasBackend, rpc } from "@/lib/backend";
import { NOME_VITRINE } from "@/lib/mural-saude";
import { getItem, KEYS, parse, setItem, useStored } from "@/lib/storage";
import { EnfeiteDaFesta } from "./Festa";
import { useI18n } from "./I18n";

interface Saved {
  faixa?: string;
  pausa?: boolean;
  motivo?: string;
  em?: number;
}

/** De quanto em quanto tempo o navegador pergunta de novo se a coordenação mudou alguma coisa. */
const FRESH = 10 * 60 * 1000;

/**
 * O texto da faixa para um endereço (sem o idioma): o padrão mais parecido da lista, em que "*" vale por um trecho.
 * Entre dois que servem, ganha o que tem mais trechos escritos por extenso ("/trilhas/x/prova" é prova, não aula);
 * sem nenhum, vale o do começo do endereço ("/apoie/anterior" usa o de "/apoie").
 */
export function faixaDaPagina(trechos: string[], faixas: Record<string, string>): string | null {
  const padroes = Object.keys(faixas).map((chave) => ({ chave, partes: chave.split("/").filter(Boolean) }));
  for (let n = trechos.length; n > 0; n--) {
    let melhor: { chave: string; exatos: number } | null = null;
    for (const { chave, partes } of padroes) {
      if (partes.length !== n) continue;
      let exatos = 0;
      let serve = true;
      for (let i = 0; i < n; i++) {
        if (partes[i] === trechos[i]) exatos++;
        else if (partes[i] !== "*") {
          serve = false;
          break;
        }
      }
      if (serve && (!melhor || exatos > melhor.exatos)) melhor = { chave, exatos };
    }
    if (melhor) return faixas[melhor.chave];
  }
  return null;
}

/**
 * A faixa escura do alto. Na página inicial, o texto de sempre (ou o que a coordenação escreveu); em cada outra
 * página, uma linha dizendo do que ela trata. Se a coordenação pausou os envios, o aviso vem embaixo.
 * Cinco toques seguidos aqui acionam a saída rápida (veja Shortcuts). Logo abaixo corre o fio das fitas e, nos dias
 * de festa, o enfeite da data.
 */
export function Strip({ fallback, faixas }: { fallback: string; faixas: Record<string, string> }) {
  const { t } = useI18n();
  const saved = parse<Saved>(useStored(KEYS.site), {});
  const trechos = (usePathname() ?? "").split("/").filter(Boolean).slice(1);
  // No Mural de Saúde, a faixa só diz o que o mural é: nada de chamada do instituto nem de gratuidade.
  const noMural = trechos[0] === "saude";
  const texto = noMural ? `${NOME_VITRINE} · contatos de profissionais com registro ativo` : trechos.length === 0 ? saved.faixa || fallback : faixaDaPagina(trechos, faixas) || fallback;

  useEffect(() => {
    if (!hasBackend) return;
    if (Date.now() - (parse<Saved>(getItem(KEYS.site), {}).em ?? 0) < FRESH) return;
    let cancelled = false;
    rpc<Saved>("site")
      .then((valor) => {
        if (!cancelled) setItem(KEYS.site, JSON.stringify({ faixa: valor.faixa, pausa: valor.pausa, motivo: valor.motivo, em: Date.now() }));
      })
      .catch(() => {
        // Sem resposta, fica o texto que veio com a página.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {saved.pausa && (
        <p role="status" className="bg-[#c21f16] px-4 py-1.5 text-center font-sans text-xs font-semibold text-white">
          {t.errors.envios_pausados}
          {saved.motivo && ` ${saved.motivo}`}
        </p>
      )}
      <div className="relative">
        {/* A faixa preta fica sempre no alto (os cinco toques nela são a saída rápida no celular). */}
        <div data-saida className={`faixa-de-avisos bg-[#1f1a14] px-4 py-2 text-center font-mono text-[0.72rem] uppercase tracking-[0.08em] text-[#e9dcbc] max-md:truncate max-md:px-3 max-md:py-1.5 max-md:text-[0.62rem]`}>
          {texto}
        </div>
        {/* O fio das fitas: quatro pixels de cor, como as fitas amarradas na grade da igreja. */}
        <div aria-hidden className="fio-das-fitas" />
        <EnfeiteDaFesta />
      </div>
    </>
  );
}
