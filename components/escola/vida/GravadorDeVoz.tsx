// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "@/components/Link";
import { fill, type Locale, localePath } from "@/i18n/config";
import type { TextosDaVida } from "@/i18n/escola/vida";
import { apagarVozLocal, gravarVozLocal, MAX_SEGUNDOS_DA_VOZ, MAX_TITULO_DA_VOZ, MAX_VOZES, type VozLocal } from "@/lib/escola/vida";
import { apagarAudio, guardarAudio, lerAudio, podeGravarAudio } from "./audio-local";
import { useVozesLocais } from "./guardado-vida";

type S = TextosDaVida["vozes"];

function RoteiroDaVoz({ s, selo, escolhida, escolher }: { s: S["roteiro"]; selo: string; escolhida: number; escolher: (i: number) => void }) {
  return (
    <section className="vida-bloco" aria-labelledby="roteiro-da-voz" data-roteiro-da-voz="">
      <h2 id="roteiro-da-voz" className="vida-titulo">
        {s.titulo} <span className="vida-selo">{selo}</span>
      </h2>
      <p className="vida-nota">{s.emRevisao}</p>
      <p className="vida-texto">{s.lead}</p>
      <div className="vida-roteiro" role="radiogroup" aria-label={s.titulo}>
        {s.perguntas.map((p, i) => (
          <label key={p}>
            <input type="radio" name="pergunta-da-voz" checked={escolhida === i} onChange={() => escolher(i)} />
            <span>{p}</span>
          </label>
        ))}
      </div>
    </section>
  );
}

