// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { getClient } from "./backend";

// Gaveta Aberta: trabalhos de estudantes publicados por quem os fez, sob licença livre. O nome da seção mora só nos
// textos (i18n "drawer" e o painel): trocar o nome não mexe em nada daqui.

/** A versão do termo de cessão em vigor (content/paginas/gaveta-termo.md). Mudou o termo? Mude aqui e no banco. */
export const TERMO_VERSAO = "1";

export const tiposDeTrabalho = ["tcc", "monografia", "dissertacao", "artigo", "projeto", "relatorio", "apostila", "codigo", "apresentacao", "outro"] as const;
export type TipoDeTrabalho = (typeof tiposDeTrabalho)[number];

export const licencasDaGaveta = ["CC BY 4.0", "CC BY-SA 4.0", "CC0 1.0"] as const;
export type LicencaDaGaveta = (typeof licencasDaGaveta)[number];

/** O texto oficial de cada licença, em português. */
export const enderecoDaLicenca: Record<LicencaDaGaveta, string> = {
  "CC BY 4.0": "https://creativecommons.org/licenses/by/4.0/deed.pt-br",
  "CC BY-SA 4.0": "https://creativecommons.org/licenses/by-sa/4.0/deed.pt-br",
  "CC0 1.0": "https://creativecommons.org/publicdomain/zero/1.0/deed.pt-br",
};

export interface Trabalho {
  id: string;
  titulo: string;
  tipo: TipoDeTrabalho;
  disciplina: string;
  curso: string;
  instituicao: string;
  ano: number | null;
  comentario: string;
  link: string;
  arquivo: string;
  licenca: LicencaDaGaveta;
  credito: string;
  publicado_em: string | null;
  // Só nas listas de quem publicou e da equipe:
  status?: "pendente" | "aprovado" | "recusado" | "retirado";
  nota?: string;
  criado_em?: string;
  autor?: string;
  termo_nome?: string;
  termo_versao?: string;
  termo_em?: string;
  decidido_por?: string;
}

const DEPOSITO = "gaveta";
export const PDF_MAXIMO = 10 * 1024 * 1024;

export class ErroDaGaveta extends Error {}

/** Confere pelos primeiros bytes que o arquivo é mesmo um PDF, e o tamanho, antes de mandar qualquer coisa. */
export async function pdfValido(arquivo: File): Promise<boolean> {
  if (arquivo.size === 0 || arquivo.size > PDF_MAXIMO) return false;
  const cabeca = new Uint8Array(await arquivo.slice(0, 5).arrayBuffer());
  return String.fromCharCode(...cabeca) === "%PDF-";
}

/** Envia o PDF para a pasta da própria pessoa, com um nome sorteado (o nome original do arquivo não sai do aparelho). */
export async function enviarPdf(arquivo: File): Promise<string> {
  if (!(await pdfValido(arquivo))) throw new ErroDaGaveta("formato");
  const supabase = await getClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new ErroDaGaveta("sessao");
  const caminho = `${data.user.id}/${crypto.randomUUID()}.pdf`;
  const { error } = await supabase.storage.from(DEPOSITO).upload(caminho, arquivo, { contentType: "application/pdf", upsert: false });
  if (error) throw new ErroDaGaveta("envio");
  return caminho;
}

/** Baixa o PDF (público depois de aprovado; antes, só a própria pessoa e a equipe que decide) como um endereço local temporário. */
export async function baixarPdf(caminho: string): Promise<string> {
  const supabase = await getClient();
  const { data, error } = await supabase.storage.from(DEPOSITO).download(caminho);
  if (error || !data) throw new ErroDaGaveta("leitura");
  return URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
}

/** Apaga o PDF do depósito (quem publicou, ao tirar a ficha do ar). Falha aqui não é grave: a ficha já saiu do ar. */
export async function apagarPdf(caminho: string): Promise<void> {
  try {
    const supabase = await getClient();
    await supabase.storage.from(DEPOSITO).remove([caminho]);
  } catch {
    // o arquivo fica até a equipe apagar; a ficha já não aparece
  }
}

/** Um nome de arquivo legível para quem baixa: o título sem acentos nem símbolos. */
export function nomeDoArquivo(titulo: string): string {
  const base = titulo
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base || "trabalho"}.pdf`;
}
