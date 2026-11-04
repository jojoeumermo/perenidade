// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A lógica das quatro ferramentas da vida real da Etapa 3 (sem tela, para o teste rodar direto no Node):
//   1. árvore de decisão para emergências trabalhistas (CLT, com artigo);
//   2. explicador de cláusulas de aluguel (Lei 8.245/1991) e de empréstimo (CDC, Lei 8.078/1990);
//   3. calculadora de carga elétrica da casa (tabela simplificada do manual baseado na NBR 5410, a mesma da aula
//      "Dimensionar um circuito");
//   4. mapa de serviços públicos (CRAS, UBS, CAPS, Defensoria, Procon, EJA), só com links oficiais.
// Tudo roda no aparelho. Cada artigo citado aqui foi conferido no texto da lei publicado em planalto.gov.br (4/11/2026).
// Sem os atalhos "@/": o teste carrega este arquivo direto.

/* ───────────────────────── 1. Emergências trabalhistas ───────────────────────── */

export interface Resultado {
  titulo: string;
  /** O que a pessoa deve juntar antes de procurar o sindicato ou a Defensoria. */
  provas: string[];
  /** O que fazer, na ordem. */
  passos: string[];
  /** A lei de cada ponto, com artigo. */
  lei: string[];
  /** Um aviso de prazo ou de cuidado, quando há. */
  cuidado?: string;
}

export interface NoDaArvore {
  id: string;
  pergunta: string;
  opcoes: { texto: string; vai: string }[];
}

/** O que sempre se leva, qualquer que seja o caso. */
export const PROVAS_DE_SEMPRE = [
  "Documento de identidade e CPF",
  "Carteira de Trabalho (a física ou a digital, com print das telas do contrato)",
  "Nome e endereço da empresa ou da pessoa que contratou (e o CNPJ, se souber)",
  "Datas: quando começou, quando terminou, quanto combinaram de pagar e como (Pix, dinheiro, depósito)",
  "Nomes e telefones de colegas que viram o que aconteceu (testemunhas)",
];

export const ARVORE: NoDaArvore[] = [
  {
    id: "inicio",
    pergunta: "O que está acontecendo com você no trabalho?",
    opcoes: [
      { texto: "Fui mandado embora e não recebi tudo", vai: "rescisao" },
      { texto: "Trabalho sem carteira assinada", vai: "semcarteira" },
      { texto: "Faço hora extra ou não tenho controle do horário", vai: "horas" },
      { texto: "Não me deram férias ou o pagamento delas está errado", vai: "ferias" },
      { texto: "Descontaram do meu salário sem eu entender", vai: "desconto" },
      { texto: "Me machuquei ou adoeci por causa do trabalho", vai: "acidente" },
      { texto: "Sofro humilhação, ofensa ou ameaça no trabalho", vai: "assedio" },
      { texto: "Me acusaram de justa causa e eu discordo", vai: "justacausa" },
      { texto: "Querem que eu peça demissão ou assine um acordo", vai: "acordo" },
    ],
  },
];

