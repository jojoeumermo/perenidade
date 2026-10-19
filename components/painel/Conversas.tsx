// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { leads, manages, rpc, type Me } from "@/lib/backend";
import { buscar, desindexar, indexar, type Indexada } from "@/lib/busca-local";
import type { Chaveiro } from "@/lib/chaveiro";
import { type Citacao, type Conteudo, desempacotar, empacotar, type Enquete, type Evento, extrairMencoes, linksDe, previaDoLink, reacoes, type Rsvp, semFormatacao, trechoDe } from "@/lib/mensagem";
import { conversaDestravada, destravar, estaDestravado, travaDisponivel, travaLigada } from "@/lib/trava";
import { contextoDaConversa } from "@/lib/sigilo";
import { getItem, setItem } from "@/lib/storage";
import { useI18n } from "../I18n";
import { Aviso, botao, botaoClaro, campo, dataHora, elo, localDoPainel, papeis, rotulo, textoDoErro, useLista } from "./comum";
import { Avatar } from "./Avatar";
import type { Membro } from "./Equipe";
import { Formatado } from "./Formatado";
import { AnexoVisto, type EstadoDoAnexo, Galeria, Gravador, type ItemDaGaleria, Preparados, type Preparado, preparar, soltar, subir } from "./Anexos";
import { Alertas, AparelhoPendente, Aparelhos, ComoFunciona, enviarCifrado, Seguranca, TextoAberto, useAbertos, useChaveiro } from "./Sigilo";

type Tipo = "direta" | "grupo" | "departamento";

interface Conversa {
  id: string;
  tipo: Tipo;
  /** Nos grupos de departamento: a função ("design") ou "geral", a equipe toda. */
  departamento: string | null;
  nome: string;
  /** Fui eu que criei o grupo. */
  dona: boolean;
  /** Nas conversas privadas: a outra pessoa. */
  outro: string | null;
  online: boolean | null;
  visto_em: string | null;
  membros: number;
  apagar_apos: number | null;
  ultima: { corpo: string; minha: boolean; autor: string; autor_id: string | null; criado_em: string } | null;
  nao_lidas: number;
  /** O que eu fiz com a conversa (vale em todos os meus aparelhos; os outros não veem). */
  fixada: boolean;
  arquivada: boolean;
  silenciada: boolean;
  marcada_nao_lida: boolean;
  trancada: boolean;
  descricao: string;
  /** A mensagem com a foto do grupo, cifrada como as outras. */
  foto: { id: string; corpo: string; autor: string | null; criado_em: string } | null;
  /** Fechada pela coordenação por enquanto (ninguém escreve; ler pode). */
  fechada?: boolean;
}

interface Mensagem {
  id: string;
  autor: string | null;
  nome: string;
  minha: boolean;
  corpo: string;
  criado_em: string;
  /** Com a autodestruição ligada, quando a mensagem some. */
  expira_em: string | null;
  /** Texto, ou uma reação ou edição de outra mensagem ("alvo"). */
  tipo: "texto" | "reacao" | "edicao" | "sistema" | "voto" | "rsvp";
  alvo: string | null;
  /** O que o banco sabe dos arquivos: ver uma vez já aberto, bytes ainda disponíveis. O resto vai dentro do cifrado. */
  anexos: EstadoDoAnexo[];
  /** Aviso do sistema: quem fez o quê (o banco escreve; não é cifrado). */
  detalhe: { evento: string; por: string; alvo: string | null; alvo_nome: string; texto: string } | null;
}

interface MembroDaConversa {
  id: string;
  nome: string;
  avatar?: string;
  eu: boolean;
  /** Nulo quando a pessoa (ou eu) esconde o "visto por último". */
  online: boolean | null;
  visto_em: string | null;
  /** Nulo quando a pessoa (ou eu) desligou a confirmação de leitura. */
  lido_em: string | null;
  recebido_em: string;
  digitando: "" | "texto" | "audio";
  admin: boolean;
}

interface Aberta {
  id: string;
  tipo: Tipo;
  departamento: string | null;
  nome: string;
  /** Posso mudar o grupo (criei, ou sou da coordenação). */
  dona: boolean;
  apagar_apos: number | null;
  apagar_desde: string | null;
  apagar_por: string;
  descricao: string;
  foto: string | null;
  so_admins_enviam: boolean;
  so_admins_mudam: boolean;
  /** Administro este grupo (ou sou da coordenação). */
  admin: boolean;
  posso_enviar: boolean;
  /** Por que não posso enviar, quando foi a coordenação: "chat_fechado" ou "silenciado". */
  barrado?: string | null;
  motivo_do_fechamento?: string;
  membros: MembroDaConversa[];
  fixadas: string[];
  favoritas: string[];
  mensagens: Mensagem[];
}

const MAXIMO = 2000;
/** Até quando uma mensagem pode ser editada. */
const EDITAVEL_POR = 15 * 60 * 1000;
const prazos: { segundos: number; nome: string }[] = [
  { segundos: 0, nome: "Desligada" },
  { segundos: 3600, nome: "1 hora" },
  { segundos: 86400, nome: "1 dia" },
  { segundos: 604800, nome: "7 dias" },
];
const nomeDoPrazo = (segundos: number | null) => prazos.find((prazo) => prazo.segundos === (segundos ?? 0))?.nome ?? "";

const iniciais = (nome: string) =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("") || "?";

const hora = (iso: string) => new Date(iso).toLocaleTimeString(localDoPainel(), { hour: "2-digit", minute: "2-digit" });
const diaDe = (iso: string) => new Date(iso).toLocaleDateString(localDoPainel(), { weekday: "long", day: "2-digit", month: "long" });

/** "some em 40 min", "some em 5 h", "some em 3 dias". */
function restante(iso: string) {
  const minutos = Math.max(1, Math.round((new Date(iso).getTime() - Date.now()) / 60000));
  if (minutos < 60) return `some em ${minutos} min`;
  if (minutos < 60 * 24) return `some em ${Math.round(minutos / 60)} h`;
  return `some em ${Math.round(minutos / 1440)} dias`;
}

/** "online", "visto por último há 12 min", "visto por último ontem às 21:40"… Vazio quando a pessoa esconde. */
function presenca(online: boolean | null, visto: string | null) {
  if (online) return "online";
  if (!visto) return "";
  const quando = new Date(visto);
  const minutos = Math.round((Date.now() - quando.getTime()) / 60000);
  if (minutos < 60) return `visto por último há ${Math.max(minutos, 2)} min`;
  const hoje = new Date();
  const ontem = new Date(Date.now() - 86400000);
  if (quando.toDateString() === hoje.toDateString()) return `visto por último hoje às ${hora(visto)}`;
  if (quando.toDateString() === ontem.toDateString()) return `visto por último ontem às ${hora(visto)}`;
  return `visto por último em ${quando.toLocaleDateString(localDoPainel(), { day: "2-digit", month: "2-digit" })}`;
}

