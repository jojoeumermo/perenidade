// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas da cultura (Prompt 4, itens 38 a 42; supabase/migracoes/20261127-p4-cultura.sql). Tudo vai direto ao banco com a
// sessão da pessoa: o banco confere o interruptor, a conta, a comunidade e o limite em cada chamada. Nenhuma resposta traz o id de
// uma pessoa: só o codinome de quem assina uma obra ou uma peça (que é pública como o post dela) e o "minha" de quem olha. Com
// NEXT_PUBLIC_ALUMIA_PREVIA=sim, um dublê na memória responde (nada vai a lugar nenhum). Sem "@/" de propósito.
import { BackendError } from "../../backend";
import { chamar, type Chamar } from "../cliente";
import type { Genero, Linguagem, Local, SituacaoDoLivro } from "./regras";

export const PREVIA_DA_CULTURA = process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim";

export interface ComunidadeDaCultura { slug: string; nome: string; modero: boolean }
export interface Capitulo { numero: number; titulo: string; post: string; em: string }
export interface Obra {
  id: string; titulo: string; genero: Genero; sinopse: string; autor: string; handle: string | null; capitulos: number; minha: boolean; sigo: boolean;
  ultimo: string | null;
  /** Só na obra aberta. */
  lista?: Capitulo[];
  /** Quantas pessoas seguem: só para a autora e só a partir de 3 (abaixo, nulo). Quem são, nunca. */
  seguidores?: number | null;
}
export interface Peca { id: string; titulo: string; linguagem: Linguagem; post: string; em: string; autor: string; handle: string | null; minha: boolean }
export interface Mural { itens: Peca[]; autor: string | null }
export interface Sessao { id: string; quando: string; local_tipo: Local; local_texto: string; filme: string; ano: number | null; sinopse: string }
export interface NotaDoDiario { id: string; filme: string; ano: number | null; nota: string; em: string; minha: boolean }
export interface Cineclube { comunidade: string; modero: boolean; posso: boolean; sessoes: Sessao[]; diario: NotaDoDiario[] }
export interface Citacao { id: string; texto: string; pagina: string; minha: boolean }
/** O grupo somado: tudo nulo abaixo de 3 leitoras. A média vem arredondada de 10 em 10. */
export interface Grupo { leitoras: number | null; media: number | null; terminaram: number | null }
export interface Livro { id: string; titulo: string; autoria: string; situacao: SituacaoDoLivro; meu: boolean; eu: number | null; grupo: Grupo; citacoes: Citacao[] }
export interface Estante { comunidade: string; modero: boolean; posso: boolean; livros: Livro[] }
export interface Faixa { id: string; url: string; titulo: string; dominio: string; imagem: string | null; nota: string; minha: boolean }
export interface Playlist { comunidade: string; modero: boolean; posso: boolean; itens: Faixa[] }

export interface PedidoDeSessao { comunidade: string; quando: string; local_tipo: Local; local_texto: string; filme: string; ano: string; sinopse: string }

