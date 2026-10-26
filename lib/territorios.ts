// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import dados from "@/content/territorios.json";

export interface Edicao {
  titulo: string;
  tipo: string;
  ano: string;
  cor: "preto" | "papel" | "vermelho";
  /** A capa de verdade da edição (foto do coletivo), quando já chegou. */
  imagem?: string;
  alt?: string;
}

export interface Foto {
  src: string;
  alt: string;
}

export interface Territorio {
  slug: string;
  numero: number;
  nome: string;
  linha: string;
  sobre: string;
  quem: string;
  instagram: string;
  pessoas: { nome: string; papel: string; instagram: string }[];
  temas: string[];
  edicoes: Edicao[];
  editoria: string;
  pautas: string[];
  trilhas: string[];
  capsula?: { nome: string; texto: string; pecas: string[] };
  foto?: Foto;
  fotoAtras?: Foto;
  destaques?: { chapeu: string; titulo: string; resumo: string; imagem: string; alt: string }[];
  imprensa?: { veiculo: string; titulo: string; url: string };
  /** De quem são as fotos e em que termos o site as usa (não entram na licença livre). */
  credito?: string;
  podcast?: { titulo: string; com: string };
  lancamento?: { titulo: string };
}

/** Os coletivos parceiros, na ordem em que chegaram (content/territorios.json). */
export const territorios = dados.territorios as Territorio[];
