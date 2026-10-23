// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A lógica do multímetro virtual: o que o visor mostra para cada posição da chave, cada borne em que a ponteira
// vermelha está e cada par de terminais em que as duas ponteiras encostam. Os valores das peças são os típicos de
// bancada (pilha nova, bateria de 9 V, tomada de 127 V ou 220 V, resistores pelo código de cores); os limites de escala
// e os avisos de segurança seguem o funcionamento de um multímetro digital comum de 3½ dígitos.

export type Chave = "off" | "vdc20" | "vdc200" | "vac750" | "ohm200" | "ohm2k" | "ohm200k" | "cont" | "a10";
export type Borne = "vohm" | "a10";

export const CHAVES: { id: Chave; rotulo: string; grupo: "V⎓" | "V~" | "Ω" | "•)))" | "A" | "OFF"; angulo: number }[] = [
  { id: "off", rotulo: "OFF", grupo: "OFF", angulo: -90 },
  { id: "vdc20", rotulo: "20", grupo: "V⎓", angulo: -50 },
  { id: "vdc200", rotulo: "200", grupo: "V⎓", angulo: -25 },
  { id: "vac750", rotulo: "750", grupo: "V~", angulo: 0 },
  { id: "a10", rotulo: "10A", grupo: "A", angulo: 30 },
  { id: "cont", rotulo: "•)))", grupo: "•)))", angulo: 60 },
  { id: "ohm200", rotulo: "200", grupo: "Ω", angulo: 100 },
  { id: "ohm2k", rotulo: "2k", grupo: "Ω", angulo: 130 },
  { id: "ohm200k", rotulo: "200k", grupo: "Ω", angulo: 160 },
];

/** Uma peça da bancada, com dois terminais (a ponta vermelha e a preta encostam neles). */
export interface Peca {
  id: string;
  nome: string;
  /** Tensão contínua entre o terminal "mais" (a) e o "menos" (b), em volts. */
  dc?: number;
  /** Tensão alternada (eficaz), em volts. */
  ac?: number;
  /** Resistência entre os terminais, em ohms (Infinity: aberto). Só faz sentido sem energia. */
  ohm?: number;
  /** Nomes dos dois terminais, para a pessoa saber onde encostou. */
  terminais: [string, string];
  /** O que se aprende ao medir certo. */
  explicacao: string;
  /** Desenho simples (emoji) na bancada. */
  icone: string;
}

export interface Leitura {
  visor: string;
  unidade: string;
  tipo: "ok" | "aviso" | "perigo" | "nada";
  texto?: string;
  bipe?: boolean;
  queimaFusivel?: boolean;
}

const fmt = (n: number, casas: number) => n.toFixed(casas).replace(".", ",");

/**
 * O que o multímetro mostra. "invertido": a vermelha no terminal b (o sinal de menos aparece na contínua).
 * "fusivelQueimado": depois de um curto na escala de corrente, a corrente não mede mais até trocar o fusível.
 */
