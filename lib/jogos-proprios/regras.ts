// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Jogos próprios (parte 1): as regras puras e os dados com fonte. Sem React, sem disco, sem "@/": o teste
// (scripts/testar-jogos-proprios.mjs) importa este arquivo direto. Os componentes ficam em components/jogos/proprios/.
//
// Regra de ouro: número, lei e fato só entram aqui com fonte conferida (docs/jogos-proprios.md lista a conferência).
// O que é exemplo inventado para ensinar (o sapato de R$ 100, a costureira) diz "exemplo" na tela.

export interface Fonte {
  titulo: string;
  url?: string;
}

/* ---------- Linha de montagem (mais-valia) ---------- */

export interface ResultadoMaisValia {
  /** Horas do dia que bastam para o trabalhador produzir o valor do próprio salário. */
  horasNecessarias: number;
  /** Horas que sobram até o fim da jornada: o valor produzido nelas fica com quem contrata. */
  horasExcedentes: number;
  /** Valor produzido no dia inteiro. */
  valorDoDia: number;
  /** Parte do valor do dia que fica com o trabalhador (o salário). */
  paraQuemTrabalha: number;
  /** Parte que fica com quem contrata (antes de pagar matéria-prima, aluguel e impostos, que o exemplo ignora). */
  paraQuemContrata: number;
  /** Taxa de mais-valia de Marx: tempo excedente dividido pelo necessário. */
  taxa: number;
}

/** Exemplo: salário do dia, valor que o trabalho cria por hora e horas da jornada. Todos os valores são do exemplo. */
export function maisValia(salarioDia: number, valorPorHora: number, horas: number): ResultadoMaisValia {
  const h = Math.max(0, horas);
  const v = Math.max(0, valorPorHora);
  const s = Math.max(0, salarioDia);
  const valorDoDia = v * h;
  const pago = Math.min(s, valorDoDia);
  const horasNecessarias = v > 0 ? Math.min(h, s / v) : h;
  const horasExcedentes = Math.max(0, h - horasNecessarias);
  return {
    horasNecessarias,
    horasExcedentes,
    valorDoDia,
    paraQuemTrabalha: pago,
    paraQuemContrata: Math.max(0, valorDoDia - pago),
    taxa: horasNecessarias > 0 ? horasExcedentes / horasNecessarias : 0,
  };
}

/* ---------- Quem é o dono? ---------- */

export type Destino = "trabalho" | "dono" | "estado" | "fornecedor";
export const DESTINOS: { id: Destino; nome: string }[] = [
  { id: "trabalho", nome: "Quem trabalha" },
  { id: "dono", nome: "Quem é dono do negócio" },
  { id: "estado", nome: "O Estado" },
  { id: "fornecedor", nome: "Quem vendeu o material" },
];

export interface CartaDeFluxo {
  id: string;
  texto: string;
  destino: Destino;
  explicacao: string;
}

/** Exemplo inventado: um par de sapatos vendido por R$ 100. Nenhum número aqui é dado de pesquisa. */
export const CARTAS_DE_FLUXO: CartaDeFluxo[] = [
  { id: "salario", texto: "Salário de quem costura os sapatos", destino: "trabalho", explicacao: "O salário é o preço do tempo de trabalho vendido ao dono." },
  { id: "lucro", texto: "Lucro que sobra depois de pagar tudo", destino: "dono", explicacao: "O lucro vai para quem é dono do negócio, mesmo que não tenha costurado nenhum sapato." },
  { id: "couro", texto: "Couro e cola comprados de outra empresa", destino: "fornecedor", explicacao: "Matéria-prima é paga a quem a vende. Aquela empresa também tem seus donos e seus trabalhadores." },
  { id: "imposto", texto: "Imposto embutido no preço do sapato", destino: "estado", explicacao: "O imposto sobre o consumo vai para os cofres públicos e paga serviços do Estado." },
  { id: "hora-extra", texto: "Pagamento da hora extra trabalhada", destino: "trabalho", explicacao: "Hora extra é tempo de trabalho a mais, pago a quem trabalhou." },
  { id: "tributo-lucro", texto: "Imposto de renda sobre o lucro da empresa", destino: "estado", explicacao: "Tributo cobrado sobre o ganho, não sobre o preço do produto." },
];

