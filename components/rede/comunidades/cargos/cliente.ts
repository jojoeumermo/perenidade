// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas de cargos e chegada ao banco (supabase/migracoes/20261116-alumia-o10-cargos.sql) e as três de antes que a aba
// também usa (regras, fixar e pedidos, com a conferência de permissão refeita na mesma migração). Com NEXT_PUBLIC_ALUMIA_PREVIA=sim,
// um dublê com dados de exemplo que guarda as mudanças na memória da aba (nada vai ao banco). Na prévia, "?visao=membro" no
// endereço mostra a aba como quem não cuida de nada.
import { chamar, type Chamar } from "../../../../lib/rede/cliente";
import { PERMISSOES, type Cargo, type EtiquetaDePessoa, type Interesse, type PainelDosCargos, type Permissao, type QuemDa } from "./regras";

export interface CargoParaSalvar {
  nome: string;
  descricao: string;
  permissoes: Permissao[];
}

export interface ChegadaParaSalvar {
  boas_vindas?: string;
  interesses?: { nome: string; texto: string }[];
  regras_antes?: boolean;
}

export function criarClienteDosCargos(c: Chamar) {
  return {
    painel: (slug: string) => c<PainelDosCargos>("alumia_cargos_painel", { p_slug: slug }),
    regrasParaPostar: (slug: string) => c<{ precisa: boolean; nome?: string }>("alumia_cargos_regras_para_postar", { p_slug: slug }),
    etiquetasDosPosts: (posts: string[]) => c<{ post: string; etiqueta: string }[]>("alumia_cargos_etiquetas_dos_posts", { p_posts: posts }),
    salvarCargo: (slug: string, id: string | null, p: CargoParaSalvar) => c<Omit<Cargo, "pessoas">>("alumia_cargos_salvar", { p_slug: slug, p_id: id, p }),
    apagarCargo: (slug: string, id: string) => c<{ ok: boolean }>("alumia_cargos_apagar", { p_slug: slug, p_id: id }),
    convidar: (slug: string, cargo: string, handle: string) => c<{ situacao: string }>("alumia_cargos_convidar", { p_slug: slug, p_cargo: cargo, p_handle: handle }),
    tirar: (slug: string, cargo: string, usuario: string) => c<{ ok: boolean }>("alumia_cargos_tirar", { p_slug: slug, p_cargo: cargo, p_usuario: usuario }),
    responder: (cargo: string, aceita: boolean) => c<{ situacao: string | null }>("alumia_cargos_responder", { p_cargo: cargo, p_aceita: aceita }),
    deixar: (cargo: string) => c<{ ok: boolean }>("alumia_cargos_deixar", { p_cargo: cargo }),
    salvarEtiquetas: (slug: string, lista: { id?: string; nome: string; quem_da: QuemDa }[]) => c<EtiquetaDePessoa[]>("alumia_cargos_etiquetas_salvar", { p_slug: slug, p: lista }),
    escolherEtiqueta: (slug: string, etiqueta: string | null) => c<{ etiqueta: { id: string; nome: string } | null }>("alumia_cargos_etiqueta_escolher", { p_slug: slug, p_etiqueta: etiqueta }),
    recusarEtiqueta: (slug: string, etiqueta: string) => c<{ ok: boolean }>("alumia_cargos_etiqueta_recusar", { p_slug: slug, p_etiqueta: etiqueta }),
    oferecerEtiqueta: (slug: string, etiqueta: string, handle: string) => c<{ ok: boolean }>("alumia_cargos_etiqueta_oferecer", { p_slug: slug, p_etiqueta: etiqueta, p_handle: handle }),
    tirarEtiqueta: (slug: string, handle: string) => c<{ ok: boolean }>("alumia_cargos_etiqueta_tirar", { p_slug: slug, p_handle: handle }),
    salvarChegada: (slug: string, p: ChegadaParaSalvar) => c<{ boas_vindas: string; interesses: Interesse[]; regras_antes: boolean; regras_em: string }>("alumia_cargos_chegada_salvar", { p_slug: slug, p }),
    aceitarRegras: (slug: string) => c<{ lidas_em: string }>("alumia_cargos_regras_aceitar", { p_slug: slug }),
    fixarPrazo: (slug: string, post: string, ate: string | null) => c<{ post: string; ate: string | null }>("alumia_cargos_fixar_prazo", { p_slug: slug, p_post: post, p_ate: ate }),
    salvarRegras: (slug: string, regras: { titulo: string; texto: string }[]) => c<{ regras: { numero: number; titulo: string; texto: string }[] }>("rede_com_regras_salvar", { p_slug: slug, p_regras: regras }),
  };
}

export const PREVIA_DOS_CARGOS = process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim";

