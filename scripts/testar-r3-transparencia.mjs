// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Onda R3, item 2.4 (transparência dos binários), o verificador do Node (lib/rede/transparencia-apps/conferir.ts). Aceite: "um
// binário fora do log é recusado". Os vetores (scripts/vetores/sigstore/LEIA-ME.md): um pacote Sigstore REAL e público (o
// atestado de proveniência do lançamento v4.5.1 do sigstore-python) e o arquivo que ele cobre. Cada ataque é uma mudança nesse
// pacote ou no arquivo; todos precisam dar "fora_do_log". Sem rede. Uso: npm run testar:r3-transparencia
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import fc from "fast-check";
import { conferirArquivo, conferirComDetalhe } from "../lib/rede/transparencia-apps/conferir.ts";
import { identidadeDaVersao, versaoValida } from "../lib/rede/transparencia-apps/identidade.ts";

const ler = (c) => fs.readFileSync(new URL(`../${c}`, import.meta.url));
const ARQUIVO = new Uint8Array(ler("scripts/vetores/sigstore/sigstore-4.5.1-py3-none-any.whl"));
const PACOTE = JSON.parse(ler("scripts/vetores/sigstore/pacote-positivo.json").toString("utf8"));
const RAIZ = JSON.parse(ler("public/apps/raiz-sigstore.json").toString("utf8"));
const QUEM = { uri: "https://github.com/sigstore/sigstore-python/.github/workflows/release.yml@refs/tags/v4.5.1", emissor: "https://token.actions.githubusercontent.com" };
const copia = () => structuredClone(PACOTE);

let n = 0;
const ok = async (nome, fn) => {
  await fn();
  n++;
  console.log(`ok ${n} - ${nome}`);
};
const recusa = (arquivo, pacote, quem = QUEM, raiz = RAIZ) => {
  const r = conferirComDetalhe(arquivo, pacote, quem, raiz);
  assert.equal(r.resultado, "fora_do_log", `devia recusar, mas deu ${JSON.stringify(r)}`);
  return r.motivo;
};
const b64 = (s) => Buffer.from(s, "base64");

await ok("o pacote real confere: no_log (o verificador funciona)", () => {
  assert.deepEqual(conferirComDetalhe(ARQUIVO, PACOTE, QUEM, RAIZ), { resultado: "no_log" });
});
await ok("conferirArquivo (contrato do desenho) usa a raiz embutida e dá o mesmo", async () => {
  assert.equal(await conferirArquivo(ARQUIVO, PACOTE, QUEM), "no_log");
});

// ── o binário ──
await ok("um byte trocado no arquivo: fora_do_log (o resumo não é o do livro)", () => {
  const outro = ARQUIVO.slice();
  outro[1000] ^= 1;
  assert.equal(recusa(outro, PACOTE), "resumo_diferente");
});
await ok("um arquivo que nunca foi ao livro: fora_do_log", () => {
  recusa(new TextEncoder().encode("alumia-falsa.exe"), PACOTE);
});
await ok("arquivo vazio: fora_do_log", () => recusa(new Uint8Array(0), PACOTE));

// ── a declaração assinada ──
await ok("o resumo trocado DENTRO da declaração (para bater com o binário falso): a assinatura não confere", () => {
  const falso = new TextEncoder().encode("binario-adulterado");
  const p = copia();
  const declaracao = JSON.parse(b64(p.dsseEnvelope.payload).toString("utf8"));
  declaracao.subject[0].digest.sha256 = createHash("sha256").update(falso).digest("hex");
  p.dsseEnvelope.payload = Buffer.from(JSON.stringify(declaracao)).toString("base64");
  recusa(falso, p);
});
await ok("a assinatura do envelope trocada: fora_do_log", () => {
  const p = copia();
  const s = b64(p.dsseEnvelope.signatures[0].sig);
  s[s.length - 5] ^= 1;
  p.dsseEnvelope.signatures[0].sig = s.toString("base64");
  recusa(ARQUIVO, p);
});
await ok("tipo do atestado diferente de in-toto: fora_do_log", () => {
  const p = copia();
  p.dsseEnvelope.payloadType = "text/plain";
  assert.equal(recusa(ARQUIVO, p), "tipo_do_atestado");
});