export const RESULTADOS: Record<string, Resultado> = {
  rescisao: {
    titulo: "Dispensado sem receber as verbas da rescisão",
    provas: [
      "Carta ou mensagem de dispensa (ou print da conversa em que mandaram você embora)",
      "Contracheques ou recibos de pagamento dos últimos meses",
      "Extrato do FGTS (aplicativo oficial) para ver se os depósitos foram feitos",
      "A rescisão que lhe entregaram, se entregaram, com o que está escrito nela",
      "Registro das datas: último dia trabalhado e dia em que deveria ter recebido",
    ],
    passos: [
      "Conte na folha as datas e os valores que faltam. A calculadora \"Direitos do trabalhador\" ajuda a ter uma ordem de grandeza.",
      "Peça por escrito (mensagem que fique guardada) o pagamento e a entrega dos documentos da rescisão.",
      "Leve a folha e as provas ao sindicato da sua categoria ou à Defensoria Pública, antes de assinar qualquer papel que você não entenda.",
      "Se não houver acordo, o caminho é a reclamação trabalhista; o sindicato ou a Defensoria orientam como fazê-la.",
    ],
    lei: [
      "CLT, art. 477, § 6º: a rescisão e o pagamento das verbas devem ser feitos até dez dias contados do término do contrato (texto dado pela Lei 13.467/2017).",
      "CLT, art. 467: quando há controvérsia sobre o montante das verbas rescisórias, a parte sem controvérsia tem regra própria de pagamento.",
      "CLT, art. 146: ao fim do contrato, por qualquer causa, as férias vencidas ou proporcionais são pagas.",
      "CF, art. 7º, I: relação de emprego protegida contra despedida arbitrária ou sem justa causa, nos termos de lei complementar.",
    ],
    cuidado: "O prazo para cobrar na Justiça é limitado: cinco anos, e no máximo dois anos depois que o contrato acabou (CF, art. 7º, XXIX). Não deixe para depois.",
  },
  semcarteira: {
    titulo: "Trabalho sem carteira assinada",
    provas: [
      "Mensagens (WhatsApp, e-mail) em que a empresa manda tarefa, horário ou escala",
      "Comprovantes de pagamento: Pix, depósito, recibo, vale",
      "Fotos suas no local de trabalho, com uniforme, crachá ou ferramentas da empresa",
      "Nomes de colegas e clientes que viram você trabalhar, com telefone",
      "Anotação simples dos dias e horários trabalhados, feita no seu celular, com a data de cada anotação",
    ],
    passos: [
      "Comece a guardar tudo agora; apagar o que já existe só enfraquece o seu caso.",
      "Procure o sindicato da categoria ou a Defensoria Pública para saber se há vínculo de emprego no seu caso.",
      "Não aceite assinar papel dizendo que você é autônomo sem entender o que ele diz.",
    ],
    lei: [
      "CLT, art. 41: em todas as atividades é obrigatório para o empregador o registro dos respectivos trabalhadores.",
      "CLT, art. 29: o empregador tem o prazo de 5 dias úteis para anotar a Carteira de Trabalho de quem admite.",
    ],
    cuidado: "Se o contrato acabou, o prazo de dois anos para cobrar já corre (CF, art. 7º, XXIX).",
  },
  horas: {
    titulo: "Horas extras e controle de horário",
    provas: [
      "Anotação diária do horário em que entra e sai (celular, caderno), com data",
      "Prints de escalas, grupos de trabalho e mensagens que mostram horário e pedido de hora extra",
      "Contracheques, para ver se a hora extra aparece e quanto foi paga",
      "Fotos ou registros do ponto, se houver relógio ou aplicativo",
      "Colegas que trabalham no mesmo horário",
    ],
    passos: [
      "Use a calculadora \"Direitos do trabalhador\" (aba Horas extras) para estimar quanto deveria ter recebido.",
      "Leve a anotação e os contracheques ao sindicato: a convenção coletiva da sua categoria pode garantir mais do que a lei.",
      "Peça ao sindicato ou à Defensoria que olhem o seu caso antes de procurar a empresa.",
    ],
    lei: [
      "CLT, art. 58: a duração normal do trabalho não excede 8 horas diárias.",
      "CLT, art. 59: a jornada diária pode ter horas extras em número não excedente a duas.",
      "CLT, art. 74, § 2º: nos estabelecimentos com mais de 20 trabalhadores é obrigatória a anotação da hora de entrada e de saída.",
      "CF, art. 7º, XVI: remuneração do serviço extraordinário superior, no mínimo, em cinquenta por cento à do normal.",
    ],
  },
  ferias: {
    titulo: "Férias não dadas ou pagas errado",
    provas: [
      "Data em que você começou e a das últimas férias",
      "Recibos de férias ou contracheques do mês em que as tirou",
      "Mensagens em que o pedido de férias foi recusado ou adiado",
      "Escala de trabalho do período",
    ],
    passos: [
      "Calcule o que deveria receber na calculadora \"Direitos do trabalhador\" (aba Férias).",
      "Peça por escrito a marcação das férias.",
      "Se não resolver, leve as provas ao sindicato ou à Defensoria.",
    ],
    lei: [
      "CLT, art. 129: todo empregado terá direito anualmente ao gozo de um período de férias, sem prejuízo da remuneração.",
      "CLT, art. 130: após cada período de 12 meses de contrato, o empregado tem direito a férias.",
      "CLT, art. 134: as férias são concedidas por ato do empregador, em uma ou mais épocas, nos 12 meses seguintes ao direito (confira no artigo as regras de divisão em períodos).",
      "CLT, art. 137: concedidas as férias fora desse prazo, o empregador paga em dobro a respectiva remuneração.",
      "CF, art. 7º, XVII: um terço a mais do que o salário normal.",
    ],
  },
  desconto: {
    titulo: "Desconto no salário que você não entende",
    provas: [
      "Os contracheques, com o desconto marcado",
      "Qualquer papel que você assinou autorizando descontos",
      "Mensagens em que explicaram (ou se recusaram a explicar) o desconto",
      "Valor combinado de salário e valor que de fato caiu na conta",
    ],
    passos: [
      "Marque cada desconto nos contracheques e escreva ao lado o que você sabe dele.",
      "Peça por escrito a explicação do desconto.",
      "Leve ao sindicato: alguns descontos são previstos em lei ou na convenção da categoria, outros não.",
    ],
    lei: ["CLT, art. 462: ao empregador é vedado efetuar qualquer desconto nos salários do empregado, salvo os casos que a lei prevê."],
  },
  acidente: {
    titulo: "Acidente ou doença causada pelo trabalho",
    provas: [
      "Atestado e relatório médicos, receitas, exames e protocolos de atendimento",
      "Fotos do local, da máquina ou da situação, se puder",
      "A Comunicação de Acidente de Trabalho (CAT), se a empresa fez; se não fez, o pedido para fazer",
      "Nomes de colegas que viram o acidente ou conhecem a condição do lugar",
      "Registro de quando começaram os sintomas e do que você fazia",
    ],
    passos: [
      "Primeiro a saúde: procure atendimento médico (UBS, UPA ou pronto-socorro) e peça o atestado.",
      "Peça à empresa a CAT. Se ela não emitir, o próprio acidentado, os dependentes, o sindicato, o médico ou uma autoridade pública podem formalizar a comunicação.",
      "Leve tudo ao sindicato e à Defensoria Pública para orientar o auxílio e os direitos do seu caso.",
    ],
    lei: [
      "Lei 8.213/1991, art. 22: a empresa deve comunicar o acidente do trabalho à Previdência Social até o primeiro dia útil seguinte ao da ocorrência.",
      "Lei 8.213/1991, art. 22, § 2º: na falta da comunicação da empresa, podem formalizá-la o acidentado, seus dependentes, o sindicato, o médico que o assistiu ou qualquer autoridade pública.",
      "CLT, arts. 189 e 195: insalubridade e periculosidade se caracterizam por perícia de médico ou engenheiro do trabalho.",
    ],
  },
  assedio: {
    titulo: "Humilhação, ofensa ou ameaça no trabalho",
    provas: [
      "Mensagens, e-mails e prints com as ofensas, ameaças ou ordens humilhantes, com a data",
      "Anotação sua de cada episódio: dia, hora, lugar, o que foi dito e quem estava perto",
      "Nomes de testemunhas",
      "Atestados médicos, se o que aconteceu afetou a sua saúde",
      "Antes de usar qualquer gravação de áudio ou vídeo, pergunte ao sindicato ou à Defensoria como ela deve ser usada",
    ],
    passos: [
      "Procure um lugar seguro e uma pessoa de confiança para contar. Se houver agressão ou ameaça, é caso de polícia: procure a delegacia ou a polícia.",
      "Anote tudo no mesmo dia e guarde cópia fora do celular de trabalho.",
      "Leve as anotações ao sindicato ou à Defensoria Pública.",
    ],
    lei: [
      "CLT, art. 223-B: causa dano de natureza extrapatrimonial a ação ou omissão que ofenda a esfera moral ou existencial da pessoa física.",
      "CLT, art. 483, alíneas e e f: o empregado pode considerar rescindido o contrato e pleitear indenização quando o empregador ou seus prepostos ofendem a sua honra ou o agridem fisicamente.",
    ],
  },
  justacausa: {
    titulo: "Acusação de justa causa com a qual você não concorda",
    provas: [
      "A carta ou mensagem em que a acusaram, e o que ela diz exatamente",
      "Seu histórico: advertências recebidas (ou a falta delas), elogios, avaliações",
      "Mensagens e registros do dia dos fatos",
      "Testemunhas do que aconteceu",
    ],
    passos: [
      "Não assine documento que confirme a justa causa sem ler e entender.",
      "Anote a sua versão dos fatos, com datas, no mesmo dia.",
      "Leve ao sindicato ou à Defensoria: quem alega a justa causa precisa provar o motivo.",
    ],
    lei: [
      "CLT, art. 482: o artigo lista as hipóteses de justa causa (atos de improbidade, indisciplina, abandono de emprego, entre outras); fora delas, a justa causa não se sustenta.",
      "CLT, art. 818: o artigo reparte entre as partes o ônus da prova.",
    ],
  },
  acordo: {
    titulo: "Pedido de demissão ou acordo de saída",
    provas: [
      "Mensagens em que pedem que você peça demissão ou assine o acordo",
      "O papel que querem que você assine, em cópia",
      "O valor das verbas que seriam devidas em cada caso (use a calculadora \"Direitos do trabalhador\")",
    ],
    passos: [
      "Não assine na hora. Leve uma cópia para casa e mostre ao sindicato.",
      "Compare: o que você receberia numa dispensa sem justa causa e o que receberia no acordo ou no pedido de demissão.",
      "Se quiser sair por acordo, o acordo precisa ser escrito e conferido por você.",
    ],
    lei: [
      "CLT, art. 484-A: o contrato de trabalho poderá ser extinto por acordo entre empregado e empregador, com verbas próprias para esse caso (leia o artigo).",
      "CLT, art. 477, § 6º: a rescisão e o pagamento devem ser feitos até dez dias do término do contrato.",
    ],
    cuidado: "No pedido de demissão e no acordo você pode perder direitos que teria na dispensa sem justa causa. Antes de assinar, confira com quem entende.",
  },
};

