// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As imagens de fora guardadas no DISCO DA VPS, na chegada (P12; supabase/migracoes/20261112-fediverso-midia-guardada.sql).
// A rota-proxy (app/api/fediverso/midia) esconde QUEM vê uma imagem de fora; isto esconde QUANDO. Quando uma nota com imagem chega,
// o banco põe cada imagem numa fila com uma hora sorteada (1 a 15 min). Na rodada do timer da VPS (a rota /api/fediverso/entregar),
// `guardarPendentes` busca as que venceram, com as mesmas travas da rota-proxy (SSRF, bloqueio em cada salto, 8 MB, tipo pelos
// bytes), e grava em `<pasta>/<2 primeiras letras da chave>/<chave>`. A rota-proxy serve a cópia e, enquanto a imagem está na fila,
// não a busca lá fora.
//
// A pasta vem de ALUMIA_FEDIVERSO_MIDIA_DIR (no contêiner, /dados/fed-midia: infra/contabo/atualizar.sh monta
// /var/lib/lucia/fed-midia da VPS ali). Sem ela, nada disto roda e a rota-proxy faz como antes. Só roda no servidor. Sem "@/".
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pedirAoFediverso, urlDoFediverso } from "./http";
import { banco } from "./servidor";

/** O maior tamanho de uma imagem de fora (o mesmo da rota-proxy). */
export const MAIOR_IMAGEM = 8 * 1024 * 1024;
/** O espaço que as imagens podem ocupar na VPS, somado (padrão 20 GB; ALUMIA_FEDIVERSO_MIDIA_TETO_MB muda). */
const tetoEmBytes = () => {
  const mb = Number(process.env.ALUMIA_FEDIVERSO_MIDIA_TETO_MB ?? "");
  return (Number.isFinite(mb) && mb > 0 ? mb : 20_480) * 1024 * 1024;
};
const CHAVE = /^[0-9a-f]{64}$/;

/** A pasta das imagens guardadas; vazio: o recurso está desligado. Lida a cada uso (os testes trocam a variável). */
export const pastaDaMidia = () => (process.env.ALUMIA_FEDIVERSO_MIDIA_DIR ?? "").trim();
export const midiaGuardadaLigada = () => pastaDaMidia() !== "";

/** A chave do arquivo: o SHA-256 do endereço, em hexadecimal (a mesma de interno.rede_fed_midia_chave). */
export const chaveDaMidia = (url: string) => createHash("sha256").update(url, "utf8").digest("hex");

const caminhoDe = (chave: string) => {
  if (!CHAVE.test(chave)) throw new Error("chave_invalida");
  return join(pastaDaMidia(), chave.slice(0, 2), chave);
};

/** O tipo da imagem pelos BYTES (JPG, PNG, WebP, GIF e AVIF; nunca SVG). Nulo: não é imagem que a Alumia serve. */
export function tipoPelosBytes(b: Uint8Array): string | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  const t = (de: number, ate: number) => String.fromCharCode(...b.subarray(de, ate));
  if (t(0, 4) === "RIFF" && t(8, 12) === "WEBP") return "image/webp";
  if (t(0, 4) === "GIF8") return "image/gif";
  if (t(4, 8) === "ftyp" && /^avi[fs]$/.test(t(8, 12))) return "image/avif";
  return null;
}

/** Instância liberada? (falha do banco = não: na dúvida, não busca) */
const liberada = (url: string) => banco<boolean>("bloqueado", { url }).then((b) => !b, () => false);

/** Busca uma imagem de fora com as travas de sempre. Nulo em qualquer dúvida. */
export async function buscarImagemDeFora(url: string): Promise<{ bytes: Uint8Array; tipo: string } | null> {
  if (!urlDoFediverso(url)) return null;
  const r = await pedirAoFediverso(url, {
    binario: true,
    maxBytes: MAIOR_IMAGEM,
    tempoMs: 10_000,
    cabecalhos: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9" },
    // O primeiro endereço e cada redirecionamento: instância bloqueada pela mediação não serve.
    conferirSalto: (u) => liberada(u.href),
  }).catch(() => null);
  if (!r || r.status !== 200 || !r.bytes?.length) return null;
  const tipo = tipoPelosBytes(r.bytes);
  return tipo ? { bytes: r.bytes, tipo } : null;
}

