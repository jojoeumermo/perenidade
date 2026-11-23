// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// 61. Orçamento participativo: propor o uso de um valor da caixa, apoiar (uma vez, até 3 propostas) e votar na consulta da organização
// (o voto secreto que já existe; esta tela só leva até ela). Sem o nome de quem propôs ou apoiou; os apoios aparecem só depois do fim
// do apoio, cada total a partir de 3.
import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { organizacao, type Orcamento, type Orcamentos } from "@/lib/rede/organizacao/cliente";
import { centavosDoTexto } from "@/lib/rede/organizacao/regras";
import { enderecos } from "@/lib/rede/tipos";
import { preencher } from "@/lib/rede/preencher";
import { Botao } from "../ui/Botao";
import type { PropsDaSecaoDaOrg } from "./TelaDaOrganizacao";
import { diaEHora, fraseDoErro } from "./textos";
import { useCarga } from "./usar";

const daqui = (dias: number) => { const d = new Date(Date.now() + dias * 864e5); d.setSeconds(0, 0); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); };

export function SecaoOrcamento({ t, lang, org }: PropsDaSecaoDaOrg) {
  const { dado, erro, carregando, recarregar, trocar } = useCarga<Orcamentos>(`orcamentos-${org.handle}`, () => organizacao.orcamentos(org.handle));
  const [abrir, setAbrir] = useState(false);
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);
  const [marcadas, setMarcadas] = useState<Record<string, string[]>>({});
  const id = useId();
  const o = t.orcamento;
  const reais = (c: number) => new Intl.NumberFormat(lang, { style: "currency", currency: "BRL" }).format(c / 100);
  const trocarUm = (x: Orcamento) => dado && trocar({ ...dado, orcamentos: dado.orcamentos.map((y) => (y.id === x.id ? x : y)) });

  async function agir(fazer: () => Promise<Orcamento>, texto: string) {
    try {
      trocarUm(await fazer());
      setMensagem({ texto, erro: false });
    } catch (x) {
      setMensagem({ texto: fraseDoErro(t, x), erro: true });
    }
  }

  async function criar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await organizacao.criarOrcamento({
        org: org.handle, titulo: String(f.get("titulo") ?? ""), caixa: String(f.get("caixa") ?? ""), centavos: centavosDoTexto(String(f.get("valor") ?? "")) ?? -1,
        propostas_ate: new Date(String(f.get("propostas_ate"))).toISOString(), apoio_ate: new Date(String(f.get("apoio_ate"))).toISOString(),
      });
      setMensagem({ texto: o.criado, erro: false });
      setAbrir(false);
      recarregar();
    } catch (x) {
      setMensagem({ texto: fraseDoErro(t, x), erro: true });
    }
  }

  function propor(x: Orcamento) {
    return (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const form = e.currentTarget;
      void agir(() => organizacao.proporNoOrcamento(x.id, { titulo: String(f.get("titulo") ?? ""), descricao: String(f.get("descricao") ?? ""), centavos: centavosDoTexto(String(f.get("valor") ?? "")) ?? -1 }), o.proposto)
        .then(() => form.reset());
    };
  }

  const marcar = (orc: string, prop: string, sim: boolean) =>
    setMarcadas((m) => ({ ...m, [orc]: sim ? [...(m[orc] ?? []), prop].slice(-3) : (m[orc] ?? []).filter((p) => p !== prop) }));

  return (
    <section className="or-bloco" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="or-subtitulo">{o.titulo}</h2>
      <p className="or-miudo">{o.sobre}</p>
      {mensagem && <p className={mensagem.erro ? "or-erro" : "or-ok"} role={mensagem.erro ? "alert" : "status"}>{mensagem.texto}</p>}
      {erro ? <p className="or-erro" role="alert">{fraseDoErro(t, erro)}</p> : null}
      {carregando && !dado ? <p className="or-miudo" role="status">{t.comum.carregando}</p> : null}
      {dado?.posso_criar && (abrir ? (
        <form className="or-form" onSubmit={criar} aria-label={o.novo}>
          <label>{t.comum.titulo}<input type="text" name="titulo" required minLength={3} maxLength={120} /></label>
          <label>{o.valor}<input type="text" name="valor" inputMode="decimal" required placeholder="1.500,00" /></label>
          <label>{o.caixa} {t.comum.opcional}
            <select name="caixa" defaultValue=""><option value="">{o.semCaixa}</option>{dado.caixas.map((k) => <option key={k.id} value={k.id}>{k.nome}</option>)}</select>
          </label>
          <label>{o.propostasAte}<input type="datetime-local" name="propostas_ate" required defaultValue={daqui(7)} /></label>
          <label>{o.apoioAte}<input type="datetime-local" name="apoio_ate" required defaultValue={daqui(14)} /></label>
          <div className="or-acoes">
            <Botao type="submit">{t.comum.salvar}</Botao>
            <Botao type="button" variante="fantasma" onClick={() => setAbrir(false)}>{t.comum.cancelar}</Botao>
          </div>
        </form>
      ) : (
        <div className="or-acoes"><Botao variante="contorno" onClick={() => setAbrir(true)}>{o.novo}</Botao></div>
      ))}
      {dado && dado.orcamentos.length === 0 && <p className="or-miudo">{o.vazio}</p>}
      {dado && dado.orcamentos.length > 0 && (
        <ul className="or-lista">
          {dado.orcamentos.map((x) => (
            <li key={x.id} className="or-cartao">
              <p className="or-etiqueta">{(o.fases as Record<string, string>)[x.fase]}</p>
              <h3>{x.titulo}</h3>
              <p><span className="or-numero">{reais(x.centavos)}</span>{x.caixa ? ` · ${x.caixa.nome}` : ""}</p>
              <p className="or-miudo">{x.fase === "propostas" ? preencher(o.ate, { quando: diaEHora(lang, x.propostas_ate) }) : x.fase === "apoio" ? preencher(o.ate, { quando: diaEHora(lang, x.apoio_ate) }) : o.votacao}</p>
              {x.propostas.length === 0 ? <p className="or-miudo">{o.semPropostas}</p> : (
                <ul className="or-lista">
                  {x.propostas.map((p) => (
                    <li key={p.id}>
                      {x.fase === "apoio" && !x.apoiei ? (
                        <label className="or-opcao"><input type="checkbox" checked={(marcadas[x.id] ?? []).includes(p.id)} onChange={(e) => marcar(x.id, p.id, e.target.checked)} />{p.titulo} · {reais(p.centavos)}</label>
                      ) : (
                        <strong>{p.titulo} · {reais(p.centavos)}</strong>
                      )}
                      {p.descricao && <p className="or-miudo">{p.descricao}</p>}
                      {x.fase === "votacao" && <p className="or-miudo">{preencher(o.apoios, { n: p.apoios ?? t.comum.menosDe3 })}</p>}
                    </li>
                  ))}
                </ul>
              )}
              {x.fase === "propostas" && (
                <form className="or-form" onSubmit={propor(x)} aria-label={o.propor}>
                  <label>{o.oQue}<input type="text" name="titulo" required minLength={3} maxLength={120} /></label>
                  <label>{o.porQue} {t.comum.opcional}<textarea name="descricao" maxLength={600} /></label>
                  <label>{o.quanto}<input type="text" name="valor" inputMode="decimal" required /></label>
                  <div className="or-acoes"><Botao type="submit" variante="contorno" tamanho="p">{o.propor}</Botao></div>
                </form>
              )}
              {x.fase === "apoio" && (x.apoiei ? <p className="or-miudo">{o.jaApoiou}</p> : (
                <div className="or-acoes"><Botao tamanho="p" disabled={!(marcadas[x.id] ?? []).length} onClick={() => agir(() => organizacao.apoiarNoOrcamento(x.id, marcadas[x.id] ?? []), o.apoiado)}>{o.apoiar}</Botao></div>
              ))}
              {x.consulta && <p>{o.consultaLigada} <Link className="or-link" href={enderecos.perfil(lang, org.handle)}>{x.consulta.pergunta}</Link></p>}
              {x.fase === "votacao" && x.posso_conduzir && dado.consultas && (
                <label className="or-escolha">{o.ligar}
                  <select value={x.consulta?.id ?? ""} onChange={(e) => agir(() => organizacao.ligarConsulta(x.id, e.target.value || null), o.ligada)}>
                    <option value="">{o.nenhuma}</option>
                    {dado.consultas.map((c) => <option key={c.id} value={c.id}>{c.pergunta}</option>)}
                  </select>
                </label>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
