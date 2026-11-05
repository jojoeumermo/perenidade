// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  Archive, ArrowLeft, AtSign, BarChart3, Ban, Bold, Italic, Paperclip, CalendarDays, Camera, Check, CheckCheck, ChevronDown, Circle, CircleDot, Clock, Code, Ellipsis, ExternalLink, EyeOff, Forward, Hash, List, Lock, LogOut, Maximize2, MessageSquare, Mic, Pencil, Phone, PhoneOff, Pin, Plus, Quote, Reply, Search, Send, SendHorizontal, Settings, ShieldCheck, Smile, Star, StarOff, SunMoon, Trash2, UserMinus, UserPlus, Users, Volume2, X,
  type LucideIcon,
} from "lucide-react";
import { can, leads, manages, rpc, type Me } from "@/lib/backend";
import { JITSI_DOMINIO } from "@/lib/jitsi";
import { buscar, desindexar, indexar, type Indexada } from "@/lib/busca-local";
import type { Chaveiro } from "@/lib/chaveiro";
import { type Citacao, type Conteudo, desempacotar, empacotar, type Enquete, type Evento, extrairMencoes, linksDe, previaDoLink, reacoes, type Rsvp, semFormatacao, trechoDe } from "@/lib/mensagem";
import { conversaDestravada, destravar, estaDestravado, travaDisponivel, travaLigada } from "@/lib/trava";
import { contextoDaConversa } from "@/lib/sigilo";
import { getItem, setItem } from "@/lib/storage";
import { useI18n } from "../I18n";
import { JitsiSala } from "../JitsiSala";
import { agirOtimista, Aviso, campo, dataHora, localDoPainel, papeis, rotulo, textoDoErro, useLista } from "./comum";
import { Avatar } from "./Avatar";
import type { Membro } from "./Equipe";
import { Formatado } from "./Formatado";
import { Amigos, Bolinha, CartaoDePerfil, COMANDOS, ConviteDoGrupo, CORES_DE_PRESENCA, EntrarPorConvite, MeuStatus, type Presenca, rodarComando } from "./ConversasStoat";
import { EmojiDaReacao } from "./EmojiDoInstituto";
import { AnexoVisto, type EstadoDoAnexo, Galeria, Gravador, type ItemDaGaleria, Preparados, type Preparado, preparar, soltar, subir } from "./Anexos";
import { Alertas, AparelhoPendente, Aparelhos, ComoFunciona, enviarCifrado, Seguranca, TextoAberto, useAbertos, useChaveiro } from "./Sigilo";
import { AbrirAgora, baixarIcs, Historico, NovaReuniao, type Proposta as PropostaDeReuniao, Propostas, type Reuniao, tipos as tiposDeReuniao } from "./Reunioes";
import { Abas, Botao, CabecalhoDeSecao, type ComandoDoComposer, Composer, Contador, Esqueleto, Faixa, Lista, MenuSuspenso, PaineisAjustaveis, Selo, Vazio, confirmarFrase, perguntarTexto, useComandosDaSecao } from "./ui";

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

