// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova as regras de tela da B1 da casca (lib/rede/publicar/b1.ts), sem navegador: o aviso de conteúdo (chave e "sempre abrir"),
// o relógio do lembrete de pausa (só conta rolagem de verdade, sem placar), a aba inicial, o código da chave dos rascunhos e a
// cifra AES-GCM (o servidor só vê o embaralhado; outra chave não abre), e os textos da B1 nos 6 idiomas, com as mesmas chaves.
// Também confere que as telas usam o que a B1 trouxe (o Escrever manda aviso e citar_quem; o rascunho vai cifrado).
// Uso: npm run testar:alumia-b1-casca-telas
import fs from "node:fs";
import {
  avisoAbreSozinho,
  avisosQueAbrem,
  chaveDoAviso,
  chaveDoCodigo,
  cifrarRascunho,
  codigoDaChave,
  criarRelogioDaPausa,
  decifrarRascunho,
  guardarAbaPreferida,
  abaPreferida,
  guardarMinutosDaPausa,
  guardarNaConta,
  marcarAvisoQueAbre,
  marcarGuardarNaConta,
  minutosDaPausa,
  chaveDoAparelho,
} from "../lib/rede/publicar/b1.ts";

let certos = 0;
const falhas = [];
async function espera(nome, fazer) {
  try {
    const ok = await fazer();
    if (ok !== true) throw new Error(`deu ${JSON.stringify(ok)}`);
    certos++;
  } catch (e) {
    falhas.push(`${nome}: ${e.message}`);
  }
}
const ler = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
function guarda() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
}

// ───── Aviso de conteúdo ─────
await espera("a chave do aviso ignora acento, caixa e espaço", () => chaveDoAviso("  Violência   POLICIAL ") === "violencia policial");
await espera("a chave corta em 80 (como o banco)", () => chaveDoAviso("a".repeat(200)).length === 80);
{
  const g = guarda();
  await espera("sem escolha, nenhum aviso abre sozinho", () => avisoAbreSozinho("Luto", g) === false);
  marcarAvisoQueAbre("Luto", true, g);
  await espera("'sempre abrir avisos de Luto' vale para 'luto ' também", () => avisoAbreSozinho("luto ", g) === true);
  marcarAvisoQueAbre("luto", false, g);
  await espera("e dá para desligar (a lista some do aparelho)", () => avisoAbreSozinho("Luto", g) === false && !g.m.size);
  for (let i = 0; i < 40; i++) marcarAvisoQueAbre(`tema ${i}`, true, g);
  await espera("no máximo 30 avisos guardados", () => avisosQueAbrem(g).length === 30);
  g.setItem("alumia:avisos-abertos:v1", "{quebrado");
  await espera("lixo no armazenamento não quebra a tela", () => avisosQueAbrem(g).length === 0);
}

// ───── Pausa ─────
{
  const g = guarda();
  await espera("o lembrete vem ligado em 30 min por padrão", () => minutosDaPausa(g) === 30);
  guardarMinutosDaPausa(0, g);
  await espera("desligar fica guardado", () => minutosDaPausa(g) === 0);
  guardarMinutosDaPausa(7, g);
  await espera("um valor fora da lista volta ao padrão", () => minutosDaPausa(g) === 30);

  const r = criarRelogioDaPausa(15);
  let t = 0;
  let tocou = false;
  // 20 minutos com a página parada (sem rolar): não conta.
  for (; t < 20 * 60_000; t += 5_000) tocou ||= r.tique(t, true);
  await espera("sem rolar, o relógio não anda", () => !tocou && r.ms === 0);
  // 20 minutos rolando, mas com a aba escondida: não conta.
  for (let u = 0; u < 20 * 60_000; u += 5_000, t += 5_000) {
    r.gesto(t);
    tocou ||= r.tique(t, false);
  }
  await espera("aba escondida não conta", () => !tocou);
  // Rolando de verdade: aos 15 minutos, toca.
  let quando = null;
  for (let u = 0; u < 20 * 60_000; u += 5_000, t += 5_000) {
    r.gesto(t);
    if (r.tique(t, true) && quando === null) quando = u;
  }
  await espera("rolando de verdade, toca perto dos 15 minutos", () => quando !== null && quando >= 14 * 60_000 && quando <= 15 * 60_000 + 10_000);
  r.zerar();
  await espera("zerar recomeça do zero (sem placar acumulado)", () => r.ms === 0);
  const desligado = criarRelogioDaPausa(0);
  let x = false;
  for (let u = 0; u < 120 * 60_000; u += 5_000) {
    desligado.gesto(u);
    x ||= desligado.tique(u, true);
  }
  await espera("desligado nunca toca", () => x === false);
}

// ───── Aba inicial ─────
{
  const g = guarda();
  await espera("sem escolha, a aba é a de sempre (nula aqui)", () => abaPreferida(g) === null);
  guardarAbaPreferida("comunidades", g);
  await espera("a aba escolhida fica no aparelho", () => abaPreferida(g) === "comunidades");
  guardarAbaPreferida("geral", g);
  await espera("aba que não existe não é guardada", () => abaPreferida(g) === null);
}

