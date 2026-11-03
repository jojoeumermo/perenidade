// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O selo de privacidade de cada ferramenta e de cada recurso que fala com alguém de fora (R1-92, Etapa 4). Cada linha
// daqui foi conferida no código: quem chama /api/... passa pelo servidor do instituto; quem abre um serviço de terceiros
// direto do navegador usa um serviço de fora; o resto fica no aparelho. O roteiro scripts/testar-acesso.mjs confere de
// novo a cada mudança (toda ferramenta tem selo, cada rota declarada existe, o método bate e a rota não grava o que a
// pessoa mandou quando o selo diz isso). Sem os atalhos "@/": o teste roda este arquivo direto no Node.

import { tools, type ToolId } from "./areas";

export type TipoDeSelo = "aparelho" | "instituto" | "externo";

/** Os serviços de fora que aparecem nos selos. O nome traduzido fica em i18n/escola/acesso/<lang>.json (servicos). */
export const SERVICOS = ["dicionarios", "tatoeba", "phet", "vozDoNavegador", "reconhecimentoDeFala", "ia", "vlibras"] as const;
export type Servico = (typeof SERVICOS)[number];

/** A parte de uma ferramenta que se comporta diferente do resto (a foto, a voz). Nome em i18n/.../partes. */
export const PARTES = ["foto", "voz"] as const;
export type Parte = (typeof PARTES)[number];

export interface Selo {
  tipo: TipoDeSelo;
  /** Com "instituto": o serviço aberto que o servidor consulta. Com "externo": o serviço de fora. */
  servico?: Servico;
  /**
   * Só com "instituto": true quando a rota foi lida e não grava o que a pessoa mandou. Pedido GET com o texto no
   * endereço nunca leva true: a hospedagem registra o endereço por pouco tempo (privacidade, "Registros técnicos").
   */
  naoGuarda?: boolean;
  /** Só com "instituto": o arquivo da rota conferida e o método do pedido. */
  rota?: string;
  metodo?: "GET" | "POST";
  /** Quando o selo vale só para uma parte da ferramenta. */
  parte?: Parte;
}

export interface SelosDeUmItem {
  /** O que vale para a ferramenta inteira (ou para tudo o que não é uma das partes). */
  principal: Selo;
  /** Partes que mandam algo para fora: cada uma com o seu selo, mostrado logo depois do principal. */
  partes?: readonly Selo[];
}

const aparelho: SelosDeUmItem = { principal: { tipo: "aparelho" } };
/** A voz do navegador (speechSynthesis): em alguns navegadores ela é gerada pela empresa do navegador (privacidade). */
const comVoz: SelosDeUmItem = { principal: { tipo: "aparelho" }, partes: [{ tipo: "externo", servico: "vozDoNavegador", parte: "voz" }] };
/** O assistente de reforço (Edge Function "assistente"): POST; pergunta, foto e resposta não são guardadas. */
const ASSISTENTE: Selo = { tipo: "instituto", naoGuarda: true, rota: "supabase/functions/assistente/index.ts", metodo: "POST" };

