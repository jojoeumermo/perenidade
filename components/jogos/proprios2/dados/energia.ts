// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Fonte } from "../tipos";

export type Medidor = "emprego" | "conta" | "clima" | "territorio";

export const MEDIDORES: { id: Medidor; nome: string; ajuda: string }[] = [
  { id: "emprego", nome: "Emprego e renda", ajuda: "Quem trabalha hoje na energia suja continua com renda?" },
  { id: "conta", nome: "Conta de luz", ajuda: "A conta cabe no orçamento de quem tem menos?" },
  { id: "clima", nome: "Clima", ajuda: "Cai a emissão de gases que esquentam o planeta?" },
  { id: "territorio", nome: "Território e voz", ajuda: "As comunidades afetadas foram ouvidas e decidiram?" },
];

export type Placar = Record<Medidor, number>;

export interface Escolha {
  texto: string;
  efeito: Partial<Placar>;
  retorno: string;
}

export interface Cena {
  id: string;
  titulo: string;
  texto: string;
  escolhas: Escolha[];
  /** O que existe na lei de verdade, com a fonte. */
  naVidaReal: { texto: string; fonte: Fonte };
}

export const INICIO: Placar = { emprego: 50, conta: 50, clima: 50, territorio: 50 };

/** Os efeitos são valores didáticos para mostrar o dilema, não medições. Os fatos legais de cada cena têm fonte. */
export const CENAS: Cena[] = [
  {
    id: "parque",
    titulo: "O parque solar no território",
    texto:
      "Uma empresa quer um grande parque solar numa área onde vive uma comunidade tradicional. Promete empregos na obra e energia limpa para a região. A comunidade ainda não foi procurada.",
    escolhas: [
      { texto: "Aprovar logo: a obra gera emprego e o clima agradece.", efeito: { emprego: 8, clima: 10, territorio: -25 }, retorno: "O parque sai, mas a comunidade descobre pela placa de obra. Vem processo, atraso e desconfiança." },
      { texto: "Consultar a comunidade antes, com tempo e com a decisão dela valendo.", efeito: { emprego: -4, clima: 6, territorio: 20 }, retorno: "Demora mais. O projeto muda de lugar e de desenho, e a comunidade passa a ser sócia, não obstáculo." },
      { texto: "Cancelar o parque e não fazer nada.", efeito: { emprego: -8, clima: -8, territorio: 4 }, retorno: "Ninguém é incomodado, e nada muda. O problema da energia continua sem resposta." },
    ],
    naVidaReal: {
      texto:
        "A Convenção 169 da OIT, art. 6º, 1, a, manda consultar os povos interessados, por procedimentos apropriados e por suas instituições representativas, sempre que uma medida administrativa possa afetá-los diretamente (promulgada no Brasil pelo Decreto 5.051/2004, hoje consolidado no Decreto 10.088/2019).",
      fonte: { nome: "Decreto 5.051/2004 (planalto.gov.br)", url: "https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/decreto/d5051.htm" },
    },
  },
  {
    id: "carvao",
    titulo: "A usina a carvão vai fechar",
    texto: "Daqui a alguns anos, a usina a carvão que emprega a cidade inteira vai parar. As famílias dos trabalhadores perguntam: e agora?",
    escolhas: [
      { texto: "Fechar já e deixar o mercado resolver.", efeito: { emprego: -25, clima: 12, territorio: -8 }, retorno: "Cai a emissão e cai a renda de uma cidade inteira. A raiva vira voto contra qualquer transição." },
      { texto: "Plano com a cidade: requalificação, novos empregos na região e data combinada.", efeito: { emprego: 6, clima: 8, territorio: 14, conta: -4 }, retorno: "Custa dinheiro público e tempo de conversa, mas a cidade chega ao fim da usina com para onde ir." },
      { texto: "Adiar o fechamento para sempre.", efeito: { emprego: 6, clima: -18, conta: -6 }, retorno: "Todo mundo respira aliviado hoje. O problema só cresce e quem paga é a próxima geração." },
    ],
    naVidaReal: {
      texto:
        "A Lei 14.299/2022 criou o Programa de Transição Energética Justa (TEJ, art. 4º) para a região do carvão em Santa Catarina, com um conselho (art. 4º, § 2º) que reúne ministérios, o governo estadual, a associação dos municípios da região, entidades do setor e a federação dos trabalhadores da indústria do carvão.",
      fonte: { nome: "Lei 14.299/2022 (planalto.gov.br)", url: "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2022/lei/l14299.htm" },
    },
  },
  {
    id: "conta",
    titulo: "A conta de luz pesa no orçamento",
    texto: "Com tarifas subindo, famílias do bairro deixam de comprar comida para pagar a luz. Alguém propõe cortar os descontos para 'equilibrar as contas'.",
    escolhas: [
      { texto: "Cortar o desconto: a conta fecha, o resto é problema do bairro.", efeito: { conta: -22, territorio: -6, emprego: -2 }, retorno: "As contas do sistema fecham no papel. As famílias mais pobres pagam o preço, e a ligação clandestina aumenta." },
      { texto: "Manter e ampliar o desconto para famílias de baixa renda.", efeito: { conta: 18, territorio: 6 }, retorno: "Mais gente consegue pagar. O custo é dividido entre todos os consumidores e é preciso explicar isso com clareza." },
      { texto: "Dar o desconto sem cadastro, para todo mundo.", efeito: { conta: 8, clima: -8 }, retorno: "Fica simples, mas o benefício chega também a quem não precisa e sobra menos para quem precisa." },
    ],
    naVidaReal: {
      texto:
        "A Tarifa Social de Energia Elétrica, criada pela Lei 10.438/2002 e regulada pela Lei 12.212/2010, dá desconto à subclasse residencial baixa renda. Pelo art. 2º, tem direito a unidade com morador em família inscrita no Cadastro Único com renda mensal por pessoa de até meio salário mínimo, ou que receba o Benefício de Prestação Continuada. Os percentuais de desconto mudam com a lei: confira a redação vigente.",
      fonte: { nome: "Lei 12.212/2010 (planalto.gov.br)", url: "https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2010/lei/l12212.htm" },
    },
  },
  {
    id: "telhado",
    titulo: "Placas no telhado do bairro",
    texto: "A associação de moradores quer pôr placas solares nos telhados do conjunto popular e dividir o que sobrar. Falta dinheiro para comprar e quem entenda de instalação.",
    escolhas: [
      { texto: "Cada um se vira sozinho; quem tem dinheiro instala.", efeito: { conta: -6, clima: 4, territorio: -8 }, retorno: "Quem já tem mais, economiza mais. A conta dos outros fica igual e a distância entre os vizinhos aumenta." },
      { texto: "Montar uma cooperativa de compra e instalação, com curso para jovens do bairro.", efeito: { emprego: 12, conta: 12, clima: 8, territorio: 10 }, retorno: "O custo cai na compra em grupo, nascem empregos locais e o bairro aprende a cuidar do que instalou." },
      { texto: "Esperar o governo resolver tudo.", efeito: { conta: -4, clima: -4 }, retorno: "Nada acontece enquanto ninguém se mexe. O telhado fica vazio e a conta, cheia." },
    ],
    naVidaReal: {
      texto:
        "O marco legal da microgeração e minigeração distribuída é a Lei 14.300/2022. Pelo art. 1º, XI, microgeração distribuída é a usina renovável ou de cogeração qualificada, ligada à rede da distribuidora, com potência instalada de até 75 kW.",
      fonte: { nome: "Lei 14.300/2022 (planalto.gov.br)", url: "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2022/lei/l14300.htm" },
    },
  },
  {
    id: "decisao",
    titulo: "Quem decide o plano",
    texto: "O plano de transição da cidade está pronto, escrito por consultores. Falta decidir como ele será apresentado.",
    escolhas: [
      { texto: "Publicar o plano pronto no site da prefeitura.", efeito: { territorio: -12, emprego: -4 }, retorno: "O plano é bom no papel, mas quem sofre as consequências não foi ouvido, e o plano trava na primeira reunião tensa." },
      { texto: "Ouvir trabalhadores, moradores e jovens em reuniões de bairro, e mudar o plano com o que ouvir.", efeito: { territorio: 20, emprego: 6, conta: 4, clima: 4 }, retorno: "Demora. O plano melhora e ganha quem o defenda, porque quem aponta o que falta também ajuda a fazer." },
      { texto: "Fazer uma enquete na internet e seguir o resultado.", efeito: { territorio: -2, conta: -2 }, retorno: "Quem tem internet responde; quem mais precisa de voz quase não aparece." },
    ],
    naVidaReal: {
      texto:
        "O Estatuto da Cidade põe a gestão democrática, com participação da população e de associações representativas, entre as diretrizes da política urbana (Lei 10.257/2001, art. 2º, II). Ele fala de cidade, não de energia, mas a lógica é a mesma.",
      fonte: { nome: "Lei 10.257/2001 (planalto.gov.br)", url: "https://www.planalto.gov.br/ccivil_03/leis/leis_2001/l10257.htm" },
    },
  },
];

