// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { abrirMensagens, abrirSessao, confiarNaIdentidade, depoisDeBuraco, enviarTexto, type MensagemAberta, ordemDaConversa, type Sessao } from "@/lib/rede/chat-chaveiro";
import { codigoDeSeguranca, type Eu, MAX_CARACTERES, textoCabe } from "@/lib/rede/chat-privado";
import { aoApagarTudoDoChat } from "@/lib/rede/chat/gaveta";
import { codigoComMetadeEscondida, conferirMetadeDe, conferirQr, metadeDaOutraPessoa } from "@/lib/rede/chat/verificacao";
import { chat, type ConversaDoChat, type Prazo } from "@/lib/rede/cliente-chat";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDoChat } from "@/lib/rede/textos-chat";
import type { ImagemDePerfil } from "@/lib/rede/tipos-perfil";
import { codigoEmGrupos, metadeDoCodigo } from "@/lib/sigilo";
import { Avatar } from "../perfil/Avatar";
import { botaoForte, botaoLeve, botaoPerigo, erroDoChat } from "./comum";
import { Denuncia } from "./Denuncia";
import { LeitorDeQr, QrDoCodigo, temCamera } from "./Qr";

const PRAZOS: Prazo[] = [1, 7, 30];
const INTERVALO = 8000;

/** "some em 3 dias", no idioma da pessoa. */
function quandoSome(lang: string, expira: string): string {
  const ms = Date.parse(expira) - Date.now();
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  const horas = ms / 3_600_000;
  return horas < 1 ? rtf.format(Math.max(1, Math.round(ms / 60_000)), "minute") : horas < 48 ? rtf.format(Math.round(horas), "hour") : rtf.format(Math.round(horas / 24), "day");
}

/** Os sessenta números em doze grupos, com largura fixa para comparar de olho. */
function Grupos({ grupos, rotulo }: { grupos: string[]; rotulo: string }) {
  return (
    <p className="max-w-[15rem] font-mono text-base leading-relaxed tracking-wide" aria-label={rotulo}>
      {/* O espaço entre os grupos: leitor de tela e "copiar" recebem grupos de cinco, não sessenta números colados. */}
      {grupos.map((grupo, i) => (
        <Fragment key={i}>
          <span className="inline-block w-[4.4rem]">{grupo}</span>{i < grupos.length - 1 ? " " : ""}
        </Fragment>
      ))}
    </p>
  );
}

/**
 * A identidade de alguém que estava VERIFICADA mudou: um clique não basta. A tela só segue se a pessoa comparar de verdade:
 * lendo o QR da outra com a câmera, ou digitando os seis grupos que a tela da OUTRA pessoa marca como "seus" (a metade que vem
 * da identidade dela), conferidos contra a metade calculada da identidade nova (`metadeDaNova`), em qualquer posição. Nem a minha
 * metade nem "os grupos X a Y da tela dela" servem: os dois conferem com uma identidade falsa (lib/rede/chat/verificacao.ts).
 */
function CompararDeNovo({ t, nome, codigo, minhaMetade, metadeDaNova, aoConferir }: { t: TextosDoChat; nome: string; codigo: string; minhaMetade: string; metadeDaNova: string; aoConferir: () => void }) {
  // Só para esconder na tela a metade que precisa ser ouvida; a conferência não depende da posição.
  const daOutra = metadeDaOutraPessoa(codigo, minhaMetade);
  const [digitado, setDigitado] = useState("");
  const [aviso, setAviso] = useState("");
  const [lendo, setLendo] = useState(false);
  const id = "alumia-chat-grupo-do-codigo";
  // A câmera só liga com o toque da pessoa.
  const lerQr = temCamera() && !lendo && <button type="button" onClick={() => { setAviso(""); setLendo(true); }} className={botaoLeve}>{t.acoes.qrLer}</button>;
  return (
    <div className="mt-3 space-y-3">
      {daOutra && <Grupos grupos={codigoComMetadeEscondida(codigo, daOutra.inicio)} rotulo={t.acoes.codigo} />}
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (conferirMetadeDe(metadeDaNova, digitado)) aoConferir();
          else setAviso(t.conversa.grupoErrado);
        }}
      >
        <label htmlFor={id} className="w-full text-sm">{preencher(t.conversa.grupoPedido, { nome })}</label>
        <input
          id={id}
          value={codigoEmGrupos(digitado)}
          onChange={(e) => setDigitado(e.target.value.replace(/[^0-9]/g, "").slice(0, 30))}
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          aria-label={preencher(t.conversa.grupoRotulo, { nome })}
          className="min-h-11 w-full max-w-[22rem] rounded-md border border-rule bg-white px-3 font-mono tracking-wider text-[#1f1a14]"
        />
        <button type="submit" disabled={digitado.length !== 30} className={botaoLeve}>{t.conversa.grupoConferir}</button>
        {lerQr}
      </form>
      {lendo && (
        <LeitorDeQr
          t={t}
          fechar={() => setLendo(false)}
          aoLer={(texto) => {
            setLendo(false);
            const r = conferirQr(texto, codigo);
            if (r === "confere") aoConferir();
            else setAviso(r === "nao_confere" ? t.acoes.qrNaoConfere : t.acoes.qrOutro);
          }}
        />
      )}
      {aviso && <p role="alert" className="font-semibold">{aviso}</p>}
    </div>
  );
}

