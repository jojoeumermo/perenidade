// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";
//
// O lado do navegador do modo ato (frente 9C): as funções do banco de supabase/migracoes/20261115-alumia-o9-modoato.sql. Na
// prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim) nada vai a banco nenhum: um dublê na memória da aba faz a tela andar.
import { BackendError, rpc } from "../../backend";
import { previaLigada } from "../publicar/alumia2";

export interface PessoaDoAto {
  handle: string | null;
  nome: string;
}

export interface ContatoDeSeguranca extends PessoaDoAto {
  aceito: boolean;
}

export interface RecadoDoAto extends PessoaDoAto {
  id: string;
  tipo: "estou_bem" | "detido";
  criado_em: string;
  expira_em: string;
  /** O nome da organização, quando o "fui detido" chegou pela assessoria jurídica dela. */
  via_org: string | null;
}

export interface OrgComAssessoria {
  handle: string;
  nome: string;
  texto: string | null;
}

export interface SituacaoDoModoAto {
  contatos: ContatoDeSeguranca[];
  pedidos: PessoaDoAto[];
  sou_contato_de: PessoaDoAto[];
  recados: RecadoDoAto[];
  /** O "Fui detido" foi liberado pela coordenação no painel. */
  detido_ligado: boolean;
  /** As organizações com selo que a pessoa gere (para publicar o plantão jurídico). */
  minhas_orgs: OrgComAssessoria[];
}

const previa = () => previaLigada();
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const daqui = (min: number) => new Date(Date.now() + min * 60_000).toISOString();

// O dublê da prévia: a Faísca, com dois contatos (um já aceitou), um pedido, um recado e uma organização que ela gere.
let exemplo: SituacaoDoModoAto = {
  contatos: [
    { handle: "brasa", nome: "Brasa", aceito: true },
    { handle: "cais_do_porto", nome: "Cais", aceito: false },
  ],
  pedidos: [{ handle: "ventania", nome: "Ventania" }],
  sou_contato_de: [{ handle: "brasa", nome: "Brasa" }],
  recados: [{ id: "r1", handle: "brasa", nome: "Brasa", tipo: "estou_bem", criado_em: daqui(-38), expira_em: daqui(24 * 60 - 38), via_org: null }],
  detido_ligado: true,
  minhas_orgs: [{ handle: "coletivo_faisca", nome: "Coletivo Faísca", texto: "Plantão da Comissão de Direitos Humanos, todo dia de ato das 8h às 22h. Peça pelo plantão do coletivo." }],
};
const ASSESSORIAS_DA_PREVIA: OrgComAssessoria[] = [
  { handle: "coletivo_faisca", nome: "Coletivo Faísca", texto: exemplo.minhas_orgs[0].texto },
  { handle: "sindicato_aurora", nome: "Sindicato Aurora", texto: "Advogadas do sindicato atendem em plantão durante os atos convocados pela categoria." },
];
const copia = (): SituacaoDoModoAto => structuredClone(exemplo);
const limpo = (h: string) => h.replace(/^@/, "").trim().toLowerCase();

export const modoAto = {
  situacao: async (): Promise<SituacaoDoModoAto> => {
    if (previa()) return copia();
    return rpc<SituacaoDoModoAto>("alumia_ato_situacao");
  },

  pedirContato: async (handle: string): Promise<SituacaoDoModoAto> => {
    if (previa()) {
      await espera(250);
      const h = limpo(handle);
      if (!/^[a-z0-9_]{3,20}$/.test(h) || h === "faisca") throw new BackendError("nao_encontrado");
      if (!exemplo.contatos.some((c) => c.handle === h)) {
        if (exemplo.contatos.length >= 10) throw new BackendError("limite_de_contatos");
        exemplo = { ...exemplo, contatos: [...exemplo.contatos, { handle: h, nome: h.charAt(0).toUpperCase() + h.slice(1), aceito: false }] };
      }
      return copia();
    }
    return rpc<SituacaoDoModoAto>("alumia_ato_contato_pedir", { p_handle: handle });
  },

  responder: async (handle: string, aceito: boolean): Promise<SituacaoDoModoAto> => {
    if (previa()) {
      await espera(200);
      const p = exemplo.pedidos.find((x) => x.handle === handle);
      exemplo = { ...exemplo, pedidos: exemplo.pedidos.filter((x) => x.handle !== handle), sou_contato_de: aceito && p ? [...exemplo.sou_contato_de, p] : exemplo.sou_contato_de };
      return copia();
    }
    return rpc<SituacaoDoModoAto>("alumia_ato_contato_responder", { p_handle: handle, p_aceito: aceito });
  },

  tirar: async (handle: string): Promise<SituacaoDoModoAto> => {
    if (previa()) {
      await espera(200);
      exemplo = {
        ...exemplo,
        contatos: exemplo.contatos.filter((c) => c.handle !== handle),
        sou_contato_de: exemplo.sou_contato_de.filter((c) => c.handle !== handle),
        recados: exemplo.recados.filter((r) => r.handle !== handle),
      };
      return copia();
    }
    return rpc<SituacaoDoModoAto>("alumia_ato_contato_tirar", { p_handle: handle });
  },

  estouBem: async (): Promise<{ avisados: number }> => {
    if (previa()) {
      await espera(500);
      const n = exemplo.contatos.filter((c) => c.aceito).length;
      if (n === 0) throw new BackendError("sem_contatos");
      return { avisados: n };
    }
    return rpc<{ avisados: number }>("alumia_ato_estou_bem");
  },

  fuiDetido: async (org: string | null): Promise<{ avisados: number; assessoria: boolean }> => {
    if (previa()) {
      await espera(500);
      const n = exemplo.contatos.filter((c) => c.aceito).length + (org ? 2 : 0);
      if (n === 0) throw new BackendError("sem_contatos");
      return { avisados: n, assessoria: !!org };
    }
    return rpc<{ avisados: number; assessoria: boolean }>("alumia_ato_fui_detido", { p_org: org });
  },

  apagarRecado: async (id: string): Promise<SituacaoDoModoAto> => {
    if (previa()) {
      exemplo = { ...exemplo, recados: exemplo.recados.filter((r) => r.id !== id) };
      return copia();
    }
    return rpc<SituacaoDoModoAto>("alumia_ato_recado_apagar", { p_id: id });
  },

  assessorias: async (): Promise<OrgComAssessoria[]> => {
    if (previa()) return structuredClone(ASSESSORIAS_DA_PREVIA);
    return rpc<OrgComAssessoria[]>("alumia_ato_assessorias");
  },

  guardarAssessoria: async (org: string, texto: string): Promise<SituacaoDoModoAto> => {
    if (previa()) {
      await espera(250);
      const t = texto.trim();
      if (t && (t.length < 10 || t.length > 400 || /[<>]/.test(t))) throw new BackendError("invalido:texto");
      exemplo = { ...exemplo, minhas_orgs: exemplo.minhas_orgs.map((o) => (o.handle === org ? { ...o, texto: t || null } : o)) };
      return copia();
    }
    return rpc<SituacaoDoModoAto>("alumia_ato_assessoria_guardar", { p_org: org, p_texto: texto });
  },
};
