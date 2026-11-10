// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o lado do aparelho dos atos da Alumia (frente F2, PLANO-ALUMIA §8): o cliente desconfia do servidor (número de pessoas
// nunca chega à tela; total só para quem organizou; link de apoio só https), o dublê da prévia segue as regras do banco (proporção
// nula abaixo de 3, em passos de 10 %, adiar/cancelar só quem organizou, "era 12/11" guardado), o formulário confere com os limites
// do banco, o .ics é válido (RFC 5545) e o "Chegar" não leva nada de quem clicou. O teste do BANCO entra com a migração da F2.
// Uso: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --disable-warning=DEP0205 --import ./scripts/carregar-ts.mjs scripts/testar-alumia-atos.mjs
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chamarDuble, criarClienteDosAtos, limparAto, pedidoDoAto } from "../lib/rede/cliente-atos.ts";
import { atosDeExemplo, criarDuble } from "../lib/rede/atos/exemplos.ts";
import { conferirAto, pontoEDetalhe } from "../lib/rede/atos/formulario.ts";
import { icsDoAto, nomeDoIcs } from "../lib/rede/atos/ics.ts";
import { linkDeApoioSeguro, linkDoMapa, textoParaChamar } from "../lib/rede/atos/chegar.ts";
import { contarNovos, CHAVE_DOS_VISTOS } from "../lib/rede/atos/novos.ts";
import { EVENTO_DA_CIDADE, guardarCidade, nomeDaCidade, ouvirCidade } from "../lib/rede/atos/aparelho.ts";
import { codigoDoErro, fraseDoErro, CODIGOS_DE_ERRO } from "../lib/rede/atos/erros.ts";
import { mola, MOLAS } from "../lib/rede/atos/movimento.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let certos = 0;
const falhas = [];
const igual = (nome, valor, esperado) => {
  if (JSON.stringify(valor) === JSON.stringify(esperado)) certos++;
  else falhas.push(`${nome}: veio ${JSON.stringify(valor)?.slice(0, 300)}, esperava ${JSON.stringify(esperado)?.slice(0, 300)}`);
};
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
const passo = (x) => x === null || (x >= 0.1 && x <= 1 && Math.abs(x * 10 - Math.round(x * 10)) < 1e-9);

// ── limparAto: o servidor com defeito não consegue mostrar um número de pessoas ──
const base = atosDeExemplo(Date.parse("2026-11-09T12:00:00Z"))[0].ato;
igual("proporção fora dos passos vira nula", limparAto({ ...base, acesos: 0.37 }).acesos, null);
igual("número de pessoas no lugar da proporção vira nulo", limparAto({ ...base, acesos: 26 }).acesos, null);
igual("proporção em passo de 10 % passa", limparAto({ ...base, acesos: 0.7 }).acesos, 0.7);
igual("total some para quem não organizou", limparAto({ ...base, meu: false, total: 26 }).total, null);
igual("total fica para quem organizou", limparAto({ ...base, meu: true, total: 26 }).total, 26);
for (const ruim of ["javascript:alert(1)", "http://x.org", "data:text/html,oi", "https://u:s@x.org"]) {
  igual(`link de apoio recusado: ${ruim}`, limparAto({ ...base, link_apoio: ruim }).link_apoio, null);
  igual(`linkDeApoioSeguro recusa: ${ruim}`, linkDeApoioSeguro(ruim), null);
}
igual("link https passa", limparAto({ ...base, link_apoio: "https://exemplo.org/v" }).link_apoio, "https://exemplo.org/v");
igual("respostas negativas viram 0", limparAto({ ...base, respostas: -3 }).respostas, 0);

// ── O dublê e o cliente (a matriz: quem não organizou, quem organizou) ──
const duble = criarDuble({ atos: atosDeExemplo() });
const cli = criarClienteDosAtos(chamarDuble(duble));
const perto = await cli.atos("perto", { cidade: "sao paulo" });
ok("Perto pela cidade escrita (sem acento e sem caixa)", perto.itens.length === 3 && perto.itens.every((a) => a.cidade === "São Paulo"));
igual("Perto sem cidade não devolve nada (nada de GPS)", (await cli.atos("perto", {})).itens.length, 0);
const seguindo = await cli.atos("seguindo");
ok("Seguindo traz todos, por data", seguindo.itens.length === 4 && seguindo.itens.every((a, i, l) => i === 0 || l[i - 1].inicio <= a.inicio));
ok("nenhuma proporção fora dos passos de 10 %", seguindo.itens.every((a) => passo(a.acesos)));
const aula = seguindo.itens.find((a) => a.titulo.startsWith("Aula"));
igual("2 confirmações: o mosaico fica apagado (nulo abaixo de 3)", aula.acesos, null);
ok("total nulo para quem não organizou", seguindo.itens.filter((a) => !a.meu).every((a) => a.total === null));
const vigilia = seguindo.itens.find((a) => a.meu);
ok("quem organizou vê o total exato", typeof vigilia.total === "number" && vigilia.total === 14);
ok("nenhum ato traz lista de pessoas", seguindo.itens.every((a) => !Object.values(a).some((v) => Array.isArray(v))));
ok("adiado guarda a data de antes (era 12/11)", vigilia.situacao === "adiado" && typeof vigilia.inicio_anterior === "string");