/** O cliente da cultura sobre uma função que chama o banco (a de verdade ou o dublê). */
export function criarClienteDaCultura(c: Chamar) {
  return {
    inicio: () => c<{ comunidades: ComunidadeDaCultura[] }>("rede_p4_cultura_inicio"),
    // 38. Obra seriada
    obras: (filtro: "todas" | "minhas" | "seguindo", genero: Genero | null) => c<{ itens: Obra[] }>("rede_p4_obras", { p: { filtro, genero } }),
    obra: (id: string) => c<Obra>("rede_p4_obra", { p_id: id }),
    criarObra: (titulo: string, genero: Genero, sinopse: string) => c<Obra>("rede_p4_obra_criar", { p: { titulo, genero, sinopse } }),
    apagarObra: (id: string) => c<{ apagada: boolean }>("rede_p4_obra_apagar", { p_id: id }),
    capitulo: (obra: string, post: string, titulo: string) => c<Obra>("rede_p4_obra_capitulo", { p_obra: obra, p_post: post, p_titulo: titulo }),
    tirarCapitulo: (obra: string, numero: number) => c<Obra>("rede_p4_obra_capitulo_tirar", { p_obra: obra, p_numero: numero }),
    seguir: (obra: string, sim: boolean) => c<{ sigo: boolean }>("rede_p4_obra_seguir", { p_id: obra, p_seguir: sim }),
    // 39. Mural de arte
    mural: (linguagem: Linguagem | null, handle: string | null) => c<Mural>("rede_p4_mural", { p: { linguagem, handle } }),
    criarPeca: (post: string, titulo: string, linguagem: Linguagem) => c<Peca>("rede_p4_peca_criar", { p: { post, titulo, linguagem } }),
    tirarPeca: (id: string) => c<{ tirada: boolean }>("rede_p4_peca_tirar", { p_id: id }),
    // 40. Cineclube
    cine: (comunidade: string) => c<Cineclube>("rede_p4_cine", { p_comunidade: comunidade }),
    marcarSessao: (p: PedidoDeSessao) => c<{ id: string }>("rede_p4_cine_marcar", { p }),
    desmarcarSessao: (id: string) => c<{ desmarcada: boolean }>("rede_p4_cine_desmarcar", { p_id: id }),
    anotar: (comunidade: string, filme: string, ano: string, nota: string, sessao: string | null) =>
      c<{ id: string }>("rede_p4_cine_anotar", { p: { comunidade, filme, ano, nota, sessao } }),
    tirarNota: (id: string) => c<{ tirada: boolean }>("rede_p4_cine_nota_tirar", { p_id: id }),
    // 41. Clube de leitura
    estante: (comunidade: string) => c<Estante>("rede_p4_estante", { p_comunidade: comunidade }),
    porLivro: (comunidade: string, titulo: string, autoria: string) => c<Livro>("rede_p4_livro_por", { p: { comunidade, titulo, autoria } }),
    situacao: (id: string, situacao: SituacaoDoLivro) => c<Livro>("rede_p4_livro_situacao", { p_id: id, p_situacao: situacao }),
    tirarLivro: (id: string) => c<{ tirado: boolean }>("rede_p4_livro_tirar", { p_id: id }),
    progresso: (livro: string, pct: number | null) => c<Livro>("rede_p4_leitura_marcar", { p_livro: livro, p_pct: pct }),
    citar: (livro: string, texto: string, pagina: string) => c<Livro>("rede_p4_citacao_por", { p_livro: livro, p_texto: texto, p_pagina: pagina }),
    tirarCitacao: (id: string) => c<{ tirada: boolean }>("rede_p4_citacao_tirar", { p_id: id }),
    // 42. Playlist coletiva
    playlist: (comunidade: string) => c<Playlist>("rede_p4_playlist", { p_comunidade: comunidade }),
    porFaixa: (comunidade: string, url: string, titulo: string, imagem: string | null, nota: string) =>
      c<{ id: string; dominio: string }>("rede_p4_playlist_por", { p: { comunidade, url, titulo, imagem, nota } }),
    tirarFaixa: (id: string) => c<{ tirado: boolean }>("rede_p4_playlist_tirar", { p_id: id }),
  };
}

export type ClienteDaCultura = ReturnType<typeof criarClienteDaCultura>;

/** O grupo somado como o banco faz: nada abaixo de 3, a média de 10 em 10, quem terminou só a partir de 3. */
export function somarGrupo(pcts: number[]): Grupo {
  if (pcts.length < 3) return { leitoras: null, media: null, terminaram: null };
  const fim = pcts.filter((p) => p === 100).length;
  return { leitoras: pcts.length, media: Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length / 10) * 10, terminaram: fim >= 3 ? fim : null };
}

type ObraDoDuble = Obra & { lista: Capitulo[]; seguem: number };
type LivroDoDuble = Omit<Livro, "grupo"> & { outras: number[] };

