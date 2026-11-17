// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os ícones da Alumia (aba do navegador, tela inicial do iPhone e manifesto), gerados do mesmo desenho do lampião da marca
// (components/rede/ui/Lampiao.tsx): fundo da noite (#0f0e0d), papel creme, chama vermelha e dourada. Rodar de novo só quando o
// desenho mudar: `node scripts/gerar-icones-alumia.mjs`. Usa o sharp que o Next já traz; escreve em public/alumia/.
//
// A margem: o 192 e o 512 cabem inteiros no círculo seguro do ícone recortado (80% do lado, a regra do "maskable"), então o
// Android pode recortar em círculo, gota ou quadrado sem comer a alça nem a base. O 180 (iPhone, cantos arredondados) e o 32
// (aba) têm margem menor, porque ali ninguém recorta em círculo e o desenho precisa de cada pixel.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destino = path.join(raiz, "public", "alumia");

const NOITE = "#0f0e0d";
const PAPEL = "#f3efe6";
const VERMELHO = "#e8321f";
const DOURADO = "#ffc21a";
const CAIXA = { x: 480, y: 330, largura: 745, altura: 1280 };
const CHAMA = [".d.", ".vv", "vvv", "vdv", ".v."];

const cartoes = CHAMA.flatMap((linha, y) =>
  [...linha].map((c, x) => (c === "." ? "" : `<rect x="${700 + x * 105}" y="${826 + y * 105}" width="95" height="95" rx="13" fill="${c === "d" ? DOURADO : VERMELHO}"/>`)),
).join("");

/** O ícone de `lado` pixels, com o lampião de `fracao` da altura, centrado na noite. */
function svgDoIcone(lado, fracao) {
  const altura = lado * fracao;
  const largura = (altura * CAIXA.largura) / CAIXA.altura;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 ${lado} ${lado}">
<rect width="${lado}" height="${lado}" fill="${NOITE}"/>
<svg x="${(lado - largura) / 2}" y="${(lado - altura) / 2}" width="${largura}" height="${altura}" viewBox="${CAIXA.x} ${CAIXA.y} ${CAIXA.largura} ${CAIXA.altura}">
<path d="M662 620V577A190 190 0 0 1 1042 577V620" fill="none" stroke="${PAPEL}" stroke-width="94"/>
<path d="M548 616H1157L1106 711H598Z" fill="${PAPEL}"/>
<rect x="487" y="709" width="731" height="761" rx="150" fill="${PAPEL}"/>
<rect x="573" y="794" width="558" height="578" rx="95" fill="${NOITE}"/>
${cartoes}
<rect x="586" y="1487" width="536" height="113" rx="56.5" fill="${PAPEL}"/>
</svg>
</svg>`;
}

// O lampião inteiro (alça a base, proporção 0,58) cabe no círculo de raio 40% do lado com altura de até 69%: 66% deixa folga.
const ICONES = [
  { arquivo: "icone-32.png", lado: 32, fracao: 0.88 },
  { arquivo: "apple-icone-180.png", lado: 180, fracao: 0.74 },
  { arquivo: "icone-192.png", lado: 192, fracao: 0.66 },
  { arquivo: "icone-512.png", lado: 512, fracao: 0.66 },
];

mkdirSync(destino, { recursive: true });
// O vetorial da aba (sizes="any"): o navegador prefere ele ao favicon.ico do site, que o Next põe em toda página.
writeFileSync(path.join(destino, "icone.svg"), `${svgDoIcone(64, 0.88).replaceAll("\n", "")}\n`);
console.log("public/alumia/icone.svg");
for (const { arquivo, lado, fracao } of ICONES) {
  // Desenha 8 vezes maior e reduz: as bordas ficam lisas mesmo no de 32.
  await sharp(Buffer.from(svgDoIcone(lado * 8, fracao)))
    .resize(lado, lado)
    .png({ compressionLevel: 9 })
    .toFile(path.join(destino, arquivo));
  console.log(`public/alumia/${arquivo} (${lado} × ${lado})`);
}
