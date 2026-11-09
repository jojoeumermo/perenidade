// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Confere o pacote "lacunas pedagógicas" da Etapa 3 (docs/escola/lacunas-pedagogicas.md): plantão de dúvidas, alfabetização
// com áudio e ícone primeiro, bloco "outro jeito" e resposta aberta ou em áudio com retorno. Só leitura de arquivos:
// nada de rede, nada de navegador. Uso: npm run testar:lacunas-3
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (r) => fs.readFileSync(path.join(RAIZ, r), "utf8");
const existe = (r) => fs.existsSync(path.join(RAIZ, r));
const LINGUAS = ["pt", "en", "es", "fr", "ru", "zh"];
let falhas = 0;
let total = 0;
function ok(cond, msg) {
  total++;
  if (!cond) {
    falhas++;
    console.error(`FALHOU: ${msg}`);
  }
}
const chaves = (o, prefixo = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? chaves(v, `${prefixo}${k}.`) : [`${prefixo}${k}`]));
const folhas = (o) => Object.values(o).flatMap((v) => (v && typeof v === "object" ? folhas(v) : [v]));

// ───────────── 1. Interface nos 6 idiomas ─────────────
const NOVAS = ["outrojeito", "outrojeitoAbrir", "ouvirPergunta", "pararAudio", "respostaFalar", "respostaGravar", "respostaParar", "respostaGravando", "respostaOuvir", "respostaApagar", "respostaAviso", "respostaSemMicrofone", "respostaConferir", "respostaConferir1", "respostaConferir2", "respostaConferir3", "retornoPedir", "retornoPergunta", "retornoRotulo", "retornoBotao", "retornoAviso"];
for (const l of LINGUAS) {
  const blocos = JSON.parse(ler(`i18n/${l}.json`)).lesson.blocks;
  for (const k of NOVAS) ok(typeof blocos[k] === "string" && blocos[k].trim().length > 0, `i18n/${l}.json lesson.blocks.${k} falta`);
}
const pt = JSON.parse(ler("i18n/plantao/pt.json"));
for (const l of LINGUAS) {
  // "_rascunho": true marca tradução ainda não revisada (convenção dos textos da rede, adotada pela Escola ao trocar
  // "acompanhante" por "Assistente" em 11/2026): é marcador, não texto, e fica fora da comparação de chaves.
  const { _rascunho, ...t } = JSON.parse(ler(`i18n/plantao/${l}.json`));
  void _rascunho;
  ok(JSON.stringify(chaves(t)) === JSON.stringify(chaves(pt)), `i18n/plantao/${l}.json tem chaves diferentes das do pt`);
  ok(folhas(t).every((v) => typeof v === "string" && v.trim()), `i18n/plantao/${l}.json tem texto vazio`);
}
// Nada de horário inventado: o pt não pode afirmar hora do dia nem "das 9 às 17".
const textoPt = folhas(pt).join(" ");
ok(!/\b\d{1,2}\s?h\b|\b\d{1,2}:\d{2}\b|\bdas \d+ às\b|\b24 horas\b|\b24h\b/i.test(textoPt), "o plantão afirma um horário que não tem fonte");
ok(/não existe um horário fixo/i.test(pt.semHorario), "o plantão precisa dizer que não há horário fixo");

// ───────────── 2. A página do plantão só reúne canais que existem ─────────────
const pagina = ler("app/[lang]/plantao/page.tsx");
ok(!/from "(node:)?fs"|from "(node:)?path"|process\.cwd\(\)/.test(pagina), "a página do plantão não pode ler o disco (deploy)");
const hrefs = [...pagina.matchAll(/href: "(\/[a-z0-9-/]+)"/g)].map((m) => m[1]);
ok(hrefs.length >= 5, `canais com endereço (achei ${hrefs.length})`);
for (const h of new Set([...hrefs, "/sala-livre", "/busca", "/perguntas", "/glossario"])) ok(existe(`app/[lang]${h}/page.tsx`), `o canal ${h} não existe como página`);
// Cada canal aponta para uma página que já tinha o texto dele: nada de canal novo.
for (const rota of ["/reforco", "/alumia", "/ao-vivo", "/estudo-em-grupo", "/escola/acompanhante"]) ok(pagina.includes(`"${rota}"`), `o plantão devia citar ${rota}`);
ok(/ligado\("escola"\)/.test(pagina), "o acompanhante da Escola só aparece com o recurso escola ligado");
ok(ler("app/sitemap.ts").includes('"/plantao"'), "falta /plantao no sitemap");
ok(ler("lib/interdicao.ts").includes('"/plantao"'), "falta /plantao numa área de lib/interdicao.ts");
ok(ler("lib/secoes-do-site.ts").includes('"/plantao"'), "falta /plantao no menu Mais");
const intencoes = JSON.parse(ler("content/busca-intencoes.json"));
ok(intencoes.some((i) => i.id === "tirar-duvida" && i.destinos.some((d) => d.caminho === "/plantao")), "falta a intenção de busca que leva ao plantão");
for (const l of LINGUAS) ok(typeof JSON.parse(ler(`i18n/escola/busca/${l}.json`)).paginas["/plantao"] === "string", `falta o título de /plantao em i18n/escola/busca/${l}.json`);

