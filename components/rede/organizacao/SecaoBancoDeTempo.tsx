// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// 56. Banco de tempo da comunidade: troca de horas de serviço, sem dinheiro. Quem recebeu registra e quem deu confirma. O saldo e as
// trocas são só da própria pessoa: não existe tela (nem função no banco) que mostre o saldo de outra pessoa ou um ranking.
import { useId, useState, type FormEvent } from "react";
import { confirmar } from "@/components/perguntar";
import { organizacao, type BancoDeTempo, type TrocaDeHoras } from "@/lib/rede/organizacao/cliente";
import { duracao } from "@/lib/rede/organizacao/regras";
import { preencher } from "@/lib/rede/preencher";
import { Botao } from "../ui/Botao";
import type { PropsDaSecaoDaComunidade } from "./TelaDaOrganizacao";
import { dataCurta, fraseDoErro } from "./textos";
import { useCarga } from "./usar";

export function SecaoBancoDeTempo({ t, lang, comunidade }: PropsDaSecaoDaComunidade) {
  const { dado, erro, carregando, recarregar } = useCarga<BancoDeTempo>(`tempo-${comunidade.slug}`, () => organizacao.bancoDeTempo(comunidade.slug));
  const [abrir, setAbrir] = useState(false);
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const id = useId();
  const b = t.tempo;
  const horas = (min: number) => { const d = duracao(min); return preencher(d.min ? b.hm : b.h, { h: d.h, m: d.min }); };

  async function registrar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setOcupado(true);
    try {
      await organizacao.registrarHoras({ comunidade: comunidade.slug, de: String(f.get("de") ?? ""), minutos: Number(f.get("minutos")), servico: String(f.get("servico") ?? "") });
      setMensagem({ texto: b.registrada, erro: false });
      setAbrir(false);
      recarregar();
    } catch (x) {
      setMensagem({ texto: fraseDoErro(t, x), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  async function agir(x: TrocaDeHoras, acao: "sim" | "nao" | "apagar") {
    if (acao === "apagar" && !(await confirmar(preencher(b.apagarPergunta, { servico: x.servico }), { sim: t.comum.sim, nao: t.comum.nao, perigo: true }))) return;
    try {
      if (acao === "apagar") await organizacao.apagarHoras(x.id);
      else await organizacao.responderHoras(x.id, acao === "sim");
      recarregar();
    } catch (e) {
      setMensagem({ texto: fraseDoErro(t, e), erro: true });
    }
  }

  return (
    <section className="or-bloco" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="or-subtitulo">{b.titulo}</h2>
      <p className="or-miudo">{b.sobre}</p>
      {mensagem && <p className={mensagem.erro ? "or-erro" : "or-ok"} role={mensagem.erro ? "alert" : "status"}>{mensagem.texto}</p>}
      {erro ? <p className="or-erro" role="alert">{fraseDoErro(t, erro)}</p> : null}
      {carregando && !dado ? <p className="or-miudo" role="status">{t.comum.carregando}</p> : null}
      {dado && (
        <p className="or-cartao">
          <span className="or-etiqueta">{b.saldo}</span>
          <span className="or-numero">{dado.saldo_min < 0 ? "−" : dado.saldo_min > 0 ? "+" : ""}{horas(Math.abs(dado.saldo_min))}</span>
          <span className="or-miudo">{b.soVoce}</span>
        </p>
      )}
      {dado && (abrir ? (
        <form className="or-form" onSubmit={registrar} aria-label={b.registrar}>
          <label>{b.de}<input type="text" name="de" required pattern="@?[a-z0-9_]{3,20}" autoCapitalize="none" autoComplete="off" placeholder="@" /></label>
          <label>{b.servico}<input type="text" name="servico" required minLength={3} maxLength={120} /></label>
          <label>{b.quanto}
            <select name="minutos" defaultValue="60">
              {[30, 60, 90, 120, 180, 240, 300, 360, 420, 480].map((m) => <option key={m} value={m}>{horas(m)}</option>)}
            </select>
          </label>
          <p className="or-miudo">{b.comoConfirma}</p>
          <div className="or-acoes">
            <Botao type="submit" disabled={ocupado}>{t.comum.salvar}</Botao>
            <Botao type="button" variante="fantasma" onClick={() => setAbrir(false)}>{t.comum.cancelar}</Botao>
          </div>
        </form>
      ) : (
        <div className="or-acoes"><Botao variante="contorno" onClick={() => setAbrir(true)}>{b.registrar}</Botao></div>
      ))}
      {dado && dado.trocas.length === 0 && <p className="or-miudo">{b.vazio}</p>}
      {dado && dado.trocas.length > 0 && (
        <ul className="or-lista">
          {dado.trocas.map((x) => (
            <li key={x.id} className="or-cartao">
              <p className="or-etiqueta">{(b.estados as Record<string, string>)[x.estado]} · {dataCurta(lang, x.dia)}</p>
              <h3>{x.servico}</h3>
              <p>{preencher(x.papel === "dei" ? b.dei : b.recebi, { tempo: horas(x.minutos), codinome: x.outra?.codinome ?? "" })}</p>
              <div className="or-acoes">
                {x.pode_responder && <Botao tamanho="p" onClick={() => agir(x, "sim")}>{b.confirmar}</Botao>}
                {x.pode_responder && <Botao variante="contorno" tamanho="p" onClick={() => agir(x, "nao")}>{b.recusar}</Botao>}
                <Botao variante="fantasma" tamanho="p" onClick={() => agir(x, "apagar")}>{t.comum.apagar}</Botao>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
