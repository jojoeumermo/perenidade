// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useState } from "react";
import { apurarDecisao, decisao as cliente, faltaAte, maiorVisivel, type Decisao } from "@/lib/rede/decisao/cliente";
import { preencher } from "@/lib/rede/preencher";
import { Botao } from "../../ui/Botao";
import { dataEHora, erroDaDecisao, tempoQueFalta, type TextosDaDecisao } from "./textos";

/**
 * Uma votação da comunidade. Aberta: a pergunta, o carimbo do modo (secreto ou aberto, à vista ANTES de votar), o quórum, o prazo e
 * as opções em ladrilhos; no modo aberto, a pessoa confirma que o nome vai junto antes do voto sair. Encerrada: o resultado em
 * barras, só com 3 votos ou mais e o quórum atingido (a opção com menos de 3 diz "menos de 3", sem barra); no modo aberto, os nomes
 * por opção. Fechada com cédula cifrada ainda fechada, a tela pede a apuração ao servidor e lê de novo.
 */
export function CartaoDaDecisao({ d, td, lang, modero, aoMudar, aoReler }: {
  d: Decisao;
  td: TextosDaDecisao;
  lang: string;
  modero: boolean;
  aoMudar: (d: Decisao) => void;
  aoReler: () => void;
}) {
  const id = useId();
  const tc = td.cartao;
  const [escolha, setEscolha] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [cancelar, setCancelar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  // Fechada com cédulas cifradas: o servidor abre todas de uma vez; depois, a lista é lida de novo (uma vez por votação).
  useEffect(() => {
    if (d.situacao !== "fechada" || !d.apurar) return;
    let vivo = true;
    void apurarDecisao(d.id).then((abriu) => vivo && abriu && aoReler());
    return () => {
      vivo = false;
    };
  }, [d.id, d.situacao, d.apurar, aoReler]);

  const falta = d.situacao === "aberta" ? faltaAte(d.prazo) : null;
  const textoDa = (oid: string) => d.opcoes.find((o) => o.id === oid)?.texto ?? "";

  async function votar() {
    if (!escolha) return;
    if (d.modo === "aberta" && !confirmar) return setConfirmar(true);
    setOcupado(true);
    setErro("");
    try {
      await cliente.votar(d, escolha);
      setConfirmar(false);
      aoMudar({ ...d, votei: true, possoVotar: false, impedimento: "ja_votou" });
    } catch (e) {
      setErro(erroDaDecisao(td, e));
    } finally {
      setOcupado(false);
    }
  }

  async function cancelarVotacao() {
    setOcupado(true);
    setErro("");
    try {
      aoMudar(await cliente.cancelar(d.id));
      setCancelar(false);
    } catch (e) {
      setErro(erroDaDecisao(td, e));
    } finally {
      setOcupado(false);
    }
  }

  const maior = maiorVisivel(d.opcoes);
  const impedimento = d.impedimento === "chegou_depois" ? tc.chegouDepois : d.impedimento === "nao_membro" ? tc.naoMembro : d.impedimento === "entre_na_alumia" ? tc.entreNaAlumia : null;

  return (
    <article className={`d10-cartao d10-cartao-${d.situacao}`} aria-labelledby={`${id}-p`}>
      <div className="d10-cartao-topo">
        <span className={`d10-cond d10-estado d10-estado-${d.situacao}`}>{td.situacao[d.situacao]}</span>
        <span className="d10-quando">
          {d.situacao === "aberta" ? (falta ? preencher(tc.fechaEm, { tempo: tempoQueFalta(td, falta) }) : "") : preencher(tc.fechou, { data: dataEHora(d.prazo, lang) })}
        </span>
        <span className={`d10-cond d10-carimbo d10-carimbo-${d.modo}`}>{td.modo[d.modo]}</span>
      </div>
      <h3 id={`${id}-p`} className="d10-cond d10-pergunta">{d.pergunta}</h3>
      {d.explicacao ? <p className="d10-explicacao">{d.explicacao}</p> : null}
      <p className="d10-nota">{preencher(tc.quorum, { n: d.quorum })}</p>

      {d.situacao === "cancelada" ? (
        <p className="d10-nota d10-nota-forte">{tc.cancelada}</p>
      ) : d.situacao === "fechada" ? (
        <Resultado d={d} td={td} maior={maior} />
      ) : d.votei ? (
        <p className="d10-ok" role="status">
          <span aria-hidden className="d10-ok-marca">✓</span> {tc.votei} {tc.resultadoDepois}
        </p>
      ) : d.possoVotar ? (
        <form
          className="d10-voto"
          onSubmit={(e) => {
            e.preventDefault();
            void votar();
          }}
        >
          {d.modo === "aberta" ? <p className="d10-aviso-aberta">{tc.avisoAberta}</p> : null}
          <fieldset className="d10-opcoes" disabled={ocupado || confirmar}>
            <legend className="d10-nota">{tc.escolha}</legend>
            {d.opcoes.map((o, i) => (
              <label key={o.id} className="d10-opcao">
                <input type="radio" name={`${id}-op`} value={o.id} checked={escolha === o.id} onChange={() => setEscolha(o.id)} />
                <span aria-hidden className="d10-cond d10-opcao-n">{i + 1}</span>
                <span className="d10-opcao-texto">{o.texto}</span>
              </label>
            ))}
          </fieldset>
          {confirmar ? (
            <div className="d10-confirmar" role="alertdialog" aria-labelledby={`${id}-c`} onKeyDown={(e) => { if (e.key === "Escape" && !ocupado) setConfirmar(false); }}>
              <p id={`${id}-c`}>{preencher(tc.confirmarAberta, { opcao: textoDa(escolha) })}</p>
              <div className="d10-acoes">
                <Botao type="submit" disabled={ocupado} autoFocus>
                  {ocupado ? tc.votando : tc.confirmarSim}
                </Botao>
                <Botao variante="contorno" disabled={ocupado} onClick={() => setConfirmar(false)}>
                  {tc.confirmarNao}
                </Botao>
              </div>
            </div>
          ) : (
            <div className="d10-acoes">
              <Botao type="submit" disabled={ocupado || !escolha}>
                {ocupado ? tc.votando : tc.votar}
              </Botao>
              <span className="d10-nota">{tc.resultadoDepois}</span>
            </div>
          )}
          <p className="d10-nota">{tc.regraVoto}</p>
          {d.modo === "secreta" ? (
            <details className="d10-como">
              <summary>{tc.comoTitulo}</summary>
              <p>{tc.comoTexto}</p>
            </details>
          ) : null}
        </form>
      ) : (
        <p className="d10-nota d10-nota-forte">
          {impedimento} {tc.resultadoDepois}
        </p>
      )}

      {modero && d.situacao === "aberta" ? (
        cancelar ? (
          <div className="d10-confirmar d10-confirmar-perigo" role="alertdialog" aria-labelledby={`${id}-x`} onKeyDown={(e) => { if (e.key === "Escape" && !ocupado) setCancelar(false); }}>
            <p id={`${id}-x`}>{tc.cancelarPergunta}</p>
            <div className="d10-acoes">
              <Botao variante="primario" disabled={ocupado} onClick={() => void cancelarVotacao()}>
                {tc.cancelarSim}
              </Botao>
              <Botao variante="contorno" disabled={ocupado} onClick={() => setCancelar(false)} autoFocus>
                {tc.cancelarNao}
              </Botao>
            </div>
          </div>
        ) : (
          <div className="d10-rodape">
            <Botao variante="fantasma" tamanho="p" onClick={() => setCancelar(true)}>
              {tc.cancelar}
            </Botao>
          </div>
        )
      ) : null}
      {erro ? (
        <p className="d10-erro" role="alert">
          {erro}
        </p>
      ) : null}
    </article>
  );
}

/** O resultado de uma votação encerrada (ou por que ele não aparece). */
function Resultado({ d, td, maior }: { d: Decisao; td: TextosDaDecisao; maior: number | null }) {
  const tc = td.cartao;
  const semNumeros = d.resultado && d.numeros === false;
  const linhaDeQuem = semNumeros ? tc.semNumeros : d.votantes === null ? tc.votantesPoucos : preencher(tc.votantes, { n: d.votantes });
  if (d.apurar) return <p className="d10-nota" role="status">{tc.apurando}</p>;
  return (
    <div className="d10-resultado">
      {d.resultado ? (
        <>
          <h4 className="d10-cond d10-resultado-titulo">{tc.resultado}</h4>
          <ol className="d10-barras">
            {d.opcoes.map((o) => (
              <li key={o.id} className={`d10-barra ${o.vencedora ? "d10-barra-vencedora" : ""}`}>
                <div className="d10-barra-cabeca">
                  <span className="d10-barra-texto">{o.texto}</span>
                  {o.vencedora && !d.empate ? <span className="d10-cond d10-venceu">{tc.venceu}</span> : null}
                  {semNumeros ? null : <span className="d10-cond d10-barra-n">{o.votos === null ? tc.menosDe3 : preencher(tc.votos, { n: o.votos })}</span>}
                </div>
                {semNumeros ? null : (
                  <div className="d10-trilho" aria-hidden>
                    {o.votos !== null && maior ? <span className="d10-preenchido" style={{ inlineSize: `${Math.max(4, Math.round((o.votos / maior) * 100))}%` }} /> : null}
                  </div>
                )}
                {o.quem && o.quem.length > 0 ? (
                  <p className="d10-quem">
                    <span className="d10-quem-rotulo">{tc.quem}:</span> {o.quem.join(", ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
          {d.empate ? <p className="d10-nota d10-nota-forte">{tc.empate}</p> : null}
        </>
      ) : d.quorumAtingido === false || d.votantes === null ? null : (
        <p className="d10-nota">{tc.semResultado}</p>
      )}
      <p className="d10-nota">
        {linhaDeQuem} {semNumeros ? tc.quorumOk : d.votantes === null ? "" : d.quorumAtingido ? tc.quorumOk : tc.quorumNao}
      </p>
    </div>
  );
}