function Rosto({ nome, online = false, tipo = "direta", avatar }: { nome: string; online?: boolean; tipo?: Tipo; avatar?: string | null }) {
  if (tipo === "direta" && avatar) {
    return (
      <span className="relative shrink-0">
        <Avatar nome={nome} avatar={avatar} className="h-10 w-10" />
        {online && <span title="online" className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-parchment-deep bg-ok" />}
      </span>
    );
  }
  return (
    <span className="relative shrink-0">
      <span aria-hidden className={`flex h-10 w-10 items-center justify-center font-semibold ${tipo === "departamento" ? "bg-oxblood text-parchment" : tipo === "grupo" ? "border-2 border-ink text-ink" : "bg-ink text-parchment"}`}>
        {tipo === "direta" ? iniciais(nome) : "#"}
      </span>
      {online && <span title="online" className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-parchment bg-ok" />}
    </span>
  );
}

/** Chama "recarregar" de tempos em tempos, só com a aba do navegador à vista. */
function useRelogio(recarregar: () => void, intervalo: number) {
  useEffect(() => {
    const relogio = window.setInterval(() => {
      if (document.visibilityState === "visible") recarregar();
    }, intervalo);
    return () => window.clearInterval(relogio);
  }, [recarregar, intervalo]);
}

/** O rascunho de cada conversa fica só neste aparelho. */
const chaveDoRascunho = (conversa: string) => `lucia:rascunho:${conversa}`;

/**
 * As conversas da equipe: privadas, em grupo e os grupos fixos de cada departamento. Só quem participa de uma conversa a vê.
 * Tudo é cifrado de ponta a ponta neste aparelho antes de ser enviado, e some depois de trinta dias (ou antes, com a autodestruição).
 */
export function Conversas({ me }: { me: Me }) {
  const { chaveiro, erro } = useChaveiro(me.id);
  const lista = useLista<Conversa[]>("chat_conversas");
  const membros = useLista<Membro[]>("equipe_membros");
  const [aberta, setAberta] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [tela, setTela] = useState<"conversa" | "grupo" | "favoritas" | "relatos" | "privadas">("conversa");
  const [filtro, setFiltro] = useState<"todas" | "nao_lidas" | "pessoas" | "grupos" | "fixadas">("todas");
  const [arquivadas, setArquivadas] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [achadas, setAchadas] = useState<Indexada[]>([]);
  const [aviso, setAviso] = useState("");
  const [trava, setTrava] = useState<"conferindo" | "travada" | "aberta">(() => (travaLigada() && !estaDestravado() ? "travada" : "aberta"));
  const [pedindoTrava, setPedindoTrava] = useState<string | null>(null);
  useRelogio(lista.recarregar, 8000);
  useRelogio(membros.recarregar, 30000);
  // Busca no índice deste aparelho: só o que ele já abriu.
  useEffect(() => {
    const termoDeBusca = busca.trim();
    let cancelado = false;
    const marca = window.setTimeout(() => { if (termoDeBusca.length < 2) { setAchadas([]); return; } void buscar(termoDeBusca).then((itens) => { if (!cancelado) setAchadas(itens); }); }, 200);
    return () => { cancelado = true; window.clearTimeout(marca); };
  }, [busca]);
  const previas = useAbertos(
    chaveiro,
    (lista.dados ?? []).flatMap((conversa) =>
      conversa.ultima ? [{ id: `${conversa.id}:${conversa.ultima.criado_em}`, conversa: conversa.id, corpo: conversa.ultima.corpo, contexto: contextoDaConversa(conversa.id, conversa.ultima.autor_id ?? ""), autor: conversa.ultima.autor_id }] : [],
    ),
  );

  if (erro) return <Aviso texto={erro} />;
  if (!chaveiro) return <Aviso texto="Preparando a chave deste aparelho…" />;
  // Aparelho ainda não aprovado: nada abre aqui até um aparelho já aprovado da pessoa conferir o código.
  if (chaveiro.estado !== "aprovado") return <div className="border border-rule bg-parchment"><AparelhoPendente chaveiro={chaveiro} /></div>;
  if (trava !== "aberta") {
    return (
      <div className="border border-rule bg-parchment p-8 text-center">
        <p className="font-serif text-2xl font-semibold">Conversas trancadas</p>
        <p className="mx-auto mt-2 max-w-md text-ink-soft">Você pediu a digital para abrir as conversas neste aparelho. Confirme no leitor do aparelho para continuar.</p>
        <button type="button" className={`mt-4 ${botao}`} disabled={trava === "conferindo"} onClick={() => { setTrava("conferindo"); void destravar().then((ok) => setTrava(ok ? "aberta" : "travada")); }}>
          {trava === "conferindo" ? "Conferindo…" : "Destravar com a digital"}
        </button>
      </div>
    );
  }

  const termo = busca.trim().toLowerCase();
  const conversas = (lista.dados ?? []).filter((conversa) => {
    if (termo) return conversa.nome.toLowerCase().includes(termo);
    if (conversa.arquivada !== arquivadas) return false;
    if (filtro === "nao_lidas") return conversa.nao_lidas > 0 || conversa.marcada_nao_lida;
    if (filtro === "pessoas") return conversa.tipo === "direta";
    if (filtro === "grupos") return conversa.tipo !== "direta";
    if (filtro === "fixadas") return conversa.fixada;
    return true;
  });
  const quantasArquivadas = (lista.dados ?? []).filter((conversa) => conversa.arquivada).length;

  /** Abrir uma conversa trancada pede a digital (uma vez por alguns minutos). */
  async function abrirConversa(conversa: Conversa) {
    setTela("conversa");
    if (conversa.trancada && !conversaDestravada(conversa.id)) {
      setPedindoTrava(conversa.id);
      const ok = await destravar(conversa.id);
      setPedindoTrava(null);
      if (!ok) { setAviso("A digital não foi confirmada: a conversa continua trancada."); return; }
    }
    setAberta(conversa.id);
  }

  async function marcar(conversa: Conversa, campos: Record<string, unknown>) {
    setMenu(null);
    setAviso("");
    try {
      if (campos.p_trancar === true && !(await travaDisponivel())) { setAviso("Este aparelho não tem digital cadastrada: cadastre em Minha conta → Entrar com a digital."); return; }
      await rpc("chat_conversa_marcar", { p_id: conversa.id, ...campos });
      lista.recarregar();
    } catch (erro) {
      setAviso(textoDoErro(erro));
    }
  }
  const comConversa = new Set((lista.dados ?? []).flatMap((conversa) => (conversa.outro ? [conversa.outro] : [])));
  // Privado só para trabalho: a lista traz só com quem o servidor deixa abrir (liderança ou colaboração em andamento).
  const pessoas = (membros.dados ?? []).filter((membro) => !membro.eu && membro.privado && (termo ? membro.nome.toLowerCase().includes(termo) : !comConversa.has(membro.id)));
  const aberto = tela !== "conversa" || aberta !== null;

  async function conversarCom(usuario: string) {
    setAviso("");
    try {
      const { id } = await rpc<{ id: string }>("chat_direta", { p_usuario: usuario });
      setBusca("");
      setTela("conversa");
      setAberta(id);
      lista.recarregar();
    } catch (erro) {
      setAviso(textoDoErro(erro));
    }
  }

  /** A última mensagem, aberta: o texto sem formatação e, se me mencionou, a marca. */
  function previa(conversa: Conversa): { texto: string; mencao: boolean } {
    if (!conversa.ultima) return { texto: conversa.tipo === "direta" ? "Nenhuma mensagem ainda" : `${conversa.membros} pessoas`, mencao: false };
    const quem = conversa.ultima.minha ? "Você: " : conversa.tipo !== "direta" ? `${conversa.ultima.autor.split(" ")[0]}: ` : "";
    const aberta = previas[`${conversa.id}:${conversa.ultima.criado_em}`];
    if (!aberta) return { texto: `${quem}${conversa.ultima.corpo.startsWith("c1.") ? "mensagem antiga" : "…"}`, mencao: false };
    const conteudo = desempacotar(aberta.texto);
    const arquivo = conteudo.anexos?.length ? `${{ imagem: "🖼 Foto", video: "🎞 Vídeo", audio: "🎙 Áudio", pdf: "📄 PDF", docx: "📝 Documento" }[conteudo.anexos[0].tipo]}${conteudo.anexos.length > 1 ? ` +${conteudo.anexos.length - 1}` : ""}${conteudo.texto ? " · " : ""}` : "";
    const especial = conteudo.enquete ? `📊 Enquete: ${conteudo.enquete.pergunta}` : conteudo.evento ? `📅 Evento: ${conteudo.evento.titulo}` : conteudo.grupo_foto ? "🖼 Foto do grupo" : "";
    return { texto: `${quem}${conteudo.encaminhada ? "↪ " : ""}${arquivo}${especial || semFormatacao(conteudo.texto)}`, mencao: Boolean(conteudo.mencoes?.includes(me.id)) && !conversa.ultima.minha };
  }

  return (
    <div className="grid h-[calc(100dvh-16.5rem)] min-h-[18rem] lg:min-h-[24rem] border border-rule lg:h-[calc(100dvh-12.5rem)] lg:grid-cols-[19rem_minmax(0,1fr)]">
      <aside className={`flex min-h-0 flex-col border-rule bg-parchment-deep lg:border-r ${aberto ? "hidden lg:flex" : "flex"}`}>
        <div className="space-y-2 border-b border-rule p-3">
          <input value={busca} onChange={(e) => setBusca(e.target.value)} type="search" placeholder="Procurar pessoa ou conversa" aria-label="Procurar pessoa ou conversa" className={`${campo} mt-0 bg-parchment`} />
          <div className="flex gap-2">
            <button type="button" className={`${botaoClaro} flex-1 py-1.5`} onClick={() => { setTela("grupo"); setAberta(null); }}>
              Novo grupo
            </button>
            <button type="button" className={`${botaoClaro} py-1.5`} aria-pressed={tela === "favoritas"} onClick={() => { setTela("favoritas"); setAberta(null); }} title="Mensagens favoritas">
              ★
            </button>
            {manages(me) && (
              <button type="button" className={`${botaoClaro} py-1.5`} aria-pressed={tela === "relatos"} onClick={() => { setTela("relatos"); setAberta(null); }} title="Relatos à coordenação">
                ⚑
              </button>
            )}
            {leads(me) && (
              <button type="button" className={`${botaoClaro} py-1.5`} aria-pressed={tela === "privadas"} onClick={() => { setTela("privadas"); setAberta(null); }} title="Quem está em conversa privada">
                👥
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1 text-xs" role="group" aria-label="Filtrar conversas">
            {([["todas", "Todas"], ["nao_lidas", "Não lidas"], ["pessoas", "Pessoas"], ["grupos", "Grupos"], ["fixadas", "Fixadas"]] as const).map(([valor, nome]) => (
              <button key={valor} type="button" aria-pressed={filtro === valor} onClick={() => { setFiltro(valor); setArquivadas(false); }} className={`cursor-pointer border px-2 py-0.5 ${filtro === valor && !arquivadas ? "border-ink bg-ink text-parchment" : "border-rule hover:border-ink"}`}>
                {nome}
              </button>
            ))}
            {quantasArquivadas > 0 && (
              <button type="button" aria-pressed={arquivadas} onClick={() => setArquivadas(!arquivadas)} className={`cursor-pointer border px-2 py-0.5 ${arquivadas ? "border-ink bg-ink text-parchment" : "border-rule hover:border-ink"}`}>
                Arquivadas ({quantasArquivadas})
              </button>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
          {(lista.erro || membros.erro || aviso) && <Aviso texto={lista.erro || membros.erro || aviso} />}
          <ul>
            {conversas.map((conversa) => {
              const ultima = previa(conversa);
              const pendentes = conversa.nao_lidas > 0 || conversa.marcada_nao_lida;
              return (
                <li key={conversa.id} className="relative">
                  <button
                    type="button"
                    onClick={() => void abrirConversa(conversa)}
                    onContextMenu={(e) => { e.preventDefault(); setMenu(menu === conversa.id ? null : conversa.id); }}
                    aria-current={aberta === conversa.id ? "true" : undefined}
                    className={`flex w-full cursor-pointer items-center gap-3 border-b border-rule px-3 py-2.5 pr-9 text-left ${aberta === conversa.id ? "bg-parchment" : "hover:bg-parchment"}`}
                  >
                    {conversa.foto ? <FotoDoGrupo chaveiro={chaveiro} conversa={conversa.id} foto={conversa.foto} nome={conversa.nome} /> : <Rosto nome={conversa.nome} online={Boolean(conversa.online)} tipo={conversa.tipo} />}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-semibold">
                          {conversa.trancada && <span title="Trancada com a digital" className="mr-1 font-normal text-ink-soft">🔒</span>}
                          {conversa.nome}
                          {conversa.apagar_apos && <span title={`Autodestruição: ${nomeDoPrazo(conversa.apagar_apos)}`} className="ml-1 font-normal text-ink-soft">⏱</span>}
                          {conversa.fechada && <span title="Fechada pela coordenação por enquanto" className="ml-1 font-normal text-ink-soft">⛔</span>}
                          {conversa.silenciada && <span title="Silenciada" className="ml-1 font-normal text-ink-soft">🔕</span>}
                        </span>
                        <span className="flex shrink-0 items-center gap-1 text-xs text-ink-soft">
                          {conversa.fixada && <span title="Fixada no alto" aria-label="Fixada">📌</span>}
                          {conversa.ultima && <span>{hora(conversa.ultima.criado_em)}</span>}
                        </span>
                      </span>
                      <span className="flex items-center justify-between gap-2">
                        <span className={`truncate ${ultima.mencao ? "font-semibold text-ink" : "text-ink-soft"}`}>{pedindoTrava === conversa.id ? "Confirme a digital…" : ultima.texto}</span>
                        <span className="flex shrink-0 gap-1">
                          {ultima.mencao && <span title="Você foi mencionado" className="bg-gold px-1.5 py-0.5 font-mono text-[0.7rem] font-semibold leading-none text-ink">@</span>}
                          {pendentes && <span className={`px-1.5 py-0.5 font-mono text-[0.7rem] font-semibold leading-none ${conversa.silenciada ? "bg-rule text-ink" : "bg-oxblood text-parchment"}`}>{conversa.nao_lidas || "•"}</span>}
                        </span>
                      </span>
                    </span>
                  </button>
                  <button type="button" aria-label={`Opções da conversa ${conversa.nome}`} aria-expanded={menu === conversa.id} className="absolute right-1 top-2 cursor-pointer px-2 py-1 text-ink-soft hover:text-ink" onClick={() => setMenu(menu === conversa.id ? null : conversa.id)}>⋯</button>
                  {menu === conversa.id && (
                    <ul role="menu" className="absolute right-2 top-9 z-20 w-56 border-2 border-ink bg-parchment text-sm shadow">
                      {([
                        [conversa.fixada ? "Desafixar" : "Fixar no alto", { p_fixar: !conversa.fixada }],
                        [conversa.arquivada ? "Desarquivar" : "Arquivar", { p_arquivar: !conversa.arquivada }],
                        [conversa.marcada_nao_lida || conversa.nao_lidas > 0 ? "Marcar como lida" : "Marcar como não lida", conversa.marcada_nao_lida || conversa.nao_lidas > 0 ? { p_nao_lida: false, __ler: true } : { p_nao_lida: true }],
                        [conversa.silenciada ? "Tirar o silêncio" : "Silenciar por 8 horas", { p_silenciar_horas: conversa.silenciada ? 0 : 8 }],
                        ...(conversa.silenciada ? [] : [["Silenciar por 7 dias", { p_silenciar_horas: 168 }] as const, ["Silenciar para sempre", { p_silenciar_horas: 876000 }] as const]),
                        [conversa.trancada ? "Destrancar" : "Trancar com a digital", { p_trancar: !conversa.trancada }],
                      ] as [string, Record<string, unknown>][]).map(([nome, campos]) => (
                        <li key={nome}>
                          <button type="button" role="menuitem" className="block w-full cursor-pointer px-3 py-1.5 text-left hover:bg-parchment-deep" onClick={() => {
                            if (campos.__ler) { setMenu(null); void rpc("chat_ver", { p_id: conversa.id }).then(() => lista.recarregar()).catch(() => undefined); return; }
                            void marcar(conversa, campos);
                          }}>{nome}</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
          {achadas.length > 0 && (
            <>
              <p className={`${rotulo} px-3 pb-1 pt-4`}>Mensagens (só o que este aparelho já abriu)</p>
              <ul>
                {achadas.map((item) => (
                  <li key={item.id}>
                    <button type="button" className="block w-full cursor-pointer border-b border-rule px-3 py-2 text-left hover:bg-parchment" onClick={() => { const conversa = lista.dados?.find((c) => c.id === item.conversa); if (conversa) void abrirConversa(conversa).then(() => window.setTimeout(() => document.getElementById(`m-${item.id}`)?.scrollIntoView({ block: "center" }), 600)); }}>
                      <span className="block truncate text-xs text-ink-soft">{item.conversa_nome} · {item.autor} · {new Date(item.criado_em).toLocaleDateString("pt-BR")}</span>
                      <span className="block truncate">{item.texto}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {pessoas.length > 0 && (
            <>
              <p className={`${rotulo} px-3 pb-1 pt-4`}>{termo ? "Pessoas" : "Conversa de trabalho"}</p>
              <p className="px-3 pb-1 text-xs text-ink-soft">Privado só com a liderança ou com quem colabora com você numa contribuição. O resto é nos grupos.</p>
              <ul>
                {pessoas.map((membro) => (
                  <li key={membro.id}>
                    <button type="button" onClick={() => void conversarCom(membro.id)} className="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left hover:bg-parchment">
                      <Rosto nome={membro.nome} online={Boolean(membro.online)} avatar={membro.avatar} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{membro.nome}</span>
                        <span className="block truncate text-xs text-ink-soft">{presenca(membro.online, membro.visto_em)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {termo && conversas.length === 0 && pessoas.length === 0 && achadas.length === 0 && <p className="px-3 py-4 text-ink-soft">Nada com esse nome: nem pessoa, nem conversa, nem mensagem já aberta aqui.</p>}
          {!termo && conversas.length === 0 && filtro !== "todas" && <p className="px-3 py-4 text-ink-soft">Nenhuma conversa neste filtro.</p>}
        </div>
        {/* A lista de aparelhos cresce (aprovação, cópia de recuperação): rola dentro do próprio pé, sem empurrar a tela. */}
        <div className="max-h-[60%] space-y-2 overflow-y-auto border-t border-rule p-3 [scrollbar-width:thin]">
          <ComoFunciona />
          <Aparelhos chaveiro={chaveiro} />
        </div>
      </aside>

      <section className={`min-h-0 min-w-0 flex-col bg-parchment ${aberto ? "flex" : "hidden lg:flex"}`}>
        {tela === "grupo" ? (
          <NovoGrupo membros={membros.dados ?? []} fechar={() => setTela("conversa")} criado={(id) => { setTela("conversa"); setAberta(id); lista.recarregar(); }} />
        ) : tela === "favoritas" ? (
          <Favoritas chaveiro={chaveiro} fechar={() => setTela("conversa")} abrir={(id) => { setTela("conversa"); setAberta(id); }} />
        ) : tela === "relatos" ? (
          <Relatos fechar={() => setTela("conversa")} />
        ) : tela === "privadas" ? (
          <Privadas fechar={() => setTela("conversa")} />
        ) : aberta ? (
          <Janela
            key={aberta}
            id={aberta}
            chaveiro={chaveiro}
            me={me}
            equipe={membros.dados ?? []}
            conversas={lista.dados ?? []}
            resumo={lista.dados?.find((conversa) => conversa.id === aberta)}
            voltar={() => { setAberta(null); lista.recarregar(); }}
            mudou={lista.recarregar}
          />
        ) : (
          <div className="m-auto max-w-sm px-6 text-center text-ink-soft">
            <p className="font-serif text-2xl font-semibold text-ink">Conversas da equipe</p>
            <p className="mt-2">Escolha uma conversa, procure uma pessoa pelo nome ou crie um grupo. Cada função tem o próprio grupo, e quem tem a função já está nele. Só quem participa de uma conversa consegue vê-la.</p>
            <p className="mt-2 text-xs">Cifrado de ponta a ponta neste aparelho · some em 30 dias</p>
          </div>
        )}
      </section>
    </div>
  );
}

/** O que a tela mostra de uma mensagem de texto: o conteúdo aberto (já com a última edição), as reações e a autoria. */
interface Vista {
  mensagem: Mensagem;
  conteudo: Conteudo | null;
  autoria: "ok" | "invalida" | "sem_assinatura" | "sem_identidade" | "esperando";
  editada: boolean;
  /** emoji → quem reagiu (com o id da reação, para a própria pessoa desfazer). */
  reacoes: { emoji: string; quem: { id: string; autor: string | null; nome: string; minha: boolean }[] }[];
  /** Enquete: quem votou em quê. Evento: quem respondeu o quê. */
  votos: { autor: string | null; nome: string; minha: boolean; opcoes: number[] }[];
  rsvps: { autor: string | null; nome: string; minha: boolean; resposta: Rsvp }[];
}

/** Uma conversa aberta: as mensagens, quem está por aqui, a autodestruição e a caixa de escrever. */
function Janela({ id, chaveiro, me, equipe, conversas, resumo, voltar, mudou }: { id: string; chaveiro: Chaveiro; me: Me; equipe: Membro[]; conversas: Conversa[]; resumo?: Conversa; voltar: () => void; mudou: () => void }) {
  const conversa = useLista<Aberta>("chat_ver", { p_id: id });
  const { recarregar } = conversa;
  const [texto, setTexto] = useState(() => getItem(chaveDoRascunho(id)));
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [gerir, setGerir] = useState(false);
  const [citando, setCitando] = useState<Citacao | null>(null);
  const [editando, setEditando] = useState<Mensagem | null>(null);
  const [reagindo, setReagindo] = useState<string | null>(null);
  const [quemReagiu, setQuemReagiu] = useState<string | null>(null);
  const [lidaPor, setLidaPor] = useState<string | null>(null);
  const [selecionadas, setSelecionadas] = useState<Set<string> | null>(null);
  const [encaminhando, setEncaminhando] = useState<string[] | null>(null);
  const [destacada, setDestacada] = useState<string | null>(null);
  const [seguranca, setSeguranca] = useState<{ usuario: string; nome: string } | null>(null);
  const [sugestao, setSugestao] = useState<{ inicio: number; termo: string } | null>(null);
  const [preparados, setPreparados] = useState<Preparado[]>([]);
  const [gravando, setGravando] = useState(false);
  const [galeria, setGaleria] = useState(false);
  const [andamento, setAndamento] = useState("");
  const [arrastando, setArrastando] = useState(false);
  const [compondo, setCompondo] = useState<"enquete" | "evento" | "relato" | null>(null);
  const caixa = useRef<HTMLTextAreaElement>(null);
  const escolha = useRef<HTMLInputElement>(null);
  const fim = useRef<HTMLDivElement>(null);
  const ultimoAvisoDeDigitando = useRef(0);
  const ultimoRecebido = useRef("");
  useRelogio(recarregar, 3000);
  useEffect(() => () => soltar(preparados), [preparados]);
  const dados = conversa.dados;
  // Mensagem com autodestruição some da tela no prazo, mesmo antes de o banco apagá-la.
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const relogio = window.setInterval(() => setAgora(Date.now()), 5000);
    return () => window.clearInterval(relogio);
  }, []);
  const todas = useMemo(() => (dados?.mensagens ?? []).filter((mensagem) => !mensagem.expira_em || new Date(mensagem.expira_em).getTime() > agora), [dados, agora]);
  const abertos = useAbertos(chaveiro, todas.map((mensagem) => ({ id: mensagem.id, conversa: id, corpo: mensagem.corpo, contexto: contextoDaConversa(id, mensagem.autor ?? ""), autor: mensagem.autor })));
  const alertas = chaveiro.alertasDe(id);
  const pessoas = chaveiro.pessoasDe(id);
  const membrosDaConversa = useMemo(() => (dados?.membros ?? []).map((membro) => ({ id: membro.id, nome: membro.nome })), [dados]);

  // O que cada mensagem de texto mostra, com a última edição e as reações já juntadas.
  const vistas = useMemo<Vista[]>(() => {
    const edicoes = new Map<string, Mensagem>();
    const reacoesPor = new Map<string, Mensagem[]>();
    for (const mensagem of todas) {
      if (mensagem.tipo === "edicao" && mensagem.alvo) {
        const atual = edicoes.get(mensagem.alvo);
        if (!atual || atual.criado_em < mensagem.criado_em) edicoes.set(mensagem.alvo, mensagem);
      } else if ((mensagem.tipo === "reacao" || mensagem.tipo === "voto" || mensagem.tipo === "rsvp") && mensagem.alvo) {
        reacoesPor.set(mensagem.alvo, [...(reacoesPor.get(mensagem.alvo) ?? []), mensagem]);
      }
    }
    return todas
      .filter((mensagem) => mensagem.tipo === "texto" || mensagem.tipo === "sistema")
      .map((mensagem) => {
        if (mensagem.tipo === "sistema") return { mensagem, conteudo: null, autoria: "ok" as const, editada: false, reacoes: [], votos: [], rsvps: [] };
        const edicao = edicoes.get(mensagem.id);
        const original = abertos[mensagem.id];
        const fonte = edicao && abertos[edicao.id] ? abertos[edicao.id] : original;
        const conteudo = fonte ? desempacotar(fonte.texto) : null;
        // A edição troca o texto, mas a citação, a encaminhada e a prévia são as da mensagem original.
        const base = original ? desempacotar(original.texto) : null;
        const grupos = new Map<string, Vista["reacoes"][number]["quem"]>();
        const votos: Vista["votos"] = [];
        const rsvps: Vista["rsvps"] = [];
        for (const resposta of reacoesPor.get(mensagem.id) ?? []) {
          const dentro = abertos[resposta.id] ? desempacotar(abertos[resposta.id]!.texto) : null;
          if (!dentro) continue;
          if (resposta.tipo === "voto" && dentro.voto) votos.push({ autor: resposta.autor, nome: resposta.nome, minha: resposta.minha, opcoes: dentro.voto });
          else if (resposta.tipo === "rsvp" && dentro.rsvp) rsvps.push({ autor: resposta.autor, nome: resposta.nome, minha: resposta.minha, resposta: dentro.rsvp });
          else if (resposta.tipo === "reacao" && dentro.emoji) grupos.set(dentro.emoji, [...(grupos.get(dentro.emoji) ?? []), { id: resposta.id, autor: resposta.autor, nome: resposta.nome, minha: resposta.minha }]);
        }
        return {
          mensagem,
          conteudo: conteudo && base ? { ...base, texto: conteudo.texto } : conteudo,
          autoria: original === undefined ? "esperando" : original === null ? "esperando" : original.autoria,
          editada: Boolean(edicao),
          reacoes: [...grupos.entries()].map(([emoji, quem]) => ({ emoji, quem })),
          votos,
          rsvps,
        };
      });
  }, [todas, abertos]);
  const ultima = vistas.at(-1)?.mensagem.id;
  const nomeDaConversa = dados ? (dados.tipo === "direta" ? (dados.membros.find((membro) => !membro.eu)?.nome ?? "Conversa") : dados.nome) : "";

  // Busca: o que este aparelho abriu entra no índice local (só texto; nada sai do aparelho).
  useEffect(() => {
    const itens = vistas.filter((vista) => vista.mensagem.tipo === "texto" && vista.conteudo?.texto).map((vista) => ({ id: vista.mensagem.id, conversa: id, conversa_nome: nomeDaConversa, autor: vista.mensagem.minha ? "Você" : vista.mensagem.nome, texto: semFormatacao(vista.conteudo!.texto), criado_em: vista.mensagem.criado_em }));
    if (itens.length) void indexar(itens);
  }, [vistas, id, nomeDaConversa]);

  // Mensagem nova: a conversa rola sozinha até o fim.
  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [ultima]);

  // Avisa que este aparelho recebeu as mensagens (o segundo tique de quem enviou), uma vez por mensagem nova de outra pessoa.
  useEffect(() => {
    const novas = vistas.filter((vista) => !vista.mensagem.minha && vista.conteudo);
    const marca = novas.at(-1)?.mensagem.id ?? "";
    if (!marca || marca === ultimoRecebido.current) return;
    ultimoRecebido.current = marca;
    void rpc("chat_recebidas", { p_id: id }).catch(() => undefined);
  }, [vistas, id]);

  // O rascunho fica guardado neste aparelho enquanto a pessoa não envia.
  useEffect(() => {
    if (editando) return;
    const relogio = window.setTimeout(() => setItem(chaveDoRascunho(id), texto.trim() ? texto : null), 400);
    return () => window.clearTimeout(relogio);
  }, [texto, id, editando]);

  /** "Fulano está digitando…": avisa no máximo a cada quatro segundos enquanto a pessoa escreve. */
  function avisarDigitando(tipo: "texto" | "audio" | "") {
    const agora = Date.now();
    if (tipo && agora - ultimoAvisoDeDigitando.current < 4000) return;
    ultimoAvisoDeDigitando.current = tipo ? agora : 0;
    void rpc("chat_digitando", { p_id: id, p_tipo: tipo }).catch(() => undefined);
  }

  if (!dados) {
    return (
      <div className="p-4">
        <button type="button" className={`${elo} lg:hidden`} onClick={voltar}>← Conversas</button>
        <Aviso texto={conversa.erro || "Abrindo…"} />
      </div>
    );
  }

  const outro = dados.tipo === "direta" ? dados.membros.find((membro) => !membro.eu) : undefined;
  const nome = dados.tipo === "direta" ? (outro?.nome ?? resumo?.nome ?? "Conversa") : dados.nome;
  const outros = dados.membros.filter((membro) => !membro.eu);
  const verificado = (usuario: string) => pessoas.find((pessoa) => pessoa.usuario === usuario)?.verificado ?? false;
  const digitando = outros.filter((membro) => membro.digitando);
  const fixadas = dados.fixadas.map((fixada) => vistas.find((vista) => vista.mensagem.id === fixada)).filter((vista): vista is Vista => Boolean(vista));
  const favoritas = new Set(dados.favoritas);
  const emGrupo = dados.tipo !== "direta";

  /** Os tiques de uma mensagem minha: enviada, entregue a todos, lida por todos (ou por quantos, no grupo). */
  function tiques(mensagem: Mensagem) {
    if (!mensagem.minha || outros.length === 0) return null;
    const entregue = outros.every((membro) => membro.recebido_em >= mensagem.criado_em);
    const leram = outros.filter((membro) => membro.lido_em && membro.lido_em >= mensagem.criado_em);
    const confirmacao = outros.some((membro) => membro.lido_em !== null);
    const lida = confirmacao && leram.length === outros.length;
    const titulo = lida ? "Lida" : entregue ? "Entregue" : "Enviada";
    return (
      <button
        type="button"
        title={titulo}
        aria-label={`${titulo}${emGrupo && leram.length ? `, por ${leram.length}` : ""}`}
        className={`ml-1 cursor-pointer font-mono ${lida ? "text-[#f0cf8e]" : ""}`}
        onClick={() => emGrupo && setLidaPor(lidaPor === mensagem.id ? null : mensagem.id)}
      >
        {entregue || lida ? "✓✓" : "✓"}
        {emGrupo && leram.length > 0 && <span className="ml-0.5">{leram.length}</span>}
      </button>
    );
  }

  function irPara(mensagem: string) {
    document.getElementById(`m-${mensagem}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    setDestacada(mensagem);
    window.setTimeout(() => setDestacada((atual) => (atual === mensagem ? null : atual)), 1600);
  }

  async function enviar(arquivos: Preparado[] = preparados) {
    const limpo = texto.trim();
    if ((!limpo && arquivos.length === 0) || ocupado) return;
    setOcupado(true);
    setAviso("");
    try {
      if (editando) {
        await enviarCifrado(chaveiro, id, empacotar({ texto: limpo }), contextoDaConversa(id, me.id), (corpo) => rpc("chat_enviar", { p_id: id, p_corpo: corpo, p_tipo: "edicao", p_alvo: editando.id }));
        setEditando(null);
      } else {
        const link = linksDe(limpo)[0];
        const conteudo: Conteudo = { texto: limpo, citando: citando ?? undefined, mencoes: extrairMencoes(limpo, membrosDaConversa), previa: link ? (previaDoLink(link) ?? undefined) : undefined };
        if (arquivos.length) {
          // Cada arquivo é cifrado com uma chave só dele e sobe antes; a mensagem leva as chaves e prende os arquivos.
          conteudo.anexos = await subir(arquivos, id, (feitos) => setAndamento(`Cifrando e enviando ${feitos} de ${arquivos.length}…`));
          setAndamento("");
        }
        const ids = conteudo.anexos?.map((anexo) => anexo.id);
        await enviarCifrado(chaveiro, id, empacotar(conteudo), contextoDaConversa(id, me.id), (corpo) => rpc("chat_enviar", { p_id: id, p_corpo: corpo, p_anexos: ids ?? null }));
        setCitando(null);
        if (arquivos.length) { soltar(arquivos); setPreparados([]); }
      }
      setTexto("");
      setItem(chaveDoRascunho(id), null);
      avisarDigitando("");
      recarregar();
      mudou();
    } catch (erro) {
      setAndamento("");
      setAviso(textoDoErro(erro));
    } finally {
      setOcupado(false);
    }
  }

  /** Arquivos escolhidos, colados ou arrastados: conferidos e preparados aqui, antes de qualquer envio. */
  async function anexar(arquivos: File[]) {
    if (arquivos.length === 0 || editando) return;
    setAviso("");
    try {
      const novos = await preparar(arquivos, preparados.length);
      setPreparados((atual) => [...atual, ...novos]);
      caixa.current?.focus();
    } catch (erro) {
      setAviso(textoDoErro(erro));
    }
  }

  async function agir(fazer: () => Promise<unknown>) {
    setAviso("");
    try {
      await fazer();
      recarregar();
      mudou();
    } catch (erro) {
      setAviso(textoDoErro(erro));
    }
  }

  const apagar = (mensagem: string) => agir(async () => { await rpc("chat_apagar", { p_id: mensagem }); await desindexar([mensagem]); });
  /** Enquete, evento, voto e resposta a evento: um conteúdo cifrado como qualquer outro. */
  const enviarConteudo = (conteudo: Conteudo, tipo: "texto" | "voto" | "rsvp" = "texto", alvo?: string) =>
    agir(() => enviarCifrado(chaveiro, id, empacotar(conteudo), contextoDaConversa(id, me.id), (corpo) => rpc("chat_enviar", { p_id: id, p_corpo: corpo, p_tipo: tipo, p_alvo: alvo ?? null })));

  const autodestruir = (segundos: number) => agir(() => rpc("chat_autodestruir", { p_id: id, p_segundos: segundos }));
  const fixar = (mensagem: string, fixar: boolean) => agir(() => rpc("chat_fixar", { p_mensagem: mensagem, p_fixar: fixar }));
  const favoritar = (mensagem: string, favoritar: boolean) => agir(() => rpc("chat_favoritar", { p_mensagem: mensagem, p_favoritar: favoritar }));

  /** Reagir: a mesma reação de novo desfaz; outra troca. */
  function reagir(vista: Vista, emoji: string) {
    setReagindo(null);
    const minha = vista.reacoes.flatMap((grupo) => grupo.quem.filter((quem) => quem.minha).map((quem) => ({ ...quem, emoji: grupo.emoji })))[0];
    if (minha?.emoji === emoji) return apagar(minha.id);
    return agir(() => enviarCifrado(chaveiro, id, empacotar({ texto: "", emoji }), contextoDaConversa(id, me.id), (corpo) => rpc("chat_enviar", { p_id: id, p_corpo: corpo, p_tipo: "reacao", p_alvo: vista.mensagem.id })));
  }

  function citar(vista: Vista) {
    if (!vista.conteudo) return;
    setEditando(null);
    setCitando({ id: vista.mensagem.id, autor: vista.mensagem.autor ?? "", nome: vista.mensagem.minha ? "Você" : vista.mensagem.nome, trecho: trechoDe(semFormatacao(vista.conteudo.texto)) });
    caixa.current?.focus();
  }

  function editar(vista: Vista) {
    if (!vista.conteudo) return;
    setCitando(null);
    setEditando(vista.mensagem);
    setTexto(vista.conteudo.texto);
    caixa.current?.focus();
  }

  const editavel = (mensagem: Mensagem) => mensagem.minha && agora - new Date(mensagem.criado_em).getTime() < EDITAVEL_POR;

  /** Encaminha as mensagens escolhidas para outras conversas, cifrando de novo para cada uma. */
  async function encaminhar(destinos: string[]) {
    const ids = encaminhando ?? [];
    setEncaminhando(null);
    setSelecionadas(null);
    setOcupado(true);
    setAviso("");
    try {
      for (const destino of destinos) {
        for (const alvo of ids) {
          const vista = vistas.find((item) => item.mensagem.id === alvo);
          if (!vista?.conteudo) continue;
          const conteudo: Conteudo = { texto: vista.conteudo.texto, encaminhada: true, previa: vista.conteudo.previa };
          const anexos = (vista.conteudo.anexos ?? []).filter((anexo) => !anexo.uma_vez);
          if (anexos.length) {
            // Baixa, abre e cifra de novo com chave nova para a conversa de destino: a chave de uma conversa nunca vale em outra.
            const { reenviar } = await import("./Anexos");
            conteudo.anexos = await reenviar(anexos, id, destino);
          }
          await enviarCifrado(chaveiro, destino, empacotar(conteudo), contextoDaConversa(destino, me.id), (corpo) => rpc("chat_enviar", { p_id: destino, p_corpo: corpo, p_anexos: conteudo.anexos?.map((anexo) => anexo.id) ?? null }));
        }
      }
      setAviso(destinos.length > 1 ? (ids.length > 1 ? `Encaminhadas para ${destinos.length} conversas.` : `Encaminhada para ${destinos.length} conversas.`) : ids.length > 1 ? "Encaminhadas para 1 conversa." : "Encaminhada para 1 conversa.");
      mudou();
    } catch (erro) {
      setAviso(textoDoErro(erro));
    } finally {
      setOcupado(false);
    }
  }

  async function apagarSelecionadas() {
    const minhas = [...(selecionadas ?? [])].filter((alvo) => vistas.find((vista) => vista.mensagem.id === alvo)?.mensagem.minha);
    if (minhas.length === 0 || !window.confirm(`Apagar ${minhas.length > 1 ? `${minhas.length} mensagens suas` : "1 mensagem sua"} para todo mundo?`)) return;
    setSelecionadas(null);
    await agir(async () => {
      for (const alvo of minhas) await rpc("chat_apagar", { p_id: alvo });
    });
  }

  /** Menção com @: a lista de quem está na conversa, filtrada pelo que a pessoa já digitou depois do @. */
  function aoDigitar(valor: string, cursor: number) {
    setTexto(valor);
    if (valor.trim()) avisarDigitando("texto");
    const antes = valor.slice(0, cursor);
    const arroba = /(?:^|\s)@([^\s@]*)$/.exec(antes);
    setSugestao(arroba ? { inicio: cursor - arroba[1].length - 1, termo: arroba[1] } : null);
  }
  const sugeridos = sugestao ? outros.filter((membro) => membro.nome.toLowerCase().includes(sugestao.termo.toLowerCase())).slice(0, 6) : [];
  function mencionar(membro: MembroDaConversa) {
    if (!sugestao) return;
    const primeiro = membro.nome.split(/\s+/)[0];
    const depois = texto.slice(sugestao.inicio + 1 + sugestao.termo.length);
    const novo = `${texto.slice(0, sugestao.inicio)}@${primeiro} ${depois.replace(/^\s/, "")}`;
    setTexto(novo);
    setSugestao(null);
    caixa.current?.focus();
  }

  return (
    <>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-rule bg-parchment-deep px-3 py-2.5">
        <button type="button" aria-label="Voltar às conversas" className="cursor-pointer px-1 text-xl lg:hidden" onClick={voltar}>←</button>
        <Rosto nome={nome} online={Boolean(outro?.online)} tipo={dados.tipo} avatar={outro?.avatar} />
        <div className="min-w-[10rem] flex-1">
          <p className="truncate font-semibold">
            {nome}
            {outro && verificado(outro.id) && <span title="Identidade verificada pessoalmente" className="ml-1.5 font-normal text-ok">✓ verificado</span>}
          </p>
          <p className="truncate text-xs text-ink-soft" aria-live="polite">
            {digitando.length > 0
              ? `${digitando.map((membro) => membro.nome.split(" ")[0]).join(", ")} ${digitando.some((membro) => membro.digitando === "audio") ? "está gravando áudio…" : digitando.length > 1 ? "estão digitando…" : "está digitando…"}`
              : outro
                ? presenca(outro.online, outro.visto_em)
                : `${dados.tipo === "departamento" ? "Grupo do departamento · " : ""}${dados.membros.length} pessoas${outros.some((membro) => membro.online !== null) ? ` · ${dados.membros.filter((membro) => membro.online).length} online` : ""}`}
            {outro && (
              <>
                {" · "}
                <button type="button" className={elo} onClick={() => setSeguranca(seguranca ? null : { usuario: outro.id, nome: outro.nome })}>código de segurança</button>
              </>
            )}
          </p>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-ink-soft">
          <span aria-hidden>⏱</span>
          <span className="sr-only">Autodestruição das mensagens</span>
          <select value={dados.apagar_apos ?? 0} onChange={(e) => void autodestruir(Number(e.target.value))} className="cursor-pointer border border-rule bg-parchment px-1.5 py-1 text-ink" title="Autodestruição das mensagens novas">
            {prazos.map((prazo) => (
              <option key={prazo.segundos} value={prazo.segundos}>{prazo.segundos ? `Some em ${prazo.nome}` : "Sem autodestruição"}</option>
            ))}
          </select>
        </label>
        <button type="button" className={elo} aria-pressed={selecionadas !== null} onClick={() => setSelecionadas(selecionadas ? null : new Set())}>
          {selecionadas ? "Cancelar seleção" : "Selecionar"}
        </button>
        <button type="button" className={elo} onClick={() => setGaleria(true)}>Arquivos</button>
        {dados.tipo !== "direta" && (
          <button type="button" className={elo} aria-expanded={gerir} onClick={() => setGerir(!gerir)}>
            {gerir ? "Fechar" : "Grupo"}
          </button>
        )}
      </header>

      {gerir && dados.tipo !== "direta" ? (
        <Grupo dados={dados} me={me} equipe={equipe} chaveiro={chaveiro} conversa={id} depois={() => { recarregar(); mudou(); }} saiu={voltar} enviarFoto={async (arquivo) => {
          // A foto do grupo é uma mensagem com a imagem, cifrada como qualquer outra; o grupo passa a apontar para ela.
          const [foto] = await preparar([arquivo], 0);
          const anexos = await subir([foto], id);
          soltar([foto]);
          const { id: mensagem } = await enviarCifrado(chaveiro, id, empacotar({ texto: "", anexos, grupo_foto: true }), contextoDaConversa(id, me.id), (corpo) => rpc<{ id: string }>("chat_enviar", { p_id: id, p_corpo: corpo, p_anexos: anexos.map((anexo) => anexo.id) }));
          await rpc("chat_grupo_mudar", { p_id: id, p_foto: mensagem });
          recarregar();
          mudou();
        }} />
      ) : (
        <>
          {fixadas.length > 0 && (
            <div className="flex items-center gap-2 border-b border-rule bg-parchment-deep px-3 py-1.5 text-xs">
              <span aria-hidden>📌</span>
              <button type="button" className="min-w-0 flex-1 cursor-pointer truncate text-left hover:underline" onClick={() => irPara(fixadas[0].mensagem.id)}>
                <span className="font-semibold">{fixadas[0].mensagem.minha ? "Você" : fixadas[0].mensagem.nome.split(" ")[0]}: </span>
                {fixadas[0].conteudo ? semFormatacao(fixadas[0].conteudo.texto) : "…"}
                {fixadas.length > 1 && <span className="text-ink-soft"> · +{fixadas.length - 1}</span>}
              </button>
              <button type="button" className={elo} onClick={() => void fixar(fixadas[0].mensagem.id, false)}>Desafixar</button>
            </div>
          )}
          {selecionadas && (
            <div className="flex flex-wrap items-center gap-3 border-b border-rule bg-ink px-3 py-1.5 text-xs text-parchment">
              <span>{selecionadas.size} {selecionadas.size === 1 ? "selecionada" : "selecionadas"}</span>
              <button type="button" className="cursor-pointer underline disabled:opacity-50" disabled={selecionadas.size === 0} onClick={() => setEncaminhando([...selecionadas])}>Encaminhar</button>
              <button type="button" className="cursor-pointer underline disabled:opacity-50" disabled={![...selecionadas].some((alvo) => vistas.find((vista) => vista.mensagem.id === alvo)?.mensagem.minha)} onClick={() => void apagarSelecionadas()}>Apagar as minhas</button>
              <button type="button" className="cursor-pointer underline disabled:opacity-50" disabled={selecionadas.size === 0} onClick={() => setCompondo("relato")}>Relatar à coordenação</button>
            </div>
          )}
          {compondo === "relato" && selecionadas && (
            <Relatar
              membros={outros}
              escolhidas={vistas.filter((vista) => selecionadas.has(vista.mensagem.id) && vista.conteudo).map((vista) => ({ id: vista.mensagem.id, autor: vista.mensagem.minha ? "Você" : vista.mensagem.nome, quando: vista.mensagem.criado_em, texto: semFormatacao(vista.conteudo!.texto) || (vista.conteudo!.anexos?.length ? "[arquivo]" : "") }))}
              fechar={() => setCompondo(null)}
              enviar={(contra, motivo, mensagens) => { setCompondo(null); setSelecionadas(null); void agir(async () => { await rpc("chat_relatar", { p_conversa: id, p_contra: contra, p_motivo: motivo, p_mensagens: mensagens }); setAviso("Relato enviado à coordenação."); }); }}
            />
          )}
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-4 [scrollbar-width:thin]" aria-live="polite">
            {seguranca && (
              <div className="mb-3">
                <Seguranca chaveiro={chaveiro} conversa={id} usuario={seguranca.usuario} nome={seguranca.nome} fechar={() => setSeguranca(null)} />
              </div>
            )}
            <Alertas chaveiro={chaveiro} conversa={id} alertas={alertas} />
            {dados.apagar_apos && (
              <p className="mx-auto mb-3 max-w-md border border-rule bg-parchment-deep px-3 py-2 text-center text-xs text-ink-soft">
                Autodestruição ligada{dados.apagar_por ? ` por ${dados.apagar_por}` : ""}: as mensagens enviadas desde então somem {nomeDoPrazo(dados.apagar_apos)} depois de enviadas.
              </p>
            )}
            {vistas.length === 0 && <p className="py-10 text-center text-ink-soft">{dados.tipo === "departamento" ? "Ninguém escreveu aqui ainda. Todo mundo dessa função lê o que for escrito." : "Nenhuma mensagem ainda. Diga oi."}</p>}
            {vistas.map((vista, indice) => {
              const { mensagem, conteudo } = vista;
              const anterior = vistas[indice - 1]?.mensagem;
              const outroDia = !anterior || new Date(anterior.criado_em).toDateString() !== new Date(mensagem.criado_em).toDateString();
              if (mensagem.tipo === "sistema") {
                return (
                  <div key={mensagem.id} id={`m-${mensagem.id}`}>
                    {outroDia && <p className="py-2 text-center text-xs uppercase tracking-widest text-ink-soft">{diaDe(mensagem.criado_em)}</p>}
                    <p className="mx-auto my-1 max-w-md border border-rule bg-parchment-deep px-3 py-1 text-center text-xs text-ink-soft">{textoDoAviso(mensagem, me)} · {hora(mensagem.criado_em)}</p>
                  </div>
                );
              }
              const mostraNome = dados.tipo !== "direta" && !mensagem.minha && (outroDia || anterior?.autor !== mensagem.autor);
              const meMenciona = Boolean(conteudo?.mencoes?.includes(me.id)) && !mensagem.minha;
              const marcada = selecionadas?.has(mensagem.id) ?? false;
              const leram = outros.filter((membro) => membro.lido_em && membro.lido_em >= mensagem.criado_em);
              return (
                <div key={mensagem.id} id={`m-${mensagem.id}`} className={destacada === mensagem.id ? "painel-surge" : ""}>
                  {outroDia && <p className="py-2 text-center text-xs uppercase tracking-widest text-ink-soft">{diaDe(mensagem.criado_em)}</p>}
                  <div className={`group flex items-end gap-2 ${mensagem.minha ? "justify-end" : "justify-start"}`}>
                    {selecionadas && (
                      <input
                        type="checkbox"
                        className="mb-3 h-4 w-4 shrink-0"
                        aria-label="Selecionar mensagem"
                        checked={marcada}
                        onChange={(e) => setSelecionadas((atual) => { const novo = new Set(atual); if (e.target.checked) novo.add(mensagem.id); else novo.delete(mensagem.id); return novo; })}
                      />
                    )}
                    {mensagem.minha && !selecionadas && <Acoes vista={vista} eu me={me} favorita={favoritas.has(mensagem.id)} fixada={dados.fixadas.includes(mensagem.id)} editavel={editavel(mensagem)} citar={() => citar(vista)} reagir={() => setReagindo(reagindo === mensagem.id ? null : mensagem.id)} encaminhar={() => setEncaminhando([mensagem.id])} fixar={(sim) => void fixar(mensagem.id, sim)} favoritar={(sim) => void favoritar(mensagem.id, sim)} editar={() => editar(vista)} apagar={() => void apagar(mensagem.id)} />}
                    <div className={`relative max-w-[80%] px-3 py-1.5 sm:max-w-[70%] ${conteudo?.anexos?.length ? "w-[80%] sm:w-[70%] md:max-w-md" : ""} ${mensagem.minha ? "bg-ink text-parchment" : `border bg-parchment-deep ${meMenciona ? "border-gold border-l-4" : "border-rule"}`} ${destacada === mensagem.id ? "outline outline-2 outline-gold" : ""} ${marcada ? "outline outline-2 outline-oxblood" : ""}`}>
                      {mostraNome && (
                        <p className="text-xs font-semibold text-gold">
                          {mensagem.nome}
                          {mensagem.autor && verificado(mensagem.autor) && <span title="Identidade verificada pessoalmente" className="ml-1 font-normal text-ok">✓</span>}
                        </p>
                      )}
                      {conteudo?.encaminhada && <p className={`text-[0.7rem] italic ${mensagem.minha ? "text-parchment/70" : "text-ink-soft"}`}>↪ Encaminhada</p>}
                      {conteudo?.citando && (
                        <button type="button" onClick={() => irPara(conteudo.citando!.id)} className={`mb-1 block w-full cursor-pointer border-l-2 px-2 py-1 text-left text-xs ${mensagem.minha ? "border-[#f0cf8e] bg-parchment/10" : "border-oxblood bg-parchment"}`}>
                          <span className="block font-semibold">{conteudo.citando.autor === me.id ? "Você" : conteudo.citando.nome}</span>
                          <span className="block truncate opacity-80">{conteudo.citando.trecho}</span>
                        </button>
                      )}
                      {conteudo?.anexos?.map((anexo) => (
                        <AnexoVisto key={anexo.id} anexo={anexo} estado={mensagem.anexos.find((estado) => estado.id === anexo.id)} conversa={id} minha={mensagem.minha} />
                      ))}
                      <div className={`whitespace-pre-line break-words ${vista.autoria === "invalida" ? "border border-oxblood p-1" : ""}`}>
                        {conteudo ? (
                          <>
                            {conteudo.texto && <Formatado texto={conteudo.texto} membros={membrosDaConversa} eu={me.id} />}
                            {vista.autoria === "invalida" && <span className="mt-1 block border-l-2 border-oxblood pl-2 text-xs font-semibold text-oxblood">Não foi possível verificar o autor desta mensagem: a assinatura não confere com a identidade de quem aparece como autor.</span>}
                          </>
                        ) : (
                          <TextoAberto aberto={abertos[mensagem.id]} antiga={mensagem.corpo.startsWith("c1.")} />
                        )}
                      </div>
                      {conteudo?.enquete && <EnqueteVista enquete={conteudo.enquete} votos={vista.votos} minha={mensagem.minha} votar={(opcoes) => void enviarConteudo({ texto: "", voto: opcoes }, "voto", mensagem.id)} />}
                      {conteudo?.evento && <EventoVista evento={conteudo.evento} rsvps={vista.rsvps} minha={mensagem.minha} responder={(resposta) => void enviarConteudo({ texto: "", rsvp: resposta }, "rsvp", mensagem.id)} />}
                      {conteudo?.previa && (
                        <a href={conteudo.previa.url} target="_blank" rel="noopener noreferrer nofollow" className={`mt-1 block border px-2 py-1 text-xs no-underline ${mensagem.minha ? "border-parchment/40" : "border-rule bg-parchment"}`}>
                          <span className="block truncate font-semibold">{conteudo.previa.titulo}</span>
                          <span className="block truncate opacity-70">{conteudo.previa.dominio} · prévia feita só do endereço</span>
                        </a>
                      )}
                      {vista.reacoes.length > 0 && (
                        <p className="mt-1 flex flex-wrap gap-1">
                          {vista.reacoes.map((grupo) => (
                            <button
                              key={grupo.emoji}
                              type="button"
                              title={grupo.quem.map((quem) => (quem.minha ? "você" : quem.nome)).join(", ")}
                              aria-label={`${grupo.emoji} de ${grupo.quem.map((quem) => (quem.minha ? "você" : quem.nome)).join(", ")}`}
                              onClick={() => (quemReagiu === mensagem.id ? setQuemReagiu(null) : setQuemReagiu(mensagem.id))}
                              className={`cursor-pointer rounded-full border px-1.5 text-xs ${grupo.quem.some((quem) => quem.minha) ? "border-gold bg-gold/30 text-ink" : mensagem.minha ? "border-parchment/40" : "border-rule bg-parchment"}`}
                            >
                              {grupo.emoji} {grupo.quem.length}
                            </button>
                          ))}
                        </p>
                      )}
                      {quemReagiu === mensagem.id && (
                        <ul className={`mt-1 text-[0.7rem] ${mensagem.minha ? "text-parchment/80" : "text-ink-soft"}`}>
                          {vista.reacoes.flatMap((grupo) => grupo.quem.map((quem) => (
                            <li key={quem.id} className="flex items-center justify-between gap-2">
                              <span>{grupo.emoji} {quem.minha ? "Você" : quem.nome}</span>
                              {quem.minha && <button type="button" className="cursor-pointer underline" onClick={() => void apagar(quem.id)}>desfazer</button>}
                            </li>
                          )))}
                        </ul>
                      )}
                      <p className={`text-right text-[0.65rem] leading-tight ${mensagem.minha ? "text-parchment/70" : "text-ink-soft"}`}>
                        {vista.editada && <span>Editada · </span>}
                        {dados.fixadas.includes(mensagem.id) && <span title="Fixada">📌 </span>}
                        {favoritas.has(mensagem.id) && <span title="Favorita">★ </span>}
                        {mensagem.expira_em && <span title={`Autodestruição: ${new Date(mensagem.expira_em).toLocaleString("pt-BR")}`}>⏱ {restante(mensagem.expira_em)} · </span>}
                        {hora(mensagem.criado_em)}
                        {tiques(mensagem)}
                      </p>
                      {lidaPor === mensagem.id && (
                        <p className={`text-[0.7rem] ${mensagem.minha ? "text-parchment/80" : "text-ink-soft"}`}>
                          {leram.length === 0 ? "Ninguém leu ainda." : `Lida por ${leram.map((membro) => membro.nome.split(" ")[0]).join(", ")}`}
                          {outros.some((membro) => membro.lido_em === null) && " (quem desligou a confirmação de leitura não aparece)"}
                        </p>
                      )}
                      {reagindo === mensagem.id && (
                        <p role="group" aria-label="Reagir" className="absolute -top-8 right-0 z-10 flex gap-0.5 border border-rule bg-parchment p-1 text-base shadow">
                          {reacoes.map((emoji) => (
                            <button key={emoji} type="button" className="cursor-pointer px-1 hover:bg-parchment-deep" aria-label={`Reagir com ${emoji}`} onClick={() => void reagir(vista, emoji)}>{emoji}</button>
                          ))}
                        </p>
                      )}
                    </div>
                    {!mensagem.minha && !selecionadas && <Acoes vista={vista} me={me} favorita={favoritas.has(mensagem.id)} fixada={dados.fixadas.includes(mensagem.id)} editavel={false} citar={() => citar(vista)} reagir={() => setReagindo(reagindo === mensagem.id ? null : mensagem.id)} encaminhar={() => setEncaminhando([mensagem.id])} fixar={(sim) => void fixar(mensagem.id, sim)} favoritar={(sim) => void favoritar(mensagem.id, sim)} />}
                  </div>
                </div>
              );
            })}
            <div ref={fim} />
          </div>
          {encaminhando && <Encaminhar conversas={conversas.filter((item) => item.id !== id)} quantas={encaminhando.length} fechar={() => setEncaminhando(null)} enviar={(destinos) => void encaminhar(destinos)} />}
          {galeria && (
            <Galeria
              conversa={id}
              fechar={() => setGaleria(false)}
              irPara={irPara}
              itens={vistas.flatMap((vista): ItemDaGaleria[] => (vista.conteudo?.anexos ?? []).map((anexo) => ({ mensagem: vista.mensagem.id, anexo, estado: vista.mensagem.anexos.find((estado) => estado.id === anexo.id), autor: vista.mensagem.nome, minha: vista.mensagem.minha, quando: `${new Date(vista.mensagem.criado_em).toLocaleDateString("pt-BR")} ${hora(vista.mensagem.criado_em)}` })))}
            />
          )}
          {gravando && <Gravador aoGravar={(audio) => void enviar([audio])} aoAvisar={avisarDigitando} fechar={() => setGravando(false)} />}
          {compondo === "enquete" && <NovaEnquete fechar={() => setCompondo(null)} criar={(enquete) => { setCompondo(null); void enviarConteudo({ texto: "", enquete }); }} />}
          {compondo === "evento" && <NovoEvento fechar={() => setCompondo(null)} criar={(evento) => { setCompondo(null); void enviarConteudo({ texto: "", evento }); }} />}
          {!dados.posso_enviar && (
            <p className="border-t border-rule bg-parchment-deep px-3 py-2 text-center text-xs text-ink-soft">
              {dados.barrado === "chat_fechado"
                ? `As conversas estão fechadas pela coordenação por enquanto.${dados.motivo_do_fechamento ? ` Motivo: ${dados.motivo_do_fechamento}` : ""} Ler pode; escrever, ainda não.`
                : dados.barrado === "silenciado"
                  ? "A coordenação silenciou a sua conta nas conversas por enquanto. Você lê, mas não escreve."
                  : "Neste grupo, só os administradores mandam mensagem. Você ainda pode reagir e votar."}
            </p>
          )}
          <form
            className={`relative border-t border-rule bg-parchment-deep p-3 ${arrastando ? "outline outline-2 -outline-offset-4 outline-dashed outline-oxblood" : ""} ${dados.posso_enviar ? "" : "hidden"}`}
            onSubmit={(e) => { e.preventDefault(); void enviar(); }}
            onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setArrastando(true); } }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => { e.preventDefault(); setArrastando(false); void anexar([...e.dataTransfer.files]); }}
          >
            <Preparados itens={preparados} mudar={setPreparados} />
            {andamento && <p className="mb-2 text-xs text-ink-soft" aria-live="polite">{andamento}</p>}
            {citando && (
              <div className="mb-2 flex items-start gap-2 border-l-2 border-oxblood bg-parchment px-2 py-1 text-xs">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">Respondendo a {citando.nome}</span>
                  <span className="block truncate text-ink-soft">{citando.trecho}</span>
                </span>
                <button type="button" className={elo} aria-label="Cancelar a citação" onClick={() => setCitando(null)}>✕</button>
              </div>
            )}
            {editando && (
              <div className="mb-2 flex items-center gap-2 border-l-2 border-gold bg-parchment px-2 py-1 text-xs">
                <span className="flex-1 font-semibold">Editando a mensagem (até 15 minutos depois de enviada)</span>
                <button type="button" className={elo} onClick={() => { setEditando(null); setTexto(getItem(chaveDoRascunho(id))); }}>Cancelar</button>
              </div>
            )}
            {sugestao && sugeridos.length > 0 && (
              <ul role="listbox" aria-label="Mencionar alguém" className="absolute bottom-full left-3 z-10 mb-1 border-2 border-ink bg-parchment text-xs shadow">
                {sugeridos.map((membro) => (
                  <li key={membro.id}>
                    <button type="button" role="option" aria-selected={false} className="block w-full cursor-pointer px-3 py-1.5 text-left hover:bg-parchment-deep" onMouseDown={(e) => { e.preventDefault(); mencionar(membro); }}>
                      @{membro.nome}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={caixa}
                value={texto}
                onChange={(e) => aoDigitar(e.target.value, e.target.selectionStart ?? e.target.value.length)}
                onBlur={() => { window.setTimeout(() => setSugestao(null), 150); avisarDigitando(""); }}
                onPaste={(e) => { const arquivos = [...e.clipboardData.files]; if (arquivos.length) { e.preventDefault(); void anexar(arquivos); } }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (sugestao && sugeridos.length > 0) mencionar(sugeridos[0]);
                    else void enviar();
                  } else if (e.key === "Escape") {
                    setSugestao(null);
                    setReagindo(null);
                    if (editando) { setEditando(null); setTexto(getItem(chaveDoRascunho(id))); }
                  }
                }}
                rows={1}
                maxLength={MAXIMO}
                aria-label={`Mensagem para ${nome}`}
                placeholder={preparados.length ? "Legenda (opcional)" : "Escreva uma mensagem (*negrito*, _itálico_, ~tachado~, `mono`, @nome)"}
                className={`${campo} mt-0 max-h-32 min-h-[2.6rem] min-w-0 flex-1 resize-y bg-parchment`}
              />
              {!editando && (
                <>
                  <input ref={escolha} type="file" multiple accept="image/*,video/*,audio/*,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={(e) => { void anexar([...(e.target.files ?? [])]); e.target.value = ""; }} />
                  <button type="button" className={`${botaoClaro} px-1.5 py-1.5 text-sm`} title="Anexar foto, vídeo, áudio, PDF ou DOCX (ou cole, ou arraste aqui)" aria-label="Anexar arquivo" disabled={ocupado} onClick={() => escolha.current?.click()}>📎</button>
                  <button type="button" className={`${botaoClaro} px-1.5 py-1.5 text-sm`} title="Gravar áudio" aria-label="Gravar áudio" aria-pressed={gravando} disabled={ocupado} onClick={() => setGravando(!gravando)}>🎙</button>
                  {dados.tipo !== "direta" && (
                    <>
                      <button type="button" className={`${botaoClaro} px-1.5 py-1.5 text-sm`} title="Enquete" aria-label="Criar enquete" disabled={ocupado} onClick={() => setCompondo("enquete")}>📊</button>
                      <button type="button" className={`${botaoClaro} px-1.5 py-1.5 text-sm`} title="Evento" aria-label="Criar evento" disabled={ocupado} onClick={() => setCompondo("evento")}>📅</button>
                    </>
                  )}
                </>
              )}
              <button type="submit" className={botao} disabled={ocupado || (!texto.trim() && preparados.length === 0)}>
                {editando ? "Guardar" : ocupado && andamento ? "Enviando…" : "Enviar"}
              </button>
            </div>
          </form>
          {aviso && <Aviso texto={aviso} />}
        </>
      )}
    </>
  );
}

/** As ações de uma mensagem, à vista ao passar o mouse ou com o teclado: responder, reagir, encaminhar, fixar, favoritar, editar, apagar. */
function Acoes({ vista, eu = false, favorita, fixada, editavel, citar, reagir, encaminhar, fixar, favoritar, editar, apagar }: {
  vista: Vista; eu?: boolean; me: Me; favorita: boolean; fixada: boolean; editavel: boolean;
  citar: () => void; reagir: () => void; encaminhar: () => void; fixar: (sim: boolean) => void; favoritar: (sim: boolean) => void; editar?: () => void; apagar?: () => void;
}) {
  const pronta = Boolean(vista.conteudo);
  const item = "cursor-pointer px-1 hover:text-oxblood";
  return (
    <span role="group" aria-label="Ações da mensagem" className={`mb-2 flex shrink-0 flex-wrap gap-0.5 text-xs text-ink-soft opacity-0 focus-within:opacity-100 group-hover:opacity-100 ${eu ? "justify-end" : ""}`}>
      <button type="button" className={item} disabled={!pronta} title="Responder" aria-label="Responder" onClick={citar}>↩</button>
      <button type="button" className={item} title="Reagir" aria-label="Reagir" onClick={reagir}>☺</button>
      <button type="button" className={item} disabled={!pronta} title="Encaminhar" aria-label="Encaminhar" onClick={encaminhar}>↪</button>
      <button type="button" className={item} title={fixada ? "Desafixar" : "Fixar"} aria-label={fixada ? "Desafixar" : "Fixar"} aria-pressed={fixada} onClick={() => fixar(!fixada)}>📌</button>
      <button type="button" className={item} title={favorita ? "Tirar das favoritas" : "Favoritar"} aria-label={favorita ? "Tirar das favoritas" : "Favoritar"} aria-pressed={favorita} onClick={() => favoritar(!favorita)}>{favorita ? "★" : "☆"}</button>
      {editavel && editar && <button type="button" className={item} disabled={!pronta} title="Editar" aria-label="Editar" onClick={editar}>✎</button>}
      {apagar && <button type="button" className={item} title="Apagar para todos" aria-label="Apagar para todos" onClick={apagar}>🗑</button>}
    </span>
  );
}

/** Escolher para quais conversas encaminhar. */
function Encaminhar({ conversas, quantas, fechar, enviar }: { conversas: Conversa[]; quantas: number; fechar: () => void; enviar: (destinos: string[]) => void }) {
  const [escolhidas, setEscolhidas] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  const termo = busca.trim().toLowerCase();
  return (
    <div role="dialog" aria-label="Encaminhar" className="border-t-2 border-ink bg-parchment p-3 text-sm">
      <p className="font-semibold">Encaminhar {quantas} {quantas > 1 ? "mensagens" : "mensagem"} para…</p>
      <input value={busca} onChange={(e) => setBusca(e.target.value)} type="search" placeholder="Procurar conversa" aria-label="Procurar conversa" className={`${campo} bg-parchment-deep`} />
      <ul className="mt-2 max-h-40 overflow-y-auto border-y border-rule">
        {conversas.filter((conversa) => !termo || conversa.nome.toLowerCase().includes(termo)).map((conversa) => (
          <li key={conversa.id}>
            <label className="flex cursor-pointer items-center gap-2 px-1 py-1 hover:bg-parchment-deep">
              <input type="checkbox" className="h-4 w-4" checked={escolhidas.includes(conversa.id)} onChange={(e) => setEscolhidas(e.target.checked ? [...escolhidas, conversa.id] : escolhidas.filter((item) => item !== conversa.id))} />
              <span className="truncate">{conversa.tipo === "direta" ? conversa.nome : `# ${conversa.nome}`}</span>
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex gap-3">
        <button type="button" className={botao} disabled={escolhidas.length === 0} onClick={() => enviar(escolhidas)}>Encaminhar</button>
        <button type="button" className={elo} onClick={fechar}>Cancelar</button>
      </p>
    </div>
  );
}

interface Favorita {
  id: string;
  conversa: string;
  conversa_nome: string;
  autor: string | null;
  nome: string;
  corpo: string;
  criado_em: string;
}

/** As mensagens que a pessoa marcou com estrela, de todas as conversas. */
function Favoritas({ chaveiro, fechar, abrir }: { chaveiro: Chaveiro; fechar: () => void; abrir: (conversa: string) => void }) {
  const lista = useLista<Favorita[]>("chat_favoritas");
  const abertos = useAbertos(chaveiro, (lista.dados ?? []).map((item) => ({ id: item.id, conversa: item.conversa, corpo: item.corpo, contexto: contextoDaConversa(item.conversa, item.autor ?? ""), autor: item.autor })));
  const acao = useCallback(async (mensagem: string) => { await rpc("chat_favoritar", { p_mensagem: mensagem, p_favoritar: false }); lista.recarregar(); }, [lista]);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-2xl font-semibold">Mensagens favoritas</h2>
        <button type="button" className={elo} onClick={fechar}>Fechar</button>
      </div>
      <Aviso texto={lista.erro} />
      {lista.dados?.length === 0 && <p className="mt-3 text-ink-soft">Nenhuma mensagem favorita. Use a estrela nas ações de uma mensagem.</p>}
      <ul className="mt-3 divide-y divide-rule border-y border-rule">
        {lista.dados?.map((item) => (
          <li key={item.id} className="py-2">
            <p className="text-xs text-ink-soft">
              <button type="button" className={elo} onClick={() => abrir(item.conversa)}>{item.conversa_nome || "Conversa"}</button> · {item.nome || "Alguém"} · {hora(item.criado_em)}, {new Date(item.criado_em).toLocaleDateString("pt-BR")}
            </p>
            <p className="whitespace-pre-line break-words" data-original>{abertos[item.id] ? semFormatacao(desempacotar(abertos[item.id]!.texto).texto) : "…"}</p>
            <button type="button" className={`${elo} text-xs`} onClick={() => void acao(item.id)}>Tirar das favoritas</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Quem está no grupo. Num grupo comum, quem criou (ou a coordenação) põe e tira gente, troca o nome e apaga; qualquer um sai.
 * O grupo de um departamento acompanha as funções: entra quem recebe a função, sai quem deixa de tê-la.
 */
function Grupo({ dados, me, equipe, chaveiro, conversa, depois, saiu, enviarFoto }: { dados: Aberta; me: Me; equipe: Membro[]; chaveiro: Chaveiro; conversa: string; depois: () => void; saiu: () => void; enviarFoto: (arquivo: File) => Promise<void> }) {
  const [nome, setNome] = useState(dados.nome);
  const [descricao, setDescricao] = useState(dados.descricao);
  const [novo, setNovo] = useState("");
  const [aviso, setAviso] = useState("");
  const [seguranca, setSeguranca] = useState<{ usuario: string; nome: string } | null>(null);
  const fotoNova = useRef<HTMLInputElement>(null);
  const dentro = new Set(dados.membros.map((membro) => membro.id));
  const livres = equipe.filter((membro) => !dentro.has(membro.id));
  const fixo = dados.tipo === "departamento";
  /** Administro: gente, permissões e administradores. */
  const pode = dados.admin && !fixo;
  /** Descrição e foto (e o nome, fora dos departamentos): administradores e o representante, ou todo mundo se o grupo deixar. */
  const edita = dados.admin || (!fixo && !dados.so_admins_mudam);
  const pessoas = chaveiro.pessoasDe(conversa);
  const verificado = (usuario: string) => pessoas.find((pessoa) => pessoa.usuario === usuario)?.verificado ?? false;

  async function fazer(funcao: string, argumentos: Record<string, unknown>, fim: () => void = depois) {
    setAviso("");
    try {
      await rpc(funcao, argumentos);
      fim();
    } catch (erro) {
      setAviso(textoDoErro(erro));
    }
  }

  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
      {fixo && (
        <p className="max-w-xl border-l-2 border-oxblood pl-3 text-ink-soft">
          {dados.departamento === "geral"
            ? "O grupo da equipe inteira: todo mundo que tem alguma função no instituto está aqui."
            : `O grupo de ${papeis[dados.departamento as keyof typeof papeis] ?? dados.nome}. Quem recebe essa função entra sozinho, quem deixa de tê-la sai, e a coordenação participa de todos os grupos. Não dá para sair nem tirar ninguém.`}
        </p>
      )}
      {!fixo && !edita && dados.descricao && <p className="max-w-xl whitespace-pre-line text-ink-soft" data-original>{dados.descricao}</p>}
      {edita && (
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void fazer("chat_grupo_mudar", { p_id: dados.id, p_nome: fixo ? null : nome, p_descricao: descricao }); }}>
          <div className="flex flex-wrap items-end gap-2">
            <label className={`block min-w-48 flex-1 ${fixo ? "hidden" : ""}`}>
              Nome do grupo
              <input value={nome} onChange={(e) => setNome(e.target.value)} minLength={2} maxLength={60} className={campo} />
            </label>
            <button type="submit" className={botaoClaro} disabled={nome.trim().length < 2 || (nome.trim() === dados.nome && descricao.trim() === dados.descricao)}>Guardar</button>
          </div>
          <label className="block max-w-xl">
            Descrição (opcional)
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={500} rows={2} className={campo} placeholder="Para que serve o grupo, combinados…" />
          </label>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <input ref={fotoNova} type="file" accept="image/*" className="hidden" onChange={(e) => { const arquivo = e.target.files?.[0]; e.target.value = ""; if (arquivo) void enviarFoto(arquivo).catch((erro) => setAviso(textoDoErro(erro))); }} />
            <button type="button" className={botaoClaro} onClick={() => fotoNova.current?.click()}>{dados.foto ? "Trocar a foto do grupo" : "Pôr uma foto no grupo"}</button>
            <span className="text-xs text-ink-soft">A foto é mandada como mensagem cifrada: só quem está no grupo a vê.</span>
          </p>
        </form>
      )}
      {dados.admin && (
        <fieldset className="max-w-xl space-y-1 text-sm">
          <legend className={rotulo}>Permissões</legend>
          <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={dados.so_admins_mudam} onChange={(e) => void fazer("chat_grupo_mudar", { p_id: dados.id, p_so_admins_mudam: e.target.checked })} /> Só administradores mudam nome, descrição e foto</label>
          <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={dados.so_admins_enviam} onChange={(e) => void fazer("chat_grupo_mudar", { p_id: dados.id, p_so_admins_enviam: e.target.checked })} /> Só administradores mandam mensagem (os outros reagem e votam)</label>
        </fieldset>
      )}
      <div>
        <p className={rotulo}>{dados.membros.length} pessoas</p>
        <ul className="mt-2 divide-y divide-rule border-y border-rule">
          {dados.membros.map((membro) => (
            <li key={membro.id} className="flex items-center justify-between gap-3 py-2">
              <span className="flex min-w-0 items-center gap-3">
                <Rosto nome={membro.nome} online={Boolean(membro.online)} avatar={membro.avatar} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {membro.nome}{membro.eu && " (você)"}
                    {!membro.eu && verificado(membro.id) && <span title="Identidade verificada pessoalmente" className="ml-1.5 font-normal text-ok">✓</span>}
                    {!fixo && membro.admin && <span className="ml-1.5 border border-rule px-1 text-[0.65rem] font-normal uppercase tracking-wide text-ink-soft">admin</span>}
                  </span>
                  <span className="block truncate text-xs text-ink-soft">
                    {presenca(membro.online, membro.visto_em)}
                    {!membro.eu && (
                      <>
                        {presenca(membro.online, membro.visto_em) ? " · " : ""}
                        <button type="button" className={elo} onClick={() => setSeguranca(seguranca?.usuario === membro.id ? null : { usuario: membro.id, nome: membro.nome })}>código de segurança</button>
                      </>
                    )}
                  </span>
                </span>
              </span>
              {pode && (
                <span className="flex shrink-0 gap-3 text-xs">
                  {membro.admin ? (
                    <button type="button" className={elo} onClick={() => void fazer("chat_grupo_mudar", { p_id: dados.id, p_tirar_admin: [membro.id] })}>{membro.eu ? "Deixar de administrar" : "Tirar de admin"}</button>
                  ) : (
                    <button type="button" className={elo} onClick={() => void fazer("chat_grupo_mudar", { p_id: dados.id, p_admins: [membro.id] })}>Tornar admin</button>
                  )}
                  {membro.id !== me.id && <button type="button" className={`${elo} text-oxblood`} onClick={() => void fazer("chat_grupo_mudar", { p_id: dados.id, p_tirar: [membro.id] })}>Tirar</button>}
                </span>
              )}
            </li>
          ))}
        </ul>
        {seguranca && (
          <div className="mt-3">
            <Seguranca chaveiro={chaveiro} conversa={conversa} usuario={seguranca.usuario} nome={seguranca.nome} fechar={() => setSeguranca(null)} />
          </div>
        )}
      </div>
      {pode && livres.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="block min-w-48 flex-1">
            Pôr mais alguém
            <select value={novo} onChange={(e) => setNovo(e.target.value)} className={campo}>
              <option value="">Escolha…</option>
              {livres.map((membro) => (
                <option key={membro.id} value={membro.id}>{membro.nome}</option>
              ))}
            </select>
          </label>
          <button type="button" className={botaoClaro} disabled={!novo} onClick={() => void fazer("chat_grupo_mudar", { p_id: dados.id, p_incluir: [novo] }, () => { setNovo(""); depois(); })}>Pôr no grupo</button>
        </div>
      )}
      {!fixo && (
        <p className="flex flex-wrap gap-5">
          <button type="button" className={elo} onClick={() => { if (window.confirm("Sair deste grupo?")) void fazer("chat_sair", { p_id: dados.id }, saiu); }}>Sair do grupo</button>
          {dados.dona && (
            <button type="button" className={`${elo} text-oxblood`} onClick={() => { if (window.confirm("Apagar o grupo e todas as mensagens dele? Isso não tem volta.")) void fazer("chat_grupo_apagar", { p_id: dados.id }, saiu); }}>
              Apagar o grupo
            </button>
          )}
        </p>
      )}
      <Aviso texto={aviso} />
    </div>
  );
}

/** O texto de um aviso do sistema, em português. */
function textoDoAviso(mensagem: Mensagem, me: Me): string {
  const d = mensagem.detalhe;
  if (!d) return "";
  const por = mensagem.autor === me.id ? "Você" : d.por || "Alguém";
  const alvo = d.alvo === me.id ? "você" : d.alvo_nome || "alguém";
  switch (d.evento) {
    case "criou": return `${por} criou o grupo`;
    case "nome": return `${por} mudou o nome do grupo para "${d.texto}"`;
    case "descricao": return `${por} mudou a descrição do grupo`;
    case "foto": return `${por} trocou a foto do grupo`;
    case "entrou": return `${por} pôs ${alvo} no grupo`;
    case "tirado": return `${por} tirou ${alvo} do grupo`;
    case "saiu": return `${por} saiu do grupo`;
    case "admin": return `${por} tornou ${alvo} administrador`;
    case "admin_tirado": return `${por} tirou ${alvo} de administrador`;
    case "so_admins_enviam": return `${por} definiu que só administradores mandam mensagem`;
    case "todos_enviam": return `${por} liberou as mensagens para todo mundo`;
    case "so_admins_mudam": return `${por} definiu que só administradores mudam o grupo`;
    case "todos_mudam": return `${por} liberou nome, descrição e foto para todo mundo`;
    case "autodestruicao": return d.texto === "0" || !d.texto ? `${por} desligou a autodestruição` : `${por} ligou a autodestruição: as mensagens somem em ${nomeDoPrazo(Number(d.texto)).toLowerCase()}`;
    default: return `${por}: ${d.evento}`;
  }
}

/** A foto de um grupo na lista: a mensagem com a imagem, aberta neste aparelho. */
function FotoDoGrupo({ chaveiro, conversa, foto, nome }: { chaveiro: Chaveiro; conversa: string; foto: NonNullable<Conversa["foto"]>; nome: string }) {
  const abertos = useAbertos(chaveiro, [{ id: foto.id, conversa, corpo: foto.corpo, contexto: contextoDaConversa(conversa, foto.autor ?? ""), autor: foto.autor }]);
  const conteudo = abertos[foto.id] ? desempacotar(abertos[foto.id]!.texto) : null;
  const anexo = conteudo?.anexos?.[0];
  if (!anexo || anexo.tipo !== "imagem") return <Rosto nome={nome} tipo="grupo" />;
  return (
    <span className="h-10 w-10 shrink-0 overflow-hidden [&_img]:h-10 [&_img]:w-10 [&_img]:object-cover [&_button]:block [&_span]:hidden">
      <AnexoVisto anexo={anexo} conversa={conversa} minha={false} />
    </span>
  );
}

/** Uma enquete: as opções, quantos votaram em cada e quem; a pessoa vota tocando (e troca o voto quando quiser). */
function EnqueteVista({ enquete, votos, minha, votar }: { enquete: Enquete; votos: Vista["votos"]; minha: boolean; votar: (opcoes: number[]) => void }) {
  const [quem, setQuem] = useState<number | null>(null);
  const meu = votos.find((voto) => voto.minha)?.opcoes ?? [];
  const total = votos.length;
  return (
    <div className={`my-1 border px-2 py-1.5 text-sm ${minha ? "border-parchment/40" : "border-rule bg-parchment"}`}>
      <p className="font-semibold">📊 {enquete.pergunta}</p>
      <p className="text-[0.7rem] opacity-70">{enquete.varias ? "Pode marcar mais de uma" : "Marque uma"} · {total} {total === 1 ? "voto" : "votos"}</p>
      <ul className="mt-1 space-y-1">
        {enquete.opcoes.map((opcao, i) => {
          const votaram = votos.filter((voto) => voto.opcoes.includes(i));
          const marcada = meu.includes(i);
          return (
            <li key={i}>
              <button type="button" className="relative block w-full cursor-pointer overflow-hidden border border-current/30 px-2 py-1 text-left" aria-pressed={marcada} onClick={() => votar(enquete.varias ? (marcada ? meu.filter((j) => j !== i) : [...meu, i]) : [i])}>
                <span className="absolute inset-y-0 left-0 bg-gold/30" style={{ width: `${total ? (votaram.length / total) * 100 : 0}%` }} />
                <span className="relative flex justify-between gap-2"><span>{marcada ? "◉ " : "○ "}{opcao}</span><span className="font-mono text-xs">{votaram.length}</span></span>
              </button>
              {votaram.length > 0 && (
                <button type="button" className="cursor-pointer text-[0.7rem] underline opacity-70" onClick={() => setQuem(quem === i ? null : i)}>{quem === i ? votaram.map((voto) => (voto.minha ? "você" : voto.nome)).join(", ") : "quem votou"}</button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Um evento com data, local e as respostas (vou, talvez, não) de cada pessoa. */
function EventoVista({ evento, rsvps, minha, responder }: { evento: Evento; rsvps: Vista["rsvps"]; minha: boolean; responder: (resposta: Rsvp) => void }) {
  const minhaResposta = rsvps.find((rsvp) => rsvp.minha)?.resposta;
  const quando = new Date(evento.quando);
  const grupos: [Rsvp, string][] = [["vou", "Vou"], ["talvez", "Talvez"], ["nao", "Não vou"]];
  return (
    <div className={`my-1 border px-2 py-1.5 text-sm ${minha ? "border-parchment/40" : "border-rule bg-parchment"}`}>
      <p className="font-semibold">📅 {evento.titulo}</p>
      <p className="text-xs">{quando.toLocaleString(localDoPainel(), { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}{evento.local ? ` · ${evento.local}` : ""}</p>
      <p className="mt-1 flex flex-wrap gap-1">
        {grupos.map(([valor, nome]) => (
          <button key={valor} type="button" aria-pressed={minhaResposta === valor} className={`cursor-pointer border px-2 py-0.5 text-xs ${minhaResposta === valor ? "border-gold bg-gold/30 text-ink" : "border-current/30"}`} onClick={() => responder(valor)}>
            {nome} ({rsvps.filter((rsvp) => rsvp.resposta === valor).length})
          </button>
        ))}
      </p>
      {rsvps.length > 0 && (
        <ul className="mt-1 text-[0.7rem] opacity-80">
          {grupos.map(([valor, nome]) => { const lista = rsvps.filter((rsvp) => rsvp.resposta === valor); return lista.length ? <li key={valor}>{nome}: {lista.map((rsvp) => (rsvp.minha ? "você" : rsvp.nome)).join(", ")}</li> : null; })}
        </ul>
      )}
    </div>
  );
}

function NovaEnquete({ fechar, criar }: { fechar: () => void; criar: (enquete: Enquete) => void }) {
  const [pergunta, setPergunta] = useState("");
  const [opcoes, setOpcoes] = useState(["", ""]);
  const [varias, setVarias] = useState(false);
  const validas = opcoes.map((opcao) => opcao.trim()).filter(Boolean);
  return (
    <form className="space-y-2 border-t border-rule bg-parchment p-3 text-sm" onSubmit={(e) => { e.preventDefault(); if (pergunta.trim() && validas.length >= 2) criar({ pergunta: pergunta.trim(), opcoes: validas, varias: varias || undefined }); }}>
      <p className="font-semibold">Nova enquete</p>
      <input value={pergunta} onChange={(e) => setPergunta(e.target.value)} maxLength={300} placeholder="Pergunta" aria-label="Pergunta" className={`${campo} mt-0`} required />
      {opcoes.map((opcao, i) => (
        <input key={i} value={opcao} onChange={(e) => setOpcoes(opcoes.map((atual, j) => (j === i ? e.target.value : atual)))} maxLength={100} placeholder={`Opção ${i + 1}`} aria-label={`Opção ${i + 1}`} className={`${campo} mt-0`} />
      ))}
      <p className="flex flex-wrap items-center gap-3">
        {opcoes.length < 12 && <button type="button" className={elo} onClick={() => setOpcoes([...opcoes, ""])}>+ opção</button>}
        <label className="flex cursor-pointer items-center gap-1"><input type="checkbox" checked={varias} onChange={(e) => setVarias(e.target.checked)} /> pode marcar mais de uma</label>
        <span className="flex-1" />
        <button type="submit" className={botao} disabled={!pergunta.trim() || validas.length < 2}>Enviar enquete</button>
        <button type="button" className={elo} onClick={fechar}>Cancelar</button>
      </p>
    </form>
  );
}

function NovoEvento({ fechar, criar }: { fechar: () => void; criar: (evento: Evento) => void }) {
  const [titulo, setTitulo] = useState("");
  const [quando, setQuando] = useState("");
  const [local, setLocal] = useState("");
  const valido = titulo.trim() && quando && !Number.isNaN(Date.parse(quando));
  return (
    <form className="space-y-2 border-t border-rule bg-parchment p-3 text-sm" onSubmit={(e) => { e.preventDefault(); if (valido) criar({ titulo: titulo.trim(), quando: new Date(quando).toISOString(), local: local.trim() || undefined }); }}>
      <p className="font-semibold">Novo evento</p>
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} placeholder="O que é (reunião, aula, ato…)" aria-label="Título do evento" className={`${campo} mt-0`} required />
      <div className="flex flex-wrap gap-2">
        <input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} aria-label="Data e hora" className={`${campo} mt-0 flex-1`} required />
        <input value={local} onChange={(e) => setLocal(e.target.value)} maxLength={200} placeholder="Local (opcional)" aria-label="Local" className={`${campo} mt-0 flex-1`} />
      </div>
      <p className="flex gap-3">
        <button type="submit" className={botao} disabled={!valido}>Enviar evento</button>
        <button type="button" className={elo} onClick={fechar}>Cancelar</button>
      </p>
    </form>
  );
}

/** Relatar à coordenação: a pessoa escolhe contra quem, diz o motivo e vê exatamente o que será aberto. */
function Relatar({ membros, escolhidas, fechar, enviar }: { membros: MembroDaConversa[]; escolhidas: { id: string; autor: string; quando: string; texto: string }[]; fechar: () => void; enviar: (contra: string | null, motivo: string, mensagens: typeof escolhidas) => void }) {
  const [contra, setContra] = useState("");
  const [motivo, setMotivo] = useState("");
  return (
    <form role="dialog" aria-label="Relatar à coordenação" className="space-y-2 border-t-2 border-ink bg-parchment p-3 text-sm" onSubmit={(e) => { e.preventDefault(); if (motivo.trim().length >= 2) enviar(contra || null, motivo.trim(), escolhidas); }}>
      <p className="font-semibold">Relatar à coordenação</p>
      <p className="text-xs text-ink-soft">As {escolhidas.length} mensagens escolhidas serão abertas por este aparelho e enviadas, em texto legível, só para quem gere a equipe (coordenação, vice e supervisão). É a única maneira de alguém de fora ler uma conversa: por sua decisão.</p>
      <label className="block">
        Sobre quem
        <select value={contra} onChange={(e) => setContra(e.target.value)} className={campo}>
          <option value="">Não é sobre uma pessoa específica</option>
          {membros.map((membro) => <option key={membro.id} value={membro.id}>{membro.nome}</option>)}
        </select>
      </label>
      <label className="block">
        O que aconteceu
        <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} minLength={2} maxLength={500} rows={2} className={campo} required />
      </label>
      <ul className="max-h-32 overflow-y-auto border border-rule bg-parchment-deep p-2 text-xs">
        {escolhidas.map((item) => <li key={item.id} className="truncate"><strong>{item.autor}</strong> ({hora(item.quando)}): {item.texto}</li>)}
      </ul>
      <p className="flex gap-3">
        <button type="submit" className={botao} disabled={motivo.trim().length < 2}>Enviar o relato</button>
        <button type="button" className={elo} onClick={fechar}>Cancelar</button>
      </p>
    </form>
  );
}

interface Relato {
  id: string;
  conversa_nome: string;
  autor: string;
  contra: string;
  motivo: string;
  mensagens: { id: string; autor: string; quando: string; texto: string }[];
  status: "aberto" | "resolvido";
  nota: string;
  criado_em: string;
}

/** Os relatos recebidos, para quem gere a equipe. */
function Relatos({ fechar }: { fechar: () => void }) {
  const lista = useLista<Relato[]>("chat_relatos");
  const [aviso, setAviso] = useState("");
  async function resolver(id: string) {
    const nota = window.prompt("O que foi feito? (fica registrado no relato)") ?? "";
    setAviso("");
    try { await rpc("chat_relato_resolver", { p_id: id, p_nota: nota }); lista.recarregar(); } catch (erro) { setAviso(textoDoErro(erro)); }
  }
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-2xl font-semibold">Relatos à coordenação</h2>
        <button type="button" className={elo} onClick={fechar}>Fechar</button>
      </div>
      <p className="mt-1 max-w-xl text-ink-soft">Mensagens que alguém da equipe decidiu abrir e mostrar à coordenação. Fora daqui, ninguém lê conversa dos outros, nem a coordenação.</p>
      <Aviso texto={lista.erro || aviso} />
      {lista.dados?.length === 0 && <p className="mt-3 text-ink-soft">Nenhum relato.</p>}
      <ul className="mt-3 space-y-3">
        {lista.dados?.map((relato) => (
          <li key={relato.id} className={`border p-3 ${relato.status === "aberto" ? "border-oxblood" : "border-rule opacity-80"}`}>
            <p className="text-xs text-ink-soft">{dataHora(relato.criado_em)} · {relato.conversa_nome} · relatado por {relato.autor || "alguém"}{relato.contra ? ` · sobre ${relato.contra}` : ""} · {relato.status === "aberto" ? "em aberto" : "resolvido"}</p>
            <p className="mt-1 font-semibold">{relato.motivo}</p>
            <ul className="mt-2 space-y-1 border-l-2 border-rule pl-2 text-sm">
              {relato.mensagens.map((item) => <li key={item.id}><strong>{item.autor}</strong> <span className="text-xs text-ink-soft">{item.quando ? dataHora(item.quando) : ""}</span>: <span className="whitespace-pre-line" data-original>{item.texto}</span></li>)}
            </ul>
            {relato.nota && <p className="mt-2 text-sm"><strong>Encaminhamento:</strong> {relato.nota}</p>}
            {relato.status === "aberto" && <button type="button" className={`mt-2 ${botaoClaro}`} onClick={() => void resolver(relato.id)}>Marcar como resolvido</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Para a coordenação: quem está em conversa privada com quem (nunca o conteúdo). */
function Privadas({ fechar }: { fechar: () => void }) {
  const lista = useLista<{ id: string; pessoas: string[]; movida_em: string; mensagens: number }[]>("chat_privadas");
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-2xl font-semibold">Conversas privadas em andamento</h2>
        <button type="button" className={elo} onClick={fechar}>Fechar</button>
      </div>
      <p className="mt-1 max-w-xl text-ink-soft">Quem está conversando em privado e quando foi a última mensagem. O conteúdo é cifrado: nem a coordenação lê.</p>
      <Aviso texto={lista.erro} />
      {lista.dados?.length === 0 && <p className="mt-3 text-ink-soft">Nenhuma conversa privada.</p>}
      <ul className="mt-3 divide-y divide-rule border-y border-rule">
        {lista.dados?.map((item) => (
          <li key={item.id} className="flex flex-wrap justify-between gap-2 py-2"><span>{item.pessoas.join(" e ")}</span><span className="text-xs text-ink-soft">{item.mensagens} mensagens · última {dataHora(item.movida_em)}</span></li>
        ))}
      </ul>
    </div>
  );
}

/** Criar um grupo: um nome e as pessoas. Dá para marcar de uma vez todo mundo de uma função. */
function NovoGrupo({ membros, fechar, criado }: { membros: Membro[]; fechar: () => void; criado: (id: string) => void }) {
  const { t } = useI18n();
  const [nome, setNome] = useState("");
  const [marcados, setMarcados] = useState<string[]>([]);
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const outros = membros.filter((membro) => !membro.eu);
  const funcoes = [...new Set(outros.flatMap((membro) => membro.papeis.map((papel) => papel.papel)))];
  const descricao = (membro: Membro) => [...new Set(membro.papeis.map((papel) => `${papeis[papel.papel]}${papel.disciplina ? ` de ${t.areas[papel.disciplina as keyof typeof t.areas]?.[0] ?? papel.disciplina}` : ""}`))].join(", ");

  async function criar() {
    setOcupado(true);
    setAviso("");
    try {
      criado((await rpc<{ id: string }>("chat_grupo_criar", { p_nome: nome, p_membros: marcados })).id);
    } catch (erro) {
      setAviso(textoDoErro(erro));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4" onSubmit={(e) => { e.preventDefault(); void criar(); }}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-2xl font-semibold">Novo grupo</h2>
        <button type="button" className={elo} onClick={fechar}>Cancelar</button>
      </div>
      <p className="max-w-xl text-ink-soft">Cada função já tem o próprio grupo, com todo mundo dela. Crie um grupo novo para um projeto ou uma turma de trabalho.</p>
      <label className="block max-w-md">
        Nome do grupo
        <input value={nome} onChange={(e) => setNome(e.target.value)} required minLength={2} maxLength={60} placeholder="Ex.: Aulas de frações" className={campo} />
      </label>
      <div>
        <p className={rotulo}>Marcar todo mundo de uma função</p>
        <p className="mt-2 flex flex-wrap gap-2">
          {funcoes.map((funcao) => (
            <button
              key={funcao}
              type="button"
              className="cursor-pointer border border-rule bg-parchment-deep px-3 py-1 hover:border-ink"
              onClick={() => setMarcados([...new Set([...marcados, ...outros.filter((membro) => membro.papeis.some((papel) => papel.papel === funcao)).map((membro) => membro.id)])])}
            >
              {papeis[funcao]}
            </button>
          ))}
        </p>
      </div>
      <fieldset>
        <legend className={rotulo}>Quem entra ({marcados.length})</legend>
        <ul className="mt-2 divide-y divide-rule border-y border-rule">
          {outros.map((membro) => (
            <li key={membro.id}>
              <label className="flex cursor-pointer items-center gap-3 py-2">
                <input type="checkbox" className="h-4 w-4" checked={marcados.includes(membro.id)} onChange={(e) => setMarcados(e.target.checked ? [...marcados, membro.id] : marcados.filter((item) => item !== membro.id))} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{membro.nome}</span>
                  <span className="block truncate text-xs text-ink-soft">{descricao(membro)}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <button type="submit" className={botao} disabled={ocupado || nome.trim().length < 2 || marcados.length === 0}>Criar grupo</button>
      <Aviso texto={aviso} />
    </form>
  );
}
