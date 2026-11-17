// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A página "index.html" que vai dentro do .zip de "Meus dados": o mesmo conteúdo do meus-dados.json, de um jeito fácil de ler,
// num arquivo só, sem script e sem nada buscado na internet (a folha de estilo vai dentro; as imagens são as da pasta midias do
// próprio .zip). Claro e escuro pela preferência do aparelho. Tudo o que vem do banco passa por `escapar`. Função pura (o teste
// e o servidor usam). Sem "@/" de propósito.
import type { TextosDeMeusDados } from "./textos";
import { encher } from "./textos";

export interface ArquivoListado {
  /** O caminho no depósito ("<conta>/<id>.webp"). */
  caminho: string;
  /** Onde ficou dentro do .zip ("midias/rede-midia/<id>.webp"), se veio o arquivo. */
  local?: string;
  /** O endereço temporário, se o arquivo não coube no .zip. */
  link?: string;
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapar = (texto: string): string => texto.replace(/[&<>"']/g, (c) => ESCAPES[c]);

// Os números de outras pessoas com o piso de 3: nulo quer dizer "menos de 3".
const COM_PISO = new Set(["quantos", "apoios", "reacoes", "respostas_de_outras_pessoas", "assinaturas", "perguntas_recebidas", "seguidores_de_fora"]);
const IMAGEM_EMBUTIDA = /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/;
const DATA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function valor(chave: string, v: unknown, t: TextosDeMeusDados["arquivo"], lang: string): string {
  if (v === null || v === undefined) return COM_PISO.has(chave) ? `<span class="piso">${escapar(t.menosDeTres)}</span>` : "—";
  if (typeof v === "boolean") return v ? "✓" : "—";
  if (typeof v === "number") return escapar(v.toLocaleString(lang));
  if (typeof v === "string") {
    if (IMAGEM_EMBUTIDA.test(v) && v.length < 300_000) return `<img class="embutida" alt="" src="${v}">`;
    if (DATA.test(v)) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return `<time datetime="${escapar(v)}">${escapar(d.toLocaleString(lang))}</time>`;
    }
    return escapar(v.length > 4000 ? `${v.slice(0, 4000)}…` : v);
  }
  if (Array.isArray(v) && v.every((x) => typeof x !== "object" || x === null)) return escapar(v.map((x) => String(x ?? "—")).join(", ")) || "—";
  const json = JSON.stringify(v, null, 1);
  return `<code>${escapar(json.length > 1200 ? `${json.slice(0, 1200)}…` : json)}</code>`;
}

function tabela(linhas: Record<string, unknown>[], t: TextosDeMeusDados["arquivo"], lang: string): string {
  const colunas: string[] = [];
  for (const l of linhas) for (const k of Object.keys(l)) if (!colunas.includes(k)) colunas.push(k);
  const cabeca = colunas.map((c) => `<th scope="col">${escapar(c.replace(/_/g, " "))}</th>`).join("");
  const corpo = linhas.map((l) => `<tr>${colunas.map((c) => `<td>${valor(c, l[c], t, lang)}</td>`).join("")}</tr>`).join("");
  return `<div class="rolagem"><table><thead><tr>${cabeca}</tr></thead><tbody>${corpo}</tbody></table></div>`;
}

function ficha(objeto: Record<string, unknown>, t: TextosDeMeusDados["arquivo"], lang: string): string {
  const itens = Object.entries(objeto).map(([k, v]) => `<div><dt>${escapar(k.replace(/_/g, " "))}</dt><dd>${valor(k, v, t, lang)}</dd></div>`).join("");
  return `<dl class="ficha">${itens}</dl>`;
}

function parte(v: unknown, t: TextosDeMeusDados["arquivo"], lang: string): string {
  if (v === null || v === undefined) return `<p class="vazio">${escapar(t.vazio)}</p>`;
  if (typeof v === "string") return `<p>${escapar(v)}</p>`;
  if (Array.isArray(v)) {
    if (v.length === 0) return `<p class="vazio">${escapar(t.vazio)}</p>`;
    if (v.every((x) => x && typeof x === "object" && !Array.isArray(x))) return tabela(v as Record<string, unknown>[], t, lang);
    return `<p>${valor("", v, t, lang)}</p>`;
  }
  if (typeof v === "object") return ficha(v as Record<string, unknown>, t, lang);
  return `<p>${valor("", v, t, lang)}</p>`;
}

const ESTILO = `
:root{color-scheme:light dark;--fundo:#f3efe6;--cartao:#fbf8f2;--linha:#d5cdbf;--texto:#0f0e0d;--texto2:#5c554d;--vermelho:#bc2217;--ouro:#7a5800}
@media (prefers-color-scheme:dark){:root{--fundo:#0f0e0d;--cartao:#1b1917;--linha:#2a2622;--texto:#f3efe6;--texto2:#a9a29a;--vermelho:#e8321f;--ouro:#ffc21a}}
*{box-sizing:border-box}body{margin:0;background:var(--fundo);color:var(--texto);font:16px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.faixa{height:6px;background:linear-gradient(to right,#c21f16 0 16.667%,#f0b323 16.667% 23.333%,#23408e 23.333% 33.333%,#f3efe6 33.333% 36.667%,#2e6b4f 36.667% 50%,#e4577f 50% 56.667%,#ea7a24 56.667% 66.667%,#0f0e0d 66.667% 70%,#1f8a85 70% 80%,#f0b323 80% 86.667%,#c21f16 86.667% 100%)}
main{max-width:1180px;margin:0 auto;padding:32px 16px 64px}
h1,h2{font-family:"Archivo Narrow","Arial Narrow",ui-sans-serif,sans-serif;font-stretch:condensed;text-transform:uppercase;letter-spacing:-.01em;line-height:.95;margin:0}
h1{font-size:clamp(2.2rem,5vw,3.6rem);font-weight:800}h2{font-size:1.5rem;font-weight:800}
.sobre{color:var(--texto2);max-width:72ch}.carimbo{display:inline-block;border:2px solid var(--vermelho);color:var(--vermelho);border-radius:6px;padding:.1em .5em;transform:rotate(-3deg);font-weight:800;text-transform:uppercase;font-size:.8rem;margin-bottom:12px}
nav{display:flex;flex-wrap:wrap;gap:6px;margin:24px 0}nav a{color:var(--texto);border:1px solid var(--linha);border-radius:999px;padding:2px 10px;font-size:.85rem;text-decoration:none}nav a:hover{border-color:var(--vermelho)}
section{background:var(--cartao);border:1px solid var(--linha);border-radius:14px;padding:20px;margin:16px 0}
section h2{display:flex;justify-content:space-between;gap:12px;align-items:baseline;margin-bottom:12px}section h2 small{font-family:ui-sans-serif,system-ui,sans-serif;text-transform:none;font-weight:600;font-size:.85rem;color:var(--texto2)}
.rolagem{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:.9rem}th,td{text-align:left;vertical-align:top;padding:6px 8px;border-bottom:1px solid var(--linha)}th{color:var(--texto2);font-weight:700;white-space:nowrap}td{max-width:46ch;overflow-wrap:anywhere}
.ficha{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px 24px;margin:0}.ficha dt{color:var(--texto2);font-size:.8rem;font-weight:700;text-transform:uppercase}.ficha dd{margin:0;overflow-wrap:anywhere}
code{font-size:.8rem;white-space:pre-wrap;overflow-wrap:anywhere}.vazio{color:var(--texto2)}.piso{color:var(--ouro);font-weight:700}
.midias{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;list-style:none;padding:0;margin:0}.midias li{border:1px solid var(--linha);border-radius:10px;padding:8px;font-size:.8rem;overflow-wrap:anywhere}.midias img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;display:block;margin-bottom:6px}
img.embutida{max-width:96px;border-radius:8px;display:block}a{color:var(--vermelho)}
`;

/** Monta a página. `dados` é o que o banco devolveu (rede_meusdados_exportar); `linhas`, o que veio deste aparelho. */
export function montarIndice(dados: Record<string, unknown>, t: TextosDeMeusDados["arquivo"], opcoes: { lang: string; arquivos: ArquivoListado[]; linhas?: unknown }): string {
  const lang = opcoes.lang;
  const ignorar = new Set(["formato", "gerado_em", "midias"]);
  const secoes: { id: string; titulo: string; html: string; n?: number }[] = [];
  for (const [chave, v] of Object.entries(dados)) {
    if (ignorar.has(chave)) continue;
    const titulo = (t.secoes as Record<string, string>)[chave] ?? chave.replace(/_/g, " ");
    secoes.push({ id: chave, titulo, html: parte(v, t, lang), n: Array.isArray(v) ? v.length : undefined });
  }
  if (Array.isArray(opcoes.linhas) && opcoes.linhas.length > 0) {
    secoes.push({ id: "linhas", titulo: `${t.secoes.linhas} · ${t.aparelho}`, html: parte(opcoes.linhas, t, lang), n: opcoes.linhas.length });
  }
  if (opcoes.arquivos.length > 0) {
    const itens = opcoes.arquivos
      .map((a) => {
        const nome = escapar(a.caminho.split("/").pop() ?? a.caminho);
        if (a.local) {
          const img = /\.(webp|png|jpe?g)$/i.test(a.local) ? `<img alt="" loading="lazy" src="${escapar(a.local)}">` : "";
          return `<li>${img}<a href="${escapar(a.local)}">${nome}</a><br>${escapar(t.arquivoNoZip)}</li>`;
        }
        return `<li>${nome}<br>${a.link ? `<a href="${escapar(a.link)}" rel="noreferrer">${escapar(t.arquivoLink)}</a>` : "—"}</li>`;
      })
      .join("");
    secoes.push({ id: "arquivos", titulo: t.arquivos, html: `<ul class="midias">${itens}</ul>`, n: opcoes.arquivos.length });
  }
  const gerado = typeof dados.gerado_em === "string" ? new Date(dados.gerado_em) : new Date();
  const indice = secoes.map((s) => `<a href="#${escapar(s.id)}">${escapar(s.titulo)}</a>`).join("");
  const corpo = secoes
    .map((s) => `<section id="${escapar(s.id)}"><h2>${escapar(s.titulo)}${s.n !== undefined ? ` <small>${s.n.toLocaleString(lang)}</small>` : ""}</h2>${s.html}</section>`)
    .join("\n");
  return `<!doctype html>
<html lang="${escapar(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data: file:; style-src 'unsafe-inline'">
<title>${escapar(t.titulo)}</title>
<style>${ESTILO}</style>
</head>
<body>
<div class="faixa" aria-hidden="true"></div>
<main>
<span class="carimbo">Alumia</span>
<h1>${escapar(t.titulo)}</h1>
<p class="sobre">${escapar(encher(t.gerado, { quando: gerado.toLocaleString(lang) }))}</p>
<p class="sobre">${escapar(t.comoLer)}</p>
<p class="sobre">${escapar(t.terceiros)}</p>
<nav>${indice}</nav>
${corpo}
</main>
</body>
</html>
`;
}
