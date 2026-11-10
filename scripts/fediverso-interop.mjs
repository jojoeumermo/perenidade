// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Conferência de caixa-preta da Alumia como servidor do Fediverso (etapa A de docs/rede/FEDIVERSO-INTEROP.md). Recebe o endereço
// da Alumia e olha, de fora, só com pedidos HTTP à PRÓPRIA Alumia, o que um Mastodon olharia: WebFinger nos dois hosts (subject
// canônico no domínio curto, self no ator), host-meta, o ator da pessoa, o ator da instância, NodeInfo 2.1 e 2.0 contra os
// esquemas oficiais (scripts/dados/nodeinfo-2.*.schema.json), a caixa de saída, Content-Type e Vary, e a caixa de entrada:
// sem assinatura → 401; Digest errado → 401 digest_diferente; data velha → 401 data_fora_da_janela; chave que não é a do ator →
// 401 assinatura_invalida; e a PROVA DO BLOQUEIO: ator em threads.net ou em bsky.brid.gy → 403 instancia_bloqueada.
// Também acusa página de desafio do Cloudflare (os pedidos saem com User-Agent de servidor do Fediverso, não de navegador).
//
// O que ele NÃO faz: não cria conta, não segue ninguém, não publica e não manda nada a terceiros. Só pede aos hosts da Alumia (o
// dela e o domínio curto); endereço de outro host que apareça numa resposta não é pedido. Os POSTs usam como ator o ator da
// própria instância e uma chave RSA gerada na hora e jogada fora: todos têm de ser recusados, e nada é gravado. Os POSTs do
// bloqueio vão SEM assinatura: a caixa confere o bloqueio antes de tudo (lib/rede/fediverso/caixa.ts), então a Alumia responde
// sem buscar nada em threads.net nem em brid.gy.
//
// As conferências são funções puras (recebem a resposta já lida e devolvem a lista do que conferiram). O --autoteste roda todas
// contra uma Alumia simulada em memória, certa e com defeitos, sem rede.
//
// Uso: node scripts/fediverso-interop.mjs https://alumia.institutolucia.org --conta nome [--json] [--tudo]
//      node scripts/fediverso-interop.mjs --autoteste
import { createHash, createSign, createVerify, generateKeyPairSync, randomUUID, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const HANDLE = /^[a-z0-9_]{3,20}$/;
const AP = "application/activity+json";
const ACEITA_AP = 'application/activity+json, application/ld+json; profile="https://www.w3.org/ns/activitystreams"';
/** Os domínios que a mediação mantém bloqueados (decisão de 10/11/2026): Threads e a ponte Bridgy Fed. Um ator de teste em cada. */
export const BLOQUEADOS = [
  { nome: "Threads (threads.net)", ator: "https://threads.net/ap/users/conferencia-de-interop" },
  { nome: "Threads (subdomínio www.threads.net)", ator: "https://www.threads.net/ap/users/conferencia-de-interop" },
  { nome: "Bridgy Fed (bsky.brid.gy)", ator: "https://bsky.brid.gy/ap/conferencia-de-interop" },
];

// ═══════════════════ Peças puras ═══════════════════

/** "alumia.institutolucia.org" → "institutolucia.org" (o domínio curto do @; igual a lib/rede/fediverso/enderecos.ts). */
export function dominioCurtoDe(dominio) {
  const m = /^alumia\.(.+)$/i.exec(dominio);
  if (!m) return "";
  const resto = m[1].toLowerCase();
  return resto.includes(".") ? resto : "";
}

/** Os endereços que a conferência espera, a partir da base e da conta. */
export function enderecosDe(base, conta) {
  const raiz = base.replace(/\/+$/, "");
  const dominio = new URL(raiz).host;
  const curto = dominioCurtoDe(dominio);
  const api = `${raiz}/api/fediverso`;
  return {
    base: raiz,
    dominio,
    curto,
    dominioDaConta: curto || dominio,
    hosts: [dominio, ...(curto ? [curto] : [])],
    ator: conta ? `${api}/u/${conta}` : null,
    pagina: conta ? `${raiz}/@${conta}` : null,
    instancia: `${api}/ator`,
    chaveDaInstancia: `${api}/ator#main-key`,
    caixa: `${api}/inbox`,
    indiceNodeinfo: `${raiz}/.well-known/nodeinfo`,
  };
}

/** "SHA-256=<base64>" do corpo. */
export const digestDe = (corpo) => `SHA-256=${createHash("sha256").update(corpo).digest("base64")}`;

/**
 * Os cabeçalhos assinados de um POST, do jeito que o Mastodon assina (draft-cavage: (request-target), host, date, digest e
 * content-type, RSA com SHA-256). `digest` deixa mandar um resumo que não é o do corpo (a conferência do Digest errado).
 */
export function assinarPost({ url, corpo, chaveId, chavePrivada, data = new Date(), digest = digestDe(corpo) }) {
  const u = new URL(url);
  const cab = { host: u.host, date: data.toUTCString(), digest, "content-type": AP };
  const nomes = ["(request-target)", "host", "date", "digest", "content-type"];
  const texto = nomes.map((n) => (n === "(request-target)" ? `(request-target): post ${u.pathname}${u.search}` : `${n}: ${cab[n]}`)).join("\n");
  const assinatura = createSign("sha256").update(texto).sign(chavePrivada, "base64");
  return {
    Date: cab.date,
    Digest: cab.digest,
    "Content-Type": AP,
    Signature: `keyId="${chaveId}",algorithm="rsa-sha256",headers="${nomes.join(" ")}",signature="${assinatura}"`,
  };
}

/**
 * Um conferidor pequeno do JSON Schema draft-04, com TODAS as palavras-chave que os esquemas do NodeInfo usam. Palavra-chave fora
 * da lista é erro (o conferidor não finge validar o que não sabe). O mesmo de scripts/testar-fediverso-saida.mjs.
 */
const CONHECIDAS = new Set(["$schema", "id", "description", "type", "additionalProperties", "required", "properties", "enum", "pattern", "minItems", "items", "minimum", "minProperties"]);
export function valida(esquema, valor, caminho = "$") {
  const erros = [];
  for (const k of Object.keys(esquema)) if (!CONHECIDAS.has(k)) throw new Error(`palavra-chave que o conferidor não sabe: ${k} em ${caminho}`);
  const tipoDe = (v) => (Array.isArray(v) ? "array" : v === null ? "null" : Number.isInteger(v) ? "integer" : typeof v);
  if (esquema.type) {
    const t = tipoDe(valor);
    const aceitos = Array.isArray(esquema.type) ? esquema.type : [esquema.type];
    if (!aceitos.some((a) => a === t || (a === "number" && t === "integer"))) erros.push(`${caminho}: tipo ${t}, esperado ${aceitos.join("|")}`);
  }
  if (esquema.enum && !esquema.enum.includes(valor)) erros.push(`${caminho}: ${JSON.stringify(valor)} fora de ${esquema.enum.join("|")}`);
  if (esquema.pattern && typeof valor === "string" && !new RegExp(esquema.pattern).test(valor)) erros.push(`${caminho}: não casa ${esquema.pattern}`);
  if (esquema.minimum !== undefined && typeof valor === "number" && valor < esquema.minimum) erros.push(`${caminho}: menor que ${esquema.minimum}`);
  if (Array.isArray(valor)) {
    if (esquema.minItems !== undefined && valor.length < esquema.minItems) erros.push(`${caminho}: menos de ${esquema.minItems} itens`);
    if (esquema.items) valor.forEach((v, i) => erros.push(...valida(esquema.items, v, `${caminho}[${i}]`)));
  }
  if (valor && typeof valor === "object" && !Array.isArray(valor)) {
    if (esquema.minProperties !== undefined && Object.keys(valor).length < esquema.minProperties) erros.push(`${caminho}: menos de ${esquema.minProperties} campos`);
    for (const r of esquema.required ?? []) if (!(r in valor)) erros.push(`${caminho}: falta ${r}`);
    for (const [k, v] of Object.entries(valor)) {
      if (esquema.properties?.[k]) erros.push(...valida(esquema.properties[k], v, `${caminho}.${k}`));
      else if (esquema.additionalProperties === false) erros.push(`${caminho}: campo a mais ${k}`);
      else if (esquema.additionalProperties && typeof esquema.additionalProperties === "object") erros.push(...valida(esquema.additionalProperties, v, `${caminho}.${k}`));
    }
  }
  return erros;
}

const lerEsquema = (versao) => JSON.parse(fs.readFileSync(new URL(`./dados/nodeinfo-${versao}.schema.json`, import.meta.url), "utf8"));

// ═══════════════════ As conferências (puras) ═══════════════════
// Uma resposta lida é { status, cabecalhos (nomes em minúsculas), texto, erro? }. status 0 = o pedido nem voltou.
// Cada conferência devolve uma lista de { passo, nome, ok, detalhe }.

const item = (passo, nome, ok, detalhe = "") => ({ passo, nome, ok: Boolean(ok), detalhe: ok ? "" : String(detalhe).slice(0, 400) });
const cab = (r, nome) => r.cabecalhos?.[nome] ?? "";
const curto = (v) => (v === undefined ? "nada" : JSON.stringify(v))?.slice(0, 160);
const mesmoHost = (url, host) => {
  try {
    const u = new URL(String(url));
    return u.protocol === "https:" && u.host === host;
  } catch {
    return false;
  }
};
function json(r) {
  try {
    const j = JSON.parse(r.texto);
    return j && typeof j === "object" && !Array.isArray(j) ? j : null;
  } catch {
    return null;
  }
}

/** A resposta é uma página de desafio (ou de bloqueio) do Cloudflare, e não a Alumia? Devolve o sinal achado, ou nulo. */
export function desafioDoCloudflare(r) {
  if (/challenge/i.test(cab(r, "cf-mitigated"))) return "cabeçalho cf-mitigated: challenge";
  if (!/text\/html/i.test(cab(r, "content-type"))) return null;
  const m = /Just a moment\.\.\.|challenge-platform|cf-chl-|cf_chl_|cf-browser-verification|Checking your browser|Attention Required! \| Cloudflare|Sorry, you have been blocked/i.exec(r.texto ?? "");
  return m ? `página de desafio ("${m[0]}")` : null;
}

/** O que barra qualquer conferência antes de olhar o conteúdo: o pedido não voltou, ou voltou uma página do Cloudflare. */
function barrada(passo, nome, r) {
  if (!r || r.status === 0) return [item(passo, nome, false, `sem resposta (${r?.erro ?? "erro de rede"})`)];
  const desafio = desafioDoCloudflare(r);
  if (desafio) return [item(passo, nome, false, `o Cloudflare respondeu no lugar da Alumia: ${desafio}, status ${r.status}`)];
  return null;
}

/** WebFinger de uma conta num host: 200 jrd+json, subject canônico e self no ator. */
export function conferirWebfinger(r, { passo = "A1", host, subject, self }) {
  const em = `WebFinger em ${host}`;
  const b = barrada(passo, em, r);
  if (b) return b;
  const d = json(r);
  const links = Array.isArray(d?.links) ? d.links : [];
  const eu = links.find((l) => l?.rel === "self");
  return [
    item(passo, `${em}: responde 200`, r.status === 200, `status ${r.status}`),
    item(passo, `${em}: Content-Type application/jrd+json`, /^application\/jrd\+json\b/i.test(cab(r, "content-type")), `veio ${curto(cab(r, "content-type"))}`),
    item(passo, `${em}: subject canônico (${subject})`, d?.subject === subject, `veio ${curto(d?.subject)}`),
    item(passo, `${em}: self aponta o ator, em activity+json`, eu?.href === self && /activity\+json|ld\+json/.test(String(eu?.type ?? "")), `veio ${curto(eu)}`),
    item(passo, `${em}: Vary inclui Host (a resposta muda por host)`, /(^|,)\s*host\s*(,|$)/i.test(cab(r, "vary")), `Vary: ${curto(cab(r, "vary"))}`),
    item(passo, `${em}: aberto a outras origens (Access-Control-Allow-Origin: *)`, cab(r, "access-control-allow-origin") === "*", `veio ${curto(cab(r, "access-control-allow-origin"))}`),
  ];
}

/** host-meta de um host: aponta o WebFinger do PRÓPRIO host. */
export function conferirHostMeta(r, { passo = "A7", host }) {
  const em = `host-meta em ${host}`;
  const b = barrada(passo, em, r);
  if (b) return b;
  const modelo = /<Link[^>]*rel="lrdd"[^>]*template="([^"]+)"/.exec(r.texto ?? "")?.[1];
  return [
    item(passo, `${em}: responde 200 em application/xrd+xml`, r.status === 200 && /^application\/xrd\+xml\b/i.test(cab(r, "content-type")), `status ${r.status}, ${curto(cab(r, "content-type"))}`),
    item(passo, `${em}: aponta o WebFinger do próprio host`, modelo === `https://${host}/.well-known/webfinger?resource={uri}`, `veio ${curto(modelo)}`),
  ];
}

