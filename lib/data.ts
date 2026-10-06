export type Area = "Inglês" | "História" | "Informática" | "Programação" | "Matemática" | "Literatura";

export const areas: Area[] = ["Inglês", "História", "Informática", "Programação", "Matemática", "Literatura"];

export interface Book {
  id: string;
  title: string;
  author: string;
  area: Area;
  synopsis: string;
  license: "Domínio público" | "CC BY" | "CC BY-SA" | "CC BY-NC";
  source: string;
  externalUrl: string;
}

// Apenas metadados + link externo. Nunca hospedamos o arquivo.
export const books: Book[] = [
  {
    id: "dom-casmurro",
    title: "Dom Casmurro",
    author: "Machado de Assis",
    area: "Literatura",
    synopsis: "Bentinho narra o ciúme e a dúvida sobre Capitu, num dos maiores romances da língua portuguesa.",
    license: "Domínio público",
    source: "Domínio Público (MEC)",
    externalUrl: "http://www.dominiopublico.gov.br",
  },
  {
    id: "romeo-and-juliet",
    title: "Romeo and Juliet",
    author: "William Shakespeare",
    area: "Inglês",
    synopsis: "A tragédia dos amantes de Verona, ótima para praticar inglês clássico.",
    license: "Domínio público",
    source: "Project Gutenberg",
    externalUrl: "https://www.gutenberg.org",
  },
  {
    id: "the-republic",
    title: "A República",
    author: "Platão",
    area: "História",
    synopsis: "Diálogo fundador da filosofia política ocidental sobre justiça e a cidade ideal.",
    license: "Domínio público",
    source: "Project Gutenberg",
    externalUrl: "https://www.gutenberg.org",
  },
  {
    id: "elementos-euclides",
    title: "Os Elementos",
    author: "Euclides",
    area: "Matemática",
    synopsis: "A obra que organizou a geometria por axiomas e demonstrações por mais de dois milênios.",
    license: "Domínio público",
    source: "Project Gutenberg",
    externalUrl: "https://www.gutenberg.org",
  },
  {
    id: "think-python",
    title: "Think Python",
    author: "Allen B. Downey",
    area: "Programação",
    synopsis: "Introdução à programação com Python, publicada sob licença aberta.",
    license: "CC BY-NC",
    source: "Green Tea Press",
    externalUrl: "https://greenteapress.com/wp/think-python-2e/",
  },
  {
    id: "the-linux-command-line",
    title: "The Linux Command Line",
    author: "William Shotts",
    area: "Informática",
    synopsis: "Guia completo do terminal Linux, de iniciante a scripts.",
    license: "CC BY",
    source: "LinuxCommand.org",
    externalUrl: "https://linuxcommand.org/tlcl.php",
  },
];

export interface Lesson {
  slug: string;
  title: string;
}

export interface Track {
  slug: string;
  title: string;
  area: Area;
  level: "Iniciante" | "Intermediário" | "Avançado";
  summary: string;
  lessons: Lesson[];
}

export const tracks: Track[] = [
  {
    slug: "ingles-do-zero",
    title: "Inglês do zero",
    area: "Inglês",
    level: "Iniciante",
    summary: "Alfabeto, saudações e frases do dia a dia.",
    lessons: [
      { slug: "alfabeto-e-sons", title: "Alfabeto e sons" },
      { slug: "saudacoes", title: "Saudações e apresentações" },
      { slug: "verbo-to-be", title: "O verbo to be" },
    ],
  },
  {
    slug: "historia-antiga",
    title: "História Antiga",
    area: "História",
    level: "Iniciante",
    summary: "Mesopotâmia, Egito, Grécia e Roma.",
    lessons: [
      { slug: "mesopotamia", title: "Mesopotâmia: o berço da escrita" },
      { slug: "biblioteca-de-alexandria", title: "A Biblioteca de Alexandria" },
    ],
  },
  {
    slug: "logica-de-programacao",
    title: "Lógica de programação",
    area: "Programação",
    level: "Iniciante",
    summary: "Variáveis, condições e laços, sem depender de linguagem.",
    lessons: [
      { slug: "variaveis", title: "Variáveis e tipos" },
      { slug: "condicoes", title: "Condições" },
      { slug: "lacos", title: "Laços de repetição" },
    ],
  },
];

export const lessonBodies: Record<string, string[]> = {
  "biblioteca-de-alexandria": [
    "Fundada no século III a.C., sob os Ptolomeus, a Biblioteca de Alexandria buscava reunir todo o saber conhecido.",
    "Navios que chegavam ao porto tinham seus rolos copiados; a cópia ficava com o dono e o original, com a biblioteca.",
    "Não houve um único incêndio que a destruiu: foi um declínio lento de financiamento, conflitos e descaso. A lição permanece: o conhecimento precisa de muitas cópias.",
  ],
};

export const defaultBody = [
  "Esta aula ainda está em construção. Ela entra aqui quando a comunidade enviar o conteúdo e a moderação aprovar.",
  "Quer escrever? Use a página Contribuir.",
];