export function conferirFluxo(colocacoes: Record<string, Destino | undefined>): { certas: number; total: number; erradas: string[] } {
  const erradas = CARTAS_DE_FLUXO.filter((c) => colocacoes[c.id] !== c.destino).map((c) => c.id);
  return { certas: CARTAS_DE_FLUXO.length - erradas.length, total: CARTAS_DE_FLUXO.length, erradas };
}

/* ---------- Conquistas e greves ---------- */

export interface Conquista {
  id: string;
  direito: string;
  /** Onde está garantido hoje. */
  lei: string;
  fonte: Fonte;
}

const CF = "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm";
export const CONQUISTAS: Conquista[] = [
  { id: "13", direito: "13º salário", lei: "Lei nº 4.090, de 13 de julho de 1962; Constituição, art. 7º, VIII", fonte: { titulo: "Lei nº 4.090/1962", url: "https://www.planalto.gov.br/ccivil_03/leis/l4090.htm" } },
  { id: "ferias", direito: "Férias com um terço a mais", lei: "Constituição, art. 7º, XVII", fonte: { titulo: "Constituição de 1988", url: CF } },
  { id: "repouso", direito: "Descanso semanal remunerado", lei: "Lei nº 605, de 5 de janeiro de 1949; Constituição, art. 7º, XV", fonte: { titulo: "Lei nº 605/1949", url: "https://www.planalto.gov.br/ccivil_03/leis/l0605.htm" } },
  { id: "jornada", direito: "Jornada de oito horas por dia", lei: "Constituição, art. 7º, XIII (e a CLT, Decreto-Lei nº 5.452, de 1º de maio de 1943)", fonte: { titulo: "Constituição de 1988", url: CF } },
  { id: "gestante", direito: "Licença-gestante de 120 dias", lei: "Constituição, art. 7º, XVIII", fonte: { titulo: "Constituição de 1988", url: CF } },
  { id: "fgts", direito: "Fundo de garantia (FGTS)", lei: "Constituição, art. 7º, III", fonte: { titulo: "Constituição de 1988", url: CF } },
  { id: "menores", direito: "Proibição de trabalho a menores de 16 anos (salvo aprendiz, a partir de 14)", lei: "Constituição, art. 7º, XXXIII", fonte: { titulo: "Constituição de 1988", url: CF } },
  { id: "convencao", direito: "Reconhecimento dos acordos e convenções coletivas", lei: "Constituição, art. 7º, XXVI", fonte: { titulo: "Constituição de 1988", url: CF } },
  { id: "greve", direito: "Direito de greve", lei: "Constituição, art. 9º", fonte: { titulo: "Constituição de 1988", url: CF } },
];

/** Segunda rodada: a pauta da greve geral de 1917 em São Paulo (fontes: IHU Unisinos e Agência CEUB, ver docs/jogos-proprios.md). */
export interface ItemDePauta {
  id: string;
  texto: string;
  estavaNaPauta: boolean;
}
export const PAUTA_1917: ItemDePauta[] = [
  { id: "oito", texto: "Jornada de 8 horas", estavaNaPauta: true },
  { id: "menores", texto: "Proibição do trabalho de menores de 14 anos", estavaNaPauta: true },
  { id: "noturno", texto: "Fim do trabalho noturno para mulheres e menores de 14 anos", estavaNaPauta: true },
  { id: "aumento", texto: "Aumento de salários", estavaNaPauta: true },
  { id: "fgts", texto: "FGTS", estavaNaPauta: false },
  { id: "treze", texto: "13º salário", estavaNaPauta: false },
  { id: "gestante", texto: "Licença-gestante de 120 dias", estavaNaPauta: false },
];
export const FONTES_1917: Fonte[] = [
  { titulo: "A greve geral paulista de 1917 e os seus reflexos no movimento operário brasileiro (IHU Unisinos)", url: "https://ihu.unisinos.br/categorias/186-noticias-2017/568240-a-greve-geral-paulista-de-1917-e-os-seus-reflexos-no-movimento-operario-brasileiro" },
  { titulo: "Greve geral de 1917: paralisação deixou legado (Agência de Notícias CEUB)", url: "https://agenciadenoticias.uniceub.br/brasil/greve-geral-paralisacao-de-1917-deixou-legado-mas-pais-evoluiu-pouco-dizem-historiadores/" },
];