/** O que todo documento ActivityPub daqui tem de ter nos cabeçalhos. */
function cabecalhosAP(passo, de, r) {
  return [
    item(passo, `${de}: responde 200`, r.status === 200, `status ${r.status}`),
    item(passo, `${de}: Content-Type application/activity+json`, /^application\/(activity\+json|ld\+json)\b/i.test(cab(r, "content-type")), `veio ${curto(cab(r, "content-type"))}`),
    item(passo, `${de}: Vary inclui Accept (navegador e servidor recebem coisas diferentes)`, /(^|,)\s*accept\s*(,|$)/i.test(cab(r, "vary")), `Vary: ${curto(cab(r, "vary"))}`),
  ];
}

/** A chave pública de um ator: mora no ator, é dele e é um PEM. */
function chaveDoAtor(passo, de, d, id) {
  const k = d?.publicKey;
  return [
    item(passo, `${de}: publicKey.owner é o id do ator`, Boolean(id) && k?.owner === id, `owner ${curto(k?.owner)}, id ${curto(d?.id)}`),
    item(passo, `${de}: publicKey.id é ${id}#main-key`, k?.id === `${id}#main-key`, `veio ${curto(k?.id)}`),
    item(passo, `${de}: publicKeyPem é uma chave pública em PEM`, typeof k?.publicKeyPem === "string" && /^-----BEGIN (RSA )?PUBLIC KEY-----/.test(k.publicKeyPem), `veio ${curto(k?.publicKeyPem)}`),
  ];
}

