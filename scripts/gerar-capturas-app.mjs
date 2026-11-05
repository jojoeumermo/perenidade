// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Gera as capturas de tela do aplicativo para o convite de instalação (campo "screenshots" do manifesto) e grava a lista em
// lib/capturas-app.json, que lib/manifesto.ts lê. Precisa do site no ar (npm run dev ou npm start) e do Playwright com o
// Chromium instalado (npx playwright install chromium). Nada sai do computador: só fala com o endereço dado.
// Uso: npm run gerar:capturas-app [-- http://localhost:3000]
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
if (!/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(BASE)) {
  console.error("Use um endereço local (localhost): as capturas saem do site que roda na sua máquina.");
  process.exit(1);
}
const PASTA = new URL("../public/capturas-app/", import.meta.url);
const LISTA = new URL("../lib/capturas-app.json", import.meta.url);

// Chrome pede lados entre 320 e 3840 px e proporção até 2,3. Celular em retrato (a casca vale abaixo de 768 px) e um painel largo.
const CAPTURAS = [
  { aba: "inicio", caminho: "/pt", forma: "narrow", largura: 390, altura: 844 },
  { aba: "estudar", caminho: "/pt/trilhas", forma: "narrow", largura: 390, altura: 844 },
  { aba: "jogos", caminho: "/pt/jogos", forma: "narrow", largura: 390, altura: 844 },
  { aba: "comunidade", caminho: "/pt/comunidade", forma: "narrow", largura: 390, altura: 844 },
  { aba: "inicio", caminho: "/pt", forma: "wide", largura: 1280, altura: 720 },
];

fs.mkdirSync(PASTA, { recursive: true });
const navegador = await chromium.launch();
const feitas = [];
try {
  for (const c of CAPTURAS) {
    const contexto = await navegador.newContext({ viewport: { width: c.largura, height: c.altura }, deviceScaleFactor: 1, isMobile: c.forma === "narrow", hasTouch: c.forma === "narrow", colorScheme: "light", locale: "pt-BR" });
    const pagina = await contexto.newPage();
    await pagina.goto(BASE + c.caminho, { waitUntil: "networkidle", timeout: 60_000 });
    await pagina.waitForTimeout(800);
    const nome = `${c.forma}-${c.aba}.png`;
    await pagina.screenshot({ path: fileURLToPath(new URL(nome, PASTA)) });
    feitas.push({ src: `/capturas-app/${nome}`, sizes: `${c.largura}x${c.altura}`, type: "image/png", form_factor: c.forma, aba: c.aba });
    await contexto.close();
    console.log("ok", nome);
  }
} finally {
  await navegador.close();
}
fs.writeFileSync(LISTA, JSON.stringify({ capturas: feitas }, null, 2) + "\n");
console.log(`${feitas.length} capturas gravadas em public/capturas-app/ e listadas em lib/capturas-app.json.`);