// ───────────── 3. Alfabetização: áudio e ícone primeiro ─────────────
const quiz = ler("components/Quiz.tsx");
const inline = ler("components/InlineCheck.tsx");
for (const [nome, fonte] of [["Quiz", quiz], ["InlineCheck", inline]]) {
  ok(/audio\??\s*[:=]/.test(fonte) && fonte.includes("OuvirTexto") && fonte.includes("IconesDeTraco"), `${nome} precisa do áudio e dos ícones (prop audio)`);
  ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(fonte.replace(/rpc\(/g, "")), `${nome} não pode mandar nada para a rede por causa do áudio`);
}
const aula = ler("app/[lang]/trilhas/[track]/[lesson]/page.tsx");
ok(/<Quiz [^>]*audio=\{letraGrande\}/.test(aula), "a página da aula precisa ligar o áudio do Quiz nas trilhas de alfabetização");
ok((aula.match(/<Markdown [^>]*audio=\{letraGrande\}/g) ?? []).length >= 2, "a página da aula precisa ligar o áudio dos blocos (texto completo e versão fácil)");
const ouvirTexto = ler("components/aula/OuvirTexto.tsx");
ok(/startReading/.test(ouvirTexto) && !/fetch\(|speechSynthesis\.speak\(/.test(ouvirTexto), "OuvirTexto usa o leitor do site (voz do aparelho), sem rede");
ok(ler("components/aula/OuvirParagrafo.tsx").includes("aside.bloco"), "OuvirParagrafo precisa ler também os blocos da aula (instruções)");
const icones = ler("components/aula/IconesDeTraco.tsx");
for (const nome of ["IconeMicrofone", "IconeSeta", "IconeCerto", "IconeErrado", "IconeRefazer", "IconeLixeira"]) ok(icones.includes(`export const ${nome}`), `falta o ícone ${nome}`);
ok(!/aria-hidden=\{?false/.test(icones) && /aria-hidden/.test(icones), "os ícones são só desenho (aria-hidden)");

// ───────────── 4. O bloco "outro jeito" ─────────────
const blocos = ler("components/aula/Blocos.tsx");
ok(/export function OutroJeito/.test(blocos) && /"outrojeito"/.test(blocos), "falta o componente OutroJeito na lista dos blocos");
ok(ler("components/Markdown.tsx").includes('language === "outrojeito"'), "o Markdown não desenha o bloco outrojeito");
ok(ler("components/Editor.tsx").includes("outrojeito:"), "o editor não tem o esqueleto do outrojeito");
ok(ler("components/rotulosDoEditor.ts").includes("outrojeito:"), "o menu do editor não nomeia o outrojeito");
ok(ler("scripts/gerar-espelho.mjs").includes('"outrojeito"'), "o espelho de texto simples não cobre o outrojeito");
ok(ler("app/globals.css").includes(".bloco-outrojeito"), "falta o estilo do outrojeito");
ok(/<details>/.test(blocos.slice(blocos.indexOf("export function OutroJeito"))), "o outrojeito precisa vir fechado (details)");
// O outrojeito não conta como parte do modelo e não muda a conferência das 9 partes.
const modelo = ler("lib/modelo-de-aula.ts");
ok(!/outrojeito/.test(modelo), "o outrojeito é opcional: não entra na conferência do modelo");
ok(/outrojeito/.test(ler("docs/MODELO-DE-AULA.md")), "docs/MODELO-DE-AULA.md precisa explicar o bloco outrojeito");

// ───────────── 5. Resposta aberta ou em áudio, com retorno ─────────────
const resp = ler("components/aula/RespostaAberta.tsx");
ok(/audio-local/.test(resp) && /guardarAudio/.test(resp), "o áudio da resposta usa a base local já existente (lucia-explicacoes)");
ok(!/fetch\(|XMLHttpRequest|sendBeacon|SpeechRecognition|webkitSpeechRecognition|localStorage/.test(resp), "RespostaAberta não manda áudio para fora nem reconhece fala (que mandaria o áudio a um servidor)");
ok(/ligado\("meu-estudo"\)/.test(resp) && /ligado\("escola"\)/.test(resp), "o áudio vai com o meu-estudo e o retorno do assistente com a escola");
ok(/pedindo && <RetornoDoAssistente/.test(resp), "o retorno do assistente só aparece depois que a pessoa pede");
const retorno = ler("components/aula/RetornoDoAssistente.tsx");
ok(/modo="socratico"/.test(retorno) && /Conversa/.test(retorno), "o retorno usa a conversa do acompanhante e um modo que a função já tem");
ok(!/\baudio\b|Blob/i.test(retorno.replace(/o áudio nunca sai[^\n]*/gi, "")), "o retorno do assistente nunca manda áudio");
for (const bloco of ["SuaRealidade", "OutroLado", "Realidade"]) {
  const i = blocos.indexOf(`export function ${bloco}`);
  ok(i >= 0 && blocos.slice(i, blocos.indexOf("\n}\n", i)).includes("<RespostaAberta"), `o bloco ${bloco} precisa da resposta em áudio`);
}
// A base do áudio é apagada no "apagar meus dados" (já era a do "Explique com suas palavras").
ok(/lucia-explicacoes/.test(ler("components/DataPanel.tsx")), "o apagar meus dados precisa limpar a base dos áudios");

console.log(falhas ? `\n${falhas} de ${total} conferências falharam.` : `\nTudo certo: ${total} conferências do pacote lacunas pedagógicas.`);
process.exit(falhas ? 1 : 0);
