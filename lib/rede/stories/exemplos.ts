// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O DUBLÊ dos stories para a prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim): os mesmos dados das pranchas (celular-stories-na-linha,
// celular-ver-story), na memória do navegador, sem enviar NADA a lugar nenhum. Serve para conferir a tela e tirar as fotos antes
// do back-end existir. Fora da prévia este arquivo nem é baixado (lib/rede/cliente-stories.ts importa sob demanda).
// Codinomes e organizações de exemplo, nenhuma pessoa real. Sem "@/" de propósito (roda no Node nos testes).
import type { ClienteDeStories } from "../cliente-stories";
import type { AutoraDoStory, DestaqueDeStories, FigurinhaEnquete, PedidoDeStory, PessoaDaRoda, Story } from "../tipos-stories";
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
        { tipo: "contagem", ato: "ex-ato-passe-livre", titulo: "Passe Livre Já", inicio: em(2 * 24 * H + 4 * H + 31 * MIN + 30_000), avisar: false, pos: { x: 0.4, y: 0.6, giro: -4, escala: 0.95 } },
        { tipo: "enquete", pergunta: "Você vai na panfletagem?", opcoes: ["Vou", "Não dá"], meu_voto: null, pos: { x: 0.54, y: 0.83, giro: 2.5, escala: 0.92 } },
      ],
    }),
    story("ex-rosa-3", ROSA, 1 * H, { fundo: { tipo: "listras", cor: "dourado" }, texto: "O que levar no ato?", figurinhas: [{ tipo: "pergunta", texto: "O que não pode faltar na mochila?" }] }),
    story("ex-passe-1", PASSE, 2 * H, {
      publico: "membros",
      fundo: { tipo: "mosaico", cor: "verde" },
      texto: "Tarifa zero é possível",
      figurinhas: [{ tipo: "link", url: "https://institutolucia.org/", rotulo: "Leia o estudo", pos: { x: 0.6, y: 0.72, giro: -3, escala: 1.08 } }],
    }),
    story("ex-leste-1", LESTE, 5 * H, { publico: "proximos", fundo: { tipo: "listras", cor: "azul" }, texto: "Plenária do Núcleo Leste", legenda: "Sábado, 15h · sede da ocupação" }),
    story("ex-leste-2", LESTE, 40 * MIN, { publico: "proximos", fundo: { tipo: "listras", cor: "noite" }, texto: "Pauta aberta", figurinhas: [{ tipo: "pergunta", texto: "O que não pode faltar na pauta?" }] }),
    story("ex-dce-1", DCE, 7 * H, { publico: "membros", fundo: { tipo: "mosaico", cor: "dourado" }, texto: "Calourada de luta", legenda: "Sexta, 18h · pátio" }),
    // Um vídeo de exemplo: o endereço é gerado no próprio navegador (gerarVideoDeExemplo), nada vem de fora.
    story("ex-dce-2", DCE, 20 * MIN, {
      publico: "membros",
      fundo: { tipo: "video", cor: "vermelho", url: "", alt: "Vídeo de exemplo: cartões da faixa acendendo", duracao: 5000, som: false },
      texto: "Ato na reitoria",
      legenda: "Gravado agora · sem som",
      estilo: { fonte: "condensada", alinhar: "esq", caixa: "nenhuma" },
      figurinhas: [{ tipo: "comunidade", slug: "estudantes-ufpe", nome: "Estudantes UFPE" }],
    }),
  ];
}

/**
 * Um vídeo de exemplo feito no próprio navegador (5 s de cartões acendendo, 720 × 1280, sem som), para a prévia mostrar um story
 * de vídeo sem baixar nada. Nulo onde não há canvas nem gravador (Node, navegador antigo).
 */
export async function gerarVideoDeExemplo(ms = 5000): Promise<string | null> {
  if (typeof document === "undefined" || typeof MediaRecorder === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 360;
  canvas.height = 640;
  const ctx = canvas.getContext("2d");
  if (!ctx || !("captureStream" in canvas)) return null;
  const tipos = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
  const tipo = tipos.find((x) => MediaRecorder.isTypeSupported(x));
  if (!tipo) return null;
  const fluxo = canvas.captureStream(30);
  const gravador = new MediaRecorder(fluxo, { mimeType: tipo, videoBitsPerSecond: 800_000 });
  const partes: Blob[] = [];
  gravador.ondataavailable = (e) => e.data.size && partes.push(e.data);
  const cores = ["#c21f16", "#8e1610", "#e8661f", "#f08a24", "#a91a12"];
  const inicio = performance.now();
  let quadro = 0;
  const desenhar = () => {
    const t = (performance.now() - inicio) / 1000;
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 18; x++) {
        const k = Math.abs(Math.sin(x * 12.9898 + y * 78.233 + Math.floor(t * 3 + (x + y) / 6)) * 43758.5453) % 1;
        ctx.fillStyle = cores[Math.floor(k * cores.length)];
        ctx.fillRect(x * 20 + 1, y * 20 + 1, 18, 18);
      }
    quadro = requestAnimationFrame(desenhar);
  };
  desenhar();
  gravador.start(500);
  await new Promise((r) => setTimeout(r, ms));
  cancelAnimationFrame(quadro);
  await new Promise<void>((r) => {
    gravador.onstop = () => r();
    gravador.stop();
  });
  fluxo.getTracks().forEach((x) => x.stop());
  return URL.createObjectURL(new Blob(partes, { type: tipo.split(";")[0] }));
}

