// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O DUBLÊ dos stories para a prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim): os mesmos dados das pranchas (celular-stories-na-linha,
// celular-ver-story), na memória do navegador, sem enviar NADA a lugar nenhum. Serve para conferir a tela e tirar as fotos antes
// do back-end existir. Fora da prévia este arquivo nem é baixado (lib/rede/cliente-stories.ts importa sob demanda).
// Codinomes e organizações de exemplo, nenhuma pessoa real. Sem "@/" de propósito (roda no Node nos testes).
import type { ClienteDeStories } from "../cliente-stories";
import type { AutoraDoStory, FigurinhaEnquete, PedidoDeStory, Story } from "../tipos-stories";
import { LIMITES_DO_STORY } from "../tipos-stories";

const H = 60 * 60 * 1000;
const MIN = 60 * 1000;

export const EU_NA_PREVIA: AutoraDoStory = { handle: "voce", nome: "Você", cor: 2 };

const ROSA: AutoraDoStory = { handle: "rosavermelha", nome: "Rosa Vermelha", cor: 2 };
const PASSE: AutoraDoStory = { handle: "passelivresp", nome: "Passe Livre SP", cor: 1 };
const LESTE: AutoraDoStory = { handle: "nucleoleste", nome: "Núcleo Leste", cor: 3 };
const DCE: AutoraDoStory = { handle: "dcelivre", nome: "DCE Livre", cor: 4 };

/** Os stories de exemplo, com os instantes relativos a `agora` (a contagem do ato fica em "2 dias, 04 horas, 31 min"). */
export function storiesDeExemplo(agora: number): Story[] {
  const em = (ms: number) => new Date(agora + ms).toISOString();
  const story = (id: string, autora: AutoraDoStory, ha: number, resto: Partial<Story>): Story => ({
    id,
    autora,
    criado_em: em(-ha),
    expira_em: em(-ha + LIMITES_DO_STORY.vida),
    publico: "seguidores",
    fundo: { tipo: "listras", cor: "azul" },
    texto: "",
    legenda: null,
    figurinhas: [],
    meu: false,
    ...resto,
  });
  return [
    story("ex-rosa-1", ROSA, 4 * H, { fundo: { tipo: "listras", cor: "vermelho" }, texto: "Assembleia do DCE aprovou", legenda: "Paralisação na quinta · todo mundo junto" }),
    story("ex-rosa-2", ROSA, 3 * H, {
      fundo: { tipo: "mosaico", cor: "vermelho" },
      texto: "Paralisação na quinta",
      legenda: "Panfletagem no RU · amanhã, 11h",
      figurinhas: [
        { tipo: "contagem", ato: "ex-ato-passe-livre", titulo: "Passe Livre Já", inicio: em(2 * 24 * H + 4 * H + 31 * MIN + 30_000), avisar: false },
        { tipo: "enquete", pergunta: "Você vai na panfletagem?", opcoes: ["Vou", "Não dá"], meu_voto: null },
      ],
    }),
    story("ex-rosa-3", ROSA, 1 * H, { fundo: { tipo: "listras", cor: "dourado" }, texto: "O que levar no ato?", figurinhas: [{ tipo: "pergunta", texto: "O que não pode faltar na mochila?" }] }),
    story("ex-passe-1", PASSE, 2 * H, {
      publico: "membros",
      fundo: { tipo: "mosaico", cor: "verde" },
      texto: "Tarifa zero é possível",
      figurinhas: [{ tipo: "link", url: "https://institutolucia.org/", rotulo: "Leia o estudo" }],
    }),
    story("ex-leste-1", LESTE, 5 * H, { publico: "proximos", fundo: { tipo: "listras", cor: "azul" }, texto: "Plenária do Núcleo Leste", legenda: "Sábado, 15h · sede da ocupação" }),
    story("ex-leste-2", LESTE, 40 * MIN, { publico: "proximos", fundo: { tipo: "listras", cor: "noite" }, texto: "Pauta aberta", figurinhas: [{ tipo: "pergunta", texto: "O que não pode faltar na pauta?" }] }),
    story("ex-dce-1", DCE, 7 * H, { publico: "membros", fundo: { tipo: "mosaico", cor: "dourado" }, texto: "Calourada de luta", legenda: "Sexta, 18h · pátio" }),
  ];
}

