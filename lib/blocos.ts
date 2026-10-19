// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// O editor por blocos lê e escreve o Markdown de sempre. Este arquivo é a parte pura (sem React), para o
// roteiro de conferência (npm run testar:blocos) rodar direto no Node. Sem os atalhos "@/" de propósito.
import { eInterativo } from "./interativos";

export type Tipo = "paragrafo" | "titulo" | "subtitulo" | "lista" | "numerada" | "citacao" | "imagem" | "video" | "formula" | "conta" | "questao" | "codigo" | "anexo" | "tabela" | "interativo" | "bruto";
/** Corta o Markdown em blocos: linhas em branco separam; cercas de código e fórmulas em bloco ficam inteiras; títulos são sempre um bloco só. */
export function partir(md: string): string[] {
  const linhas = md.replace(/\r\n?/g, "\n").split("\n");
  const blocos: string[] = [];
  let atual: string[] = [];
  const fechar = () => {
    if (atual.length) blocos.push(atual.join("\n"));
    atual = [];
  };
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const cerca = /^\s*(`{3,}|~{3,})/.exec(linha);
    if (cerca) {
      fechar();
      const marca = cerca[1];
      const grupo = [linha];
      while (++i < linhas.length) {
        grupo.push(linhas[i]);
        if (linhas[i].trim().startsWith(marca) && linhas[i].trim().replace(/[`~]/g, "") === "") break;
      }
      blocos.push(grupo.join("\n"));
      continue;
    }
    if (linha.trim() === "$$") {
      fechar();
      const grupo = [linha];
      while (++i < linhas.length) {
        grupo.push(linhas[i]);
        if (linhas[i].trim() === "$$") break;
      }
      blocos.push(grupo.join("\n"));
      continue;
    }
    if (linha.trim() === "") {
      fechar();
      continue;
    }
    if (/^#{1,6}\s/.test(linha)) {
      fechar();
      blocos.push(linha);
      continue;
    }
    atual.push(linha);
  }
  fechar();
  return blocos;
}

export function tipoDe(md: string): Tipo {
  const linhas = md.split("\n");
  const cerca = /^```\s*([\w-]*)/.exec(md);
  if (cerca) {
    const lingua = cerca[1];
    if (lingua === "video") return "video";
    if (lingua === "verificar") return "questao";
    if (lingua === "conta") return "conta";
    if (lingua === "pauta" || lingua === "teclado") return "bruto";
    if (eInterativo(lingua)) return "interativo";
    return "codigo";
  }
  if (/^~~~/.test(md)) return "bruto";
  if (md.trim().startsWith("$$")) return "formula";
  if (/^###\s/.test(md)) return "subtitulo";
  if (/^##?\s/.test(md)) return "titulo";
  if (/^#{4,6}\s/.test(md)) return "bruto";
  if (linhas.every((l) => /^>\s?/.test(l))) return "citacao";
  if (linhas.every((l) => /^[-*+] /.test(l))) return "lista";
  if (linhas.every((l) => /^\d+[.)] /.test(l))) return "numerada";
  if (linhas.length === 1 && /^!\[[^\]]*\]\([^)]*\)$/.test(md)) return "imagem";
  if (linhas.length === 1 && /^\[📎[^\]]*\]\([^)\s]*\)$/.test(md)) return "anexo";
  if (linhas.every((l) => l.trim().startsWith("|"))) return "tabela";
  if (linhas.some((l) => /^\s+[-*+\d]/.test(l))) return "bruto";
  return "paragrafo";
}

/** O texto "puro" de um bloco de texto, sem as marcas da linha (para trocar o tipo sem perder o conteúdo). */
export function textoPuro(md: string): string {
  return md
    .split("\n")
    .map((l) => l.replace(/^(#{1,6}\s|>\s?|[-*+]\s|\d+[.)]\s)/, ""))
    .join("\n");
}
export function comMarcas(tipo: Tipo, texto: string): string {
  const linhas = texto.split("\n");
  switch (tipo) {
    case "titulo":
      return `## ${texto.replace(/\n+/g, " ")}`;
    case "subtitulo":
      return `### ${texto.replace(/\n+/g, " ")}`;
    case "lista":
      return linhas.map((l) => `- ${l}`).join("\n");
    case "numerada":
      return linhas.map((l, i) => `${i + 1}. ${l}`).join("\n");
    case "citacao":
      return linhas.map((l) => `> ${l}`).join("\n");
    default:
      return texto;
  }
}

/** O miolo de uma cerca (sem a primeira e a última linha). */
export function miolo(md: string): string {
  const linhas = md.split("\n");
  const fecha = linhas.length > 1 && /^\s*(`{3,}|~{3,}|\$\$)\s*$/.test(linhas[linhas.length - 1]);
  return linhas.slice(1, fecha ? -1 : undefined).join("\n");
}
