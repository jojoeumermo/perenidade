// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Onda R3, frente android (itens 1.2 e 2.3), no Node com os plugins nativos FALSOS:
//   - lib/rede/casca/plataforma.ts: a casca do site não promete o que não tem; o caminho da rede social não vira outro endereço;
//   - lib/rede/casca/android.ts: o embrulho passa pelo cofre com a finalidade como dado associado; o fetch nativo só sai para o
//     servidor do Instituto, só GET/POST, sem Origin, Cookie nem Referer, com os cabeçalhos fixos; a rede social só por caminho;
//     a conferência no livro público não finge que conferiu;
//   - lib/rede/casca/trava.ts: a senha do app, a senha de pânico (conta isca), apagar depois de X senhas erradas (desligado por
//     padrão), a contagem ANTES da conferência (matar o app no meio não dá tentativa grátis) e a trava automática.
// Os ataques estão escritos como teste (cada um falharia sem a defesa). O Kotlin/Java é testado no emulador
// (scripts/testar-r3-android-aparelho.mjs).
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-r3-android-casca.mjs
import { webcrypto } from "node:crypto";
import fs from "node:fs";

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
async function recusa(nome, promessa, codigo) {
  try {
    const valor = await promessa();
    falhas.push(`${nome}: deveria recusar com "${codigo}", mas passou (${JSON.stringify(valor)?.slice(0, 120)})`);
  } catch (erro) {
    if (String(erro?.code ?? erro?.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro?.code ?? erro?.message}"`);
  }
}
const T = new TextEncoder();
const iguais = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const b64 = (b) => Buffer.from(b).toString("base64");
const deB64 = (t) => new Uint8Array(Buffer.from(t, "base64"));

const plataforma = await import("../lib/rede/casca/plataforma.ts");
const android = await import("../lib/rede/casca/android.ts");
const trava = await import("../lib/rede/casca/trava.ts");
const panico = await import("../lib/rede/seguranca/cofre-de-panico.ts");

// ── O cofre falso: AES-256-GCM com uma chave "do aparelho" (como o Keystore), a finalidade como dado associado ──
function cofreFalso({ limite = 0 } = {}) {
  const estado = { erros: 0, limite, apagou: 0, ordem: [] };
  const chave = webcrypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  return {
    st: estado,
    async embrulhar({ finalidade, dados }) {
      const iv = webcrypto.getRandomValues(new Uint8Array(12));
      const c = await webcrypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: T.encode(finalidade) }, await chave, deB64(dados));
      return { embrulhado: b64(new Uint8Array([...iv, ...new Uint8Array(c)])) };
    },
    async desembrulhar({ finalidade, embrulhado }) {
      estado.ordem.push("desembrulhar");
      const b = deB64(embrulhado);
      try {
        const c = await webcrypto.subtle.decrypt({ name: "AES-GCM", iv: b.slice(0, 12), additionalData: T.encode(finalidade) }, await chave, b.slice(12));
        return { dados: b64(new Uint8Array(c)) };
      } catch {
        return { dados: null };
      }
    },
    async apagarTudo() {
      estado.apagou++;
      estado.ordem.push("apagar");
    },
    async contarSenhaErrada() {
      estado.erros++;
      estado.ordem.push("contar");
      return { erros: estado.erros, limite: estado.limite };
    },
    async zerarSenhas() {
      estado.erros = 0;
      estado.ordem.push("zerar");
    },
    async definirLimite({ limite: l }) {
      estado.limite = l;
      return { limite: l };
    },
    async estado() {
      return { erros: estado.erros, limite: estado.limite, nivel: "tee" };
    },
  };
}
function appFalso() {
  const chamadas = { rede: [], notificar: 0 };
  const ouvintes = new Set();
  return {
    chamadas,
    disparar: () => ouvintes.forEach((f) => f()),
    async disfarce({ nome }) {
      return { nome };
    },
    async disfarceAtual() {
      return { nome: "padrao" };
    },
    async notificar() {
      chamadas.notificar++;
    },
    async abrirRede({ caminho }) {
      chamadas.rede.push(caminho);
    },
    async addListener(_evento, f) {
      ouvintes.add(f);
      return { remove: async () => ouvintes.delete(f) };
    },
    ouvintes,
  };
}
function httpFalso() {
  const pedidos = [];
  return {
    pedidos,
    async request(o) {
      pedidos.push(o);
      return { status: 200, data: '{"ok":true}', headers: {} };
    },
  };
}
const armazemFalso = () => {
  const m = new Map();
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

// ── plataforma.ts ──
{
  const { caminhoDaRede, cascaDoSite, casca, definirCasca } = plataforma;
  ok("caminho da rede: /alumia aceito", caminhoDaRede("/alumia") === "/alumia");
  ok("caminho da rede: com busca aceito", caminhoDaRede("/alumia/u/ana?aba=posts") === "/alumia/u/ana?aba=posts");
  for (const ruim of ["//outro.site/x", "/\\outro.site", "https://outro.site", "javascript:alert(1)", "", "alumia", "/a b", "/\nx", `/${"a".repeat(600)}`, null, 42])
    ok(`caminho da rede recusado: ${JSON.stringify(ruim)?.slice(0, 30)}`, caminhoDaRede(ruim) === null);
  ok("sem casca definida, vale a do site", casca().plataforma === "site");
  await recusa("o site não confere atualização (não há app)", () => cascaDoSite.conferirAtualizacao("1.0.0"), "so_no_app");
  const d = new Uint8Array([1, 2, 3]);
  ok("no site o embrulho não finge cofre (devolve os mesmos bytes)", iguais(await cascaDoSite.embrulhar("x", d), d));
  ok("o site não tem fetch nativo", cascaDoSite.fetchNativo === undefined);
  const outra = { ...cascaDoSite, plataforma: "android" };
  definirCasca(outra);
  ok("definirCasca troca a casca", casca().plataforma === "android");
  definirCasca(cascaDoSite);
}

// ── android.ts ──
const cofre = cofreFalso();
const app = appFalso();
const http = httpFalso();
const c = android.criarCascaAndroid({ cofre, app, http, base: "https://institutolucia.org" });
{
  const segredo = webcrypto.getRandomValues(new Uint8Array(32));
  const e = await c.embrulhar("loja/v1", segredo);
  ok("o embrulho não é o segredo em claro", !iguais(e, segredo) && e.length === 12 + 32 + 16);
  ok("desembrulha com a mesma finalidade", iguais(await c.desembrulhar("loja/v1", e), segredo));
  ok("ataque: embrulho de uma finalidade não abre como outra", (await c.desembrulhar("trava/v1", e)) === null);
  const mexido = e.slice();
  mexido[20] ^= 1;
  ok("ataque: embrulho mexido não abre (nulo, sem lançar)", (await c.desembrulhar("loja/v1", mexido)) === null);
  const deOutroAparelho = android.criarCascaAndroid({ cofre: cofreFalso(), app });
  ok("ataque: embrulho copiado para outro aparelho não abre", (await deOutroAparelho.desembrulhar("loja/v1", e)) === null);
  for (const f of ["", "A", "a b", "a\nb", "../x", "x".repeat(65), "trava/v1\u0000"]) await recusa(`finalidade recusada: ${JSON.stringify(f).slice(0, 20)}`, () => c.embrulhar(f, segredo), "finalidade");
  ok("finalidade torta no desembrulhar dá nulo", (await c.desembrulhar("a b", e)) === null);
  const grande = new Uint8Array(200_000).map((_, i) => (i * 131 + 7) & 255);
  ok("embrulho de 200 KB (a ponte em base64 aguenta)", iguais(await c.desembrulhar("grande", await c.embrulhar("grande", grande)), grande));
}
{
  const f = c.fetchNativo;
  ok("o app tem fetch nativo", typeof f === "function");
  await recusa("ataque: fetch nativo para outro endereço", () => f("https://outro.site/api/alumia/caixa/lote", { method: "POST", body: "{}" }), "endereco_fora");
  await recusa("ataque: fetch nativo para subdomínio parecido", () => f("https://institutolucia.org.outro.site/x"), "endereco_fora");
  await recusa("ataque: fetch nativo em http (sem TLS)", () => f("http://institutolucia.org/x"), "endereco_fora");
  await recusa("fetch nativo só GET e POST", () => f("https://institutolucia.org/api/alumia/caixa/apagar", { method: "DELETE" }), "metodo");
  ok("nada saiu do aparelho nos pedidos recusados", http.pedidos.length === 0);
  const r = await f("https://institutolucia.org/api/alumia/caixa/lote", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "PrivateToken token=abc", Origin: "https://x", Cookie: "s=1", Referer: "https://x/y", "X-Qualquer": "1" },
    body: JSON.stringify({ a: 1 }),
  });
  const p = http.pedidos[0];
  ok("fetch nativo devolve a resposta", r.status === 200 && (await r.json()).ok === true);
  ok("cabeçalhos fixos (User-Agent alumia/1)", p.headers["User-Agent"] === "alumia/1" && p.headers.Accept === "application/json");
  ok("o passe vai (Authorization) e o tipo do corpo vai", p.headers.Authorization === "PrivateToken token=abc" && p.headers["Content-Type"] === "application/json");
  const nomes = Object.keys(p.headers).map((n) => n.toLowerCase());
  ok("ataque: sem Origin, Cookie, Referer nem cabeçalho de fora", !nomes.includes("origin") && !nomes.includes("cookie") && !nomes.includes("referer") && !nomes.includes("x-qualquer"));
  ok("o corpo JSON chega como objeto", p.data?.a === 1);
}
{
  await recusa("ataque: a rede social por endereço de fora", () => c.abrirRede("//outro.site/login"), "caminho");
  await recusa("ataque: a rede social por javascript:", () => c.abrirRede("javascript:alert(1)"), "caminho");
  for (const chat of ["/alumia/conversas", "/pt/alumia/conversas?c=1", "/alumia/%63onversas", "/alumia/aparelhos", "/painel", "/en/painel/equipe", "/alumia/./conversas", "/alumia/x/../conversas"]) {
    await recusa(`ATAQUE: a página do chat do site (${chat}) não abre na rede social, fora da casca e da trava`, () => c.abrirRede(chat), "caminho");
  }
  ok("nada foi aberto nos caminhos recusados", app.chamadas.rede.length === 0);
  await c.abrirRede("/alumia");
  ok("caminho do site abre a rede social (fora da casca)", app.chamadas.rede[0] === "/alumia");
  await recusa("a conferência no livro público não finge que conferiu", () => c.conferirAtualizacao("0.1.0"), "nao_implementado");
  await c.notificar();
  ok("notificar passa pelo nativo (sem texto nenhum)", app.chamadas.notificar === 1);
  let fundo = 0;
  const desligar = c.aoIrParaOFundo(() => fundo++);
  await new Promise((r) => setTimeout(r, 0));
  app.disparar();
  ok("ida ao fundo avisa a casca", fundo === 1);
  desligar();
  await new Promise((r) => setTimeout(r, 0));
  app.disparar();
  ok("desligado, não avisa mais", fundo === 1 && app.ouvintes.size === 0);
  const antes = app.ouvintes.size;
  const desligarJa = c.aoIrParaOFundo(() => fundo++);
  desligarJa();
  await new Promise((r) => setTimeout(r, 0));
  ok("desligar antes da ponte responder não deixa ouvinte para trás", app.ouvintes.size === antes);
  await c.apagarTudo();
  ok("apagar tudo chama o cofre nativo", cofre.st.apagou === 1);
}