/** O dublê da prévia: duas comunidades de exemplo, obras, peças, uma sessão, livros e links inventados. Nada sai do aparelho. */
export function dubleDaCultura(): Chamar {
  const agora = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  const novoId = () => crypto.randomUUID();
  const post = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const DIA = 86_400_000;
  const comunidades: ComunidadeDaCultura[] = [{ slug: "cine-praca", nome: "Cine Praça", modero: true }, { slug: "sarau-da-quebrada", nome: "Sarau da Quebrada", modero: false }];
  const obras: ObraDoDuble[] = [
    {
      id: novoId(), titulo: "Cordel da greve", genero: "cordel", sinopse: "Uma greve contada em versos, capítulo por capítulo.", autor: "Faísca", handle: "faisca",
      capitulos: 2, minha: false, sigo: false, ultimo: iso(agora - DIA), seguem: 0,
      lista: [{ numero: 1, titulo: "O apito", post: post(1), em: iso(agora - 5 * DIA) }, { numero: 2, titulo: "A assembleia", post: post(2), em: iso(agora - DIA) }],
    },
    {
      id: novoId(), titulo: "Quadrinhos do ponto de ônibus", genero: "hq", sinopse: "", autor: "Você", handle: null, capitulos: 1, minha: true, sigo: false,
      ultimo: iso(agora - 3 * DIA), seguem: 4, lista: [{ numero: 1, titulo: "", post: post(3), em: iso(agora - 3 * DIA) }],
    },
  ];
  let pecas: Peca[] = [
    { id: novoId(), titulo: "Lambe da escola", linguagem: "lambe", post: post(10), em: iso(agora - 2 * DIA), autor: "Faísca", handle: "faisca", minha: false },
    { id: novoId(), titulo: "Retrato da ocupação", linguagem: "fotografia", post: post(11), em: iso(agora - 6 * DIA), autor: "Brisa", handle: "brisa", minha: false },
  ];
  const sessoes: Record<string, Sessao[]> = {
    "cine-praca": [{ id: novoId(), quando: iso(agora + 7 * DIA), local_tipo: "biblioteca", local_texto: "Biblioteca do bairro", filme: "Eles não usam black-tie", ano: 1981, sinopse: "Greve e família." }],
  };
  const diario: Record<string, NotaDoDiario[]> = {
    "cine-praca": [{ id: novoId(), filme: "Bacurau", ano: 2019, nota: "A roda falou de memória e de território.", em: iso(agora - 9 * DIA), minha: false }],
  };
  const livros: Record<string, LivroDoDuble[]> = {
    "cine-praca": [
      {
        id: novoId(), titulo: "Quarto de despejo", autoria: "Carolina Maria de Jesus", situacao: "lendo", meu: false, eu: null, outras: [40, 70, 100],
        citacoes: [{ id: novoId(), texto: "A fome é a escravatura atual.", pagina: "27", minha: false }],
      },
      { id: novoId(), titulo: "Torto arado", autoria: "Itamar Vieira Junior", situacao: "proximo", meu: false, eu: null, outras: [10], citacoes: [] },
    ],
  };
  const faixas: Record<string, Faixa[]> = {
    "cine-praca": [{ id: novoId(), url: "https://musica.exemplo.org/faixa/123", titulo: "Canto de luta", dominio: "musica.exemplo.org", imagem: null, nota: "Para abrir a sessão.", minha: false }],
  };

  const daComunidade = (slug: unknown) => {
    const k = comunidades.find((x) => x.slug === slug);
    if (!k) throw new BackendError("nao_encontrado");
    return k;
  };
  const obraVista = (o: ObraDoDuble, completa: boolean): Obra => {
    const { lista, seguem, ...resto } = o;
    const base = { ...resto, capitulos: lista.length };
    return completa ? { ...base, lista, seguidores: o.minha && seguem >= 3 ? seguem : null } : base;
  };
  const livroVisto = (l: LivroDoDuble): Livro => {
    const { outras, ...resto } = l;
    return { ...resto, grupo: somarGrupo(l.eu === null ? outras : [...outras, l.eu]) };
  };
  const acharLivro = (id: unknown) => {
    for (const lista of Object.values(livros)) {
      const l = lista.find((x) => x.id === id);
      if (l) return l;
    }
    throw new BackendError("nao_encontrado");
  };
  /** Tira o item de id dado de uma das listas; sem ele, "nao_encontrado". */
  const tirarDe = <X extends { id: string }>(listas: Record<string, X[]>, id: unknown) => {
    for (const lista of Object.values(listas)) {
      const i = lista.findIndex((x) => x.id === id);
      if (i >= 0) {
        lista.splice(i, 1);
        return;
      }
    }
    throw new BackendError("nao_encontrado");
  };

  return async <T,>(funcao: string, a: Record<string, unknown> = {}): Promise<T> => {
    await new Promise((r) => setTimeout(r, 120));
    const p = (a.p ?? {}) as Record<string, unknown>;
    const r = <X,>(x: X) => x as unknown as T;
    switch (funcao) {
      case "rede_p4_cultura_inicio":
        return r({ comunidades });
      case "rede_p4_obras": {
        const lista = obras.filter((o) => (p.filtro !== "minhas" || o.minha) && (p.filtro !== "seguindo" || o.sigo) && (!p.genero || o.genero === p.genero));
        return r({ itens: lista.map((o) => obraVista(o, false)) });
      }
      case "rede_p4_obra": {
        const o = obras.find((x) => x.id === a.p_id);
        if (!o) throw new BackendError("nao_encontrado");
        return r(obraVista(o, true));
      }
      case "rede_p4_obra_criar": {
        const titulo = String(p.titulo ?? "").trim();
        if (titulo.length < 2) throw new BackendError("invalido:titulo");
        const o: ObraDoDuble = {
          id: novoId(), titulo, genero: p.genero as Genero, sinopse: String(p.sinopse ?? ""), autor: "Você", handle: null, capitulos: 0, minha: true, sigo: false,
          ultimo: null, seguem: 0, lista: [],
        };
        obras.unshift(o);
        return r(obraVista(o, true));
      }
      case "rede_p4_obra_apagar": {
        const i = obras.findIndex((x) => x.id === a.p_id && x.minha);
        if (i < 0) throw new BackendError("nao_encontrado");
        obras.splice(i, 1);
        return r({ apagada: true });
      }
      case "rede_p4_obra_capitulo": {
        const o = obras.find((x) => x.id === a.p_obra && x.minha);
        if (!o) throw new BackendError("nao_encontrado");
        if (obras.some((x) => x.lista.some((c) => c.post === a.p_post))) throw new BackendError("ja_ligado");
        o.lista.push({ numero: (o.lista.at(-1)?.numero ?? 0) + 1, titulo: String(a.p_titulo ?? ""), post: String(a.p_post), em: iso(Date.now()) });
        o.ultimo = iso(Date.now());
        return r(obraVista(o, true));
      }
      case "rede_p4_obra_capitulo_tirar": {
        const o = obras.find((x) => x.id === a.p_obra && x.minha);
        if (!o) throw new BackendError("nao_encontrado");
        o.lista = o.lista.filter((c) => c.numero !== a.p_numero);
        return r(obraVista(o, true));
      }
      case "rede_p4_obra_seguir": {
        const o = obras.find((x) => x.id === a.p_id);
        if (!o) throw new BackendError("nao_encontrado");
        if (o.minha) throw new BackendError("invalido:minha");
        o.sigo = a.p_seguir !== false;
        return r({ sigo: o.sigo });
      }
      case "rede_p4_mural": {
        const handle = typeof p.handle === "string" && p.handle ? p.handle.replace(/^@/, "").toLowerCase() : null;
        if (handle && !pecas.some((x) => x.handle === handle)) throw new BackendError("nao_encontrado");
        const itens = pecas.filter((x) => (!p.linguagem || x.linguagem === p.linguagem) && (!handle || x.handle === handle));
        return r({ itens, autor: handle ? (itens[0]?.autor ?? null) : null });
      }
      case "rede_p4_peca_criar": {
        if (pecas.some((x) => x.post === p.post)) throw new BackendError("ja_ligado");
        const k: Peca = { id: novoId(), titulo: String(p.titulo ?? ""), linguagem: p.linguagem as Linguagem, post: String(p.post), em: iso(Date.now()), autor: "Você", handle: null, minha: true };
        pecas = [k, ...pecas];
        return r(k);
      }
      case "rede_p4_peca_tirar": {
        if (!pecas.some((x) => x.id === a.p_id && x.minha)) throw new BackendError("nao_encontrado");
        pecas = pecas.filter((x) => x.id !== a.p_id);
        return r({ tirada: true });
      }
      case "rede_p4_cine": {
        const k = daComunidade(a.p_comunidade);
        return r({ comunidade: k.slug, modero: k.modero, posso: true, sessoes: sessoes[k.slug] ?? [], diario: diario[k.slug] ?? [] });
      }
      case "rede_p4_cine_marcar": {
        const k = daComunidade(p.comunidade);
        if (!k.modero) throw new BackendError("sem_permissao");
        const s: Sessao = {
          id: novoId(), quando: String(p.quando), local_tipo: p.local_tipo as Local, local_texto: String(p.local_texto ?? ""), filme: String(p.filme ?? ""),
          ano: p.ano ? Number(p.ano) : null, sinopse: String(p.sinopse ?? ""),
        };
        (sessoes[k.slug] ??= []).push(s);
        sessoes[k.slug].sort((x, y) => x.quando.localeCompare(y.quando));
        return r({ id: s.id });
      }
      case "rede_p4_cine_desmarcar":
        tirarDe(sessoes, a.p_id);
        return r({ desmarcada: true });
      case "rede_p4_cine_anotar": {
        const k = daComunidade(p.comunidade);
        const n: NotaDoDiario = { id: novoId(), filme: String(p.filme ?? ""), ano: p.ano ? Number(p.ano) : null, nota: String(p.nota ?? ""), em: iso(Date.now()), minha: true };
        (diario[k.slug] ??= []).unshift(n);
        return r({ id: n.id });
      }
      case "rede_p4_cine_nota_tirar":
        tirarDe(diario, a.p_id);
        return r({ tirada: true });
      case "rede_p4_estante": {
        const k = daComunidade(a.p_comunidade);
        const ordem = ["lendo", "proximo", "lido"];
        const lista = [...(livros[k.slug] ?? [])].sort((x, y) => ordem.indexOf(x.situacao) - ordem.indexOf(y.situacao));
        return r({ comunidade: k.slug, modero: k.modero, posso: true, livros: lista.map(livroVisto) });
      }
      case "rede_p4_livro_por": {
        const k = daComunidade(p.comunidade);
        const l: LivroDoDuble = { id: novoId(), titulo: String(p.titulo ?? ""), autoria: String(p.autoria ?? ""), situacao: "proximo", meu: true, eu: null, outras: [], citacoes: [] };
        (livros[k.slug] ??= []).push(l);
        return r(livroVisto(l));
      }
      case "rede_p4_livro_situacao": {
        const l = acharLivro(a.p_id);
        l.situacao = a.p_situacao as SituacaoDoLivro;
        return r(livroVisto(l));
      }
      case "rede_p4_livro_tirar":
        tirarDe(livros, a.p_id);
        return r({ tirado: true });
      case "rede_p4_leitura_marcar": {
        const l = acharLivro(a.p_livro);
        const pct = a.p_pct === null || a.p_pct === undefined ? null : Number(a.p_pct);
        if (pct !== null && (pct < 0 || pct > 100)) throw new BackendError("invalido:pct");
        l.eu = pct;
        return r(livroVisto(l));
      }
      case "rede_p4_citacao_por": {
        const l = acharLivro(a.p_livro);
        const texto = String(a.p_texto ?? "").trim();
        if (texto.length < 3) throw new BackendError("invalido:texto");
        l.citacoes.unshift({ id: novoId(), texto, pagina: String(a.p_pagina ?? ""), minha: true });
        return r(livroVisto(l));
      }
      case "rede_p4_citacao_tirar": {
        for (const lista of Object.values(livros)) {
          for (const l of lista) {
            const i = l.citacoes.findIndex((x) => x.id === a.p_id);
            if (i >= 0) {
              l.citacoes.splice(i, 1);
              return r({ tirada: true });
            }
          }
        }
        throw new BackendError("nao_encontrado");
      }
      case "rede_p4_playlist": {
        const k = daComunidade(a.p_comunidade);
        return r({ comunidade: k.slug, modero: k.modero, posso: true, itens: faixas[k.slug] ?? [] });
      }
      case "rede_p4_playlist_por": {
        const k = daComunidade(p.comunidade);
        const url = String(p.url ?? "");
        const dominio = (/^[A-Za-z]+:\/\/([^/:?#]+)/.exec(url)?.[1] ?? "").toLowerCase();
        if (!dominio) throw new BackendError("invalido:url");
        if ((faixas[k.slug] ?? []).some((x) => x.url === url)) throw new BackendError("ja_ligado");
        const f: Faixa = { id: novoId(), url, titulo: String(p.titulo || dominio), dominio, imagem: null, nota: String(p.nota ?? ""), minha: true };
        (faixas[k.slug] ??= []).unshift(f);
        return r({ id: f.id, dominio });
      }
      case "rede_p4_playlist_tirar":
        tirarDe(faixas, a.p_id);
        return r({ tirado: true });
      default:
        throw new BackendError("desligado");
    }
  };
}

export const cultura = criarClienteDaCultura(PREVIA_DA_CULTURA ? dubleDaCultura() : chamar);