/** A cópia guardada de uma imagem (com o tipo conferido de novo pelos bytes), ou nulo. */
export async function lerGuardada(url: string): Promise<{ bytes: Uint8Array; tipo: string } | null> {
  if (!midiaGuardadaLigada()) return null;
  try {
    const bytes = new Uint8Array(await readFile(caminhoDe(chaveDaMidia(url))));
    const tipo = tipoPelosBytes(bytes);
    return tipo ? { bytes, tipo } : null;
  } catch {
    return null;
  }
}

/** O banco diz se a imagem está na fila: "pendente" quer dizer que a rota-proxy NÃO pode ir buscá-la lá fora agora. */
export async function estadoDaMidia(url: string): Promise<"guardada" | "pendente" | "falhou" | "desconhecida"> {
  const r = await banco<{ estado?: string }>("estado", { chave: chaveDaMidia(url) }, "rede_fed_midia_servidor").catch(() => null);
  const e = r?.estado;
  // Na dúvida (o banco falhou), trata como pendente: não busca fora (a imagem aparece na próxima vez).
  return e === "guardada" || e === "falhou" || e === "desconhecida" ? e : "pendente";
}

async function gravar(chave: string, bytes: Uint8Array): Promise<void> {
  const destino = caminhoDe(chave);
  await mkdir(join(pastaDaMidia(), chave.slice(0, 2)), { recursive: true });
  const parcial = `${destino}.${process.pid}.parcial`;
  await writeFile(parcial, bytes, { mode: 0o640 });
  await rename(parcial, destino);
}

export interface RodadaDaMidia {
  guardadas: number;
  falhas: number;
  apagadas: number;
}

/**
 * Uma rodada: busca as imagens cuja hora chegou (até `limite`) e grava; depois a faxina apaga os arquivos que o banco tirou do
 * registro. Para quando passa de `tempoMs` (a rota de entrega tem 60 s no total). Nunca lança.
 */
export async function guardarPendentes(limite = 10, tempoMs = 20_000): Promise<RodadaDaMidia> {
  const r: RodadaDaMidia = { guardadas: 0, falhas: 0, apagadas: 0 };
  if (!midiaGuardadaLigada()) return r;
  const inicio = Date.now();
  try {
    const pendentes = await banco<{ chave: string; url: string }[]>("pendentes", { limite, teto_bytes: tetoEmBytes() }, "rede_fed_midia_servidor");
    for (const p of Array.isArray(pendentes) ? pendentes : []) {
      if (Date.now() - inicio > tempoMs) break;
      if (!p || !CHAVE.test(p.chave) || chaveDaMidia(p.url) !== p.chave) continue;
      const imagem = await buscarImagemDeFora(p.url);
      let ok = false;
      if (imagem) {
        try {
          await gravar(p.chave, imagem.bytes);
          ok = true;
        } catch {
          ok = false;
        }
      }
      await banco("guardada", { chave: p.chave, ok, bytes: imagem?.bytes.length ?? null }, "rede_fed_midia_servidor").catch(() => null);
      if (ok) r.guardadas++;
      else r.falhas++;
    }
    const vencidas = await banco<string[]>("faxina", { limite: 50 }, "rede_fed_midia_servidor").catch(() => []);
    for (const chave of Array.isArray(vencidas) ? vencidas : []) {
      if (typeof chave !== "string" || !CHAVE.test(chave)) continue;
      await rm(caminhoDe(chave), { force: true }).catch(() => undefined);
      r.apagadas++;
    }
  } catch {
    // o banco falhou: a próxima rodada tenta de novo
  }
  return r;
}
