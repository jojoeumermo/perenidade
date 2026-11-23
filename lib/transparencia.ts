// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que as páginas públicas de transparência mostram (app/[lang]/transparencia/**), lido de content/transparencia/ no servidor:
// os relatórios de auditoria na íntegra, os pedidos de órgãos públicos, os relatórios trimestrais, o canário e a lista completa do
// que o servidor guarda (gerada do banco por scripts/ferramentas/inventario-do-banco.mjs). Arquivo malformado derruba o build com
// o nome do arquivo (como lib/content.ts): uma página de transparência errada é pior que nenhuma.
import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import { parseFrontmatter } from "./frontmatter";

const PASTA = path.join(process.cwd(), "content/transparencia");
const DATA = /^\d{4}-\d{2}-\d{2}$/;

function falhar(arquivo: string, motivo: string): never {
  throw new Error(`content/transparencia/${arquivo}: ${motivo}`);
}
function lerJson<T>(arquivo: string): T {
  try {
    return JSON.parse(fs.readFileSync(path.join(PASTA, arquivo), "utf8")) as T;
  } catch (erro) {
    falhar(arquivo, (erro as Error).message);
  }
}
const texto = (v: unknown, arquivo: string, campo: string): string => {
  if (typeof v !== "string" || !v.trim()) falhar(arquivo, `falta "${campo}"`);
  return v.trim();
};
const data = (v: unknown, arquivo: string, campo: string): string => {
  const t = texto(v, arquivo, campo);
  if (!DATA.test(t)) falhar(arquivo, `"${campo}" precisa ser AAAA-MM-DD`);
  return t;
};

// ── Relatórios de auditoria ──────────────────────────────────────────────────────────────────────────────────────────────────

export interface Achados {
  criticos: number;
  altos: number;
  medios: number;
  baixos: number;
}
export interface RelatorioDeAuditoria {
  data: string;
  titulo: string;
  quem: string;
  escopo: string;
  /** Caminho a partir de public/ (o PDF na íntegra), por exemplo /transparencia/relatorios/2027-03-auditoria.pdf. */
  arquivo: string;
  sha256: string;
  achados: Achados;
  resposta: string;
}

/** Confere a lista de relatórios (o conteúdo de relatorios.json); erro com o item e o campo. */
export function validarRelatorios(bruto: { relatorios?: unknown }, arq = "relatorios.json"): RelatorioDeAuditoria[] {
  if (!Array.isArray(bruto.relatorios)) falhar(arq, 'falta a lista "relatorios"');
  return bruto.relatorios
    .map((r, i) => {
      const x = (r ?? {}) as Record<string, unknown>;
      const onde = `${arq} (item ${i + 1})`;
      const arquivo = texto(x.arquivo, onde, "arquivo");
      if (!/^\/transparencia\/relatorios\/[a-z0-9-]+\.pdf$/.test(arquivo)) falhar(onde, '"arquivo" precisa ser /transparencia/relatorios/<nome>.pdf');
      const sha256 = texto(x.sha256, onde, "sha256");
      if (!/^[0-9a-f]{64}$/.test(sha256)) falhar(onde, '"sha256" precisa ter 64 letras hexadecimais');
      const a = (x.achados ?? {}) as Record<string, unknown>;
      const n = (v: unknown, campo: string) => {
        if (!Number.isInteger(v) || (v as number) < 0) falhar(onde, `"achados.${campo}" precisa ser um número inteiro`);
        return v as number;
      };
      return {
        data: data(x.data, onde, "data"),
        titulo: texto(x.titulo, onde, "titulo"),
        quem: texto(x.quem, onde, "quem"),
        escopo: texto(x.escopo, onde, "escopo"),
        arquivo,
        sha256,
        achados: { criticos: n(a.criticos, "criticos"), altos: n(a.altos, "altos"), medios: n(a.medios, "medios"), baixos: n(a.baixos, "baixos") },
        resposta: typeof x.resposta === "string" ? x.resposta.trim() : "",
      };
    })
    .sort((a, b) => b.data.localeCompare(a.data));
}
export const relatoriosDeAuditoria = cache((): RelatorioDeAuditoria[] => validarRelatorios(lerJson("relatorios.json")));

// ── Pedidos de órgãos públicos ───────────────────────────────────────────────────────────────────────────────────────────────

export const TIPOS_DE_PEDIDO = ["ordem judicial", "requisição", "ofício", "outro"] as const;
export interface PedidoDeOrgao {
  recebido: string;
  tipo: (typeof TIPOS_DE_PEDIDO)[number];
  /** O tipo de órgão (vara criminal, delegacia, Ministério Público...), nunca nome de pessoa nem número que identifique alguém. */
  orgao: string;
  pediu: string;
  entregamos: string;
  contestamos: boolean;
  situacao: string;
}
export interface Pedidos {
  desde: string | null;
  atualizado: string | null;
  pedidos: PedidoDeOrgao[];
}

/** Confere os pedidos (o conteúdo de pedidos.json). */
export function validarPedidos(bruto: Record<string, unknown>, arq = "pedidos.json"): Pedidos {
  if (!Array.isArray(bruto.pedidos)) falhar(arq, 'falta a lista "pedidos"');
  const quando = (v: unknown, campo: string) => (v === null || v === undefined ? null : data(v, arq, campo));
  const pedidos = bruto.pedidos.map((p, i) => {
    const x = (p ?? {}) as Record<string, unknown>;
    const onde = `${arq} (item ${i + 1})`;
    if (!TIPOS_DE_PEDIDO.includes(x.tipo as PedidoDeOrgao["tipo"])) falhar(onde, `"tipo" precisa ser ${TIPOS_DE_PEDIDO.join(", ")}`);
    if (typeof x.contestamos !== "boolean") falhar(onde, '"contestamos" precisa ser true ou false');
    return {
      recebido: data(x.recebido, onde, "recebido"),
      tipo: x.tipo as PedidoDeOrgao["tipo"],
      orgao: texto(x.orgao, onde, "orgao"),
      pediu: texto(x.pediu, onde, "pediu"),
      entregamos: texto(x.entregamos, onde, "entregamos"),
      contestamos: x.contestamos,
      situacao: texto(x.situacao, onde, "situacao"),
    };
  });
  return { desde: quando(bruto.desde, "desde"), atualizado: quando(bruto.atualizado, "atualizado"), pedidos: pedidos.sort((a, b) => b.recebido.localeCompare(a.recebido)) };
}
export const pedidosDeOrgaos = cache((): Pedidos => validarPedidos(lerJson("pedidos.json")));

