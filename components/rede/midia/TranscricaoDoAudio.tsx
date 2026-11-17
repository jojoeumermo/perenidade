// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { esquecerTranscricao, midia, transcricaoDoPost, type OrigemDaTranscricao, type TranscricaoDoPost } from "@/lib/rede/midia/cliente";
import { ditadoNoAparelho, ditarAudio } from "@/lib/rede/midia/reconhecer";
import { LIMITES_DA_MIDIA, transcricaoLimpa } from "@/lib/rede/midia/regras";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { Post } from "@/lib/rede/tipos";
import type { ContextoDoEncaixe } from "../encaixes";
import { enderecoDaMidia } from "../publicar/api";
import { mensagemDaMidia, previa, useAudioDoPost, useTextosDaMidia } from "./base";

function useTranscricao(postId: string, ativo: boolean): [TranscricaoDoPost | null, (t: TranscricaoDoPost | null) => void] {
  const [estado, setEstado] = useState<{ post: string; t: TranscricaoDoPost | null } | null>(null);
  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    transcricaoDoPost(postId).then((t) => vivo && setEstado({ post: postId, t }));
    return () => {
      vivo = false;
    };
  }, [postId, ativo]);
  const trocar = (t: TranscricaoDoPost | null) => {
    esquecerTranscricao(postId);
    setEstado({ post: postId, t });
  };
  return [estado?.post === postId ? estado.t : null, trocar];
}

/**
 * A transcrição do áudio de um post ou resposta. Para quem lê: "Ler a transcrição" abre o texto aprovado (e diz quem a fez).
 * Para quem gravou: escrever ou editar, com "Ditar no aparelho" quando o navegador transcreve sem mandar nada para fora; o
 * rascunho fica só nesta tela, e só "Aprovar e mostrar" manda o texto ao banco. Sem áudio no post, nada aparece.
 */
export function TranscricaoDoAudio({ lang, s, post }: { lang: string; s: TextosDaRede; post: Post }) {
  const audio = useAudioDoPost(post.id);
  const tm = useTextosDaMidia(lang, Boolean(audio));
  const [transcricao, trocar] = useTranscricao(post.id, Boolean(audio));
  const [aberta, setAberta] = useState(false);
  const [editando, setEditando] = useState(false);
  const [nota, setNota] = useState("");
  if (!audio || !tm) return null;
  if (!transcricao && !post.meu) return null;
  return (
    <div className="m12-transcricao" onClick={(e) => e.stopPropagation()}>
      {transcricao && !editando && (
        <>
          <button type="button" className="al2-chip al2-chip-p" aria-expanded={aberta} onClick={() => setAberta((x) => !x)}>
            <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
              <path d="M5 7h14M5 12h14M5 17h9" />
            </svg>
            {aberta ? tm.transcricao.esconder : tm.transcricao.mostrar}
          </button>
          {aberta && (
            <blockquote className="m12-transcricao-texto">
              <p>{transcricao.texto}</p>
              <footer>{transcricao.origem === "aparelho" ? tm.transcricao.origemAparelho : tm.transcricao.origemDigitada}</footer>
            </blockquote>
          )}
        </>
      )}
      {post.meu && !editando && (
        <div className="m12-linha">
          <button type="button" className="al2-acao" onClick={() => (setEditando(true), setNota(""))}>
            {transcricao ? tm.transcricao.editar : tm.transcricao.escrever}
          </button>
          {transcricao && (
            <button
              type="button"
              className="al2-acao"
              onClick={async () => {
                try {
                  await midia().tirarTranscricao(post.id);
                  trocar(null);
                  setNota(tm.transcricao.tirada);
                } catch (e) {
                  setNota(mensagemDaMidia(s, tm, e));
                }
              }}
            >
              {tm.transcricao.tirar}
            </button>
          )}
        </div>
      )}
      {editando && (
        <EditorDaTranscricao
          lang={lang}
          s={s}
          postId={post.id}
          audioId={audio.id}
          inicial={transcricao?.texto ?? ""}
          inicialDoAparelho={transcricao?.origem === "aparelho"}
          aoFechar={() => setEditando(false)}
          aoAprovar={(t) => {
            trocar(t);
            setEditando(false);
            setAberta(true);
            setNota(tm.transcricao.aprovada);
          }}
        />
      )}
      {nota && <p role="status" className="m12-nota">{nota}</p>}
    </div>
  );
}

