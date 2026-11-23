// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A conversa de um grupo (recurso "alumia-chat-grupo"), na página Conversas e na janela flutuante. Documento: docs/rede/CHAT-PRIVADO.md ("Conversa em grupo").
// Só a tela: tudo passa pelo cliente dos grupos (lib/rede/chat/grupo/cliente.ts), que fala com os grupos deste aparelho (MLS,
// caixas anônimas). Aqui: as mensagens (texto, anexo cifrado, prazo, ver uma vez, apagar), quem está (com o @ conferido e o código
// de segurança de cada pessoa), convidar pelo @ e tirar alguém (só quem administra), mudar o nome e sair.
// Nenhum número abaixo de 3 (a contagem vem do grupo). Alvos de toque de 44 px; sem animação.
import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CorpoDeAnexo } from "@/lib/rede/chat/anexo-cifrado";
import { gruposDoChat, type GrupoNaLista, type MensagemDoGrupo, type PessoaDoGrupo, type PrazoDoGrupo } from "@/lib/rede/chat/grupo/cliente";
import { preencher } from "@/lib/rede/preencher";
import { ligado } from "@/lib/recursos";
import { carregarTextosDoAnexo, type TextosDoAnexo } from "@/lib/rede/textos-chat-anexo";
import { erroDoGrupo, type TextosDoChatGrupo } from "@/lib/rede/textos-chat-grupo";
import { codigoEmGrupos } from "@/lib/sigilo";
import { AnexoNaMensagem, AnexoNoCompositor } from "../AnexoCifrado";
import { botaoForte, botaoLeve, botaoPerigo } from "../comum";
import { Confirmar, type PedidoDeConfirmacao } from "../Confirmar";

type Painel = null | "pessoas" | "convidar" | "nome";