/** O selo de cada ferramenta da caixa (lib/areas.ts, tools). O teste falha se faltar alguma. */
export const SELOS_DAS_FERRAMENTAS: Record<ToolId, SelosDeUmItem> = {
  // A conta fica no aparelho; só a foto do exercício (opcional, com conta) vai ao assistente.
  resolvedor: { principal: { tipo: "aparelho" }, partes: [{ ...ASSISTENTE, parte: "foto" }, { tipo: "externo", servico: "ia", parte: "foto" }] },
  calculadora: aparelho,
  graficos: aparelho,
  estatistica: aparelho,
  "conversor-de-unidades": aparelho,
  "tabela-verdade": aparelho,
  "tabela-periodica": aparelho,
  "massa-molar": aparelho,
  balanceamento: aparelho,
  punnett: aparelho,
  "sistema-solar": aparelho,
  // Python e PHP rodam no próprio navegador (Pyodide e PHP em WebAssembly, servidos pelo site).
  python: aparelho,
  php: aparelho,
  html: aparelho,
  "bases-numericas": aparelho,
  cronometro: aparelho,
  redacao: aparelho,
  silabario: comVoz,
  // GET com a palavra no endereço: o servidor consulta o Wikcionário, o Dicionário Aberto e o Free Dictionary API.
  dicionario: { principal: { tipo: "instituto", servico: "dicionarios", rota: "app/api/dicionario/route.ts", metodo: "GET" } },
  pronuncia: comVoz,
  // GET com a busca no endereço: o servidor consulta o Tatoeba.
  frases: { principal: { tipo: "instituto", servico: "tatoeba", rota: "app/api/frases/route.ts", metodo: "GET" } },
  // O afinador ouve o microfone, mas o som é analisado no aparelho e não sai dele.
  afinador: aparelho,
  metronomo: aparelho,
  teclado: aparelho,
  "leitura-de-notas": aparelho,
  cores: aparelho,
  "escala-cartografica": aparelho,
  "fusos-horarios": aparelho,
  "juros-compostos": aparelho,
  "mais-valia": aparelho,
  rcp: aparelho,
  "frequencia-cardiaca": aparelho,
  // Na caixa, a IDE é só o atalho para a página dela.
  ide: aparelho,
  // As simulações abrem do próprio PhET, dentro da página: o navegador fala com o servidor deles.
  simulacoes: { principal: { tipo: "externo", servico: "phet" } },
  "fisica-simulada": aparelho,
  reacoes: aparelho,
  algoritmos: aparelho,
  criptografia: aparelho,
  grafos: aparelho,
  sudoku: aparelho,
  "referencias-abnt": aparelho,
  "palavras-geradoras": comVoz,
  solidos: aparelho,
  "contas-do-dia-a-dia": aparelho,
  "tons-do-mandarim": comVoz,
  alfabetos: comVoz,
  ceu: aparelho,
  "calculadoras-de-eletronica": aparelho,
  "direitos-trabalhistas": aparelho,
  // O dicionário chinês e os traços vêm de arquivos do próprio site; a voz é a do navegador.
  "dicionario-chines": comVoz,
  "escrita-chinesa": comVoz,
  // O dicionário de ortografia é baixado do próprio site e a conferência roda no aparelho.
  "corretor-ortografico": aparelho,
};

/** Os selos fora da caixa de ferramentas. */
export const SELOS_DE_FORA = {
  /** O reforço (components/Assistente.tsx). */
  assistente: { principal: ASSISTENTE, partes: [{ tipo: "externo", servico: "ia" }] },
  /** O botão do VLibras (components/estudo/AtivarVLibras.tsx): o navegador baixa o tradutor do governo. */
  vlibras: { principal: { tipo: "externo", servico: "vlibras" } },
  /** A prática de idiomas com reconhecimento de fala (components/Pratica.tsx, exercício "falar"). */
  reconhecimentoDeFala: { principal: { tipo: "externo", servico: "reconhecimentoDeFala" } },
} as const satisfies Record<string, SelosDeUmItem>;

export type ItemDeFora = keyof typeof SELOS_DE_FORA;

/**
 * A seção da página de privacidade de cada tipo. O renderizador (components/Markdown.tsx, rehype-slug) dá id aos
 * títulos com o github-slugger; o teste confere que estes ids existem em content/paginas/privacidade.md.
 */
export const ANCORAS: Record<TipoDeSelo, string> = {
  aparelho: "se-você-só-estuda",
  instituto: "os-serviços-que-mantêm-o-site-no-ar",
  externo: "os-serviços-que-mantêm-o-site-no-ar",
};

/** Qual frase do dicionário vale para um selo (chaves de i18n/escola/acesso/<lang>.json, grupo "selo"). */
export function fraseDoSelo(selo: Selo): "aparelho" | "instituto" | "institutoNaoGuarda" | "institutoConsulta" | "externo" {
  if (selo.tipo === "aparelho") return "aparelho";
  if (selo.tipo === "externo") return "externo";
  if (selo.servico) return "institutoConsulta";
  return selo.naoGuarda ? "institutoNaoGuarda" : "instituto";
}

/** O selo da ferramenta; undefined quando ela não está na lista (o teste impede isso). */
export function selosDaFerramenta(id: string): SelosDeUmItem | undefined {
  return (tools as readonly string[]).includes(id) ? SELOS_DAS_FERRAMENTAS[id as ToolId] : undefined;
}

/** Contagem por tipo principal, para o relatório e a documentação. */
export function resumoDosSelos(): Record<TipoDeSelo, number> {
  const resumo: Record<TipoDeSelo, number> = { aparelho: 0, instituto: 0, externo: 0 };
  for (const id of tools) resumo[SELOS_DAS_FERRAMENTAS[id].principal.tipo] += 1;
  return resumo;
}
