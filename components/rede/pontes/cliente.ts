// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas das pontes (frente 13E; supabase/migracoes/20261119-alumia-o13-pontes.sql e as rotas app/api/rede/{robos,telegram,
// traduzir}). O que precisa de segredo do servidor (criar a conta do robô, criar a chave, traduzir) vai às rotas do site com o
// token da sessão; o resto vai direto ao banco. Com NEXT_PUBLIC_ALUMIA_PREVIA=sim, um dublê na memória faz as telas andarem sem
// banco (nada vai a lugar nenhum). Nenhuma resposta traz pessoa: o robô é conta de organização, o mural é da organização.
import { BackendError, getClient } from "../../../lib/backend";
import { chamar, type Chamar } from "../../../lib/rede/cliente";
import type { TipoDoMural } from "../../../lib/rede/pontes/regras";

export const PREVIA_DAS_PONTES = process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim";

export interface OrgDasPontes {
  handle: string;
  nome: string;
  palavra: string;
  selo: boolean;
  gerencio: boolean;
}
export interface EuNasPontes {
  coordenacao: boolean;
  telegram: boolean;
  orgs: OrgDasPontes[];
}
export type SituacaoDoRobo = "criando" | "esperando" | "ativo" | "recusado" | "desligado";
export interface Robo {
  id: string;
  nome: string;
  descricao: string;
  situacao: SituacaoDoRobo;
  handle: string | null;
  temChave: boolean;
  chaveDia: string | null;
  criadoDia: string;
  usadoDia: string | null;
  hoje: number;
  org?: { handle: string; nome: string };
}
export interface CanalDoTelegram {
  canal: string;
  ligado: boolean;
  motivo: "falhas" | null;
  enviadoDia: string | null;
}
export interface PontesDaOrg {
  selo: boolean;
  robos: Robo[];
  telegram: CanalDoTelegram | null;
}
export interface Resumo {
  ligado: boolean;
  escolhidas: string[];
  opcoes: { slug: string; nome: string }[];
}
export interface RotuloDeRobo {
  autor: string;
  org: { handle: string; nome: string };
}
export interface RoboDoPerfil {
  nome: string;
  descricao: string;
  parado: boolean;
  org: { handle: string; nome: string };
}
export interface Chamado {
  id: string;
  tipo: TipoDoMural;
  categoria: string;
  titulo: string;
  texto: string;
  cidade: string | null;
  quando: string | null;
  ate: string;
  encerrado: boolean;
  org: { handle: string; nome: string; palavra: string; tipo: string };
  posso: boolean;
}
export interface Mural {
  chamados: Chamado[];
  cidades: string[];
  possoPublicar: { handle: string; nome: string }[];
  meus: Chamado[];
}
export interface ChamadoNovo {
  tipo: TipoDoMural;
  categoria: string;
  titulo: string;
  texto: string;
  cidade: string;
  quando: string;
  ate: string;
}
export interface Traducao {
  titulo: string | null;
  texto: string;
  origem: string | null;
}

/** Uma rota do servidor do site, com o token da sessão. */
async function pelaRota<T>(caminho: string, corpo: unknown): Promise<T> {
  const supabase = await getClient();
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) throw new BackendError("entre_primeiro");
  const r = await fetch(caminho, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(corpo) }).catch(() => {
    throw new BackendError("sem_conexao");
  });
  const resposta = (await r.json().catch(() => null)) as (T & { erro?: string }) | null;
  if (!r.ok || !resposta || resposta.erro) throw new BackendError(resposta?.erro ?? "falha");
  return resposta;
}