/** Os nós alcançáveis: do início, cada opção leva a um resultado. */
export function proximo(vai: string): { tipo: "pergunta"; no: NoDaArvore } | { tipo: "resultado"; resultado: Resultado; id: string } | null {
  const no = ARVORE.find((n) => n.id === vai);
  if (no) return { tipo: "pergunta", no };
  const r = RESULTADOS[vai];
  return r ? { tipo: "resultado", resultado: r, id: vai } : null;
}

/** O resumo em texto para levar ao sindicato ou à Defensoria (copiar e colar), com o que já está marcado. */
export function resumoParaLevar(id: string, marcadas: string[], fatos: string): string {
  const r = RESULTADOS[id];
  if (!r) return "";
  const linhas = [`Assunto: ${r.titulo}`, "", "O que eu já tenho:"];
  const tenho = r.provas.filter((p) => marcadas.includes(p));
  linhas.push(...(tenho.length ? tenho.map((p) => `- ${p}`) : ["- (nada marcado ainda)"]));
  const falta = r.provas.filter((p) => !marcadas.includes(p));
  if (falta.length) linhas.push("", "O que ainda falta juntar:", ...falta.map((p) => `- ${p}`));
  if (fatos.trim()) linhas.push("", "O que aconteceu, com as minhas palavras:", fatos.trim());
  linhas.push("", "Lei que li sobre o meu caso:", ...r.lei.map((l) => `- ${l}`));
  return linhas.join("\n");
}

/* ───────────────────────── 2. Cláusulas de aluguel e de empréstimo ───────────────────────── */

export type Gravidade = "ilegal" | "atencao" | "informa";

export interface Clausula {
  id: string;
  tema: string;
  /** Palavras que, no texto colado, indicam o assunto (regex, sem acento: o texto é normalizado). */
  acha: RegExp;
  gravidade: Gravidade;
  explica: string;
  lei: string;
}

/** Tira acento e põe em minúsculas, para a busca não depender de como a pessoa digitou. */
export const normalizar = (s: string) => s.replace(/[À-ſ]/g, (c) => c.normalize("NFD")[0]).toLowerCase();

