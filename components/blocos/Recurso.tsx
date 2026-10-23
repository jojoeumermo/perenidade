// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import phet from "@/content/phet.json";
import { localePath } from "@/i18n/config";
import { LABS } from "@/lib/areas";
import { EDITORES } from "@/lib/estudio";
import { useI18n } from "../I18n";

// O bloco "Recurso do site": põe dentro da aula (ou da Sala livre do professor) um laboratório do site, uma obra do
// acervo, um editor do Estúdio de prática ou uma simulação do PhET. Tudo é do próprio site, menos o PhET, que abre no
// quadro dele (já liberado na política de segurança), com licença CC BY.
//
//   laboratorio: linux        obra: 1984        estudio: blockbench        phet: circuit-construction-kit-dc

export type TipoDeRecurso = "laboratorio" | "obra" | "estudio" | "phet";
export function lerRecurso(spec: string): { tipo: TipoDeRecurso; id: string; altura: number } | null {
  let tipo: TipoDeRecurso | null = null;
  let id = "";
  let altura = 640;
  for (const linha of spec.split(/\r?\n/)) {
    const m = /^\s*(laboratorio|laboratório|obra|estudio|estúdio|phet|altura)\s*:\s*(.+?)\s*$/i.exec(linha);
    if (!m) continue;
    const chave = m[1].normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
    if (chave === "altura") altura = Math.min(1200, Math.max(320, Number(m[2]) || 640));
    else {
      tipo = chave as TipoDeRecurso;
      id = m[2].trim();
    }
  }
  return tipo && /^[a-z0-9-]{1,80}$/.test(id) ? { tipo, id, altura } : null;
}

export const RECURSOS_DISPONIVEIS = {
  laboratorio: Object.keys(LABS),
  estudio: EDITORES.filter((e) => !e.baixar).map((e) => e.id),
  phet: (phet as { id: string }[]).map((p) => p.id),
} as const;

interface Obra {
  id: string;
  titulo: string;
  autor: string;
  ano?: string;
  licenca: string;
  fonte: string;
  area: string;
}

