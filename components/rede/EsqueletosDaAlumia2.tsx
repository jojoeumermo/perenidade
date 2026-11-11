// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useParams } from "next/navigation";
import { EsqueletoDaCasca, EsqueletoDoPost } from "./Esqueletos";

/**
 * Os esqueletos novos da F1 (PLANO-ALUMIA §8): o cartão do ato, a faixa de stories, o post aberto e o Escrever, e a tela de
 * carregamento das rotas da Alumia (app/[lang]/alumia/**\/loading.tsx), para a navegação não mostrar tela vazia antes do
 * JavaScript. Tudo `aria-hidden`, com uma frase só para o leitor de tela. No alto contraste e no e-ink, contorno tracejado em vez
 * do cinza que pisca (alumia.css); "reduzir movimento" tira o brilho.
 */

// O "Carregando…" sem baixar os textos da Rede (o loading.tsx não recebe os textos e deve ser leve).
const CARREGANDO: Record<string, string> = { pt: "Carregando…", en: "Loading…", es: "Cargando…", fr: "Chargement…", ru: "Загрузка…", zh: "加载中…" };
export function textoDeCarregando(lang: unknown): string {
  return CARREGANDO[typeof lang === "string" ? lang : "pt"] ?? CARREGANDO.pt;
}

function Bloco({ className }: { className: string }) {
  return <div className={`al-esq rounded bg-parchment-deep motion-safe:animate-pulse ${className}`} />;
}

/** A faixa de stories: rodinhas com o nome embaixo. */
export function EsqueletoDosStories() {
  return (
    <div className="flex gap-4 overflow-hidden px-4 py-3 md:px-5" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex w-16 shrink-0 flex-col items-center gap-2">
          <Bloco className="al2-esq-bola h-16 w-16 !rounded-full" />
          <Bloco className="h-2.5 w-12" />
        </div>
      ))}
    </div>
  );
}

/** O cartão do ato: a faixa da data, o nome grande, onde e quando, o mosaico e o "Eu vou". */
export function EsqueletoDoCartaoDoAto() {
  return (
    <div className="space-y-3 border-b border-rule px-4 py-5 md:px-5" aria-hidden>
      <Bloco className="h-6 w-28" />
      <Bloco className="h-9 w-3/4" />
      <div className="flex gap-3">
        <Bloco className="h-4 w-24" />
        <Bloco className="h-4 w-40" />
      </div>
      <Bloco className="h-36 w-full !rounded-2xl" />
      <Bloco className="h-11 w-32 !rounded-full" />
    </div>
  );
}

/** O post aberto (a página da conversa): o post grande e as primeiras respostas recuadas. */
export function EsqueletoDoPostAberto() {
  return (
    <div aria-hidden>
      <div className="space-y-3 border-b border-rule px-4 pb-4 pt-6 md:px-5">
        <div className="flex items-center gap-3">
          <Bloco className="h-12 w-12 !rounded-xl" />
          <div className="flex-1 space-y-2">
            <Bloco className="h-4 w-1/3" />
            <Bloco className="h-3 w-1/4" />
          </div>
        </div>
        <Bloco className="h-5 w-full" />
        <Bloco className="h-5 w-11/12" />
        <Bloco className="h-5 w-2/3" />
      </div>
      <div className="pl-6">
        <EsqueletoDoPost i={1} />
        <EsqueletoDoPost i={2} />
      </div>
    </div>
  );
}

/** O Escrever: o alto (Cancelar e Publicar), as pílulas dos tipos, o campo e as linhas de escolha. */
export function EsqueletoDoEscrever() {
  return (
    <div className="space-y-4 px-4 py-4" aria-hidden>
      <div className="flex justify-between">
        <Bloco className="h-6 w-20" />
        <Bloco className="h-10 w-28 !rounded-full" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Bloco key={i} className="h-10 w-20 !rounded-full" />
        ))}
      </div>
      <Bloco className="h-40 w-full !rounded-xl" />
      {Array.from({ length: 3 }, (_, i) => (
        <Bloco key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

/** O que cada rota mostra enquanto carrega. */
export function CarregandoDaAlumia({ tipo = "linha" }: { tipo?: "linha" | "post" | "ato" }) {
  const { lang } = useParams<{ lang?: string }>() ?? {};
  const rotulo = textoDeCarregando(lang);
  if (tipo === "linha") return <EsqueletoDaCasca rotulo={rotulo} />;
  return (
    <div role="status" aria-live="polite" className="al-esq-casca mx-auto max-w-[720px]">
      <span className="sr-only">{rotulo}</span>
      {tipo === "post" ? <EsqueletoDoPostAberto /> : <EsqueletoDoCartaoDoAto />}
    </div>
  );
}
