// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A malha sem internet no aparelho (onda R3, item 2.2): só liga quando a pessoa ativa, com o aviso; desligada a cada vez que o app
// abre; só no app Android; desligar apaga tudo; e o transporte sobre o plugin nativo `AlumiaMalha` (lib/rede/malha/android.ts),
// com um plugin de mentira que move bytes entre dois "celulares" como o Kotlin moveria. Pacote estranho que chega pelo plugin
// (base64 quebrado, grande demais, de par desconhecido) não derruba nada.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-r3-malha-ativacao.mjs
import { paraB64Url } from "../lib/rede/chat/r2/bytes.ts";
import { montarCobertura, TAMANHO_DO_PACOTE } from "../lib/rede/malha/pacote.ts";
import { transporteAndroid, pluginDaMalha } from "../lib/rede/malha/android.ts";
import { NoDaMalha } from "../lib/rede/malha/no.ts";
import { estadoDaMalha, ligarMalha, desligarMalha, noDaMalha, _paraTestes } from "../lib/rede/malha/ativacao.ts";

let certos = 0;
const falhas = [];
const confere = (nome, ok, detalhe = "") => (ok ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
const espera = () => new Promise((ok) => setTimeout(ok, 150));

/** Um plugin de mentira: guarda os ouvintes e o que foi mandado; `ligado` diz se o Bluetooth estaria ligado. */
function pluginFalso() {
  const ouvintes = { encontro: [], pacote: [], fim: [] };
  const p = {
    ligado: false,
    mandados: [],
    async ligar() {
      p.ligado = true;
    },
    async desligar() {
      p.ligado = false;
    },
    async mandar(o) {
      p.mandados.push(o);
      p.outro?.emitir("pacote", { par: o.par, dados: o.dados });
    },
    async addListener(ev, f) {
      ouvintes[ev].push(f);
      return { remove: async () => (ouvintes[ev] = ouvintes[ev].filter((x) => x !== f)) };
    },
    emitir(ev, e) {
      for (const f of ouvintes[ev]) f(e);
    },
    quantos: (ev) => ouvintes[ev].length,
  };
  return p;
}

// ── No site (sem Capacitor) ────────────────────────────────────────────────────────────────────────────────────────────────
{
  _paraTestes(null);
  confere("site: sem o app, o estado é \"so_no_app\"", estadoDaMalha() === "so_no_app" && pluginDaMalha() === null);
  confere("site: ligar com o aviso diz \"so_no_app\" e não liga nada", ligarMalha({ celularesProximosPercebem: true }) === "so_no_app" && noDaMalha() === null);
  globalThis.Capacitor = { getPlatform: () => "web", Plugins: { AlumiaMalha: pluginFalso() } };
  confere("site: um Capacitor que não é Android não conta", pluginDaMalha() === null);
}

// ── No app Android ─────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const plugin = pluginFalso();
  globalThis.Capacitor = { getPlatform: () => "android", Plugins: { AlumiaMalha: plugin } };
  _paraTestes(null);
  confere("app: desligada por padrão (e o Bluetooth parado)", estadoDaMalha() === "desligada" && !plugin.ligado && noDaMalha() === null);
  let lancou = "";
  try {
    ligarMalha({});
  } catch (e) {
    lancou = e.message;
  }
  confere("app: sem o aviso aceito, não liga", lancou === "aviso_obrigatorio" && !plugin.ligado);
  try {
    ligarMalha(undefined);
  } catch (e) {
    lancou = e.message;
  }
  confere("app: sem aviso nenhum, não liga", lancou === "aviso_obrigatorio" && !plugin.ligado);
  confere("app: com o aviso aceito, liga", ligarMalha({ celularesProximosPercebem: true }) === "ligada" && estadoDaMalha() === "ligada");
  await espera();
  confere("app: o plugin foi ligado e ouve encontro, pacote e fim", plugin.ligado && plugin.quantos("encontro") === 1 && plugin.quantos("pacote") === 1 && plugin.quantos("fim") === 1);
  noDaMalha().guardar(await montarCobertura());
  plugin.emitir("encontro", { par: "7" });
  await espera();
  await espera();
  confere("app: no encontro, manda os pacotes (o guardado e a cobertura do encontro), 3254 bytes cada", plugin.mandados.length === 2 && plugin.mandados.every((m) => m.par === "7" && m.dados.length === Math.ceil((TAMANHO_DO_PACOTE * 4) / 3)));
  const antes = noDaMalha().quantos;
  for (const dados of ["***", "", "a".repeat(9000), 12, null, paraB64Url(new Uint8Array(10))]) plugin.emitir("pacote", { par: "7", dados });
  plugin.emitir("pacote", { par: "desconhecido", dados: paraB64Url(await montarCobertura()) });
  await espera();
  confere("app: pacote estranho pelo plugin (base64 quebrado, grande, de par desconhecido) não derruba e não entra", noDaMalha()?.quantos === antes);
  plugin.emitir("pacote", { par: "7", dados: paraB64Url(await montarCobertura()) });
  await espera();
  confere("app: um pacote bom do par entra", noDaMalha()?.quantos === antes + 1);
  plugin.emitir("fim", { par: "7" });
  plugin.emitir("pacote", { par: "7", dados: paraB64Url(await montarCobertura()) });
  await espera();
  confere("app: depois do fim, o par não entrega mais nada", noDaMalha()?.quantos === antes + 1);
  const no = noDaMalha();
  desligarMalha();
  await espera();
  confere("app: desligar para o Bluetooth, tira os ouvintes e apaga o guardado", !plugin.ligado && plugin.quantos("encontro") === 0 && no.quantos === 0 && estadoDaMalha() === "desligada");
  _paraTestes(null);
  confere("app: ao abrir de novo, começa desligada (nada fica gravado dizendo para ligar sozinha)", estadoDaMalha() === "desligada" && noDaMalha() === null);
}

// ── Dois celulares pelo plugin (o Kotlin só move bytes) ──────────────────────────────────────────────────────────────────────
{
  const pa = pluginFalso();
  const pb = pluginFalso();
  pa.outro = pb;
  pb.outro = pa;
  const recebidos = [];
  const a = new NoDaMalha(transporteAndroid(pa), async () => false);
  const b = new NoDaMalha(transporteAndroid(pb), async (p) => (recebidos.push(p), false));
  a.ligar();
  b.ligar();
  await espera();
  const p = await montarCobertura();
  a.guardar(p);
  pa.emitir("encontro", { par: "1" });
  pb.emitir("encontro", { par: "1" });
  await espera();
  await espera();
  confere("dois celulares: o pacote de A chega a B pelo plugin, sem mudar um byte", recebidos.some((x) => x.length === p.length && x.every((v, i) => v === p[i])), JSON.stringify([recebidos.length, pa.mandados.length, pb.mandados.length, b.descartados]));
  a.desligar();
  b.desligar();
}

delete globalThis.Capacitor;
console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
