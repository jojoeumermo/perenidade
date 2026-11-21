// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// "Este binário dos apps está no livro público?" (onda R3, item 2.4), no Node: scripts/conferir-app.mjs, o CI e os testes.
// Toda a criptografia é do cliente oficial do Sigstore para JavaScript (@sigstore/verify, o mesmo do `npm audit signatures`):
// cadeia do certificado até o Fulcio, SCT do registro de certificados, identidade, assinatura, corpo da entrada no Rekor, prova de
// inclusão de Merkle conferida contra o "checkpoint" assinado pelo Rekor. A raiz de confiança vem EMBUTIDA (public/apps/
// raiz-sigstore.json, o trusted_root.json público do Sigstore, trocado a cada versão): a conferência não pergunta nada à rede.
//
// O que este arquivo acrescenta por cima da biblioteca (e por quê):
//   1. a prova de inclusão é OBRIGATÓRIA (a biblioteca aceita só a "promessa" assinada, o SET; "no log" aqui quer dizer que o
//      livro mostrou o caminho de Merkle até um topo assinado);
//   2. a identidade é comparada como texto exato e o emissor também (a política da biblioteca trata a identidade como expressão
//      regular sem âncora: um pedaço do endereço passaria; o teste "identidade só com o começo do endereço" pegou isso);
//   3. num pacote DSSE (atestado in-toto, o que o fluxo de lançamento gera), o resumo SHA-256 do arquivo tem de ser o de um dos
//      "subjects" da declaração; num pacote de assinatura de mensagem, a própria biblioteca confere a assinatura sobre os bytes.
// Qualquer falha, de qualquer tipo (pacote malformado, raiz errada, exceção), é "fora_do_log": falha fechada.
// Sem "@/" de propósito: roda no Node.
import { createHash } from "node:crypto";
import { bundleFromJSON } from "@sigstore/bundle";
import { TrustedRoot } from "@sigstore/protobuf-specs";
import { toSignedEntity, toTrustMaterial, Verifier } from "@sigstore/verify";
import type { Identidade } from "./identidade";

export type Resultado = "no_log" | "fora_do_log";

const TIPOS_DE_PACOTE = new Set(["application/vnd.dev.sigstore.bundle.v0.3+json", "application/vnd.dev.sigstore.bundle+json;version=0.2"]);
const TIPO_IN_TOTO = "application/vnd.in-toto+json";
const DECLARACAO_IN_TOTO = "https://in-toto.io/Statement/v1";

/** O motivo da recusa (para a tela e para o relatório do CI). Não muda o resultado. */
export interface Detalhe {
  resultado: Resultado;
  motivo?: string;
}

function semInclusao(pacote: Record<string, unknown>): boolean {
  const material = pacote.verificationMaterial as { tlogEntries?: Array<{ inclusionProof?: { hashes?: unknown[]; checkpoint?: { envelope?: string } } }> } | undefined;
  const entradas = material?.tlogEntries;
  if (!Array.isArray(entradas) || entradas.length !== 1) return true;
  const prova = entradas[0]?.inclusionProof;
  return !prova || !Array.isArray(prova.hashes) || typeof prova.checkpoint?.envelope !== "string";
}

/**
 * As cópias SEM assinatura do topo (`rootHash` e `treeSize` da prova) têm de ser as do topo ASSINADO (a 2ª e a 3ª linha do
 * "checkpoint"). A biblioteca só usa o assinado (então mexer nas cópias não abre brecha), mas o Rust (sigstore-rs) confere a prova
 * contra a cópia e exige que bata com o assinado: aqui exigimos o mesmo, para os verificadores darem a mesma resposta.
 */
function topoIncoerente(pacote: Record<string, unknown>): boolean {
  const prova = (pacote.verificationMaterial as { tlogEntries: Array<{ inclusionProof: { rootHash?: unknown; treeSize?: unknown; checkpoint: { envelope: string } } }> })
    .tlogEntries[0].inclusionProof;
  const linhas = prova.checkpoint.envelope.split("\n");
  if (linhas.length < 3 || typeof prova.rootHash !== "string" || (typeof prova.treeSize !== "string" && typeof prova.treeSize !== "number")) return true;
  const base64Estrito = /^[A-Za-z0-9+/]{43}=$/;
  if (!base64Estrito.test(prova.rootHash) || !base64Estrito.test(linhas[2])) return true;
  if (prova.rootHash !== linhas[2] || String(prova.treeSize) !== linhas[1]) return true;
  // O "kindVersion" é uma cópia sem assinatura do tipo e da versão do corpo da entrada (o que vai ao livro): tem de bater com ele.
  const entrada = (pacote.verificationMaterial as { tlogEntries: Array<{ canonicalizedBody?: unknown; kindVersion?: { kind?: unknown; version?: unknown } }> }).tlogEntries[0];
  if (typeof entrada.canonicalizedBody !== "string") return true;
  let corpo: { kind?: unknown; apiVersion?: unknown };
  try {
    corpo = JSON.parse(Buffer.from(entrada.canonicalizedBody, "base64").toString("utf8"));
  } catch {
    return true;
  }
  return entrada.kindVersion?.kind !== corpo.kind || entrada.kindVersion?.version !== corpo.apiVersion;
}

