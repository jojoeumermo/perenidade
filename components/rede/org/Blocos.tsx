// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os blocos com ação do perfil de organização: consulta à base (votar, simples ou ranqueada), "Como votamos" (prestação de
// contas), a plenária (entrar na sala, mandar pergunta, fila em ordem de chegada) e os núcleos (pedir para entrar). Cada um recebe
// as ações de fora (`AcoesDaOrg`): no perfil de verdade, o banco (lib/rede/cliente-org.ts); no perfil de exemplo, ações que só
// mudam a tela e não guardam nada.
import { useId, useState } from "react";
import { dataCurta, escreverPessoas, faltaPara, linkSeguro, haQuanto } from "@/lib/rede/org/contagem";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaOrg } from "@/lib/rede/textos-org";
import { LIMITES, type ConsultaDaOrg, type NucleoDaOrg, type PlenariaDaOrg, type VotacaoDaOrg } from "@/lib/rede/tipos-org";
import { clienteOrgB1 } from "@/lib/rede/cliente-org-b1";
import { useTextosDaOrgB1 } from "@/lib/rede/textos-org-b1";
import { Botao } from "../ui/Botao";
import { useAgora, useLerDeNovo } from "./b1/usar";
import { BarrasDaConsulta, CartaoAoVivo, ListaDeNucleos } from "./partes";
import "./b1/b1.css";

/** O que os blocos pedem a quem os usa. Cada ação devolve o novo estado (ou lança erro, que vira a mensagem de "não deu certo"). */
export interface AcoesDaOrg {
  seguir: (sim: boolean) => Promise<{ sigo: boolean }>;
  sino: (sim: boolean) => Promise<{ sino: boolean }>;
  entrarNoNucleo: (id: string) => Promise<{ sou: boolean; pedi: boolean }>;
  votar: (consulta: string, ranking: string[]) => Promise<unknown>;
  perguntar: (plenaria: string, texto: string, mostrar: boolean) => Promise<{ naFila: number }>;
}

function useErro(t: TextosDaOrg) {
  const [erro, setErro] = useState("");
  return {
    erro,
    limpar: () => setErro(""),
    falhou: (e: unknown) => {
      const codigo = typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : "";
      setErro(codigo === "banco_desatualizado" || codigo === "sem_servico" ? t.erros.semBanco : t.erros.falha);
    },
  };
}

