// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas da estrutura das comunidades (onda 10, frente 10C) ao banco: uma função por rpc, nos nomes e parâmetros de
// supabase/migracoes/20261116-alumia-o10-estrutura.sql. Na prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim) responde um dublê com as
// comunidades de exemplo, que guarda as mudanças só na memória da aba. Sem "@/" de propósito.
import { type Chamar, chamar } from "../cliente";
import type {
  AjusteDaEstrutura,
  CidadeComComunidades,
  ComunidadeCurta,
  ComunidadesDaCidade,
  Espacos,
  Estrutura,
  EstruturaDaProposta,
  OrigemDoRepost,
} from "./tipos";
import { chaveDaCidade, nomeDoLugar } from "./regras";
import { listaDeExemplo } from "../conversa/exemplos";

export function criarClienteEstrutura(c: Chamar) {
  return {
    ver: (slug: string) => c<Estrutura>("alumia_estr_ver", { p_slug: slug }),
    salvar: (slug: string, p: AjusteDaEstrutura) => c<Estrutura>("alumia_estr_salvar", { p_slug: slug, p }),
    pedirMae: (slug: string, mae: string | null) => c<Estrutura>("alumia_estr_mae_pedir", { p_slug: slug, p_mae: mae }),
    decidirFilha: (mae: string, filha: string, aceita: boolean) => c<Estrutura>("alumia_estr_mae_decidir", { p_mae: mae, p_filha: filha, p_aceita: aceita }),
    pedirOrg: (slug: string, handle: string | null) => c<Estrutura>("alumia_estr_org_pedir", { p_slug: slug, p_handle: handle }),
    decidirOrg: (handle: string, slug: string, aceita: boolean) => c<Espacos | null>("alumia_estr_org_decidir", { p_handle: handle, p_slug: slug, p_aceita: aceita }),
    espacos: (handle: string) => c<Espacos | null>("alumia_estr_espacos", { p_handle: handle }),
    cidades: () => c<CidadeComComunidades[]>("alumia_estr_cidades"),
    daCidade: (uf: string, municipio: string) => c<ComunidadesDaCidade>("alumia_estr_da_cidade", { p_uf: uf, p_municipio: municipio }),
    repostar: (post: string, destino: string, texto: string) =>
      c<{ id: string; origem: ComunidadeCurta | null; destino: ComunidadeCurta }>("alumia_estr_repostar", { p_post: post, p_destino: destino, p_texto: texto }),
    origens: (ids: string[]) => c<OrigemDoRepost[]>("alumia_estr_origens", { p_ids: ids.slice(0, 50) }),
    proposta: (id: string, p: EstruturaDaProposta) => c<EstruturaDaProposta>("alumia_estr_proposta", { p_id: id, p }),
  };
}

export type ClienteEstrutura = ReturnType<typeof criarClienteEstrutura>;

// ── O dublê da prévia ───────────────────────────────────────────────────────────────────────────────────────────────────────

const curta = (slug: string, nome: string, cor: string, descricao: string, tipo: ComunidadeCurta["tipo"] = "aberta"): ComunidadeCurta => ({
  slug, nome, descricao, tipo, categoria: "lutas", cor,
});

/** As comunidades de exemplo da prévia, com a estrutura que cada uma teria. */
/** Os posts da semana da prévia: os mesmos da lista de comunidades de exemplo (número só a partir de 3, como no banco). */
const postsDaSemana = (slug: string): number | null => {
  const n = listaDeExemplo().find((c) => c.slug === slug)?.posts_7d ?? null;
  return n !== null && n >= 3 ? n : null;
};

