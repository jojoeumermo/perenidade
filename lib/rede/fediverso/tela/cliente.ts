// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas da tela para gente de FORA. Tudo o que traz avatar ou mídia (linha, perfil, fio) passa pelas rotas
// app/api/fediverso/**, com o token da própria pessoa: é o servidor que lê lá fora e que troca os endereços pela rota-proxy
// assinada. Por isso rede_fed_linha_mista, rede_fed_perfil_remoto, rede_fed_fio_remoto e rede_fed_respostas_de NUNCA são
// chamadas daqui direto. Direto no banco só o que não devolve endereço de fora (bloquear, silenciar, descoberta, situação).
// Nada aqui lança: cada função devolve { ok: true, dado } ou { ok: false, erro } (o código, para textoDoErroDeFora).
// Na prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim) nenhuma rota nem função do banco é chamada: voltam os dados de exemplo.
// Sem "@/" de propósito.
import { BackendError, getClient } from "../../../backend";
import { chamar } from "../../cliente";
import { previaLigada } from "../../publicar/alumia2";
import { fioDeExemplo, linhaDeExemplo, perfilDeExemplo, respostaDeExemplo, situacaoDeExemplo } from "./exemplos";
import { eDeFora, type AchadoNaBusca, type CategoriaDeDenuncia, type ContaDaqui, type FioDeFora, type LinhaDeFora, type MaisPostsDoPerfil, type PerfilDeFora, type RespostasDeForaDoPost, type SituacaoDeFora } from "./tipos";

export type Resultado<T> = { ok: true; dado: T } | { ok: false; erro: string };

const certo = <T>(dado: T): Resultado<T> => ({ ok: true, dado });
const codigoDe = (e: unknown): string => (e instanceof BackendError ? e.code : typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : "falha");