/** Uma consulta à base: aberta (votar, se a pessoa é de um núcleo) ou fechada (resultado, votantes e quórum). */
export function CartaoDaConsulta({ c, t, lang, acoes, aoVerNucleos }: { c: ConsultaDaOrg; t: TextosDaOrg; lang: string; acoes: AcoesDaOrg; aoVerNucleos: () => void }) {
  const tc = t.consulta;
  const id = useId();
  const [escolha, setEscolha] = useState<string>("");
  const [ordem, setOrdem] = useState<string[]>(() => c.opcoes.map((o) => o.id));
  const [votei, setVotei] = useState(c.votei);
  const [ocupado, setOcupado] = useState(false);
  const { erro, limpar, falhou } = useErro(t);
  const falta = c.situacao === "aberta" ? faltaPara(c.prazo) : null;
  const tempo = falta ? (falta.dias > 0 ? preencher(tc.dias, { d: falta.dias, h: falta.horas }) : preencher(tc.horas, { h: falta.horas })) : "";
  const texto = (oid: string) => c.opcoes.find((o) => o.id === oid)?.texto ?? oid;

  function mover(i: number, d: -1 | 1) {
    setOrdem((o) => {
      const n = [...o];
      const j = i + d;
      if (j < 0 || j >= n.length) return o;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  }

  async function votar() {
    const ranking = c.metodo === "simples" ? (escolha ? [escolha] : []) : ordem;
    if (ranking.length === 0) return;
    setOcupado(true);
    limpar();
    try {
      await acoes.votar(c.id, ranking);
      setVotei(true);
    } catch (e) {
      falhou(e);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <article className="al-consulta" aria-labelledby={`${id}-p`}>
      <div className="al-consulta-topo">
        <span className={`al-cond al-consulta-estado ${c.situacao === "fechada" ? "al-consulta-estado-fechada" : ""}`}>{c.situacao === "aberta" ? tc.aberta : tc.fechada}</span>
        <span>{c.situacao === "aberta" ? (tempo ? preencher(tc.fechaEm, { tempo }) : "") : preencher(tc.fechou, { data: dataCurta(c.prazo, lang) })}</span>
      </div>
      <h3 id={`${id}-p`}>{c.pergunta}</h3>
      <p className="al-consulta-compromisso">
        <b>{tc.compromisso}</b>
        {c.compromisso}
      </p>
      <p className="al-consulta-nota">
        {preencher(tc.quemVota, { nucleos: c.nucleos.join(", ") })} {c.quorum ? preencher(tc.quorum, { n: c.quorum }) : ""}
      </p>

      {c.situacao === "fechada" ? (
        <>
          <BarrasDaConsulta opcoes={c.opcoes} rotulo={tc.resultado} barra={tc.barra} />
          <p className="al-consulta-nota">
            {preencher(tc.votantes, { pessoas: escreverPessoas(c.votantes, tc.pessoas, lang) })} {c.quorumAtingido === null ? "" : c.quorumAtingido ? tc.quorumOk : tc.quorumNao}
          </p>
        </>
      ) : votei ? (
        <p className="al-ok" role="status">
          {tc.votei}
        </p>
      ) : c.possoVotar ? (
        <form
          className="al-form"
          onSubmit={(e) => {
            e.preventDefault();
            void votar();
          }}
        >
          {c.metodo === "simples" ? (
            <fieldset className="al-opcoes">
              <legend className="al-consulta-nota">{tc.simples}</legend>
              {c.opcoes.map((o) => (
                <label key={o.id} className="al-opcao">
                  <input type="radio" name={`${id}-op`} value={o.id} checked={escolha === o.id} onChange={() => setEscolha(o.id)} />
                  {o.texto}
                </label>
              ))}
            </fieldset>
          ) : (
            <>
              <p className="al-consulta-nota">{tc.ranqueada}</p>
              <ol className="al-ranking">
                {ordem.map((oid, i) => (
                  <li key={oid}>
                    <span className="al-cond al-ranking-n">{i + 1}</span>
                    <span className="al-ranking-texto">{texto(oid)}</span>
                    <Botao variante="fantasma" tamanho="p" disabled={i === 0} onClick={() => mover(i, -1)} aria-label={preencher(tc.subir, { opcao: texto(oid) })}>
                      ↑
                    </Botao>
                    <Botao variante="fantasma" tamanho="p" disabled={i === ordem.length - 1} onClick={() => mover(i, 1)} aria-label={preencher(tc.descer, { opcao: texto(oid) })}>
                      ↓
                    </Botao>
                  </li>
                ))}
              </ol>
            </>
          )}
          <p className="al-consulta-nota">{tc.secreto}</p>
          <div>
            <Botao type="submit" disabled={ocupado || (c.metodo === "simples" && !escolha)}>
              {tc.votar}
            </Botao>
          </div>
        </form>
      ) : (
        <div className="al-consulta-nota">
          <p style={{ margin: 0 }}>
            {tc.naoPosso} {tc.resultadoDepois}
          </p>
          <Botao variante="contorno" tamanho="p" onClick={aoVerNucleos} style={{ marginTop: 8 }}>
            {tc.verNucleos}
          </Botao>
        </div>
      )}
      {erro ? (
        <p className="al-perfil-erro" role="alert">
          {erro}
        </p>
      ) : null}
    </article>
  );
}

/** "Como votamos": cada voto com o porquê, o resultado e a fonte pública (tabela no computador, cartões no celular). */
export function ComoVotamos({ votacoes, t, lang }: { votacoes: VotacaoDaOrg[]; t: TextosDaOrg; lang: string }) {
  const tc = t.contas;
  if (votacoes.length === 0) return <p className="al-painel-vazio">{tc.vazio}</p>;
  return (
    <>
      <p className="al-contas-intro">{tc.intro}</p>
      <table className="al-contas">
        <caption className="sr-only">{tc.titulo}</caption>
        <thead>
          <tr>
            <th scope="col">{tc.data}</th>
            <th scope="col">{tc.projeto}</th>
            <th scope="col">{tc.voto}</th>
            <th scope="col">{tc.porque}</th>
            <th scope="col">{tc.resultado}</th>
            <th scope="col">{tc.fonte}</th>
          </tr>
        </thead>
        <tbody>
          {votacoes.map((v) => {
            const fonte = linkSeguro(v.fonte);
            return (
              <tr key={v.id}>
                <td className="al-contas-data">{dataCurta(v.data, lang)}</td>
                <td className="al-contas-projeto">{v.projeto}</td>
                <td>
                  <span className={`al-voto al-voto-${v.voto}`}>{tc.votos[v.voto]}</span>
                </td>
                <td className="al-contas-porque" data-rotulo={tc.porque}>
                  {v.porque}
                </td>
                <td className="al-contas-resultado" data-rotulo={tc.resultado}>
                  {v.resultado}
                </td>
                <td>
                  {fonte ? (
                    <a href={fonte} target="_blank" rel="noopener noreferrer nofollow">
                      {tc.abrirFonte}
                      <span className="sr-only">: {v.projeto}</span>
                    </a>
                  ) : (
                    tc.semFonte
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

/**
 * Uma plenária: o cartão "Ao vivo agora" com Entrar na sala (link de fora, só https/http) e Mandar pergunta (abre o campo), e a fila
 * em ordem de chegada. A pergunta entra no fim; ninguém reordena. O @ só aparece se a pessoa ligar "mostrar meu @".
 */
export function BlocoDaPlenaria({ p, t, lang, acoes, podePerguntar }: { p: PlenariaDaOrg; t: TextosDaOrg; lang: string; acoes: AcoesDaOrg; podePerguntar: boolean }) {
  const tp = t.plenaria;
  const id = useId();
  const viva = useTextosDaOrgB1(lang);
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [enviada, setEnviada] = useState(p.pergunteiEu);
  const [naFila, setNaFila] = useState(p.naFila);
  const [fila, setFila] = useState(p.fila);
  const [salaViva, setSalaViva] = useState(p.sala);
  const [ocupado, setOcupado] = useState(false);
  const { erro, limpar, falhou } = useErro(t);
  const sala = linkSeguro(salaViva);
  // A fila viva (B1): ao vivo, lê de novo a cada 5 s, só com a aba visível. A ordem continua a de chegada (o banco manda).
  const { ultima, pausado } = useLerDeNovo(p.aoVivo ? async () => {
    const r = await clienteOrgB1().plenaria(p.id).catch(() => null);
    if (!r) return;
    setFila(r.fila);
    setNaFila(r.naFila);
    setSalaViva(r.sala);
  } : null, 5000);
  const agora = useAgora(p.aoVivo);

  async function mandar() {
    const limpo = texto.trim();
    if (!limpo) return;
    setOcupado(true);
    limpar();
    try {
      const r = await acoes.perguntar(p.id, limpo, mostrar);
      setNaFila(r.naFila);
      setFila((f) => [...f, { id: `minha-${f.length}`, handle: mostrar ? tp.eu : null, texto: limpo, criadaEm: new Date().toISOString(), respondida: false }]);
      setEnviada(true);
      setAberto(false);
      setTexto("");
    } catch (e) {
      falhou(e);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="al-plenaria">
      <CartaoAoVivo
        t={t}
        lang={lang}
        titulo="h3"
        plenaria={{ titulo: p.titulo, descricao: p.aoVivo ? p.descricao : `${preencher(tp.marcada, { data: dataCurta(p.inicio, lang) })}. ${p.descricao}`, naSala: p.naSala, naFila }}
        acoes={
          <>
            {sala && p.aoVivo ? (
              <a href={sala} target="_blank" rel="noopener noreferrer" className="al-botao al-botao-claro al-botao-m">
                {tp.entrarNaSala}
                <span className="sr-only"> ({tp.salaFora})</span>
              </a>
            ) : (
              <span className="al-consulta-nota" style={{ alignSelf: "center" }}>
                {tp.salaDepois}
              </span>
            )}
            <Botao variante="contorno" disabled={!podePerguntar || enviada} aria-expanded={aberto} aria-controls={`${id}-form`} onClick={() => setAberto((a) => !a)}>
              {tp.mandarPergunta}
            </Botao>
          </>
        }
      />
      {enviada ? (
        <p className="al-ok" role="status">
          {enviada && !p.pergunteiEu ? tp.enviada : tp.jaPergunte}
        </p>
      ) : null}
      {aberto ? (
        <form
          id={`${id}-form`}
          className="al-form"
          onSubmit={(e) => {
            e.preventDefault();
            void mandar();
          }}
        >
          <label className="al-campo">
            <span>{tp.pergunta}</span>
            <textarea className="al-entrada" maxLength={LIMITES.pergunta} value={texto} onChange={(e) => setTexto(e.target.value)} required />
            <small>{tp.perguntaAjuda}</small>
          </label>
          <label className="al-marcar">
            <input type="checkbox" checked={mostrar} onChange={(e) => setMostrar(e.target.checked)} />
            <span>
              {tp.mostrar}
              <br />
              <small className="al-consulta-nota">{tp.mostrarAjuda}</small>
            </span>
          </label>
          <div>
            <Botao type="submit" disabled={ocupado || !texto.trim()}>
              {tp.enviar}
            </Botao>
          </div>
        </form>
      ) : null}
      {erro ? (
        <p className="al-perfil-erro" role="alert">
          {erro}
        </p>
      ) : null}
      <section aria-labelledby={`${id}-fila`}>
        <h4 id={`${id}-fila`} className="al-consulta-nota" style={{ margin: "0 0 6px" }}>
          {tp.fila} · {tp.ordem}
        </h4>
        {p.aoVivo && viva ? (
          <p className="al-consulta-nota al-fila-viva" aria-live="off">
            <span aria-hidden className="b1-ponto-vivo" /> {viva.plenaria.aoVivo}
            {pausado || ultima ? " · " : null}
            {pausado ? viva.plenaria.pausada : ultima ? haQuanto(viva.plenaria, agora - ultima) : null}
          </p>
        ) : null}
        {fila.length === 0 ? (
          <p className="al-painel-vazio">{tp.vazioFila}</p>
        ) : (
          <ol className="al-fila">
            {fila.map((q) => (
              <li key={q.id}>
                <span className={q.handle ? "al-fila-quem" : "al-fila-quem al-fila-quem-anonimo"}>
                  {q.handle ? `@${q.handle}` : tp.anonimo}
                  {q.respondida ? <span className="al-fila-respondida">{tp.respondida}</span> : null}
                </span>
                <span>{q.texto}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

/** Os núcleos da organização, cada um com o seu botão: Entrar (pede), Pedido enviado, ou Você é daqui. */
export function NucleosDaOrg({ nucleos, t, acoes, podeEntrar, lang = "pt", gerencio = false }: { nucleos: NucleoDaOrg[]; t: TextosDaOrg; acoes: AcoesDaOrg; podeEntrar: boolean; lang?: string; gerencio?: boolean }) {
  const tn = t.perfil.nucleos;
  const tb = useTextosDaOrgB1(lang);
  const [estado, setEstado] = useState<Record<string, { sou: boolean; pedi: boolean }>>(() => Object.fromEntries(nucleos.map((n) => [n.id, { sou: n.sou, pedi: n.pedi }])));
  const [mapa, setMapa] = useState<Record<string, boolean>>(() => Object.fromEntries(nucleos.map((n) => [n.id, !!n.mapa])));
  const [ocupado, setOcupado] = useState<string | null>(null);
  const { erro, limpar, falhou } = useErro(t);
  /** A chama do núcleo (B1) e, para quem gerencia, pôr ou tirar do mapa. Nunca o número de pessoas. */
  const extra = (n: NucleoDaOrg) =>
    tb ? (
      <>
        {n.chama ? <span className="b1-chama" data-chama={n.chama}>{tb.lampiao.chama[n.chama]}</span> : null}
        {gerencio && n.mapa !== undefined && n.mapa !== null ? (
          <Botao variante="fantasma" tamanho="p" pressionado={mapa[n.id]} disabled={ocupado === n.id} onClick={() => void alternarMapa(n.id)}>
            {mapa[n.id] ? tb.lampiao.noMapa : tb.lampiao.foraDoMapa}
          </Botao>
        ) : null}
      </>
    ) : null;

  async function alternarMapa(id: string) {
    setOcupado(id);
    limpar();
    try {
      const r = await clienteOrgB1().noMapa(id, !mapa[id]);
      setMapa((m) => ({ ...m, [id]: r.mapa }));
    } catch (e) {
      falhou(e);
    } finally {
      setOcupado(null);
    }
  }
  if (nucleos.length === 0) return <p className="al-painel-vazio">{tn.vazio}</p>;

  async function entrar(id: string) {
    setOcupado(id);
    limpar();
    try {
      const r = await acoes.entrarNoNucleo(id);
      setEstado((e) => ({ ...e, [id]: r }));
    } catch (e) {
      falhou(e);
    } finally {
      setOcupado(null);
    }
  }

  return (
    <>
      <ListaDeNucleos
        nucleos={nucleos}
        rotulo={tn.titulo}
        acao={(id) => {
          const e = estado[id];
          const n = nucleos.find((x) => x.id === id);
          const nome = n?.nome ?? "";
          const acao = e?.sou ? (
            <span className="al-ok">{tn.sou}</span>
          ) : e?.pedi ? (
            <span className="al-consulta-nota">{tn.pedido}</span>
          ) : (
            <Botao variante="contorno" tamanho="p" disabled={!podeEntrar || ocupado === id} onClick={() => void entrar(id)} aria-label={preencher(tn.entrarNo, { nome })}>
              {tn.entrar}
            </Botao>
          );
          return n ? <span className="b1-nucleo-acoes">{extra(n)}{acao}</span> : acao;
        }}
      />
      <p className="al-consulta-nota" style={{ marginTop: 8 }}>
        {tn.ajuda}
      </p>
      {erro ? (
        <p className="al-perfil-erro" role="alert">
          {erro}
        </p>
      ) : null}
    </>
  );
}
