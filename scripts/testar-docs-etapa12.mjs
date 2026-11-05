// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Etapa 12, pacote docs: confere que os documentos atualizados dizem a verdade sobre o código. Cada caminho, cada
// `npm run`, cada variável de ambiente, cada rotina do GitHub, cada migração e cada componente citado precisa existir; os
// números que o código fixa (limite do rastreio, entradas do mapa do painel) precisam bater; e a lista de pendências do
// Jonathan precisa cobrir o que as fontes dela pedem. Sem rede. Rodar: npm run testar:docs-etapa12
import fs from "node:fs";
import path from "node:path";
import { MAPA } from "../components/painel/estrutura.ts";

const raiz = path.join(import.meta.dirname, "..");
const caminho = (...p) => path.join(raiz, ...p);
const existe = (...p) => fs.existsSync(caminho(...p));
const ler = (...p) => fs.readFileSync(caminho(...p), "utf8");
let ok = 0;
const falhas = [];
const conferir = (nome, cond, detalhe = "") => (cond ? ok++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));

const DOCS = {
  painel: "docs/PAINEL-COMPONENTES.md",
  desenho: "docs/DESENHO-DAS-PAGINAS.md",
  manutencao: "docs/MANUTENCAO.md",
  hospedagem: "docs/HOSPEDAGEM.md",
  pendencias: "docs/plano-2026-11/notas/PENDENCIAS-PARA-O-JONATHAN.md",
};
const texto = {};
for (const [chave, arq] of Object.entries(DOCS)) {
  conferir(`${arq} existe`, existe(arq));
  texto[chave] = existe(arq) ? ler(arq) : "";
}

// A MANUTENCAO tem texto antigo (a Gaveta Aberta cita "repositório da universidade", que é um endereço de fora): as palavras
// só são conferidas no que a Etapa 12 acrescentou (seções 10a e 19 a 22).
function trechosNovosDaManutencao(t) {
  const corte = (de, ate) => {
    const i = t.indexOf(de);
    const j = t.indexOf(ate, i + 1);
    return i < 0 || j < 0 ? "" : t.slice(i, j);
  };
  return `${corte("## 10a.", "## 11.")}\n${corte("## 19.", "## Serviços abertos de fora")}`;
}

// 1. Texto limpo: sem caractere quebrado, sem emoji, sem as palavras que a interface não usa.
for (const [chave, t] of Object.entries(texto)) {
  const arq = DOCS[chave];
  conferir(`${arq}: sem caractere quebrado`, !t.includes("�") && !/Ã[\u0080-¿]/.test(t));
  conferir(`${arq}: sem BOM`, !t.startsWith("﻿"));
  conferir(`${arq}: sem emoji`, !/\p{Emoji_Presentation}/u.test(t));
  const alvo = chave === "manutencao" ? trechosNovosDaManutencao(t) : t;
  const proibidas = alvo.split("\n").filter((l) => /universidade|diploma/i.test(l) && !/nunca|nada de|nem /i.test(l));
  conferir(`${arq}: sem "universidade" nem "diploma" fora da regra que as proíbe`, proibidas.length === 0, proibidas[0]?.slice(0, 80));
}

// 2. Todo `npm run X` e todo `node scripts/...` citado existe.
const pkg = JSON.parse(ler("package.json"));
const scripts = pkg.scripts ?? {};
for (const [chave, t] of Object.entries(texto)) {
  const arq = DOCS[chave];
  const citados = new Set([...t.matchAll(/npm run ([a-z][a-z0-9:-]*)/g)].map((m) => m[1]).filter((s) => !s.endsWith(":")));
  const faltam = [...citados].filter((s) => !scripts[s]);
  conferir(`${arq}: todo "npm run" citado existe`, faltam.length === 0, faltam.join(", "));
  const nodes = new Set([...t.matchAll(/node (scripts\/[\w./-]+\.mjs)/g)].map((m) => m[1]));
  const semArquivo = [...nodes].filter((s) => !existe(s));
  conferir(`${arq}: todo "node scripts/..." citado existe`, semArquivo.length === 0, semArquivo.join(", "));
}

