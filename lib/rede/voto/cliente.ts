// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O lado do navegador do voto (supabase/migracoes/20261115-alumia-o9-resto8.sql, docs/rede/VOTO-SECRETO.md):
//   - os votos que não podem deixar a pessoa ligada ao voto no banco (enquete de post, enquete de story, votação secreta da equipe,
//     o termômetro da equipe) vão pelo servidor do site (app/api/alumia/voto/marca), que grava só a marca de "já votou";
//   - a cédula da consulta à base sai CIFRADA deste aparelho (lib/rede/voto/cedula.ts) com a chave pública da consulta; só
//     quando o servidor responde que não tem o segredo do voto ("sem_servico") vai pelo caminho de antes (a urna do banco). Freio,
//     falta de rede ou cifra que falhou viram erro na tela: o voto nunca cai em silêncio para o caminho sem cifra;
//   - o que esta pessoa escolheu fica só neste aparelho (o banco não guarda mais), para a tela mostrar "você votou nesta".
// Sem os atalhos "@/" de propósito (os clientes de lib/rede chamam daqui).
import { BackendError, getClient, hasBackend, localBackend, rpc } from "../../backend";
import { cifrarCedula } from "./cedula";

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

export function lembrarVoto(tipo: "enquete" | "story", alvo: string, escolha: unknown) {
  try {
    const m = ler();
    m[`${tipo}:${alvo}`] = { e: escolha, em: Date.now() };
    const chaves = Object.keys(m).sort((a, b) => m[b].em - m[a].em).slice(0, 500);
    localStorage.setItem(CHAVE, JSON.stringify(Object.fromEntries(chaves.map((k) => [k, m[k]]))));
  } catch {
    // sem armazenamento: a tela só não lembra a escolha depois de recarregar
  }
}

export function votoLembrado<T>(tipo: "enquete" | "story", alvo: string): T | null {
  const v = ler()[`${tipo}:${alvo}`];
  return v ? (v.e as T) : null;
}

/** A enquete de um post com a escolha que este aparelho lembra (o banco devolve "votei" vazio). */
export function comVotoLembrado<E extends { votei: string[]; votou?: boolean }>(post: string, e: E): E {
  if (e.votei.length > 0) return e;
  const lembrado = votoLembrado<string[]>("enquete", post);
  return Array.isArray(lembrado) && lembrado.length > 0 ? { ...e, votei: lembrado, votou: true } : e;
}

// ── A consulta à base ──

// A chave pública de cada consulta, guardada na memória desta aba (é pública; poupa pedidos ao servidor).
const chaves = new Map<string, string>();

/**
 * A chave pública da consulta, ou nulo só quando o servidor diz que não tem o segredo do voto ("sem_servico"). Qualquer outra
 * recusa vira BackendError: a tela mostra o erro e a pessoa tenta de novo, sem rebaixar o voto.
 */
async function chaveDaConsulta(consulta: string): Promise<string | null> {
  const guardada = chaves.get(consulta);
  if (guardada) return guardada;
  const r = await postar("/api/alumia/voto/chave", { consulta }, true);
  if (r.dado?.ok && typeof r.dado.chave === "string") {
    chaves.set(consulta, r.dado.chave);
    return r.dado.chave;
  }
  if (r.dado?.motivo === "sem_servico") return null;
  throw new BackendError(typeof r.dado?.motivo === "string" ? r.dado.motivo : "falha");
}

/** Vota na consulta: cifra no aparelho; o caminho de antes só quando o servidor não tem o segredo do voto. */
export async function votarNaConsulta(consulta: string, ranking: string[]): Promise<{ votei: true }> {
  const chave = await chaveDaConsulta(consulta);
  if (chave === null) return rpc<{ votei: true }>("rede_org_consulta_votar", { p_consulta: consulta, p_ranking: ranking });
  let cedula: string;
  try {
    cedula = await cifrarCedula(consulta, chave, ranking);
  } catch {
    throw new BackendError("falha");
  }
  return rpc<{ votei: true }>("rede_org_consulta_votar_cifrada", { p_consulta: consulta, p_cedula: cedula });
}

/** Pede ao servidor para abrir as cédulas cifradas de uma consulta fechada. Verdadeiro se abriu (a tela recarrega). */
export async function apurarConsulta(consulta: string): Promise<boolean> {
  try {
    const r = await postar("/api/alumia/voto/abrir", { consulta }, true);
    return r.dado?.ok === true;
  } catch {
    return false;
  }
}

/**
 * As funções do banco que passam pelo servidor do site (lib/rede/cliente.ts troca a chamada). A cópia local de testes
 * (scripts/backend-local.mjs) não tem as rotas: ali tudo segue direto para o banco.
 */
export const VOTO_PELO_SERVIDOR: Record<string, (a: Record<string, unknown>) => Promise<unknown>> =
  hasBackend && !localBackend
    ? {
        rede_pub_enquete_votar: async (a) => {
          const post = String(a.p_post);
          const opcoes = (a.p_opcoes as string[]) ?? [];
          const e = await votoPeloServidor<{ votei: string[] }>({ tipo: "enquete", post, opcoes });
          lembrarVoto("enquete", post, opcoes);
          return e;
        },
        rede_story_votar: async (a) => {
          const story = String(a.p_id);
          const f = await votoPeloServidor<Record<string, unknown>>({ tipo: "story", story, opcao: a.p_opcao });
          // Já tinha votado (outro aparelho): o voto de antes vale, e este aparelho não sabe qual foi.
          if (f.ja_votou) return { ...f, meu_voto: votoLembrado<0 | 1>("story", story) };
          lembrarVoto("story", story, a.p_opcao);
          return f;
        },
        rede_org_consulta_votar: (a) => votarNaConsulta(String(a.p_consulta), (a.p_ranking as string[]) ?? []),
      }
    : {};
