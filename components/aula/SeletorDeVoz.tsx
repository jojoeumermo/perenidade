// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { fill } from "@/i18n/config";
import { readPrefs } from "@/lib/prefs";
import { carregarLista, comoEstaOAparelho, faltaBaixar, gravarEscolha, lerEscolha, VOZ_DO_APARELHO, type Aparelho, type Lista } from "@/lib/vozes/catalogo";
import { aquecer, baixarVoz, cancelarDownload, definirModo, trocarVoz, useLeitor } from "@/lib/vozes/leitor";
import { TRECHOS_DA_AULA } from "./BarraDaAula";
import { useI18n } from "../I18n";

const FRASE_DA_AMOSTRA = "Olá! Esta é a voz que vai ler as aulas para você. Ela roda no seu aparelho, sem internet.";

/**
 * A escolha da voz, numa janela: a do aparelho e as naturais que o site oferece (public/vozes/vozes.json). Cada voz
 * natural mostra o tamanho do download, tem amostra curta (um arquivo pequeno, sem baixar o modelo) e só baixa depois
 * do clique. A escolha fica guardada no aparelho ("lucia:voz").
 */
export function SeletorDeVoz({ fechar }: { fechar: () => void }) {
  const { lang, t } = useI18n();
  const s = t.lesson.voz;
  const janela = useRef<HTMLDialogElement>(null);
  const leitor = useLeitor();
  const [lista, setLista] = useState<Lista | null | undefined>(undefined);
  const [faltam, setFaltam] = useState<Record<string, number>>({});
  const [escolhida, setEscolhida] = useState(() => lerEscolha().voz);
  const [modo, setModo] = useState(() => lerEscolha().modo);
  const [baixando, setBaixando] = useState<string | null>(null);
  const [erro, setErro] = useState(false);
  const [tocandoAmostra, setTocandoAmostra] = useState<string | null>(null);
  const [aparelho, setAparelho] = useState<Aparelho>({ fraco: false, economia: false, redeLenta: false });
  const amostra = useRef<HTMLAudioElement | null>(null);
  const temVozDoAparelho = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    janela.current?.showModal();
    void aquecer(TRECHOS_DA_AULA);
    const a = comoEstaOAparelho();
    // Modo pacote de dados (E4-17): reaproveita o aviso de economia antes de baixar a voz natural.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- memória e rede só existem no aparelho
    setAparelho({ ...a, economia: a.economia || readPrefs().pacote });
    let vivo = true;
    void carregarLista().then(async (l) => {
      if (!vivo) return;
      setLista(l);
      if (!l) return;
      const f: Record<string, number> = {};
      for (const v of l.vozes) f[v.id] = await faltaBaixar(l, v);
      if (vivo) setFaltam(f);
    });
    return () => {
      vivo = false;
      amostra.current?.pause();
      window.speechSynthesis?.cancel();
    };
  }, []);

  const mb = (bytes: number) => `${new Intl.NumberFormat(lang, { maximumFractionDigits: bytes < 1e7 ? 1 : 0 }).format(bytes / 1e6)} MB`;

  function ouvirAmostra(id: string, url: string | null) {
    amostra.current?.pause();
    window.speechSynthesis?.cancel();
    if (tocandoAmostra === id) return setTocandoAmostra(null);
    setTocandoAmostra(id);
    if (id === VOZ_DO_APARELHO) {
      const u = new SpeechSynthesisUtterance(FRASE_DA_AMOSTRA);
      u.lang = "pt-BR";
      u.onend = () => setTocandoAmostra(null);
      window.speechSynthesis.speak(u);
      return;
    }
    if (!url) return;
    const a = new Audio(url);
    a.onended = () => setTocandoAmostra(null);
    a.onerror = () => setTocandoAmostra(null);
    amostra.current = a;
    void a.play().catch(() => setTocandoAmostra(null));
  }

  async function usar(id: string, numero?: number) {
    setErro(false);
    if (id !== VOZ_DO_APARELHO && (faltam[id] ?? 1) > 0) {
      setBaixando(id);
      const ok = await baixarVoz(id);
      setBaixando(null);
      if (!ok) {
        setErro(true);
        return;
      }
      setFaltam((f) => ({ ...f, [id]: 0 }));
    }
    gravarEscolha({ voz: id, numero });
    setEscolhida(id);
    trocarVoz(id);
  }

  function cancelar() {
    cancelarDownload();
    setBaixando(null);
  }

  const botao = "min-h-11 cursor-pointer border-2 border-ink px-3 py-1.5 font-sans text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60";
  const progresso = leitor.aBaixar > 0 ? leitor.baixado / leitor.aBaixar : 0;

  return (
    <dialog
      ref={janela}
      aria-labelledby="titulo-da-voz"
      onClose={fechar}
      onClick={(e) => e.target === janela.current && janela.current?.close()}
      className="seletor-de-voz m-auto w-[min(34rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto border-2 border-ink bg-parchment p-0 font-sans text-ink backdrop:bg-black/50"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 id="titulo-da-voz" className="font-serif text-2xl font-semibold">
            {s.titulo}
          </h2>
          <button type="button" className="min-h-11 min-w-11 cursor-pointer text-xl leading-none hover:text-oxblood" aria-label={s.fechar} onClick={() => janela.current?.close()}>
            ×
          </button>
        </div>
        {aparelho.economia || aparelho.redeLenta ? <p className="mt-3 text-sm text-ink-soft">{s.economia}</p> : null}
        {aparelho.fraco && <p className="mt-3 text-sm text-ink-soft">{s.fraco}</p>}
        {erro && (
          <p role="alert" className="mt-3 text-sm font-semibold text-oxblood">
            {s.erro}
          </p>
        )}

        <ul className="mt-4 grid gap-3">
          <li className="border border-rule bg-parchment-deep p-4" data-voz={VOZ_DO_APARELHO}>
            <p className="font-semibold">{s.aparelho}</p>
            <p className="mt-1 text-sm text-ink-soft">{temVozDoAparelho ? s.aparelhoNota : s.semVoz}</p>
            {temVozDoAparelho && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className={`${botao} bg-parchment text-ink`} aria-pressed={tocandoAmostra === VOZ_DO_APARELHO} onClick={() => ouvirAmostra(VOZ_DO_APARELHO, null)}>
                  {tocandoAmostra === VOZ_DO_APARELHO ? s.pararAmostra : s.amostra}
                </button>
                <button type="button" className={`${botao} ${escolhida === VOZ_DO_APARELHO ? "bg-ink text-parchment" : "bg-parchment text-ink"}`} aria-pressed={escolhida === VOZ_DO_APARELHO} disabled={Boolean(baixando)} onClick={() => usar(VOZ_DO_APARELHO)}>
                  {escolhida === VOZ_DO_APARELHO ? s.usando : s.usar}
                </button>
              </div>
            )}
          </li>

          {lista === null && <li className="text-sm text-ink-soft">{s.nenhumaNatural}</li>}
          {lista?.vozes.filter((v) => (v.idioma ?? "pt") === "pt").map((v) => {
            const falta = faltam[v.id];
            const pronta = falta === 0;
            const nome = `${fill(s.natural, { n: v.numero })} · ${v.genero === "f" ? s.feminina : s.masculina}`;
            const esta = baixando === v.id;
            return (
              <li key={v.id} className="border border-rule bg-parchment-deep p-4" data-voz={v.id}>
                <p className="font-semibold">
                  {nome}
                  {v.motor === "kokoro" && <span className="ml-2 font-mono text-xs font-normal uppercase tracking-[0.06em] text-ink-soft">{s.pesada}</span>}
                </p>
                <p className="mt-1 text-sm text-ink-soft">{pronta ? s.jaBaixada : fill(s.naturalNota, { tamanho: mb(falta ?? v.bytes) })}</p>
                {v.motor === "kokoro" && <p className="mt-1 text-sm text-ink-soft">{s.lenta}</p>}
                <p className="mt-1 text-xs text-ink-soft">{fill(s.credito, { modelo: v.modelo, licenca: v.licenca })}</p>
                {esta && (
                  <div className="mt-3" aria-live="polite">
                    <progress className="h-2 w-full accent-[#c21f16]" max={1} value={progresso} aria-label={fill(s.baixando, { feito: mb(leitor.baixado), total: mb(leitor.aBaixar || v.bytes) })} />
                    <p className="mt-1 text-xs">{fill(s.baixando, { feito: mb(leitor.baixado), total: mb(leitor.aBaixar || v.bytes) })}</p>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {v.amostra && (
                    <button type="button" className={`${botao} bg-parchment text-ink`} aria-pressed={tocandoAmostra === v.id} onClick={() => ouvirAmostra(v.id, v.amostra)}>
                      {tocandoAmostra === v.id ? s.pararAmostra : s.amostra}
                    </button>
                  )}
                  {esta ? (
                    <button type="button" className={`${botao} bg-parchment text-ink`} onClick={cancelar}>
                      {s.cancelar}
                    </button>
                  ) : (
                    <button type="button" className={`${botao} ${escolhida === v.id ? "bg-ink text-parchment" : "bg-parchment text-ink"}`} aria-pressed={escolhida === v.id} disabled={Boolean(baixando) || falta === undefined} onClick={() => usar(v.id, v.numero)}>
                      {escolhida === v.id ? s.usando : pronta ? s.usar : s.baixar}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {lista && lista.vozes.some((v) => v.idioma && v.idioma !== "pt") && <p className="mt-3 text-sm text-ink-soft">{s.outrosIdiomas}</p>}

        <fieldset className="mt-5 border-t border-rule pt-4">
          <legend className="sr-only">{s.modo}</legend>
          <p aria-hidden className="font-semibold">
            {s.modo}
          </p>
          <div className="mt-2 grid gap-2">
            {(["frase", "direto"] as const).map((m) => (
              <label key={m} className="flex min-h-11 cursor-pointer items-center gap-3 border border-rule bg-parchment-deep px-3 py-2 text-sm">
                <input
                  type="radio"
                  name="modo-de-leitura"
                  value={m}
                  checked={modo === m}
                  onChange={() => {
                    setModo(m);
                    gravarEscolha({ modo: m });
                    definirModo(m);
                  }}
                  className="h-4 w-4 accent-[#c21f16]"
                />
                <span>{m === "frase" ? s.modoFrase : s.modoDireto}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </dialog>
  );
}
