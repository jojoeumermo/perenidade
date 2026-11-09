// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O DUBLÊ das funções de atos (rede_atos, rede_ato, rede_ato_proximo, rede_ato_vou, rede_ato_mudar, rede_ato_publicar) com os
// dados das pranchas, só para a prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim): as funções de verdade (supabase/migracoes/
// 20261109-alumia-f2.sql) têm o mesmo contrato (lib/rede/tipos-atos.ts). Tudo fica na memória da aba; nada sai do aparelho. Os nomes são ilustrativos (não são pessoas).
// O dublê segue as mesmas regras do banco: proporção em passos de 10 % e nula abaixo de 3; total só para quem organizou.
// Sem "@/" de propósito (roda no Node nos testes).
import { proporcaoDoMosaico } from "../mosaico";
import { elosDaCorrente } from "./corrente";
import type { Ato, Corrente, EstadoDoFarol, FarolDoAto, FiltroDosAtos, OrgQuePosso, PaginaDeAtos, PedidoDeMudanca, RespostaDoVou } from "../tipos-atos";

/**
 * Os atos de exemplo, com o DIA relativo a `agora` e a HORA fixa como nas pranchas (Passe Livre às 18h, Vigília às 6h, RU às
 * 11h): a foto de uma hora e a de outra mostram a mesma hora. A contagem da faixa ("2d 04h") fica só aproximada.
 */
export function atosDeExemplo(agora: number = Date.now()): { ato: Ato; confirmados: number }[] {
  const dia = (n: number, h: number) => {
    const d = new Date(agora);
    d.setDate(d.getDate() + n);
    d.setHours(h, 0, 0, 0);
    return d.toISOString();
  };
  const base = {
    inicio_anterior: null,
    motivo: "",
    total: null,
    vou_eu: false,
    meu: false,
    link_apoio: null,
  };
  return [
    {
      confirmados: 26,
      ato: {
        ...base,
        id: "0e1b6c1a-5d1f-4c3e-9a51-6f3a2b1c0d01",
        titulo: "Passe Livre Já",
        palavra: "PASSE LIVRE",
        comunidade: { slug: "passe-livre-sp", nome: "Passe Livre SP", cor: 1 },
        chamado_por: "passelivre_sp",
        inicio: dia(2, 18),
        onde: "Praça da Sé · concentração na escadaria da catedral",
        cidade: "São Paulo",
        descricao: "Tarifa zero para estudantes e desempregados. Traga sua faixa, água e o cartão de transporte.",
        situacao: "confirmado",
        acesos: null,
        vou_eu: true,
        respostas: 48,
        link_apoio: "https://exemplo.org/fundo-do-passe-livre",
      },
    },
    {
      confirmados: 14,
      ato: {
        ...base,
        id: "0e1b6c1a-5d1f-4c3e-9a51-6f3a2b1c0d02",
        titulo: "Vigília na ocupação Esperança",
        palavra: "FICA ESPERANCA",
        comunidade: { slug: "moradia-zona-leste", nome: "Moradia Zona Leste", cor: 3 },
        chamado_por: "moradia_zl",
        inicio: dia(9, 6),
        inicio_anterior: dia(6, 6),
        onde: "Ocupação Esperança, Itaquera · na porta da ocupação",
        cidade: "São Paulo",
        descricao: "Vigília na porta da ocupação no dia da reintegração. 140 famílias. Precisamos de gente às 6h e de quem filme com o celular na horizontal.",
        situacao: "adiado",
        motivo: "a Defensoria conseguiu adiar a reintegração",
        acesos: null,
        respostas: 27,
        meu: true,
      },
    },
    {
      confirmados: 2,
      ato: {
        ...base,
        id: "0e1b6c1a-5d1f-4c3e-9a51-6f3a2b1c0d03",
        titulo: "Aula pública no vão do MASP",
        palavra: "AULA PUBLICA",
        comunidade: { slug: "marxismo-aula-em-debate", nome: "Marxismo · aula em debate", cor: 4 },
        chamado_por: "liaquilombo",
        // depois da Vigília: na prancha celular-modo-atos o "próximo ato" do Passe Livre é a Vigília adiada
        inicio: dia(12, 15),
        onde: "Vão livre do MASP, Av. Paulista",
        cidade: "São Paulo",
        descricao: "Aula aberta sobre mais-valia e trabalho por aplicativo. Leve um banquinho.",
        situacao: "cancelado",
        motivo: "cancelada pela chuva · nova data em breve",
        acesos: null,
        respostas: 9,
      },
    },
    {
      confirmados: 31,
      ato: {
        ...base,
        id: "0e1b6c1a-5d1f-4c3e-9a51-6f3a2b1c0d04",
        titulo: "Panfletagem no RU",
        palavra: "RU",
        comunidade: { slug: "estudantes-ufpe", nome: "Estudantes UFPE", cor: 2 },
        chamado_por: "rosavermelha",
        inicio: dia(3, 11),
        onde: "Restaurante Universitário",
        cidade: "Recife",
        descricao: "O núcleo vai panfletar no RU. Leva água e uma caneta.",
        situacao: "confirmado",
        acesos: null,
        respostas: 14,
      },
    },
  ];
}

