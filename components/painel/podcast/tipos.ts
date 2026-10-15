// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Capitulo, FonteCitada, ObraCitada } from "@/lib/podcast";

export const ETAPAS = ["ideia", "roteiro", "gravacao", "edicao", "revisao", "aprovado", "publicado"] as const;
export type Etapa = (typeof ETAPAS)[number];

export const NOME_DA_ETAPA: Record<Etapa, string> = {
  ideia: "Ideia",
  roteiro: "Roteiro",
  gravacao: "Gravação",
  edicao: "Edição",
  revisao: "Revisão",
  aprovado: "Aprovado",
  publicado: "No ar",
};

export const SOBRE_A_ETAPA: Record<Etapa, string> = {
  ideia: "Tema anotado, ainda sem pauta.",
  roteiro: "Pauta, convidados e roteiro sendo escritos.",
  gravacao: "Gravação marcada ou acontecendo.",
  edicao: "Áudio sendo editado, transcrito e conferido.",
  revisao: "Enviado: esperando a supervisão aprovar ou pedir ajuste.",
  aprovado: "Aprovado: falta conferir a lista e publicar.",
  publicado: "No site, no feed e nas plataformas.",
};

export interface Eu {
  id: string;
  producao: boolean;
  edicao: boolean;
  supervisao: boolean;
  coordenacao: boolean;
  design: boolean;
  time: boolean;
  revisor: boolean;
}

export interface Config {
  nome: string;
  descricao: string;
  autor: string;
  email: string;
  categoria: string;
  subcategoria: string;
  explicito: boolean;
  capa: string;
  capa_mini: string;
  guardados: number;
  links: Record<string, string>;
}

export interface Serie {
  id: string;
  slug: string;
  titulo: string;
  descricao: string;
  capa: string;
  capa_mini: string;
  ordem: number;
  ativa: boolean;
}

export interface ResumoDoEpisodio {
  id: string;
  slug: string | null;
  titulo: string;
  status: Etapa;
  serie: string | null;
  temporada: number | null;
  numero: number | null;
  capa: string;
  capa_mini: string;
  disciplina: string | null;
  temas: string[];
  responsavel: { id: string; nome: string } | null;
  gravacao_em: string | null;
  publicar_em: string | null;
  publicado_em: string | null;
  atualizado_em: string;
  duracao: number;
  duracao_prevista: number;
  audio_guardado: boolean;
  externo: boolean;
  audio_bytes: number;
  enviado_por: string | null;
  comentarios: number;
  pendencias: string[];
  nota_supervisao: string;
}

export interface PainelDoPodcast {
  eu: Eu;
  config: Config;
  series: Serie[];
  episodios: ResumoDoEpisodio[];
  contagens: { revisao: number; perguntas: number; sugestoes: number; pedidos: number; comentarios: number };
  armazenamento: { limite?: number; guardados?: number; bytes_publicos?: number; bytes_producao?: number; liberar?: number; proximos?: { id: string; titulo: string; externo: boolean }[] };
}

export interface Arquivo {
  id: string;
  tipo: "bruto" | "editado" | "final" | "video" | "convidado" | "outro";
  deposito: "" | "podcast" | "podcast-producao";
  caminho: string;
  link: string;
  nome: string;
  bytes: number;
  mime: string;
  nota: string;
  guardado: boolean;
  enviado_por_nome: string | null;
  criado_em: string;
}

export interface Comentario {
  id: string;
  texto: string;
  tempo: number | null;
  arquivo: string | null;
  resolvido: boolean;
  criado_em: string;
  autor: string;
  meu: boolean;
}

export interface EpisodioCompleto {
  id: string;
  slug: string | null;
  titulo: string;
  resumo: string;
  tema: string;
  pauta: string;
  roteiro: string;
  notas: string;
  fontes: FonteCitada[];
  obras: ObraCitada[];
  duracao_prevista: number;
  convidados: string[];
  trilhas: string[];
  serie: string | null;
  temporada: number | null;
  numero: number | null;
  temas: string[];
  disciplina: string | null;
  trilha: string | null;
  status: Etapa;
  responsavel: string | null;
  responsavel_nome: string | null;
  versao: number;
  gravacao_em: string | null;
  publicar_em: string | null;
  sala: string;
  capa: string;
  capa_mini: string;
  audio: string;
  audio_bytes: number;
  audio_tipo: string;
  duracao: number;
  audio_guardado: boolean;
  audio_externo: string;
  picos: number[];
  transcricao: string;
  legendas: string;
  capitulos: Capitulo[];
  checklist: { volume?: boolean; ruido?: boolean; fontes?: boolean; trilhas?: boolean };
  explicito: boolean;
  nota_supervisao: string;
  enviado_por: string | null;
  enviado_por_nome: string | null;
  aprovado_por_nome: string | null;
  publicado_em: string | null;
  topico: string | null;
  token_revisao: string | null;
  token_validade: string | null;
  pendencias: string[];
  arquivos: Arquivo[];
  comentarios: Comentario[];
  historico: { acao: string; nota: string; nome: string; criado_em: string }[];
  convidados_dados: { id: string; nome: string; minibio: string; autoriza_voz: boolean; autoriza_imagem: boolean; contato: string }[];
  trilhas_dados: { id: string; titulo: string; autor: string; licenca: string; fonte: string }[];
  pedidos: { id: string; texto: string; status: string; criado_em: string; pedido_por: string | null }[];
  perguntas: { id: string; texto: string; assinatura: string; audio: string; status: string }[];
  plays: number;
}

export const bytes = (n: number) => (n >= 1024 * 1024 * 1024 ? `${(n / 1024 ** 3).toFixed(1)} GB` : n >= 1024 * 1024 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
