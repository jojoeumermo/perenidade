// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import type { TextosDaRede } from "@/lib/rede/textos";
import { preencher } from "@/lib/rede/preencher";
import { EditorDeTexto } from "../../texto/EditorDeTexto";
import { TrechoFormatado } from "../../texto/TextoFormatado";
import { questoes } from "./cliente";
import { LIMITES, letra, MATERIAS, problemasDaQuestao, type QuestaoParaEnviar } from "./regras";
import { erroDasQuestoes, type TextosDasQuestoes } from "./textos";
import type { QuestaoCompleta } from "./tipos";

const VAZIA: QuestaoParaEnviar = { materia: "", tema: "", enunciado: "", alternativas: ["", "", "", ""], certa: -1, explicacao: "" };

/**
 * Escrever (ou editar) uma questão: matéria, tema, enunciado e explicação com o texto formatado (fórmula, código, ver como fica),
 * de 2 a 5 alternativas e qual é a certa. A régua é a mesma do banco (./regras), que confere de novo e limpa o texto.
 */
export function EscreverQuestao({
  lang,
  s,
  t,
  editando,
  materiaInicial,
  aoTerminar,
}: {
  lang: string;
  s: Pick<TextosDaRede, "erros">;
  t: TextosDasQuestoes;
  editando?: QuestaoCompleta | null;
  materiaInicial?: string | null;
  aoTerminar: (id: string | null, mensagem: string) => void;
}) {
  const [q, setQ] = useState<QuestaoParaEnviar>(() =>
    editando
      ? { materia: editando.materia, tema: editando.tema, enunciado: editando.enunciado, alternativas: [...editando.alternativas], certa: editando.certa, explicacao: editando.explicacao }
      : { ...VAZIA, materia: materiaInicial ?? "" },
  );
  const [tentou, setTentou] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const problemas = problemasDaQuestao(q);
  const muda = (parte: Partial<QuestaoParaEnviar>) => setQ((x) => ({ ...x, ...parte }));

  async function enviar() {
    setTentou(true);
    if (problemas.length) return;
    setOcupado(true);
    setErro("");
    try {
      const r = await questoes.salvar(editando?.id ?? null, { ...q, tema: q.tema.trim(), alternativas: q.alternativas.map((a) => a.trim()) });
      aoTerminar(r.id, r.criada ? t.escrever.publicada : t.escrever.salva);
    } catch (x) {
      setErro(erroDasQuestoes(t, s, x));
    } finally {
      setOcupado(false);
    }
  }

  function tirar(i: number) {
    const alternativas = q.alternativas.filter((_, j) => j !== i);
    muda({ alternativas, certa: q.certa === i ? -1 : q.certa > i ? q.certa - 1 : q.certa });
  }

  const avisos = tentou ? problemas.map((p) => t.escrever.problemas[p]) : [];
  return (
    <form
      className="qst-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void enviar();
      }}
    >
      <h3 className="qst-cond qst-subtitulo">{editando ? t.escrever.editar : t.escrever.titulo}</h3>
      <p className="qst-discreto">{t.escrever.intro}</p>

      <div className="qst-linha-dupla">
        <label className="qst-campo">
          <span className="qst-rotulo">{t.escrever.materia}</span>
          <select className="qst-entrada" value={q.materia} onChange={(e) => muda({ materia: e.target.value })} aria-invalid={tentou && problemas.includes("materia")}>
            <option value="" disabled>
              {t.materia.escolha}
            </option>
            {MATERIAS.map((m) => (
              <option key={m} value={m}>
                {t.materias[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="qst-campo">
          <span className="qst-rotulo">{t.escrever.tema}</span>
          <input
            className="qst-entrada"
            value={q.tema}
            maxLength={LIMITES.tema[1]}
            placeholder={t.escrever.temaDica}
            onChange={(e) => muda({ tema: e.target.value })}
            aria-invalid={tentou && problemas.includes("tema")}
          />
        </label>
      </div>

      <EditorDeTexto lang={lang} rotulo={t.escrever.enunciado} valor={q.enunciado} aoMudar={(v) => muda({ enunciado: v })} max={LIMITES.enunciado[1]} linhas={7} obrigatorio />

      <fieldset className="qst-alternativas-form">
        <legend className="qst-rotulo">{t.escrever.alternativas}</legend>
        {q.alternativas.map((a, i) => (
          <div key={i} className="qst-alternativa-form" data-certa={q.certa === i || undefined}>
            <span className="qst-letra" aria-hidden="true">
              {letra(i)}
            </span>
            <div className="qst-alternativa-campos">
              <input
                className="qst-entrada"
                value={a}
                maxLength={LIMITES.alternativa[1]}
                aria-label={preencher(t.escrever.alternativa, { letra: letra(i) })}
                onChange={(e) => muda({ alternativas: q.alternativas.map((x, j) => (j === i ? e.target.value : x)) })}
              />
              {/[`$*_[]/.test(a) && (
                <span className="qst-previa-curta">
                  <TrechoFormatado texto={a} lang={lang} />
                </span>
              )}
            </div>
            <label className="qst-opcao qst-opcao-certa">
              <input type="radio" name="qst-certa" checked={q.certa === i} onChange={() => muda({ certa: i })} />
              {t.escrever.certa}
            </label>
            {q.alternativas.length > LIMITES.alternativas[0] && (
              <button type="button" className="qst-botao-icone" aria-label={preencher(t.escrever.tirar, { letra: letra(i) })} onClick={() => tirar(i)}>
                <span aria-hidden="true">×</span>
              </button>
            )}
          </div>
        ))}
        {q.alternativas.length < LIMITES.alternativas[1] && (
          <button type="button" className="qst-botao qst-botao-contorno" onClick={() => muda({ alternativas: [...q.alternativas, ""] })}>
            + {t.escrever.maisUma}
          </button>
        )}
      </fieldset>

      <EditorDeTexto lang={lang} rotulo={t.escrever.explicacao} valor={q.explicacao} aoMudar={(v) => muda({ explicacao: v })} max={LIMITES.explicacao[1]} linhas={5} obrigatorio />

      <p className="qst-discreto">{t.escrever.semNome}</p>
      {avisos.length > 0 && (
        <ul className="qst-erro" role="alert">
          {avisos.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )}
      {erro && (
        <p className="qst-erro" role="alert">
          {erro}
        </p>
      )}
      <div className="qst-acoes">
        <button type="submit" className="qst-botao" disabled={ocupado}>
          {editando ? t.escrever.salvar : t.escrever.publicar}
        </button>
        <button type="button" className="qst-botao qst-botao-contorno" onClick={() => aoTerminar(null, "")}>
          {t.escrever.cancelar}
        </button>
      </div>
    </form>
  );
}
