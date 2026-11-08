// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Vale o Escrito: os casos publicados no banco (public.vale_publicadas), juntados aos arquivos de content/vale-o-escrito/.
// SÓ O SERVIDOR importa este módulo (ele chama dados.ts, que lê o disco). Sem "@/" (roda no Node nos testes).
//
// Regras:
//   - Cada linha do banco é conferida: formato (id, dossiê cadastrado, doc com o mesmo id e dossiê) e depois as MESMAS
//     regras dos arquivos (conferirArquivo). Linha inválida é descartada; a página nunca quebra por causa dela.
//   - Quando o mesmo id existe no arquivo e no banco, vale o do banco (é o que a curadoria aprovou por último).
//   - Banco fora do ar, lento (mais de 5 s), sem variáveis de ambiente ou com resposta estranha: valem só os arquivos.
//   - A resposta é guardada por 300 s: na memória do processo (cache() do React não guarda entre requisições em rotas) e
//     no cache de dados do Next (fetch com next.revalidate), que também faz a página ser refeita a cada 5 minutos.

import { SLUGS_DOS_DOSSIES } from "./catalogo";
import { docPublico, type DocumentoDeEntrada } from "./curadoria";
import { conferirArquivo, lerArquivoBruto, lerTudo, type DossieLido } from "./dados";
import type { ArquivoDeEntradas, Ligacao, Organizacao, PessoaPublica } from "./tipos";

export const SEGUNDOS_DO_BANCO = 300;
const PRAZO_DA_RESPOSTA_MS = 5000;
const ID_VALIDO = /^[a-z0-9][a-z0-9-]{1,79}$/;

/** O formato de cada item de public.vale_publicadas(). */
export interface LinhaPublicada {
  id: string;
  dossie: string;
  doc: DocumentoDeEntrada;
}

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Confere só o formato de uma linha (o conteúdo passa depois pelas regras de regras.ts). Devolve a linha tipada ou o
 * motivo do descarte.
 */
export function conferirLinha(bruta: unknown): { ok: true; linha: LinhaPublicada } | { ok: false; motivo: string } {
  if (!ehObjeto(bruta)) return { ok: false, motivo: "linha não é objeto" };
  const { id, dossie, doc } = bruta;
  if (typeof id !== "string" || !ID_VALIDO.test(id)) return { ok: false, motivo: "id inválido" };
  if (typeof dossie !== "string" || !(SLUGS_DOS_DOSSIES as readonly string[]).includes(dossie)) return { ok: false, motivo: `${id}: dossiê desconhecido` };
  if (!ehObjeto(doc)) return { ok: false, motivo: `${id}: sem documento` };
  if (doc.id !== id) return { ok: false, motivo: `${id}: id diferente do documento` };
  if (doc.dossie !== dossie) return { ok: false, motivo: `${id}: dossiê diferente do documento` };
  if (typeof doc.titulo !== "string" || !Array.isArray(doc.fontes) || !Array.isArray(doc.pessoas) || !Array.isArray(doc.organizacoes)) {
    return { ok: false, motivo: `${id}: documento fora do formato` };
  }
  for (const campo of ["pessoasPublicas", "organizacoesPublicas", "ligacoes"] as const) {
    if (doc[campo] !== undefined && !Array.isArray(doc[campo])) return { ok: false, motivo: `${id}: ${campo} fora do formato` };
  }
  return { ok: true, linha: { id, dossie, doc: doc as unknown as DocumentoDeEntrada } };
}

/** Troca (ou acrescenta) por id: o que vem depois vence. Itens sem id de texto ficam de fora. */
function porId<T extends { id: string }>(base: readonly T[], novos: readonly T[]): T[] {
  const mapa = new Map<string, T>();
  for (const x of [...base, ...novos]) if (ehObjeto(x) && typeof x.id === "string") mapa.set(x.id, x);
  return [...mapa.values()];
}

/**
 * Junta os arquivos brutos de cada dossiê com as linhas do banco e confere tudo de novo. Puro (o teste usa com dados na
 * memória). `brutos` é indexado pelo slug; dossiê sem arquivo começa vazio.
 */
