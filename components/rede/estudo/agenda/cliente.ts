// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O lado do navegador da agenda de provas e da monitoria (frente 11C): as funções alumia_agenda_* e alumia_monitoria* de
// supabase/migracoes/20261117-alumia-o11-turma.sql. Na prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim) nada vai a banco nenhum: um dublê
// na memória da aba faz a tela andar. As datas do ENEM do dublê são as do site (com a fonte do Inep); a outra prova é exemplo.
import { BackendError, rpc } from "@/lib/backend";
import { previaLigada } from "@/lib/rede/publicar/alumia2";
import {
  datasDoSite, DISCIPLINAS, fonteValida, LIMITES_DA_MONITORIA, type AgendaDeProvas, type DadosDaData, type DataDaAgenda, type Disciplina,
  type JanelaMinha, type Monitor, type Monitoria,
} from "./regras";

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const dois = (n: number) => String(n).padStart(2, "0");
const hojeEmBrasilia = () => {
  const d = new Date(Date.now() - 3 * 3_600_000);
  return `${d.getUTCFullYear()}-${dois(d.getUTCMonth() + 1)}-${dois(d.getUTCDate())}`;
};
const somar = (dia: string, n: number) => {
  const [a, m, d] = dia.split("-").map(Number);
  const x = new Date(Date.UTC(a, m - 1, d + n));
  return `${x.getUTCFullYear()}-${dois(x.getUTCMonth() + 1)}-${dois(x.getUTCDate())}`;
};
const daqui = (horas: number, minuto = 0) => {
  const d = new Date(Date.now() + horas * 3_600_000);
  d.setMinutes(minuto, 0, 0);
  return d.toISOString();
};

// ───── O dublê da prévia ─────
let datasDaPrevia: DataDaAgenda[] | null = null;
function datas(): DataDaAgenda[] {
  if (datasDaPrevia) return datasDaPrevia;
  const hoje = hojeEmBrasilia();
  const doSite = datasDoSite(somar(hoje, -7)).map((d, i) => ({ ...d, id: `enem-${i}`, hora: d.etapa.includes("dia de provas") ? "13:30" : null, assinada: i === 1 }));
  const exemplo = (i: number, etapa: string, dias: number, hora: string | null): DataDaAgenda => ({
    id: `exemplo-${i}`, exame: "Vestibular de exemplo", etapa, dia: somar(hoje, dias), hora, orgao: "Banca de exemplo", fonte: "https://exemplo.org/edital",
    conferido_em: somar(hoje, -3), assinada: i === 0,
  });
  datasDaPrevia = [...doSite, exemplo(0, "Fim das inscrições", 9, null), exemplo(1, "Primeira fase", 23, "13:00"), exemplo(2, "Segunda fase · redação", 51, "13:00")];
  return datasDaPrevia;
}
const agendaDaPrevia = (): AgendaDeProvas => ({ pode_cuidar: true, hoje: hojeEmBrasilia(), itens: structuredClone(datas()) });

let monitoriaDaPrevia: Monitoria = {
  pode_nomear: true,
  eu: { situacao: "ativo", disciplinas: ["matematica", "natureza"] },
  abertas: [
    { id: "j1", disciplina: "matematica", inicio: daqui(26, 0), duracao: 45, sala: "conversa", aula: null, nota: "Funções e gráficos", cancelada: false },
    { id: "j2", disciplina: "redacao", inicio: daqui(28, 30), duracao: 60, sala: "aula", aula: null, nota: "Proposta de intervenção, competência 5", cancelada: false },
    { id: "j3", disciplina: "humanas", inicio: daqui(50, 0), duracao: 45, sala: "conversa", aula: null, nota: "", cancelada: false },
    { id: "j4", disciplina: "linguagens", inicio: daqui(75, 0), duracao: 30, sala: "conversa", aula: null, nota: "Interpretação de texto", cancelada: false },
  ],
  marcadas: [
    { id: "j9", disciplina: "natureza", inicio: daqui(5, 0), duracao: 45, sala: "conversa", aula: null, nota: "Estequiometria", cancelada: false, monitor: { nome: "Brasa", handle: "brasa" }, duvida: "Não entendo mol." },
  ],
  minhas: [
    { id: "m1", disciplina: "matematica", inicio: daqui(30, 0), duracao: 60, sala: "conversa", aula: null, nota: "Porcentagem e juros", cancelada: false, vagas: 3,
      marcas: [{ nome: "Ventania", handle: "ventania", duvida: "Juros compostos no ENEM." }, { nome: "Cais", handle: "cais_do_porto", duvida: "" }] },
    { id: "m2", disciplina: "natureza", inicio: daqui(98, 0), duracao: 45, sala: "conversa", aula: null, nota: "", cancelada: false, vagas: 1, marcas: [] },
  ],
  aulas: [{ id: "6f1c2b8e-1a2b-4c3d-8e9f-001122334455", titulo: "Plantão de exatas", inicio: daqui(48, 0) }],
};
let monitoresDaPrevia: Monitor[] = [
  { nome: "Faísca", handle: "faisca", disciplinas: ["matematica", "natureza"], situacao: "ativo" },
  { nome: "Brasa", handle: "brasa", disciplinas: ["natureza"], situacao: "ativo" },
  { nome: "Maré", handle: "mare", disciplinas: ["redacao", "linguagens"], situacao: "convidado" },
];
const copiaM = () => structuredClone(monitoriaDaPrevia);

