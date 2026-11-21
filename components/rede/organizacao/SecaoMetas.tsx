// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// 62. Meta coletiva da organização: "500 panfletos até sexta". Cada pessoa de dentro soma o que fez; a soma só aparece com 3 pessoas ou
// mais, e nunca quem somou quanto. Sem ranking.
import { useId, useState, type FormEvent } from "react";
import { organizacao, type Meta, type Metas } from "@/lib/rede/organizacao/cliente";
import { preencher } from "@/lib/rede/preencher";
import { Botao } from "../ui/Botao";
import type { PropsDaSecaoDaOrg } from "./TelaDaOrganizacao";
import { dataCurta, fraseDoErro } from "./textos";
import { useCarga } from "./usar";

export function SecaoMetas({ t, lang, org }: PropsDaSecaoDaOrg) {
  const { dado, erro, carregando, recarregar, trocar } = useCarga<Metas>(`metas-${org.handle}`, () => organizacao.metas(org.handle));
  const [abrir, setAbrir] = useState(false);
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);
  const id = useId();
  const m = t.metas;
  const trocarUma = (x: Meta) => dado && trocar({ ...dado, metas: dado.metas.map((y) => (y.id === x.id ? x : y)) });

  async function criar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await organizacao.criarMeta({ org: org.handle, titulo: String(f.get("titulo") ?? ""), unidade: String(f.get("unidade") ?? ""), alvo: Number(f.get("alvo")), prazo: String(f.get("prazo") ?? "") });
      setMensagem({ texto: m.criada, erro: false });
      setAbrir(false);
      recarregar();
    } catch (x) {
      setMensagem({ texto: fraseDoErro(t, x), erro: true });
    }
  }

  function somar(x: Meta) {
    return async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget;
      try {
        trocarUma(await organizacao.somarNaMeta(x.id, Number(new FormData(form).get("quanto"))));
        setMensagem({ texto: m.somado, erro: false });
        form.reset();
      } catch (y) {
        setMensagem({ texto: fraseDoErro(t, y), erro: true });
      }
    };
  }

  async function encerrar(x: Meta) {
    try {
      trocarUma(await organizacao.encerrarMeta(x.id));
    } catch (y) {
      setMensagem({ texto: fraseDoErro(t, y), erro: true });
    }
  }

  return (
    <section className="or-bloco" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="or-subtitulo">{m.titulo}</h2>
      <p className="or-miudo">{m.sobre}</p>
      {mensagem && <p className={mensagem.erro ? "or-erro" : "or-ok"} role={mensagem.erro ? "alert" : "status"}>{mensagem.texto}</p>}
      {erro ? <p className="or-erro" role="alert">{fraseDoErro(t, erro)}</p> : null}
      {carregando && !dado ? <p className="or-miudo" role="status">{t.comum.carregando}</p> : null}
      {dado?.posso_criar && (abrir ? (
        <form className="or-form" onSubmit={criar} aria-label={m.nova}>
          <label>{m.oQue}<input type="text" name="titulo" required minLength={3} maxLength={120} /></label>
          <label>{m.unidade}<input type="text" name="unidade" required minLength={2} maxLength={30} placeholder={m.exemploUnidade} /></label>
          <label>{m.alvo}<input type="number" name="alvo" required min={1} max={10000000} /></label>
          <label>{m.prazo} {t.comum.opcional}<input type="date" name="prazo" /></label>
          <div className="or-acoes">
            <Botao type="submit">{t.comum.salvar}</Botao>
            <Botao type="button" variante="fantasma" onClick={() => setAbrir(false)}>{t.comum.cancelar}</Botao>
          </div>
        </form>
      ) : (
        <div className="or-acoes"><Botao variante="contorno" onClick={() => setAbrir(true)}>{m.nova}</Botao></div>
      ))}
      {dado && dado.metas.length === 0 && <p className="or-miudo">{m.vazio}</p>}
      {dado && dado.metas.length > 0 && (
        <ul className="or-lista">
          {dado.metas.map((x) => {
            const pct = x.soma === null ? null : Math.min(100, Math.round((x.soma / x.alvo) * 100));
            return (
              <li key={x.id} className="or-cartao">
                <p className="or-etiqueta">{x.encerrada ? m.encerrada : x.prazo ? preencher(m.ate, { dia: dataCurta(lang, x.prazo) }) : m.aberta}</p>
                <h3>{x.titulo}</h3>
                <p>{preencher(m.alvoDe, { n: x.alvo.toLocaleString(lang), unidade: x.unidade })}</p>
                {pct === null ? <p className="or-miudo">{m.poucos}</p> : (
                  <>
                    <div className="or-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={x.titulo}><span style={{ width: `${pct}%` }} /></div>
                    <p><span className="or-numero">{preencher(m.soma, { n: (x.soma ?? 0).toLocaleString(lang), unidade: x.unidade, pct })}</span>{x.atingida ? ` · ${m.batida}` : ""}</p>
                  </>
                )}
                {x.somei && <p className="or-miudo">{m.voceSomou}</p>}
                {!x.encerrada && (
                  <form className="or-acoes" onSubmit={somar(x)} aria-label={preencher(m.somarEm, { titulo: x.titulo })}>
                    <label className="or-escolha">{preencher(m.quanto, { unidade: x.unidade })}<input type="number" name="quanto" required min={1} max={x.alvo} style={{ minHeight: 44, maxWidth: "8rem" }} /></label>
                    <Botao type="submit" tamanho="p">{m.somar}</Botao>
                    {x.posso_encerrar && <Botao type="button" variante="fantasma" tamanho="p" onClick={() => encerrar(x)}>{m.encerrar}</Botao>}
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
