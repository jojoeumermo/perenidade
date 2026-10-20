// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O cartão de encaminhamento da vitrine Saúde Solidária, desenhado no próprio aparelho (canvas), na identidade do
// instituto: a faixa preta com a estrela, o fio vermelho, o papel e as letras do jornal. A pessoa baixa a imagem e manda
// ao profissional, que confirma que ela chegou pelo instituto. Nada sai do aparelho: nem o nome, nem o código.
import { site } from "@/lib/site";

export interface DadosDoCartao {
  profissional: string;
  descricao: string;
  quem: string;
  codigo: string;
  data: string;
}

const PAPEL = "#f4ecd8";
const TINTA = "#17130e";
const VINHO = "#7a1f1f";
const PRELO = "#c21f16";
const OURO = "#d4a24c";

/** As famílias de letra que a página já carregou (as mesmas do site), para o desenho sair com elas. */
function familias() {
  const css = getComputedStyle(document.documentElement);
  const ler = (nome: string, reserva: string) => `${css.getPropertyValue(nome).trim() || ""}${css.getPropertyValue(nome).trim() ? ", " : ""}${reserva}`;
  return { serif: ler("--font-serif-display", "Georgia, serif"), sans: ler("--font-ui", "Arial, sans-serif"), mono: ler("--font-archive", "monospace") };
}

function estrela(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, cor: string) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const raio = i % 2 === 0 ? r : r * 0.42;
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(x + raio * Math.cos(ang), y + raio * Math.sin(ang));
  }
  ctx.closePath();
  ctx.fillStyle = cor;
  ctx.fill();
}

/** Quebra o texto em linhas que cabem na largura. */
function linhas(ctx: CanvasRenderingContext2D, texto: string, largura: number) {
  const saida: string[] = [];
  let atual = "";
  for (const palavra of texto.split(/\s+/)) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (ctx.measureText(tentativa).width > largura && atual) {
      saida.push(atual);
      atual = palavra;
    } else atual = tentativa;
  }
  if (atual) saida.push(atual);
  return saida;
}

function carregar(src: string): Promise<HTMLImageElement | null> {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = src;
  });
}

/** Desenha o cartão (1080 × 1350, bom para o WhatsApp) e devolve a imagem PNG. */
export async function desenharCartao(d: DadosDoCartao): Promise<Blob> {
  await document.fonts?.ready;
  const f = familias();
  const L = 1080;
  const A = 1350;
  const c = document.createElement("canvas");
  c.width = L;
  c.height = A;
  const ctx = c.getContext("2d")!;

  // Papel e moldura dupla.
  ctx.fillStyle = PAPEL;
  ctx.fillRect(0, 0, L, A);
  ctx.strokeStyle = TINTA;
  ctx.lineWidth = 6;
  ctx.strokeRect(36, 36, L - 72, A - 72);
  ctx.lineWidth = 2;
  ctx.strokeRect(52, 52, L - 104, A - 104);

  // A faixa preta com a estrela e o nome do instituto; o fio vermelho embaixo.
  ctx.fillStyle = TINTA;
  ctx.fillRect(52, 52, L - 104, 200);
  ctx.fillStyle = PRELO;
  ctx.fillRect(52, 252, L - 104, 14);
  estrela(ctx, 140, 152, 52, OURO);
  ctx.fillStyle = PAPEL;
  ctx.font = `900 italic 64px ${f.sans}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(site.name.toUpperCase(), 215, 160);
  ctx.fillStyle = OURO;
  ctx.font = `500 26px ${f.mono}`;
  ctx.fillText("SAÚDE SOLIDÁRIA · CARTÃO DE ENCAMINHAMENTO", 218, 210);
  const marca = await carregar("/marca.png");
  if (marca) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(L - 150, 152, 62, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(marca, L - 212, 90, 124, 124);
    ctx.restore();
  }

  // A saudação ao profissional.
  ctx.fillStyle = VINHO;
  ctx.font = `500 26px ${f.mono}`;
  ctx.fillText("PARA APRESENTAR AO PROFISSIONAL", 110, 345);
  ctx.fillStyle = TINTA;
  ctx.font = `600 84px ${f.serif}`;
  ctx.fillText(`Olá, ${d.profissional.split(/\s+/)[0]}!`, 104, 440);
  ctx.font = `400 38px ${f.serif}`;
  let y = 505;
  for (const l of linhas(ctx, "Esta pessoa chegou até você pela vitrine Saúde Solidária do Instituto Lúcia.", L - 220)) {
    ctx.fillText(l, 108, y);
    y += 50;
  }

  // As linhas do cartão, como numa ficha: o profissional; depois quem chega e a data, lado a lado.
  const fio = (altura: number) => {
    ctx.strokeStyle = "rgba(23,19,14,0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(108, altura);
    ctx.lineTo(L - 108, altura);
    ctx.stroke();
  };
  const rotulo = (texto: string, x: number, altura: number) => {
    ctx.fillStyle = VINHO;
    ctx.font = `500 22px ${f.mono}`;
    ctx.fillText(texto.toUpperCase(), x, altura);
  };
  y += 10;
  fio(y);
  rotulo("Profissional", 108, y + 36);
  ctx.fillStyle = TINTA;
  ctx.font = `600 46px ${f.serif}`;
  ctx.fillText(d.profissional, 108, y + 92);
  ctx.font = `400 30px ${f.sans}`;
  y += 140;
  for (const l of linhas(ctx, d.descricao, L - 220)) {
    ctx.fillText(l, 108, y);
    y += 40;
  }
  y += 14;
  fio(y);
  rotulo("Quem chega", 108, y + 36);
  rotulo("Data", L / 2 + 20, y + 36);
  ctx.fillStyle = TINTA;
  ctx.font = `600 42px ${f.serif}`;
  ctx.fillText(d.quem || "—", 108, y + 90);
  ctx.fillText(d.data, L / 2 + 20, y + 90);
  y += 120;
  fio(y);

  // O código, como um carimbo.
  ctx.save();
  ctx.translate(L / 2, Math.min(y + 110, A - 300));
  ctx.rotate(-0.025);
  ctx.strokeStyle = PRELO;
  ctx.lineWidth = 6;
  ctx.strokeRect(-380, -70, 760, 140);
  ctx.lineWidth = 2;
  ctx.strokeRect(-366, -56, 732, 112);
  ctx.fillStyle = PRELO;
  ctx.textAlign = "center";
  ctx.font = `500 22px ${f.mono}`;
  ctx.fillText("CÓDIGO DO ENCAMINHAMENTO", 0, -18);
  ctx.font = `500 46px ${f.mono}`;
  ctx.fillText(d.codigo, 0, 36);
  ctx.restore();

  // O rodapé, com o que o cartão é e o que não é.
  ctx.textAlign = "left";
  ctx.fillStyle = "#4a4032";
  ctx.font = `400 25px ${f.sans}`;
  y = A - 190;
  for (const l of linhas(ctx, "O instituto não intermedeia nem acompanha o atendimento: o cartão só ajuda o profissional a contar quantas pessoas chegaram pela parceria. Não é serviço de emergência: SAMU 192 · CVV 188.", L - 220)) {
    ctx.fillText(l, 108, y);
    y += 34;
  }
  ctx.fillStyle = TINTA;
  ctx.font = `500 24px ${f.mono}`;
  ctx.fillText(`${site.url.replace(/^https?:\/\//, "")}/saude`, 108, A - 78);

  return new Promise((ok, falha) => c.toBlob((b) => (b ? ok(b) : falha(new Error("cartao"))), "image/png"));
}