function estruturasDeExemplo(): Record<string, Estrutura> {
  const zl = curta("moradia-zona-leste", "Moradia Zona Leste", "#ff8a1f", "Ocupações, despejos e mutirões da Zona Leste.");
  const itaquera = curta("ocupacao-itaquera", "Ocupação Itaquera", "#ffc21a", "A assembleia e os mutirões da ocupação em Itaquera.");
  const guaianases = curta("ocupacao-guaianases", "Ocupação Guaianases", "#e8321f", "A ocupação de Guaianases: cozinha, creche e assembleia.", "restrita");
  const pl = curta("passe-livre-sp", "Passe Livre SP", "#1fc2b5", "Pela tarifa zero no transporte de São Paulo.");
  const base = (c: ComunidadeCurta): Estrutura => ({
    comunidade: c.slug, nome: c.nome, modero: false, mae: null, mae_pedido: null, filhas: [], pedidos_filhas: null, pode_ser_mae: true, pode_ser_filha: true,
    heranca: "propria", so_leitura: false, respostas: "todos", reposts: "todos", local: null, org: null, org_pedido: null, posso_abrir_post: true, posso_responder: true,
  });
  return {
    "moradia-zona-leste": {
      ...base(zl), modero: true, pode_ser_filha: false,
      filhas: [{ ...itaquera, municipio: "São Paulo", bairro: "Itaquera" }],
      pedidos_filhas: [{ ...guaianases, heranca: "mae" }],
      local: { uf: "SP", municipio: "São Paulo", bairro: "Zona Leste" },
      org: { handle: "mandatapopular", codinome: "Mandata Popular", selo: true },
    },
    "ocupacao-itaquera": { ...base(itaquera), mae: zl, heranca: "mae", pode_ser_mae: false, local: { uf: "SP", municipio: "São Paulo", bairro: "Itaquera" } },
    "passe-livre-sp": {
      ...base(pl), so_leitura: true, respostas: "membros", posso_abrir_post: false, local: { uf: "SP", municipio: "São Paulo", bairro: null },
    },
  };
}

function cidadesDeExemplo(estruturas: Record<string, Estrutura>): CidadeComComunidades[] {
  const extras = [
    { uf: "PE", municipio: "Recife", comunidades: 2 },
    { uf: "RJ", municipio: "Niterói", comunidades: 1 },
    { uf: "SP", municipio: "Campinas", comunidades: 1 },
  ];
  const sp = Object.values(estruturas).filter((e) => e.local?.municipio === "São Paulo").length;
  return [...extras, { uf: "SP", municipio: "São Paulo", comunidades: sp }].sort((a, b) => a.uf.localeCompare(b.uf) || chaveDaCidade(a.municipio).localeCompare(chaveDaCidade(b.municipio)));
}