export const agenda = {
  datas: async (): Promise<AgendaDeProvas> => {
    if (previaLigada()) return agendaDaPrevia();
    return rpc<AgendaDeProvas>("alumia_agenda_datas");
  },

  assinar: async (ids: string[], sim: boolean): Promise<AgendaDeProvas> => {
    if (previaLigada()) {
      await espera(150);
      datasDaPrevia = datas().map((d) => (ids.includes(d.id) ? { ...d, assinada: sim } : d));
      return agendaDaPrevia();
    }
    return rpc<AgendaDeProvas>("alumia_agenda_assinar", { p_datas: ids, p_sim: sim });
  },

  salvar: async (id: string | null, dados: DadosDaData): Promise<DataDaAgenda> => {
    if (previaLigada()) {
      await espera(250);
      if (!fonteValida(dados.fonte)) throw new BackendError("invalido:fonte");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dados.dia)) throw new BackendError("invalido:dia");
      const ja = datas().find((d) => (id ? d.id === id : d.exame === dados.exame && d.etapa === dados.etapa && d.dia === dados.dia));
      const nova: DataDaAgenda = { ...dados, hora: dados.hora || null, id: ja?.id ?? `nova-${Date.now()}`, assinada: ja?.assinada ?? false };
      datasDaPrevia = ja ? datas().map((d) => (d.id === ja.id ? nova : d)) : [...datas(), nova];
      return nova;
    }
    return rpc<DataDaAgenda>("alumia_agenda_salvar", { p_id: id, p: dados });
  },

  apagar: async (id: string): Promise<void> => {
    if (previaLigada()) {
      await espera(200);
      datasDaPrevia = datas().filter((d) => d.id !== id);
      return;
    }
    await rpc("alumia_agenda_apagar", { p_id: id });
  },
};

export interface Oferta {
  disciplina: Disciplina;
  inicio: string;
  duracao: number;
  vagas: number;
  sala: "conversa" | "aula";
  aula: string | null;
  nota: string;
}