export function criarClienteDasPontes(c: Chamar, rota: <T>(caminho: string, corpo: unknown) => Promise<T> = pelaRota) {
  return {
    eu: () => c<EuNasPontes>("alumia_pontes_eu", {}),
    daOrg: (handle: string) => c<PontesDaOrg>("alumia_pontes_org", { p_handle: handle }),
    criarRobo: (org: string, nome: string, descricao: string) => rota<{ robo: Robo }>("/api/rede/robos/conta", { org, nome, descricao }),
    novaChave: (robo: string) => rota<{ chave: string; robo: Robo }>("/api/rede/robos/chave", { robo }),
    desligarRobo: (robo: string) => c<Robo>("alumia_pontes_robo_desligar", { p_robo: robo }),
    fila: () => c<Robo[]>("alumia_pontes_robos_fila", {}),
    decidir: (robo: string, aprovar: boolean) => c<Robo>("alumia_pontes_robo_decidir", { p_robo: robo, p_aprovar: aprovar }),
    telegram: (handle: string, canal: string, ligado: boolean) => c<PontesDaOrg>("alumia_pontes_telegram_salvar", { p_handle: handle, p_canal: canal, p_ligado: ligado }),
    resumo: () => c<Resumo>("alumia_pontes_resumo_ver", {}),
    salvarResumo: (ligado: boolean, comunidades: string[]) => c<Resumo>("alumia_pontes_resumo_salvar", { p_ligado: ligado, p_comunidades: comunidades }),
    previaDoResumo: () => c<{ assunto: string; texto: string } | null>("alumia_pontes_resumo_previa", {}),
    rotulos: (autores: string[]) => c<RotuloDeRobo[]>("alumia_pontes_rotulos", { p_autores: autores }),
    roboDe: (handle: string) => c<RoboDoPerfil | null>("alumia_pontes_robo_de", { p_handle: handle }),
    mural: (filtro: { tipo?: string; cidade?: string }) => c<Mural>("alumia_trabalhadores", { p: filtro }),
    publicarChamado: (org: string, p: ChamadoNovo) => c<Chamado>("alumia_trabalhadores_publicar", { p_handle: org, p }),
    encerrarChamado: (id: string) => c<Chamado>("alumia_trabalhadores_encerrar", { p_id: id }),
    traduzir: (post: string, lang: string) => rota<Traducao>("/api/rede/traduzir", { post, lang }),
  };
}

// ── O dublê da prévia ─────────────────────────────────────────────────────────────────────────────────────────────────────

const hoje = () => new Date().toISOString().slice(0, 10);
const mais = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