const pl = seguindo.itens.find((a) => a.titulo === "Passe Livre Já");
const desfaz = await cli.vou(pl.id, false);
ok("desfazer o Você vai", desfaz.vou_eu === false && desfaz.total === null && passo(desfaz.acesos));
const refaz = await cli.vou(pl.id, true);
ok("confirmar acende de novo; total segue nulo para quem não organizou", refaz.vou_eu === true && refaz.total === null && passo(refaz.acesos));
let recusou = false;
try {
  await cli.vou(aula.id, true);
} catch (e) {
  recusou = /ato_cancelado/.test(String(e));
}
ok("não dá para confirmar ato cancelado", recusou);

recusou = false;
try {
  await cli.mudar(pl.id, { situacao: "cancelado" });
} catch (e) {
  recusou = /so_quem_organizou/.test(String(e));
}
ok("só quem organizou adia ou cancela", recusou);
const nova = new Date(Date.now() + 20 * 86_400_000).toISOString();
const adiado = await cli.mudar(vigilia.id, { situacao: "adiado", inicio: nova, motivo: "chuva" });
ok("adiar troca a data e mantém a de antes", adiado.inicio === nova && adiado.inicio_anterior === vigilia.inicio_anterior && adiado.motivo === "chuva");
const cancelado = await cli.mudar(vigilia.id, { situacao: "cancelado", motivo: "x".repeat(300) });
ok("cancelar; motivo cortado em 140", cancelado.situacao === "cancelado" && cancelado.motivo.length === 140);
const deNovo = await cli.mudar(vigilia.id, { situacao: "confirmado" });
ok("confirmar de novo limpa o motivo", deNovo.situacao === "confirmado" && deNovo.motivo === "");
const prox = await cli.proximo();
ok("o próximo ato nunca é cancelado e é o que a pessoa confirmou", prox && prox.situacao !== "cancelado" && prox.vou_eu);

// ── O formulário (mesmos limites do banco) ──
const agora = Date.parse("2026-11-09T12:00:00Z");
const bom = conferirAto({ titulo: "Fica Esperança", quando: "2026-11-19T09:00:00Z", onde: "Ocupação Esperança, Itaquera", cidade: "São Paulo", descricao: "Vigília." }, agora);
ok("formulário completo fica pronto", bom.pronto && bom.palavra === "FICA ESPERANCA" && /^[A-Z ]{2,14}$/.test(bom.palavra));
igual("vazio aponta todos os campos", Object.keys(conferirAto({ titulo: "", quando: null, onde: "", cidade: "", descricao: "" }, agora).problemas).sort(), ["cidade", "descricao", "onde", "quando", "titulo"]);
igual("data no passado", conferirAto({ ...bom, quando: "2026-11-01T00:00:00Z" }, agora).problemas.quando, "passado");
igual("mais de um ano à frente", conferirAto({ ...bom, quando: "2028-01-01T00:00:00Z" }, agora).problemas.quando, "longe");
igual("nome só de números não desenha o mosaico", conferirAto({ ...bom, titulo: "2026" }, agora).problemas.titulo, "palavra");
igual("chamado acima de 500", conferirAto({ ...bom, descricao: "a".repeat(501) }, agora).problemas.descricao, "longo");
const pedido = pedidoDoAto(bom, { publico: "publico", comunidade: "moradia-zona-leste" });
ok("o pedido do rede_ato_publicar leva a palavra, a data, o ponto e a cidade", pedido.tipo === "ato" && pedido.palavra === "FICA ESPERANCA" && pedido.cidade === "São Paulo" && pedido.inicio === bom.quando && pedido.descricao === "Vigília." && pedido.comunidade === "moradia-zona-leste");
igual("ponto e detalhe", pontoEDetalhe("Praça da Sé · concentração na escadaria"), { ponto: "Praça da Sé", detalhe: "concentração na escadaria" });

