// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

export interface Lambe {
  linhas: [string, string, string];
  texto: string;
  /** O carimbo do mesmo tema: a linha de cima e a de baixo (a estrela vai no meio). */
  carimbo?: [string, string];
}

/**
 * O jeito do cartaz, que acompanha o tom do texto: o grito vermelho (o de sempre), a pergunta no anil, a memória no
 * preto de luto, a festa no amarelo do ipê, a terra no verde da mata, o cordel no papel com a xilogravura grande e o
 * classificado de poste, com as tirinhas de destacar.
 */
export const FORMATOS = ["grito", "pergunta", "memoria", "festa", "terra", "cordel", "classificado"] as const;
export type Formato = (typeof FORMATOS)[number];

/** O lambe-lambe de um dia, como chega à página inicial. */
export interface LambeDoDia {
  dia: number;
  numero: number;
  lambe: Lambe;
  xilo: string;
  formato: Formato;
}

/** O número do dia no fuso de Brasília: o cartaz troca à meia-noite daqui, para todo mundo ao mesmo tempo. */
export function diaDe(data: Date): number {
  return Math.floor((data.getTime() - 3 * 3600 * 1000) / 86_400_000);
}

/** O número da semana em Brasília, contando de segunda a domingo (o dia 0, 01/01/1970, foi uma quinta). */
export function semanaDe(data: Date): number {
  return Math.floor((diaDe(data) + 3) / 7);
}

const mdc = (a: number, b: number): number => (b === 0 ? a : mdc(b, a % b));

/**
 * Qual item sai num dia, numa lista que não acompanha o calendário: um passo fixo que não divide o tamanho da lista,
 * para que dias seguidos não tragam vizinhos no arquivo e a lista inteira passe antes de algum se repetir.
 */
export function lambeDoDia(dia: number, total: number): number {
  if (total <= 1) return 0;
  let passo = 37;
  while (mdc(passo, total) !== 1) passo++;
  return (((dia * passo) % total) + total) % total;
}

// ───────────── Datas especiais (T16, 06/11/2026) ─────────────
//
// Pedido: "caso seja uma data especial, tipo consciência negra, natal, etc., o lambe-lambe do dia vai ser o mais
// referente àquela data. Os outros dias ele tem que ser aleatório mesmo."
//
// Como escolhe: numa data deste mapa (ou num dia que o próprio estoque marca como festa), ganha o cartaz que mais
// combina com ela: o que foi escrito para aquele dia do ano (campo "dia" de content/lambes.json) vale mais; depois, os
// temas abaixo procurados no carimbo, no id e no texto do cartaz. Nos outros dias, o navegador sorteia (Math.random)
// um cartaz do estoque e guarda o sorteio só no aparelho, para o dia inteiro (veja components/inicio/LambeDoDia.tsx):
// recarregar não troca o cartaz, mas cada pessoa vê o seu, e o de amanhã não dá para prever.

/** Uma data especial: o nome (para quem lê o código e os testes) e as palavras dos temas, já sem acento. */
export interface DataEspecial {
  nome: string;
  temas: string[];
}

/**
 * Datas fixas, "MM-DD" → temas. Acrescente aqui. Cada tema é procurado como palavra inteira (aceita o plural com "s"),
 * sem acento e sem maiúscula; terminado em "*", vale como começo de palavra ("feminis*" acha feminismo e feminista).
 */