// 3. Todo caminho de arquivo ou pasta entre crases existe (menos o que os documentos dizem que ainda vai ser criado).
const AINDA_NAO_EXISTE = new Set([
  "docs/plano-2026-11/notas/seguranca-producao.md", // a PENDENCIAS diz, com todas as letras, que o arquivo falta (item 1.7)
  "infra/aula-ao-vivo/.env", // o .env nasce na máquina da sala, fora do Git (só existe o .env.exemplo)
  "public/territorios/noizocupa/anuncio.mp4", // o Jonathan coloca o vídeo (item 7.1)
  "public/territorios/coletivo-kamikaze/anuncio.mp4",
  "public/vale-o-escrito/", // recomendação do pacote do Vale o Escrito, ainda não feita (item 3.11)
  "public/epub/", // gerado pelo build (gerar-epub.mjs), não fica no repositório
  "dados/recordings", // pasta dentro da máquina da sala de aula, não do repositório
  "content/escola/quem-foi-lucia-maria.md", // conferido abaixo à parte
]);
const ehCaminho = (s) => /^[\w.[\]-]+(\/[\w.[\]-]*)+$/.test(s) && !/^(https?|www)/.test(s) && !/^\d/.test(s);
const CAMINHOS_DE_FORA = /^(settings|dash\.|cloud\.|supabase\.com|acleddata|api\.|inlabs|alerta\.|brunolemos|netlogoweb|www\.|institutolucia|office@|github\.com|jech\/|ghcr\.io|planalto|ms\/|wiki\/|\.next\/|node_modules|usr\/|opt\/|\/)/;
for (const [chave, t] of Object.entries(texto)) {
  const arq = DOCS[chave];
  const caminhos = new Set([...t.matchAll(/`([^`\s]+)`/g)].map((m) => m[1].replace(/[.,;:)]+$/, "")).filter((s) => ehCaminho(s) && !CAMINHOS_DE_FORA.test(s) && !s.includes("<") && !s.includes("*") && !s.includes("...")));
  const quebrados = [...caminhos].filter((c) => {
    if (AINDA_NAO_EXISTE.has(c)) return false;
    // "sw.js" ou "app/[lang]/x" ou "lucia:..." não são problema; só confere o que começa por pasta do projeto.
    if (!/^(app|components|lib|scripts|docs|content|i18n|styles|public|supabase|infra|e2e|\.github|app-loja|capacitor|proxy)/.test(c)) return false;
    return !existe(c.replace(/\/$/, ""));
  });
  conferir(`${arq}: todo caminho do projeto citado existe`, quebrados.length === 0, quebrados.slice(0, 6).join(", "));
}
conferir("o marcador de Quem foi Lúcia Maria: o arquivo existe", existe("content/escola/quem-foi-lucia-maria.md"));

// 4. Variáveis de ambiente de HOSPEDAGEM: todas existem no código, nas rotinas, nas funções ou na máquina da sala.
const fontes = [];
const andar = (pasta, exts) => {
  if (!fs.existsSync(pasta)) return;
  for (const e of fs.readdirSync(pasta, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next") continue;
    const p = path.join(pasta, e.name);
    if (e.isDirectory()) andar(p, exts);
    else if (exts.some((x) => e.name.endsWith(x))) fontes.push(p);
  }
};
for (const pasta of ["app", "lib", "components", "supabase/functions", ".github", "infra", "scripts"]) andar(caminho(...pasta.split("/")), [".ts", ".tsx", ".mjs", ".js", ".yml", ".sh", ".exemplo", ".md"]);
fontes.push(caminho("next.config.ts"), caminho("proxy.ts"));
const corpo = fontes.filter((f) => fs.existsSync(f) && !f.includes(`${path.sep}scripts${path.sep}testar-`)).map((f) => fs.readFileSync(f, "utf8")).join("\n");
const variaveis = new Set([...texto.hospedagem.matchAll(/`([A-Z][A-Z0-9_]{4,}\*?)`/g)].map((m) => m[1]).filter((v) => /_/.test(v) && !v.endsWith("*")));
// Nomes que são de fora do repositório (painéis dos serviços) ou conceitos, não variáveis lidas por nós.
const DE_FORA = new Set(["NEXT_PUBLIC_RECURSOS_TODOS", "COOLIFY_APP_UUID"]);
const semUso = [...variaveis].filter((v) => !DE_FORA.has(v) && !corpo.includes(v));
conferir("HOSPEDAGEM: toda variável citada aparece no código, nas rotinas, nas funções ou na máquina da sala", semUso.length === 0, semUso.join(", "));
for (const v of ["NEXT_PUBLIC_GALENE_URL", "GALENE_JWT_KEY", "REDE_PREVIA_SEGREDO", "OG_SEGREDO", "NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "PUSH_SEGREDO", "VERCEL_TOKEN_LEITURA", "GITHUB_LEITURA_TOKEN", "CF_TOKEN_CACHE", "CF_ZONE_ID", "VALE_O_ESCRITO"]) {
  conferir(`HOSPEDAGEM cita ${v}`, texto.hospedagem.includes(v));
  conferir(`${v} é lida de verdade`, corpo.includes(v));
}
conferir("HOSPEDAGEM: o aviso sobre a rotina producao.yml é verdadeiro (não repassa GALENE nem VAPID)", !/GALENE|VAPID/.test(ler(".github/workflows/producao.yml")));
conferir("HOSPEDAGEM: portas e tag do Galène batem com a máquina da sala", ["10000", "1194", "galene-1.2.1"].every((x) => texto.hospedagem.includes(x) && (ler("infra/aula-ao-vivo/docker-compose.yml") + ler("infra/aula-ao-vivo/.env.exemplo")).includes(x)));
conferir("HOSPEDAGEM: token da sala de 90 segundos", /90 segundos/.test(texto.hospedagem) && /90/.test(ler("lib/aula-sala.ts")));
conferir("HOSPEDAGEM: o recurso do Vale o Escrito só liga pelo nome", /vale-o-escrito/.test(texto.hospedagem) && ler("lib/recursos.ts").includes('SO_PELO_NOME: readonly Recurso[] = ["escola", "vale-o-escrito", "rede-v2"]'));

// 5. MANUTENÇÃO: rotinas, migrações, testes e o limite do rastreio.
const rotinas = fs.readdirSync(caminho(".github", "workflows")).filter((f) => f.endsWith(".yml"));
for (const r of rotinas) conferir(`MANUTENCAO cita a rotina ${r}`, texto.manutencao.includes(r.replace(/\.yml$/, "")), "");
for (const m of new Set([...texto.manutencao.matchAll(/`([a-z0-9-]+\.yml)`/g)].map((x) => x[1]))) conferir(`MANUTENCAO: a rotina ${m} existe`, rotinas.includes(m));
const migracoes = fs.readdirSync(caminho("supabase", "migracoes")).filter((f) => f.endsWith(".sql"));
const install = ler("supabase", "install.sql").replace(/\r\n/g, "\n");
for (const m of migracoes) {
  const nome = m.replace(/\.sql$/, "");
  const citada = texto.manutencao.includes(nome) || (nome.startsWith("2026-11-rede-") && texto.manutencao.includes("2026-11-rede-fundacao.sql") && texto.manutencao.includes("2026-11-rede-integracao.sql"));
  conferir(`MANUTENCAO cobre a migração ${m}`, citada);
  conferir(`${m} está inteira no install.sql (como a MANUTENCAO afirma)`, install.includes(ler("supabase", "migracoes", m).replace(/\r\n/g, "\n").trim()));
}
const fnsSupabase = fs.readdirSync(caminho("supabase", "functions")).filter((f) => !f.startsWith("_") && fs.statSync(caminho("supabase", "functions", f)).isDirectory());
for (const f of fnsSupabase) conferir(`MANUTENCAO cita a função do Supabase ${f}`, texto.manutencao.includes(f));
const rastreio = ler("scripts", "conferir-rastreio.mjs");
const limiteTotal = Number(/LIMITE_TOTAL = ([\d_]+)/.exec(rastreio)?.[1].replaceAll("_", ""));
const limiteFuncoes = Number(/LIMITE_FUNCOES_COM_PROJETO = (\d+)/.exec(rastreio)?.[1]);
conferir("MANUTENCAO: o limite de 700 mil arquivos é o do script", limiteTotal === 700000 && texto.manutencao.includes("700 mil arquivos"));
conferir("MANUTENCAO: o limite de 6 funções é o do script", limiteFuncoes === 6 && /mais de 6 funções/.test(texto.manutencao));
conferir("MANUTENCAO explica as regras do rastreio", ["caminho dinâmico", "layout raiz", "dynamic import", "módulo só de textos"].every((x) => texto.manutencao.includes(x)));
conferir("MANUTENCAO e HOSPEDAGEM dão o mesmo número do rastreio (679 mil)", texto.manutencao.includes("679 mil") && texto.hospedagem.includes("679 mil"));
const noCi = ler(".github", "workflows", "ci.yml");
conferir("MANUTENCAO diz que conferir:rastreio roda no CI e roda mesmo", noCi.includes("conferir:rastreio") && /conferir:rastreio.{0,6}\(CI\)/.test(texto.manutencao));
// Todo teste citado como "(CI)" está mesmo no ci.yml, e nenhum teste do ci.yml falta na lista de "(CI)".
const marcadosCi = new Set([...texto.manutencao.matchAll(/`((?:testar|conferir|cobertura|fila|orcamento)[:\w-]*|pendencias)` \(CI\)/g)].map((m) => m[1]));
for (const t of marcadosCi) conferir(`MANUTENCAO marca ${t} como CI e ele está no ci.yml`, noCi.includes(`npm run ${t}`));
const testesDoCi = [...noCi.matchAll(/npm run ((?:testar|conferir|cobertura|fila|orcamento)[:\w-]*|pendencias)\b/g)].map((m) => m[1]).filter((t) => t !== "conferir:i18n" || true);
for (const t of new Set(testesDoCi)) conferir(`o teste ${t}, que o ci.yml roda, aparece na MANUTENCAO`, texto.manutencao.includes(`\`${t}\``) || texto.manutencao.includes(`\`${t.replace(/^testar:/, "")}\``) || texto.manutencao.includes(t));
// Todo script testar:* que a MANUTENCAO cita existe e os principais pacotes de novembro estão todos lá.
for (const t of ["testar:painel-fundacao", "testar:painel-confirms", "testar:controles", "testar:backend-1", "testar:backend-2", "testar:rede-fundacao", "testar:vale-o-escrito", "testar:vale-o-escrito-robo", "testar:jogos-pagina", "testar:territorios", "testar:labs-externos", "testar:app-casca", "testar:app-telas", "testar:app-offline", "testar:app-loja", "testar:aula-ao-vivo", "testar:integracao-5689", "testar:eixos-equipe", "testar:departamentos-termos", "testar:escola-banco"]) {
  conferir(`MANUTENCAO cita ${t}`, texto.manutencao.includes(t.replace(/^testar:/, "")) );
  conferir(`${t} está registrado no package.json`, Boolean(scripts[t]));
}
const naoCitados = Object.keys(scripts).filter((s) => /^testar:/.test(s) && !texto.manutencao.includes(s.replace(/^testar:/, "")));
console.log(`(informativo) testes de package.json sem menção na MANUTENCAO: ${naoCitados.length ? naoCitados.join(", ") : "nenhum"}`);

