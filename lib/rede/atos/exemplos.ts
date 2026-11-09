// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O DUBLÊ das funções de atos (rede_atos, rede_ato, rede_ato_proximo, rede_ato_vou, rede_ato_mudar) com os dados das pranchas,
// só para a prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim): a etapa de back-end cria as funções de verdade com o mesmo contrato
// (lib/rede/tipos-atos.ts). Tudo fica na memória da aba; nada sai do aparelho. Os nomes são ilustrativos (não são pessoas).
// O dublê segue as mesmas regras do banco: proporção em passos de 10 % e nula abaixo de 3; total só para quem organizou.
// Sem "@/" de propósito (roda no Node nos testes).
import { proporcaoDoMosaico } from "../mosaico";
import type { Ato, FiltroDosAtos, PaginaDeAtos, PedidoDeMudanca, RespostaDoVou } from "../tipos-atos";

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
        inicio: dia(4, 15),
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

/** O que o dublê guarda (por aba). */
export interface EstadoDoDuble {
  atos: { ato: Ato; confirmados: number }[];
}

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
export function criarDuble(estado: EstadoDoDuble = { atos: atosDeExemplo() }) {
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
  };
}