/** O farol de exemplo: o Passe Livre está tranquilo (confirmado pela coordenação); a Vigília (que "você" coordena) tem um pedido
 * de outra pessoa da coordenação esperando a sua confirmação, para dar para ver as duas pessoas na prévia. */
export interface FarolDoDuble {
  estado: EstadoDoFarol;
  texto: string;
  mudado_em: string | null;
  pendente: { estado: EstadoDoFarol; texto: string; meu: boolean; em: number } | null;
}

export function faroisDeExemplo(agora: number = Date.now()): Record<string, FarolDoDuble> {
  return {
    "0e1b6c1a-5d1f-4c3e-9a51-6f3a2b1c0d01": { estado: "tranquilo", texto: "", mudado_em: new Date(agora - 40 * 60_000).toISOString(), pendente: null },
    "0e1b6c1a-5d1f-4c3e-9a51-6f3a2b1c0d02": { estado: "tranquilo", texto: "", mudado_em: null, pendente: { estado: "ponto2", texto: "Praça Silva Teles, em frente à escola", meu: false, em: agora - 3 * 60_000 } },
  };
}

/** A corrente de exemplo (São Paulo), com 17 respostas para a meta de 30: a barra mostra metade dos elos. */
export function correntesDeExemplo(agora: number = Date.now()): { corrente: Corrente; respostas: number; minha: boolean }[] {
  const amanha5h = new Date(agora);
  amanha5h.setDate(amanha5h.getDate() + 1);
  amanha5h.setHours(5, 0, 0, 0);
  return [
    {
      respostas: 17,
      minha: false,
      corrente: {
        id: "c0e1b6c1-0000-4c3e-9a51-6f3a2b1c0d01",
        texto: "Precisamos de 30 pessoas às 5h na ocupação Esperança: a reintegração pode vir de madrugada.",
        cidade: "São Paulo",
        meta: 30,
        quando: amanha5h.toISOString(),
        expira_em: new Date(amanha5h.getTime() + 6 * 3_600_000).toISOString(),
        org: { handle: "moradia_zl", nome: "Moradia Zona Leste" },
        elos: null,
        fechada: false,
        vou_eu: false,
        total: null,
      },
    },
  ];
}

/** O que o dublê guarda (por aba). */
export interface EstadoDoDuble {
  atos: { ato: Ato; confirmados: number }[];
  farois?: Record<string, FarolDoDuble>;
  correntes?: { corrente: Corrente; respostas: number; minha: boolean }[];
}

const ORG_DA_PREVIA: OrgQuePosso = { id: "org-previa-moradia-zl", handle: "moradia_zl", nome: "Moradia Zona Leste" };

const comProporcao = (x: { ato: Ato; confirmados: number }): Ato => ({
  ...x.ato,
  acesos: proporcaoDoMosaico(x.confirmados),
  total: x.ato.meu ? x.confirmados : null,
});