/** O dublê: o mesmo contrato do cliente de verdade, na memória. */
export function criarClienteDaPrevia(relogio: () => number = Date.now): ClienteDeStories {
  const todos = storiesDeExemplo(relogio());
  const meus: Story[] = [];
  const espera = <T,>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(structuredClone(v)), 120));
  const noAr = (s: Story) => Date.parse(s.expira_em) > relogio();
  const achar = (id: string) => [...todos, ...meus].find((s) => s.id === id);
  let n = 0;

  return {
    previa: true,
    faixa: () => {
      const porAutora = new Map<string, Story[]>();
      for (const s of todos.filter(noAr)) porAutora.set(s.autora.handle, [...(porAutora.get(s.autora.handle) ?? []), s]);
      const grupos = [...porAutora.values()].map((lista) => ({
        autora: lista[0].autora,
        ids: lista.map((s) => s.id),
        ultimo_em: lista[lista.length - 1].criado_em,
      }));
      return espera({ meus: meus.filter(noAr).map((s) => s.id), grupos });
    },
    abrir: (handle) => espera(todos.filter((s) => s.autora.handle === handle && noAr(s))),
    meus: () => espera(meus.filter(noAr)),
    publicar: (pedido: PedidoDeStory) => {
      const id = `ex-meu-${++n}`;
      const agora = relogio();
      const fundo = pedido.imagem
        ? { tipo: "imagem" as const, cor: pedido.fundo.cor, url: pedido.imagem.replace(/^previa:/, ""), alt: pedido.alt ?? "" }
        : { tipo: pedido.fundo.tipo === "mosaico" ? ("mosaico" as const) : ("listras" as const), cor: pedido.fundo.cor };
      const s: Story = {
        id,
        autora: EU_NA_PREVIA,
        criado_em: new Date(agora).toISOString(),
        expira_em: new Date(agora + LIMITES_DO_STORY.vida).toISOString(),
        publico: pedido.publico,
        fundo,
        texto: pedido.texto,
        legenda: pedido.legenda,
        figurinhas: pedido.figurinhas.map((f) => (f.tipo === "enquete" ? { ...f, meu_voto: null, soma: null } : f)),
        meu: true,
      };
      meus.push(s);
      return espera({ id, expira_em: s.expira_em });
    },
    apagar: (id) => {
      const i = meus.findIndex((s) => s.id === id);
      if (i >= 0) meus.splice(i, 1);
      return espera({ apagado: i >= 0 });
    },
    responder: () => espera({ ok: true }),
    reagir: () => espera({ ok: true }),
    votar: (id, opcao) => {
      const f = achar(id)?.figurinhas.find((x): x is FigurinhaEnquete => x.tipo === "enquete");
      if (!f) return Promise.reject(new Error("sumiu"));
      f.meu_voto = f.meu_voto ?? opcao;
      return espera(f);
    },
    avisar: (id, sim) => {
      const f = achar(id)?.figurinhas.find((x) => x.tipo === "contagem");
      if (f && f.tipo === "contagem") f.avisar = sim;
      return espera({ avisar: sim });
    },
    atos: () => {
      const agora = relogio();
      return espera([
        { id: "ex-ato-passe-livre", titulo: "Passe Livre Já", inicio: new Date(agora + 2 * 24 * H + 4 * H + 31 * MIN).toISOString() },
        { id: "ex-ato-plenaria", titulo: "Plenária Leste", inicio: new Date(agora + 5 * 24 * H).toISOString() },
      ]);
    },
    denunciar: () => espera({ protocolo: "PREVIA-0001" }),
    // Na prévia a imagem nunca sai do aparelho: vira um endereço local do navegador.
    enviarImagem: (imagem) => espera(`previa:${typeof URL !== "undefined" && "createObjectURL" in URL ? URL.createObjectURL(imagem) : ""}`),
  };
}
