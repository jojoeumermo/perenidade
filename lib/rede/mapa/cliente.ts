// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O lado do navegador da frente 13B: o mapa (rede_mapa) e o "Pergunte a…" ao vivo (rede_ama_*), de
// supabase/migracoes/20261119-alumia-o13-mapa.sql. Na prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim) nada vai a banco nenhum: um dublê na
// memória da aba faz as telas andarem, com as mesmas regras (número só a partir de 3, ordem de chegada, a vez é a primeira da fila).
import { BackendError, rpc } from "@/lib/backend";
import { previaLigada } from "@/lib/rede/publicar/alumia2";
import { limparMapa, MINIMO } from "./regras";
import type { AgendaAoVivo, LugarDoMapa, Mapa, MotivoDaRetirada, PedidoDeSessao, PerguntaAoVivo, SessaoAoVivo, SessaoComPerguntas, SessoesDaCaixa } from "./tipos";
import { LIMITES_DO_AO_VIVO as L } from "./tipos";

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ───── O dublê do mapa ─────
const lugar = (nome: string, uf: string | null, escrito: string, ch: number, ev: number, orgs: string[] = []): LugarDoMapa => ({
  nome, uf, escrito,
  chamados: ch >= MINIMO ? ch : null, chamados_ha: ch > 0,
  eventos: ev >= MINIMO ? ev : null, eventos_ha: ev > 0,
  nucleos_ha: orgs.length > 0,
  orgs: orgs.map((o) => ({ handle: o.toLowerCase().replace(/[^a-z]/g, ""), nome: o })),
});
const MAPA_DA_PREVIA: Mapa = {
  dias: 60,
  lugares: [
    lugar("sao paulo", null, "São Paulo", 14, 6, ["Coletivo Lume", "Sindicato Brasa"]),
    lugar("sao paulo", "SP", "São Paulo - SP", 2, 0),
    lugar("rio de janeiro", null, "Rio de Janeiro", 7, 2, ["Coletivo Lume"]),
    lugar("recife", "PE", "Recife/PE", 2, 4, ["Movimento Maré"]),
    lugar("belo horizonte", null, "Belo Horizonte", 5, 1),
    lugar("porto alegre", null, "Porto Alegre", 3, 3, ["Grêmio Farol"]),
    lugar("salvador", null, "Salvador", 9, 0, ["Movimento Maré"]),
    lugar("fortaleza", null, "Fortaleza", 1, 1),
    lugar("belem", null, "Belém", 4, 0),
    lugar("manaus", null, "Manaus", 2, 0),
    lugar("curitiba", null, "Curitiba", 3, 1),
    lugar("goiania", null, "Goiânia", 0, 3),
    lugar("florianopolis", null, "Florianópolis", 1, 0, ["Coletivo Lume"]),
    lugar("natal", null, "Natal", 1, 0),
    lugar("campinas", null, "Campinas", 3, 0),
    lugar("sao bernardo do campo", null, "São Bernardo do Campo", 11, 0, ["Sindicato Brasa"]),
    lugar("juazeiro do norte", null, "Juazeiro do Norte", 0, 1),
    lugar("brasilia", null, "Brasília", 6, 2),
    lugar("teresina", null, "Teresina", 1, 0),
    lugar("cuiaba", null, "Cuiabá", 0, 1),
    lugar("boa vista", null, "Boa Vista", 0, 0, ["Movimento Maré"]),
    lugar("bom jesus", null, "Bom Jesus", 2, 0),
    lugar("vila esperanca do norte", null, "Vila Esperança do Norte", 1, 0),
  ],
};