/** O token da sessão: as rotas do servidor repassam ao banco, que confere tudo como a própria pessoa. */
async function token(): Promise<string | null> {
  try {
    const { data } = await (await getClient()).auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/** Pede a uma rota nossa. Corpo que não é JSON (o 404 "Not Found" da federação desligada) vira "nao_encontrado" ou "falha". */
async function pedirRota<T>(caminho: string, corpo?: Record<string, unknown>): Promise<Resultado<T>> {
  const t = await token();
  if (!t) return { ok: false, erro: "entre_primeiro" };
  let r: Response;
  try {
    r = await fetch(caminho, {
      method: corpo ? "POST" : "GET",
      headers: { Authorization: `Bearer ${t}`, ...(corpo ? { "Content-Type": "application/json" } : {}) },
      ...(corpo ? { body: JSON.stringify(corpo) } : {}),
      cache: "no-store",
    });
  } catch {
    return { ok: false, erro: "sem_conexao" };
  }
  const dado = (await r.json().catch(() => null)) as (T & { erro?: unknown }) | null;
  if (r.ok && dado && typeof dado === "object") return certo(dado);
  const erro = dado && typeof dado === "object" && typeof dado.erro === "string" ? dado.erro : r.status === 404 ? "nao_encontrado" : r.status === 429 ? "muitos_pedidos" : "falha";
  return { ok: false, erro };
}

/** Chama uma função do banco como a pessoa (o mesmo `chamar` do resto da Alumia), sem lançar. */
async function pedirBanco<T>(funcao: string, argumentos: Record<string, unknown> = {}): Promise<Resultado<T>> {
  try {
    return certo(await chamar<T>(funcao, argumentos));
  } catch (e) {
    return { ok: false, erro: codigoDe(e) };
  }
}

const q = encodeURIComponent;
const previa = () => previaLigada();

export const deFora = {
  /** A linha mista (quem a pessoa segue fora daqui e o que eles impulsionam). `cursor` é o `proximo` da página anterior. */
  linha: (cursor: string | null = null, limite = 20): Promise<Resultado<LinhaDeFora>> =>
    previa() ? Promise.resolve(certo(cursor ? { itens: [], proximo: null } : linhaDeExemplo())) : pedirRota(`/api/fediverso/remoto?linha=1&limite=${limite}${cursor ? `&cursor=${q(cursor)}` : ""}`),
  /** O perfil de alguém de fora, por "@nome@servidor" ou pelo endereço https do ator. Conta daqui volta como { local: true, handle }. */
  perfil: (contaOuAtor: string): Promise<Resultado<PerfilDeFora | ContaDaqui>> =>
    previa() ? Promise.resolve(certo(perfilDeExemplo())) : pedirRota(`/api/fediverso/remoto?${/^https:\/\//i.test(contaOuAtor.trim()) ? "ator" : "conta"}=${q(contaOuAtor.trim())}`),
  /** Mais posts guardados de um perfil de fora. `ator` é o endereço https da conta; `cursor` é o `proximo` da página anterior. */
  maisDoPerfil: async (ator: string, cursor: string): Promise<Resultado<MaisPostsDoPerfil>> => {
    if (previa()) return certo({ posts: [], proximo: null });
    const r = await pedirRota<Partial<MaisPostsDoPerfil>>(`/api/fediverso/remoto?ator=${q(ator)}&cursor=${q(cursor)}`);
    if (!r.ok) return r;
    return certo({ posts: Array.isArray(r.dado.posts) ? r.dado.posts.filter(eDeFora) : [], proximo: typeof r.dado.proximo === "string" && r.dado.proximo ? r.dado.proximo : null });
  },
  /**
   * O fio de uma nota de fora (o `id` do cartão). Se a Alumia não guarda a nota, volta o erro "so_na_origem" sem buscar nada lá
   * fora; `buscarLa` (o toque da pessoa em "buscar este post em <servidor>") é o que manda o servidor daqui ir até a origem.
   */
  fio: (idDaNota: string, buscarLa = false): Promise<Resultado<FioDeFora>> =>
    previa() ? Promise.resolve(certo(fioDeExemplo())) : pedirRota(`/api/fediverso/remoto?post=${q(idDaNota)}${buscarLa ? "&buscar=1" : ""}`),
  /** As respostas de fora a um post DAQUI (o id dele), da mais antiga à mais nova. `cursor` é o `proximo` da página anterior. */
  respostasDe: async (idDoPost: string, cursor: string | null = null): Promise<Resultado<RespostasDeForaDoPost>> => {
    if (previa()) return certo(cursor ? { itens: [], proximo: null, total: 1 } : { itens: [respostaDeExemplo()], proximo: null, total: 1 });
    const r = await pedirRota<Partial<RespostasDeForaDoPost>>(`/api/fediverso/remoto?respostas=${q(idDoPost)}${cursor ? `&cursor=${q(cursor)}` : ""}`);
    if (!r.ok) return r;
    const itens = Array.isArray(r.dado.itens) ? r.dado.itens.filter(eDeFora) : [];
    return certo({ itens, proximo: typeof r.dado.proximo === "string" && r.dado.proximo ? r.dado.proximo : null, total: typeof r.dado.total === "number" ? r.dado.total : itens.length });
  },
  /** Acha uma conta pelo endereço (posts só em texto). Conta daqui volta como { local: true, handle }. */
  buscar: (conta: string): Promise<Resultado<AchadoNaBusca | ContaDaqui>> => {
    if (!previa()) return pedirRota(`/api/fediverso/buscar?conta=${q(conta.trim())}`);
    const p = perfilDeExemplo();
    return Promise.resolve(certo({ ator: p.ator, handle: p.handle, nome: p.nome, resumo: p.resumo, url: p.url, posts: p.posts.map((c) => ({ id: c.id, url: c.url, texto: c.texto, aviso: c.aviso, publicado: c.criado_em })), seguindo: "sim" as const, ligado: true }));
  },
  /** Seguir (ou deixar de seguir) o ator. O pedido fica "pedido" até o outro servidor aceitar. */
  seguir: (ator: string, sim: boolean): Promise<Resultado<{ ok: true; seguindo: "pedido" | "nao" }>> =>
    previa() ? Promise.resolve(certo({ ok: true as const, seguindo: sim ? ("pedido" as const) : ("nao" as const) })) : pedirRota("/api/fediverso/seguir", { ator, sim }),
  /** Curtir ("like") ou impulsionar ("announce"), ou desfazer (`sim` falso). Volta o estado de verdade depois da ação. */
  interagir: (post: string, tipo: "like" | "announce", sim: boolean): Promise<Resultado<{ ok: true; tipo: "like" | "announce"; sim: boolean; curti: boolean; impulsionei: boolean }>> =>
    previa() ? Promise.resolve(certo({ ok: true as const, tipo, sim, curti: tipo === "like" && sim, impulsionei: tipo === "announce" && sim })) : pedirRota("/api/fediverso/interagir", { post, tipo, sim }),
  /** Responder a uma nota de fora: vira um post público daqui. `id` é o do post novo. */
  responder: (post: string, texto: string, aviso = ""): Promise<Resultado<{ ok: true; id: string | null }>> =>
    previa() ? Promise.resolve(certo({ ok: true as const, id: null })) : pedirRota("/api/fediverso/responder", { post, texto, aviso }),
  /** Denunciar um post ou uma conta de fora à mediação daqui. `encaminhada` diz se o aviso foi MESMO para o servidor de origem. */
  denunciar: (alvo: string, categoria: CategoriaDeDenuncia, texto = "", encaminhar = false): Promise<Resultado<{ ok: true; protocolo: string | null; encaminhada: boolean; ja: boolean }>> =>
    previa() ? Promise.resolve(certo({ ok: true as const, protocolo: "EXEMPLO-0001", encaminhada: encaminhar, ja: false })) : pedirRota("/api/fediverso/denunciar", { alvo, categoria, texto, encaminhar }),
  /** Bloquear (ou desbloquear) alguém de fora. */
  bloquearPessoa: (ator: string, sim: boolean): Promise<Resultado<{ ok: true; bloqueado: boolean }>> =>
    previa() ? Promise.resolve(certo({ ok: true as const, bloqueado: sim })) : pedirBanco("rede_fed_bloquear_pessoa", { p_ator: ator, p_sim: sim }),
  /** Silenciar (ou não) alguém de fora: some da linha e dos avisos, só aqui. */
  silenciarPessoa: (ator: string, sim: boolean): Promise<Resultado<{ ok: true; silenciado: boolean }>> =>
    previa() ? Promise.resolve(certo({ ok: true as const, silenciado: sim })) : pedirBanco("rede_fed_silenciar_pessoa", { p_ator: ator, p_sim: sim }),
  /** Aparecer (ou não) em buscas e diretórios de outros servidores. Volta a situação nova. */
  descoberta: (sim: boolean): Promise<Resultado<SituacaoDeFora>> =>
    previa() ? Promise.resolve(certo({ ...situacaoDeExemplo(), descobrivel: sim })) : pedirBanco("rede_fed_descoberta", { p_sim: sim }),
  /** A situação da federação da própria pessoa. */
  situacao: (): Promise<Resultado<SituacaoDeFora>> => (previa() ? Promise.resolve(certo(situacaoDeExemplo())) : pedirBanco("rede_fed_situacao")),
};
