// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { lerLegendas, lerRelogio, relogio } from "@/lib/podcast";
import { urlPublica } from "@/lib/podcast-audio";
import { botao, botaoClaro, campo, rotulo } from "../comum";
import { estrela, fontes, imagemDaMarca } from "./Arte";

const FORMATOS = [
  { id: "vertical", nome: "Vertical 9:16 (Reels, TikTok, Shorts)", w: 1080, h: 1920 },
  { id: "quadrado", nome: "Quadrado 1:1 (feed)", w: 1080, h: 1080 },
  { id: "retrato", nome: "Em pé 4:5 (feed do Instagram)", w: 1080, h: 1350 },
] as const;

export interface EpisodioDoCorte {
  titulo: string;
  programa: string;
  capa: string;
  audio: string;
  legendas: string;
}

function quebrar(pena: CanvasRenderingContext2D, texto: string, largura: number): string[] {
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of texto.split(/\s+/).filter(Boolean)) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (pena.measureText(tentativa).width <= largura) atual = tentativa;
    else {
      if (atual) linhas.push(atual);
      atual = palavra;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

/**
 * Gerador de cortes: escolhe um trecho de 15 a 60 segundos e grava, no próprio navegador, um vídeo com a capa, a onda
 * sonora animada e a legenda do trecho (tirada das legendas do episódio ou digitada aqui). O vídeo sai pronto para
 * baixar e postar. A gravação leva o tempo do trecho, porque o som toca enquanto grava.
 */
export function GeradorDeCortes({ episodio }: { episodio: EpisodioDoCorte }) {
  const [fonte, setFonte] = useState<"deposito" | "arquivo">(episodio.audio ? "deposito" : "arquivo");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [inicio, setInicio] = useState("0:00");
  const [duracao, setDuracao] = useState(45);
  const [formato, setFormato] = useState<(typeof FORMATOS)[number]["id"]>("vertical");
  const [manual, setManual] = useState("");
  const [estado, setEstado] = useState<"parado" | "gravando" | "pronto">("parado");
  const [andamento, setAndamento] = useState(0);
  const [video, setVideo] = useState<{ url: string; ext: string } | null>(null);
  const [aviso, setAviso] = useState("");
  const tela = useRef<HTMLCanvasElement>(null);
  const parar = useRef(false);
  const legendas = useMemo(() => lerLegendas(episodio.legendas), [episodio.legendas]);
  const objeto = useMemo(() => (arquivo ? URL.createObjectURL(arquivo) : ""), [arquivo]);
  useEffect(() => () => {
    if (objeto) URL.revokeObjectURL(objeto);
  }, [objeto]);
  const de = lerRelogio(inicio) ?? 0;
  const fim = de + duracao;
  const trechos = legendas.filter((t) => t.fim > de && t.inicio < fim);

  async function gerar() {
    const url = fonte === "deposito" ? urlPublica(episodio.audio) : objeto;
    const alvo = tela.current;
    if (!url || !alvo) return setAviso("Escolha o áudio do corte.");
    if (typeof MediaRecorder === "undefined" || !("captureStream" in alvo)) return setAviso("Este navegador não grava vídeo. Use o Chrome, o Edge ou o Firefox no computador.");
    setAviso("");
    setVideo(null);
    parar.current = false;
    const { w, h } = FORMATOS.find((f) => f.id === formato)!;
    alvo.width = w;
    alvo.height = h;
    const pena = alvo.getContext("2d")!;
    const { serifa, sans, mono } = await fontes();
    const logo = await imagemDaMarca();
    const capa = await new Promise<HTMLImageElement | null>((resolve) => {
      if (!episodio.capa) return resolve(null);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = urlPublica(episodio.capa);
    });
    const som = new Audio();
    som.crossOrigin = "anonymous";
    som.preload = "auto";
    som.src = url;
    try {
      await new Promise<void>((resolve, reject) => {
        som.addEventListener("loadedmetadata", () => resolve(), { once: true });
        som.addEventListener("error", () => reject(new Error("audio")), { once: true });
      });
    } catch {
      return setAviso("Não deu para abrir o áudio. Se ele saiu do depósito, escolha o arquivo do computador.");
    }
    if (de >= som.duration) return setAviso("O começo do corte passa do fim do áudio.");
    const contexto = new AudioContext();
    const origem = contexto.createMediaElementSource(som);
    const analisador = contexto.createAnalyser();
    analisador.fftSize = 128;
    const destino = contexto.createMediaStreamDestination();
    origem.connect(analisador);
    analisador.connect(destino);
    const fluxo = new MediaStream([...(alvo as HTMLCanvasElement & { captureStream(fps: number): MediaStream }).captureStream(30).getVideoTracks(), ...destino.stream.getAudioTracks()]);
    const tipo = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    const gravador = new MediaRecorder(fluxo, { ...(tipo ? { mimeType: tipo } : {}), videoBitsPerSecond: 5_000_000, audioBitsPerSecond: 128_000 });
    const partes: Blob[] = [];
    gravador.ondataavailable = (e) => partes.push(e.data);
    const acabou = new Promise<void>((resolve) => {
      gravador.onstop = () => resolve();
    });
    som.currentTime = de;
    await new Promise((resolve) => som.addEventListener("seeked", resolve, { once: true }));
    const dados = new Uint8Array(analisador.frequencyBinCount);
    const u = Math.min(w, h) / 100;
    const m = 7 * u;
    const manuais = manual.split("\n").map((l) => l.trim()).filter(Boolean);

    const desenhar = () => {
      const agora = som.currentTime;
      pena.fillStyle = "#1f1a14";
      pena.fillRect(0, 0, w, h);
      pena.fillStyle = "#c21f16";
      pena.fillRect(0, 0, w, 14 * u);
      pena.fillStyle = "#f4ecd8";
      pena.font = `italic 900 ${5.4 * u}px ${sans}`;
      pena.fillText((episodio.programa || "PODCAST").toUpperCase().slice(0, 28), m, 9 * u);
      const lado = formato === "vertical" ? 62 * u : formato === "retrato" ? 44 * u : 38 * u;
      const topo = 20 * u;
      if (capa) pena.drawImage(capa, (w - lado) / 2, topo, lado, lado);
      else {
        // Sem capa, o cartaz do site: vermelho, a quina preta e a estrela.
        const x = (w - lado) / 2;
        pena.fillStyle = "#c21f16";
        pena.fillRect(x, topo, lado, lado);
        pena.fillStyle = "#1f1a14";
        pena.beginPath();
        pena.moveTo(x + lado, topo + lado * 0.64);
        pena.lineTo(x + lado, topo + lado);
        pena.lineTo(x + lado * 0.6, topo + lado);
        pena.closePath();
        pena.fill();
        estrela(pena, x + lado / 2, topo + lado / 2, lado * 0.28, "#f4ecd8");
      }
      let y = topo + lado + 9 * u;
      pena.fillStyle = "#f4ecd8";
      pena.font = `600 ${5.2 * u}px ${serifa}`;
      for (const linha of quebrar(pena, episodio.titulo, w - 2 * m).slice(0, 2)) {
        pena.fillText(linha, m, y);
        y += 6 * u;
      }
      // A onda: barras que sobem com o som.
      analisador.getByteFrequencyData(dados);
      const barras = 40;
      const largura = (w - 2 * m) / barras;
      const base = y + 9 * u;
      for (let i = 0; i < barras; i++) {
        const valor = dados[Math.floor((i / barras) * dados.length * 0.75)] / 255;
        const altura = Math.max(0.8 * u, valor * 14 * u);
        pena.fillStyle = i % 2 ? "#d4a24c" : "#c21f16";
        pena.fillRect(m + i * largura, base - altura / 2, largura * 0.6, altura);
      }
      // A legenda do momento.
      const fala =
        trechos.find((t) => agora >= t.inicio && agora < t.fim)?.texto ??
        (manuais.length ? manuais[Math.min(manuais.length - 1, Math.floor(((agora - de) / duracao) * manuais.length))] : "");
      if (fala) {
        pena.font = `800 ${5 * u}px ${sans}`;
        const linhas = quebrar(pena, fala, w - 2 * m - 4 * u).slice(0, 4);
        const alto = linhas.length * 6.2 * u + 3 * u;
        const ly = base + 12 * u;
        pena.fillStyle = "#f4ecd8";
        pena.fillRect(m, ly, w - 2 * m, alto);
        pena.fillStyle = "#1f1a14";
        linhas.forEach((linha, i) => pena.fillText(linha, m + 2 * u, ly + 6 * u + i * 6.2 * u));
      }
      // Progresso e assinatura.
      pena.fillStyle = "#3a3020";
      pena.fillRect(m, h - 15 * u, w - 2 * m, 0.8 * u);
      pena.fillStyle = "#c21f16";
      pena.fillRect(m, h - 15 * u, (w - 2 * m) * Math.min(1, (agora - de) / duracao), 0.8 * u);
      if (logo) pena.drawImage(logo, m, h - 11 * u, 7 * u, 7 * u);
      pena.fillStyle = "#b3a584";
      pena.font = `500 ${2.8 * u}px ${mono}`;
      pena.fillText("institutolucia.org/podcasts", m + 9 * u, h - 6.6 * u);
      pena.textAlign = "right";
      pena.fillText(relogio(agora), w - m, h - 6.6 * u);
      pena.textAlign = "left";
    };

    setEstado("gravando");
    desenhar();
    gravador.start(250);
    await contexto.resume();
    await som.play();
    await new Promise<void>((resolve) => {
      const quadro = () => {
        desenhar();
        setAndamento(Math.min(1, (som.currentTime - de) / duracao));
        if (parar.current || som.currentTime >= fim || som.ended) return resolve();
        requestAnimationFrame(quadro);
      };
      requestAnimationFrame(quadro);
    });
    som.pause();
    gravador.stop();
    await acabou;
    void contexto.close();
    const mime = (gravador.mimeType || tipo || "video/webm").split(";")[0];
    setVideo({ url: URL.createObjectURL(new Blob(partes, { type: mime })), ext: mime.includes("mp4") ? "mp4" : "webm" });
    setEstado("pronto");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div>
        <canvas ref={tela} className={`w-full max-w-sm border-2 border-ink bg-[#1f1a14] ${estado === "parado" && !video ? "hidden" : ""}`} />
        {video && (
          <div className="mt-4 space-y-2">
            <video src={video.url} controls className="w-full max-w-sm border-2 border-ink" />
            <a href={video.url} download={`corte-${episodio.titulo.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.${video.ext}`} className={`${botao} inline-block`}>
              Baixar o vídeo ({video.ext.toUpperCase()})
            </a>
            {video.ext === "webm" && <p className="text-ink-soft">O Instagram prefere MP4. Se recusar o arquivo, converta de graça no HandBrake, ou grave o corte pelo Chrome, que já gera MP4.</p>}
          </div>
        )}
        {estado === "parado" && !video && (
          <p className="border-l-2 border-gold pl-3 text-ink-soft">
            Escolha o trecho e aperte Gerar. O som do trecho toca em silêncio enquanto o vídeo grava, então espere até o fim (a duração do corte).
          </p>
        )}
      </div>
      <div className="space-y-3">
        <fieldset>
          <legend className={rotulo}>Áudio</legend>
          {episodio.audio && (
            <label className="mt-1 flex items-center gap-2">
              <input type="radio" checked={fonte === "deposito"} onChange={() => setFonte("deposito")} />
              O áudio final do episódio
            </label>
          )}
          <label className="mt-1 flex items-center gap-2">
            <input type="radio" checked={fonte === "arquivo"} onChange={() => setFonte("arquivo")} />
            Um arquivo do computador
          </label>
          {fonte === "arquivo" && <input type="file" accept="audio/*" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} className="mt-2 block w-full" />}
        </fieldset>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            Começa em
            <input value={inicio} onChange={(e) => setInicio(e.target.value)} placeholder="12:40" className={campo} />
          </label>
          <label className="block">
            Duração (s)
            <input type="number" min={15} max={60} value={duracao} onChange={(e) => setDuracao(Math.max(15, Math.min(60, Number(e.target.value) || 45)))} className={campo} />
          </label>
        </div>
        <label className="block">
          Formato
          <select value={formato} onChange={(e) => setFormato(e.target.value as typeof formato)} className={campo}>
            {FORMATOS.map((f) => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </select>
        </label>
        {trechos.length > 0 ? (
          <div>
            <p className={rotulo}>Legenda do trecho (das legendas do episódio)</p>
            <p className="mt-1 max-h-32 overflow-y-auto text-ink-soft">{trechos.map((t) => t.texto).join(" ")}</p>
          </div>
        ) : (
          <label className="block">
            Legenda (uma frase por linha; elas se revezam ao longo do corte)
            <textarea value={manual} onChange={(e) => setManual(e.target.value)} rows={4} className={campo} />
          </label>
        )}
        <p className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void gerar()} disabled={estado === "gravando"} className={botao}>
            {estado === "gravando" ? `Gravando… ${Math.round(andamento * 100)}%` : "Gerar o vídeo"}
          </button>
          {estado === "gravando" && (
            <button type="button" onClick={() => (parar.current = true)} className={botaoClaro}>Parar</button>
          )}
        </p>
        <p role="status" className="min-h-5 text-oxblood">{aviso}</p>
      </div>
    </div>
  );
}
