// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A impressão de rede: o "banir por IP" da Alumia sem guardar IP. Nenhum endereço
// de rede é guardado, nem em registro de acesso (decisão da coordenação de 13/11).
// Só no servidor. O endereço de quem entra vira HMAC-SHA-256 com um segredo que vive em variável de ambiente
// (ALUMIA_IMPRESSAO_SEGREDO) e nunca chega ao banco: o banco guarda só o resumo, e sem o segredo o resumo não volta ao endereço
// nem testando os 4 bilhões de IPv4. No IPv6 entra só o prefixo /64 (a rede da casa ou do aparelho): os outros 64 bits mudam
// sozinhos, e bani-los um a um não barraria ninguém.
//
// Sem os atalhos "@/" de propósito: `npm run testar:alumia-o7-painel` roda este arquivo direto no Node.
import { createHmac, timingSafeEqual } from "node:crypto";

/** O menor segredo aceito. Menor que isso, nada é calculado (e nada é registrado). */
export const TAMANHO_MINIMO_DO_SEGREDO = 32;

// ── Segredos com versão (onda R3, 2.6) ─────────────────────────────────────────────────────────────────────────────────────
// Um segredo do servidor pode vir com versão: "v<N>:<base64url de 32 bytes ou mais>" (o que a cerimônia, scripts/segredos/
// cerimonia.mjs, entrega). Sem o prefixo, é o segredo de antes (versão 1, o texto inteiro como chave: as impressões de antes valem
// igual). Na troca, o servidor guarda também o anterior (ALUMIA_IMPRESSAO_SEGREDO_ANTERIOR) e calcula as duas impressões: o banco
// aceita a anterior por 30 dias desde que viu a versão nova pela primeira vez (os banimentos por rede seguem valendo na troca), e a
// de antes da anterior, nunca.

export interface SegredoVersionado {
  versao: number;
  chave: Buffer;
}

/** Lê um segredo com ou sem versão. Nulo se curto, torto ou com versão fora de 1..32767. */
export function lerSegredo(texto: string | undefined | null): SegredoVersionado | null {
  if (!texto) return null;
  const m = /^v([1-9][0-9]{0,4}):([A-Za-z0-9_-]+)$/.exec(texto);
  if (m) {
    const versao = Number(m[1]);
    const chave = Buffer.from(m[2], "base64url");
    return versao <= 32767 && chave.length >= TAMANHO_MINIMO_DO_SEGREDO && chave.toString("base64url") === m[2] ? { versao, chave } : null;
  }
  // Parece ter versão ("v<algarismos>:") mas não fecha: recusado (não vira, por engano, um segredo de antes).
  if (/^v[0-9]+:/.test(texto)) return null;
  return texto.length >= TAMANHO_MINIMO_DO_SEGREDO ? { versao: 1, chave: Buffer.from(texto, "utf8") } : null;
}

function ipv4(texto: string): string | null {
  const partes = texto.split(".");
  if (partes.length !== 4) return null;
  const numeros = partes.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return numeros.every((n) => n >= 0 && n <= 255) ? numeros.join(".") : null;
}