function dubleDasPontes(): { c: Chamar; rota: <T>(caminho: string, corpo: unknown) => Promise<T> } {
  const vazio = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("previa") === "vazia";
  const orgs: OrgDasPontes[] = [
    { handle: "metroviarios", nome: "Sindicato dos Metroviários", palavra: "METRO", selo: true, gerencio: true },
    { handle: "coletivobrasa", nome: "Coletivo Brasa", palavra: "BRASA", selo: false, gerencio: true },
  ];
  const robos: Record<string, Robo[]> = {
    metroviarios: vazio ? [] : [
      { id: "r1", nome: "Boletim da greve", descricao: "Publica o boletim diário do comando de greve às 7h.", situacao: "ativo", handle: "robo_1a2b3c4d", temChave: true, chaveDia: mais(-12), criadoDia: mais(-20), usadoDia: hoje(), hoje: 3 },
      { id: "r2", nome: "Agenda das assembleias", descricao: "Avisa as assembleias marcadas pela diretoria.", situacao: "desligado", handle: "robo_9f8e7d6c", temChave: false, chaveDia: null, criadoDia: mais(-60), usadoDia: mais(-30), hoje: 0 },
    ],
    coletivobrasa: [],
  };
  const canais: Record<string, CanalDoTelegram | null> = { metroviarios: vazio ? null : { canal: "@metroviarios_sp", ligado: true, motivo: null, enviadoDia: mais(-1) }, coletivobrasa: null };
  const fila: Robo[] = vazio ? [] : [{ id: "f1", nome: "Agenda da Brasa", descricao: "Publica a agenda semanal do coletivo toda segunda.", situacao: "esperando", handle: "robo_5e6f7a8b", temChave: false, chaveDia: null, criadoDia: hoje(), usadoDia: null, hoje: 0, org: { handle: "coletivobrasa", nome: "Coletivo Brasa" } }];
  let resumo: Resumo = { ligado: !vazio, escolhidas: vazio ? [] : ["historia"], opcoes: [{ slug: "historia", nome: "História" }, { slug: "quimica", nome: "Química" }, { slug: "redacao-enem", nome: "Redação ENEM" }] };
  const org = (handle: string) => ({ handle, nome: orgs.find((o) => o.handle === handle)?.nome ?? handle, palavra: orgs.find((o) => o.handle === handle)?.palavra ?? "ORG", tipo: "sindicato" });
  let chamados: Chamado[] = vazio ? [] : [
    { id: "c1", tipo: "greve", categoria: "Metroviários de São Paulo", titulo: "Greve a partir de segunda contra a privatização das linhas", texto: "A assembleia aprovou greve por tempo indeterminado. Contribua com o fundo de greve na sede do sindicato e compareça ao ato de terça, às 17h, na Praça da Sé.", cidade: "São Paulo", quando: mais(3), ate: mais(20), encerrado: false, org: org("metroviarios"), posso: true },
    { id: "c2", tipo: "assembleia", categoria: "Professoras da rede estadual", titulo: "Assembleia da categoria sobre o reajuste", texto: "Assembleia aberta para decidir a proposta do governo. Traga a sua escola: quanto mais escolas, mais força na negociação.", cidade: "Recife", quando: mais(5), ate: mais(6), encerrado: false, org: { handle: "aprofpe", nome: "Associação das Professoras", palavra: "APROF", tipo: "sindicato" }, posso: false },
    { id: "c3", tipo: "solidariedade", categoria: "Entregadores por aplicativo", titulo: "Fundo para quem foi bloqueado depois da paralisação", texto: "Doações de cesta básica e de passe de ônibus para os entregadores bloqueados pelos aplicativos depois do breque de outubro.", cidade: "Belo Horizonte", quando: null, ate: mais(40), encerrado: false, org: { handle: "entregadoresbh", nome: "Coletivo Entregadores BH", palavra: "BREQUE", tipo: "coletivo" }, posso: false },
    { id: "c4", tipo: "campanha", categoria: "Comerciárias", titulo: "Campanha pelo fim da escala 6x1", texto: "Abaixo-assinado nas lojas do centro e roda de conversa no sábado. Quem trabalha no comércio do centro, procure a delegada da sua loja.", cidade: "São Paulo", quando: null, ate: mais(60), encerrado: false, org: { handle: "comerciarias", nome: "Comerciárias em Luta", palavra: "6X1", tipo: "movimento" }, posso: false },
    { id: "c5", tipo: "trabalho", categoria: "Cooperativa de costura", titulo: "Mutirão de costura das faixas do ato", texto: "A cooperativa precisa de mãos para costurar as faixas do ato de novembro. Tecido e linha garantidos; traga a sua tesoura.", cidade: "Recife", quando: mais(2), ate: mais(2), encerrado: false, org: { handle: "costurajunto", nome: "Cooperativa Costura Junto", palavra: "COSTURA", tipo: "coletivo" }, posso: false },
  ];
  const espera = () => new Promise((r) => setTimeout(r, 200));
  const c: Chamar = async <T,>(funcao: string, a: Record<string, unknown> = {}): Promise<T> => {
    await espera();
    switch (funcao) {
      case "alumia_pontes_eu":
        return { coordenacao: true, telegram: true, orgs } as T;
      case "alumia_pontes_org": {
        const h = String(a.p_handle);
        return { selo: orgs.find((o) => o.handle === h)?.selo ?? false, robos: robos[h] ?? [], telegram: canais[h] ?? null } as T;
      }
      case "alumia_pontes_robo_desligar": {
        for (const lista of Object.values(robos)) for (const r of lista) if (r.id === a.p_robo) { r.situacao = "desligado"; r.temChave = false; return r as T; }
        throw new BackendError("nao_encontrado");
      }
      case "alumia_pontes_robos_fila":
        return fila.filter((r) => r.situacao === "esperando") as T;
      case "alumia_pontes_robo_decidir": {
        const r = fila.find((x) => x.id === a.p_robo);
        if (!r) throw new BackendError("nao_encontrado");
        r.situacao = a.p_aprovar ? "ativo" : "recusado";
        return r as T;
      }
      case "alumia_pontes_telegram_salvar": {
        const h = String(a.p_handle);
        canais[h] = String(a.p_canal) ? { canal: String(a.p_canal), ligado: Boolean(a.p_ligado), motivo: null, enviadoDia: canais[h]?.enviadoDia ?? null } : null;
        return { selo: true, robos: robos[h] ?? [], telegram: canais[h] } as T;
      }
      case "alumia_pontes_resumo_ver":
        return resumo as T;
      case "alumia_pontes_resumo_salvar":
        resumo = { ...resumo, ligado: Boolean(a.p_ligado), escolhidas: a.p_ligado ? (a.p_comunidades as string[]) : [] };
        return resumo as T;
      case "alumia_pontes_resumo_previa":
        return (resumo.escolhidas.length ? { assunto: "O resumo das suas comunidades na Alumia", texto: "Os títulos públicos da semana nas comunidades que você escolheu:\n\nHistória\n- A Revolta da Vacina e a reforma urbana do Rio\n- Por que a Cabanagem foi apagada dos livros\n- e mais 7 posts curtos\n" } : null) as T;
      case "alumia_pontes_rotulos":
        return ((a.p_autores as string[]) ?? []).filter((x) => x.startsWith("robo")).map((autor) => ({ autor, org: { handle: "metroviarios", nome: "Sindicato dos Metroviários" } })) as T;
      case "alumia_pontes_robo_de":
        return (String(a.p_handle).startsWith("robo_") ? { nome: "Boletim da greve", descricao: "Publica o boletim diário do comando de greve.", parado: false, org: { handle: "metroviarios", nome: "Sindicato dos Metroviários" } } : null) as T;
      case "alumia_trabalhadores": {
        const f = (a.p ?? {}) as { tipo?: string; cidade?: string };
        const abertos = chamados.filter((x) => !x.encerrado && (!f.tipo || x.tipo === f.tipo) && (!f.cidade || x.cidade?.toLowerCase() === f.cidade.toLowerCase()));
        return { chamados: abertos, cidades: [...new Set(chamados.filter((x) => !x.encerrado && x.cidade).map((x) => x.cidade as string))].sort(), possoPublicar: [{ handle: "metroviarios", nome: "Sindicato dos Metroviários" }], meus: chamados.filter((x) => x.posso) } as T;
      }
      case "alumia_trabalhadores_publicar": {
        const p = a.p as ChamadoNovo;
        const novo: Chamado = { id: `c${Date.now()}`, ...p, cidade: p.cidade || null, quando: p.quando || null, ate: p.ate || mais(30), encerrado: false, org: org(String(a.p_handle)), posso: true };
        chamados = [novo, ...chamados];
        return novo as T;
      }
      case "alumia_trabalhadores_encerrar": {
        const x = chamados.find((y) => y.id === a.p_id);
        if (!x) throw new BackendError("nao_encontrado");
        x.encerrado = true;
        return x as T;
      }
      default:
        throw new BackendError("sem_servico");
    }
  };
  const rota = async <T,>(caminho: string, corpo: unknown): Promise<T> => {
    await espera();
    const b = corpo as Record<string, string>;
    if (caminho === "/api/rede/robos/conta") {
      const lista = robos[b.org] ?? (robos[b.org] = []);
      const selo = orgs.find((o) => o.handle === b.org)?.selo ?? false;
      const r: Robo = { id: `r${Date.now()}`, nome: b.nome, descricao: b.descricao, situacao: selo ? "ativo" : "esperando", handle: `robo_${Date.now().toString(16).slice(-8)}`, temChave: false, chaveDia: null, criadoDia: hoje(), usadoDia: null, hoje: 0 };
      lista.push(r);
      return { robo: r } as T;
    }
    if (caminho === "/api/rede/robos/chave") {
      for (const lista of Object.values(robos)) for (const r of lista) if (r.id === b.robo) { r.temChave = true; r.chaveDia = hoje(); return { chave: `alumia_robo_${"x".repeat(43)}`, robo: r } as T; }
      throw new BackendError("nao_encontrado");
    }
    if (caminho === "/api/rede/traduzir") return { titulo: null, texto: "[translation preview] The general assembly approved the strike starting Monday.", origem: "pt" } as T;
    throw new BackendError("sem_servico");
  };
  return { c, rota };
}

const duble = PREVIA_DAS_PONTES ? dubleDasPontes() : null;
export const pontes = duble ? criarClienteDasPontes(duble.c, duble.rota) : criarClienteDasPontes(chamar);
