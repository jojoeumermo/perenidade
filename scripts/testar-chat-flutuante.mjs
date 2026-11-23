// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A janela de conversas no canto da Alumia (recurso "alumia-chat-flutuante") e a tela inicial de Conversas. Confere, sem navegador:
//   1. a tela inicial: sem o chat novo neste aparelho, a lista é vazia (não é o erro "Falta a chave") e qualquer outro erro segue;
//      a página Conversas e a janela usam a mesma regra; o texto do erro e o de quem ainda não ativou são humanos e com o nome;
//   2. a troca de cifra: o aviso de antes some quando o dia da troca começa (o de depois é da limpeza do aparelho);
//   3. o estado da janela (lib/rede/chat/janela.ts): abrir, minimizar, fechar, conversas lado a lado conforme a largura, o
//      celular com uma por vez, e "esquecer" (Sair rápido / apagar tudo do chat) zerando tudo;
//   4. o recurso: ligado por padrão (também com "todos" e com a lista vazia), "-alumia-chat-flutuante" desliga, o painel tem o
//      nome, e o catálogo (SQL) o tem sem ser "só pelo nome";
//   5. a estrutura: o layout monta a janela dentro do portão, só com o recurso, só com rede-v2 e nunca com o chat só nos apps; o
//      botão leve não importa nada do chat de forma estática (o resto desce no toque); a janela reaproveita a Conversa e o cliente do
//      chat e não importa nenhum módulo de cifra; nada vai ao servidor nem ao disco sobre as janelas; Esc, foco preso só em tela
//      cheia, role=dialog/region com rótulo, alvos de 44 px; textos nos seis idiomas (os outros com a marca de rascunho).
// Uso: npm run testar:chat-flutuante
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COLUNA_DO_MENU, conversasQueCabem, JANELA_FECHADA, janela, LARGURA_DA_CONVERSA, LARGURA_DA_LISTA, MAXIMO_DE_CONVERSAS, naPaginaDasConversas, RESPIRO, telaCheia } from "../lib/rede/chat/janela.ts";
import { listaSemChatAqui } from "../lib/rede/chat/lista-inicial.ts";
import { avisarTroca } from "../lib/rede/chat/r2/troca.ts";
import { ligado, lerRecursos, PADRAO, RECURSOS, SO_PELO_NOME } from "../lib/recursos.ts";
import { NOMES_DAS_FUNCOES } from "../components/painel/alumia/nomes-das-funcoes.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, "");

