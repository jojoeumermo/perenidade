// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { localePath } from "@/i18n/config";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/I18n";
import { LIMITES } from "@/lib/escola/acompanhante";
import { ligado } from "@/lib/recursos";
import { useTextosDoAcompanhante } from "./textos";
import "@/styles/escola-acompanhante.css";

// A conversa e o "outro jeito" só são baixados quando a folha abre.
const Conversa = dynamic(() => import("./Conversa").then((m) => m.Conversa), { ssr: false });
const OutroJeito = dynamic(() => import("./OutroJeito").then((m) => m.OutroJeito), { ssr: false });

// "Não entendi" (R1-49): o botão na faixa da aula, ao lado do Ouvir. Abre uma folha com o trecho que a pessoa marcou
// (ou, sem marca, o pedaço da aula que está na tela: a parte do E4-03, data-parte) e o monitor socrático, que faz uma
// pergunta antes de explicar. Na mesma folha, "Explique com exemplo do meu trabalho" (R1-51).
// Só com o recurso "escola" ligado; os textos chegam depois da hidratação (o botão não existe no HTML do servidor).

const RAIZES = ["#texto-da-aula", "#texto-facil"];

/** O texto marcado, se a marca estiver dentro do texto da aula. */
function textoMarcado(): string {
  const selecao = window.getSelection();
  const texto = selecao?.toString().replace(/\s+/g, " ").trim() ?? "";
  if (!texto || !selecao?.anchorNode) return "";
  const no = selecao.anchorNode instanceof Element ? selecao.anchorNode : selecao.anchorNode.parentElement;
  return no && RAIZES.some((r) => no.closest(r)) ? texto.slice(0, LIMITES.trecho) : "";
}

const visivel = (el: Element) => {
  if ((el as HTMLElement).offsetParent === null && getComputedStyle(el).position !== "fixed") return false;
  const caixa = el.getBoundingClientRect();
  return caixa.bottom > window.innerHeight * 0.2 && caixa.top < window.innerHeight;
};

/** O pedaço da aula na tela: a parte (data-parte) do primeiro bloco visível, ou os parágrafos (data-p) a partir dele. */
export function parteNaTela(): string {
  for (const raiz of RAIZES) {
    const caixa = document.querySelector(raiz);
    if (!caixa || (caixa as HTMLElement).offsetParent === null) continue;
    const blocos = [...caixa.querySelectorAll("[data-parte]:not([data-fatia])")];
    const primeiro = blocos.find(visivel);
    if (primeiro) {
      const parte = primeiro.getAttribute("data-parte");
      const daParte = blocos.filter((b) => b.getAttribute("data-parte") === parte);
      // Começa no bloco que está na tela, para a parte longa não mandar só o começo dela.
      const inicio = Math.max(0, daParte.indexOf(primeiro));
      return juntar(daParte.slice(inicio));
    }
    const paragrafos = [...caixa.querySelectorAll("[data-p]")];
    const daTela = paragrafos.findIndex(visivel);
    if (daTela >= 0) return juntar(paragrafos.slice(daTela));
  }
  return "";
}

function juntar(blocos: Element[]): string {
  let texto = "";
  for (const b of blocos) {
    const t = (b.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!t) continue;
    texto = texto ? `${texto}\n\n${t}` : t;
    if (texto.length >= LIMITES.trecho) break;
  }
  if (texto.length <= LIMITES.trecho) return texto;
  const corte = texto.lastIndexOf(" ", LIMITES.trecho - 1);
  return `${texto.slice(0, corte > 0 ? corte : LIMITES.trecho - 1)}…`;
}

