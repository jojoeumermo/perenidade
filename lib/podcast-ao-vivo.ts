// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Podcast ao vivo (T17): as regras puras, sem nada do navegador, para rodar também no teste em Node
// (scripts/testar-podcast-imersivo.mjs). O componente é components/podcast/AoVivo.tsx; o banco,
// supabase/migracoes/20261106-t17-podcast-ao-vivo.sql; a explicação e os limites, docs/PODCAST-AO-VIVO.md.
//
// Dois jeitos de transmitir, reaproveitando o que o site já tem para as aulas ao vivo:
//   - "navegador": quem faz o podcast liga a câmera aqui mesmo e o vídeo vai direto do navegador dela para quem assiste
//     (WebRTC com a sala e a transmissão de lib/tempo-real.ts e lib/aovivo.ts, com a presença assinada e, quando
//     configurado, o TURN da Cloudflare de /api/aovivo/rede, que esconde o endereço de rede de todo mundo). Cada pessoa
//     assistindo é uma cópia do vídeo saindo da conexão de quem transmite: por isso o teto LIMITE_DIRETO;
//   - "link": uma transmissão aberta feita fora (OBS → PeerTube, ou YouTube). O PeerTube/YouTube distribui para quanta
//     gente for; a página só embute o tocador depois do clique (PeerTube sem P2P; YouTube pelo endereço sem cookies).
import { idDoYoutube, videoPeerTube } from "./aula-sala.ts";
import type { Presente } from "./tempo-real.ts";

/** Quantas pessoas assistem direto do navegador de quem transmite (720p a ~1,5 Mbit/s cada: ~22 Mbit/s de subida). */
export const LIMITE_DIRETO = 15;

/** Quanto tempo sem sinal de vida de quem transmite pelo navegador até a página considerar a transmissão encerrada. */
export const PULSO_SEGUNDOS = 60;

export type Modo = "navegador" | "link";

export interface EstadoAoVivo {
  no_ar: boolean;
  titulo?: string;
  modo?: Modo;
  /** A transmissão aberta (modo "link"), ou a reserva para quando a sala direta lotar (modo "navegador"). */
  endereco?: string;
  /** A sala do WebRTC (modo "navegador"): um identificador sorteado a cada transmissão. */
  sala?: string;
  /** As chaves públicas de quem transmite nesta sala: quem assiste só aceita vídeo assinado por uma delas. */
  chaves?: string[];
  desde?: string;
  /** Quem está vendo a página pode transmitir (é do podcast, no painel). */
  pode?: boolean;
  /** Quem está vendo a página é quem começou esta transmissão. */
  minha?: boolean;
}

export type EnderecoAberto = { tipo: "peertube"; url: string; host: string; id: string } | { tipo: "youtube"; url: string; id: string } | { tipo: "link"; url: string };

/**
 * Como a página mostra o endereço de uma transmissão aberta: PeerTube da lista do instituto e YouTube viram tocador (só
 * depois do clique); outro endereço https vira só um link (a página não embute site que o instituto não conhece);
 * qualquer outra coisa é recusada.
 */
export function enderecoAberto(url: string, dominiosPeerTube: string[]): EnderecoAberto | null {
  const texto = (url ?? "").trim();
  if (!texto || texto.length > 500) return null;
  let u: URL;
  try {
    u = new URL(texto);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password) return null;
  const pt = videoPeerTube(texto, dominiosPeerTube);
  if (pt) return { tipo: "peertube", url: texto, ...pt };
  const yt = idDoYoutube(texto);
  if (yt) return { tipo: "youtube", url: texto, id: yt };
  return { tipo: "link", url: u.href };
}

/**
 * Quem fica na sala direta, decidido no navegador de quem transmite: todo mundo que transmite e até LIMITE_DIRETO
 * pessoas assistindo. Quem já foi admitido e continua na sala fica (ninguém perde o vídeo porque outra pessoa chegou);
 * as vagas livres vão para quem chegou, pela ordem de chegada (ou, sem ela, da chave de cada aba). Quem fica de fora recebe o aviso de
 * sala cheia e, se houver, vê a transmissão aberta de reserva.
 */
export function naSalaDireta(
  presentes: Presente[],
  admitidos: ReadonlySet<string> = new Set(),
  limite = LIMITE_DIRETO,
  /**
   * T33: `chegada` (chave → quando quem transmite viu a aba pela primeira vez) põe as vagas livres em ordem de chegada, em
   * vez da chave que a própria aba escolhe (com ela, um script com chaves "0000…" passava na frente de todo mundo).
   * `barrados`: quem pegou vaga e não ligou o vídeo a tempo espera um pouco antes de tentar de novo.
   */
  opcoes: { chegada?: ReadonlyMap<string, number>; barrados?: ReadonlySet<string> } = {},
): { lista: Presente[]; admitidos: Set<string>; fora: Presente[] } {
  const chegada = opcoes.chegada;
  const ordem = [...presentes].sort((a, b) => {
    if (chegada) {
      const d = (chegada.get(a.chave) ?? Number.MAX_SAFE_INTEGER) - (chegada.get(b.chave) ?? Number.MAX_SAFE_INTEGER);
      if (d) return d;
    }
    return a.chave < b.chave ? -1 : a.chave > b.chave ? 1 : 0;
  });
  const quem = ordem.filter((p) => p.papel === "educador");
  const todos = ordem.filter((p) => p.papel !== "educador");
  const assistem = todos.filter((p) => !opcoes.barrados?.has(p.chave));
  const ficam = assistem.filter((p) => admitidos.has(p.chave)).slice(0, Math.max(0, limite));
  const vagas = Math.max(0, limite - ficam.length);
  const chegam = assistem.filter((p) => !admitidos.has(p.chave)).slice(0, vagas);
  const dentro = new Set([...ficam, ...chegam].map((p) => p.chave));
  return { lista: [...quem, ...assistem.filter((p) => dentro.has(p.chave))], admitidos: dentro, fora: todos.filter((p) => !dentro.has(p.chave)) };
}

/** Quanto tempo quem ganhou a vaga tem para ligar o vídeo de verdade, e quanto espera depois se não ligar (T33). */
export const PRAZO_LIGAR_MS = 20_000;
export const BARRADO_MS = 2 * 60_000;

/**
 * Quem está com vaga na sala direta e não ligou o vídeo no prazo (presença sem ligação: uma aba travada ou um script
 * ocupando vaga). Quem já ligou alguma vez não sai por aqui: se cair, a presença dele some e a vaga se libera sozinha.
 */
export function semLigacao(admitidos: ReadonlySet<string>, admitidoEm: ReadonlyMap<string, number>, ligaram: ReadonlySet<string>, agora: number, prazo = PRAZO_LIGAR_MS): string[] {
  return [...admitidos].filter((c) => !ligaram.has(c) && agora - (admitidoEm.get(c) ?? agora) > prazo);
}
