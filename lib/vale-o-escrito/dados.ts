// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Vale o Escrito: leitura dos dados publicados em arquivo (content/vale-o-escrito/). Só o SERVIDOR importa este módulo,
// e só as páginas do observatório (app/[lang]/vale-o-escrito/...): ele lê o disco e NUNCA pode ser importado pelo layout
// raiz nem por componente de cliente (foi o que estourou o deploy de 45 minutos). Cada leitura escreve a pasta no
// próprio caminho, literal, para o rastreio de arquivos da Vercel não levar o projeto inteiro (scripts/conferir-rastreio.mjs).
//
// Formato (ESPEC, seção 4):
//   content/vale-o-escrito/dossies.json            { "dossies": Dossie[] }
//   content/vale-o-escrito/entradas/<slug>.json    ArquivoDeEntradas (um por dossiê)
//
// Entrada que não passa em regras.ts NÃO sai daqui: é descartada e o motivo vai para `descartadas` (o teste e o
// painel mostram). Melhor uma ficha a menos do que uma ficha sem fonte.

import fs from "node:fs";
import path from "node:path";
import { SLUGS_DOS_DOSSIES } from "./catalogo";
import { validarEntrada, validarLigacao, validarPessoa } from "./regras";
import type { ArquivoDeEntradas, Dossie, Entrada, Ligacao, Organizacao, PessoaPublica } from "./tipos";

const ler = <T>(leitura: () => string): T | null => {
  try {
    return JSON.parse(leitura()) as T;
  } catch {
    return null;
  }
};

/** Os dossiês, na ordem da coluna esquerda. */
export function lerDossies(): Dossie[] {
  const arquivo = ler<{ dossies: Dossie[] }>(() => fs.readFileSync(path.join(process.cwd(), "content", "vale-o-escrito", "dossies.json"), "utf8"));
  return [...(arquivo?.dossies ?? [])].sort((a, b) => a.ordem - b.ordem);
}

/** Um arquivo bruto de dossiê, sem conferir nada. Slug fora da lista cadastrada devolve null (nada de caminho solto). */
export function lerArquivoBruto(slug: string): ArquivoDeEntradas | null {
  if (!(SLUGS_DOS_DOSSIES as readonly string[]).includes(slug)) return null;
  return ler<ArquivoDeEntradas>(() => fs.readFileSync(path.join(process.cwd(), "content", "vale-o-escrito", "entradas", `${slug}.json`), "utf8"));
}

export interface DossieLido {
  dossie: string;
  pessoas: PessoaPublica[];
  organizacoes: Organizacao[];
  ligacoes: Ligacao[];
  entradas: Entrada[];
  /**
   * Entradas marcadas "pendente-curadoria" que passam nas regras (sem exigir o arquivo do Internet Archive, que só se
   * faz na aprovação). NÃO são publicadas: só a tela da curadoria e o teste as leem.
   */
  pendentes: Entrada[];
  /** Ligações das entradas pendentes (também não publicadas). */
  ligacoesPendentes: Ligacao[];
  /** O que foi descartado e por quê ("<id>: <erro>"). */
  descartadas: string[];
}

/** Lê um dossiê e deixa só o que passa nas regras. Pessoa inválida some junto com as entradas que dependem dela. */
export function lerDossie(slug: string): DossieLido {
  const bruto = lerArquivoBruto(slug);
  const vazio: DossieLido = { dossie: slug, pessoas: [], organizacoes: [], ligacoes: [], entradas: [], pendentes: [], ligacoesPendentes: [], descartadas: [] };
  if (!bruto) return vazio;
  return conferirArquivo(bruto);
}

/** A conferência do arquivo, separada da leitura para o teste usá-la com dados na memória. */
export function conferirArquivo(bruto: ArquivoDeEntradas): DossieLido {
  const descartadas: string[] = [];
  const pessoas = (bruto.pessoas ?? []).filter((p) => {
    const c = validarPessoa(p);
    if (!c.ok) descartadas.push(`pessoa ${p?.id}: ${c.erros.join("; ")}`);
    return c.ok;
  });
  const organizacoesTodas = bruto.organizacoes ?? [];
  const idsDeOrganizacoes = organizacoesTodas.map((o) => o.id);
  const ehPendente = (en: Entrada) => en?.revisao === "pendente-curadoria";
  const conferir = (en: Entrada, publicada: boolean) => {
    const c = validarEntrada(en, { publicada, pessoas, organizacoesIds: idsDeOrganizacoes });
    if (!c.ok) descartadas.push(`${en?.id}: ${c.erros.join("; ")}`);
    return c.ok && en.dossie === bruto.dossie;
  };
  // Pendente de curadoria NUNCA sai como publicada, mesmo que passe nas regras.
  const entradas = (bruto.entradas ?? []).filter((en) => !ehPendente(en) && conferir(en, true));
  const pendentes = (bruto.entradas ?? []).filter((en) => ehPendente(en) && conferir(en, false));
  const idsDeEntradas = new Set(entradas.map((x) => x.id));
  const fontesPorEntrada = new Map([...entradas, ...pendentes].map((x) => [x.id, x.fontes.map((f) => f.id)]));
  const idsDePendentes = new Set(pendentes.map((x) => x.id));
  const ligacoes: Ligacao[] = [];
  const ligacoesPendentes: Ligacao[] = [];
  for (const l of bruto.ligacoes ?? []) {
    const c = validarLigacao(l, fontesPorEntrada.get(l?.entradaId));
    if (c.ok && idsDeEntradas.has(l.entradaId)) ligacoes.push(l);
    else if (c.ok && idsDePendentes.has(l.entradaId)) ligacoesPendentes.push(l);
    else descartadas.push(`ligação ${l?.id}: ${c.erros.join("; ") || "entrada não publicada"}`);
  }
  // Quem só aparece em entrada pendente não é publicado (nem pessoa, nem organização).
  const usadasPorPublicadas = new Set(entradas.flatMap((x) => [...x.pessoas.map((p) => p.pessoaId), ...x.organizacoes]));
  const usadasPorPendentes = new Set(pendentes.flatMap((x) => [...x.pessoas.map((p) => p.pessoaId), ...x.organizacoes]));
  const soPendente = (id: string) => usadasPorPendentes.has(id) && !usadasPorPublicadas.has(id);
  return {
    dossie: bruto.dossie,
    pessoas: pessoas.filter((p) => !soPendente(p.id)),
    organizacoes: organizacoesTodas.filter((o) => !soPendente(o.id)),
    ligacoes,
    entradas,
    pendentes,
    ligacoesPendentes,
    descartadas,
  };
}

/** Todos os dossiês, cada um conferido. Resultado guardado na memória do servidor (os arquivos só mudam num deploy). */
let memoria: DossieLido[] | null = null;
export function lerTudo(): DossieLido[] {
  if (!memoria) memoria = SLUGS_DOS_DOSSIES.map((slug) => lerDossie(slug));
  return memoria;
}
