// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useId, useState } from "react";
import { conferirPedido, decisao as cliente, LIMITES_DA_DECISAO as L, type Decisao, type ModoDaDecisao } from "@/lib/rede/decisao/cliente";
import { preencher } from "@/lib/rede/preencher";
import { Botao } from "../../ui/Botao";
import { erroDaDecisao, type TextosDaDecisao } from "./textos";

/** "AAAA-MM-DDTHH:MM" no horário do aparelho (o que o campo datetime-local lê e escreve). */
function paraCampo(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * A moderação abre uma votação: a pergunta, o contexto, de 2 a 8 opções, o modo (secreto ou aberto, com o que cada um quer dizer
 * escrito do lado), o quórum e o prazo. O banco confere tudo de novo. Depois de aberta, só dá para cancelar.
 */
export function NovaDecisao({ slug, td, aoAbrir, aoDesistir }: { slug: string; td: TextosDaDecisao; aoAbrir: (d: Decisao) => void; aoDesistir: () => void }) {
  const id = useId();
  const tn = td.nova;
  const [pergunta, setPergunta] = useState("");
  const [explicacao, setExplicacao] = useState("");
  const [opcoes, setOpcoes] = useState<string[]>(["", ""]);
  const [modo, setModo] = useState<ModoDaDecisao>("secreta");
  const [quorum, setQuorum] = useState(10);
  const [prazo, setPrazo] = useState(() => paraCampo(Date.now() + 3 * 86_400_000));
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  // O "agora" dos limites do campo de prazo: o da abertura do formulário (o banco confere de novo na hora de abrir).
  const [agora] = useState(() => Date.now());

  async function abrir() {
    const pedido = { pergunta, explicacao, opcoes, modo, quorum, prazo: new Date(prazo).toISOString() };
    const campo = conferirPedido(pedido);
    if (campo) return setErro((td.erros as Record<string, string>)[campo]);
    setOcupado(true);
    setErro("");
    try {
      aoAbrir(await cliente.criar(slug, pedido));
    } catch (e) {
      setErro(erroDaDecisao(td, e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form
      className="d10-nova"
      aria-labelledby={`${id}-t`}
      onSubmit={(e) => {
        e.preventDefault();
        void abrir();
      }}
    >
      <h3 id={`${id}-t`} className="d10-cond d10-nova-titulo">{tn.titulo}</h3>
      <label className="d10-campo">
        {tn.pergunta}
        <input value={pergunta} onChange={(e) => setPergunta(e.target.value)} maxLength={L.perguntaMax} placeholder={tn.perguntaDica} required minLength={L.perguntaMin} />
      </label>
      <label className="d10-campo">
        {tn.explicacao}
        <textarea value={explicacao} onChange={(e) => setExplicacao(e.target.value)} maxLength={L.explicacaoMax} placeholder={tn.explicacaoDica} rows={2} />
      </label>

      <fieldset className="d10-campo d10-campo-grupo">
        <legend>{tn.opcoes}</legend>
        <ol className="d10-lista-opcoes">
          {opcoes.map((o, i) => (
            <li key={i}>
              <span aria-hidden className="d10-cond d10-opcao-n">{i + 1}</span>
              <input
                value={o}
                onChange={(e) => setOpcoes((lista) => lista.map((x, j) => (j === i ? e.target.value : x)))}
                maxLength={L.opcaoMax}
                aria-label={preencher(tn.opcao, { n: i + 1 })}
                required={i < L.opcoesMin}
              />
              {opcoes.length > L.opcoesMin ? (
                <button type="button" className="d10-tirar" aria-label={preencher(tn.tirarOpcao, { n: i + 1 })} onClick={() => setOpcoes((lista) => lista.filter((_, j) => j !== i))}>
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ol>
        {opcoes.length < L.opcoesMax ? (
          <Botao variante="contorno" tamanho="p" onClick={() => setOpcoes((lista) => [...lista, ""])}>
            + {tn.maisOpcao}
          </Botao>
        ) : null}
      </fieldset>

      <fieldset className="d10-campo d10-campo-grupo">
        <legend>{tn.modo}</legend>
        <div className="d10-modos">
          {(["secreta", "aberta"] as const).map((m) => (
            <label key={m} className="d10-modo">
              <input type="radio" name={`${id}-modo`} value={m} checked={modo === m} onChange={() => setModo(m)} />
              <span className="d10-cond d10-modo-nome">{m === "secreta" ? tn.secreta : tn.aberta}</span>
              <span className="d10-modo-dica">{m === "secreta" ? tn.secretaDica : tn.abertaDica}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="d10-dois">
        <label className="d10-campo">
          {tn.quorum}
          <input type="number" inputMode="numeric" min={L.quorumMin} max={L.quorumMax} step={1} value={quorum} onChange={(e) => setQuorum(Math.floor(Number(e.target.value)))} aria-describedby={`${id}-q`} />
          <span id={`${id}-q`} className="d10-nota">{tn.quorumDica}</span>
        </label>
        <label className="d10-campo">
          {tn.prazo}
          <input
            type="datetime-local"
            value={prazo}
            min={paraCampo(agora + L.prazoMinHoras * 3_600_000)}
            max={paraCampo(agora + L.prazoMaxDias * 86_400_000)}
            onChange={(e) => setPrazo(e.target.value)}
            aria-describedby={`${id}-p`}
            required
          />
          <span id={`${id}-p`} className="d10-nota">{tn.prazoDica}</span>
        </label>
      </div>

      <p className="d10-nota">{tn.naoMuda}</p>
      <div className="d10-acoes">
        <Botao type="submit" disabled={ocupado}>
          {ocupado ? tn.abrindo : tn.abrir}
        </Botao>
        <Botao variante="contorno" disabled={ocupado} onClick={aoDesistir}>
          {tn.desistir}
        </Botao>
      </div>
      {erro ? (
        <p className="d10-erro" role="alert">
          {erro}
        </p>
      ) : null}
    </form>
  );
}
