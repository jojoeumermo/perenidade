// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Onda R3, frente android (itens 1.2, 2.3 e os itens de app da Parte 4), NO EMULADOR (ou num aparelho ligado pelo adb):
//   - o APK instalado: sem cópia de segurança, sem filtro de link, a casca não exportada (nem o adb abre), o pacote só com a casca;
//   - os testes instrumentados (CofreNoAparelhoTest: Keystore/StrongBox, embrulho, disfarce, caminhos da rede social);
//   - o chat: Ana no emulador (o motor de cifra EMPACOTADO no app), Bia no Node, nos dois sentidos;
//   - nenhuma página remota: a casca não navega para fora, não abre janela, e o WebView com a ponte só tem https://localhost;
//   - a captura de tela sai preta (FLAG_SECURE), a notificação é só o título e secreta na tela bloqueada, o teclado recebe o pedido
//     de não aprender;
//   - apagar depois de X senhas erradas: desligado por padrão; a contagem sobrevive a DESLIGAR À FORÇA e a REINICIAR; no limite, a
//     chave do cofre e os dados somem;
//   - o disfarce sobrevive a reiniciar; a trava cobre a tela ao ir para o fundo;
//   - a loja do chat no meio de uma sincronização: desligar à força e reiniciar no meio não deixam o estado quebrado.
// Precisa do pacote de TESTE (a casca montada com NEXT_PUBLIC_CASCA_TESTE=1 e ALUMIA_APP_DEPURAR=1):
//   NEXT_PUBLIC_CASCA_TESTE=1 ALUMIA_APP_DEPURAR=1 node casca/montar.mjs && ALUMIA_APP_DEPURAR=1 node casca/android.mjs
//   cd android && ./gradlew :app:assembleDebug :app:assembleDebugAndroidTest
// Uso: node --experimental-wasm-jspi --experimental-wasm-exnref --import ./scripts/carregar-ts.mjs scripts/testar-r3-android-aparelho.mjs [--sem-reiniciar]
// O adb vem de ANDROID_HOME / ANDROID_SDK_ROOT (ou da pasta padrão do SDK). Um emulador ligado (`adb devices`) é exigido.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { motorNoNode } from "./cifra-no-node.mjs";
import { cifrar, decifrar, ligarProteus, sessaoPelaPreChave } from "../lib/rede/chat/r2/proteus.ts";
import { novoParEd25519 } from "../lib/rede/chat/r2/certificados.ts";