// ── o livro (Rekor) ──
await ok("sem a prova de inclusão (só a promessa assinada): fora_do_log", () => {
  const p = copia();
  delete p.verificationMaterial.tlogEntries[0].inclusionProof;
  assert.equal(recusa(ARQUIVO, p), "sem_prova_de_inclusao");
});
await ok("prova de inclusão cortada (um passo de Merkle a menos): fora_do_log", () => {
  const p = copia();
  p.verificationMaterial.tlogEntries[0].inclusionProof.hashes.pop();
  recusa(ARQUIVO, p);
});
await ok("prova de inclusão com um passo trocado: fora_do_log", () => {
  const p = copia();
  const h = b64(p.verificationMaterial.tlogEntries[0].inclusionProof.hashes[3]);
  h[0] ^= 0x80;
  p.verificationMaterial.tlogEntries[0].inclusionProof.hashes[3] = h.toString("base64");
  recusa(ARQUIVO, p);
});
await ok("índice da folha trocado: fora_do_log", () => {
  const p = copia();
  const prova = p.verificationMaterial.tlogEntries[0].inclusionProof;
  prova.logIndex = String(BigInt(prova.logIndex) + 1n);
  recusa(ARQUIVO, p);
});
await ok("topo (checkpoint) com outra raiz de Merkle: a assinatura do Rekor não confere", () => {
  const p = copia();
  const prova = p.verificationMaterial.tlogEntries[0].inclusionProof;
  const raizFalsa = Buffer.alloc(32, 7).toString("base64");
  prova.checkpoint.envelope = prova.checkpoint.envelope.replace(prova.rootHash, raizFalsa);
  prova.rootHash = raizFalsa;
  recusa(ARQUIVO, p);
});
await ok("corpo da entrada do livro trocado: fora_do_log", () => {
  const p = copia();
  const corpo = JSON.parse(b64(p.verificationMaterial.tlogEntries[0].canonicalizedBody).toString("utf8"));
  corpo.spec.envelopeHash = { algorithm: "sha256", value: "0".repeat(64) };
  p.verificationMaterial.tlogEntries[0].canonicalizedBody = Buffer.from(JSON.stringify(corpo)).toString("base64");
  recusa(ARQUIVO, p);
});
await ok("duas entradas no livro (uma repetida): fora_do_log", () => {
  const p = copia();
  p.verificationMaterial.tlogEntries.push(structuredClone(p.verificationMaterial.tlogEntries[0]));
  recusa(ARQUIVO, p);
});
await ok("sem entrada no livro: fora_do_log", () => {
  const p = copia();
  p.verificationMaterial.tlogEntries = [];
  recusa(ARQUIVO, p);
});
await ok("raiz de confiança sem as chaves do Rekor (livro desconhecido): fora_do_log", () => {
  const raiz = structuredClone(RAIZ);
  raiz.tlogs = [];
  recusa(ARQUIVO, PACOTE, QUEM, raiz);
});
await ok("raiz de confiança sem o Fulcio (certificado sem cadeia): fora_do_log", () => {
  const raiz = structuredClone(RAIZ);
  raiz.certificateAuthorities = [];
  recusa(ARQUIVO, PACOTE, QUEM, raiz);
});