/** O ator da pessoa: Person com inbox, outbox, followers, following e a chave. */
export function conferirAtor(r, { passo = "A2", id, conta, caixa }) {
  const de = `ator de @${conta}`;
  const b = barrada(passo, de, r);
  if (b) return b;
  const d = json(r);
  const host = new URL(id).host;
  const colecao = (campo) => item(passo, `${de}: tem ${campo} no host da Alumia`, mesmoHost(d?.[campo], host), `veio ${curto(d?.[campo])}`);
  return [
    ...cabecalhosAP(passo, de, r),
    item(passo, `${de}: é um Person com o id certo`, d?.type === "Person" && d?.id === id, `type ${curto(d?.type)}, id ${curto(d?.id)}`),
    item(passo, `${de}: preferredUsername é o @`, d?.preferredUsername === conta, `veio ${curto(d?.preferredUsername)}`),
    item(passo, `${de}: inbox é ${id}/inbox`, d?.inbox === `${id}/inbox`, `veio ${curto(d?.inbox)}`),
    colecao("outbox"),
    colecao("followers"),
    colecao("following"),
    item(passo, `${de}: endpoints.sharedInbox é a caixa compartilhada`, d?.endpoints?.sharedInbox === caixa, `veio ${curto(d?.endpoints?.sharedInbox)}`),
    ...chaveDoAtor(passo, de, d, id),
  ];
}

/** Quem abre o endereço do ator no navegador vai para a página do perfil. */
export function conferirNavegador(r, { passo = "A2", conta, pagina }) {
  const de = `ator de @${conta} pedido como navegador`;
  const b = barrada(passo, de, r);
  if (b) return b;
  return [item(passo, `${de}: redireciona para a página do perfil`, [302, 303, 307].includes(r.status) && cab(r, "location") === pagina, `status ${r.status}, Location ${curto(cab(r, "location"))}`)];
}

/** O ator da instância (Application): o que assina as buscas da Alumia lá fora. */
export function conferirInstancia(r, { passo = "A8", id, caixa }) {
  const de = "ator da instância";
  const b = barrada(passo, de, r);
  if (b) return b;
  const d = json(r);
  return [
    ...cabecalhosAP(passo, de, r),
    item(passo, `${de}: é um Application com o id certo`, ["Application", "Service"].includes(d?.type) && d?.id === id, `type ${curto(d?.type)}, id ${curto(d?.id)}`),
    item(passo, `${de}: inbox é a caixa compartilhada`, d?.inbox === caixa, `veio ${curto(d?.inbox)}`),
    ...chaveDoAtor(passo, de, d, id),
  ];
}

/** O índice do NodeInfo: aponta o 2.1 e o 2.0, os dois no host da Alumia. */
export function conferirIndiceNodeinfo(r, { passo = "A3", host }) {
  const de = "índice do NodeInfo";
  const b = barrada(passo, de, r);
  if (b) return b;
  const links = Array.isArray(json(r)?.links) ? json(r).links : [];
  const de21 = links.find((l) => l?.rel === "http://nodeinfo.diaspora.software/ns/schema/2.1")?.href;
  const de20 = links.find((l) => l?.rel === "http://nodeinfo.diaspora.software/ns/schema/2.0")?.href;
  return [
    item(passo, `${de}: responde 200`, r.status === 200, `status ${r.status}`),
    item(passo, `${de}: aponta o documento 2.1 no host da Alumia`, mesmoHost(de21, host), `veio ${curto(de21)}`),
    item(passo, `${de}: aponta o documento 2.0 no host da Alumia`, mesmoHost(de20, host), `veio ${curto(de20)}`),
  ];
}

/** Um documento do NodeInfo: passa no esquema oficial da versão, com o profile certo no Content-Type. */
export function conferirNodeinfo(r, { passo = "A3", versao, esquema }) {
  const de = `NodeInfo ${versao}`;
  const b = barrada(passo, de, r);
  if (b) return b;
  const d = json(r);
  const erros = d ? valida(esquema, d) : ["não é JSON"];
  return [
    item(passo, `${de}: responde 200`, r.status === 200, `status ${r.status}`),
    item(passo, `${de}: Content-Type com o profile do esquema ${versao}`, /^application\/json\b/i.test(cab(r, "content-type")) && cab(r, "content-type").includes(`schema/${versao}#`), `veio ${curto(cab(r, "content-type"))}`),
    item(passo, `${de}: passa no esquema oficial`, erros.length === 0, erros.join("; ")),
    item(passo, `${de}: diz a versão ${versao} e o protocolo activitypub`, d?.version === versao && Array.isArray(d?.protocols) && d.protocols.includes("activitypub"), `version ${curto(d?.version)}, protocols ${curto(d?.protocols)}`),
  ];
}

