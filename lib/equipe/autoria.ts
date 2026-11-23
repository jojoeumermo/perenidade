// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Onda R3, o que a R2 deixou (13): o chat da equipe sem autor e sem hora no banco. Quem escreveu e quando vão DENTRO do cifrado
// ("m1", lib/equipe/mls.ts), assinados pela identidade de quem escreve (ECDSA P-256, lib/sigilo.ts). O banco guarda o dia, um número
// por conversa e o resumo de uma "ficha de dono" (supabase/migracoes/20261125-r3-resto-r2.sql).
//
// Formatos:
//   - texto assinado, dentro do cifrado: "s2.<autor>.<hora em ms>.<assinatura>.<texto>", a assinatura sobre
//     "alumia/r3/equipe/mensagem/v1|<conversa>|e<época>|<id>|<tipo>|<alvo ou ->|<autor>|<hora>|<texto>": prende o texto à conversa, à
//     época, ao id da mensagem (escolhido pelo aparelho), ao tipo e ao alvo (uma reação não muda de mensagem) e a quem escreveu;
//   - contexto do cifrado (o AAD do "m1"): "conversa2:<conversa>:<id>" (sem o autor: quem abre ainda não sabe quem foi);
//   - ficha de dono: HMAC-SHA-256(K, "<finalidade>|<conversa>|<alvo>"), com K = HKDF-SHA-256(os 32 bytes secretos da identidade, sal
//     vazio, "alumia/r3/equipe/dono/v1"). Só os aparelhos aprovados da pessoa têm a identidade (lib/chaveiro.ts), então só eles fazem a
//     ficha. O banco guarda SHA-256(ficha) ("dono") e, para apagar ou editar, recebe a ficha e confere o resumo. Para "mensagem", o
//     alvo é o id da própria mensagem (uma ficha diferente em cada uma: o banco não liga duas mensagens à mesma pessoa); para reação,
//     voto e resposta a evento, o alvo é a mensagem reagida (a mesma ficha para a mesma pessoa e a mesma mensagem: a nova troca a
//     anterior sem o banco saber quem é).
// Garantias e limites (o público, com o modelo de ameaça, em
// docs/rede/CHAT-PRIVADO.md): quem copia o banco não lê autor nem hora; o servidor no ar continua vendo a sessão de quem chama a função
// (o mesmo limite do resto do chat da equipe: os membros de cada conversa ficam no cadastro do painel). A hora é a do aparelho de quem
// escreve: um membro pode mentir a própria hora (não a de outro).
// Sem "@/": roda no Node nos testes (scripts/testar-r3-resto-equipe.mjs).
import { hkdf } from "@noble/hashes/hkdf.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { assinar, deBase64, exportarIdentidade, paraBase64, verificar, type Autoria, type Identidade } from "../sigilo";

export const ROTULOS = {
  mensagem: "alumia/r3/equipe/mensagem/v1",
  dono: "alumia/r3/equipe/dono/v1",
} as const;

export type TipoDaMensagem = "texto" | "reacao" | "edicao" | "voto" | "rsvp";
export type FinalidadeDaFicha = "mensagem" | "reacao" | "voto" | "rsvp";

