// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O manifesto dos arquivos que o navegador baixa para rodar o chat cifrado. Documento: docs/rede/CHAT-PRIVADO.md ("Conferir o
// código que o navegador recebe").
//
// O problema: a cifra do chat roda no navegador, com o código que o servidor entrega. Um servidor tomado poderia entregar um
// código que copia as mensagens antes de cifrar. O manifesto não impede isso, mas deixa conferir: a cada versão publicada, uma
// máquina do GitHub tira os arquivos de dentro da imagem que ela mesma montou a partir do código público
// (.github/workflows/producao.yml), calcula o SHA-256 de cada um e publica a lista FORA do servidor (o ramo "transparencia" deste
// repositório, chat/<commit>.json). Depois baixa os mesmos arquivos do site no ar e compara. Qualquer pessoa pode fazer a
// mesma comparação, de onde estiver (pelo Tor, por exemplo), com o modo "conferir".
//
// Entram todos os arquivos de script, estilo e WebAssembly de /_next/static (o chat também roda o código comum das páginas). Os
// que levam a cifra do chat (as marcas abaixo) saem marcados com "chat": true; o modo "conferir" baixa esses por padrão.
//
// Uso:
//   node scripts/manifesto-do-chat.mjs gerar --pasta <.next/static> --commit <sha> --saida <arquivo.json>
//   node scripts/manifesto-do-chat.mjs conferir --site <https://...> [--manifesto <arquivo ou https://...>] [--todos]
//     Sem --manifesto: lê o commit em <site>/versao.txt e baixa o manifesto do ramo "transparencia" no GitHub.
//   Saída 0: confere. 1: algum arquivo do site é diferente do manifesto. 2: não deu para baixar.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const FORMATO = "alumia-manifesto-do-chat:1";
const REPOSITORIO = "jojoeumermo/perenidade";
const EXTENSOES = new Set([".js", ".mjs", ".css", ".wasm"]);
/**
 * Textos que só existem no código da cifra do chat e sobrevivem à compactação (são rótulos das chaves e dos formatos): o
 * envelope selado, o registro das chaves, os formatos das mensagens e os rótulos dos posts e da voz dos grupos.
 */
// Onda R2: a conversa a dois marca o código com os rótulos dela (lib/rede/chat/r2/rotulos.ts); o selado, o "c3" e o aperto de
// mão do chat do beta saíram; os grupos e a equipe marcam com os rótulos do motor MLS (lib/rede/grupos/rotulos-do-motor.ts).
// Onda R3: a camada pós-quântica da conversa a dois (lib/rede/chat/r3/camada-pq.ts) marca com o rótulo dela.
export const MARCAS_DO_CHAT = ["alumia/r2/envelope/v1", "alumia/r2/pedido/assinado/v1", "alumia-kt:1:", "alumia/r2/mls/", "alumia/r3/pq/camada/v1"];

/** O resumo de um arquivo: SHA-256 em hexadecimal e o valor de "integrity" (SHA-384, base64) para quem quiser usar SRI. */
export function resumir(bytes) {
  return {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    sri: `sha384-${createHash("sha384").update(bytes).digest("base64")}`,
  };
}

/**
 * É arquivo da cifra do chat? Do WebAssembly, o motor da conversa a dois e dos grupos (@wireapp/core-crypto, servido como
 * /cifra/core-crypto-<versão>.wasm) e o SPQR do Signal (a camada pós-quântica, /cifra/spqr-<versão>.wasm, onda R3: o sha256 dele
 * também vai dentro do código do chat, que confere antes de carregar); o PGlite do estudo não é do chat.
 */
export function ehDoChat(nome, bytes) {
  if (nome.endsWith(".wasm")) return /(^|\/)(core-crypto|spqr)-[0-9.]+\.wasm$/.test(nome);
  const texto = Buffer.from(bytes).toString("latin1");
  return MARCAS_DO_CHAT.some((m) => texto.includes(m));
}