// ── O dublê da prévia ─────────────────────────────────────────────────────────────────────────────────────────────────────

const DIA = 86_400_000;
const estados = new Map<string, PainelDosCargos>();
const chave = (n: string) => Array.from(n.toLowerCase()).reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7).toString(16).padStart(8, "0").slice(0, 10);

function painelDeExemplo(slug: string): PainelDosCargos {
  const membro = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("visao") === "membro";
  const interesses: Interesse[] = [
    { nome: "Estudar", texto: "Comece pela cartilha “Despejo não é destino”, na aba Wiki." },
    { nome: "Ir aos mutirões", texto: "Todo sábado, 9h, na ocupação. Leve luva e água." },
    { nome: "Ajudar na comunicação", texto: "Escreva no fio fixado “Quem faz o jornal do mês”." },
    { nome: "Primeira ocupação", texto: "Leia as perguntas frequentes e fale com a Secretaria pelo Falar com a moderação." },
  ].map((i) => ({ ...i, chave: chave(i.nome) }));
  return {
    comunidade: slug,
    nome: "Comunidade de exemplo",
    tipo: "aberta",
    situacao: "membro",
    modero: !membro,
    permissoes: membro ? [] : [...PERMISSOES],
    cargos: [
      { id: "c1", nome: "Secretaria", descricao: "Recebe quem chega, responde os pedidos e escreve as boas-vindas.", permissoes: ["pedidos", "boas_vindas"], pessoas: null },
      { id: "c2", nome: "Formação", descricao: "Fixa os textos de estudo do mês e tira do alto quando o ciclo acaba.", permissoes: ["fixar", "etiquetas"], pessoas: 4 },
      { id: "c3", nome: "Acolhida", descricao: "Conversa com quem chegou agora. Sem poder de moderação.", permissoes: [], pessoas: 7 },
    ],
    meus_cargos: membro ? [{ id: "c1", nome: "Secretaria", permissoes: ["pedidos", "boas_vindas"], situacao: "convidado" }] : [],
    etiquetas: [
      { id: "e1", nome: "Moradora", quem_da: "pessoa" },
      { id: "e2", nome: "Estudante", quem_da: "pessoa" },
      { id: "e3", nome: "Professora", quem_da: "pessoa" },
      { id: "e4", nome: "Advogada popular", quem_da: "moderacao" },
    ],
    minha_etiqueta: { id: "e1", nome: "Moradora" },
    ofertas: membro ? [{ id: "e4", nome: "Advogada popular" }] : [],
    chegada: {
      boas_vindas: "Que bom ter você na luta pela moradia. Aqui a gente se organiza para que ninguém fique sem casa: leia as regras, se apresente no fio fixado e escolha por onde quer começar.",
      interesses,
      regras_antes: true,
      regras_em: new Date(Date.now() - 5 * DIA).toISOString(),
    },
    regras: [
      { numero: 1, titulo: "Respeito sempre", texto: "Discorde da ideia, nunca ataque a pessoa." },
      { numero: 2, titulo: "Nada de dado pessoal", texto: "Endereço, telefone e foto de rosto só com autorização." },
      { numero: 3, titulo: "Fale da luta", texto: "Moradia, despejo, ocupação e direito à cidade." },
    ],
    regras_lidas_em: membro ? null : new Date(Date.now() - 2 * DIA).toISOString(),
    precisa_ler: membro,
    gestao: membro
      ? {}
      : {
          pessoas: [
            { cargo: "c1", usuario: "u1", codinome: "Faísca", handle: "faisca", situacao: "ativo" },
            { cargo: "c1", usuario: "u2", codinome: "Frevo Vermelho", handle: "frevovermelho", situacao: "convidado" },
            { cargo: "c2", usuario: "u3", codinome: "Maré Alta", handle: "marealta", situacao: "ativo" },
          ],
          fixados: [
            { post: "p1", trecho: "Ciclo de estudo de novembro: “A questão da habitação”, de Engels.", ate: new Date(Date.now() + 6.5 * DIA).toISOString() },
            { post: "p2", trecho: "Como funciona a assembleia de quarta (leia antes da primeira vez).", ate: null },
          ],
          pedidos: 2,
        },
  };
}

