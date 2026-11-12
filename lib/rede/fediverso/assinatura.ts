// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Assinatura HTTP do Fediverso (draft-cavage-http-signatures, a que o Mastodon usa): quem entrega uma atividade assina a linha do
// pedido, o host, a data e o resumo (Digest) do corpo com a chave privada do ator; quem recebe busca a chave pública do ator e
// confere. Aqui: assinar (para entregar) e conferir (na caixa de entrada). Só RSA com SHA-256. Lógica pura, sem "@/".
// Na ENTRADA vale também a RFC 9421 (HTTP Message Signatures: cabeçalhos Signature-Input e Signature, com Content-Digest), que
// servidores novos mandam: rsa-v1_5-sha256, rsa-pss-sha512 e ed25519 (conferirAssinatura9421). Na saída continua a cavage, que
// todo o Fediverso lê.
import { constants, createHash, createPublicKey, createSign, createVerify, generateKeyPairSync, timingSafeEqual, verify as verificarAssinatura } from "node:crypto";

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

// ── RFC 9421 ──

/** Uma assinatura RFC 9421 lida: o rótulo, os componentes cobertos, os parâmetros e a assinatura em bytes. */
export interface Assinatura9421 {
  rotulo: string;
  componentes: string[];
  parametros: Record<string, string | number>;
  /** O texto exato depois de "rotulo=" no Signature-Input (vai no fim da base de assinatura). */
  listaCrua: string;
  assinatura: Buffer;
}

/**
 * Lê Signature-Input e Signature (RFC 9421, dicionários de campo estruturado). Usa a primeira assinatura que tem keyid. Nulo se
 * falta alguma coisa ou se o texto é grande demais.
 */
export function lerAssinatura9421(ler: (nome: string) => string | null): Assinatura9421 | null {
  const entrada = ler("signature-input");
  const assinaturas = ler("signature");
  if (!entrada || !assinaturas || entrada.length > 4096 || assinaturas.length > 8192) return null;
  for (const m of entrada.matchAll(/([a-z*][a-z0-9_.*-]{0,63})=(\([^)]{0,2048}\)(?:;[a-z][a-z0-9_.*-]{0,63}=(?:"[^"]{0,1024}"|-?\d{1,15}))*)/gi)) {
    const rotulo = m[1];
    const listaCrua = m[2];
    const componentes = [...listaCrua.slice(1, listaCrua.indexOf(")")).matchAll(/"([^"]+)"/g)].map((c) => c[1].toLowerCase());
    const parametros: Record<string, string | number> = {};
    for (const p of listaCrua.slice(listaCrua.indexOf(")") + 1).matchAll(/;([a-z][a-z0-9_.*-]{0,63})=(?:"([^"]*)"|(-?\d+))/gi)) {
      parametros[p[1].toLowerCase()] = p[2] !== undefined ? p[2] : Number(p[3]);
    }
    if (typeof parametros.keyid !== "string") continue;
    const sig = new RegExp(`(?:^|,)\\s*${rotulo.replace(/[.*]/g, "\\$&")}=:([A-Za-z0-9+/=]{1,4096}):`).exec(assinaturas);
    if (!sig) continue;
    return { rotulo, componentes, parametros, listaCrua, assinatura: Buffer.from(sig[1], "base64") };
  }
  return null;
}

/** O keyId de um pedido: o da cavage (Signature ou Authorization) ou o da RFC 9421 (keyid em Signature-Input). */
export function keyIdDoPedido(ler: (nome: string) => string | null): string | null {
  const cavage = /keyId="([^"]+)"/.exec(ler("signature") ?? ler("authorization") ?? "");
  if (cavage) return cavage[1];
  const a = lerAssinatura9421(ler);
  return a && typeof a.parametros.keyid === "string" ? a.parametros.keyid : null;
}

/** A base de assinatura (RFC 9421, seção 2.5). Nulo se um componente pedido não existe ou não é aceito aqui. */
export function baseDaAssinatura9421(a: Assinatura9421, metodo: string, caminho: string, ler: (nome: string) => string | null): string | null {
  const host = (ler("host") ?? "").toLowerCase();
  const u = (() => {
    try {
      return new URL(`https://${host}${caminho}`);
    } catch {
      return null;
    }
  })();
  if (!u) return null;
  const linhas: string[] = [];
  for (const c of a.componentes) {
    let valor: string | null;
    switch (c) {
      case "@method": valor = metodo.toUpperCase(); break;
      case "@target-uri": valor = u.href; break;
      case "@authority": valor = host; break;
      case "@scheme": valor = "https"; break;
      case "@path": valor = u.pathname; break;
      case "@query": valor = u.search || "?"; break;
      case "@request-target": valor = `${u.pathname}${u.search}`; break;
      default:
        if (c.startsWith("@") || c.includes(";")) return null;
        valor = ler(c);
        if (valor !== null) valor = valor.trim();
    }
    if (valor === null) return null;
    linhas.push(`"${c}": ${valor}`);
  }
  linhas.push(`"@signature-params": ${a.listaCrua}`);
  return linhas.join("\n");
}

