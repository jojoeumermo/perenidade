// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import Link from "@/components/Link";
import { Confirmar } from "../../conversa/base3";
import { Botao, classesDoBotao } from "../../ui/Botao";
import { EstadoDaAlumia } from "../../ui/Estado";
import { baixar, encher, Nota, textoDoErro } from "../turma/comum";
import { monitoria, type Oferta } from "./cliente";
import {
  DISCIPLINAS, DURACOES, enderecoDaSala, icsDaMonitoria, instanteDoCampo, LIMITES_DA_MONITORIA, type Disciplina, type JanelaDeMonitoria,
  type JanelaMarcada, type JanelaMinha, type Monitor, type Monitoria,
} from "./regras";
import type { TextosDaAgenda } from "./textos";

type T = TextosDaAgenda;
type Avisar = (x: { texto: string; erro?: boolean }) => void;
const localDe = (lang: string) => (lang === "zh" ? "zh-CN" : lang === "pt" ? "pt-BR" : lang);

function useFormatos(lang: string) {
  const dia = new Intl.DateTimeFormat(localDe(lang), { weekday: "long", day: "numeric", month: "long" });
  const curto = new Intl.DateTimeFormat(localDe(lang), { weekday: "short", day: "2-digit", month: "2-digit" });
  const hora = new Intl.DateTimeFormat(localDe(lang), { hour: "2-digit", minute: "2-digit" });
  return {
    dia: (iso: string) => dia.format(new Date(iso)),
    quando: (iso: string) => `${curto.format(new Date(iso)).replace(".", "")} · ${hora.format(new Date(iso))}`,
    chave: (iso: string) => new Date(iso).toDateString(),
  };
}

/**
 * A aba Monitoria. Quem estuda vê os horários com vaga por disciplina, dia e hora (nunca de quem são, nem quantas vagas sobram),
 * marca com a dúvida em uma linha e, depois de marcar, vê com quem é e abre a sala (a Aula ao vivo do site ou a conversa da
 * Alumia). Quem foi nomeado e aceitou oferece horários e vê quem marcou os dele. A coordenação, a vice e a mediação nomeiam.
 */
