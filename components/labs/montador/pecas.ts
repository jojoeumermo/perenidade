// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As peças da bancada de montagem: genéricas, sem marca, com os números que decidem se o computador liga (soquete,
// tipo de memória, tamanho, consumo, conectores). Os valores são típicos do mercado, arredondados para o estudo.

export type Formato = "ATX" | "mATX" | "ITX";
export type Soquete = "AM4" | "AM5" | "LGA1700";
export type Memoria = "DDR4" | "DDR5";

export interface Placa { id: string; nome: string; soquete: Soquete; memoria: Memoria; formato: Formato; slotsRam: number; m2: number; sata: number }
export interface Cpu { id: string; nome: string; soquete: Soquete; tdp: number; video: boolean; coolerNaCaixa: boolean }
export interface Cooler { id: string; nome: string; capacidade: number; altura: number; radiador?: 240 | 360; box?: boolean }
export interface Ram { id: string; nome: string; memoria: Memoria; pentes: number; gb: number }
export interface Disco { id: string; nome: string; tipo: "m2" | "sata"; hd?: boolean; consumo: number }
export interface Gpu { id: string; nome: string; consumo: number; comprimento: number; pinos8: number; novo12v?: boolean }
export interface Fonte { id: string; nome: string; watts: number; real: number; pinos8: number; novo12v: boolean; generica?: boolean }
export interface Gabinete { id: string; nome: string; formatos: Formato[]; gpuMax: number; coolerMax: number; radiador: 0 | 240 | 360 }

export const PLACAS: Placa[] = [
  { id: "am4-atx", nome: "ATX · AM4 · DDR4 · 4 slots de memória · 2 M.2", soquete: "AM4", memoria: "DDR4", formato: "ATX", slotsRam: 4, m2: 2, sata: 6 },
  { id: "am5-atx", nome: "ATX · AM5 · DDR5 · 4 slots de memória · 3 M.2", soquete: "AM5", memoria: "DDR5", formato: "ATX", slotsRam: 4, m2: 3, sata: 4 },
  { id: "1700-matx", nome: "Micro-ATX · LGA1700 · DDR4 · 2 slots · 1 M.2", soquete: "LGA1700", memoria: "DDR4", formato: "mATX", slotsRam: 2, m2: 1, sata: 4 },
  { id: "1700-itx", nome: "Mini-ITX · LGA1700 · DDR5 · 2 slots · 2 M.2", soquete: "LGA1700", memoria: "DDR5", formato: "ITX", slotsRam: 2, m2: 2, sata: 2 },
];

export const CPUS: Cpu[] = [
  { id: "am4-6g", nome: "6 núcleos, AM4, com vídeo integrado, 65 W (vem com cooler)", soquete: "AM4", tdp: 65, video: true, coolerNaCaixa: true },
  { id: "am4-8", nome: "8 núcleos, AM4, sem vídeo integrado, 105 W", soquete: "AM4", tdp: 105, video: false, coolerNaCaixa: false },
  { id: "am5-6", nome: "6 núcleos, AM5, vídeo integrado básico, 65 W", soquete: "AM5", tdp: 65, video: true, coolerNaCaixa: false },
  { id: "am5-16", nome: "16 núcleos, AM5, vídeo integrado básico, 170 W", soquete: "AM5", tdp: 170, video: true, coolerNaCaixa: false },
  { id: "1700-6", nome: "6 núcleos, LGA1700, com vídeo integrado, 65 W (vem com cooler)", soquete: "LGA1700", tdp: 65, video: true, coolerNaCaixa: true },
  { id: "1700-14f", nome: "14 núcleos, LGA1700, sem vídeo integrado (série F), 180 W no turbo", soquete: "LGA1700", tdp: 180, video: false, coolerNaCaixa: false },
];

