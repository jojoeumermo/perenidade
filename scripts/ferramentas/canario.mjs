// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O canário (content/transparencia/canario.md): conferir o arquivo, assinar no CI e conferir a assinatura de quem baixou.
//   node scripts/ferramentas/canario.mjs conferir-arquivo [canario.md]
//       o arquivo está publicável? (situacao "publicado", datas AAAA-MM-DD, validade depois da emissão e no máximo 100 dias, as
//       marcas {emitido} e {valido_ate} no texto). Sai com 1 e diz o que falta.
//   node scripts/ferramentas/canario.mjs assinar <saida.sigstore.json> [canario.md]
//       SÓ NO CI (fluxo canario.yml, com id-token: write): assina com o Sigstore sem chave guardada (a identidade é a do fluxo do
//       GitHub; o Rekor registra o texto exato e a hora). Recusa se o arquivo não passa no conferir-arquivo ou se a emissão não é de
//       hoje (UTC, com um dia de folga).
//   node scripts/ferramentas/canario.mjs conferir <canario.md> <canario.sigstore.json>
//       quem baixou confere: a assinatura é deste texto, saiu do fluxo canario.yml do repositório no ramo master, e está no Rekor.
//       Precisa de internet (a raiz de confiança do Sigstore vem pelo TUF). Sai com 0 só se tudo bate.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PADRAO = path.join(raiz, "content/transparencia/canario.md");
/** A identidade exata de quem assina: o fluxo do canário, no ramo master deste repositório. */
export const IDENTIDADE = "https://github.com/jojoeumermo/perenidade/.github/workflows/canario.yml@refs/heads/master";
export const EMISSOR = "https://token.actions.githubusercontent.com";
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DIAS = 100;

/** Os problemas do arquivo do canário para ser publicado (lista vazia: pode assinar). Não lê a data de hoje. */
export function problemasDoCanario(bruto) {
  const p = [];
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(bruto);
  if (!m) return ["sem o cabeçalho entre ---"];
  const campos = Object.fromEntries(
    m[1]
      .split(/\r?\n/)
      .map((l) => /^([a-z_]+):\s*"?([^"]*)"?\s*$/.exec(l))
      .filter(Boolean)
      .map((x) => [x[1], x[2]]),
  );
  if (campos.situacao !== "publicado") p.push('"situacao" precisa ser "publicado"');
  if (!DATA.test(campos.emitido ?? "")) p.push('"emitido" precisa ser AAAA-MM-DD');
  if (!DATA.test(campos.valido_ate ?? "")) p.push('"valido_ate" precisa ser AAAA-MM-DD');
  if (DATA.test(campos.emitido ?? "") && DATA.test(campos.valido_ate ?? "")) {
    const dias = (Date.parse(`${campos.valido_ate}T00:00:00Z`) - Date.parse(`${campos.emitido}T00:00:00Z`)) / 86_400_000;
    if (!(dias > 0)) p.push('"valido_ate" precisa ser depois de "emitido"');
    else if (dias > MAX_DIAS) p.push(`a validade passa de ${MAX_DIAS} dias (canário longo demais não avisa nada)`);
  }
  if (!m[2].includes("{emitido}") || !m[2].includes("{valido_ate}")) p.push("o texto precisa ter as marcas {emitido} e {valido_ate}");
  return p;
}

export function emitidoDe(bruto) {
  return /\nemitido:\s*"?(\d{4}-\d{2}-\d{2})"?/.exec(bruto)?.[1] ?? null;
}

/** O pacote tem a forma de um pacote Sigstore (antes de ir à rede)? */
export function formaDoPacote(texto) {
  let j;
  try {
    j = JSON.parse(texto);
  } catch {
    return "o pacote não é JSON";
  }
  if (typeof j?.mediaType !== "string" || !j.mediaType.startsWith("application/vnd.dev.sigstore.bundle")) return "o pacote não é um pacote Sigstore (mediaType)";
  if (!j.verificationMaterial || !j.messageSignature) return "o pacote não tem a assinatura de um arquivo (messageSignature)";
  return null;
}

const direto = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (direto) {
  const [acao, a, b] = process.argv.slice(2);
  if (acao === "conferir-arquivo") {
    const p = problemasDoCanario(fs.readFileSync(a ?? PADRAO, "utf8"));
    if (p.length) {
      console.error(`O canário não está pronto para assinar:\n  ${p.join("\n  ")}`);
      process.exit(1);
    }
    console.log("O canário pode ser assinado.");
  } else if (acao === "assinar") {
    if (!a) {
      console.error("Uso: canario.mjs assinar <saida.sigstore.json> [canario.md]");
      process.exit(2);
    }
    const bruto = fs.readFileSync(b ?? PADRAO);
    const p = problemasDoCanario(bruto.toString("utf8"));
    const hoje = Date.now();
    const emitido = Date.parse(`${emitidoDe(bruto.toString("utf8"))}T00:00:00Z`);
    if (!(Math.abs(hoje - emitido) <= 2 * 86_400_000)) p.push('"emitido" precisa ser a data de hoje (o Rekor registra a hora da assinatura; as duas têm de bater)');
    if (p.length) {
      console.error(`Não assino:\n  ${p.join("\n  ")}`);
      process.exit(1);
    }
    if (!process.env.ACTIONS_ID_TOKEN_REQUEST_URL) {
      console.error("Não assino fora do fluxo do GitHub (sem id-token): a identidade do canário é a do fluxo canario.yml.");
      process.exit(2);
    }
    const { sign } = await import("sigstore");
    const pacote = await sign(bruto);
    fs.writeFileSync(a, `${JSON.stringify(pacote, null, 2)}\n`);
    console.log(`Assinado: ${a}`);
  } else if (acao === "conferir") {
    if (!a || !b) {
      console.error("Uso: canario.mjs conferir <canario.md> <canario.sigstore.json>");
      process.exit(2);
    }
    const texto = fs.readFileSync(b, "utf8");
    const forma = formaDoPacote(texto);
    if (forma) {
      console.error(`Recusado: ${forma}.`);
      process.exit(1);
    }
    const { verify } = await import("sigstore");
    try {
      await verify(JSON.parse(texto), fs.readFileSync(a), { certificateIdentityURI: IDENTIDADE, certificateIssuer: EMISSOR, tlogThreshold: 1 });
    } catch (erro) {
      console.error(`Recusado: ${erro?.message ?? erro}`);
      process.exit(1);
    }
    const p = problemasDoCanario(fs.readFileSync(a, "utf8"));
    console.log(`Verified OK: o texto saiu do fluxo do canário do repositório e está no Rekor.${p.length ? ` Atenção: ${p.join("; ")}.` : ""}`);
  } else {
    console.error("Uso: canario.mjs conferir-arquivo | assinar <saida> | conferir <canario.md> <pacote>");
    process.exit(2);
  }
}