// ───── O dublê do ao vivo: a Faísca responde numa sessão no ar e tem um convite esperando ─────
const agora = () => Date.now();
const iso = (ms: number) => new Date(ms).toISOString();
const momento = (s: { inicio: string; fim: string }) => (agora() < Date.parse(s.inicio) ? "antes" : agora() <= Date.parse(s.fim) ? "ao_vivo" : "encerrada");
interface SessaoDoDuble extends Omit<SessaoComPerguntas, "momento" | "perguntas" | "vez"> {
  dono: string | null;
  slug: string | null;
}
const FAISCA = { handle: "faisca", nome: "Faísca" };
const pergunta = (id: string, texto: string, minutosAtras: number, extra: Partial<PerguntaAoVivo> = {}): PerguntaAoVivo => ({
  id, texto, situacao: "fila", resposta: null, respondida_em: null, criado_em: iso(agora() - minutosAtras * 60e3), motivo: null, quem: null, minha: false, ...extra,
});
let sessoesDaPrevia: SessaoDoDuble[] = [
  {
    id: "s-agora", titulo: "Moradia: como organizar a assembleia do prédio", inicio: iso(agora() - 25 * 60e3), fim: iso(agora() + 35 * 60e3),
    situacao: "marcada", convidada: FAISCA, de: { tipo: "comunidade", slug: "moradia", nome: "Moradia" }, cuida: false, sou_convidada: true,
    dono: null, slug: "moradia", pode_perguntar: false,
    lista: [
      pergunta("q1", "Quanto tempo antes vocês avisaram os vizinhos da primeira assembleia?", 24, { situacao: "respondida", resposta: "Duas semanas antes, com cartaz no elevador e um bilhete por baixo de cada porta. Na véspera, de porta em porta.", respondida_em: iso(agora() - 20 * 60e3), quem: "Lia" }),
      pergunta("q2", "Pergunta retirada", 21, { situacao: "retirada", texto: null, motivo: "dado_pessoal" }),
      pergunta("q3", "O síndico pode proibir a assembleia no salão de festas?", 18, { situacao: "passada" }),
      pergunta("q4", "Como dividir as tarefas sem cair tudo nas mesmas três pessoas?", 12, { quem: "Tainá" }),
      pergunta("q5", "Vale chamar a defensoria logo na primeira conversa?", 9),
      pergunta("q6", "E quando o prédio tem muita gente de aluguel por temporada?", 4),
    ],
  },
  {
    id: "s-depois", titulo: "Pergunte à professora de Química", inicio: iso(agora() + 2 * 86400e3), fim: iso(agora() + 2 * 86400e3 + 60 * 60e3),
    situacao: "marcada", convidada: { handle: "profa_rita", nome: "Rita" }, de: { tipo: "comunidade", slug: "quimica", nome: "Química" }, cuida: false, sou_convidada: false,
    dono: null, slug: "quimica", pode_perguntar: true, lista: [pergunta("r1", "Como estudar estequiometria sem decorar?", 60)],
  },
  {
    id: "s-convite", titulo: "Transporte: a tarifa zero na cidade", inicio: iso(agora() + 5 * 86400e3), fim: iso(agora() + 5 * 86400e3 + 90 * 60e3),
    situacao: "convite", convidada: FAISCA, de: { tipo: "comunidade", slug: "transporte", nome: "Transporte" }, cuida: false, sou_convidada: true,
    dono: null, slug: "transporte", pode_perguntar: false, lista: [],
  },
];
function vistaDaSessao(s: SessaoDoDuble): SessaoComPerguntas {
  const visiveis = s.lista.filter((q) => q.situacao !== "retirada").length;
  const { dono: _d, slug: _s, ...resto } = s;
  void _d;
  void _s;
  return { ...resto, momento: momento(s), perguntas: visiveis >= MINIMO ? visiveis : null, vez: s.lista.find((q) => q.situacao === "fila")?.id ?? null };
}
const resumo = (s: SessaoDoDuble): SessaoAoVivo => {
  const { vez: _v, lista: _l, pode_perguntar: _p, ...r } = vistaDaSessao(s);
  void _v;
  void _l;
  void _p;
  return r;
};
function achar(id: string): SessaoDoDuble {
  const s = sessoesDaPrevia.find((x) => x.id === id);
  if (!s) throw new BackendError("nao_encontrado");
  return s;
}
function trocar(id: string, mudar: (s: SessaoDoDuble) => SessaoDoDuble) {
  sessoesDaPrevia = sessoesDaPrevia.map((x) => (x.id === id ? mudar(x) : x));
}
function acharPergunta(id: string): [SessaoDoDuble, PerguntaAoVivo] {
  for (const s of sessoesDaPrevia) {
    const q = s.lista.find((x) => x.id === id);
    if (q) return [s, q];
  }
  throw new BackendError("nao_encontrado");
}
const trocarPergunta = (id: string, mudar: (q: PerguntaAoVivo) => PerguntaAoVivo | null) => {
  const [s] = acharPergunta(id);
  trocar(s.id, (x) => ({ ...x, lista: x.lista.flatMap((q) => (q.id === id ? (mudar(q) ?? []) : [q])) }));
};
let contador = 0;

