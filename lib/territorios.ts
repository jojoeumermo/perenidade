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
  /** A identidade visual própria da página (components/territorios/PaginaDoColetivo.tsx); sem ela, vale o desenho do Na Atividade. */
  visual?: "noizocupa" | "kamikaze";
  slogan?: string;
  /**
   * O post do anúncio no Instagram (só o código do endereço /p/<código>/) e o texto que o apresenta. `capa` é o quadro
   * parado do vídeo (public/territorios/<slug>/anuncio-capa.webp); `vertical`, o vídeo em pé (9:16, como no Instagram).
   */
  anuncio?: { post: string; titulo: string; texto: string; capa?: string; vertical?: boolean };
  agenda?: { titulo: string; quando: string; onde: string; como: string };
  // Daqui para baixo, o que as páginas com identidade própria (NoizOcupa, Kamikaze) trazem do perfil do coletivo no
  // Instagram (com uso autorizado). Cada `post` é o código do endereço /p/<código>/ de onde o texto saiu.
  /** A segunda linha do cartaz da abertura ("Unir · Organizar · Fortalecer"). */
  lema?: string;
  /** A imagem grande da abertura. */
  capa?: Foto;
  /** A convocação do coletivo: quem e o que ele procura, e como apoiar. */
  chamado?: { titulo: string; texto: string; itens: { titulo: string; texto: string }[]; apoio?: string; post?: string };
  /** Como o coletivo nasceu, nas palavras dele. */
  historia?: { titulo: string; paragrafos: string[]; post?: string };
  /** Um trecho de manifesto do coletivo. */
  citacao?: { titulo: string; texto: string; post?: string };
  /** O trabalho em destaque (com a programação, quando houve). */
  destaque?: { chapeu: string; titulo: string; texto: string; programa?: { hora: string; titulo: string; texto: string }[]; post?: string };
  /** As campanhas do coletivo, com os cartazes. */
  campanhas?: { titulo: string; texto: string; post?: string; fotos: Foto[] }[];
  /** A linha do tempo feita com os posts. */
  marcos?: { titulo: string; itens: { quando: string; titulo: string; texto: string; post?: string }[] };
  /** As fotos e os cartazes do perfil, com o crédito de quem fotografou quando o coletivo creditou. */
  galeria?: { titulo: string; fotos: (Foto & { legenda?: string; credito?: string })[] };
}

/** Os coletivos parceiros, na ordem em que chegaram (content/territorios.json). */
export const territorios: Territorio[] = dados.territorios as Territorio[];
