// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// A lista de vozes falsa dos testes do "Ouvir a aula": uma voz "teste" que baixa dois arquivos pequenos do site.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const raiz = path.resolve(__dirname, "..");

function arquivo(publicado: string) {
  const b = fs.readFileSync(path.join(raiz, "public", publicado));
  return { url: publicado, bytes: b.length, sha256: createHash("sha256").update(b).digest("hex") };
}

export function listaFalsa() {
  const a = arquivo("/workers/voz-motor.js");
  const b = arquivo("/workers/voz.js");
  return {
    formato: 1,
    ort: { versao: "0", wasm: { js: "/x.js", pasta: "/", wasm: a }, webgpu: { js: "/x.js", pasta: "/", wasm: a } },
    fonemas: { js: "/x.js", wasm: a, dados: b },
    vozes: [{ id: "teste-f", motor: "teste", numero: 1, genero: "f", webgpu: false, espeak: "pt-br", modelo: "Voz de teste", licenca: "AGPL-3.0", amostra: null, bytes: a.bytes + b.bytes, arquivos: [{ ...a, papel: "modelo" }, { ...b, papel: "estilo" }] }],
  };
}

