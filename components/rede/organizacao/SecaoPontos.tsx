// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// 58. Pontos de apoio da comunidade: cozinha solidária, biblioteca, plantão jurídico, ponto de água. Só lugares públicos, aprovados
// pela mediação. O "como chegar" é o mesmo link do ato (OpenStreetMap com o endereço, sem Referer); a Alumia não pede a posição.
import { useId, useState, type FormEvent } from "react";
import { confirmar } from "@/components/perguntar";
import { organizacao, type PontoDeApoio, type PontosDeApoio } from "@/lib/rede/organizacao/cliente";
import { comoChegar, TIPOS_DE_PONTO } from "@/lib/rede/organizacao/regras";
import { preencher } from "@/lib/rede/preencher";
import { Botao } from "../ui/Botao";
import type { PropsDaSecaoDaComunidade } from "./TelaDaOrganizacao";
import { fraseDoErro } from "./textos";
import { useCarga } from "./usar";

export function SecaoPontos({ t, comunidade }: PropsDaSecaoDaComunidade) {
  const { dado, erro, carregando, recarregar } = useCarga<PontosDeApoio>(`pontos-${comunidade.slug}`, () => organizacao.pontos(comunidade.slug));
  const [abrir, setAbrir] = useState(false);
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const id = useId();
  const p = t.pontos;
  const tipos = p.tipos as Record<string, string>;

  async function propor(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setOcupado(true);
    try {
      await organizacao.proporPonto({
        comunidade: comunidade.slug, tipo: String(f.get("tipo") ?? "outro"), nome: String(f.get("nome") ?? ""), endereco: String(f.get("endereco") ?? ""),
        cidade: String(f.get("cidade") ?? ""), horario: String(f.get("horario") ?? ""), publico: f.get("publico") === "sim",
      });
      setMensagem({ texto: p.proposto, erro: false });
      setAbrir(false);
      recarregar();
    } catch (x) {
      setMensagem({ texto: fraseDoErro(t, x), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  async function decidir(x: PontoDeApoio, aprovar: boolean) {
    if (!aprovar && !(await confirmar(preencher(x.aprovado ? p.tirarPergunta : p.recusarPergunta, { nome: x.nome }), { sim: t.comum.sim, nao: t.comum.nao, perigo: true }))) return;
    try {
      await organizacao.decidirPonto(x.id, aprovar);
      recarregar();
    } catch (e) {
      setMensagem({ texto: fraseDoErro(t, e), erro: true });
    }
  }

  const cartao = (x: PontoDeApoio, pendente: boolean) => (
    <li key={x.id} className="or-cartao">
      <p className="or-etiqueta">{tipos[x.tipo] ?? x.tipo}</p>
      <h3>{x.nome}</h3>
      <p>{x.endereco} · {x.cidade}</p>
      {x.horario && <p className="or-miudo">{x.horario}</p>}
      <div className="or-acoes">
        <a className="or-link" href={comoChegar(x)} target="_blank" rel="noopener noreferrer">{p.chegar}</a>
        {pendente && <Botao tamanho="p" onClick={() => decidir(x, true)}>{p.aprovar}</Botao>}
        {dado?.modero && <Botao variante="fantasma" tamanho="p" onClick={() => decidir(x, false)}>{pendente ? p.recusar : t.comum.tirar}</Botao>}
      </div>
    </li>
  );

  return (
    <section className="or-bloco" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="or-subtitulo">{p.titulo}</h2>
      <p className="or-miudo">{p.sobre}</p>
      {mensagem && <p className={mensagem.erro ? "or-erro" : "or-ok"} role={mensagem.erro ? "alert" : "status"}>{mensagem.texto}</p>}
      {erro ? <p className="or-erro" role="alert">{fraseDoErro(t, erro)}</p> : null}
      {carregando && !dado ? <p className="or-miudo" role="status">{t.comum.carregando}</p> : null}
      {dado?.posso_propor && (abrir ? (
        <form className="or-form" onSubmit={propor} aria-label={p.propor}>
          <label>{p.tipo}
            <select name="tipo" defaultValue="cozinha">
              {TIPOS_DE_PONTO.map((k) => <option key={k} value={k}>{tipos[k]}</option>)}
            </select>
          </label>
          <label>{p.nome}<input type="text" name="nome" required minLength={3} maxLength={100} /></label>
          <label>{p.endereco}<input type="text" name="endereco" required minLength={3} maxLength={160} /></label>
          <label>{p.cidade}<input type="text" name="cidade" required minLength={2} maxLength={80} /></label>
          <label>{p.horario} {t.comum.opcional}<input type="text" name="horario" maxLength={120} /></label>
          <label className="or-opcao"><input type="checkbox" name="publico" value="sim" required />{p.publico}</label>
          <div className="or-acoes">
            <Botao type="submit" disabled={ocupado}>{p.enviar}</Botao>
            <Botao type="button" variante="fantasma" onClick={() => setAbrir(false)}>{t.comum.cancelar}</Botao>
          </div>
        </form>
      ) : (
        <div className="or-acoes"><Botao variante="contorno" onClick={() => setAbrir(true)}>{p.propor}</Botao></div>
      ))}
      {dado && dado.pendentes && dado.pendentes.length > 0 && (
        <>
          <h3 className="or-etiqueta">{p.esperando}</h3>
          <ul className="or-lista">{dado.pendentes.map((x) => cartao(x, true))}</ul>
        </>
      )}
      {dado && dado.pontos.length === 0 && <p className="or-miudo">{p.vazio}</p>}
      {dado && dado.pontos.length > 0 && <ul className="or-lista">{dado.pontos.map((x) => cartao(x, false))}</ul>}
    </section>
  );
}
