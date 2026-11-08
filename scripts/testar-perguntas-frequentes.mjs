// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Confere as perguntas frequentes do botão "?" (content/perguntas-frequentes.json, lib/perguntas-frequentes.ts e
// components/assistente): os 6 idiomas completos, cada link apontando para uma página que existe em app/[lang], o filtro
// local (sem acento, sem diferenciar maiúsculas) e a janela sem IA e sem pedido a servidor.
// Uso: npm run testar:perguntas-frequentes
import { existsSync, readFileSync } from "node:fs";
import { filtrarPerguntas, normalizar } from "../lib/perguntas-frequentes.ts";

let certos = 0;
const falhas = [];
function confere(nome, ok) {
  if (ok) certos++;
  else falhas.push(nome);
}

const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"];
const ler = (caminho) => readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");
const { itens } = JSON.parse(ler("content/perguntas-frequentes.json"));
const recursos = ler("lib/recursos.ts");

// ── Os dados ──
confere("entre 20 e 35 itens", itens.length >= 20 && itens.length <= 35);
confere("ids únicos", new Set(itens.map((i) => i.id)).size === itens.length);
for (const item of itens) {
  for (const l of IDIOMAS) {
    const t = item[l];
    confere(`${item.id}: texto em ${l}`, t && typeof t.pergunta === "string" && t.pergunta.trim().length >= 5 && typeof t.resposta === "string" && t.resposta.trim().length >= 20);
    if (t) confere(`${item.id} (${l}): resposta curta (até 420 letras)`, t.resposta.length <= 420);
  }
  if (item.href) {
    confere(`${item.id}: link interno, começando com "/"`, /^\/[a-z0-9-]+(\/[a-z0-9-]+)*$/.test(item.href));
    confere(`${item.id}: a página ${item.href} existe em app/[lang]`, existsSync(new URL(`../app/[lang]${item.href}/page.tsx`, import.meta.url)));
  }
  for (const campo of ["recurso", "semRecurso"]) {
    if (item[campo]) confere(`${item.id}: o recurso "${item[campo]}" existe em lib/recursos.ts`, recursos.includes(`"${item[campo]}":`));
  }
  if (item.pt?.resposta.includes("{email}")) confere(`${item.id}: {email} em todos os idiomas`, IDIOMAS.every((l) => item[l]?.resposta.includes("{email}")));
  confere(`${item.id}: nada de endereço de fora nem e-mail escrito à mão`, !/https?:\/\/|@/.test(JSON.stringify(item)));
}
// Cada pergunta presa a um recurso tem a irmã para quando ele está desligado (ou nenhuma, de propósito, no "meu-estudo").
for (const item of itens.filter((i) => i.recurso && i.recurso !== "meu-estudo")) {
  confere(`${item.id}: há a versão para o recurso desligado`, itens.some((o) => o.semRecurso === item.recurso));
}
// As perguntas pedidas na frente.
for (const id of ["podcasts", "comecar", "alumia", "contribuir", "enem", "vale-o-escrito", "painel", "apoie", "idioma", "acessibilidade", "jornal", "memorial", "contato"]) {
  confere(`tem a pergunta "${id}"`, itens.some((i) => i.id === id));
}