/* ---------- Orçamento: quem paga a conta? ---------- */

/** Carga tributária bruta de 2023, em % do PIB (Receita Federal, "Carga Tributária no Brasil de 2023"). */
export const CTB_2023 = { total: 32.11, uniao: 21.78, estados: 8.01, municipios: 2.31 };
export const FONTE_CTB: Fonte = { titulo: "Receita Federal do Brasil, Carga Tributária no Brasil de 2023", url: "https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/estudos/carga-tributaria/carga-tributaria-no-brasil-2023" };

/** Despesas de consumo das famílias, participação média no total (IBGE, POF 2017-2018). "outros" é o que resta até 100. */
export const POF_2017_2018 = { habitacao: 36.6, transporte: 18.1, alimentacao: 17.5 };
export const FONTE_POF: Fonte = { titulo: "IBGE, Pesquisa de Orçamentos Familiares 2017-2018", url: "https://agenciadenoticias.ibge.gov.br/agencia-sala-de-imprensa/2013-agencia-de-noticias/releases/25598-pof-2017-2018-familias-com-ate-r-1-9-mil-destinam-61-2-de-seus-gastos-a-alimentacao-e-habitacao" };

export function outrosGastos(): number {
  return Math.round((100 - POF_2017_2018.habitacao - POF_2017_2018.transporte - POF_2017_2018.alimentacao) * 10) / 10;
}

/** Quanto do PIB (de cada R$ 1.000 produzidos) vira arrecadação, e quanto cabe a cada nível de governo, mantida a proporção de 2023. */
export function repartirCarga(cargaPct: number): { uniao: number; estados: number; municipios: number; total: number } {
  const c = Math.max(0, cargaPct);
  const f = c / CTB_2023.total;
  const r = (n: number) => Math.round(n * 100) / 100;
  return { uniao: r(CTB_2023.uniao * f), estados: r(CTB_2023.estados * f), municipios: r(CTB_2023.municipios * f), total: r(c) };
}

/**
 * Exemplo para sentir o que é imposto "regressivo": duas famílias hipotéticas, uma gasta quase toda a renda e a outra guarda
 * parte. Um imposto de `aliquotaConsumo`% só sobre o que se gasta pesa mais, proporcionalmente, na que gasta tudo.
 * Retorna quanto cada família paga, em % da renda. A conta é de aritmética simples; os números são do exemplo.
 */
export function pesoNaRenda(aliquotaConsumoPct: number, parteGastaPct: number): number {
  return Math.round((aliquotaConsumoPct * parteGastaPct) / 100 * 100) / 100;
}

/* ---------- Fato ou boato? ---------- */

export interface ChecagemParaJogo {
  slug: string;
  alegacao: string;
  veredito: string;
  titulo: string;
}

/** Só entra no jogo checagem com veredito claro. "Falso" e "Enganoso" viram "boato"; "Verdadeiro" vira "fato". */
export function classeDoVeredito(veredito: string): "fato" | "boato" | "enganoso" | null {
  const v = veredito.trim().toLowerCase();
  if (v === "verdadeiro" || v === "fato") return "fato";
  if (v === "falso") return "boato";
  if (v === "enganoso") return "enganoso";
  return null;
}

/** Sorteia `n` checagens sem repetir. O sorteio roda só depois de um clique (não há diferença entre servidor e navegador). */
export function sortear<T>(lista: readonly T[], n: number, aleatorio: () => number = Math.random): T[] {
  const c = [...lista];
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c.slice(0, Math.max(0, n));
}

/* ---------- Detetive de fake news ---------- */

