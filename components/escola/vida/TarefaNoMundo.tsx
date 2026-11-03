// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { useCaderneta } from "@/components/escola/guardado-escola";
import { fill } from "@/i18n/config";
import type { TextosDaVida } from "@/i18n/escola/vida";
import { desmarcarTarefa, idDoRegistroDaTarefa, MAX_NOTA, marcarTarefa, registrarTarefaNaCaderneta } from "@/lib/escola/vida";
import { useTarefas } from "./guardado-vida";

type S = TextosDaVida["tarefas"]["cartao"];

const formatarDia = (dia: string, lang: string) => {
  try {
    return new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${dia}T00:00:00Z`));
  } catch {
    return dia;
  }
};

/**
 * A tarefa no mundo de um curso, no cartão que o curso já tem: "Marcar como feita" (a fazer, feita em <data>, desfazer),
 * uma nota curta e "Registrar na caderneta". Tudo só neste aparelho (lucia:escola:tarefas). Sem JavaScript o curso
 * continua mostrando o texto da tarefa; só a marca precisa dele.
 */
export function TarefaNoMundo({ curso, tituloDoCurso, s, lang }: { curso: string; tituloDoCurso: string; s: S; lang: string }) {
  const marca = useTarefas()[curso];
  const caderneta = useCaderneta();
  const [edicao, setEdicao] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);
  const registrada = caderneta.some((r) => r.id === idDoRegistroDaTarefa(curso));

  // Enquanto a pessoa não escreve, a caixa mostra a nota guardada (que só chega do aparelho depois de montar).
  const guardada = marca?.nota ?? "";
  const nota = edicao ?? guardada;

  const falhou = () => setMensagem({ ok: false, texto: s.falhou });

  function marcar() {
    if (!marcarTarefa(curso, { nota })) falhou();
    else {
      setEdicao(null);
      setMensagem(null);
    }
  }
  function desfazer() {
    if (!desmarcarTarefa(curso)) falhou();
    else {
      setEdicao(null);
      setMensagem(null);
    }
  }
  function registrar() {
    if (registrarTarefaNaCaderneta(curso, tituloDoCurso)) setMensagem({ ok: true, texto: s.registrada });
    else falhou();
  }

  return (
    <div className="vida-cartao mt-4" data-tarefa-curso={curso}>
      <h3>{s.titulo}</h3>
      {marca ? (
        <p role="status" className="vida-ok" data-estado="feita">
          {fill(s.feita, { data: formatarDia(marca.em, lang) })}
        </p>
      ) : null}
      <label className="vida-rotulo" htmlFor={`nota-${curso}`}>
        {s.nota}
      </label>
      <textarea id={`nota-${curso}`} className="vida-input" maxLength={MAX_NOTA} value={nota} onChange={(e) => setEdicao(e.target.value)} />
      <p className="vida-nota">{s.notaAviso}</p>
      <div className="vida-botoes">
        {!marca ? (
          <button type="button" className="vida-botao" onClick={marcar}>
            {s.marcar}
          </button>
        ) : (
          <>
            <button type="button" className="vida-botao-claro" onClick={marcar} disabled={nota.trim() === guardada.trim()}>
              {s.salvarNota}
            </button>
            <button type="button" className="vida-botao-claro" onClick={desfazer}>
              {s.desfazer}
            </button>
            <button type="button" className="vida-botao" onClick={registrar} disabled={registrada}>
              {registrada ? s.registrada : s.registrar}
            </button>
          </>
        )}
      </div>
      {marca && !registrada ? <p className="vida-nota">{s.avisoCaderneta}</p> : null}
      <p className="vida-nota">{s.soNoAparelho}</p>
      {mensagem ? (
        <p role="status" className={mensagem.ok ? "vida-ok" : "vida-erro"}>
          {mensagem.texto}
        </p>
      ) : null}
    </div>
  );
}

/** "N de M tarefas feitas", só para quem estuda (sem ranking). */
export function ContadorDeTarefas({ total, texto }: { total: number; texto: string }) {
  const n = Object.keys(useTarefas()).length;
  return (
    <p className="vida-nota" role="status" data-contador="tarefas">
      {fill(texto, { n, m: total })}
    </p>
  );
}
