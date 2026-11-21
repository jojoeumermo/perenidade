// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas do grupo "memória e luta" (Prompt 4; supabase/migracoes/20261127-p4-memoria-e-luta.sql). Tudo vai direto ao banco com
// a sessão da pessoa: o banco confere o interruptor, a conta, a comunidade e a mediação em cada chamada. Nenhuma resposta traz quem
// enviou, quem registrou, quem pediu para sair ou número de pessoas. Com NEXT_PUBLIC_ALUMIA_PREVIA=sim, um dublê na memória responde
// (nada vai a lugar nenhum). Sem "@/" de propósito.
import { BackendError } from "../../backend";
import { chamar, type Chamar } from "../cliente";

export const PREVIA_DA_MEMORIA = process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim";

export type Consentimento = "sem_pessoas" | "pessoas_consentiram" | "so_eu";
export const CONSENTIMENTOS: readonly Consentimento[] = ["sem_pessoas", "pessoas_consentiram", "so_eu"];

export interface ComunidadeMinha {
  slug: string;
  nome: string;
  modero: boolean;
}

export interface Memoria {
  id: string;
  comunidade: string;
  titulo: string;
  texto: string;
  quando: string | null;
  consentimento: Consentimento;
  foto: boolean;
  estado: "reservada" | "pendente" | "publicada" | "retirada";
  retirada_por: "aparece" | "mediacao" | null;
  minha: boolean;
  posso_decidir: boolean;
}

export interface ArquivoVivo {
  comunidade: string;
  posso_enviar: boolean;
  modero: boolean;
  memorias: Memoria[];
  minhas: Memoria[];
  fila: Memoria[];
}

export interface Vitoria {
  id: string;
  comunidade: string;
  comunidade_nome: string;
  titulo: string;
  texto: string;
  quando: string;
  fonte: string | null;
  posso_tirar: boolean;
}

export interface Mural {
  vitorias: Vitoria[];
  posso_registrar: { slug: string; nome: string }[];
}

export type TipoDoItem = "post" | "ato" | "documento" | "vitoria" | "memoria";
export const TIPOS_DO_ITEM: readonly TipoDoItem[] = ["ato", "post", "documento", "vitoria", "memoria"];

export interface ItemDaLinha {
  id: string;
  tipo: TipoDoItem;
  titulo: string;
  quando: string;
  post: string | null;
  link: string | null;
  vitoria: string | null;
  memoria: string | null;
}

export interface Campanha {
  id: string;
  comunidade: string;
  comunidade_nome: string;
  titulo: string;
  sobre: string;
  encerrada: boolean;
  criada_em: string;
  modero: boolean;
}

export type CampanhaComLinha = Campanha & { linha: ItemDaLinha[] };

export interface ListaDeCampanhas {
  campanhas: Campanha[];
  posso_abrir: { slug: string; nome: string }[];
}

export interface PodcastResumo {
  slug: string;
  titulo: string;
  sobre: string;
  comunidade: string;
  comunidade_nome: string;
  rss: boolean;
}

export interface ListaDePodcasts {
  podcasts: PodcastResumo[];
  posso_criar: { slug: string; nome: string }[];
}

export interface Episodio {
  id: string;
  post: string;
  titulo: string;
  notas: string;
  numero: number;
  criado_em: string;
  duracao: number | null;
}

export type Podcast = PodcastResumo & { modero: boolean; episodios: Episodio[] };