export const DATAS_ESPECIAIS: Record<string, DataEspecial> = {
  "01-01": { nome: "Ano-novo", temas: ["ano novo", "1959"] },
  "01-21": { nome: "Dia Nacional de Combate à Intolerância Religiosa", temas: ["axe", "terreiro", "intolerancia"] },
  "01-29": { nome: "Dia da Visibilidade Trans", temas: ["visibilidade", "trans", "nome"] },
  "03-08": { nome: "Dia Internacional da Mulher", temas: ["mulheres", "mulher", "feminis*"] },
  "03-14": { nome: "Marielle presente", temas: ["marielle"] },
  "03-21": { nome: "Dia Internacional contra a Discriminação Racial", temas: ["racismo", "antirracis*"] },
  "03-31": { nome: "Golpe de 1964: nunca mais", temas: ["1964", "ditadura", "nunca mais"] },
  "04-07": { nome: "Dia Mundial da Saúde", temas: ["sus", "saude"] },
  "04-17": { nome: "Massacre de Eldorado dos Carajás", temas: ["carajas", "terra", "mst", "reforma agraria"] },
  "04-19": { nome: "Dia dos Povos Indígenas", temas: ["indigena", "demarcacao", "povos", "floresta", "tekoha"] },
  "04-22": { nome: "Invasão de 1500", temas: ["1500", "indigena", "povos"] },
  "05-01": { nome: "Dia do Trabalhador", temas: ["trabalhador", "trabalho", "sindicato", "greve"] },
  "05-13": { nome: "Abolição inacabada", temas: ["abolicao", "liberdade", "quilombo", "escravi*"] },
  "05-17": { nome: "Dia contra a LGBTfobia", temas: ["lgbt", "orgulho"] },
  "05-18": { nome: "Luta Antimanicomial", temas: ["saude mental", "manicom*"] },
  "05-25": { nome: "Dia da África", temas: ["africa"] },
  "06-05": { nome: "Dia do Meio Ambiente", temas: ["floresta", "meio ambiente", "terra"] },
  "06-28": { nome: "Orgulho LGBTQIA+", temas: ["orgulho", "lgbt", "visibilidade"] },
  "07-13": { nome: "Aniversário do ECA", temas: ["eca", "crianca"] },
  "07-25": { nome: "Dia da Mulher Negra Latino-americana e Caribenha (Tereza de Benguela)", temas: ["tereza", "benguela", "mulher negra", "quilombo"] },
  "08-09": { nome: "Dia Internacional dos Povos Indígenas", temas: ["indigena", "povos"] },
  "08-29": { nome: "Visibilidade Lésbica", temas: ["lesbica", "visibilidade"] },
  "09-07": { nome: "7 de Setembro: independência pra quem? (Grito dos Excluídos)", temas: ["independencia", "grito dos", "excluidos"] },
  "09-21": { nome: "Dia de Luta da Pessoa com Deficiência", temas: ["anticapacitis*", "deficiencia", "libras"] },
  "10-12": { nome: "Dia das Crianças", temas: ["crianca", "infancia"] },
  "10-15": { nome: "Dia do Professor", temas: ["professor", "escola"] },
  "11-02": { nome: "Finados", temas: ["memoria"] },
  "11-14": { nome: "Lanceiros Negros (Porongos)", temas: ["lanceiros", "porongos"] },
  "11-15": { nome: "Proclamação da República", temas: ["republica", "15 de novembro"] },
  "11-20": { nome: "Dia da Consciência Negra (Zumbi e Dandara)", temas: ["palmares", "zumbi", "dandara", "quilombo", "consciencia negra"] },
  "11-25": { nome: "Dia pelo Fim da Violência contra a Mulher", temas: ["ni una", "violencia", "180"] },
  "12-01": { nome: "Dia Mundial de Luta contra a Aids", temas: ["prevencao", "hiv", "aids"] },
  "12-10": { nome: "Dia dos Direitos Humanos", temas: ["direitos", "humanos"] },
  "12-24": { nome: "Véspera de Natal", temas: ["natal", "ceia"] },
  "12-25": { nome: "Natal", temas: ["natal", "boas festas", "menino"] },
  "12-31": { nome: "Réveillon", temas: ["ano novo"] },
};

/** "MM-DD" de um dia (contado como em diaDe: dias desde 01/01/1970, no fuso de Brasília). */
export const mesEDia = (dia: number) => new Date(dia * 86_400_000).toISOString().slice(5, 10);

/** O n-ésimo domingo de um mês (mês de 1 a 12), como "MM-DD". */
function domingo(ano: number, mes: number, n: number): string {
  const primeiro = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
  const dia = 1 + ((7 - primeiro) % 7) + (n - 1) * 7;
  return `${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** As datas especiais do dia (fixas e as que mudam de ano para ano: Dia das Mães e Dia dos Pais), ou null. */
export function dataEspecial(dia: number): DataEspecial | null {
  const md = mesEDia(dia);
  const ano = new Date(dia * 86_400_000).getUTCFullYear();
  const fixa = DATAS_ESPECIAIS[md];
  if (fixa) return fixa;
  if (md === domingo(ano, 5, 2)) return { nome: "Dia das Mães", temas: ["mae", "creche", "cuidado"] };
  if (md === domingo(ano, 8, 2)) return { nome: "Dia dos Pais", temas: ["pai", "cuidado"] };
  return null;
}

/** Tira acento e maiúscula, para comparar temas. */
export const semAcento = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/**
 * Quanto um cartaz combina com um dia especial: 10 se foi escrito para aquele dia do ano, mais 3 por tema achado no
 * carimbo e 1 por tema achado no id ou no texto. O cartaz de maior nota ganha.
 */
export function notaDoCartaz(c: { dia: string; id: string; lambe: Lambe }, md: string, data: DataEspecial | null): number {
  let nota = c.dia === md ? 10 : 0;
  if (!data) return nota;
  const carimbo = semAcento((c.lambe.carimbo ?? []).join(" "));
  const resto = semAcento(`${c.id.replace(/-/g, " ")} ${c.lambe.linhas.join(" ")} ${c.lambe.texto}`);
  for (const tema of data.temas) {
    const t = semAcento(tema);
    const raiz = t.endsWith("*");
    const palavra = (raiz ? t.slice(0, -1) : t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const achar = new RegExp(`(^|[^a-z0-9])${palavra}${raiz ? "" : "s?(?![a-z0-9])"}`);
    if (achar.test(carimbo)) nota += 3;
    else if (achar.test(resto)) nota += 1;
  }
  return nota;
}
