// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A janela de conversas por cima da Alumia (recurso "alumia-chat-flutuante"; o botão do canto é ./ChatFlutuante.tsx). É só uma
// CASCA de tela: a lista, a busca pelo @ e a conversa são as mesmas da página Conversas (components/rede/chat/Tela.tsx e
// Conversa.tsx), com o mesmo cliente (lib/rede/cliente-chat.ts) e o mesmo chaveiro (lib/rede/chat-chaveiro.ts). Nada de protocolo
// novo, nada de cifra aqui. O que a janela sabe (quais conversas estão abertas, minimizadas) fica só na memória da aba.
//
// No computador: a lista no canto e, ao lado dela, uma ou mais conversas abertas (quantas couberem), cada uma com minimizar e fechar.
// No celular (abaixo de 768 px): a janela ocupa a tela inteira, uma coisa por vez, com o botão de voltar; o foco fica preso nela.
// Esc minimiza (a conversa em que o foco está, ou a janela). Sem animação nenhuma: vale igual com menos movimento e no modo leve.
// As pastas, as notas para mim, os lembretes e os ajustes do chat continuam na página Conversas (o botão de expandir leva lá).
import { type Dispatch, type KeyboardEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "@/components/Link";
import { CONFERIR_AGENDADAS_MS } from "@/lib/rede/chat/agendar";
import { aoApagarTudoDoChat } from "@/lib/rede/chat/gaveta";
import { type AcaoDaJanela, conversasQueCabem, type EstadoDaJanela, telaCheia } from "@/lib/rede/chat/janela";
import { listaSemChatAqui } from "@/lib/rede/chat/lista-inicial";
import { ativarNesteAparelho, type Eu, enviarAgendadas, estadoDoAparelho, receberMensagens, resumoDasConversas } from "@/lib/rede/chat-chaveiro";
import { chat, type ConversaDoChat, PREVIA_DO_CHAT, type SituacaoDoChat } from "@/lib/rede/cliente-chat";
import { rede } from "@/lib/rede/cliente";
import { preencher } from "@/lib/rede/preencher";
import { previaLigada } from "@/lib/rede/publicar/alumia2";
import { ligado } from "@/lib/recursos";
import type { TextosDaRede } from "@/lib/rede/textos";
import { carregarTextosDoChat, type TextosDoChat } from "@/lib/rede/textos-chat";
import type { ImagemDePerfil } from "@/lib/rede/tipos-perfil";
import { useEscondidasDaViagem } from "../../conta/NoChat";
import { codigoDoErro } from "../../erros";
import { EsqueletoDaLinha } from "../../Esqueletos";
import { Avatar } from "../../perfil/Avatar";
import { botaoForte, botaoLeve, erroDoChat } from "../comum";
import { Conversa } from "../Conversa";
import { carregarTextosDaRede } from "./textos-da-rede";
import type { GrupoNaLista } from "@/lib/rede/chat/grupo/cliente";
import { carregarTextosDoChatGrupo, type TextosDoChatGrupo } from "@/lib/rede/textos-chat-grupo";
import { ListaDeGrupos } from "../grupo/ListaDeGrupos";
import { ConversaDoGrupo } from "../grupo/ConversaDoGrupo";

/** Na janela, um grupo aberto tem o id "g:<grupo>" (as conversas a dois têm o id delas): o estado da janela é um só. */
const PREFIXO_DO_GRUPO = "g:";
const grupoDaJanela = (id: string) => (id.startsWith(PREFIXO_DO_GRUPO) ? id.slice(PREFIXO_DO_GRUPO.length) : null);

type Aparelho =
  | { estado: "carregando" }
  | { estado: "pronto"; eu: Eu }
  | { estado: "sem_chave" }
  | { estado: "outro_aparelho" }
  | { estado: "apagado" }
  | { estado: "fora"; texto: string }
  | { estado: "erro"; texto: string; calmo: boolean };

/** A largura da janela do navegador, atualizada ao girar o celular ou mudar o tamanho da janela. */
function useLargura(): number {
  const [largura, setLargura] = useState(() => (typeof window === "undefined" ? 1280 : window.innerWidth));
  useEffect(() => {
    const medir = () => setLargura(window.innerWidth);
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);
  return largura;
}

const semArroba = (x: string) => x.trim().replace(/^@+/, "").toLowerCase();

/** O que dá para focar dentro de um elemento (para prender o foco na janela em tela cheia). */
function focaveis(raiz: HTMLElement): HTMLElement[] {
  return [...raiz.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(
    (el) => !el.closest("[hidden]") && el.getClientRects().length > 0,
  );
}

function Icone({ d }: { d: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
const ICONE_MINIMIZAR = "M5 12h14";
const ICONE_FECHAR = "M6 6l12 12M18 6L6 18";
const ICONE_EXPANDIR = "M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7";

export default function JanelaDoChat({ lang, estado, despachar, aoMinimizar, aoFechar }: { lang: string; estado: EstadoDaJanela; despachar: Dispatch<AcaoDaJanela>; aoMinimizar: () => void; aoFechar: () => void }) {
  const [t, setT] = useState<TextosDoChat | null>(null);
  const [s, setS] = useState<TextosDaRede | null>(null);
  const [sit, setSit] = useState<SituacaoDoChat | null>(null);
  const [aparelho, setAparelho] = useState<Aparelho>({ estado: "carregando" });
  const [lista, setLista] = useState<ConversaDoChat[] | null>(null);
  const [naoLidas, setNaoLidas] = useState<Map<string, number>>(new Map());
  const [busca, setBusca] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const largura = useLargura();
  const cheia = telaCheia(largura);
  const cabem = conversasQueCabem(largura);
  const id = useId();
  const raiz = useRef<HTMLDivElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const comConversaP4 = ligado("alumia-p4-conversa");
  // A conversa em grupo (recurso "alumia-chat-grupo"): os grupos aparecem na lista e abrem aqui, como as conversas a dois.
  const comGrupos = ligado("alumia-chat-grupo");
  const [tg, setTg] = useState<TextosDoChatGrupo | null>(null);
  const [grupos, setGrupos] = useState<GrupoNaLista[]>([]);
  useEffect(() => {
    if (!comGrupos) return;
    let vivo = true;
    carregarTextosDoChatGrupo(lang).then((x) => vivo && setTg(x)).catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [comGrupos, lang]);
  // O modo viagem (Prompt 4, item 109): as conversas escondidas não aparecem aqui, como na página.
  const escondidas = useEscondidasDaViagem((lista ?? []).map((c) => c.id));

  useEffect(() => {
    let vivo = true;
    Promise.all([carregarTextosDoChat(lang), carregarTextosDaRede(lang)])
      .then(([a, b]) => {
        if (!vivo) return;
        setT(a);
        setS(b);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [lang]);

  const recarregar = useCallback(async () => {
    const [nova, conversas] = await Promise.all([chat.situacao(), chat.conversas().catch(listaSemChatAqui<ConversaDoChat>)]);
    setSit(nova);
    setLista(conversas);
    return nova;
  }, []);

  // Quem está na conta (a mesma pergunta que a Rede faz; na prévia, a pessoa de exemplo), o chat e o estado deste aparelho.
  useEffect(() => {
    if (!t || !s) return;
    let vivo = true;
    (async () => {
      try {
        const quem = previaLigada() ? (await import("@/lib/rede/publicar/exemplos-alumia2")).SITUACAO_DE_EXEMPLO : await rede.situacao();
        if (!vivo) return;
        if (!quem.logado) return setAparelho({ estado: "fora", texto: t.entre });
        if (!quem.membro) return setAparelho({ estado: "fora", texto: t.soMembros });
        const nova = await recarregar();
        if (!vivo) return;
        const e = await estadoDoAparelho(nova);
        if (vivo) setAparelho(e.estado === "outro_aparelho" ? { estado: "outro_aparelho" } : e);
      } catch (e) {
        if (vivo) setAparelho({ estado: "erro", texto: erroDoChat(t, s, e), calmo: codigoDoErro(e) === "sem_servico" });
      }
    })();
    return () => {
      vivo = false;
    };
  }, [t, s, recarregar]);

  const eu = aparelho.estado === "pronto" ? aparelho.eu : null;
  // As não lidas contadas neste aparelho (a caixa selada é buscada como na página; o banco não sabe quantas chegaram).
  const resumir = useCallback(async () => {
    if (!eu) return;
    await receberMensagens(eu).catch(() => 0);
    const r = await resumoDasConversas(eu.usuario).catch(() => new Map());
    setNaoLidas(new Map([...r].map(([k, v]) => [k, (v as { naoLidas: number }).naoLidas])));
  }, [eu]);

  // A lista se atualiza ao abrir e a cada 30 s, só com a aba visível e a janela à vista.
  const aVista = estado.aberta && !estado.minimizada;
  useEffect(() => {
    if (!eu || !aVista) return;
    // resumir é assíncrona: o estado muda depois da caixa selada responder, não durante o efeito.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void resumir();
    const vez = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void recarregar().catch(() => undefined);
      void resumir();
    }, 30_000);
    return () => window.clearInterval(vez);
  }, [eu, aVista, recarregar, resumir]);

  // Como na página: com o chat pronto, o tráfego de cobertura (onda R3, 3.3) e o envio agendado (Prompt 4, item 18) seguem ligados.
  useEffect(() => {
    if (!eu || PREVIA_DO_CHAT) return;
    void Promise.all([import("@/lib/rede/caixas/agenda"), import("@/lib/rede/caixas/ritmo")]).then(([{ cobertura }, { observarBateria }]) => {
      observarBateria();
      cobertura(true);
    }, () => undefined);
  }, [eu]);
  useEffect(() => {
    if (!eu || !comConversaP4 || PREVIA_DO_CHAT) return;
    const conferir = () => void enviarAgendadas(eu).catch(() => undefined);
    const vez = window.setInterval(conferir, CONFERIR_AGENDADAS_MS);
    return () => window.clearInterval(vez);
  }, [eu, comConversaP4]);

  // "Sair rápido" ou "apagar tudo do chat" (aqui ou em outra aba): a janela esquece tudo e fecha.
  useEffect(
    () =>
      aoApagarTudoDoChat(() => {
        setLista([]);
        setNaoLidas(new Map());
        setGrupos([]);
        despachar({ tipo: "esquecer" });
        aoFechar();
      }),
    [despachar, aoFechar],
  );

  // Mudou a largura: saem as conversas que não cabem mais lado a lado.
  useEffect(() => {
    despachar({ tipo: "caber", cabem });
  }, [cabem, despachar]);

  // Ao abrir (ou voltar de minimizada), o foco vai para o título da janela.
  useEffect(() => {
    if (aVista) titulo.current?.focus({ preventScroll: true });
  }, [aVista]);

  const visiveis = useMemo(() => (lista ?? []).filter((c) => !escondidas.has(c.id)), [lista, escondidas]);
  const porId = useMemo(() => new Map(visiveis.map((c) => [c.id, c])), [visiveis]);
  const grupoPorId = useMemo(() => new Map(grupos.map((g) => [g.id, g])), [grupos]);
  const grupoDe = (id: string) => {
    const g = grupoDaJanela(id);
    return g ? (grupoPorId.get(g) ?? null) : null;
  };
  // As conversas abertas que ainda existem (apagada, escondida pelo modo viagem ou fora da lista: sai da janela). O grupo também.
  const abertas = estado.conversas.filter((c) => porId.has(c.id) || (comGrupos && !!tg && grupoDe(c.id) !== null));
  // No celular, uma coisa por vez: a conversa mais recente que não está minimizada, ou a lista.
  const daVez = cheia ? abertas.find((c) => !c.minimizada) ?? null : null;

  // Uma conversa fechada (ou o voltar do celular) tira da tela o botão que tinha o foco: o foco volta ao título da janela, e não
  // ao fim da página (o Esc e o Tab continuam funcionando dentro dela).
  const idDaVez = daVez?.id ?? null;
  const quantas = abertas.length;
  useEffect(() => {
    if (!aVista) return;
    const ativo = document.activeElement;
    if (!ativo || ativo === document.body) titulo.current?.focus({ preventScroll: true });
  }, [idDaVez, quantas, aVista]);

  const abrirConversa = (c: ConversaDoChat) => {
    if (c.situacao !== "aberta") return;
    setAviso("");
    despachar({ tipo: "abrirConversa", id: c.id, cabem });
  };

  async function comecar(e: React.FormEvent) {
    e.preventDefault();
    if (!t || !s || ocupado) return;
    const nome = semArroba(busca);
    if (!nome) return;
    const ja = visiveis.find((c) => c.com.handle === nome);
    if (ja) {
      setBusca("");
      if (ja.situacao === "aberta") abrirConversa(ja);
      else setAviso(ja.pedi ? t.lista.pedidoEnviado : preencher(t.lista.pedidoDe, { nome: ja.com.codinome }));
      return;
    }
    setOcupado(true);
    setAviso("");
    try {
      const c = await chat.abrir(nome);
      setBusca("");
      await recarregar();
      if (c.situacao === "aberta") despachar({ tipo: "abrirConversa", id: c.id, cabem });
      else setAviso(t.lista.pedidoEnviado);
    } catch (erro) {
      setAviso(erroDoChat(t, s, erro));
    } finally {
      setOcupado(false);
    }
  }

  async function responder(c: ConversaDoChat, aceitar: boolean) {
    if (!t || !s || ocupado) return;
    setOcupado(true);
    setAviso("");
    try {
      const r = await chat.responder(c.id, aceitar);
      await recarregar();
      if ("id" in r) despachar({ tipo: "abrirConversa", id: r.id, cabem });
    } catch (erro) {
      setAviso(erroDoChat(t, s, erro));
    } finally {
      setOcupado(false);
    }
  }

  async function ativar() {
    if (!t || !s || !sit || ocupado) return;
    setOcupado(true);
    setAviso("");
    try {
      const novo = await ativarNesteAparelho(sit.eu);
      setAparelho({ estado: "pronto", eu: novo });
      await recarregar();
    } catch (erro) {
      setAviso(erroDoChat(t, s, erro));
    } finally {
      setOcupado(false);
    }
  }

  // Esc minimiza o que tem o foco (a conversa, ou a janela). Quem tratou o Esc antes (o campo editando, um menu) já o segurou.
  const aoTeclar = (e: KeyboardEvent<HTMLElement>, conversa?: string) => {
    if (e.key === "Escape" && !e.defaultPrevented) {
      e.preventDefault();
      e.stopPropagation();
      if (conversa && !cheia) despachar({ tipo: "minimizarConversa", id: conversa });
      else aoMinimizar();
      return;
    }
    // Em tela cheia (celular), o foco fica preso na janela, como num diálogo.
    if (e.key === "Tab" && cheia && raiz.current) {
      const itens = focaveis(raiz.current);
      if (!itens.length) return;
      const [primeiro, ultimo] = [itens[0], itens[itens.length - 1]];
      if (e.shiftKey && (document.activeElement === primeiro || document.activeElement === titulo.current)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    }
  };

  const tj = t?.janela;
  const paginaDasConversas = `/${lang}/alumia/conversas`;
  // Expandir leva à página Conversas inteira, já na conversa aberta (o mesmo ?conversa= da carona), e minimiza a janela.
  const primeiraAberta = abertas.find((c) => !c.minimizada && !grupoDaJanela(c.id))?.id ?? null;
  const enderecoExpandido = primeiraAberta ? `${paginaDasConversas}?conversa=${encodeURIComponent(primeiraAberta)}` : paginaDasConversas;

  const botoesDaJanela = tj && (
    <div className="ml-auto flex shrink-0 items-center">
      <Link href={enderecoExpandido} className="al-cf-icone" aria-label={tj.expandir} title={tj.expandir} onClick={() => despachar({ tipo: "minimizar" })}>
        <Icone d={ICONE_EXPANDIR} />
      </Link>
      <button type="button" className="al-cf-icone" onClick={aoMinimizar} aria-label={tj.minimizar} title={tj.minimizar}>
        <Icone d={ICONE_MINIMIZAR} />
      </button>
      <button type="button" className="al-cf-icone" onClick={aoFechar} aria-label={tj.fechar} title={tj.fechar}>
        <Icone d={ICONE_FECHAR} />
      </button>
    </div>
  );

  const corpoDaLista = () => {
    if (!t || !s || !tj) return <EsqueletoDaLinha rotulo="…" quantos={3} />;
    if (aparelho.estado === "carregando") return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />;
    if (aparelho.estado === "fora") return <p className="px-4 py-6 text-ink-soft">{aparelho.texto}</p>;
    if (aparelho.estado === "erro")
      return aparelho.calmo ? <p role="status" className="px-4 py-6 text-ink-soft">{aparelho.texto}</p> : <p role="alert" className="px-4 py-6 text-oxblood">{aparelho.texto}</p>;
    if (aparelho.estado !== "pronto") {
      // O chat ainda não está neste aparelho: o convite claro, nunca um erro de chave. Ativar do zero aqui só quando a conta ainda
      // não tem chat; ligar pelo QR, restaurar a cópia ou começar do zero (com o aviso do risco) ficam na página Conversas.
      return (
        <div className="space-y-3 px-4 py-5">
          <h3 className="font-serif text-lg font-bold">{aparelho.estado === "sem_chave" ? t.ativar.titulo : aparelho.estado === "apagado" ? t.ativar.apagadoTitulo : t.ativar.outroTitulo}</h3>
          <p className="text-sm text-ink-soft">{aparelho.estado === "sem_chave" ? tj.ativarAqui : aparelho.estado === "apagado" ? t.ativar.apagadoTexto : tj.outroAparelho}</p>
          {aparelho.estado === "sem_chave" ? (
            <button type="button" disabled={ocupado || !sit} onClick={() => void ativar()} className={`${botaoForte} w-full`}>
              {t.ativar.botao}
            </button>
          ) : (
            <Link href={paginaDasConversas} className={`${botaoForte} inline-flex w-full items-center justify-center`} onClick={() => despachar({ tipo: "minimizar" })}>
              {tj.irParaConversas}
            </Link>
          )}
        </div>
      );
    }
    const termo = semArroba(busca);
    const pedidos = visiveis.filter((c) => c.situacao === "pedido" && !c.pedi);
    const resto = visiveis.filter((c) => !(c.situacao === "pedido" && !c.pedi));
    const achadas = termo ? resto.filter((c) => c.com.codinome.toLowerCase().includes(termo) || (c.com.handle ?? "").includes(termo)) : resto;
    const exata = termo !== "" && visiveis.some((c) => c.com.handle === termo);
    return (
      <>
        <form onSubmit={(e) => void comecar(e)} className="border-b border-rule px-3 py-3" role="search" aria-label={tj.buscar}>
          <label htmlFor={`${id}-busca`} className="text-sm font-semibold">
            {tj.buscar}
          </label>
          <input
            id={`${id}-busca`}
            value={busca}
            onChange={(e) => setBusca(e.target.value.replace(/\s/g, ""))}
            placeholder={tj.placeholder}
            aria-describedby={`${id}-dica`}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={40}
            className="mt-1 block min-h-11 w-full rounded-md border border-rule bg-paper px-3"
          />
          <p id={`${id}-dica`} className="mt-1 text-xs text-ink-soft">
            {tj.buscarDica}
          </p>
          {termo && !exata && (
            <button type="submit" disabled={ocupado} className={`${botaoForte} mt-2 w-full`}>
              {preencher(tj.comecar, { nome: termo })}
            </button>
          )}
        </form>
        {aviso && (
          <p role="status" className="border-b border-rule bg-parchment-deep px-3 py-2 text-sm">
            {aviso}
          </p>
        )}
        {comGrupos && tg && eu && (
          <ListaDeGrupos
            tg={tg}
            conta={eu.usuario}
            compacta
            termo={termo}
            abertos={abertas.map((a) => grupoDaJanela(a.id) ?? "")}
            aoListar={setGrupos}
            aoAbrir={(g) => {
              setAviso("");
              despachar({ tipo: "abrirConversa", id: `${PREFIXO_DO_GRUPO}${g.id}`, cabem });
            }}
          />
        )}
        {pedidos.length > 0 && !termo && (
          <div className="border-b border-rule px-3 py-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-soft">{t.lista.pedidos}</h3>
            <ul className="mt-2 space-y-3">
              {pedidos.map((c) => (
                <li key={c.id} className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Avatar usuario={c.com.id} imagem={c.com.avatar as ImagemDePerfil | null} codinome={c.com.codinome} tamanho={32} />
                    <p className="min-w-0 flex-1">{preencher(t.lista.pedidoDe, { nome: c.com.codinome })}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" disabled={ocupado} onClick={() => void responder(c, true)} className={`${botaoForte} flex-1`}>
                      {t.lista.aceitar}
                    </button>
                    <button type="button" disabled={ocupado} onClick={() => void responder(c, false)} className={`${botaoLeve} flex-1`}>
                      {t.lista.recusar}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        {lista === null ? (
          <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />
        ) : achadas.length === 0 ? (
          <p className="px-4 py-6 text-sm text-ink-soft">{termo ? tj.nadaNaBusca : tj.vazio}</p>
        ) : (
          <ul aria-label={t.lista.rotulo}>
            {achadas.map((c) => {
              const n = Math.max(naoLidas.get(c.id) ?? 0, c.nao_lidas);
              const aberta = abertas.some((x) => x.id === c.id);
              return (
                <li key={c.id} className="border-b border-rule">
                  <button
                    type="button"
                    disabled={c.situacao === "pedido"}
                    onClick={() => abrirConversa(c)}
                    aria-current={aberta ? "true" : undefined}
                    className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left hover:bg-parchment-deep disabled:cursor-default disabled:hover:bg-transparent aria-[current]:bg-parchment-deep"
                  >
                    <Avatar usuario={c.com.id} imagem={c.com.avatar as ImagemDePerfil | null} codinome={c.com.codinome} tamanho={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{c.com.codinome}</span>
                      <span className="block truncate text-xs text-ink-soft">{c.situacao === "pedido" ? t.lista.pedidoEnviado : c.com.handle ? `@${c.com.handle}` : ""}</span>
                    </span>
                    {n > 0 && <span className="rounded-full bg-[#c21f16] px-2 py-0.5 text-xs font-bold text-white">{preencher(t.lista.naoLidas, { n: String(n) })}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </>
    );
  };

  const oculta = !aVista;

  // ── Celular: tela inteira, uma coisa por vez ──
  if (cheia) {
    const conversa = daVez ? porId.get(daVez.id) : null;
    const grupo = daVez && !conversa ? grupoDe(daVez.id) : null;
    return (
      <div
        ref={raiz}
        className="al-cf al-cf-cheia no-print bg-parchment text-ink"
        role="dialog"
        aria-modal="true"
        aria-label={conversa && tj ? preencher(tj.conversaCom, { nome: conversa.com.codinome }) : grupo && tg ? preencher(tg.conversa.rotulo, { nome: grupo.nome }) : (tj?.rotulo ?? undefined)}
        hidden={oculta}
        onKeyDown={(e) => aoTeclar(e)}
        data-chat-flutuante
      >
        <div className="al-cf-barra border-b border-rule bg-paper">
          <h2 ref={titulo} id={`${id}-titulo`} tabIndex={-1} className="min-w-0 truncate pl-1 font-serif text-lg font-bold outline-none">
            {tj?.rotulo ?? "…"}
          </h2>
          {botoesDaJanela}
        </div>
        <div className="al-cf-corpo">
          {conversa && t && s && eu ? (
            <div className="al-cf-conversa">
              <Conversa
                lang={lang}
                t={t}
                s={s}
                eu={eu}
                conversa={conversa}
                idDoCampo={`${id}-texto-${conversa.id}`}
                aoVoltar={() => despachar({ tipo: "fecharConversa", id: conversa.id })}
                aoApagar={() => {
                  despachar({ tipo: "fecharConversa", id: conversa.id });
                  void recarregar().catch(() => undefined);
                }}
              />
            </div>
          ) : grupo && tg && eu && daVez ? (
            <div className="al-cf-conversa">
              <ConversaDoGrupo lang={lang} tg={tg} conta={eu.usuario} grupo={grupo} idDoCampo={`${id}-texto-${daVez.id}`} aoVoltar={() => despachar({ tipo: "fecharConversa", id: daVez.id })} />
            </div>
          ) : (
            corpoDaLista()
          )}
        </div>
      </div>
    );
  }

  // ── Computador: a lista no canto e as conversas ao lado ──
  return (
    <div ref={raiz} className="al-cf no-print" hidden={oculta} data-chat-flutuante>
      <section className="al-cf-painel bg-parchment text-ink" role="region" aria-labelledby={`${id}-titulo`} onKeyDown={(e) => aoTeclar(e)} data-chat-flutuante-lista>
        <div className="al-cf-barra border-b border-rule bg-paper">
          <h2 ref={titulo} id={`${id}-titulo`} tabIndex={-1} className="min-w-0 truncate pl-1 font-serif text-lg font-bold outline-none">
            {tj?.rotulo ?? "…"}
          </h2>
          {botoesDaJanela}
        </div>
        <div className="al-cf-corpo">{corpoDaLista()}</div>
      </section>
      {t && s && eu && tj &&
        abertas.map((a) => {
          const g = grupoDe(a.id);
          if (g && tg) {
            const nome = g.nome;
            const rotulo = preencher(tg.conversa.rotulo, { nome });
            return (
              <section
                key={a.id}
                className="al-cf-painel al-cf-painel-conversa bg-parchment text-ink"
                data-minimizada={a.minimizada ? "" : undefined}
                role="region"
                aria-label={rotulo}
                onKeyDown={(e) => aoTeclar(e, a.id)}
                data-chat-flutuante-conversa
              >
                <div className="al-cf-barra border-b border-rule bg-paper">
                  <button
                    type="button"
                    className="flex min-h-11 min-w-0 flex-1 items-center gap-2 pl-1 text-left font-semibold"
                    aria-expanded={!a.minimizada}
                    aria-label={preencher(a.minimizada ? tj.restaurarConversa : tj.minimizarConversa, { nome: rotulo })}
                    onClick={() => despachar(a.minimizada ? { tipo: "restaurarConversa", id: a.id, cabem } : { tipo: "minimizarConversa", id: a.id })}
                  >
                    <span className="truncate">{nome}</span>
                  </button>
                  {!a.minimizada && (
                    <button type="button" className="al-cf-icone" onClick={() => despachar({ tipo: "minimizarConversa", id: a.id })} aria-label={preencher(tj.minimizarConversa, { nome: rotulo })} title={preencher(tj.minimizarConversa, { nome: rotulo })}>
                      <Icone d={ICONE_MINIMIZAR} />
                    </button>
                  )}
                  <button type="button" className="al-cf-icone" onClick={() => despachar({ tipo: "fecharConversa", id: a.id })} aria-label={preencher(tj.fecharConversa, { nome: rotulo })} title={preencher(tj.fecharConversa, { nome: rotulo })}>
                    <Icone d={ICONE_FECHAR} />
                  </button>
                </div>
                {/* Minimizado, o grupo continua montado (o rascunho não se perde); só o corpo sai de vista. */}
                <div className="al-cf-corpo al-cf-conversa" hidden={a.minimizada}>
                  <ConversaDoGrupo lang={lang} tg={tg} conta={eu.usuario} grupo={g} compacta idDoCampo={`${id}-texto-${a.id}`} aoVoltar={() => despachar({ tipo: "fecharConversa", id: a.id })} />
                </div>
              </section>
            );
          }
          const c = porId.get(a.id) as ConversaDoChat;
          const nome = c.com.codinome;
          return (
            <section
              key={a.id}
              className="al-cf-painel al-cf-painel-conversa bg-parchment text-ink"
              data-minimizada={a.minimizada ? "" : undefined}
              role="region"
              aria-label={preencher(tj.conversaCom, { nome })}
              onKeyDown={(e) => aoTeclar(e, a.id)}
              data-chat-flutuante-conversa
            >
              <div className="al-cf-barra border-b border-rule bg-paper">
                <button
                  type="button"
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-2 pl-1 text-left font-semibold"
                  aria-expanded={!a.minimizada}
                  aria-label={preencher(a.minimizada ? tj.restaurarConversa : tj.minimizarConversa, { nome })}
                  onClick={() => despachar(a.minimizada ? { tipo: "restaurarConversa", id: a.id, cabem } : { tipo: "minimizarConversa", id: a.id })}
                >
                  <Avatar usuario={c.com.id} imagem={c.com.avatar as ImagemDePerfil | null} codinome={nome} tamanho={28} />
                  <span className="truncate">{nome}</span>
                </button>
                {!a.minimizada && (
                  <button type="button" className="al-cf-icone" onClick={() => despachar({ tipo: "minimizarConversa", id: a.id })} aria-label={preencher(tj.minimizarConversa, { nome })} title={preencher(tj.minimizarConversa, { nome })}>
                    <Icone d={ICONE_MINIMIZAR} />
                  </button>
                )}
                <button type="button" className="al-cf-icone" onClick={() => despachar({ tipo: "fecharConversa", id: a.id })} aria-label={preencher(tj.fecharConversa, { nome })} title={preencher(tj.fecharConversa, { nome })}>
                  <Icone d={ICONE_FECHAR} />
                </button>
              </div>
              {/* Minimizada, a conversa continua montada (o rascunho não se perde); só o corpo sai de vista. */}
              <div className="al-cf-corpo al-cf-conversa" hidden={a.minimizada}>
                <Conversa
                  lang={lang}
                  t={t}
                  s={s}
                  eu={eu}
                  conversa={c}
                  idDoCampo={`${id}-texto-${a.id}`}
                  aoVoltar={() => despachar({ tipo: "fecharConversa", id: a.id })}
                  aoApagar={() => {
                    despachar({ tipo: "fecharConversa", id: a.id });
                    void recarregar().catch(() => undefined);
                  }}
                />
              </div>
            </section>
          );
        })}
    </div>
  );
}