/** Desconfia do servidor: o número de perguntas abaixo de 3 vira nulo. */
function limparSessao<T extends SessaoAoVivo>(s: T): T {
  return { ...s, perguntas: typeof s.perguntas === "number" && s.perguntas >= MINIMO ? s.perguntas : null };
}

export const mapa = {
  /** O mapa inteiro, já agregado por cidade. */
  ler: async (): Promise<Mapa> => {
    if (previaLigada()) {
      await espera(200);
      return limparMapa(structuredClone(MAPA_DA_PREVIA));
    }
    return limparMapa(await rpc<Mapa>("rede_mapa"));
  },
};

export const aoVivo = {
  /** A agenda: no ar, próximas (14 dias) e os convites da pessoa. */
  agenda: async (): Promise<AgendaAoVivo> => {
    if (previaLigada()) {
      await espera(150);
      const marcadas = sessoesDaPrevia.filter((s) => s.situacao === "marcada" && Date.parse(s.fim) >= agora());
      return {
        ao_vivo: marcadas.filter((s) => momento(s) === "ao_vivo").map(resumo),
        proximas: marcadas.filter((s) => momento(s) === "antes").map(resumo),
        convites: sessoesDaPrevia.filter((s) => s.situacao === "convite" && s.sou_convidada).map(resumo),
      };
    }
    const a = await rpc<AgendaAoVivo>("rede_ama_agenda");
    return { ao_vivo: (a?.ao_vivo ?? []).map(limparSessao), proximas: (a?.proximas ?? []).map(limparSessao), convites: (a?.convites ?? []).map(limparSessao) };
  },

  /** As sessões de uma caixa (a de uma pessoa, pelo @, ou a de uma comunidade, pelo slug). */
  daCaixa: async (alvo: { handle?: string; slug?: string }): Promise<SessoesDaCaixa> => {
    if (previaLigada()) {
      await espera(150);
      const daqui = sessoesDaPrevia.filter((s) => (alvo.slug ? s.slug === alvo.slug : s.dono === (alvo.handle ?? "")) && s.situacao !== "cancelada");
      return { cuida: true, sessoes: daqui.map(resumo) };
    }
    const r = await rpc<SessoesDaCaixa>("rede_ama_lista", { p_handle: alvo.handle ?? null, p_slug: alvo.slug ?? null });
    return { cuida: r?.cuida === true, sessoes: (r?.sessoes ?? []).map(limparSessao) };
  },

  /** Uma sessão com as perguntas, por ordem de chegada. */
  sessao: async (id: string): Promise<SessaoComPerguntas> => {
    if (previaLigada()) {
      await espera(120);
      return structuredClone(vistaDaSessao(achar(id)));
    }
    const s = await rpc<SessaoComPerguntas>("rede_ama", { p_id: id });
    return limparSessao({ ...s, lista: Array.isArray(s?.lista) ? s.lista : [] });
  },

  marcar: async (alvo: { slug?: string | null }, p: PedidoDeSessao): Promise<{ id: string; situacao: string }> => {
    if (previaLigada()) {
      await espera(250);
      if (p.titulo.trim().length < L.tituloMin) throw new BackendError("invalido:titulo");
      const id = `s-nova-${++contador}`;
      const inicio = Date.parse(p.inicio);
      if (!Number.isFinite(inicio) || inicio < agora() + 10 * 60e3) throw new BackendError("invalido:inicio");
      sessoesDaPrevia = [...sessoesDaPrevia, {
        id, titulo: p.titulo.trim(), inicio: iso(inicio), fim: iso(inicio + p.minutos * 60e3), situacao: alvo.slug ? "convite" : "marcada",
        convidada: alvo.slug ? { handle: (p.convidada ?? "").replace(/^@/, ""), nome: (p.convidada ?? "").replace(/^@/, "") } : FAISCA,
        de: alvo.slug ? { tipo: "comunidade", slug: alvo.slug, nome: alvo.slug } : { tipo: "pessoa", ...FAISCA }, cuida: true, sou_convidada: !alvo.slug,
        dono: alvo.slug ? null : "", slug: alvo.slug ?? null, pode_perguntar: false, lista: [],
      }];
      return { id, situacao: alvo.slug ? "convite" : "marcada" };
    }
    return rpc("rede_ama_marcar", { p_slug: alvo.slug ?? null, p: { titulo: p.titulo, inicio: p.inicio, minutos: p.minutos, convidada: p.convidada ?? null } });
  },

  convite: async (id: string, aceita: boolean): Promise<void> => {
    if (previaLigada()) {
      await espera(200);
      trocar(id, (s) => ({ ...s, situacao: aceita ? "marcada" : "recusada" }));
      return;
    }
    await rpc("rede_ama_convite", { p_id: id, p_aceita: aceita });
  },

  cancelar: async (id: string): Promise<void> => {
    if (previaLigada()) {
      await espera(200);
      trocar(id, (s) => ({ ...s, situacao: "cancelada", lista: [] }));
      return;
    }
    await rpc("rede_ama_cancelar", { p_id: id });
  },

  perguntar: async (id: string, texto: string, mostrarNome: boolean): Promise<void> => {
    if (previaLigada()) {
      await espera(200);
      const t = texto.replace(/\s+/g, " ").trim();
      if (t.length < L.perguntaMin) throw new BackendError("invalido:texto");
      trocar(id, (s) => ({ ...s, lista: [...s.lista, pergunta(`q-nova-${++contador}`, t, 0, { minha: true, quem: mostrarNome ? FAISCA.nome : null })] }));
      return;
    }
    await rpc("rede_ama_perguntar", { p_id: id, p_texto: texto, p_mostrar_nome: mostrarNome });
  },

  /** A convidada responde (texto) ou passa (nulo) a pergunta da vez. */
  responder: async (pergunta: string, resposta: string | null): Promise<void> => {
    if (previaLigada()) {
      await espera(200);
      const [s] = acharPergunta(pergunta);
      if (s.lista.find((q) => q.situacao === "fila")?.id !== pergunta) throw new BackendError("fora_da_vez");
      trocarPergunta(pergunta, (q) => (resposta === null ? { ...q, situacao: "passada" } : { ...q, situacao: "respondida", resposta: resposta.trim(), respondida_em: iso(agora()) }));
      return;
    }
    await rpc("rede_ama_responder", { p_pergunta: pergunta, p_resposta: resposta });
  },

  /** Retira: sem motivo, a própria pergunta (some); com motivo, quem cuida (fica como retirada, sem texto). */
  retirar: async (pergunta: string, motivo: MotivoDaRetirada | null = null): Promise<void> => {
    if (previaLigada()) {
      await espera(200);
      trocarPergunta(pergunta, (q) => (motivo ? { ...q, situacao: "retirada", texto: null, motivo, resposta: null } : null));
      return;
    }
    await rpc("rede_ama_retirar", { p_pergunta: pergunta, p_motivo: motivo });
  },
};