// ── a identidade ──
await ok("identidade trocada (a nossa, de outra tag): fora_do_log", () => {
  recusa(ARQUIVO, PACOTE, identidadeDaVersao("4.5.1"));
});
await ok("identidade com a tag de outra versão do mesmo fluxo: fora_do_log", () => {
  recusa(ARQUIVO, PACOTE, { ...QUEM, uri: QUEM.uri.replace("v4.5.1", "v4.5.2") });
});
await ok("identidade só com o começo do endereço (sem a tag): fora_do_log (comparação exata, não por prefixo)", () => {
  recusa(ARQUIVO, PACOTE, { ...QUEM, uri: QUEM.uri.split("@")[0] });
});
await ok("identidade em forma de expressão regular: fora_do_log", () => {
  recusa(ARQUIVO, PACOTE, { ...QUEM, uri: ".*" });
});
await ok("emissor trocado: fora_do_log", () => {
  recusa(ARQUIVO, PACOTE, { ...QUEM, emissor: "https://accounts.google.com" });
});
await ok("identidade vazia: fora_do_log", () => {
  assert.equal(recusa(ARQUIVO, PACOTE, { uri: "", emissor: "" }), "identidade_vazia");
});

// ── o formato ──
await ok("pacote de formato velho (v0.1, sem prova de inclusão obrigatória): fora_do_log", () => {
  const p = copia();
  p.mediaType = "application/vnd.dev.sigstore.bundle+json;version=0.1";
  assert.equal(recusa(ARQUIVO, p), "versao_do_pacote");
});
await ok("nulo, texto, lista e objeto vazio: fora_do_log, sem exceção", () => {
  for (const p of [null, undefined, "x", 1, [], {}]) recusa(ARQUIVO, p);
});
await ok("cópia do topo sem assinatura (rootHash, treeSize) diferente do topo assinado: fora_do_log (o Rust recusa igual)", () => {
  const prova = PACOTE.verificationMaterial.tlogEntries[0].inclusionProof;
  for (const mexer of [
    (ip) => (ip.rootHash = ` ${prova.rootHash.slice(1)}`),
    (ip) => (ip.rootHash = `A${prova.rootHash.slice(1)}`),
    (ip) => (ip.rootHash = Buffer.alloc(32).toString("base64")),
    (ip) => (ip.treeSize = String(BigInt(prova.treeSize) + 1n)),
    (ip) => delete ip.rootHash,
  ]) {
    const p = copia();
    mexer(p.verificationMaterial.tlogEntries[0].inclusionProof);
    assert.equal(recusa(ARQUIVO, p), "topo_incoerente");
  }
  for (const [campo, valor] of [["version", "1.0.1"], ["kind", "intoto"]]) {
    const p = copia();
    p.verificationMaterial.tlogEntries[0].kindVersion[campo] = valor;
    assert.equal(recusa(ARQUIVO, p), "topo_incoerente", `kindVersion.${campo}`);
  }
});
await ok("propriedade: qualquer mudança de um byte no JSON do pacote nunca vira no_log por acidente (3000 casos)", () => {
  const texto = JSON.stringify(PACOTE);
  fc.assert(
    fc.property(fc.integer({ min: 0, max: texto.length - 1 }), fc.integer({ min: 32, max: 126 }), (i, c) => {
      const novo = texto.slice(0, i) + String.fromCharCode(c) + texto.slice(i + 1);
      if (novo === texto) return true;
      let p;
      try {
        p = JSON.parse(novo);
      } catch {
        p = null;
      }
      const r = conferirComDetalhe(ARQUIVO, p, QUEM, RAIZ).resultado;
      // Mudar um caractere de um campo que a conferência não lê (por exemplo, o "name" do outro subject) pode continuar válido;
      // o que não pode é um campo lido ser aceito mexido. Por isso o teste exige: se deu no_log, a parte assinada não mudou.
      // Compara o que os campos SIGNIFICAM: os bytes do base64 (a biblioteca ignora espaço e "=" do fim, como todo decodificador
      // base64 do Node) e, do topo, só o texto assinado (o nome do assinante na linha de assinatura não é assinado; a chave vem da
      // raiz embutida).
      if (r === "no_log") {
        const bytes = (s) => Buffer.from(String(s), "base64").toString("hex");
        const sentido = (x) => {
          const ip = x.verificationMaterial.tlogEntries[0].inclusionProof;
          return JSON.stringify([
            bytes(x.dsseEnvelope.payload),
            bytes(x.dsseEnvelope.signatures[0].sig),
            ip.logIndex,
            ip.treeSize,
            bytes(ip.rootHash),
            ip.hashes.map(bytes),
            ip.checkpoint.envelope.split("\n\n")[0],
          ]);
        };
        return sentido(JSON.parse(texto)) === sentido(p);
      }
      return true;
    }),
    { numRuns: 3000 },
  );
});

