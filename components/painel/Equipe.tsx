// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { rpc, type Role } from "@/lib/backend";
import type { Aberto } from "@/lib/chaveiro";
import { desempacotar } from "@/lib/mensagem";
import { contextoDoMural } from "@/lib/sigilo";
import { safeLink } from "@/lib/text";
import { previewFile } from "@/lib/upload";
import { useI18n } from "../I18n";
import { EstanteDoAprendizado } from "./Aprendizado";
import { Avatar } from "./Avatar";
import { Aviso, botao, botaoClaro, campo, data, dataHora, elo, localDoPainel, papeis, rotulo, textoDoErro, useAcao, useLista } from "./comum";
import { Formatado } from "./Formatado";
import { AparelhoPendente, ComoFunciona, enviarCifrado, SEM_CHAVE, useAbertos, useChaveiro } from "./Sigilo";

type Etiqueta = "duvida" | "ideia" | "aviso" | "conquista" | "material" | "debate";

interface Resposta {
  id: string;
  autor: string;
  autor_id: string | null;
  avatar?: string | null;
  meu: boolean;
  corpo: string;
  criado_em: string;
  /** No fio: o comentário que este responde (nulo: responde à publicação). */
  acima?: string | null;
  apoios?: number;
  apoiei?: boolean;
}

interface Recado extends Resposta {
  /** Vem preenchido no início (todos os canais); num canal, é o próprio canal. */
  canal?: string;
  para: Role["papel"] | null;
  resolvido: boolean;
  etiqueta?: Etiqueta | null;
  fixada?: boolean;
  respostas: Resposta[];
}

export interface Canais {
  sala: string;
  canais: string[];
  /** Canal → grupo do departamento cuja chave cifra o canal ("geral" e "pedidos" usam o da equipe toda). */
  conversas: Record<string, string>;
}

export interface Membro {
  id: string;
  nome: string;
  bio: string;
  eu: boolean;
  por_aqui: boolean;
  /** De férias até esta data (Minha conta › Cuidado). */
  ferias_ate?: string | null;
  /** O que a pessoa sabe fazer (Minha conta › Perfil). */
  oficios?: string[];
  /** Com o painel aberto nos últimos dois minutos. */
  online: boolean;
  visto_em: string;
  papeis: { papel: Role["papel"]; disciplina: string | null }[];
  /** Posso abrir conversa privada com esta pessoa (liderança ou colaboração em andamento). */
  privado: boolean;
  avatar?: string;
}

/** Cada canal é uma comunidade do mural, com nome e o que se conversa nela. */
const comunidades: Record<string, { nome: string; sobre: string }> = {
  geral: { nome: "Todos", sobre: "A praça da equipe toda: avisos, ideias, conquistas e o que for de todo mundo." },
  pedidos: { nome: "Pedidos de ajuda", sobre: "Uma função pede ajuda a outra. Diga do que precisa, para quando e para qual aula; quando resolver, marque como resolvido." },
  aprendizado: { nome: "Aprendizado interno", sobre: "A equipe ensina a equipe: oficinas, estudos dirigidos e trocas de ofício." },
  coordenacao: { nome: "Coordenação", sobre: "O canal de quem coordena o instituto." },
  supervisao: { nome: "Supervisão", sobre: "O canal de quem supervisiona o trabalho da equipe." },
  curadoria: { nome: "Curadoria", sobre: "O canal de quem cuida do acervo." },
  mediacao: { nome: "Mediação", sobre: "O canal de quem media a Comunidade." },
  educacao: { nome: "Educadores", sobre: "O canal de quem escreve e dá aulas." },
  revisao: { nome: "Revisão", sobre: "O canal de quem revisa as aulas e os textos." },
  traducao: { nome: "Tradução", sobre: "O canal de quem traduz." },
  jornalismo: { nome: "Comunicação", sobre: "O canal do Departamento de Comunicação: jornal, rádio, podcast e marketing." },
  mentoria: { nome: "Reforço", sobre: "O canal de quem dá reforço escolar." },
  design: { nome: "Design", sobre: "O canal de quem desenha as artes e as páginas." },
  marketing: { nome: "Comunicação · Marketing", sobre: "O canal de quem divulga o instituto, dentro do Departamento de Comunicação." },
  desenvolvimento: { nome: "Desenvolvimento", sobre: "O canal de quem programa o site." },
};

const etiquetas: Record<Etiqueta, { nome: string; estilo: string }> = {
  aviso: { nome: "Aviso", estilo: "bg-oxblood text-parchment" },
  ideia: { nome: "Ideia", estilo: "bg-gold text-ink" },
  duvida: { nome: "Dúvida", estilo: "border border-ink text-ink" },
  conquista: { nome: "Conquista", estilo: "bg-ok text-parchment" },
  material: { nome: "Material", estilo: "bg-ink text-parchment" },
  debate: { nome: "Debate", estilo: "border border-oxblood text-oxblood" },
};

type Ordem = "alta" | "novas" | "apoiadas" | "abertas";
const ordens: { id: Ordem; nome: string }[] = [
  { id: "alta", nome: "Em alta" },
  { id: "novas", nome: "Novas" },
  { id: "apoiadas", nome: "Mais apoiadas" },
  { id: "abertas", nome: "Sem resposta" },
];

const funcoes: Role["papel"][] = ["design", "marketing", "desenvolvimento", "educacao", "curadoria", "mediacao", "revisao", "traducao", "jornalismo", "mentoria", "supervisao", "coordenacao"];
/** O texto cifrado ocupa mais espaço do que o aberto: este limite garante que ele cabe no banco. */
const MAXIMO = 2000;
/** O título é a primeira linha; uma primeira linha maior que isto é parágrafo (das publicações de antes do título). */
const TITULO = 180;
/** A partir daqui o fio para de recuar: a resposta entra no mesmo nível, para caber no celular. */
const FUNDO_DO_FIO = 5;
const CHAVE_DAS_SALVAS = "lucia:mural-salvas";
const CHAVE_DA_VISTA = "lucia:mural-vista";

