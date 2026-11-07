// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Vale o Escrito: conferência e importação dos lotes de casos novos (content/vale-o-escrito/novos-casos/<recorte>.json),
// pesquisados pela equipe (ou por agente) e ainda NÃO publicados. Lógica pura, sem disco e sem "@/": quem lê e grava é
// scripts/vale-o-escrito/importar-novos-casos.mjs; o teste (scripts/testar-vale-o-escrito.mjs) usa as mesmas funções.
//
// Regra da coordenação (05/11/2026): só vai ao ar caso com FONTE OFICIAL (fonte primária: processo, investigação oficial
// ou dado oficial) e SITUAÇÃO JURÍDICA preenchidas. Duplicata se reconhece pelo id e pelo LINK da fonte: o mesmo link já
// usado por outra entrada (publicada, pendente ou de outro lote) barra a entrada nova, para a curadoria mesclar à mão.

import { conferirArquivo } from "./dados";
import type { DocumentoDeEntrada } from "./curadoria";
import { fontePrimaria } from "./regras";
import { SITUACOES, type ArquivoDeEntradas, type Entrada } from "./tipos";

/** Link comparável: sem "www.", sem barra final, sem âncora, sem parâmetros de rastreio, protocolo e caixa do domínio iguais. */
export function linkComparavel(url: string): string {
  try {
    const u = new URL(url.trim());
    u.hash = "";
    for (const p of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ori$)/i.test(p)) u.searchParams.delete(p);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    return `${host}${u.pathname.replace(/\/+$/, "")}${u.search}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

/** A entrada cumpre a regra da coordenação para ir ao ar? (fonte oficial e situação jurídica) */
export function temFonteOficialESituacao(en: Entrada): boolean {
  return (SITUACOES as readonly string[]).includes(en?.situacao) && Array.isArray(en?.fontes) && en.fontes.some(fontePrimaria);
}

export interface ResultadoDoLote {
  /** Entradas que passam nas regras, na regra da coordenação e não repetem id nem link. */
  aceitas: Entrada[];
  /** "<id>: <motivo>" de cada entrada barrada (regra, fonte oficial, duplicata). */
  barradas: string[];
  /** Ids que já estão nos arquivos de entradas (importados antes): nem aceitos de novo, nem erro. */
  jaImportadas: string[];
}

/**
 * Confere um lote contra o que já existe. `existentes` são os arquivos de content/vale-o-escrito/entradas/ (publicadas e
 * pendentes) e os lotes já conferidos antes deste; cada entrada aceita entra no conjunto para os próximos lotes.
 */
export function conferirLote(lote: ArquivoDeEntradas, existentes: readonly ArquivoDeEntradas[], vistos?: { ids: Set<string>; links: Map<string, string> }): ResultadoDoLote {
  const conhecidos = vistos ?? indiceDeExistentes(existentes);
  const barradas: string[] = [];
  const aceitas: Entrada[] = [];
  const jaImportadas: string[] = [];
  // Conferência como no site: pendente-curadoria passa sem o arquivo do Internet Archive; aprovada precisa dele.
  const lido = conferirArquivo(lote);
  barradas.push(...lido.descartadas);
  const validas = new Set([...lido.entradas, ...lido.pendentes].map((e) => e.id));
  for (const en of lote.entradas ?? []) {
    if (!validas.has(en?.id)) continue;
    if (!temFonteOficialESituacao(en)) {
      barradas.push(`${en.id}: falta fonte oficial (processo, investigação oficial ou dado oficial) ou situação jurídica`);
      continue;
    }
    if (conhecidos.ids.has(en.id)) {
      jaImportadas.push(en.id);
      continue;
    }
    const repetido = en.fontes.map((f) => [f.url, conhecidos.links.get(linkComparavel(f.url))] as const).find(([, dono]) => dono && dono !== en.id);
    if (repetido) {
      barradas.push(`${en.id}: o link ${repetido[0]} já é fonte de ${repetido[1]} (duplicata: mesclar na curadoria)`);
      continue;
    }
    conhecidos.ids.add(en.id);
    for (const f of en.fontes) conhecidos.links.set(linkComparavel(f.url), en.id);
    aceitas.push(en);
  }
  return { aceitas, barradas, jaImportadas };
}

/** Ids e links (comparáveis) de todas as entradas dos arquivos dados. */
export function indiceDeExistentes(arquivos: readonly ArquivoDeEntradas[]): { ids: Set<string>; links: Map<string, string> } {
  const ids = new Set<string>();
  const links = new Map<string, string>();
  for (const a of arquivos)
    for (const en of a?.entradas ?? []) {
      ids.add(en.id);
      for (const f of en.fontes ?? []) if (typeof f?.url === "string" && !links.has(linkComparavel(f.url))) links.set(linkComparavel(f.url), en.id);
    }
  return { ids, links };
}

/**
 * O documento de uma entrada do lote para a fila da curadoria (interno.vale_fila.rascunho): a Entrada mais as pessoas,
 * organizações e ligações dela, do jeito que o editor do painel abre e o exportador separa (DocumentoDeEntrada).
 */
export function documentoDaEntrada(lote: ArquivoDeEntradas, en: Entrada): DocumentoDeEntrada {
  const idsDePessoas = new Set(en.pessoas.map((p) => p.pessoaId));
  const idsDeOrganizacoes = new Set(en.organizacoes);
  return {
    ...en,
    pessoasPublicas: (lote.pessoas ?? []).filter((p) => idsDePessoas.has(p.id)),
    organizacoesPublicas: (lote.organizacoes ?? []).filter((o) => idsDeOrganizacoes.has(o.id)),
    ligacoes: (lote.ligacoes ?? []).filter((l) => l.entradaId === en.id),
  };
}

/**
 * Junta as entradas aceitas ao arquivo do dossiê (content/vale-o-escrito/entradas/<slug>.json), com as pessoas,
 * organizações e ligações delas. Não troca nada do que já existe; pessoa ou organização com o mesmo id e outro nome barra
 * a junção (devolve o motivo), para não ligar um caso à pessoa errada.
 */
export function juntarAoArquivo(base: ArquivoDeEntradas, lote: ArquivoDeEntradas, aceitas: readonly Entrada[]): { arquivo: ArquivoDeEntradas; conflitos: string[] } {
  const arquivo: ArquivoDeEntradas = {
    dossie: base.dossie,
    pessoas: [...(base.pessoas ?? [])],
    organizacoes: [...(base.organizacoes ?? [])],
    ligacoes: [...(base.ligacoes ?? [])],
    entradas: [...(base.entradas ?? [])],
  };
  const conflitos: string[] = [];
  for (const en of aceitas) {
    if (en.dossie !== base.dossie) {
      conflitos.push(`${en.id}: é do dossiê ${en.dossie}, não de ${base.dossie}`);
      continue;
    }
    const doc = documentoDaEntrada(lote, en);
    const choque = [
      ...(doc.pessoasPublicas ?? []).map((p) => [p, arquivo.pessoas.find((x) => x.id === p.id)] as const),
      ...(doc.organizacoesPublicas ?? []).map((o) => [o, arquivo.organizacoes.find((x) => x.id === o.id)] as const),
    ].find(([novo, velho]) => velho && velho.nome !== novo.nome);
    if (choque) {
      conflitos.push(`${en.id}: o id ${choque[0].id} já é de "${choque[1]!.nome}" no arquivo do dossiê`);
      continue;
    }
    for (const p of doc.pessoasPublicas ?? []) if (!arquivo.pessoas.some((x) => x.id === p.id)) arquivo.pessoas.push(p);
    for (const o of doc.organizacoesPublicas ?? []) if (!arquivo.organizacoes.some((x) => x.id === o.id)) arquivo.organizacoes.push(o);
    for (const l of doc.ligacoes ?? []) if (!arquivo.ligacoes.some((x) => x.id === l.id)) arquivo.ligacoes.push(l);
    arquivo.entradas.push(en);
  }
  return { arquivo, conflitos };
}

/** Texto SQL entre aspas simples, com $ e aspas escapados pelo dollar-quoting com etiqueta própria. */
const literalJson = (valor: unknown): string => {
  const texto = JSON.stringify(valor);
  let etiqueta = "vale";
  while (texto.includes(`$${etiqueta}$`)) etiqueta += "x";
  return `$${etiqueta}$${texto}$${etiqueta}$::jsonb`;
};

/**
 * SQL que põe as entradas na FILA da curadoria (interno.vale_fila, origem 'equipe'), o mesmo caminho do "entrada manual"
 * do painel: a curadoria abre, relê a fonte, arquiva no Internet Archive e aprova (vale_fila_decidir confere de novo com
 * interno.vale_doc_ok). Não duplica: pula o id que já está em vale_entradas ou num rascunho da fila ainda aberto.
 * Rodar no SQL Editor do Supabase (o editor roda como dono do banco; nada de chave em arquivo).
 */
export function sqlDaFila(docs: readonly DocumentoDeEntrada[], origemDoLote: string): string {
  const linhas = [
    `-- Vale o Escrito: casos novos para a fila da curadoria (${origemDoLote}). Gerado por scripts/vale-o-escrito/importar-novos-casos.mjs.`,
    "-- Não publica nada: cada caso entra como pendente na fila e só vai ao ar quando a curadoria aprovar no painel.",
    "begin;",
  ];
  for (const doc of docs) {
    const id = doc.id.replace(/'/g, "''");
    linhas.push(
      `insert into interno.vale_fila (origem, rascunho)`,
      `select 'equipe', ${literalJson(doc)}`,
      `where not exists (select 1 from interno.vale_entradas where id = '${id}')`,
      `  and not exists (select 1 from interno.vale_fila where rascunho ->> 'id' = '${id}' and estado in ('pendente', 'em_revisao', 'devolvida'));`,
    );
  }
  linhas.push("commit;", "");
  return linhas.join("\n");
}