function EditorDaTranscricao({
  lang,
  s,
  postId,
  audioId,
  inicial,
  inicialDoAparelho,
  aoFechar,
  aoAprovar,
}: {
  lang: string;
  s: TextosDaRede;
  postId: string;
  audioId: string;
  inicial: string;
  inicialDoAparelho: boolean;
  aoFechar: () => void;
  aoAprovar: (t: TranscricaoDoPost) => void;
}) {
  const tm = useTextosDaMidia(lang);
  const id = useId();
  const [texto, setTexto] = useState(inicial);
  const [origem, setOrigem] = useState<OrigemDaTranscricao>(inicialDoAparelho ? "aparelho" : "digitada");
  const [podeDitar, setPodeDitar] = useState(false);
  const [ditando, setDitando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const parar = useRef<(() => void) | null>(null);
  const campo = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let vivo = true;
    if (!previa()) ditadoNoAparelho(lang).then((sim) => vivo && setPodeDitar(sim));
    campo.current?.focus();
    return () => {
      vivo = false;
      parar.current?.();
    };
  }, [lang]);

  if (!tm) return null;
  const limpo = transcricaoLimpa(texto);

  async function ditar() {
    if (!tm) return;
    setErro("");
    try {
      const url = await enderecoDaMidia(audioId);
      setDitando(true);
      const antes = texto.trim();
      parar.current = ditarAudio(
        url,
        lang,
        (dito) => {
          setTexto(antes ? `${antes}\n${dito}` : dito);
          setOrigem("aparelho");
        },
        (e) => {
          setDitando(false);
          parar.current = null;
          if (e) setErro(tm.erros.sem_ditado);
        },
      );
    } catch (e) {
      setDitando(false);
      setErro(mensagemDaMidia(s, tm, e));
    }
  }

  async function aprovar() {
    if (!tm || !limpo || ocupado) return;
    parar.current?.();
    setOcupado(true);
    setErro("");
    try {
      const r = await midia().aprovar(postId, limpo, origem);
      aoAprovar({ texto: r.texto, origem: r.origem });
    } catch (e) {
      setErro(mensagemDaMidia(s, tm, e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="m12-editor al2-anexo">
      <label htmlFor={id} className="m12-rotulo">{tm.transcricao.campo}</label>
      <textarea
        id={id}
        ref={campo}
        className="al2-campo m12-campo"
        rows={4}
        maxLength={LIMITES_DA_MIDIA.transcricao}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        aria-describedby={`${id}-dica`}
      />
      <p id={`${id}-dica`} className="m12-dica">
        {tm.transcricao.dica} <span className="m12-contador">{preencher(tm.transcricao.contador, { n: texto.length, max: LIMITES_DA_MIDIA.transcricao })}</span>
      </p>
      <div className="m12-linha">
        {podeDitar && (
          ditando ? (
            <button type="button" className="al-botao al-botao-p al-botao-contorno" onClick={() => parar.current?.()}>
              <span className="m12-gravando" aria-hidden /> {tm.transcricao.pararDitado}
            </button>
          ) : (
            <button type="button" className="al-botao al-botao-p al-botao-contorno" onClick={() => void ditar()}>
              {tm.transcricao.ditar}
            </button>
          )
        )}
        {ditando && <span role="status" className="m12-dica">{tm.transcricao.ditando}</span>}
        <span className="m12-empurra" />
        <button type="button" className="al-botao al-botao-p al-botao-fantasma" onClick={aoFechar}>
          {tm.transcricao.cancelar}
        </button>
        <button type="button" className="al-botao al-botao-p al-botao-primario" disabled={!limpo || ocupado} onClick={() => void aprovar()}>
          {ocupado ? tm.transcricao.aprovando : tm.transcricao.aprovar}
        </button>
      </div>
      {erro && <p role="alert" className="m12-erro">{erro}</p>}
    </div>
  );
}

/** No cartão (encaixe anexosDoCartao): a mesma peça. */
export function TranscricaoNoCartao({ lang, s, post }: ContextoDoEncaixe & { post: Post }) {
  return <TranscricaoDoAudio lang={lang} s={s} post={post} />;
}
