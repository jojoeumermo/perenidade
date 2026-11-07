// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Podcast ao vivo (T17) na página /podcasts: o aviso "no ar agora" com o vídeo para todo mundo e, para quem faz o podcast
// (função no painel), o estúdio para começar e encerrar. Regras: lib/podcast-ao-vivo.ts; banco:
// supabase/migracoes/20261106-t17-podcast-ao-vivo.sql; limites e escolhas: docs/PODCAST-AO-VIVO.md.
//
// Leve de propósito: aqui só a consulta do estado (uma chamada pequena, a cada 30 s com a aba visível). O WebRTC
// (components/podcast/AoVivoSala.tsx) só carrega quando a pessoa clica em assistir ou começa a transmitir; o tocador do
// PeerTube ou do YouTube, só depois do clique. Nada é gravado e nada de quem assiste é guardado.
import dynamic from "next/dynamic";
import { useCallback, useEffect, useId, useState } from "react";
import { fill } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { errorText } from "@/i18n/core";
import { PEERTUBE_DOMINIOS } from "@/lib/aula-sala";
import { BackendError, hasBackend, rpc } from "@/lib/backend";
import { enderecoAberto, type EstadoAoVivo, LIMITE_DIRETO, type Modo } from "@/lib/podcast-ao-vivo";
import { TocadorPeerTube } from "../aovivo/TocadorPeerTube";
import { useI18n } from "../I18n";

/** Os textos do ao vivo (t.podcast.aoVivo): chegam da página, como os de toda seção que não é do núcleo (i18n/core.ts). */
export type TextosAoVivo = Dict["podcast"]["aoVivo"];
import { TocadorYoutube } from "../TocadorYoutube";

const Assistir = dynamic(() => import("./AoVivoSala").then((m) => m.Assistir), { ssr: false });
const Transmitir = dynamic(() => import("./AoVivoSala").then((m) => m.Transmitir), { ssr: false });

/** A transmissão aberta (PeerTube da lista ou YouTube, só depois do clique) ou, de outro endereço, só o link. */
function Aberta({ endereco, titulo, s }: { endereco: string; titulo: string; s: TextosAoVivo }) {
  const e = enderecoAberto(endereco, PEERTUBE_DOMINIOS);
  if (!e) return null;
  if (e.tipo === "peertube") return <TocadorPeerTube url={e.url} titulo={titulo} aoVivo />;
  if (e.tipo === "youtube") return <TocadorYoutube id={e.id} titulo={titulo} aoVivo textos={{ assistir: s.assistirAberta, aviso: s.avisoYoutube }} />;
  return (
    <p className="font-sans text-sm">
      <a href={e.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="underline hover:text-[#d4a24c]">
        {s.abrirFora} ↗
      </a>
    </p>
  );
}

/** O formulário de quem faz o podcast: título, modo, endereço e a confirmação do consentimento de quem aparece. */
function Estudio({ aoComecar, s }: { aoComecar: () => void; s: TextosAoVivo }) {
  const { t } = useI18n();
  const id = useId();
  const [titulo, setTitulo] = useState("");
  const [modo, setModo] = useState<Modo>("navegador");
  const [endereco, setEndereco] = useState("");
  const [consentimento, setConsentimento] = useState(false);
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function comecar(e: React.FormEvent) {
    e.preventDefault();
    setAviso("");
    const limpo = endereco.trim();
    if ((modo === "link" || limpo) && !enderecoAberto(limpo, PEERTUBE_DOMINIOS)) return setAviso(s.linkInvalido);
    if (!consentimento) return setAviso(t.errors.consentimento);
    setOcupado(true);
    try {
      await rpc("podcast_ao_vivo_iniciar", { p_titulo: titulo, p_modo: modo, p_endereco: limpo, p_consentimento: consentimento });
      aoComecar();
    } catch (erro) {
      const codigo = erro instanceof BackendError ? erro.code : "falha";
      setAviso(codigo === "ocupado" ? s.outraPessoa : codigo.startsWith("invalido:endereco") ? s.linkInvalido : errorText(t, codigo));
    } finally {
      setOcupado(false);
    }
  }

  const campo = "mt-1 block min-h-11 w-full border-2 border-[#f4ecd8] bg-[#17130e] px-3 py-2 font-sans text-[#f4ecd8]";
  return (
    <form onSubmit={(e) => void comecar(e)} className="space-y-4 font-sans text-sm" aria-labelledby={`${id}-titulo`}>
      <div>
        <h3 id={`${id}-titulo`} className="font-sans text-lg font-black uppercase italic">{s.estudio}</h3>
        <p className="mt-1 text-[#d9ccac]">{s.estudioLead}</p>
      </div>
      <label className="block font-semibold">
        {s.tituloCampo}
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} className={campo} />
      </label>
      <fieldset className="space-y-2">
        <legend className="font-semibold">{s.modo}</legend>
        {(["navegador", "link"] as const).map((m) => (
          <label key={m} className="flex min-h-11 cursor-pointer items-center gap-2">
            <input type="radio" name={`${id}-modo`} value={m} checked={modo === m} onChange={() => setModo(m)} className="accent-[#c21f16]" />
            {m === "navegador" ? fill(s.modoNavegador, { n: LIMITE_DIRETO }) : s.modoLink}
          </label>
        ))}
      </fieldset>
      <label className="block font-semibold">
        {modo === "link" ? s.linkCampo : s.linkReserva}
        <input type="url" inputMode="url" value={endereco} onChange={(e) => setEndereco(e.target.value)} required={modo === "link"} maxLength={500} placeholder="https://" className={campo} />
      </label>
      <label className="flex cursor-pointer items-start gap-2">
        <input type="checkbox" checked={consentimento} onChange={(e) => setConsentimento(e.target.checked)} required className="mt-1 h-5 w-5 shrink-0 accent-[#c21f16]" />
        <span>{s.consentimento}</span>
      </label>
      <p className="text-xs text-[#d9ccac]">{fill(s.limites, { n: LIMITE_DIRETO })}</p>
      <button type="submit" disabled={ocupado} className="min-h-11 cursor-pointer bg-[#c21f16] px-5 py-2 font-bold text-white hover:bg-[#a51810] disabled:opacity-50">
        {ocupado ? s.iniciando : s.iniciar}
      </button>
      {aviso && <p role="alert" className="text-[#e0837a]">{aviso}</p>}
    </form>
  );
}