// ── a identidade dos apps ──
await ok("a identidade dos apps é o fluxo de lançamento deste repositório, na tag exata", () => {
  assert.deepEqual(identidadeDaVersao("1.2.3"), {
    uri: "https://github.com/jojoeumermo/perenidade/.github/workflows/apps-lancamento.yml@refs/tags/v1.2.3",
    emissor: "https://token.actions.githubusercontent.com",
  });
  for (const v of ["1.2", "1.2.3-beta", "v1.2.3", "1.2.3/../x", "", " 1.2.3"]) {
    assert.equal(versaoValida(v), false, v);
    assert.throws(() => identidadeDaVersao(v));
  }
});


// ── a lista de versões do lançamento (scripts/apps-versoes.mjs): só entra o que passa na mesma conferência ──
const { spawnSync } = await import("node:child_process");
const os = await import("node:os");
const caminho = await import("node:path");
const montarLista = (arquivo, pacote) => {
  const pasta = fs.mkdtempSync(caminho.join(os.tmpdir(), "alumia-versoes-"));
  fs.writeFileSync(caminho.join(pasta, "alumia-4.5.1-linux-x64-executavel"), arquivo);
  if (pacote !== undefined) fs.writeFileSync(caminho.join(pasta, "alumia-4.5.1-linux-x64-executavel.sigstore.json"), pacote);
  const saida = caminho.join(pasta, "versoes.json");
  const argumentos = ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "scripts/apps-versoes.mjs", "--pasta", pasta, "--versao", "4.5.1", "--saida", saida, "--identidade", QUEM.uri, "--emissor", QUEM.emissor];
  const r = spawnSync(process.execPath, argumentos, { encoding: "utf8", cwd: new URL("..", import.meta.url) });
  const lista = fs.existsSync(saida) ? JSON.parse(fs.readFileSync(saida, "utf8")) : null;
  fs.rmSync(pasta, { recursive: true, force: true });
  return { status: r.status, lista };
};
await ok("lista de versões: o arquivo que confere entra, com o resumo, o tamanho e a entrada do Rekor", () => {
  const { status, lista } = montarLista(ARQUIVO, JSON.stringify(PACOTE));
  assert.equal(status, 0);
  assert.equal(lista.versao, "4.5.1");
  assert.equal(lista.arquivos.length, 1);
  const [a] = lista.arquivos;
  assert.equal(a.plataforma, "linux");
  assert.equal(a.sha256, createHash("sha256").update(ARQUIVO).digest("hex"));
  assert.equal(a.tamanho, ARQUIVO.length);
  assert.equal(a.rekor.indice, Number(PACOTE.verificationMaterial.tlogEntries[0].logIndex));
  assert.match(a.rekor.uuid, /^[0-9a-f]{64}$/);
});
await ok("lista de versões: um binário fora do log (ou sem pacote) derruba a montagem e nada é escrito", () => {
  const outro = ARQUIVO.slice();
  outro[10] ^= 1;
  for (const [arquivo, pacote] of [[outro, JSON.stringify(PACOTE)], [ARQUIVO, undefined], [ARQUIVO, "{}"]]) {
    const { status, lista } = montarLista(arquivo, pacote);
    assert.equal(status, 1);
    assert.equal(lista, null);
  }
});

console.log(`\n${n} testes, todos passaram.`);
