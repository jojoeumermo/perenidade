// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O horário de silêncio do aviso no celular (Onda 8, operação). A pessoa escolhe a janela no horário do aparelho; a conta para o
// horário universal é feita aqui, e o banco guarda só os minutos do dia (public.rede_aviso_silencio_salvar): nem fuso, nem cidade.
// No silêncio o push não sai; os avisos se juntam e chegam num aviso só quando a janela acaba (rede_aviso_push_pendentes).
//
// Prompt 4, item 17 (com "alumia-p4-conversa"): a janela passa a ficar SÓ NO APARELHO (lib/rede/avisos/silencio-no-aparelho.ts,
// no horário do aparelho), e o service worker mostra o aviso sem som nem vibração dentro dela. O servidor não sabe mais: a janela
// antiga, se havia, vem para o aparelho e é apagada de lá (rede_aviso_silencio_salvar com os dois nulos), uma vez.
import { useEffect, useId, useState } from "react";
import { rpc } from "@/lib/backend";
import { ligado } from "@/lib/recursos";
import { guardarJanelaNoAparelho, hhmmDe, lerJanelaNoAparelho, minutosDe } from "@/lib/rede/avisos/silencio-no-aparelho";
import { carregarTextosDaConversaP4, type TextosDaConversaP4 } from "@/lib/rede/textos-p4-conversa";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDeAvisos } from "@/lib/rede/textos-avisos";
import { previa } from "../conversa/base3";

type Janela = { inicio: number; fim: number } | null;

const DIA = 24 * 60;
const mod = (n: number) => ((n % DIA) + DIA) % DIA;
/** A diferença do aparelho para o horário universal, em minutos (no Brasil, sem horário de verão, é fixa o ano todo). */
const desvio = () => new Date().getTimezoneOffset();
/** "22:00" (horário do aparelho) → minutos do dia no horário universal. */
export const paraUniversal = (hhmm: string, d = desvio()): number | null => {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return mod(h * 60 + min + d);
};
/** Minutos do dia no horário universal → "22:00" no horário do aparelho. */
export const doUniversal = (minutos: number, d = desvio()): string => {
  const local = mod(minutos - d);
  return `${String(Math.floor(local / 60)).padStart(2, "0")}:${String(local % 60).padStart(2, "0")}`;
};

