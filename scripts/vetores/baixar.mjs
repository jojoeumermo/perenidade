// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Baixa os vetores oficiais listados em scripts/vetores/fontes.json (fonte oficial, commit fixo) e confere o sha256 de cada um antes
// de entregar. Guarda numa pasta temporária fora do repositório (ALUMIA_VETORES_DIR, ou a pasta temporária do sistema): os arquivos
// não vão para o git. Arquivo com resumo diferente é apagado e o teste falha (nada de seguir com vetor adulterado).
// Uso: node scripts/vetores/baixar.mjs   (ou import { vetores } from "./vetores/baixar.mjs")
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const fontes = JSON.parse(fs.readFileSync(path.join(aqui, "fontes.json"), "utf8"));
export const PASTA = process.env.ALUMIA_VETORES_DIR || path.join(os.tmpdir(), "alumia-vetores");

const resumo = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** O caminho de um vetor já conferido (baixa se não estiver na pasta, ou se estiver com outro resumo). */
export async function vetor(nome) {
  const f = fontes.arquivos.find((a) => a.nome === nome);
  if (!f) throw new Error(`vetor fora da lista: ${nome}`);
  if (!/^https:\/\/(raw\.githubusercontent\.com|www\.rfc-editor\.org)\//.test(f.url)) throw new Error(`fonte não oficial: ${f.url}`);
  const destino = path.join(PASTA, ...f.nome.split("/"));
  if (fs.existsSync(destino) && resumo(fs.readFileSync(destino)) === f.sha256) return destino;
  const resposta = await fetch(f.url, { redirect: "error" });
  if (!resposta.ok) throw new Error(`não baixou ${f.nome}: ${resposta.status}`);
  const bytes = Buffer.from(await resposta.arrayBuffer());
  const r = resumo(bytes);
  if (r !== f.sha256) throw new Error(`resumo diferente em ${f.nome}: ${r} (esperado ${f.sha256})`);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, bytes);
  return destino;
}

export const lerJson = async (nome) => JSON.parse(fs.readFileSync(await vetor(nome), "utf8"));
export const lerTexto = async (nome) => fs.readFileSync(await vetor(nome), "utf8");
export const listaDeFontes = () => fontes.arquivos.map((a) => ({ ...a }));

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const a of fontes.arquivos) console.log(`${a.nome}: ${await vetor(a.nome)}`);
}
