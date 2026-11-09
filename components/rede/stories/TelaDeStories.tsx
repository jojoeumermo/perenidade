// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import "./stories.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { enderecosDosStories, lerPedidoDoEndereco } from "@/lib/rede/stories/enderecos";
import type { Aba } from "@/lib/rede/tipos";
import { Linha } from "../Linha";
import type { PropsDaTelaDoPacote } from "../registro";
import { Criar } from "./Criar";
import { FaixaDeStories } from "./FaixaDeStories";
import { Visor } from "./Visor";
import { useClienteDosStories, useTextosDosStories } from "./usar";

const ABAS: readonly Aba[] = ["seguindo", "comunidades", "tudo"];

/** O que está aberto por cima da faixa: nada, o visor de alguém ou o "criar". */
type Aberto = { tipo: "nada" } | { tipo: "ver"; handle: string; i: number; fila: string[] } | { tipo: "criar"; post: string | null };

function lerAberto(): Aberto {
  const p = lerPedidoDoEndereco(new URLSearchParams(window.location.search));
  if (p.criar) return { tipo: "criar", post: p.post };
  if (p.ver) return { tipo: "ver", handle: p.ver, i: p.i, fila: [] };
  return { tipo: "nada" };
}

/**
 * Os stories (/alumia/stories; pranchas celular-stories-na-linha, celular-criar-story e celular-ver-story): a faixa no alto da
 * linha, as abas Seguindo / Comunidades / Tudo e a linha de sempre embaixo; o visor e o "criar" abrem por cima, com o endereço
 * dizendo o que está aberto (?ver=@nome, ?criar=1), para o botão de voltar do celular fechar em vez de sair da Alumia.
 * Atrás das flags rede-v2 + alumia-2 + alumia-stories (lib/rede/rotas-novas.ts): desligadas, a página dá 404.
 */
export default function TelaDeStories({ lang, s, situacao }: PropsDaTelaDoPacote) {
  const t = useTextosDosStories(lang);
  const cliente = useClienteDosStories();
  const [aba, setAba] = useState<Aba>("seguindo");
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

  const ir = useCallback((novo: Aberto, url: string) => {
    if (empilhados.current > 0) window.history.replaceState(null, "", url);
    else {
      window.history.pushState(null, "", url);
      empilhados.current = 1;
    }
    setAberto(novo);
  }, []);
  const fechar = useCallback(() => {
    // Volta no histórico se o visor/criar foi aberto daqui; senão, só troca o endereço.
    if (empilhados.current > 0) {
      empilhados.current = 0;
      window.history.back();
    } else window.history.replaceState(null, "", enderecosDosStories.stories(lang));
    setAberto({ tipo: "nada" });
    setVersao((v) => v + 1);
  }, [lang]);
  const mudou = useCallback(() => setVersao((v) => v + 1), []);

  if (!t || !cliente) return <div className="al-st-faixa" aria-busy="true" style={{ minHeight: 132 }} />;

  const previa = cliente.previa;
  const logado = situacao.logado || previa;
  const eu = situacao.handle ? { handle: situacao.handle, nome: situacao.codinome ?? situacao.handle } : previa ? { handle: "voce", nome: t.faixa.seuStory } : null;

  return (
    <div>
      {previa ? <p className="al-st-previa">{t.previa}</p> : null}
      <FaixaDeStories
        t={t}
        cliente={cliente}
        eu={eu}
        logado={logado}
        versao={versao}
        aoAbrir={(handle, i, fila) => ir({ tipo: "ver", handle, i, fila }, enderecosDosStories.ver(lang, handle, i))}
        aoCriar={() => ir({ tipo: "criar", post: null }, enderecosDosStories.criar(lang))}
      />

      <div className="al-st-abas" role="tablist" aria-label={t.abas.rotulo}>
        {ABAS.map((a) => (
          <button key={a} type="button" role="tab" id={`al-st-aba-${a}`} aria-controls="al-st-aba-painel" aria-selected={aba === a} className="al-st-aba" onClick={() => setAba(a)}>
            {s.abas[a as "seguindo" | "comunidades" | "tudo"]}
          </button>
        ))}
      </div>
      <div id="al-st-aba-painel" role="tabpanel" aria-labelledby={`al-st-aba-${aba}`} className="al-st-aba-painel">
        <Linha key={aba} aba={aba} lang={lang} s={s} logado={situacao.logado} vazio={aba === "seguindo" ? s.estados.vazioSeguindo : aba === "comunidades" ? s.estados.vazioComunidades : undefined} />
      </div>

      {aberto.tipo === "ver" ? (
        <Visor key={`${aberto.handle}:${aberto.i}`} t={t} cliente={cliente} lang={lang} handle={aberto.handle} inicio={aberto.i} fila={aberto.fila} aoFechar={fechar} aoMudou={mudou} />
      ) : null}
      {aberto.tipo === "criar" && logado ? (
        <Criar
          t={t}
          cliente={cliente}
          postRef={aberto.post}
          aoFechar={fechar}
          aoPublicar={() => {
            mudou();
            window.setTimeout(fechar, 900);
          }}
        />
      ) : null}
    </div>
  );
}
