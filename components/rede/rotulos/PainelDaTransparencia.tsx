// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O bloco da transparência no painel de controle da Alumia, só para a coordenação: o aviso de ordem sigilosa (com a renovação pela
// frase escrita) e os pedidos de órgãos públicos (registrar e corrigir; não se apaga). Quem junta pendura este componente no painel
// (components/painel/alumia), numa aba ou na Visão geral; ele não depende de nada do painel. O banco confere o papel em toda chamada.
import "./rotulos.css";
import { useCallback, useEffect, useId, useState } from "react";
import Link from "@/components/Link";
import { type PainelDaTransparenciaDados, type PedidoParaSalvar, type PedidoRegistrado, rotulos } from "./cliente";
import { Carregando } from "./pecas";
import { FRASE_DO_AVISO, ORGAOS, PEDIDOS, PRAZO_DO_AVISO_DIAS, RESPOSTAS, type Orgao, type PedidoDeAutoridade, type Resposta } from "./regras";
import { codigoDoErro, dataNoIdioma, por, textoDoErro, type TextosDosRotulos } from "./textos";
import { useTextosDosRotulos } from "./usarTextos";

const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** O formulário de um pedido (novo ou corrigindo um já registrado). */
function FormularioDoPedido({ t, inicial, aoSalvar, aoCancelar }: {
  t: TextosDosRotulos; inicial: PedidoRegistrado | null; aoSalvar: (p: PedidoParaSalvar) => Promise<string | null>; aoCancelar: () => void;
}) {
  const tp = t.painel;
  const tt = t.transparencia;
  const [p, setP] = useState<PedidoParaSalvar>(() => inicial
    ? { recebido_em: inicial.recebido_em, orgao: inicial.orgao, pedido: inicial.pedido, resposta: inicial.resposta, respondido_em: inicial.respondido_em, contas: inicial.contas }
    : { recebido_em: hoje(), orgao: "judiciario", pedido: "dados_de_conta", resposta: "em_analise", respondido_em: null, contas: 0 });
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const base = useId();
  const id = (c: string) => `${base}-${c}`;
  const mudar = <K extends keyof PedidoParaSalvar>(k: K, v: PedidoParaSalvar[K]) => setP((x) => ({ ...x, [k]: v }));
  const salvar = async () => {
    setEnviando(true);
    setErro(await aoSalvar({ ...p, respondido_em: p.resposta === "em_analise" ? null : (p.respondido_em || hoje()) }));
    setEnviando(false);
  };
  return (
    <div className="rt-form" style={{ marginBottom: "1rem" }}>
      <p>{tp.pedidosAjuda}</p>
      <div className="rt-campos">
        <div className="rt-campo">
          <label htmlFor={id("recebido")}>{tp.campos.recebido_em}</label>
          <input id={id("recebido")} type="date" max={hoje()} value={p.recebido_em} onChange={(e) => mudar("recebido_em", e.target.value)} />
        </div>
        <div className="rt-campo">
          <label htmlFor={id("orgao")}>{tp.campos.orgao}</label>
          <select id={id("orgao")} value={p.orgao} onChange={(e) => mudar("orgao", e.target.value as Orgao)}>
            {ORGAOS.map((o) => <option key={o} value={o}>{tt.orgaos[o]}</option>)}
          </select>
        </div>
        <div className="rt-campo">
          <label htmlFor={id("pedido")}>{tp.campos.pedido}</label>
          <select id={id("pedido")} value={p.pedido} onChange={(e) => mudar("pedido", e.target.value as PedidoDeAutoridade)}>
            {PEDIDOS.map((o) => <option key={o} value={o}>{tt.pedidos[o]}</option>)}
          </select>
        </div>
        <div className="rt-campo">
          <label htmlFor={id("contas")}>{tp.campos.contas}</label>
          <input id={id("contas")} type="number" min={0} max={100000} value={p.contas} onChange={(e) => mudar("contas", Math.max(0, Math.min(100000, Number(e.target.value) || 0)))} />
        </div>
        <div className="rt-campo">
          <label htmlFor={id("resposta")}>{tp.campos.resposta}</label>
          <select id={id("resposta")} value={p.resposta} onChange={(e) => mudar("resposta", e.target.value as Resposta)}>
            {RESPOSTAS.map((o) => <option key={o} value={o}>{tt.respostas[o]}</option>)}
          </select>
        </div>
        {p.resposta !== "em_analise" && (
          <div className="rt-campo">
            <label htmlFor={id("respondido")}>{tp.campos.respondido_em}</label>
            <input id={id("respondido")} type="date" min={p.recebido_em} max={hoje()} value={p.respondido_em ?? hoje()} onChange={(e) => mudar("respondido_em", e.target.value)} />
          </div>
        )}
      </div>
      <div className="rt-acoes">
        <button type="button" className="al-botao al-botao-primario" disabled={enviando || !p.recebido_em} onClick={salvar}>{tp.salvar}</button>
        <button type="button" className="al-botao al-botao-contorno" onClick={aoCancelar}>{tp.cancelar}</button>
      </div>
      {erro && <p className="rt-erro" role="alert">{erro}</p>}
    </div>
  );
}

