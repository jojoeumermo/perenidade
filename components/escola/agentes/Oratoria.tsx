// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useGuardado } from "@/components/estudo/guardado";
import { useI18n } from "@/components/I18n";
import { fill, htmlLang, type Locale } from "@/i18n/config";
import type { TextosDoAcompanhante } from "@/i18n/escola/acompanhante";
import type { TextosDosAgentes } from "@/i18n/escola/agentes";
import { novoId } from "@/lib/escola/acompanhante";
import { analisarFala, apagarEnsaios, type Ensaio, formatarDuracao, gravarEnsaio, LIMITES_DOS_AGENTES, lerEnsaios } from "@/lib/escola/agentes";
import { Conversa, useModoSeguro } from "../acompanhante/Conversa";
import { conferirComTextos } from "./conferir";
import { MicrofoneDeFala } from "./MicrofoneDeFala";

const SEM_ENSAIOS: Ensaio[] = [];

type Medida = ReturnType<typeof analisarFala> & { anterior: Ensaio | null };

/** O cronômetro, o microfone e a medida: tudo no aparelho. O texto só aparece aqui, nunca é guardado. */
function PainelDaFala({ s, lang, texto, preencher }: { s: TextosDosAgentes["oratoria"]; lang: string; texto: string; preencher: (texto: string) => void }) {
  const id = useId();
  const seguro = useModoSeguro();
  const [rodando, setRodando] = useState(false);
  const [decorrido, setDecorrido] = useState(0);
  const [segundos, setSegundos] = useState("");
  const [medida, setMedida] = useState<Medida | null>(null);
  const inicio = useRef(0);
  const max = LIMITES_DOS_AGENTES.ensaioSegundos;

  useEffect(() => {
    if (!rodando) return;
    const tick = window.setInterval(() => {
      const t = Math.min(max, (Date.now() - inicio.current) / 1000);
      setDecorrido(t);
      if (t >= max) {
        setRodando(false);
        setSegundos(String(max));
      }
    }, 250);
    return () => window.clearInterval(tick);
  }, [rodando, max]);

  function alternar() {
    if (rodando) {
      setRodando(false);
      setSegundos(String(Math.round(decorrido)));
      return;
    }
    inicio.current = Date.now() - decorrido * 1000;
    setRodando(true);
  }

  function medir() {
    const s0 = Math.min(max, Math.max(0, Number(segundos) || 0));
    const m = analisarFala(texto, s0, lang);
    const anterior = lerEnsaios()[0] ?? null;
    setMedida({ ...m, anterior });
    if (m.palavras > 0) gravarEnsaio({ id: novoId(), em: Date.now(), segundos: m.segundos, palavras: m.palavras, ppm: m.ppm });
  }

  const comparacao = (m: Medida): string => {
    const c = s.comparacao;
    if (!m.anterior || m.ppm === null || m.anterior.ppm === null) return c.primeiro;
    const dif = m.ppm - m.anterior.ppm;
    return dif === 0 ? c.igual : fill(dif > 0 ? c.mais : c.menos, { n: Math.abs(dif) });
  };

  return (
    <div className="mt-3 border-2 border-ink p-3" data-painel-da-fala>
      <MicrofoneDeFala s={s} lang={lang} texto={texto} preencher={preencher} />
      <p className="mt-4 font-semibold">{s.cronometro}</p>
      <p className="mt-1 flex flex-wrap items-center gap-3">
        <output className="font-mono text-2xl" aria-live="off" data-cronometro>
          {formatarDuracao(decorrido)}
        </output>
        <button type="button" className="acompanhante-botao-claro" onClick={alternar} aria-pressed={rodando}>
          {rodando ? s.parar : s.iniciar}
        </button>
        <button
          type="button"
          className="acompanhante-botao-claro"
          onClick={() => {
            setRodando(false);
            setDecorrido(0);
            setSegundos("");
          }}
        >
          {s.zerar}
        </button>
      </p>
      <label htmlFor={`${id}-seg`} className="mt-3 block font-semibold">
        {s.segundos}
      </label>
      <p className="text-sm text-ink-soft">{s.segundosDica}</p>
      <input
        id={`${id}-seg`}
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        value={segundos}
        onChange={(e) => setSegundos(e.target.value.replace(/\D/g, "").slice(0, 3))}
        className="acompanhante-campo mt-1 w-32 border-2 border-ink bg-parchment px-3 py-2 font-mono text-base"
        data-segundos
      />
      <p className="mt-3">
        <button type="button" className="acompanhante-botao-claro" onClick={medir} data-medir>
          {s.medir}
        </button>
      </p>
      {seguro && <p className="mt-1 text-xs text-ink-soft">{s.modoSeguro}</p>}
      <div role="status" aria-live="polite">
        {medida && (
          <section className="mt-3 border-l-4 border-gold pl-3" data-medida>
            <h3 className="font-semibold">{s.medida}</h3>
            <ul className="mt-1 space-y-1 text-sm">
              <li>{fill(s.palavras, { n: medida.palavras })}</li>
              <li>{fill(s.duracao, { t: medida.duracao })}</li>
              <li data-ppm>{medida.ppm === null ? s.semRitmo : fill(s.ritmo, { n: medida.ppm })}</li>
              {medida.repetidas.length > 0 && <li>{fill(s.repetidas, { lista: medida.repetidas.map((r) => `${r.palavra} (${r.vezes})`).join(", ") })}</li>}
              <li>{comparacao(medida)}</li>
            </ul>
            <p className="mt-2 text-xs text-ink-soft">{s.semFaixa}</p>
          </section>
        )}
      </div>
    </div>
  );
}