export const CLAUSULAS_ALUGUEL: Clausula[] = [
  {
    id: "duas-garantias", tema: "Duas garantias ao mesmo tempo", gravidade: "ilegal",
    acha: /(fiador|fianca)[\s\S]{0,400}(caucao|deposito[\s\S]{0,20}garantia|seguro[- ]fianca|titulo de capitalizacao)|(caucao|seguro[- ]fianca|titulo de capitalizacao)[\s\S]{0,400}(fiador|fianca)/,
    explica: "O contrato não pode exigir mais de uma garantia (por exemplo fiador e caução juntos). A garantia exigida a mais é nula, e exigi-la é contravenção penal.",
    lei: "Lei 8.245/1991, art. 37, parágrafo único (vedada, sob pena de nulidade, mais de uma modalidade de garantia), e art. 43 (contravenção penal).",
  },
  {
    id: "caucao-3", tema: "Depósito de caução", gravidade: "atencao",
    acha: /caucao|deposito[\s\S]{0,20}garantia/,
    explica: "A caução em dinheiro não pode passar de três meses de aluguel e deve ser depositada em caderneta de poupança, com as vantagens revertendo a você. Confira o valor e o recibo.",
    lei: "Lei 8.245/1991, art. 38, § 2º.",
  },
  {
    id: "adiantado", tema: "Aluguel pago adiantado", gravidade: "atencao",
    acha: /adiantad|antecipad[oa][\s\S]{0,30}alugue|alugue[\s\S]{0,30}antecipad/,
    explica: "Em regra o locador não pode exigir o aluguel antecipado. As exceções são a locação por temporada e a locação sem garantia (art. 42).",
    lei: "Lei 8.245/1991, art. 20 (e art. 42).",
  },
  {
    id: "moeda", tema: "Aluguel ligado ao dólar ou ao salário mínimo", gravidade: "ilegal",
    acha: /dolar|euro\b|moeda estrangeira|variacao cambial|salario[- ]minimo/,
    explica: "O aluguel pode ser reajustado por índice combinado entre as partes, mas não pode ser fixado em moeda estrangeira nem ligado à variação cambial ou ao salário mínimo.",
    lei: "Lei 8.245/1991, art. 17 (e art. 18, que permite as partes fixarem o reajuste de comum acordo).",
  },
  {
    id: "multa-saida", tema: "Multa por sair antes do prazo", gravidade: "atencao",
    acha: /multa[\s\S]{0,120}(rescis|devolu|desocup|antes do prazo|descumpr)|(rescis|devolu|desocup)[\s\S]{0,120}multa/,
    explica: "Quem devolve o imóvel antes do fim do prazo paga a multa combinada, mas proporcional ao tempo de contrato que já cumpriu. Quem é transferido pelo empregador para outra cidade fica dispensado, se avisar por escrito com 30 dias de antecedência.",
    lei: "Lei 8.245/1991, art. 4º e parágrafo único.",
  },
  {
    id: "aviso", tema: "Aviso para sair", gravidade: "informa",
    acha: /aviso previo|prazo indeterminado|notificar|denunciar/,
    explica: "Depois que o contrato passa a prazo indeterminado, o inquilino pode sair avisando por escrito com 30 dias; sem o aviso, o locador pode cobrar um mês de aluguel e encargos.",
    lei: "Lei 8.245/1991, art. 6º e parágrafo único.",
  },
  {
    id: "venda", tema: "Venda do imóvel durante o contrato", gravidade: "atencao",
    acha: /venda do imovel|alienacao|vender o imovel|vendido|novo proprietario|adquirente/,
    explica: "Se o imóvel for vendido durante a locação, o comprador pode pedir que você saia, em 90 dias, nas condições que o artigo prevê. Você também tem preferência para comprar o imóvel em igualdade de condições com terceiros.",
    lei: "Lei 8.245/1991, art. 8º (venda) e arts. 27 e 33 (preferência).",
  },
  {
    id: "condominio", tema: "Despesas de condomínio", gravidade: "atencao",
    acha: /condominio|taxa extra|fundo de reserva|\bobras?\b|fachada/,
    explica: "As despesas ordinárias (do dia a dia do prédio) ficam com o inquilino. As extraordinárias (obras estruturais, pintura de fachada, fundo de reserva) ficam com o locador. Você pode pedir os comprovantes do que está sendo cobrado.",
    lei: "Lei 8.245/1991, art. 22, X e parágrafo único; art. 23, § 1º; art. 22, IX; art. 25.",
  },
  {
    id: "reparos", tema: "Reparos e defeitos do imóvel", gravidade: "atencao",
    acha: /reparo|conserto|manutencao|defeito|vicio|estado de conservacao|vistoria|infiltrac/,
    explica: "O locador deve entregar o imóvel em estado de servir ao uso e responde pelos defeitos anteriores à locação. O inquilino deve avisar logo que surgir um dano e permitir os reparos urgentes. Faça a vistoria inicial com fotos e anexe ao contrato.",
    lei: "Lei 8.245/1991, art. 22, I e IV; art. 23, IV; art. 26.",
  },
  {
    id: "benfeitorias", tema: "Obras e melhorias que o inquilino faz", gravidade: "atencao",
    acha: /benfeitoria|renuncia[\s\S]{0,40}indeniza|obras? por conta do locatario/,
    explica: "As benfeitorias necessárias feitas pelo inquilino são indenizáveis, salvo cláusula expressa em contrário; leia com atenção se o contrato afasta a indenização.",
    lei: "Lei 8.245/1991, art. 35.",
  },
  {
    id: "revisao", tema: "Reajuste e revisão do valor", gravidade: "informa",
    acha: /reajust|igp|ipca|indice|revisao do alugue/,
    explica: "As partes combinam o índice de reajuste. Depois de três anos de contrato, sem acordo, qualquer delas pode pedir à Justiça a revisão do aluguel para o valor de mercado.",
    lei: "Lei 8.245/1991, art. 18 e art. 19.",
  },
  {
    id: "fiador", tema: "Fiador: troca e duração da fiança", gravidade: "informa",
    acha: /fiador|fianca/,
    explica: "Salvo cláusula em contrário, a garantia vale até a devolução do imóvel, inclusive se o contrato continuar por prazo indeterminado. O locador pode exigir novo fiador em certos casos (morte, exoneração do fiador, prorrogação).",
    lei: "Lei 8.245/1991, art. 39 e art. 40.",
  },
  {
    id: "pagamento", tema: "Dia do pagamento", gravidade: "informa",
    acha: /vencimento|dia \d+|todo dia|pagamento do alugue/,
    explica: "O aluguel é pago no prazo combinado; se o contrato não disser, é até o sexto dia útil do mês seguinte ao vencido.",
    lei: "Lei 8.245/1991, art. 23, I.",
  },
  {
    id: "despejo", tema: "Perda do imóvel e despejo", gravidade: "informa",
    acha: /despejo|rescisao imediata|retomada|desocupar/,
    explica: "A locação só se desfaz nas hipóteses previstas na lei (acordo, infração, falta de pagamento, reparos urgentes ordenados pelo poder público). Despejo é por decisão da Justiça; julgada procedente a ação, o juiz manda desocupar, em regra em 30 dias.",
    lei: "Lei 8.245/1991, art. 9º e art. 63.",
  },
];