export function PainelDaTransparencia({ lang }: { lang: string }) {
  const t = useTextosDosRotulos(lang);
  const [dados, setDados] = useState<PainelDaTransparenciaDados | null>(null);
  const [estado, setEstado] = useState<"carregando" | "pronto" | "sem_permissao" | "erro">("carregando");
  const [editando, setEditando] = useState<PedidoRegistrado | "novo" | null>(null);
  const [frase, setFrase] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const idFrase = useId();

  const carregar = useCallback(() => {
    rotulos.painel().then(
      (d) => {
        setDados(d);
        setEstado("pronto");
      },
      (e) => setEstado(codigoDoErro(e) === "sem_permissao" ? "sem_permissao" : "erro"),
    );
  }, []);
  useEffect(() => carregar(), [carregar]);

  if (!t) return <Carregando rotulo="…" />;
  const tp = t.painel;
  const tt = t.transparencia;
  if (estado === "carregando") return <Carregando rotulo={tp.carregando} />;
  if (estado === "sem_permissao") return <p className="rt-erro">{tp.erros.sem_permissao}</p>;
  if (estado === "erro" || !dados) return <p className="rt-erro" role="alert">{tp.erros.generico}</p>;

  const c = dados.canario;
  const renovar = async () => {
    try {
      const novo = await rotulos.renovarAviso(frase);
      setDados((d) => (d ? { ...d, canario: novo } : d));
      setFrase("");
      setMsg({ ok: true, texto: tp.renovado });
      carregar();
    } catch (e) {
      setMsg({ ok: false, texto: textoDoErro(tp.erros, e) });
    }
  };
  const salvar = async (p: PedidoParaSalvar): Promise<string | null> => {
    try {
      await rotulos.salvarPedido(editando && editando !== "novo" ? editando.id : null, p);
      setEditando(null);
      setMsg({ ok: true, texto: tp.salvo });
      carregar();
      return null;
    } catch (e) {
      return textoDoErro(tp.erros, e);
    }
  };

  return (
    <section className="rt-painel" aria-labelledby="rt-painel-t">
      <h2 id="rt-painel-t" className="al-cond">{tp.titulo}</h2>
      <p>
        {tp.chamada}{" "}
        <Link href={`/${lang}/alumia/transparencia`} className="rt-link">{tp.verPagina}</Link>
      </p>
      {msg && <p className={msg.ok ? "rt-ok" : "rt-erro"} role={msg.ok ? "status" : "alert"} style={{ marginBottom: "1rem" }}>{msg.texto}</p>}

      <div className="rt-canario" data-vencido={c.vencido ? "sim" : undefined} style={{ marginBottom: "1.6rem" }}>
        <div className="rt-canario-selo al-cond" aria-hidden>
          <span><strong>{c.vencido ? "!" : "✓"}</strong>{por(tt.canario.selo, { dias: PRAZO_DO_AVISO_DIAS })}</span>
        </div>
        <div>
          <h3 className="al-cond" style={{ margin: "0 0 0.35rem", fontSize: "1.05rem", letterSpacing: "0.08em", color: "var(--al-texto-3)" }}>{tp.avisoTitulo}</h3>
          <p className="rt-canario-frase" style={{ fontSize: "1.05rem" }}>
            {!c.renovado_em ? tp.nunca : c.vencido
              ? por(tp.vencido, { data: dataNoIdioma(lang, c.renovado_em) })
              : por(tp.valendo, { vence: dataNoIdioma(lang, c.vence_em), data: dataNoIdioma(lang, c.renovado_em) })}
          </p>
          <p className="rt-canario-nota">{por(tp.renovarAjuda, { dias: PRAZO_DO_AVISO_DIAS })}</p>
          <div className="rt-campo" style={{ marginTop: "0.8rem", maxWidth: "28rem" }}>
            <label htmlFor={idFrase}>{tp.frase}</label>
            <input id={idFrase} value={frase} maxLength={60} autoComplete="off" onChange={(e) => setFrase(e.target.value)} placeholder={FRASE_DO_AVISO} />
          </div>
          <div className="rt-acoes">
            <button type="button" className="al-botao al-botao-primario" disabled={frase.trim().length < 10} onClick={renovar}>{tp.renovar}</button>
          </div>
          {dados.renovacoes.length > 0 && (
            <>
              <p className="rt-canario-nota" style={{ fontWeight: 700 }}>{tp.renovacoes}</p>
              <ul className="rt-renovacoes">
                {dados.renovacoes.map((r) => <li key={r.renovado_em}>{dataNoIdioma(lang, r.renovado_em)}{r.por ? ` · ${r.por}` : ""}</li>)}
              </ul>
            </>
          )}
        </div>
      </div>

      <h3 className="al-cond" style={{ margin: "0 0 0.7rem", fontSize: "1.6rem" }}>{tp.pedidosTitulo}</h3>
      {editando ? (
        <FormularioDoPedido key={editando === "novo" ? "novo" : editando.id} t={t} inicial={editando === "novo" ? null : editando} aoSalvar={salvar} aoCancelar={() => setEditando(null)} />
      ) : (
        <div className="rt-acoes" style={{ marginBottom: "0.9rem" }}>
          <button type="button" className="al-botao al-botao-primario" onClick={() => setEditando("novo")}>{tp.novo}</button>
        </div>
      )}
      {dados.pedidos.length === 0 ? <p className="rt-texto">{tp.vazio}</p> : (
        <table className="rt-tabela">
          <thead>
            <tr>
              <th scope="col">{tp.campos.recebido_em}</th>
              <th scope="col">{tp.campos.orgao}</th>
              <th scope="col">{tp.campos.pedido}</th>
              <th scope="col">{tp.campos.contas}</th>
              <th scope="col">{tp.campos.resposta}</th>
              <th scope="col"><span className="sr-only">{tp.editar}</span></th>
            </tr>
          </thead>
          <tbody>
            {dados.pedidos.map((p) => (
              <tr key={p.id}>
                <td data-rotulo={tp.campos.recebido_em}>{dataNoIdioma(lang, p.recebido_em)}</td>
                <td data-rotulo={tp.campos.orgao}>{tt.orgaos[p.orgao]}</td>
                <td data-rotulo={tp.campos.pedido}>{tt.pedidos[p.pedido]}</td>
                <td data-rotulo={tp.campos.contas}>{p.contas}</td>
                <td data-rotulo={tp.campos.resposta}>{tt.respostas[p.resposta]}{p.respondido_em ? ` · ${dataNoIdioma(lang, p.respondido_em, true)}` : ""}</td>
                <td><button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => setEditando(p)}>{tp.editar}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default PainelDaTransparencia;