/** "agora", "há 12 min", "há 3 h" ou a data, para o mural parecer conversa e não relatório. */
function quando(iso: string, agora: number) {
  const minutos = Math.round((agora - new Date(iso).getTime()) / 60000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  if (minutos < 60 * 24) return `há ${Math.round(minutos / 60)} h`;
  return new Date(iso).toLocaleDateString(localDoPainel(), { day: "2-digit", month: "2-digit" });
}

/** O "em alta": apoios e comentários pesam, e o tempo esfria (como num fórum). */
function calor(recado: Recado, agora: number) {
  const horas = Math.max(0, (agora - new Date(recado.criado_em).getTime()) / 36e5);
  return (1 + (recado.apoios ?? 0) * 1.5 + recado.respostas.length) / Math.pow(horas + 2, 1.3);
}

function partes(aberto: Aberto) {
  const texto = desempacotar(aberto.texto).texto.trim();
  const quebra = texto.indexOf("\n");
  const primeira = (quebra < 0 ? texto : texto.slice(0, quebra)).trim();
  if (primeira.length > TITULO) return { titulo: "", corpo: texto };
  return { titulo: primeira, corpo: quebra < 0 ? "" : texto.slice(quebra + 1).trim() };
}

function lerLista(chave: string): string[] {
  try {
    const valor: unknown = JSON.parse(localStorage.getItem(chave) ?? "[]");
    return Array.isArray(valor) ? valor.filter((item): item is string => typeof item === "string").slice(0, 300) : [];
  } catch {
    return [];
  }
}

function guardar(chave: string, valor: string) {
  try {
    localStorage.setItem(chave, valor);
  } catch {
    // Sem armazenamento (janela anônima): a escolha vale só até fechar.
  }
}

/** O link de uma publicação: ?aba=rede&canal=…&pub=… abre o canal com o fio aberto. */
function lerEndereco(): { canal: string | null; pub: string | null } {
  if (typeof window === "undefined") return { canal: null, pub: null };
  const busca = new URLSearchParams(window.location.search);
  const canal = busca.get("canal");
  const pub = busca.get("pub");
  return { canal: canal && /^[a-z]{3,20}$/.test(canal) ? canal : null, pub: pub && /^[0-9a-f-]{36}$/.test(pub) ? pub : null };
}

const caminhos = {
  apoio: "M12 4l7.5 8.5H15V20H9v-7.5H4.5z",
  comentario: "M4 5h16v11H9.5L5 19.5V16H4z",
  salvar: "M6.5 3.5h11v17L12 16.5l-5.5 4z",
  elo: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  pino: "M9 3.5h6l-1 5.5 3.5 3.5h-11L10 9zM12 12.5V21",
  mais: "M5.5 12h.01M12 12h.01M18.5 12h.01",
  certo: "M5 12.5l4.5 4.5L19 7.5",
  casa: "M4 11l8-7 8 7v9h-5.5v-6h-5v6H4z",
  cartoes: "M4 4.5h16v7H4zM4 14.5h16v5H4z",
  compacto: "M4 6h16M4 12h16M4 18h16",
  lixo: "M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13",
  mais_um: "M12 5v14M5 12h14",
};

function Icone({ nome, cheio = false, className = "h-4 w-4" }: { nome: keyof typeof caminhos; cheio?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`shrink-0 ${className}`} fill={cheio ? "currentColor" : "none"} stroke="currentColor" strokeWidth={nome === "mais" ? 3.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={caminhos[nome]} />
    </svg>
  );
}

const corDaComunidade = (id: string) =>
  id === "geral" ? "bg-oxblood text-parchment" : id === "pedidos" ? "bg-gold text-ink" : id === "aprendizado" ? "bg-ok text-parchment" : id === "inicio" || id === "salvas" ? "bg-parchment text-ink border border-ink" : "bg-ink text-parchment";

const faixaDa = (id: string) => (id === "inicio" || id === "salvas" ? "bg-ink" : corDaComunidade(id));

/** O selo redondo da comunidade (a inicial do nome), como o ícone de um fórum. */
function Selo({ id, grande = false }: { id: string; grande?: boolean }) {
  const tamanho = grande ? "h-16 w-16 border-4 border-parchment-deep text-3xl" : "h-6 w-6 text-[0.72rem]";
  if (id === "inicio" || id === "salvas") {
    return (
      <span aria-hidden className={`flex shrink-0 items-center justify-center rounded-full ${corDaComunidade(id)} ${tamanho}`}>
        <Icone nome={id === "inicio" ? "casa" : "salvar"} className={grande ? "h-7 w-7" : "h-3.5 w-3.5"} />
      </span>
    );
  }
  return (
    <span aria-hidden className={`flex shrink-0 items-center justify-center rounded-full font-serif font-bold ${corDaComunidade(id)} ${tamanho}`}>
      {(comunidades[id]?.nome ?? id).slice(0, 1)}
    </span>
  );
}

const pilula = "inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-parchment hover:text-ink disabled:cursor-default disabled:opacity-60";

/** O apoio (o voto do mural, só para cima). A própria publicação não se apoia. */
function BotaoDeApoio({ item, ocupado, apoiar, deitado = true }: { item: Resposta; ocupado: boolean; apoiar: (id: string, apoiar: boolean) => void; deitado?: boolean }) {
  const ativo = Boolean(item.apoiei);
  const n = item.apoios ?? 0;
  return (
    <button
      type="button"
      disabled={item.meu || ocupado}
      onClick={() => apoiar(item.id, !ativo)}
      aria-pressed={ativo}
      title={item.meu ? "Os colegas apoiam o que você escreve" : ativo ? "Retirar o apoio" : "Apoiar"}
      className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-1 rounded-full font-bold disabled:cursor-default ${deitado ? "px-2.5 py-1.5 text-xs" : "w-11 flex-col py-1.5 text-xs"} ${ativo ? "bg-oxblood text-parchment" : "bg-parchment text-ink hover:text-oxblood disabled:hover:text-ink"}`}
    >
      <Icone nome="apoio" cheio={ativo} />
      <span>{n}</span>
      <span className="sr-only">{ativo ? "Retirar o apoio" : "Apoiar"}</span>
    </button>
  );
}

function Autoria({ aberto }: { aberto: Aberto }) {
  if (aberto.autoria === "invalida") {
    return <p className="mt-1 border-l-2 border-oxblood pl-2 text-xs font-semibold text-oxblood">Não foi possível verificar o autor desta mensagem: a assinatura não confere com a identidade de quem aparece como autor.</p>;
  }
  if (aberto.autoria === "sem_identidade") return <p className="mt-1 text-[0.65rem] opacity-70">Autor ainda sem identidade conhecida neste aparelho.</p>;
  return null;
}

/** O texto de um comentário: aberto neste aparelho, ainda sem chave, ou da época da frase. */
function TextoDoComentario({ item, aberto }: { item: Resposta; aberto: Aberto | null | undefined }) {
  if (aberto === null) return <p className="italic opacity-80">{SEM_CHAVE}</p>;
  if (!aberto) return <p>…</p>;
  if (item.corpo.startsWith("c1.")) return <p className="italic opacity-80">{aberto.texto}</p>;
  return (
    <>
      <Formatado texto={desempacotar(aberto.texto).texto} className="whitespace-pre-line break-words" />
      <Autoria aberto={aberto} />
    </>
  );
}

interface Acoes {
  apoiar: (id: string, apoiar: boolean) => void;
  apagar: (id: string, publicacao: boolean) => void;
  resolver: (recado: Recado) => void;
  fixar: (recado: Recado) => void;
  salvar: (id: string) => void;
  copiar: (recado: Recado) => void;
  comentar: (recado: Recado, corpo: string, acima: string | null) => Promise<boolean>;
  abrirCanal: (canal: string) => void;
  alternarFio: (id: string) => void;
}

interface Comum {
  abertos: Record<string, Aberto | null>;
  agora: number;
  modera: boolean;
  ocupado: boolean;
  acoes: Acoes;
}

/**
 * A rede interna da equipe, no jeito de fórum: comunidades (um canal para todos, um por função, um de pedidos de ajuda
 * e o aprendizado interno), publicações com título e etiqueta, apoios, comentários em fio e fixadas pela moderação.
 * Tudo é cifrado de ponta a ponta neste aparelho, com a chave do grupo do departamento de cada canal (a mesma das
 * Conversas), antes de ser enviado, e some depois de trinta dias.
 */
export function Equipe({ usuario, lider, modera = lider, aprendiz, recarregar: recarregarConta }: { usuario: string; lider: boolean; /** Coordenação, coordenação pedagógica e supervisão apagam o que for de outra pessoa e fixam no alto. */ modera?: boolean; /** Já aceitou o termo do aprendizado interno (undefined: banco antigo). */ aprendiz?: boolean; recarregar?: () => void }) {
  const canais = useLista<Canais>("equipe_canais");
  const membros = useLista<Membro[]>("equipe_membros");
  const { chaveiro, erro } = useChaveiro(usuario);
  const [endereco] = useState(lerEndereco);
  const [onde, setOnde] = useState(endereco.canal ?? "inicio");
  const [ordem, setOrdem] = useState<Ordem>("alta");
  const [vista, setVista] = useState<"cartoes" | "compacto">(() => (typeof window !== "undefined" && lerLista(CHAVE_DA_VISTA)[0] === "compacto" ? "compacto" : "cartoes"));
  const [salvas, setSalvas] = useState<string[]>(() => (typeof window !== "undefined" ? lerLista(CHAVE_DAS_SALVAS) : []));
  const [fios, setFios] = useState<string[]>(endereco.pub ? [endereco.pub] : []);
  const [escrevendo, setEscrevendo] = useState(false);
  /** O título que a estante do aprendizado sugere para a publicação (oficina ou ensaio de aula). */
  const [proposta, setProposta] = useState("");
  const [aviso, setAviso] = useState("");
  const [agora, setAgora] = useState(() => Date.now());
  const dados = canais.dados;
  // Um link para canal que a pessoa não enxerga cai no início.
  const lugar = dados && onde !== "inicio" && onde !== "salvas" && !dados.canais.includes(onde) ? "inicio" : onde;
  const geral = lugar === "inicio" || lugar === "salvas";
  const lista = useLista<Recado[]>("equipe_listar", { p_canal: geral ? "inicio" : lugar });
  const { recarregar } = lista;
  const acao = useAcao(recarregar);
  const rolou = useRef(false);

  const itens = useMemo(
    () =>
      (lista.dados ?? []).flatMap((recado) => {
        const canal = recado.canal ?? lugar;
        const conversa = dados?.conversas[canal];
        if (!conversa) return [];
        return [recado, ...recado.respostas].map((item) => ({ id: item.id, conversa, corpo: item.corpo, contexto: contextoDoMural(canal, item.autor_id ?? ""), autor: item.autor_id }));
      }),
    [lista.dados, dados, lugar],
  );
  const abertos = useAbertos(chaveiro, itens);

  // Publicações novas aparecem sozinhas, sem a pessoa precisar recarregar; o "há 5 min" anda junto.
  useEffect(() => {
    const relogio = window.setInterval(() => {
      setAgora(Date.now());
      if (document.visibilityState === "visible") recarregar();
    }, 30000);
    return () => window.clearInterval(relogio);
  }, [recarregar]);

  // Quem chegou por um link vai direto à publicação.
  useEffect(() => {
    if (rolou.current || !endereco.pub || !lista.dados) return;
    rolou.current = true;
    window.requestAnimationFrame(() => document.getElementById(`pub-${endereco.pub}`)?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }, [endereco.pub, lista.dados]);

  const visiveis = useMemo(() => {
    let todos = lista.dados ?? [];
    if (lugar === "salvas") todos = todos.filter((recado) => salvas.includes(recado.id));
    const fixadas = geral ? [] : todos.filter((recado) => recado.fixada);
    let resto = todos.filter((recado) => geral || !recado.fixada);
    if (ordem === "abertas") resto = resto.filter((recado) => recado.respostas.length === 0 && !recado.resolvido);
    const novas = (a: Recado, b: Recado) => b.criado_em.localeCompare(a.criado_em);
    resto = [...resto].sort(
      ordem === "alta" ? (a, b) => calor(b, agora) - calor(a, agora) : ordem === "apoiadas" ? (a, b) => (b.apoios ?? 0) - (a.apoios ?? 0) || novas(a, b) : novas,
    );
    return [...fixadas, ...resto];
  }, [lista.dados, lugar, geral, salvas, ordem, agora]);

  function trocar(id: string) {
    setOnde(id);
    setEscrevendo(false);
    setAviso("");
    if (id === "salvas") setOrdem("novas");
  }

  async function escrever(canal: string, corpo: string, extras: { respostaA?: string | null; para?: string | null; etiqueta?: Etiqueta | null; acima?: string | null } = {}) {
    const conversa = dados?.conversas[canal];
    if (!chaveiro || !conversa) return false;
    setAviso("");
    try {
      await enviarCifrado(chaveiro, conversa, corpo.trim(), contextoDoMural(canal, usuario), (cifrado) =>
        rpc("equipe_escrever", {
          p_canal: canal,
          p_corpo: cifrado,
          p_resposta_a: extras.respostaA ?? null,
          p_para: extras.para ?? null,
          // Só manda o que é novo quando há o que mandar: assim o mural segue funcionando num banco ainda sem o fórum.
          ...(extras.etiqueta ? { p_etiqueta: extras.etiqueta } : {}),
          ...(extras.acima ? { p_acima: extras.acima } : {}),
        }),
      );
      recarregar();
      return true;
    } catch (falha) {
      setAviso(textoDoErro(falha));
      return false;
    }
  }

  async function apagarTudo() {
    if (!window.confirm("Apagar agora todas as conversas da equipe, de todos os canais? Isso não tem volta.")) return;
    try {
      const resposta = await rpc<{ apagadas: number }>("equipe_apagar_tudo");
      setAviso(`Tudo apagado (${resposta.apagadas} mensagens).`);
      recarregar();
    } catch (falha) {
      setAviso(textoDoErro(falha));
    }
  }

  const acoes: Acoes = {
    apoiar: (id, apoiar) => void acao.agir("equipe_apoiar", { p_id: id, p_apoiar: apoiar }, ""),
    apagar: (id, publicacao) => {
      if (!window.confirm(publicacao ? "Apagar esta publicação e os comentários dela?" : "Apagar este comentário e as respostas a ele?")) return;
      void acao.agir("equipe_apagar", { p_id: id }, publicacao ? "Publicação apagada." : "Comentário apagado.");
    },
    resolver: (recado) => void acao.agir("equipe_marcar", { p_id: recado.id, p_resolvido: !recado.resolvido }, ""),
    fixar: (recado) => void acao.agir("equipe_fixar", { p_id: recado.id, p_fixada: !recado.fixada }, recado.fixada ? "Publicação solta." : "Publicação fixada no alto do canal."),
    salvar: (id) =>
      setSalvas((antes) => {
        const depois = antes.includes(id) ? antes.filter((item) => item !== id) : [id, ...antes].slice(0, 300);
        guardar(CHAVE_DAS_SALVAS, JSON.stringify(depois));
        return depois;
      }),
    copiar: (recado) => {
      const url = new URL(window.location.href);
      url.search = "";
      url.hash = "";
      url.searchParams.set("aba", "rede");
      url.searchParams.set("canal", recado.canal ?? lugar);
      url.searchParams.set("pub", recado.id);
      navigator.clipboard.writeText(url.toString()).then(
        () => setAviso("Link copiado. Só abre para quem é da equipe e enxerga este canal."),
        () => setAviso(url.toString()),
      );
    },
    comentar: (recado, corpo, acima) => escrever(recado.canal ?? lugar, corpo, { respostaA: recado.id, acima }),
    abrirCanal: trocar,
    alternarFio: (id) => setFios((antes) => (antes.includes(id) ? antes.filter((item) => item !== id) : [...antes, id])),
  };

  if (erro) return <Aviso texto={erro} />;
  if (!dados || !chaveiro) return <Aviso texto={canais.erro || "Preparando a chave deste aparelho…"} />;
  if (chaveiro.estado !== "aprovado") return <AparelhoPendente chaveiro={chaveiro} />;

  const eu = membros.dados?.find((membro) => membro.eu);
  const comum: Comum = { abertos, agora, modera, ocupado: acao.ocupado, acoes };
  const nomeDoLugar = lugar === "inicio" ? "Início" : lugar === "salvas" ? "Salvas" : (comunidades[lugar]?.nome ?? lugar);
  const sobre =
    lugar === "inicio"
      ? "As publicações de todas as comunidades que você enxerga, num lugar só."
      : lugar === "salvas"
        ? "O que você guardou para ler depois. Fica só neste aparelho."
        : (comunidades[lugar]?.sobre ?? "");
  const comentarios = visiveis.reduce((soma, recado) => soma + recado.respostas.length, 0);
  const online = membros.dados?.filter((membro) => membro.online).length ?? 0;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[12.5rem_minmax(0,1fr)] xl:grid-cols-[12.5rem_minmax(0,1fr)_17.5rem]">
      {/* As comunidades: coluna à esquerda nas telas largas, faixa rolável no celular. */}
      <nav aria-label="Comunidades do mural" className="min-w-0 lg:row-span-2 xl:row-span-1">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:hidden">
          {["inicio", "salvas", ...dados.canais].map((id) => (
            <button key={id} type="button" onClick={() => trocar(id)} aria-current={lugar === id ? "page" : undefined} className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-sm ${lugar === id ? "border-ink bg-ink text-parchment" : "border-rule bg-parchment-deep hover:border-ink"}`}>
              <Selo id={id} />
              {id === "inicio" ? "Início" : id === "salvas" ? "Salvas" : (comunidades[id]?.nome ?? id)}
            </button>
          ))}
        </div>
        <div className="sticky top-4 hidden space-y-5 lg:block">
          <ul className="space-y-0.5">
            <ItemDoMenu id="inicio" nome="Início" ativo={lugar === "inicio"} trocar={trocar} />
            <ItemDoMenu id="salvas" nome="Salvas" ativo={lugar === "salvas"} trocar={trocar} conta={salvas.length} />
          </ul>
          <div>
            <h2 className={`${rotulo} px-2`}>Comunidades</h2>
            <ul className="mt-1.5 space-y-0.5">
              {dados.canais.map((id) => (
                <ItemDoMenu key={id} id={id} nome={comunidades[id]?.nome ?? id} ativo={lugar === id} trocar={trocar} />
              ))}
            </ul>
          </div>
        </div>
      </nav>

      <div className="min-w-0 space-y-3">
        <header className="overflow-hidden border border-rule bg-parchment-deep">
          <div aria-hidden className={`mural-faixa h-14 sm:h-16 ${faixaDa(lugar)}`} />
          <div className="flex flex-wrap items-end gap-x-3 gap-y-2 px-4 pb-3">
            <div className="-mt-7">
              <Selo id={lugar} grande />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-serif text-2xl font-semibold leading-tight">{nomeDoLugar}</h2>
              {!geral && <p className="font-mono text-xs text-ink-soft">m/{lugar}</p>}
            </div>
            {lugar !== "salvas" && (
              <button type="button" className={`${botao} hidden items-center gap-2 rounded-full px-4 py-2 sm:inline-flex`} onClick={() => setEscrevendo(true)}>
                <Icone nome="mais_um" />
                Criar publicação
              </button>
            )}
          </div>
          <p className="px-4 pb-3 text-sm text-ink-soft xl:hidden">{sobre}</p>
        </header>

        {lugar === "aprendizado" && <TermoDoAprendizado aceito={aprendiz} recarregar={() => recarregarConta?.()} />}
        {lugar === "aprendizado" && (
          <EstanteDoAprendizado
            propor={(titulo) => {
              setProposta(titulo);
              setEscrevendo(true);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        )}

        {lugar !== "salvas" && (
          <Compor
            key={`${lugar}:${proposta}`}
            tituloInicial={lugar === "aprendizado" ? proposta : ""}
            canais={dados.canais}
            inicial={geral ? "geral" : lugar}
            escolher={geral}
            eu={eu}
            aberto={escrevendo}
            setAberto={setEscrevendo}
            ocupado={acao.ocupado}
            publicar={(canal, corpo, extras) => escrever(canal, corpo, extras)}
          />
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border border-rule bg-parchment-deep px-2 py-1.5">
          <div role="tablist" aria-label="Ordenar as publicações" className="flex flex-wrap gap-1">
            {ordens.map((item) => (
              <button key={item.id} type="button" role="tab" aria-selected={ordem === item.id} onClick={() => setOrdem(item.id)} className={`cursor-pointer rounded-full px-3 py-1.5 text-sm font-semibold ${ordem === item.id ? "bg-ink text-parchment" : "text-ink-soft hover:bg-parchment hover:text-ink"}`}>
                {item.nome}
              </button>
            ))}
          </div>
          <div className="flex gap-0.5" role="group" aria-label="Jeito de ver">
            {(["cartoes", "compacto"] as const).map((jeito) => (
              <button
                key={jeito}
                type="button"
                aria-pressed={vista === jeito}
                title={jeito === "cartoes" ? "Cartões" : "Compacto"}
                onClick={() => {
                  setVista(jeito);
                  guardar(CHAVE_DA_VISTA, JSON.stringify([jeito]));
                }}
                className={`cursor-pointer rounded-full p-2 ${vista === jeito ? "bg-parchment text-ink" : "text-ink-soft hover:text-ink"}`}
              >
                <Icone nome={jeito} />
                <span className="sr-only">{jeito === "cartoes" ? "Cartões" : "Compacto"}</span>
              </button>
            ))}
          </div>
        </div>

        <Aviso texto={lista.erro || acao.aviso || aviso} />

        {lista.dados && visiveis.length === 0 && (
          <div className="border border-dashed border-rule px-6 py-12 text-center">
            <p className="font-serif text-xl font-semibold">{lugar === "salvas" ? "Nada salvo ainda" : ordem === "abertas" ? "Tudo respondido por aqui" : "Ninguém publicou aqui ainda"}</p>
            <p className="mx-auto mt-1 max-w-sm text-ink-soft">
              {lugar === "salvas" ? "Toque em “Salvar” numa publicação para guardá-la aqui." : ordem === "abertas" ? "Nenhuma publicação esperando a primeira resposta." : "Comece a conversa: uma ideia, um aviso ou um pedido de ajuda."}
            </p>
          </div>
        )}

        <div className={vista === "compacto" ? "border border-rule bg-parchment-deep" : "space-y-3"}>
          {visiveis.map((recado) => (
            <Publicacao key={recado.id} recado={recado} canal={recado.canal ?? lugar} mostrarCanal={geral} compacto={vista === "compacto"} salva={salvas.includes(recado.id)} fioAberto={fios.includes(recado.id)} {...comum} />
          ))}
        </div>
      </div>

      <aside className="min-w-0 space-y-4 lg:col-start-2 xl:col-start-3 xl:row-start-1">
        <section className="overflow-hidden border border-rule bg-parchment-deep">
          <div aria-hidden className={`h-1.5 ${faixaDa(lugar)}`} />
          <div className="p-4">
            <h2 className="font-serif text-lg font-semibold">{nomeDoLugar}</h2>
            <p className="mt-1 text-sm text-ink-soft">{sobre}</p>
            <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-rule pt-3 text-center">
              <div>
                <dt className="text-[0.65rem] uppercase tracking-wider text-ink-soft">Publicações</dt>
                <dd className="font-serif text-xl font-semibold">{visiveis.length}</dd>
              </div>
              <div>
                <dt className="text-[0.65rem] uppercase tracking-wider text-ink-soft">Comentários</dt>
                <dd className="font-serif text-xl font-semibold">{comentarios}</dd>
              </div>
              <div>
                <dt className="text-[0.65rem] uppercase tracking-wider text-ink-soft">Online</dt>
                <dd className="flex items-center justify-center gap-1.5 font-serif text-xl font-semibold">
                  <span aria-hidden className="h-2 w-2 rounded-full bg-ok" />
                  {online}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-ink-soft">Cifrado de ponta a ponta neste aparelho · some em 30 dias</p>
          </div>
        </section>

        <Apoios />

        <details className="group border border-rule bg-parchment-deep" open>
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-semibold">
            Combinados do mural
            <span aria-hidden className="text-ink-soft transition-transform group-open:rotate-180">▾</span>
          </summary>
          <ol className="list-decimal space-y-2 border-t border-rule py-3 pl-9 pr-4 text-sm text-ink-soft">
            <li>Critique o trabalho, nunca a pessoa. Todo mundo aqui é voluntário.</li>
            <li>Nada de dados pessoais de estudantes ou de quem escreveu ao instituto.</li>
            <li>Pedido atendido? Marque como resolvido, para a fila andar.</li>
            <li>Apoie o que ajudou você: é assim que o melhor sobe.</li>
          </ol>
        </details>

        <Gente membros={membros.dados} erro={membros.erro} />

        <section className="border border-rule bg-parchment-deep p-4 text-sm text-ink-soft">
          <h2 className={rotulo}>Voz e vídeo</h2>
          <p className="mt-2">As reuniões da equipe agora ficam em Conversas e reuniões.</p>
          {safeLink(dados.sala) && (
            <p className="mt-1">
              <a href={dados.sala} target="_blank" rel="noopener noreferrer" className={elo}>Abrir a sala da equipe</a>
            </p>
          )}
        </section>

        <section className="space-y-2 px-1 text-xs text-ink-soft">
          <ComoFunciona />
          {lider && (
            <button type="button" className={`${elo} block text-oxblood`} onClick={() => void apagarTudo()}>
              Apagar todas as conversas agora
            </button>
          )}
        </section>
      </aside>
    </div>
  );
}

function ItemDoMenu({ id, nome, ativo, trocar, conta }: { id: string; nome: string; ativo: boolean; trocar: (id: string) => void; conta?: number }) {
  return (
    <li>
      <button type="button" onClick={() => trocar(id)} aria-current={ativo ? "page" : undefined} className={`flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm ${ativo ? "bg-parchment-deep font-semibold text-ink shadow-[inset_3px_0_0_var(--oxblood)]" : "text-ink-soft hover:bg-parchment-deep hover:text-ink"}`}>
        <Selo id={id} />
        <span className="min-w-0 flex-1 truncate">{nome}</span>
        {conta ? <span className="text-xs text-ink-soft">{conta}</span> : null}
      </button>
    </li>
  );
}

/** A caixa de criar publicação: fechada, uma linha; aberta, título, texto, etiqueta (e, nos pedidos, para quem). */
function Compor({ canais, inicial, escolher, eu, aberto, setAberto, ocupado, publicar, tituloInicial = "" }: {
  tituloInicial?: string;
  canais: string[];
  inicial: string;
  escolher: boolean;
  eu?: Membro;
  aberto: boolean;
  setAberto: (aberto: boolean) => void;
  ocupado: boolean;
  publicar: (canal: string, corpo: string, extras: { para?: string | null; etiqueta?: Etiqueta | null }) => Promise<boolean>;
}) {
  const [canal, setCanal] = useState(inicial);
  const [titulo, setTitulo] = useState(tituloInicial);
  const [texto, setTexto] = useState("");
  const [etiqueta, setEtiqueta] = useState<Etiqueta | null>(null);
  const [para, setPara] = useState<Role["papel"]>("design");
  const [enviando, setEnviando] = useState(false);
  const corpo = texto.trim() ? `${titulo.trim()}\n\n${texto.trim()}` : titulo.trim();
  const pedido = canal === "pedidos";

  if (!aberto) {
    return (
      <div className="flex items-center gap-3 border border-rule bg-parchment-deep p-2.5">
        <Avatar nome={eu?.nome ?? "?"} avatar={eu?.avatar} className="h-9 w-9 rounded-full" />
        <button type="button" onClick={() => setAberto(true)} className="min-w-0 flex-1 cursor-text rounded-full border border-rule bg-parchment px-4 py-2 text-left text-ink-soft hover:border-ink">
          {pedido ? "Do que você precisa?" : "Criar publicação"}
        </button>
      </div>
    );
  }

  return (
    <form
      className="border-2 border-ink bg-parchment-deep"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!titulo.trim() || corpo.length > MAXIMO) return;
        setEnviando(true);
        const certo = await publicar(canal, corpo, { para: pedido ? para : null, etiqueta });
        setEnviando(false);
        if (certo) {
          setTitulo("");
          setTexto("");
          setEtiqueta(null);
          setAberto(false);
        }
      }}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-rule px-4 py-2.5 text-sm">
        <span className="font-semibold">Publicar em</span>
        {escolher ? (
          <select value={canal} onChange={(e) => setCanal(e.target.value)} className="cursor-pointer rounded-full border border-rule bg-parchment px-3 py-1" aria-label="Comunidade">
            {canais.map((id) => (
              <option key={id} value={id}>{comunidades[id]?.nome ?? id}</option>
            ))}
          </select>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full border border-rule bg-parchment py-0.5 pl-0.5 pr-3">
            <Selo id={canal} />
            {comunidades[canal]?.nome ?? canal}
          </span>
        )}
        {pedido && (
          <label className="flex items-center gap-2">
            <span className="font-semibold">para</span>
            <select value={para} onChange={(e) => setPara(e.target.value as Role["papel"])} className="cursor-pointer rounded-full border border-rule bg-parchment px-3 py-1">
              {funcoes.map((funcao) => (
                <option key={funcao} value={funcao}>{papeis[funcao]}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="space-y-3 p-4">
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value.replace(/\n/g, " "))}
          maxLength={TITULO}
          required
          autoFocus
          aria-label="Título"
          placeholder={pedido ? "Do que você precisa, numa linha" : "Título"}
          className="w-full border-0 border-b-2 border-rule bg-transparent pb-1.5 font-serif text-xl font-semibold placeholder:font-normal placeholder:text-ink-soft focus:border-ink focus:outline-none"
        />
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} aria-label="Texto" placeholder={pedido ? "Para quando, para qual aula ou matéria, o que já está pronto." : "Texto (opcional). *negrito*, _itálico_ e links funcionam."} className={`${campo} mt-0 bg-parchment`} />
        <fieldset>
          <legend className="text-xs font-semibold text-ink-soft">Etiqueta (opcional)</legend>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {(Object.keys(etiquetas) as Etiqueta[]).map((id) => (
              <button key={id} type="button" aria-pressed={etiqueta === id} onClick={() => setEtiqueta(etiqueta === id ? null : id)} className={`cursor-pointer rounded-full px-2.5 py-1 text-xs font-semibold ${etiqueta === id ? etiquetas[id].estilo : "border border-rule text-ink-soft hover:border-ink hover:text-ink"}`}>
                {etiquetas[id].nome}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rule px-4 py-2.5">
        <span className={`text-xs ${corpo.length > MAXIMO ? "font-semibold text-oxblood" : "text-ink-soft"}`}>
          {corpo.length}/{MAXIMO} · cifrado neste aparelho
        </span>
        <span className="flex gap-2">
          <button type="button" className={`${botaoClaro} rounded-full px-4 py-1.5`} onClick={() => setAberto(false)}>
            Cancelar
          </button>
          <button type="submit" className={`${botao} rounded-full px-5 py-2`} disabled={ocupado || enviando || !titulo.trim() || corpo.length > MAXIMO}>
            {pedido ? "Pedir ajuda" : "Publicar"}
          </button>
        </span>
      </div>
    </form>
  );
}

function Etiquetas({ recado }: { recado: Recado }) {
  if (!recado.etiqueta && !recado.para && !recado.resolvido) return null;
  return (
    <p className="mt-1.5 flex flex-wrap gap-1.5 text-[0.7rem] font-semibold">
      {recado.etiqueta && etiquetas[recado.etiqueta] && <span className={`rounded-full px-2 py-0.5 ${etiquetas[recado.etiqueta].estilo}`}>{etiquetas[recado.etiqueta].nome}</span>}
      {recado.para && <span className="rounded-full border border-ink px-2 py-0.5">para {papeis[recado.para]}</span>}
      {recado.resolvido && (
        <span className="inline-flex items-center gap-1 rounded-full bg-ok px-2 py-0.5 text-parchment">
          <Icone nome="certo" className="h-3 w-3" />
          resolvido
        </span>
      )}
    </p>
  );
}

function Publicacao({ recado, canal, mostrarCanal, compacto, salva, fioAberto, abertos, agora, modera, ocupado, acoes }: Comum & { recado: Recado; canal: string; mostrarCanal: boolean; compacto: boolean; salva: boolean; fioAberto: boolean }) {
  const [inteiro, setInteiro] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);
  const aberto = abertos[recado.id];
  const antiga = recado.corpo.startsWith("c1.");
  const p = aberto && !antiga ? partes(aberto) : null;
  const titulo = aberto === null ? SEM_CHAVE : !aberto ? "…" : antiga ? aberto.texto : p!.titulo;
  const corpo = p?.corpo ?? "";
  const longo = corpo.length > 420 || corpo.split("\n").length > 7;
  const n = recado.respostas.length;
  const nome = recado.autor || "Alguém que saiu da equipe";
  const resolve = (recado.meu || modera) && (canal === "pedidos" || recado.etiqueta === "duvida" || recado.resolvido);
  const fechar = () => menu.current?.removeAttribute("open");
  const comentarios = n === 0 ? "Comentar" : n === 1 ? "1 comentário" : `${n} comentários`;

  const meta = (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-ink-soft">
      {mostrarCanal && (
        <>
          <button type="button" onClick={() => acoes.abrirCanal(canal)} className="flex cursor-pointer items-center gap-1.5 font-semibold text-ink hover:underline">
            <Selo id={canal} />
            {comunidades[canal]?.nome ?? canal}
          </button>
          <span aria-hidden>•</span>
        </>
      )}
      {!compacto && <Avatar nome={nome} avatar={recado.avatar} className="h-5 w-5 rounded-full text-[0.55rem]" />}
      <span className="font-semibold text-ink">{nome}</span>
      <span aria-hidden>•</span>
      <time dateTime={recado.criado_em} title={dataHora(recado.criado_em)}>{quando(recado.criado_em, agora)}</time>
      {recado.fixada && (
        <span className="ml-1 inline-flex items-center gap-1 font-semibold text-ok">
          <Icone nome="pino" className="h-3.5 w-3.5" />
          Fixada
        </span>
      )}
      {compacto && (
        <>
          <span aria-hidden>•</span>
          <span>{comentarios}</span>
        </>
      )}
    </p>
  );

  const fio = fioAberto && <Fio recado={recado} canal={canal} abertos={abertos} agora={agora} modera={modera} ocupado={ocupado} acoes={acoes} />;

  if (compacto) {
    return (
      <article id={`pub-${recado.id}`} className={`border-b border-rule last:border-b-0 ${recado.fixada && !mostrarCanal ? "bg-parchment" : ""}`}>
        <div className="flex items-start gap-3 px-3 py-2.5">
          <BotaoDeApoio item={recado} ocupado={ocupado} apoiar={acoes.apoiar} deitado={false} />
          <div className="min-w-0 flex-1">
            <button type="button" onClick={() => acoes.alternarFio(recado.id)} aria-expanded={fioAberto} className="cursor-pointer text-left font-serif text-[1.05rem] font-semibold leading-snug hover:underline" data-original>
              {titulo || corpo.slice(0, 140)}
            </button>
            <Etiquetas recado={recado} />
            <div className="mt-1">{meta}</div>
          </div>
        </div>
        {fio}
      </article>
    );
  }

  return (
    <article id={`pub-${recado.id}`} className={`border bg-parchment-deep transition-colors ${recado.fixada && !mostrarCanal ? "border-ok" : "border-rule hover:border-ink-soft"}`}>
      <div className="px-4 pt-3">{meta}</div>
      <div className={`px-4 pt-1.5 ${recado.resolvido ? "opacity-80" : ""}`}>
        {titulo && (
          <h3 className={`font-serif text-xl font-semibold leading-snug [text-wrap:balance] ${aberto && !antiga ? "" : "font-normal italic opacity-80"}`} data-original>
            {titulo}
          </h3>
        )}
        <Etiquetas recado={recado} />
        {corpo && (
          <div className={`relative mt-2 leading-relaxed ${longo && !inteiro ? "max-h-44 overflow-hidden" : ""}`} data-original>
            <Formatado texto={corpo} className="whitespace-pre-line break-words" />
            {longo && !inteiro && <div aria-hidden className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-parchment-deep" />}
          </div>
        )}
        {longo && (
          <button type="button" onClick={() => setInteiro(!inteiro)} className="mt-1 cursor-pointer text-xs font-semibold text-oxblood hover:underline">
            {inteiro ? "Ver menos" : "Ver mais"}
          </button>
        )}
        {aberto && !antiga && <Autoria aberto={aberto} />}
      </div>
      <div className="flex flex-wrap items-center gap-1 px-2.5 py-2">
        <BotaoDeApoio item={recado} ocupado={ocupado} apoiar={acoes.apoiar} />
        <button type="button" className={`${pilula} ${fioAberto ? "bg-parchment text-ink" : ""}`} onClick={() => acoes.alternarFio(recado.id)} aria-expanded={fioAberto}>
          <Icone nome="comentario" />
          {comentarios}
        </button>
        <button type="button" className={`${pilula} ${salva ? "text-oxblood" : ""}`} onClick={() => acoes.salvar(recado.id)} aria-pressed={salva}>
          <Icone nome="salvar" cheio={salva} />
          {salva ? "Salva" : "Salvar"}
        </button>
        <button type="button" className={`${pilula} hidden sm:inline-flex`} onClick={() => acoes.copiar(recado)}>
          <Icone nome="elo" />
          Copiar link
        </button>
        {resolve && (
          <button type="button" className={`${pilula} ${recado.resolvido ? "" : "text-ok"}`} disabled={ocupado} onClick={() => acoes.resolver(recado)}>
            <Icone nome="certo" />
            {recado.resolvido ? "Reabrir" : "Resolvido"}
          </button>
        )}
        <details ref={menu} className="relative ml-auto">
          <summary className={`${pilula} list-none px-2`} aria-label="Mais opções">
            <Icone nome="mais" />
          </summary>
          <div className="absolute right-0 z-20 mt-1 w-48 border border-ink bg-parchment py-1 text-sm shadow-[4px_4px_0_var(--ink)]">
            <button type="button" className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left hover:bg-parchment-deep sm:hidden" onClick={() => { fechar(); acoes.copiar(recado); }}>
              <Icone nome="elo" />
              Copiar link
            </button>
            {modera && !mostrarCanal && (
              <button type="button" className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left hover:bg-parchment-deep" onClick={() => { fechar(); acoes.fixar(recado); }}>
                <Icone nome="pino" />
                {recado.fixada ? "Soltar do alto" : "Fixar no alto"}
              </button>
            )}
            {(recado.meu || modera) && (
              <button type="button" className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-oxblood hover:bg-parchment-deep" onClick={() => { fechar(); acoes.apagar(recado.id, true); }}>
                <Icone nome="lixo" />
                Apagar
              </button>
            )}
            {!recado.meu && !modera && <p className="px-3 py-2 text-xs text-ink-soft">Só quem escreveu, a coordenação e a supervisão apagam.</p>}
          </div>
        </details>
      </div>
      {fio}
    </article>
  );
}

/** Os comentários de uma publicação, em fio: cada resposta recua sob o comentário que responde, e um fio se recolhe. */
function Fio({ recado, canal, abertos, agora, modera, ocupado, acoes }: Comum & { recado: Recado; canal: string }) {
  const [texto, setTexto] = useState("");
  const [respondendo, setRespondendo] = useState<string | null>(null);
  const [recolhidos, setRecolhidos] = useState<string[]>([]);
  const filhos = useMemo(() => {
    const ids = new Set(recado.respostas.map((item) => item.id));
    const mapa = new Map<string | null, Resposta[]>();
    for (const item of recado.respostas) {
      const pai = item.acima && ids.has(item.acima) ? item.acima : null;
      mapa.set(pai, [...(mapa.get(pai) ?? []), item]);
    }
    // No primeiro nível, os mais apoiados primeiro; dentro do fio, a ordem da conversa.
    mapa.set(null, [...(mapa.get(null) ?? [])].sort((a, b) => (b.apoios ?? 0) - (a.apoios ?? 0) || a.criado_em.localeCompare(b.criado_em)));
    return mapa;
  }, [recado.respostas]);
  const raiz = filhos.get(null) ?? [];

  const contexto: Contexto = {
    filhos,
    autorDaPublicacao: recado.autor_id,
    respondendo,
    responder: setRespondendo,
    recolhidos,
    recolher: (id) => setRecolhidos((antes) => (antes.includes(id) ? antes.filter((item) => item !== id) : [...antes, id])),
    enviar: (corpo, acima) => acoes.comentar(recado, corpo, acima),
  };

  return (
    <section aria-label="Comentários" className="border-t border-rule bg-parchment px-4 pb-4 pt-3">
      <form
        className="border border-rule bg-parchment-deep focus-within:border-ink"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await acoes.comentar(recado, texto, null)) setTexto("");
        }}
      >
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} maxLength={MAXIMO} aria-label={`Comentar em ${comunidades[canal]?.nome ?? canal}`} placeholder="Adicionar um comentário" className="block w-full resize-y bg-transparent px-3 py-2 focus:outline-none" />
        <div className="flex justify-end px-2 pb-2">
          <button type="submit" className={`${botao} rounded-full px-4 py-1.5 text-sm`} disabled={ocupado || !texto.trim()}>
            Comentar
          </button>
        </div>
      </form>
      {raiz.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">Nenhum comentário ainda. Seja a primeira pessoa a responder.</p>
      ) : (
        <ol className="mt-4 space-y-4">
          {raiz.map((item) => (
            <Comentario key={item.id} item={item} nivel={0} contexto={contexto} abertos={abertos} agora={agora} modera={modera} ocupado={ocupado} acoes={acoes} />
          ))}
        </ol>
      )}
    </section>
  );
}

