// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Gera os 24 rostos ilustrados (public/rede/avatares/a01..a24.svg) e os 8 padrões de capa (public/rede/capas/c01..c08.svg) da
// Rede Lúcia. Desenhos próprios do projeto, geométricos, sem pessoas reais, sem rosto fotográfico e sem referência a
// nenhuma etnia, gênero ou partido: cada pessoa escolhe o que a representa. Cada arquivo pesa menos de 1 KB.
// Uso: node scripts/gerar-avatares-rede.mjs (só quando a galeria mudar; os arquivos gerados vão para o git).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cabecalho = "<!-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE). -->\n";

// [fundo, miolo do desenho (viewBox 96 x 96)]
const AVATARES = [
  ["#f4c542", '<circle cx="48" cy="48" r="16" fill="#c21f16"/><path d="M48 16v10M48 70v10M16 48h10M70 48h10M25 25l7 7M64 64l7 7M71 25l-7 7M32 64l-7 7" stroke="#1f1a14" stroke-width="5" stroke-linecap="round"/>'], // sol
  ["#1f2a44", '<path d="M60 22a26 26 0 1 0 14 40 22 22 0 0 1-14-40z" fill="#f4ecd8"/><circle cx="68" cy="30" r="3" fill="#f4c542"/><circle cx="76" cy="44" r="2" fill="#f4c542"/>'], // lua
  ["#cfe3b4", '<path d="M48 76V44" stroke="#1f1a14" stroke-width="5" stroke-linecap="round"/><path d="M48 50C48 34 36 28 24 30c0 14 10 22 24 20z" fill="#2f6b2f"/><path d="M48 44c0-14 10-20 24-18 0 14-10 20-24 18z" fill="#2f6b2f"/>'], // broto
  ["#f4ecd8", '<path d="M22 26h24c4 0 6 2 6 6v38c0-4-2-6-6-6H22z" fill="#c21f16"/><path d="M74 26H52v38c0-4 2-6 6-6h16z" fill="#1f1a14"/>'], // livro
  ["#9bd1e5", '<path d="M18 52c14-26 40-26 54-6l8-8-2 18c-6 14-24 22-40 14l-8 6 2-12z" fill="#1f1a14"/><circle cx="64" cy="44" r="3" fill="#f4ecd8"/><path d="M78 40l10-2-4 8z" fill="#c21f16"/>'], // pássaro
  ["#2c6e8f", '<path d="M16 48c14-20 34-20 48 0-14 20-34 20-48 0z" fill="#f4c542"/><path d="M64 48l16-14v28z" fill="#f4c542"/><circle cx="34" cy="44" r="3" fill="#1f1a14"/>'], // peixe
  ["#f0b88a", '<path d="M10 76 38 30l14 22 10-14 24 38z" fill="#6b3f2a"/><path d="M38 30l7 11-7-3-6 3z" fill="#f4ecd8"/>'], // montanha
  ["#bfe0f0", '<path d="M8 40c10-12 20-12 30 0s20 12 30 0 14-8 20-2v14c-6-6-10-8-20 2s-20 12-30 0-20-12-30 0z" fill="#1f6fa0"/><path d="M8 62c10-12 20-12 30 0s20 12 30 0 14-8 20-2v14c-6-6-10-8-20 2s-20 12-30 0-20-12-30 0z" fill="#1f1a14"/>'], // onda
  ["#1f1a14", '<path d="M48 14l9 22 24 2-18 16 6 24-21-13-21 13 6-24L15 38l24-2z" fill="#f4c542"/>'], // estrela
  ["#f4ecd8", '<path d="M48 14c4 14 22 20 22 40a22 22 0 0 1-44 0c0-10 6-16 10-22 2 6 4 8 8 8-2-10 0-20 4-26z" fill="#c21f16"/><path d="M48 46c2 8 10 10 10 20a10 10 0 0 1-20 0c0-6 6-10 10-20z" fill="#f4c542"/>'], // chama
  ["#d9c7f0", '<circle cx="34" cy="38" r="14" fill="none" stroke="#1f1a14" stroke-width="7"/><path d="M44 48l26 26M60 64l8-8M68 72l8-8" stroke="#1f1a14" stroke-width="7" stroke-linecap="round" fill="none"/>'], // chave
  ["#2b2438", '<path d="M40 22h16v8H40zM36 30h24l4 38H32z" fill="#f4c542"/><path d="M44 36h8v26h-8z" fill="#f4ecd8"/><path d="M42 70h12v6H42z" fill="#f4c542"/>'], // lanterna
  ["#e8d9b5", '<circle cx="48" cy="48" r="28" fill="none" stroke="#1f1a14" stroke-width="5"/><path d="M48 24l8 24-8 24-8-24z" fill="#c21f16"/><path d="M48 72l-8-24h8z" fill="#1f1a14"/>'], // bússola
  ["#cfe9d9", '<path d="M44 80V54h8v26z" fill="#7a4a26"/><circle cx="48" cy="38" r="22" fill="#2f6b2f"/><circle cx="36" cy="46" r="12" fill="#2f6b2f"/><circle cx="60" cy="46" r="12" fill="#2f6b2f"/>'], // árvore
  ["#f7d9c4", '<path d="M16 48 48 20l32 28h-8v28H24V48z" fill="#1f1a14"/><path d="M42 76V58h12v18z" fill="#f7d9c4"/><path d="M56 36h8v8l-8-7z" fill="#c21f16"/>'], // casa
  ["#b8c9e8", '<path d="M8 56h80" stroke="#1f1a14" stroke-width="6"/><path d="M14 56c8-26 20-26 34 0 14-26 26-26 34 0" fill="none" stroke="#c21f16" stroke-width="6"/><path d="M8 72h80" stroke="#1f1a14" stroke-width="3" opacity=".5"/>'], // ponte
  ["#fbe3a6", '<path d="M48 14v40" stroke="#1f1a14" stroke-width="4"/><path d="M52 18c14 8 20 22 20 34H52z" fill="#c21f16"/><path d="M44 24c-10 8-14 18-14 28h14z" fill="#f4ecd8"/><path d="M22 60h52l-8 14H30z" fill="#1f1a14"/>'], // barco
  ["#fad4e0", '<g fill="#c2185b"><circle cx="48" cy="28" r="12"/><circle cx="68" cy="48" r="12"/><circle cx="48" cy="68" r="12"/><circle cx="28" cy="48" r="12"/></g><circle cx="48" cy="48" r="10" fill="#f4c542"/>'], // flor
  ["#dff0c8", '<path d="M20 74C16 40 40 18 78 18 80 56 56 80 20 74z" fill="#3d7a2a"/><path d="M20 74C36 56 50 42 66 30" stroke="#dff0c8" stroke-width="4" fill="none" stroke-linecap="round"/>'], // folha
  ["#f4ecd8", '<path d="M48 78C16 56 14 34 28 24c10-6 18 0 20 8 2-8 10-14 20-8 14 10 12 32-20 54z" fill="#c21f16"/>'], // coração
  ["#7fb6d9", '<path d="M26 64a14 14 0 0 1 2-28 20 20 0 0 1 38-2 16 16 0 0 1 4 30z" fill="#f4ecd8"/>'], // nuvem
  ["#e7d4b0", '<path d="M20 44h56l-8 32H28z" fill="#5a3a1a"/><path d="M28 44c0-16 8-26 20-26s20 10 20 26" fill="none" stroke="#5a3a1a" stroke-width="5"/><path d="M34 54v14M48 54v14M62 54v14" stroke="#e7d4b0" stroke-width="3"/>'], // cesta
  ["#1f1a14", '<path d="M14 62h68" stroke="#f4ecd8" stroke-width="5" stroke-linecap="round"/><path d="M22 62a26 26 0 0 1 52 0" fill="#c21f16"/><circle cx="48" cy="30" r="5" fill="#f4ecd8"/>'], // nascer do dia
  ["#d8f0ee", '<circle cx="36" cy="48" r="14" fill="#127a76"/><circle cx="62" cy="48" r="14" fill="none" stroke="#127a76" stroke-width="6"/><path d="M48 48h4" stroke="#127a76" stroke-width="5"/><circle cx="36" cy="48" r="5" fill="#f4c542"/>'], // elos
];