export function limitar(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/** Aplica o efeito de uma escolha ao placar, sempre entre 0 e 100. */
export function aplicar(placar: Placar, efeito: Partial<Placar>): Placar {
  const novo = { ...placar };
  for (const m of MEDIDORES) novo[m.id] = limitar(placar[m.id] + (efeito[m.id] ?? 0));
  return novo;
}

export type Final = "justa" | "parcial" | "injusta";

/** Justa: nenhum medidor abaixo de 40 e média de 55 ou mais. Injusta: algum medidor abaixo de 25. */
export function classificar(p: Placar): Final {
  const v = MEDIDORES.map((m) => p[m.id]);
  if (v.some((x) => x < 25)) return "injusta";
  if (v.every((x) => x >= 40) && v.reduce((a, b) => a + b, 0) / v.length >= 55) return "justa";
  return "parcial";
}

export const FINAIS: Record<Final, { titulo: string; texto: string }> = {
  justa: { titulo: "Transição justa", texto: "Nenhum medidor foi sacrificado. Limpar a energia sem deixar ninguém para trás exige mais conversa e mais tempo, e é o que se chama de transição justa." },
  parcial: { titulo: "Transição pela metade", texto: "Algo avançou, mas um ou mais medidores ficaram para trás. Releia os retornos e tente outro caminho: não há resposta única." },
  injusta: { titulo: "Transição que deixou gente para trás", texto: "Pelo menos um medidor caiu muito. Uma energia limpa que empobrece ou silencia quem já tinha menos costuma perder apoio e travar." },
};

export const FONTES_ENERGIA: Fonte[] = CENAS.map((c) => c.naVidaReal.fonte);