export interface Sinal {
  id: string;
  trecho: string;
  /** Verdadeiro se o trecho é sinal de alerta de verdade. */
  alerta: boolean;
  porque: string;
}

/** Mensagem INVENTADA para treino (ninguém, empresa ou fato real). Cada trecho é marcável. */
export const MENSAGEM_DE_TREINO: { titulo: string; sinais: Sinal[] } = {
  titulo: "Corrente recebida num grupo da família (texto inventado para o jogo)",
  sinais: [
    { id: "urgente", trecho: "URGENTE!!! COMPARTILHE ANTES QUE APAGUEM!!!", alerta: true, porque: "Pressa e medo de censura empurram a pessoa a repassar sem pensar." },
    { id: "cientistas", trecho: "Cientistas descobriram que um chá de casca de limão cura qualquer doença.", alerta: true, porque: "\"Cientistas\" sem nome, instituição ou estudo, e uma cura para \"qualquer\" doença, é promessa grande demais." },
    { id: "amigo", trecho: "Meu primo, que trabalha num hospital, me contou.", alerta: true, porque: "Fonte de segunda mão que ninguém consegue conferir." },
    { id: "data", trecho: "Mensagem enviada em 4 de novembro, de um grupo de bairro.", alerta: false, porque: "Data e origem do recebimento não provam nada, nem a favor nem contra." },
    { id: "link", trecho: "Leia o estudo completo em: (nenhum link)", alerta: true, porque: "Diz que há estudo mas não mostra onde está." },
    { id: "pergunta", trecho: "Converse com seu médico antes de trocar qualquer tratamento.", alerta: false, porque: "Conselho prudente: não é sinal de alerta." },
  ],
};

export function conferirSinais(marcados: readonly string[]): { acertos: string[]; erros: string[]; faltaram: string[] } {
  const set = new Set(marcados);
  const sinais = MENSAGEM_DE_TREINO.sinais;
  return {
    acertos: sinais.filter((s) => s.alerta && set.has(s.id)).map((s) => s.id),
    erros: sinais.filter((s) => !s.alerta && set.has(s.id)).map((s) => s.id),
    faltaram: sinais.filter((s) => s.alerta && !set.has(s.id)).map((s) => s.id),
  };
}

/* ---------- A catraca e o relógio ---------- */

export interface DiaDeTrabalho {
  /** Horas de trabalho, ida e volta do trabalho, sono e o que sobra do dia de 24 horas. */
  trabalho: number;
  deslocamento: number;
  sono: number;
  sobra: number;
}

/** Dia de 24 horas. Os números que a pessoa escolhe são do exemplo; só o limite de 8 horas diárias da jornada vem da Constituição, art. 7º, XIII. */
export function diaDeTrabalho(trabalho: number, deslocamento: number, sono: number): DiaDeTrabalho {
  const t = Math.max(0, trabalho);
  const d = Math.max(0, deslocamento);
  const s = Math.max(0, sono);
  return { trabalho: t, deslocamento: d, sono: s, sobra: Math.round((24 - t - d - s) * 100) / 100 };
}

/** Quanto o trajeto come do tempo "fora da cama e do emprego". */
export function parteDoTempoLivre(dia: DiaDeTrabalho): number {
  const livreBruto = 24 - dia.trabalho - dia.sono;
  return livreBruto > 0 ? Math.round((dia.deslocamento / livreBruto) * 100) : 0;
}

/* ---------- Negociação coletiva ---------- */

export interface EscolhaDeNegociacao {
  texto: string;
  /** Efeito nos dois medidores, de -2 a +2. */
  forca: number;
  abertura: number;
  retorno: string;
  proxima: string;
}
export interface CenaDeNegociacao {
  id: string;
  titulo: string;
  texto: string;
  escolhas: EscolhaDeNegociacao[];
}

