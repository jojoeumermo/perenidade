// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// As chamadas do acervo (frente 10D) ao banco (supabase/migracoes/20261116-alumia-o10-acervo.sql) e à rota dos arquivos do núcleo
// (app/api/rede/acervo/arquivo). Com NEXT_PUBLIC_ALUMIA_PREVIA=sim, um dublê na memória da aba (./exemplos): nada sai do aparelho.
import { BackendError, getClient } from "@/lib/backend";
import { chamar } from "@/lib/rede/cliente";
import { previaDaAlumiaLigada } from "@/lib/rede/conversa/exemplos";
import type { Post } from "@/lib/rede/tipos";
import { duble } from "./exemplos";
import { identificarArquivo, limparPdf, LIMITE_DO_ARQUIVO, type ExportacaoDaComunidade } from "./regras";
import type { ArquivoDoNucleo, Colecao, Doc, DocResumo, ListaDeArquivos, ListaDeColecoes, MesDoArquivo, QuemEditaAWiki, RegrasDaWiki, VersaoDoDoc } from "./tipos";

type Pagina<T> = { itens: T[]; proximo: string | null };

const c = <T>(funcao: string, argumentos: Record<string, unknown> = {}): Promise<T> => (previaDaAlumiaLigada() ? duble<T>(funcao, argumentos) : chamar<T>(funcao, argumentos));

export const acervo = {
  // Coleções.
  colecoes: (alvo: { slug?: string; handle?: string }) => c<ListaDeColecoes>("rede_acervo_colecoes", { p_slug: alvo.slug ?? null, p_handle: alvo.handle ?? null }),
  colecao: (id: string) => c<Colecao>("rede_acervo_colecao", { p_id: id }),
  salvarColecao: (id: string | null, slug: string | null, titulo: string, descricao: string) =>
    c<{ id: string; titulo: string; descricao: string }>("rede_acervo_colecao_salvar", { p_id: id, p_slug: slug, p_titulo: titulo, p_descricao: descricao }),
  apagarColecao: (id: string) => c<{ apagada: boolean }>("rede_acervo_colecao_apagar", { p_id: id }),
  porNaColecao: (id: string, post: string, sim: boolean, nota = "") => c<{ na_colecao: boolean }>("rede_acervo_colecao_por", { p_id: id, p_post: post, p_sim: sim, p_nota: nota }),
  ordenar: (id: string, posts: string[]) => c<{ ordem: string[] }>("rede_acervo_colecao_ordem", { p_id: id, p_posts: posts }),
  tirarMeu: (id: string, post: string) => c<{ na_colecao: boolean }>("rede_acervo_colecao_tirar_meu", { p_id: id, p_post: post }),
  sugerir: (id: string, post: string) => c<{ sugerido: boolean }>("rede_acervo_sugerir", { p_id: id, p_post: post }),
  descartar: (id: string, post: string) => c<{ descartada: boolean }>("rede_acervo_sugestao_descartar", { p_id: id, p_post: post }),

  // Documentos do núcleo.
  docs: (nucleo: string) => c<{ itens: DocResumo[]; media: boolean }>("rede_acervo_docs", { p_nucleo: nucleo }),
  doc: (id: string, versao: number | null = null) => c<Doc>("rede_acervo_doc", { p_id: id, p_versao: versao }),
  salvarDoc: (nucleo: string, id: string | null, titulo: string, corpo: string, resumo: string, base: number | null) =>
    c<{ id: string; versao: number }>("rede_acervo_doc_salvar", { p_nucleo: nucleo, p_id: id, p_titulo: titulo, p_corpo: corpo, p_resumo: resumo, p_base: base }),
  historicoDoDoc: (id: string) => c<{ media: boolean; versoes: VersaoDoDoc[] }>("rede_acervo_doc_historico", { p_id: id }),
  restaurarDoc: (id: string, versao: number) => c<{ id: string; versao: number }>("rede_acervo_doc_restaurar", { p_id: id, p_versao: versao }),
  apagarDoc: (id: string) => c<{ apagado: boolean }>("rede_acervo_doc_apagar", { p_id: id }),

  // Arquivos do núcleo (a lista; enviar, apagar e baixar estão abaixo).
  arquivos: (nucleo: string) => c<ListaDeArquivos>("rede_acervo_arquivos", { p_nucleo: nucleo }),

  // Arquivo por mês e exportar.
  meses: (slug: string) => c<{ comunidade: string; meses: MesDoArquivo[] }>("rede_acervo_meses", { p_slug: slug }),
  mes: (slug: string, mes: string, cursor: string | null = null) => c<Pagina<Post> & { mes: string }>("rede_acervo_mes", { p_slug: slug, p_mes: mes, p_cursor: cursor }),
  exportarPagina: (slug: string, cursor: string | null) => c<Partial<ExportacaoDaComunidade> & { posts: ExportacaoDaComunidade["posts"]; proximo: string | null }>("rede_acervo_exportar", { p_slug: slug, p_cursor: cursor }),

  // Busca dentro da comunidade: a busca de sempre com o operador "c:<slug>" (sem função nova no banco).
  buscar: (slug: string, q: string, cursor: string | null = null) =>
    c<{ itens: Post[]; proximo: string | null; fim_por_teto: boolean }>("rede_alumia_buscar", { p_q: `c:${slug} ${q}`.trim(), p_ordem: "novos", p_cursor: cursor, p_limite: 20 }),

  // Wiki.
  regrasDaWiki: (slug: string, pagina: string | null) => c<RegrasDaWiki>("rede_acervo_wiki_regras", { p_slug: slug, p_pagina: pagina }),
  quemEditaAWiki: (slug: string, quem: QuemEditaAWiki) => c<{ quem: QuemEditaAWiki }>("rede_acervo_wiki_quem", { p_slug: slug, p_quem: quem }),
  desfazerNaWiki: (slug: string, pagina: string) => c<{ pagina: string; versao: number }>("rede_acervo_wiki_desfazer", { p_slug: slug, p_pagina: pagina }),
};