let certos = 0;
const falhas = [];
const ok = (nome, condicao, detalhe = "") => {
  if (condicao) {
    certos++;
    console.log(`ok ${certos} - ${nome}`);
  } else {
    falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`);
    console.log(`FALHOU - ${nome}${detalhe ? `: ${detalhe}` : ""}`);
  }
};
const lanca = (f) => {
  try {
    f();
    return false;
  } catch {
    return true;
  }
};

// ═══════════════════ 1. A tela inicial de Conversas ═══════════════════
{
  const semChave = Object.assign(new Error("dm_sem_chave"), { code: "dm_sem_chave" });
  ok("sem o chat neste aparelho (dm_sem_chave), a lista é vazia", Array.isArray(listaSemChatAqui(semChave)) && listaSemChatAqui(semChave).length === 0);
  ok("o mesmo código só na mensagem do erro também vale", listaSemChatAqui(new Error("dm_sem_chave")).length === 0);
  ok("outro erro (sem serviço, falha de rede) segue adiante", lanca(() => listaSemChatAqui(Object.assign(new Error("x"), { code: "sem_servico" }))) && lanca(() => listaSemChatAqui(new TypeError("Failed to fetch"))));
  const tela = semComentarios(ler("components/rede/chat/Tela.tsx"));
  ok("a página Conversas busca a lista com a regra (não vira a tela de erro só por abrir)", /chat\.conversas\(\)\.catch\(listaSemChatAqui/.test(tela));
  const janelaDoChat = semComentarios(ler("components/rede/chat/janela/JanelaDoChat.tsx"));
  ok("a janela usa a mesma regra", /chat\.conversas\(\)\.catch\(listaSemChatAqui/.test(janelaDoChat));
  ok("a janela mostra o convite para ativar (o fluxo de sempre: ativarNesteAparelho), nunca um erro de chave", /ativarNesteAparelho\(/.test(janelaDoChat) && /t\.ativar\.botao/.test(janelaDoChat));
  const pt = JSON.parse(ler("i18n/rede/chat/pt.json"));
  ok("o erro dm_sem_chave não diz mais \"Falta a chave\"", !/falta a chave/i.test(pt.erros.dm_sem_chave) && /ainda não ativou/.test(pt.erros.dm_sem_chave));
  ok("quem ainda não ativou aparece pelo nome dentro da conversa", pt.conversa.semChaveDoOutro.includes("{nome}") && /preencher\(t\.conversa\.semChaveDoOutro, \{ nome: conversa\.com\.codinome \}\)/.test(ler("components/rede/chat/Conversa.tsx")));
  ok("a lista vazia diz como começar uma conversa", /Comece uma conversa/.test(pt.lista.vazio) && /Comece uma conversa/.test(pt.janela.vazio));
}

// ═══════════════════ 2. A troca de cifra ═══════════════════
ok("véspera da troca: o aviso de antes aparece", avisarTroca(Date.parse("2026-11-22T23:59:59Z"), "2026-11-23"));
ok("no próprio dia (00:00 UTC e o resto do dia): o aviso de antes some", !avisarTroca(Date.parse("2026-11-23T00:00:00Z"), "2026-11-23") && !avisarTroca(Date.parse("2026-11-23T20:00:00Z"), "2026-11-23"));
ok("depois do dia: some", !avisarTroca(Date.parse("2026-11-30T12:00:00Z"), "2026-11-23"));

// ═══════════════════ 3. O estado da janela ═══════════════════
{
  let e = JANELA_FECHADA;
  ok("começa fechada, sem conversa", !e.aberta && !e.minimizada && e.conversas.length === 0);
  e = janela(e, { tipo: "abrir" });
  ok("abrir mostra a lista", e.aberta && !e.minimizada);
  e = janela(e, { tipo: "abrirConversa", id: "a", cabem: 2 });
  e = janela(e, { tipo: "abrirConversa", id: "b", cabem: 2 });
  ok("duas conversas lado a lado, a mais nova primeiro", e.conversas.map((c) => c.id).join() === "b,a");
  e = janela(e, { tipo: "abrirConversa", id: "c", cabem: 2 });
  ok("a terceira, onde só cabem duas, tira a mais antiga", e.conversas.map((c) => c.id).join() === "c,b");
  e = janela(e, { tipo: "abrirConversa", id: "b", cabem: 2 });
  ok("abrir de novo uma que já está aberta só a traz para a frente", e.conversas.map((c) => c.id).join() === "b,c");
  e = janela(e, { tipo: "minimizarConversa", id: "c" });
  ok("minimizar uma conversa deixa só a barra (continua aberta)", e.conversas.find((c) => c.id === "c")?.minimizada === true);
  e = janela(e, { tipo: "abrirConversa", id: "d", cabem: 2 });
  ok("a minimizada não ocupa lugar: d e b abertas, c minimizada", e.conversas.map((c) => `${c.id}${c.minimizada ? "-" : ""}`).join() === "d,b,c-");
  e = janela(e, { tipo: "restaurarConversa", id: "c", cabem: 2 });
  ok("restaurar a minimizada a traz para a frente e tira a que sobra", e.conversas.map((c) => `${c.id}${c.minimizada ? "-" : ""}`).join() === "c,d");
  e = janela(e, { tipo: "minimizar" });
  ok("minimizar a janela guarda as conversas (a navegação e o Esc não perdem nada)", e.aberta && e.minimizada && e.conversas.length === 2);
  e = janela(e, { tipo: "abrir" });
  ok("voltar a abrir traz tudo de volta", e.aberta && !e.minimizada && e.conversas.length === 2);
  e = janela(e, { tipo: "caber", cabem: 1 });
  ok("a janela do navegador encolheu: fica só a mais nova", e.conversas.map((c) => c.id).join() === "c");
  e = janela(e, { tipo: "fecharConversa", id: "c" });
  ok("fechar a conversa a tira da janela", e.conversas.length === 0 && e.aberta);
  e = janela(janela(e, { tipo: "abrirConversa", id: "x", cabem: 3 }), { tipo: "fechar" });
  ok("fechar a janela fecha tudo (nada fica guardado)", JSON.stringify(e) === JSON.stringify(JANELA_FECHADA));
  e = janela(janela(janela(JANELA_FECHADA, { tipo: "abrir" }), { tipo: "abrirConversa", id: "y", cabem: 1 }), { tipo: "esquecer" });
  ok("Sair rápido / apagar tudo do chat: a janela esquece tudo", JSON.stringify(e) === JSON.stringify(JANELA_FECHADA));
  ok("minimizar com a janela fechada não abre nada", JSON.stringify(janela(JANELA_FECHADA, { tipo: "minimizar" })) === JSON.stringify(JANELA_FECHADA));
  let muitas = janela(JANELA_FECHADA, { tipo: "abrir" });
  for (const id of ["1", "2", "3", "4", "5"]) muitas = janela(janela(muitas, { tipo: "abrirConversa", id, cabem: 9 }), { tipo: "minimizarConversa", id });
  ok(`nunca mais de ${MAXIMO_DE_CONVERSAS} conversas na janela`, muitas.conversas.length === MAXIMO_DE_CONVERSAS);
  ok("360 e 390 px: tela cheia, uma conversa por vez", telaCheia(360) && telaCheia(390) && conversasQueCabem(390) === 1);
  ok("768 px: janela no canto, uma conversa ao lado da lista", !telaCheia(768) && conversasQueCabem(768) === 1);
  ok("1024 e 1280 px: uma conversa ao lado da lista (a coluna do menu, com o Sair rápido, fica livre)", conversasQueCabem(1024) === 1 && conversasQueCabem(1280) === 1);
  ok("1440 px: duas; 1920 px: três (o máximo, e não passa disso)", conversasQueCabem(1440) === 2 && conversasQueCabem(1920) === 3 && conversasQueCabem(4000) === 3);
  {
    // A conta de pixels: a lista, as conversas e os respiros, à direita da coluna do menu, em cada largura do computador.
    const cabeSemCobrir = [1024, 1280, 1366, 1440, 1600, 1920].every((l) => {
      const n = conversasQueCabem(l);
      const ocupado = 24 + LARGURA_DA_LISTA + n * (LARGURA_DA_CONVERSA + RESPIRO);
      return l - ocupado >= COLUNA_DO_MENU;
    });
    ok("do computador em diante, a janela nunca cobre a coluna do menu (Escrever, Sair rápido)", cabeSemCobrir);
  }
  ok("a janela some na página Conversas (só lá)", naPaginaDasConversas("/pt/alumia/conversas") && naPaginaDasConversas("/en/alumia/conversas/") && !naPaginaDasConversas("/pt/alumia") && !naPaginaDasConversas("/pt/alumia/conversas-x") && !naPaginaDasConversas(null));
}

// ═══════════════════ 4. O recurso ═══════════════════
{
  const nome = "alumia-chat-flutuante";
  ok("o recurso existe, está em PADRAO e não é só pelo nome", nome in RECURSOS && PADRAO.includes(nome) && !SO_PELO_NOME.includes(nome));
  ok("ligado com a lista vazia, com \"todos\" e com outros nomes", ligado(nome, lerRecursos("")) && ligado(nome, lerRecursos("todos")) && ligado(nome, lerRecursos("rede-v2,alumia-2")));
  ok("\"-alumia-chat-flutuante\" desliga, e \"nenhum\" também", !ligado(nome, lerRecursos("todos,-alumia-chat-flutuante")) && !ligado(nome, lerRecursos("nenhum")));
  ok("o painel único tem o nome e a descrição", typeof NOMES_DAS_FUNCOES[nome]?.nome === "string" && typeof NOMES_DAS_FUNCOES[nome]?.sobre === "string");
  const sql = ler("supabase/migracoes/20261129-chat-flutuante.sql");
  ok("o catálogo recebe o nome sem ser só pelo nome (o painel liga e desliga na hora)", /values \('alumia-chat-flutuante', false\)/.test(sql));
  ok("a migração não cria tabela nem função (a janela não guarda nada no servidor)", !/create\s+(table|or replace function|function)/i.test(sql));
  ok("a migração está inteira no fim do install.sql", ler("supabase/install.sql").replace(/\r\n/g, "\n").includes(sql.replace(/\r\n/g, "\n").trim()));
}

// ═══════════════════ 5. A estrutura ═══════════════════
{
  const layout = semComentarios(ler("app/[lang]/alumia/layout.tsx"));
  ok("o layout monta a janela só com rede-v2, com o recurso e sem o chat só nos apps", /ligado\("rede-v2"\) && ligado\("alumia-chat-flutuante"\) && !chatSoApp\(\)/.test(layout));
  ok("a janela fica dentro do portão (quem não passou por ele não a vê)", layout.indexOf("<ChatFlutuante") < layout.indexOf("<PortaoDaAlumia") && /\{telas\}\s*<\/PortaoDaAlumia>/.test(layout));

  // O botão é leve: nenhuma importação estática alcança o cliente, o chaveiro ou a cifra do chat.
  const PROIBIDOS = [/^lib\/rede\/chat\/r2\//, /^lib\/rede\/chat\/r3\//, /^lib\/rede\/cifra\//, /^lib\/equipe\//, /^lib\/rede\/grupos\//, /^lib\/rede\/chat-/, /^lib\/rede\/cliente-chat/, /^lib\/rede\/caixas\//, /^components\/rede\/chat\/(?!janela\/ChatFlutuante)/];
  const MARCADORES = ["alumia/r2/envelope/v1", "proteusEncrypt", "@wireapp/core-crypto", "matrix-sdk-crypto"];
  const resolver = (de, esp) => {
    let base;
    if (esp.startsWith("@/")) base = path.join(raiz, esp.slice(2));
    else if (esp.startsWith(".")) base = path.resolve(path.dirname(path.join(raiz, de)), esp);
    else return null;
    for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) if (fs.existsSync(c) && fs.statSync(c).isFile()) return path.relative(raiz, c).split(path.sep).join("/");
    return null;
  };
  const estaticos = (arquivo) => {
    const texto = ler(arquivo).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    return [...texto.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?!type\b)(?:[^"';]*?\s+from\s+)?["']([^"']+)["']/g)].map((m) => m[1]);
  };
  const vistos = new Set();
  const fila = ["components/rede/chat/janela/ChatFlutuante.tsx"];
  while (fila.length) {
    const a = fila.pop();
    if (vistos.has(a)) continue;
    vistos.add(a);
    if (!/\.(ts|tsx|mjs|js)$/.test(a)) continue;
    for (const esp of estaticos(a)) {
      const r = resolver(a, esp);
      if (r) fila.push(r);
    }
  }
  const alcancados = [...vistos].filter((a) => PROIBIDOS.some((p) => p.test(a)));
  ok("o botão não importa nada do chat de forma estática (cliente, chaveiro, cifra, caixas)", vistos.size > 2 && alcancados.length === 0, alcancados.join(", "));
  const comMarca = [...vistos].filter((a) => /\.(ts|tsx)$/.test(a) && MARCADORES.some((m) => ler(a).includes(m)));
  ok("nada do que o botão alcança tem os marcadores da cifra", comMarca.length === 0, comMarca.join(", "));
  const botao = semComentarios(ler("components/rede/chat/janela/ChatFlutuante.tsx"));
  ok("a janela de verdade desce só no toque (import dinâmico, sem servidor)", /dynamic\(\(\) => import\("\.\/JanelaDoChat"\), \{ ssr: false \}\)/.test(botao));
  ok("o botão some na página Conversas e para quem não tem sessão", /naPaginaDasConversas\(caminho\)/.test(botao) && /hasSession\(\)/.test(botao));

  const janelaDoChat = semComentarios(ler("components/rede/chat/janela/JanelaDoChat.tsx"));
  ok("a janela reaproveita a Conversa, o cliente e o chaveiro do chat", /import \{ Conversa \} from "\.\.\/Conversa"/.test(janelaDoChat) && /from "@\/lib\/rede\/cliente-chat"/.test(janelaDoChat) && /from "@\/lib\/rede\/chat-chaveiro"/.test(janelaDoChat));
  ok("a janela não importa nenhum módulo de cifra direto (Proteus, SPQR, MLS, envelope, caixas, passes, franquia)", !/from "@\/lib\/rede\/(chat\/r2|chat\/r3|cifra|grupos|caixas\/(?!agenda|ritmo))/.test(janelaDoChat) && !/proteus|spqr|core-crypto|franquia|envelope/i.test(janelaDoChat.replace(/import\("@\/lib\/rede\/caixas\/(agenda|ritmo)"\)/g, "")));
  const juntos = botao + janelaDoChat + semComentarios(ler("lib/rede/chat/janela.ts"));
  ok("nada sobre as janelas vai ao disco nem ao servidor (sem localStorage, sessionStorage, IndexedDB, fetch ou rpc próprios)", !/localStorage\.(setItem|getItem)|sessionStorage|indexedDB|fetch\(|\brpc\(/.test(juntos));
  ok("o modo viagem vale na janela como na página", /useEscondidasDaViagem\(/.test(janelaDoChat));
  ok("Sair rápido / apagar tudo do chat: a janela esquece e fecha", /aoApagarTudoDoChat\(/.test(janelaDoChat) && /tipo: "esquecer"/.test(janelaDoChat));
  ok("Esc minimiza (respeitando quem já tratou o Esc)", /e\.key === "Escape" && !e\.defaultPrevented/.test(janelaDoChat));
  ok("o foco fica preso só em tela cheia", /e\.key === "Tab" && cheia/.test(janelaDoChat));
  ok("celular: role=dialog com aria-modal e rótulo; computador: role=region com rótulo", /role="dialog"\s+aria-modal="true"\s+aria-label=\{/.test(janelaDoChat) && (janelaDoChat.match(/role="region"/g) ?? []).length >= 2 && /aria-label=\{preencher\(tj\.conversaCom/.test(janelaDoChat));
  ok("cada conversa lado a lado tem o próprio campo (sem id repetido)", /idDoCampo=\{`\$\{id\}-texto-/.test(janelaDoChat) && /htmlFor=\{idDoCampo\}/.test(ler("components/rede/chat/Conversa.tsx")));
  const css = ler("styles/alumia-chat-flutuante.css");
  ok("alvos de 44 px nos botões da janela e 48 px no botão do canto", /\.al-cf-icone \{[^}]*min-width: 44px; min-height: 44px/.test(css) && /\.al-cf-lancador \{[^}]*min-width: 48px; min-height: 48px/.test(css));
  ok("sem animação nem transição na janela (menos movimento e modo leve)", !/animation|transition/.test(css.replace(/\/\*[\s\S]*?\*\//g, "")) && !/animate-|transition/.test(janelaDoChat + botao));
  ok("no celular e no tablet o botão fica acima da barra de baixo, e o \"voltar ao topo\" sobe um degrau", /\.al-cf-lancador \{[^}]*bottom: calc\(5\.25rem/.test(css) && /:root:has\(\.al-cf-lancador\) \[data-al="2"\] \.al-subir/.test(css));
  ok("fora da impressão", /@media print \{\s*\.al-cf, \.al-cf-lancador \{ display: none !important; \}/.test(css));
}

// ═══════════════════ 6. Os textos ═══════════════════
{
  const pt = JSON.parse(ler("i18n/rede/chat/pt.json"));
  const chaves = Object.keys(pt.janela);
  const marcas = (x) => (x.match(/\{\w+\}/g) ?? []).sort().join();
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const d = JSON.parse(ler(`i18n/rede/chat/${l}.json`));
    const falta = chaves.filter((k) => typeof d.janela?.[k] !== "string" || !d.janela[k].trim() || marcas(d.janela[k]) !== marcas(pt.janela[k]));
    ok(`${l}: os textos da janela, com os mesmos marcadores, e a marca de rascunho`, d._rascunho === true && falta.length === 0 && marcas(d.conversa.semChaveDoOutro) === marcas(pt.conversa.semChaveDoOutro), falta.join(", "));
  }
  ok("pt é texto final (sem a marca de rascunho)", pt._rascunho === undefined);
  const usados = [...semComentarios(ler("components/rede/chat/janela/JanelaDoChat.tsx")).matchAll(/tj\.(\w+)/g)].map((m) => m[1]);
  const semTexto = [...new Set(usados)].filter((k) => !(k in pt.janela));
  ok("todo texto que a janela usa existe", semTexto.length === 0, semTexto.join(", "));
}

console.log(`\n${certos} certos, ${falhas.length} falhas`);
if (falhas.length) {
  for (const f of falhas) console.log(`  - ${f}`);
  process.exit(1);
}