/** Os oito grupos de um IPv6 (com "::" expandido), ou nulo se não for IPv6. */
function gruposDoIpv6(texto: string): string[] | null {
  if (!/^[0-9a-f:]+$/.test(texto) || texto.includes(":::")) return null;
  const lados = texto.split("::");
  if (lados.length > 2) return null;
  const esquerda = lados[0] ? lados[0].split(":") : [];
  const direita = lados.length === 2 && lados[1] ? lados[1].split(":") : [];
  const faltam = 8 - esquerda.length - direita.length;
  if (lados.length === 1 ? faltam !== 0 : faltam < 1) return null;
  const grupos = [...esquerda, ...Array<string>(lados.length === 2 ? faltam : 0).fill("0"), ...direita];
  if (grupos.length !== 8 || grupos.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return grupos.map((g) => g.replace(/^0+(?=.)/, ""));
}

/**
 * A rede de um endereço, na forma que entra na conta: o IPv4 inteiro, ou o prefixo /64 do IPv6 ("2001:db8:aa:bb::/64").
 * IPv4 embrulhado em IPv6 ("::ffff:203.0.113.7") vale como IPv4. O que não for endereço devolve nulo.
 */
export function redeDoEndereco(endereco: string | null | undefined): string | null {
  const texto = (endereco ?? "").trim().toLowerCase().replace(/^\[|\]$/g, "").replace(/%.*$/, "");
  if (!texto) return null;
  const embrulhado = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(texto);
  if (embrulhado) return ipv4(embrulhado[1]);
  if (!texto.includes(":")) return ipv4(texto);
  const grupos = gruposDoIpv6(texto);
  return grupos ? `${grupos.slice(0, 4).join(":")}::/64` : null;
}

/** A impressão: HMAC-SHA-256 da rede, em hexadecimal (64 letras). Sem segredo bom ou sem endereço válido, nulo. */
export function impressaoDaRede(endereco: string | null | undefined, segredo: string | undefined): string | null {
  const rede = redeDoEndereco(endereco);
  const s = lerSegredo(segredo);
  if (!rede || !s) return null;
  return createHmac("sha256", s.chave).update(`alumia:rede:${rede}`).digest("hex");
}

/**
 * As impressões para o banco na troca de segredo: a da versão atual e, se o anterior é EXATAMENTE a versão de antes, a dele. Nulo
 * sem segredo bom ou sem endereço válido. Um anterior de outra versão (mais velho, ou igual) é ignorado.
 */
export function impressoesDaRede(
  endereco: string | null | undefined,
  atual: string | undefined = process.env.ALUMIA_IMPRESSAO_SEGREDO,
  anterior: string | undefined = process.env.ALUMIA_IMPRESSAO_SEGREDO_ANTERIOR,
): { versao: number; impressao: string; anterior: string | null } | null {
  const a = lerSegredo(atual);
  const impressao = impressaoDaRede(endereco, atual);
  if (!a || !impressao) return null;
  const b = lerSegredo(anterior);
  return { versao: a.versao, impressao, anterior: b && b.versao === a.versao - 1 ? impressaoDaRede(endereco, anterior) : null };
}

/** O pedido traz o sinal da borda (o cabeçalho que a regra da Cloudflare põe, com o segredo de ALUMIA_BORDA_SEGREDO)? */
export function veioDaBorda(cabecalhos: Headers, segredo: string | undefined = process.env.ALUMIA_BORDA_SEGREDO): boolean {
  if (!segredo || segredo.length < TAMANHO_MINIMO_DO_SEGREDO) return true;
  const sinal = Buffer.from(cabecalhos.get("x-alumia-borda") ?? "");
  const esperado = Buffer.from(segredo);
  return sinal.length === esperado.length && timingSafeEqual(sinal, esperado);
}

/**
 * O endereço de quem fez o pedido, só para calcular a impressão na hora (ele não é guardado nem registrado em lugar nenhum).
 * Em produção vale SÓ o "cf-connecting-ip", que a Cloudflare escreve por cima do que o visitante mandar: sem ele (o site
 * rodando sem a Cloudflare na frente, numa prévia ou num espelho), não há impressão, porque "x-forwarded-for" e "x-real-ip"
 * quem chama escolhe. Com ALUMIA_BORDA_SEGREDO definido, o "cf-connecting-ip" só vale se o pedido trouxer também o sinal da
 * borda (x-alumia-borda, posto por uma regra da Cloudflare): quem chega à origem por fora da Cloudflare não escolhe o endereço.
 * Fora de produção (cópia local, testes), os dois valem como recurso.
 */
export function enderecoDoPedido(cabecalhos: Headers, soBorda: boolean = process.env.NODE_ENV === "production"): string | null {
  const borda = cabecalhos.get("cf-connecting-ip")?.trim() ?? "";
  if (soBorda) return borda && veioDaBorda(cabecalhos) ? borda : null;
  if (borda) return borda;
  const bruto = cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim() || cabecalhos.get("x-real-ip")?.trim() || "";
  return bruto || null;
}