/** "sha-256=:<base64>:" do corpo (o Content-Digest da RFC 9530). */
const contentDigestDe = (corpo: string | Uint8Array) => createHash("sha256").update(corpo).digest("base64");

/**
 * Confere uma assinatura RFC 9421. Exige @method e o destino (@target-uri, ou @authority com @path ou @request-target); num POST,
 * também content-digest, que precisa bater com o corpo. O tempo vem de "created" (ou de date, se coberto), na mesma janela da cavage;
 * "expires", se houver, também vale.
 */
export function conferirAssinatura9421({
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
}): { ok: true; keyId: string } | { ok: false; motivo: MotivoDaRecusa } {
  const a = lerAssinatura9421(ler);
  if (!a) return { ok: false, motivo: "sem_assinatura" };
  const cobre = (c: string) => a.componentes.includes(c);
  const destino = cobre("@target-uri") || (cobre("@authority") && (cobre("@path") || cobre("@request-target")));
  if (!cobre("@method") || !destino) return { ok: false, motivo: "cabecalhos_faltando" };
  const criado = typeof a.parametros.created === "number" ? a.parametros.created * 1000 : cobre("date") ? Date.parse(ler("date") ?? "") : NaN;
  if (!Number.isFinite(criado) || criado < agora - PASSADO_MS || criado > agora + FUTURO_MS) return { ok: false, motivo: "data_fora_da_janela" };
  if (typeof a.parametros.expires === "number" && a.parametros.expires * 1000 < agora) return { ok: false, motivo: "data_fora_da_janela" };
  if (metodo.toUpperCase() === "POST") {
    if (!cobre("content-digest")) return { ok: false, motivo: "cabecalhos_faltando" };
    const recebido = /sha-256=:([A-Za-z0-9+/=]{1,200}):/i.exec(ler("content-digest") ?? "");
    const calculado = Buffer.from(contentDigestDe(corpo ?? ""));
    const veio = Buffer.from(recebido?.[1] ?? "");
    if (!recebido || veio.length !== calculado.length || !timingSafeEqual(veio, calculado)) return { ok: false, motivo: "digest_diferente" };
  }
  const base = baseDaAssinatura9421(a, metodo, caminho, ler);
  if (base === null) return { ok: false, motivo: "cabecalhos_faltando" };
  try {
    const chave = createPublicKey(chavePublica);
    const alg = typeof a.parametros.alg === "string" ? a.parametros.alg.toLowerCase() : chave.asymmetricKeyType === "ed25519" ? "ed25519" : "rsa-v1_5-sha256";
    let ok = false;
    if (alg === "ed25519" && chave.asymmetricKeyType === "ed25519") ok = verificarAssinatura(null, Buffer.from(base), chave, a.assinatura);
    else if (alg === "rsa-v1_5-sha256" && chave.asymmetricKeyType === "rsa") ok = verificarAssinatura("sha256", Buffer.from(base), chave, a.assinatura);
    else if (alg === "rsa-pss-sha512" && (chave.asymmetricKeyType === "rsa" || chave.asymmetricKeyType === "rsa-pss"))
      ok = verificarAssinatura("sha512", Buffer.from(base), { key: chave, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 64 }, a.assinatura);
    else return { ok: false, motivo: "algoritmo" };
    return ok ? { ok: true, keyId: a.parametros.keyid as string } : { ok: false, motivo: "assinatura_invalida" };
  } catch {
    return { ok: false, motivo: "assinatura_invalida" };
  }
}

/**
 * Confere a assinatura de um pedido recebido. Exige (request-target), host e date assinados; num POST, também o digest, que
 * precisa bater com o corpo. `ler` devolve um cabeçalho do pedido (nulo se não existe). Sem a assinatura cavage e com a da RFC 9421,
 * confere a da RFC 9421 (conferirAssinatura9421).
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
  if (!assinatura) {
    if (!ler("signature-input")) return { ok: false, motivo: "sem_assinatura" };
    const r = conferirAssinatura9421({ metodo, caminho, ler, corpo, chavePublica, agora });
    return r.ok ? { ok: true, assinatura: { keyId: r.keyId, algorithm: "rfc9421", headers: [], signature: "" } } : r;
  }
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