/** Os resumos SHA-256 (hex) dos "subjects" de uma declaração in-toto v1; nulo se não for uma. */
function resumosDaDeclaracao(payload: Buffer): string[] | null {
  let d: unknown;
  try {
    d = JSON.parse(payload.toString("utf8"));
  } catch {
    return null;
  }
  if (!d || typeof d !== "object") return null;
  const declaracao = d as { _type?: unknown; subject?: unknown };
  if (declaracao._type !== DECLARACAO_IN_TOTO || !Array.isArray(declaracao.subject)) return null;
  const resumos: string[] = [];
  for (const s of declaracao.subject as Array<{ digest?: { sha256?: unknown } }>) {
    const h = s?.digest?.sha256;
    if (typeof h === "string" && /^[0-9a-f]{64}$/.test(h)) resumos.push(h);
  }
  return resumos;
}

/** A conferência com o motivo da recusa. `raiz` é o trusted_root.json do Sigstore (o embutido nos apps). */
export function conferirComDetalhe(arquivo: Uint8Array, pacote: unknown, identidade: Identidade, raiz: unknown): Detalhe {
  try {
    if (!pacote || typeof pacote !== "object") return { resultado: "fora_do_log", motivo: "pacote_malformado" };
    const p = pacote as Record<string, unknown>;
    if (typeof p.mediaType !== "string" || !TIPOS_DE_PACOTE.has(p.mediaType)) return { resultado: "fora_do_log", motivo: "versao_do_pacote" };
    if (semInclusao(p)) return { resultado: "fora_do_log", motivo: "sem_prova_de_inclusao" };
    if (topoIncoerente(p)) return { resultado: "fora_do_log", motivo: "topo_incoerente" };
    if (typeof identidade?.uri !== "string" || typeof identidade?.emissor !== "string" || !identidade.uri || !identidade.emissor) {
      return { resultado: "fora_do_log", motivo: "identidade_vazia" };
    }
    const bundle = bundleFromJSON(pacote);
    const bytes = Buffer.from(arquivo.buffer, arquivo.byteOffset, arquivo.byteLength);
    const resumo = createHash("sha256").update(bytes).digest("hex");
    if (bundle.content.$case === "dsseEnvelope") {
      const envelope = bundle.content.dsseEnvelope;
      if (envelope.payloadType !== TIPO_IN_TOTO) return { resultado: "fora_do_log", motivo: "tipo_do_atestado" };
      const resumos = resumosDaDeclaracao(envelope.payload);
      if (!resumos) return { resultado: "fora_do_log", motivo: "declaracao_malformada" };
      if (!resumos.includes(resumo)) return { resultado: "fora_do_log", motivo: "resumo_diferente" };
    }
    const material = toTrustMaterial(TrustedRoot.fromJSON(raiz));
    const verificador = new Verifier(material, { tlogThreshold: 1, ctlogThreshold: 1 });
    const entidade = toSignedEntity(bundle, bundle.content.$case === "dsseEnvelope" ? undefined : bytes);
    // A identidade NÃO vai como "subjectAlternativeName" da política: lá a biblioteca trata o texto como expressão regular sem
    // âncora (o "." vale qualquer letra e um pedaço do endereço bastaria). A comparação é feita aqui, texto exato, com o que o
    // certificado conferido diz.
    const quem = verificador.verify(entidade, { extensions: { issuer: identidade.emissor } });
    if (quem.identity?.subjectAlternativeName !== identidade.uri) return { resultado: "fora_do_log", motivo: "identidade_diferente" };
    if (quem.identity?.extensions?.issuer !== identidade.emissor) return { resultado: "fora_do_log", motivo: "emissor_diferente" };
    return { resultado: "no_log" };
  } catch (erro) {
    const codigo = erro && typeof erro === "object" && "code" in erro ? String((erro as { code: unknown }).code) : "erro";
    return { resultado: "fora_do_log", motivo: codigo.toLowerCase() };
  }
}

/** O contrato do desenho (seção 4.3): "no_log" só quando tudo confere. A raiz padrão é a embutida (public/apps/raiz-sigstore.json). */
export async function conferirArquivo(arquivo: Uint8Array, pacote: unknown, identidade: Identidade, raiz?: unknown): Promise<Resultado> {
  const r = raiz ?? (await import("../../../public/apps/raiz-sigstore.json", { with: { type: "json" } })).default;
  return conferirComDetalhe(arquivo, pacote, identidade, r).resultado;
}