/** O dublê: o mesmo contrato do cliente de verdade, na memória. */
export function criarClienteDaPrevia(relogio: () => number = Date.now): ClienteDeStories {
  const todos = storiesDeExemplo(relogio());
  const meus: Story[] = [];
  // O vídeo de exemplo começa a ser feito já (5 s), para estar pronto quando alguém tocar na bolinha.
  const video = gerarVideoDeExemplo().catch(() => null);
  const comVideo = async (lista: Story[]): Promise<Story[]> => {
    if (!lista.some((s) => s.fundo.tipo === "video" && !s.fundo.url)) return lista;
    const url = await video;
    return lista.map((s) => (s.fundo.tipo === "video" && !s.fundo.url ? (url ? { ...s, fundo: { ...s.fundo, url } } : { ...s, fundo: { tipo: "mosaico", cor: s.fundo.cor } }) : s));
  };
  // Destaques de exemplo: os stories guardados não somem (na prévia, cópias dos exemplos com 3 dias).
  const guardado = (s: Story, dias: number): Story => ({ ...s, id: `${s.id}-d`, criado_em: new Date(relogio() - dias * 24 * H).toISOString(), expira_em: new Date(relogio() - dias * 24 * H + LIMITES_DO_STORY.vida).toISOString() });
  const destaques: { autora: string; d: DestaqueDeStories; stories: Story[] }[] = [
    { autora: "rosavermelha", d: { id: "ex-dest-greve", titulo: "Greve 2026", cor: "vermelho", n: 2 }, stories: [guardado(todos[0], 3), guardado(todos[1], 3)] },
    { autora: "rosavermelha", d: { id: "ex-dest-pauta", titulo: "Pauta", cor: "dourado", n: 1 }, stories: [guardado(todos[2], 5)] },
    { autora: "voce", d: { id: "ex-dest-meu", titulo: "Atos", cor: "azul", n: 1 }, stories: [{ ...guardado(todos[4], 2), autora: EU_NA_PREVIA, meu: true }] },
  ];
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
    abrir: (handle) => espera(todos.filter((s) => s.autora.handle === handle && noAr(s))).then(comVideo),
    meus: () => espera(meus.filter(noAr)),
    publicar: (pedido: PedidoDeStory) => {
      const id = `ex-meu-${++n}`;
      const agora = relogio();
      const fundo: Story["fundo"] = pedido.imagem
        ? pedido.fundo.tipo === "video"
          ? { tipo: "video", cor: pedido.fundo.cor, url: pedido.imagem.replace(/^previa:/, ""), alt: pedido.alt ?? "", duracao: pedido.video?.duracao_ms ?? 5000, som: !!pedido.video?.som }
          : { tipo: "imagem", cor: pedido.fundo.cor, url: pedido.imagem.replace(/^previa:/, ""), alt: pedido.alt ?? "" }
        : { tipo: pedido.fundo.tipo === "mosaico" ? "mosaico" : "listras", cor: pedido.fundo.cor };
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
        estilo: pedido.estilo ?? {},
        destaques: [],
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
    enviarImagem: async (imagem, aoProgresso) => {
      // Um envio de mentira, com andamento, para a prévia mostrar o anel de progresso.
      for (let k = 1; k <= 5; k++) {
        await new Promise((r) => setTimeout(r, 160));
        aoProgresso?.(k / 5);
      }
      return `previa:${typeof URL !== "undefined" && "createObjectURL" in URL ? URL.createObjectURL(imagem) : ""}`;
    },
    comunidades: () =>
      espera([
        { slug: "estudantes-ufpe", nome: "Estudantes UFPE" },
        { slug: "passe-livre-sp", nome: "Passe Livre SP" },
        { slug: "moradia-leste", nome: "Moradia Zona Leste" },
      ]),
    destaques: (handle) =>
      espera(destaques.filter((x) => x.autora === handle || (handle === "eu" && x.autora === "voce")).map((x) => ({ ...x.d, n: x.stories.length }))),
    destaque: (id) => espera(destaques.find((x) => x.d.id === id)?.stories ?? []).then(comVideo),
    salvarDestaque: ({ destaque, titulo, story, cor }) => {
      let alvo = destaques.find((x) => x.d.id === destaque && x.autora === "voce");
      if (!alvo) {
        if (destaques.filter((x) => x.autora === "voce").length >= LIMITES_DO_STORY.destaques) return Promise.reject(new Error("limite:destaques"));
        alvo = { autora: "voce", d: { id: `ex-dest-${++n}`, titulo: titulo ?? "Destaque", cor: cor ?? "vermelho", n: 0 }, stories: [] };
        destaques.push(alvo);
      } else {
        if (titulo) alvo.d.titulo = titulo;
        if (cor) alvo.d.cor = cor;
      }
      const s = meus.find((x) => x.id === story);
      if (s && !alvo.stories.some((x) => x.id === s.id)) {
        alvo.stories.push(s);
        s.destaques = [...(s.destaques ?? []), alvo.d.id];
      }
      return espera({ id: alvo.d.id, titulo: alvo.d.titulo, cor: alvo.d.cor });
    },
    tirarDoDestaque: (destaque, story) => {
      const alvo = destaques.find((x) => x.d.id === destaque);
      if (alvo) alvo.stories = alvo.stories.filter((s) => s.id !== story);
      const s = meus.find((x) => x.id === story);
      if (s) s.destaques = (s.destaques ?? []).filter((d) => d !== destaque);
      return espera({ ok: true });
    },
    apagarDestaque: (destaque) => {
      const i = destaques.findIndex((x) => x.d.id === destaque && x.autora === "voce");
      if (i >= 0) destaques.splice(i, 1);
      return espera({ apagado: i >= 0 });
    },
    ordenarDestaques: (ids) => {
      const meusD = destaques.filter((x) => x.autora === "voce");
      const outros = destaques.filter((x) => x.autora !== "voce");
      meusD.sort((a, b) => (ids.indexOf(a.d.id) + 1 || 99) - (ids.indexOf(b.d.id) + 1 || 99));
      destaques.splice(0, destaques.length, ...outros, ...meusD);
      return espera({ ok: true });
    },
    ordenarNoDestaque: (destaque, ids) => {
      const alvo = destaques.find((x) => x.d.id === destaque && x.autora === "voce");
      alvo?.stories.sort((a, b) => (ids.indexOf(a.id) + 1 || 99) - (ids.indexOf(b.id) + 1 || 99));
      return espera({ ok: true });
    },
    capaDoDestaque: (destaque, story) => {
      const alvo = destaques.find((x) => x.d.id === destaque && x.autora === "voce");
      const s = alvo?.stories.find((x) => x.id === story);
      if (alvo) {
        alvo.d.capa_story = story;
        alvo.d.capa = s && s.fundo.tipo === "imagem" ? { tipo: "imagem", url: s.fundo.url } : null;
      }
      return espera({ ok: true });
    },
    trocarMidia: (story, caminho) => {
      for (const s of [...meus, ...destaques.flatMap((x) => x.stories)]) {
        if (s.id === story && s.fundo.tipo === "imagem") s.fundo = { ...s.fundo, url: caminho.replace(/^previa:/, "") };
      }
      return espera({ ok: true });
    },
    post: (id) =>
      espera(
        id.includes("ato")
          ? { tipo: "ato" as const, id, autora: todos[0].autora, titulo: "Passe Livre Já", inicio: new Date(relogio() + 2 * 24 * H).toISOString(), cidade: "São Paulo", situacao: "confirmado" as const }
          : { tipo: "post" as const, id, autora: todos[1].autora, texto: "A assembleia aprovou a greve por tempo indeterminado. Todo mundo na praça amanhã!", criado_em: new Date(relogio() - 3 * H).toISOString() },
      ),
    responderPergunta: () => espera({ ok: true }),
    respostas: () =>
      espera([
        { id: "ex-resp-1", texto: "Água, protetor e a faixa do núcleo!", criado_em: new Date(relogio() - 20 * MIN).toISOString(), pergunta: true, de: todos[1].autora },
        { id: "ex-resp-2", texto: "Tô dentro, levo mais duas pessoas.", criado_em: new Date(relogio() - 50 * MIN).toISOString(), pergunta: false, de: todos[2].autora },
      ]),
    caixa: () => espera(meus.filter(noAr).slice(0, 3).map((s) => ({ id: s.id, texto: s.texto, cor: s.fundo.cor, criado_em: s.criado_em, expira_em: s.expira_em, n: 2, perguntas: 1, ultima: new Date(relogio() - 20 * MIN).toISOString() }))),
    vou: (_ato, sim) => espera({ vou_eu: sim }),
    roda: () => espera([...roda]),
    mudarRoda: (handle, sim) => {
      const h = handle.replace(/^@/, "").toLowerCase();
      const i = roda.findIndex((x) => x.handle === h);
      if (sim && i < 0) {
        const a = todos.find((s) => s.autora.handle === h)?.autora;
        if (!a) return Promise.reject(new Error("nao_encontrado"));
        roda.push({ handle: a.handle, nome: a.nome, cor: a.cor ?? null });
      } else if (!sim && i >= 0) roda.splice(i, 1);
      return espera([...roda]);
    },
    daComunidade: () => {
      const vivos = todos.filter(noAr).slice(0, 2);
      return espera(vivos.map((s) => ({ autora: s.autora, ids: [s.id], ultimo_em: s.criado_em })));
    },
  };
}

/** A roda de confiança da prévia (só na memória desta aba). */
const roda: PessoaDaRoda[] = [];