const PACOTE = "org.institutolucia.app";
const raiz = path.resolve(import.meta.dirname, "..");
const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? path.join(process.env.LOCALAPPDATA ?? path.join(process.env.HOME ?? "", "Library"), "Android", "Sdk");
const ADB = path.join(sdk, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb");
const APK = path.join(raiz, "android/app/build/outputs/apk/debug/app-debug.apk");
const APK_TESTE = path.join(raiz, "android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk");
const semReiniciar = process.argv.includes("--sem-reiniciar");

let certos = 0;
const naoConferido = [];
const falhas = [];
const ok = (nome, cond, detalhe = "") => {
  if (cond) {
    certos++;
    console.log(`ok - ${nome}`);
  } else {
    falhas.push(nome);
    console.log(`FALHOU - ${nome}${detalhe ? ` (${String(detalhe).slice(0, 300)})` : ""}`);
  }
};
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function adb(args, { binario = false, tempo = 120_000 } = {}) {
  const r = spawnSync(ADB, args, { encoding: binario ? "buffer" : "utf8", timeout: tempo, maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw r.error;
  return binario ? r.stdout : `${r.stdout ?? ""}${r.stderr ?? ""}`;
}
const shell = (cmd, o) => adb(["shell", cmd], o);

// ── O aparelho e o pacote ──
if (!fs.existsSync(ADB)) {
  console.error(`adb não encontrado (${ADB}): defina ANDROID_HOME`);
  process.exit(2);
}
if (!/\bdevice\b/.test(adb(["devices"]).split("\n").slice(1).join("\n"))) {
  console.error("nenhum aparelho ligado ao adb (ligue o emulador)");
  process.exit(2);
}
for (const f of [APK, APK_TESTE]) {
  if (!fs.existsSync(f)) {
    console.error(`falta ${path.relative(raiz, f)}: monte o pacote de teste (veja o cabeçalho)`);
    process.exit(2);
  }
}

async function esperarLigar() {
  adb(["wait-for-device"], { tempo: 300_000 });
  for (let i = 0; i < 180; i++) {
    if (shell("getprop sys.boot_completed").trim() === "1") {
      await esperar(4000);
      return;
    }
    await esperar(1000);
  }
  throw new Error("o aparelho não terminou de ligar");
}
async function reiniciar() {
  adb(["reboot"]);
  await esperar(5000);
  await esperarLigar();
  // A tela trancada do sistema atrapalha abrir o app; o emulador de teste não tem senha de tela.
  shell("input keyevent KEYCODE_WAKEUP");
  shell("wm dismiss-keyguard");
  await esperar(1000);
}

// ── A ponte de depuração do WebView (só existe no pacote de teste: ALUMIA_APP_DEPURAR=1) ──
let porta = 9340;
class Pagina {
  constructor(ws) {
    this.ws = ws;
    this.n = 0;
    this.pendentes = new Map();
    ws.addEventListener("message", (m) => {
      const d = JSON.parse(m.data);
      if (d.id && this.pendentes.has(d.id)) {
        this.pendentes.get(d.id)(d);
        this.pendentes.delete(d.id);
      }
    });
  }
  mandar(method, params = {}) {
    const id = ++this.n;
    return new Promise((ok, falha) => {
      const t = setTimeout(() => falha(new Error(`sem resposta: ${method}`)), 240_000);
      this.pendentes.set(id, (d) => {
        clearTimeout(t);
        ok(d);
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  /** Avalia uma expressão na casca (com await) e devolve o valor. Erro da página vira exceção. */
  async avaliar(expr) {
    const d = await this.mandar("Runtime.evaluate", { expression: `(async () => (${expr}))()`, awaitPromise: true, returnByValue: true });
    if (d.result?.exceptionDetails) throw new Error(d.result.exceptionDetails.exception?.description ?? d.result.exceptionDetails.text);
    return d.result?.result?.value;
  }
  fechar() {
    try {
      this.ws.close();
    } catch {
      // já fechada
    }
  }
}

async function alvos() {
  const pid = shell(`pidof ${PACOTE}`).trim().split(/\s+/)[0];
  if (!pid) return null;
  porta++;
  adb(["forward", `tcp:${porta}`, `localabstract:webview_devtools_remote_${pid}`]);
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${porta}/json`);
      const lista = await r.json();
      if (lista.length) return lista;
    } catch {
      // o WebView ainda não abriu a porta
    }
    await esperar(1000);
  }
  return null;
}

/** Abre o app pelo nome da tela inicial e conecta na casca. */
async function abrirCasca(alias = "Padrao") {
  shell(`am start -W -n ${PACOTE}/${PACOTE}.${alias}`);
  let lista = null;
  for (let i = 0; i < 20 && !lista; i++) {
    lista = await alvos();
    if (!lista) await esperar(1000);
  }
  if (!lista) throw new Error("a casca não abriu a depuração (pacote de teste?)");
  const alvo = lista.find((a) => a.type === "page");
  const ws = new WebSocket(alvo.webSocketDebuggerUrl);
  await new Promise((ok, falha) => {
    ws.addEventListener("open", ok, { once: true });
    ws.addEventListener("error", falha, { once: true });
  });
  const p = new Pagina(ws);
  for (let i = 0; i < 60; i++) {
    if (await p.avaliar("typeof window.__alumiaTeste === 'object'").catch(() => false)) return { p, lista };
    await esperar(500);
  }
  throw new Error("a casca abriu sem __alumiaTeste (o pacote não é o de teste)");
}
const pararApp = () => shell(`am force-stop ${PACOTE}`);

// ── 1. O pacote instalado ──
console.log("# instalar");
shell(`pm uninstall ${PACOTE}`);
shell(`pm uninstall ${PACOTE}.test`);
ok("instala o pacote de teste", /Success/.test(adb(["install", "-r", "-t", APK])));
ok("instala os testes instrumentados", /Success/.test(adb(["install", "-r", "-t", APK_TESTE])));
const pacote = shell(`dumpsys package ${PACOTE}`);
const bandeiras = pacote.match(/pkgFlags=\[([^\]]*)\]/)?.[1] ?? "";
ok("ataque: o sistema não faz cópia de segurança do app (sem ALLOW_BACKUP)", bandeiras.length > 0 && !/ALLOW_BACKUP/.test(bandeiras), bandeiras);
const backup = shell(`bmgr backupnow ${PACOTE}`);
ok("ataque: `bmgr backupnow` não copia nada do app", !/Success/i.test(backup) || /not allowed|BackupNotAllowed|is not eligible|disabled/i.test(backup), backup);
const viaLink = shell(`am start -W -a android.intent.action.VIEW -d https://institutolucia.org/alumia/conversas ${PACOTE}`);
ok("ataque: nenhum link abre o app (sem filtro de link)", /No Activity found|unable to resolve|Error/i.test(viaLink) && !/Status: ok/.test(viaLink), viaLink);
const direto = shell(`am start -W -n ${PACOTE}/.MainActivity`);
ok("ataque: a casca (MainActivity) não abre de fora, nem pelo adb", /Permission Denial|not exported|SecurityException|Error/i.test(direto) && !/Status: ok/.test(direto), direto);
const daRede = shell(`am start -W -n ${PACOTE}/.RedeActivity`);
ok("ataque: a tela da rede social não abre de fora", /Permission Denial|not exported|SecurityException|Error/i.test(daRede) && !/Status: ok/.test(daRede), daRede);
const lancadores = shell(`cmd package query-activities --brief -a android.intent.action.MAIN -c android.intent.category.LAUNCHER ${PACOTE}`);
ok("um só nome na tela inicial, o padrão", /\.Padrao/.test(lancadores) && !/\.Calculadora|\.Notas/.test(lancadores), lancadores);

// ── 2. Os testes instrumentados ──
console.log("# instrumentados");
const instr = shell(`am instrument -w ${PACOTE}.test/androidx.test.runner.AndroidJUnitRunner`, { tempo: 600_000 });
ok("CofreNoAparelhoTest passa no aparelho", /\nOK \(\d+ tests?\)/.test(instr), instr.split("\n").slice(-15).join(" | "));
console.log(`  ${instr.match(/OK \(\d+ tests?\)|FAILURES!!![^\n]*\n[^\n]*/)?.[0] ?? ""}`);

// ── 3. A casca: nenhuma página remota, o chat empacotado ──
console.log("# casca e chat");
shell(`pm grant ${PACOTE} android.permission.POST_NOTIFICATIONS`);
let { p, lista } = await abrirCasca();
ok("o WebView com a ponte só tem a casca (https://localhost)", lista.every((a) => a.type !== "page" || a.url.startsWith("https://localhost/")), JSON.stringify(lista.map((a) => a.url)));
await p.avaliar("(location.href = 'https://example.org/', true)").catch(() => undefined);
await esperar(2500);
({ p } = await abrirCasca().catch(async () => abrirCasca()));
ok("ataque: a casca não navega para fora (o nativo bloqueia)", (await p.avaliar("location.href")).startsWith("https://localhost/"));
ok("ataque: a casca não abre janela nova", (await p.avaliar("window.open('https://example.org/') === null")) === true);
const scriptsDeFora = await p.avaliar("[...document.scripts].filter((s) => s.src && !s.src.startsWith('https://localhost/')).length");
ok("nenhum script de fora na casca", scriptsDeFora === 0);
const csp = await p.avaliar("document.querySelector('meta[http-equiv=\"Content-Security-Policy\"]')?.content ?? ''");
ok("a casca tem a política de segurança (sem script de fora)", /script-src 'self' 'wasm-unsafe-eval'/.test(csp) && !/https?:\/\/[^ ;]*/.test(csp.split(";").find((d) => d.includes("script-src")) ?? ""), csp);
const injetado = await p.avaliar("new Promise((ok) => { const s = document.createElement('script'); s.src = 'https://example.org/x.js'; s.onerror = () => ok('recusado'); s.onload = () => ok('carregou'); document.head.appendChild(s); setTimeout(() => ok('tempo'), 8000); })");
ok("ataque: script de fora injetado na casca não carrega", injetado !== "carregou", injetado);

// O chat: Ana no emulador (o motor do pacote), Bia no Node.
// O motor (@wireapp/core-crypto) exige o JSPI do WebAssembly: Android System WebView 137 ou mais novo. Sem ele, a prova do chat
// NÃO roda (e a casca mostra "atualize o WebView"); isso aparece no fim como NÃO CONFERIDO, nunca como certo.
const comJspi = await p.avaliar("typeof WebAssembly.Suspending === 'function'");
const webview = (shell("dumpsys webviewupdate").match(/Current WebView package \(name, version\): \(([^)]+)\)/) ?? [])[1] ?? "?";
console.log(`  WebView do aparelho: ${webview}; JSPI: ${comJspi ? "sim" : "não"}`);
if (comJspi) {
  const M = await motorNoNode();
  const bia = { motor: M.CoreCrypto.new(M.Database.inMemory()), chave: novoParEd25519() };
  bia.motor = await bia.motor;
  bia.impressao = await ligarProteus(bia.motor);
  // O banco do motor de uma rodada anterior (no OPFS, em core-crypto/) é apagado antes: a chave dele foi sorteada na outra rodada.
  await p.avaliar("navigator.storage.getDirectory().then((d) => d.getDirectoryHandle('core-crypto')).then((c) => c.removeEntry('alumia-teste-aparelho', { recursive: true })).then(() => 'apagado', () => 'nada')");
  const ana = await p.avaliar("window.__alumiaTeste.chatComecar()");
  ok("o motor de cifra roda dentro do app (core-crypto empacotado)", typeof ana?.impressao === "string" && ana.impressao.length > 20 && typeof ana.versao === "string", JSON.stringify(ana));
  const deB64 = (t) => Uint8Array.from(Buffer.from(t, "base64"));
  const b64 = (b) => Buffer.from(b).toString("base64");
  await sessaoPelaPreChave(bia.motor, deB64(ana.aparelho), ana.impressao, { id: ana.pre.id, pkb: deB64(ana.pre.pkb), assinatura: deB64(ana.pre.assinatura) });
  // A sessão da Bia é com o APARELHO da Ana (a chave dela no emulador), não com a da própria Bia.
  const ida = await cifrar(bia.motor, deB64(ana.aparelho), new TextEncoder().encode("oi, Ana — Bia no Node"));
  const abertoPelaAna = await p.avaliar(`window.__alumiaTeste.chatAbrir(${JSON.stringify(b64(bia.chave.publica))}, ${JSON.stringify(bia.impressao)}, ${JSON.stringify(b64(ida))})`);
  ok("o chat funciona: Ana (emulador) abre o que Bia (Node) mandou", abertoPelaAna === "oi, Ana — Bia no Node", abertoPelaAna);
  const volta = await p.avaliar(`window.__alumiaTeste.chatCifrar(${JSON.stringify(b64(bia.chave.publica))}, "oi, Bia — Ana no emulador")`);
  const abertoPelaBia = await decifrar(bia.motor, deB64(ana.aparelho), ana.impressao, deB64(volta));
  ok("o chat funciona: Bia (Node) abre o que Ana (emulador) mandou", abertoPelaBia && new TextDecoder().decode(abertoPelaBia) === "oi, Bia — Ana no emulador");
  const repetida = await p.avaliar(`window.__alumiaTeste.chatAbrir(${JSON.stringify(b64(bia.chave.publica))}, ${JSON.stringify(bia.impressao)}, ${JSON.stringify(b64(ida))})`);
  ok("ataque: a mesma mensagem de novo não abre (repetição)", repetida === null);
} else {
  naoConferido.push(`o chat no aparelho (Ana no emulador, Bia no Node): o WebView do aparelho (${webview}) não tem JSPI; precisa do 137+`);
}

// ── 4. Tela, notificação e teclado ──
console.log("# tela, notificação e teclado");
const janelas = shell("dumpsys window windows");
const minha = janelas.split(/\n(?=  Window #)/).find((b) => b.includes(`u0 ${PACOTE}/`) && /\bfl=/.test(b)) ?? "";
ok("FLAG_SECURE na janela da casca", /\bfl=[^\n]*\bSECURE\b/.test(minha), minha.slice(0, 400));
const foto = adb(["exec-out", "screencap", "-p"], { binario: true });
const escura = fracaoEscura(foto);
ok("ataque: a captura de tela sai preta (FLAG_SECURE)", escura > 0.97, `fração escura ${escura}`);
await p.avaliar("window.__alumiaTeste.app.notificar()");
await esperar(1500);
const notif = shell("dumpsys notification --noredact");
const registro = notif.split(/\n(?=\s+NotificationRecord\()/).find((b) => b.includes(`pkg=${PACOTE}`)) ?? "";
ok("a notificação existe e é secreta na tela bloqueada (vis=SECRET)", /vis=SECRET/.test(registro), registro.slice(0, 600));
ok("ataque: a notificação não leva texto, remetente nem trecho", registro.length > 0 && !/android\.text=String|android\.bigText|android\.messages|android\.subText=String|tickerText=[^n]/.test(registro), registro.slice(0, 600));
shell(`cmd notification cancel_all ${PACOTE}`);
// O teclado: toca no primeiro campo da casca e lê o EditorInfo que o WebView do app entregou ao teclado.
const campo = await p.avaliar("(() => { const c = document.querySelector('input, textarea'); if (!c) return null; const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, dpr: devicePixelRatio, ac: c.getAttribute('autocomplete'), sc: c.getAttribute('spellcheck'), cor: c.getAttribute('autocorrect') }; })()");
if (campo) {
  const topo = JSON.parse(lista.find((a) => a.type === "page")?.description ?? "{}").screenY ?? 0;
  shell(`input tap ${Math.round(campo.x * campo.dpr)} ${Math.round(campo.y * campo.dpr + topo)}`);
  await esperar(2000);
  const ime = shell("dumpsys input_method");
  const opcoes = [...ime.matchAll(/imeOptions=0x([0-9a-f]+)/g)].map((m) => parseInt(m[1], 16));
  ok("ataque: o teclado recebe IME_FLAG_NO_PERSONALIZED_LEARNING no campo da casca", opcoes.some((o) => (o & 0x1000000) !== 0), opcoes.map((o) => o.toString(16)).join(","));
  ok("o campo pede sem preencher, sem corretor e sem sugestão", campo.ac === "off" && campo.sc === "false" && campo.cor === "off", JSON.stringify(campo));
  await p.avaliar("(document.activeElement?.blur(), true)");
} else {
  ok("há um campo de texto na primeira tela da casca", false);
}

// ── 5. Cofre, senha do app, apagar depois de X, trava ──
console.log("# cofre e trava");
const est0 = await p.avaliar("window.__alumiaTeste.cofre.estado()");
ok("apagar depois de X senhas: DESLIGADO por padrão", est0?.limite === 0, JSON.stringify(est0));
const emulador = shell("getprop ro.kernel.qemu").trim() === "1" || shell("getprop ro.boot.qemu").trim() === "1";
if (emulador && est0?.nivel === "software") naoConferido.push("a chave no hardware (TEE/StrongBox): o emulador não tem; o cofre caiu para o Keystore em software, como o código prevê (aparelho real: docs/TESTE-EM-APARELHO-REAL.md)");
else ok("a chave do cofre está no hardware do aparelho (TEE ou StrongBox)", ["tee", "strongbox"].includes(est0?.nivel), est0?.nivel);
console.log(`  nível do cofre neste aparelho: ${est0?.nivel}`);
const embrulho = await p.avaliar("window.__alumiaTeste.cofre.embrulhar({ finalidade: 'teste/v1', dados: btoa('segredo do aparelho') }).then((r) => r.embrulhado)");
ok("o cofre embrulha", typeof embrulho === "string" && embrulho.length > 20);
await p.avaliar("window.__alumiaTeste.trava.definirSenhaDoApp('senha certa do app')");
for (let i = 0; i < 4; i++) await p.avaliar("window.__alumiaTeste.trava.destravar('errada')");
ok("desligado: 4 senhas erradas não apagam nada", (await p.avaliar("window.__alumiaTeste.trava.temSenhaDoApp()")) === true);
ok("a senha certa abre", (await p.avaliar("window.__alumiaTeste.trava.destravar('senha certa do app')"))?.tipo === "certa");
await p.avaliar("window.__alumiaTeste.cofre.definirLimite({ limite: 3 })");
await p.avaliar("window.__alumiaTeste.cofre.zerarSenhas()");
await p.avaliar("window.__alumiaTeste.trava.destravar('errada 1')");
ok("ataque: limite 1 ou 2 é recusado também no nativo", await p.avaliar("window.__alumiaTeste.cofre.definirLimite({ limite: 2 }).then(() => false, () => true)"));
// Desligar à força com uma tentativa contada: a contagem fica.
p.fechar();
pararApp();
({ p, lista } = await abrirCasca());
ok("ataque: desligar à força não zera a contagem", (await p.avaliar("window.__alumiaTeste.cofre.estado()"))?.erros === 1);
await p.avaliar("window.__alumiaTeste.trava.destravar('errada 2')");
// O disfarce, antes de reiniciar.
await p.avaliar("window.__alumiaTeste.app.disfarce({ nome: 'calculadora' })");
await esperar(1500);
const comDisfarce = shell(`cmd package query-activities --brief -a android.intent.action.MAIN -c android.intent.category.LAUNCHER ${PACOTE}`);
ok("disfarce: na tela inicial só a \"Calculadora\"", /\.Calculadora/.test(comDisfarce) && !/\.Padrao|\.Notas/.test(comDisfarce), comDisfarce);
p.fechar();
let aliasAtual = "Calculadora";
if (!semReiniciar) {
  console.log("# reiniciar o aparelho");
  await reiniciar();
  // Reiniciar logo depois de trocar o nome: o sistema pode perder a troca (grava com atraso); o app reaplica a escolha ao ligar
  // (Reaplicar, no aviso de aparelho ligado). Espera até 60 s pelo aviso.
  let depois = "";
  for (let i = 0; i < 30; i++) {
    depois = shell(`cmd package query-activities --brief -a android.intent.action.MAIN -c android.intent.category.LAUNCHER ${PACOTE}`);
    if (/\.Calculadora/.test(depois) && !/\.Padrao/.test(depois)) break;
    await esperar(2000);
  }
  ok("disfarce: continua depois de reiniciar", /\.Calculadora/.test(depois) && !/\.Padrao|\.Notas/.test(depois), depois);
  ({ p, lista } = await abrirCasca(aliasAtual));
  ok("ataque: reiniciar o aparelho não zera a contagem", (await p.avaliar("window.__alumiaTeste.cofre.estado()"))?.erros === 2);
  const aberto = await p.avaliar(`window.__alumiaTeste.cofre.desembrulhar({ finalidade: 'teste/v1', embrulhado: ${JSON.stringify(embrulho)} }).then((r) => r.dados && atob(r.dados))`);
  ok("a chave do cofre sobrevive a reiniciar (o embrulho de antes abre)", aberto === "segredo do aparelho", aberto);
  ok("a senha do app sobrevive a reiniciar", (await p.avaliar("window.__alumiaTeste.trava.temSenhaDoApp()")) === true);
} else {
  ({ p, lista } = await abrirCasca(aliasAtual));
}
await p.avaliar("window.__alumiaTeste.app.disfarce({ nome: 'padrao' })");
aliasAtual = "Padrao";
await esperar(1500);
// Trocar o nome desliga o nome por onde o app foi aberto: o sistema fecha a tarefa (o app vai para o fundo; abre pelo nome novo).
p.fechar();
pararApp();
({ p, lista } = await abrirCasca(aliasAtual));

// A trava automática: ao ir para o fundo, a tela é coberta e trava.
shell("input keyevent KEYCODE_HOME");
await esperar(1500);
shell(`am start -W -n ${PACOTE}/${PACOTE}.${aliasAtual}`);
await esperar(1500);
const telaDepois = await p.avaliar("document.querySelector('[data-tela]')?.getAttribute('data-tela') ?? document.body.innerText.slice(0, 200)").catch((e) => String(e));
ok("trava automática: voltar do fundo cai na trava", /trava/.test(String(telaDepois)), telaDepois);

// A sincronização interrompida (loja do chat): desligar à força no meio.
console.log("# sincronia interrompida");
await p.avaliar("window.__alumiaTeste.sincronizar('ana', 5)");
await p.mandar("Runtime.evaluate", { expression: "window.__alumiaTeste.sincronizar('ana', 100000)", awaitPromise: false });
await esperar(1200);
p.fechar();
pararApp();
({ p, lista } = await abrirCasca(aliasAtual));
const lidoForca = await p.avaliar("window.__alumiaTeste.lerDaLoja('ana').then((v) => v ? v.volta : 'vazio', (e) => 'erro: ' + e)");
ok("desligar à força no meio da sincronia: a loja abre num estado inteiro", typeof lidoForca === "number" && lidoForca >= 4, lidoForca);
ok("e a sincronia segue depois", (await p.avaliar("window.__alumiaTeste.sincronizar('ana', 3)")) === 2);
if (!semReiniciar) {
  await p.mandar("Runtime.evaluate", { expression: "window.__alumiaTeste.sincronizar('ana', 100000)", awaitPromise: false });
  await esperar(1200);
  p.fechar();
  console.log("# reiniciar no meio da sincronia");
  await reiniciar();
  ({ p, lista } = await abrirCasca(aliasAtual));
  const lidoReinicio = await p.avaliar("window.__alumiaTeste.lerDaLoja('ana').then((v) => v ? v.volta : 'vazio', (e) => 'erro: ' + e)");
  ok("reiniciar no meio da sincronia: a loja abre num estado inteiro", typeof lidoReinicio === "number" && lidoReinicio >= 2, lidoReinicio);
}

// O limite: a terceira errada apaga tudo (a chave do cofre e os dados do app; o sistema encerra o processo).
console.log("# apagar tudo no limite");
const antesDeApagar = await p.avaliar("window.__alumiaTeste.cofre.estado()");
ok("antes do limite a contagem está em 2 de 3", antesDeApagar?.erros === 2 && antesDeApagar?.limite === 3, JSON.stringify(antesDeApagar));
await p.mandar("Runtime.evaluate", { expression: "window.__alumiaTeste.trava.destravar('errada 3')", awaitPromise: false });
await esperar(4000);
p.fechar();
const arquivos = shell(`run-as ${PACOTE} sh -c 'ls -R shared_prefs files app_webview 2>/dev/null | grep -c . '`).trim();
ok("no limite: os dados do app somem (preferências, arquivos, WebView)", arquivos === "0" || /No such file/.test(arquivos), arquivos);
({ p, lista } = await abrirCasca(aliasAtual));
const depoisDeApagar = await p.avaliar(`window.__alumiaTeste.cofre.desembrulhar({ finalidade: 'teste/v1', embrulhado: ${JSON.stringify(embrulho)} }).then((r) => r.dados ?? null, () => null)`);
ok("no limite: a chave do cofre some (o embrulho de antes não abre mais)", depoisDeApagar === null, depoisDeApagar);
ok("no limite: a senha do app e a loja do chat somem", (await p.avaliar("window.__alumiaTeste.trava.temSenhaDoApp()")) === false && (await p.avaliar("window.__alumiaTeste.lerDaLoja('ana')")) === null);
const estDepois = await p.avaliar("window.__alumiaTeste.cofre.estado()");
ok("depois de apagar, o limite volta ao padrão (desligado)", estDepois?.limite === 0 && estDepois?.erros === 0, JSON.stringify(estDepois));
p.fechar();
pararApp();

console.log(`\ntestar-r3-android-aparelho: ${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  FALHOU: ${f}`);
for (const n of naoConferido) console.log(`  NÃO CONFERIDO: ${n}`);
process.exit(falhas.length ? 1 : 0);

/** A fração de pixels escuros de um PNG de captura (RGBA 8 bits, o formato do screencap). Sem dependência: só zlib. */
function fracaoEscura(png) {
  if (!png || png.length < 50 || png.readUInt32BE(0) !== 0x89504e47) return 0;
  let pos = 8;
  let largura = 0;
  let altura = 0;
  let tipo = 6;
  const idat = [];
  while (pos < png.length) {
    const n = png.readUInt32BE(pos);
    const t = png.toString("ascii", pos + 4, pos + 8);
    const d = png.subarray(pos + 8, pos + 8 + n);
    if (t === "IHDR") {
      largura = d.readUInt32BE(0);
      altura = d.readUInt32BE(4);
      tipo = d[9];
    } else if (t === "IDAT") idat.push(d);
    pos += 12 + n;
  }
  const bpp = tipo === 6 ? 4 : tipo === 2 ? 3 : 0;
  if (!bpp) return 0;
  const cru = zlib.inflateSync(Buffer.concat(idat));
  const linha = largura * bpp;
  let anterior = Buffer.alloc(linha);
  let escuros = 0;
  for (let y = 0; y < altura; y++) {
    const filtro = cru[y * (linha + 1)];
    const atual = Buffer.from(cru.subarray(y * (linha + 1) + 1, (y + 1) * (linha + 1)));
    for (let i = 0; i < linha; i++) {
      const a = i >= bpp ? atual[i - bpp] : 0;
      const b = anterior[i];
      const c = i >= bpp ? anterior[i - bpp] : 0;
      let v = atual[i];
      if (filtro === 1) v += a;
      else if (filtro === 2) v += b;
      else if (filtro === 3) v += (a + b) >> 1;
      else if (filtro === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a);
        const pb = Math.abs(pp - b);
        const pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      atual[i] = v & 0xff;
    }
    for (let x = 0; x < largura; x += 4) {
      const i = x * bpp;
      if (atual[i] < 16 && atual[i + 1] < 16 && atual[i + 2] < 16) escuros++;
    }
    anterior = atual;
  }
  return escuros / (Math.ceil(largura / 4) * altura);
}
