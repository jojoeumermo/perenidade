// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Funções com permissões e mandato (tesouraria, comunicação, segurança…) e as eleições internas que as preenchem (FUNCOES-E-IDEIAS
// linha 236; PLANO-ALUMIA §5 F4). Quem é de fora vê só os nomes das funções; quem é de dentro vê quem ocupa (codinome) e até
// quando, a etiqueta que só membros veem. A eleição usa a consulta ranqueada do banco (voto secreto, segundo turno instantâneo,
// quórum escrito antes): quem vence ganha o mandato sozinho, sem o dono "dar o cargo".
import { useCallback, useEffect, useId, useState } from "react";
import { clienteOrgB1 } from "@/lib/rede/cliente-org-b1";
import { PERMISSOES, PERMISSOES_SUGERIDAS, TIPOS_DE_FUNCAO, type EleicaoDaOrg, type FuncoesDaOrg, type Permissao, type TipoDeFuncao } from "@/lib/rede/org/b1";
import { dataCurta } from "@/lib/rede/org/contagem";
import { preencher } from "@/lib/rede/preencher";
import { fraseDoErro, useTextosDaOrgB1, type TextosDaOrgB1 } from "@/lib/rede/textos-org-b1";
import { Botao } from "../../ui/Botao";
import "./b1.css";

const isoDoCampo = (v: string) => {
  const d = new Date(v);
  return v && !Number.isNaN(d.getTime()) ? d.toISOString() : "";
};

