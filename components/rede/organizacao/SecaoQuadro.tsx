// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// 52 e 122. O quadro da organização: a fazer, fazendo, feito. O cartão aponta o ato e a função responsável, nunca uma pessoa; "Eu
// assumo" mostra a quem assumiu que assumiu, aos outros "tem quem leve" e, só a partir de 3, quantas pessoas. O cartão recorrente
// (rodízio) volta sozinho com o prazo seguinte e a próxima função da escala quando vai para "feito". Mover é por botão (sem arrastar),
// para funcionar com teclado, leitor de tela e toque.
import { useId, useState, type FormEvent } from "react";
import { confirmar } from "@/components/perguntar";
import { organizacao, COLUNAS, type Cartao, type Coluna, type Quadro } from "@/lib/rede/organizacao/cliente";
import { preencher } from "@/lib/rede/preencher";
import { Botao } from "../ui/Botao";
import type { PropsDaSecaoDaOrg } from "./TelaDaOrganizacao";
import { dataCurta, diaEHora, fraseDoErro } from "./textos";
import { useCarga } from "./usar";

export function SecaoQuadro({ t, lang, org }: PropsDaSecaoDaOrg) {
  const { dado, erro, carregando, recarregar, trocar } = useCarga<Quadro>(`quadro-${org.handle}`, () => organizacao.quadro(org.handle));
  const [abrir, setAbrir] = useState(false);
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const id = useId();
  const q = t.quadro;

  const trocarCartao = (c: Cartao) => dado && trocar({ ...dado, cartoes: dado.cartoes.map((x) => (x.id === c.id ? c : x)) });

  async function criar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setOcupado(true);
    try {
      await organizacao.criarCartao({
        org: org.handle, titulo: String(f.get("titulo") ?? ""), notas: String(f.get("notas") ?? ""), prazo: String(f.get("prazo") ?? ""),
        ato: String(f.get("ato") ?? ""), funcao: String(f.get("funcao") ?? ""), recorrencia: String(f.get("recorrencia") ?? ""),
        rodizio: f.getAll("rodizio").map(String),
      });
      setMensagem({ texto: q.criado, erro: false });
      setAbrir(false);
      recarregar();
    } catch (x) {
      setMensagem({ texto: fraseDoErro(t, x), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  async function agir(fazer: () => Promise<Cartao>, recarregarDepois = false) {
    try {
      const c = await fazer();
      if (recarregarDepois) recarregar();
      else trocarCartao(c);
    } catch (x) {
      setMensagem({ texto: fraseDoErro(t, x), erro: true });
    }
  }

  async function apagar(c: Cartao) {
    if (!(await confirmar(preencher(q.apagarPergunta, { titulo: c.titulo }), { sim: t.comum.sim, nao: t.comum.nao, perigo: true }))) return;
    try {
      await organizacao.apagarCartao(c.id);
      if (dado) trocar({ ...dado, cartoes: dado.cartoes.filter((x) => x.id !== c.id) });
    } catch (x) {
      setMensagem({ texto: fraseDoErro(t, x), erro: true });
    }
  }

  const colunas = q.colunas as Record<Coluna, string>;
  return (
    <section className="or-bloco" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="or-subtitulo">{q.titulo}</h2>
      <p className="or-miudo">{q.sobre}</p>
      {mensagem && <p className={mensagem.erro ? "or-erro" : "or-ok"} role={mensagem.erro ? "alert" : "status"}>{mensagem.texto}</p>}
      {erro ? <p className="or-erro" role="alert">{fraseDoErro(t, erro)}</p> : null}
      {carregando && !dado ? <p className="or-miudo" role="status">{t.comum.carregando}</p> : null}
      {dado && (abrir ? (
        <form className="or-form" onSubmit={criar} aria-label={q.novo}>
          <label>{t.comum.titulo}<input type="text" name="titulo" required minLength={3} maxLength={120} /></label>
          <label>{q.notas} {t.comum.opcional}<textarea name="notas" maxLength={500} /></label>
          <label>{q.prazo} {t.comum.opcional}<input type="date" name="prazo" /></label>
          {dado.atos.length > 0 && (
            <label>{q.ato} {t.comum.opcional}
              <select name="ato" defaultValue="">
                <option value="">{q.semAto}</option>
                {dado.atos.map((a) => <option key={a.id} value={a.id}>{a.titulo} · {diaEHora(lang, a.inicio)}</option>)}
              </select>
            </label>
          )}
          {dado.funcoes.length > 0 && (
            <label>{q.funcao} {t.comum.opcional}
              <select name="funcao" defaultValue="">
                <option value="">{q.semFuncao}</option>
                {dado.funcoes.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </label>
          )}
          <label>{q.recorrencia} {t.comum.opcional}
            <select name="recorrencia" defaultValue="">
              <option value="">{q.semRecorrencia}</option>
              <option value="semanal">{q.semanal}</option>
              <option value="quinzenal">{q.quinzenal}</option>
              <option value="mensal">{q.mensal}</option>
            </select>
          </label>
          {dado.funcoes.length > 1 && (
            <fieldset>
              <legend>{q.rodizio} {t.comum.opcional}</legend>
              {dado.funcoes.map((f) => (
                <label key={f.id} className="or-opcao"><input type="checkbox" name="rodizio" value={f.id} />{f.nome}</label>
              ))}
            </fieldset>
          )}
          <div className="or-acoes">
            <Botao type="submit" disabled={ocupado}>{t.comum.salvar}</Botao>
            <Botao type="button" variante="fantasma" onClick={() => setAbrir(false)}>{t.comum.cancelar}</Botao>
          </div>
        </form>
      ) : (
        <div className="or-acoes"><Botao variante="contorno" onClick={() => setAbrir(true)}>{q.novo}</Botao></div>
      ))}
      {dado && (
        <div className="or-colunas">
          {COLUNAS.map((col) => {
            const lista = dado.cartoes.filter((c) => c.coluna === col);
            return (
              <section key={col} className="or-coluna" aria-label={colunas[col]}>
                <h3>{colunas[col]} <span className="or-numero">({lista.length})</span></h3>
                {lista.length === 0 && <p className="or-miudo">{q.vazia}</p>}
                <ul className="or-lista">
                  {lista.map((c) => (
                    <li key={c.id} className="or-cartao" data-cartao={c.id}>
                      <h4 className="or-cartao-titulo">{c.titulo}</h4>
                      {c.notas && <p>{c.notas}</p>}
                      <p className="or-etiqueta">
                        {[c.prazo ? preencher(q.ate, { dia: dataCurta(lang, c.prazo) }) : "", c.funcao?.nome ?? "", c.ato ? c.ato.titulo : "", c.recorrencia ? q[c.recorrencia] : "", c.rodizio && c.rodizio.length > 1 ? preencher(q.escala, { funcoes: c.rodizio.map((f) => f.nome).join(" → ") }) : ""].filter(Boolean).join(" · ")}
                      </p>
                      <p className="or-miudo">{c.eu ? q.euAssumi : c.tem_quem ? (c.assumidas ? preencher(q.assumidas, { n: c.assumidas }) : q.temQuem) : q.ninguem}</p>
                      <div className="or-acoes">
                        <Botao variante={c.eu ? "claro" : "contorno"} tamanho="p" pressionado={c.eu} onClick={() => agir(() => organizacao.assumirCartao(c.id, !c.eu))}>{q.assumir}</Botao>
                        {COLUNAS.filter((x) => x !== col).map((x) => (
                          <Botao key={x} variante="fantasma" tamanho="p" onClick={() => agir(() => organizacao.moverCartao(c.id, x), x === "feito" && !!c.recorrencia)}>
                            {preencher(q.moverPara, { coluna: colunas[x] })}
                          </Botao>
                        ))}
                        {dado.gerencio && <Botao variante="fantasma" tamanho="p" onClick={() => apagar(c)}>{t.comum.apagar}</Botao>}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
