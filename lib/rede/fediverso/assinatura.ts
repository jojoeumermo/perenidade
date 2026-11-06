// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Assinatura HTTP do Fediverso (draft-cavage-http-signatures, a que o Mastodon usa): quem entrega uma atividade assina a linha do
// pedido, o host, a data e o resumo (Digest) do corpo com a chave privada do ator; quem recebe busca a chave pública do ator e
// confere. Aqui: assinar (para entregar) e conferir (na caixa de entrada). Só RSA com SHA-256. Lógica pura, sem "@/".
import { createHash, createSign, createVerify, generateKeyPairSync, timingSafeEqual } from "node:crypto";

export interface Assinatura {
  keyId: string;
  algorithm: string;
  headers: string[];
  signature: string;
}

/** "SHA-256=<base64>" do corpo. */
export function digestDe(corpo: string | Uint8Array): string {
  return `SHA-256=${createHash("sha256").update(corpo).digest("base64")}`;
}

/** Um par RSA de 2048 bits (PEM), como o Mastodon usa. */
export function gerarParDeChaves(): { publica: string; privada: string } {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publica: publicKey, privada: privateKey };
}

/** O texto que é assinado: uma linha "nome: valor" por cabeçalho, na ordem da lista. Nulo se falta um cabeçalho pedido. */
export function textoParaAssinar(cabecalhos: string[], metodo: string, caminho: string, ler: (nome: string) => string | null): string | null {
  const linhas: string[] = [];
  for (const nome of cabecalhos) {
    if (nome === "(request-target)") {
      linhas.push(`(request-target): ${metodo.toLowerCase()} ${caminho}`);
      continue;
    }
    const valor = ler(nome);
    if (valor === null) return null;
    linhas.push(`${nome}: ${valor.trim()}`);
  }
  return linhas.join("\n");
}

/** Os cabeçalhos assinados de um pedido de saída (Date, Host, Digest e Signature). */
export function assinarPedido({
  metodo,
  url,
  corpo,
  chaveId,
  chavePrivada,
  data = new Date(),
}: {
  metodo: "GET" | "POST";
  url: string;
  corpo?: string;
  chaveId: string;
  chavePrivada: string;
  data?: Date;
}): Record<string, string> {
  const u = new URL(url);
  const cab: Record<string, string> = { host: u.host, date: data.toUTCString() };
  const nomes = ["(request-target)", "host", "date"];
  if (metodo === "POST") {
    cab.digest = digestDe(corpo ?? "");
    cab["content-type"] = "application/activity+json";
    nomes.push("digest", "content-type");
  }
  const texto = textoParaAssinar(nomes, metodo, `${u.pathname}${u.search}`, (n) => cab[n] ?? null) as string;
  const assinatura = createSign("sha256").update(texto).sign(chavePrivada, "base64");
  return {
    Host: cab.host,
    Date: cab.date,
    ...(cab.digest ? { Digest: cab.digest, "Content-Type": cab["content-type"] } : {}),
    Signature: `keyId="${chaveId}",algorithm="rsa-sha256",headers="${nomes.join(" ")}",signature="${assinatura}"`,
  };
}

/** Lê o cabeçalho Signature (ou "Authorization: Signature …"). Nulo se não tem os campos obrigatórios. */
export function lerAssinatura(valor: string | null): Assinatura | null {
  if (!valor) return null;
  const texto = valor.replace(/^Signature\s+/i, "");
  if (texto.length > 4096) return null;
  const campos: Record<string, string> = {};
  for (const m of texto.matchAll(/([a-zA-Z]+)="([^"]*)"/g)) campos[m[1]] = m[2];
  if (!campos.keyId || !campos.signature) return null;
  return {
    keyId: campos.keyId,
    algorithm: (campos.algorithm ?? "rsa-sha256").toLowerCase(),
    headers: (campos.headers ?? "date").toLowerCase().split(/\s+/).filter(Boolean),
    signature: campos.signature,
  };
}

export type MotivoDaRecusa =
  | "sem_assinatura"
  | "algoritmo"
  | "cabecalhos_faltando"
  | "data_fora_da_janela"
  | "digest_diferente"
  | "assinatura_invalida";

// A janela de tempo da data assinada: até 12 horas para trás (entregas que esperaram na fila do outro lado) e 1 hora para a frente
// (relógio adiantado), como o Mastodon.
const PASSADO_MS = 12 * 3_600_000;
const FUTURO_MS = 3_600_000;

/**
 * Confere a assinatura de um pedido recebido. Exige (request-target), host e date assinados; num POST, também o digest, que
 * precisa bater com o corpo. `ler` devolve um cabeçalho do pedido (nulo se não existe).
 */
export function conferirAssinatura({
  metodo,
  caminho,
  ler,
  corpo,
  chavePublica,
  agora = Date.now(),
}: {
  metodo: string;
  caminho: string;
  ler: (nome: string) => string | null;
  corpo?: Uint8Array | string;
  chavePublica: string;
  agora?: number;
}): { ok: true; assinatura: Assinatura } | { ok: false; motivo: MotivoDaRecusa } {
  const assinatura = lerAssinatura(ler("signature") ?? ler("authorization"));
  if (!assinatura) return { ok: false, motivo: "sem_assinatura" };
  if (!["rsa-sha256", "hs2019"].includes(assinatura.algorithm)) return { ok: false, motivo: "algoritmo" };
  const exigidos = ["(request-target)", "host", "date", ...(metodo.toUpperCase() === "POST" ? ["digest"] : [])];
  if (!exigidos.every((h) => assinatura.headers.includes(h))) return { ok: false, motivo: "cabecalhos_faltando" };
  const data = Date.parse(ler("date") ?? "");
  if (!Number.isFinite(data) || data < agora - PASSADO_MS || data > agora + FUTURO_MS) return { ok: false, motivo: "data_fora_da_janela" };
  if (metodo.toUpperCase() === "POST") {
    const recebido = ler("digest") ?? "";
    const calculado = digestDe(corpo ?? "");
    const igual = recebido.split(",").some((parte) => {
      const p = parte.trim();
      if (!/^sha-256=/i.test(p)) return false;
      const a = Buffer.from(p.slice(8));
      const b = Buffer.from(calculado.slice(8));
      return a.length === b.length && timingSafeEqual(a, b);
    });
    if (!igual) return { ok: false, motivo: "digest_diferente" };
  }
  const texto = textoParaAssinar(assinatura.headers, metodo, caminho, ler);
  if (texto === null) return { ok: false, motivo: "cabecalhos_faltando" };
  try {
    const ok = createVerify("sha256").update(texto).verify(chavePublica, assinatura.signature, "base64");
    return ok ? { ok: true, assinatura } : { ok: false, motivo: "assinatura_invalida" };
  } catch {
    return { ok: false, motivo: "assinatura_invalida" };
  }
}
