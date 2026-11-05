// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Lê UM arquivo de dentro de um .zip remoto usando só requisições com "Range" (sem baixar o zip inteiro).
import zlib from "node:zlib";

const UA = { "User-Agent": "Mozilla/5.0 (InstitutoLucia-gerar-parametros-tri)" };

async function faixa(url, ini, fim) {
  for (let t = 0; t < 4; t++) {
    try {
      const r = await fetch(url, { headers: { ...UA, Range: `bytes=${ini}-${fim}` } });
      if (r.status !== 206 && r.status !== 200) throw new Error("HTTP " + r.status);
      return Buffer.from(await r.arrayBuffer());
    } catch (e) {
      if (t === 3) throw e;
      await new Promise((ok) => setTimeout(ok, 1500 * (t + 1)));
    }
  }
}

/** Lista as entradas (nome, tamanho, deslocamento) da central de diretório do zip remoto. */
export async function listarZip(url) {
  const h = await fetch(url, { method: "HEAD", headers: UA });
  const total = Number(h.headers.get("content-length"));
  const cauda = await faixa(url, Math.max(0, total - 70000), total - 1);
  let eocd = -1;
  for (let i = cauda.length - 22; i >= 0; i--) if (cauda.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("fim do zip não encontrado");
  let tamCD = cauda.readUInt32LE(eocd + 12);
  let offCD = cauda.readUInt32LE(eocd + 16);
  let n = cauda.readUInt16LE(eocd + 10);
  if (offCD === 0xffffffff || n === 0xffff) {
    // zip64
    let loc = -1;
    for (let i = eocd - 20; i >= 0; i--) if (cauda.readUInt32LE(i) === 0x07064b50) { loc = i; break; }
    const off64 = Number(cauda.readBigUInt64LE(loc + 8));
    const r = await faixa(url, off64, off64 + 55);
    n = Number(r.readBigUInt64LE(32));
    tamCD = Number(r.readBigUInt64LE(40));
    offCD = Number(r.readBigUInt64LE(48));
  }
  const cd = await faixa(url, offCD, offCD + tamCD - 1);
  const entradas = [];
  let p = 0;
  while (p + 46 <= cd.length && cd.readUInt32LE(p) === 0x02014b50) {
    const metodo = cd.readUInt16LE(p + 10);
    let tamC = cd.readUInt32LE(p + 20);
    let tamU = cd.readUInt32LE(p + 24);
    const nl = cd.readUInt16LE(p + 28), el = cd.readUInt16LE(p + 30), cl = cd.readUInt16LE(p + 32);
    let off = cd.readUInt32LE(p + 42);
    const nome = cd.toString("utf8", p + 46, p + 46 + nl);
    if (tamC === 0xffffffff || tamU === 0xffffffff || off === 0xffffffff) {
      let q = p + 46 + nl; const fimE = q + el;
      while (q + 4 <= fimE) {
        const id = cd.readUInt16LE(q), sz = cd.readUInt16LE(q + 2);
        if (id === 1) {
          let k = q + 4;
          if (tamU === 0xffffffff) { tamU = Number(cd.readBigUInt64LE(k)); k += 8; }
          if (tamC === 0xffffffff) { tamC = Number(cd.readBigUInt64LE(k)); k += 8; }
          if (off === 0xffffffff) { off = Number(cd.readBigUInt64LE(k)); k += 8; }
        }
        q += 4 + sz;
      }
    }
    entradas.push({ nome, metodo, tamC, tamU, off });
    p += 46 + nl + el + cl;
  }
  return entradas;
}

/** Baixa e descompacta uma entrada. */
export async function extrairEntrada(url, e) {
  const cab = await faixa(url, e.off, e.off + 29);
  const nl = cab.readUInt16LE(26), el = cab.readUInt16LE(28);
  const ini = e.off + 30 + nl + el;
  const dados = await faixa(url, ini, ini + e.tamC - 1);
  return e.metodo === 0 ? dados : zlib.inflateRawSync(dados);
}