function Rosto({ nome, online = false, tipo = "direta", avatar, pequeno = false }: { nome: string; online?: boolean; tipo?: Tipo; avatar?: string | null; pequeno?: boolean }) {
  const tamanho = pequeno ? "h-8 w-8" : "h-10 w-10";
  if (tipo === "direta") {
    return (
      <span className="relative shrink-0">
        <Avatar nome={nome} avatar={avatar} className={`${tamanho} rounded-full`} />
        {online && <span title="online" className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-s-lado bg-s-ok" />}
      </span>
    );
  }
  return (
    <span className="relative shrink-0">
      <span aria-hidden className={`flex ${tamanho} items-center justify-center rounded-full font-semibold ${tipo === "departamento" ? "bg-s-acento text-[var(--pn-sobre-destaque)]" : "bg-s-campo text-s-texto"}`}><Hash className="h-4 w-4" /></span>
      {online && <span title="online" className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-s-lado bg-s-ok" />}
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

/** Os ícones da sala, todos do Lucide (traço de 1,8 px, como o resto do painel). */
const ICONES_DA_SALA = {
  conversa: MessageSquare,
  estrela: Star,
  mais: Plus,
  agenda: CalendarDays,
  voz: Volume2,
  engrenagem: Settings,
  cerquilha: Hash,
  cadeado: Lock,
  pessoas: Users,
  alfinete: Pin,
  seta: ChevronDown,
  sair: LogOut,
  ampliar: Maximize2,
  menu: Ellipsis,
  sol: SunMoon,
  escudo: ShieldCheck,
  telefone: Phone,
  camera: Camera,
  desligar: PhoneOff,
  responder: Reply,
  encaminhar: Forward,
  rosto: Smile,
  lapis: Pencil,
  lixo: Trash2,
  relogio: Clock,
  bloqueio: Ban,
  enquete: BarChart3,
  enviar: SendHorizontal,
  microfone: Mic,
} satisfies Record<string, LucideIcon>;
function IconeDaSala({ nome, className = "h-5 w-5" }: { nome: keyof typeof ICONES_DA_SALA; className?: string }) {
  const Simbolo = ICONES_DA_SALA[nome];
  return <Simbolo className={className} strokeWidth={1.8} aria-hidden="true" />;
}

const CHAVE_DO_TEMA_DA_SALA = "lucia:salas-tema";
type TemaDaSala = "painel" | "stoat" | "escuro" | "pergaminho";

/**
 * O tema "painel" (o padrão do redesenho): a sala usa os tokens do painel, o papel quente e a tinta do Instituto, e
 * acompanha o claro e o escuro da casca. Só nomes de token: nenhuma cor escrita à mão.
 */
const SALA_COM_O_PAINEL = {
  "--s-trilho": "var(--pn-ativo)",
  "--s-lado": "var(--pn-superficie-2)",
  "--s-chat": "var(--pn-fundo)",
  "--s-campo": "var(--pn-superficie)",
  "--s-hover": "color-mix(in srgb, var(--pn-texto) 5%, transparent)",
  "--s-ativo": "color-mix(in srgb, var(--pn-destaque-vivo) 12%, transparent)",
  "--s-linha": "var(--pn-borda)",
  "--s-texto": "var(--pn-texto)",
  "--s-suave": "var(--pn-texto-suave)",
  "--s-mudo": "var(--pn-texto-mudo)",
  "--s-acento": "var(--pn-destaque)",
  "--s-acento-suave": "var(--pn-destaque-vivo)",
  "--s-ouro": "var(--pn-ouro)",
  "--s-mencao": "color-mix(in srgb, var(--pn-ouro) 14%, transparent)",
  "--s-ok": "var(--pn-ok)",
  "--s-folha": "var(--pn-superficie)",
  "--s-sombra": "transparent",
  "--s-azul": "var(--pn-info)",
  "--s-verde": "var(--pn-ok)",
  colorScheme: "inherit",
} as CSSProperties;

/** Nos outros temas da sala (Noite, Papel, Stoat), os componentes do painel (ui/) seguem as cores da sala. */
const PAINEL_NA_SALA = {
  "--pn-fundo": "var(--s-chat)",
  "--pn-superficie": "var(--s-folha)",
  "--pn-superficie-2": "var(--s-lado)",
  "--pn-ativo": "var(--s-ativo)",
  "--pn-borda": "var(--s-linha)",
  "--pn-borda-forte": "var(--s-linha)",
  "--pn-texto": "var(--s-texto)",
  "--pn-texto-suave": "var(--s-suave)",
  "--pn-texto-mudo": "var(--s-mudo)",
  "--pn-destaque": "var(--s-acento)",
  "--pn-destaque-vivo": "var(--s-acento-suave)",
  "--pn-destaque-suave": "var(--s-campo)",
  "--pn-ouro": "var(--s-ouro)",
  "--pn-ok": "var(--s-ok)",
  "--pn-info": "var(--s-azul)",
  "--pn-foco": "var(--s-ouro)",
  // As cores antigas do site (text-ink-soft, border-rule, bg-parchment…) que ainda passam pelas telas da sala: a ponte
  // do painel as resolve no .painel, com as cores da casca; aqui elas passam a seguir a sala (senão, no tema Noite, o
  // texto suave do papel claro cairia sobre o fundo escuro).
  "--parchment": "var(--s-chat)",
  "--parchment-deep": "var(--s-lado)",
  "--folha": "var(--s-folha)",
  "--ink": "var(--s-texto)",
  "--ink-soft": "var(--s-suave)",
  "--rule": "var(--s-linha)",
  "--oxblood": "var(--s-acento-suave)",
  "--gold": "var(--s-ouro)",
  "--ok": "var(--s-ok)",
} as CSSProperties;

const estiloDaSala = (tema: TemaDaSala) => (tema === "painel" ? SALA_COM_O_PAINEL : PAINEL_NA_SALA);

/** As colunas ajustáveis só a partir de 64 rem; abaixo, uma coluna de cada vez (como antes). */
function useLargo() {
  return useSyncExternalStore(
    (avisar) => {
      const consulta = window.matchMedia("(min-width: 64rem)");
      consulta.addEventListener("change", avisar);
      return () => consulta.removeEventListener("change", avisar);
    },
    () => window.matchMedia("(min-width: 64rem)").matches,
    () => true,
  );
}

/** Os menus que abrem dentro da sala (opções do canal, anexar): o desenho do MenuSuspenso do painel. */
const MENU_DA_SALA = "pn-menu-suspenso absolute z-30";
const ITEM_DA_SALA = "pn-menu-suspenso-item w-full cursor-pointer text-left hover:bg-[var(--pn-ativo)] focus-visible:bg-[var(--pn-ativo)]";

/** A hora de agora, para os avisos de "digitando" (só chamada nos eventos: tecla, envio, saída do campo). */
const relogioDeParede = () => Date.now();

/** Uma linha nova antes do que o comando põe, se o texto já tem algo na linha de agora. */
const linhaNova = (texto: string) => (texto && !texto.endsWith("\n") ? `${texto}\n` : texto);

/** Os comandos de formatação do campo de mensagem ("/" no começo da linha). A saída é o texto simples de sempre. */
const COMANDOS_DE_FORMATO: ComandoDoComposer[] = [
  { id: "resposta", nome: "Citação", sobre: "> trecho citado", simbolo: Quote, inserir: (t) => `${linhaNova(t)}> ` },
  { id: "lista", nome: "Lista", sobre: "- item", simbolo: List, inserir: (t) => `${linhaNova(t)}- ` },
  { id: "código", nome: "Bloco de código", sobre: "``` código ```", simbolo: Code, inserir: (t) => `${linhaNova(t)}\`\`\`\n` },
  { id: "spoiler", nome: "Spoiler", sobre: "||texto escondido||", simbolo: EyeOff, inserir: (t) => `${t}||` },
  { id: "menção", nome: "Mencionar alguém", sobre: "@nome", simbolo: AtSign, inserir: (t) => `${t}${t && !/\s$/.test(t) ? " " : ""}@` },
];

/** Uma chamada de voz ou de vídeo num canal: a reunião ao vivo ligada à conversa, com quem está nela agora. */
type ChamadaDoCanal = Reuniao & { conversa: string; video: boolean; na_sala: { id: string; nome: string }[] };
type Espaco = "instituto" | "diretas";
type Tela = "conversa" | "grupo" | "favoritas" | "relatos" | "privadas" | "agenda" | "reuniao" | "seguranca";

/**
 * As conversas e as reuniões da equipe, num lugar só, no jeito do Discord: o trilho com os espaços (mensagens diretas e
 * o Instituto), a lista de canais (departamentos, grupos e as reuniões como canais de voz), a conversa no meio e quem
 * está por aqui do lado. Tudo o que se escreve é cifrado de ponta a ponta neste aparelho; a reunião é pelo Jitsi, e a
 * chamada continua ligada (num quadrinho) enquanto a pessoa lê e escreve nos canais.
 */
export function Conversas({ me, inicial }: { me: Me; inicial?: "reunioes" }) {
  const { lang } = useI18n();
  const { chaveiro, erro } = useChaveiro(me.id);
  const lista = useLista<Conversa[]>("chat_conversas");
  const membros = useLista<Membro[]>("equipe_membros");
  const reunioes = useLista<Reuniao[]>("reunioes_listar");
  const propostasDeReuniao = useLista<PropostaDeReuniao[]>("reunioes_propostas");
  const gereReunioes = can(me, "coordenacao", "supervisao");
  const [espaco, setEspaco] = useState<Espaco>("instituto");
  const [aberta, setAberta] = useState<string | null>(null);
  const [tela, setTela] = useState<Tela>(inicial === "reunioes" ? "agenda" : "conversa");
  const [reuniaoVista, setReuniaoVista] = useState<string | null>(null);
  const [chamada, setChamada] = useState<Reuniao | null>(null);
  const [lugarDaChamada, setLugarDaChamada] = useState<HTMLDivElement | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todas" | "nao_lidas" | "fixadas">("todas");
  const [arquivadas, setArquivadas] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [menuDoEspaco, setMenuDoEspaco] = useState(false);
  const [recolhidas, setRecolhidas] = useState<string[]>([]);
  const [achadas, setAchadas] = useState<Indexada[]>([]);
  const [aviso, setAviso] = useState("");
  // O padrão é o tema do painel (papel e tinta do Instituto); Noite, Papel e Stoat ficam na troca de tema.
  const [tema, setTema] = useState<TemaDaSala>(() => {
    const guardado = getItem(CHAVE_DO_TEMA_DA_SALA);
    return guardado === "pergaminho" || guardado === "stoat" || guardado === "escuro" ? guardado : "painel";
  });
  const largo = useLargo();
  // A terceira coluna (membros do grupo) começa aberta nas telas largas, como no Discord; dá para recolher.
  const [membrosAbertos, setMembrosAbertos] = useState(() => typeof window !== "undefined" && window.innerWidth >= 1280);
  const [lugarDosMembros, setLugarDosMembros] = useState<HTMLDivElement | null>(null);
  // As chamadas acontecendo agora nas minhas conversas (como os canais de voz do Discord).
  const chamadas = useLista<ChamadaDoCanal[]>("chat_chamadas");
  const [lugarNaConversa, setLugarNaConversa] = useState<HTMLDivElement | null>(null);
  const [chamadasVistas, setChamadasVistas] = useState<string[]>([]);
  const [meuStatus, setMeuStatus] = useState(false);
  const [minhaPresenca, setMinhaPresenca] = useState<Presenca>("online");
  useEffect(() => {
    rpc<{ presenca: Presenca }>("chat_perfil_meu").then((r) => setMinhaPresenca(r.presenca)).catch(() => undefined);
  }, []);
  const [trava, setTrava] = useState<"conferindo" | "travada" | "aberta">(() => (travaLigada() && !estaDestravado() ? "travada" : "aberta"));
  const [pedindoTrava, setPedindoTrava] = useState<string | null>(null);
  const [agora] = useState(() => Date.now());
  useRelogio(lista.recarregar, 8000);
  useRelogio(membros.recarregar, 30000);
  useRelogio(reunioes.recarregar, 30000);
  useRelogio(chamadas.recarregar, 10000);
  // Enquanto a pessoa está numa chamada, o sinal de vida a cada 30 segundos (quem fecha a aba sem sair para de contar).
  const idDaChamada = chamada?.id;
  useEffect(() => {
    if (!idDaChamada) return;
    const relogio = window.setInterval(() => void rpc("reuniao_presenca", { p_id: idDaChamada, p_entrou: true }).catch(() => undefined), 30000);
    return () => window.clearInterval(relogio);
  }, [idDaChamada]);
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

  // ───── Optimistic UI: fixar, arquivar, silenciar e marcar como lida mudam a lista na hora ─────
  /** O que cada campo de chat_conversa_marcar muda na linha da conversa (para a tela mudar antes de o banco responder). */
  const efeitoDe = (campos: Record<string, unknown>): Partial<Conversa> => ({
    ...(typeof campos.p_fixar === "boolean" ? { fixada: campos.p_fixar } : {}),
    ...(typeof campos.p_arquivar === "boolean" ? { arquivada: campos.p_arquivar } : {}),
    ...(typeof campos.p_nao_lida === "boolean" ? { marcada_nao_lida: campos.p_nao_lida } : {}),
    ...(typeof campos.p_silenciar_horas === "number" ? { silenciada: campos.p_silenciar_horas > 0 } : {}),
  });
  const marcarOtimista = (conversa: Conversa, campos: Record<string, unknown>) =>
    agirOtimista<Conversa[]>({
      lista: { funcao: "chat_conversas" },
      remendo: (dados) => dados.map((c) => (c.id === conversa.id ? { ...c, ...efeitoDe(campos) } : c)),
      funcao: "chat_conversa_marcar",
      argumentos: { p_id: conversa.id, ...campos },
    });
  /** Marcar como lida é abrir a conversa no banco (chat_ver), como sempre; a contagem some na hora. */
  const lerOtimista = (conversa: Conversa) =>
    agirOtimista<Conversa[]>({
      lista: { funcao: "chat_conversas" },
      remendo: (dados) => dados.map((c) => (c.id === conversa.id ? { ...c, nao_lidas: 0, marcada_nao_lida: false } : c)),
      funcao: "chat_ver",
      argumentos: { p_id: conversa.id },
    });

  // A paleta (Ctrl K) ganha os comandos da conversa aberta: marcar como lida, silenciar, fixar e arquivar, sem mouse.
  const conversaAberta = tela === "conversa" && aberta ? (lista.dados ?? []).find((c) => c.id === aberta) : undefined;
  const pendenteNaAberta = Boolean(conversaAberta && (conversaAberta.marcada_nao_lida || conversaAberta.nao_lidas > 0));
  useComandosDaSecao(
    conversaAberta
      ? [
          pendenteNaAberta
            ? { id: "conversa-ler", nome: "Marcar como lida", sobre: conversaAberta.nome, simbolo: MessageSquare, fazer: () => void lerOtimista(conversaAberta) }
            : { id: "conversa-nao-lida", nome: "Marcar como não lida", sobre: conversaAberta.nome, simbolo: MessageSquare, fazer: () => void marcarOtimista(conversaAberta, { p_nao_lida: true }) },
          conversaAberta.silenciada
            ? { id: "conversa-som", nome: "Tirar o silêncio", sobre: conversaAberta.nome, simbolo: Volume2, fazer: () => void marcarOtimista(conversaAberta, { p_silenciar_horas: 0 }) }
            : { id: "conversa-silenciar", nome: "Silenciar por 8 horas", sobre: conversaAberta.nome, simbolo: Volume2, fazer: () => void marcarOtimista(conversaAberta, { p_silenciar_horas: 8 }) },
          { id: "conversa-fixar", nome: conversaAberta.fixada ? "Desafixar" : "Fixar no alto", sobre: conversaAberta.nome, simbolo: Pin, fazer: () => void marcarOtimista(conversaAberta, { p_fixar: !conversaAberta.fixada }) },
          { id: "conversa-arquivar", nome: conversaAberta.arquivada ? "Desarquivar" : "Arquivar", sobre: conversaAberta.nome, simbolo: Archive, fazer: () => void marcarOtimista(conversaAberta, { p_arquivar: !conversaAberta.arquivada }) },
          ...(conversaAberta.tipo !== "direta" ? [{ id: "conversa-membros", nome: "Membros", sobre: conversaAberta.nome, simbolo: Users, fazer: () => setMembrosAbertos((v) => !v) }] : []),
        ]
      : [],
    [conversaAberta?.id, pendenteNaAberta, conversaAberta?.silenciada, conversaAberta?.fixada, conversaAberta?.arquivada],
  );

  if (erro) return <Faixa tom="erro">{erro}</Faixa>;
  if (!chaveiro) return <Esqueleto forma="fila" rotulo="Preparando a chave deste aparelho…" />;
  // Aparelho ainda não aprovado: nada abre aqui até um aparelho já aprovado da pessoa conferir o código.
  if (chaveiro.estado !== "aprovado") return <div className="pn-cartao m-4"><AparelhoPendente chaveiro={chaveiro} /></div>;
  if (trava !== "aberta") {
    return (
      <div className="salas m-4 p-8 text-center" data-tema={tema} style={estiloDaSala(tema)}>
        <Lock aria-hidden className="mx-auto mb-3 h-8 w-8 text-s-acento-suave" />
        <p className="font-serif text-2xl font-semibold">Conversas trancadas</p>
        <p className="mx-auto mt-2 max-w-md text-s-suave">Você pediu a digital para abrir as conversas neste aparelho. Confirme no leitor do aparelho para continuar.</p>
        <Botao variante="principal" className="mt-4" carregando={trava === "conferindo"} disabled={trava === "conferindo"} onClick={() => { setTrava("conferindo"); void destravar().then((ok) => setTrava(ok ? "aberta" : "travada")); }}>
          {trava === "conferindo" ? "Conferindo…" : "Destravar com a digital"}
        </Botao>
      </div>
    );
  }

  const termo = busca.trim().toLowerCase();
  const todas = lista.dados ?? [];
  const passaNoFiltro = (conversa: Conversa) => {
    if (conversa.arquivada !== arquivadas) return false;
    if (filtro === "nao_lidas") return conversa.nao_lidas > 0 || conversa.marcada_nao_lida;
    if (filtro === "fixadas") return conversa.fixada;
    return true;
  };
  const ordenar = (a: Conversa, b: Conversa) => Number(b.fixada) - Number(a.fixada) || (b.ultima?.criado_em ?? "").localeCompare(a.ultima?.criado_em ?? "");
  const departamentos = todas.filter((c) => c.tipo === "departamento" && passaNoFiltro(c)).sort((a, b) => (a.departamento === "geral" ? -1 : b.departamento === "geral" ? 1 : a.nome.localeCompare(b.nome, "pt")));
  const grupos = todas.filter((c) => c.tipo === "grupo" && passaNoFiltro(c)).sort(ordenar);
  const diretas = todas.filter((c) => c.tipo === "direta" && passaNoFiltro(c)).sort(ordenar);
  const achadasPorNome = termo ? todas.filter((c) => c.nome.toLowerCase().includes(termo)) : [];
  const quantasArquivadas = todas.filter((conversa) => conversa.arquivada).length;
  const pendentesEm = (lista_: Conversa[]) => lista_.reduce((n, c) => n + (c.silenciada ? 0 : c.nao_lidas || (c.marcada_nao_lida ? 1 : 0)), 0);
  const naoLidasDiretas = pendentesEm(todas.filter((c) => c.tipo === "direta" && !c.arquivada));
  const naoLidasInstituto = pendentesEm(todas.filter((c) => c.tipo !== "direta" && !c.arquivada));
  const listaDeReunioes = reunioes.dados ?? [];
  const aoVivo = listaDeReunioes.filter((r) => r.status === "ao_vivo");
  const proximas = listaDeReunioes.filter((r) => r.status === "agendada" && new Date(r.inicio).getTime() > agora - 3600_000).sort((a, b) => a.inicio.localeCompare(b.inicio));
  const passadas = listaDeReunioes.filter((r) => r.status === "encerrada" || r.status === "cancelada" || (r.status === "agendada" && new Date(r.inicio).getTime() <= agora - 3600_000));
  const canaisDeVoz = [...aoVivo, ...proximas.slice(0, 6)];
  const propostasPendentes = (propostasDeReuniao.dados ?? []).filter((p) => p.status === "pendente").length;
  const reuniaoAberta = listaDeReunioes.find((r) => r.id === reuniaoVista) ?? null;
  const euMembro = (membros.dados ?? []).find((m) => m.eu);
  const listaDeChamadas = chamadas.dados ?? [];
  const chamadaDe = (conversa: string) => listaDeChamadas.find((c) => c.conversa === conversa);
  // A chamada que alguém acabou de começar numa conversa minha e eu ainda não vi: vira o convite no alto da sala.
  const chamadaNova = listaDeChamadas.find((c) => c.organizador.id !== me.id && chamada?.id !== c.id && !chamadasVistas.includes(c.id) && !c.na_sala.some((p) => p.id === me.id));
  const nomeDaConversa = (id: string) => todas.find((c) => c.id === id)?.nome ?? "";

  /** Abrir uma conversa trancada pede a digital (uma vez por alguns minutos). */
  async function abrirConversa(conversa: Conversa) {
    setTela("conversa");
    setMenu(null);
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
    // Fixar, arquivar, silenciar e não lida: simples e reversíveis, a lista muda na hora (Optimistic UI).
    if (campos.p_trancar === undefined) {
      await marcarOtimista(conversa, campos);
      return;
    }
    try {
      if (campos.p_trancar === true && !(await travaDisponivel())) { setAviso("Este aparelho não tem digital cadastrada: cadastre em Minha conta → Entrar com a digital."); return; }
      await rpc("chat_conversa_marcar", { p_id: conversa.id, ...campos });
      lista.recarregar();
    } catch (erro) {
      setAviso(textoDoErro(erro));
    }
  }
  const comConversa = new Set(todas.flatMap((conversa) => (conversa.outro ? [conversa.outro] : [])));
  // Privado só para trabalho: a lista traz só com quem o servidor deixa abrir (liderança ou colaboração em andamento).
  const pessoas = (membros.dados ?? []).filter((membro) => !membro.eu && membro.privado && (termo ? membro.nome.toLowerCase().includes(termo) : !comConversa.has(membro.id)));

  async function conversarCom(usuario: string) {
    setAviso("");
    try {
      const { id } = await rpc<{ id: string }>("chat_direta", { p_usuario: usuario });
      setBusca("");
      setEspaco("diretas");
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
    const ab = previas[`${conversa.id}:${conversa.ultima.criado_em}`];
    if (!ab) return { texto: `${quem}${conversa.ultima.corpo.startsWith("c1.") ? "mensagem antiga" : "…"}`, mencao: false };
    const conteudo = desempacotar(ab.texto);
    const arquivo = conteudo.anexos?.length ? `${{ imagem: "Foto", video: "Vídeo", audio: "Áudio", pdf: "PDF", docx: "Documento" }[conteudo.anexos[0].tipo]}${conteudo.anexos.length > 1 ? ` +${conteudo.anexos.length - 1}` : ""}${conteudo.texto ? " · " : ""}` : "";
    const especial = conteudo.enquete ? `Enquete: ${conteudo.enquete.pergunta}` : conteudo.evento ? `Evento: ${conteudo.evento.titulo}` : conteudo.grupo_foto ? "Foto do grupo" : "";
    return { texto: `${quem}${conteudo.encaminhada ? "↪ " : ""}${arquivo}${especial || semFormatacao(conteudo.texto)}`, mencao: Boolean(conteudo.mencoes?.includes(me.id)) && !conversa.ultima.minha };
  }

  // ───── Reuniões como canais de voz ─────
  async function entrarNaChamada(r: Reuniao) {
    setChamada(r);
    const doCanal = (r as Partial<ChamadaDoCanal>).conversa;
    if (doCanal) {
      // A chamada de um canal abre em cima das mensagens daquele canal, como uma ligação no Discord.
      setChamadasVistas((vistas) => [...vistas, r.id]);
      setTela("conversa");
      setAberta(doCanal);
    } else {
      setReuniaoVista(r.id);
      setTela("reuniao");
      setAberta(null);
    }
    try {
      await rpc("reuniao_presenca", { p_id: r.id, p_entrou: true });
    } catch {
      // a presença é um registro; a sala abre mesmo assim
    }
  }
  async function sairDaChamada() {
    const r = chamada;
    setChamada(null);
    if (r) {
      try {
        await rpc("reuniao_presenca", { p_id: r.id, p_entrou: false });
      } catch {
        // idem
      }
      reunioes.recarregar();
      chamadas.recarregar();
    }
  }
  /** Começar uma chamada de voz ou de vídeo na conversa (todo mundo dela é avisado) e já entrar nela. */
  async function iniciarChamada(conversa: string, video: boolean) {
    setAviso("");
    try {
      const r = await rpc<ChamadaDoCanal>("chat_chamada_iniciar", { p_conversa: conversa, p_video: video });
      chamadas.recarregar();
      await entrarNaChamada(r);
    } catch (erro) {
      setAviso(textoDoErro(erro));
    }
  }
  async function mudarEstado(r: Reuniao, status: Reuniao["status"], mensagem: string) {
    setAviso("");
    try {
      await rpc("reuniao_estado", { p_id: r.id, p_status: status });
      setAviso(mensagem);
      reunioes.recarregar();
      if (chamada?.id === r.id) setChamada({ ...r, status });
      if (status === "encerrada" && chamada?.id === r.id) void sairDaChamada();
    } catch (erro) {
      setAviso(textoDoErro(erro));
    }
  }
  const abrirReuniao = (r: Reuniao) => { setReuniaoVista(r.id); setTela("reuniao"); setAberta(null); };
  // Instituto (o padrão) → Noite → Papel → Stoat → Instituto.
  const trocarTema = () => setTema((t) => { const novo: TemaDaSala = t === "painel" ? "escuro" : t === "escuro" ? "pergaminho" : t === "pergaminho" ? "stoat" : "painel"; setItem(CHAVE_DO_TEMA_DA_SALA, novo === "painel" ? null : novo); return novo; });

  const aberto = tela !== "conversa" || aberta !== null;
  const linhaDeCanal = (conversa: Conversa) => (
    <LinhaDeCanal
      key={conversa.id}
      conversa={conversa}
      ativa={tela === "conversa" && aberta === conversa.id}
      previa={previa(conversa)}
      chaveiro={chaveiro}
      pedindoTrava={pedindoTrava === conversa.id}
      menuAberto={menu === conversa.id}
      chamada={chamadaDe(conversa.id)}
      estouNaChamada={Boolean(chamada && chamada.id === chamadaDe(conversa.id)?.id)}
      entrarNaChamada={() => { const c = chamadaDe(conversa.id); if (c) void entrarNaChamada(c); }}
      abrir={() => void abrirConversa(conversa)}
      alternarMenu={() => setMenu(menu === conversa.id ? null : conversa.id)}
      marcar={(campos) => {
        if (campos.__ler) { setMenu(null); void lerOtimista(conversa); return; }
        void marcar(conversa, campos);
      }}
    />
  );
  const categoria = (id: string, titulo: string, conteudo: ReactNode, acao?: { rotulo: string; fazer: () => void }) => (
    <div className="mt-5 first:mt-2">
      <div className="group flex items-center justify-between px-2">
        <button type="button" className="salas-rot flex cursor-pointer items-center gap-1 text-s-mudo hover:text-s-texto" aria-expanded={!recolhidas.includes(id)} onClick={() => setRecolhidas((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]))}>
          <IconeDaSala nome="seta" className={`h-3 w-3 transition-transform motion-reduce:transition-none ${recolhidas.includes(id) ? "-rotate-90" : ""}`} />
          {titulo}
        </button>
        {acao && <Botao variante="discreto" pequeno icone simbolo={Plus} aria-label={acao.rotulo} dica={acao.rotulo} onClick={acao.fazer} />}
      </div>
      {!recolhidas.includes(id) && <Lista rotulo={titulo} plana className="mt-0.5 gap-px">{conteudo}</Lista>}
    </div>
  );

  // A terceira coluna (membros do grupo aberto): só nas telas largas, recolhível pelo botão de membros ou pela paleta.
  const comMembros = largo && membrosAbertos && tela === "conversa" && Boolean(conversaAberta && conversaAberta.tipo !== "direta");

  // Trilho: os espaços, as reuniões ao vivo e os atalhos (só nas telas largas, ao lado dos canais).
  const trilho = (
      <nav aria-label="Espaços" className="salas-rolagem flex w-[4.5rem] shrink-0 flex-col items-center gap-2 overflow-y-auto border-r border-s-linha bg-s-trilho py-3">
        <BotaoDoTrilho rotulo="Mensagens diretas" ativo={espaco === "diretas"} conta={naoLidasDiretas} fazer={() => { setEspaco("diretas"); setTela("conversa"); setAberta(null); }}>
          <IconeDaSala nome="conversa" className="h-6 w-6" />
        </BotaoDoTrilho>
        <span className="h-0.5 w-8 rounded bg-s-linha" aria-hidden="true" />
        <BotaoDoTrilho rotulo="Instituto Lúcia" ativo={espaco === "instituto"} conta={naoLidasInstituto} marca fazer={() => { setEspaco("instituto"); setTela("conversa"); setAberta(null); }}>
          {/* A marca original, sem redesenho: o espaço do instituto é ela. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/marca-96.png" alt="" className="h-12 w-12 rounded-full" />
        </BotaoDoTrilho>
        {listaDeChamadas.map((c) => (
          <BotaoDoTrilho key={c.id} rotulo={`${c.video ? "Chamada de vídeo" : "Chamada de voz"} em ${nomeDaConversa(c.conversa) || c.titulo} · ${c.na_sala.length} na chamada`} ativo={chamada?.id === c.id} vivo fazer={() => { if (chamada?.id === c.id) { setTela("conversa"); setAberta(c.conversa); } else void entrarNaChamada(c); }}>
            <IconeDaSala nome={c.video ? "camera" : "telefone"} className="h-6 w-6" />
          </BotaoDoTrilho>
        ))}
        {aoVivo.map((r) => (
          <BotaoDoTrilho key={r.id} rotulo={`Ao vivo: ${r.titulo}`} vermelho fazer={() => (r.posso_entrar && r.sala ? void entrarNaChamada(r) : abrirReuniao(r))}>
            <IconeDaSala nome="voz" className="h-6 w-6" />
          </BotaoDoTrilho>
        ))}
        <BotaoDoTrilho rotulo="Reuniões" ativo={tela === "agenda"} conta={gereReunioes ? propostasPendentes : 0} fazer={() => { setTela("agenda"); setAberta(null); }}>
          <IconeDaSala nome="agenda" className="h-6 w-6" />
        </BotaoDoTrilho>
        <BotaoDoTrilho rotulo="Criar grupo" verde fazer={() => { setTela("grupo"); setAberta(null); }}>
          <IconeDaSala nome="mais" className="h-6 w-6" />
        </BotaoDoTrilho>
        <span className="flex-1" />
        <BotaoDoTrilho rotulo="Mensagens favoritas" ativo={tela === "favoritas"} fazer={() => { setTela("favoritas"); setAberta(null); }}>
          <IconeDaSala nome="estrela" className="h-5 w-5" />
        </BotaoDoTrilho>
      </nav>
  );

  // Canais: o espaço, a busca, os filtros e a lista (departamentos, grupos, reuniões; ou as diretas).
  const canais = (
      <aside aria-label="Canais" className={`h-full min-h-0 min-w-0 flex-1 flex-col bg-s-lado ${largo ? "" : "border-r border-s-linha"} ${aberto ? "hidden lg:flex" : "flex"}`}>
        <MenuSuspenso
          rotulo={espaco === "instituto" ? "Instituto Lúcia" : "Mensagens diretas"}
          aoMudar={setMenuDoEspaco}
          gatilho={
            <button
              type="button"
              className="flex h-14 w-full shrink-0 cursor-pointer items-center justify-between gap-2 border-b border-s-linha px-4 text-left hover:bg-[var(--s-hover)]"
              aria-expanded={menuDoEspaco}
            >
              <span className="min-w-0">
                <span className="block truncate font-serif text-[1.2rem] leading-tight font-semibold">{espaco === "instituto" ? "Instituto Lúcia" : "Mensagens diretas"}</span>
                <span className="salas-rot block truncate text-[0.6rem] text-s-mudo">
                  {espaco === "instituto" ? `${(membros.dados ?? []).length} pessoas · ${(membros.dados ?? []).filter((m) => m.online).length} agora` : `${diretas.length} conversas`}
                </span>
              </span>
              <IconeDaSala nome="seta" className={`h-4 w-4 shrink-0 text-s-suave transition-transform motion-reduce:transition-none ${menuDoEspaco ? "rotate-180" : ""}`} />
            </button>
          }
          // As duas abas de espaço também aqui: no celular o trilho fica escondido.
          itens={([
            [espaco === "instituto" ? "Ir para mensagens diretas" : "Ir para o Instituto", espaco === "instituto" ? MessageSquare : Hash, () => setEspaco(espaco === "instituto" ? "diretas" : "instituto")],
            ["Criar grupo", Plus, () => setTela("grupo")],
            ["Reuniões e agenda", CalendarDays, () => setTela("agenda")],
            ["Mensagens favoritas", Star, () => setTela("favoritas")],
            ...(manages(me) ? [["Relatos à coordenação", Quote, () => setTela("relatos")] as const] : []),
            ...(leads(me) ? [["Quem está em conversa privada", Lock, () => setTela("privadas")] as const] : []),
            ["Aparelhos e segurança", ShieldCheck, () => setTela("seguranca")],
          ] as [string, LucideIcon, () => void][]).map(([nome, simbolo, fazer]) => ({ rotulo: nome, simbolo, fazer: () => { setAberta(null); fazer(); } }))}
        />
        <div className="space-y-2 px-3 pt-3">
          <label className="pn-campo flex h-9 items-center gap-2 px-2.5 text-s-mudo">
            <Search aria-hidden className="h-4 w-4 shrink-0" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} type="search" placeholder="Procurar ou pular para…" aria-label="Procurar pessoa, canal ou mensagem" className="min-w-0 flex-1 bg-transparent text-[0.9rem] text-s-texto outline-none placeholder:text-s-mudo" />
          </label>
          <div className="flex flex-wrap gap-1 text-xs" role="group" aria-label="Filtrar">
            {([["todas", "Todas"], ["nao_lidas", "Não lidas"], ["fixadas", "Fixadas"]] as const).map(([valor, nome]) => (
              <button key={valor} type="button" aria-pressed={filtro === valor && !arquivadas} onClick={() => { setFiltro(valor); setArquivadas(false); }} className={`pn-etiqueta cursor-pointer font-semibold ${filtro === valor && !arquivadas ? "pn-etiqueta-bordo" : ""}`}>{nome}</button>
            ))}
            {quantasArquivadas > 0 && <button type="button" aria-pressed={arquivadas} onClick={() => setArquivadas(!arquivadas)} className={`pn-etiqueta cursor-pointer font-semibold ${arquivadas ? "pn-etiqueta-bordo" : ""}`}><Archive aria-hidden className="h-3 w-3" />Arquivadas {quantasArquivadas}</button>}
          </div>
        </div>
        <div className="salas-rolagem min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {(lista.erro || membros.erro) && (
            <Faixa tom="erro" className="mt-2" acao={<Botao pequeno onClick={() => { lista.recarregar(); membros.recarregar(); }}>Tentar de novo</Botao>}>{lista.erro || membros.erro}</Faixa>
          )}
          {aviso && !lista.erro && !membros.erro && <Faixa tom="aviso" className="mt-2">{aviso}</Faixa>}
          {lista.dados === null && !lista.erro && <div className="px-1 pt-3"><Esqueleto forma="linhas" linhas={6} rotulo="Carregando as conversas" /></div>}
          {termo ? (
            <>
              {achadasPorNome.length > 0 && categoria("busca-canais", "Canais e conversas", achadasPorNome.map(linhaDeCanal))}
              {pessoas.length > 0 && categoria("busca-pessoas", "Pessoas", pessoas.map((membro) => <LinhaDePessoa key={membro.id} membro={membro} fazer={() => void conversarCom(membro.id)} />))}
              {achadas.length > 0 &&
                categoria("busca-mensagens", "Mensagens já abertas aqui", achadas.map((item) => (
                  <li key={item.id}>
                    <button type="button" className="block w-full cursor-pointer rounded px-2 py-1.5 text-left hover:bg-[var(--s-hover)]" onClick={() => { const conversa = todas.find((c) => c.id === item.conversa); if (conversa) void abrirConversa(conversa).then(() => window.setTimeout(() => document.getElementById(`m-${item.id}`)?.scrollIntoView({ block: "center" }), 600)); }}>
                      <span className="block truncate text-[0.7rem] text-s-mudo">{item.conversa_nome} · {item.autor} · {new Date(item.criado_em).toLocaleDateString(localDoPainel())}</span>
                      <span className="block truncate text-sm">{item.texto}</span>
                    </button>
                  </li>
                )))}
              {achadasPorNome.length === 0 && pessoas.length === 0 && achadas.length === 0 && <p className="px-2 py-4 text-sm text-s-suave">Nada com esse nome: nem pessoa, nem conversa, nem mensagem já aberta aqui.</p>}
            </>
          ) : espaco === "instituto" ? (
            <>
              <button type="button" onClick={() => { setTela("agenda"); setAberta(null); }} className={`mt-2 flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${tela === "agenda" ? "bg-[var(--s-ativo)] text-s-texto" : "text-s-suave hover:bg-[var(--s-hover)] hover:text-s-texto"}`}>
                <IconeDaSala nome="agenda" className="h-4 w-4" />
                <span className="flex-1">{proximas.length ? `${proximas.length} reunião(ões) marcada(s)` : "Reuniões"}</span>
                {aoVivo.length > 0 && <Selo tom="bordo" ponto>AO VIVO</Selo>}
              </button>
              {lista.dados !== null && todas.length === 0 && !arquivadas && filtro === "todas" && (
                <div className="pt-4"><Vazio simbolo={MessageSquare} titulo="Nenhum grupo ainda." texto="Cada departamento tem o próprio canal, e quem tem a função já está nele." /></div>
              )}
              {categoria("departamentos", "Departamentos", departamentos.length ? departamentos.map(linhaDeCanal) : <li className="px-2 py-1 text-xs text-s-mudo">Nenhum departamento neste filtro.</li>)}
              {categoria("grupos", "Grupos", grupos.length ? grupos.map(linhaDeCanal) : <li className="px-2 py-1 text-xs text-s-mudo">Nenhum grupo ainda.</li>, { rotulo: "Criar grupo", fazer: () => { setTela("grupo"); setAberta(null); } })}
              {categoria(
                "voz",
                "Reuniões · voz",
                canaisDeVoz.length ? canaisDeVoz.map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => abrirReuniao(r)} className={`group flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${tela === "reuniao" && reuniaoVista === r.id ? "bg-[var(--s-ativo)] text-s-texto" : "text-s-suave hover:bg-[var(--s-hover)] hover:text-s-texto"}`}>
                      <IconeDaSala nome="voz" className={`h-4 w-4 shrink-0 ${r.status === "ao_vivo" ? "text-s-acento" : ""}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{r.titulo}</span>
                        <span className="block truncate text-[0.68rem] text-s-mudo">{r.status === "ao_vivo" ? `ao vivo${r.presentes ? ` · ${r.presentes} na sala` : ""}` : new Date(r.inicio).toLocaleString(localDoPainel(), { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                      </span>
                      {chamada?.id === r.id && <span className="h-2 w-2 rounded-full bg-s-ok" title="Você está nesta sala" />}
                    </button>
                  </li>
                )) : <li className="px-2 py-1 text-xs text-s-mudo">Nenhuma reunião marcada.</li>,
                gereReunioes ? { rotulo: "Marcar reunião", fazer: () => { setTela("agenda"); setAberta(null); } } : undefined,
              )}
            </>
          ) : (
            <>
              {categoria("amigos", "Amigos", <Amigos equipe={membros.dados ?? []} conversar={(usuario) => void conversarCom(usuario)} />)}
              {categoria("diretas", "Mensagens diretas", diretas.length ? diretas.map(linhaDeCanal) : <li className="px-2 py-1 text-xs text-s-mudo">Nenhuma conversa privada ainda.</li>)}
              {pessoas.length > 0 && categoria("iniciar", "Conversa de trabalho", (
                <>
                  <li className="px-2 pb-1 text-[0.7rem] text-s-mudo">Privado só com a liderança ou com quem colabora com você numa contribuição. O resto é nos grupos.</li>
                  {pessoas.map((membro) => <LinhaDePessoa key={membro.id} membro={membro} fazer={() => void conversarCom(membro.id)} />)}
                </>
              ))}
            </>
          )}
        </div>
        {chamada && (
          <div className="flex items-center gap-2 border-t border-s-linha bg-s-trilho px-3 py-2.5">
            <span className="salas-ao-vivo flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-s-verde text-[var(--pn-sobre-destaque)]"><IconeDaSala nome={(chamada as Partial<ChamadaDoCanal>).video === false ? "telefone" : "camera"} className="h-4 w-4" /></span>
            <button
              type="button"
              className="min-w-0 flex-1 cursor-pointer text-left"
              title="Voltar para a chamada"
              onClick={() => { const doCanal = (chamada as Partial<ChamadaDoCanal>).conversa; if (doCanal) { setTela("conversa"); setAberta(doCanal); } else { setReuniaoVista(chamada.id); setTela("reuniao"); setAberta(null); } }}
            >
              <span className="block text-sm font-bold text-s-ok">Chamada conectada</span>
              <span className="block truncate text-xs text-s-suave">{chamada.titulo}</span>
            </button>
            <Botao variante="principal" pequeno icone simbolo={PhoneOff} aria-label="Sair da chamada" dica="Sair da chamada" onClick={() => void sairDaChamada()} />
          </div>
        )}
        <div className="relative flex items-center gap-2 border-t border-s-linha bg-s-trilho px-2 py-2">
          {meuStatus && <MeuStatus fechar={() => setMeuStatus(false)} mudou={(p) => { setMinhaPresenca(p); membros.recarregar(); }} />}
          <button type="button" className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md p-0.5 text-left hover:bg-[var(--s-hover)]" aria-expanded={meuStatus} title="Presença, frase de status e capa do cartão" onClick={() => setMeuStatus(!meuStatus)}>
            <span className="relative shrink-0">
              <Avatar nome={me.nome} avatar={euMembro?.avatar} className="h-8 w-8 rounded-full" />
              <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-s-trilho" style={{ backgroundColor: CORES_DE_PRESENCA[minhaPresenca] }} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{me.nome}</span>
              <span className="block truncate text-[0.68rem] text-s-mudo">{euMembro?.frase || "cifrado neste aparelho"}</span>
            </span>
          </button>
          <Botao variante="discreto" pequeno icone simbolo={SunMoon} aria-label="Trocar o tema da sala" dica={tema === "painel" ? "Trocar para o tema Noite" : tema === "escuro" ? "Trocar para o tema Papel" : tema === "pergaminho" ? "Trocar para o tema Stoat" : "Trocar para o tema do Instituto"} onClick={trocarTema} />
          <Botao variante="discreto" pequeno icone simbolo={Settings} aria-label="Aparelhos e segurança" dica="Aparelhos e segurança" onClick={() => { setTela("seguranca"); setAberta(null); }} />
        </div>
      </aside>
  );

  // O meio: a conversa, a reunião ou uma das telas da sala.
  const meio = (
      <section aria-label="Conversa" className={`relative h-full min-h-0 min-w-0 flex-col bg-s-chat ${aberto || chamadaNova ? "flex" : "hidden lg:flex"}`}>
        {/* Alguém começou uma chamada numa conversa minha: o convite fica no alto até eu entrar ou dispensar. */}
        {chamadaNova && (
          <div role="alert" className="salas-folha absolute inset-x-3 top-3 z-40 flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="salas-ao-vivo flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-s-verde text-[var(--pn-sobre-destaque)]"><IconeDaSala nome={chamadaNova.video ? "camera" : "telefone"} className="h-5 w-5" /></span>
            <p className="min-w-0 flex-1 text-sm">
              <strong className="block text-[0.95rem]">{chamadaNova.organizador.nome.split(" ")[0]} começou uma chamada {chamadaNova.video ? "de vídeo" : "de voz"}</strong>
              <span className="text-s-suave">em {nomeDaConversa(chamadaNova.conversa) ? `#${nomeDaConversa(chamadaNova.conversa)}` : "uma conversa"}{chamadaNova.na_sala.length ? ` · ${chamadaNova.na_sala.length} na chamada` : ""}</span>
            </p>
            <Botao variante="principal" simbolo={chamadaNova.video ? Camera : Phone} onClick={() => void entrarNaChamada(chamadaNova)}>Entrar</Botao>
            <Botao onClick={() => setChamadasVistas((vistas) => [...vistas, chamadaNova.id])}>Agora não</Botao>
          </div>
        )}
        {tela === "grupo" ? (
          <TelaDaSala titulo="Criar grupo" voltar={() => setTela("conversa")}>
            <NovoGrupo membros={membros.dados ?? []} fechar={() => setTela("conversa")} criado={(id) => { setTela("conversa"); setEspaco("instituto"); setAberta(id); lista.recarregar(); }} />
          </TelaDaSala>
        ) : tela === "favoritas" ? (
          <TelaDaSala titulo="Mensagens favoritas" voltar={() => setTela("conversa")}>
            <Favoritas chaveiro={chaveiro} fechar={() => setTela("conversa")} abrir={(id) => { setTela("conversa"); setAberta(id); }} />
          </TelaDaSala>
        ) : tela === "relatos" ? (
          <TelaDaSala titulo="Relatos à coordenação" voltar={() => setTela("conversa")}><Relatos fechar={() => setTela("conversa")} /></TelaDaSala>
        ) : tela === "privadas" ? (
          <TelaDaSala titulo="Conversas privadas" voltar={() => setTela("conversa")}><Privadas fechar={() => setTela("conversa")} /></TelaDaSala>
        ) : tela === "seguranca" ? (
          <TelaDaSala titulo="Aparelhos e segurança" voltar={() => setTela("conversa")}>
            <div className="max-w-2xl space-y-4">
              <ComoFunciona />
              <Aparelhos chaveiro={chaveiro} />
            </div>
          </TelaDaSala>
        ) : tela === "agenda" ? (
          <TelaDaSala titulo="Reuniões" icone="agenda" voltar={() => setTela("conversa")}>
            <AgendaDeReunioes
              gere={gereReunioes}
              aoVivo={aoVivo}
              proximas={proximas}
              passadas={passadas}
              propostas={propostasDeReuniao.dados ?? []}
              erroDasPropostas={propostasDeReuniao.erro}
              abrir={abrirReuniao}
              entrar={(r) => void entrarNaChamada(r)}
              recarregar={() => { reunioes.recarregar(); propostasDeReuniao.recarregar(); }}
            />
          </TelaDaSala>
        ) : tela === "reuniao" && reuniaoAberta ? (
          <SalaDeVoz
            reuniao={reuniaoAberta}
            naChamada={chamada?.id === reuniaoAberta.id}
            entrar={() => void entrarNaChamada(reuniaoAberta)}
            sair={() => void sairDaChamada()}
            mudarEstado={(status, mensagem) => void mudarEstado(reuniaoAberta, status, mensagem)}
            lugar={setLugarDaChamada}
            voltar={() => setTela("agenda")}
            aviso={aviso}
          />
        ) : aberta ? (
          <Janela
            key={aberta}
            id={aberta}
            chaveiro={chaveiro}
            me={me}
            equipe={membros.dados ?? []}
            conversas={todas}
            resumo={todas.find((conversa) => conversa.id === aberta)}
            conversarCom={(usuario) => void conversarCom(usuario)}
            voltar={() => { setAberta(null); lista.recarregar(); }}
            mudou={lista.recarregar}
            chamada={chamadaDe(aberta)}
            estouNaChamada={Boolean(chamada && chamada.id === chamadaDe(aberta)?.id)}
            iniciarChamada={(video) => void iniciarChamada(aberta, video)}
            entrarNaChamada={() => { const c = chamadaDe(aberta); if (c) void entrarNaChamada(c); }}
            sairDaChamada={() => void sairDaChamada()}
            lugarDaChamada={setLugarNaConversa}
            largo={largo}
            membrosAbertos={membrosAbertos}
            alternarMembros={() => setMembrosAbertos((v) => !v)}
            lugarDosMembros={comMembros ? lugarDosMembros : null}
          />
        ) : (
          <BoasVindas
            espaco={espaco}
            geral={departamentos.find((c) => c.departamento === "geral") ?? departamentos[0]}
            aoVivo={aoVivo[0]}
            proxima={proximas[0]}
            abrir={(c) => void abrirConversa(c)}
            agenda={() => setTela("agenda")}
            grupo={() => setTela("grupo")}
            seguranca={() => setTela("seguranca")}
            entrar={(r) => void entrarNaChamada(r)}
          />
        )}
      </section>
  );

  return (
    <div className="salas relative h-[calc(100dvh-var(--pn-barra-altura)-var(--pn-barra-baixo))] min-h-[22rem] overflow-hidden lg:h-[calc(100dvh-var(--pn-barra-altura))] lg:min-h-[28rem]" data-tema={tema} style={estiloDaSala(tema)}>
      <EntrarPorConvite entrar={(conversa) => { setEspaco("instituto"); setTela("conversa"); setAberta(conversa); lista.recarregar(); }} />
      {largo ? (
        // Canais | conversa | membros: a pessoa arrasta as divisórias (as larguras ficam guardadas na casca).
        <PaineisAjustaveis
          id="conversas"
          className="h-full"
          paineis={[
            { id: "canais", nome: "canais", minimo: 18, padrao: 26, maximo: 40, conteudo: <div className="flex h-full min-h-0">{trilho}{canais}</div> },
            { id: "conversa", nome: "conversa", minimo: 34, conteudo: meio },
            ...(comMembros ? [{ id: "detalhes", nome: "membros", minimo: 14, padrao: 20, maximo: 32, recolhivel: true, conteudo: <div ref={setLugarDosMembros} className="h-full min-h-0" /> }] : []),
          ]}
        />
      ) : (
        <div className="grid h-full">
          {canais}
          {meio}
        </div>
      )}

      {chamada && (
        <CamadaDaChamada
          tema={tema}
          chamada={chamada}
          lugar={
            tela === "reuniao" && reuniaoVista === chamada.id ? lugarDaChamada
            : tela === "conversa" && aberta && (chamada as Partial<ChamadaDoCanal>).conversa === aberta ? lugarNaConversa
            : null
          }
          me={me}
          lang={lang}
          abrir={() => { const doCanal = (chamada as Partial<ChamadaDoCanal>).conversa; if (doCanal) { setTela("conversa"); setAberta(doCanal); } else { setReuniaoVista(chamada.id); setTela("reuniao"); setAberta(null); } }}
          sair={() => void sairDaChamada()}
        />
      )}
    </div>
  );
}

function BotaoDoTrilho({ rotulo, ativo = false, conta = 0, vermelho = false, verde = false, marca = false, vivo = false, fazer, children }: { rotulo: string; ativo?: boolean; conta?: number; vermelho?: boolean; verde?: boolean; marca?: boolean; vivo?: boolean; fazer: () => void; children: ReactNode }) {
  return (
    <span className="group relative flex w-full justify-center">
      {/* A pílula do lado: alta quando ativo, baixinha quando há algo não lido. */}
      <span className={`salas-pilula absolute top-1/2 left-0 w-1 -translate-y-1/2 rounded-r bg-s-texto ${ativo ? "h-10" : conta ? "h-2 group-hover:h-5" : "h-0 group-hover:h-5"}`} aria-hidden="true" />
      <button
        type="button"
        title={rotulo}
        aria-label={rotulo}
        aria-pressed={ativo}
        onClick={fazer}
        className={`salas-trilho-botao relative flex h-12 w-12 cursor-pointer items-center justify-center ${
          marca ? `bg-transparent ${ativo ? "ring-2 ring-s-ouro ring-offset-2 ring-offset-[var(--s-trilho)]" : "opacity-85 hover:opacity-100"}`
          : vivo ? `salas-ao-vivo ${ativo ? "bg-s-verde text-[var(--pn-sobre-destaque)]" : "bg-s-campo text-s-ok hover:bg-s-verde hover:text-[var(--pn-sobre-destaque)]"}`
          : ativo ? "bg-s-acento text-[var(--pn-sobre-destaque)]" : vermelho ? "bg-s-campo text-s-acento hover:bg-s-acento hover:text-[var(--pn-sobre-destaque)]" : verde ? "bg-s-campo text-s-ok hover:bg-s-verde hover:text-[var(--pn-sobre-destaque)]" : "bg-s-campo text-s-suave hover:bg-s-acento hover:text-[var(--pn-sobre-destaque)]"}`}
      >
        {children}
        {vermelho && <span className="absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 animate-pulse rounded-full border-2 border-s-trilho bg-s-acento motion-reduce:animate-none" aria-hidden="true" />}
        <Contador n={conta} className="absolute -right-1 -bottom-1 ring-2 ring-[var(--s-trilho)]" />
      </button>
    </span>
  );
}

function LinhaDeCanal({ conversa, ativa, previa, chaveiro, pedindoTrava, menuAberto, chamada, estouNaChamada, entrarNaChamada, abrir, alternarMenu, marcar }: { conversa: Conversa; ativa: boolean; previa: { texto: string; mencao: boolean }; chaveiro: Chaveiro; pedindoTrava: boolean; menuAberto: boolean; chamada?: ChamadaDoCanal; estouNaChamada: boolean; entrarNaChamada: () => void; abrir: () => void; alternarMenu: () => void; marcar: (campos: Record<string, unknown>) => void }) {
  const pendentes = conversa.nao_lidas > 0 || conversa.marcada_nao_lida;
  const direta = conversa.tipo === "direta";
  return (
    <li className="relative">
      {pendentes && !conversa.silenciada && <span className="absolute top-1/2 -left-2 h-2 w-1 -translate-y-1/2 rounded-r bg-s-texto" aria-hidden="true" />}
      <button
        type="button"
        onClick={abrir}
        onContextMenu={(e) => { e.preventDefault(); alternarMenu(); }}
        aria-current={ativa ? "true" : undefined}
        title={previa.texto}
        className={`group flex w-full cursor-pointer items-center gap-2.5 rounded px-2.5 py-[0.4rem] pr-7 text-left text-[0.95rem] ${ativa ? "bg-[var(--s-ativo)] font-semibold text-s-texto" : pendentes && !conversa.silenciada ? "font-bold text-s-texto hover:bg-[var(--s-hover)]" : conversa.silenciada ? "text-s-mudo hover:bg-[var(--s-hover)]" : "font-medium text-s-suave hover:bg-[var(--s-hover)] hover:text-s-texto"}`}
      >
        {direta ? (
          <Rosto nome={conversa.nome} online={Boolean(conversa.online)} tipo="direta" pequeno />
        ) : conversa.foto ? (
          <FotoDoGrupo chaveiro={chaveiro} conversa={conversa.id} foto={conversa.foto} nome={conversa.nome} />
        ) : (
          <IconeDaSala nome={conversa.trancada ? "cadeado" : "cerquilha"} className="h-4 w-4 shrink-0 text-s-mudo" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate">
            {conversa.nome}
            {conversa.apagar_apos && <span title={`Autodestruição: ${nomeDoPrazo(conversa.apagar_apos)}`} className="ml-1.5 inline-block align-[-2px] font-normal text-s-mudo"><IconeDaSala nome="relogio" className="h-3.5 w-3.5" /></span>}
            {conversa.fechada && <span title="Fechada pela coordenação por enquanto" className="ml-1.5 inline-block align-[-2px] font-normal text-s-mudo"><IconeDaSala nome="bloqueio" className="h-3.5 w-3.5" /></span>}
          </span>
          {direta && <span className="block truncate text-xs font-normal text-s-mudo">{pedindoTrava ? "Confirme a digital…" : previa.texto}</span>}
        </span>
        {chamada && <span title={`${chamada.na_sala.length} na chamada`} className="text-s-ok"><IconeDaSala nome={chamada.video ? "camera" : "telefone"} className="h-4 w-4" /></span>}
        {previa.mencao && <Selo tom="bordo" titulo="Você foi mencionado"><AtSign aria-hidden className="h-3 w-3" /><span className="sr-only">Você foi mencionado</span></Selo>}
        {pendentes && conversa.nao_lidas > 0 && !previa.mencao && (conversa.silenciada ? <Selo>{conversa.nao_lidas}<span className="sr-only"> não lidas</span></Selo> : <Contador n={conversa.nao_lidas} rotulo="não lidas" />)}
      </button>
      {/* Quem está na chamada deste canal, logo embaixo, como os canais de voz do Discord. */}
      {chamada && (
        <button type="button" onClick={entrarNaChamada} className="mb-1 ml-9 flex max-w-[calc(100%-2.25rem)] cursor-pointer items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs text-s-suave hover:bg-[var(--s-hover)] hover:text-s-texto" title={estouNaChamada ? "Você está nesta chamada" : "Entrar na chamada"}>
          <span className="flex -space-x-1.5">
            {chamada.na_sala.slice(0, 4).map((p) => <Avatar key={p.id} nome={p.nome} className="h-5 w-5 rounded-full ring-2 ring-[var(--s-lado)]" texto="text-[0.55rem]" />)}
          </span>
          <span className="truncate">{chamada.na_sala.length ? `${chamada.na_sala.map((p) => p.nome.split(" ")[0]).slice(0, 2).join(", ")}${chamada.na_sala.length > 2 ? ` +${chamada.na_sala.length - 2}` : ""}` : "Chamada aberta"}</span>
          <span className="salas-rot ml-auto shrink-0 text-[0.58rem] text-s-ok">{estouNaChamada ? "você está" : "entrar"}</span>
        </button>
      )}
      <button type="button" aria-label={`Opções da conversa ${conversa.nome}`} aria-expanded={menuAberto} className="absolute top-1.5 right-1 cursor-pointer rounded px-1 text-s-mudo opacity-0 group-hover:opacity-100 hover:text-s-texto focus:opacity-100" onClick={alternarMenu}><IconeDaSala nome="menu" className="h-4 w-4" /></button>
      {menuAberto && (
        <ul role="menu" aria-label={`Opções da conversa ${conversa.nome}`} className={`${MENU_DA_SALA} top-8 right-0 w-56`}>
          {([
            [conversa.fixada ? "Desafixar" : "Fixar no alto", { p_fixar: !conversa.fixada }],
            [conversa.arquivada ? "Desarquivar" : "Arquivar", { p_arquivar: !conversa.arquivada }],
            [conversa.marcada_nao_lida || conversa.nao_lidas > 0 ? "Marcar como lida" : "Marcar como não lida", conversa.marcada_nao_lida || conversa.nao_lidas > 0 ? { p_nao_lida: false, __ler: true } : { p_nao_lida: true }],
            [conversa.silenciada ? "Tirar o silêncio" : "Silenciar por 8 horas", { p_silenciar_horas: conversa.silenciada ? 0 : 8 }],
            ...(conversa.silenciada ? [] : [["Silenciar por 7 dias", { p_silenciar_horas: 168 }] as const, ["Silenciar para sempre", { p_silenciar_horas: 876000 }] as const]),
            [conversa.trancada ? "Destrancar" : "Trancar com a digital", { p_trancar: !conversa.trancada }],
          ] as [string, Record<string, unknown>][]).map(([nome, campos]) => (
            <li key={nome}>
              <button type="button" role="menuitem" className={ITEM_DA_SALA} onClick={() => marcar(campos)}><span>{nome}</span></button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function LinhaDePessoa({ membro, fazer }: { membro: Membro; fazer: () => void }) {
  return (
    <li>
      <button type="button" onClick={fazer} className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-s-suave hover:bg-[var(--s-hover)] hover:text-s-texto">
        <Rosto nome={membro.nome} online={Boolean(membro.online)} avatar={membro.avatar} pequeno />
        <span className="min-w-0">
          <span className="block truncate text-sm">{membro.nome}</span>
          <span className="block truncate text-[0.68rem] text-s-mudo">{presenca(membro.online, membro.visto_em)}</span>
        </span>
      </button>
    </li>
  );
}

/** Uma tela simples dentro da sala (grupo novo, favoritas, segurança…), com o cabeçalho no jeito dos canais. */
function TelaDaSala({ titulo, icone, voltar, children }: { titulo: string; icone?: keyof typeof ICONES_DA_SALA; voltar: () => void; children: ReactNode }) {
  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-s-linha px-4">
        <span className="lg:hidden"><Botao variante="discreto" pequeno icone simbolo={ArrowLeft} aria-label="Voltar" onClick={voltar} /></span>
        {icone && <IconeDaSala nome={icone} className="h-5 w-5 text-s-acento-suave" />}
        <h2 className="font-serif text-lg font-semibold">{titulo}</h2>
      </header>
      <div className="salas-rolagem min-h-0 flex-1 overflow-y-auto">{children}</div>
    </>
  );
}

function BoasVindas({ espaco, geral, aoVivo, proxima, abrir, agenda, grupo, seguranca, entrar }: { espaco: Espaco; geral?: Conversa; aoVivo?: Reuniao; proxima?: Reuniao; abrir: (c: Conversa) => void; agenda: () => void; grupo: () => void; seguranca: () => void; entrar: (r: Reuniao) => void }) {
  // Cartões do painel, todos clicáveis (sem pulo ao passar o mouse: só a borda muda).
  const cartao = "pn-cartao pn-cartao-interativo flex cursor-pointer flex-col gap-1 p-4 text-left";
  return (
    <div className="salas-rolagem m-auto w-full max-w-2xl overflow-y-auto px-6 py-10">
      <CabecalhoDeSecao
        nivel={2}
        rotulo={espaco === "instituto" ? "Instituto Lúcia" : "Mensagens diretas"}
        titulo="Bem-vindo às conversas da equipe"
        simbolo={MessageSquare}
        sobre="Cada departamento tem o próprio canal, e quem tem a função já está nele. Grupos e conversas privadas, só quem participa vê. Tudo cifrado de ponta a ponta neste aparelho, e as reuniões por vídeo acontecem aqui mesmo."
      />
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {aoVivo && aoVivo.posso_entrar && aoVivo.sala && (
          <button type="button" className={`${cartao} pn-cartao-destaque sm:col-span-2`} onClick={() => entrar(aoVivo)}>
            <span className="flex items-center gap-2 font-semibold text-s-acento"><IconeDaSala nome="voz" /> Ao vivo agora</span>
            <span className="text-lg font-semibold">{aoVivo.titulo}</span>
            <span className="text-sm text-s-suave">Entrar na sala</span>
          </button>
        )}
        {geral && (
          <button type="button" className={cartao} onClick={() => abrir(geral)}>
            <span className="flex items-center gap-2 font-semibold"><IconeDaSala nome="cerquilha" className="h-4 w-4 text-s-mudo" /> {geral.nome}</span>
            <span className="text-sm text-s-suave">O canal da equipe toda.</span>
          </button>
        )}
        <button type="button" className={cartao} onClick={agenda}>
          <span className="flex items-center gap-2 font-semibold"><IconeDaSala nome="agenda" className="h-4 w-4 text-s-mudo" /> Reuniões</span>
          <span className="text-sm text-s-suave">{proxima ? `Próxima: ${proxima.titulo}, ${new Date(proxima.inicio).toLocaleString(localDoPainel(), { weekday: "long", hour: "2-digit", minute: "2-digit" })}` : "A agenda, as propostas e o histórico com as atas."}</span>
        </button>
        <button type="button" className={cartao} onClick={grupo}>
          <span className="flex items-center gap-2 font-semibold"><IconeDaSala nome="mais" className="h-4 w-4 text-s-mudo" /> Criar um grupo</span>
          <span className="text-sm text-s-suave">Para um projeto, um mutirão ou uma turma.</span>
        </button>
        <button type="button" className={cartao} onClick={seguranca}>
          <span className="flex items-center gap-2 font-semibold"><IconeDaSala nome="escudo" className="h-4 w-4 text-s-mudo" /> Aparelhos e segurança</span>
          <span className="text-sm text-s-suave">Como a cifra funciona e os aparelhos da sua conta.</span>
        </button>
      </div>
    </div>
  );
}

const ROTULO_DO_STATUS: Record<Reuniao["status"], string> = { agendada: "marcada", ao_vivo: "ao vivo", encerrada: "encerrada", cancelada: "cancelada" };

/** Um canal de voz: a reunião com a pauta, quem marcou, quem está na sala e o lugar onde a chamada aparece. */
function SalaDeVoz({ reuniao: r, naChamada, entrar, sair, mudarEstado, lugar, voltar, aviso }: { reuniao: Reuniao; naChamada: boolean; entrar: () => void; sair: () => void; mudarEstado: (status: Reuniao["status"], mensagem: string) => void; lugar: (el: HTMLDivElement | null) => void; voltar: () => void; aviso: string }) {
  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-s-linha px-4">
        <span className="lg:hidden"><Botao variante="discreto" pequeno icone simbolo={ArrowLeft} aria-label="Voltar" onClick={voltar} /></span>
        <IconeDaSala nome="voz" className={`h-5 w-5 ${r.status === "ao_vivo" ? "text-s-acento-suave" : "text-s-mudo"}`} />
        <h2 className="min-w-0 flex-1 truncate font-serif text-lg font-semibold">{r.titulo}</h2>
        <Selo tom={r.status === "ao_vivo" ? "bordo" : r.status === "cancelada" ? "erro" : "neutro"} ponto={r.status === "ao_vivo"}>{ROTULO_DO_STATUS[r.status]}</Selo>
        {r.conduzo && r.status === "agendada" && <Botao variante="principal" pequeno onClick={() => mudarEstado("ao_vivo", "A reunião começou: a equipe foi avisada.")}>Começar</Botao>}
        {r.conduzo && r.status === "ao_vivo" && <Botao pequeno perigo onClick={async () => { if ((await confirmarFrase("Encerrar a reunião para todos?"))) mudarEstado("encerrada", "Reunião encerrada."); }}>Encerrar para todos</Botao>}
      </header>
      {naChamada ? (
        // A chamada (que mora numa camada própria, para não cair ao trocar de canal) se encaixa aqui.
        <div ref={lugar} className="min-h-0 flex-1 bg-[var(--pn-menu-fundo)]" />
      ) : (
        <div className="salas-rolagem min-h-0 flex-1 overflow-y-auto px-6 py-8">
          <div className="mx-auto max-w-2xl">
            <div className="flex flex-col items-center gap-3 rounded-xl border border-s-linha bg-s-lado px-6 py-10 text-center">
              <span className={`flex h-20 w-20 items-center justify-center rounded-full ${r.status === "ao_vivo" ? "bg-s-acento text-[var(--pn-sobre-destaque)]" : "bg-s-campo text-s-suave"}`}><IconeDaSala nome="voz" className="h-10 w-10" /></span>
              <h3 className="font-serif text-3xl font-semibold">{r.titulo}</h3>
              <p className="text-s-suave">{new Date(r.inicio).toLocaleString(localDoPainel(), { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })} · {r.duracao} min · com {r.organizador.nome}</p>
              <p className="text-sm text-s-mudo">{tiposDeReuniao[r.tipo]}{r.recorrencia ? ` · ${r.recorrencia}` : ""}{r.presentes ? ` · ${r.presentes} na sala agora` : ""}</p>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {r.sala && r.posso_entrar && (r.status === "ao_vivo" || r.conduzo) ? (
                  <button type="button" className="cursor-pointer rounded-md bg-s-verde px-5 py-2 font-semibold text-[var(--pn-sobre-destaque)] hover:brightness-110" onClick={entrar}>{r.status === "ao_vivo" ? "Entrar na sala" : "Abrir a sala"}</button>
                ) : (
                  <p className="text-sm text-s-suave">{r.status === "agendada" ? "A sala abre quando a reunião começar." : r.status === "encerrada" ? "Esta reunião já terminou." : r.status === "cancelada" ? "Esta reunião foi cancelada." : "Você não está entre os convidados desta reunião."}</p>
                )}
                {r.status === "agendada" && <Botao simbolo={CalendarDays} onClick={() => baixarIcs(r)}>Pôr na agenda (.ics)</Botao>}
              </div>
            </div>
            {r.pauta && (
              <section className="mt-6">
                <h4 className="font-mono text-xs uppercase tracking-widest text-s-ouro">Pauta</h4>
                <p className="mt-2 whitespace-pre-wrap" data-original>{r.pauta}</p>
              </section>
            )}
            {r.link_pauta && <p className="mt-3"><a href={r.link_pauta} target="_blank" rel="noopener noreferrer" className="pn-elo inline-flex items-center gap-1">Documento da pauta <ExternalLink aria-hidden className="h-3.5 w-3.5" /></a></p>}
            {r.convidados.length > 0 && <p className="mt-4 text-sm text-s-suave">Convidados: {r.convidados.map((c) => c.nome).join(", ")}</p>}
            {r.presencas.length > 0 && (
              <section className="mt-6">
                <h4 className="font-mono text-xs uppercase tracking-widest text-s-ouro">Presença</h4>
                <ul className="mt-2 space-y-1 text-sm">{r.presencas.map((p, i) => <li key={i} className="flex justify-between gap-3"><span>{p.nome}</span><span className="text-s-mudo">{new Date(p.entrou_em).toLocaleTimeString(localDoPainel(), { hour: "2-digit", minute: "2-digit" })}{p.saiu_em ? ` – ${new Date(p.saiu_em).toLocaleTimeString(localDoPainel(), { hour: "2-digit", minute: "2-digit" })}` : " · na sala"}</span></li>)}</ul>
              </section>
            )}
            {r.ata && (
              <section className="mt-6">
                <h4 className="font-mono text-xs uppercase tracking-widest text-s-ouro">Ata</h4>
                <p className="mt-2 whitespace-pre-wrap text-s-suave" data-original>{r.ata}</p>
              </section>
            )}
            {aviso && <Faixa tom="info" className="mt-4">{aviso}</Faixa>}
            <p className="mt-8 text-xs text-s-mudo">Nada de áudio ou vídeo fica no servidor do instituto; só quem entrou e quando. Quem abre a reunião entra primeiro e modera.</p>
          </div>
        </div>
      )}
      {naChamada && (
        <div className="flex shrink-0 items-center justify-center gap-3 border-t border-s-linha bg-s-lado px-4 py-2">
          <span className="text-sm text-s-suave">Pode trocar de canal: a chamada continua num quadrinho.</span>
          <Botao variante="principal" pequeno simbolo={PhoneOff} onClick={sair}>Sair da chamada</Botao>
        </div>
      )}
    </>
  );
}

/**
 * A chamada do Jitsi numa camada só dela (no body, por cima do painel), para não reiniciar ao trocar de canal: com a
 * sala aberta, ela cobre o lugar reservado no meio; fora dali, vira um quadrinho no canto que dá para reabrir.
 */
function CamadaDaChamada({ tema, chamada, lugar, me, lang, abrir, sair }: { tema: TemaDaSala; chamada: Reuniao; lugar: HTMLDivElement | null; me: Me; lang: string; abrir: () => void; sair: () => void }) {
  const [caixa, setCaixa] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  useEffect(() => {
    if (!lugar) return;
    const medir = () => {
      const r = lugar.getBoundingClientRect();
      setCaixa({ x: r.left, y: r.top, w: r.width, h: r.height });
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(lugar);
    window.addEventListener("scroll", medir, true);
    window.addEventListener("resize", medir);
    return () => {
      observador.disconnect();
      window.removeEventListener("scroll", medir, true);
      window.removeEventListener("resize", medir);
    };
  }, [lugar]);
  const grande = Boolean(lugar && caixa);
  const estilo: CSSProperties = grande && caixa ? { left: caixa.x, top: caixa.y, width: caixa.w, height: caixa.h } : { right: 16, bottom: 16, width: 360, height: 236 };
  return createPortal(
    <div className={`salas fixed z-[60] flex flex-col overflow-hidden ${grande ? "" : "rounded-lg border border-s-linha shadow-[var(--pn-sombra-flutuante)]"}`} data-tema={tema} style={{ ...estiloDaSala(tema), ...estilo }}>
      {!grande && (
        <div className="flex items-center gap-2 bg-s-trilho px-2 py-1.5 text-xs">
          <IconeDaSala nome="voz" className="h-4 w-4 text-s-ok" />
          <span className="min-w-0 flex-1 truncate font-semibold">{chamada.titulo}</span>
          <Botao variante="discreto" pequeno icone simbolo={Maximize2} aria-label="Abrir a sala" dica="Abrir a sala" onClick={abrir} />
          <Botao variante="discreto" pequeno icone perigo simbolo={LogOut} aria-label="Sair da chamada" dica="Sair da chamada" onClick={sair} />
        </div>
      )}
      <div className="min-h-0 flex-1 bg-[var(--pn-menu-fundo)]">
        <JitsiSala sala={chamada.sala ?? ""} nome={me.nome} conduzo={chamada.conduzo} lang={lang} assunto={chamada.titulo} aoSair={sair} video={(chamada as Partial<ChamadaDoCanal>).video} />
      </div>
    </div>,
    document.body,
  );
}

/** A agenda: o que está ao vivo, as próximas, as propostas, marcar uma nova e o histórico com as atas. */
function AgendaDeReunioes({ gere, aoVivo, proximas, passadas, propostas, erroDasPropostas, abrir, entrar, recarregar }: { gere: boolean; aoVivo: Reuniao[]; proximas: Reuniao[]; passadas: Reuniao[]; propostas: PropostaDeReuniao[]; erroDasPropostas: string; abrir: (r: Reuniao) => void; entrar: (r: Reuniao) => void; recarregar: () => void }) {
  const [aba, setAba] = useState<"agora" | "propostas" | "nova" | "historico">("agora");
  const pendentes = propostas.filter((p) => p.status === "pendente").length;
  const linha = (r: Reuniao) => (
    <li key={r.id} className="pn-item flex-wrap">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${r.status === "ao_vivo" ? "bg-s-acento text-[var(--pn-sobre-destaque)]" : "bg-s-lado text-s-suave"}`}><IconeDaSala nome="voz" className="h-4 w-4" /></span>
      <button type="button" className="pn-item-texto min-w-0 flex-1 cursor-pointer text-left" onClick={() => abrir(r)}>
        <span className="pn-item-titulo">{r.titulo}</span>
        <span className="pn-item-meta">{new Date(r.inicio).toLocaleString(localDoPainel(), { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} · {r.duracao} min · {r.organizador.nome} · {tiposDeReuniao[r.tipo]}</span>
      </button>
      {r.status === "ao_vivo" && <Selo tom="bordo" ponto>{ROTULO_DO_STATUS[r.status]}</Selo>}
      {r.status === "ao_vivo" && r.sala && r.posso_entrar && <Botao variante="principal" pequeno simbolo={Volume2} onClick={() => entrar(r)}>Entrar</Botao>}
      {r.status === "agendada" && <Botao pequeno simbolo={CalendarDays} onClick={() => baixarIcs(r)}>.ics</Botao>}
    </li>
  );
  return (
    <div className="mx-auto max-w-3xl px-4 py-5">
      <Abas<typeof aba>
        rotulo="Reuniões"
        valor={aba}
        aoMudar={setAba}
        opcoes={[
          { id: "agora", nome: "Agora e próximas", conta: aoVivo.length },
          { id: "propostas", nome: "Propostas", conta: gere ? pendentes : 0 },
          ...(gere ? [{ id: "nova" as const, nome: "Marcar reunião" }] : []),
          { id: "historico", nome: "Histórico e atas" },
        ]}
        painel={(id) => (
          <>
            {id === "agora" && (
              <div className="space-y-6">
                {gere && <AbrirAgora escuro entrar={(r) => { recarregar(); entrar(r); }} />}
                {aoVivo.length > 0 && (
                  <section>
                    <CabecalhoDeSecao nivel={2} titulo="Ao vivo agora" simbolo={Volume2} />
                    <Lista rotulo="Ao vivo agora" className="mt-2">{aoVivo.map(linha)}</Lista>
                  </section>
                )}
                <section>
                  <CabecalhoDeSecao nivel={2} titulo="Próximas" simbolo={CalendarDays} />
                  {proximas.length ? (
                    <Lista rotulo="Próximas" className="mt-2">{proximas.map(linha)}</Lista>
                  ) : (
                    <Vazio simbolo={CalendarDays} titulo="Nenhuma reunião marcada." texto={gere ? "Marque uma em “Marcar reunião”." : "Proponha uma em “Propostas”."} />
                  )}
                </section>
                <p className="text-xs text-s-mudo">As reuniões acontecem pelo Jitsi Meet (código aberto) em {JITSI_DOMINIO}, dentro do painel, sem limite de tempo. Cada reunião tem uma sala de nome sorteado, que só quem pode entrar recebe. Guardamos só quem entrou e quando.</p>
              </div>
            )}
            {id === "propostas" && <Propostas gere={gere} propostas={propostas} erro={erroDasPropostas} recarregar={recarregar} />}
            {id === "nova" && gere && <NovaReuniao editando={null} depois={() => { recarregar(); setAba("agora"); }} cancelar={() => setAba("agora")} />}
            {id === "historico" && <Historico reunioes={passadas} recarregar={recarregar} />}
          </>
        )}
      />
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
function Janela({ id, chaveiro, me, equipe, conversas, resumo, conversarCom, voltar, mudou, chamada, estouNaChamada, iniciarChamada, entrarNaChamada, sairDaChamada, lugarDaChamada, largo, membrosAbertos, alternarMembros, lugarDosMembros }: {
  id: string; chaveiro: Chaveiro; me: Me; equipe: Membro[]; conversas: Conversa[]; resumo?: Conversa; conversarCom: (usuario: string) => void; voltar: () => void; mudou: () => void;
  /** A chamada acontecendo nesta conversa, se houver; e se eu estou nela. */
  chamada?: ChamadaDoCanal; estouNaChamada: boolean;
  iniciarChamada: (video: boolean) => void; entrarNaChamada: () => void; sairDaChamada: () => void;
  /** O lugar, em cima das mensagens, onde a chamada (que mora numa camada própria) se encaixa. */
  lugarDaChamada: (el: HTMLDivElement | null) => void;
  /** Telas largas: os membros vão para a terceira coluna (lugarDosMembros); nas outras, ficam ao lado, como antes. */
  largo: boolean; membrosAbertos: boolean; alternarMembros: () => void; lugarDosMembros: HTMLDivElement | null;
}) {
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
  const [preparados, setPreparados] = useState<Preparado[]>([]);
  const [gravando, setGravando] = useState(false);
  const [galeria, setGaleria] = useState(false);
  const [andamento, setAndamento] = useState("");
  const [arrastando, setArrastando] = useState(false);
  const [compondo, setCompondo] = useState<"enquete" | "evento" | "relato" | null>(null);
  const [menuDoCanal, setMenuDoCanal] = useState(false);
  const [maisAberto, setMaisAberto] = useState(false);
  /** O cartão de perfil aberto (clicar no nome ou na foto de alguém). */
  const [perfil, setPerfil] = useState<string | null>(null);
  // O campo de escrever é o Composer do painel; a moldura dá acesso à caixa de texto (foco, seleção).
  const moldura = useRef<HTMLDivElement>(null);
  const caixa = { get current() { return moldura.current?.querySelector("textarea") ?? null; } };
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
    const agora = relogioDeParede();
    if (tipo && agora - ultimoAvisoDeDigitando.current < 4000) return;
    ultimoAvisoDeDigitando.current = tipo ? agora : 0;
    void rpc("chat_digitando", { p_id: id, p_tipo: tipo }).catch(() => undefined);
  }

  // Na paleta (Ctrl K): fixar a última mensagem do canal, ou desafixar a que está fixada (a mesma ação da barrinha).
  const ultimaDeTexto = [...vistas].reverse().find((vista) => vista.mensagem.tipo === "texto" && vista.conteudo);
  const fixadaAgora = dados?.fixadas[0];
  useComandosDaSecao(
    dados
      ? [
          ...(ultimaDeTexto && !dados.fixadas.includes(ultimaDeTexto.mensagem.id)
            ? [{ id: "mensagem-fixar", nome: "Fixar", sobre: trechoDe(semFormatacao(ultimaDeTexto.conteudo?.texto ?? "")), simbolo: Pin, fazer: () => void agir(() => rpc("chat_fixar", { p_mensagem: ultimaDeTexto.mensagem.id, p_fixar: true })) }]
            : []),
          ...(fixadaAgora ? [{ id: "mensagem-desafixar", nome: "Desafixar", sobre: "Mensagens fixadas", simbolo: Pin, fazer: () => void agir(() => rpc("chat_fixar", { p_mensagem: fixadaAgora, p_fixar: false })) }] : []),
        ]
      : [],
    [ultimaDeTexto?.mensagem.id, fixadaAgora, dados?.fixadas.length],
  );

  if (!dados) {
    return (
      <div className="p-4">
        <span className="lg:hidden"><Botao variante="discreto" simbolo={ArrowLeft} onClick={voltar}>Conversas</Botao></span>
        {conversa.erro ? (
          <Faixa tom="erro" acao={<Botao pequeno onClick={recarregar}>Tentar de novo</Botao>}>{conversa.erro}</Faixa>
        ) : (
          <Esqueleto forma="linhas" linhas={5} rotulo="Abrindo…" />
        )}
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
        className={`ml-1 inline-flex cursor-pointer items-center font-mono ${lida ? "text-s-ouro" : ""}`}
        onClick={() => emGrupo && setLidaPor(lidaPor === mensagem.id ? null : mensagem.id)}
      >
        {entregue || lida ? <CheckCheck aria-hidden className="h-3.5 w-3.5" /> : <Check aria-hidden className="h-3.5 w-3.5" />}
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
    let limpo = texto.trim();
    if ((!limpo && arquivos.length === 0) || ocupado) return;
    setOcupado(true);
    setAviso("");
    try {
      // Os comandos com barra (/tarefa, /pauta, /dado…): rodam aqui, no aparelho de quem digitou.
      if (!editando && arquivos.length === 0 && limpo.startsWith("/")) {
        const feito = await rodarComando(limpo, me);
        if (feito) {
          if (feito.abrir && emGrupo) setCompondo(feito.abrir);
          if (feito.aviso) setAviso(feito.aviso);
          if (!feito.mandar) {
            setTexto("");
            return;
          }
          limpo = feito.mandar;
        }
      }
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
      // Só limpa a caixa se ela ainda tem o que foi enviado: o que a pessoa digitou durante o envio fica.
      setTexto((atual) => (atual.trim() === limpo || atual.trim().startsWith("/") ? "" : atual));
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
    if (minhas.length === 0 || !(await confirmarFrase(`Apagar ${minhas.length > 1 ? `${minhas.length} mensagens suas` : "1 mensagem sua"} para todo mundo?`))) return;
    setSelecionadas(null);
    await agir(async () => {
      for (const alvo of minhas) await rpc("chat_apagar", { p_id: alvo });
    });
  }

  /** O texto mudou no Composer ("/" e "@" são do próprio Composer): guarda e avisa que a pessoa está digitando. */
  function aoDigitar(valor: string) {
    setTexto(valor);
    if (valor.trim()) avisarDigitando("texto");
  }
  /** Negrito e itálico (pela barra e por Ctrl B / Ctrl I): põe o sinal das conversas em volta do que está selecionado. */
  function marcarTexto(sinal: string) {
    const el = caixa.current;
    if (!el) return;
    const inicio = el.selectionStart ?? texto.length;
    const fim = el.selectionEnd ?? inicio;
    const novo = `${texto.slice(0, inicio)}${sinal}${texto.slice(inicio, fim)}${sinal}${texto.slice(fim)}`;
    aoDigitar(novo);
    window.requestAnimationFrame(() => { el.focus(); el.setSelectionRange(inicio + 1, fim + 1); });
  }
  /** Os comandos do "/": os de formatação e os que rodam neste aparelho (/tarefa, /pauta, /dado…), com o mesmo texto de sempre. */
  const comandosDoCampo: ComandoDoComposer[] = editando
    ? []
    : [...COMANDOS_DE_FORMATO, ...COMANDOS.map((c) => ({ id: c.nome, nome: c.uso, sobre: c.sobre, simbolo: SendHorizontal, inserir: (t: string) => `/${c.nome} ${t}` }))];
  const quemMencionar = outros.map((membro) => ({ id: membro.id, nome: membro.nome }));

  /** A cor do nome de cada pessoa, pela função (como as cores de cargo do Discord). */
  const corDoNome = (autor: string | null) => {
    const funcoes = equipe.find((membro) => membro.id === autor)?.papeis.map((p) => p.papel) ?? [];
    // Cores dos tokens da sala: cada uma lê bem nos três temas.
    if (funcoes.includes("coordenacao") || funcoes.includes("vice")) return "var(--s-ouro)";
    if (funcoes.some((f) => f === "educacao" || f === "educacao_secundaria")) return "var(--s-ok)";
    if (funcoes.some((f) => f === "supervisao" || f === "jornalismo" || f === "marketing" || f === "porta_voz")) return "var(--s-azul)";
    if (funcoes.includes("design") || funcoes.includes("curadoria")) return "var(--s-acento-suave)";
    return "var(--s-texto)";
  };
  /** A etiqueta do cargo ao lado do nome, nos canais e grupos (na conversa privada não precisa). */
  const cargoDe = (autor: string | null) => {
    if (dados.tipo === "direta" || !autor) return "";
    const ordem = ["coordenacao", "vice", "supervisao", "educacao", "educacao_secundaria", "curadoria", "revisao", "jornalismo", "marketing", "design", "traducao", "mediacao", "desenvolvimento"];
    const funcoes = equipe.find((membro) => membro.id === autor)?.papeis.map((p) => p.papel as string) ?? [];
    const principal = ordem.find((papel) => funcoes.includes(papel));
    return principal ? ((papeis as Record<string, string>)[principal] ?? "").toLowerCase() : "";
  };
  const avatarDe = (autor: string | null) => dados.membros.find((membro) => membro.id === autor)?.avatar ?? equipe.find((membro) => membro.id === autor)?.avatar;
  const itemDoMenu = ITEM_DA_SALA;

  return (
    // Trocar de conversa remonta a janela (key={aberta}): ela entra deslizando de leve (painel-troca, no globals.css).
    <div className="painel-troca flex min-h-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2.5 border-b border-s-linha px-4">
          <span className="lg:hidden"><Botao variante="discreto" pequeno icone simbolo={ArrowLeft} aria-label="Voltar às conversas" onClick={voltar} /></span>
          {dados.tipo === "direta" ? <Rosto nome={nome} online={Boolean(outro?.online)} tipo="direta" avatar={outro?.avatar} pequeno /> : <IconeDaSala nome="cerquilha" className="h-5 w-5 shrink-0 text-s-acento-suave" />}
          <h2 className="max-w-[45%] shrink-0 truncate font-serif text-lg font-semibold">
            {nome}
            {outro && verificado(outro.id) && <span title="Identidade verificada pessoalmente" className="ml-1.5 inline-flex items-center gap-0.5 font-sans text-xs font-normal text-s-ok"><Check aria-hidden className="h-3 w-3" /> verificado</span>}
          </h2>
          <span className="hidden h-6 w-px bg-s-linha sm:block" aria-hidden="true" />
          <p className="hidden min-w-0 flex-1 truncate text-sm text-s-suave sm:block" aria-live="polite">
            {digitando.length > 0
              ? `${digitando.map((membro) => membro.nome.split(" ")[0]).join(", ")} ${digitando.some((membro) => membro.digitando === "audio") ? "está gravando áudio…" : digitando.length > 1 ? "estão digitando…" : "está digitando…"}`
              : outro
                ? presenca(outro.online, outro.visto_em)
                : dados.descricao || `${dados.tipo === "departamento" ? "Canal do departamento · " : ""}${dados.membros.length} pessoas${outros.some((membro) => membro.online !== null) ? ` · ${dados.membros.filter((membro) => membro.online).length} online` : ""}`}
          </p>
          <span className="flex-1 sm:hidden" />
          <span title="Cifrado de ponta a ponta neste aparelho: o servidor não lê" className="salas-rot hidden shrink-0 items-center gap-1.5 border border-s-linha px-2 py-1 text-[0.58rem] text-s-ok 2xl:flex">
            <IconeDaSala nome="cadeado" className="h-3 w-3" />ponta a ponta
          </span>
          {dados.apagar_apos && <span title={`Autodestruição: ${nomeDoPrazo(dados.apagar_apos)}`} className="text-s-mudo"><IconeDaSala nome="relogio" className="h-4 w-4" /></span>}
          {/* As chamadas do canal, como no Discord: voz ou vídeo para todo mundo da conversa, que é avisado. */}
          {chamada ? (
            !estouNaChamada && (
              <Botao variante="principal" pequeno className="salas-ao-vivo shrink-0" simbolo={chamada.video ? Camera : Phone} aria-label="Entrar na chamada" onClick={entrarNaChamada}>
                <span className="hidden xl:inline">Entrar na chamada</span>
              </Botao>
            )
          ) : dados.posso_enviar ? (
            <>
              <Botao variante="discreto" pequeno icone simbolo={Phone} aria-label="Começar chamada de voz" dica="Começar uma chamada de voz (todo mundo da conversa é avisado)" onClick={() => iniciarChamada(false)} />
              <Botao variante="discreto" pequeno icone simbolo={Camera} aria-label="Começar chamada de vídeo" dica="Começar uma chamada de vídeo (todo mundo da conversa é avisado)" onClick={() => iniciarChamada(true)} />
            </>
          ) : null}
          {fixadas.length > 0 && (
            <span className="relative">
              <Botao variante="discreto" pequeno icone simbolo={Pin} aria-label="Ir para a mensagem fixada" dica="Mensagens fixadas" onClick={() => irPara(fixadas[0].mensagem.id)} />
              <Contador n={fixadas.length} rotulo="fixadas" className="pointer-events-none absolute -top-1 -right-1" />
            </span>
          )}
          {emGrupo && (
            <Botao variante="discreto" pequeno icone simbolo={Users} aria-label="Mostrar os membros" dica="Membros" aria-pressed={membrosAbertos} className={membrosAbertos ? "text-s-acento-suave" : ""} onClick={alternarMembros} />
          )}
          <span className="relative">
            <Botao variante="discreto" pequeno icone simbolo={Ellipsis} aria-label="Mais opções do canal" dica="Mais" aria-expanded={menuDoCanal} onClick={() => setMenuDoCanal(!menuDoCanal)} />
            {menuDoCanal && (
              <ul role="menu" aria-label="Mais opções do canal" className={`${MENU_DA_SALA} top-9 right-0 w-64`}>
                <li><button type="button" role="menuitem" className={itemDoMenu} onClick={() => { setMenuDoCanal(false); setSelecionadas(selecionadas ? null : new Set()); }}>{selecionadas ? "Cancelar a seleção" : "Selecionar mensagens"}</button></li>
                <li><button type="button" role="menuitem" className={itemDoMenu} onClick={() => { setMenuDoCanal(false); setGaleria(true); }}>Arquivos da conversa</button></li>
                {emGrupo && <li><button type="button" role="menuitem" className={itemDoMenu} onClick={() => { setMenuDoCanal(false); setGerir(!gerir); }}>{gerir ? "Voltar às mensagens" : "Configurar o grupo"}</button></li>}
                {outro && <li><button type="button" role="menuitem" className={itemDoMenu} onClick={() => { setMenuDoCanal(false); setSeguranca(seguranca ? null : { usuario: outro.id, nome: outro.nome }); }}>Código de segurança</button></li>}
                <li className="mt-1 border-t border-[var(--pn-borda)] px-2.5 pt-2 pb-1">
                  <label className="pn-rotulo-mono block">
                    Autodestruição das mensagens novas
                    <select value={dados.apagar_apos ?? 0} onChange={(e) => { setMenuDoCanal(false); void autodestruir(Number(e.target.value)); }} className="pn-campo mt-1 w-full cursor-pointer">
                      {prazos.map((prazo) => (
                        <option key={prazo.segundos} value={prazo.segundos}>{prazo.segundos ? `Some em ${prazo.nome}` : "Desligada"}</option>
                      ))}
                    </select>
                  </label>
                </li>
              </ul>
            )}
          </span>
        </header>

        {/* A chamada deste canal: com a pessoa dentro, a sala abre aqui em cima das mensagens; fora, a faixa de quem está. */}
        {chamada && estouNaChamada && (
          <div className="flex h-[min(46vh,26rem)] shrink-0 flex-col border-b border-s-linha bg-[var(--pn-menu-fundo)]">
            <div ref={lugarDaChamada} className="min-h-0 flex-1" />
            <div className="flex shrink-0 items-center gap-3 bg-s-trilho px-4 py-2">
              <span className="salas-rot text-[0.6rem] text-s-ok">{chamada.video ? "Chamada de vídeo" : "Chamada de voz"} · {chamada.na_sala.length} na chamada</span>
              <span className="flex -space-x-1.5">{chamada.na_sala.slice(0, 6).map((p) => <Avatar key={p.id} nome={p.nome} className="h-6 w-6 rounded-full ring-2 ring-[var(--s-trilho)]" texto="text-[0.55rem]" />)}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-s-mudo" title="Troque de canal à vontade: a chamada continua num quadrinho.">Troque de canal à vontade: a chamada continua num quadrinho.</span>
              <Botao variante="principal" pequeno simbolo={PhoneOff} onClick={sairDaChamada}>Sair</Botao>
            </div>
          </div>
        )}
        {chamada && !estouNaChamada && (
          <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-s-linha bg-[color-mix(in_srgb,var(--s-ok)_10%,transparent)] px-4 py-2.5">
            <span className="salas-ao-vivo flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-s-verde text-[var(--pn-sobre-destaque)]"><IconeDaSala nome={chamada.video ? "camera" : "telefone"} className="h-4 w-4" /></span>
            <p className="min-w-0 flex-1 text-sm">
              <strong>{chamada.video ? "Chamada de vídeo" : "Chamada de voz"} acontecendo</strong>
              <span className="text-s-suave"> · {chamada.na_sala.length ? `na chamada: ${chamada.na_sala.map((p) => p.nome.split(" ")[0]).join(", ")}` : `começada por ${chamada.organizador.nome.split(" ")[0]}`}</span>
            </p>
            <Botao variante="principal" pequeno simbolo={chamada.video ? Camera : Phone} onClick={entrarNaChamada}>Entrar</Botao>
          </div>
        )}
        {gerir && dados.tipo !== "direta" ? (
          <div className="salas-rolagem min-h-0 flex-1 overflow-y-auto">
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
          </div>
        ) : (
          <>
            {fixadas.length > 0 && (
              <div className="flex shrink-0 items-center gap-2 border-b border-s-linha bg-s-lado px-4 py-1.5 text-xs">
                <IconeDaSala nome="alfinete" className="h-3.5 w-3.5 text-s-ouro" />
                <button type="button" className="min-w-0 flex-1 cursor-pointer truncate text-left hover:underline" onClick={() => irPara(fixadas[0].mensagem.id)}>
                  <span className="font-semibold">{fixadas[0].mensagem.minha ? "Você" : fixadas[0].mensagem.nome.split(" ")[0]}: </span>
                  {fixadas[0].conteudo ? semFormatacao(fixadas[0].conteudo.texto) : "…"}
                  {fixadas.length > 1 && <span className="text-s-mudo"> · +{fixadas.length - 1}</span>}
                </button>
                <Botao variante="discreto" pequeno onClick={() => void fixar(fixadas[0].mensagem.id, false)}>Desafixar</Botao>
              </div>
            )}
            {selecionadas && (
              <div className="flex shrink-0 flex-wrap items-center gap-3 bg-s-acento px-4 py-1.5 text-xs text-[var(--pn-sobre-destaque)]">
                <span>{selecionadas.size} {selecionadas.size === 1 ? "selecionada" : "selecionadas"}</span>
                <button type="button" className="cursor-pointer underline disabled:opacity-50" disabled={selecionadas.size === 0} onClick={() => setEncaminhando([...selecionadas])}>Encaminhar</button>
                <button type="button" className="cursor-pointer underline disabled:opacity-50" disabled={![...selecionadas].some((alvo) => vistas.find((vista) => vista.mensagem.id === alvo)?.mensagem.minha)} onClick={() => void apagarSelecionadas()}>Apagar as minhas</button>
                <button type="button" className="cursor-pointer underline disabled:opacity-50" disabled={selecionadas.size === 0} onClick={() => setCompondo("relato")}>Relatar à coordenação</button>
                <button type="button" className="ml-auto cursor-pointer underline" onClick={() => setSelecionadas(null)}>Cancelar</button>
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
            <div className="salas-rolagem min-h-0 flex-1 overflow-y-auto pt-4 pb-2" aria-live="polite">
              {seguranca && (
                <div className="mx-4 mb-3">
                  <Seguranca chaveiro={chaveiro} conversa={id} usuario={seguranca.usuario} nome={seguranca.nome} fechar={() => setSeguranca(null)} />
                </div>
              )}
              <div className="px-4"><Alertas chaveiro={chaveiro} conversa={id} alertas={alertas} /></div>
              {/* O começo do canal, como no Discord. */}
              <div className="mx-4 mb-4 border-b border-s-linha pb-4">
                <span className={`flex h-16 w-16 items-center justify-center rounded-full ${dados.tipo === "direta" ? "" : "bg-s-campo"}`}>
                  {dados.tipo === "direta" ? <Avatar nome={nome} avatar={outro?.avatar} className="h-16 w-16 rounded-full" /> : <IconeDaSala nome="cerquilha" className="h-9 w-9 text-s-texto" />}
                </span>
                <h3 className="mt-2 font-serif text-3xl font-semibold">{dados.tipo === "direta" ? nome : `Bem-vindo a #${nome}`}</h3>
                <p className="text-sm text-s-suave">
                  {dados.tipo === "direta" ? `O começo da sua conversa privada com ${nome}.` : dados.tipo === "departamento" ? "O canal do departamento: todo mundo dessa função lê o que for escrito aqui." : "O começo do grupo. Só quem participa vê."} Cifrado de ponta a ponta neste aparelho.
                  {dados.apagar_apos ? ` Autodestruição ligada${dados.apagar_por ? ` por ${dados.apagar_por}` : ""}: as mensagens novas somem ${nomeDoPrazo(dados.apagar_apos)} depois de enviadas.` : ""}
                </p>
              </div>
              {vistas.map((vista, indice) => {
                const { mensagem, conteudo } = vista;
                const anterior = vistas[indice - 1]?.mensagem;
                const outroDia = !anterior || new Date(anterior.criado_em).toDateString() !== new Date(mensagem.criado_em).toDateString();
                const separador = outroDia ? (
                  <div className="salas-rot mx-5 my-4 flex items-center gap-3 text-[0.62rem] text-s-mudo" role="separator">
                    <span className="h-px flex-1 bg-s-linha" />
                    {diaDe(mensagem.criado_em)}
                    <span className="h-px flex-1 bg-s-linha" />
                  </div>
                ) : null;
                if (mensagem.tipo === "sistema") {
                  const deChamada = mensagem.detalhe?.evento === "chamada" || mensagem.detalhe?.evento === "chamada_fim";
                  return (
                    <div key={mensagem.id} id={`m-${mensagem.id}`}>
                      {separador}
                      <p className="flex items-center gap-4 px-5 py-1.5 text-sm text-s-suave">
                        <span className={`flex w-10 justify-center ${deChamada ? "text-s-ok" : "text-s-mudo"}`}><IconeDaSala nome={deChamada ? (mensagem.detalhe?.texto === "video" ? "camera" : "telefone") : "enviar"} className="h-4 w-4" /></span>
                        <span>{textoDoAviso(mensagem, me)}</span>
                        <span className="font-mono text-[0.7rem] text-s-mudo">{hora(mensagem.criado_em)}</span>
                        {mensagem.detalhe?.evento === "chamada" && chamada && !estouNaChamada && <button type="button" className="cursor-pointer font-semibold text-s-ok underline" onClick={entrarNaChamada}>Entrar</button>}
                      </p>
                    </div>
                  );
                }
                // Mensagens seguidas da mesma pessoa, a menos de 7 minutos uma da outra, ficam juntas (sem repetir nome e foto).
                const continua = Boolean(anterior && !outroDia && anterior.tipo !== "sistema" && anterior.autor === mensagem.autor && new Date(mensagem.criado_em).getTime() - new Date(anterior.criado_em).getTime() < 7 * 60_000 && !conteudo?.citando);
                const meMenciona = Boolean(conteudo?.mencoes?.includes(me.id)) && !mensagem.minha;
                const marcada = selecionadas?.has(mensagem.id) ?? false;
                const leram = outros.filter((membro) => membro.lido_em && membro.lido_em >= mensagem.criado_em);
                return (
                  <div key={mensagem.id} id={`m-${mensagem.id}`} className={destacada === mensagem.id ? "painel-surge" : ""}>
                    {separador}
                    <div className={`group relative flex gap-4 px-5 py-1 ${continua ? "" : "mt-3"} ${meMenciona ? "bg-[var(--s-mencao)] shadow-[inset_3px_0_0_var(--s-ouro)]" : "hover:bg-[var(--s-hover)]"} ${destacada === mensagem.id || marcada ? "bg-[var(--s-ativo)]" : ""}`}>
                      {selecionadas && (
                        <input
                          type="checkbox"
                          className="mt-1.5 h-4 w-4 shrink-0 accent-[var(--s-acento)]"
                          aria-label="Selecionar mensagem"
                          checked={marcada}
                          onChange={(e) => setSelecionadas((atual) => { const novo = new Set(atual); if (e.target.checked) novo.add(mensagem.id); else novo.delete(mensagem.id); return novo; })}
                        />
                      )}
                      <div className="w-10 shrink-0">
                        {continua ? (
                          <span className="invisible block pt-1 text-right font-mono text-[0.66rem] text-s-mudo group-hover:visible">{hora(mensagem.criado_em)}</span>
                        ) : (
                          <button type="button" className="mt-0.5 shrink-0 cursor-pointer rounded-full" aria-label={`Perfil de ${mensagem.minha ? me.nome : mensagem.nome}`} onClick={() => mensagem.autor && setPerfil(mensagem.autor)}>
                            <Avatar nome={mensagem.minha ? me.nome : mensagem.nome} avatar={avatarDe(mensagem.autor)} className="h-10 w-10 rounded-full" />
                          </button>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        {conteudo?.citando && (
                          <button type="button" onClick={() => irPara(conteudo.citando!.id)} className="relative mb-0.5 flex max-w-full cursor-pointer items-center gap-1.5 text-left text-xs text-s-suave hover:text-s-texto">
                            <span className="absolute top-1/2 -left-9 h-3 w-7 rounded-tl-md border-t-2 border-l-2 border-s-linha" aria-hidden="true" />
                            <strong className="shrink-0" style={{ color: corDoNome(conteudo.citando.autor) }}>@{conteudo.citando.autor === me.id ? "Você" : conteudo.citando.nome}</strong>
                            <span className="truncate">{conteudo.citando.trecho}</span>
                          </button>
                        )}
                        {!continua && (
                          <p className="flex flex-wrap items-baseline gap-x-2">
                            <button type="button" className="cursor-pointer text-[0.95rem] font-bold hover:underline" style={{ color: corDoNome(mensagem.autor) }} onClick={() => mensagem.autor && setPerfil(mensagem.autor)}>{mensagem.minha ? me.nome : mensagem.nome}</button>
                            {cargoDe(mensagem.autor) && <span className="salas-rot border px-1.5 py-px text-[0.55rem] tracking-[0.12em]" style={{ color: corDoNome(mensagem.autor), borderColor: corDoNome(mensagem.autor) }}>{cargoDe(mensagem.autor)}</span>}
                            {mensagem.autor && verificado(mensagem.autor) && <span title="Identidade verificada pessoalmente" className="text-xs text-s-ok">verificado</span>}
                            <span className="font-mono text-[0.7rem] text-s-mudo">{hora(mensagem.criado_em)}</span>
                          </p>
                        )}
                        {conteudo?.encaminhada && <p className="inline-flex items-center gap-1 text-[0.72rem] italic text-s-mudo"><Forward aria-hidden className="h-3 w-3" /> Encaminhada</p>}
                        {conteudo?.anexos?.map((anexo) => (
                          <div key={anexo.id} className="mt-1 max-w-md">
                            <AnexoVisto anexo={anexo} estado={mensagem.anexos.find((estado) => estado.id === anexo.id)} conversa={id} minha={mensagem.minha} />
                          </div>
                        ))}
                        <div className={`whitespace-pre-line break-words text-[0.97rem] leading-[1.55] ${vista.autoria === "invalida" ? "rounded border border-s-acento p-1" : ""}`}>
                          {conteudo ? (
                            <>
                              {conteudo.texto && <Formatado texto={conteudo.texto} membros={membrosDaConversa} eu={me.id} />}
                              {vista.autoria === "invalida" && <span className="mt-1 block border-l-2 border-s-acento pl-2 text-xs font-semibold text-s-acento">Não foi possível verificar o autor desta mensagem: a assinatura não confere com a identidade de quem aparece como autor.</span>}
                            </>
                          ) : (
                            <TextoAberto aberto={abertos[mensagem.id]} antiga={mensagem.corpo.startsWith("c1.")} />
                          )}
                          {(vista.editada || dados.fixadas.includes(mensagem.id) || favoritas.has(mensagem.id) || mensagem.expira_em || mensagem.minha) && (
                            <span className="ml-1.5 inline-flex items-center gap-1 align-baseline text-[0.65rem] text-s-mudo">
                              {vista.editada && <span>(editada)</span>}
                              {dados.fixadas.includes(mensagem.id) && <span title="Fixada" className="text-s-ouro"><IconeDaSala nome="alfinete" className="h-3 w-3" /></span>}
                              {favoritas.has(mensagem.id) && <span title="Favorita" className="text-s-ouro"><IconeDaSala nome="estrela" className="h-3 w-3" /></span>}
                              {mensagem.expira_em && <span className="inline-flex items-center gap-0.5" title={`Autodestruição: ${new Date(mensagem.expira_em).toLocaleString(localDoPainel())}`}><IconeDaSala nome="relogio" className="h-3 w-3" /> {restante(mensagem.expira_em)}</span>}
                              {tiques(mensagem)}
                            </span>
                          )}
                        </div>
                        {conteudo?.enquete && <EnqueteVista enquete={conteudo.enquete} votos={vista.votos} minha={mensagem.minha} votar={(opcoes) => void enviarConteudo({ texto: "", voto: opcoes }, "voto", mensagem.id)} />}
                        {conteudo?.evento && <EventoVista evento={conteudo.evento} rsvps={vista.rsvps} minha={mensagem.minha} responder={(resposta) => void enviarConteudo({ texto: "", rsvp: resposta }, "rsvp", mensagem.id)} />}
                        {conteudo?.previa && (
                          <a href={conteudo.previa.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 block max-w-md rounded border-l-4 border-s-acento bg-s-lado px-3 py-2 text-xs no-underline">
                            <span className="block truncate font-semibold text-s-texto">{conteudo.previa.titulo}</span>
                            <span className="block truncate text-s-mudo">{conteudo.previa.dominio} · prévia feita só do endereço</span>
                          </a>
                        )}
                        {vista.reacoes.length > 0 && (
                          <p className="mt-1 flex flex-wrap gap-1">
                            {vista.reacoes.map((grupo) => (
                              <button
                                key={grupo.emoji}
                                type="button"
                                title={grupo.quem.map((quem) => (quem.minha ? "você" : quem.nome)).join(", ")}
                                aria-label={`${grupo.emoji.replace(/:/g, "")} de ${grupo.quem.map((quem) => (quem.minha ? "você" : quem.nome)).join(", ")}`}
                                onClick={() => void reagir(vista, grupo.emoji)}
                                onContextMenu={(e) => { e.preventDefault(); setQuemReagiu(quemReagiu === mensagem.id ? null : mensagem.id); }}
                                className={`cursor-pointer rounded-md border px-1.5 py-0.5 text-xs ${grupo.quem.some((quem) => quem.minha) ? "border-s-acento-suave bg-[var(--s-ativo)]" : "border-transparent bg-s-campo hover:border-s-linha"}`}
                              >
                                <EmojiDaReacao emoji={grupo.emoji} /> <span className="font-semibold">{grupo.quem.length}</span>
                              </button>
                            ))}
                            <button type="button" className="cursor-pointer rounded-md bg-s-campo px-1.5 py-0.5 text-xs text-s-mudo opacity-0 group-hover:opacity-100 hover:text-s-texto" aria-label="Quem reagiu" onClick={() => setQuemReagiu(quemReagiu === mensagem.id ? null : mensagem.id)}>quem?</button>
                          </p>
                        )}
                        {quemReagiu === mensagem.id && (
                          <ul className="mt-1 max-w-xs rounded border border-s-linha bg-s-lado p-2 text-[0.72rem] text-s-suave">
                            {vista.reacoes.flatMap((grupo) => grupo.quem.map((quem) => (
                              <li key={quem.id} className="flex items-center justify-between gap-2">
                                <span>{grupo.emoji} {quem.minha ? "Você" : quem.nome}</span>
                                {quem.minha && <button type="button" className="cursor-pointer underline" onClick={() => void apagar(quem.id)}>desfazer</button>}
                              </li>
                            )))}
                          </ul>
                        )}
                        {lidaPor === mensagem.id && (
                          <p className="text-[0.72rem] text-s-mudo">
                            {leram.length === 0 ? "Ninguém leu ainda." : `Lida por ${leram.map((membro) => membro.nome.split(" ")[0]).join(", ")}`}
                            {outros.some((membro) => membro.lido_em === null) && " (quem desligou a confirmação de leitura não aparece)"}
                          </p>
                        )}
                      </div>
                      {!selecionadas && (
                        <Acoes vista={vista} eu={mensagem.minha} me={me} favorita={favoritas.has(mensagem.id)} fixada={dados.fixadas.includes(mensagem.id)} editavel={editavel(mensagem)} citar={() => citar(vista)} reagir={() => setReagindo(reagindo === mensagem.id ? null : mensagem.id)} encaminhar={() => setEncaminhando([mensagem.id])} fixar={(sim) => void fixar(mensagem.id, sim)} favoritar={(sim) => void favoritar(mensagem.id, sim)} editar={mensagem.minha ? () => editar(vista) : undefined} apagar={mensagem.minha ? () => void apagar(mensagem.id) : undefined} />
                      )}
                      {reagindo === mensagem.id && (
                        <p role="group" aria-label="Reagir" className="absolute -top-10 right-4 z-20 flex gap-0.5 rounded-md border border-s-linha bg-s-trilho p-1 text-lg shadow-2xl">
                          {reacoes.map((emoji) => (
                            <button key={emoji} type="button" className="cursor-pointer rounded px-1 hover:bg-[var(--s-ativo)]" aria-label={`Reagir com ${emoji.replace(/:/g, "")}`} onClick={() => void reagir(vista, emoji)}><EmojiDaReacao emoji={emoji} /></button>
                          ))}
                        </p>
                      )}
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
                itens={vistas.flatMap((vista): ItemDaGaleria[] => (vista.conteudo?.anexos ?? []).map((anexo) => ({ mensagem: vista.mensagem.id, anexo, estado: vista.mensagem.anexos.find((estado) => estado.id === anexo.id), autor: vista.mensagem.nome, minha: vista.mensagem.minha, quando: `${new Date(vista.mensagem.criado_em).toLocaleDateString(localDoPainel())} ${hora(vista.mensagem.criado_em)}` })))}
              />
            )}
            {gravando && <Gravador aoGravar={(audio) => void enviar([audio])} aoAvisar={avisarDigitando} fechar={() => setGravando(false)} />}
            {compondo === "enquete" && <NovaEnquete fechar={() => setCompondo(null)} criar={(enquete) => { setCompondo(null); void enviarConteudo({ texto: "", enquete }); }} />}
            {compondo === "evento" && <NovoEvento fechar={() => setCompondo(null)} criar={(evento) => { setCompondo(null); void enviarConteudo({ texto: "", evento }); }} />}
            {!dados.posso_enviar && (
              <Faixa tom={dados.barrado ? "aviso" : "info"} className="mx-4 mb-4">
                {dados.barrado === "chat_fechado"
                  ? `As conversas estão fechadas pela coordenação por enquanto.${dados.motivo_do_fechamento ? ` Motivo: ${dados.motivo_do_fechamento}` : ""} Ler pode; escrever, ainda não.`
                  : dados.barrado === "silenciado"
                    ? "A coordenação silenciou a sua conta nas conversas por enquanto. Você lê, mas não escreve."
                    : "Neste grupo, só os administradores mandam mensagem. Você ainda pode reagir e votar."}
              </Faixa>
            )}
            <form
              className={`relative shrink-0 px-5 pt-1 pb-5 ${arrastando ? "outline outline-2 -outline-offset-4 outline-dashed outline-s-acento" : ""} ${dados.posso_enviar ? "" : "hidden"}`}
              onSubmit={(e) => { e.preventDefault(); void enviar(); }}
              onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setArrastando(true); } }}
              onDragLeave={() => setArrastando(false)}
              onDrop={(e) => { e.preventDefault(); setArrastando(false); void anexar([...e.dataTransfer.files]); }}
            >
              <Preparados itens={preparados} mudar={setPreparados} />
              {andamento && <p className="mb-2 text-xs text-s-suave" aria-live="polite">{andamento}</p>}
              {citando && (
                <div className="flex items-center gap-2 rounded-t-lg bg-s-lado px-3 py-2 text-xs">
                  <span className="min-w-0 flex-1 truncate text-s-suave">Respondendo a <strong className="text-s-texto">{citando.nome}</strong> · {citando.trecho}</span>
                  <Botao variante="discreto" pequeno icone simbolo={X} aria-label="Cancelar a resposta" onClick={() => setCitando(null)} />
                </div>
              )}
              {editando && (
                <div className="flex items-center gap-2 rounded-t-lg bg-s-lado px-3 py-2 text-xs">
                  <span className="flex-1 font-semibold">Editando a mensagem (até 15 minutos depois de enviada)</span>
                  <button type="button" className="cursor-pointer text-s-mudo underline hover:text-s-texto" onClick={() => { setEditando(null); setTexto(getItem(chaveDoRascunho(id))); }}>Cancelar</button>
                </div>
              )}
              {maisAberto && !editando && (
                <ul role="menu" aria-label="Anexar ou criar" className={`${MENU_DA_SALA} bottom-full left-4 mb-1 w-56`}>
                  <li><button type="button" role="menuitem" className={itemDoMenu} onClick={() => { setMaisAberto(false); escolha.current?.click(); }}><Paperclip aria-hidden /><span>Enviar arquivo</span></button></li>
                  <li><button type="button" role="menuitem" className={itemDoMenu} onClick={() => { setMaisAberto(false); setGravando(true); }}><Mic aria-hidden /><span>Gravar áudio</span></button></li>
                  {emGrupo && <li><button type="button" role="menuitem" className={itemDoMenu} onClick={() => { setMaisAberto(false); setCompondo("enquete"); }}><BarChart3 aria-hidden /><span>Criar enquete</span></button></li>}
                  {emGrupo && <li><button type="button" role="menuitem" className={itemDoMenu} onClick={() => { setMaisAberto(false); setCompondo("evento"); }}><CalendarDays aria-hidden /><span>Criar evento</span></button></li>}
                </ul>
              )}
              <div className="salas-folha">
              <div
                ref={moldura}
                className="flex items-end gap-3 px-3.5 pt-3 pb-2"
                onPaste={(e) => { const arquivos = [...e.clipboardData.files]; if (arquivos.length) { e.preventDefault(); void anexar(arquivos); } }}
                onBlur={() => avisarDigitando("")}
                // Ctrl B e Ctrl I com os sinais das conversas (*negrito* e _itálico_): o texto guardado não muda de formato.
                onKeyDownCapture={(e) => {
                  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === "b" || e.key === "i") && e.target instanceof HTMLTextAreaElement) {
                    e.preventDefault();
                    e.stopPropagation();
                    marcarTexto(e.key === "b" ? "*" : "_");
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Escape") return;
                  setReagindo(null);
                  setMaisAberto(false);
                  if (editando) { setEditando(null); setTexto(getItem(chaveDoRascunho(id))); }
                }}
              >
                {!editando && (
                  <>
                    <input ref={escolha} type="file" multiple accept="image/*,video/*,audio/*,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={(e) => { void anexar([...(e.target.files ?? [])]); e.target.value = ""; }} />
                    <Botao variante="discreto" pequeno icone simbolo={Plus} className="mb-0.5 shrink-0" aria-label="Anexar ou criar" dica="Arquivo, áudio, enquete ou evento" aria-expanded={maisAberto} disabled={ocupado} onClick={() => setMaisAberto(!maisAberto)} />
                  </>
                )}
                <Composer
                  rotulo={`Mensagem para ${nome}`}
                  valor={texto}
                  aoMudar={aoDigitar}
                  aoEnviar={() => void enviar()}
                  comandos={comandosDoCampo}
                  pessoas={quemMencionar}
                  maxLength={MAXIMO}
                  placeholder={preparados.length ? "Legenda (opcional)" : dados.tipo === "direta" ? `Conversar com @${nome}` : `Conversar em #${nome}`}
                  className="min-w-0 flex-1"
                />
              </div>
              {/* A barra de ferramentas: formatação, enquete, evento, áudio e o Enviar. */}
              <div className="flex items-center gap-0.5 px-2.5 pb-2 text-s-suave">
                {!editando && (
                  <>
                    <Botao variante="discreto" pequeno icone simbolo={Bold} aria-label="Negrito" dica="Negrito (*texto*)" atalho="Ctrl B" onClick={() => marcarTexto("*")} />
                    <Botao variante="discreto" pequeno icone simbolo={Italic} aria-label="Itálico" dica="Itálico (_texto_)" atalho="Ctrl I" onClick={() => marcarTexto("_")} />
                    {emGrupo && <Botao variante="discreto" pequeno icone simbolo={BarChart3} aria-label="Criar enquete" dica="Criar enquete" onClick={() => setCompondo("enquete")} />}
                    {emGrupo && <Botao variante="discreto" pequeno icone simbolo={CalendarDays} aria-label="Criar evento" dica="Criar evento" onClick={() => setCompondo("evento")} />}
                    <Botao variante="discreto" pequeno icone simbolo={Mic} aria-label="Gravar áudio" dica="Gravar áudio" onClick={() => setGravando(true)} />
                  </>
                )}
                <p className="hidden min-w-0 flex-1 truncate px-2 text-xs text-s-mudo md:block"><b className="font-mono">/</b> comandos · <b className="font-mono">@</b> chamar alguém · ||spoiler|| · Shift+Enter quebra a linha</p>
                <span className="flex-1 md:hidden" />
                <Botao type="submit" variante="principal" pequeno simboloFim={editando || ocupado ? undefined : SendHorizontal} carregando={ocupado && Boolean(andamento)} disabled={ocupado || (!texto.trim() && preparados.length === 0)} aria-label={editando ? "Guardar" : "Enviar"}>
                  {editando ? "Guardar" : ocupado && andamento ? "Enviando…" : "Enviar"}
                </Botao>
              </div>
              </div>
            </form>
            {aviso && <Faixa tom="info" className="mx-4 mb-2">{aviso}</Faixa>}
          </>
        )}
      </div>
      {/* Membros: na terceira coluna das telas largas (por portal, a coluna ajustável é da sala); nas outras, ao lado. */}
      {emGrupo && membrosAbertos && (largo
        ? lugarDosMembros && createPortal(<MembrosDaSala coluna membros={dados.membros} equipe={equipe} corDoNome={corDoNome} abrir={setPerfil} naChamada={chamada?.na_sala ?? []} />, lugarDosMembros)
        : <MembrosDaSala membros={dados.membros} equipe={equipe} corDoNome={corDoNome} abrir={setPerfil} naChamada={chamada?.na_sala ?? []} />)}
      {perfil && (() => {
        const membro = equipe.find((m) => m.id === perfil);
        return membro ? <CartaoDePerfil membro={membro} me={me} fechar={() => setPerfil(null)} conversar={conversarCom} /> : null;
      })()}
    </div>
  );
}

/** Quem está na conversa, como a lista de membros do Discord: por função, quem está por aqui primeiro, depois o resto. */
function MembrosDaSala({ membros, equipe, corDoNome, abrir, naChamada, coluna = false }: { membros: MembroDaConversa[]; equipe: Membro[]; corDoNome: (autor: string | null) => string; abrir: (id: string) => void; naChamada: { id: string; nome: string }[]; /** Na terceira coluna ajustável (ocupa a coluna toda). */ coluna?: boolean }) {
  const [todosOsLonge, setTodosOsLonge] = useState(false);
  const naChamadaIds = new Set(naChamada.map((p) => p.id));
  const ordem: string[] = ["coordenacao", "vice", "supervisao", "curadoria", "educacao", "educacao_secundaria", "revisao", "traducao", "jornalismo", "design", "marketing", "mediacao", "mentoria", "desenvolvimento", "porta_voz", "representante", "saude"];
  const funcaoDe = (id: string) => {
    const funcoes = equipe.find((m) => m.id === id)?.papeis.map((p) => p.papel) ?? [];
    return ordem.find((papel) => funcoes.includes(papel as never)) ?? "";
  };
  const emChamada = membros.filter((m) => naChamadaIds.has(m.id));
  const online = membros.filter((m) => m.online !== false && !naChamadaIds.has(m.id));
  const longe = membros.filter((m) => m.online === false && !naChamadaIds.has(m.id));
  const grupos = new Map<string, MembroDaConversa[]>();
  for (const m of online) {
    const f = funcaoDe(m.id);
    grupos.set(f, [...(grupos.get(f) ?? []), m]);
  }
  const blocos = [...grupos.entries()].sort((a, b) => (a[0] === "" ? 1 : b[0] === "" ? -1 : ordem.indexOf(a[0]) - ordem.indexOf(b[0])));
  const linha = (m: MembroDaConversa, apagado = false) => {
    const daEquipe = equipe.find((e) => e.id === m.id);
    return (
      <li key={m.id}>
        <button type="button" onClick={() => abrir(m.id)} className={`flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-[var(--s-hover)] ${apagado ? "opacity-55" : ""}`}>
          <span className="relative shrink-0">
            <Avatar nome={m.nome} avatar={m.avatar} className="h-8 w-8 rounded-full" />
            {!apagado && <Bolinha presenca={daEquipe?.presenca} online={m.online} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-sm ${apagado ? "font-medium" : "font-semibold"}`} style={{ color: apagado ? undefined : corDoNome(m.id) }}>
              {m.eu ? `${m.nome} (você)` : m.nome}
              {m.admin && <span className="ml-1 inline-block align-[-1px] text-s-ouro" title="Administra o grupo"><IconeDaSala nome="estrela" className="h-3 w-3" /></span>}
            </span>
            {!apagado && daEquipe?.frase && <span className="block truncate text-xs text-s-mudo">{daEquipe.frase}</span>}
          </span>
        </button>
      </li>
    );
  };
  return (
    <aside className={`salas-rolagem overflow-y-auto bg-s-lado px-2.5 py-4 ${coluna ? "block h-full" : "hidden w-64 shrink-0 border-l border-s-linha md:block"}`} aria-label="Membros">
      {emChamada.length > 0 && (
        <section className="mb-4">
          <h3 className="salas-rot px-2 text-[0.6rem] text-s-ok">Na chamada — {emChamada.length}</h3>
          <Lista rotulo="Na chamada" plana className="mt-1">{emChamada.map((m) => linha(m))}</Lista>
        </section>
      )}
      {blocos.map(([funcao, lista]) => (
        <section key={funcao || "outros"} className="mb-4">
          <h3 className="salas-rot px-2 text-[0.6rem] text-s-mudo">{funcao ? (papeis as Record<string, string>)[funcao] ?? funcao : "Por aqui"} — {lista.length}</h3>
          <Lista rotulo={funcao ? (papeis as Record<string, string>)[funcao] ?? funcao : "Por aqui"} plana className="mt-1">{lista.map((m) => linha(m))}</Lista>
        </section>
      ))}
      {longe.length > 0 && (
        <section>
          <h3 className="salas-rot px-2 text-[0.6rem] text-s-mudo">Fora agora — {longe.length}</h3>
          {/* Quem está fora fica recolhido: a lista não pode ser só de ausentes. */}
          <Lista rotulo="Fora agora" plana className="mt-1">{(todosOsLonge ? longe : longe.slice(0, 8)).map((m) => linha(m, true))}</Lista>
          {longe.length > 8 && (
            <Botao pequeno className="mx-2 mt-2 w-[calc(100%-1rem)]" onClick={() => setTodosOsLonge(!todosOsLonge)}>
              {todosOsLonge ? "Mostrar menos" : `Ver as ${longe.length} pessoas`}
            </Botao>
          )}
        </section>
      )}
    </aside>
  );
}

/** As ações de uma mensagem, numa barrinha que aparece ao passar o mouse (ou com o teclado), como no Discord. */
function Acoes({ vista, favorita, fixada, editavel, citar, reagir, encaminhar, fixar, favoritar, editar, apagar }: {
  vista: Vista; eu?: boolean; me: Me; favorita: boolean; fixada: boolean; editavel: boolean;
  citar: () => void; reagir: () => void; encaminhar: () => void; fixar: (sim: boolean) => void; favoritar: (sim: boolean) => void; editar?: () => void; apagar?: () => void;
}) {
  const pronta = Boolean(vista.conteudo);
  const item = "flex h-8 w-9 cursor-pointer items-center justify-center text-s-suave hover:bg-[var(--s-ativo)] hover:text-s-texto disabled:opacity-40";
  return (
    <span role="group" aria-label="Ações da mensagem" className="salas-folha absolute -top-5 right-5 z-10 hidden overflow-hidden text-sm group-hover:flex focus-within:flex" style={{ borderWidth: 1, boxShadow: "var(--pn-sombra-flutuante)" }}>
      <button type="button" className={item} title="Reagir" aria-label="Reagir" onClick={reagir}><IconeDaSala nome="rosto" className="h-[1.05rem] w-[1.05rem]" /></button>
      <button type="button" className={item} disabled={!pronta} title="Responder" aria-label="Responder" onClick={citar}><IconeDaSala nome="responder" className="h-[1.05rem] w-[1.05rem]" /></button>
      <button type="button" className={item} disabled={!pronta} title="Encaminhar" aria-label="Encaminhar" onClick={encaminhar}><IconeDaSala nome="encaminhar" className="h-[1.05rem] w-[1.05rem]" /></button>
      <button type="button" className={`${item} ${fixada ? "text-s-ouro" : ""}`} title={fixada ? "Desafixar" : "Fixar"} aria-label={fixada ? "Desafixar" : "Fixar"} aria-pressed={fixada} onClick={() => fixar(!fixada)}><IconeDaSala nome="alfinete" className="h-[1.05rem] w-[1.05rem]" /></button>
      <button type="button" className={`${item} ${favorita ? "text-s-ouro" : ""}`} title={favorita ? "Tirar das favoritas" : "Favoritar"} aria-label={favorita ? "Tirar das favoritas" : "Favoritar"} aria-pressed={favorita} onClick={() => favoritar(!favorita)}><IconeDaSala nome="estrela" className="h-[1.05rem] w-[1.05rem]" /></button>
      {editavel && editar && <button type="button" className={item} disabled={!pronta} title="Editar" aria-label="Editar" onClick={editar}><IconeDaSala nome="lapis" className="h-[1.05rem] w-[1.05rem]" /></button>}
      {apagar && <button type="button" className={`${item} hover:text-s-acento`} title="Apagar para todos" aria-label="Apagar para todos" onClick={apagar}><IconeDaSala nome="lixo" className="h-[1.05rem] w-[1.05rem]" /></button>}
    </span>
  );
}

/** Escolher para quais conversas encaminhar. */
function Encaminhar({ conversas, quantas, fechar, enviar }: { conversas: Conversa[]; quantas: number; fechar: () => void; enviar: (destinos: string[]) => void }) {
  const [escolhidas, setEscolhidas] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  const termo = busca.trim().toLowerCase();
  return (
    <div role="dialog" aria-label="Encaminhar" className="border-t border-s-linha bg-s-lado p-3 text-sm">
      <p className="font-semibold">Encaminhar {quantas} {quantas > 1 ? "mensagens" : "mensagem"} para…</p>
      <input value={busca} onChange={(e) => setBusca(e.target.value)} type="search" placeholder="Procurar conversa" aria-label="Procurar conversa" className="pn-campo mt-1" />
      <ul aria-label="Conversas" className="mt-2 max-h-40 overflow-y-auto border-y border-s-linha">
        {conversas.filter((conversa) => !termo || conversa.nome.toLowerCase().includes(termo)).map((conversa) => (
          <li key={conversa.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-[var(--s-hover)]">
              <input type="checkbox" className="h-4 w-4" checked={escolhidas.includes(conversa.id)} onChange={(e) => setEscolhidas(e.target.checked ? [...escolhidas, conversa.id] : escolhidas.filter((item) => item !== conversa.id))} />
              <span className="truncate">{conversa.tipo === "direta" ? conversa.nome : `# ${conversa.nome}`}</span>
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex gap-3">
        <Botao variante="principal" simbolo={Forward} disabled={escolhidas.length === 0} onClick={() => enviar(escolhidas)}>Encaminhar</Botao>
        <Botao variante="discreto" onClick={fechar}>Cancelar</Botao>
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
      <CabecalhoDeSecao nivel={2} titulo="Mensagens favoritas" simbolo={Star} acoes={<Botao variante="discreto" pequeno simbolo={X} onClick={fechar}>Fechar</Botao>} />
      <Aviso texto={lista.erro} />
      {lista.dados === null && !lista.erro && <Esqueleto forma="linhas" />}
      {lista.dados?.length === 0 && <Vazio simbolo={Star} titulo="Nenhuma mensagem favorita." texto="Use a estrela nas ações de uma mensagem." />}
      <ul className="mt-3 divide-y divide-rule border-y border-rule">
        {lista.dados?.map((item) => (
          <li key={item.id} className="py-2">
            <p className="text-xs text-ink-soft">
              <button type="button" className="pn-elo" onClick={() => abrir(item.conversa)}>{item.conversa_nome || "Conversa"}</button> · {item.nome || "Alguém"} · {hora(item.criado_em)}, {new Date(item.criado_em).toLocaleDateString(localDoPainel())}
            </p>
            <p className="whitespace-pre-line break-words" data-original>{abertos[item.id] ? semFormatacao(desempacotar(abertos[item.id]!.texto).texto) : "…"}</p>
            <Botao variante="discreto" pequeno simbolo={StarOff} onClick={() => void acao(item.id)}>Tirar das favoritas</Botao>
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
        <p className="pn-faixa pn-faixa-info max-w-xl">
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
            <Botao type="submit" simbolo={Check} disabled={nome.trim().length < 2 || (nome.trim() === dados.nome && descricao.trim() === dados.descricao)}>Guardar</Botao>
          </div>
          <label className="block max-w-xl">
            Descrição (opcional)
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={500} rows={2} className={campo} placeholder="Para que serve o grupo, combinados…" />
          </label>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <input ref={fotoNova} type="file" accept="image/*" className="hidden" onChange={(e) => { const arquivo = e.target.files?.[0]; e.target.value = ""; if (arquivo) void enviarFoto(arquivo).catch((erro) => setAviso(textoDoErro(erro))); }} />
            <Botao simbolo={Camera} onClick={() => fotoNova.current?.click()}>{dados.foto ? "Trocar a foto do grupo" : "Pôr uma foto no grupo"}</Botao>
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
                    {!membro.eu && verificado(membro.id) && <span title="Identidade verificada pessoalmente" className="ml-1.5 inline-block align-[-2px] font-normal text-ok"><Check aria-hidden className="h-3.5 w-3.5" /><span className="sr-only">verificado</span></span>}
                    {!fixo && membro.admin && <span className="ml-1.5 border border-rule px-1 text-[0.65rem] font-normal uppercase tracking-wide text-ink-soft">admin</span>}
                  </span>
                  <span className="block truncate text-xs text-ink-soft">
                    {presenca(membro.online, membro.visto_em)}
                    {!membro.eu && (
                      <>
                        {presenca(membro.online, membro.visto_em) ? " · " : ""}
                        <Botao variante="discreto" pequeno simbolo={ShieldCheck} aria-expanded={seguranca?.usuario === membro.id} onClick={() => setSeguranca(seguranca?.usuario === membro.id ? null : { usuario: membro.id, nome: membro.nome })}>código de segurança</Botao>
                      </>
                    )}
                  </span>
                </span>
              </span>
              {pode && (
                <span className="flex shrink-0 gap-3 text-xs">
                  {membro.admin ? (
                    <Botao variante="discreto" pequeno onClick={() => void fazer("chat_grupo_mudar", { p_id: dados.id, p_tirar_admin: [membro.id] })}>{membro.eu ? "Deixar de administrar" : "Tirar de admin"}</Botao>
                  ) : (
                    <Botao variante="discreto" pequeno onClick={() => void fazer("chat_grupo_mudar", { p_id: dados.id, p_admins: [membro.id] })}>Tornar admin</Botao>
                  )}
                  {membro.id !== me.id && <Botao variante="discreto" pequeno perigo simbolo={UserMinus} onClick={() => void fazer("chat_grupo_mudar", { p_id: dados.id, p_tirar: [membro.id] })}>Tirar</Botao>}
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
          <Botao simbolo={UserPlus} disabled={!novo} onClick={() => void fazer("chat_grupo_mudar", { p_id: dados.id, p_incluir: [novo] }, () => { setNovo(""); depois(); })}>Pôr no grupo</Botao>
        </div>
      )}
      {!fixo && edita && <ConviteDoGrupo conversa={dados.id} />}
      {!fixo && (
        <p className="flex flex-wrap gap-5">
          <Botao variante="discreto" pequeno simbolo={LogOut} onClick={async () => { if ((await confirmarFrase("Sair deste grupo?"))) void fazer("chat_sair", { p_id: dados.id }, saiu); }}>Sair do grupo</Botao>
          {dados.dona && (
            <Botao variante="discreto" pequeno perigo simbolo={Trash2} onClick={async () => { if ((await confirmarFrase("Apagar o grupo e todas as mensagens dele? Isso não tem volta."))) void fazer("chat_grupo_apagar", { p_id: dados.id }, saiu); }}>
              Apagar o grupo
            </Botao>
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
    case "convite": return `${por} entrou pelo convite`;
    case "tirado": return `${por} tirou ${alvo} do grupo`;
    case "saiu": return `${por} saiu do grupo`;
    case "admin": return `${por} tornou ${alvo} administrador`;
    case "admin_tirado": return `${por} tirou ${alvo} de administrador`;
    case "so_admins_enviam": return `${por} definiu que só administradores mandam mensagem`;
    case "todos_enviam": return `${por} liberou as mensagens para todo mundo`;
    case "so_admins_mudam": return `${por} definiu que só administradores mudam o grupo`;
    case "todos_mudam": return `${por} liberou nome, descrição e foto para todo mundo`;
    case "autodestruicao": return d.texto === "0" || !d.texto ? `${por} desligou a autodestruição` : `${por} ligou a autodestruição: as mensagens somem em ${nomeDoPrazo(Number(d.texto)).toLowerCase()}`;
    case "chamada": return `${por} começou uma chamada ${d.texto === "video" ? "de vídeo" : "de voz"}`;
    case "chamada_fim": {
      const minutos = Math.max(1, Math.round(Number(d.texto || 0) / 60));
      return `A chamada terminou · durou ${minutos < 60 ? `${minutos} min` : `${Math.floor(minutos / 60)} h ${minutos % 60} min`}`;
    }
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
    <div className={`my-1 rounded-md border px-2 py-1.5 text-sm ${minha ? "border-current/40" : "border-s-linha bg-s-campo"}`}>
      <p className="font-semibold">{enquete.pergunta}</p>
      <p className="text-[0.7rem] opacity-70">{enquete.varias ? "Pode marcar mais de uma" : "Marque uma"} · {total} {total === 1 ? "voto" : "votos"}</p>
      <ul className="mt-1 space-y-1">
        {enquete.opcoes.map((opcao, i) => {
          const votaram = votos.filter((voto) => voto.opcoes.includes(i));
          const marcada = meu.includes(i);
          return (
            <li key={i}>
              <button type="button" className="relative block w-full cursor-pointer overflow-hidden border border-current/30 px-2 py-1 text-left" aria-pressed={marcada} onClick={() => votar(enquete.varias ? (marcada ? meu.filter((j) => j !== i) : [...meu, i]) : [i])}>
                <span className="absolute inset-y-0 left-0 bg-gold/30" style={{ width: `${total ? (votaram.length / total) * 100 : 0}%` }} />
                <span className="relative flex justify-between gap-2"><span className="inline-flex items-center gap-1.5">{marcada ? <CircleDot aria-hidden className="h-3.5 w-3.5" /> : <Circle aria-hidden className="h-3.5 w-3.5" />}{opcao}</span><span className="font-mono text-xs">{votaram.length}</span></span>
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
    <div className={`my-1 rounded-md border px-2 py-1.5 text-sm ${minha ? "border-current/40" : "border-s-linha bg-s-campo"}`}>
      <p className="font-semibold">{evento.titulo}</p>
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
    <form className="space-y-2 border-t border-s-linha bg-s-lado p-3 text-sm" onSubmit={(e) => { e.preventDefault(); if (pergunta.trim() && validas.length >= 2) criar({ pergunta: pergunta.trim(), opcoes: validas, varias: varias || undefined }); }}>
      <p className="font-semibold">Nova enquete</p>
      <input value={pergunta} onChange={(e) => setPergunta(e.target.value)} maxLength={300} placeholder="Pergunta" aria-label="Pergunta" className={`${campo} mt-0`} required />
      {opcoes.map((opcao, i) => (
        <input key={i} value={opcao} onChange={(e) => setOpcoes(opcoes.map((atual, j) => (j === i ? e.target.value : atual)))} maxLength={100} placeholder={`Opção ${i + 1}`} aria-label={`Opção ${i + 1}`} className={`${campo} mt-0`} />
      ))}
      <p className="flex flex-wrap items-center gap-3">
        {opcoes.length < 12 && <Botao variante="discreto" pequeno onClick={() => setOpcoes([...opcoes, ""])}>+ opção</Botao>}
        <label className="flex cursor-pointer items-center gap-1"><input type="checkbox" checked={varias} onChange={(e) => setVarias(e.target.checked)} /> pode marcar mais de uma</label>
        <span className="flex-1" />
        <Botao type="submit" variante="principal" simbolo={BarChart3} disabled={!pergunta.trim() || validas.length < 2}>Enviar enquete</Botao>
        <Botao variante="discreto" onClick={fechar}>Cancelar</Botao>
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
    <form className="space-y-2 border-t border-s-linha bg-s-lado p-3 text-sm" onSubmit={(e) => { e.preventDefault(); if (valido) criar({ titulo: titulo.trim(), quando: new Date(quando).toISOString(), local: local.trim() || undefined }); }}>
      <p className="font-semibold">Novo evento</p>
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} placeholder="O que é (reunião, aula, ato…)" aria-label="Título do evento" className={`${campo} mt-0`} required />
      <div className="flex flex-wrap gap-2">
        <input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} aria-label="Data e hora" className={`${campo} mt-0 flex-1`} required />
        <input value={local} onChange={(e) => setLocal(e.target.value)} maxLength={200} placeholder="Local (opcional)" aria-label="Local" className={`${campo} mt-0 flex-1`} />
      </div>
      <p className="flex gap-3">
        <Botao type="submit" variante="principal" simbolo={CalendarDays} disabled={!valido}>Enviar evento</Botao>
        <Botao variante="discreto" onClick={fechar}>Cancelar</Botao>
      </p>
    </form>
  );
}

/** Relatar à coordenação: a pessoa escolhe contra quem, diz o motivo e vê exatamente o que será aberto. */
function Relatar({ membros, escolhidas, fechar, enviar }: { membros: MembroDaConversa[]; escolhidas: { id: string; autor: string; quando: string; texto: string }[]; fechar: () => void; enviar: (contra: string | null, motivo: string, mensagens: typeof escolhidas) => void }) {
  const [contra, setContra] = useState("");
  const [motivo, setMotivo] = useState("");
  return (
    <form role="dialog" aria-label="Relatar à coordenação" className="space-y-2 border-t border-s-linha bg-s-lado p-3 text-sm" onSubmit={(e) => { e.preventDefault(); if (motivo.trim().length >= 2) enviar(contra || null, motivo.trim(), escolhidas); }}>
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
      <ul aria-label="Mensagens escolhidas" className="max-h-32 overflow-y-auto rounded-md border border-s-linha bg-s-campo p-2 text-xs">
        {escolhidas.map((item) => <li key={item.id} className="truncate"><strong>{item.autor}</strong> ({hora(item.quando)}): {item.texto}</li>)}
      </ul>
      <p className="flex gap-3">
        <Botao type="submit" variante="principal" simbolo={Send} disabled={motivo.trim().length < 2}>Enviar o relato</Botao>
        <Botao variante="discreto" onClick={fechar}>Cancelar</Botao>
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
    const nota = (await perguntarTexto("O que foi feito? (fica registrado no relato)")) ?? "";
    setAviso("");
    try { await rpc("chat_relato_resolver", { p_id: id, p_nota: nota }); lista.recarregar(); } catch (erro) { setAviso(textoDoErro(erro)); }
  }
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <CabecalhoDeSecao nivel={2} titulo="Relatos à coordenação" simbolo={Quote} acoes={<Botao variante="discreto" pequeno simbolo={X} onClick={fechar}>Fechar</Botao>} />
      <p className="mt-1 max-w-xl text-ink-soft">Mensagens que alguém da equipe decidiu abrir e mostrar à coordenação. Fora daqui, ninguém lê conversa dos outros, nem a coordenação.</p>
      <Aviso texto={lista.erro || aviso} />
      {lista.dados === null && !lista.erro && <Esqueleto forma="cartoes" />}
      {lista.dados?.length === 0 && <Vazio simbolo={Quote} titulo="Nenhum relato." />}
      <ul className="mt-3 space-y-3">
        {lista.dados?.map((relato) => (
          <li key={relato.id} className={`pn-cartao p-3 ${relato.status === "aberto" ? "pn-cartao-destaque" : "opacity-80"}`}>
            <p className="text-xs text-ink-soft">{dataHora(relato.criado_em)} · {relato.conversa_nome} · relatado por {relato.autor || "alguém"}{relato.contra ? ` · sobre ${relato.contra}` : ""} · {relato.status === "aberto" ? "em aberto" : "resolvido"}</p>
            <p className="mt-1 font-semibold">{relato.motivo}</p>
            <ul className="mt-2 space-y-1 border-l-2 border-rule pl-2 text-sm">
              {relato.mensagens.map((item) => <li key={item.id}><strong>{item.autor}</strong> <span className="text-xs text-ink-soft">{item.quando ? dataHora(item.quando) : ""}</span>: <span className="whitespace-pre-line" data-original>{item.texto}</span></li>)}
            </ul>
            {relato.nota && <p className="mt-2 text-sm"><strong>Encaminhamento:</strong> {relato.nota}</p>}
            {relato.status === "aberto" && <Botao className="mt-2" simbolo={Check} onClick={() => void resolver(relato.id)}>Marcar como resolvido</Botao>}
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
      <CabecalhoDeSecao nivel={2} titulo="Conversas privadas em andamento" simbolo={Lock} acoes={<Botao variante="discreto" pequeno simbolo={X} onClick={fechar}>Fechar</Botao>} />
      <p className="mt-1 max-w-xl text-ink-soft">Quem está conversando em privado e quando foi a última mensagem. O conteúdo é cifrado: nem a coordenação lê.</p>
      <Aviso texto={lista.erro} />
      {lista.dados === null && !lista.erro && <Esqueleto forma="linhas" />}
      {lista.dados?.length === 0 && <Vazio simbolo={Lock} titulo="Nenhuma conversa privada." />}
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
      <CabecalhoDeSecao nivel={2} titulo="Novo grupo" simbolo={Users} acoes={<Botao variante="discreto" pequeno onClick={fechar}>Cancelar</Botao>} />
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
              className="pn-botao pn-botao-pequeno"
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
      <Botao type="submit" variante="principal" simbolo={Users} carregando={ocupado} disabled={nome.trim().length < 2 || marcados.length === 0}>Criar grupo</Botao>
      <Aviso texto={aviso} />
    </form>
  );
}