/**
 * Ensaio de oratória (modo "oratoria" do assistente, com 50 caracteres ou mais): a fala escrita ou transcrita, o
 * cronômetro, a medida local e o histórico dos ensaios, só com números (lucia:escola-privado:ensaios).
 */
export function Oratoria({ s, comum, a }: { s: TextosDosAgentes["oratoria"]; comum: TextosDosAgentes["comum"]; a: TextosDoAcompanhante }) {
  const { lang } = useI18n();
  const [ensaios] = useGuardado<Ensaio[]>(() => lerEnsaios(), SEM_ENSAIOS);
  const [aviso, setAviso] = useState("");
  const conferir = useMemo(() => conferirComTextos(comum), [comum]);
  const data = (ms: number) => new Date(ms).toLocaleString(htmlLang[lang as Locale] ?? "pt-BR", { dateStyle: "short", timeStyle: "short" });
  return (
    <div data-oratoria>
      <Conversa
        s={a}
        modo="oratoria"
        itens={["fala"]}
        campo={{ rotulo: s.fala, dica: s.falaDica, max: LIMITES_DOS_AGENTES.falaMax, min: LIMITES_DOS_AGENTES.falaMin, linhas: 8, lang }}
        botao={s.botao}
        semServidor="aviso"
        conferirTexto={conferir}
        extraNoCampo={(preencher, texto) => <PainelDaFala s={s} lang={lang} texto={texto} preencher={preencher} />}
      />
      <section className="mt-10" aria-labelledby="ensaios-do-aparelho" data-ensaios>
        <h2 id="ensaios-do-aparelho" className="font-serif text-2xl font-semibold">
          {s.ensaios}
        </h2>
        {ensaios.length === 0 ? (
          <p className="mt-2 text-ink-soft">{s.nenhum}</p>
        ) : (
          <>
            <ul className="mt-2 space-y-1 text-sm">
              {ensaios.map((e) => (
                <li key={e.id}>{fill(s.ensaioLinha, { data: data(e.em), palavras: e.palavras, duracao: formatarDuracao(e.segundos), ritmo: e.ppm === null ? s.ensaioSemRitmo : fill(s.ensaioRitmo, { n: e.ppm }) })}</li>
              ))}
            </ul>
            <p className="mt-3">
              <button
                type="button"
                className="acompanhante-botao-claro"
                data-apagar-ensaios
                onClick={() => {
                  if (!window.confirm(s.confirmar)) return;
                  apagarEnsaios();
                  setAviso(s.apagados);
                }}
              >
                {s.apagar}
              </button>
            </p>
          </>
        )}
        <p role="status" aria-live="polite" className="mt-2 text-sm">
          {aviso}
        </p>
        <p className="mt-2 text-xs text-ink-soft">{s.soNumeros}</p>
      </section>
    </div>
  );
}