/** A caixa de saída: OrderedCollection com total e primeira página (ou os itens direto, quando é vazia de propósito). */
export function conferirOutbox(r, { passo = "A9", de, id, host }) {
  const b = barrada(passo, de, r);
  if (b) return b;
  const d = json(r);
  return [
    ...cabecalhosAP(passo, de, r),
    item(passo, `${de}: é uma OrderedCollection com o id certo`, d?.type === "OrderedCollection" && d?.id === id, `type ${curto(d?.type)}, id ${curto(d?.id)}`),
    item(passo, `${de}: totalItems é um número inteiro`, Number.isInteger(d?.totalItems) && d.totalItems >= 0, `veio ${curto(d?.totalItems)}`),
    item(passo, `${de}: tem a primeira página (first) no host da Alumia, ou os itens`, mesmoHost(d?.first, host) || Array.isArray(d?.orderedItems), `first ${curto(d?.first)}`),
  ];
}

/** A primeira página da caixa de saída: só Create do próprio ator. */
export function conferirPaginaDoOutbox(r, { passo = "A9", de, outbox, ator }) {
  const b = barrada(passo, de, r);
  if (b) return b;
  const d = json(r);
  const itens = Array.isArray(d?.orderedItems) ? d.orderedItems : null;
  const deOutro = (itens ?? []).find((a) => a?.type !== "Create" || a?.actor !== ator || (a?.object && typeof a.object === "object" && a.object.attributedTo !== ator));
  return [
    ...cabecalhosAP(passo, de, r),
    item(passo, `${de}: é uma OrderedCollectionPage da caixa de saída`, d?.type === "OrderedCollectionPage" && d?.partOf === outbox, `type ${curto(d?.type)}, partOf ${curto(d?.partOf)}`),
    item(passo, `${de}: só traz Create do próprio ator`, Boolean(itens) && !deOutro, itens ? `item estranho: ${curto(deOutro)}` : "sem orderedItems"),
  ];
}

/** Uma recusa da caixa de entrada: o status E o motivo devolvido no corpo (lib/rede/fediverso/rotas.ts devolve o motivo em texto). */
export function conferirRecusa(r, { passo, nome, status, motivo, dica = "" }) {
  const b = barrada(passo, nome, r);
  if (b) return b;
  const veio = (r.texto ?? "").trim().slice(0, 80);
  return [item(passo, `${nome} → ${status} ${motivo}`, r.status === status && veio === motivo, `veio ${r.status} ${curto(veio)}${dica && veio !== motivo ? `. ${dica}` : ""}`)];
}

/** O resumo do Cloudflare: nenhum dos pedidos (todos com User-Agent de servidor do Fediverso) caiu em página de desafio. */
export function conferirSemDesafio(respostas, { passo = "A13" } = {}) {
  const barrados = respostas.filter((x) => x.resposta.status !== 0 && desafioDoCloudflare(x.resposta));
  const nome = `nenhum dos ${respostas.length} pedidos caiu em página de desafio do Cloudflare`;
  return [item(passo, nome, respostas.length > 0 && barrados.length === 0, barrados.map((x) => `${x.metodo} ${x.url} (${desafioDoCloudflare(x.resposta)})`).join("; ") || "nenhum pedido foi feito")];
}

// ═══════════════════ O roteiro (quem pede é injetado: a rede de verdade ou a Alumia simulada) ═══════════════════

/**
 * Faz os pedidos na ordem do roteiro e junta as conferências. `pedir(metodo, url, { cabecalhos, corpo })` devolve a resposta lida.
 * Sem `conta`, as conferências da pessoa ficam puladas (a lista `puladas` diz quais).
 */