export const CLAUSULAS_EMPRESTIMO: Clausula[] = [
  {
    id: "multa-2", tema: "Multa por atraso", gravidade: "ilegal",
    acha: /multa[\s\S]{0,80}(atraso|mora|inadimpl)|(atraso|mora|inadimpl)[\s\S]{0,80}multa/,
    explica: "Nos contratos de crédito, a multa por atraso não pode ser maior que 2% do valor da prestação. Se o contrato cobra mais, a cláusula pode ser contestada.",
    lei: "CDC (Lei 8.078/1990), art. 52, § 1º.",
  },
  {
    id: "quitacao", tema: "Pagar antes do prazo", gravidade: "atencao",
    acha: /quitacao antecipada|liquidacao antecipada|pagamento antecipado|antecipar parcela/,
    explica: "Você tem direito de quitar o débito antes do prazo, com redução proporcional dos juros e dos demais acréscimos. Se o contrato proíbe ou cobra multa por isso, pergunte ao Procon.",
    lei: "CDC, art. 52, § 2º.",
  },
  {
    id: "juros-cet", tema: "Juros e custo total", gravidade: "atencao",
    acha: /juros|taxa|cet\b|custo efetivo/,
    explica: "Antes de contratar, o fornecedor deve informar o preço em reais, os juros de mora e a taxa efetiva anual de juros, os acréscimos legais e o número e a periodicidade das prestações. Procure essas quatro coisas no contrato; se faltar alguma, peça por escrito.",
    lei: "CDC, art. 52, I a IV; art. 54-B e art. 54-D (informações na oferta de crédito).",
  },
  {
    id: "unilateral", tema: "Mudança de preço ou de juros só de um lado", gravidade: "ilegal",
    acha: /unilateral|a criterio do (banco|credor|fornecedor|financiador)|independente de aviso|sem aviso previo/,
    explica: "É nula a cláusula que permite ao fornecedor variar o preço de maneira unilateral, direta ou indiretamente.",
    lei: "CDC, art. 51, X.",
  },
  {
    id: "custos-cobranca", tema: "Custos de cobrança pagos por você", gravidade: "ilegal",
    acha: /honorarios|custas|despesas de cobranca|custo de cobranca|ressarcir/,
    explica: "É nula a cláusula que obriga o consumidor a ressarcir os custos de cobrança da dívida sem que o mesmo valha para o fornecedor. Peça que o Procon ou a Defensoria leiam essa parte.",
    lei: "CDC, art. 51, XII.",
  },
  {
    id: "perda-total", tema: "Perder tudo o que já pagou", gravidade: "ilegal",
    acha: /perda (total|das parcelas)|perdera as parcelas|sem direito a (devolucao|restituicao)|retencao total/,
    explica: "Nos contratos de compra a prestação, são nulas as cláusulas que dizem que, se você não pagar o resto, perde tudo o que já pagou.",
    lei: "CDC, art. 53.",
  },
  {
    id: "venda-casada", tema: "Seguro ou produto obrigatório junto com o crédito", gravidade: "ilegal",
    acha: /seguro (prestamista|obrigatorio)|obrigatoriedade de (seguro|contratar)|titulo de capitalizacao|pacote de servicos|cesta de servicos/,
    explica: "Condicionar o crédito à compra de outro produto ou serviço (por exemplo um seguro) é venda casada, prática abusiva. Você pode recusar o que não pediu.",
    lei: "CDC, art. 39, I.",
  },
  {
    id: "desvantagem", tema: "Cláusula que deixa só você em desvantagem", gravidade: "atencao",
    acha: /renuncia|abdica|irrevogavel|irretratavel|vencimento antecipado de toda|foro de eleicao/,
    explica: "São nulas as cláusulas iníquas ou abusivas que colocam o consumidor em desvantagem exagerada; e o consumidor pode pedir a modificação de cláusulas que estabeleçam prestações desproporcionais.",
    lei: "CDC, art. 51, IV; art. 39, V; art. 6º, V.",
  },
  {
    id: "responsabilidade", tema: "Banco ou loja que se isenta de culpa", gravidade: "ilegal",
    acha: /isenta|nao se responsabiliza|exonera|isencao de responsabilidade/,
    explica: "São nulas as cláusulas que impossibilitem, exonerem ou atenuem a responsabilidade do fornecedor por vícios do produto ou do serviço.",
    lei: "CDC, art. 51, I.",
  },
  {
    id: "cobranca-vexatoria", tema: "Cobrança que expõe ou constrange", gravidade: "atencao",
    acha: /protesto|negativacao|serasa|spc|cobranca (domiciliar|no local de trabalho)|contato com terceiros/,
    explica: "O consumidor inadimplente não pode ser exposto a ridículo nem submetido a constrangimento na cobrança. Quem paga cobrança indevida tem direito à repetição do indébito.",
    lei: "CDC, art. 42, caput e parágrafo único.",
  },
  {
    id: "superendividamento", tema: "Dívidas demais para pagar", gravidade: "informa",
    acha: /renegoci|repactua|superendivid/,
    explica: "Quem não consegue pagar todas as dívidas sem comprometer o mínimo para viver pode pedir a repactuação em processo na Justiça, com plano de pagamento. Veja a trilha \"Dívidas e nome sujo\".",
    lei: "CDC, art. 104-A (repactuação de dívidas); art. 54-D e 54-G (deveres do fornecedor na oferta de crédito).",
  },
  {
    id: "clareza", tema: "Letra miúda e linguagem difícil", gravidade: "informa",
    acha: /^$/,
    explica: "Os contratos de consumo não obrigam o consumidor se ele não teve oportunidade de conhecer o conteúdo antes, ou se o texto dificulta a compreensão do sentido e do alcance. Peça uma cópia antes de assinar e leia com calma.",
    lei: "CDC, art. 46; art. 6º, III (informação adequada e clara).",
  },
];

/** O que um contrato bom diz: se o texto colado não tem, a pessoa é avisada. */
export const DEVE_CONSTAR: Record<"aluguel" | "emprestimo", { nome: string; acha: RegExp; lei: string }[]> = {
  aluguel: [
    { nome: "valor do aluguel", acha: /r\$|reais|valor do alugue/, lei: "Lei 8.245/1991, art. 17" },
    { nome: "prazo do contrato", acha: /prazo|meses|anos|vigencia/, lei: "Lei 8.245/1991, art. 46 e 47" },
    { nome: "o índice de reajuste", acha: /reajust|igp|ipca|indice/, lei: "Lei 8.245/1991, art. 18" },
    { nome: "a garantia (uma só)", acha: /fiador|fianca|caucao|seguro[- ]fianca|titulo de capitalizacao|sem garantia/, lei: "Lei 8.245/1991, art. 37" },
  ],
  emprestimo: [
    { nome: "o valor em reais", acha: /r\$|reais/, lei: "CDC, art. 52, I" },
    { nome: "os juros e a taxa efetiva anual", acha: /juros|taxa efetiva|cet\b|custo efetivo/, lei: "CDC, art. 52, II" },
    { nome: "o número e a periodicidade das parcelas", acha: /parcela|prestac|mensal|meses/, lei: "CDC, art. 52, IV" },
  ],
};

export interface Achado {
  clausula: Clausula;
  /** O pedaço do texto colado em que a cláusula foi achada (para a pessoa se localizar). */
  trecho: string;
}

