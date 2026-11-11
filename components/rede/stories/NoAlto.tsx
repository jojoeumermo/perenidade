// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import "./stories.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { CHAVES_DOS_STORIES, enderecosDosStories, lerExtrasDoCriar, lerPedidoDoEndereco } from "@/lib/rede/stories/enderecos";
import type { Situacao } from "@/lib/rede/tipos";
import type { AutoraDoStory } from "@/lib/rede/tipos-stories";
import { Criar } from "./Criar";
import { FaixaDeStories } from "./FaixaDeStories";
import { Visor } from "./Visor";
import { enderecoAqui, useClienteDosStories, useTextosDosStories } from "./usar";

/** O que está aberto por cima da faixa: nada, o visor de alguém ou o "criar". */
type Aberto =
  | { tipo: "nada" }
  | { tipo: "ver"; handle: string; i: number; fila: string[]; autoras?: Record<string, AutoraDoStory> }
  | { tipo: "criar"; post: string | null; extras?: ReturnType<typeof lerExtrasDoCriar> };

function lerAberto(): Aberto {
  const p = lerPedidoDoEndereco(new URLSearchParams(window.location.search));
  if (p.criar) return { tipo: "criar", post: p.post, extras: lerExtrasDoCriar(new URLSearchParams(window.location.search)) };
  if (p.ver) return { tipo: "ver", handle: p.ver, i: p.i, fila: [] };
  return { tipo: "nada" };
}

/**
 * O mesmo pedido (?ver=nome&i=0, ?criar=1; "?ver=@nome" também é aceito ao abrir) no endereço da tela onde a faixa está: na
 * linha de Início fica /alumia?ver=…, na tela dos stories /alumia/stories?ver=… (e no host próprio, /?ver=…). As outras chaves
 * da busca (?aba=) ficam.
 */
function aqui(modelo: string | null): string {
  if (!modelo) return enderecoAqui(null, CHAVES_DOS_STORIES);
  const pedido: Record<string, string> = {};
  new URLSearchParams(modelo.slice(modelo.indexOf("?") + 1)).forEach((v, k) => (pedido[k] = v));
  return enderecoAqui(pedido, CHAVES_DOS_STORIES);
}

/**
 * Os stories abertos a partir do endereço: o que está por cima, abrir (empilha uma entrada no histórico, para o voltar do
 * celular fechar em vez de sair da Alumia) e fechar (volta no histórico).
 */
export function useStoriesAbertos(lang: string) {
  const [aberto, setAberto] = useState<Aberto>({ tipo: "nada" });
  const [versao, setVersao] = useState(0);
  /** Quantas entradas o visor/criar pôs no histórico (para o fechar voltar em vez de empilhar). */
  const empilhados = useRef(0);

  // O que o endereço pede (e de novo ao voltar/avançar no navegador).
  useEffect(() => {
    const ler = () => {
      empilhados.current = 0;
      setAberto(lerAberto());
    };
    ler();
    window.addEventListener("popstate", ler);
    return () => window.removeEventListener("popstate", ler);
  }, []);

  const ir = useCallback((novo: Aberto, modelo: string) => {
    const url = aqui(modelo);
    if (empilhados.current > 0) window.history.replaceState(window.history.state, "", url);
    else {
      window.history.pushState(window.history.state, "", url);
      empilhados.current = 1;
    }
    setAberto(novo);
  }, []);
  const fechar = useCallback(() => {
    if (empilhados.current > 0) {
      empilhados.current = 0;
      window.history.back();
    } else window.history.replaceState(window.history.state, "", aqui(null));
    setAberto({ tipo: "nada" });
    setVersao((v) => v + 1);
  }, []);
  const mudou = useCallback(() => setVersao((v) => v + 1), []);
  const abrir = useCallback(
    (handle: string, i: number, fila: string[], autoras?: Record<string, AutoraDoStory>) => ir({ tipo: "ver", handle, i, fila, autoras }, enderecosDosStories.ver(lang, handle, i)),
    [ir, lang],
  );
  const criar = useCallback(() => ir({ tipo: "criar", post: null }, enderecosDosStories.criar(lang)), [ir, lang]);
  /**
   * O visor passou para outra pessoa (ou outro story): só o endereço muda (replaceState, sem nova entrada no histórico e sem
   * remontar o visor), para recarregar ou compartilhar abrir em quem está na tela agora.
   */
  const trocou = useCallback(
    (handle: string, i: number) => {
      if (lerPedidoDoEndereco(new URLSearchParams(window.location.search)).ver === null) return;
      window.history.replaceState(window.history.state, "", aqui(enderecosDosStories.ver(lang, handle, i)));
    },
    [lang],
  );
  return { aberto, versao, abrir, criar, fechar, mudou, trocou };
}

/**
 * A faixa de stories no alto (prancha celular-stories-na-linha), com o visor e o "criar" por cima quando abertos. Fica no alto
 * da linha de Início (encaixe topoDaLinha) e na tela /alumia/stories. Nada aqui conta ao servidor quem viu (PLANO-ALUMIA §6.4).
 */
export default function StoriesNoAlto({ lang, situacao }: { lang: string; situacao: Situacao }) {
  const t = useTextosDosStories(lang);
  const cliente = useClienteDosStories();
  const { aberto, versao, abrir, criar, fechar, mudou, trocou } = useStoriesAbertos(lang);

  if (!t || !cliente) return <div className="al-st-faixa" aria-busy="true" style={{ minHeight: 132 }} />;

  const previa = cliente.previa;
  const logado = situacao.logado || previa;
  const eu = situacao.handle ? { handle: situacao.handle, nome: situacao.codinome ?? situacao.handle } : previa ? { handle: "voce", nome: t.faixa.seuStory } : null;

  return (
    <>
      {previa ? <p className="al-st-previa">{t.previa}</p> : null}
      <FaixaDeStories t={t} cliente={cliente} eu={eu} logado={logado} versao={versao} aoAbrir={abrir} aoCriar={criar} />
      {aberto.tipo === "ver" ? (
        <Visor
          key={`${aberto.handle}:${aberto.i}`}
          t={t}
          cliente={cliente}
          lang={lang}
          handle={aberto.handle}
          inicio={aberto.i}
          fila={aberto.fila}
          autoras={aberto.autoras}
          aoFechar={fechar}
          aoMudou={mudou}
          aoTrocar={trocou}
        />
      ) : null}
      {aberto.tipo === "criar" && logado ? (
        <Criar
          t={t}
          cliente={cliente}
          postRef={aberto.post}
          extras={aberto.extras}
          lang={lang}
          aoFechar={fechar}
          aoPublicar={() => {
            mudou();
            window.setTimeout(fechar, 900);
          }}
        />
      ) : null}
    </>
  );
}