// ── trava.ts ──
{
  const { limiteValido, definirSenhaDoApp, conferirSenha, destravar, temSenhaDoApp, travaAutomatica, senhaDoAppValida } = trava;
  for (const n of [0, 3, 10, 50]) ok(`limite aceito: ${n}`, limiteValido(n));
  for (const n of [1, 2, 51, -1, 3.5, "5", null, Number.NaN]) ok(`limite recusado: ${String(n)}`, !limiteValido(n));
  ok("senha do app curta recusada", !senhaDoAppValida("12345") && senhaDoAppValida("123456"));

  const cofreT = cofreFalso();
  const ct = android.criarCascaAndroid({ cofre: cofreT, app: appFalso() });
  const arm = armazemFalso();
  ok("sem trava ainda", !temSenhaDoApp(arm));
  await recusa("senha do app curta não é gravada", () => definirSenhaDoApp("abc", ct, arm), "senha_curta");
  await definirSenhaDoApp("girassol 77", ct, arm);
  ok("trava gravada", temSenhaDoApp(arm));
  const bruto = arm.getItem(trava.CHAVE_DA_TRAVA);
  ok("a trava guardada não tem cabeçalho nem verificador legíveis (embrulhada)", !/argon2id13|verificador|sal/.test(Buffer.from(bruto, "base64").toString("latin1")));
  ok("senha certa abre", (await conferirSenha("girassol 77", ct, arm)).tipo === "certa");
  ok("senha errada não abre", (await conferirSenha("girassol 78", ct, arm)).tipo === "errada");
  {
    const armNfc = armazemFalso();
    await definirSenhaDoApp("café com pão", ct, armNfc);
    ok("a mesma senha com acento escrito de outro jeito abre (NFC)", (await conferirSenha("café com pão", ct, armNfc)).tipo === "certa");
  }
  // Senha de pânico: o cofre da onda 11 no mesmo armazenamento.
  const isca = { email: "isca@exemplo.org", senha: "SenhaDaIsca123abc", codinome: "maria_flor", criada: "2026-11-18T00:00:00.000Z" };
  panico.guardarCofre(await panico.fecharCofre("corre pro mato", isca), arm);
  const p = await conferirSenha("corre pro mato", ct, arm);
  ok("a senha de pânico na trava abre a conta isca", p.tipo === "panico" && p.isca.codinome === "maria_flor");
  ok("a senha do app continua abrindo o de verdade", (await conferirSenha("girassol 77", ct, arm)).tipo === "certa");
  // Ataques ao armazenamento.
  const outroAparelho = android.criarCascaAndroid({ cofre: cofreFalso(), app: appFalso() });
  ok("ataque: a trava copiada para outro aparelho não abre nem com a senha certa", (await conferirSenha("girassol 77", outroAparelho, arm)).tipo === "errada");
  const armMexido = armazemFalso();
  for (const [k, v] of arm.m) armMexido.setItem(k, v);
  const b = Buffer.from(armMexido.getItem(trava.CHAVE_DA_TRAVA), "base64");
  b[b.length - 3] ^= 1;
  armMexido.setItem(trava.CHAVE_DA_TRAVA, b.toString("base64"));
  ok("ataque: trava mexida não abre (e não lança)", (await conferirSenha("girassol 77", ct, armMexido)).tipo === "errada");
  armMexido.setItem(trava.CHAVE_DA_TRAVA, "%%%nao-e-base64");
  ok("ataque: trava torta não abre (e não lança)", (await conferirSenha("girassol 77", ct, armMexido)).tipo === "errada");
  ok("ainda com a trava mexida, a senha de pânico abre a isca", (await conferirSenha("corre pro mato", ct, armMexido)).tipo === "panico");
  const semTrava = armazemFalso();
  ok("sem trava, senha qualquer não abre", (await conferirSenha("girassol 77", ct, semTrava)).tipo === "errada");

  // O tempo não diz qual senha foi (as duas derivações sempre): mede a mediana de 5 de cada.
  const medir = async (senha) => {
    const t = [];
    for (let i = 0; i < 5; i++) {
      const a = performance.now();
      await conferirSenha(senha, ct, arm);
      t.push(performance.now() - a);
    }
    return t.sort((x, y) => x - y)[2];
  };
  const [tc, te, tp] = [await medir("girassol 77"), await medir("girassol 78"), await medir("corre pro mato")];
  ok(`o tempo da certa, da errada e da de pânico é parecido (${tc.toFixed(0)}/${te.toFixed(0)}/${tp.toFixed(0)} ms)`, Math.max(tc, te, tp) / Math.min(tc, te, tp) < 1.6);

  // Contagem ANTES da conferência.
  cofreT.st.ordem.length = 0;
  await destravar("errada 1234", { casca: ct, contador: cofreT, armazem: arm });
  ok("a tentativa é contada no cofre nativo ANTES de conferir", cofreT.st.ordem[0] === "contar" && cofreT.st.ordem.indexOf("desembrulhar") > 0);
  // Simula matar o app no meio da conferência: a contagem já ficou gravada.
  const morre = { ...cofreT, contarSenhaErrada: cofreT.contarSenhaErrada };
  const cascaQueMorre = { ...ct, desembrulhar: () => new Promise(() => undefined) };
  const antes = cofreT.st.erros;
  void destravar("qualquer", { casca: cascaQueMorre, contador: morre, armazem: arm });
  await new Promise((r) => setTimeout(r, 20));
  ok("ataque: matar o app no meio da conferência não dá tentativa grátis", cofreT.st.erros === antes + 1);
  await cofreT.zerarSenhas();

  // Desligado por padrão: 60 erradas e nada some.
  for (let i = 0; i < 60; i++) await cofreT.contarSenhaErrada();
  const r60 = await destravar("errada", { casca: ct, contador: cofreT, armazem: arm });
  ok("desligado (padrão): nenhuma contagem apaga", cofreT.st.apagou === 0 && r60.tipo === "errada" && r60.restam === null);
  const rc = await destravar("girassol 77", { casca: ct, contador: cofreT, armazem: arm });
  ok("a senha certa zera a contagem", rc.tipo === "certa" && cofreT.st.erros === 0);

  // Ligado em 3.
  await cofreT.definirLimite({ limite: 3 });
  const r1 = await destravar("errada a", { casca: ct, contador: cofreT, armazem: arm });
  const r2 = await destravar("errada b", { casca: ct, contador: cofreT, armazem: arm });
  ok("ligado em 3: diz quantas restam", r1.restam === 2 && r2.restam === 1 && cofreT.st.apagou === 0);
  const rp = await destravar("corre pro mato", { casca: ct, contador: cofreT, armazem: arm });
  ok("a de pânico na última tentativa abre a isca e zera (não apaga)", rp.tipo === "panico" && cofreT.st.erros === 0 && cofreT.st.apagou === 0);
  await destravar("errada a", { casca: ct, contador: cofreT, armazem: arm });
  await destravar("errada b", { casca: ct, contador: cofreT, armazem: arm });
  const r3 = await destravar("errada c", { casca: ct, contador: cofreT, armazem: arm });
  ok("ligado em 3: a terceira errada apaga tudo", r3.tipo === "apagado" && cofreT.st.apagou === 1);
  ok("a certa na última tentativa não apaga", await (async () => {
    await cofreT.zerarSenhas();
    await destravar("x1", { casca: ct, contador: cofreT, armazem: arm });
    await destravar("x2", { casca: ct, contador: cofreT, armazem: arm });
    const r = await destravar("girassol 77", { casca: ct, contador: cofreT, armazem: arm });
    return r.tipo === "certa" && cofreT.st.apagou === 1;
  })());
  // Limite mexido no armazenamento nativo (fora da faixa): não vira "apaga na primeira".
  cofreT.st.limite = 1;
  await cofreT.zerarSenhas();
  const rm = await destravar("errada", { casca: ct, contador: cofreT, armazem: arm });
  ok("ataque: limite fora da faixa (1) não apaga na primeira", rm.tipo === "errada" && cofreT.st.apagou === 1);

  // Trava automática.
  let agora = 0;
  let tique = null;
  const relogio = { agora: () => agora, agendar: (f) => ((tique = f), () => (tique = null)) };
  const appT = appFalso();
  const cAuto = android.criarCascaAndroid({ cofre: cofreFalso(), app: appT });
  let travou = 0;
  const t = travaAutomatica(cAuto, 2, () => travou++, relogio);
  agora = 60_000;
  tique();
  ok("trava automática: 1 min parado não trava (limite 2)", travou === 0);
  t.tocou();
  agora = 60_000 + 119_000;
  tique();
  ok("trava automática: o toque recomeça a contar", travou === 0);
  agora = 60_000 + 120_000;
  tique();
  ok("trava automática: 2 min sem toque trava", travou === 1);
  await new Promise((r) => setTimeout(r, 0));
  appT.disparar();
  ok("trava automática: ir para o fundo trava na hora", travou === 2);
  t.desligar();
  ok("trava automática desligada não deixa relógio", tique === null);
}

// ── Código: sem Math.random e sem import do Capacitor nos módulos (o site não leva o Capacitor) ──
for (const arq of ["plataforma", "android", "trava"]) {
  const texto = fs.readFileSync(new URL(`../lib/rede/casca/${arq}.ts`, import.meta.url), "utf8");
  ok(`${arq}.ts sem Math.random`, !/Math\.random/.test(texto));
  ok(`${arq}.ts sem import do Capacitor`, !/from\s+["']@capacitor/.test(texto));
}

console.log(`testar-r3-android-casca: ${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  FALHOU: ${f}`);
process.exit(falhas.length ? 1 : 0);