export function NaoEntendi({ aula, className = "" }: { aula: string; className?: string }) {
  const { lang } = useI18n();
  const ativo = ligado("escola");
  const s = useTextosDoAcompanhante(lang, ativo);
  const folha = useRef<HTMLDialogElement>(null);
  const marcado = useRef("");
  const [aberta, setAberta] = useState<{ trecho: string; marcado: boolean; vez: number } | null>(null);

  // A marca some quando o dedo toca no botão em alguns celulares: guarda a última marca feita dentro da aula.
  useEffect(() => {
    if (!ativo) return;
    const lembrar = () => {
      const t = textoMarcado();
      if (t) marcado.current = t;
    };
    const esquecer = () => {
      if (!window.getSelection()?.toString().trim()) marcado.current = "";
    };
    document.addEventListener("selectionchange", lembrar);
    document.addEventListener("pointerdown", esquecer);
    return () => {
      document.removeEventListener("selectionchange", lembrar);
      document.removeEventListener("pointerdown", esquecer);
    };
  }, [ativo]);

  useEffect(() => {
    if (aberta && folha.current && !folha.current.open) folha.current.showModal();
  }, [aberta]);

  if (!ativo || !s) return null;

  function abrir() {
    const agora = textoMarcado() || marcado.current;
    setAberta((antes) => ({ trecho: agora || parteNaTela(), marcado: Boolean(agora), vez: (antes?.vez ?? 0) + 1 }));
  }

  return (
    <>
      <button type="button" className={className} onPointerDown={() => (marcado.current = textoMarcado() || marcado.current)} onClick={abrir} aria-haspopup="dialog" data-nao-entendi>
        {s.naoEntendi.botao}
      </button>
      {aberta && (
        <dialog
          ref={folha}
          className="acompanhante-folha normal-case tracking-normal"
          aria-labelledby="nao-entendi-titulo"
          onClose={() => setAberta(null)}
          onClick={(e) => {
            // Toque fora da folha (no fundo escurecido) fecha.
            if (e.target === e.currentTarget) e.currentTarget.close();
          }}
        >
          <div className="p-4 font-sans text-base text-ink sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <h2 id="nao-entendi-titulo" className="font-serif text-2xl font-semibold">
                {s.naoEntendi.titulo}
              </h2>
              <button type="button" className="acompanhante-botao-claro shrink-0" onClick={() => folha.current?.close()}>
                {s.naoEntendi.fechar}
              </button>
            </div>
            {aberta.trecho ? (
              <>
                <p className="mt-3 text-sm text-ink-soft">{aberta.marcado ? s.naoEntendi.selecionado : s.naoEntendi.parteAtual}</p>
                <blockquote className="mt-1 max-h-48 overflow-auto whitespace-pre-line border-l-4 border-gold bg-parchment-deep px-3 py-2 font-serif" lang="pt">
                  {aberta.trecho}
                </blockquote>
                <Conversa
                  key={`socratico-${aberta.vez}`}
                  s={s}
                  modo="socratico"
                  contexto={{ aula, trecho: aberta.trecho }}
                  itens={["trecho", "aula", "pergunta"]}
                  campo={{ rotulo: s.naoEntendi.perguntaOpcional, max: 600, min: 3, linhas: 2 }}
                  botao={s.naoEntendi.perguntar}
                  semTextoBasta
                  semServidor="busca"
                />
                <hr className="my-6 border-rule" />
                <OutroJeito key={`outro-${aberta.vez}`} s={s} trecho={aberta.trecho} aula={aula} />
              </>
            ) : (
              <p className="mt-4">{s.naoEntendi.semTrecho}</p>
            )}
            {/* A aula de reforço (09/11/2026): quando o assistente não basta, uma pessoa da equipe explica. Sempre à mão,
                com ou sem trecho marcado. */}
            <section className="mt-6 border-2 border-ink bg-parchment-deep p-4" aria-labelledby="nao-entendi-reforco">
              <h3 id="nao-entendi-reforco" className="font-serif text-xl font-semibold">
                {s.naoEntendi.reforcoTitulo}
              </h3>
              <p className="mt-1 text-sm text-ink-soft">{s.naoEntendi.reforcoTexto}</p>
              <Link href={localePath(lang, "/reforco")} className="botao botao-tinta mt-3 inline-block">
                {s.naoEntendi.reforcoBotao} →
              </Link>
            </section>
          </div>
        </dialog>
      )}
    </>
  );
}