export function AbaDaMonitoria({ t, lang, avisar }: { t: T; lang: string; avisar: Avisar }) {
  const id = useId();
  const f = useFormatos(lang);
  const [m, setM] = useState<Monitoria | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [vez, setVez] = useState(0);
  const [filtro, setFiltro] = useState<Disciplina | null>(null);
  const [marcando, setMarcando] = useState<string | null>(null);
  const [desmarcando, setDesmarcando] = useState<JanelaMarcada | null>(null);
  const [cancelando, setCancelando] = useState<JanelaMinha | null>(null);
  const [deixando, setDeixando] = useState(false);

  useEffect(() => {
    let vivo = true;
    monitoria.situacao().then(
      (r) => {
        if (!vivo) return;
        setM(r);
        setErro(null);
      },
      (e: unknown) => vivo && setErro(e ?? new Error("falha")),
    );
    return () => {
      vivo = false;
    };
  }, [vez]);

  async function fazer(acao: () => Promise<Monitoria>, feito: string) {
    try {
      setM(await acao());
      avisar({ texto: feito });
      return true;
    } catch (e) {
      avisar({ texto: textoDoErro(t.erros, e), erro: true });
      return false;
    }
  }

  if (erro && !m) {
    return (
      <EstadoDaAlumia erro texto={textoDoErro(t.erros, erro)}>
        <Botao variante="claro" onClick={() => setVez((n) => n + 1)}>{t.tentar}</Botao>
      </EstadoDaAlumia>
    );
  }
  if (!m) {
    return (
      <div className="es-esqueleto" role="status" aria-label={t.carregando}>
        <span />
      </div>
    );
  }

  const abertas = m.abertas.filter((j) => !filtro || j.disciplina === filtro);
  const porDia: { chave: string; titulo: string; itens: JanelaDeMonitoria[] }[] = [];
  for (const j of abertas) {
    const chave = f.chave(j.inicio);
    const grupo = porDia.find((g) => g.chave === chave);
    if (grupo) grupo.itens.push(j);
    else porDia.push({ chave, titulo: f.dia(j.inicio), itens: [j] });
  }
  const ativo = m.eu?.situacao === "ativo";
  const url = typeof window !== "undefined" ? `${window.location.origin}/${lang}/alumia/agenda?aba=monitoria` : "";
  const disciplinasComHorario = DISCIPLINAS.filter((d) => m.abertas.some((j) => j.disciplina === d));

  return (
    <div className="es-colunas">
      <div className="es-principal">
        {m.marcadas.length > 0 && (
          <section className="es-grupo" aria-labelledby={`${id}-marcadas`}>
            <h2 id={`${id}-marcadas`} className="es-secao al-cond">{t.monitoria.marcadasTitulo}</h2>
            <ul className="es-horarios" role="list">
              {m.marcadas.map((j) => (
                <li key={j.id}>
                  <article className="es-horario" data-disciplina={j.disciplina} data-cancelada={j.cancelada || undefined}>
                    <div className="es-horario-topo">
                      <h3 className="es-horario-disc al-cond">{t.disciplinas[j.disciplina]}</h3>
                      <p className="es-horario-quando">{f.quando(j.inicio)} · {encher(t.monitoria.minutos, { n: j.duracao })}</p>
                    </div>
                    {j.cancelada ? (
                      <p className="es-carimbo" data-tom="apagado">{t.monitoria.cancelada}</p>
                    ) : (
                      <p className="es-texto">
                        {t.monitoria.com} <span className="es-pessoa">{j.monitor.nome}</span>{j.monitor.handle ? ` @${j.monitor.handle}` : ""}
                      </p>
                    )}
                    {j.duvida && <p className="es-duvida">“{j.duvida}”</p>}
                    <Sala t={t} j={j} />
                    <div className="es-acoes">
                      {!j.cancelada && (
                        <Link href={enderecoDaSala(lang, j.sala, j.aula, j.monitor.handle)} className={classesDoBotao("primario", "m")}>{t.monitoria.abrirSala}</Link>
                      )}
                      {!j.cancelada && (
                        <Botao variante="fantasma" tamanho="m" onClick={() => baixar(`monitoria-${j.disciplina}.ics`, icsDaMonitoria(j, encher(t.monitoria.icsTitulo, { disciplina: t.disciplinas[j.disciplina] }), url))}>{t.monitoria.agenda}</Botao>
                      )}
                      <Botao variante="fantasma" tamanho="m" onClick={() => setDesmarcando(j)}>{j.cancelada ? t.monitoria.tirarDaLista : t.monitoria.desmarcar}</Botao>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="es-grupo" aria-labelledby={`${id}-abertas`}>
          <h2 id={`${id}-abertas`} className="es-secao al-cond">{t.monitoria.abertasTitulo}</h2>
          <p className="es-miudo">{t.monitoria.abertasTexto}</p>
          {disciplinasComHorario.length > 1 && (
            <div className="es-filtros" role="group" aria-label={t.monitoria.filtrar}>
              <button type="button" className="es-filtro" aria-pressed={filtro === null} onClick={() => setFiltro(null)}>{t.monitoria.todas}</button>
              {disciplinasComHorario.map((d) => (
                <button key={d} type="button" className="es-filtro" aria-pressed={filtro === d} onClick={() => setFiltro(d)}>{t.disciplinas[d]}</button>
              ))}
            </div>
          )}
          {porDia.length === 0 ? (
            <EstadoDaAlumia icone="relogio" titulo={t.monitoria.vazioTitulo} texto={t.monitoria.vazio} />
          ) : (
            porDia.map((g) => (
              <div key={g.chave} className="es-grupo">
                <h3 className="es-dia-titulo al-cond">{g.titulo}</h3>
                <ul className="es-horarios" role="list">
                  {g.itens.map((j) => (
                    <li key={j.id}>
                      <HorarioAberto
                        t={t}
                        f={f}
                        j={j}
                        aberto={marcando === j.id}
                        aoAbrir={() => setMarcando(marcando === j.id ? null : j.id)}
                        aoMarcar={async (duvida) => {
                          if (await fazer(() => monitoria.marcar(j.id, duvida), t.monitoria.marcou)) setMarcando(null);
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>

        {ativo && (
          <section className="es-grupo" aria-labelledby={`${id}-minhas`}>
            <h2 id={`${id}-minhas`} className="es-secao al-cond">{t.monitoria.minhasTitulo}</h2>
            {m.minhas.length === 0 ? (
              <p className="es-texto">{t.monitoria.minhasVazio}</p>
            ) : (
              <ul className="es-horarios" role="list">
                {m.minhas.map((j) => (
                  <li key={j.id}>
                    <article className="es-horario" data-disciplina={j.disciplina} data-cancelada={j.cancelada || undefined}>
                      <div className="es-horario-topo">
                        <h3 className="es-horario-disc al-cond">{t.disciplinas[j.disciplina]}</h3>
                        <p className="es-horario-quando">{f.quando(j.inicio)} · {encher(t.monitoria.minutos, { n: j.duracao })}</p>
                      </div>
                      {j.cancelada && <p className="es-carimbo" data-tom="apagado">{t.monitoria.cancelada}</p>}
                      {j.nota && <p className="es-texto">{j.nota}</p>}
                      <Sala t={t} j={j} />
                      <p className="es-rotulo al-cond">{encher(j.vagas === 1 ? t.monitoria.vaga1 : t.monitoria.vagas, { n: j.vagas })}</p>
                      {j.marcas.length === 0 ? (
                        <p className="es-miudo">{t.monitoria.ninguemAinda}</p>
                      ) : (
                        <ul className="es-marcas" role="list">
                          {j.marcas.map((p, i) => (
                            <li key={`${p.handle ?? ""}${i}`}>
                              <span className="es-pessoa">{p.nome}</span>
                              {p.handle && <span>@{p.handle}</span>}
                              {p.duvida && <span className="es-duvida">“{p.duvida}”</span>}
                              {!j.cancelada && p.handle && (
                                <Link href={enderecoDaSala(lang, j.sala, j.aula, p.handle)} className={classesDoBotao("fantasma", "p")}>{j.sala === "aula" ? t.monitoria.abrirSala : t.monitoria.conversar}</Link>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      {!j.cancelada && (
                        <div className="es-acoes">
                          <Botao variante="fantasma" tamanho="m" onClick={() => baixar(`monitoria-${j.disciplina}.ics`, icsDaMonitoria(j, encher(t.monitoria.icsTitulo, { disciplina: t.disciplinas[j.disciplina] }), url))}>{t.monitoria.agenda}</Botao>
                          <Botao variante="fantasma" tamanho="m" onClick={() => setCancelando(j)}>{t.monitoria.cancelar}</Botao>
                        </div>
                      )}
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      <aside className="es-lado" aria-label={t.monitoria.lado}>
        {m.eu?.situacao === "convidado" && (
          <section className="es-cartao es-convite-monitor" aria-labelledby={`${id}-conv`}>
            <h2 id={`${id}-conv`} className="es-cartao-titulo al-cond">{t.monitoria.conviteTitulo}</h2>
            <p className="es-texto">{encher(t.monitoria.conviteTexto, { disciplinas: m.eu.disciplinas.map((d) => t.disciplinas[d]).join(", ") })}</p>
            <div className="es-acoes">
              <Botao variante="primario" tamanho="m" onClick={() => fazer(() => monitoria.responder(true), t.monitoria.aceitou)}>{t.monitoria.aceitar}</Botao>
              <Botao variante="fantasma" tamanho="m" onClick={() => fazer(() => monitoria.responder(false), t.monitoria.recusou)}>{t.monitoria.recusar}</Botao>
            </div>
          </section>
        )}
        {ativo && m.eu && (
          <Oferecer t={t} disciplinas={m.eu.disciplinas} aulas={m.aulas} f={f} aoOferecer={(o) => fazer(() => monitoria.oferecer(o), t.oferecer.feito)} aoDeixar={() => setDeixando(true)} />
        )}
        {m.pode_nomear && <Monitores t={t} avisar={avisar} />}
        <section className="es-cartao es-regra" aria-labelledby={`${id}-regra`}>
          <h2 id={`${id}-regra`} className="es-cartao-titulo al-cond">{t.monitoria.regraTitulo}</h2>
          <ul className="es-itens" role="list">
            {t.monitoria.regra.map((item, i) => (
              <li key={i}>
                <span className="es-item-ladrilho" data-cor={["1", "d", "v", "4", "2"][i % 5]} aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      </aside>

      <Confirmar
        aberto={desmarcando !== null}
        titulo={t.monitoria.desmarcarTitulo}
        texto={desmarcando?.cancelada ? t.monitoria.tirarDaListaTexto : t.monitoria.desmarcarTexto}
        sim={desmarcando?.cancelada ? t.monitoria.tirarDaLista : t.monitoria.desmarcar}
        nao={t.monitoria.manter}
        aoFechar={() => setDesmarcando(null)}
        aoSim={() => desmarcando && fazer(() => monitoria.desmarcar(desmarcando.id), t.monitoria.desmarcou)}
      />
      <Confirmar
        aberto={cancelando !== null}
        titulo={t.monitoria.cancelarTitulo}
        texto={t.monitoria.cancelarTexto}
        sim={t.monitoria.cancelar}
        nao={t.monitoria.manter}
        aoFechar={() => setCancelando(null)}
        aoSim={() => cancelando && fazer(() => monitoria.cancelar(cancelando.id), t.monitoria.cancelou)}
      />
      <Confirmar
        aberto={deixando}
        titulo={t.oferecer.deixarTitulo}
        texto={t.oferecer.deixarTexto}
        sim={t.oferecer.deixar}
        nao={t.monitoria.manter}
        aoFechar={() => setDeixando(false)}
        aoSim={() => fazer(() => monitoria.deixar(), t.oferecer.deixou)}
      />
    </div>
  );
}

/** Onde a sala acontece, em palavras (nunca só o ícone). */
function Sala({ t, j }: { t: T; j: JanelaDeMonitoria }) {
  return <p className="es-horario-sala">{j.sala === "aula" ? t.monitoria.salaAula : t.monitoria.salaConversa}</p>;
}

function HorarioAberto({ t, f, j, aberto, aoAbrir, aoMarcar }: {
  t: T;
  f: ReturnType<typeof useFormatos>;
  j: JanelaDeMonitoria;
  aberto: boolean;
  aoAbrir: () => void;
  aoMarcar: (duvida: string) => Promise<void>;
}) {
  const id = useId();
  const [duvida, setDuvida] = useState("");
  const [ocupado, setOcupado] = useState(false);
  return (
    <article className="es-horario" data-disciplina={j.disciplina}>
      <div className="es-horario-topo">
        <h4 className="es-horario-disc al-cond">{t.disciplinas[j.disciplina]}</h4>
        <p className="es-horario-quando">{f.quando(j.inicio)} · {encher(t.monitoria.minutos, { n: j.duracao })}</p>
      </div>
      {j.nota && <p className="es-texto">{j.nota}</p>}
      <div className="es-acoes">
        <Sala t={t} j={j} />
        <span className="es-carimbo">{t.monitoria.haVaga}</span>
      </div>
      {aberto ? (
        <form
          className="es-form es-bloco"
          onSubmit={async (e: FormEvent) => {
            e.preventDefault();
            setOcupado(true);
            await aoMarcar(duvida);
            setOcupado(false);
          }}
        >
          <label className="es-campo" htmlFor={`${id}-d`}>
            <span>{t.monitoria.duvida}</span>
            <textarea id={`${id}-d`} value={duvida} onChange={(e) => setDuvida(e.target.value)} maxLength={LIMITES_DA_MONITORIA.duvida} rows={2} placeholder={t.monitoria.duvidaExemplo} />
          </label>
          <p className="es-miudo">{t.monitoria.quemVe}</p>
          <div className="es-acoes">
            <Botao type="submit" variante="primario" tamanho="m" disabled={ocupado}>{t.monitoria.confirmar}</Botao>
            <Botao variante="fantasma" tamanho="m" onClick={aoAbrir}>{t.monitoria.voltar}</Botao>
          </div>
        </form>
      ) : (
        <div className="es-acoes">
          <Botao variante="contorno" tamanho="m" onClick={aoAbrir}>{t.monitoria.marcar}</Botao>
        </div>
      )}
    </article>
  );
}

function Oferecer({ t, disciplinas, aulas, f, aoOferecer, aoDeixar }: {
  t: T;
  disciplinas: Disciplina[];
  aulas: Monitoria["aulas"];
  f: ReturnType<typeof useFormatos>;
  aoOferecer: (o: Oferta) => Promise<boolean>;
  aoDeixar: () => void;
}) {
  const id = useId();
  const [disciplina, setDisciplina] = useState<Disciplina>(disciplinas[0]);
  const [inicio, setInicio] = useState("");
  const [duracao, setDuracao] = useState(60);
  const [vagas, setVagas] = useState(1);
  const [sala, setSala] = useState<"conversa" | "aula">("conversa");
  const [aula, setAula] = useState(aulas[0]?.id ?? "");
  const [nota, setNota] = useState("");
  const [aviso, setAviso] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const quando = instanteDoCampo(inicio);
    if (!quando) {
      setAviso({ texto: t.erros["invalido:inicio"], erro: true });
      return;
    }
    setOcupado(true);
    setAviso(null);
    const certo = await aoOferecer({ disciplina, inicio: quando, duracao, vagas, sala, aula: sala === "aula" ? aula || null : null, nota: nota.trim() });
    setOcupado(false);
    if (certo) {
      setInicio("");
      setNota("");
    }
  }

  return (
    <section className="es-cartao es-comecar" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="es-cartao-titulo al-cond">{t.oferecer.titulo}</h2>
      <p className="es-texto">{t.oferecer.texto}</p>
      <form className="es-form" onSubmit={enviar}>
        <label className="es-campo" htmlFor={`${id}-disc`}>
          <span>{t.oferecer.disciplina}</span>
          <select id={`${id}-disc`} value={disciplina} onChange={(e) => setDisciplina(e.target.value as Disciplina)}>
            {disciplinas.map((d) => (
              <option key={d} value={d}>{t.disciplinas[d]}</option>
            ))}
          </select>
        </label>
        <label className="es-campo" htmlFor={`${id}-quando`}>
          <span>{t.oferecer.quando}</span>
          <input id={`${id}-quando`} type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} required />
        </label>
        <div className="es-campos es-campos-2">
          <label className="es-campo" htmlFor={`${id}-dur`}>
            <span>{t.oferecer.duracao}</span>
            <select id={`${id}-dur`} value={duracao} onChange={(e) => setDuracao(Number(e.target.value))}>
              {DURACOES.map((d) => (
                <option key={d} value={d}>{encher(t.monitoria.minutos, { n: d })}</option>
              ))}
            </select>
          </label>
          <label className="es-campo" htmlFor={`${id}-vagas`}>
            <span>{t.oferecer.vagas}</span>
            <select id={`${id}-vagas`} value={vagas} onChange={(e) => setVagas(Number(e.target.value))}>
              {Array.from({ length: LIMITES_DA_MONITORIA.vagas }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>
        <fieldset className="es-campo">
          <legend>{t.oferecer.sala}</legend>
          <div className="es-escolhas">
            <label className="es-escolha">
              <input type="radio" name={`${id}-sala`} checked={sala === "conversa"} onChange={() => setSala("conversa")} />
              {t.oferecer.salaConversa}
            </label>
            <label className="es-escolha">
              <input type="radio" name={`${id}-sala`} checked={sala === "aula"} disabled={aulas.length === 0} onChange={() => setSala("aula")} />
              {t.oferecer.salaAula}
            </label>
          </div>
          {aulas.length === 0 && <p className="es-miudo">{t.oferecer.semAula}</p>}
        </fieldset>
        {sala === "aula" && aulas.length > 0 && (
          <label className="es-campo" htmlFor={`${id}-aula`}>
            <span>{t.oferecer.qualAula}</span>
            <select id={`${id}-aula`} value={aula} onChange={(e) => setAula(e.target.value)}>
              {aulas.map((a) => (
                <option key={a.id} value={a.id}>{a.titulo} · {f.quando(a.inicio)}</option>
              ))}
            </select>
          </label>
        )}
        <label className="es-campo" htmlFor={`${id}-nota`}>
          <span>{t.oferecer.nota}</span>
          <input id={`${id}-nota`} value={nota} onChange={(e) => setNota(e.target.value)} maxLength={LIMITES_DA_MONITORIA.nota} placeholder={t.oferecer.notaExemplo} />
        </label>
        <Nota nota={aviso} />
        <Botao type="submit" variante="primario" tamanho="m" disabled={ocupado}>{t.oferecer.botao}</Botao>
      </form>
      <div className="es-bloco">
        <Botao variante="fantasma" tamanho="m" onClick={aoDeixar}>{t.oferecer.deixar}</Botao>
      </div>
    </section>
  );
}

/** Quem dá monitoria: só para quem nomeia. Nomear por @ (a pessoa aceita ou recusa) e tirar. */
function Monitores({ t, avisar }: { t: T; avisar: Avisar }) {
  const id = useId();
  const [lista, setLista] = useState<Monitor[] | null>(null);
  const [handle, setHandle] = useState("");
  const [escolha, setEscolha] = useState<Disciplina[]>([]);
  const [nota, setNota] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [tirando, setTirando] = useState<Monitor | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    monitoria.monitores().then((r) => vivo && setLista(r), () => vivo && setLista([]));
    return () => {
      vivo = false;
    };
  }, []);

  async function nomear(e: FormEvent) {
    e.preventDefault();
    if (escolha.length === 0) {
      setNota({ texto: t.erros["invalido:disciplinas"], erro: true });
      return;
    }
    setOcupado(true);
    setNota(null);
    try {
      setLista(await monitoria.nomear(handle, escolha));
      avisar({ texto: encher(t.monitores.convidou, { handle: handle.replace(/^@/, "") }) });
      setHandle("");
      setEscolha([]);
    } catch (erro) {
      setNota({ texto: textoDoErro(t.erros, erro), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="es-cartao es-entrar" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="es-cartao-titulo al-cond">{t.monitores.titulo}</h2>
      <p className="es-texto">{t.monitores.texto}</p>
      <form className="es-form" onSubmit={nomear}>
        <label className="es-campo" htmlFor={`${id}-h`}>
          <span>{t.monitores.quem}</span>
          <input id={`${id}-h`} value={handle} onChange={(e) => setHandle(e.target.value)} required autoComplete="off" spellCheck={false} placeholder="@codinome" />
        </label>
        <fieldset className="es-campo">
          <legend>{t.monitores.disciplinas}</legend>
          <div className="es-escolhas">
            {DISCIPLINAS.map((d) => (
              <label key={d} className="es-escolha">
                <input type="checkbox" checked={escolha.includes(d)} onChange={(e) => setEscolha((x) => (e.target.checked ? [...x, d] : x.filter((y) => y !== d)))} />
                {t.disciplinas[d]}
              </label>
            ))}
          </div>
        </fieldset>
        <Nota nota={nota} />
        <Botao type="submit" variante="claro" tamanho="m" disabled={ocupado}>{t.monitores.convidar}</Botao>
      </form>
      <div className="es-bloco">
        {!lista ? null : lista.length === 0 ? (
          <p className="es-miudo">{t.monitores.nenhum}</p>
        ) : (
          <ul className="es-marcas" role="list">
            {lista.map((p) => (
              <li key={p.handle ?? p.nome}>
                <span className="es-pessoa">{p.nome}</span>
                {p.handle && <span>@{p.handle}</span>}
                <span className="es-miudo">{p.disciplinas.map((d) => t.disciplinas[d]).join(", ")}</span>
                {p.situacao === "convidado" && <span className="es-carimbo" data-tom="apagado">{t.monitores.esperando}</span>}
                {p.handle && <Botao variante="fantasma" tamanho="p" onClick={() => setTirando(p)}>{t.monitores.tirar}</Botao>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <Confirmar
        aberto={tirando !== null}
        titulo={encher(t.monitores.tirarTitulo, { nome: tirando?.nome ?? "" })}
        texto={t.monitores.tirarTexto}
        sim={t.monitores.tirar}
        nao={t.monitoria.manter}
        aoFechar={() => setTirando(null)}
        aoSim={async () => {
          if (!tirando?.handle) return;
          try {
            setLista(await monitoria.tirar(tirando.handle));
            avisar({ texto: t.monitores.tirou });
          } catch (e) {
            avisar({ texto: textoDoErro(t.erros, e), erro: true });
          }
        }}
      />
    </section>
  );
}
