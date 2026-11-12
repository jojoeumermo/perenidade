// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As silhuetas da entrada da Alumia (lib/rede/entrada/silhuetas.json → public/alumia/entrada/<id>.webp + creditos.json).
// Para cada figura ligada: pergunta ao Wikimedia Commons a licença e o autor, recusa o que não é domínio público nem licença
// livre (CC0, CC BY, CC BY-SA), baixa uma miniatura (640 px) para uma pasta temporária, e faz a silhueta: cinza, contraste
// forte, escurecida, desfocada e recortada no retrato 3:4. A foto original nunca vai para o repositório; só a silhueta, que é
// obra derivada e segue a licença da original (CC BY-SA continua CC BY-SA, com o crédito).
//
// Pessoa viva só passa com "autorizacao" preenchida (Código Civil art. 20; LGPD art. 7º). Uso: npm run alumia:silhuetas
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lista = JSON.parse(fs.readFileSync(path.join(raiz, "lib/rede/entrada/silhuetas.json"), "utf8"));
const saida = path.join(raiz, "public/alumia/entrada");
const temporaria = fs.mkdtempSync(path.join(os.tmpdir(), "alumia-silhuetas-"));
const AGENTE = { "User-Agent": "perenidade-build/1.0 (roteiro de montagem do site)" };
const LIVRE = /^(public domain|domínio público|pd|cc0|cc by(-sa)? [0-9.]+( [a-z]{2})?)$/i;
const limpo = (html) => String(html ?? "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim().replace(/^(.+?) \1$/, "$1");

/** fetch com paciência: o Commons responde 429 quando se pede rápido demais; espera e tenta de novo (até 4 vezes). */
async function buscar(endereco) {
  for (let vez = 0; ; vez++) {
    const r = await fetch(endereco, { headers: AGENTE });
    if (r.status !== 429 || vez >= 3) return r;
    await new Promise((ok) => setTimeout(ok, 4000 * (vez + 1)));
  }
}

fs.mkdirSync(saida, { recursive: true });
const creditos = [];
for (const f of lista.figuras) {
  if (!f.ligada) {
    // Figura desligada não fica publicada: a silhueta dela sai da pasta pública.
    fs.rmSync(path.join(saida, `${f.id}.webp`), { force: true });
    continue;
  }
  if (f.viva && !String(f.autorizacao ?? "").trim()) throw new Error(`${f.id}: pessoa viva sem autorização anotada; não entra`);
  const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=640&iiextmetadatafilter=LicenseShortName|LicenseUrl|Artist&titles=${encodeURIComponent(f.arquivo)}`;
  const resposta = await buscar(u);
  if (!resposta.ok) throw new Error(`${f.id}: Commons respondeu ${resposta.status}`);
  const pagina = Object.values((await resposta.json()).query?.pages ?? {})[0];
  const info = pagina?.imageinfo?.[0];
  if (!info) throw new Error(`${f.id}: arquivo não encontrado no Commons (${f.arquivo})`);
  const m = info.extmetadata ?? {};
  const licenca = limpo(m.LicenseShortName?.value);
  if (!LIVRE.test(licenca)) throw new Error(`${f.id}: licença "${licenca}" não é livre`);
  const miniatura = String(info.thumburl ?? info.url ?? "").replace(/^\/\//, "https://");
  if (!/^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(miniatura)) throw new Error(`${f.id}: endereço de imagem inesperado (${miniatura.slice(0, 80)})`);
  const bruto = path.join(temporaria, `${f.id}.bin`);
  const imagem = await buscar(miniatura);
  if (!imagem.ok) throw new Error(`${f.id}: download falhou (${imagem.status})`);
  fs.writeFileSync(bruto, Buffer.from(await imagem.arrayBuffer()));
  // A silhueta: retrato 3:4 com foco no rosto (attention), cinza, contraste puxado, escurecida e desfocada. Na tela ela entra
  // em "multiply" sobre o vermelho: o claro vira vermelho, o escuro vira a figura.
  await sharp(bruto)
    .resize(480, 640, { fit: "cover", position: sharp.strategy.attention })
    .grayscale()
    .normalise()
    .linear(1.5, -40)
    .gamma(1.6)
    .blur(2.2)
    .webp({ quality: 58 })
    .toFile(path.join(saida, `${f.id}.webp`));
  creditos.push({
    id: f.id,
    nome: f.nome,
    autor: f.autor || limpo(m.Artist?.value) || "Autoria desconhecida",
    licenca,
    licencaUrl: limpo(m.LicenseUrl?.value) || null,
    fonte: info.descriptionurl,
    derivada: "Silhueta (cinza, contraste, escurecida, desfocada e recortada) feita pelo Instituto Lúcia",
    // CC BY-SA obriga a obra derivada a sair sob a mesma licença, e a dizer isso: a silhueta não é AGPL como o código.
    ...(/^cc by-sa /i.test(licenca) ? { licencaDerivada: licenca } : {}),
    ...(f.cuidado ? { cuidado: f.cuidado } : {}),
  });
  console.log(`✓ ${f.id} · ${licenca}`);
  await new Promise((r) => setTimeout(r, 600));
}
fs.writeFileSync(path.join(raiz, "lib/rede/entrada/creditos.json"), `${JSON.stringify(creditos, null, 2)}\n`);
fs.rmSync(temporaria, { recursive: true, force: true });
console.log(`${creditos.length} silhuetas em public/alumia/entrada; créditos em lib/rede/entrada/creditos.json`);
