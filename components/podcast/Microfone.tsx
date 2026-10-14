// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import type { Dict } from "@/i18n/types";

const db = (valor: number) => (valor > 0 ? 20 * Math.log10(valor) : -120);

interface Medida {
  ruido: number;
  fala: number;
  pico: number;
}

/**
 * Teste de microfone antes de gravar: o medidor mostra o nível ao vivo; o teste guiado mede o ruído do ambiente
 * (cinco segundos em silêncio) e a voz (cinco segundos lendo uma frase), e devolve conselhos práticos.
 * Nada sai do aparelho: o som é analisado aqui mesmo e a gravação de teste fica só na memória.
 */
export function TesteDeMicrofone({ s }: { s: Dict["podcast"] }) {
  const [aparelhos, setAparelhos] = useState<MediaDeviceInfo[]>([]);
  const [escolhido, setEscolhido] = useState("");
  const [nivel, setNivel] = useState(-120);
  const [ligado, setLigado] = useState(false);
  const [negado, setNegado] = useState(false);
  const [etapa, setEtapa] = useState<"livre" | "silencio" | "voz" | "pronto">("livre");
  const [medida, setMedida] = useState<Medida | null>(null);
  const [gravacao, setGravacao] = useState("");
  const fluxo = useRef<MediaStream | null>(null);
  const contexto = useRef<AudioContext | null>(null);
  const analisador = useRef<AnalyserNode | null>(null);
  const quadro = useRef(0);
  const amostras = useRef<{ rms: number[]; pico: number }>({ rms: [], pico: 0 });
  const etapaAtual = useRef(etapa);
  useEffect(() => {
    etapaAtual.current = etapa;
  }, [etapa]);

  async function ligar(id = escolhido) {
    desligar();
    try {
      const novo = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: id ? { exact: id } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      fluxo.current = novo;
      const ctx = new AudioContext();
      const no = ctx.createAnalyser();
      no.fftSize = 2048;
      ctx.createMediaStreamSource(novo).connect(no);
      contexto.current = ctx;
      analisador.current = no;
      setLigado(true);
      setNegado(false);
      const lista = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput");
      setAparelhos(lista);
      const dados = new Float32Array(no.fftSize);
      const medir = () => {
        no.getFloatTimeDomainData(dados);
        let soma = 0;
        let pico = 0;
        for (const v of dados) {
          soma += v * v;
          pico = Math.max(pico, Math.abs(v));
        }
        const rms = Math.sqrt(soma / dados.length);
        setNivel(db(rms));
        if (etapaAtual.current === "silencio" || etapaAtual.current === "voz") {
          amostras.current.rms.push(rms);
          amostras.current.pico = Math.max(amostras.current.pico, pico);
        }
        quadro.current = requestAnimationFrame(medir);
      };
      quadro.current = requestAnimationFrame(medir);
    } catch {
      setNegado(true);
    }
  }

  function desligar() {
    cancelAnimationFrame(quadro.current);
    fluxo.current?.getTracks().forEach((faixa) => faixa.stop());
    void contexto.current?.close().catch(() => {});
    fluxo.current = null;
    contexto.current = null;
    setLigado(false);
  }

  useEffect(() => () => desligar(), []);

  async function testar() {
    if (!fluxo.current) await ligar();
    if (!fluxo.current) return;
    const partes: Blob[] = [];
    const gravador = new MediaRecorder(fluxo.current);
    gravador.ondataavailable = (e) => partes.push(e.data);
    gravador.onstop = () => setGravacao(URL.createObjectURL(new Blob(partes, { type: gravador.mimeType || "audio/webm" })));
    const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
    amostras.current = { rms: [], pico: 0 };
    setEtapa("silencio");
    await espera(5000);
    const silencio = [...amostras.current.rms].sort((a, b) => a - b);
    const ruido = db(silencio[Math.floor(silencio.length / 2)] ?? 0);
    amostras.current = { rms: [], pico: 0 };
    setEtapa("voz");
    gravador.start();
    await espera(6000);
    gravador.stop();
    const voz = [...amostras.current.rms].sort((a, b) => b - a);
    // A fala é o nível das partes mais fortes (o quinto mais alto), não a média com as pausas.
    const fala = db(voz[Math.floor(voz.length * 0.2)] ?? 0);
    setMedida({ ruido, fala, pico: db(amostras.current.pico) });
    setEtapa("pronto");
  }

  const largura = Math.max(0, Math.min(100, ((nivel + 60) / 60) * 100));
  const conselhos: string[] = [];
  if (medida) {
    if (medida.pico > -1) conselhos.push(s.micTooHot);
    else if (medida.fala < -32) conselhos.push(s.micTooLow);
    else conselhos.push(s.micVoiceOk);
    if (medida.ruido > -50) conselhos.push(s.micNoisy);
    else conselhos.push(s.micQuiet);
    if (medida.fala - medida.ruido < 25) conselhos.push(s.micCloser);
  }

  return (
    <div className="border-4 border-ink p-5 font-sans sm:p-6">
      <h2 className="text-2xl font-black uppercase italic leading-none">{s.micTitle}</h2>
      <p className="mt-2 text-ink-soft">{s.micLead}</p>
      {!ligado ? (
        <button type="button" onClick={() => void ligar()} className="mt-4 cursor-pointer bg-ink px-5 py-2.5 font-semibold text-parchment hover:bg-oxblood">
          🎙 {s.micStart}
        </button>
      ) : (
        <div className="mt-4 space-y-4">
          {aparelhos.length > 1 && (
            <label className="block text-sm">
              {s.micDevice}
              <select value={escolhido} onChange={(e) => { setEscolhido(e.target.value); void ligar(e.target.value); }} className="mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2">
                {aparelhos.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || `${s.micDevice} ${i + 1}`}</option>
                ))}
              </select>
            </label>
          )}
          <div>
            <p className="flex justify-between font-mono text-xs text-ink-soft">
              <span>{s.micLevel}</span>
              <span className="tabular-nums">{nivel > -119 ? `${nivel.toFixed(0)} dB` : "—"}</span>
            </p>
            <div role="meter" aria-label={s.micLevel} aria-valuemin={-60} aria-valuemax={0} aria-valuenow={Math.round(nivel)} className="mt-1 h-4 w-full border-2 border-ink bg-parchment-deep">
              <div className={`h-full ${nivel > -3 ? "bg-[#c21f16]" : nivel > -20 ? "bg-ok" : "bg-gold"}`} style={{ width: `${largura}%` }} />
            </div>
            <p className="mt-1 text-xs text-ink-soft">{s.micTarget}</p>
          </div>
          <button type="button" onClick={() => void testar()} disabled={etapa === "silencio" || etapa === "voz"} className="cursor-pointer border-2 border-ink px-5 py-2 font-semibold hover:border-oxblood hover:text-oxblood disabled:opacity-60">
            {etapa === "silencio" ? s.micSilence : etapa === "voz" ? s.micSpeak : s.micGuided}
          </button>
          {etapa === "voz" && <p className="border-l-2 border-gold pl-3 font-serif text-xl italic">{s.micSentence}</p>}
          {medida && (
            <div className="border-l-2 border-oxblood pl-4">
              <p className="font-mono text-xs">
                {s.micNoise}: {medida.ruido.toFixed(0)} dB · {s.micVoice}: {medida.fala.toFixed(0)} dB · {s.micPeak}: {medida.pico.toFixed(0)} dB
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {conselhos.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              {gravacao && (
                <p className="mt-3 text-sm">
                  {s.micListen}
                  <audio controls src={gravacao} className="mt-1 h-10 w-full" />
                </p>
              )}
            </div>
          )}
          <button type="button" onClick={desligar} className="block cursor-pointer text-sm underline">{s.micStop}</button>
        </div>
      )}
      {negado && <p className="mt-3 text-sm text-oxblood">{s.micDenied}</p>}
      <details className="mt-5 text-sm">
        <summary className="cursor-pointer font-semibold">{s.micTipsTitle}</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">
          {s.micTips.map((dica) => (
            <li key={dica}>{dica}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