// ── .ics (RFC 5545) ──
const ics = icsDoAto({ ...pl, titulo: "Passe Livre; Já, agora", descricao: "linha 1\nlinha 2 " + "x".repeat(120) }, { url: "https://alumia.institutolucia.org/pt/alumia/ato/" + pl.id });
const linhas = ics.split("\r\n");
ok(".ics começa e termina certo", linhas[0] === "BEGIN:VCALENDAR" && linhas.at(-1) === "END:VCALENDAR" || linhas.at(-2) === "END:VCALENDAR");
ok(".ics tem um VEVENT com UID, DTSTART e DTSTAMP", /BEGIN:VEVENT[\s\S]*UID:[\s\S]*DTSTART:\d{8}T\d{6}Z[\s\S]*END:VEVENT/.test(ics) && /DTSTAMP:\d{8}T\d{6}Z/.test(ics));
ok(".ics escapa ; e ,", ics.includes("Passe Livre\\; Já\\, agora"));
ok(".ics dobra linhas longas (≤ 75 + continuação com espaço)", linhas.every((l) => l.length <= 76));
ok(".ics só com CRLF", !/[^\r]\n/.test(ics));
ok(".ics não leva quem vai nem o total", !/ATTENDEE|ORGANIZER/.test(ics));
const icsCancelado = icsDoAto({ ...pl, situacao: "cancelado" }, { url: "https://x.org" });
ok(".ics de cancelado sai com STATUS:CANCELLED", icsCancelado.includes("STATUS:CANCELLED"));
ok("nome do arquivo .ics sem caracteres estranhos", /^[a-z0-9-]+\.ics$/.test(nomeDoIcs("Passe Livre Já!")));

// ── Chegar e Chamar ──
const mapa = linkDoMapa("Praça da Sé", "São Paulo");
ok("Chegar: OpenStreetMap, só https e só o endereço", mapa.startsWith("https://www.openstreetmap.org/search?query=") && !/id=|uid|usuario|lat=|lon=/.test(mapa));
igual("Chamar: só nome, quando e onde", textoParaChamar(" Passe Livre Já ", "sex 15/11", "Praça da Sé"), "Passe Livre Já · sex 15/11 · Praça da Sé");

