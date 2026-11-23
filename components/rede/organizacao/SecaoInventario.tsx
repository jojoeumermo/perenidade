// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// 57. Inventário solidário da organização: megafone, faixa, som. Lista coisas, não pessoas: quem é de dentro marca que pegou ou
// devolveu, e o banco só conta quantas estão fora, nunca com quem.
import { useId, useState, type FormEvent } from "react";
import { confirmar } from "@/components/perguntar";
import { organizacao, type CoisaDoInventario, type Inventario } from "@/lib/rede/organizacao/cliente";
import { preencher } from "@/lib/rede/preencher";
import { Botao } from "../ui/Botao";
import type { PropsDaSecaoDaOrg } from "./TelaDaOrganizacao";
import { fraseDoErro } from "./textos";
import { useCarga } from "./usar";

export function SecaoInventario({ t, org }: PropsDaSecaoDaOrg) {
  const { dado, erro, carregando, recarregar, trocar } = useCarga<Inventario>(`inventario-${org.handle}`, () => organizacao.inventario(org.handle));
  const [abrir, setAbrir] = useState(false);
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const id = useId();
  const i = t.inventario;

  async function criar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setOcupado(true);
    try {
      await organizacao.criarCoisa({ org: org.handle, nome: String(f.get("nome") ?? ""), notas: String(f.get("notas") ?? ""), quantidade: Number(f.get("quantidade") || 1) });
      setMensagem({ texto: i.posta, erro: false });
      setAbrir(false);
      recarregar();
    } catch (x) {
      setMensagem({ texto: fraseDoErro(t, x), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  async function emprestar(c: CoisaDoInventario, pegar: boolean) {
    try {
      const nova = await organizacao.emprestarCoisa(c.id, pegar);
      if (dado) trocar({ ...dado, coisas: dado.coisas.map((x) => (x.id === c.id ? nova : x)) });
      setMensagem({ texto: preencher(pegar ? i.pegou : i.devolveu, { nome: c.nome }), erro: false });
    } catch (x) {
      setMensagem({ texto: fraseDoErro(t, x), erro: true });
    }
  }

  async function apagar(c: CoisaDoInventario) {
    if (!(await confirmar(preencher(i.apagarPergunta, { nome: c.nome }), { sim: t.comum.sim, nao: t.comum.nao, perigo: true }))) return;
    try {
      await organizacao.apagarCoisa(c.id);
      if (dado) trocar({ ...dado, coisas: dado.coisas.filter((x) => x.id !== c.id) });
    } catch (x) {
      setMensagem({ texto: fraseDoErro(t, x), erro: true });
    }
  }

  return (
    <section className="or-bloco" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="or-subtitulo">{i.titulo}</h2>
      <p className="or-miudo">{i.sobre}</p>
      {mensagem && <p className={mensagem.erro ? "or-erro" : "or-ok"} role={mensagem.erro ? "alert" : "status"}>{mensagem.texto}</p>}
      {erro ? <p className="or-erro" role="alert">{fraseDoErro(t, erro)}</p> : null}
      {carregando && !dado ? <p className="or-miudo" role="status">{t.comum.carregando}</p> : null}
      {dado?.gerencio && (abrir ? (
        <form className="or-form" onSubmit={criar} aria-label={i.nova}>
          <label>{i.nome}<input type="text" name="nome" required minLength={3} maxLength={80} /></label>
          <label>{i.quantidade}<input type="number" name="quantidade" min={1} max={99} defaultValue={1} required /></label>
          <label>{i.notas} {t.comum.opcional}<input type="text" name="notas" maxLength={200} /></label>
          <div className="or-acoes">
            <Botao type="submit" disabled={ocupado}>{t.comum.salvar}</Botao>
            <Botao type="button" variante="fantasma" onClick={() => setAbrir(false)}>{t.comum.cancelar}</Botao>
          </div>
        </form>
      ) : (
        <div className="or-acoes"><Botao variante="contorno" onClick={() => setAbrir(true)}>{i.nova}</Botao></div>
      ))}
      {dado && dado.coisas.length === 0 && <p className="or-miudo">{i.vazio}</p>}
      {dado && dado.coisas.length > 0 && (
        <ul className="or-lista">
          {dado.coisas.map((c) => (
            <li key={c.id} className="or-cartao">
              <h3>{c.nome}</h3>
              {c.notas && <p className="or-miudo">{c.notas}</p>}
              <p><span className="or-numero">{preencher(i.disponiveis, { n: c.disponiveis, total: c.quantidade })}</span></p>
              <div className="or-acoes">
                <Botao tamanho="p" disabled={c.disponiveis < 1} onClick={() => emprestar(c, true)}>{i.pegar}</Botao>
                <Botao variante="contorno" tamanho="p" disabled={c.emprestadas < 1} onClick={() => emprestar(c, false)}>{i.devolver}</Botao>
                {dado.gerencio && <Botao variante="fantasma" tamanho="p" onClick={() => apagar(c)}>{t.comum.apagar}</Botao>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