/** O dublê: as mesmas funções, respondendo com os exemplos (e guardando as mudanças só nesta aba). */
export function criarDubleDaEstrutura(): Record<string, (a: Record<string, unknown>) => unknown> {
  const estruturas = estruturasDeExemplo();
  const achar = (slug: string): Estrutura => {
    const e = estruturas[slug];
    if (e) return e;
    const nova: Estrutura = {
      comunidade: slug, nome: slug, modero: false, mae: null, mae_pedido: null, filhas: [], pedidos_filhas: null, pode_ser_mae: true, pode_ser_filha: true,
      heranca: "propria", so_leitura: false, respostas: "todos", reposts: "todos", local: null, org: null, org_pedido: null, posso_abrir_post: true, posso_responder: true,
    };
    estruturas[slug] = nova;
    return nova;
  };
  return {
    alumia_estr_ver: (a) => achar(String(a.p_slug)),
    alumia_estr_salvar: (a) => {
      const e = achar(String(a.p_slug));
      const p = (a.p ?? {}) as AjusteDaEstrutura;
      if (p.so_leitura !== undefined) e.so_leitura = p.so_leitura;
      if (p.respostas) e.respostas = p.respostas;
      if (p.reposts) e.reposts = p.reposts;
      if (p.heranca) e.heranca = p.heranca;
      if (p.municipio !== undefined || p.uf !== undefined || p.bairro !== undefined) {
        const municipio = nomeDoLugar(p.municipio ?? e.local?.municipio);
        e.local = municipio ? { uf: (p.uf ?? e.local?.uf ?? "SP").toUpperCase(), municipio, bairro: nomeDoLugar(p.bairro ?? e.local?.bairro) } : null;
      }
      return e;
    },
    alumia_estr_mae_pedir: (a) => {
      const e = achar(String(a.p_slug));
      const mae = a.p_mae ? String(a.p_mae) : null;
      e.mae = null;
      e.mae_pedido = mae ? curta(mae, estruturas[mae]?.nome ?? mae, "", "") : null;
      return e;
    },
    alumia_estr_mae_decidir: (a) => {
      const e = achar(String(a.p_mae));
      const filha = (e.pedidos_filhas ?? []).find((f) => f.slug === a.p_filha);
      e.pedidos_filhas = (e.pedidos_filhas ?? []).filter((f) => f.slug !== a.p_filha);
      if (a.p_aceita && filha) e.filhas = [...e.filhas, { ...filha, municipio: e.local?.municipio ?? null, bairro: null }];
      if (!a.p_aceita) e.filhas = e.filhas.filter((f) => f.slug !== a.p_filha);
      return e;
    },
    alumia_estr_org_pedir: (a) => {
      const e = achar(String(a.p_slug));
      const h = a.p_handle ? String(a.p_handle).replace(/^@+/, "") : null;
      e.org = null;
      e.org_pedido = h ? { handle: h, codinome: h, selo: true } : null;
      return e;
    },
    alumia_estr_org_decidir: () => null,
    alumia_estr_espacos: (a) => {
      const handle = String(a.p_handle);
      const ligadas = Object.values(estruturas).filter((e) => e.org?.handle === handle);
      return {
        handle, codinome: "Mandata Popular", selo: true, gerencio: true,
        comunidades: ligadas.map((e) => ({
          ...curta(e.comunidade, e.nome, "#ff8a1f", "Ocupações, despejos e mutirões da Zona Leste."),
          municipio: e.local?.municipio ?? null, uf: e.local?.uf ?? null, bairro: e.local?.bairro ?? null, posts_7d: postsDaSemana(e.comunidade),
          filhas: e.filhas.map(({ slug, nome, descricao, tipo, categoria, cor }) => ({ slug, nome, descricao, tipo, categoria, cor })),
        })).concat([{ ...curta("saude-popular-sp", "Saúde Popular SP", "#5b8cff", "Postos, filas e o conselho de saúde."), municipio: "São Paulo", uf: "SP", bairro: null, posts_7d: null, filhas: [] }]),
        nucleos: [
          { id: "n1", nome: "Núcleo Zona Leste", quando: "Sábados, 10h", cidade: "São Paulo", uf: "SP" },
          { id: "n2", nome: "Núcleo Centro", quando: "Quartas, 19h", cidade: "São Paulo", uf: "SP" },
        ],
        pedidos: [curta("cultura-hip-hop", "Cultura e hip-hop", "#a27bff", "Saraus, batalhas e quem faz cultura na quebrada.")],
      } satisfies Espacos;
    },
    alumia_estr_cidades: () => cidadesDeExemplo(estruturas),
    alumia_estr_da_cidade: (a) => {
      const chave = chaveDaCidade(String(a.p_municipio));
      const itens = Object.values(estruturas)
        .filter((e) => e.local && chaveDaCidade(e.local.municipio) === chave && e.local.uf === String(a.p_uf).toUpperCase())
        .map((e) => ({ ...curta(e.comunidade, e.nome, e.comunidade === "passe-livre-sp" ? "#1fc2b5" : e.comunidade === "ocupacao-itaquera" ? "#ffc21a" : "#ff8a1f", ""), municipio: e.local!.municipio, bairro: e.local!.bairro, situacao: null, posts_7d: postsDaSemana(e.comunidade) }))
        .sort((x, y) => (x.bairro ?? "").localeCompare(y.bairro ?? "") || x.nome.localeCompare(y.nome));
      return { uf: String(a.p_uf).toUpperCase(), itens } satisfies ComunidadesDaCidade;
    },
    alumia_estr_repostar: (a) => ({ id: "00000000-0000-4000-8000-0000000000e1", origem: null, destino: curta(String(a.p_destino), String(a.p_destino), "", "") }),
    alumia_estr_origens: () => [],
    alumia_estr_proposta: (a) => a.p ?? {},
  };
}

/** A prévia com dados de exemplo está ligada? (A referência é literal para o Next gravar o valor no código do navegador.) */
const PREVIA = process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim";

function chamarComDuble(duble = criarDubleDaEstrutura(), resto: Chamar = chamar): Chamar {
  return async <T,>(funcao: string, argumentos: Record<string, unknown> = {}) => {
    const f = duble[funcao];
    if (!f) return resto<T>(funcao, argumentos);
    await new Promise((r) => setTimeout(r, 120));
    return structuredClone(f(argumentos)) as T;
  };
}

export const estrutura = criarClienteEstrutura(PREVIA ? chamarComDuble() : chamar);