export interface Explicacao {
  achados: Achado[];
  faltam: { nome: string; lei: string }[];
  /** Cláusulas que valem para qualquer contrato do tipo, mesmo sem aparecer no texto. */
  gerais: Clausula[];
}

/** Lê o texto colado e devolve o que foi achado e o que falta. Nada sai do aparelho. */
export function explicarClausulas(tipo: "aluguel" | "emprestimo", texto: string): Explicacao {
  const lista = tipo === "aluguel" ? CLAUSULAS_ALUGUEL : CLAUSULAS_EMPRESTIMO;
  const norm = normalizar(texto);
  const achados: Achado[] = [];
  const gerais: Clausula[] = [];
  for (const c of lista) {
    if (c.acha.source === "^$") { gerais.push(c); continue; }
    const m = c.acha.exec(norm);
    if (!m) continue;
    const ini = Math.max(0, m.index - 50);
    // Corta no texto original (a normalização troca letra por letra); se por acaso o tamanho mudou, cai no normalizado.
    const fonte = texto.length === norm.length ? texto : norm;
    achados.push({ clausula: c, trecho: fonte.slice(ini, Math.min(fonte.length, m.index + m[0].length + 80)).replace(/\s+/g, " ").trim() });
  }
  const faltam = norm.length < 80 ? [] : DEVE_CONSTAR[tipo].filter((d) => !d.acha.test(norm)).map(({ nome, lei }) => ({ nome, lei }));
  return { achados, faltam, gerais };
}

/* ───────────────────────── 3. Carga elétrica da casa ───────────────────────── */

/** A tabela simplificada do manual baseado na NBR 5410 (a mesma da aula "Dimensionar um circuito"): disjuntor por seção de fio e por número de circuitos no eletroduto. */
export const TABELA_FIOS: { mm2: number; disjuntor: [number, number, number, number] }[] = [
  { mm2: 1.5, disjuntor: [15, 10, 10, 10] },
  { mm2: 2.5, disjuntor: [20, 15, 15, 15] },
  { mm2: 4, disjuntor: [30, 25, 20, 20] },
  { mm2: 6, disjuntor: [40, 30, 25, 25] },
  { mm2: 10, disjuntor: [50, 40, 40, 35] },
  { mm2: 16, disjuntor: [70, 60, 50, 40] },
];

/** O interruptor DR mínimo para cada disjuntor, pela mesma aula. */
export function drMinimo(disjuntor: number): number | null {
  if ([10, 15, 20, 25].includes(disjuntor)) return 25;
  if ([30, 40].includes(disjuntor)) return 40;
  if ([50, 60].includes(disjuntor)) return 63;
  if (disjuntor === 70) return 80;
  return null;
}

export type TipoDeCircuito = "iluminacao" | "tomadas" | "exclusivo";

export interface EntradaDoCircuito {
  /** Potência total do circuito, em W ou VA. */
  watts: number;
  tensao: 127 | 220;
  /** Quantos circuitos passam juntos no mesmo eletroduto (1 a 4; mais que 4 vale a coluna de 4). */
  agrupados: number;
  tipo: TipoDeCircuito;
  /** Fio que existe hoje, em mm² (0 = não sei). */
  fioAtual?: number;
  /** Disjuntor que existe hoje, em A (0 = não sei). */
  disjuntorAtual?: number;
}

export interface SaidaDoCircuito {
  corrente: number;
  /** Seção mínima do fio, em mm², pela tabela e pela seção mínima da norma; null se passou da tabela. */
  fioMinimo: number | null;
  disjuntor: number | null;
  dr: number | null;
  nivel: "ok" | "atencao" | "perigo";
  avisos: string[];
}

const coluna = (agrupados: number) => Math.min(3, Math.max(0, Math.round(agrupados) - 1));

/** A corrente que o fio de tal seção suporta, no sentido da tabela: o maior disjuntor permitido para ele. */
export function disjuntorMaximoDoFio(mm2: number, agrupados: number): number | null {
  const l = TABELA_FIOS.find((x) => x.mm2 === mm2);
  return l ? l.disjuntor[coluna(agrupados)] : null;
}

/** A conta do passo a passo da aula: corrente, depois a primeira linha da tabela cujo disjuntor cobre a corrente, depois a seção mínima da norma. */
export function avaliarCircuito(e: EntradaDoCircuito): SaidaDoCircuito {
  const avisos: string[] = [];
  const corrente = e.tensao > 0 ? Math.max(0, e.watts) / e.tensao : 0;
  const col = coluna(e.agrupados);
  const linha = TABELA_FIOS.find((l) => l.disjuntor[col] >= corrente);
  const secaoMinimaNorma = e.tipo === "iluminacao" ? 1.5 : 2.5;
  let nivel: SaidaDoCircuito["nivel"] = "ok";
  const sobe = (n: SaidaDoCircuito["nivel"]) => { if (n === "perigo" || (n === "atencao" && nivel === "ok")) nivel = n; };

  if (e.tipo !== "exclusivo" && corrente > 10) {
    avisos.push("Corrente acima de 10 A num circuito de uso geral: pelo manual baseado na NBR 5410, divida em circuitos menores. Aparelho que puxa mais de 10 A pede circuito só para ele.");
    sobe("atencao");
  }
  if (corrente === 0) return { corrente, fioMinimo: null, disjuntor: null, dr: null, nivel: "ok", avisos: ["Ponha a potência dos aparelhos para ver a conta."] };
  if (!linha) {
    avisos.push("A corrente passa da tabela simplificada (até 70 A). Isso é projeto de profissional habilitado, não de tabela.");
    return { corrente, fioMinimo: null, disjuntor: null, dr: null, nivel: "perigo", avisos };
  }
  const fioMinimo = Math.max(linha.mm2, secaoMinimaNorma);
  const disjuntor = linha.disjuntor[col];
  const dr = drMinimo(disjuntor);

  if (e.fioAtual && e.fioAtual > 0) {
    const max = disjuntorMaximoDoFio(e.fioAtual, e.agrupados);
    if (max === null) avisos.push("Essa seção de fio não está na tabela simplificada (1,5 a 16 mm²): confira com um eletricista.");
    else {
      if (e.fioAtual < secaoMinimaNorma) { avisos.push(`O fio de ${num(e.fioAtual)} mm² é menor que o mínimo da norma para ${e.tipo === "iluminacao" ? "iluminação (1,5 mm²)" : "tomadas e aparelhos (2,5 mm²)"}.`); sobe("perigo"); }
      if (corrente > max) { avisos.push(`O fio de ${num(e.fioAtual)} mm² suporta no máximo o equivalente a um disjuntor de ${max} A neste tipo de instalação, e a carga puxa ${num(corrente)} A: o fio esquenta. Não use esta carga neste fio.`); sobe("perigo"); }
      if (e.disjuntorAtual && e.disjuntorAtual > max) { avisos.push(`O disjuntor de ${e.disjuntorAtual} A é maior do que o fio de ${num(e.fioAtual)} mm² aguenta (${max} A). O disjuntor não vai desarmar antes de o fio esquentar: risco de incêndio. Não troque disjuntor por um maior sem trocar o fio.`); sobe("perigo"); }
    }
  }
  if (e.disjuntorAtual && e.disjuntorAtual > 0 && corrente > e.disjuntorAtual) {
    avisos.push(`A carga puxa ${num(corrente)} A e o disjuntor de ${e.disjuntorAtual} A vai desarmar. É a proteção funcionando: reduza a carga ou refaça o circuito; não troque por um disjuntor maior.`);
    sobe("atencao");
  }
  if (e.tipo === "exclusivo" && corrente <= 10) avisos.push("Circuito exclusivo com corrente de até 10 A: confira se precisa mesmo ser só desse aparelho.");
  return { corrente, fioMinimo, disjuntor, dr, nivel, avisos };
}

