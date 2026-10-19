// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os editores do Estúdio de prática (PhotoCraft, FilmCraft e EffectCraft, do projeto ArtCraft; Blockbench, SculptGL e o
// editor do three.js para 3D): código aberto, hospedados SEM modificação num endereço separado (estudio.institutolucia.org),
// para que o código deles não alcance os cookies, a sessão do painel nem as chaves do banco. O aluno não sai do site: as
// páginas /estudio-de-pratica/abrir/<editor> mostram o programa dentro do institutolucia.org, num quadro de outra origem. A versão fica fixa aqui e em scripts/editores.mjs; trocar de
// versão é manual (veja docs/ESTUDIO-EDITORES.md). Enquanto o endereço não estiver no ar, o painel diz isso e oferece
// só o que funciona sem ele (baixar o PSD).

export interface EditorAvancado {
  id: "photocraft" | "filmcraft" | "effectcraft" | "lightcraft" | "blockbench" | "sculptgl" | "threejs";
  nome: string;
  repositorio: string;
  versao: string;
  /** Tamanho do pacote web oficial, em MB (o que o navegador baixa na primeira vez). */
  mb: number;
  licenca: string;
  estilo: string;
  /** Caminho dentro do estúdio, quando o programa não abre na raiz da própria pasta. */
  caminho?: string;
  /** Programa só de computador (não roda no navegador): a página aponta para o download oficial. */
  baixar?: string;
}

export const EDITORES: EditorAvancado[] = [
  { id: "photocraft", nome: "PhotoCraft", repositorio: "https://github.com/storytold/photocraft", versao: "0.10.0", mb: 10, licenca: "MIT ou Apache-2.0", estilo: "Photoshop" },
  { id: "filmcraft", nome: "FilmCraft", repositorio: "https://github.com/storytold/filmcraft", versao: "0.9.0", mb: 12, licenca: "Apache-2.0", estilo: "Premiere" },
  { id: "effectcraft", nome: "EffectCraft", repositorio: "https://github.com/storytold/effectcraft", versao: "0.11.1", mb: 18, licenca: "Apache-2.0", estilo: "After Effects" },
  { id: "lightcraft", nome: "LightCraft", repositorio: "https://github.com/storytold/lightcraft", versao: "0.9.1", mb: 105, licenca: "Apache-2.0", estilo: "Lightroom", baixar: "https://github.com/storytold/lightcraft/releases/tag/v0.9.1" },
  { id: "blockbench", nome: "Blockbench", repositorio: "https://github.com/JannisX11/blockbench", versao: "5.2.2", mb: 10, licenca: "GPL-3.0", estilo: "Blender (low-poly)" },
  { id: "sculptgl", nome: "SculptGL", repositorio: "https://github.com/stephomi/sculptgl", versao: "0.9.0", mb: 5, licenca: "MIT", estilo: "ZBrush" },
  { id: "threejs", nome: "Editor do three.js", repositorio: "https://github.com/mrdoob/three.js", versao: "r186", mb: 9, licenca: "MIT", estilo: "cena 3D", caminho: "threejs/editor/" },
];

/** Que programas cada disciplina tem no Estúdio de prática, na ordem dos cartões. */
export const ESTUDIOS = {
  "edicao-de-video": ["filmcraft", "effectcraft"],
  "edicao-de-foto": ["photocraft", "lightcraft"],
  "modelagem-3d": ["blockbench", "sculptgl", "threejs"],
} as const satisfies Record<string, readonly EditorAvancado["id"][]>;
export type AreaDoEstudio = keyof typeof ESTUDIOS;
export const temEstudio = (area: string): area is AreaDoEstudio => area in ESTUDIOS;
export const editor = (id: string) => EDITORES.find((e) => e.id === id);

/** O endereço do estúdio separado (sem barra no fim). Vazio: ainda não está no ar. */
export const ESTUDIO_URL = (process.env.NEXT_PUBLIC_ESTUDIO_URL ?? "").replace(/\/$/, "");

export const enderecoDo = (id: EditorAvancado["id"]) => (ESTUDIO_URL ? `${ESTUDIO_URL}/${editor(id)?.caminho ?? `${id}/`}` : "");

export interface Compatibilidade {
  webgpu: boolean;
  wasm: boolean;
  isolamento: boolean;
  /** Memória do aparelho em GB, quando o navegador informa (Chrome e Edge). */
  memoria: number | null;
  navegador: string;
}

/** O que o navegador oferece, em palavras simples, antes de abrir um editor avançado. */
export async function conferirCompatibilidade(): Promise<Compatibilidade> {
  const nav = navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> }; deviceMemory?: number; userAgentData?: { brands?: { brand: string }[] } };
  let webgpu = false;
  try {
    webgpu = Boolean(nav.gpu && (await nav.gpu.requestAdapter()));
  } catch {
    webgpu = false;
  }
  const ua = navigator.userAgent;
  const navegador = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "outro";
  return { webgpu, wasm: typeof WebAssembly === "object", isolamento: typeof SharedArrayBuffer === "function", memoria: typeof nav.deviceMemory === "number" ? nav.deviceMemory : null, navegador };
}

/** Filmes abertos da Blender Foundation: licença e crédito conferidos nas páginas oficiais de cada projeto. */
export const FILMES = [
  { titulo: "Big Buck Bunny", ano: 2008, licenca: "CC BY 3.0", credito: "(c) copyright 2008, Blender Foundation / www.bigbuckbunny.org", pagina: "https://peach.blender.org/download/" },
  { titulo: "Elephants Dream", ano: 2006, licenca: "CC BY 2.5", credito: "(c) copyright 2006, Blender Foundation / Netherlands Media Art Institute / www.elephantsdream.org", pagina: "https://orange.blender.org/download/" },
  { titulo: "Sintel", ano: 2010, licenca: "CC BY 3.0", credito: "(c) copyright Blender Foundation | durian.blender.org", pagina: "https://durian.blender.org/download/" },
  { titulo: "Tears of Steel", ano: 2012, licenca: "CC BY 3.0", credito: "(CC) Blender Foundation | mango.blender.org", pagina: "https://mango.blender.org/download/" },
];