function quandoSome(lang: string, ms: number): string {
  return new Date(ms).toLocaleString(lang, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function ConversaDoGrupo({ lang, tg, conta, grupo: doPai, aoVoltar, compacta = false, idDoCampo }: {
  lang: string;
  tg: TextosDoChatGrupo;
  conta: string;
  grupo: GrupoNaLista;
  aoVoltar: () => void;
  /** Na janela flutuante: sem o cabeçalho grande (a janela tem a barra com o nome). */
  compacta?: boolean;
  idDoCampo?: string;
}) {
  // O grupo como a lista deste aparelho o tem agora (nome, contagem, mediação, fora): relido junto com as mensagens.
  const [grupo, setGrupo] = useState<GrupoNaLista>(doPai);
  const [mensagens, setMensagens] = useState<MensagemDoGrupo[] | null>(null);
  const [pessoas, setPessoas] = useState<PessoaDoGrupo[]>([]);
  const [painel, setPainel] = useState<Painel>(null);
  const [texto, setTexto] = useState("");
  const [prazo, setPrazo] = useState<PrazoDoGrupo>(7);
  const [umaVez, setUmaVez] = useState(false);
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [abertasUmaVez, setAbertasUmaVez] = useState<Set<string>>(new Set());
  const [convidado, setConvidado] = useState("");
  const [feitos, setFeitos] = useState<{ codinome: string; quando: number }[]>([]);
  const [novoNome, setNovoNome] = useState(doPai.nome);
  const [codigos, setCodigos] = useState<Record<string, string>>({});
  const [confirmacao, setConfirmacao] = useState<PedidoDeConfirmacao | null>(null);
  const [ta, setTa] = useState<TextosDoAnexo | null>(null);
  const id = useId();
  const campo = idDoCampo ?? `${id}-texto`;
  const fim = useRef<HTMLDivElement>(null);
  const fora = grupo.fora !== null;
  const comAnexo = ligado("alumia-p4-anexo-cifrado");
  const px = compacta ? "px-3" : "px-[18px]";

  useEffect(() => {
    if (!comAnexo) return;
    let vivo = true;
    carregarTextosDoAnexo(lang).then((x) => vivo && setTa(x)).catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [comAnexo, lang]);

  // Só lê o que já chegou a este aparelho: a agenda das caixas busca o grupo no horário dela (nada é puxado ao abrir).
  const idDoGrupo = doPai.id;
  const ler = useCallback(async () => {
    try {
      const agora = (await gruposDoChat.lista(conta)).grupos.find((g) => g.id === idDoGrupo);
      if (agora) setGrupo(agora);
      setMensagens(await gruposDoChat.mensagens(conta, idDoGrupo));
      if (agora && !agora.fora) setPessoas(await gruposDoChat.pessoas(conta, idDoGrupo));
      await gruposDoChat.marcarLido(conta, idDoGrupo);
    } catch (e) {
      setMensagens((atual) => atual ?? []);
      setAviso(erroDoGrupo(tg, e));
    }
  }, [conta, idDoGrupo, tg]);
  useEffect(() => {
    // ler é assíncrona: o estado muda depois da guarda responder, não durante o efeito.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void ler();
    const parar = gruposDoChat.aoMudar(() => void ler());
    const vez = window.setInterval(() => {
      if (document.visibilityState === "visible") void ler();
    }, 15_000);
    return () => {
      parar();
      window.clearInterval(vez);
    };
  }, [ler]);
  const quantas = mensagens?.length ?? 0;
  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [quantas]);

  const nomes = useMemo(() => new Map(pessoas.map((p) => [p.identidade, p])), [pessoas]);
  const souMediacao = grupo.souMediacao && !fora;
  const textoCabe = (x: string) => x.trim().length > 0 && [...x.trim()].length <= 2000;

  async function fazer(f: () => Promise<void>) {
    if (ocupado) return;
    setOcupado(true);
    setAviso("");
    try {
      await f();
    } catch (e) {
      setAviso(erroDoGrupo(tg, e));
    } finally {
      setOcupado(false);
    }
  }

  const enviar = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!textoCabe(texto)) return;
    void fazer(async () => {
      await gruposDoChat.mandarTexto(conta, grupo.id, texto, { prazo, umaVez });
      setTexto("");
      setUmaVez(false);
      await ler();
    });
  };

  const abrirPainel = (p: Painel) => {
    setAviso("");
    setPainel((atual) => (atual === p ? null : p));
    if (p === "convidar") void gruposDoChat.convitesFeitos(conta, grupo.id).then(setFeitos, () => undefined);
  };

  const convidar = (e: React.FormEvent) => {
    e.preventDefault();
    const nome = convidado.trim().replace(/^@+/, "").toLowerCase();
    if (!nome) return;
    void fazer(async () => {
      await gruposDoChat.convidar(conta, grupo.id, nome);
      setConvidado("");
      setAviso(preencher(tg.convidar.enviado, { nome }));
      setFeitos(await gruposDoChat.convitesFeitos(conta, grupo.id));
    });
  };

  const nomeDe = (identidade: string, minha: boolean) => (minha ? tg.conversa.voce : nomes.get(identidade)?.codinome ? `@${nomes.get(identidade)!.codinome}` : tg.conversa.semNome);
  const prazos: { v: PrazoDoGrupo; r: string }[] = [
    { v: 1, r: tg.conversa.dia1 },
    { v: 7, r: tg.conversa.dia7 },
    { v: 30, r: tg.conversa.dia30 },
  ];

  const corpoDoAnexo = (m: MensagemDoGrupo): CorpoDeAnexo | null => gruposDoChat.corpoDoAnexo(m);

  return (
    <div className={`flex ${compacta ? "h-full min-h-0" : "min-h-[70vh]"} flex-col`} data-conversa-grupo>
      <header className={`sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-rule bg-parchment ${px} py-2`}>
        {!compacta && (
          <button type="button" onClick={aoVoltar} className="min-h-11 min-w-11 rounded-full hover:bg-parchment-deep" aria-label={tg.conversa.voltar}>
            <svg aria-hidden viewBox="0 0 24 24" className="mx-auto h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
        )}
        <div className="min-w-0 flex-1">
          {!compacta && <h2 className="truncate font-serif text-lg font-bold">{grupo.nome}</h2>}
          <p className="text-xs text-ink-soft">{grupo.contagem !== null ? preencher(tg.pessoas.contagem, { n: String(grupo.contagem) }) : tg.conversa.lead}</p>
        </div>
        {!fora && (
          <div className="flex flex-wrap gap-1">
            <button type="button" className={botaoLeve} aria-expanded={painel === "pessoas"} onClick={() => abrirPainel("pessoas")}>{tg.conversa.pessoas}</button>
            {souMediacao && <button type="button" className={botaoLeve} aria-expanded={painel === "convidar"} onClick={() => abrirPainel("convidar")}>{tg.conversa.convidar}</button>}
          </div>
        )}
      </header>

      {grupo.suspeito && <p role="alert" className={`${px} border-b border-oxblood py-2 text-sm font-semibold`}>{tg.conversa.suspeito}</p>}
      {aviso && <p role="status" className={`${px} border-b border-rule bg-parchment-deep py-2 text-sm`}>{aviso}</p>}

      {painel === "pessoas" && !fora && (
        <section aria-labelledby={`${id}-pessoas`} className={`${px} space-y-3 border-b border-rule py-3`}>
          <div className="flex items-center justify-between gap-2">
            <h3 id={`${id}-pessoas`} className="font-semibold">{tg.pessoas.titulo}</h3>
            <button type="button" className="inline-flex min-h-11 items-center px-1 text-sm underline" onClick={() => setPainel(null)}>{tg.pessoas.fechar}</button>
          </div>
          <p className="text-xs text-ink-soft">{tg.pessoas.explica}</p>
          <ul className="space-y-3">
            {pessoas.map((p) => {
              const nome = p.codinome ?? "";
              return (
                <li key={p.identidade} className="space-y-1" data-pessoa-grupo>
                  <p className="text-sm">
                    <span className="font-semibold">{p.eu ? tg.conversa.voce : nome ? `@${nome}` : tg.conversa.semNome}</span>
                    {p.mediacao && <span className="text-ink-soft"> · {tg.pessoas.mediacao}</span>}
                  </p>
                  {!p.eu && (
                    <p className={`text-xs ${p.conferida === "nao_confere" ? "font-semibold text-oxblood" : "text-ink-soft"}`}>
                      {p.conferida === "confere" ? tg.pessoas.conferida : p.conferida === "nao_confere" ? tg.pessoas.naoConfere : tg.pessoas.semConferir}
                    </p>
                  )}
                  {!p.eu && p.conta && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex min-h-11 items-center text-sm underline"
                        aria-expanded={!!codigos[p.identidade]}
                        onClick={() => {
                          if (codigos[p.identidade]) return setCodigos((c) => Object.fromEntries(Object.entries(c).filter(([k]) => k !== p.identidade)));
                          void gruposDoChat.codigo(conta, { conta: p.conta!, identidade: p.identidade }).then((c) => setCodigos((x) => ({ ...x, [p.identidade]: c })), () => undefined);
                        }}
                      >
                        {codigos[p.identidade] ? tg.pessoas.esconderCodigo : tg.pessoas.verCodigo}
                      </button>
                      {souMediacao && (
                        <button
                          type="button"
                          className={botaoPerigo}
                          disabled={ocupado}
                          onClick={() =>
                            setConfirmacao({
                              pergunta: preencher(tg.pessoas.tirarConfirma, { nome: nome || tg.conversa.semNome }),
                              sim: tg.pessoas.tirarSim,
                              fazer: () => void fazer(async () => {
                                await gruposDoChat.tirar(conta, grupo.id, p.identidade);
                                await ler();
                              }),
                            })
                          }
                        >
                          {tg.pessoas.tirar}
                        </button>
                      )}
                    </div>
                  )}
                  {codigos[p.identidade] && (
                    <div className="rounded-md border border-rule p-2" data-codigo-grupo>
                      <p className="text-xs font-semibold">{preencher(tg.pessoas.codigo, { nome })}</p>
                      <p className="max-w-[15rem] font-mono text-base leading-relaxed tracking-wide" aria-label={preencher(tg.pessoas.codigo, { nome })}>
                        {codigoEmGrupos(codigos[p.identidade]).split(" ").map((g, i, todos) => (
                          <Fragment key={i}>
                            <span className="inline-block w-[4.4rem]">{g}</span>{i < todos.length - 1 ? " " : ""}
                          </Fragment>
                        ))}
                      </p>
                      <p className="mt-1 text-xs text-ink-soft">{tg.pessoas.codigoExplica}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap gap-2 pt-1">
            {souMediacao && (
              <button type="button" className={botaoLeve} onClick={() => { setNovoNome(grupo.nome); setPainel("nome"); }}>{tg.conversa.renomear}</button>
            )}
            <button
              type="button"
              className={botaoPerigo}
              disabled={ocupado}
              onClick={() =>
                setConfirmacao({
                  pergunta: preencher(tg.sair.confirma, { grupo: grupo.nome }),
                  sim: tg.sair.sim,
                  fazer: () => void fazer(async () => {
                    await gruposDoChat.sair(conta, grupo.id);
                    aoVoltar();
                  }),
                })
              }
            >
              {tg.conversa.sair}
            </button>
          </div>
        </section>
      )}

      {painel === "nome" && souMediacao && (
        <form
          className={`${px} space-y-2 border-b border-rule py-3`}
          onSubmit={(e) => {
            e.preventDefault();
            void fazer(async () => {
              await gruposDoChat.renomear(conta, grupo.id, novoNome);
              setPainel(null);
            });
          }}
        >
          <label htmlFor={`${id}-nome`} className="block text-sm font-semibold">{tg.lista.nomeRotulo}</label>
          <input id={`${id}-nome`} value={novoNome} onChange={(e) => setNovoNome(e.target.value)} maxLength={60} className="block min-h-11 w-full rounded-md border border-rule bg-paper px-3" />
          <p className="text-xs text-ink-soft">{tg.lista.nomeDica}</p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={ocupado || !novoNome.trim()} className={botaoForte}>{tg.conversa.renomearBotao}</button>
            <button type="button" className={botaoLeve} onClick={() => setPainel(null)}>{tg.lista.cancelar}</button>
          </div>
        </form>
      )}

      {painel === "convidar" && souMediacao && (
        <form onSubmit={convidar} className={`${px} space-y-2 border-b border-rule py-3`} aria-labelledby={`${id}-convidar`}>
          <div className="flex items-center justify-between gap-2">
            <h3 id={`${id}-convidar`} className="font-semibold">{tg.convidar.titulo}</h3>
            <button type="button" className="inline-flex min-h-11 items-center px-1 text-sm underline" onClick={() => setPainel(null)}>{tg.convidar.fechar}</button>
          </div>
          <label htmlFor={`${id}-arroba`} className="block text-sm font-semibold">{tg.convidar.rotulo}</label>
          <input
            id={`${id}-arroba`}
            value={convidado}
            onChange={(e) => setConvidado(e.target.value.replace(/\s/g, ""))}
            placeholder={tg.convidar.placeholder}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={40}
            aria-describedby={`${id}-dica-convite`}
            className="block min-h-11 w-full rounded-md border border-rule bg-paper px-3"
          />
          <p id={`${id}-dica-convite`} className="text-xs text-ink-soft">{tg.convidar.dica}</p>
          <button type="submit" disabled={ocupado || !convidado.trim()} className={botaoForte}>{tg.convidar.botao}</button>
          {feitos.length > 0 && (
            <div className="text-sm">
              <p className="text-xs font-semibold text-ink-soft">{tg.convidar.pendentes}</p>
              <ul className="mt-1 space-y-1">
                {feitos.map((f) => (
                  <li key={f.codinome}>@{f.codinome}</li>
                ))}
              </ul>
            </div>
          )}
        </form>
      )}

      <div className={`flex-1 overflow-y-auto ${px} py-3`}>
        {fora && (
          <div className="mb-3 space-y-2 rounded-md border border-rule p-3 text-sm" role="note">
            <p>{tg.conversa.fora}</p>
            <button type="button" className={botaoLeve} onClick={() => void fazer(async () => { await gruposDoChat.esquecer(conta, grupo.id); aoVoltar(); })}>{tg.conversa.esquecer}</button>
          </div>
        )}
        {mensagens !== null && mensagens.length === 0 && <p className="text-sm text-ink-soft">{tg.conversa.vazio}</p>}
        <ul className="space-y-2" aria-label={preencher(tg.conversa.rotulo, { nome: grupo.nome })}>
          {(mensagens ?? []).map((m) => {
            const corpo = m.anexo ? corpoDoAnexo(m) : null;
            const umaVezFechada = m.umaVez && !m.minha && !abertasUmaVez.has(m.id) && !m.anexo;
            return (
              <li key={m.id} className={`flex ${m.minha ? "justify-end" : "justify-start"}`} data-mensagem-grupo>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 ${m.minha ? "rounded-br-sm bg-ink text-parchment" : "rounded-bl-sm border border-rule bg-parchment-deep"}`}>
                  <p className={`text-[11px] font-semibold ${m.minha ? "sr-only" : ""}`}>{nomeDe(m.autor, m.minha)}</p>
                  {m.anexo ? (
                    corpo && ta ? (
                      <AnexoNaMensagem
                        t={ta}
                        abrirCorpo={(c) => gruposDoChat.abrirAnexo(grupo.id, c)}
                        corpo={corpo}
                        minha={m.minha}
                        aoAbrirUmaVez={() => void gruposDoChat.apagarMensagem(conta, grupo.id, m.id).catch(() => undefined)}
                        aoFecharUmaVez={() => setMensagens((atual) => (atual ?? []).filter((x) => x.id !== m.id))}
                        lang={lang}
                      />
                    ) : (
                      <p className="text-sm italic opacity-80">{tg.conversa.anexo}</p>
                    )
                  ) : umaVezFechada ? (
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center underline"
                      onClick={() => {
                        // Abriu: já sai da guarda deste aparelho; o texto fica só nesta tela até fechar.
                        setAbertasUmaVez((atual) => new Set(atual).add(m.id));
                        void gruposDoChat.apagarMensagem(conta, grupo.id, m.id).catch(() => undefined);
                      }}
                    >
                      {tg.conversa.umaVezAbrir}
                    </button>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap break-words">{m.texto}</p>
                      {m.umaVez && !m.minha && (
                        <button type="button" className="mt-1 inline-flex min-h-11 items-center text-xs underline" onClick={() => setMensagens((atual) => (atual ?? []).filter((x) => x.id !== m.id))}>
                          {tg.conversa.umaVezFechar}
                        </button>
                      )}
                    </>
                  )}
                  <div className="mt-1 flex flex-wrap items-center justify-end gap-x-2 text-[11px]">
                    <time className="opacity-80" dateTime={new Date(m.quando).toISOString()}>{new Date(m.quando).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" })}</time>
                    <span className="opacity-80">· {tg.conversa.prazo} {quandoSome(lang, m.expira)}</span>
                    {m.umaVez && <span className="opacity-80">· {tg.conversa.umaVez}</span>}
                    {!umaVezFechada && (
                      <button
                        type="button"
                        className="inline-flex min-h-11 min-w-11 items-center justify-center underline"
                        onClick={() =>
                          setConfirmacao({
                            pergunta: m.minha && !m.anexo ? tg.conversa.apagarTodos : tg.conversa.apagarAqui,
                            sim: tg.conversa.apagar,
                            fazer: () => void fazer(async () => {
                              await gruposDoChat.apagarMensagem(conta, grupo.id, m.id);
                              await ler();
                            }),
                          })
                        }
                      >
                        {tg.conversa.apagar}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <div ref={fim} />
      </div>

      {!fora && (
        <form onSubmit={enviar} className={`sticky bottom-0 border-t border-rule bg-parchment ${px} py-3`}>
          <label className="sr-only" htmlFor={campo}>{tg.conversa.campo}</label>
          <div className="flex items-end gap-2">
            <textarea
              id={campo}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  enviar();
                }
              }}
              rows={2}
              placeholder={tg.conversa.campo}
              autoComplete="off"
              className="min-h-11 flex-1 resize-none rounded-xl border border-rule bg-parchment px-3 py-2"
            />
            <button type="submit" disabled={ocupado || !textoCabe(texto)} className={botaoForte}>{ocupado ? tg.conversa.enviando : tg.conversa.enviar}</button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-1">
              <span>{tg.conversa.prazo}</span>
              <select value={prazo} onChange={(e) => setPrazo(Number(e.target.value) as PrazoDoGrupo)} className="min-h-9 rounded-md border border-rule bg-parchment px-1">
                {prazos.map((p) => (
                  <option key={p.v} value={p.v}>{p.r}</option>
                ))}
              </select>
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={umaVez} onChange={(e) => setUmaVez(e.target.checked)} className="h-4 w-4" />
              <span>{tg.conversa.umaVez}</span>
            </label>
          </div>
          {comAnexo && ta && (
            <div className="mt-2 flex flex-col gap-1 text-xs">
              <AnexoNoCompositor
                t={ta}
                enviar={async (arquivo, mime, duracaoMs, o) => {
                  await gruposDoChat.mandarAnexo(conta, grupo.id, arquivo, mime, duracaoMs, { prazo, umaVez: !!o.umaVez });
                }}
                opcoes={() => ({ prazoDias: prazo, umaVez })}
                desligado={ocupado}
                aoEnviado={() => {
                  setUmaVez(false);
                  void ler();
                }}
                aoErro={setAviso}
              />
              <p className="max-w-prose text-ink-soft">{ta.aviso}</p>
            </div>
          )}
        </form>
      )}
      <Confirmar pedido={confirmacao} nao={confirmacao?.sim === tg.sair.sim ? tg.sair.nao : tg.pessoas.tirarNao} aoFechar={() => setConfirmacao(null)} />
    </div>
  );
}