// ── O código das telas: sem GPS, sem lista, sem rastreio ──
const ler = (p) => readFileSync(path.join(raiz, p), "utf8");
const telas = ["Acoes", "AtoAberto", "CartaoDoAto", "FaixaProximoAto", "ItemDoAto", "TelaDosAtos", "PaginaDoAto", "FormularioDoAto", "AtosPerto", "AnexoChamado", "TopoDoInicio", "Calendario", "AbaDosAtos", "partes", "usar", "Chegar", "Farol", "Corrente", "FlapsDoAto", "MosaicoVivo"].map((n) => ler(`components/rede/atos/${n}.${n === "usar" ? "ts" : "tsx"}`)).join("\n");
ok("nenhuma tela pede a posição do aparelho", !/geolocation|getCurrentPosition|watchPosition/.test(telas));
ok("Chegar sai sem Referer", /rel="noopener noreferrer"[^>]*referrerPolicy="no-referrer"/.test(telas));
const encaixe = ler("components/rede/atos/encaixe.tsx");
ok("encaixe vazio com as flags desligadas", /const LIGADO = rotaNovaLigada\("atos"\)/.test(encaixe) && /!LIGADO \? \{\}/.test(encaixe));
ok("emblema dos atos só com conta", /emblema: \(\{ situacao \}\) => \(situacao\.logado \? atosNovos\(\) : null\)/.test(encaixe));
ok("chamado embutido vale pelo campo, não pelo tipo do post", !/post\.tipo !== "chamado"/.test(ler("components/rede/atos/AnexoChamado.tsx")));
ok("Você vai vence a pílula do celular", /:root \[data-al="2"\] \.al-ato-coluna \.al-ato-quadrado:is\(\.al-ato-quadrado-vou/.test(ler("components/rede/atos/atos.css")));
ok("alto do Início nulo com as flags desligadas", /TopoDoInicioEncaixado[^=]*= !LIGADO\s*\?\s*null/.test(encaixe));

// ── "Há ato novo": conta atos (nunca gente), só no aparelho, e o "Sair rápido" apaga ──
const novosAtos = [{ id: "a", situacao: "confirmado" }, { id: "b", situacao: "adiado" }, { id: "c", situacao: "cancelado" }];
igual("novos: cancelado não conta", contarNovos(novosAtos, new Set()), 2);
igual("novos: visto não conta", contarNovos(novosAtos, new Set(["a"])), 1);
igual("novos: tudo visto dá 0", contarNovos(novosAtos, new Set(["a", "b"])), 0);
ok("vistos na chave que o Sair rápido apaga", CHAVE_DOS_VISTOS.startsWith("lucia:rede"));
ok("vistos nunca vão ao servidor", !/chamar|rpc\(|fetch\(/.test(ler("lib/rede/atos/novos.ts").replace(/import\("\.\.\/cliente-atos"\)[\s\S]*?atos\.atos\("seguindo"\)/, "")));

for (const l of ["pt", "en", "es", "fr", "ru", "zh"]) {
  const pt = JSON.parse(ler("i18n/rede/atos/pt.json"));
  const outro = JSON.parse(ler(`i18n/rede/atos/${l}.json`));
  const chaves = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? chaves(v, `${p}${k}.`) : [`${p}${k}`])).sort();
  igual(`textos em ${l} com as mesmas chaves do pt`, chaves(outro), chaves(pt));
}

// ── Erros com a frase certa (não o genérico) ──
igual("ato_cancelado vira a frase do ato cancelado", codigoDoErro(new Error("ato_cancelado")), "ato_cancelado");
igual("muitos_pedidos vira a frase de esperar", codigoDoErro(new Error("muitos_pedidos")), "muitos_pedidos");
igual("429 do servidor também é muitos_pedidos", codigoDoErro(new Error("HTTP 429 Too Many Requests")), "muitos_pedidos");
igual("sem rede", codigoDoErro(new TypeError("Failed to fetch")), "sem_rede");
igual("desconhecido vira genérico", codigoDoErro(new Error("xyz")), "generico");
{
  const pt = JSON.parse(ler("i18n/rede/atos/pt.json"));
  ok("todo código de erro tem frase em pt", CODIGOS_DE_ERRO.every((c) => typeof pt.erros[c] === "string" && pt.erros[c].length > 5));
  ok("a frase do ato cancelado não é a genérica", fraseDoErro(pt.erros, new Error("ato_cancelado")) !== pt.erros.generico);
}
ok("nenhuma tela mostra mais o erro genérico do Você vai", !/t\.acoes\.erroVou/.test(telas));
// ── Movimento: a mola termina em 1 e respeita quem pediu menos movimento ──
{
  const m = mola(240, 13);
  ok("mola vira linear() terminando em 1", m.easing.startsWith("linear(0") && m.easing.endsWith(", 1)") && m.duracao > 200 && m.duracao < 2500);
  ok("mola com quique passa do fim (overshoot)", MOLAS.quique.easing.split(",").some((v) => parseFloat(v.replace("linear(", "")) > 1));
  const mv = ler("lib/rede/atos/movimento.ts");
  ok("pode mexer olha prefers-reduced-motion, modo parado e e-ink", /prefers-reduced-motion/.test(mv) && /data-parado/.test(mv) && /data-eink/.test(mv));
}

// ── Revisão: cidade escrita, farol na hora do idioma, Chegar modal, sem View Transition por cima das barras ──
igual("cidade minúscula e com espaços vira nome", nomeDaCidade("  são   paulo "), "São Paulo");
igual("preposições ficam minúsculas", nomeDaCidade("RIO DE JANEIRO"), "Rio de Janeiro");
igual("hífen também capitaliza", nomeDaCidade("embu-guaçu"), "Embu-Guaçu");
igual("escrita sem maiúsculas passa igual", nomeDaCidade("圣保罗"), "圣保罗");
{
  const farol = ler("components/rede/atos/Farol.tsx");
  const chegar = ler("components/rede/atos/Chegar.tsx");
  const css = ler("components/rede/atos/atos.css");
  ok("a hora do pedido do farol usa o idioma da página", /toLocaleTimeString\(lang/.test(farol) && !/toLocaleTimeString\(\[\]/.test(telas));
  ok("Dispersar pede dois toques", /e === "dispersar"/.test(farol));
  ok("Chegar é um dialog modal (showModal)", /<dialog/.test(chegar) && /showModal\(\)/.test(chegar));
  ok("a troca de ato não usa View Transition (ela pintava por cima das barras)", !/startViewTransition|viewTransitionName/.test(telas) && !/::view-transition/.test(css));
  ok("botões do farol vencem a pílula do celular", css.includes(':root:not([data-leitor]) [data-al="2"] .al-farol-botoes .al-farol-botao[aria-pressed]'));
  ok("flutuantes do site ancorados na vaga das telas de ato", css.includes("anchor-name: --al-flutua") && css.includes("position-anchor: --al-flutua"));
  ok("mosaico: alto contraste e e-ink voltam aos tokens", css.includes(':root:is([data-contrast], [data-eink]) [data-al="2"] .al-mosaico-vivo {'));
}
// ── revisão 10/11: a coluna "Perto" segue a cidade; o Chamar tem plano B; validação com frase nossa ──
{
  const ouvidos = new Map();
  const guardado = new Map();
  const antes = { window: globalThis.window, localStorage: globalThis.localStorage };
  globalThis.localStorage = { getItem: (k) => guardado.get(k) ?? null, setItem: (k, v) => guardado.set(k, String(v)), removeItem: (k) => guardado.delete(k) };
  globalThis.window = {
    addEventListener: (n, f) => ouvidos.set(n, [...(ouvidos.get(n) ?? []), f]),
    removeEventListener: (n, f) => ouvidos.set(n, (ouvidos.get(n) ?? []).filter((x) => x !== f)),
    dispatchEvent: (e) => (ouvidos.get(e.type) ?? []).forEach((f) => f(e)),
  };
  let vezes = 0;
  const desligar = ouvirCidade(() => vezes++);
  guardarCidade("Recife");
  ok("guardar a cidade avisa quem ouve (a coluna Perto)", vezes === 1 && guardado.get("lucia:rede:atos:cidade") === "Recife");
  (ouvidos.get("storage") ?? []).forEach((f) => f({ key: "lucia:rede:atos:cidade" }));
  (ouvidos.get("storage") ?? []).forEach((f) => f({ key: "outra:chave" }));
  ok("a cidade trocada em outra aba também avisa (e outra chave não)", vezes === 2);
  desligar();
  guardarCidade("Olinda");
  ok("desligado, não ouve mais", vezes === 2 && (ouvidos.get(EVENTO_DA_CIDADE) ?? []).length === 0);
  globalThis.window = antes.window;
  globalThis.localStorage = antes.localStorage;
  const partes = ler("components/rede/atos/partes.tsx");
  ok("Chamar: sem área de transferência, copia pelo campo; se nem isso, devolve \"falhou\"", /execCommand\("copy"\)/.test(partes) && /"falhou"/.test(partes));
  const formularios = ["components/rede/atos/Corrente.tsx", "components/rede/atos/Farol.tsx", "components/rede/atos/PaginaDoAto.tsx"].map(ler).join("\n");
  ok("formulários dos atos sem balão do navegador (noValidate) e sem required/minLength", (formularios.match(/<form/g) ?? []).length === (formularios.match(/noValidate/g) ?? []).length && !/\bminLength=/.test(formularios));
  const css = ler("components/rede/atos/atos.css");
  ok("o mosaico vivo é creme como na prancha (aceso a 88 %)", css.includes("--al-mv-aceso: color-mix(in srgb, var(--al-cartao-aceso) 88%"));
  ok("hover só em quem tem mouse (nada de fundo preso no toque)", !/^\[data-al="2"\] \.al-atos-cidade:hover/m.test(css) && css.includes("@media (hover: hover)"));
  const tela = ler("components/rede/atos/TelaDosAtos.tsx");
  ok("J/K seguidos durante a troca entram na fila (nada se perde)", tela.includes("fila.current") && tela.includes("irDepois.current(depois)"));
  ok("o calendário também guarda a vaga dos flutuantes", ler("components/rede/atos/Calendario.tsx").includes("al-atos-vaga") && css.includes(".al-atos-tela, .al-ato-pagina, .al-cal"));
}
for (const l of ["pt", "en", "es", "fr", "ru", "zh"]) {
  const j = JSON.parse(ler(`i18n/rede/atos/${l}.json`));
  ok(`${l}: "não deu para copiar" mostra o endereço`, j.acoes.naoCopiou.includes("{url}"));
  ok(`${l}: frases da validação da corrente e do ponto`, !!(j.corrente.erroTexto && j.corrente.erroCidade && j.corrente.erroMeta && j.corrente.erroHora && j.farol.erroPonto));
  ok(`${l}: o exemplo da cidade não parece valor preenchido`, j.tela.cidadeExemplo !== "São Paulo");
  ok(`${l}: trocar pedido do farol cita os dois estados`, j.farol.trocarPedido.includes("{pendente}") && j.farol.trocarPedido.includes("{estado}"));
}

console.log(`testar-alumia-atos: ${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log("  ✗ " + f);
process.exit(falhas.length ? 1 : 0);
