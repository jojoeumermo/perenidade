// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O lado do navegador do voto (supabase/migracoes/20261115-alumia-o9-resto8.sql, 20261124-r2-voto.sql, docs/rede/VOTO-SECRETO.md):
//   - os votos que não podem deixar a pessoa ligada ao voto no banco (enquete de post, enquete de story, votação secreta da equipe,
//     o termômetro da equipe) vão pelo servidor do site (app/api/alumia/voto/marca), que grava só a marca de "já votou";
//   - a cédula das votações secretas (consulta à base e eleições, votação da comunidade, votação da equipe) sai CIFRADA deste
//     aparelho para a chave das guardiãs da coordenação (lib/rede/voto/urna.ts): nem o servidor do site nem o banco a abrem. Não há
//     caminho às claras: sem a chave das guardiãs, não se vota, e a tela diz por quê;
//   - o que esta pessoa escolheu fica só neste aparelho (o banco não guarda mais), para a tela mostrar "você votou nesta".
// Sem os atalhos "@/" de propósito (os clientes de lib/rede chamam daqui).
import { BackendError, getClient, hasBackend, localBackend, rpc } from "../../backend";
import { fonteDaIdentidadeDoVoto } from "./identidade";
import { guardarChaveDeGuardia, lerChaveDeGuardia } from "./guarda";
import { criarUrna, ErroDaUrna } from "./urna";
import { criarUrnaAnonima, ErroDoDeposito, type TipoDaUrnaAnonima } from "./urna-anonima";

async function token(): Promise<string> {
  const supabase = await getClient();
  const t = (await supabase.auth.getSession()).data.session?.access_token;
  if (!t) throw new BackendError("entre_primeiro");
  return t;
}

async function postar(caminho: string, corpo: unknown, comSessao: boolean): Promise<{ status: number; dado: Record<string, unknown> | null }> {
  let r: Response;
  try {
    r = await fetch(caminho, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(comSessao ? { Authorization: `Bearer ${await token()}` } : {}) },
      body: JSON.stringify(corpo),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    if (e instanceof BackendError) throw e;
    throw new BackendError("sem_conexao");
  }
  return { status: r.status, dado: (await r.json().catch(() => null)) as Record<string, unknown> | null };
}

/** Um voto pelo servidor (app/api/alumia/voto/marca). Devolve o que o banco devolveu; recusa vira BackendError com o código. */
export async function votoPeloServidor<T>(corpo: Record<string, unknown>): Promise<T> {
  const r = await postar("/api/alumia/voto/marca", corpo, true);
  if (!r.dado?.ok) throw new BackendError(typeof r.dado?.motivo === "string" ? r.dado.motivo : r.status === 404 ? "sem_servico" : "falha");
  return (corpo.tipo === "equipe_ver" ? r.dado.votei : r.dado.dado) as T;
}

// ── O que esta pessoa escolheu, só neste aparelho ──
// Com o prefixo das chaves da Alumia (lib/rede/saida.ts): o "Sair rápido" apaga junto. Até 500 lembranças, as mais novas.
const CHAVE = "lucia:rede:votos";
type Lembranca = Record<string, { e: unknown; em: number }>;

function ler(): Lembranca {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? "{}") as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Lembranca) : {};
  } catch {
    return {};
  }
}

export function lembrarVoto(tipo: "enquete" | "story" | "teste", alvo: string, escolha: unknown) {
  try {
    const m = ler();
    m[`${tipo}:${alvo}`] = { e: escolha, em: Date.now() };
    const chaves = Object.keys(m).sort((a, b) => m[b].em - m[a].em).slice(0, 500);
    localStorage.setItem(CHAVE, JSON.stringify(Object.fromEntries(chaves.map((k) => [k, m[k]]))));
  } catch {
    // sem armazenamento: a tela só não lembra a escolha depois de recarregar
  }
}

export function votoLembrado<T>(tipo: "enquete" | "story" | "teste", alvo: string): T | null {
  const v = ler()[`${tipo}:${alvo}`];
  return v ? (v.e as T) : null;
}

/** P5: o teste do story com o que este aparelho respondeu e a certa (que só chegou na resposta; o banco não sabe quem respondeu). */
export function comTesteLembrado<F extends { minha?: number | null; certa?: number | null }>(f: F, story: string): F {
  if (typeof f.minha === "number") return f;
  const l = votoLembrado<{ minha: number; certa: number | null }>("teste", story);
  return l && typeof l.minha === "number" ? { ...f, minha: l.minha, certa: f.certa ?? l.certa } : f;
}

