// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { fill } from "@/i18n/config";
import type { TextosDaVida } from "@/i18n/escola/vida";
import { apagarCaso, CASO_LIVRE, gravarCaso, lerCaso, MAX_PASSO_DO_CASO, PASSOS_DO_CASO, registrarCasoNaCaderneta } from "@/lib/escola/vida";

type S = TextosDaVida["caso"];
const VAZIA = () => Array<string>(PASSOS_DO_CASO).fill("");

/**
 * O estudo de caso do bairro em 5 passos (olhar, ouvir, anotar, comparar com a aula, propor). O rascunho é por curso (ou
 * livre) e fica só neste aparelho, em chave privada (fora da cópia de segurança). Só o resumo vai para a caderneta, depois
 * do aviso de que ela pode ser exportada e vista por outras pessoas.
 */
export function CasoDoBairro({ cursos, s }: { cursos: { slug: string; titulo: string }[]; s: S }) {
  const [curso, setCurso] = useState(CASO_LIVRE);
  const [passos, setPassos] = useState<string[]>(VAZIA);
  const [titulo, setTitulo] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);

  // O curso pode vir do link da página do curso (?curso=<slug>); o rascunho guardado entra quando o aparelho responde.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const pedido = new URLSearchParams(window.location.search).get("curso");
      if (pedido && cursos.some((c) => c.slug === pedido)) setCurso(pedido);
    }, 0);
    return () => window.clearTimeout(id);
  }, [cursos]);
  useEffect(() => {
    const id = window.setTimeout(() => {
      setPassos(lerCaso(curso) ?? VAZIA());
      setConfirmando(false);
      setMensagem(null);
    }, 0);
    return () => window.clearTimeout(id);
  }, [curso]);

  const nomeDoCurso = cursos.find((c) => c.slug === curso)?.titulo;
  const tituloFinal = (titulo.trim() || (nomeDoCurso ? `${s.tituloPadrao}: ${nomeDoCurso}` : s.tituloPadrao)).slice(0, 160);
  const algum = passos.some((p) => p.trim());

  function guardar() {
    setMensagem(gravarCaso(curso, passos) ? { ok: true, texto: s.guardado } : { ok: false, texto: s.falhou });
  }
  function registrar() {
    gravarCaso(curso, passos);
    const r = registrarCasoNaCaderneta(curso, tituloFinal, passos, s.passos.map((p) => p.titulo));
    setConfirmando(false);
    setMensagem(r ? { ok: true, texto: s.registrado } : { ok: false, texto: s.falhou });
  }
  function apagar() {
    apagarCaso(curso);
    setPassos(VAZIA());
    setMensagem({ ok: true, texto: s.apagado });
  }

  return (
    <div data-caso-do-bairro="">
      <p className="vida-aviso">{s.aviso}</p>
      <label className="vida-rotulo" htmlFor="caso-curso">
        {s.curso}
      </label>
      <select id="caso-curso" className="vida-input" value={curso} onChange={(e) => setCurso(e.target.value)}>
        <option value={CASO_LIVRE}>{s.livre}</option>
        {cursos.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.titulo}
          </option>
        ))}
      </select>
      <label className="vida-rotulo" htmlFor="caso-titulo">
        {s.tituloLabel}
      </label>
      <input id="caso-titulo" className="vida-input" maxLength={160} value={titulo} placeholder={s.tituloPadrao} onChange={(e) => setTitulo(e.target.value)} />
      {s.passos.map((p, i) => (
        <div key={p.titulo}>
          <label className="vida-rotulo" htmlFor={`caso-passo-${i}`}>
            {p.titulo}
          </label>
          <p className="vida-nota">
            {p.ajuda} {fill(s.limite, { n: MAX_PASSO_DO_CASO })}
          </p>
          <textarea
            id={`caso-passo-${i}`}
            className="vida-input"
            maxLength={MAX_PASSO_DO_CASO}
            value={passos[i] ?? ""}
            onChange={(e) => setPassos((atual) => atual.map((x, j) => (j === i ? e.target.value : x)))}
          />
        </div>
      ))}
      <p className="vida-nota">{s.privado}</p>
      <div className="vida-botoes">
        <button type="button" className="vida-botao" onClick={guardar}>
          {s.guardar}
        </button>
        <button type="button" className="vida-botao-claro" onClick={() => setConfirmando(true)} disabled={!algum}>
          {s.registrar}
        </button>
        <button type="button" className="vida-botao-claro" onClick={apagar}>
          {s.apagar}
        </button>
      </div>
      {confirmando ? (
        <div className="vida-aviso" role="alertdialog" aria-label={s.registrar}>
          <p>{s.avisoCaderneta}</p>
          <div className="vida-botoes">
            <button type="button" className="vida-botao" onClick={registrar}>
              {s.registrar}
            </button>
            <button type="button" className="vida-botao-claro" onClick={() => setConfirmando(false)}>
              {s.cancelar}
            </button>
          </div>
        </div>
      ) : null}
      {mensagem ? (
        <p role="status" className={mensagem.ok ? "vida-ok" : "vida-erro"}>
          {mensagem.texto}
        </p>
      ) : null}
    </div>
  );
}