function chamarDuble(): Chamar {
  const responder = async <T,>(f: string, a: Record<string, unknown>): Promise<T> => {
    await new Promise((r) => setTimeout(r, 120));
    const slug = String(a.p_slug ?? "exemplo");
    const atual = estados.get(slug) ?? painelDeExemplo(slug);
    estados.set(slug, atual);
    const devolver = (x: unknown) => x as T;
    switch (f) {
      case "alumia_cargos_painel":
        return devolver(structuredClone(atual));
      case "alumia_cargos_regras_para_postar":
        return devolver({ precisa: atual.precisa_ler, nome: atual.nome });
      case "alumia_cargos_etiquetas_dos_posts":
        return devolver([]);
      case "alumia_cargos_salvar": {
        const p = a.p as { nome: string; descricao: string; permissoes: Permissao[] };
        const id = (a.p_id as string | null) ?? `c${Date.now()}`;
        const ja = atual.cargos.find((k) => k.id === id);
        if (ja) Object.assign(ja, p);
        else atual.cargos.push({ id, ...p, pessoas: null });
        return devolver({ id, ...p });
      }
      case "alumia_cargos_apagar":
        atual.cargos = atual.cargos.filter((k) => k.id !== a.p_id);
        return devolver({ ok: true });
      case "alumia_cargos_convidar":
        atual.gestao.pessoas?.push({ cargo: String(a.p_cargo), usuario: `u${Date.now()}`, codinome: String(a.p_handle).replace(/^@/, ""), handle: String(a.p_handle).replace(/^@/, ""), situacao: "convidado" });
        return devolver({ situacao: "convidado" });
      case "alumia_cargos_tirar":
        if (atual.gestao.pessoas) atual.gestao.pessoas = atual.gestao.pessoas.filter((x) => !(x.cargo === a.p_cargo && x.usuario === a.p_usuario));
        return devolver({ ok: true });
      case "alumia_cargos_responder":
      case "alumia_cargos_deixar": {
        for (const e of estados.values()) {
          if (f === "alumia_cargos_deixar" || a.p_aceita === false) e.meus_cargos = e.meus_cargos.filter((k) => k.id !== a.p_cargo);
          else e.meus_cargos = e.meus_cargos.map((k) => (k.id === a.p_cargo ? { ...k, situacao: "ativo" } : k));
        }
        return devolver({ situacao: a.p_aceita ? "ativo" : null, ok: true });
      }
      case "alumia_cargos_etiquetas_salvar": {
        const lista = a.p as { id?: string; nome: string; quem_da: QuemDa }[];
        atual.etiquetas = lista.map((e, i) => ({ id: e.id ?? `e${Date.now()}${i}`, nome: e.nome, quem_da: e.quem_da }));
        return devolver(atual.etiquetas);
      }
      case "alumia_cargos_etiqueta_escolher": {
        const e = atual.etiquetas.find((x) => x.id === a.p_etiqueta) ?? atual.ofertas.find((x) => x.id === a.p_etiqueta);
        atual.minha_etiqueta = e ? { id: e.id, nome: e.nome } : null;
        atual.ofertas = atual.ofertas.filter((x) => x.id !== a.p_etiqueta);
        return devolver({ etiqueta: atual.minha_etiqueta });
      }
      case "alumia_cargos_etiqueta_recusar":
        atual.ofertas = atual.ofertas.filter((x) => x.id !== a.p_etiqueta);
        return devolver({ ok: true });
      case "alumia_cargos_etiqueta_oferecer":
      case "alumia_cargos_etiqueta_tirar":
        return devolver({ ok: true });
      case "alumia_cargos_chegada_salvar": {
        const p = a.p as { boas_vindas?: string; interesses?: { nome: string; texto: string }[]; regras_antes?: boolean };
        if (p.boas_vindas !== undefined) atual.chegada.boas_vindas = p.boas_vindas;
        if (p.interesses) atual.chegada.interesses = p.interesses.map((i) => ({ ...i, chave: chave(i.nome) }));
        if (p.regras_antes !== undefined) atual.chegada.regras_antes = p.regras_antes;
        return devolver(atual.chegada);
      }
      case "alumia_cargos_regras_aceitar":
        atual.regras_lidas_em = new Date().toISOString();
        atual.precisa_ler = false;
        return devolver({ lidas_em: atual.regras_lidas_em });
      case "alumia_cargos_fixar_prazo":
        atual.gestao.fixados = atual.gestao.fixados?.map((x) => (x.post === a.p_post ? { ...x, ate: (a.p_ate as string | null) ?? null } : x));
        return devolver({ post: a.p_post, ate: a.p_ate });
      case "rede_com_regras_salvar": {
        const regras = (a.p_regras as { titulo: string; texto: string }[]).map((r, i) => ({ numero: i + 1, ...r }));
        atual.regras = regras;
        return devolver({ regras });
      }
      default:
        throw Object.assign(new Error("generico"), { code: "generico" });
    }
  };
  return responder as Chamar;
}

export const chamarDosCargos: Chamar = PREVIA_DOS_CARGOS ? chamarDuble() : chamar;
export const cargos = criarClienteDosCargos(chamarDosCargos);
