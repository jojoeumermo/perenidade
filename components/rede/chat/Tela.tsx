// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useState } from "react";
import { ativarNesteAparelho, estadoDoAparelho } from "@/lib/rede/chat-chaveiro";
import type { Eu } from "@/lib/rede/chat-privado";
import { chat, type ConversaDoChat, type SituacaoDoChat } from "@/lib/rede/cliente-chat";
import { preencher } from "@/lib/rede/preencher";
import { carregarTextosDoChat, type TextosDoChat } from "@/lib/rede/textos-chat";
import { Avatar } from "../perfil/Avatar";
import type { ImagemDePerfil } from "@/lib/rede/tipos-perfil";
import { EsqueletoDaLinha } from "../Esqueletos";
import type { PropsDaTelaDoPacote } from "../registro";
import { Ajustes } from "./Ajustes";
import { Conversa } from "./Conversa";
import { botaoForte, botaoLeve, erroDoChat } from "./comum";

type Aparelho = { estado: "carregando" } | { estado: "pronto"; eu: Eu } | { estado: "sem_chave" } | { estado: "outro_aparelho" } | { estado: "erro"; texto: string };

/**
 * Conversas da Alumia (/comunidade/conversas): o chat privado, cifrado de ponta a ponta com a mesma tecnologia das conversas da
 * equipe (docs/rede/CHAT-PRIVADO.md). Componentes próprios, sem mexer no visual do resto da Alumia. Nada daqui vai ao Fediverso.
 */