/** Junta as páginas da exportação (até 200 páginas de 500 posts), avisando o andamento. */
export async function exportarComunidade(slug: string, aoAndar: (posts: number) => void): Promise<ExportacaoDaComunidade> {
  const primeira = await acervo.exportarPagina(slug, null);
  const tudo = { ...primeira, posts: [...primeira.posts] } as ExportacaoDaComunidade & { proximo?: string | null };
  let cursor = primeira.proximo;
  aoAndar(tudo.posts.length);
  for (let i = 0; cursor && i < 200; i++) {
    const r = await acervo.exportarPagina(slug, cursor);
    tudo.posts.push(...r.posts);
    cursor = r.proximo;
    aoAndar(tudo.posts.length);
  }
  delete tudo.proximo;
  return tudo;
}

/** Entrega um arquivo para a pessoa salvar (nada sai do aparelho além do que ela baixa). */
export function baixarArquivo(nome: string, conteudo: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function token(): Promise<string> {
  const supabase = await getClient();
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  if (!t) throw new BackendError("entre_primeiro");
  return t;
}

/** O código do motivo de um arquivo que não pode subir (a tela traduz). */
export type RecusaDoArquivo = "tipo" | "grande" | "pdf_comprimido" | "pdf_programa";

/** Confere e limpa no aparelho antes de enviar (o servidor confere e limpa de novo). Devolve os bytes limpos ou o motivo. */
export async function prepararArquivo(arquivo: File): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; motivo: RecusaDoArquivo }> {
  if (arquivo.size > LIMITE_DO_ARQUIVO) return { ok: false, motivo: "grande" };
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const id = identificarArquivo(bytes);
  if (!id) return { ok: false, motivo: "tipo" };
  if (id.ext === "pdf") {
    const limpo = limparPdf(bytes);
    if (!limpo.ok) return { ok: false, motivo: limpo.motivo === "anexo_ou_programa" ? "pdf_programa" : limpo.motivo === "comprimido" ? "pdf_comprimido" : "tipo" };
    return { ok: true, bytes: limpo.bytes };
  }
  const { limparImagem } = await import("@/lib/rede/publicar/midia");
  const limpa = limparImagem(bytes);
  return limpa ? { ok: true, bytes: limpa } : { ok: false, motivo: "tipo" };
}

/** Envia um arquivo já limpo para o núcleo. Devolve o arquivo e o código de desfazer (vale 15 minutos). */
export async function enviarArquivo(nucleo: string, nome: string, bytes: Uint8Array): Promise<{ arquivo: ArquivoDoNucleo; desfazer: string }> {
  if (previaDaAlumiaLigada()) return duble("acervo_enviar", { nucleo, nome, tamanho: bytes.length, ext: identificarArquivo(bytes)?.ext ?? "pdf" });
  const r = await fetch(`/api/rede/acervo/arquivo?nucleo=${encodeURIComponent(nucleo)}&nome=${encodeURIComponent(nome)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/octet-stream" },
    body: bytes as unknown as BodyInit,
  }).catch(() => {
    throw new BackendError("sem_conexao");
  });
  const corpo = (await r.json().catch(() => null)) as { erro?: string; arquivo?: ArquivoDoNucleo; desfazer?: string } | null;
  if (!r.ok || !corpo?.arquivo || !corpo.desfazer) throw new BackendError(corpo?.erro ?? "falha");
  return { arquivo: corpo.arquivo, desfazer: corpo.desfazer };
}

/** Apaga um arquivo (a mediação; ou quem enviou, com o código, nos 15 minutos). O servidor tira do depósito. */
export async function apagarArquivo(id: string, desfazer: string | null = null): Promise<void> {
  if (previaDaAlumiaLigada()) return duble("acervo_apagar", { id });
  const q = new URLSearchParams({ id, ...(desfazer ? { desfazer } : {}) });
  const r = await fetch(`/api/rede/acervo/arquivo?${q}`, { method: "DELETE", headers: { Authorization: `Bearer ${await token()}` } }).catch(() => {
    throw new BackendError("sem_conexao");
  });
  if (!r.ok) {
    const corpo = (await r.json().catch(() => null)) as { erro?: string } | null;
    throw new BackendError(corpo?.erro ?? "falha");
  }
}

/** O endereço assinado (60 segundos) para baixar um arquivo do núcleo, com o nome da lista. A regra do depósito decide. */
export async function enderecoParaBaixar(arquivo: ArquivoDoNucleo): Promise<string> {
  if (previaDaAlumiaLigada()) throw new BackendError("sem_servico");
  const supabase = await getClient();
  const nome = /\.(pdf|jpg|png|webp)$/i.test(arquivo.nome) ? arquivo.nome : `${arquivo.nome}.${arquivo.ext}`;
  const { data, error } = await supabase.storage.from("rede-acervo").createSignedUrl(arquivo.caminho, 60, { download: nome });
  if (error || !data) throw new BackendError("nao_encontrado");
  return data.signedUrl;
}