function* arquivos(pasta, base = pasta) {
  for (const item of fs.readdirSync(pasta, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const caminho = path.join(pasta, item.name);
    if (item.isDirectory()) yield* arquivos(caminho, base);
    else if (item.isFile() && EXTENSOES.has(path.extname(item.name))) yield path.relative(base, caminho).split(path.sep).join("/");
  }
}

/** O manifesto de uma pasta .next/static. Sem hora: o mesmo commit dá o mesmo manifesto. */
export function gerar(pasta, commit) {
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error("commit precisa ser o sha de 40 letras");
  const lista = {};
  for (const relativo of arquivos(pasta)) {
    const bytes = fs.readFileSync(path.join(pasta, relativo));
    lista[`/_next/static/${relativo}`] = { ...resumir(bytes), bytes: bytes.length, ...(ehDoChat(relativo, bytes) ? { chat: true } : {}) };
  }
  return { formato: FORMATO, commit, arquivos: lista };
}

/** Confere um manifesto lido (formato, commit, nomes e resumos). Lança se não é um manifesto. */
export function validar(manifesto) {
  if (manifesto?.formato !== FORMATO || !/^[0-9a-f]{40}$/.test(manifesto.commit ?? "") || typeof manifesto.arquivos !== "object" || manifesto.arquivos === null) {
    throw new Error("isto não é um manifesto do chat");
  }
  for (const [nome, a] of Object.entries(manifesto.arquivos)) {
    if (!/^\/_next\/static\/[A-Za-z0-9._\-/]+$/.test(nome) || nome.includes("..") || !/^[0-9a-f]{64}$/.test(a?.sha256 ?? "")) throw new Error(`entrada estranha no manifesto: ${nome.slice(0, 80)}`);
  }
  return manifesto;
}

/**
 * Compara o que o site entrega com o manifesto. `baixar(caminho)` devolve os bytes (ou null se não achou). Devolve as diferenças
 * (vazio: confere) e quantos foram conferidos.
 */
export async function conferir(manifesto, baixar, { todos = false, deUmaVez = 6 } = {}) {
  validar(manifesto);
  const alvo = Object.entries(manifesto.arquivos).filter(([, a]) => todos || a.chat);
  const diferencas = [];
  let conferidos = 0;
  for (let i = 0; i < alvo.length; i += deUmaVez) {
    await Promise.all(alvo.slice(i, i + deUmaVez).map(async ([nome, a]) => {
      const bytes = await baixar(nome);
      if (!bytes) diferencas.push(`${nome}: o site não entregou o arquivo`);
      else if (resumir(bytes).sha256 !== a.sha256) diferencas.push(`${nome}: o site entregou um arquivo DIFERENTE do que foi montado a partir do código público`);
      else conferidos++;
    }));
  }
  return { diferencas, conferidos, total: alvo.length };
}

async function baixarDe(url, limite = 64 * 1024 * 1024) {
  const r = await fetch(url, { headers: { "User-Agent": "ConferirOChat/1.0", "Cache-Control": "no-cache" }, redirect: "error", signal: AbortSignal.timeout(60_000) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`${new URL(url).pathname} respondeu ${r.status}`);
  const bytes = Buffer.from(await r.arrayBuffer());
  if (bytes.length > limite) throw new Error("arquivo grande demais");
  return bytes;
}

function argumento(nome) {
  const i = process.argv.indexOf(`--${nome}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function principal() {
  const modo = process.argv[2];
  if (modo === "gerar") {
    const pasta = argumento("pasta");
    const commit = argumento("commit");
    const saida = argumento("saida");
    if (!pasta || !commit || !saida) throw new Error("uso: gerar --pasta <.next/static> --commit <sha> --saida <arquivo>");
    const manifesto = gerar(pasta, commit);
    fs.mkdirSync(path.dirname(path.resolve(saida)), { recursive: true });
    fs.writeFileSync(saida, `${JSON.stringify(manifesto, null, 1)}\n`);
    const doChat = Object.values(manifesto.arquivos).filter((a) => a.chat).length;
    console.log(`Manifesto de ${commit}: ${Object.keys(manifesto.arquivos).length} arquivos, ${doChat} com a cifra do chat.`);
    if (doChat === 0) throw new Error("nenhum arquivo com a cifra do chat: as marcas mudaram? (MARCAS_DO_CHAT)");
    return 0;
  }
  if (modo === "conferir") {
    const site = String(argumento("site") ?? "").replace(/\/$/, "");
    if (!/^https:\/\/[^\s/]+$/.test(site) && !/^http:\/\/[a-z2-7]{56}\.onion$/.test(site)) throw new Error("--site precisa ser https://<endereço> (ou http://<nome>.onion)");
    let fonte = argumento("manifesto");
    if (!fonte) {
      const commit = String(await baixarDe(`${site}/versao.txt`) ?? "").trim();
      if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error("o site não mostrou o commit em /versao.txt");
      fonte = `https://raw.githubusercontent.com/${REPOSITORIO}/transparencia/chat/${commit}.json`;
      console.log(`O site diz estar no commit ${commit}.`);
    }
    const texto = /^https:\/\//.test(fonte) ? String(await baixarDe(fonte) ?? "") : fs.readFileSync(fonte, "utf8");
    if (!texto) throw new Error("manifesto não encontrado (a versão ainda não foi publicada fora do servidor?)");
    const manifesto = validar(JSON.parse(texto));
    const { diferencas, conferidos, total } = await conferir(manifesto, (nome) => baixarDe(`${site}${nome}`), { todos: process.argv.includes("--todos") });
    if (diferencas.length) {
      console.error(`NÃO CONFERE: ${diferencas.length} de ${total} arquivos.`);
      for (const d of diferencas) console.error(`  ${d}`);
      fs.writeFileSync("manifesto-do-chat.md", `O site entregou arquivos diferentes do manifesto do commit ${manifesto.commit}:\n\n${diferencas.map((d) => `- ${d}`).join("\n")}\n`);
      return 1;
    }
    console.log(`Confere: os ${conferidos} arquivos que o site entregou são os que foram montados a partir do commit ${manifesto.commit}.`);
    return 0;
  }
  throw new Error("uso: node scripts/manifesto-do-chat.mjs gerar|conferir ...");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  principal().then((codigo) => process.exit(codigo), (e) => {
    console.error(String(e?.message ?? e));
    process.exit(2);
  });
}
