// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Sobe o servidor do chat separado (nativo/servidor-chat) em contêiner numa máquina de TESTE com Docker, roda as provas contra ele e
// apaga tudo no fim. Nada aqui é implantação: é a prova do item 3.1 (uma instância) e do item 2.7 (duas instâncias).
// Para cada instância: uma rede Docker INTERNA (sem saída e sem porta publicada), o Postgres 17 próprio do chat (o banco montado DUAS
// vezes com nativo/servidor-chat/banco/001-chat.sql, e o servidor entrando com um papel que só executa as funções), a "rede de teste"
// (scripts/r3-servidor-rede-teste.mjs: só a rota pública da chave dos passes) e o servidor do chat como na produção: usuário sem
// privilégios, sistema de arquivos só de leitura, sem capacidade nenhuma do kernel, sem ganhar privilégio. Os segredos (franquia, token
// da interface, senha do banco, chaves dos passes) são sorteados a cada rodada e morrem com ela.
// O teste fala com cada servidor por um túnel SSH até o endereço do contêiner na rede interna (nenhuma porta publicada).
// Uso (a máquina de teste vem do ambiente, nunca do repositório):
//   R3_VPS=<apelido ssh> node --import ./scripts/carregar-ts.mjs scripts/r3-servidor-conteiner.mjs            (3.1: uma instância)
//   R3_VPS=<apelido ssh> node --import ./scripts/carregar-ts.mjs scripts/r3-servidor-conteiner.mjs --duas     (2.7: duas instâncias)
// R3_MANTER_IMAGEM=1 deixa a imagem montada (a montagem leva minutos); os contêineres, as redes e a pasta sempre saem.
import { execFileSync, spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VPS = (process.env.R3_VPS ?? "").trim();
if (!/^[A-Za-z0-9._-]+$/.test(VPS)) {
  console.error("R3_VPS (o apelido ssh da máquina de teste) é obrigatório.");
  process.exit(2);
}
const DUAS = process.argv.includes("--duas");
const RODADA = crypto.randomBytes(4).toString("hex");
const PREFIXO = `r3c-${RODADA}`;
const PASTA = `/tmp/${PREFIXO}`;
const IMAGEM = `r3-chat-teste:${process.env.R3_MANTER_IMAGEM === "1" ? "fixa" : RODADA}`;
const POSTGRES = "postgres:17-alpine";
const NODE = "node:24-bookworm-slim";

const ssh = (comando, { entrada, silencio = false } = {}) => {
  try {
    return execFileSync("ssh", ["-o", "BatchMode=yes", VPS, comando], { input: entrada, encoding: "utf8", stdio: ["pipe", "pipe", silencio ? "ignore" : "pipe"], maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    if (silencio) return "";
    throw new Error(`ssh: ${comando.slice(0, 120)}…\n${e.stderr ?? e.message}`);
  }
};
const aspas = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
const sorteio = (n) => crypto.randomBytes(n).toString("base64url");

// ── As chaves dos passes de cada instância (a desta semana e a da anterior), sorteadas agora ─────────────────────────────────
const { publicVerif } = await import("@cloudflare/privacypass-ts");
const { MODO, semanaDe } = await import("../lib/rede/passes/comum.ts");
async function chavesDosPasses() {
  const hoje = semanaDe();
  const saida = {};
  for (const semana of [hoje, hoje - 1]) {
    const par = await publicVerif.Issuer.generateKey(MODO, { modulusLength: 2048, publicExponent: Uint8Array.of(1, 0, 1) });
    const publica = await publicVerif.getPublicKeyBytes(par.publicKey);
    const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", par.privateKey));
    saida[semana] = { publica: Buffer.from(publica).toString("base64url"), id: crypto.createHash("sha256").update(publica).digest("base64url"), pkcs8: Buffer.from(pkcs8).toString("base64url") };
  }
  return saida;
}

const INSTANCIAS = DUAS ? ["a", "b"] : ["a"];
const estado = {};
for (const i of INSTANCIAS) {
  estado[i] = {
    rede: `${PREFIXO}-${i}`,
    banco: `${PREFIXO}-${i}-banco`,
    redeTeste: `${PREFIXO}-${i}-rede`,
    chat: `${PREFIXO}-${i}-chat`,
    senhaDono: sorteio(24),
    senhaServidor: sorteio(24),
    franquia: sorteio(32),
    token: sorteio(32),
    chaves: await chavesDosPasses(),
  };
}

const tuneis = [];
let codigo = 1;
try {
  // ── Os arquivos: só o que a imagem e a prova usam ──────────────────────────────────────────────────────────────────────
  // O pacote sai do tar direto para a memória (o tar do Git no Windows leria "C:" de um caminho como máquina remota).
  const pacote = execFileSync("tar", ["-czf", "-", "Cargo.toml", "Cargo.lock", "rust-toolchain.toml", "Dockerfile", "src", "banco"], { cwd: path.join(raiz, "nativo/servidor-chat"), maxBuffer: 64 * 1024 * 1024 });
  ssh(`mkdir -m 700 ${PASTA} && mkdir ${PASTA}/servidor`);
  ssh(`tar -xzf - -C ${PASTA}/servidor`, { entrada: pacote });
  ssh(`cat > ${PASTA}/rede-teste.mjs && chmod 644 ${PASTA}/rede-teste.mjs`, { entrada: fs.readFileSync(path.join(raiz, "scripts/r3-servidor-rede-teste.mjs")) });

  // ── A imagem (a mesma do Dockerfile, com o Rust e o Debian fixados por resumo) ─────────────────────────────────────────
  const jaTem = ssh(`docker image inspect ${IMAGEM} >/dev/null 2>&1 && echo sim || echo nao`).trim() === "sim";
  if (!jaTem) {
    console.log(`montando a imagem do servidor do chat (${IMAGEM})…`);
    const t0 = Date.now();
    ssh(`cd ${PASTA}/servidor && docker build -q -t ${IMAGEM} . >/dev/null`);
    console.log(`  montada em ${Math.round((Date.now() - t0) / 1000)} s`);
  }

  for (const i of INSTANCIAS) {
    const e = estado[i];
    ssh(`docker network create --internal ${e.rede} >/dev/null`);
    // O banco do chat: Postgres 17 próprio, sem porta publicada.
    ssh(`docker run -d --name ${e.banco} --network ${e.rede} -e POSTGRES_PASSWORD=${aspas(e.senhaDono)} -e POSTGRES_DB=chat ${POSTGRES} >/dev/null`);
    for (let n = 0; n < 60; n++) {
      if (ssh(`docker exec ${e.banco} pg_isready -U postgres -d chat >/dev/null 2>&1 && echo sim || echo nao`).trim() === "sim") break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    await new Promise((r) => setTimeout(r, 2000));
    for (const vez of [1, 2]) {
      ssh(`docker exec -i ${e.banco} psql -q -U postgres -d chat -v ON_ERROR_STOP=1 >/dev/null`, { entrada: fs.readFileSync(path.join(raiz, "nativo/servidor-chat/banco/001-chat.sql")) });
      console.log(`instância ${i}: banco do chat montado (${vez}ª vez)`);
    }
    ssh(`docker exec -i ${e.banco} psql -q -U postgres -d chat -v ON_ERROR_STOP=1 >/dev/null`, { entrada: `alter role chat_servidor password '${e.senhaServidor}';\n` });
    // A rede de teste (só a rota pública da chave dos passes).
    const publicas = Object.fromEntries(Object.entries(e.chaves).map(([s, c]) => [s, { id: c.id, publica: c.publica }]));
    ssh(`docker run -d --name ${e.redeTeste} --network ${e.rede} --read-only --cap-drop ALL --security-opt no-new-privileges --user 10001:10001 -v ${PASTA}/rede-teste.mjs:/rede/r.mjs:ro -e R3_CHAVES=${aspas(JSON.stringify(publicas))} ${NODE} node /rede/r.mjs >/dev/null`);
    // O servidor do chat, como na produção.
    const env = {
      CHAT_BANCO_URL: `postgres://chat_servidor:${e.senhaServidor}@${e.banco}:5432/chat`,
      CHAT_FRANQUIA_SEGREDO: e.franquia,
      CHAT_INTERFACE_TOKEN: e.token,
      CHAT_PASSES_CHAVE_URL: `http://${e.redeTeste}:8080/api/alumia/passes/chave`,
      CHAT_TESTE_SEM_TLS: "1",
      CHAT_ESPERA_DO_LOTE_MS: "50",
    };
    ssh(`docker run -d --name ${e.chat} --network ${e.rede} --read-only --cap-drop ALL --security-opt no-new-privileges --user 10001:10001 ${Object.entries(env).map(([k, v]) => `-e ${k}=${aspas(v)}`).join(" ")} ${IMAGEM} >/dev/null`);
    e.ip = ssh(`docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ${e.chat}`).trim();
    // Os limites do contêiner, conferidos no Docker (não só pedidos).
    const insp = JSON.parse(ssh(`docker inspect ${e.chat}`))[0];
    e.limites = {
      so_leitura: insp.HostConfig.ReadonlyRootfs === true,
      sem_capacidades: JSON.stringify(insp.HostConfig.CapDrop) === '["ALL"]' && !insp.HostConfig.CapAdd?.length,
      sem_novos_privilegios: (insp.HostConfig.SecurityOpt ?? []).includes("no-new-privileges"),
      usuario: insp.Config.User,
      sem_porta_publicada: Object.keys(insp.HostConfig.PortBindings ?? {}).length === 0 && Object.values(insp.NetworkSettings.Ports ?? {}).every((p) => !p),
      rede_interna: JSON.parse(ssh(`docker network inspect ${e.rede}`))[0].Internal === true,
      escrever_no_disco: ssh(`docker exec ${e.chat} /bin/sh -c 'touch /tmp/x 2>&1 || echo recusado'`, { silencio: true }).includes("recusado") ? "recusado" : "possivel",
      sair_para_a_internet: ssh(`docker exec ${e.chat} timeout 5 bash -c 'exec 3<>/dev/tcp/1.1.1.1/443 && echo saiu' 2>/dev/null || echo sem_saida`, { silencio: true }).trim().split(/\s+/).pop() || "sem_shell",
    };
    console.log(`instância ${i}: limites do contêiner`, JSON.stringify(e.limites));
  }

  // ── Os túneis (ssh -L até o endereço do contêiner; nenhuma porta publicada no Docker) ─────────────────────────────────────
  const portaLivre = () => new Promise((ok) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => ok(p)); }); });
  for (const i of INSTANCIAS) {
    const e = estado[i];
    e.porta = await portaLivre();
    const t = spawn("ssh", ["-o", "BatchMode=yes", "-o", "ExitOnForwardFailure=yes", "-N", "-L", `127.0.0.1:${e.porta}:${e.ip}:8080`, VPS], { stdio: "ignore" });
    tuneis.push(t);
    let pronto = false;
    for (let n = 0; n < 40 && !pronto; n++) {
      await new Promise((r) => setTimeout(r, 500));
      pronto = await fetch(`http://127.0.0.1:${e.porta}/saude`).then((r) => r.ok, () => false);
    }
    if (!pronto) throw new Error(`instância ${i}: o servidor do chat não respondeu (logs: ${ssh(`docker logs --tail 20 ${e.chat} 2>&1`, { silencio: true })})`);
    console.log(`instância ${i}: servidor do chat no ar (pelo túnel)`);
  }

  // ── As provas ────────────────────────────────────────────────────────────────────────────────────────────────────────
  const rodar = (arquivo, env) =>
    new Promise((ok) => {
      const p = spawn(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "--disable-warning=DEP0205", "--import", "./scripts/carregar-ts.mjs", arquivo], {
        cwd: raiz,
        env: { ...process.env, ...env },
        stdio: "inherit",
      });
      p.on("exit", (c) => ok(c ?? 1));
    });
  const daInstancia = (i) => ({
    url: `http://127.0.0.1:${estado[i].porta}`,
    token: estado[i].token,
    chaves: estado[i].chaves,
    limites: estado[i].limites,
    // Para o aceite (b): o que o servidor guarda, lido pelo DONO do banco do chat (só o teste tem essa credencial).
    banco: estado[i].banco,
  });
  if (!DUAS) {
    codigo = await rodar("scripts/testar-r3-servidor.mjs", {
      CHAT_URL: daInstancia("a").url,
      CHAT_INTERFACE_TOKEN: estado.a.token,
      CHAT_TESTE_INSTANCIA: JSON.stringify(daInstancia("a")),
      R3_VPS: VPS,
    });
  } else {
    codigo = await rodar("scripts/testar-r3-instancias.mjs", {
      R3_INSTANCIAS: JSON.stringify({ a: daInstancia("a"), b: daInstancia("b") }),
      R3_VPS: VPS,
    });
  }
} catch (erro) {
  console.error(`\nA prova em contêiner parou: ${erro.message}`);
  codigo = 1;
} finally {
  for (const t of tuneis) t.kill();
  for (const i of INSTANCIAS) {
    const e = estado[i];
    ssh(`docker rm -f ${e.chat} ${e.redeTeste} ${e.banco} >/dev/null 2>&1; docker network rm ${e.rede} >/dev/null 2>&1; true`, { silencio: true });
  }
  if (process.env.R3_MANTER_IMAGEM !== "1") ssh(`docker image rm ${IMAGEM} >/dev/null 2>&1; true`, { silencio: true });
  ssh(`rm -rf ${PASTA}`, { silencio: true });
  const sobrou = ssh(`docker ps -a --format '{{.Names}}' | grep -c '^${PREFIXO}' || true`, { silencio: true }).trim();
  console.log(`\nlimpeza: contêineres desta rodada que sobraram = ${sobrou || "0"}; pasta apagada`);
}
process.exit(codigo);