/** O id de um post a partir do que a pessoa colou: o id puro ou um endereço da Alumia que termina nele (/p/<id> ou /ato/<id>). */
export function idDoPost(texto: string): string | null {
  const m = texto.trim().toLowerCase().match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?(?:[?#].*)?$/);
  return m ? m[1] : null;
}

/** O cliente sobre uma função que chama o banco (a de verdade ou o dublê). */
export function criarClienteDaMemoria(c: Chamar) {
  return {
    minhas: () => c<ComunidadeMinha[]>("rede_p4_ml_minhas"),
    // 44. Arquivo vivo
    arquivo: (comunidade: string) => c<ArquivoVivo>("rede_p4_memorias", { p_comunidade: comunidade }),
    enviarMemoria: (p: { comunidade: string; titulo: string; texto: string; quando: string; consentimento: Consentimento }) => c<Memoria>("rede_p4_memoria_enviar", { p }),
    decidirMemoria: (id: string, publicar: boolean) => c<ArquivoVivo>("rede_p4_memoria_decidir", { p_id: id, p_publicar: publicar }),
    sairDaMemoria: (id: string, motivo: "aparece" | "mediacao" = "aparece") => c<{ ok: boolean }>("rede_p4_memoria_sair", { p_id: id, p_motivo: motivo }),
    apagarMemoria: (id: string) => c<{ ok: boolean }>("rede_p4_memoria_apagar", { p_id: id }),
    // 116. Mural de vitórias
    mural: (comunidade: string | null = null) => c<Mural>("rede_p4_vitorias", { p_comunidade: comunidade }),
    registrarVitoria: (p: { comunidade: string; titulo: string; texto: string; quando: string; fonte: string }) => c<Vitoria>("rede_p4_vitoria_registrar", { p }),
    tirarVitoria: (id: string) => c<{ ok: boolean }>("rede_p4_vitoria_tirar", { p_id: id }),
    // 115. Campanhas
    campanhas: (comunidade: string | null = null) => c<ListaDeCampanhas>("rede_p4_campanhas", { p_comunidade: comunidade }),
    campanha: (id: string) => c<CampanhaComLinha>("rede_p4_campanha", { p_id: id }),
    abrirCampanha: (p: { comunidade: string; titulo: string; sobre: string }) => c<Campanha>("rede_p4_campanha_criar", { p }),
    porNaCampanha: (p: { campanha: string; tipo: TipoDoItem; titulo: string; quando?: string; post?: string; link?: string; vitoria?: string; memoria?: string }) =>
      c<CampanhaComLinha>("rede_p4_campanha_por", { p }),
    tirarDaCampanha: (item: string) => c<CampanhaComLinha>("rede_p4_campanha_tirar", { p_item: item }),
    encerrarCampanha: (id: string, encerrada: boolean) => c<CampanhaComLinha>("rede_p4_campanha_encerrar", { p_id: id, p_encerrada: encerrada }),
    // 119. Podcast
    podcasts: () => c<ListaDePodcasts>("rede_p4_podcasts"),
    podcast: (slug: string) => c<Podcast>("rede_p4_podcast", { p_slug: slug }),
    criarPodcast: (p: { comunidade: string; slug: string; titulo: string; sobre: string }) => c<Podcast>("rede_p4_podcast_criar", { p }),
    porEpisodio: (p: { podcast: string; post: string; titulo: string; notas: string }) => c<Podcast>("rede_p4_episodio_por", { p }),
    tirarEpisodio: (id: string) => c<Podcast>("rede_p4_episodio_tirar", { p_id: id }),
  };
}

const hoje = () => new Date().toISOString().slice(0, 10);

/** A campanha sem a linha do tempo (como a lista devolve). */
const semLinha = (c: CampanhaComLinha): Campanha => ({
  id: c.id, comunidade: c.comunidade, comunidade_nome: c.comunidade_nome, titulo: c.titulo, sobre: c.sobre, encerrada: c.encerrada, criada_em: c.criada_em, modero: c.modero,
});

/** O podcast como a lista devolve (sem os episódios e sem o "modero"). */
const resumoDoPodcast = (x: Podcast): PodcastResumo => ({ slug: x.slug, titulo: x.titulo, sobre: x.sobre, comunidade: x.comunidade, comunidade_nome: x.comunidade_nome, rss: x.rss });

/**
 * O dublê da prévia: uma comunidade aberta que a pessoa modera e uma fechada de que ela só participa, com uma vitória, uma campanha,
 * uma memória e um podcast de exemplo. As regras de quem pode fazer o quê são as do banco, de forma resumida.
 */
export function dubleDaMemoria(): Chamar {
  const uuid = () => crypto.randomUUID();
  const COMUNIDADES: ComunidadeMinha[] = [
    { slug: "luta-moradia", nome: "Luta por moradia", modero: true },
    { slug: "roda-de-leitura", nome: "Roda de leitura", modero: false },
  ];
  const nome = (slug: string) => COMUNIDADES.find((c) => c.slug === slug)?.nome ?? slug;
  const modera = (slug: string) => COMUNIDADES.find((c) => c.slug === slug)?.modero ?? false;
  const vitorias: Vitoria[] = [
    { id: uuid(), comunidade: "luta-moradia", comunidade_nome: "Luta por moradia", titulo: "Prédio da rua do Carmo vira moradia popular", texto: "Depois de dois anos de ocupação, a prefeitura desapropriou o prédio.", quando: "2024-03-01", fonte: "https://exemplo.org/noticia", posso_tirar: true },
  ];
  const memorias: (Memoria & { _minha: boolean })[] = [
    { id: uuid(), comunidade: "luta-moradia", titulo: "A primeira noite da ocupação", texto: "Trinta famílias entraram no prédio vazio com colchões e panelas.", quando: "2022-05-12", consentimento: "sem_pessoas", foto: false, estado: "publicada", retirada_por: null, minha: false, posso_decidir: true, _minha: false },
    { id: uuid(), comunidade: "luta-moradia", titulo: "O mutirão da cozinha", texto: "A cozinha coletiva serviu almoço para todo mundo por um mês.", quando: "2022-06-02", consentimento: "pessoas_consentiram", foto: false, estado: "pendente", retirada_por: null, minha: false, posso_decidir: true, _minha: false },
  ];
  const campanhas: CampanhaComLinha[] = [];
  const primeira: CampanhaComLinha = {
    id: uuid(), comunidade: "luta-moradia", comunidade_nome: "Luta por moradia", titulo: "Moradia já", sobre: "A luta do prédio da rua do Carmo.", encerrada: false,
    criada_em: new Date().toISOString(), modero: true, linha: [],
  };
  primeira.linha.push(
    { id: uuid(), tipo: "documento", titulo: "Ofício à prefeitura", quando: "2022-04-20", post: null, link: "https://exemplo.org/oficio.pdf", vitoria: null, memoria: null },
    { id: uuid(), tipo: "memoria", titulo: "A primeira noite da ocupação", quando: "2022-05-12", post: null, link: null, vitoria: null, memoria: memorias[0].id },
    { id: uuid(), tipo: "vitoria", titulo: "Desapropriação do prédio", quando: "2024-03-01", post: null, link: null, vitoria: vitorias[0].id, memoria: null },
  );
  campanhas.push(primeira);
  const podcasts: Podcast[] = [
    { slug: "vozes-da-ocupacao", titulo: "Vozes da ocupação", sobre: "Histórias de quem luta por moradia.", comunidade: "luta-moradia", comunidade_nome: "Luta por moradia", rss: true, modero: true, episodios: [] },
  ];
  const arquivo = (slug: string): ArquivoVivo => ({
    comunidade: slug,
    posso_enviar: COMUNIDADES.some((c) => c.slug === slug),
    modero: modera(slug),
    memorias: memorias.filter((m) => m.comunidade === slug && m.estado === "publicada").map(limpar(slug)),
    minhas: memorias.filter((m) => m.comunidade === slug && m._minha && m.estado !== "publicada").map(limpar(slug)),
    fila: modera(slug) ? memorias.filter((m) => m.comunidade === slug && m.estado === "pendente").map(limpar(slug)) : [],
  });
  function limpar(slug: string) {
    return ({ _minha, ...m }: Memoria & { _minha: boolean }): Memoria => ({ ...m, minha: _minha, posso_decidir: modera(slug) });
  }
  const achar = <T extends { id: string }>(lista: T[], id: unknown): T => {
    const x = lista.find((y) => y.id === id);
    if (!x) throw new BackendError("nao_encontrado");
    return x;
  };
  const texto = (v: unknown, min: number, max: number, campo = "titulo") => {
    const t = String(v ?? "").trim();
    if (t.length < min || t.length > max) throw new BackendError(`invalido:${campo}`);
    return t;
  };
  return async <T,>(funcao: string, a: Record<string, unknown> = {}): Promise<T> => {
    const p = (a.p ?? {}) as Record<string, string>;
    switch (funcao) {
      case "rede_p4_ml_minhas":
        return COMUNIDADES as T;
      case "rede_p4_memorias":
        return arquivo(String(a.p_comunidade)) as T;
      case "rede_p4_memoria_enviar": {
        if (!CONSENTIMENTOS.includes(p.consentimento as Consentimento)) throw new BackendError("invalido:consentimento");
        const m = { id: uuid(), comunidade: p.comunidade, titulo: texto(p.titulo, 3, 120), texto: String(p.texto ?? "").slice(0, 2000), quando: p.quando || null, consentimento: p.consentimento as Consentimento, foto: false, estado: "pendente" as const, retirada_por: null, minha: true, posso_decidir: modera(p.comunidade), _minha: true };
        memorias.push(m);
        return limpar(p.comunidade)(m) as T;
      }
      case "rede_p4_memoria_decidir": {
        const m = achar(memorias, a.p_id);
        if (!modera(m.comunidade)) throw new BackendError("nao_encontrado");
        if (a.p_publicar) m.estado = "publicada";
        else memorias.splice(memorias.indexOf(m), 1);
        return arquivo(m.comunidade) as T;
      }
      case "rede_p4_memoria_sair": {
        const m = achar(memorias, a.p_id);
        m.estado = "retirada";
        m.retirada_por = a.p_motivo === "mediacao" ? "mediacao" : "aparece";
        return { ok: true } as T;
      }
      case "rede_p4_memoria_apagar": {
        const m = achar(memorias, a.p_id);
        memorias.splice(memorias.indexOf(m), 1);
        return { ok: true } as T;
      }
      case "rede_p4_vitorias": {
        const slug = a.p_comunidade ? String(a.p_comunidade) : null;
        return { vitorias: vitorias.filter((v) => !slug || v.comunidade === slug).sort((x, y) => y.quando.localeCompare(x.quando)), posso_registrar: COMUNIDADES.filter((c) => c.modero).map(({ slug: s, nome: n }) => ({ slug: s, nome: n })) } as T;
      }
      case "rede_p4_vitoria_registrar": {
        if (!modera(p.comunidade)) throw new BackendError("sem_permissao");
        if (p.fonte && !/^https:\/\//.test(p.fonte)) throw new BackendError("invalido:link");
        const v: Vitoria = { id: uuid(), comunidade: p.comunidade, comunidade_nome: nome(p.comunidade), titulo: texto(p.titulo, 3, 140), texto: String(p.texto ?? "").slice(0, 1000), quando: p.quando || hoje(), fonte: p.fonte || null, posso_tirar: true };
        vitorias.push(v);
        return v as T;
      }
      case "rede_p4_vitoria_tirar":
        vitorias.splice(vitorias.indexOf(achar(vitorias, a.p_id)), 1);
        return { ok: true } as T;
      case "rede_p4_campanhas":
        return { campanhas: campanhas.map(semLinha), posso_abrir: COMUNIDADES.filter((c) => c.modero).map(({ slug: s, nome: n }) => ({ slug: s, nome: n })) } as T;
      case "rede_p4_campanha":
        return achar(campanhas, a.p_id) as T;
      case "rede_p4_campanha_criar": {
        if (!modera(p.comunidade)) throw new BackendError("sem_permissao");
        const c: CampanhaComLinha = { id: uuid(), comunidade: p.comunidade, comunidade_nome: nome(p.comunidade), titulo: texto(p.titulo, 3, 120), sobre: String(p.sobre ?? "").slice(0, 1000), encerrada: false, criada_em: new Date().toISOString(), modero: true, linha: [] };
        campanhas.unshift(c);
        return semLinha(c) as T;
      }
      case "rede_p4_campanha_por": {
        const c = achar(campanhas, p.campanha);
        const tipo = p.tipo as TipoDoItem;
        if (!TIPOS_DO_ITEM.includes(tipo)) throw new BackendError("invalido:tipo");
        if (tipo === "documento" && !/^https:\/\//.test(p.link ?? "")) throw new BackendError("invalido:link");
        if ((tipo === "post" || tipo === "ato") && !p.post) throw new BackendError("nao_encontrado");
        const quando = p.quando || (tipo === "vitoria" ? achar(vitorias, p.vitoria).quando : tipo === "memoria" ? achar(memorias, p.memoria).quando : null) || hoje();
        c.linha.push({ id: uuid(), tipo, titulo: texto(p.titulo, 3, 140), quando, post: p.post || null, link: tipo === "documento" ? p.link : null, vitoria: p.vitoria || null, memoria: p.memoria || null });
        c.linha.sort((x, y) => x.quando.localeCompare(y.quando));
        return c as T;
      }
      case "rede_p4_campanha_tirar": {
        const c = campanhas.find((k) => k.linha.some((i) => i.id === a.p_item));
        if (!c) throw new BackendError("nao_encontrado");
        c.linha = c.linha.filter((i) => i.id !== a.p_item);
        return c as T;
      }
      case "rede_p4_campanha_encerrar": {
        const c = achar(campanhas, a.p_id);
        c.encerrada = Boolean(a.p_encerrada);
        return c as T;
      }
      case "rede_p4_podcasts":
        return { podcasts: podcasts.map(resumoDoPodcast), posso_criar: COMUNIDADES.filter((c) => c.modero).map(({ slug: s, nome: n }) => ({ slug: s, nome: n })) } as T;
      case "rede_p4_podcast": {
        const x = podcasts.find((y) => y.slug === a.p_slug);
        if (!x) throw new BackendError("nao_encontrado");
        return x as T;
      }
      case "rede_p4_podcast_criar": {
        if (!modera(p.comunidade)) throw new BackendError("sem_permissao");
        if (!/^[a-z0-9-]{3,40}$/.test(p.slug ?? "")) throw new BackendError("invalido:slug");
        if (podcasts.some((y) => y.slug === p.slug)) throw new BackendError("invalido:slug_usado");
        const x: Podcast = { slug: p.slug, titulo: texto(p.titulo, 3, 80), sobre: String(p.sobre ?? "").slice(0, 1000), comunidade: p.comunidade, comunidade_nome: nome(p.comunidade), rss: p.comunidade === "luta-moradia", modero: true, episodios: [] };
        podcasts.push(x);
        return x as T;
      }
      case "rede_p4_episodio_por": {
        const x = podcasts.find((y) => y.slug === p.podcast);
        if (!x) throw new BackendError("nao_encontrado");
        if (!p.post) throw new BackendError("nao_encontrado");
        if (x.episodios.some((e) => e.post === p.post)) throw new BackendError("invalido:repetido");
        x.episodios.unshift({ id: uuid(), post: p.post, titulo: texto(p.titulo, 3, 120), notas: String(p.notas ?? "").slice(0, 2000), numero: x.episodios.length + 1, criado_em: new Date().toISOString(), duracao: 50 });
        return x as T;
      }
      case "rede_p4_episodio_tirar": {
        const x = podcasts.find((y) => y.episodios.some((e) => e.id === a.p_id));
        if (!x) throw new BackendError("nao_encontrado");
        x.episodios = x.episodios.filter((e) => e.id !== a.p_id);
        return x as T;
      }
      default:
        throw new BackendError("desligado");
    }
  };
}

export const memoriaDaLuta = criarClienteDaMemoria(PREVIA_DA_MEMORIA ? dubleDaMemoria() : chamar);
