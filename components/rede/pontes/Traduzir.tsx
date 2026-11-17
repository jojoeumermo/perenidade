// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// "Traduzir" um post (atrás de "alumia-traducao"). O botão fica no menu "mais" do cartão (encaixe acoesDoCartao) e só aparece
// quando o servidor do site tem o endereço do NOSSO tradutor (GET /api/rede/traduzir, perguntado uma vez por aba); a tradução
// aparece embaixo do texto (encaixe anexosDoCartao). Nada é traduzido sozinho: só no toque. A tradução fica só na memória da
// aba e some ao tocar em "Ver o original" ou ao recarregar.
import "./pontes.css";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { ContextoDoEncaixe } from "../encaixes";
import type { Post } from "@/lib/rede/tipos";
import { pontes, PREVIA_DAS_PONTES, type Traducao } from "./cliente";
import { textoDoErro } from "./textos";
import { useTextosDasPontes } from "./usarTextos";

type Estado = { tipo: "carregando" } | { tipo: "pronto"; t: Traducao } | { tipo: "erro"; mensagem: string };

const estados = new Map<string, Estado>();
const ouvintes = new Set<() => void>();
let versao = 0;
function mudar(id: string, e: Estado | null) {
  if (e) estados.set(id, e);
  else estados.delete(id);
  versao++;
  for (const o of ouvintes) o();
}
function assinar(o: () => void) {
  ouvintes.add(o);
  return () => ouvintes.delete(o);
}
function useEstado(id: string): Estado | null {
  useSyncExternalStore(assinar, () => versao, () => 0);
  return estados.get(id) ?? null;
}

let disponivel: Promise<boolean> | null = null;
/** O servidor tem tradutor? Pergunta uma vez por aba. */
function perguntarDisponivel(): Promise<boolean> {
  if (PREVIA_DAS_PONTES) return Promise.resolve(true);
  disponivel ??= fetch("/api/rede/traduzir", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<{ disponivel?: boolean }>) : { disponivel: false }))
    .then((j) => j.disponivel === true)
    .catch(() => false);
  return disponivel;
}

function IconeTraduzir() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h9M8.5 3v2M6 5c.6 3 2.6 5.6 5.5 7M11 5c-.7 3.4-3 6.4-6.5 8" />
      <path d="m12 20 4-9 4 9M13.4 17h5.2" />
    </svg>
  );
}

/** No menu "mais" do cartão: "Traduzir" (só com tradutor, só para quem tem conta, só em post com texto). */
export function BotaoTraduzir({ lang, situacao, post }: ContextoDoEncaixe & { post: Post }) {
  const t = useTextosDasPontes(lang);
  const [pode, setPode] = useState(false);
  const estado = useEstado(post.id);
  const logado = situacao.logado && !situacao.suspenso;
  useEffect(() => {
    if (!logado) return;
    let vivo = true;
    void perguntarDisponivel().then((d) => vivo && setPode(d));
    return () => {
      vivo = false;
    };
  }, [logado]);
  if (!t || !pode || !logado || !(post.texto || post.corpo || "").trim()) return null;
  const carregando = estado?.tipo === "carregando";
  return (
    <button
      type="button"
      className="al2-acao justify-start"
      disabled={carregando}
      aria-pressed={estado?.tipo === "pronto"}
      onClick={(e) => {
        e.stopPropagation();
        // Como as outras ações do menu "mais": ao tocar, o menu fecha e a tradução aparece no cartão, sem nada por cima.
        e.currentTarget.closest("details")?.removeAttribute("open");
        if (estado?.tipo === "pronto") return mudar(post.id, null);
        mudar(post.id, { tipo: "carregando" });
        pontes.traduzir(post.id, lang).then(
          (r) => mudar(post.id, { tipo: "pronto", t: r }),
          (erro) => mudar(post.id, { tipo: "erro", mensagem: textoDoErro(t.erros, erro) || t.traduzir.erro }),
        );
      }}
    >
      <IconeTraduzir />
      <span>{carregando ? t.traduzir.traduzindo : estado?.tipo === "pronto" ? t.traduzir.original : t.traduzir.botao}</span>
    </button>
  );
}

/** Embaixo do texto do cartão: a tradução (ou o erro), com "Ver o original". */
export function TraducaoNoCartao({ lang, post }: ContextoDoEncaixe & { post: Post }) {
  const t = useTextosDasPontes(lang);
  const estado = useEstado(post.id);
  if (!t || !estado) return null;
  if (estado.tipo === "carregando") return <p className="po-nota" aria-live="polite">{t.traduzir.traduzindo}</p>;
  if (estado.tipo === "erro") return <p className="po-erro" role="alert">{t.traduzir.erro} {estado.mensagem !== t.traduzir.erro ? estado.mensagem : ""}</p>;
  return (
    <div className="po-traducao" lang={lang} aria-live="polite">
      {estado.t.titulo && <strong>{estado.t.titulo}</strong>}
      {estado.t.texto}
      <small>
        <span>{t.traduzir.nota}</span>
        <button type="button" onClick={(e) => { e.stopPropagation(); mudar(post.id, null); }}>{t.traduzir.original}</button>
      </small>
    </div>
  );
}