export function juntarArquivosEBanco(
  brutos: ReadonlyMap<string, ArquivoDeEntradas | null>,
  linhasBrutas: readonly unknown[],
): { lidos: DossieLido[]; descartadas: string[] } {
  const descartadas: string[] = [];
  const linhas: LinhaPublicada[] = [];
  const vistos = new Set<string>();
  for (const bruta of linhasBrutas) {
    const c = conferirLinha(bruta);
    if (!c.ok) {
      descartadas.push(`banco: ${c.motivo}`);
      continue;
    }
    // A função devolve da mudança mais recente para a mais antiga: se um id vier repetido, fica o primeiro.
    if (vistos.has(c.linha.id)) continue;
    vistos.add(c.linha.id);
    linhas.push(c.linha);
  }
  const idsDoBanco = new Set(linhas.map((l) => l.id));
  const lidos = SLUGS_DOS_DOSSIES.map((slug): DossieLido => {
    const arquivo = brutos.get(slug) ?? null;
    const doBanco = linhas.filter((l) => l.dossie === slug);
    const base: ArquivoDeEntradas = {
      dossie: slug,
      pessoas: Array.isArray(arquivo?.pessoas) ? arquivo.pessoas : [],
      organizacoes: Array.isArray(arquivo?.organizacoes) ? arquivo.organizacoes : [],
      ligacoes: Array.isArray(arquivo?.ligacoes) ? arquivo.ligacoes : [],
      entradas: Array.isArray(arquivo?.entradas) ? arquivo.entradas : [],
    };
    // O caso do banco tira o do arquivo com o mesmo id (em qualquer dossiê) e as ligações que eram dele.
    const junto: ArquivoDeEntradas = {
      dossie: slug,
      pessoas: porId<PessoaPublica>(base.pessoas, doBanco.flatMap((l) => l.doc.pessoasPublicas ?? [])),
      organizacoes: porId<Organizacao>(base.organizacoes, doBanco.flatMap((l) => l.doc.organizacoesPublicas ?? [])),
      ligacoes: porId<Ligacao>(
        base.ligacoes.filter((x) => !idsDoBanco.has(x?.entradaId)),
        doBanco.flatMap((l) => (l.doc.ligacoes ?? []).filter((x) => ehObjeto(x) && x.entradaId === l.id)),
      ),
      entradas: [...base.entradas.filter((x) => !idsDoBanco.has(x?.id)), ...doBanco.map((l) => docPublico(l.doc))],
    };
    try {
      return conferirArquivo(junto);
    } catch {
      // Algo no banco derrubou a conferência: este dossiê fica só com o arquivo.
      descartadas.push(`banco: dossiê ${slug} voltou para o arquivo`);
      try {
        return conferirArquivo(base);
      } catch {
        return { dossie: slug, pessoas: [], organizacoes: [], ligacoes: [], entradas: [], pendentes: [], ligacoesPendentes: [], descartadas: [] };
      }
    }
  });
  return { lidos, descartadas };
}

/** Busca as linhas publicadas. Sem variáveis, com erro, resposta não-lista ou mais de 5 s: null (valem os arquivos). */
export async function buscarPublicadas(buscar: typeof fetch = fetch): Promise<unknown[] | null> {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !chave) return null;
  try {
    // GET: a função é "stable", o PostgREST aceita, e o cache de dados do Next guarda a resposta por 300 s.
    const resposta = await buscar(`${url}/rest/v1/rpc/vale_publicadas`, {
      method: "GET",
      headers: { apikey: chave, Authorization: `Bearer ${chave}`, Accept: "application/json" },
      next: { revalidate: SEGUNDOS_DO_BANCO },
      signal: AbortSignal.timeout(PRAZO_DA_RESPOSTA_MS),
    } as RequestInit);
    if (!resposta.ok) return null;
    const corpo: unknown = await resposta.json();
    return Array.isArray(corpo) ? corpo : null;
  } catch {
    return null;
  }
}

let guardado: { em: number; lidos: DossieLido[] } | null = null;
let buscando: Promise<DossieLido[]> | null = null;

/**
 * Todos os dossiês, arquivos + banco, conferidos. Guarda o resultado por 300 s na memória do processo; se o banco
 * falhar, devolve os arquivos (e tenta de novo na próxima chamada, sem guardar a falha).
 */
export async function lerTudoComBanco(): Promise<DossieLido[]> {
  if (guardado && Date.now() - guardado.em < SEGUNDOS_DO_BANCO * 1000) return guardado.lidos;
  buscando ??= (async () => {
    try {
      const linhas = await buscarPublicadas();
      if (!linhas) return lerTudo();
      const brutos = new Map(SLUGS_DOS_DOSSIES.map((slug) => [slug, lerArquivoBruto(slug)] as const));
      const { lidos } = juntarArquivosEBanco(brutos, linhas);
      guardado = { em: Date.now(), lidos };
      return lidos;
    } catch {
      return lerTudo();
    } finally {
      buscando = null;
    }
  })();
  return buscando;
}
