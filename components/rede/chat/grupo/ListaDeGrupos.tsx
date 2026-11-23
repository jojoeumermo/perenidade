// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os grupos na lista de conversas (recurso "alumia-chat-grupo"), na página Conversas e na janela flutuante: os convites recebidos
// (entrar ou recusar), os que esperam a entrada terminar, criar um grupo e os grupos deste aparelho. Só a tela: tudo passa pelo
// cliente dos grupos (lib/rede/chat/grupo/cliente.ts). Nenhum número abaixo de 3 (a contagem vem do grupo, que dá null abaixo de 3).
// Alvos de toque de 44 px; sem animação.
import { useCallback, useEffect, useId, useState } from "react";
import { gruposDoChat, type GrupoNaLista, type ListaDosGrupos } from "@/lib/rede/chat/grupo/cliente";
import { preencher } from "@/lib/rede/preencher";
import { erroDoGrupo, type TextosDoChatGrupo } from "@/lib/rede/textos-chat-grupo";
import { botaoForte, botaoLeve } from "../comum";

function IconeDoGrupo({ tamanho }: { tamanho: number }) {
  return (
    <span aria-hidden className="flex shrink-0 items-center justify-center rounded-full border border-rule bg-parchment-deep" style={{ width: tamanho, height: tamanho }}>
      <svg viewBox="0 0 24 24" width={tamanho / 2} height={tamanho / 2} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 11a2.5 2.5 0 1 0 0-5M21 20a5 5 0 0 0-4-4.9" />
      </svg>
    </span>
  );
}

