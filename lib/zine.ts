// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import QRCode from "qrcode";

// O que a zine da aula e o kit do núcleo tiram do texto da aula: os blocos de sala (a provocação, a roda, o "leve para a
// sua comunidade") e o começo de cada seção, em texto simples, para caber numa folha impressa.

/** O conteúdo de um bloco de sala (```provocacao, ```roda, ```leve…), sem os marcadores de lista. */
export function blocoDaAula(body: string, nome: string): string[] {
  const achado = new RegExp("```" + nome + "\\s*\\n([\\s\\S]*?)```").exec(body);
  if (!achado) return [];
  return achado[1]
    .split("\n")
    .map((linha) => textoSimples(linha.replace(/^\s*[-*]\s+/, "")))
    .filter(Boolean);
}

/** Markdown em texto corrido: sem links, ênfases, imagens, código nem citações. */
export function textoSimples(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(\*|_)(.+?)\1/g, "$2")
    .replace(/^\s*>\s?/gm, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Corta no fim de uma frase (ou de uma palavra) antes do limite. */
export function cortar(texto: string, limite: number): string {
  if (texto.length <= limite) return texto;
  const pedaco = texto.slice(0, limite);
  const frase = Math.max(pedaco.lastIndexOf(". "), pedaco.lastIndexOf("? "), pedaco.lastIndexOf("! "));
  return frase > limite * 0.5 ? pedaco.slice(0, frase + 1) : `${pedaco.slice(0, pedaco.lastIndexOf(" "))}…`;
}

/** As seções da aula (## título) com o primeiro parágrafo de cada uma, deixando de fora blocos de código e listas. */
export function secoesDaAula(body: string): { titulo: string; texto: string }[] {
  const semBlocos = body.replace(/```[\s\S]*?```/g, "");
  const partes = semBlocos.split(/^## /m).slice(1);
  return partes
    .map((parte) => {
      const [primeira, ...resto] = parte.split("\n");
      // Parágrafos e itens de lista, na ordem, até encher o quadro (tabelas, imagens e subtítulos ficam de fora).
      let texto = "";
      for (const bloco of resto.join("\n").split(/\n\s*\n/).map((p) => p.trim())) {
        if (!bloco || /^(#|\||!\[)/.test(bloco)) continue;
        const limpo = /^([-*] |\d+\. )/.test(bloco)
          ? bloco.split("\n").map((linha) => `• ${textoSimples(linha.replace(/^\s*([-*]|\d+\.)\s+/, ""))}`).join(" ")
          : textoSimples(bloco);
        texto = texto ? `${texto} ${limpo}` : limpo;
        if (texto.length >= 480) break;
      }
      return { titulo: textoSimples(primeira), texto };
    })
    .filter((s) => s.titulo && s.texto);
}

/** O QR de um endereço, em SVG pronto para pôr na página (gerado no servidor, na montagem do site). */
export async function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 0, color: { dark: "#17130e", light: "#0000" } });
}