export async function rodar({ base, conta, pedir, agora = Date.now() }) {
  const e = enderecosDe(base, conta);
  const conferencias = [];
  const puladas = [];
  const respostas = [];
  // Só os hosts da Alumia são pedidos: um endereço de fora que venha numa resposta (um href, um first) não sai daqui.
  const pedirAqui = async (metodo, url, opcoes = {}) => {
    let host = "";
    try {
      host = new URL(url).host;
    } catch {
      // endereço torto: cai no "fora da Alumia"
    }
    if (!e.hosts.includes(host)) return { status: 0, cabecalhos: {}, texto: "", erro: `endereço fora da Alumia, não pedido: ${String(url).slice(0, 120)}` };
    const resposta = await pedir(metodo, url, opcoes);
    respostas.push({ metodo, url, resposta });
    return resposta;
  };
  const ler = (url, aceita = ACEITA_AP) => pedirAqui("GET", url, { cabecalhos: { Accept: aceita } });
  const junta = (lista) => conferencias.push(...lista);

  // A1: WebFinger da conta nos dois hosts (o Mastodon refaz a busca no host do subject e precisa chegar ao MESMO ator).
  if (conta) {
    for (const host of e.hosts) {
      const r = await ler(`https://${host}/.well-known/webfinger?resource=${encodeURIComponent(`acct:${conta}@${e.dominioDaConta}`)}`, "application/jrd+json, application/json");
      junta(conferirWebfinger(r, { host, subject: `acct:${conta}@${e.dominioDaConta}`, self: e.ator }));
    }
    // A2: o ator, como servidor e como navegador.
    const ator = await ler(e.ator);
    junta(conferirAtor(ator, { id: e.ator, conta, caixa: e.caixa }));
    junta(conferirNavegador(await ler(e.ator, "text/html,application/xhtml+xml"), { conta, pagina: e.pagina }));
    // A9: a caixa de saída da pessoa e a primeira página dela.
    const outbox = await ler(`${e.ator}/outbox`);
    junta(conferirOutbox(outbox, { de: `caixa de saída de @${conta}`, id: `${e.ator}/outbox`, host: e.dominio }));
    const primeira = json(outbox)?.first;
    if (typeof primeira === "string") junta(conferirPaginaDoOutbox(await ler(primeira), { de: `primeira página da caixa de saída de @${conta}`, outbox: `${e.ator}/outbox`, ator: e.ator }));
  } else {
    puladas.push("A1 WebFinger da conta", "A2 ator da pessoa", "A9 caixa de saída da pessoa (passe --conta nome)");
  }

  // A7: host-meta em cada host.
  for (const host of e.hosts) junta(conferirHostMeta(await ler(`https://${host}/.well-known/host-meta`, "application/xrd+xml"), { host }));

  // A8: o ator da instância, o WebFinger dele e a caixa de saída (sempre vazia).
  junta(conferirInstancia(await ler(e.instancia), { id: e.instancia, caixa: e.caixa }));
  const wfInstancia = await ler(`${e.base}/.well-known/webfinger?resource=${encodeURIComponent(`acct:${e.dominio}@${e.dominio}`)}`, "application/jrd+json, application/json");
  junta(conferirWebfinger(wfInstancia, { passo: "A8", host: `${e.dominio} (ator da instância)`, subject: `acct:${e.dominio}@${e.dominio}`, self: e.instancia }));
  junta(conferirOutbox(await ler(`${e.instancia}/outbox`), { passo: "A8", de: "caixa de saída da instância", id: `${e.instancia}/outbox`, host: e.dominio }));

  // A3: NodeInfo, pelo índice, contra os esquemas oficiais.
  const indice = await ler(e.indiceNodeinfo, "application/json");
  junta(conferirIndiceNodeinfo(indice, { host: e.dominio }));
  for (const versao of ["2.1", "2.0"]) {
    const href = (Array.isArray(json(indice)?.links) ? json(indice).links : []).find((l) => l?.rel === `http://nodeinfo.diaspora.software/ns/schema/${versao}`)?.href;
    if (typeof href === "string") junta(conferirNodeinfo(await ler(href, "application/json"), { versao, esquema: lerEsquema(versao) }));
  }

  // A4, A5, A10 e A11: a caixa de entrada recusa. O ator é o da própria instância; a chave é gerada aqui e jogada fora.
  // A ordem na caixa (lib/rede/fediverso/caixa.ts e assinatura.ts): bloqueio, sem_assinatura, chave do ator, cabeçalhos, data,
  // digest e, por último, a assinatura. A atividade tem um tipo que a caixa ignora: mesmo se passasse, nada seria gravado.
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
  const atividade = (ator) => JSON.stringify({ "@context": "https://www.w3.org/ns/activitystreams", id: `${ator}#conferencia-${randomUUID()}`, type: "ConferenciaDeInterop", actor: ator });
  const postar = (corpo, cabecalhos) => pedirAqui("POST", e.caixa, { cabecalhos: { Accept: AP, "Content-Type": AP, ...cabecalhos }, corpo });
  const assinado = (corpo, extras = {}) => assinarPost({ url: e.caixa, corpo, chaveId: e.chaveDaInstancia, chavePrivada: privateKey, data: new Date(agora), ...extras });
  const dicaDaChave = "Se veio chave_desconhecida, a Alumia não conseguiu ler o próprio ator da instância (A8) para conferir a assinatura";

  const corpo = atividade(e.instancia);
  junta(conferirRecusa(await postar(corpo, {}), { passo: "A4", nome: "POST na caixa sem assinatura", status: 401, motivo: "sem_assinatura" }));
  junta(conferirRecusa(await postar(corpo, assinado(corpo, { digest: digestDe(`${corpo} `) })), { passo: "A5", nome: "POST assinado com Digest que não é o do corpo", status: 401, motivo: "digest_diferente", dica: dicaDaChave }));
  junta(conferirRecusa(await postar(corpo, assinado(corpo, { data: new Date(agora - 13 * 3_600_000) })), { passo: "A10", nome: "POST assinado com data de 13 horas atrás", status: 401, motivo: "data_fora_da_janela", dica: dicaDaChave }));
  junta(conferirRecusa(await postar(corpo, assinado(corpo)), { passo: "A11", nome: "POST bem formado, assinado com chave que não é a do ator", status: 401, motivo: "assinatura_invalida", dica: dicaDaChave }));

  // A12: a prova do bloqueio. Sem assinatura de propósito: a caixa recusa pelo domínio antes de qualquer outra conferência.
  for (const b of BLOQUEADOS) {
    junta(conferirRecusa(await postar(atividade(b.ator), {}), { passo: "A12", nome: `POST com ator em ${b.nome}`, status: 403, motivo: "instancia_bloqueada", dica: "O domínio precisa estar na lista de instâncias bloqueadas da mediação" }));
  }

  // A13: o Cloudflare não pôs desafio em nenhum pedido.
  junta(conferirSemDesafio(respostas));
  return { base: e.base, conta: conta ?? null, hosts: e.hosts, conferencias, puladas, pedidos: respostas.length };
}

// ═══════════════════ A rede de verdade ═══════════════════

/** Pede de verdade, com User-Agent de servidor do Fediverso (é com ele que o Cloudflare decide se desafia), sem seguir redirecionamento. */
function pedirNaRede(agente) {
  return async (metodo, url, { cabecalhos = {}, corpo } = {}) => {
    try {
      const r = await fetch(url, { method: metodo, headers: { "User-Agent": agente, ...cabecalhos }, body: corpo, redirect: "manual", signal: AbortSignal.timeout(20_000) });
      const texto = (await r.text()).slice(0, 600_000);
      return { status: r.status, cabecalhos: Object.fromEntries([...r.headers].map(([k, v]) => [k.toLowerCase(), v])), texto };
    } catch (erro) {
      return { status: 0, cabecalhos: {}, texto: "", erro: String(erro?.cause?.code ?? erro?.cause?.message ?? erro?.message ?? erro) };
    }
  };
}

// ═══════════════════ O autoteste (sem rede): uma Alumia simulada, certa e com defeitos ═══════════════════