// ───── Rascunho cifrado ─────
{
  const g = guarda();
  await espera("guardar na conta vem desligado (opt-in)", () => guardarNaConta(g) === false);
  marcarGuardarNaConta(true, g);
  await espera("e liga quando a pessoa escolhe", () => guardarNaConta(g) === true);
  const chave = chaveDoAparelho(g);
  await espera("a chave do aparelho tem 32 bytes e é a mesma da segunda vez", () => chaveDoCodigo(chave) === chave && chaveDoAparelho(g) === chave);
  const codigo = codigoDaChave(chave);
  await espera("o código para outro aparelho volta à mesma chave (com ou sem tracinhos)", () => chaveDoCodigo(codigo) === chave && chaveDoCodigo(codigo.replace(/-/g, " ")) === chave);
  await espera("código errado é recusado", () => chaveDoCodigo("isto-nao-e-chave") === null);
  const conteudo = { tipo: "post", texto: "Denúncia: abordagem na Rua X, 19h", titulo: "", corpo: "", comunidade: null, publico: "membros", responde_quem: "todos" };
  const c = await cifrarRascunho(conteudo, chave);
  await espera("o servidor recebe só v, iv e cifra (sem o texto)", () => Object.keys(c).sort().join() === "cifra,iv,v" && !JSON.stringify(c).includes("Denúncia") && /^[A-Za-z0-9+/]{16}$/.test(c.iv));
  const c2 = await cifrarRascunho(conteudo, chave);
  await espera("cada cifra usa um iv novo", () => c.iv !== c2.iv && c.cifra !== c2.cifra);
  await espera("a mesma chave abre", async () => (await decifrarRascunho(c, chave))?.texto === conteudo.texto);
  const outra = chaveDoAparelho(guarda());
  await espera("outra chave não abre (nulo, sem erro)", async () => (await decifrarRascunho(c, outra)) === null);
  const mexida = { ...c, cifra: c.cifra.slice(0, -4) + (c.cifra.endsWith("AAA=") ? "BBB=" : "AAA=") };
  await espera("cifra mexida não abre", async () => (await decifrarRascunho(mexida, chave)) === null);
}

// ───── Textos nos 6 idiomas ─────
const idiomas = ["pt", "en", "es", "fr", "ru", "zh"];
const chaves = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? chaves(v, `${p}${k}.`) : [`${p}${k}`]));
const base = chaves(JSON.parse(ler("i18n/rede/publicar/alumia2/pt.json")).b1).sort();
for (const l of idiomas) {
  const b1 = JSON.parse(ler(`i18n/rede/publicar/alumia2/${l}.json`)).b1;
  await espera(`b1 em ${l}: as mesmas ${base.length} chaves`, () => JSON.stringify(chaves(b1).sort()) === JSON.stringify(base));
  await espera(`b1 em ${l}: nada vazio, os {marcadores} batem com o pt`, () => {
    const pt = JSON.parse(ler("i18n/rede/publicar/alumia2/pt.json")).b1;
    const pega = (o, k) => k.split(".").reduce((x, y) => x?.[y], o);
    return base.every((k) => {
      const v = pega(b1, k);
      const marcas = (s) => (String(s).match(/\{\w+\}/g) ?? []).sort().join();
      return typeof v === "string" && v.trim() && marcas(v) === marcas(pega(pt, k));
    });
  });
}

// ───── As telas usam a B1 ─────
const extras = ler("components/rede/publicar/ExtrasDoEscrever.tsx");
const escrever = ler("components/rede/publicar/alumia2/EscreverDaAlumia2.tsx");
const cartao = ler("components/rede/publicar/alumia2/CartaoDaAlumia2.tsx");
await espera("o Escrever manda o aviso de conteúdo e quem pode citar", () => extras.includes("campos.aviso = aviso.trim()") && extras.includes("campos.citar_quem = citarQuem"));
await espera("o Escrever publica pelo rede_pub_publicar_mais e agenda pelo rede_pub_agendar_mais", () => escrever.includes("redePub.publicarMais(") && escrever.includes("redePub.agendarMais("));
await espera("o rascunho na conta só sai cifrado e só com a chave ligada", () => escrever.includes("salvarCifrado(rascunhoAtual)") && !escrever.includes("redePub.salvarRascunho(rascunhoAtual)") && escrever.includes("!naConta"));
await espera("rascunho de ato nunca vai à conta", () => /tipo === "ato"\) \{\s*if \(rascunhoTemTexto/.test(escrever));
await espera("o cartão cobre texto e imagem com o aviso e tem o citar", () => cartao.includes("al2-cw-coberto") && cartao.includes("CitarNoCartao"));
await espera("o lembrete de pausa não manda nada ao servidor", () => !/redePub|rede\.|fetch\(/.test(ler("components/rede/publicar/alumia2/LembreteDePausa.tsx")));
await espera("as rotas da Alumia têm loading.tsx", () => ["app/[lang]/alumia/loading.tsx", "app/[lang]/alumia/p/[id]/loading.tsx", "app/[lang]/alumia/ato/[id]/loading.tsx"].every((p) => fs.existsSync(new URL(`../${p}`, import.meta.url))));
await espera("a rota reserva do agendador exige a chave e compara em tempo constante", () => {
  const r = ler("app/api/rede/agendados/route.ts");
  return r.includes("CRON_SECRET") && r.includes("timingSafeEqual") && r.includes("rede_pub_agendados_rodar");
});

if (falhas.length) {
  console.error(`✗ ${falhas.length} falha(s):\n  - ${falhas.join("\n  - ")}`);
  process.exit(1);
}
console.log(`✓ Alumia B1 · casca nas telas: ${certos} verificações certas.`);