/**
 * O bloco do ao vivo. Fora do ar e para quem não faz o podcast, não aparece (nem ocupa espaço). Sem banco configurado,
 * também não.
 */
export function PodcastAoVivo({ s, className = "mt-12" }: { s: TextosAoVivo; className?: string }) {
  const { t } = useI18n();
  const [estado, setEstado] = useState<EstadoAoVivo | null>(null);
  const [assistindo, setAssistindo] = useState(false);
  const [aviso, setAviso] = useState("");

  const ler = useCallback(async () => {
    if (!hasBackend) return;
    try {
      setEstado(await rpc<EstadoAoVivo>("podcast_ao_vivo_estado"));
    } catch {
      // sem conexão: a próxima rodada tenta de novo
    }
  }, []);

  useEffect(() => {
    const primeira = window.setTimeout(() => void ler(), 0);
    const timer = window.setInterval(() => {
      if (!document.hidden) void ler();
    }, 30_000);
    const voltar = () => {
      if (!document.hidden) void ler();
    };
    document.addEventListener("visibilitychange", voltar);
    return () => {
      window.clearTimeout(primeira);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", voltar);
    };
  }, [ler]);

  if (!estado || (!estado.no_ar && !estado.pode)) return null;
  const titulo = estado.titulo || s.titulo;
  const reserva = estado.endereco ? (
    <div className="space-y-2">
      <p className="font-sans text-sm font-semibold">{s.lotadoLink}</p>
      <Aberta endereco={estado.endereco} titulo={titulo} s={s} />
    </div>
  ) : null;

  async function encerrarLink() {
    setAviso("");
    try {
      await rpc("podcast_ao_vivo_encerrar");
    } catch (e) {
      setAviso(errorText(t, e instanceof BackendError ? e.code : "falha"));
    }
    void ler();
  }

  return (
    <section aria-labelledby="podcast-ao-vivo" className={`${className} border-4 border-ink bg-[#1f1a14] p-5 text-[#f4ecd8] shadow-[6px_6px_0_#c21f16] sm:p-8`} data-podcast-ao-vivo={estado.no_ar ? "no-ar" : "fora"}>
      {estado.no_ar ? (
        <div className="space-y-4">
          <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.25em] text-[#d4a24c]">
            <span aria-hidden className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-[#c21f16]" /> {s.noAr}
          </p>
          <h2 id="podcast-ao-vivo" className="font-sans text-3xl font-black uppercase italic leading-none">{titulo}</h2>
          <p className="max-w-3xl font-sans text-xs text-[#d9ccac]">{s.aviso}</p>
          {estado.modo === "navegador" && estado.sala ? (
            estado.minha && estado.pode ? (
              <Transmitir
                s={s}
                sala={estado.sala}
                aoEncerrar={(motivo) => {
                  setAviso(motivo ?? "");
                  void ler();
                }}
              />
            ) : assistindo ? (
              <Assistir s={s} sala={estado.sala} chaves={estado.chaves ?? []} reserva={reserva} aoSair={() => setAssistindo(false)} />
            ) : (
              <button type="button" onClick={() => setAssistindo(true)} className="min-h-11 cursor-pointer bg-[#c21f16] px-6 py-3 font-sans font-bold text-white hover:bg-[#a51810]">
                ▶ {s.assistir}
              </button>
            )
          ) : estado.endereco ? (
            <Aberta endereco={estado.endereco} titulo={titulo} s={s} />
          ) : null}
          {estado.modo === "link" && estado.minha && (
            <p className="font-sans text-sm">
              {s.voceTransmite}{" "}
              <button type="button" onClick={() => void encerrarLink()} className="min-h-11 cursor-pointer bg-[#c21f16] px-4 py-1.5 font-bold text-white hover:bg-[#a51810]">
                {s.encerrar}
              </button>
            </p>
          )}
          {estado.pode && !estado.minha && <p className="font-sans text-xs text-[#d9ccac]">{s.outraPessoa}</p>}
          {aviso && <p role="alert" className="font-sans text-sm text-[#e0837a]">{aviso}</p>}
        </div>
      ) : (
        <>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-[#d4a24c]">{s.rotulo}</p>
          <h2 id="podcast-ao-vivo" className="sr-only">{s.titulo}</h2>
          <Estudio
            s={s}
            aoComecar={() => {
              setAviso("");
              void ler();
            }}
          />
          {aviso && <p role="alert" className="mt-3 font-sans text-sm text-[#e0837a]">{aviso}</p>}
        </>
      )}
    </section>
  );
}