/** História inventada: padaria industrial "Pão Novo" (não existe). Só a base legal é real. */
export const CENAS_DE_NEGOCIACAO: CenaDeNegociacao[] = [
  {
    id: "assembleia",
    titulo: "A assembleia",
    texto: "A padaria industrial Pão Novo (inventada) tem 120 trabalhadores. A data-base chegou e o sindicato convoca assembleia para montar a pauta. A Constituição obriga a participação do sindicato na negociação (art. 8º, VI). O que fazer primeiro?",
    escolhas: [
      { texto: "Perguntar a todos o que é mais urgente e votar a pauta.", forca: 2, abertura: 0, retorno: "A pauta nasce da base. Fica mais difícil a empresa dizer que ela não representa ninguém.", proxima: "mesa" },
      { texto: "A diretoria do sindicato escreve a pauta sozinha, para ganhar tempo.", forca: -1, abertura: 1, retorno: "É rápido, mas parte da turma não se vê na pauta e o apoio esfria.", proxima: "mesa" },
    ],
  },
  {
    id: "mesa",
    titulo: "A primeira rodada",
    texto: "A empresa recebe a pauta (reposição da inflação, vale-alimentação e fim da escala sem folga) e responde: \"o caixa está apertado\". Pede para ver apenas o reajuste.",
    escolhas: [
      { texto: "Pedir os números da empresa e conferir com a turma antes de ceder.", forca: 1, abertura: 1, retorno: "Pedir informação é legítimo e mostra seriedade. A empresa fica sem o argumento vago.", proxima: "impasse" },
      { texto: "Aceitar só o reajuste e deixar o resto para o ano que vem.", forca: -2, abertura: 2, retorno: "A empresa sorri, mas a turma sente que as outras pautas foram deixadas de lado.", proxima: "impasse" },
      { texto: "Sair da mesa e anunciar greve na mesma hora.", forca: 0, abertura: -2, retorno: "A greve é um direito (art. 9º), mas sem preparo e sem tentar a mesa a empresa endurece.", proxima: "impasse" },
    ],
  },
  {
    id: "impasse",
    titulo: "O impasse",
    texto: "Passaram-se três rodadas. A empresa cede o vale-alimentação, mas diz não à folga semanal. A categoria está dividida.",
    escolhas: [
      { texto: "Fazer nova assembleia e propor uma escala de folga em etapas.", forca: 1, abertura: 1, retorno: "A proposta em etapas deixa a empresa se mexer sem perder a face e a categoria decide junto.", proxima: "fim" },
      { texto: "Manter a pauta inteira e votar a greve, com aviso prévio e fundo de apoio.", forca: 2, abertura: -1, retorno: "Avisada e organizada, a greve pressiona sem ferir a lei. O custo para todos é real.", proxima: "fim" },
      { texto: "Fechar o acordo como está para acabar logo.", forca: -2, abertura: 2, retorno: "Acaba rápido, mas a questão da folga continua como ferida aberta.", proxima: "fim" },
    ],
  },
];

export function finalDaNegociacao(forca: number, abertura: number): { titulo: string; texto: string } {
  if (forca >= 3 && abertura >= 0) return { titulo: "Acordo bom e firme", texto: "A categoria entrou unida e a empresa viu vantagem em fechar. Convenção ou acordo coletivo é reconhecido pela Constituição (art. 7º, XXVI), e fica valendo o que foi escrito." };
  if (forca >= 1) return { titulo: "Acordo parcial", texto: "Saiu ganho e ficou pendência. Na vida real, o que não entra no acordo volta na próxima data-base." };
  if (abertura <= -2) return { titulo: "Mesa travada", texto: "Sem diálogo, ninguém cede. A mediação ou a Justiça do Trabalho costumam entrar quando a conversa para." };
  return { titulo: "Acordo fraco", texto: "Fechou, mas a categoria sai com pouca coisa. O que faltou foi força coletiva na hora de decidir." };
}

/** Roda uma sequência de índices de escolha, uma por cena, e devolve os medidores. */
export function rodarNegociacao(indices: readonly number[]): { forca: number; abertura: number } {
  let forca = 0;
  let abertura = 0;
  CENAS_DE_NEGOCIACAO.forEach((cena, i) => {
    const e = cena.escolhas[indices[i]];
    if (e) {
      forca += e.forca;
      abertura += e.abertura;
    }
  });
  return { forca, abertura };
}