export function ListaDeGrupos({ tg, conta, aoAbrir, compacta = false, termo = "", abertos = [], aoListar }: {
  tg: TextosDoChatGrupo;
  conta: string;
  aoAbrir: (g: GrupoNaLista) => void;
  /** Na janela flutuante: margens menores. */
  compacta?: boolean;
  /** A busca da janela: só os grupos com o termo no nome (convites e criar somem durante a busca). */
  termo?: string;
  /** Os grupos abertos agora (marcados na lista). */
  abertos?: readonly string[];
  /** Quem monta a lista fica sabendo dos grupos (a janela usa o nome no título do painel). */
  aoListar?: (grupos: GrupoNaLista[]) => void;
}) {
  const [lista, setLista] = useState<ListaDosGrupos | null>(null);
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const id = useId();
  const px = compacta ? "px-3" : "px-[18px]";

  const recarregar = useCallback(async () => {
    try {
      const l = await gruposDoChat.lista(conta);
      setLista(l);
      aoListar?.(l.grupos);
    } catch (e) {
      setLista({ grupos: [], convites: [], esperando: [] });
      setAviso(erroDoGrupo(tg, e));
    }
  }, [conta, tg, aoListar]);

  useEffect(() => {
    // recarregar é assíncrona: o estado muda depois da guarda responder, não durante o efeito.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void recarregar();
    const parar = gruposDoChat.aoMudar(() => void recarregar());
    // A agenda das caixas busca cada grupo no seu horário; aqui só se relê o que já chegou a este aparelho (nada vai à rede).
    const vez = window.setInterval(() => {
      if (document.visibilityState === "visible") void recarregar();
    }, 30_000);
    return () => {
      parar();
      window.clearInterval(vez);
    };
  }, [recarregar]);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (ocupado || !nome.trim()) return;
    setOcupado(true);
    setAviso("");
    try {
      const novo = await gruposDoChat.criar(conta, nome);
      setNome("");
      setCriando(false);
      const l = await gruposDoChat.lista(conta);
      setLista(l);
      aoListar?.(l.grupos);
      const g = l.grupos.find((x) => x.id === novo);
      if (g) aoAbrir(g);
    } catch (erro) {
      setAviso(erroDoGrupo(tg, erro));
    } finally {
      setOcupado(false);
    }
  }

  async function responder(g: string, aceitar: boolean) {
    if (ocupado) return;
    setOcupado(true);
    setAviso("");
    try {
      await gruposDoChat.responder(conta, g, aceitar);
      await recarregar();
    } catch (erro) {
      setAviso(erroDoGrupo(tg, erro));
    } finally {
      setOcupado(false);
    }
  }

  const t = termo.trim().toLowerCase();
  const grupos = (lista?.grupos ?? []).filter((g) => !t || g.nome.toLowerCase().includes(t));
  if (t && grupos.length === 0) return null;
  return (
    <section aria-labelledby={`${id}-titulo`} className="border-b border-rule" data-chat-grupos>
      <div className={`flex items-center justify-between gap-2 ${px} pt-3`}>
        <h2 id={`${id}-titulo`} className="text-xs font-bold uppercase tracking-wider text-ink-soft">{tg.lista.titulo}</h2>
        {!t && !criando && (
          <button type="button" className="inline-flex min-h-11 items-center px-1 text-sm font-semibold underline" onClick={() => { setCriando(true); setAviso(""); }}>
            {tg.lista.criar}
          </button>
        )}
      </div>
      {aviso && <p role="status" className={`${px} py-2 text-sm`}>{aviso}</p>}
      {criando && !t && (
        <form onSubmit={(e) => void criar(e)} className={`${px} space-y-2 py-2`}>
          <label htmlFor={`${id}-nome`} className="block text-sm font-semibold">{tg.lista.nomeRotulo}</label>
          <input
            id={`${id}-nome`}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={60}
            autoComplete="off"
            aria-describedby={`${id}-dica`}
            className="block min-h-11 w-full rounded-md border border-rule bg-paper px-3"
            autoFocus
          />
          <p id={`${id}-dica`} className="text-xs text-ink-soft">{tg.lista.nomeDica}</p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={ocupado || !nome.trim()} className={botaoForte}>{tg.lista.criarBotao}</button>
            <button type="button" className={botaoLeve} onClick={() => { setCriando(false); setNome(""); }}>{tg.lista.cancelar}</button>
          </div>
        </form>
      )}
      {!t && (lista?.convites.length ?? 0) > 0 && (
        <div className={`${px} py-2`}>
          <h3 className="text-xs font-semibold text-ink-soft">{tg.lista.convites}</h3>
          <ul className="mt-2 space-y-3">
            {lista!.convites.map((c) => (
              <li key={c.g} className="space-y-2" data-convite-grupo>
                <p className="text-sm">{preencher(tg.lista.conviteDe, { nome: c.codinome, grupo: c.nome })}</p>
                <div className="flex gap-2">
                  <button type="button" disabled={ocupado} onClick={() => void responder(c.g, true)} className={`${botaoForte} flex-1`}>{tg.lista.aceitar}</button>
                  <button type="button" disabled={ocupado} onClick={() => void responder(c.g, false)} className={`${botaoLeve} flex-1`}>{tg.lista.recusar}</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!t && (lista?.esperando.length ?? 0) > 0 && (
        <ul className={`${px} space-y-1 py-2 text-sm text-ink-soft`}>
          {lista!.esperando.map((c) => (
            <li key={c.g} role="status">{preencher(tg.lista.esperando, { grupo: c.nome })}</li>
          ))}
        </ul>
      )}
      {lista && grupos.length === 0 && !criando && lista.convites.length === 0 && lista.esperando.length === 0 && (
        <p className={`${px} pb-3 pt-1 text-sm text-ink-soft`}>{tg.lista.vazio}</p>
      )}
      {grupos.length > 0 && (
        <ul aria-label={tg.lista.titulo} className="mt-1">
          {grupos.map((g) => (
            <li key={g.id} className="border-t border-rule">
              <button
                type="button"
                onClick={() => aoAbrir(g)}
                aria-current={abertos.includes(g.id) ? "true" : undefined}
                title={preencher(tg.lista.abrir, { nome: g.nome })}
                className={`flex min-h-11 w-full items-center gap-3 ${px} py-2 text-left hover:bg-parchment-deep aria-[current]:bg-parchment-deep`}
              >
                <IconeDoGrupo tamanho={compacta ? 40 : 44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{g.nome}</span>
                  <span className="block truncate text-xs text-ink-soft">
                    {g.fora ? tg.lista.fora : g.suspeito ? tg.lista.suspeito : g.contagem !== null ? preencher(tg.lista.pessoas, { n: String(g.contagem) }) : tg.lista.grupo}
                  </span>
                </span>
                {g.naoLidas > 0 && <span className="rounded-full bg-[#c21f16] px-2 py-0.5 text-xs font-bold text-white">{preencher(tg.lista.naoLidas, { n: String(g.naoLidas) })}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