export const monitoria = {
  situacao: async (): Promise<Monitoria> => {
    if (previaLigada()) return copiaM();
    return rpc<Monitoria>("alumia_monitoria");
  },

  marcar: async (janela: string, duvida: string): Promise<Monitoria> => {
    if (previaLigada()) {
      await espera(300);
      const j = monitoriaDaPrevia.abertas.find((x) => x.id === janela);
      if (!j) throw new BackendError("nao_encontrado");
      if (monitoriaDaPrevia.marcadas.length >= LIMITES_DA_MONITORIA.marcasAFrente) throw new BackendError("limite_de_marcas");
      monitoriaDaPrevia = {
        ...monitoriaDaPrevia,
        abertas: monitoriaDaPrevia.abertas.filter((x) => x.id !== janela),
        marcadas: [...monitoriaDaPrevia.marcadas, { ...j, monitor: { nome: "Maré", handle: "mare" }, duvida: duvida.trim() }].sort((a, b) => a.inicio.localeCompare(b.inicio)),
      };
      return copiaM();
    }
    // Horário cheio volta como resposta (não como erro), para o pedido contar no freio de marcar.
    const r = await rpc<{ erro?: string }>("alumia_monitoria_marcar", { p_janela: janela, p_duvida: duvida });
    if (r?.erro) throw new BackendError(r.erro);
    return rpc<Monitoria>("alumia_monitoria");
  },

  desmarcar: async (janela: string): Promise<Monitoria> => {
    if (previaLigada()) {
      await espera(200);
      const j = monitoriaDaPrevia.marcadas.find((x) => x.id === janela);
      monitoriaDaPrevia = {
        ...monitoriaDaPrevia,
        marcadas: monitoriaDaPrevia.marcadas.filter((x) => x.id !== janela),
        abertas: j ? [...monitoriaDaPrevia.abertas, { id: j.id, disciplina: j.disciplina, inicio: j.inicio, duracao: j.duracao, sala: j.sala, aula: null, nota: j.nota, cancelada: false }].sort((a, b) => a.inicio.localeCompare(b.inicio)) : monitoriaDaPrevia.abertas,
      };
      return copiaM();
    }
    await rpc("alumia_monitoria_desmarcar", { p_janela: janela });
    return rpc<Monitoria>("alumia_monitoria");
  },

  oferecer: async (o: Oferta): Promise<Monitoria> => {
    if (previaLigada()) {
      await espera(250);
      if (!o.inicio || new Date(o.inicio).getTime() < Date.now() + 3_600_000) throw new BackendError("invalido:inicio");
      const nova: JanelaMinha = { id: `m-${Date.now()}`, ...o, aula: o.sala === "aula" ? o.aula : null, cancelada: false, marcas: [] };
      monitoriaDaPrevia = { ...monitoriaDaPrevia, minhas: [...monitoriaDaPrevia.minhas, nova].sort((a, b) => a.inicio.localeCompare(b.inicio)) };
      return copiaM();
    }
    await rpc("alumia_monitoria_oferecer", { p: o });
    return rpc<Monitoria>("alumia_monitoria");
  },

  cancelar: async (janela: string): Promise<Monitoria> => {
    if (previaLigada()) {
      await espera(200);
      monitoriaDaPrevia = { ...monitoriaDaPrevia, minhas: monitoriaDaPrevia.minhas.map((j) => (j.id === janela ? { ...j, cancelada: true } : j)) };
      return copiaM();
    }
    await rpc("alumia_monitoria_cancelar", { p_janela: janela });
    return rpc<Monitoria>("alumia_monitoria");
  },

  responder: async (aceita: boolean): Promise<Monitoria> => {
    if (previaLigada()) {
      await espera(200);
      monitoriaDaPrevia = { ...monitoriaDaPrevia, eu: aceita && monitoriaDaPrevia.eu ? { ...monitoriaDaPrevia.eu, situacao: "ativo" } : null };
      return copiaM();
    }
    return rpc<Monitoria>("alumia_monitoria_responder", { p_aceita: aceita });
  },

  deixar: async (): Promise<Monitoria> => {
    if (previaLigada()) {
      await espera(200);
      monitoriaDaPrevia = { ...monitoriaDaPrevia, eu: null, minhas: [] };
      return copiaM();
    }
    return rpc<Monitoria>("alumia_monitoria_deixar");
  },

  monitores: async (): Promise<Monitor[]> => {
    if (previaLigada()) return structuredClone(monitoresDaPrevia);
    return (await rpc<{ itens: Monitor[] }>("alumia_monitoria_monitores")).itens;
  },

  nomear: async (handle: string, disciplinas: Disciplina[]): Promise<Monitor[]> => {
    if (previaLigada()) {
      await espera(250);
      const h = handle.replace(/^@/, "").trim().toLowerCase();
      if (!/^[a-z0-9_]{3,20}$/.test(h)) throw new BackendError("invalido:pessoa");
      if (disciplinas.length === 0 || !disciplinas.every((d) => (DISCIPLINAS as readonly string[]).includes(d))) throw new BackendError("invalido:disciplinas");
      const ja = monitoresDaPrevia.find((m) => m.handle === h);
      monitoresDaPrevia = ja
        ? monitoresDaPrevia.map((m) => (m.handle === h ? { ...m, disciplinas } : m))
        : [...monitoresDaPrevia, { nome: h.charAt(0).toUpperCase() + h.slice(1), handle: h, disciplinas, situacao: "convidado" }];
      return structuredClone(monitoresDaPrevia);
    }
    return (await rpc<{ itens: Monitor[] }>("alumia_monitoria_nomear", { p_handle: handle, p_disciplinas: disciplinas })).itens;
  },

  tirar: async (handle: string): Promise<Monitor[]> => {
    if (previaLigada()) {
      await espera(200);
      monitoresDaPrevia = monitoresDaPrevia.filter((m) => m.handle !== handle);
      return structuredClone(monitoresDaPrevia);
    }
    return (await rpc<{ itens: Monitor[] }>("alumia_monitoria_tirar", { p_handle: handle })).itens;
  },
};