export const COOLERS: Cooler[] = [
  { id: "box", nome: "Cooler box (o que vem na caixa do processador)", capacidade: 65, altura: 55, box: true },
  { id: "baixo", nome: "Cooler baixo (low profile), 47 mm, até 95 W", capacidade: 95, altura: 47 },
  { id: "torre", nome: "Cooler torre, 155 mm, até 180 W", capacidade: 180, altura: 155 },
  { id: "torre-g", nome: "Cooler torre duplo, 165 mm, até 240 W", capacidade: 240, altura: 165 },
  { id: "water240", nome: "Water cooler com radiador de 240 mm, até 250 W", capacidade: 250, altura: 30, radiador: 240 },
  { id: "water360", nome: "Water cooler com radiador de 360 mm, até 300 W", capacidade: 300, altura: 30, radiador: 360 },
];

export const RAMS: Ram[] = [
  { id: "d4-1x8", nome: "1 pente de 8 GB DDR4", memoria: "DDR4", pentes: 1, gb: 8 },
  { id: "d4-2x8", nome: "2 pentes de 8 GB DDR4 (16 GB)", memoria: "DDR4", pentes: 2, gb: 16 },
  { id: "d4-4x16", nome: "4 pentes de 16 GB DDR4 (64 GB)", memoria: "DDR4", pentes: 4, gb: 64 },
  { id: "d5-1x16", nome: "1 pente de 16 GB DDR5", memoria: "DDR5", pentes: 1, gb: 16 },
  { id: "d5-2x16", nome: "2 pentes de 16 GB DDR5 (32 GB)", memoria: "DDR5", pentes: 2, gb: 32 },
  { id: "d5-4x16", nome: "4 pentes de 16 GB DDR5 (64 GB)", memoria: "DDR5", pentes: 4, gb: 64 },
];

export const DISCOS: Disco[] = [
  { id: "nvme1", nome: "SSD NVMe 1 TB (M.2)", tipo: "m2", consumo: 7 },
  { id: "nvme2", nome: "SSD NVMe 2 TB (M.2)", tipo: "m2", consumo: 8 },
  { id: "nvme3", nome: "SSD NVMe 500 GB (M.2)", tipo: "m2", consumo: 6 },
  { id: "sata-ssd", nome: "SSD SATA 1 TB (2,5\")", tipo: "sata", consumo: 4 },
  { id: "hd", nome: "HD 2 TB (SATA, 3,5\")", tipo: "sata", hd: true, consumo: 9 },
];

export const GPUS: Gpu[] = [
  { id: "nenhuma", nome: "Sem placa de vídeo (usar o vídeo do processador)", consumo: 0, comprimento: 0, pinos8: 0 },
  { id: "entrada", nome: "De entrada, 75 W, 170 mm, sem cabo extra", consumo: 75, comprimento: 170, pinos8: 0 },
  { id: "media", nome: "Intermediária, 200 W, 270 mm, 1 cabo de 8 pinos", consumo: 200, comprimento: 270, pinos8: 1 },
  { id: "alta", nome: "Alta, 320 W, 320 mm, 2 cabos de 8 pinos", consumo: 320, comprimento: 320, pinos8: 2 },
  { id: "topo", nome: "Topo, 450 W, 340 mm, conector 12V-2x6 (16 pinos)", consumo: 450, comprimento: 340, pinos8: 0, novo12v: true },
];

export const FONTES: Fonte[] = [
  { id: "gen500", nome: "Fonte genérica \"500 W\" (sem selo, muito barata)", watts: 500, real: 250, pinos8: 1, novo12v: false, generica: true },
  { id: "400", nome: "400 W, 80 Plus Bronze, 1 cabo PCIe de 8 pinos", watts: 400, real: 400, pinos8: 1, novo12v: false },
  { id: "550", nome: "550 W, 80 Plus Bronze, 2 cabos PCIe de 8 pinos", watts: 550, real: 550, pinos8: 2, novo12v: false },
  { id: "750", nome: "750 W, 80 Plus Gold, 3 cabos PCIe de 8 pinos", watts: 750, real: 750, pinos8: 3, novo12v: false },
  { id: "1000", nome: "1000 W, ATX 3.1, 80 Plus Gold, 12V-2x6 e 2 cabos de 8 pinos", watts: 1000, real: 1000, pinos8: 2, novo12v: true },
];

