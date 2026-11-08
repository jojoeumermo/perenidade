// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O estúdio do podcast ao vivo (T17), dentro do painel, na aba Podcast → Ao vivo. É ferramenta da equipe: começar,
// transmitir pela câmera deste navegador (ou apontar uma transmissão aberta do PeerTube ou do YouTube) e encerrar. A página
// pública /podcasts só mostra a transmissão para quem assiste (components/podcast/AoVivo.tsx). Quem pode transmitir é
// decidido pelo banco (interno.podcaster(), em podcast_ao_vivo_estado e podcast_ao_vivo_iniciar), não por esta tela.
import dynamic from "next/dynamic";
import { useEffect, useId, useState } from "react";
import { fill, localePath, type Locale } from "@/i18n/config";
import { errorText } from "@/i18n/core";
import pt from "@/i18n/pt.json";
import { PEERTUBE_DOMINIOS } from "@/lib/aula-sala";
import { BackendError, hasBackend, rpc } from "@/lib/backend";
import { enderecoAberto, LIMITE_DIRETO, type Modo } from "@/lib/podcast-ao-vivo";
import { useI18n } from "../../I18n";
import { Aberta, type TextosAoVivo, useEstadoAoVivo } from "../../podcast/AoVivo";
import { Esqueleto, Faixa } from "../ui";

const Transmitir = dynamic(() => import("../../podcast/AoVivoSala").then((m) => m.Transmitir), { ssr: false });

/** Os textos do ao vivo nos outros idiomas do painel, carregados só quando o painel está em outro idioma. */
const textos: Partial<Record<Locale, () => Promise<TextosAoVivo>>> = {
  en: () => import("@/i18n/en.json").then((d) => d.default.podcast.aoVivo),
  es: () => import("@/i18n/es.json").then((d) => d.default.podcast.aoVivo),
  fr: () => import("@/i18n/fr.json").then((d) => d.default.podcast.aoVivo),
  ru: () => import("@/i18n/ru.json").then((d) => d.default.podcast.aoVivo),
  zh: () => import("@/i18n/zh.json").then((d) => d.default.podcast.aoVivo),
};

function useTextos(): TextosAoVivo {
  const { lang } = useI18n();
  const [carregado, setCarregado] = useState<{ lang: Locale; s: TextosAoVivo } | null>(null);
  useEffect(() => {
    const carregar = textos[lang];
    if (!carregar) return;
    let ativo = true;
    void carregar().then((s) => {
      if (ativo) setCarregado({ lang, s });
    });
    return () => {
      ativo = false;
    };
  }, [lang]);
  return carregado?.lang === lang ? carregado.s : pt.podcast.aoVivo;
}

/** O formulário para começar: título, modo, endereço e a confirmação do consentimento de quem aparece. */
function Formulario({ aoComecar, s }: { aoComecar: () => void; s: TextosAoVivo }) {
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
    <form onSubmit={(e) => void comecar(e)} className="space-y-4 font-sans text-sm" aria-label={s.estudio}>
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
 * A aba Ao vivo do podcast no painel. Fora do ar: o formulário para começar. No ar e sendo de quem está vendo: a
 * transmissão pelo navegador (câmera, tela, só áudio, silenciar, encerrar) ou, por link, a prévia e o botão de encerrar.
 * No ar por outra pessoa: o aviso de que já há transmissão.
 */
export function EstudioAoVivo() {
  const { t, lang } = useI18n();
  const s = useTextos();
  const { estado, ler } = useEstadoAoVivo();
  const [aviso, setAviso] = useState("");

  if (!hasBackend) return <Faixa tom="info">{s.semPermissao}</Faixa>;
  if (!estado) return <Esqueleto forma="linhas" />;
  if (!estado.pode) return <Faixa tom="info">{s.semPermissao}</Faixa>;
  const titulo = estado.titulo || s.titulo;

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
    <div className="space-y-4" data-original>
      <div>
        <p className="pn-sobre" style={{ marginTop: 0 }}>{s.estudioLead}</p>
        <p className="mt-1 text-sm">
          <a href={localePath(lang, "/podcasts")} target="_blank" rel="noopener noreferrer" className="pn-elo">
            {s.paginaPublica} ↗
          </a>
        </p>
      </div>
      <section aria-label={s.estudio} className="border-4 border-ink bg-[#1f1a14] p-5 text-[#f4ecd8] shadow-[6px_6px_0_#c21f16] sm:p-8" data-podcast-ao-vivo={estado.no_ar ? "no-ar" : "fora"}>
        {estado.no_ar ? (
          <div className="space-y-4">
            <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.25em] text-[#d4a24c]">
              <span aria-hidden className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-[#c21f16]" /> {s.noAr}
            </p>
            <h3 className="font-sans text-2xl font-black uppercase italic leading-none">{titulo}</h3>
            {estado.minha && estado.modo === "navegador" && estado.sala ? (
              <Transmitir
                s={s}
                sala={estado.sala}
                aoEncerrar={(motivo) => {
                  setAviso(motivo ?? "");
                  void ler();
                }}
              />
            ) : estado.minha && estado.modo === "link" ? (
              <>
                {estado.endereco && <Aberta endereco={estado.endereco} titulo={titulo} s={s} />}
                <p className="font-sans text-sm">
                  {s.voceTransmite}{" "}
                  <button type="button" onClick={() => void encerrarLink()} className="min-h-11 cursor-pointer bg-[#c21f16] px-4 py-1.5 font-bold text-white hover:bg-[#a51810]">
                    {s.encerrar}
                  </button>
                </p>
              </>
            ) : (
              <p className="font-sans text-sm text-[#d9ccac]">{s.outraPessoa}</p>
            )}
            {aviso && <p role="alert" className="font-sans text-sm text-[#e0837a]">{aviso}</p>}
          </div>
        ) : (
          <>
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.25em] text-[#d4a24c]">{s.estudio}</p>
            <Formulario
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
    </div>
  );
}