export function ler(chave: Chave, borne: Borne, peca: Peca | null, invertido: boolean, fusivelQueimado: boolean): Leitura {
  if (chave === "off") return { visor: "", unidade: "", tipo: "nada" };
  const energizada = Boolean(peca && ((peca.dc ?? 0) !== 0 || (peca.ac ?? 0) !== 0));
  // A ponteira vermelha no borne de 10 A transforma o multímetro num fio entre as ponteiras.
  if (borne === "a10") {
    if (peca && energizada) {
      return {
        visor: fusivelQueimado ? "0,00" : "FUSE",
        unidade: "A",
        tipo: "perigo",
        queimaFusivel: true,
        texto: `PERIGO: com a ponteira vermelha no borne de 10 A, o multímetro vira quase um fio. Encostar as ponteiras ${peca.ac ? "na tomada" : "numa fonte"} é um curto-circuito: queima o fusível interno${peca.ac ? " e, na tomada, pode causar arco elétrico e queimadura" : ""}. Corrente se mede em série, com o circuito aberto e a chave em A; tensão, com a vermelha em VΩ.`,
      };
    }
    if (chave !== "a10") return { visor: "0,00", unidade: "", tipo: "aviso", texto: "A ponteira vermelha está no borne de 10 A, mas a chave não está em corrente: a leitura não faz sentido. Volte a vermelha para o borne VΩ." };
  }
  if (chave === "a10") {
    if (borne !== "a10") return { visor: "0,00", unidade: "A", tipo: "aviso", texto: "Para medir corrente, a ponteira vermelha vai no borne de 10 A, e o multímetro entra em série no circuito (no lugar de um pedaço de fio)." };
    if (fusivelQueimado) return { visor: "0,00", unidade: "A", tipo: "aviso", texto: "O fusível interno queimou no curto de antes: a escala de corrente não mede nada até trocar o fusível." };
    return { visor: "0,00", unidade: "A", tipo: "aviso", texto: "Sem um circuito aberto para o multímetro entrar em série, não há corrente para medir aqui." };
  }
  if (!peca) return { visor: chave.startsWith("ohm") || chave === "cont" ? "1" : "0,00", unidade: "", tipo: "nada", texto: "Encoste as duas ponteiras nos dois terminais de uma mesma peça." };
  if (chave === "cont" || chave.startsWith("ohm")) {
    if (energizada) return { visor: "----", unidade: "", tipo: "perigo", texto: "Nunca meça resistência ou continuidade com a peça energizada: a leitura não vale e pode danificar o multímetro. Desligue o disjuntor ou tire da tomada antes." };
    if (peca.ohm === undefined) return { visor: "1", unidade: "", tipo: "aviso", texto: "Esta peça não tem resistência para medir." };
    if (chave === "cont") return peca.ohm < 30 ? { visor: fmt(peca.ohm, 1), unidade: "Ω", tipo: "ok", bipe: true, texto: peca.explicacao } : { visor: "1", unidade: "", tipo: "ok", texto: `Sem bipe: não há continuidade (circuito aberto). ${peca.explicacao}` };
    const max = chave === "ohm200" ? 200 : chave === "ohm2k" ? 2000 : 200000;
    if (peca.ohm > max) return { visor: "1", unidade: "", tipo: peca.ohm === Infinity ? "ok" : "aviso", texto: peca.ohm === Infinity ? `Aberto: resistência infinita. ${peca.explicacao}` : "\"1\" sozinho à esquerda é estouro de escala: o valor passa do máximo desta posição. Gire para uma escala maior." };
    const valor = chave === "ohm200k" ? fmt(peca.ohm / 1000, 1) : fmt(peca.ohm, chave === "ohm200" ? 1 : 0);
    return { visor: valor, unidade: chave === "ohm200k" ? "kΩ" : "Ω", tipo: "ok", texto: peca.explicacao };
  }
  if (chave === "vac750") {
    if (peca.ac) return { visor: fmt(peca.ac, 0), unidade: "V~", tipo: "ok", texto: peca.explicacao };
    if (peca.dc) return { visor: "0", unidade: "V~", tipo: "aviso", texto: "Escala de alternada numa fonte contínua: o visor mostra zero (ou um número sem sentido). Para pilha, bateria e fonte de computador, use V⎓." };
    return { visor: "0", unidade: "V~", tipo: "aviso", texto: "Peça sem energia: não há tensão para medir." };
  }
  // Contínua.
  if (peca.ac) {
    const max = chave === "vdc20" ? 20 : 200;
    return { visor: peca.ac > max ? "1" : "0,0", unidade: "V⎓", tipo: "aviso", texto: "A tomada é tensão alternada: na escala contínua o visor engana. Gire para V~ 750 antes de encostar na tomada." };
  }
  if (peca.dc === undefined) return { visor: "0,00", unidade: "V⎓", tipo: "aviso", texto: "Peça sem energia: não há tensão para medir. Para ela, use Ω ou continuidade." };
  const max = chave === "vdc20" ? 20 : 200;
  if (Math.abs(peca.dc) > max) return { visor: "1", unidade: "", tipo: "aviso", texto: "Estouro de escala: a tensão passa de 20 V. Gire para 200." };
  const v = invertido ? -peca.dc : peca.dc;
  return {
    visor: chave === "vdc20" ? fmt(v, 2) : fmt(v, 1),
    unidade: "V⎓",
    tipo: "ok",
    texto: `${invertido && peca.dc ? "O sinal de menos quer dizer ponteiras invertidas (a vermelha no negativo): no digital não estraga nada. " : ""}${peca.explicacao}`,
  };
}