export default function Tela({ lang, s, situacao }: PropsDaTelaDoPacote) {
  const [t, setT] = useState<TextosDoChat | null>(null);
  const [sit, setSit] = useState<SituacaoDoChat | null>(null);
  const [aparelho, setAparelho] = useState<Aparelho>({ estado: "carregando" });
  const [lista, setLista] = useState<ConversaDoChat[] | null>(null);
  const [aberta, setAberta] = useState<ConversaDoChat | null>(null);
  const [handle, setHandle] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [ajustes, setAjustes] = useState(false);

  useEffect(() => {
    let vivo = true;
    carregarTextosDoChat(lang).then((x) => vivo && setT(x)).catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [lang]);

  const recarregar = useCallback(async () => {
    const [nova, conversas] = await Promise.all([chat.situacao(), chat.conversas()]);
    setSit(nova);
    setLista(conversas);
    return { nova, conversas };
  }, []);

  // Situação, estado deste aparelho e a lista. Se veio ?com=handle (botão do perfil), abre ou pede a conversa.
  useEffect(() => {
    if (!situacao.logado || !situacao.membro || !t) return;
    let vivo = true;
    (async () => {
      try {
        const { nova, conversas } = await recarregar();
        if (!vivo) return;
        const estado = await estadoDoAparelho(nova);
        if (!vivo) return;
        setAparelho(estado);
        const com = new URLSearchParams(window.location.search).get("com");
        if (com) {
          const ja = conversas.find((c) => c.com.handle === com.toLowerCase());
          if (ja) setAberta(ja);
          else setHandle(com);
        }
      } catch (e) {
        if (vivo) setAparelho({ estado: "erro", texto: erroDoChat(t, s, e) });
      }
    })();
    return () => {
      vivo = false;
    };
  }, [situacao.logado, situacao.membro, t, s, recarregar]);

  // A lista se atualiza sozinha a cada 30 s, só com a aba visível e sem conversa aberta.
  useEffect(() => {
    if (aparelho.estado !== "pronto" || aberta) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void recarregar().catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(id);
  }, [aparelho.estado, aberta, recarregar]);

  async function ativar() {
    if (!sit || ocupado || !t) return;
    setOcupado(true);
    setAviso("");
    try {
      const eu = await ativarNesteAparelho(sit.eu);
      setAparelho({ estado: "pronto", eu });
      await recarregar();
    } catch (e) {
      setAviso(erroDoChat(t, s, e));
    } finally {
      setOcupado(false);
    }
  }

  async function abrirPorHandle(e: React.FormEvent) {
    e.preventDefault();
    if (!t || ocupado || !handle.trim()) return;
    setOcupado(true);
    setAviso("");
    try {
      const c = await chat.abrir(handle.trim());
      setHandle("");
      await recarregar();
      if (c.situacao === "aberta") setAberta(c);
      else setAviso(t.lista.pedidoEnviado);
    } catch (erro) {
      setAviso(erroDoChat(t, s, erro));
    } finally {
      setOcupado(false);
    }
  }

  async function responder(c: ConversaDoChat, aceitar: boolean) {
    if (!t || ocupado) return;
    setOcupado(true);
    setAviso("");
    try {
      const r = await chat.responder(c.id, aceitar);
      await recarregar();
      if ("id" in r) setAberta(r);
    } catch (erro) {
      setAviso(erroDoChat(t, s, erro));
    } finally {
      setOcupado(false);
    }
  }

  if (!t) return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />;

  const cabecalho = (
    <header className="border-b border-rule px-[18px] py-4 font-sans">
      <div className="flex items-start justify-between gap-3">
        <h1 id="alumia-chat-titulo" className="font-serif text-2xl font-extrabold">{t.titulo}</h1>
        {aparelho.estado === "pronto" && !aberta && (
          <button type="button" onClick={() => setAjustes((x) => !x)} aria-expanded={ajustes} className={botaoLeve}>
            {t.ajustes.titulo}
          </button>
        )}
      </div>
      <p className="mt-1 flex items-start gap-1.5 text-sm text-ink-soft">
        <svg aria-hidden viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 11V8a6 6 0 1 1 12 0v3M5 11h14v10H5z" />
        </svg>
        <span>{t.lead}</span>
      </p>
    </header>
  );

  if (!situacao.logado) return <section aria-labelledby="alumia-chat-titulo">{cabecalho}<p className="px-[18px] py-8 font-sans text-ink-soft">{t.entre}</p></section>;
  if (!situacao.membro) return <section aria-labelledby="alumia-chat-titulo">{cabecalho}<p className="px-[18px] py-8 font-sans text-ink-soft">{t.soMembros}</p></section>;

  if (aparelho.estado === "pronto" && aberta) {
    return (
      <section aria-labelledby="alumia-chat-titulo" className="font-sans">
        <h1 id="alumia-chat-titulo" className="sr-only">{t.titulo}</h1>
        <Conversa
          lang={lang}
          t={t}
          s={s}
          eu={aparelho.eu}
          conversa={aberta}
          aoVoltar={() => {
            setAberta(null);
            void recarregar().catch(() => undefined);
          }}
          aoApagar={() => {
            setAberta(null);
            void recarregar().catch(() => undefined);
          }}
        />
      </section>
    );
  }

  const pedidos = (lista ?? []).filter((c) => c.situacao === "pedido" && !c.pedi);
  const conversas = (lista ?? []).filter((c) => !(c.situacao === "pedido" && !c.pedi));

  return (
    <section aria-labelledby="alumia-chat-titulo" className="font-sans">
      {cabecalho}
      {aviso && (
        <p role="status" className="border-b border-rule bg-parchment-deep px-[18px] py-3 text-sm">
          {aviso}
        </p>
      )}

      {aparelho.estado === "carregando" ? (
        <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />
      ) : aparelho.estado === "erro" ? (
        <p role="alert" className="px-[18px] py-8 text-oxblood">{aparelho.texto}</p>
      ) : aparelho.estado !== "pronto" ? (
        <div className="px-[18px] py-6">
          <h2 className="font-serif text-xl font-bold">{aparelho.estado === "sem_chave" ? t.ativar.titulo : t.ativar.outroTitulo}</h2>
          <p className="mt-2 max-w-prose text-ink-soft">{aparelho.estado === "sem_chave" ? t.ativar.texto : t.ativar.outroTexto}</p>
          <button type="button" disabled={ocupado} onClick={() => void ativar()} className={`${botaoForte} mt-4`}>
            {aparelho.estado === "sem_chave" ? t.ativar.botao : t.ativar.outroBotao}
          </button>
        </div>
      ) : ajustes && sit ? (
        <Ajustes
          t={t}
          s={s}
          situacao={sit}
          aoMudar={(nova) => setSit(nova)}
          aoApagarTudo={async () => {
            setAjustes(false);
            setAparelho({ estado: "sem_chave" });
            await recarregar().catch(() => undefined);
          }}
        />
      ) : (
        <>
          <form onSubmit={(e) => void abrirPorHandle(e)} className="flex flex-wrap items-end gap-2 border-b border-rule px-[18px] py-4">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-semibold">
              {t.nova.rotulo}
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value.replace(/\s/g, ""))}
                placeholder={t.nova.placeholder}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={40}
                className="min-h-11 rounded-md border border-rule bg-paper px-3 font-normal"
              />
            </label>
            <button type="submit" disabled={ocupado || !handle.trim()} className={botaoForte}>
              {t.nova.botao}
            </button>
          </form>

          {pedidos.length > 0 && (
            <div className="border-b border-rule px-[18px] py-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-ink-soft">{t.lista.pedidos}</h2>
              <p className="mt-1 text-xs text-ink-soft">{t.lista.recusarExplica}</p>
              <ul className="mt-3 space-y-3">
                {pedidos.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-3">
                    <Avatar usuario={c.com.id} imagem={c.com.avatar as ImagemDePerfil | null} codinome={c.com.codinome} tamanho={40} />
                    <span className="min-w-0 flex-1">{preencher(t.lista.pedidoDe, { nome: c.com.codinome })}</span>
                    <button type="button" disabled={ocupado} onClick={() => void responder(c, true)} className={botaoForte}>{t.lista.aceitar}</button>
                    <button type="button" disabled={ocupado} onClick={() => void responder(c, false)} className={botaoLeve}>{t.lista.recusar}</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <h2 className="sr-only">{t.lista.rotulo}</h2>
          {lista === null ? (
            <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />
          ) : conversas.length === 0 ? (
            <p className="px-[18px] py-8 text-ink-soft">{t.lista.vazio}</p>
          ) : (
            <ul aria-label={t.lista.rotulo}>
              {conversas.map((c) => (
                <li key={c.id} className="border-b border-rule">
                  <button
                    type="button"
                    disabled={c.situacao === "pedido"}
                    onClick={() => setAberta(c)}
                    className="flex w-full items-center gap-3 px-[18px] py-3 text-left hover:bg-parchment-deep disabled:cursor-default disabled:hover:bg-transparent"
                  >
                    <Avatar usuario={c.com.id} imagem={c.com.avatar as ImagemDePerfil | null} codinome={c.com.codinome} tamanho={44} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{c.com.codinome}</span>
                      <span className="block truncate text-sm text-ink-soft">
                        {c.situacao === "pedido" ? t.lista.pedidoEnviado : c.com.handle ? `@${c.com.handle}` : ""}
                      </span>
                    </span>
                    {c.nao_lidas > 0 && (
                      <span className="rounded-full bg-[#c21f16] px-2 py-0.5 text-xs font-bold text-white">{preencher(t.lista.naoLidas, { n: String(c.nao_lidas) })}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