/** Uma conversa aberta: mensagens decifradas no aparelho, escrever, opções (prazo, código de segurança e QR, bloquear, denunciar, apagar). */
export function Conversa({ lang, t, s, eu, conversa, aoVoltar, aoApagar }: { lang: string; t: TextosDoChat; s: TextosDaRede; eu: Eu; conversa: ConversaDoChat; aoVoltar: () => void; aoApagar: () => void }) {
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [mensagens, setMensagens] = useState<MensagemAberta[]>([]);
  const [temMais, setTemMais] = useState(false);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [opcoes, setOpcoes] = useState(false);
  const [prazo, setPrazo] = useState<Prazo>(conversa.prazo_dias);
  const [bloqueio, setBloqueio] = useState(conversa.bloqueio);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [codigoNovo, setCodigoNovo] = useState<{ identidade: string; codigo: string; minhaMetade: string; metadeDaNova: string } | null>(null);
  // Os seis grupos que vêm da MINHA identidade: o que eu dito quando a outra pessoa precisa comparar de novo.
  const [meusGrupos, setMeusGrupos] = useState<string | null>(null);
  const [lendoQr, setLendoQr] = useState(false);
  const [avisoDoCodigo, setAvisoDoCodigo] = useState("");
  const [denunciando, setDenunciando] = useState(false);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const fim = useRef<HTMLDivElement>(null);
  const sessaoRef = useRef<Sessao | null>(null);

  const juntar = useCallback((novas: MensagemAberta[]) => {
    setMensagens((atual) => {
      const porId = new Map(atual.map((m) => [m.id, m]));
      for (const m of novas) porId.set(m.id, m);
      return [...porId.values()].sort((a, b) => a.criado_em.localeCompare(b.criado_em));
    });
  }, []);

  const buscar = useCallback(
    async (atual: Sessao, substituir = false) => {
      const lista = await chat.mensagens(atual.conversa);
      // Mensagem numa versão que este aparelho ainda não tem: a chave virou; abre a sessão de novo.
      let usada = atual;
      if (lista.some((m) => !atual.chaves.has(m.versao) && m.versao > atual.versao)) {
        usada = await abrirSessao(eu, atual.conversa, atual.outro, atual);
        sessaoRef.current = usada;
        setSessao(usada);
      }
      const abertas = await abrirMensagens(usada, lista);
      if (substituir) {
        setMensagens([...abertas].sort((a, b) => a.criado_em.localeCompare(b.criado_em)));
        setTemMais(lista.length >= 50);
      } else juntar(abertas);
    },
    [eu, juntar],
  );

  // Abre a sessão (identidade, chaves) e as mensagens; depois, a cada 8 s com a aba visível.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        if (bloqueio || !conversa.pode_escrever) {
          // Mesmo bloqueada, a pessoa pode apagar ou denunciar; ler, não (o servidor fecha).
          return;
        }
        const nova = await abrirSessao(eu, conversa.id, conversa.com.id);
        if (!vivo) return;
        sessaoRef.current = nova;
        setSessao(nova);
        await buscar(nova, true);
      } catch (e) {
        if (vivo) setErro(erroDoChat(t, s, e));
      }
    })();
    const id = window.setInterval(() => {
      const atual = sessaoRef.current;
      if (atual && document.visibilityState === "visible") void buscar(atual).catch(() => undefined);
    }, INTERVALO);
    return () => {
      vivo = false;
      window.clearInterval(id);
    };
  }, [eu, conversa.id, conversa.com.id, conversa.pode_escrever, bloqueio, buscar, t, s]);

  useEffect(() => {
    if (!denunciando) fim.current?.scrollIntoView({ block: "end" });
  }, [mensagens.length, denunciando]);

  // "Sair rápido": o rascunho e as mensagens abertas somem da memória desta tela na hora.
  useEffect(
    () =>
      aoApagarTudoDoChat(() => {
        sessaoRef.current = null;
        setSessao(null);
        setMensagens([]);
        setTexto("");
        setCodigo(null);
        setCodigoNovo(null);
      }),
    [],
  );

  // A identidade de alguém verificado mudou: calcula o código com a identidade NOVA, para comparar de novo.
  const identidadeNova = sessao?.exigeComparar ? sessao.mudou : null;
  useEffect(() => {
    if (!identidadeNova) return;
    let vivo = true;
    void Promise.all([codigoDeSeguranca(eu.identidade.publica, identidadeNova), metadeDoCodigo(eu.identidade.publica), metadeDoCodigo(identidadeNova)])
      .then(([codigo, minhaMetade, metadeDaNova]) => vivo && setCodigoNovo({ identidade: identidadeNova, codigo, minhaMetade, metadeDaNova }))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [identidadeNova, eu.identidade.publica]);
  // Só vale o código calculado para a identidade que está na tela agora.
  const paraComparar = identidadeNova && codigoNovo?.identidade === identidadeNova ? codigoNovo : null;

  const faltas = useMemo(() => depoisDeBuraco(mensagens), [mensagens]);
  // Dentro de cada pessoa, a ordem em que ela escreveu (o servidor não consegue mexer nela); a hora do servidor só intercala.
  const ordem = useMemo(() => ordemDaConversa(mensagens, eu.usuario), [mensagens, eu.usuario]);

  async function carregarMais() {
    const atual = sessaoRef.current;
    if (!atual || !mensagens.length) return;
    try {
      const lista = await chat.mensagens(atual.conversa, mensagens[0].criado_em);
      juntar(await abrirMensagens(atual, lista));
      setTemMais(lista.length >= 50);
    } catch (e) {
      setErro(erroDoChat(t, s, e));
    }
  }

  async function enviar(e?: React.FormEvent) {
    e?.preventDefault();
    const atual = sessaoRef.current;
    if (!atual || ocupado || !textoCabe(texto)) return;
    setOcupado(true);
    setErro("");
    try {
      const usada = await enviarTexto(atual, texto);
      if (usada !== atual) {
        sessaoRef.current = usada;
        setSessao(usada);
      }
      setTexto("");
      await buscar(usada);
    } catch (erroDoEnvio) {
      setErro(erroDoChat(t, s, erroDoEnvio));
    } finally {
      setOcupado(false);
    }
  }

  /**
   * Aceita a identidade nova. `comparou`: leu o QR ou digitou os números certos (obrigatório se a conversa estava verificada).
   * `identidade`: aquela para a qual o código comparado foi calculado; se o servidor trocou de novo no meio, o chaveiro recusa.
   */
  async function confiar(comparou: boolean, identidade?: string) {
    const atual = sessaoRef.current;
    if (!atual?.mudou) return;
    try {
      await confiarNaIdentidade(atual, identidade ?? atual.mudou, comparou);
      const nova = await abrirSessao(eu, conversa.id, conversa.com.id, atual);
      sessaoRef.current = nova;
      setSessao(nova);
      setCodigo(null);
      await buscar(nova, true);
    } catch (e) {
      setErro(erroDoChat(t, s, e));
    }
  }

  async function mostrarCodigo() {
    const atual = sessaoRef.current;
    const outra = atual?.confiadas[conversa.com.id];
    if (!atual || !outra) return;
    setAvisoDoCodigo("");
    const [doPar, meus] = await Promise.all([codigoDeSeguranca(eu.identidade.publica, outra), metadeDoCodigo(eu.identidade.publica)]);
    setCodigo(doPar);
    setMeusGrupos(meus);
  }

  async function marcarVerificado() {
    const atual = sessaoRef.current;
    const outra = atual?.confiadas[conversa.com.id];
    if (!atual || !outra) return;
    await confiarNaIdentidade(atual, outra, true);
    const nova = { ...atual, verificado: true };
    sessaoRef.current = nova;
    setSessao(nova);
  }

  async function agir(fazer: () => Promise<unknown>, confirmar?: string) {
    if (ocupado || (confirmar && !window.confirm(confirmar))) return;
    setOcupado(true);
    setErro("");
    try {
      await fazer();
    } catch (e) {
      setErro(erroDoChat(t, s, e));
    } finally {
      setOcupado(false);
    }
  }

  const restam = MAX_CARACTERES - [...texto].length;
  const doOutro = mensagens.filter((m) => m.autor !== eu.usuario && m.texto !== null && !m.repetida);

  return (
    <div className="flex min-h-[70vh] flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-rule bg-parchment px-[18px] py-3">
        <button type="button" onClick={aoVoltar} className="min-h-11 min-w-11 rounded-full hover:bg-parchment-deep" aria-label={t.conversa.voltar}>
          <svg aria-hidden viewBox="0 0 24 24" className="mx-auto h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <Avatar usuario={conversa.com.id} imagem={conversa.com.avatar as ImagemDePerfil | null} codinome={conversa.com.codinome} tamanho={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{conversa.com.codinome}</p>
          <p className="flex items-center gap-1 truncate text-xs text-ink-soft">
            <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 11V8a6 6 0 1 1 12 0v3M5 11h14v10H5z" />
            </svg>
            {conversa.com.handle ? `@${conversa.com.handle}` : ""}
            {sessao?.verificado ? ` · ${t.acoes.jaVerificado}` : ""}
            {/* Não verificada fica visível (depois do "Sair rápido", todas as verificações se perdem). */}
            {sessao && !sessao.verificado ? <span className="font-semibold text-[#8a4b00]"> · {t.acoes.naoVerificado}</span> : null}
          </p>
        </div>
        <button type="button" onClick={() => setOpcoes((x) => !x)} aria-expanded={opcoes} className={botaoLeve}>
          {t.acoes.rotulo}
        </button>
      </header>

      {opcoes && (
        <div className="space-y-4 border-b border-rule bg-parchment-deep px-[18px] py-4 text-sm">
          <label className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{t.acoes.prazo}</span>
            <select
              value={prazo}
              disabled={ocupado}
              onChange={(e) => {
                const dias = Number(e.target.value) as Prazo;
                void agir(async () => {
                  await chat.prazo(conversa.id, dias);
                  setPrazo(dias);
                  if (sessaoRef.current) await buscar(sessaoRef.current, true);
                });
              }}
              className="min-h-11 rounded-md border border-rule bg-parchment px-2"
            >
              {PRAZOS.map((d) => (
                <option key={d} value={d}>{d === 1 ? t.acoes.dia : preencher(t.acoes.dias, { n: d })}</option>
              ))}
            </select>
            <span className="text-xs text-ink-soft">{t.acoes.prazoExplica}</span>
          </label>

          {sessao && !sessao.semChaveDoOutro && !sessao.mudou && (
            <div>
              <button type="button" onClick={() => void mostrarCodigo()} className={botaoLeve}>{t.acoes.codigo}</button>
              {codigo && (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-ink-soft">{t.acoes.codigoExplica}</p>
                  <div className="flex flex-wrap items-start gap-4">
                    <QrDoCodigo codigo={codigo} rotulo={t.acoes.qrRotulo} />
                    <Grupos grupos={codigoEmGrupos(codigo).split(" ")} rotulo={t.acoes.codigo} />
                  </div>
                  {meusGrupos && (
                    <div>
                      <p className="text-xs text-ink-soft">{t.acoes.meusGrupos}</p>
                      <Grupos grupos={codigoEmGrupos(meusGrupos).split(" ")} rotulo={t.acoes.meusGrupos} />
                    </div>
                  )}
                  {lendoQr && (
                    <LeitorDeQr
                      t={t}
                      fechar={() => setLendoQr(false)}
                      aoLer={(texto) => {
                        setLendoQr(false);
                        const r = conferirQr(texto, codigo);
                        if (r === "confere") void marcarVerificado().then(() => setAvisoDoCodigo(t.acoes.qrConfere)).catch(() => undefined);
                        else setAvisoDoCodigo(r === "nao_confere" ? t.acoes.qrNaoConfere : t.acoes.qrOutro);
                      }}
                    />
                  )}
                  {avisoDoCodigo && <p role="status" className="font-semibold">{avisoDoCodigo}</p>}
                  <div className="flex flex-wrap items-center gap-2">
                    {temCamera() && !lendoQr && (
                      <button type="button" onClick={() => { setAvisoDoCodigo(""); setLendoQr(true); }} className={botaoLeve}>{t.acoes.qrLer}</button>
                    )}
                    {sessao.verificado ? (
                      <p className="text-xs font-semibold">{t.acoes.jaVerificado}</p>
                    ) : (
                      <button type="button" onClick={() => void marcarVerificado()} className={botaoLeve}>{t.acoes.verificado}</button>
                    )}
                  </div>
                  <p className="text-xs text-ink-soft">{t.acoes.negavel}</p>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={ocupado}
              onClick={() =>
                void agir(async () => {
                  await chat.bloquear(conversa.com.id, !bloqueio);
                  setBloqueio(!bloqueio);
                }, bloqueio ? undefined : t.acoes.bloquearConfirma)
              }
              className={botaoLeve}
            >
              {bloqueio ? t.acoes.desbloquear : t.acoes.bloquear}
            </button>
            <button type="button" disabled={ocupado} onClick={() => { setDenunciando(true); setOpcoes(false); }} className={botaoLeve}>
              {t.acoes.denunciar}
            </button>
            <button type="button" disabled={ocupado} onClick={() => void agir(async () => { await chat.apagar(conversa.id); aoApagar(); }, t.acoes.apagarConfirma)} className={botaoPerigo}>
              {t.acoes.apagar}
            </button>
          </div>
        </div>
      )}

      {denunciando && (
        <Denuncia
          t={t}
          s={s}
          conversa={conversa.id}
          trechos={doOutro.filter((m) => marcadas.has(m.id)).map((m) => m.texto as string)}
          aoFechar={(bloqueou) => {
            setDenunciando(false);
            setMarcadas(new Set());
            if (bloqueou) setBloqueio(true);
          }}
        />
      )}

      {sessao?.mudou && (
        <div role="alert" className="border-b border-rule bg-[#fff4d6] px-[18px] py-3 text-sm text-[#1f1a14]">
          {sessao.exigeComparar ? (
            <>
              <p className="font-semibold">{preencher(t.conversa.mudouVerificada, { nome: conversa.com.codinome })}</p>
              {paraComparar && <CompararDeNovo t={t} nome={conversa.com.codinome} codigo={paraComparar.codigo} minhaMetade={paraComparar.minhaMetade} metadeDaNova={paraComparar.metadeDaNova} aoConferir={() => void confiar(true, paraComparar.identidade)} />}
            </>
          ) : (
            <>
              <p>{preencher(t.conversa.mudou, { nome: conversa.com.codinome })}</p>
              <button type="button" onClick={() => void confiar(false)} className={`${botaoLeve} mt-2`}>{t.conversa.confirmar}</button>
            </>
          )}
        </div>
      )}
      {erro && <p role="alert" className="border-b border-rule px-[18px] py-3 text-sm text-oxblood">{erro}</p>}

      <div className="flex-1 space-y-2 px-[18px] py-4" aria-live="polite" aria-relevant="additions">
        {bloqueio || !conversa.pode_escrever ? (
          <p className="text-ink-soft">{t.conversa.bloqueada}</p>
        ) : !sessao ? (
          <p className="text-ink-soft">{t.conversa.aguarde}</p>
        ) : (
          <>
            {temMais && (
              <button type="button" onClick={() => void carregarMais()} className={`${botaoLeve} mx-auto block`}>{t.conversa.carregarMais}</button>
            )}
            {sessao.semChaveDoOutro && <p className="text-sm text-ink-soft">{t.conversa.semChaveDoOutro}</p>}
            {mensagens.length === 0 && <p className="text-sm text-ink-soft">{t.conversa.vazio}</p>}
            <ul className="space-y-2">
              {ordem.ordenadas.map((m) => {
                const minha = m.autor === eu.usuario;
                // Repetida: este aparelho já tinha esta mesma mensagem. Fica só uma linha discreta, sem o texto.
                if (m.repetida) return <li key={m.id} className="text-center text-[11px] italic text-ink-soft">{t.conversa.repetida}</li>;
                return (
                  <li key={m.id} className={`flex flex-wrap items-start gap-2 ${minha ? "justify-end" : "justify-start"}`}>
                    {faltas.has(m.id) && <p className="w-full text-center text-[11px] italic text-ink-soft">{t.conversa.faltam}</p>}
                    {denunciando && !minha && m.texto !== null && (
                      <input
                        type="checkbox"
                        className="mt-3 h-5 w-5"
                        aria-label={m.texto.slice(0, 60)}
                        checked={marcadas.has(m.id)}
                        onChange={(e) =>
                          setMarcadas((atual) => {
                            const nova = new Set(atual);
                            if (e.target.checked) nova.add(m.id);
                            else nova.delete(m.id);
                            return nova;
                          })
                        }
                      />
                    )}
                    <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 ${minha ? "rounded-br-sm bg-[#1f1a14] text-[#f6efe2]" : "rounded-bl-sm border border-rule bg-parchment-deep"}`}>
                      <p className="sr-only">{minha ? t.conversa.voce : conversa.com.codinome}:</p>
                      {m.texto === null ? (
                        <p className="text-sm italic opacity-80">{t.conversa.semChave}</p>
                      ) : (
                        <p className="whitespace-pre-wrap break-words">{m.texto}</p>
                      )}
                      {m.autoria === "invalida" && <p className="mt-1 text-xs font-semibold text-[#ff8a80]">{t.conversa.autoriaInvalida}</p>}
                      {m.duvidosa && <p className="mt-1 text-[11px] italic opacity-80">{t.conversa.duvidosa}</p>}
                      {ordem.foraDeOrdem.has(m.id) && <p className="mt-1 text-[11px] italic opacity-80">{t.conversa.foraDeOrdem}</p>}
                      {minha && ordem.semConfirmar.has(m.id) && <p className="mt-1 text-[11px] italic opacity-80">{t.conversa.semConfirmar}</p>}
                      <p className="mt-1 flex items-center justify-end gap-2 text-[11px] opacity-70">
                        <time dateTime={m.criado_em}>{new Date(m.criado_em).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" })}</time>
                        <span>· {preencher(t.conversa.expira, { quando: quandoSome(lang, m.expira_em) })}</span>
                        {minha && (
                          <button
                            type="button"
                            className="underline"
                            onClick={() =>
                              void agir(async () => {
                                await chat.apagarMensagem(m.id);
                                setMensagens((atual) => atual.filter((x) => x.id !== m.id));
                              }, t.conversa.apagarMensagemConfirma)
                            }
                          >
                            {t.conversa.apagarMensagem}
                          </button>
                        )}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div ref={fim} />
          </>
        )}
      </div>

      {sessao && !bloqueio && conversa.pode_escrever && !sessao.semChaveDoOutro && (
        <form onSubmit={(e) => void enviar(e)} className="al2-chat-escrever sticky bottom-0 border-t border-rule bg-parchment px-[18px] py-3">
          <label className="sr-only" htmlFor="alumia-chat-texto">{t.conversa.escreva}</label>
          <div className="flex items-end gap-2">
            <textarea
              id="alumia-chat-texto"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void enviar();
                }
              }}
              rows={2}
              placeholder={t.conversa.escreva}
              autoComplete="off"
              disabled={!!sessao.mudou}
              className="min-h-11 flex-1 resize-none rounded-xl border border-rule bg-parchment px-3 py-2"
            />
            <button type="submit" disabled={ocupado || !textoCabe(texto) || !!sessao.mudou} className={botaoForte}>{t.conversa.enviar}</button>
          </div>
          <p className={`mt-1 text-right text-xs ${restam < 0 ? "text-oxblood" : "text-ink-soft"}`}>{restam < 0 ? t.conversa.grande : preencher(t.conversa.restam, { n: restam })}</p>
        </form>
      )}
    </div>
  );
}