/** As peças da bancada de elétrica. */
export const BANCADA_ELETRICA: Peca[] = [
  { id: "pilha", nome: "Pilha AA", icone: "bateria", dc: 1.58, terminais: ["polo + (o biquinho)", "polo − (a base)"], explicacao: "Pilha alcalina nova tem pouco mais de 1,5 V. Abaixo de uns 1,2 V ela já não serve para controle remoto e relógio." },
  { id: "bateria9", nome: "Bateria de 9 V", icone: "bateria", dc: 9.32, terminais: ["polo + (o menor)", "polo − (o maior)"], explicacao: "Nova, passa um pouco de 9 V. É usada em detectores de fumaça, alarmes e no próprio multímetro." },
  { id: "tomada127", nome: "Tomada (127 V)", icone: "tomada", ac: 127, terminais: ["furo da fase", "furo do neutro"], explicacao: "Em boa parte do Brasil a tomada tem 127 V (às vezes aparece como 110 V ou 120 V). A tensão pode variar uns 10% para mais ou para menos." },
  { id: "tomada220", nome: "Tomada de chuveiro (220 V)", icone: "tomada", ac: 220, terminais: ["fase 1", "fase 2 (ou neutro)"], explicacao: "220 V: em algumas cidades é a tensão da casa toda; em outras, chega só aos pontos de chuveiro e ar-condicionado. Meça antes de ligar qualquer aparelho que não seja bivolt." },
  { id: "resistor1k", nome: "Resistor marrom-preto-vermelho", icone: "▭", ohm: 1000, terminais: ["perna esquerda", "perna direita"], explicacao: "Marrom (1), preto (0), vermelho (×100) = 1.000 Ω = 1 kΩ. Resistor se mede fora do circuito, senão as outras peças entram na conta." },
  { id: "resistor100k", nome: "Resistor marrom-preto-amarelo", icone: "▭", ohm: 100000, terminais: ["perna esquerda", "perna direita"], explicacao: "Marrom (1), preto (0), amarelo (×10.000) = 100 kΩ. Na escala de 2k ele estoura; na de 200k aparece certinho." },
  { id: "chuveiro", nome: "Resistência de chuveiro (desligada)", icone: "onda", ohm: 8.1, terminais: ["borne 1", "borne 2"], explicacao: "Uma resistência de uns 8 Ω num chuveiro de 220 V puxa cerca de 27 A (220 ÷ 8,1) e dá uns 6.000 W (220 × 27). Resistência partida mostra \"1\" (aberta): é a causa mais comum de chuveiro que não esquenta." },
  { id: "lampada-boa", nome: "Lâmpada incandescente boa", icone: "lampada", ohm: 15, terminais: ["contato central", "rosca"], explicacao: "Fria, a lâmpada incandescente tem resistência baixa (o filamento esquenta e ela sobe ao acender). Continuidade apita: filamento inteiro." },
  { id: "lampada-queimada", nome: "Lâmpada incandescente queimada", icone: "lampada", ohm: Infinity, terminais: ["contato central", "rosca"], explicacao: "Filamento rompido: aberto, sem continuidade. Lâmpada LED não se testa assim: ela tem um circuito eletrônico dentro." },
  { id: "fio", nome: "Pedaço de fio (2,5 mm²)", icone: "〰️", ohm: 0.1, terminais: ["ponta 1", "ponta 2"], explicacao: "Fio inteiro é quase zero ohm: continuidade apita. Use para achar fio partido dentro da parede ou de uma extensão." },
  { id: "fusivel", nome: "Fusível de vidro escurecido", icone: "escudo", ohm: Infinity, terminais: ["ponta 1", "ponta 2"], explicacao: "Aberto: queimou. Se o novo queimar logo depois da troca, há um curto ou uma sobrecarga: procure a causa antes de trocar de novo." },
  { id: "interruptor-ligado", nome: "Interruptor (na posição ligado)", icone: "engrenagem", ohm: 0.05, terminais: ["borne de entrada", "borne de saída"], explicacao: "Ligado, o interruptor é um fio: continuidade apita. Desligado, abre o circuito. Teste sempre com o disjuntor desligado." },
];

/** A fonte de computador (ATX), para o laboratório de montagem: cada cor de fio contra o preto (terra). */
export const fonteAtx = (ligada: boolean): Peca[] => [
  { id: "atx-amarelo", nome: "Fonte ATX: fio amarelo × preto", icone: "raio", dc: ligada ? 12.08 : 0, terminais: ["fio amarelo", "fio preto"], explicacao: "Amarelo é +12 V: processador, placa de vídeo e motores. Aceita de 11,4 V a 12,6 V (±5%)." },
  { id: "atx-vermelho", nome: "Fonte ATX: fio vermelho × preto", icone: "raio", dc: ligada ? 5.02 : 0, terminais: ["fio vermelho", "fio preto"], explicacao: "Vermelho é +5 V (USB, discos SATA). Tolerância: 4,75 V a 5,25 V." },
  { id: "atx-laranja", nome: "Fonte ATX: fio laranja × preto", icone: "raio", dc: ligada ? 3.34 : 0, terminais: ["fio laranja", "fio preto"], explicacao: "Laranja é +3,3 V (memória, chipset). Tolerância: 3,14 V a 3,47 V." },
  { id: "atx-roxo", nome: "Fonte ATX: fio roxo × preto", icone: "raio", dc: 5.05, terminais: ["fio roxo", "fio preto"], explicacao: "Roxo é o +5 V de espera (5VSB): existe mesmo com o computador desligado, desde que a fonte esteja na tomada." },
  { id: "atx-verde", nome: "Fonte ATX: fio verde × preto", icone: "raio", dc: ligada ? 0 : 4.9, terminais: ["fio verde", "fio preto"], explicacao: "Verde é o PS_ON: fica em uns 5 V com a fonte em espera; quando vai a 0 V (botão, ou um clipe ligando verde e preto), a fonte liga." },
  { id: "cr2032", nome: "Bateria da placa-mãe (CR2032)", icone: "moeda", dc: 2.48, terminais: ["face + (com letras)", "face −"], explicacao: "Nova, a CR2032 tem uns 3 V. Abaixo de 2,7 V a placa começa a perder data, hora e configurações: esta está fraca." },
  { id: "carregador-note", nome: "Carregador de notebook (na ponta do plugue)", icone: "tomada", dc: 19.5, terminais: ["pino central", "capa externa"], explicacao: "A maioria dos carregadores de notebook entrega de 19 V a 20 V." },
];