// 6. PAINEL-COMPONENTES: o que está em ui/ e moldes/ está no catálogo, e os números batem.
const indiceUi = ler("components", "painel", "ui", "index.ts");
const exportados = new Set([...indiceUi.matchAll(/export \{([^}]*)\}/g)].flatMap((m) => m[1].split(",")).map((s) => s.trim().replace(/^type /, "")).filter((s) => /^[A-Za-z]+$/.test(s) && !/^(PropsDoBotao|VarianteDoBotao|OpcoesDeConfirmacao|OpcoesDePergunta|OpcaoDeAba|ComandoDaPaleta|ItemDaPaleta|ColumnDef)$/.test(s)));
for (const e of exportados) conferir(`PAINEL-COMPONENTES cita ${e} (ui/)`, texto.painel.includes(e));
const indiceMoldes = ler("components", "painel", "moldes", "index.ts");
for (const e of new Set([...indiceMoldes.matchAll(/\b(Molde[A-Za-z]+)\b/g)].map((m) => m[1]))) conferir(`PAINEL-COMPONENTES cita ${e}`, texto.painel.includes(e));
for (const arq of ["Botao", "Campo", "Dialogo", "Tabela", "Toast", "Paleta", "Abas", "Vazio", "Esqueleto"]) conferir(`ui/${arq}.tsx existe`, existe("components", "painel", "ui", `${arq}.tsx`));
const entradas = Object.keys(MAPA).length;
conferir("PAINEL-COMPONENTES: o número de entradas do mapa é o de estrutura.ts", texto.painel.includes(`${entradas} entradas`), `estrutura.ts tem ${entradas}`);
const tema = ler("styles", "painel-tema.css");
for (const token of new Set([...texto.painel.matchAll(/`--pn-([a-z-]+)`/g)].map((m) => m[1]))) conferir(`token --pn-${token} existe no tema`, tema.includes(`--pn-${token}`));
for (const cls of ["pn-botao", "pn-campo", "pn-rotulo"]) conferir(`classe ${cls} existe no tema`, tema.includes(`.${cls}`));
const comum = ler("components", "painel", "comum.tsx");
for (const nome of ["campo", "botao", "botaoClaro", "elo", "rotulo", "Aviso", "useLista", "useAcao"]) conferir(`comum.tsx ainda tem ${nome} (PAINEL-COMPONENTES o cita)`, new RegExp(`export (const|function) ${nome}\\b`).test(comum));
conferir("PAINEL-COMPONENTES: Selo (local) e Avatar existem onde o catálogo diz", /function Selo\b/.test(ler("components", "painel", "MinhaConta.tsx")) && existe("components", "painel", "Avatar.tsx"));
conferir("PAINEL-COMPONENTES: Painel.tsx monta os diálogos, os avisos e a paleta", ["<DialogosDoPainel", "<AvisosDoPainel", "<Paleta"].every((x) => ler("components", "painel", "Painel.tsx").includes(x)));
conferir("PAINEL-COMPONENTES: TanStack Table na versão 8", /"@tanstack\/react-table": "\^8/.test(ler("package.json")) && texto.painel.includes("TanStack Table 8"));

// 7. DESENHO DAS PÁGINAS: as peças e as páginas novas existem.
const capa = ler("components", "pagina", "Capa.tsx");
for (const p of ["Capa", "Corpo", "Secao"]) conferir(`Capa.tsx exporta ${p} (DESENHO o descreve)`, new RegExp(`export function ${p}\\b`).test(capa));
for (const tom of ["papel", "preto", "vermelho"]) conferir(`DESENHO descreve o tom ${tom}`, texto.desenho.includes(`\`${tom}\``) && capa.includes(`"${tom}"`));
for (const rota of ["jogos", "vale-o-escrito", "imprensa", "territorios", "comunidade", "laboratorios/externos"]) conferir(`DESENHO cobre a rota ${rota} e ela existe`, texto.desenho.includes(rota) && existe("app", "[lang]", ...rota.split("/")));
for (const sec of ["Jogos", "Vale o Escrito", "Rede v2", "Territórios", "Imprensa", "Laboratórios abertos de fora", "O aplicativo", "O painel"]) conferir(`DESENHO tem a seção "${sec}"`, new RegExp(`^### ${sec}`, "m").test(texto.desenho));
conferir("DESENHO: o Vale o Escrito é a exceção declarada e o CSS está sob .ve", texto.desenho.includes("único lugar do site fora da identidade") && /^\.ve\b/m.test(ler("styles", "vale-o-escrito.css")));
conferir("DESENHO: o layout do Vale o Escrito responde 404 desligado", /notFound\(\)/.test(ler("app", "[lang]", "vale-o-escrito", "layout.tsx")));
conferir("DESENHO: a casca da Rede v2 tem as três colunas citadas", ["250px", "640px", "300px"].every((x) => ler("components", "rede", "Casca.tsx").includes(x) && texto.desenho.includes(x)));
conferir("DESENHO: as cinco abas do aplicativo existem no código", ["inicio", "estudar", "jogos", "comunidade", "eu"].every((a) => ler("components", "app", "modo.ts").includes(a)) && ["Início", "Estudar", "Jogos e labs", "Comunidade", "Eu"].every((n) => texto.desenho.includes(n)));
conferir("DESENHO: o Letreiro e a PaginaDoColetivo existem", existe("components", "territorios", "Letreiro.tsx") && existe("components", "territorios", "PaginaDoColetivo.tsx") && existe("lib", "territorios-identidades.ts"));
conferir("DESENHO: o PageHeading (usado em /imprensa) existe", existe("components", "PageHeading.tsx") && ler("app", "[lang]", "imprensa", "page.tsx").includes("PageHeading"));
conferir("DESENHO manda mudar o rastreio e os seis idiomas", texto.desenho.includes("conferir:rastreio") && ["francês", "russo", "chinês"].every((x) => texto.desenho.includes(x)));

// 8. PENDÊNCIAS: ordem, ids únicos e cobertura das fontes.
const t = texto.pendencias;
const secoes = [...t.matchAll(/^## (\d+)\. /gm)].map((m) => Number(m[1]));
conferir("PENDENCIAS: seções numeradas de 1 a 10 em ordem", secoes.join(",") === "1,2,3,4,5,6,7,8,9,10", secoes.join(","));
const itens = [...t.matchAll(/^- \[[ x]\] \*\*(\d+\.\d+)\b/gm)].map((m) => m[1]);
conferir("PENDENCIAS: ids dos itens únicos", new Set(itens).size === itens.length);
conferir("PENDENCIAS: todo item é uma caixa de marcar", (t.match(/^- \[ \]|^- \[x\]/gm) ?? []).length === itens.length);
let anterior = [0, 0];
let emOrdem = true;
for (const id of itens) {
  const [a, b] = id.split(".").map(Number);
  if (a < anterior[0] || (a === anterior[0] && b !== anterior[1] + 1 && b !== 1)) emOrdem = false;
  anterior = [a, b];
}
conferir("PENDENCIAS: itens em ordem dentro de cada seção", emOrdem);
conferir("PENDENCIAS: pelo menos 60 itens", itens.length >= 60, String(itens.length));
const fontesDasPendencias = ["docs/vale-o-escrito/ESPEC.md", "docs/vale-o-escrito/ROBO.md", "docs/vale-o-escrito/CADASTROS-PARA-O-JONATHAN.md", "docs/rede/V2.md", "docs/rede/AVISOS.md", "docs/plano-2026-11/notas/etapas-5-6-8-9.md", "docs/APP.md", "docs/APP-OFFLINE.md", "docs/APP-LOJA.md", "docs/plano-2026-11/PROGRESSO.md"];
for (const f of fontesDasPendencias) {
  conferir(`PENDENCIAS: a fonte ${f} existe`, existe(f));
  const nomeCurto = path.basename(f);
  conferir(`PENDENCIAS cita ${nomeCurto}`, t.includes(nomeCurto) || t.includes(nomeCurto.replace(/\.md$/, "")));
}
// O que cada fonte pede ao Jonathan precisa aparecer (palavra-chave por pendência de cada documento).
const cobertura = {
  "vale-o-escrito/ESPEC (decisões)": ["curadoria_vale", "condenado em 2ª instância", "48 fontes", "img-src", "13.188", "9.610", "4º, II, a", "BY-ND", "18 casos"],
  "vale-o-escrito (cadastros e robô)": ["Portal da Transparência", "ACLED", "INLABS", "Fogo Cruzado", "MapBiomas", "DataJud", "Querido Diário", "VALE_O_ESCRITO", "GEMINI_API_KEY", "feedConfirmado", "rodada seca"],
  "rede/V2 (antes de ligar)": ["install.sql", "rede-midia", "avaliar-comunidade", "enviar-push", "REDE_PREVIA_SEGREDO", "VAPID", "SEMEAR", "rede_migrar_forum", "15.211", "art. 9º", "Marco Civil", "arts. 28 a 30", "OpenAI", "art. 11", "37 achados", "rascunho marcado"],
  "etapas-5-6-8-9": ["departamentos", "mínimo de 5", "VERCEL_TOKEN_LEITURA", "GITHUB_LEITURA_TOKEN", "CF_TOKEN_CACHE", "porta-voz", "NEXT_PUBLIC_GALENE_URL", "GALENE_JWT_KEY", "NoizOcupa", "Kamikaze", "9.610", "GeoGebra", "Anatomy Atelier", "Coletivo de artes e hip-hop", "TRI", "32 pessoas", "49 cartazes", "conferir:rastreio", "ci.yml"],
  "APP e loja": ["Play", "Capacitor", "TWA", "US$ 25", "pessoa física", "13+", "15.211", "capturas", "gerar:capturas-app", "modo avião", "Pyodide", "1024 × 500", "assetlinks"],
  "PROGRESSO": ["MEI", "87 links", "Quem foi Lúcia Maria", "em revisão", "mutirão", "Traduções", "37 achados"],
};
for (const [grupo, palavras] of Object.entries(cobertura)) for (const p of palavras) conferir(`PENDENCIAS cobre (${grupo}): ${p}`, t.includes(p));
conferir("PENDENCIAS: cita lei com artigo", ["Lei 15.211/2025", "Lei 13.709/2018", "Lei 12.965/2014", "Lei 9.610/1998", "Lei 8.069/1990", "Lei 13.188/2015"].every((x) => t.includes(x)));
conferir("PENDENCIAS: nenhuma chave de verdade escrita (só nomes de variável)", !/(sk-[A-Za-z0-9]{12,}|AIza[0-9A-Za-z_-]{20,}|ghp_[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]{20,}|-----BEGIN)/.test(Object.values(texto).join("\n")));
conferir("PENDENCIAS: cada item da ordem de prioridade do resumo existe", ["Banco", "Pessoas e lei", "Cadastros e segredos", "Ligar, um recurso por vez", "Conteúdo, vídeos e aparelho"].every((x) => t.includes(x)));
// As pendências que o próprio código ainda carrega não podem ter sumido: se o código mudou, a lista precisa mudar.
conferir("PENDENCIAS: o recurso escola continua só pelo nome e a lista diz isso", ler("lib", "recursos.ts").includes('"escola"') && t.includes("`escola`"));
conferir("PENDENCIAS: o calendário da Escola continua proposto (confirmado: false)", /"confirmado":\s*false/.test(ler("content", "escola", "ano-letivo.json")) && t.includes('"confirmado": false'));
conferir("PENDENCIAS: o texto da Lúcia Maria continua pendente (marcador no arquivo)", ler("content", "escola", "quem-foi-lucia-maria.md").includes("[TEXTO A ENVIAR PELA COORDENAÇÃO]") && t.includes("[TEXTO A ENVIAR PELA COORDENAÇÃO]"));
conferir("PENDENCIAS: a exportação do Vale o Escrito não é chamada por nenhuma rotina", !/exportar\.mjs|vale-o-escrito:exportar/.test(ler(".github", "workflows", "vale-o-escrito.yml")) && t.includes("vale-o-escrito:exportar"));

// 9. O teste está registrado.
conferir("script testar:docs-etapa12 registrado no package.json", Boolean(scripts["testar:docs-etapa12"]));

console.log(`docs-etapa12: ${ok} conferências ok, ${falhas.length} falhas.`);
if (falhas.length) {
  for (const f of falhas) console.log(` - ${f}`);
  process.exit(1);
}
