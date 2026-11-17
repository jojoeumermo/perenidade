// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useId, useState } from "react";
import type { TextosDaRede } from "@/lib/rede/textos";
import { preencher } from "@/lib/rede/preencher";
import { TextoFormatado, TrechoFormatado } from "../../texto/TextoFormatado";
import { questoes } from "./cliente";
import { esquecerResposta, guardarResposta, hoje, letra, type AcertosNoAparelho, type Guarda } from "./regras";
import { erroDasQuestoes, type TextosDasQuestoes } from "./textos";
import type { MotivoDaDenuncia, Questao, Resposta } from "./tipos";

const MOTIVOS: MotivoDaDenuncia[] = ["errada", "ofensiva", "dado_pessoal", "spam", "outro"];

/** O armazenamento do aparelho (nulo quando bloqueado). */
export function guardaDoAparelho(): Guarda | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Uma questão: enunciado (texto formatado, com fórmula e código), as alternativas e "Responder". A certa e a explicação só chegam
 * do banco depois da escolha (rede_questao_responder, que não guarda nada); o acerto da primeira vez fica só neste aparelho.
 */
export function CartaoDaQuestao({
  q,
  lang,
  s,
  t,
  acertos,
  aoMudarAcertos,
}: {
  q: Questao;
  lang: string;
  s: Pick<TextosDaRede, "erros">;
  t: TextosDasQuestoes;
  acertos: AcertosNoAparelho;
  aoMudarAcertos: (a: AcertosNoAparelho) => void;
}) {
  const id = useId();
  const guardada = acertos[q.id];
  const [escolha, setEscolha] = useState<number | null>(null);
  const [resposta, setResposta] = useState<Resposta | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [denunciando, setDenunciando] = useState(false);
  const [motivo, setMotivo] = useState<MotivoDaDenuncia>("errada");
  const [nota, setNota] = useState("");

  async function responder(e: number | null) {
    if (e === null) {
      setErro(t.questao.escolhaUma);
      return;
    }
    setOcupado(true);
    setErro("");
    try {
      const r = await questoes.responder(q.id, e);
      setResposta(r);
      setEscolha(e);
      aoMudarAcertos(guardarResposta(guardaDoAparelho(), q.id, { e, a: r.acertou, m: q.materia, d: hoje() }));
    } catch (x) {
      setErro(erroDasQuestoes(t, s, x));
    } finally {
      setOcupado(false);
    }
  }

  function deNovo() {
    aoMudarAcertos(esquecerResposta(guardaDoAparelho(), q.id));
    setResposta(null);
    setEscolha(null);
  }

  async function denunciar() {
    setOcupado(true);
    setErro("");
    try {
      await questoes.denunciar(q.id, motivo);
      setDenunciando(false);
      setNota(t.denuncia.enviada);
    } catch (x) {
      setErro(erroDasQuestoes(t, s, x));
    } finally {
      setOcupado(false);
    }
  }

  const respondida = resposta !== null;
  const nomeDaMateria = (t.materias as Record<string, string>)[q.materia] ?? q.materia;
  return (
    <article className="qst-cartao" aria-labelledby={`${id}-cab`}>
      <header className="qst-cartao-cabeca" id={`${id}-cab`}>
        <span className="qst-carimbo">{t.questao.carimbo}</span>
        <span className="qst-cond">{nomeDaMateria}</span>
        <span className="qst-tema">{q.tema}</span>
        {q.minha && <span className="qst-pilula">{t.questao.sua}</span>}
        {q.editada && <span className="qst-discreto">({t.questao.editada})</span>}
      </header>

      <TextoFormatado texto={q.enunciado} lang={lang} className="qst-enunciado" />

      <fieldset className="qst-alternativas" disabled={respondida || ocupado}>
        <legend className="txf-so-leitor">{t.questao.alternativas}</legend>
        {q.alternativas.map((a, i) => {
          const certa = respondida && resposta.certa === i;
          const errada = respondida && escolha === i && !resposta.acertou;
          return (
            <label key={i} className="qst-alternativa" data-certa={certa || undefined} data-errada={errada || undefined}>
              <input type="radio" name={`${id}-alt`} value={i} checked={escolha === i} onChange={() => setEscolha(i)} />
              <span className="qst-letra" aria-hidden="true">
                {letra(i)}
              </span>
              <span className="qst-alternativa-texto">
                <span className="txf-so-leitor">{letra(i)}. </span>
                <TrechoFormatado texto={a} lang={lang} />
              </span>
              {certa && <span className="qst-marca qst-marca-certa">✓ {t.questao.certa}</span>}
              {errada && <span className="qst-marca qst-marca-errada">✗ {t.questao.marcada}</span>}
            </label>
          );
        })}
      </fieldset>

      {!respondida && guardada && (
        <p className="qst-discreto qst-ja">
          {t.questao.respondida}{" "}
          <button type="button" className="qst-link" disabled={ocupado} onClick={() => responder(guardada.e)}>
            {t.questao.verResposta}
          </button>
        </p>
      )}

      {respondida ? (
        <div className="qst-resultado" role="status">
          <p className={resposta.acertou ? "qst-veredito qst-veredito-certo" : "qst-veredito qst-veredito-errado"}>{resposta.acertou ? t.questao.acertou : t.questao.errou}</p>
          {!resposta.acertou && <p className="qst-discreto">{preencher(t.questao.certaEra, { letra: letra(resposta.certa) })}</p>}
          <section className="qst-explicacao" aria-label={t.questao.explicacao}>
            <h4 className="qst-cond">{t.questao.explicacao}</h4>
            <TextoFormatado texto={resposta.explicacao} lang={lang} nivel={4} />
          </section>
          <button type="button" className="qst-botao qst-botao-contorno" onClick={deNovo}>
            {t.questao.responderDeNovo}
          </button>
        </div>
      ) : (
        <div className="qst-acoes">
          <button type="button" className="qst-botao" disabled={ocupado} onClick={() => responder(escolha)}>
            {t.questao.responder}
          </button>
        </div>
      )}

      {erro && (
        <p className="qst-erro" role="alert">
          {erro}
        </p>
      )}
      {nota && (
        <p className="qst-nota" role="status">
          {nota}
        </p>
      )}

      {!q.minha && (
        <footer className="qst-rodape">
          {denunciando ? (
            <fieldset className="qst-denuncia">
              <legend>{t.denuncia.titulo}</legend>
              {MOTIVOS.map((m) => (
                <label key={m} className="qst-opcao">
                  <input type="radio" name={`${id}-motivo`} value={m} checked={motivo === m} onChange={() => setMotivo(m)} />
                  {t.denuncia.motivos[m]}
                </label>
              ))}
              <div className="qst-acoes">
                <button type="button" className="qst-botao" disabled={ocupado} onClick={denunciar}>
                  {t.denuncia.enviar}
                </button>
                <button type="button" className="qst-botao qst-botao-contorno" onClick={() => setDenunciando(false)}>
                  {t.denuncia.cancelar}
                </button>
              </div>
            </fieldset>
          ) : (
            !nota && (
              <button type="button" className="qst-link qst-discreto" onClick={() => setDenunciando(true)}>
                {t.questao.denunciar}
              </button>
            )
          )}
        </footer>
      )}
    </article>
  );
}