// ── O filtro ──
const lista = (l) => itens.map((i) => ({ id: i.id, pergunta: i[l].pergunta, resposta: i[l].resposta, palavras: i[l].palavras ?? "", href: i.href ?? null }));
const pt = lista("pt");
const ids = (busca, l = pt) => filtrarPerguntas(l, busca).map((p) => p.id);
confere("normalizar: tira acento e maiúscula", normalizar("ÁUDIO É Ção") === "audio e cao");
confere("busca vazia devolve tudo", ids("").length === pt.length && ids("   ").length === pt.length);
confere("só palavras vazias devolve tudo", ids("como onde o que").length === pt.length);
confere("'podcast' acha os podcasts primeiro", ids("podcast")[0] === "podcasts");
confere("'PODCASTS' (maiúscula) também", ids("PODCASTS")[0] === "podcasts");
confere("'memoria' sem acento acha o memorial", ids("memorial")[0] === "memorial");
confere("'acessibilidade' sem acento: 'acessibilidade libras'", ids("libras")[0] === "acessibilidade");
confere("'idioma' acha a troca de idioma", ids("mudar idioma")[0] === "idioma");
confere("'doacao' sem acento acha o apoio", ids("doacao")[0] === "apoie");
confere("'onde ficam as aulas' acha as aulas", ids("onde ficam as aulas").includes("aulas"));
confere("'alumia' acha a Alumia", ids("alumia")[0] === "alumia");
confere("nada casa: lista vazia", ids("xyzzy qwerty").length === 0);
confere("ordem estável no empate", JSON.stringify(ids("")) === JSON.stringify(pt.map((p) => p.id)));
const zh = lista("zh");
confere("chinês sem espaço: '播客在哪里' acha os podcasts", ids("播客在哪里", zh)[0] === "podcasts");
confere("chinês: '语言' acha a troca de idioma", ids("语言", zh)[0] === "idioma");
const ru = lista("ru");
confere("russo: 'подкаст' acha os podcasts", ids("подкаст", ru)[0] === "podcasts");
const fr = lista("fr");
confere("francês sem acento: 'memorial' acha o Mémorial", ids("memorial", fr)[0] === "memorial");

// ── A janela: sem IA, sem rede, acessível ──
const painel = ler("components/assistente/PainelDoAssistente.tsx");
const botao = ler("components/assistente/BotaoDoAssistente.tsx");
const filtro = ler("lib/perguntas-frequentes.ts");
const codigo = painel + botao + filtro;
confere("sem fetch, sem /api, sem IA", !/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|\/api\/|perguntarAoPublico|estadoDoPublico|lib\/assistente\/publico/.test(codigo));
confere("sem guardar o que se digita", !/localStorage|sessionStorage|indexedDB|document\.cookie/.test(codigo));
confere("sem HTML vindo de texto", !/dangerouslySetInnerHTML|innerHTML/.test(codigo));
confere("diálogo modal com título", /role="dialog"/.test(painel) && /aria-modal="true"/.test(painel) && /aria-labelledby=\{tituloId\}/.test(painel));
confere("foco preso (Tab gira dentro)", /function prenderFoco/.test(painel) && /e\.key !== "Tab"/.test(painel));
confere("Esc fecha", /e\.key === "Escape"\) fechar\(\)/.test(botao));
confere("setas andam pela lista", /ArrowDown/.test(painel) && /ArrowUp/.test(painel));
confere("pergunta abre e fecha a resposta (aria-expanded)", /aria-expanded=\{aberta\}/.test(painel) && /aria-controls=\{respostaId\}/.test(painel));
confere("a contagem do filtro é anunciada", /role="status"/.test(painel));
confere("sem nada que case: 'fale com a gente' por e-mail e a lista inteira", /mailto:\$\{email\}/.test(painel) && /nada \? perguntas : achadas/.test(painel));
const layout = ler("app/[lang]/layout.tsx");
confere("o layout passa só as perguntas do idioma", /perguntas=\{perguntasFrequentes\(lang\)\}/.test(layout));

// ── Os textos da moldura ──
const textos = IDIOMAS.map((l) => JSON.parse(ler(`i18n/assistente/${l}.json`)));
confere("moldura nos 6 idiomas, mesmas chaves", textos.every((j) => JSON.stringify(Object.keys(j).sort()) === JSON.stringify(Object.keys(textos[0]).sort())));
confere("moldura: {n} e {total} na contagem em todos", textos.every((j) => j.contagem.includes("{n}") && j.contagem.includes("{total}")));
confere("moldura pt: o aviso pedido quando nada casa", `${textos[0].naoAchei} ${textos[0].faleConosco}` === "Não achei. Veja as perguntas abaixo ou fale com a gente");

console.log(`${certos} conferências certas, ${falhas.length} com problema.`);
for (const falha of falhas) console.log(`  ✗ ${falha}`);
process.exit(falhas.length ? 1 : 0);
