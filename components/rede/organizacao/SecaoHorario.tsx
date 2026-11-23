// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// 53. Enquete de horário para reunião: quem conduz a mesa abre com 2 a 12 horários; cada pessoa de dentro marca uma vez os horários
// em que pode. Voto secreto: enquanto está aberta, ninguém vê parcial; fechada, só os totais a partir de 3 e o melhor horário.
import { useId, useState, type FormEvent } from "react";
import { organizacao, type EnqueteDeHorario, type Horarios } from "@/lib/rede/organizacao/cliente";
import { preencher } from "@/lib/rede/preencher";
import { Botao } from "../ui/Botao";
import type { PropsDaSecaoDaOrg } from "./TelaDaOrganizacao";
import { diaEHora, fraseDoErro } from "./textos";
import { useCarga } from "./usar";

/** O valor de um <input type="datetime-local"> (hora do aparelho) como instante ISO. */
const instante = (v: string) => (v ? new Date(v).toISOString() : "");

export function SecaoHorario({ t, lang, org }: PropsDaSecaoDaOrg) {
  const { dado, erro, carregando, recarregar, trocar } = useCarga<Horarios>(`horarios-${org.handle}`, () => organizacao.horarios(org.handle));
  const [abrir, setAbrir] = useState(false);
  const [campos, setCampos] = useState(3);
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const id = useId();
  const h = t.horario;

  const trocarEnquete = (e: EnqueteDeHorario) => dado && trocar({ ...dado, enquetes: dado.enquetes.map((x) => (x.id === e.id ? e : x)) });

  async function criar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    setOcupado(true);
    try {
      await organizacao.criarHorario({
        org: org.handle, titulo: String(f.get("titulo") ?? ""), opcoes: f.getAll("opcao").map((x) => instante(String(x))).filter(Boolean), fecha_em: instante(String(f.get("fecha_em") ?? "")),
      });
      setMensagem({ texto: h.criada, erro: false });
      setAbrir(false);
      recarregar();
    } catch (x) {
      setMensagem({ texto: fraseDoErro(t, x), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  async function votar(ev: FormEvent<HTMLFormElement>, e: EnqueteDeHorario) {
    ev.preventDefault();
    const marcadas = new FormData(ev.currentTarget).getAll("pode").map(Number);
    try {
      trocarEnquete(await organizacao.votarHorario(e.id, marcadas));
      setMensagem({ texto: h.votou, erro: false });
    } catch (x) {
      setMensagem({ texto: fraseDoErro(t, x), erro: true });
    }
  }

  async function fechar(e: EnqueteDeHorario) {
    try {
      trocarEnquete(await organizacao.fecharHorario(e.id));
    } catch (x) {
      setMensagem({ texto: fraseDoErro(t, x), erro: true });
    }
  }

  return (
    <section className="or-bloco" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="or-subtitulo">{h.titulo}</h2>
      <p className="or-miudo">{h.sobre}</p>
      {mensagem && <p className={mensagem.erro ? "or-erro" : "or-ok"} role={mensagem.erro ? "alert" : "status"}>{mensagem.texto}</p>}
      {erro ? <p className="or-erro" role="alert">{fraseDoErro(t, erro)}</p> : null}
      {carregando && !dado ? <p className="or-miudo" role="status">{t.comum.carregando}</p> : null}
      {dado?.posso_criar && (abrir ? (
        <form className="or-form" onSubmit={criar} aria-label={h.nova}>
          <label>{t.comum.titulo}<input type="text" name="titulo" required minLength={3} maxLength={120} /></label>
          <fieldset>
            <legend>{h.opcoes}</legend>
            {Array.from({ length: campos }, (_, i) => (
              <label key={i}>{preencher(h.opcao, { n: i + 1 })}<input type="datetime-local" name="opcao" required={i < 2} /></label>
            ))}
            {campos < 12 && <div className="or-acoes"><Botao type="button" variante="fantasma" tamanho="p" onClick={() => setCampos((n) => n + 1)}>{h.maisUm}</Botao></div>}
          </fieldset>
          <label>{h.fecha}<input type="datetime-local" name="fecha_em" required /></label>
          <div className="or-acoes">
            <Botao type="submit" disabled={ocupado}>{t.comum.salvar}</Botao>
            <Botao type="button" variante="fantasma" onClick={() => setAbrir(false)}>{t.comum.cancelar}</Botao>
          </div>
        </form>
      ) : (
        <div className="or-acoes"><Botao variante="contorno" onClick={() => setAbrir(true)}>{h.nova}</Botao></div>
      ))}
      {dado && dado.enquetes.length === 0 && <p className="or-miudo">{h.vazio}</p>}
      {dado && dado.enquetes.length > 0 && (
        <ul className="or-lista">
          {dado.enquetes.map((e) => (
            <li key={e.id} className="or-cartao">
              <h3>{e.titulo}</h3>
              <p className="or-etiqueta">{e.fechada ? h.fechada : preencher(h.fechaEm, { quando: diaEHora(lang, e.fecha_em) })}</p>
              {!e.fechada && !e.votei && (
                <form className="or-form" onSubmit={(ev) => votar(ev, e)} aria-label={preencher(h.votarEm, { titulo: e.titulo })}>
                  <fieldset>
                    <legend>{h.quando}</legend>
                    {e.opcoes.map((o, i) => (
                      <label key={o} className="or-opcao"><input type="checkbox" name="pode" value={i + 1} />{diaEHora(lang, o)}</label>
                    ))}
                  </fieldset>
                  <div className="or-acoes"><Botao type="submit">{h.votar}</Botao></div>
                </form>
              )}
              {!e.fechada && e.votei && <p className="or-miudo">{h.jaVotou}</p>}
              {e.fechada && e.resultado && (
                <>
                  <ul className="or-lista">
                    {e.opcoes.map((o, i) => (
                      <li key={o} className={e.resultado?.melhor === i + 1 ? "or-ok" : "or-miudo"}>
                        {diaEHora(lang, o)}: <span className="or-numero">{e.resultado?.totais[i] ?? t.comum.menosDe3}</span>{e.resultado?.melhor === i + 1 ? ` · ${h.melhor}` : ""}
                      </li>
                    ))}
                  </ul>
                  <p className="or-miudo">{e.resultado.votantes ? preencher(h.votantes, { n: e.resultado.votantes }) : h.poucos}</p>
                </>
              )}
              {!e.fechada && e.posso_fechar && <div className="or-acoes"><Botao variante="fantasma" tamanho="p" onClick={() => fechar(e)}>{h.fechar}</Botao></div>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