const normal = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** As respostas do dublê às funções do contrato. Recusa o que o banco recusaria (ato desconhecido, mudar ato de outra pessoa). */
export function criarDuble(estado: EstadoDoDuble = { atos: atosDeExemplo(), farois: faroisDeExemplo(), correntes: correntesDeExemplo() }) {
  const farois = (estado.farois ??= {});
  const correntes = (estado.correntes ??= []);
  const comElos = (x: { corrente: Corrente; respostas: number; minha: boolean }): Corrente => ({
    ...x.corrente,
    elos: elosDaCorrente(x.respostas, x.corrente.meta),
    total: x.minha ? x.respostas : null,
  });
  const farolJson = (id: string, coordena: boolean): FarolDoAto => {
    const f = farois[id] ?? { estado: "tranquilo", texto: "", mudado_em: null, pendente: null };
    const vivo = f.pendente && Date.now() - f.pendente.em < 15 * 60_000 ? f.pendente : null;
    return {
      estado: f.estado,
      texto: f.texto,
      mudado_em: f.mudado_em,
      coordena,
      pendente: coordena && vivo ? { estado: vivo.estado, texto: vivo.texto, meu: vivo.meu, expira_em: new Date(vivo.em + 15 * 60_000).toISOString() } : null,
    };
  };
  const achar = (id: unknown) => {
    const x = estado.atos.find((a) => a.ato.id === id);
    if (!x) throw new Error("nao_encontrado");
    return x;
  };
  const porData = (a: { ato: Ato }, b: { ato: Ato }) => a.ato.inicio.localeCompare(b.ato.inicio);
  return {
    rede_atos(a: { p_filtro?: FiltroDosAtos; p_cidade?: string | null; p_comunidade?: string | null }): PaginaDeAtos {
      let lista = [...estado.atos].sort(porData);
      if (a.p_comunidade) lista = lista.filter((x) => x.ato.comunidade?.slug === a.p_comunidade);
      else if (a.p_filtro === "perto") lista = a.p_cidade ? lista.filter((x) => normal(x.ato.cidade) === normal(a.p_cidade ?? "")) : [];
      return { itens: lista.map(comProporcao), proximo: null };
    },
    rede_ato(a: { p_id?: string }): Ato {
      return comProporcao(achar(a.p_id));
    },
    rede_ato_proximo(): Ato | null {
      const futuro = [...estado.atos].filter((x) => x.ato.situacao !== "cancelado").sort(porData);
      const meu = futuro.find((x) => x.ato.vou_eu) ?? futuro[0];
      return meu ? comProporcao(meu) : null;
    },
    rede_ato_vou(a: { p_id?: string; p_sim?: boolean }): RespostaDoVou {
      const x = achar(a.p_id);
      if (x.ato.situacao === "cancelado") throw new Error("ato_cancelado");
      const sim = a.p_sim !== false;
      if (sim !== x.ato.vou_eu) x.confirmados += sim ? 1 : -1;
      x.ato = { ...x.ato, vou_eu: sim };
      const atual = comProporcao(x);
      return { vou_eu: sim, acesos: atual.acesos, total: atual.total };
    },
    rede_ato_publicar(a: { p?: Record<string, unknown> }): Ato {
      const p = a.p ?? {};
      const texto = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : "");
      if (!texto("titulo") || !texto("inicio") || !texto("onde") || !texto("cidade") || !texto("descricao")) throw new Error("invalido:ato");
      const ato: Ato = {
        id: `previa-${estado.atos.length + 1}`,
        titulo: texto("titulo"),
        palavra: texto("palavra") || "ATO",
        comunidade: null,
        chamado_por: null,
        inicio: texto("inicio"),
        inicio_anterior: null,
        onde: texto("onde"),
        cidade: texto("cidade"),
        descricao: texto("descricao"),
        situacao: "confirmado",
        motivo: "",
        acesos: null,
        total: null,
        vou_eu: false,
        meu: true,
        respostas: 0,
        link_apoio: null,
      };
      estado.atos.push({ ato, confirmados: 0 });
      return comProporcao(estado.atos[estado.atos.length - 1]);
    },
    rede_ato_mudar(a: { p_id?: string } & Partial<Record<`p_${keyof PedidoDeMudanca}`, unknown>>): Ato {
      const x = achar(a.p_id);
      if (!x.ato.meu) throw new Error("so_quem_organizou");
      const situacao = a.p_situacao as PedidoDeMudanca["situacao"];
      const motivo = typeof a.p_motivo === "string" ? a.p_motivo.slice(0, 140) : "";
      if (situacao === "adiado") {
        if (typeof a.p_inicio !== "string") throw new Error("data_invalida");
        x.ato = { ...x.ato, situacao, inicio_anterior: x.ato.inicio_anterior ?? x.ato.inicio, inicio: a.p_inicio, motivo };
      } else if (situacao === "cancelado") {
        x.ato = { ...x.ato, situacao, motivo };
      } else if (situacao === "confirmado") {
        x.ato = { ...x.ato, situacao, motivo: "" };
      } else throw new Error("situacao_invalida");
      return comProporcao(x);
    },
    rede_ato_farol(a: { p_id?: string }): FarolDoAto | null {
      const x = achar(a.p_id);
      if (!x.ato.meu && !x.ato.vou_eu) return null;
      return farolJson(x.ato.id, x.ato.meu);
    },
    rede_ato_farol_pedir(a: { p_id?: string; p_estado?: EstadoDoFarol; p_texto?: string }): FarolDoAto {
      const x = achar(a.p_id);
      if (!x.ato.meu) throw new Error("so_coordenacao");
      if (x.ato.situacao === "cancelado") throw new Error("ato_cancelado");
      const estadoNovo = a.p_estado;
      if (!estadoNovo || !["tranquilo", "atencao", "dispersar", "ponto2"].includes(estadoNovo)) throw new Error("invalido:estado");
      const texto = estadoNovo === "ponto2" ? (a.p_texto ?? "").replace(/\s+/g, " ").trim() : "";
      if (estadoNovo === "ponto2" && texto.length < 3) throw new Error("invalido:texto");
      const f = (farois[x.ato.id] ??= { estado: "tranquilo", texto: "", mudado_em: null, pendente: null });
      const p = f.pendente;
      if (p && !p.meu && Date.now() - p.em < 15 * 60_000 && p.estado === estadoNovo && p.texto === texto) {
        Object.assign(f, { estado: estadoNovo, texto, mudado_em: new Date().toISOString(), pendente: null });
      } else {
        f.pendente = { estado: estadoNovo, texto, meu: true, em: Date.now() };
      }
      return farolJson(x.ato.id, true);
    },
    rede_correntes(a: { p_cidade?: string }): Corrente[] {
      const cidade = normal(a.p_cidade ?? "");
      return correntes.filter((k) => !k.corrente.fechada && normal(k.corrente.cidade) === cidade).map(comElos);
    },
    rede_corrente_vou(a: { p_id?: string; p_sim?: boolean }): Corrente {
      const k = correntes.find((x) => x.corrente.id === a.p_id);
      if (!k) throw new Error("nao_encontrado");
      const sim = a.p_sim !== false;
      if (sim && k.corrente.fechada) throw new Error("corrente_fechada");
      if (sim !== k.corrente.vou_eu) k.respostas += sim ? 1 : -1;
      k.corrente = { ...k.corrente, vou_eu: sim, fechada: k.corrente.fechada || k.respostas >= k.corrente.meta };
      return comElos(k);
    },
    rede_corrente_posso(): OrgQuePosso[] {
      return [ORG_DA_PREVIA];
    },
    rede_corrente_abrir(a: { p?: Record<string, unknown> }): Corrente {
      const p = a.p ?? {};
      if (p.org !== ORG_DA_PREVIA.id) throw new Error("so_org_verificada");
      const texto = typeof p.texto === "string" ? p.texto.trim() : "";
      const cidade = typeof p.cidade === "string" ? p.cidade.trim() : "";
      const meta = Number(p.meta);
      if (texto.length < 10 || texto.length > 140) throw new Error("invalido:texto");
      if (cidade.length < 2) throw new Error("invalido:cidade");
      if (!Number.isInteger(meta) || meta < 3 || meta > 5000) throw new Error("invalido:meta");
      if (correntes.filter((k) => k.minha).length >= 2) throw new Error("muitos_pedidos");
      const quando = typeof p.quando === "string" && p.quando ? p.quando : null;
      const k = {
        respostas: 0,
        minha: true,
        corrente: {
          id: `previa-corrente-${correntes.length + 1}`,
          texto,
          cidade,
          meta,
          quando,
          expira_em: new Date((quando ? Date.parse(quando) : Date.now()) + 6 * 3_600_000).toISOString(),
          org: { handle: ORG_DA_PREVIA.handle, nome: ORG_DA_PREVIA.nome },
          elos: null,
          fechada: false,
          vou_eu: false,
          total: 0,
        },
      };
      correntes.unshift(k);
      return comElos(k);
    },
  };
}