export function FuncoesDaOrganizacao({ handle, lang }: { handle: string; lang: string }) {
  const t = useTextosDaOrgB1(lang);
  const id = useId();
  const [f, setF] = useState<FuncoesDaOrg | null>(null);
  const [eleicoes, setEleicoes] = useState<EleicaoDaOrg[] | null>(null);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [nova, setNova] = useState<{ tipo: TipoDeFuncao; nome: string; permissoes: Permissao[]; vagas: number }>({ tipo: "tesouraria", nome: "", permissoes: ["caixa"], vagas: 1 });
  const [nomear, setNomear] = useState({ funcao: "", handle: "", fim: "" });
  const [marcar, setMarcar] = useState({ funcao: "", inscricoesAte: "", prazo: "", mandatoFim: "", quorum: "" });

  const ler = useCallback(async () => {
    const cli = clienteOrgB1();
    const r = await cli.funcoes(handle);
    setF(r);
    if (r?.dentro) setEleicoes(await cli.eleicoes(handle).catch(() => null));
  }, [handle]);
  useEffect(() => {
    let vivo = true;
    const cli = clienteOrgB1();
    cli
      .funcoes(handle)
      .then(async (r) => {
        if (!vivo) return;
        setF(r);
        if (r?.dentro) {
          const e = await cli.eleicoes(handle).catch(() => null);
          if (vivo) setEleicoes(e);
        }
      })
      .catch((e) => vivo && t && setErro(fraseDoErro(t, e)));
    return () => {
      vivo = false;
    };
  }, [handle, t]);

  if (!t || !f) return erro ? <p className="al-perfil-erro" role="alert">{erro}</p> : null;
  const tf = t.funcoes;
  const cli = clienteOrgB1();

  async function fazer<T>(acao: () => Promise<T>, depois?: (r: T) => void) {
    setOcupado(true);
    setErro("");
    setOk("");
    try {
      const r = await acao();
      depois?.(r);
      setOk(tf.feito);
    } catch (e) {
      setErro(fraseDoErro(t!, e));
    } finally {
      setOcupado(false);
    }
  }
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <section className="al-perfil-bloco b1-funcoes" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="al-cond">{tf.titulo}</h2>
      <p className="al-perfil-nota">{f.dentro ? tf.ajuda : tf.deFora}</p>
      {f.funcoes.length === 0 ? <p className="al-painel-vazio">{tf.vazio}</p> : (
        <ul className="b1-lista">
          {f.funcoes.map((fn) => (
            <li key={fn.id} className="b1-funcao" data-tipo={fn.tipo}>
              <span className="b1-funcao-nome">
                <strong>{fn.nome}</strong>
                <small>{t.funcoes.tipos[fn.tipo]} · {fn.vagas === 1 ? tf.vaga : preencher(tf.vagas, { n: fn.vagas })}</small>
              </span>
              {fn.permissoes.length ? <span className="b1-perms">{fn.permissoes.map((p) => <span key={p} className="b1-perm">{tf.permissoes[p]}</span>)}</span> : null}
              {fn.ocupantes ? (
                <ul className="b1-ocupantes" aria-label={fn.nome}>
                  {fn.ocupantes.map((o) => (
                    <li key={o.mandato} data-eu={o.eu ? "" : undefined}>
                      <span className="b1-etiqueta">{o.codinome || `@${o.handle}`}</span>
                      <small>{preencher(tf.ate, { data: dataCurta(o.fim, lang) })} · {o.origem === "eleicao" ? tf.eleita : tf.nomeada}</small>
                      {f.gerencio && !o.eu ? <Botao variante="fantasma" tamanho="p" disabled={ocupado} onClick={() => void fazer(() => cli.encerrarMandato(o.mandato), setF)}>{tf.encerrar}</Botao> : null}
                    </li>
                  ))}
                  {Array.from({ length: Math.max(0, fn.vagas - fn.ocupantes.length) }, (_, i) => <li key={`v${i}`} className="b1-vaga">{tf.vaga_livre}</li>)}
                </ul>
              ) : null}
              {f.gerencio ? (
                <Botao variante="fantasma" tamanho="p" disabled={ocupado} onClick={() => window.confirm(preencher(tf.apagarConfirma, { nome: fn.nome })) && void fazer(() => cli.apagarFuncao(handle, fn.id), setF)}>{tf.apagar}</Botao>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {f.minhas.length > 0 ? (
        <div className="b1-minhas">
          <h3 className="b1-mini">{tf.minhas}</h3>
          <ul className="b1-lista">
            {f.minhas.map((m) => (
              <li key={m.mandato} className="b1-minha-funcao">
                <span><strong>{m.nome}</strong> <small>{preencher(tf.ate, { data: dataCurta(m.fim, lang) })}</small></span>
                <Botao variante="contorno" tamanho="p" disabled={ocupado} onClick={() => window.confirm(preencher(tf.sairConfirma, { nome: m.nome })) && void fazer(() => cli.encerrarMandato(m.mandato), setF)}>{tf.sair}</Botao>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {f.gerencio ? (
        <>
          <details className="b1-novo">
            <summary>{tf.nova}</summary>
            <form className="b1-form" onSubmit={(e) => { e.preventDefault(); void fazer(() => cli.salvarFuncao(handle, { ...nova, nome: nova.nome.trim() }), (r) => { setF(r); setNova({ tipo: "tesouraria", nome: "", permissoes: ["caixa"], vagas: 1 }); }); }}>
              <label><span>{tf.tipo}</span>
                <select className="al-entrada" value={nova.tipo} onChange={(e) => { const tipo = e.target.value as TipoDeFuncao; setNova({ ...nova, tipo, permissoes: PERMISSOES_SUGERIDAS[tipo], nome: nova.nome || tf.tipos[tipo] }); }}>
                  {TIPOS_DE_FUNCAO.map((x) => <option key={x} value={x}>{tf.tipos[x]}</option>)}
                </select>
              </label>
              <label><span>{tf.nome}</span><input className="al-entrada" required minLength={2} maxLength={40} value={nova.nome} onChange={(e) => setNova({ ...nova, nome: e.target.value })} /></label>
              <label><span>{tf.quantas}</span><input className="al-entrada" type="number" min={1} max={9} value={nova.vagas} onChange={(e) => setNova({ ...nova, vagas: Math.max(1, Math.min(9, Number(e.target.value) || 1)) })} /></label>
              <fieldset className="b1-marcar">
                <legend>{tf.podeFazer}</legend>
                {PERMISSOES.map((p) => (
                  <label key={p} className="al-marcar">
                    <input type="checkbox" checked={nova.permissoes.includes(p)} onChange={(e) => setNova({ ...nova, permissoes: e.target.checked ? [...nova.permissoes, p] : nova.permissoes.filter((x) => x !== p) })} />
                    <span>{tf.permissoes[p]}</span>
                  </label>
                ))}
              </fieldset>
              <Botao type="submit" disabled={ocupado || nova.nome.trim().length < 2}>{tf.criar}</Botao>
            </form>
          </details>
          {f.funcoes.length > 0 ? (
            <details className="b1-novo">
              <summary>{tf.nomear}</summary>
              <form className="b1-form" onSubmit={(e) => { e.preventDefault(); void fazer(() => cli.darMandato(handle, { funcao: nomear.funcao || f.funcoes[0].id, handle: nomear.handle.trim(), fim: nomear.fim }), (r) => { setF(r); setNomear({ funcao: "", handle: "", fim: "" }); }); }}>
                <label><span>{tf.titulo}</span>
                  <select className="al-entrada" value={nomear.funcao || f.funcoes[0].id} onChange={(e) => setNomear({ ...nomear, funcao: e.target.value })}>
                    {f.funcoes.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                  </select>
                </label>
                <label><span>{tf.quem}</span><input className="al-entrada" required pattern="@?[a-zA-Z0-9_]{3,20}" autoComplete="off" value={nomear.handle} onChange={(e) => setNomear({ ...nomear, handle: e.target.value })} /></label>
                <label><span>{tf.fim}</span><input className="al-entrada" type="date" required min={hoje} value={nomear.fim} onChange={(e) => setNomear({ ...nomear, fim: e.target.value })} /></label>
                <Botao type="submit" disabled={ocupado}>{tf.darMandato}</Botao>
              </form>
            </details>
          ) : null}
        </>
      ) : null}

      {f.dentro && eleicoes ? <Eleicoes eleicoes={eleicoes} t={t} lang={lang} aoMudar={(e) => setEleicoes(e)} ler={ler} /> : null}

      {f.gerencio && f.funcoes.length > 0 ? (
        <details className="b1-novo">
          <summary>{t.eleicoes.marcar}</summary>
          <form className="b1-form" onSubmit={(e) => {
            e.preventDefault();
            void fazer(() => cli.abrirEleicao(handle, { funcao: marcar.funcao || f.funcoes[0].id, inscricoesAte: isoDoCampo(marcar.inscricoesAte), prazo: isoDoCampo(marcar.prazo), mandatoFim: marcar.mandatoFim, quorum: marcar.quorum ? Number(marcar.quorum) : null }), (r) => { setEleicoes(r); setMarcar({ funcao: "", inscricoesAte: "", prazo: "", mandatoFim: "", quorum: "" }); });
          }}>
            <label><span>{t.eleicoes.funcao}</span>
              <select className="al-entrada" value={marcar.funcao || f.funcoes[0].id} onChange={(e) => setMarcar({ ...marcar, funcao: e.target.value })}>
                {f.funcoes.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
              </select>
            </label>
            <label><span>{t.eleicoes.fimInscricoes}</span><input className="al-entrada" type="datetime-local" required value={marcar.inscricoesAte} onChange={(e) => setMarcar({ ...marcar, inscricoesAte: e.target.value })} /></label>
            <label><span>{t.eleicoes.fimVotacao}</span><input className="al-entrada" type="datetime-local" required value={marcar.prazo} onChange={(e) => setMarcar({ ...marcar, prazo: e.target.value })} /></label>
            <label><span>{t.eleicoes.fimMandato}</span><input className="al-entrada" type="date" required min={hoje} value={marcar.mandatoFim} onChange={(e) => setMarcar({ ...marcar, mandatoFim: e.target.value })} /></label>
            <label><span>{t.eleicoes.quorumCampo}</span><input className="al-entrada" type="number" min={3} value={marcar.quorum} onChange={(e) => setMarcar({ ...marcar, quorum: e.target.value })} /></label>
            <Botao type="submit" disabled={ocupado}>{t.eleicoes.abrir}</Botao>
          </form>
        </details>
      ) : null}

      <p className="sr-only" role="status">{ok}</p>
      {erro ? <p className="al-perfil-erro" role="alert">{erro}</p> : null}
    </section>
  );
}

function Eleicoes({ eleicoes, t, lang, aoMudar, ler }: { eleicoes: EleicaoDaOrg[]; t: TextosDaOrgB1; lang: string; aoMudar: (e: EleicaoDaOrg[]) => void; ler: () => Promise<void> }) {
  const te = t.eleicoes;
  const id = useId();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [ordens, setOrdens] = useState<Record<string, string[]>>({});
  const [votei, setVotei] = useState<Record<string, boolean>>({});
  const cli = clienteOrgB1();
  const quando = (iso: string) => new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : lang, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(iso));

  async function fazer(f: () => Promise<unknown>) {
    setOcupado(true);
    setErro("");
    try {
      await f();
      await ler();
    } catch (e) {
      setErro(fraseDoErro(t, e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="b1-eleicoes" aria-labelledby={`${id}-t`}>
      <h3 id={`${id}-t`} className="b1-mini">{te.titulo}</h3>
      <p className="al-perfil-nota">{te.ajuda}</p>
      {eleicoes.length === 0 ? <p className="al-painel-vazio">{te.vazio}</p> : eleicoes.map((e) => {
        const c = e.consulta;
        const ordem = ordens[e.id] ?? c?.opcoes.map((o) => o.id) ?? [];
        const mover = (i: number, d: -1 | 1) => {
          const n = [...ordem];
          [n[i], n[i + d]] = [n[i + d], n[i]];
          setOrdens({ ...ordens, [e.id]: n });
        };
        return (
          <article key={e.id} className="b1-eleicao" data-situacao={e.situacao}>
            <header>
              <strong>{e.funcao.nome}</strong>
              <span className="b1-selo-situacao">{te.situacao[e.situacao]}</span>
            </header>
            <p className="al-perfil-nota">
              {e.situacao === "inscricoes" ? preencher(te.inscricoesAte, { data: quando(e.inscricoesAte) }) : preencher(te.votacaoAte, { data: quando(e.prazo) })}
              {" · "}{preencher(te.mandatoAte, { data: dataCurta(e.mandatoFim, lang) })}
              {" · "}{e.quorum ? preencher(te.quorum, { n: e.quorum }) : te.semQuorum}
            </p>
            {e.situacao === "inscricoes" ? (
              <>
                <h4 className="b1-mini">{te.candidatas}</h4>
                {e.candidatos.length === 0 ? <p className="al-perfil-nota">{te.nenhuma}</p> : (
                  <ul className="b1-ocupantes">{e.candidatos.map((k) => <li key={k.handle} data-eu={k.eu ? "" : undefined}><span className="b1-etiqueta">{k.codinome || `@${k.handle}`}</span></li>)}</ul>
                )}
                {e.souCandidata ? <p className="al-ok" role="status">{te.souCandidata}</p> : null}
                {e.possoCandidatar || e.souCandidata ? (
                  <Botao variante={e.souCandidata ? "contorno" : "primario"} tamanho="p" disabled={ocupado} onClick={() => void fazer(() => cli.candidatar(e.id, !e.souCandidata).then((x) => aoMudar(eleicoes.map((y) => (y.id === x.id ? x : y)))))}>
                    {e.souCandidata ? te.desistir : te.candidatar}
                  </Botao>
                ) : null}
              </>
            ) : null}
            {e.situacao === "votacao" && c ? (
              c.votei || votei[e.id] ? <p className="al-ok" role="status">{te.votei}</p> : c.possoVotar ? (
                <form className="b1-form" onSubmit={(ev) => { ev.preventDefault(); void fazer(() => cli.votar(c.id, ordem).then(() => setVotei({ ...votei, [e.id]: true }))); }}>
                  <p className="al-perfil-nota">{te.ordem}</p>
                  <ol className="b1-ranking">
                    {ordem.map((oid, i) => {
                      const o = c.opcoes.find((x) => x.id === oid);
                      if (!o) return null;
                      return (
                        <li key={oid}>
                          <span className="b1-ranking-n" aria-hidden>{i + 1}</span>
                          <span>{o.texto}</span>
                          <span className="b1-botoes">
                            <Botao variante="fantasma" tamanho="p" disabled={i === 0} onClick={() => mover(i, -1)} aria-label={preencher(te.subir, { opcao: o.texto })}>↑</Botao>
                            <Botao variante="fantasma" tamanho="p" disabled={i === ordem.length - 1} onClick={() => mover(i, 1)} aria-label={preencher(te.descer, { opcao: o.texto })}>↓</Botao>
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                  <Botao type="submit" disabled={ocupado}>{te.votar}</Botao>
                </form>
              ) : null
            ) : null}
            {e.situacao === "apurada" || e.situacao === "sem_quorum" ? (
              <p className="b1-resultado">
                {e.eleita ? preencher(te.eleita, { quem: e.eleita.codinome || `@${e.eleita.handle}` }) : te.ninguem}
                {c?.votantes ? ` · ${preencher(te.votaram, { n: c.votantes })}` : c ? ` · ${te.poucos}` : ""}
              </p>
            ) : null}
          </article>
        );
      })}
      {erro ? <p className="al-perfil-erro" role="alert">{erro}</p> : null}
    </div>
  );
}