const CAPAS = [
  '<path d="M0 0h1200v400H0z" fill="#1f1a14"/><g stroke="#c21f16" stroke-width="18"><path d="M-50 400 350-50M100 450 500 0M250 500 650 50M400 550 800 100M550 600 950 150M700 650 1100 200M850 700 1250 250"/></g>',
  '<path d="M0 0h1200v400H0z" fill="#f4ecd8"/><g fill="#c21f16" opacity=".85"><circle cx="150" cy="120" r="60"/><circle cx="420" cy="260" r="90"/><circle cx="760" cy="110" r="70"/><circle cx="1010" cy="280" r="100"/></g><g fill="#1f1a14"><circle cx="300" cy="90" r="18"/><circle cx="640" cy="320" r="24"/><circle cx="900" cy="80" r="16"/></g>',
  '<path d="M0 0h1200v400H0z" fill="#2c6e8f"/><path d="M0 220c100-60 200-60 300 0s200 60 300 0 200-60 300 0 200 60 300 0v180H0z" fill="#1f4f6b"/><path d="M0 290c100-60 200-60 300 0s200 60 300 0 200-60 300 0 200 60 300 0v110H0z" fill="#f4c542" opacity=".9"/>',
  '<path d="M0 0h1200v400H0z" fill="#cfe3b4"/><path d="M0 400V300l120-90 100 70 150-140 140 120 120-90 170 130 130-80 270 180z" fill="#2f6b2f"/><path d="M0 400V340l160-60 160 50 200-90 220 90 190-60 270 130z" fill="#1f1a14" opacity=".85"/>',
  '<path d="M0 0h1200v400H0z" fill="#f4c542"/><g stroke="#1f1a14" stroke-width="10" fill="none"><path d="M0 100h1200M0 200h1200M0 300h1200"/><path d="M200 0v400M500 0v400M800 0v400M1100 0v400"/></g><rect x="500" y="100" width="300" height="100" fill="#c21f16"/>',
  '<path d="M0 0h1200v400H0z" fill="#1f2a44"/><g fill="#f4ecd8"><circle cx="120" cy="80" r="4"/><circle cx="320" cy="200" r="3"/><circle cx="520" cy="60" r="5"/><circle cx="760" cy="150" r="3"/><circle cx="980" cy="70" r="4"/><circle cx="1100" cy="260" r="3"/><circle cx="640" cy="320" r="4"/><circle cx="220" cy="320" r="3"/></g><path d="M900 120a70 70 0 1 0 40 110 60 60 0 0 1-40-110z" fill="#f4c542"/>',
  '<path d="M0 0h1200v400H0z" fill="#fad4e0"/><g fill="none" stroke="#c2185b" stroke-width="10"><circle cx="200" cy="200" r="120"/><circle cx="200" cy="200" r="70"/><circle cx="600" cy="200" r="120"/><circle cx="600" cy="200" r="70"/><circle cx="1000" cy="200" r="120"/><circle cx="1000" cy="200" r="70"/></g>',
  '<path d="M0 0h1200v400H0z" fill="#e8d9b5"/><g fill="#1f1a14"><path d="M0 400h1200v-40H0z"/><path d="M100 360V200h60v160zM220 360V120h80v240zM360 360V240h50v120zM460 360V160h90v200zM600 360V260h60v100zM720 360V100h70v260zM850 360V220h90v140zM990 360V180h60v180z"/></g><g fill="#c21f16"><rect x="240" y="150" width="14" height="20"/><rect x="740" y="130" width="14" height="20"/><rect x="480" y="190" width="14" height="20"/></g>',
];

fs.mkdirSync(path.join(raiz, "public/rede/avatares"), { recursive: true });
fs.mkdirSync(path.join(raiz, "public/rede/capas"), { recursive: true });
AVATARES.forEach(([fundo, miolo], i) => {
  const id = `a${String(i + 1).padStart(2, "0")}`;
  fs.writeFileSync(path.join(raiz, `public/rede/avatares/${id}.svg`), `${cabecalho}<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="${fundo}"/>${miolo}</svg>\n`);
});
CAPAS.forEach((miolo, i) => {
  const id = `c${String(i + 1).padStart(2, "0")}`;
  fs.writeFileSync(path.join(raiz, `public/rede/capas/${id}.svg`), `${cabecalho}<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">${miolo}</svg>\n`);
});
console.log(`${AVATARES.length} rostos e ${CAPAS.length} capas gravados em public/rede/.`);