// ── Relatórios trimestrais ───────────────────────────────────────────────────────────────────────────────────────────────────

export interface RelatorioTrimestral {
  trimestre: string;
  periodo: string;
  publicado: string;
  corpo: string;
}

/** Confere um relatório trimestral (o nome do arquivo e o texto com o cabeçalho). */
export function validarTrimestral(nome: string, bruto: string): RelatorioTrimestral {
  const arq = `trimestral/${nome}`;
  const { data: d, content } = parseFrontmatter(bruto);
  const trimestre = texto(d.trimestre, arq, "trimestre");
  if (!/^\d{4}-T[1-4]$/.test(trimestre) || `${trimestre}.md` !== nome) falhar(arq, '"trimestre" precisa ser AAAA-TN, igual ao nome do arquivo');
  return { trimestre, periodo: texto(d.periodo, arq, "periodo"), publicado: data(d.publicado, arq, "publicado"), corpo: content.trim() };
}

/** Os relatórios publicados (content/transparencia/trimestral/AAAA-TN.md), do mais novo ao mais velho. O MODELO.md não entra. */
export const relatoriosTrimestrais = cache((): RelatorioTrimestral[] => {
  const pasta = path.join(PASTA, "trimestral");
  if (!fs.existsSync(pasta)) return [];
  return fs
    .readdirSync(pasta)
    .filter((f) => /^\d{4}-T[1-4]\.md$/.test(f))
    .map((f) => validarTrimestral(f, fs.readFileSync(path.join(pasta, f), "utf8")))
    .sort((a, b) => b.trimestre.localeCompare(a.trimestre));
});

// ── Canário ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Canario {
  situacao: "aguardando" | "publicado";
  emitido: string | null;
  validoAte: string | null;
  /** O texto com as datas no lugar (publicado) ou com as marcas {emitido} e {valido_ate} (aguardando). */
  texto: string;
  /** O arquivo exatamente como foi assinado (o que a pessoa confere com o pacote Sigstore). */
  bruto: string;
}

/** Confere o canário (o texto do arquivo com o cabeçalho). */
export function validarCanario(bruto: string, arq = "canario.md"): Canario {
  const { data: d, content } = parseFrontmatter(bruto);
  const situacao = d.situacao;
  if (situacao !== "aguardando" && situacao !== "publicado") falhar(arq, '"situacao" precisa ser aguardando ou publicado');
  if (situacao === "aguardando") return { situacao, emitido: null, validoAte: null, texto: content.trim(), bruto };
  const emitido = data(d.emitido, arq, "emitido");
  const validoAte = data(d.valido_ate, arq, "valido_ate");
  if (validoAte <= emitido) falhar(arq, '"valido_ate" precisa ser depois de "emitido"');
  if (!content.includes("{emitido}") || !content.includes("{valido_ate}")) falhar(arq, "o texto precisa das marcas {emitido} e {valido_ate}");
  return { situacao, emitido, validoAte, texto: content.trim().replaceAll("{emitido}", emitido).replaceAll("{valido_ate}", validoAte), bruto };
}
export const canario = cache((): Canario => validarCanario(fs.readFileSync(path.join(PASTA, "canario.md"), "utf8")));

/** O canário venceu? (Publicado e com a validade no passado, pela data de hoje em UTC.) */
export const canarioVencido = (c: Canario, hoje = new Date().toISOString().slice(0, 10)) => c.situacao === "publicado" && !!c.validoAte && c.validoAte < hoje;

// ── O que o servidor guarda ──────────────────────────────────────────────────────────────────────────────────────────────────

export interface TabelaGuardada {
  tabela: string;
  area: string;
  o_que_e: string;
  colunas: [string, string][];
  aponta_para_conta: string[];
  apaga_sozinho: string[];
}
export interface ServicoDeContas {
  tabela: string;
  guarda: string;
  prazo: string;
  nota: string;
}
export interface Inventario {
  versao_do_banco: number | null;
  total: { tabelas: number; colunas: number; com_conta: number };
  servico_de_contas: ServicoDeContas[];
  tabelas: TabelaGuardada[];
}

export const inventario = cache((): Inventario => lerJson<Inventario>("o-que-o-servidor-guarda.json"));

/** O intervalo do Postgres ("30 days") em português ("30 dias"). */
const UNIDADES: Record<string, [string, string]> = {
  second: ["segundo", "segundos"], minute: ["minuto", "minutos"], hour: ["hora", "horas"], day: ["dia", "dias"], week: ["semana", "semanas"],
  month: ["mês", "meses"], year: ["ano", "anos"], mon: ["mês", "meses"], min: ["minuto", "minutos"],
};
export function prazoEmPortugues(intervalo: string) {
  const m = /^(\d+) ([a-z]+?)s?$/.exec(intervalo.trim());
  const u = m && UNIDADES[m[2]];
  return m && u ? `${m[1]} ${Number(m[1]) === 1 ? u[0] : u[1]}` : intervalo;
}