interface Contexto {
  filhos: Map<string | null, Resposta[]>;
  autorDaPublicacao: string | null;
  respondendo: string | null;
  responder: (id: string | null) => void;
  recolhidos: string[];
  recolher: (id: string) => void;
  enviar: (corpo: string, acima: string | null) => Promise<boolean>;
}

function contar(id: string, filhos: Map<string | null, Resposta[]>): number {
  return (filhos.get(id) ?? []).reduce((soma, item) => soma + 1 + contar(item.id, filhos), 0);
}

function Comentario({ item, nivel, contexto, abertos, agora, modera, ocupado, acoes }: Comum & { item: Resposta; nivel: number; contexto: Contexto }) {
  const [texto, setTexto] = useState("");
  const meus = contexto.filhos.get(item.id) ?? [];
  const recolhido = contexto.recolhidos.includes(item.id);
  const nome = item.autor || "—";
  const respondendo = contexto.respondendo === item.id;
  // No fundo do fio, a resposta entra no mesmo nível (responde ao mesmo comentário de cima).
  const acima = nivel >= FUNDO_DO_FIO ? (item.acima ?? item.id) : item.id;

  return (
    <li className="flex gap-2.5">
      <div className="flex w-7 shrink-0 flex-col items-center">
        <Avatar nome={nome} avatar={item.avatar} className="h-7 w-7 rounded-full text-[0.62rem]" />
        {!recolhido && meus.length > 0 && (
          <button type="button" onClick={() => contexto.recolher(item.id)} title="Recolher o fio" className="group mt-1 flex w-full flex-1 cursor-pointer justify-center">
            <span className="block h-full w-px bg-rule group-hover:w-0.5 group-hover:bg-ink" />
            <span className="sr-only">Recolher o fio</span>
          </button>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-ink-soft">
          <span className="font-semibold text-ink">{nome}</span>
          {item.autor_id && item.autor_id === contexto.autorDaPublicacao && <span className="rounded-full bg-ink px-1.5 text-[0.6rem] font-bold uppercase tracking-wide text-parchment">autor</span>}
          <span aria-hidden>•</span>
          <time dateTime={item.criado_em} title={dataHora(item.criado_em)}>{quando(item.criado_em, agora)}</time>
          {recolhido && (
            <button type="button" onClick={() => contexto.recolher(item.id)} className="cursor-pointer font-semibold text-oxblood hover:underline">
              + {contar(item.id, contexto.filhos)} no fio
            </button>
          )}
        </p>
        {!recolhido && (
          <>
            <div className="mt-0.5 leading-relaxed" data-original>
              <TextoDoComentario item={item} aberto={abertos[item.id]} />
            </div>
            <div className="-ml-2 mt-0.5 flex flex-wrap items-center gap-0.5">
              <BotaoDeApoio item={item} ocupado={ocupado} apoiar={acoes.apoiar} />
              <button type="button" className={pilula} onClick={() => contexto.responder(respondendo ? null : item.id)} aria-expanded={respondendo}>
                <Icone nome="comentario" />
                Responder
              </button>
              {(item.meu || modera) && (
                <button type="button" className={pilula} onClick={() => acoes.apagar(item.id, false)}>
                  <Icone nome="lixo" />
                  Apagar
                </button>
              )}
            </div>
            {respondendo && (
              <form
                className="mt-1.5 border border-rule bg-parchment-deep focus-within:border-ink"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await contexto.enviar(texto, acima)) {
                    setTexto("");
                    contexto.responder(null);
                  }
                }}
              >
                <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} maxLength={MAXIMO} autoFocus aria-label={`Responder a ${nome}`} placeholder={`Responder a ${nome}`} className="block w-full resize-y bg-transparent px-3 py-2 focus:outline-none" />
                <div className="flex justify-end gap-2 px-2 pb-2">
                  <button type="button" className="cursor-pointer rounded-full px-3 py-1.5 text-sm font-semibold text-ink-soft hover:text-ink" onClick={() => contexto.responder(null)}>
                    Cancelar
                  </button>
                  <button type="submit" className={`${botao} rounded-full px-4 py-1.5 text-sm`} disabled={ocupado || !texto.trim()}>
                    Responder
                  </button>
                </div>
              </form>
            )}
            {meus.length > 0 && (
              <ol className="mt-3 space-y-4">
                {meus.map((filho) => (
                  <Comentario key={filho.id} item={filho} nivel={nivel + 1} contexto={contexto} abertos={abertos} agora={agora} modera={modera} ocupado={ocupado} acoes={acoes} />
                ))}
              </ol>
            )}
          </>
        )}
      </div>
    </li>
  );
}

