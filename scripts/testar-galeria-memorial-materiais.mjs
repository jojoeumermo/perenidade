// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere a Etapa 6 (B36, B37, B38): galeria com ~150 cartazes, todos com crédito e fonte; memorial sem Tiradentes, com a
// grade fechada (múltiplo de 5, as 5 colunas do site) e crédito de licença em toda foto; materiais para imprimir com
// 21 peças (múltiplo de 3 colunas) e as duas novas.
// Uso: npm run testar:galeria-memorial-materiais
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let ok = 0;
const falhas = [];
const conferir = (nome, cond, detalhe = "") => (cond ? ok++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
const existe = (p) => fs.existsSync(path.join(raiz, "public", p.replace(/^\//, "")));

// ───────────── B36: galeria ─────────────
const galeria = JSON.parse(fs.readFileSync(path.join(raiz, "content", "galeria.json"), "utf8"));
conferir("galeria tem pelo menos 148 peças", galeria.length >= 148, String(galeria.length));
conferir("galeria não passa de 160 peças", galeria.length <= 160, String(galeria.length));
conferir("slugs únicos", new Set(galeria.map((p) => p.slug)).size === galeria.length);
conferir("fontes únicas", new Set(galeria.map((p) => p.fonte)).size === galeria.length);
for (const p of galeria) {
  conferir(`galeria ${p.slug}: título, autor (ou "Autor não creditado"), ano, lugar e texto`, [p.titulo, p.autor, p.ano, p.lugar, p.texto].every((x) => typeof x === "string" && x.trim()));
  conferir(`galeria ${p.slug}: fonte no Wikimedia Commons`, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(p.fonte));
  conferir(`galeria ${p.slug}: imagem no lugar certo e existente`, /^\/imagens\/galeria\/[a-z0-9-]+\.webp$/.test(p.imagem) && existe(p.imagem));
  conferir(`galeria ${p.slug}: largura e altura`, Number.isInteger(p.largura) && Number.isInteger(p.altura) && p.largura > 0 && p.altura > 0);
}
const arquivosGaleria = fs.readdirSync(path.join(raiz, "public/imagens/galeria")).filter((f) => f.endsWith(".webp"));
conferir("toda imagem da pasta da galeria tem peça (crédito em toda imagem)", arquivosGaleria.every((f) => galeria.some((p) => p.imagem.endsWith(`/${f}`))), arquivosGaleria.filter((f) => !galeria.some((p) => p.imagem.endsWith(`/${f}`))).join(", "));

// ───────────── B37: memorial ─────────────
const dirMem = path.join(raiz, "content", "memorial");
const originais = fs.readdirSync(dirMem).filter((f) => f.endsWith(".md") && !/\.(en|es|fr|ru|zh)\.md$/.test(f));
conferir("sem Tiradentes no memorial (arquivo)", !fs.readdirSync(dirMem).some((f) => /tiradentes/i.test(f)));
conferir("sem Tiradentes no memorial (foto)", !fs.existsSync(path.join(raiz, "public/imagens/memorial/tiradentes.webp")));
conferir("sem link para #tiradentes do memorial", !fs.readFileSync(path.join(raiz, "content/linha-do-tempo.json"), "utf8").includes("memorial#tiradentes"));
conferir("grade do memorial fechada (múltiplo de 5)", originais.length % 5 === 0, String(originais.length));
conferir("as duas pessoas novas existem", ["jose-do-patrocinio.md", "dom-helder-camara.md"].every((f) => originais.includes(f)));
let comFoto = 0;
for (const f of originais) {
  const t = fs.readFileSync(path.join(dirMem, f), "utf8");
  conferir(`memorial ${f}: sem a palavra Tiradentes no nome`, !/^nome:.*tiradentes/im.test(t));
  const foto = t.match(/^foto:\s*"([^"]+)"/m)?.[1];
  if (!foto) continue;
  comFoto++;
  const cred = t.match(/^foto_credito:\s*"([^"]+)"/m)?.[1] ?? "";
  const fonte = t.match(/^foto_fonte:\s*"([^"]+)"/m)?.[1] ?? "";
  conferir(`memorial ${f}: foto existe`, existe(foto));
  conferir(`memorial ${f}: crédito com licença (domínio público, CC0 ou CC BY)`, /Domínio público|CC0|CC BY/.test(cred), cred);
  conferir(`memorial ${f}: fonte no Wikimedia Commons`, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(fonte));
}
conferir("memorial tem pelo menos 77 fotos (66 de antes, sem Tiradentes, mais as novas)", comFoto >= 77, String(comFoto));
const fotosMem = fs.readdirSync(path.join(raiz, "public/imagens/memorial")).filter((f) => f.endsWith(".webp"));
conferir("toda foto do memorial é usada por alguém", fotosMem.every((f) => originais.some((o) => fs.readFileSync(path.join(dirMem, o), "utf8").includes(`/imagens/memorial/${f}"`))), fotosMem.filter((f) => !originais.some((o) => fs.readFileSync(path.join(dirMem, o), "utf8").includes(`/imagens/memorial/${f}"`))).join(", "));

// ───────────── B38: materiais ─────────────
const kit = fs.readFileSync(path.join(raiz, "components/governanca/KitDeDivulgacao.tsx"), "utf8");
const bloco = kit.slice(kit.indexOf("const PECAS"), kit.indexOf("const MODOS"));
const pecas = [...bloco.matchAll(/\{ id: "([a-z0-9-]+)",/g)].map((m) => m[1]);
conferir("21 peças no kit (3 colunas, sem lacuna)", pecas.length === 21 && pecas.length % 3 === 0, String(pecas.length));
conferir("as duas peças novas estão no kit", pecas.includes("biblioteca") && pecas.includes("quadro"));
conferir("as duas peças novas são desenhadas", kit.includes("function Biblioteca(") && kit.includes("function QuadroDaSemana("));
conferir("toda peça tem desenho no kit", pecas.every((id) => kit.includes(`peca === "${id}"`)), pecas.filter((id) => !kit.includes(`peca === "${id}"`)).join(", "));
conferir("moldura construtivista no kit", kit.includes("function Moldura("));
conferir("sem a identidade dos adinkras no kit", !/adinkra/i.test(kit));
conferir("sem as palavras proibidas na interface do kit", !/universidade|diploma/i.test(kit));

console.log(`${ok} conferências passaram.`);
if (falhas.length) {
  console.error(`${falhas.length} falha(s):\n- ${falhas.join("\n- ")}`);
  process.exit(1);
}