export function HorarioDeSilencio({ t, membro }: { t: TextosDeAvisos["prefs"]; membro: boolean }) {
  const s = t.silencio;
  const id = useId();
  // Na prévia (sem banco) começa sem horário; com banco, "undefined" até a leitura chegar.
  const [janela, setJanela] = useState<Janela | undefined>(() => (previa() ? null : undefined));
  const [inicio, setInicio] = useState("22:00");
  const [fim, setFim] = useState("07:00");
  const [recado, setRecado] = useState("");
  const [ocupado, setOcupado] = useState(false);
  // Item 17: a janela no aparelho (o estado `janela` continua em minutos universais, só para a tela; o aparelho guarda a local).
  const noAparelho = ligado("alumia-p4-conversa");
  const [tc, setTc] = useState<TextosDaConversaP4["silencio"] | null>(null);

  useEffect(() => {
    if (!noAparelho || !membro) return;
    let vivo = true;
    // O idioma da página (o <html lang> que a casca da Alumia põe); desconhecido cai no português.
    carregarTextosDaConversaP4((document.documentElement.lang || "pt").slice(0, 2))
      .then((x) => vivo && setTc(x.silencio))
      .catch(() => undefined);
    (async () => {
      let local = await lerJanelaNoAparelho();
      // A janela que estava no servidor (de antes do item 17) vem para o aparelho, se aqui não havia, e sai do servidor.
      const doServidor = previa() ? null : await rpc<Janela>("rede_aviso_silencio_ver").catch(() => null);
      if (doServidor) {
        if (!local) {
          const inicio = minutosDe(doUniversal(doServidor.inicio));
          const fim = minutosDe(doUniversal(doServidor.fim));
          if (inicio !== null && fim !== null && inicio !== fim) {
            local = { inicio, fim };
            await guardarJanelaNoAparelho(local).catch(() => undefined);
          }
        }
        await rpc("rede_aviso_silencio_salvar", { p_inicio: null, p_fim: null }).catch(() => undefined);
        if (vivo) setRecado("levado");
      }
      if (!vivo) return;
      setJanela(local ? { inicio: paraUniversal(hhmmDe(local.inicio)) as number, fim: paraUniversal(hhmmDe(local.fim)) as number } : null);
      if (local) {
        setInicio(hhmmDe(local.inicio));
        setFim(hhmmDe(local.fim));
      }
    })().catch(() => vivo && setJanela(null));
    return () => {
      vivo = false;
    };
  }, [noAparelho, membro]);

  useEffect(() => {
    let vivo = true;
    if (previa() || !membro || noAparelho) return;
    rpc<Janela>("rede_aviso_silencio_ver")
      .then((j) => {
        if (!vivo) return;
        setJanela(j ?? null);
        if (j) {
          setInicio(doUniversal(j.inicio));
          setFim(doUniversal(j.fim));
        }
      })
      .catch(() => vivo && setJanela(null));
    return () => {
      vivo = false;
    };
  }, [membro, noAparelho]);

  async function guardar(tirar: boolean) {
    setRecado("");
    if (noAparelho) {
      // Item 17: só neste aparelho, no horário dele. Nada vai ao servidor.
      const a = tirar ? null : minutosDe(inicio);
      const b = tirar ? null : minutosDe(fim);
      if (!tirar && (a === null || b === null || a === b)) return setRecado(s.igual);
      try {
        await guardarJanelaNoAparelho(tirar ? null : { inicio: a as number, fim: b as number });
        setJanela(tirar ? null : { inicio: paraUniversal(inicio) as number, fim: paraUniversal(fim) as number });
        setRecado(t.salvo);
      } catch {
        setRecado(t.falha);
      }
      return;
    }
    const a = tirar ? null : paraUniversal(inicio);
    const b = tirar ? null : paraUniversal(fim);
    if (!tirar && (a === null || b === null || a === b)) return setRecado(s.igual);
    if (previa()) {
      setJanela(tirar ? null : { inicio: a as number, fim: b as number });
      return setRecado(t.salvo);
    }
    setOcupado(true);
    try {
      const nova = await rpc<Janela>("rede_aviso_silencio_salvar", { p_inicio: a, p_fim: b });
      setJanela(nova ?? null);
      setRecado(t.salvo);
    } catch {
      setRecado(t.falha);
    } finally {
      setOcupado(false);
    }
  }

  if (!membro) return null;
  return (
    <section aria-labelledby={`${id}-titulo`} className="mt-4 border-t border-rule pt-4">
      <h3 id={`${id}-titulo`} className="font-serif text-xl font-semibold">
        {s.titulo}
      </h3>
      <p className="mt-1 text-ink-soft">{noAparelho && tc ? tc.descricao : s.descricao}</p>
      <p className="mt-2 font-bold">{janela ? preencher(s.ligado, { inicio: doUniversal(janela.inicio), fim: doUniversal(janela.fim) }) : janela === null ? s.desligado : " "}</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span>{s.inicio}</span>
          <input type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} step={900} className="min-h-11 rounded border-2 border-ink bg-transparent px-3 font-sans text-base" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{s.fim}</span>
          <input type="time" value={fim} onChange={(e) => setFim(e.target.value)} step={900} className="min-h-11 rounded border-2 border-ink bg-transparent px-3 font-sans text-base" />
        </label>
        <button type="button" disabled={ocupado} onClick={() => void guardar(false)} className="min-h-11 cursor-pointer rounded-full border-2 border-ink px-4 font-bold hover:bg-parchment-deep disabled:opacity-60">
          {s.salvar}
        </button>
        {janela ? (
          <button type="button" disabled={ocupado} onClick={() => void guardar(true)} className="min-h-11 cursor-pointer px-2 font-bold underline disabled:opacity-60">
            {s.tirar}
          </button>
        ) : null}
      </div>
      <p role="status" aria-live="polite" className="mt-2 min-h-6 text-sm text-ink-soft">
        {recado === "levado" ? (tc?.levado ?? "") : recado}
      </p>
    </section>
  );
}