/** Quem está na equipe: primeiro quem está com o painel aberto agora. */
function Gente({ membros, erro }: { membros: Membro[] | null; erro: string }) {
  const { t } = useI18n();
  const [quem, setQuem] = useState("");
  const [todos, setTodos] = useState(false);
  const nomeDaArea = (slug: string | null) => (slug ? (t.areas[slug as keyof typeof t.areas]?.[0] ?? slug) : "");
  const filtrados = (membros ?? [])
    .filter((membro) => membro.nome.toLowerCase().includes(quem.trim().toLowerCase()))
    .sort((a, b) => Number(b.online) - Number(a.online) || Number(b.por_aqui) - Number(a.por_aqui) || a.nome.localeCompare(b.nome));
  const mostrados = todos || quem ? filtrados : filtrados.slice(0, 8);

  return (
    <section className="border border-rule bg-parchment-deep p-4">
      <h2 className={rotulo}>Quem está na equipe</h2>
      <Aviso texto={erro} />
      {(membros?.length ?? 0) > 8 && <input type="search" value={quem} onChange={(e) => setQuem(e.target.value)} placeholder="Filtrar por nome" aria-label="Filtrar a equipe por nome" className={`${campo} rounded-full border px-3 py-1.5 text-sm`} />}
      <ul className="mt-3 space-y-2.5">
        {mostrados.map((membro) => (
          <li key={membro.id} className="flex items-start gap-2.5" title={membro.bio || undefined}>
            <span className="relative shrink-0">
              <Avatar nome={membro.nome} avatar={membro.avatar} className="h-8 w-8 rounded-full text-[0.7rem]" />
              {membro.online && <span title="online" className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-parchment-deep bg-ok" />}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">
                {membro.nome}
                {membro.eu && " (você)"}
                {membro.ferias_ate && <span className="ml-1.5 rounded-sm bg-[#f9e7a6] px-1 text-[0.65rem] font-semibold text-[#1f1a14]" title={`De férias até ${new Date(`${membro.ferias_ate}T12:00:00`).toLocaleDateString()}`}>de férias</span>}
              </span>
              <span className="block text-xs leading-snug text-ink-soft">{membro.papeis.map((papel) => `${papeis[papel.papel]}${papel.disciplina ? ` · ${nomeDaArea(papel.disciplina)}` : ""}`).join(" · ")}</span>
              {membro.oficios && membro.oficios.length > 0 && <span className="block text-xs leading-snug text-prelo-texto">Sabe: {membro.oficios.join(", ")}</span>}
            </span>
          </li>
        ))}
      </ul>
      {!quem && filtrados.length > 8 && (
        <button type="button" className={`${elo} mt-3 text-sm`} onClick={() => setTodos(!todos)}>
          {todos ? "Mostrar menos" : `Ver as ${filtrados.length} pessoas`}
        </button>
      )}
    </section>
  );
}

/**
 * O aprendizado interno: um quadro de estudo entre colegas (quem sabe ensina quem quer aprender), aberto a toda a
 * equipe. Quem quer que as horas contem aceita o termo; as horas só valem para quem também assinou o termo de adesão
 * do certificado, em "Horas e certificados".
 */
function TermoDoAprendizado({ aceito, recarregar }: { aceito: boolean | undefined; recarregar: () => void }) {
  const acao = useAcao(recarregar);
  if (aceito === undefined) return null;
  return (
    <section className={`border-l-4 px-4 py-3 ${aceito ? "border-ok bg-parchment-deep" : "border-oxblood bg-parchment-deep"}`}>
      <p className="font-semibold">Aprendizado interno</p>
      <p className="mt-1 text-ink-soft">
        Aqui a equipe ensina a equipe: alguém oferece uma oficina, um estudo dirigido ou uma troca de ofício, e quem quiser acompanha. Cada dia de participação registrada conta meia hora de voluntariado, só para quem aceitou este termo e assinou o termo de adesão em “Horas e certificados”.
      </p>
      {aceito ? (
        <p className="mt-2 text-xs text-ink-soft">Você participa do aprendizado interno. <button type="button" className="cursor-pointer underline" disabled={acao.ocupado} onClick={() => acao.agir("aprendizado_aceitar", { p_aceito: false }, "Você saiu do aprendizado interno.")}>Sair</button></p>
      ) : (
        <button type="button" className={`mt-3 ${botao}`} disabled={acao.ocupado} onClick={() => acao.agir("aprendizado_aceitar", { p_aceito: true }, "Bem-vindo ao aprendizado interno.")}>Aceito participar</button>
      )}
      <Aviso texto={acao.aviso} />
    </section>
  );
}

interface Arquivo {
  id: string;
  caminho: string;
  nome: string;
  status: string;
  criado_em: string;
  de: string;
  meu: boolean;
  apoios: number;
  apoiei: boolean;
}

/** Imagem ou PDF enviado por alguém da equipe só segue para a decisão da coordenação depois de dois apoios de colegas. */
function Apoios() {
  const lista = useLista<Arquivo[]>("arquivos_listar");
  const acao = useAcao(lista.recarregar);
  const esperando = lista.dados?.filter((arquivo) => arquivo.status === "pendente") ?? [];

  async function ver(caminho: string) {
    try {
      window.open(await previewFile(caminho), "_blank", "noopener,noreferrer");
    } catch {
      acao.setAviso("Não foi possível abrir o arquivo.");
    }
  }

  if (esperando.length === 0) return null;
  return (
    <section className="border-2 border-ink bg-parchment-deep p-4">
      <h2 className="font-serif text-lg font-semibold leading-snug">Imagens e arquivos esperando o apoio da equipe</h2>
      <p className="mt-1 text-sm text-ink-soft">Nada que tenha imagem vai ao ar por decisão de uma pessoa só. Abra, olhe com calma e apoie se estiver correto. Com dois apoios, a coordenação pode aprovar.</p>
      <Aviso texto={lista.erro || acao.aviso} />
      <ul className="mt-2 divide-y divide-rule">
        {esperando.map((arquivo) => (
          <li key={arquivo.id} className="py-2.5 text-sm">
            <p className="break-words font-semibold">{arquivo.nome}</p>
            <p className="text-xs text-ink-soft">
              {arquivo.caminho.split(".").pop()?.toUpperCase()} · {data(arquivo.criado_em)} · {arquivo.meu ? "enviado por você" : `de ${arquivo.de || "—"}`} · {arquivo.apoios} de 2 apoios
            </p>
            <p className="mt-1 flex gap-4">
              <button type="button" className={elo} onClick={() => void ver(arquivo.caminho)}>
                Ver
              </button>
              {!arquivo.meu && (
                <button type="button" className={elo} disabled={acao.ocupado} onClick={() => acao.agir("arquivo_apoiar", { p_id: arquivo.id, p_apoiar: !arquivo.apoiei }, arquivo.apoiei ? "Apoio retirado." : "Apoio registrado.")}>
                  {arquivo.apoiei ? "Retirar apoio" : "Apoiar"}
                </button>
              )}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