/** A enquete de um post com a escolha que este aparelho lembra (o banco devolve "votei" vazio). */
export function comVotoLembrado<E extends { votei: string[]; votou?: boolean }>(post: string, e: E): E {
  if (e.votei.length > 0) return e;
  const lembrado = votoLembrado<string[]>("enquete", post);
  return Array.isArray(lembrado) && lembrado.length > 0 ? { ...e, votei: lembrado, votou: true } : e;
}

// ── O voto secreto em limiar: consulta à base (e eleições), votação da comunidade e votação da equipe ──
// A cédula sai CIFRADA deste aparelho para a chave da votação, cuja semente está dividida entre as guardiãs da coordenação
// (lib/rede/voto/urna.ts e limiar.ts). Não há mais caminho às claras nem chave do servidor: sem a chave das guardiãs, não se vota
// ("sem_chave"), e a tela diz por quê. A consulta e a votação da comunidade vão direto ao banco (funcionam também na cópia local);
// a da equipe passa pelo servidor do site, que grava só a marca de "já votou".
// Onda R3 (15): as três vão pela URNA ANÔNIMA (lib/rede/voto/urna-anonima.ts): o passe da urna da votação é pego com a sessão (cedo,
// ao abrir a votação), e a cédula vai sem a sessão. O banco não liga mais a cédula a quem votou pela ordem das transações.

