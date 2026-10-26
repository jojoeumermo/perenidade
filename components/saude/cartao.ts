// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O cartão de encaminhamento do Mural de Saúde, desenhado no próprio aparelho (canvas), na variante NEUTRA da
// identidade (papel bege, tinta escura, as letras do site): sem estrela, sem vermelho, sem marca nem lema do instituto,
// porque o mural é independente das posições dele. A pessoa baixa a imagem e manda ao profissional, que confirma que
// ela encontrou o contato no mural. Nada sai do aparelho: nem o nome, nem o código.
import { NOME_VITRINE } from "@/lib/mural-saude";
import { site } from "@/lib/site";

export interface DadosDoCartao {
  profissional: string;
  descricao: string;
  quem: string;
  codigo: string;
  data: string;
}

const PAPEL = "#F4EBDB";
const TINTA = "#221C17";
const SUAVE = "#5a4f45";

/** As famílias de letra que a página já carregou (as mesmas do site), para o desenho sair com elas. */
function familias() {
  const css = getComputedStyle(document.documentElement);
  const ler = (nome: string, reserva: string) => `${css.getPropertyValue(nome).trim() || ""}${css.getPropertyValue(nome).trim() ? ", " : ""}${reserva}`;
  return { serif: ler("--font-serif-display", "Georgia, serif"), sans: ler("--font-ui", "Arial, sans-serif"), mono: ler("--font-archive", "monospace") };
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

  // Papel e uma moldura fina.
  ctx.fillStyle = PAPEL;
  ctx.fillRect(0, 0, L, A);
  ctx.strokeStyle = TINTA;
  ctx.lineWidth = 3;
  ctx.strokeRect(48, 48, L - 96, A - 96);

  // O cabeçalho: o nome do mural e o que o cartão é, sobre um fio fino.
  ctx.fillStyle = TINTA;
  ctx.textBaseline = "alphabetic";
  ctx.font = `600 64px ${f.serif}`;
  ctx.fillText(NOME_VITRINE, 104, 170);
  ctx.fillStyle = SUAVE;
  ctx.font = `500 26px ${f.mono}`;
  ctx.fillText("CARTÃO DE ENCAMINHAMENTO", 108, 220);
  ctx.fillStyle = TINTA;
  ctx.fillRect(104, 252, L - 208, 2);

  // A saudação ao profissional.
  ctx.fillStyle = SUAVE;
  ctx.font = `500 26px ${f.mono}`;
  ctx.fillText("PARA APRESENTAR AO PROFISSIONAL", 108, 345);
  ctx.fillStyle = TINTA;
  ctx.font = `600 84px ${f.serif}`;
  ctx.fillText(`Olá, ${d.profissional.split(/\s+/)[0]}!`, 104, 440);
  ctx.font = `400 38px ${f.serif}`;
  let y = 505;
  for (const l of linhas(ctx, `Esta pessoa encontrou o seu contato no ${NOME_VITRINE} do ${site.name}.`, L - 220)) {
    ctx.fillText(l, 108, y);
    y += 50;
  }

  // As linhas do cartão, como numa ficha: o profissional; depois quem chega e a data, lado a lado.
  const fio = (altura: number) => {
    ctx.strokeStyle = "rgba(34,28,23,0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(108, altura);
    ctx.lineTo(L - 108, altura);
    ctx.stroke();
  };
  const rotulo = (texto: string, x: number, altura: number) => {
    ctx.fillStyle = SUAVE;
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

  // O código, numa caixa simples.
  ctx.save();
  ctx.translate(L / 2, Math.min(y + 110, A - 300));
  ctx.strokeStyle = TINTA;
  ctx.lineWidth = 3;
  ctx.strokeRect(-380, -70, 760, 140);
  ctx.fillStyle = TINTA;
  ctx.textAlign = "center";
  ctx.font = `500 22px ${f.mono}`;
  ctx.fillText("CÓDIGO DO ENCAMINHAMENTO", 0, -18);
  ctx.font = `500 46px ${f.mono}`;
  ctx.fillText(d.codigo, 0, 36);
  ctx.restore();

  // O rodapé, com o que o cartão é e o que não é.
  ctx.textAlign = "left";
  ctx.fillStyle = SUAVE;
  ctx.font = `400 25px ${f.sans}`;
  y = A - 190;
  for (const l of linhas(ctx, "O instituto apenas divulga contatos: não indica, não intermedeia nem acompanha o atendimento. O cartão só ajuda o profissional a saber como a pessoa o encontrou. Não é serviço de emergência: SAMU 192 · CVV 188.", L - 220)) {
    ctx.fillText(l, 108, y);
    y += 34;
  }
  ctx.fillStyle = TINTA;
  ctx.font = `500 24px ${f.mono}`;
  ctx.fillText(`${site.url.replace(/^https?:\/\//, "")}/saude`, 108, A - 78);

  return new Promise((ok, falha) => c.toBlob((b) => (b ? ok(b) : falha(new Error("cartao"))), "image/png"));
}