/** Uma gravação guardada: ouvir, baixar (arquivo local, a pessoa decide) e apagar. */
function GravacaoGuardada({ voz, s, apagar }: { voz: VozLocal; s: S["gravador"]; apagar: (id: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  async function ouvir() {
    const audio = await lerAudio(voz.id);
    if (!audio) return setErro(true);
    setErro(false);
    setUrl(URL.createObjectURL(audio));
  }
  async function baixarArquivo() {
    const audio = await lerAudio(voz.id);
    if (!audio) return setErro(true);
    const u = URL.createObjectURL(audio);
    const a = document.createElement("a");
    a.href = u;
    a.download = `voz-${voz.criadaEm}-${voz.id}.${audio.type.includes("mp4") ? "m4a" : "webm"}`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(u), 2000);
  }

  return (
    <li data-voz-local={voz.id}>
      <p className="font-semibold">
        {voz.titulo || s.semTitulo} · <span className="vida-nota">{fill(s.segundos, { s: voz.segundos })}</span>
      </p>
      {voz.pergunta ? <p className="vida-nota">{voz.pergunta}</p> : null}
      {url ? <audio className="vida-audio" controls src={url} /> : null}
      {erro ? <p className="vida-erro">{s.falhou}</p> : null}
      <div className="vida-botoes">
        <button type="button" className="vida-botao-claro" onClick={ouvir}>
          {s.ouvir}
        </button>
        <button type="button" className="vida-botao-claro" onClick={baixarArquivo}>
          {s.baixar}
        </button>
        <button type="button" className="vida-botao-claro" onClick={() => apagar(voz.id)}>
          {s.apagar}
        </button>
      </div>
    </li>
  );
}

/**
 * Ensaiar e gravar um áudio de até 2 minutos, SÓ no aparelho. O áudio vai para o IndexedDB, os dados para o
 * localStorage privado. Não há fetch nem envio: "Enviar para o Instituto" é só o link para a página de voluntariado,
 * com o texto pronto para copiar. Sem microfone ou sem MediaRecorder, mostra o roteiro escrito.
 */
export function GravadorDeVoz({ s, selo, lang }: { s: S; selo: string; lang: Locale }) {
  const guardadas = useVozesLocais();
  const [pode, setPode] = useState<boolean | null>(null);
  const [pergunta, setPergunta] = useState(0);
  const [titulo, setTitulo] = useState("");
  const [gravando, setGravando] = useState(false);
  const [restam, setRestam] = useState(MAX_SEGUNDOS_DA_VOZ);
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const gravador = useRef<{ rec: MediaRecorder; stream: MediaStream; inicio: number; relogio: number } | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setPode(podeGravarAudio()), 0);
    return () => window.clearTimeout(id);
  }, []);

  const soltar = useCallback(() => {
    const g = gravador.current;
    if (!g) return;
    window.clearInterval(g.relogio);
    g.stream.getTracks().forEach((t) => t.stop());
    gravador.current = null;
  }, []);
  useEffect(() => soltar, [soltar]);

  const cheio = guardadas.length >= MAX_VOZES;

  async function comecar() {
    setMensagem(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const pedacos: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && pedacos.push(e.data);
      rec.onstop = async () => {
        const g = gravador.current;
        const segundos = Math.min(MAX_SEGUNDOS_DA_VOZ, Math.max(1, Math.round(((g ? Date.now() - g.inicio : 0) || 1000) / 1000)));
        soltar();
        setGravando(false);
        setRestam(MAX_SEGUNDOS_DA_VOZ);
        const audio = new Blob(pedacos, { type: rec.mimeType || "audio/webm" });
        const voz = gravarVozLocal({ segundos, titulo, pergunta: s.roteiro.perguntas[pergunta] ?? "" });
        if (!voz || !(await guardarAudio(voz.id, audio))) {
          if (voz) apagarVozLocal(voz.id);
          setMensagem({ ok: false, texto: s.gravador.falhou });
          return;
        }
        setTitulo("");
      };
      const inicio = Date.now();
      const relogio = window.setInterval(() => {
        const decorrido = Math.floor((Date.now() - inicio) / 1000);
        setRestam(Math.max(0, MAX_SEGUNDOS_DA_VOZ - decorrido));
        if (decorrido >= MAX_SEGUNDOS_DA_VOZ && rec.state === "recording") rec.stop();
      }, 250);
      gravador.current = { rec, stream, inicio, relogio };
      rec.start();
      setGravando(true);
    } catch {
      soltar();
      setMensagem({ ok: false, texto: s.gravador.semMicrofone });
    }
  }

  function parar() {
    const g = gravador.current;
    if (g && g.rec.state === "recording") g.rec.stop();
  }

  async function apagar(id: string) {
    await apagarAudio(id);
    apagarVozLocal(id);
    setMensagem({ ok: true, texto: s.gravador.apagada });
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(s.enviar.pronto);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  const g = s.gravador;
  return (
    <div data-gravador-de-voz="">
      <section className="vida-bloco" aria-labelledby="gravar-voz">
        <h2 id="gravar-voz" className="vida-titulo">
          {g.titulo}
        </h2>
        <div className="vida-aviso" data-aviso-da-voz="">
          <p className="font-semibold">{g.avisoTitulo}</p>
          <ul>
            {g.aviso.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          <p className="mt-2">{g.menores}</p>
        </div>

        {pode === false ? (
          <p className="vida-aviso" role="status" data-sem-gravacao="">
            {g.semGravacao}
          </p>
        ) : (
          <>
            <label className="vida-rotulo" htmlFor="titulo-da-voz">
              {g.tituloLabel}
            </label>
            <input id="titulo-da-voz" className="vida-input" maxLength={MAX_TITULO_DA_VOZ} value={titulo} onChange={(e) => setTitulo(e.target.value)} disabled={gravando} />
            <p className="vida-nota">
              {g.perguntaEscolhida}: {s.roteiro.perguntas[pergunta]}
            </p>
            <div className="vida-botoes">
              {!gravando ? (
                <button type="button" className="vida-botao" onClick={comecar} disabled={pode !== true || cheio}>
                  {g.gravar}
                </button>
              ) : (
                <button type="button" className="vida-botao" onClick={parar}>
                  {g.parar}
                </button>
              )}
              {gravando ? (
                <span className="vida-relogio" role="timer" aria-live="off">
                  {fill(g.restam, { s: restam })}
                </span>
              ) : null}
            </div>
            <p className="vida-nota">{g.fimAos120}</p>
            {cheio ? <p className="vida-erro">{g.limite}</p> : null}
          </>
        )}
        {mensagem ? (
          <p role="status" className={mensagem.ok ? "vida-ok" : "vida-erro"}>
            {mensagem.texto}
          </p>
        ) : null}
      </section>

      <RoteiroDaVoz s={s.roteiro} selo={selo} escolhida={pergunta} escolher={setPergunta} />

      <section className="vida-bloco" aria-labelledby="suas-vozes">
        <h2 id="suas-vozes" className="vida-titulo">
          {g.suas}
        </h2>
        {guardadas.length === 0 ? (
          <p className="vida-nota">{g.nenhuma}</p>
        ) : (
          <ul className="vida-lista">
            {guardadas.map((v) => (
              <GravacaoGuardada key={v.id} voz={v} s={g} apagar={apagar} />
            ))}
          </ul>
        )}
      </section>

      <section className="vida-bloco" aria-labelledby="enviar-voz">
        <h2 id="enviar-voz" className="vida-titulo">
          {s.enviar.titulo}
        </h2>
        <p className="vida-texto">{s.enviar.texto}</p>
        <blockquote className="vida-aviso">{s.enviar.pronto}</blockquote>
        <div className="vida-botoes">
          <button type="button" className="vida-botao-claro" onClick={copiar}>
            {copiado ? "✓" : s.enviar.copiar}
          </button>
          <Link href={localePath(lang, "/voluntarie-se")} className="vida-botao">
            {s.enviar.link}
          </Link>
        </div>
      </section>
    </div>
  );
}
