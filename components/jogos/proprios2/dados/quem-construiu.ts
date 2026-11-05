// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Fonte } from "../tipos";

export interface PerguntaDaObra {
  id: string;
  obra: string;
  pergunta: string;
  opcoes: string[];
  certa: number;
  explicacao: string;
  fonte: Fonte;
}

/** Cada item foi conferido na página citada em 2026-11 (Wikipédia: texto sob CC BY-SA 4.0, citado com crédito). */
export const OBRAS: PerguntaDaObra[] = [
  {
    id: "brasilia",
    obra: "Brasília, obras a partir de 1956",
    pergunta: "Quem levantou o Palácio da Alvorada, o Congresso e a Esplanada dos Ministérios?",
    opcoes: [
      "Só os arquitetos e engenheiros que assinam os projetos",
      "Os candangos: trabalhadores vindos, na maioria, do Norte e do Nordeste",
      "Máquinas importadas, com pouquíssima gente",
      "Soldados de um batalhão, por ordem do governo",
    ],
    certa: 1,
    explicacao:
      "Os primeiros candangos chegaram em outubro de 1956, trazidos de Belo Horizonte para erguer o Catetinho. A maior parte veio do Norte e do Nordeste. Os projetos têm assinatura; o trabalho de levantar a cidade teve milhares de mãos que os livros quase não nomeiam.",
    fonte: { nome: "Candango (Wikipédia, CC BY-SA 4.0)", url: "https://pt.wikipedia.org/wiki/Candango" },
  },
  {
    id: "madeira-mamore",
    obra: "Estrada de Ferro Madeira-Mamoré (Rondônia), 1907 a 1912",
    pergunta: "Quanta gente, de onde, trabalhou nessa ferrovia?",
    opcoes: [
      "Algumas centenas de operários, todos brasileiros",
      "Mais de 20 mil trabalhadores de cerca de 50 nacionalidades",
      "Só engenheiros estrangeiros, com ajuda de indígenas",
      "Cerca de 500 presos, sem mais ninguém",
    ],
    certa: 1,
    explicacao:
      "A página registra mais de 20 mil trabalhadores de 50 nacionalidades. O Hospital da Candelária anotou 1.522 mortes; estimativas falam em cerca de 6 mil mortos nos cinco anos de obra. A malária responde por cerca de 80% das baixas, segundo a página. Os números variam conforme a fonte: confira sempre quem contou.",
    fonte: { nome: "Estrada de Ferro Madeira-Mamoré (Wikipédia, CC BY-SA 4.0)", url: "https://pt.wikipedia.org/wiki/Estrada_de_Ferro_Madeira-Mamor%C3%A9" },
  },
  {
    id: "aleijadinho",
    obra: "Igrejas de Ouro Preto e Santuário de Congonhas (Minas Gerais), séculos XVIII e XIX",
    pergunta: "Antônio Francisco Lisboa, o Aleijadinho, esculpiu os Doze Profetas de Congonhas. Quem foi a mãe dele?",
    opcoes: [
      "Uma fidalga da família do governador",
      "Isabel, uma mulher africana escravizada; ele nasceu escravizado e foi alforriado no batismo",
      "Uma freira do convento local",
      "Não se sabe nada sobre ela",
    ],
    certa: 1,
    explicacao:
      "O pai, Manuel Francisco Lisboa, era mestre de obras português; a mãe, Isabel, era escravizada. O filho nasceu escravizado e foi alforriado no batismo. Entre outras obras, entalhou a Via Sacra (66 estátuas, 1796 a 1799) e os Doze Profetas (1800 a 1805).",
    fonte: { nome: "Aleijadinho (Wikipédia, CC BY-SA 4.0)", url: "https://pt.wikipedia.org/wiki/Aleijadinho" },
  },
  {
    id: "central-pacific",
    obra: "Ferrovia Central Pacific (Estados Unidos), década de 1860",
    pergunta: "Quem atravessou a Serra Nevada abrindo a linha de trem?",
    opcoes: [
      "Trabalhadores chineses: cerca de 80% da turma em 1868, com salário menor que o dos brancos",
      "Apenas imigrantes irlandeses, bem pagos",
      "Soldados do exército, sem salário",
      "Mineradores de ouro que quiseram ajudar",
    ],
    certa: 0,
    explicacao:
      "Em 1867 a turma da Serra Nevada era de uns 10 mil trabalhadores, na maioria chineses; em 1868 eram cerca de 12 mil, 80% da força de trabalho quando passaram pelo Donner Summit. Recebiam 31 dólares por mês, menos que os brancos, que ainda ganhavam casa e comida. Em 25 de junho de 1867, 5 mil deles fizeram greve por jornada e salário.",
    fonte: { nome: "Central Pacific Railroad (Wikipédia, CC BY-SA 4.0)", url: "https://en.wikipedia.org/wiki/Central_Pacific_Railroad" },
  },
  {
    id: "piramide",
    obra: "Grande Pirâmide de Gizé (Egito)",
    pergunta: "Os gregos antigos acreditavam que ela foi feita por escravos. O que mostram as evidências modernas?",
    opcoes: [
      "Foi feita por milhares de trabalhadores convocados (conscritos)",
      "Foi feita por extraterrestres",
      "Foi feita só por um pequeno grupo de sacerdotes",
      "Ninguém tem ideia de como foi feita",
    ],
    certa: 0,
    explicacao:
      "A página resume: os gregos achavam que escravos a construíram, mas as evidências modernas apontam para milhares de trabalhadores convocados, e há acampamentos de trabalhadores perto do local. Se eram pagos, essa fonte não diz, e por isso o jogo não afirma nada a respeito.",
    fonte: { nome: "Great Pyramid of Giza (Wikipédia, CC BY-SA 4.0)", url: "https://en.wikipedia.org/wiki/Great_Pyramid_of_Giza" },
  },
];