/** Uma Alumia de mentira, em memória, que responde como a de verdade. `defeito` estraga uma coisa de cada vez. */
function alumiaSimulada(defeito = "") {
  const base = "https://alumia.exemplo.org";
  const conta = "ana_1";
  const e = enderecosDe(base, conta);
  const par = generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
  const esta = (d) => defeito === d;
  const resposta = (status, texto, cabecalhos = {}) => ({ status, cabecalhos, texto: typeof texto === "string" ? texto : JSON.stringify(texto) });
  const ap = (corpo) => resposta(200, corpo, { "content-type": esta("ator_em_json") ? "application/json" : "application/activity+json; charset=utf-8", ...(esta("sem_vary") ? {} : { vary: "Accept, Accept-Encoding" }) });
  const desafio = () => resposta(403, "<!DOCTYPE html><html><head><title>Just a moment...</title></head><body><script src=\"/cdn-cgi/challenge-platform/h/b/orchestrate/chl_page/v1\"></script></body></html>", { "content-type": "text/html; charset=UTF-8", "cf-mitigated": "challenge", server: "cloudflare" });
  const jrd = (corpo) => resposta(200, corpo, { "content-type": "application/jrd+json; charset=utf-8", vary: "Host", "access-control-allow-origin": "*" });
  const chave = (id) => ({ id: `${id}#main-key`, owner: esta("dono_errado") ? `${id}/outro` : id, publicKeyPem: par.publicKey });
  const nodeinfo = (versao) => ({
    version: versao,
    software: { name: "alumia", version: "1.0", ...(versao === "2.1" ? { repository: "https://exemplo.org/codigo" } : {}) },
    protocols: ["activitypub"],
    services: { inbound: [], outbound: [] },
    openRegistrations: false,
    usage: { users: { total: 3, activeMonth: 2, activeHalfyear: 3 }, localPosts: 12 },
    metadata: {},
    ...(esta("nodeinfo_ruim") && versao === "2.1" ? { campoAMais: 1 } : {}),
  });
  const bloqueados = ["threads.net", "brid.gy"].filter((d) => !(esta("threads_liberado") && d === "threads.net") && !(esta("bridgy_liberado") && d === "brid.gy"));

  /** A caixa, na mesma ordem de lib/rede/fediverso/caixa.ts e assinatura.ts. */
  function caixa(u, cabecalhos, corpo) {
    if (esta("desafio_no_post")) return desafio();
    const c = Object.fromEntries(Object.entries(cabecalhos).map(([k, v]) => [k.toLowerCase(), v]));
    const recusa = (status, motivo) => resposta(status, motivo, { "cache-control": "no-store" });
    const atividade = JSON.parse(corpo);
    const dominio = new URL(atividade.actor).host;
    if (bloqueados.some((b) => dominio === b || dominio.endsWith(`.${b}`))) return recusa(403, "instancia_bloqueada");
    const lida = /keyId="([^"]+)"/.exec(c.signature ?? "");
    if (!lida) return esta("caixa_aberta") ? resposta(202, "") : recusa(401, "sem_assinatura");
    if (atividade.actor !== e.instancia || lida[1] !== e.chaveDaInstancia) return recusa(401, "chave_desconhecida");
    const nomes = /headers="([^"]+)"/.exec(c.signature)[1].split(" ");
    if (!["(request-target)", "host", "date", "digest"].every((n) => nomes.includes(n))) return recusa(401, "cabecalhos_faltando");
    const data = Date.parse(c.date ?? "");
    if (!esta("data_nao_conferida") && (!Number.isFinite(data) || data < Date.now() - 12 * 3_600_000 || data > Date.now() + 3_600_000)) return recusa(401, "data_fora_da_janela");
    const a = Buffer.from(c.digest ?? "");
    const b = Buffer.from(digestDe(corpo));
    if (!esta("digest_nao_conferido") && !(a.length === b.length && timingSafeEqual(a, b))) return recusa(401, "digest_diferente");
    if (esta("qualquer_chave_serve")) return resposta(202, "");
    const texto = nomes.map((n) => (n === "(request-target)" ? `(request-target): post ${u.pathname}${u.search}` : `${n}: ${n === "host" ? u.host : c[n]}`)).join("\n");
    const assinatura = /signature="([^"]+)"/.exec(c.signature)[1];
    return createVerify("sha256").update(texto).verify(par.publicKey, assinatura, "base64") ? resposta(202, "") : recusa(401, "assinatura_invalida");
  }

  const pedir = async (metodo, url, { cabecalhos = {}, corpo } = {}) => {
    const u = new URL(url);
    const caminho = `${u.pathname}${u.search}`;
    if (metodo === "POST") return caminho === "/api/fediverso/inbox" ? caixa(u, cabecalhos, corpo) : resposta(404, "Not Found");
    if (esta("desafio_nos_gets")) return desafio();
    if (u.pathname === "/.well-known/webfinger") {
      if (u.host === e.curto && esta("curto_desviado")) return resposta(404, "<html><body>Página não encontrada</body></html>", { "content-type": "text/html" });
      const recurso = u.searchParams.get("resource");
      if (recurso === `acct:${e.dominio}@${e.dominio}`) return jrd({ subject: recurso, aliases: [e.instancia], links: [{ rel: "self", type: AP, href: e.instancia }] });
      if (recurso !== `acct:${conta}@${e.curto}`) return resposta(404, "Not Found");
      return jrd({
        subject: `acct:${conta}@${esta("subject_no_host_longo") ? e.dominio : e.curto}`,
        aliases: [e.ator, e.pagina],
        links: [{ rel: "self", type: AP, href: esta("self_errado") ? e.pagina : e.ator }, { rel: "http://webfinger.net/rel/profile-page", type: "text/html", href: e.pagina }],
      });
    }
    if (u.pathname === "/.well-known/host-meta") {
      const host = esta("host_meta_fixo") ? e.dominio : u.host;
      return resposta(200, `<?xml version="1.0" encoding="UTF-8"?>\n<XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0">\n  <Link rel="lrdd" template="https://${host}/.well-known/webfinger?resource={uri}"/>\n</XRD>\n`, { "content-type": "application/xrd+xml; charset=utf-8", vary: "Host" });
    }
    if (u.host !== e.dominio) return resposta(404, "Not Found");
    if (u.pathname === "/.well-known/nodeinfo") {
      return resposta(200, { links: [{ rel: "http://nodeinfo.diaspora.software/ns/schema/2.1", href: `${base}/api/fediverso/nodeinfo` }, ...(esta("sem_nodeinfo_20") ? [] : [{ rel: "http://nodeinfo.diaspora.software/ns/schema/2.0", href: `${base}/api/fediverso/nodeinfo?esquema=2.0` }])] }, { "content-type": "application/json" });
    }
    if (u.pathname === "/api/fediverso/nodeinfo") {
      const versao = u.searchParams.get("esquema") === "2.0" ? "2.0" : "2.1";
      return resposta(200, nodeinfo(versao), { "content-type": `application/json; profile="http://nodeinfo.diaspora.software/ns/schema/${versao}#"` });
    }
    if (caminho === "/api/fediverso/ator") return ap({ "@context": "https://www.w3.org/ns/activitystreams", id: e.instancia, type: "Application", preferredUsername: e.dominio, inbox: e.caixa, outbox: `${e.instancia}/outbox`, publicKey: chave(e.instancia) });
    if (caminho === "/api/fediverso/ator/outbox") return ap({ id: `${e.instancia}/outbox`, type: "OrderedCollection", totalItems: 0, orderedItems: [] });
    if (caminho === `/api/fediverso/u/${conta}`) {
      if (/text\/html/.test(cabecalhos.Accept ?? "")) return esta("navegador_sem_pagina") ? ap({}) : resposta(302, "", { location: e.pagina });
      return ap({
        "@context": ["https://www.w3.org/ns/activitystreams", "https://w3id.org/security/v1"], id: e.ator, type: "Person", preferredUsername: conta, name: "Ana",
        inbox: `${e.ator}/inbox`, outbox: `${e.ator}/outbox`, followers: `${e.ator}/seguidores`, ...(esta("sem_following") ? {} : { following: `${e.ator}/seguindo` }),
        endpoints: { sharedInbox: e.caixa }, publicKey: chave(e.ator),
      });
    }
    if (u.pathname === `/api/fediverso/u/${conta}/outbox`) {
      if (!u.search) return ap({ id: `${e.ator}/outbox`, type: "OrderedCollection", totalItems: 1, first: `${e.ator}/outbox?pagina=1` });
      const autor = esta("outbox_de_outro") ? `${base}/api/fediverso/u/outra_pessoa` : e.ator;
      return ap({ id: `${e.ator}/outbox?pagina=1`, type: "OrderedCollectionPage", partOf: `${e.ator}/outbox`, orderedItems: [{ type: "Create", actor: autor, object: { type: "Note", attributedTo: autor, content: "<p>Oi</p>" } }] });
    }
    return resposta(404, "Not Found");
  };
  return { base, conta, pedir };
}