const num = (x: number) => x.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export interface Aparelho {
  nome: string;
  watts: number;
  /** Em qual circuito da casa ele está ligado (1, 2, 3…). */
  circuito: number;
}

/** Valores de exemplo, para a pessoa começar. Cada casa tem os seus: o certo é o da etiqueta do aparelho. */
export const EXEMPLOS_DE_APARELHOS: { nome: string; watts: number }[] = [
  { nome: "Chuveiro elétrico (veja a etiqueta)", watts: 5500 },
  { nome: "Ferro de passar", watts: 1000 },
  { nome: "Micro-ondas", watts: 1200 },
  { nome: "Geladeira", watts: 300 },
  { nome: "Ar-condicionado 9.000 BTU", watts: 1000 },
  { nome: "Lâmpadas LED (casa toda)", watts: 100 },
];

export interface ResumoDaCasa {
  totalWatts: number;
  correnteTotal: number;
  porCircuito: { circuito: number; watts: number; itens: string[] }[];
}

/** Soma a potência por circuito e no total. Os aparelhos vazios ou com potência negativa são ignorados. */
export function resumirCasa(aparelhos: Aparelho[], tensao: number): ResumoDaCasa {
  const validos = aparelhos.filter((a) => Number.isFinite(a.watts) && a.watts > 0);
  const mapa = new Map<number, { watts: number; itens: string[] }>();
  for (const a of validos) {
    const c = Math.max(1, Math.round(a.circuito) || 1);
    const atual = mapa.get(c) ?? { watts: 0, itens: [] };
    atual.watts += a.watts;
    atual.itens.push(a.nome || "aparelho");
    mapa.set(c, atual);
  }
  const totalWatts = validos.reduce((s, a) => s + a.watts, 0);
  return {
    totalWatts,
    correnteTotal: tensao > 0 ? totalWatts / tensao : 0,
    porCircuito: [...mapa.entries()].sort((a, b) => a[0] - b[0]).map(([circuito, v]) => ({ circuito, ...v })),
  };
}

/* ───────────────────────── 4. Mapa de serviços públicos ───────────────────────── */

export interface Servico {
  id: string;
  nome: string;
  sigla: string;
  paraQue: string;
  quando: string[];
  /** Como se chega: o que a fonte oficial diz sobre levar documento ou marcar. */
  chegar: string;
  /** Os links oficiais. Nenhum recebe dado da pessoa: ela escolhe estado e município lá. */
  links: { texto: string; url: string }[];
  /** Quando não há busca nacional confirmada, o que fazer. */
  semBuscaNacional?: string;
  lei?: string;
}

