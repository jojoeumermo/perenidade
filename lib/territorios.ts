// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import dados from "@/content/territorios.json";

export interface Edicao {
  titulo: string;
  tipo: string;
  ano: string;
  cor: "preto" | "papel" | "vermelho";
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
}

/** Os coletivos parceiros, na ordem em que chegaram (content/territorios.json). */
export const territorios = dados.territorios as Territorio[];