/** Cada defeito da Alumia simulada e o trecho do nome da conferência que TEM de acusar. */
const DEFEITOS = [
  ["subject_no_host_longo", "A1", "subject canônico"],
  ["self_errado", "A1", "self aponta o ator"],
  ["curto_desviado", "A1", "WebFinger em exemplo.org: responde 200"],
  ["host_meta_fixo", "A7", "host-meta em exemplo.org: aponta o WebFinger do próprio host"],
  ["sem_following", "A2", "tem following"],
  ["dono_errado", "A2", "publicKey.owner é o id do ator"],
  ["ator_em_json", "A2", "Content-Type application/activity+json"],
  ["sem_vary", "A2", "Vary inclui Accept"],
  ["navegador_sem_pagina", "A2", "redireciona para a página do perfil"],
  ["dono_errado", "A8", "ator da instância: publicKey.owner"],
  ["nodeinfo_ruim", "A3", "NodeInfo 2.1: passa no esquema oficial"],
  ["sem_nodeinfo_20", "A3", "aponta o documento 2.0"],
  ["outbox_de_outro", "A9", "só traz Create do próprio ator"],
  ["caixa_aberta", "A4", "sem assinatura"],
  ["digest_nao_conferido", "A5", "Digest que não é o do corpo"],
  ["data_nao_conferida", "A10", "data de 13 horas atrás"],
  ["qualquer_chave_serve", "A11", "chave que não é a do ator"],
  ["threads_liberado", "A12", "Threads (threads.net)"],
  ["threads_liberado", "A12", "Threads (subdomínio www.threads.net)"],
  ["bridgy_liberado", "A12", "Bridgy Fed (bsky.brid.gy)"],
  ["desafio_no_post", "A12", "Threads (threads.net)"],
  ["desafio_no_post", "A13", "página de desafio do Cloudflare"],
  ["desafio_nos_gets", "A13", "página de desafio do Cloudflare"],
  ["desafio_nos_gets", "A1", "WebFinger em alumia.exemplo.org"],
];