/** O que identifica uma mensagem dentro da conversa (o que o banco sabe e o aparelho confere). */
export interface Lugar {
  conversa: string;
  id: string;
  tipo: TipoDaMensagem;
  alvo: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const B64 = "[A-Za-z0-9_-]";
const FORMATO_S2 = new RegExp(`^s2\\.([0-9a-f-]{36})\\.([0-9]{13})\\.(${B64}{86})\\.([\\s\\S]*)$`);
const encoder = new TextEncoder();

/** O contexto do cifrado de uma mensagem (o AAD do "m1"): a conversa e o id, sem o autor. */
export const contextoDaMensagem = (conversa: string, id: string) => `conversa2:${conversa}:${id}`;

const amarra = (l: Lugar, epoca: number, autor: string, hora: number, texto: string) =>
  `${ROTULOS.mensagem}|${l.conversa}|e${epoca}|${l.id}|${l.tipo}|${l.alvo ?? "-"}|${autor}|${hora}|${texto}`;

/** Assina o texto com quem escreveu e a hora, para ir dentro do cifrado. */
export async function assinarMensagem(identidade: Identidade, l: Lugar, epoca: number, autor: string, hora: number, texto: string): Promise<string> {
  if (!UUID.test(l.id) || !UUID.test(autor) || !Number.isSafeInteger(hora) || String(hora).length !== 13) throw new Error("mensagem_invalida");
  return `s2.${autor}.${hora}.${await assinar(identidade.privada, amarra(l, epoca, autor, hora, texto))}.${texto}`;
}

export interface MensagemAberta {
  texto: string;
  /** Quem escreveu, como está dentro do cifrado (só vale como autoria se `autoria` for "ok"). */
  autor: string | null;
  /** A hora de quem escreveu, em ms desde 1970. */
  hora: number | null;
  autoria: Autoria;
}

/**
 * Separa o texto, o autor e a hora, e confere a assinatura com a identidade que este aparelho conhece do autor de dentro. Texto sem
 * o formato "s2" (o banco ou alguém pondo coisa no lugar): "sem_assinatura", sem autor.
 */
export async function abrirMensagem(aberto: string, l: Lugar, epoca: number, identidadeDe: (usuario: string) => string | null): Promise<MensagemAberta> {
  const p = FORMATO_S2.exec(aberto);
  if (!p) return { texto: aberto, autor: null, hora: null, autoria: "sem_assinatura" };
  const [, autor, horaTexto, assinatura, texto] = p;
  const hora = Number(horaTexto);
  const conhecida = identidadeDe(autor);
  if (!conhecida) return { texto, autor, hora, autoria: "sem_identidade" };
  const ok = await verificar(conhecida, assinatura, amarra(l, epoca, autor, hora, texto));
  return { texto, autor, hora, autoria: ok ? "ok" : "invalida" };
}

/** A chave das fichas de dono, tirada dos 32 bytes secretos da identidade (os mesmos em todos os aparelhos aprovados da pessoa). */
export async function chaveDasFichas(identidade: Identidade): Promise<Uint8Array> {
  const secreta = await exportarIdentidade(identidade);
  try {
    return hkdf(sha256, secreta, new Uint8Array(0), encoder.encode(ROTULOS.dono), 32);
  } finally {
    secreta.fill(0);
  }
}

/** A ficha de dono (32 bytes, em base64url): só quem tem a identidade faz. */
export function ficha(chave: Uint8Array, finalidade: FinalidadeDaFicha, conversa: string, alvo: string): string {
  if (chave.length !== 32 || !UUID.test(conversa) || !UUID.test(alvo)) throw new Error("ficha_invalida");
  return paraBase64(hmac(sha256, chave, encoder.encode(`${finalidade}|${conversa}|${alvo}`)));
}

/** O resumo que vai ao banco (SHA-256 da ficha, em base64url). */
export const resumoDaFicha = (f: string) => paraBase64(sha256(deBase64(f)));

/** A finalidade da ficha de cada tipo de mensagem e o alvo dela. */
export function fichaDoEnvio(chave: Uint8Array, l: Lugar): { dono: string; ficha: string } {
  const finalidade: FinalidadeDaFicha = l.tipo === "reacao" || l.tipo === "voto" || l.tipo === "rsvp" ? l.tipo : "mensagem";
  const alvo = finalidade === "mensagem" ? l.id : l.alvo;
  if (!alvo) throw new Error("ficha_invalida");
  const f = ficha(chave, finalidade, l.conversa, alvo);
  return { ficha: f, dono: resumoDaFicha(f) };
}

/** O id novo de uma mensagem (UUID v4 do sorteio do navegador). */
export const novoIdDeMensagem = () => crypto.randomUUID();

/** Uma edição só vale se vier de quem escreveu a original e até 15 minutos depois dela (a hora assinada das duas). */
export const PRAZO_DA_EDICAO_MS = 15 * 60_000;
export function edicaoValida(original: MensagemAberta | null | undefined, edicao: MensagemAberta | null | undefined): boolean {
  if (!original || !edicao || original.autoria !== "ok" || edicao.autoria !== "ok") return false;
  if (!original.autor || original.autor !== edicao.autor || original.hora === null || edicao.hora === null) return false;
  return edicao.hora >= original.hora && edicao.hora - original.hora <= PRAZO_DA_EDICAO_MS;
}