export const GABINETES: Gabinete[] = [
  { id: "itx", nome: "Compacto Mini-ITX: placa de vídeo até 200 mm, cooler até 70 mm", formatos: ["ITX"], gpuMax: 200, coolerMax: 70, radiador: 0 },
  { id: "matx", nome: "Micro-ATX: placa de vídeo até 300 mm, cooler até 160 mm, radiador 240", formatos: ["mATX", "ITX"], gpuMax: 300, coolerMax: 160, radiador: 240 },
  { id: "atx", nome: "Torre ATX: placa de vídeo até 360 mm, cooler até 170 mm, radiador 360", formatos: ["ATX", "mATX", "ITX"], gpuMax: 360, coolerMax: 170, radiador: 360 },
];

export interface Escolha { placa?: string; cpu?: string; cooler?: string; ram?: string; discos: string[]; gpu?: string; fonte?: string; gabinete?: string }

export interface Resultado { erros: string[]; avisos: string[]; consumo: number; recomendada: number; completa: boolean }

const achar = <T extends { id: string }>(lista: T[], id?: string) => lista.find((x) => x.id === id);

/** Confere a montagem inteira: o que impede de ligar (erros) e o que liga, mas não está bom (avisos). */
export function conferir(e: Escolha): Resultado {
  const placa = achar(PLACAS, e.placa), cpu = achar(CPUS, e.cpu), cooler = achar(COOLERS, e.cooler), ram = achar(RAMS, e.ram);
  const gpu = achar(GPUS, e.gpu), fonte = achar(FONTES, e.fonte), gab = achar(GABINETES, e.gabinete);
  const discos = e.discos.map((id) => achar(DISCOS, id)!).filter(Boolean);
  const erros: string[] = [], avisos: string[] = [];

  // Placa-mãe, gabinete e fonte com ventoinhas: uns 50 W; cada pente, uns 5 W.
  const consumo = (cpu?.tdp ?? 0) + (gpu?.consumo ?? 0) + (ram ? ram.pentes * 5 : 0) + discos.reduce((s, d) => s + d.consumo, 0) + 50;
  const recomendada = Math.ceil((consumo * 1.3) / 50) * 50;

  if (placa && cpu && cpu.soquete !== placa.soquete) erros.push(`Soquete: o processador é ${cpu.soquete} e a placa-mãe é ${placa.soquete}. Não encaixa: cada soquete tem pinos, tamanho e trava próprios.`);
  if (placa && ram && ram.memoria !== placa.memoria) erros.push(`Memória: o pente é ${ram.memoria} e a placa-mãe aceita só ${placa.memoria}. O chanfro do encaixe fica em outro lugar e a tensão é diferente.`);
  if (placa && ram && ram.pentes > placa.slotsRam) erros.push(`São ${ram.pentes} pentes e a placa-mãe tem ${placa.slotsRam} slots de memória.`);
  if (ram && ram.pentes === 1) avisos.push("Um pente só funciona, mas em canal único (single channel): a memória rende bem menos, e o vídeo integrado sofre mais. Dois pentes iguais, nos slots indicados no manual (em geral o 2.º e o 4.º), ativam o dual channel.");
  if (placa && gab && !gab.formatos.includes(placa.formato)) erros.push(`Formato: a placa-mãe é ${placa.formato} e o gabinete aceita ${gab.formatos.join(", ")}. Os furos dos parafusos e o espaço não batem.`);

  if (cpu && !cooler) erros.push("Falta o cooler do processador: sem ele, a temperatura passa de 100 °C em segundos e o computador desliga para se proteger.");
  if (cpu && cooler?.box && !cpu.coolerNaCaixa) erros.push("Esse processador não vem com cooler na caixa: escolha um cooler à parte.");
  if (cpu && cooler && cooler.capacidade < cpu.tdp) avisos.push(`O cooler dá conta de ${cooler.capacidade} W e o processador dissipa ${cpu.tdp} W: vai esquentar e reduzir a velocidade sozinho (thermal throttling).`);
  if (cooler && gab && !cooler.radiador && cooler.altura > gab.coolerMax) erros.push(`O cooler tem ${cooler.altura} mm de altura e o gabinete aceita até ${gab.coolerMax} mm: a tampa não fecha.`);
  if (cooler?.radiador && gab && gab.radiador < cooler.radiador) erros.push(`O radiador do water cooler é de ${cooler.radiador} mm e o gabinete ${gab.radiador ? `só tem lugar para ${gab.radiador} mm` : "não tem lugar para radiador"}.`);

  if (cpu && gpu && gpu.id === "nenhuma" && !cpu.video) erros.push("Sem imagem: o processador não tem vídeo integrado e não há placa de vídeo. O computador até liga, mas o monitor fica preto.");
  if (gpu && gab && gpu.comprimento > gab.gpuMax) erros.push(`A placa de vídeo tem ${gpu.comprimento} mm e o gabinete aceita até ${gab.gpuMax} mm: bate na frente do gabinete.`);

  if (fonte) {
    if (fonte.real < consumo * 1.3) erros.push(`Fonte: ${fonte.generica ? `a genérica diz ${fonte.watts} W, mas entrega de verdade uns ${fonte.real} W` : `${fonte.watts} W`} para ${consumo} W de consumo estimado. Com folga de 30%, o mínimo é ${recomendada} W. Fonte no limite desliga sob carga, esquenta e pode queimar outras peças.`);
    if (gpu && gpu.pinos8 > fonte.pinos8) erros.push(`A placa de vídeo pede ${gpu.pinos8} cabo(s) PCIe de 8 pinos e a fonte tem ${fonte.pinos8}. Adaptador de SATA ou Molex para PCIe não é solução: os fios não aguentam a corrente.`);
    if (gpu?.novo12v && !fonte.novo12v) avisos.push("A placa de vídeo usa o conector 12V-2x6. Essa fonte não tem esse cabo: dá para usar o adaptador que vem com a placa (encaixado até o fim), mas o ideal é uma fonte ATX 3.1.");
    if (fonte.generica) avisos.push("Fonte genérica sem certificação: a potência no rótulo costuma ser a de pico, sem proteções contra curto e surto. É a peça que mais leva o resto junto quando queima.");
  }

  if (placa && discos.filter((d) => d.tipo === "m2").length > placa.m2) erros.push(`São ${discos.filter((d) => d.tipo === "m2").length} SSDs M.2 e a placa-mãe tem ${placa.m2} encaixe(s) M.2.`);
  if (placa && discos.filter((d) => d.tipo === "sata").length > placa.sata) erros.push(`Mais discos SATA do que portas SATA na placa (${placa.sata}).`);
  if (discos.length && discos.every((d) => d.hd)) avisos.push("Sistema num HD mecânico fica lento para ligar e abrir programas. Use um SSD para o sistema e o HD para guardar arquivos.");

  const completa = Boolean(placa && cpu && cooler && ram && discos.length && gpu && fonte && gab);
  if (placa && cpu && ram && !discos.length) erros.push("Sem armazenamento: o computador liga e entra na BIOS, mas não tem onde instalar o sistema.");
  return { erros, avisos, consumo, recomendada, completa };
}

/** A ordem de montagem que se ensina em bancada (algumas etapas podem trocar de lugar; esta é a mais segura). */
export const ETAPAS = [
  "Pulseira antiestática no pulso e presa no gabinete; bancada limpa e seca",
  "Processador na placa-mãe, ainda fora do gabinete, alinhando o triângulo do canto",
  "Pasta térmica (um grão de ervilha no centro) e cooler, com o cabo no conector CPU_FAN",
  "Memórias nos slots indicados no manual, apertando até as travas fecharem",
  "SSD M.2 no encaixe, com o parafuso ou a trava",
  "Espelho traseiro e espaçadores no gabinete, só nos furos da placa",
  "Placa-mãe no gabinete, encaixada no espelho e parafusada",
  "Fonte no gabinete; cabo de 24 pinos na placa e o de 8 pinos do processador (EPS)",
  "Placa de vídeo no slot PCIe x16 de cima, com os cabos de energia",
  "Cabos do painel frontal (botão de ligar, reset, LED, USB e áudio), conferindo no manual",
  "Primeiro teste com a tampa aberta: liga, entra na BIOS e confere processador, memória e disco",
  "Organização dos cabos, tampa fechada e instalação do sistema",
];