export const SERVICOS: Servico[] = [
  {
    id: "cras", sigla: "CRAS", nome: "Centro de Referência de Assistência Social",
    paraQue: "Porta de entrada da assistência social: inscrição no Cadastro Único, orientação sobre benefícios, apoio a famílias e orientação em casos de violência doméstica.",
    quando: ["Precisa se inscrever ou atualizar o Cadastro Único", "Quer saber de benefícios sociais", "Está passando necessidade e não sabe a quem pedir ajuda"],
    chegar: "O atendimento é presencial, sem exigência de documento, mas leve CPF ou documento de identidade se tiver. O telefone 121 (gratuito, do Ministério do Desenvolvimento e Assistência Social) dá informações. Pode haver fila na primeira visita.",
    links: [
      { texto: "Gov.br: acessar o CRAS (como achar a unidade)", url: "https://www.gov.br/pt-br/servicos/acessar-o-cras-centro-de-referencia-da-assistencia-social" },
      { texto: "Gov.br: inscrever-se no Cadastro Único", url: "https://www.gov.br/pt-br/servicos/inscrever-se-no-cadastro-unico-para-programas-sociais-do-governo-federal" },
    ],
    semBuscaNacional: "Se a busca do gov.br não abrir, pergunte na Secretaria de Assistência Social da prefeitura qual CRAS atende o seu bairro: o atendimento é por território.",
  },
  {
    id: "ubs", sigla: "UBS", nome: "Unidade Básica de Saúde",
    paraQue: "Porta de entrada do SUS: consulta, vacina, exames, curativos, acompanhamento de gravidez, de pressão e de diabetes, e encaminhamento para especialistas.",
    quando: ["Precisa de consulta ou de vacina", "Quer atestado médico", "Precisa de encaminhamento para exame ou especialista"],
    chegar: "Para marcar consulta, vá à UBS mais próxima da sua residência, levando documento de identidade.",
    links: [
      { texto: "Gov.br: serviços públicos de saúde e como acessá-los (Ministério da Justiça)", url: "https://www.gov.br/mj/pt-br/assuntos/seus-direitos/refugio/integracao-local/servicos-publicos" },
      { texto: "Ministério da Saúde: Meu SUS Digital (Conecte SUS)", url: "https://www.gov.br/saude/pt-br/assuntos/conecte-sus/cidadao" },
    ],
    semBuscaNacional: "Não conferimos um buscador nacional de UBS. Pergunte a unidade do seu bairro na Secretaria Municipal de Saúde (site ou telefone da prefeitura): ela diz qual UBS atende o seu endereço.",
    lei: "CF, art. 196: a saúde é direito de todos e dever do Estado.",
  },
  {
    id: "caps", sigla: "CAPS", nome: "Centro de Atenção Psicossocial",
    paraQue: "Atendimento gratuito, do SUS, para quem vive sofrimento psíquico intenso, incluindo o uso prejudicial de álcool e outras drogas. Há unidades para adultos, para crianças e adolescentes e para álcool e drogas.",
    quando: ["Sofrimento muito forte que não passa", "Uso de álcool ou drogas que está destruindo a vida", "Criança ou adolescente com sofrimento psíquico grave"],
    chegar: "O CAPS trabalha de portas abertas: você pode ir à unidade da sua região e pedir atendimento sem consulta marcada para o primeiro acolhimento. Também pode ser encaminhado pela UBS. Em risco de vida, procure uma UPA ou o serviço de urgência.",
    links: [{ texto: "Ministério da Saúde: o que são os CAPS", url: "https://www.gov.br/saude/pt-br/composicao/saes/desmad/raps/caps" }],
    semBuscaNacional: "O Ministério da Saúde indica procurar a Secretaria Municipal de Saúde ou a UBS do bairro para saber onde fica o CAPS. Nem toda cidade tem todos os tipos: a existência depende do tamanho do município.",
  },
  {
    id: "defensoria", sigla: "Defensoria", nome: "Defensoria Pública",
    paraQue: "Assistência jurídica gratuita para quem não pode pagar um advogado: orientação, acordo e ações na Justiça.",
    quando: ["Problema de trabalho, aluguel, dívida, família ou benefício negado", "Não tem dinheiro para advogado", "Quer saber o que fazer antes de assinar ou de ir à Justiça"],
    chegar: "Há a Defensoria Pública da União (causas federais, como INSS) e a Defensoria Pública do Estado (a maioria dos demais casos). Cada uma tem suas regras de atendimento; confira no site se precisa marcar horário e quais documentos levar.",
    links: [
      { texto: "Defensoria Pública da União: unidades por estado", url: "https://www.dpu.def.br/contatos-dpu" },
      { texto: "ANADEP: Defensorias Públicas dos estados (endereços e sites)", url: "https://www.anadep.org.br/wtk/pagina/defensorias_nacionais" },
    ],
    lei: "CF, art. 5º, LXXIV: o Estado prestará assistência jurídica integral e gratuita aos que comprovarem insuficiência de recursos.",
  },
  {
    id: "procon", sigla: "Procon", nome: "Procon e consumidor.gov.br",
    paraQue: "Defesa do consumidor: reclamação contra cobrança indevida, contrato abusivo, produto com defeito, banco e loja.",
    quando: ["Cobrança que você não reconhece", "Contrato de crédito ou aluguel de loja com cláusula estranha", "Produto ou serviço que não foi entregue"],
    chegar: "Procure primeiro resolver com a empresa e guarde o número do protocolo. Se não resolver, leve contrato, notas, mensagens e protocolo ao Procon. O consumidor.gov.br é um serviço público para reclamar de empresas, e exige conta gov.br (nível prata ou ouro) para acompanhar a reclamação.",
    links: [
      { texto: "Consumidor.gov.br: órgãos de defesa do consumidor por estado (Procons e Defensorias)", url: "https://www.consumidor.gov.br/pages/principal/orgaos-gestores" },
      { texto: "Consumidor.gov.br: a plataforma de reclamações", url: "https://www.consumidor.gov.br/" },
    ],
    semBuscaNacional: "A lista de órgãos é por ordem alfabética de estado; encontre o seu estado e o Procon da sua cidade.",
    lei: "CF, art. 5º, XXXII: o Estado promoverá, na forma da lei, a defesa do consumidor. CDC, Lei 8.078/1990.",
  },
  {
    id: "eja", sigla: "EJA", nome: "Educação de Jovens e Adultos e Encceja",
    paraQue: "Estudar e terminar o ensino fundamental ou médio depois da idade regular, em curso de EJA na rede pública, ou fazer o Encceja (exame nacional que certifica competências).",
    quando: ["Não terminou os estudos e quer voltar", "Precisa do certificado para um emprego ou concurso", "Quer saber a idade mínima para o Encceja"],
    chegar: "Para o curso de EJA, procure a escola pública mais perto ou a Secretaria de Educação do município ou do estado e pergunte pela matrícula. Para o Encceja, a inscrição exige CPF; a idade mínima é de 15 anos completos no fundamental e 18 no médio na data da prova.",
    links: [{ texto: "Inep: Encceja (inscrição, regras e certificação)", url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/encceja" }],
    semBuscaNacional: "Não conferimos um buscador nacional de turmas de EJA: a matrícula é na escola ou na Secretaria de Educação da sua cidade.",
    lei: "LDB (Lei 9.394/1996), art. 37: a educação de jovens e adultos é destinada a quem não teve acesso ou continuidade de estudos no ensino fundamental e médio na idade própria; os sistemas de ensino a asseguram gratuitamente.",
  },
];

/** O texto pronto para a pessoa levar ou colar numa mensagem à prefeitura, com o município que ela digitou (só no aparelho). */
export function pedidoDeEndereco(servico: Servico, municipio: string, uf: string): string {
  const onde = [municipio.trim(), uf.trim().toUpperCase()].filter(Boolean).join("/");
  const lugar = onde ? ` em ${onde}` : "";
  return `Bom dia. Gostaria de saber o endereço e o horário de atendimento do ${servico.sigla} (${servico.nome})${lugar} que atende o meu bairro, e o que preciso levar.`;
}

export const UFS = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"] as const;