// Quando este aparelho pegou o passe de cada votação (só o instante, para sortear a espera do depósito); "lucia:rede…": o Sair rápido leva.
const CHAVE_PEGO = "lucia:rede:urna-pego";
const passes = () => import("../passes/cliente");
function lerPegos(): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_PEGO) ?? "{}") as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, number>) : {};
  } catch {
    return {};
  }
}
let passesCarregados: Awaited<ReturnType<typeof passes>> | null = null;
const urnaAnonima = criarUrnaAnonima({
  carregar: async () => {
    passesCarregados ??= await passes();
  },
  pegarPasse: async (tipo, alvo) => {
    passesCarregados ??= await passes();
    await passesCarregados.pegarPasseDaUrna(tipo, alvo);
  },
  passe: (tipo, alvo) => passesCarregados?.passeDaUrna(tipo, alvo) ?? null,
  esquecerPasse: (tipo, alvo) => passesCarregados?.esquecerPasseDaUrna(tipo, alvo),
  postarSemSessao: async (caminho, corpo, passe) => {
    try {
      // Sem cookie e sem a sessão: só o passe no cabeçalho.
      const r = await fetch(caminho, { method: "POST", headers: { "Content-Type": "application/json", Authorization: passe }, body: JSON.stringify(corpo), credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store", signal: AbortSignal.timeout(20_000) });
      return { status: r.status, corpo: (await r.json().catch(() => null)) as Record<string, unknown> | null };
    } catch {
      return { status: 0, corpo: { erro: "sem_conexao" } };
    }
  },
  pegoEm: (tipo, alvo) => lerPegos()[`${tipo}:${alvo}`] ?? null,
  marcarPego: (tipo, alvo, em) => {
    try {
      const m = lerPegos();
      m[`${tipo}:${alvo}`] = em;
      const chaves = Object.keys(m).sort((a, b) => m[b] - m[a]).slice(0, 200);
      localStorage.setItem(CHAVE_PEGO, JSON.stringify(Object.fromEntries(chaves.map((k) => [k, m[k]]))));
    } catch {
      // sem armazenamento: o depósito só espera o tempo sorteado sempre
    }
  },
  esperar: (ms) => new Promise((pronto) => setTimeout(pronto, ms)),
  sortear: (maximo) => {
    const b = new Uint32Array(1);
    crypto.getRandomValues(b);
    return Math.floor((b[0] / 2 ** 32) * maximo);
  },
  agora: () => Date.now(),
});

export const urna = criarUrna({
  chamar: (funcao, argumentos) => rpc(funcao, argumentos ?? {}),
  // A fonte ligada pelo chat; se o chat ainda não abriu nesta aba, abre agora (sem ela, a urna não confere o registro e não vota).
  fonte: async () => {
    if (!fonteDaIdentidadeDoVoto()) await import("../chat/r2/navegador").then((n) => n.abrirIdentidadeDoVoto()).catch(() => undefined);
    return fonteDaIdentidadeDoVoto();
  },
  guarda: { ler: lerChaveDeGuardia, guardar: guardarChaveDeGuardia },
  depositar: async (tipo, alvo, cedula) => {
    try {
      return await urnaAnonima.depositar(tipo as TipoDaUrnaAnonima, alvo, cedula);
    } catch (e) {
      throw e instanceof ErroDoDeposito ? new ErroDaUrna(e.codigo) : e;
    }
  },
  prepararCedula: (tipo, alvo) => urnaAnonima.prepararCedula(tipo as TipoDaUrnaAnonima, alvo),
  temCedula: (tipo, alvo) => urnaAnonima.temCedula(tipo as TipoDaUrnaAnonima, alvo),
});

/** O erro da urna vira o erro de sempre do banco (BackendError com o código), que a tela traduz. */
export async function naUrna<T>(fazer: () => Promise<T>): Promise<T> {
  try {
    return await fazer();
  } catch (e) {
    if (e instanceof ErroDaUrna) throw new BackendError(e.codigo);
    throw e;
  }
}

/** Vota na consulta: cifra no aparelho para a chave das guardiãs (depois de conferir o registro). */
export function votarNaConsulta(consulta: string, ranking: string[]): Promise<{ votei: true }> {
  return naUrna(() => urna.votar("consulta", consulta, ranking) as Promise<{ votei: true }>);
}

/**
 * As funções do banco que passam por aqui (lib/rede/cliente.ts troca a chamada). A enquete e a figurinha vão pelo servidor do site
 * (a marca de "já votou"); a cópia local de testes (scripts/backend-local.mjs) não tem essa rota, e ali elas seguem direto para o
 * banco. A consulta à base é sempre cifrada aqui, com ou sem o servidor do site.
 */
export const VOTO_PELO_SERVIDOR: Record<string, (a: Record<string, unknown>) => Promise<unknown>> = {
  ...(hasBackend && !localBackend
    ? {
        rede_pub_enquete_votar: async (a: Record<string, unknown>) => {
          const post = String(a.p_post);
          const opcoes = (a.p_opcoes as string[]) ?? [];
          const e = await votoPeloServidor<{ votei: string[] }>({ tipo: "enquete", post, opcoes });
          lembrarVoto("enquete", post, opcoes);
          return e;
        },
        rede_story_votar: async (a: Record<string, unknown>) => {
          const story = String(a.p_id);
          const f = await votoPeloServidor<Record<string, unknown>>({ tipo: "story", story, opcao: a.p_opcao });
          // Já tinha votado (outro aparelho): o voto de antes vale, e este aparelho não sabe qual foi.
          if (f.ja_votou) return { ...f, meu_voto: votoLembrado<0 | 1>("story", story) };
          lembrarVoto("story", story, a.p_opcao);
          return f;
        },
        // P5: o teste com resposta certa do story. Este aparelho lembra o que respondeu e qual era a certa (o banco não sabe quem).
        rede_story_testar: async (a: Record<string, unknown>) => {
          const story = String(a.p_id);
          const f = await votoPeloServidor<Record<string, unknown>>({ tipo: "teste", story, opcao: a.p_opcao });
          const lembrado = votoLembrado<{ minha: number; certa: number }>("teste", story);
          if (f.ja_respondeu) return { ...f, minha: lembrado?.minha ?? null };
          lembrarVoto("teste", story, { minha: a.p_opcao, certa: f.certa });
          return f;
        },
        // Prompt 4, item 132: o "pouco útil" numa resposta. A marca é calculada no servidor do site (o banco não tem o segredo).
        rede_p4_pouco_util: (a: Record<string, unknown>) => votoPeloServidor({ tipo: "pouco_util", post: String(a.p_post), sim: a.p_sim === true }),
        rede_p4_pouco_util_meus: (a: Record<string, unknown>) =>
          votoPeloServidor({ tipo: "pouco_util_ver", posts: Array.isArray(a.p_posts) ? a.p_posts.map(String) : [] }),
        // Prompt 4, item 89: o "mandei" da pressão em parlamentar, pelo mesmo motivo.
        rede_p4_pressao_mandei: (a: Record<string, unknown>) =>
          votoPeloServidor({ tipo: "pressao", pressao: String(a.p_id), sim: a.p_sim === true }),
        rede_p4_pressao_minhas: (a: Record<string, unknown>) =>
          votoPeloServidor({ tipo: "pressao_ver", pressoes: Array.isArray(a.p_pressoes) ? a.p_pressoes.map(String) : [] }),
      }
    : {}),
  ...(hasBackend ? { rede_org_consulta_votar: (a: Record<string, unknown>) => votarNaConsulta(String(a.p_consulta), (a.p_ranking as string[]) ?? []) } : {}),
};