function CartaoDaObra({ id }: { id: string }) {
  const { lang } = useI18n();
  const [obra, setObra] = useState<Obra | null | undefined>(undefined);
  const [semCapa, setSemCapa] = useState(false);
  useEffect(() => {
    let vivo = true;
    fetch(localePath(lang, "/obras.json"))
      .then((r) => (r.ok ? r.json() : []))
      .then((lista: Obra[]) => vivo && setObra(lista.find((o) => o.id === id) ?? null))
      .catch(() => vivo && setObra(null));
    return () => {
      vivo = false;
    };
  }, [id, lang]);
  if (obra === undefined) return <p className="my-6 font-sans text-sm text-ink-soft">…</p>;
  if (!obra) return <p className="my-6 font-sans text-sm text-oxblood">Obra não encontrada no acervo: {id}</p>;
  return (
    <a href={localePath(lang, `/acervo/${obra.id}`)} className="group my-6 flex gap-4 border-2 border-ink bg-parchment-deep p-3 font-sans no-underline hover:border-oxblood">
      {!semCapa && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/capas/${obra.id}.webp`} alt="" onError={() => setSemCapa(true)} className="h-28 w-20 shrink-0 border border-ink/40 object-cover" />
      )}
      <span className="min-w-0">
        <span className="block font-mono text-[0.65rem] uppercase tracking-widest text-oxblood">Do acervo · {obra.area}</span>
        <span className="mt-1 block font-serif text-xl font-semibold group-hover:text-oxblood">{obra.titulo}</span>
        <span className="block text-sm text-ink-soft">{obra.autor}{obra.ano ? `, ${obra.ano}` : ""} · {obra.licenca} · {obra.fonte}</span>
        <span className="mt-1 block text-sm underline">Abrir a ficha e ler na fonte →</span>
      </span>
    </a>
  );
}

/** O QR Code do recurso, para a turma abrir no celular durante a aula. Gerado no aparelho, sem serviço de fora. */
function QrNoCelular({ abrir, titulo }: { abrir: string; titulo: string }) {
  const [imagem, setImagem] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const mostrar = () => {
    if (imagem) return setImagem(null);
    const url = new URL(abrir, window.location.origin).toString();
    setLink(url);
    import("qrcode")
      .then((qrcode) => qrcode.toDataURL(url, { errorCorrectionLevel: "M", margin: 1, width: 320, color: { dark: "#17130e", light: "#ffffff" } }))
      .then(setImagem)
      .catch(() => setImagem(null));
  };
  return (
    <>
      <button type="button" onClick={mostrar} aria-expanded={!!imagem} className="cursor-pointer underline hover:text-oxblood">No celular</button>
      {imagem && (
        <span className="flex w-full flex-wrap items-center gap-4 border-t border-ink/20 pt-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- imagem gerada no aparelho (data:) */}
          <img src={imagem} alt={`QR Code para abrir ${titulo} no celular`} width={200} height={200} className="border border-ink/30 bg-white p-1" />
          <span className="min-w-0 text-base"><strong>Aponte a câmera do celular</strong> para abrir na hora.<br /><span className="break-all font-mono text-xs text-ink-soft">{link}</span></span>
        </span>
      )}
    </>
  );
}

function Quadro({ src, titulo, altura, abrir }: { src: string; titulo: string; altura: number; abrir: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <figure className="my-6 border-2 border-ink">
      <figcaption className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-ink bg-parchment-deep px-3 py-2 font-sans text-sm">
        <strong>{titulo}</strong>
        <span className="flex flex-wrap gap-3"><a href={abrir} target="_blank" rel="noopener" className="underline hover:text-oxblood">Abrir em tela cheia ↗</a><QrNoCelular abrir={abrir} titulo={titulo} /></span>
      </figcaption>
      {aberto ? (
        <iframe src={src} title={titulo} style={{ height: altura }} className="w-full border-0 bg-parchment" allow="clipboard-write; fullscreen" />
      ) : (
        <button type="button" onClick={() => setAberto(true)} className="flex w-full cursor-pointer items-center justify-center bg-[#17130e] py-16 font-sans font-bold text-[#f4ecd8] hover:bg-[#2a231a]">▶ Abrir aqui</button>
      )}
    </figure>
  );
}

export function Recurso({ spec }: { spec: string }) {
  const { lang, t } = useI18n();
  const r = lerRecurso(spec);
  if (!r) return <pre className="text-sm">{spec}</pre>;
  if (r.tipo === "obra") return <CartaoDaObra id={r.id} />;
  if (r.tipo === "laboratorio") {
    const caminho = LABS[r.id as keyof typeof LABS];
    if (!caminho) return <pre className="text-sm">{spec}</pre>;
    const nomes = t.labs as unknown as Record<string, string>;
    return <Quadro src={localePath(lang, caminho)} titulo={nomes[r.id] ?? r.id} altura={r.altura} abrir={localePath(lang, caminho)} />;
  }
  if (r.tipo === "estudio") {
    const ed = EDITORES.find((e) => e.id === r.id && !e.baixar);
    if (!ed) return <pre className="text-sm">{spec}</pre>;
    const caminho = localePath(lang, `/estudio-de-pratica/abrir/${ed.id}`);
    return <Quadro src={caminho} titulo={`${ed.nome} (Estúdio de prática)`} altura={Math.max(r.altura, 640)} abrir={caminho} />;
  }
  const sim = (phet as { id: string; titulo: string; url: string; pagina: string }[]).find((p) => p.id === r.id);
  if (!sim) return <pre className="text-sm">{spec}</pre>;
  return <Quadro src={sim.url} titulo={`${sim.titulo} (PhET, CC BY 4.0)`} altura={r.altura} abrir={sim.pagina} />;
}