async function autoteste() {
  let certos = 0;
  const falhas = [];
  const espera = async (nome, f) => {
    try {
      const r = await f();
      if (r !== true) throw new Error(typeof r === "string" ? r : `resultado inesperado: ${JSON.stringify(r)?.slice(0, 300)}`);
      certos++;
    } catch (erro) {
      falhas.push(`${nome}: ${erro.message}`);
    }
  };

  // As peças.
  await espera("o domínio curto sai de alumia.<domínio> e de mais nada", () => dominioCurtoDe("alumia.exemplo.org") === "exemplo.org" && dominioCurtoDe("exemplo.org") === "" && dominioCurtoDe("alumia.localhost") === "");
  await espera("a assinatura gerada confere com a chave pública do par (e não confere com o texto mexido)", () => {
    const par = generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
    const c = assinarPost({ url: "https://a.exemplo.org/api/fediverso/inbox?x=1", corpo: "{}", chaveId: "https://a.exemplo.org/k#main-key", chavePrivada: par.privateKey, data: new Date(0) });
    const texto = `(request-target): post /api/fediverso/inbox?x=1\nhost: a.exemplo.org\ndate: Thu, 01 Jan 1970 00:00:00 GMT\ndigest: ${digestDe("{}")}\ncontent-type: application/activity+json`;
    const sig = /signature="([^"]+)"/.exec(c.Signature)[1];
    const confere = (t) => createVerify("sha256").update(t).verify(par.publicKey, sig, "base64");
    return confere(texto) && !confere(texto.replace("inbox", "outbox")) && c.Digest === "SHA-256=RBNvo1WzZ4oRRq0W9+hknpT7T8If536DEMBg9hyq/4o=" && /headers="\(request-target\) host date digest content-type"/.test(c.Signature);
  });
  await espera("o conferidor de esquema acusa campo a mais e recusa palavra-chave que não sabe", () => {
    const erros = valida(lerEsquema("2.1"), { version: "2.1", extra: 1 });
    let recusou = false;
    try {
      valida({ oneOf: [] }, {});
    } catch {
      recusou = true;
    }
    return erros.some((x) => x.includes("campo a mais extra")) && erros.some((x) => x.includes("falta software")) && recusou;
  });
  await espera("a página de desafio do Cloudflare é reconhecida pelo cabeçalho e pelo corpo, e um 403 da própria Alumia não é confundido", () => {
    const html = { "content-type": "text/html; charset=UTF-8" };
    return Boolean(desafioDoCloudflare({ status: 403, cabecalhos: { "cf-mitigated": "challenge" }, texto: "" })) &&
      Boolean(desafioDoCloudflare({ status: 503, cabecalhos: html, texto: "<title>Just a moment...</title>" })) &&
      Boolean(desafioDoCloudflare({ status: 403, cabecalhos: html, texto: "<title>Attention Required! | Cloudflare</title>" })) &&
      desafioDoCloudflare({ status: 403, cabecalhos: { "content-type": "text/plain" }, texto: "instancia_bloqueada" }) === null &&
      desafioDoCloudflare({ status: 200, cabecalhos: html, texto: "<html>A página do perfil</html>" }) === null;
  });
  await espera("uma recusa só vale com o status E o motivo certos", () => {
    const pede = { passo: "A12", nome: "x", status: 403, motivo: "instancia_bloqueada" };
    const r = (status, texto) => conferirRecusa({ status, cabecalhos: { "content-type": "text/plain" }, texto }, pede)[0].ok;
    return r(403, "instancia_bloqueada") && r(403, "instancia_bloqueada\n") && !r(403, "Forbidden") && !r(401, "instancia_bloqueada") && !r(0, "");
  });

  // A Alumia simulada certa: tudo passa.
  const certa = alumiaSimulada();
  const tudo = await rodar({ base: certa.base, conta: certa.conta, pedir: certa.pedir });
  await espera("contra a Alumia simulada certa, nenhuma conferência acusa", () => {
    const ruins = tudo.conferencias.filter((c) => !c.ok);
    return ruins.length === 0 || ruins.map((c) => `[${c.passo}] ${c.nome}: ${c.detalhe}`).join(" | ");
  });
  await espera("o roteiro cobre todos os passos (A1 a A5 e A7 a A13) e só pede aos dois hosts da Alumia", () => {
    const passos = new Set(tudo.conferencias.map((c) => c.passo));
    return ["A1", "A2", "A3", "A4", "A5", "A7", "A8", "A9", "A10", "A11", "A12", "A13"].every((p) => passos.has(p)) && tudo.hosts.join() === "alumia.exemplo.org,exemplo.org" && tudo.conferencias.length >= 60;
  });
  await espera("sem --conta, as conferências da pessoa ficam puladas e o resto roda", async () => {
    const r = await rodar({ base: certa.base, conta: undefined, pedir: certa.pedir });
    return r.puladas.length === 3 && r.conferencias.every((c) => c.ok) && !r.conferencias.some((c) => ["A1", "A2", "A9"].includes(c.passo));
  });
  await espera("um endereço de fora numa resposta (o first da caixa de saída) não é pedido", async () => {
    const pedidos = [];
    const r = await rodar({
      base: certa.base,
      conta: certa.conta,
      pedir: async (metodo, url, o) => {
        pedidos.push(new URL(url).host);
        const resposta = await certa.pedir(metodo, url, o);
        return url.endsWith(`/u/${certa.conta}/outbox`) ? { ...resposta, texto: resposta.texto.replace(/"first":"[^"]+"/, '"first":"https://outro.exemplo.net/pagina"') } : resposta;
      },
    });
    return pedidos.every((h) => ["alumia.exemplo.org", "exemplo.org"].includes(h)) && r.conferencias.some((c) => !c.ok && c.detalhe.includes("fora da Alumia"));
  });

  // Cada defeito é acusado pela conferência certa.
  const rodadas = new Map();
  for (const [defeito, passo, trecho] of DEFEITOS) {
    await espera(`defeito "${defeito}" é acusado em ${passo} (${trecho})`, async () => {
      if (!rodadas.has(defeito)) {
        const a = alumiaSimulada(defeito);
        rodadas.set(defeito, await rodar({ base: a.base, conta: a.conta, pedir: a.pedir }));
      }
      const r = rodadas.get(defeito);
      const acusou = r.conferencias.some((c) => !c.ok && c.passo === passo && c.nome.includes(trecho));
      return acusou || `ninguém acusou; com problema: ${r.conferencias.filter((c) => !c.ok).map((c) => `[${c.passo}] ${c.nome}`).join(" | ") || "nada"}`;
    });
  }
  await espera("um defeito só não derruba as conferências que não têm a ver com ele", () => {
    const r = rodadas.get("threads_liberado").conferencias.filter((c) => !c.ok);
    return r.length === 2 && r.every((c) => c.passo === "A12" && c.nome.includes("Threads"));
  });

  if (falhas.length) {
    console.error(`${certos} conferências certas, ${falhas.length} com problema:\n- ${falhas.join("\n- ")}`);
    process.exit(1);
  }
  console.log(`${certos} conferências certas, 0 com problema.`);
}

// ═══════════════════ A linha de comando ═══════════════════

const USO = `Uso: node scripts/fediverso-interop.mjs <https://endereço-da-alumia> --conta <nome> [--json] [--tudo]
     node scripts/fediverso-interop.mjs --autoteste
  --conta nome  o @ local de uma conta com a federação ligada (sem ele, WebFinger, ator e caixa de saída da pessoa ficam pulados)
  --json        a saída inteira em JSON (uma linha por conferência no campo "conferencias")
  --tudo        lista também as conferências certas
  --autoteste   roda as conferências contra uma Alumia simulada, sem rede`;

async function principal(args) {
  if (args.includes("--autoteste")) return autoteste();
  const emJson = args.includes("--json");
  const iConta = args.indexOf("--conta");
  const conta = iConta >= 0 ? String(args[iConta + 1] ?? "").replace(/^@/, "").toLowerCase() : undefined;
  const endereco = args.find((a, i) => !a.startsWith("--") && i !== iConta + 1);
  let base = null;
  try {
    const u = new URL(endereco ?? "");
    if (u.protocol === "https:" && u.pathname === "/" && !u.search) base = u.origin;
  } catch {
    // fica nulo: mostra o uso
  }
  if (!base || (conta !== undefined && !HANDLE.test(conta))) {
    console.error(!base ? USO : `--conta precisa de um @ local (3 a 20 letras minúsculas, números ou _).\n${USO}`);
    process.exit(2);
  }
  const agente = `http.rb/5.2.2 (Mastodon/4.3.0; +${base}/) conferencia-de-interop`;
  const r = await rodar({ base, conta, pedir: pedirNaRede(agente) });
  const ruins = r.conferencias.filter((c) => !c.ok);
  const certas = r.conferencias.length - ruins.length;
  if (emJson) {
    console.log(JSON.stringify({ base: r.base, conta: r.conta, hosts: r.hosts, quando: new Date().toISOString(), pedidos: r.pedidos, certas, problemas: ruins.length, puladas: r.puladas, conferencias: r.conferencias }, null, 2));
  } else {
    if (args.includes("--tudo")) for (const c of r.conferencias) console.log(`${c.ok ? "certo   " : "PROBLEMA"} [${c.passo}] ${c.nome}${c.ok ? "" : `: ${c.detalhe}`}`);
    if (r.puladas.length) console.log(`Puladas: ${r.puladas.join("; ")}.`);
    if (ruins.length) console.error(`${certas} conferências certas, ${ruins.length} com problema:\n- ${ruins.map((c) => `[${c.passo}] ${c.nome}: ${c.detalhe}`).join("\n- ")}`);
    else console.log(`${certas} conferências certas, 0 com problema.`);
  }
  if (ruins.length) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await principal(process.argv.slice(2));
