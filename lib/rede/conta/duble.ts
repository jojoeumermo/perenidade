// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O dublê da prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim) do grupo "conta, identidade e convivência": responde na memória da aba, com dados
// de exemplo, as mesmas formas que o banco devolve. Nada vai a lugar nenhum. As regras de verdade são as do banco
// (supabase/migracoes/20261127-p4-conta.sql, provadas em scripts/testar-p4-conta.mjs). Sem "@/" de propósito.
import { BackendError } from "../../backend";
import type { Chamar } from "../cliente";
import type { AtendimentoDe, Cuidado, Escudo, Guia, Mediacao, MencaoNaFila, Mudanca, Prefs, Quiz } from "./cliente";
import { minutosDe, type Nivel } from "./regras";

const texto = (v: unknown, min: number, max: number, campo: string) => {
  const t = String(v ?? "").trim();
  if (t.length < min || t.length > max) throw new BackendError(`invalido:${campo}`);
  if (/\d{4,5}[-\s]?\d{4}|@[a-z0-9-]+\.[a-z]/i.test(t)) throw new BackendError("dado_pessoal");
  return t;
};

export function dubleDaConta(): Chamar {
  const prefs: Prefs = { mencao_revisar: false, mencao_quem: "todos", marcar_quem: "seguindo", marcar_aprovar: true, atendimento: null, ausencia: "", nivel: null, pendentes: 1 };
  let fila: MencaoNaFila[] = [{ post: "00000000-0000-4000-8000-000000000101", codinome: "Ventania", handle: "ventania", trecho: "Oi @voce, vem pro ato de sábado?", quando: new Date(Date.now() - 3_600_000).toISOString() }];
  const COMUNIDADES = [{ slug: "luta-moradia", nome: "Luta por moradia", modero: true, regras: true, boas_vindas: true, pedidos: true }];
  const escudo: Escudo = { travado_ate: null, modero: true, ligado: true, contas: 10, conta_dias: 7, minutos: 60, horas: 6 };
  const quiz: Quiz = { modero: true, aceitei: false, perguntas: [{ numero: 1, pergunta: "Pode atacar a pessoa em vez da ideia?", opcoes: ["Sim", "Não, só debater a ideia"], certa: 2 }] };
  const guia: Guia = { passos: [{ titulo: "Leia as regras", texto: "São curtas e valem para todo mundo.", link: "" }, { titulo: "Apresente-se", texto: "Diga de onde vem e o que te trouxe.", link: "" }], posso_editar: true };
  const cuidado: Cuidado = { sala: false, texto: "", modero: true };
  let mediacoes: Mediacao[] = [];
  const mudanca: Mudanca = { federada: true, handle: "voce", alvo: null, situacao: null, enviada_em: null, seguidoras: 4 };
  const contar = () => ({ ...prefs, pendentes: fila.length });

  const respostas: Record<string, (a: Record<string, unknown>) => unknown> = {
    rede_p4_ct_prefs: () => contar(),
    rede_p4_ct_mencao_revisar: (a) => ((prefs.mencao_revisar = !!a.p_sim), contar()),
    rede_p4_ct_mencoes: () => ({ itens: fila }),
    rede_p4_ct_mencao_decidir: (a) => {
      if (!fila.some((m) => m.post === a.p_post)) throw new BackendError("nao_encontrado");
      fila = fila.filter((m) => m.post !== a.p_post);
      return { ok: true };
    },
    rede_p4_ct_nivel: (a) => {
      const n = a.p_nivel as Nivel;
      if (!["basico", "reforcado", "maximo"].includes(n)) throw new BackendError("invalido:nivel");
      prefs.nivel = n;
      prefs.mencao_quem = n === "basico" ? "todos" : n === "reforcado" ? "seguindo" : "ninguem";
      prefs.marcar_quem = n === "maximo" ? "ninguem" : "seguindo";
      prefs.mencao_revisar = n !== "basico";
      return { ...contar(), sugestoes: n === "basico" ? [] : n === "reforcado" ? ["sair_rapido"] : ["sair_rapido", "print", "trancar", "fediverso"] };
    },
    rede_p4_ct_minhas: () => ({ comunidades: COMUNIDADES }),
    rede_p4_ct_escudo: () => escudo,
    rede_p4_ct_escudo_salvar: (a) => {
      const p = a.p as Partial<Escudo> & { destravar?: boolean };
      if (p.contas !== undefined && (p.contas < 3 || p.contas > 500)) throw new BackendError("invalido:contas");
      Object.assign(escudo, p, p.destravar ? { travado_ate: null } : {});
      delete (escudo as { destravar?: boolean }).destravar;
      return escudo;
    },
    rede_p4_ct_quiz: () => quiz,
    rede_p4_ct_quiz_salvar: (a) => {
      const p = a.p as Quiz["perguntas"];
      if (!Array.isArray(p) || p.length > 5) throw new BackendError("invalido:quiz");
      quiz.perguntas = p.map((q, i) => ({ numero: i + 1, pergunta: texto(q.pergunta, 5, 200, "pergunta"), opcoes: q.opcoes.map((o) => texto(o, 1, 120, "opcao")), certa: q.certa }));
      return quiz;
    },
    rede_p4_ct_quiz_responder: (a) => {
      const r = a.p_respostas as number[];
      const erradas = quiz.perguntas.filter((q, i) => q.certa !== r[i]).length;
      if (erradas) return { ok: false, erradas };
      quiz.aceitei = true;
      return { ok: true, lidas_em: new Date().toISOString() };
    },
    rede_p4_ct_guia: () => guia,
    rede_p4_ct_guia_salvar: (a) => {
      const p = a.p as Guia["passos"];
      if (!Array.isArray(p) || p.length > 6) throw new BackendError("invalido:guia");
      guia.passos = p.map((x) => ({ titulo: texto(x.titulo, 3, 80, "titulo"), texto: texto(x.texto, 0, 400, "texto"), link: String(x.link ?? "") }));
      return guia;
    },
    rede_p4_ct_cuidado: () => cuidado,
    rede_p4_ct_cuidados: () => ({ salas: cuidado.sala ? [{ slug: "luta-moradia", nome: "Luta por moradia" }] : [] }),
    rede_p4_ct_cuidado_marcar: (a) => Object.assign(cuidado, { sala: !!a.p_sim, texto: a.p_sim ? texto(a.p_texto, 0, 600, "texto") : "" }),
    rede_p4_ct_cuidado_encaminhar: () => {
      if (!cuidado.sala) throw new BackendError("nao_e_sala");
      return { ok: true };
    },
    rede_p4_ct_mediacoes: () => ({ itens: mediacoes }),
    rede_p4_ct_mediacao_abrir: (a) => {
      const m: Mediacao = {
        id: `00000000-0000-4000-8000-${String(mediacoes.length + 1).padStart(12, "0")}`,
        comunidade: { slug: String(a.p_slug), nome: "Luta por moradia" },
        situacao: "convite", acordo: "", criado_em: new Date().toISOString(), encerrada_em: null, sou: "mediadora", mediadora: "Você",
        partes: [{ codinome: String(a.p_handle_a), eu: false, aceite: "pendente", acordo_ok: false }, { codinome: String(a.p_handle_b), eu: false, aceite: "pendente", acordo_ok: false }],
        falas: [],
      };
      mediacoes = [m, ...mediacoes];
      return m;
    },
    rede_p4_ct_mediacao_responder: (a) => mudar(a.p_id, (m) => ({ ...m, situacao: a.p_aceitar ? "aberta" : "recusada" })),
    rede_p4_ct_mediacao_falar: (a) => mudar(a.p_id, (m) => ({ ...m, falas: [...m.falas, { id: m.falas.length + 1, codinome: "Você", eu: true, mediadora: m.sou === "mediadora", texto: texto(a.p_texto, 1, 1000, "texto"), quando: new Date().toISOString() }] })),
    rede_p4_ct_mediacao_propor: (a) => mudar(a.p_id, (m) => ({ ...m, acordo: texto(a.p_acordo, 10, 1500, "acordo") })),
    rede_p4_ct_mediacao_acordo: (a) => mudar(a.p_id, (m) => ({ ...m, situacao: a.p_sim ? "acordo" : m.situacao, falas: a.p_sim ? [] : m.falas })),
    rede_p4_ct_mediacao_encerrar: (a) => mudar(a.p_id, (m) => ({ ...m, situacao: "sem_acordo", acordo: "", falas: [] })),
    rede_p4_ct_atendimento_salvar: (a) => {
      const at = a.p_atendimento as { dias: number[]; de: string; ate: string } | null;
      if (at) {
        const de = minutosDe(at.de);
        const ate = minutosDe(at.ate);
        if (de === null || ate === null || de === ate || at.dias.length === 0) throw new BackendError("invalido:atendimento");
        prefs.atendimento = { dias: [...at.dias].sort(), de, ate };
      } else prefs.atendimento = null;
      prefs.ausencia = texto(a.p_ausencia, 0, 280, "ausencia");
      return contar();
    },
    rede_p4_ct_atendimento_de: (): AtendimentoDe | null => (prefs.ausencia ? { tem_horario: !!prefs.atendimento, fora: true, mensagem: prefs.ausencia, horario: prefs.atendimento } : null),
    rede_p4_ct_mudanca: () => mudanca,
    rede_p4_ct_mudanca_pedir: (a) => {
      const alvo = String(a.p_alvo ?? "").trim();
      if (alvo && !/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}\/\S*$/.test(alvo)) throw new BackendError("invalido:alvo");
      return Object.assign(mudanca, { alvo: alvo || null, situacao: alvo ? "conferir" : null });
    },
  };
  function mudar(id: unknown, f: (m: Mediacao) => Mediacao): Mediacao {
    const m = mediacoes.find((x) => x.id === id);
    if (!m) throw new BackendError("nao_encontrado");
    const novo = f(m);
    mediacoes = mediacoes.map((x) => (x.id === id ? novo : x));
    return novo;
  }
  return async <T,>(funcao: string, argumentos: Record<string, unknown> = {}) => {
    const r = respostas[funcao];
    if (!r) throw new BackendError("desligado");
    return structuredClone(r(argumentos)) as T;
  };
}
