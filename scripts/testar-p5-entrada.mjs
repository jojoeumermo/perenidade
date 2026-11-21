// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o navegador conhecido (P5, A4; supabase/migracoes/20261126-p5-entrada.sql e lib/sessao/*.ts) num Postgres de verdade
// (scripts/banco-local.mjs), com a migração rodada DUAS vezes sobre o install.sql e a tabela de sessões do serviço de contas criada
// como no serviço real. O centro: a mesma sessão nunca avisa duas vezes; o navegador conhecido não avisa; o novo avisa na hora; a
// sessão que ninguém apresentou avisa em 10 minutos; o banco não guarda o cookie, nem endereço de rede, nem liga duas contas pelo
// mesmo navegador; só a chave de serviço apresenta sessão. E as peças puras: o cookie (HttpOnly, Secure, SameSite), o navegador e o
// sistema iguais no site e no banco, e "Sair de todos" que continua derrubando todas as sessões.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-p5-entrada.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { noFimDoInstall } from "./install-posteriores.mjs";
import { navegadorDe, navegadorDoPedido } from "../lib/rede/seguranca/navegador.ts";
import { figuraValida, juntarFiguras, levaDaParede, licencaLivre } from "../lib/rede/entrada/rotacao.ts";
import { figurasDaEntrada } from "../lib/rede/entrada/figuras.ts";
import { figurasDoMemorial } from "../lib/rede/entrada/memorial-na-parede.ts";
import { caminhosDoDesenho, corDaTinta, desenhoDe, LADO_DO_DESENHO, NOMES_DOS_SIMBOLOS, QUANTOS_ROSTOS, SIMBOLOS } from "../lib/rede/desenhos.ts";
import { coresDoRosto, painelDoCodinome, sementeDoCodinome, COLUNAS_DO_PAINEL } from "../lib/rede/entrada/voce.ts";
import { levaParaForaDaJanela, paginaDoEndereco, SEM_JANELA } from "../components/rede/lei/janela-enderecos.ts";
import { entradaDaAlumia, entradaDaAlumiaPelaBusca, rotaNaAlumia, voltaDaAlumia } from "../lib/rede/alumia.ts";
import { dominioDoCookie, identificadorNovo, lerCookie, montarCookie, nomeDoCookie, resumoDoIdentificador } from "../lib/sessao/aparelho.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 500)}`);
    certos++;
    return valor;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
    return undefined;
  }
}
async function recusa(nome, promessa, codigo) {
  try {
    const valor = await promessa();
    falhas.push(`${nome}: deveria recusar com "${codigo}", mas passou (${JSON.stringify(valor)?.slice(0, 200)})`);
  } catch (erro) {
    if (String(erro.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro.message}"`);
  }
}

// ═══════════════════ 0. O arquivo e as peças puras ═══════════════════
const sql = ler("supabase/migracoes/20261126-p5-entrada.sql");
const semComentarios = sql.replace(/--.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
ok("o cabeçalho diz que roda depois do r3-fim (versão 16)", /Roda depois de 20261125-r3-fim\.sql \(banco na versão 16\)/.test(sql));
ok("toda função que lê ou grava tabela é security definer com search_path fixo", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  const puras = /interno\.(alumia_navegador|alumia_navegador_rotulo|alumia_navegador_texto)\(/;
  return funcoes.length >= 9 && funcoes.every((f) => /security definer set search_path = interno, pg_temp/.test(f) || puras.test(f) || /alumia_agente_minimo\(p_agente text\) returns text language sql immutable set search_path/.test(f));
})());
ok("duas tabelas novas, no esquema interno, com RLS ligada", (sql.match(/create table/gi) ?? []).length === 2
  && /alter table interno\.alumia_navegadores enable row level security/.test(sql) && /alter table interno\.alumia_entradas_pendentes enable row level security/.test(sql));
ok("nenhuma permissão direta em tabela", !/grant [a-z, ]+ on (table )?(interno|auth)\./i.test(sql));
ok("nada de endereço de rede (nem coluna, nem leitura)", !/\bip\b|ip_address|inet|x-forwarded-for|cf-connecting-ip/i.test(semComentarios));
ok("o banco não guarda hora de quando viu o navegador, só o dia", /visto_em date not null/.test(sql) && !/visto_em timestamptz/.test(sql));
ok("a porta passa em toda função nova (alumia_trancar no fim)", /select interno\.alumia_trancar\(\);\s*$/.test(sql));
ok("não mexe na versão nem na lista da porta", !/rede_alumia_versao|alumia_porta_aberta/.test(semComentarios));
ok("o install.sql traz a migração no fim, igual ao arquivo (seguida só das datadas posteriores)", noFimDoInstall(sql, ler("supabase/install.sql")));

const AGENTES = [
  ["Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0", "firefox", "linux"],
  ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0", "edge", "windows"],
  ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36", "chrome", "windows"],
  ["Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36", "chrome", "android"],
  ["Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36", "samsung", "android"],
  ["Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 EdgA/130.0.0.0", "edge", "android"],
  ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1", "safari", "ios"],
  ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1", "chrome", "ios"],
  ["Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/130.0 Mobile/15E148 Safari/605.1.15", "firefox", "ios"],
  ["Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/114.0.0.0", "opera", "macos"],
  ["Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15", "safari", "macos"],
  ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Vivaldi/7.0", "vivaldi", "windows"],
  ["Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36", "chrome", "chromeos"],
  ["Firefox/ Linux", "firefox", "linux"],
  ["Chrome/ Android", "chrome", "android"],
  ["Samsung/ Android", "samsung", "android"],
  ["curl/8.0", "outro", "outro"],
  ["node", "outro", "outro"],
  ["", "outro", "outro"],
];
ok("navegadorDe lê só o navegador e o sistema (com os nomes novos)", AGENTES.every(([a, n, s]) => { const r = navegadorDe(a); return r.navegador === n && r.sistema === s; }));
const ch = (h) => ({ get: (n) => h[n.toLowerCase()] ?? null });
ok("Client Hints: o Brave, que se diz Chrome, é o Brave", navegadorDoPedido(ch({ "user-agent": AGENTES[2][0], "sec-ch-ua": '"Brave";v="130", "Chromium";v="130"' })).navegador === "brave");
ok("Client Hints: o sistema que o user agent reduzido esconde", navegadorDoPedido(ch({ "user-agent": "Mozilla/5.0", "sec-ch-ua-platform": '"Windows"' })).sistema === "windows");
ok("Client Hints não trocam o Firefox (que não manda)", navegadorDoPedido(ch({ "user-agent": AGENTES[0][0], "sec-ch-ua": '"Brave";v="1"' })).navegador === "firefox");

const id = identificadorNovo();
ok("o identificador: 32 bytes aleatórios em base64url", /^[A-Za-z0-9_-]{43}$/.test(id) && id !== identificadorNovo());
ok("o resumo: SHA-256 em hexadecimal, nulo para cookie mexido", /^[0-9a-f]{64}$/.test(resumoDoIdentificador(id)) && resumoDoIdentificador("x") === null && resumoDoIdentificador(null) === null
  && resumoDoIdentificador(`${id}'; drop table`) === null);
const cookie = montarCookie(id, { seguro: true, dominio: "exemplo.org" });
ok("o cookie: HttpOnly, Secure, SameSite=Lax, 400 dias, prefixo __Secure-", /^__Secure-al-aparelho=/.test(cookie) && /; HttpOnly/.test(cookie) && /; Secure/.test(cookie)
  && /; SameSite=Lax/.test(cookie) && /; Max-Age=34560000/.test(cookie) && /; Path=\//.test(cookie) && /; Domain=exemplo\.org/.test(cookie));
ok("sem https (só em teste local), sem Secure e sem o prefixo", !/Secure/.test(montarCookie(id, { seguro: false, dominio: null })) && nomeDoCookie(false) === "al-aparelho");
ok("lerCookie acha o valor no meio de outros", lerCookie(`a=1; __Secure-al-aparelho=${id}; b=2`, "__Secure-al-aparelho") === id && lerCookie("a=1", "x") === null && lerCookie(null, "x") === null);
ok("o domínio: o do site para ele e os subdomínios; nenhum para outro endereço ou localhost",
  dominioDoCookie("alumia.exemplo.org", "https://exemplo.org") === "exemplo.org" && dominioDoCookie("exemplo.org", "https://exemplo.org/") === "exemplo.org"
  && dominioDoCookie("malicioso.org", "https://exemplo.org") === null && dominioDoCookie("naoexemplo.org", "https://exemplo.org") === null
  && dominioDoCookie("localhost:3000", "http://localhost:3000") === null);

// O site: as duas rotas usam o reconhecimento; o cookie só no servidor; "Sair de todos" continua derrubando todas as sessões.
const rotaAparelho = ler("app/api/sessao/aparelho/route.ts");
const rotaEntrar = ler("app/api/alumia/porta/entrar/route.ts");
const servidor = ler("lib/sessao/aparelho-servidor.ts");
const cliente = ler("lib/sessao/cliente-aparelho.ts");
ok("as duas rotas reconhecem o navegador e mandam o Set-Cookie", [rotaAparelho, rotaEntrar].every((t) => /reconhecerNavegador\(/.test(t) && /Set-Cookie/.test(t)));
ok("a rota do aparelho confere o token com o serviço de contas e a conta do token", /contaDoToken\(pedido\)/.test(rotaAparelho) && /lido\.conta !== conta\.id\.toLowerCase\(\)/.test(rotaAparelho) && /deOutraOrigem/.test(rotaAparelho));
ok("o navegador nunca lê o cookie (só a rota, com credentials same-origin)", !/document\.cookie/.test(cliente) && /credentials: "same-origin"/.test(cliente));
ok("o servidor não manda endereço de rede ao banco", !/x-forwarded-for|cf-connecting-ip|x-real-ip/i.test(servidor + rotaAparelho));
ok("a entrada com senha passa o navegador da pessoa ao serviço de contas", /servicoDeContas\("\/token\?grant_type=password", \{ email, password: senha \}, "POST", agente\)/.test(rotaEntrar));
const minhaConta = ler("components/painel/MinhaConta.tsx");
const segurancaPainel = ler("components/painel/Seguranca.tsx");
ok("\"Sair de todos\" (Minha conta e Segurança do painel) pede scope global antes do local", /signOut\(\{ scope: "global" \}\)/.test(minhaConta) && /signOut\(\{ scope: "global" \}\)/.test(segurancaPainel));
ok("o pânico do painel continua global", /signOut\(\{ scope: "global" \}\)/.test(ler("components/painel/Cuidado.tsx")));
ok("o sair comum (site, Alumia) é só desta sessão", /signOut\(\{ scope: "local" \}\)/.test(ler("lib/backend.ts")) && /signOut\(\{ scope: "local" \}\)/.test(ler("components/rede/Casca.tsx")));
ok("o \"desconectar todos\" da Alumia corta no banco (não depende do signOut do navegador)", /alumia_conta_desconectar/.test(ler("lib/rede/seguranca/cliente.ts")) && /alumia_conta_panico/.test(ler("lib/rede/seguranca/cliente.ts")));

// ═══════════════════ 0b. A3: entrar e criar conta na Alumia só dentro dela ═══════════════════
/** O nome antigo da Alumia nos endereços (o teste das rotas não deixa o caminho literal fora dos arquivos de compatibilidade). */
const ANTIGO = ["comu", "nidade"].join("");
const igual = (nome, a, b) => ok(`${nome} (${JSON.stringify(a)})`, JSON.stringify(a) === JSON.stringify(b));
igual("a entrada da Alumia: a linha, aba entrar", entradaDaAlumia("pt"), "/pt/alumia?entrar");
igual("a aba criar, voltando às organizações", entradaDaAlumia("en", "/alumia/organizacoes", true), "/en/alumia/organizacoes?criar");
igual("a volta com idioma e o endereço antigo", entradaDaAlumia("pt", `/es/${ANTIGO}/p/abc`), "/pt/alumia/p/abc?entrar");
for (const ruim of ["https://mau.exemplo/alumia", "//mau.exemplo/alumia", "/alumia//mau.exemplo", "/alumia/\\mau", "/painel", "/alumia/../painel", "/alumia/%2e%2e/painel", "/alumia/.%2e/painel", "javascript:alert(1)"]) {
  ok(`volta que não é tela da Alumia vira a linha: ${ruim}`, /^\/pt\/alumia(\/[\w\-.~%@]+)*\?entrar$/.test(entradaDaAlumia("pt", ruim)) && !entradaDaAlumia("pt", ruim).includes("mau") && !entradaDaAlumia("pt", ruim).includes("..") && !/%2e/i.test(entradaDaAlumia("pt", ruim)));
}
igual("idioma desconhecido cai no português", entradaDaAlumia("xx", "/alumia"), "/pt/alumia?entrar");
igual("da busca da página de entrar: aba, volta e o ?code= do e-mail", entradaDaAlumiaPelaBusca("fr", "?volta=%2Falumia%2Flistas&criar&code=abc"), "/fr/alumia/listas?criar&code=abc");
ok("voltaDaAlumia reconhece as telas da Alumia e só elas", voltaDaAlumia("/alumia") && voltaDaAlumia("/alumia/organizacoes") && voltaDaAlumia("/pt/alumia?x") && voltaDaAlumia(`/${ANTIGO}`)
  && !voltaDaAlumia("/escola") && !voltaDaAlumia("/painel") && !voltaDaAlumia("/alumiax") && !voltaDaAlumia(null) && !voltaDaAlumia("//alumia"));
igual("no endereço da Alumia, /entrar vai de vez (308) para o portão", rotaNaAlumia("/entrar", "", "?volta=/alumia/organizacoes&criar"), { tipo: "redirecionar", destino: "/pt/alumia/organizacoes", busca: "?criar", permanente: true });
igual("… /en/entrar também, com a volta de um link de e-mail", rotaNaAlumia("/en/entrar", "", "?code=xyz"), { tipo: "redirecionar", destino: "/en/alumia", busca: "?entrar&code=xyz", permanente: true });
ok("o proxy usa 308 no redirecionamento permanente", /decisao\.permanente \? 308 : 307/.test(ler("proxy.ts")) && /rotaNaAlumia\(pathname, request\.headers\.get\("accept"\) \?\? "", request\.nextUrl\.search\)/.test(ler("proxy.ts")));
ok("a página de entrar do site manda a volta da Alumia ao portão (308)", /voltaDaAlumia\(volta\)/.test(ler("app/[lang]/entrar/page.tsx")) && /permanentRedirect\(/.test(ler("app/[lang]/entrar/page.tsx")));
ok("o portão abre a entrada com ?entrar/?criar até nas telas abertas sem conta", /pedeEntrada/.test(ler("components/rede/entrada/PortaoDaAlumia.tsx")));
{
  const arquivos = (dir) => fs.readdirSync(path.join(raiz, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? arquivos(`${dir}/${e.name}`) : /\.tsx?$/.test(e.name) ? [`${dir}/${e.name}`] : []));
  // O "esqueci a senha" de components/rede/consertos é o da página de entrar do site (SignIn.tsx), que volta para ela mesma.
  const comEntrarDoSite = [...arquivos("components/rede"), "components/Forum.tsx"].filter((f) => f !== "components/rede/consertos/EsqueciASenha.tsx").filter((f) => /["'`](\$\{[^}]+\})?\/(\$\{lang\}\/)?entrar[?"'`]|localePath\(lang, "\/entrar"\)/.test(ler(f)));
  ok(`nenhuma tela da Alumia leva à página de entrar do site (${comEntrarDoSite.join(", ")})`, comEntrarDoSite.length === 0);
}
{
  const textos = Object.fromEntries(["pt", "en", "es", "fr", "ru", "zh"].map((l) => [l, JSON.parse(ler(`i18n/${l}.json`)).auth]));
  ok("a entrada do site não oferece mais criar conta para a Alumia (só aponta que ela tem entrada própria)", Object.values(textos).every((a) => !/Alumia/.test(a.toCreate) && !/Alumia/.test(a.why)));
}

// ═══════════════════ 0c. A1: a parede que não se arrasta e que gira ═══════════════════
{
  const parede = ler("components/rede/entrada/Parede.tsx");
  const css = ler("styles/alumia-entrada.css");
  ok("as figuras não se arrastam nem abrem o menu (draggable, dragstart, contextmenu)", parede.includes("draggable={false}") && parede.includes("onDragStart={(e) => e.preventDefault()}") && parede.includes("onContextMenu={(e) => e.preventDefault()}"));
  ok("nem se selecionam (user-select, -webkit-user-drag, toque longo)", /\.ale-parede-grade img \{\s*pointer-events: none;/.test(css) && css.includes("-webkit-user-drag: none") && css.includes("-webkit-touch-callout: none") && css.includes("user-select: none"));
  ok("a foto de quem chega também não se arrasta", ler("components/rede/entrada/Voce.tsx").split("draggable={false}").length === 3);
  const uso = ler("components/rede/entrada/useParede.ts");
  ok("a parede para com menos movimento, modo parado, economia de dados e aba escondida", uso.includes("podeMexer()") && uso.includes("saveData") && uso.includes('visibilityState !== "visible"'));
  ok("a próxima leva chega carregada antes de aparecer", uso.includes("await precarregar(proxima)"));
  ok("os créditos e os nomes acompanham as figuras da tela", ler("components/rede/entrada/Cena.tsx").includes("naTela.map") && ler("components/rede/entrada/Cena.tsx").includes("figuras={naTela}"));
}
igual("a leva 0 é a parede de sempre", levaDaParede([1, 2, 3, 4, 5], 0, 3), [1, 2, 3]);
igual("a leva seguinte dá a volta no fim", levaDaParede([1, 2, 3, 4, 5], 1, 3), [4, 5, 1]);
igual("sem figuras a mais, a parede fica como está", levaDaParede([1, 2, 3], 7, 3), [1, 2, 3]);
ok("nenhuma leva repete figura", [0, 1, 2, 3, 4, 5, 6].every((n) => new Set(levaDaParede([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], n, 9)).size === 9));
ok("licença livre: domínio público, CC0, CC BY, CC BY-SA; fora ND, NC e sem licença", ["Domínio público", "CC0", "CC BY 4.0", "CC BY-SA 3.0 DE", "Public domain"].every(licencaLivre)
  && !["CC BY-NC 4.0", "CC BY-ND 2.0", "CC BY-NC-SA 4.0", "", null, "Todos os direitos reservados"].some(licencaLivre));
{
  const sempre = figurasDaEntrada();
  const memorial = figurasDoMemorial();
  ok(`o Memorial dá figuras com foto do próprio site e crédito completo (${memorial.length})`, memorial.length >= 9 && memorial.every(figuraValida) && memorial.every((f) => fs.existsSync(path.join(raiz, "public", f.src))));
  const juntas = juntarFiguras(sempre, memorial);
  ok("as de sempre vêm primeiro e ninguém aparece duas vezes (pelo nome)", juntas.slice(0, sempre.length).map((f) => f.id).join() === sempre.map((f) => f.id).join()
    && new Set(juntas.map((f) => f.nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase())).size === juntas.length);
  ok("figura de fora com endereço de outro lugar ou sem licença livre é recusada", !figuraValida({ ...memorial[0], src: "https://mau.exemplo/x.webp" }) && !figuraValida({ ...memorial[0], credito: { ...memorial[0].credito, licenca: "CC BY-NC 4.0" } }) && !figuraValida(null));
  ok("a rota das figuras é estática e só devolve as do Memorial", /force-static/.test(ler("app/api/alumia/parede/route.ts")) && /figurasDoMemorial()/.test(ler("app/api/alumia/parede/route.ts")));
}

// ═══════════════════ 0d. A6: os termos numa janela que bloqueia ═══════════════════
{
  const janela = ler("components/rede/lei/JanelaDosTermos.tsx");
  ok("a janela é modal e deixa o resto da página inerte e parado", /role="dialog" aria-modal="true"/.test(janela) && /setAttribute\("inert", ""\)/.test(janela) && /style\.overflow = "hidden"/.test(janela));
  ok("Esc não fecha a janela com o aceite pendente (só a leitura de quem já aceitou)", /if \(!aberta \|\| pendente\) return;/.test(janela));
  ok("a saída rápida está na própria janela", /sairRapido\(DESTINO_DA_SAIDA, ENCAIXES\.aoSairRapido\)/.test(janela));
  ok("o Esc Esc Esc do modo seguro ouve na captura (passa antes de qualquer coisa da janela)", /addEventListener\("keydown", tecla, true\)/.test(ler("components/SaidaRapida.tsx")));
  ok("a casca monta a janela para quem entrou", /aberta\?\.logado && <JanelaDosTermos/.test(ler("components/rede/Rede.tsx")));
  ok("o cartão de reaceite no alto do Início (que dava para pular) saiu do encaixe", !/ReaceiteNoInicio/.test(ler("components/rede/lei/encaixe.tsx")));
  ok("Ajustes (dentro de Segurança) reabre a janela", /abrirOsTermos\(\)/.test(ler("components/rede/lei/AjustesDaLei.tsx")) && /secoesDeAjustes/.test(ler("components/rede/seguranca/TelaDaSeguranca.tsx")));
  ok("os termos dentro da janela não repetem o aceite", /semAceite/.test(ler("components/rede/lei/TelaDosTermos.tsx")));
}
igual("os links das cinco páginas abrem dentro da janela", ["/pt/alumia/termos", "/alumia/privacidade", "/o-que-guardamos", "/en/alumia/regras#r3", "/alumia/ajuda/"].map((h) => paginaDoEndereco(h, "https://exemplo.org")),
  [{ pagina: "termos", ancora: "" }, { pagina: "privacidade", ancora: "" }, { pagina: "guardamos", ancora: "" }, { pagina: "regras", ancora: "r3" }, { pagina: "ajuda", ancora: "" }]);
ok("outra origem, outra tela ou endereço quebrado não abrem na janela", [paginaDoEndereco("https://mau.exemplo/alumia/termos", "https://exemplo.org"), paginaDoEndereco("/alumia/termos-falsos", "https://exemplo.org"),
  paginaDoEndereco("/alumia/p/termos", "https://exemplo.org"), paginaDoEndereco("http://[", "https://exemplo.org")].every((r) => r === null));
ok("a janela não cobre Meus dados nem Denunciar (e os links deles saem da janela)", SEM_JANELA.test("/pt/alumia/meus-dados") && SEM_JANELA.test("/denunciar") && !SEM_JANELA.test("/pt/alumia")
  && levaParaForaDaJanela("/pt/alumia/meus-dados#apagar") && !levaParaForaDaJanela("/pt/alumia/termos"));

// ═══════════════════ 0e. A5: nada do instituto dentro da Alumia ═══════════════════
{
  const arquivos = (dir) => fs.readdirSync(path.join(raiz, dir), { recursive: true }).filter((f) => /\.tsx?$/.test(f)).map((f) => path.join(dir, String(f)));
  const daRede = arquivos("components/rede");
  const comAjudaDoSite = daRede.filter((f) => ler(f).includes("lucia:alternar-assistente"));
  ok(`nenhuma tela da Alumia abre as perguntas frequentes do site (${comAjudaDoSite.join(", ")})`, comAjudaDoSite.length === 0);
  const comDenunciarDoSite = daRede.filter((f) => /localePath\(lang, "\/denunciar"\)/.test(ler(f)));
  ok(`nenhuma tela da Alumia leva ao Denunciar do site (${comDenunciarDoSite.join(", ")})`, comDenunciarDoSite.length === 0);
  ok("a Alumia tem a própria página de denúncia, que abre sem conta", fs.existsSync(path.join(raiz, "app/[lang]/alumia/denunciar/page.tsx")) && /\|denunciar\|/.test(ler("components/rede/entrada/PortaoDaAlumia.tsx"))
    && /"denunciar",/.test(ler("lib/rede/alumia.ts")) && /denunciar: \{ componente:/.test(ler("components/rede/registro.tsx")));
  const tela = ler("components/rede/lei/TelaDeDenunciar.tsx");
  ok("a denúncia vai à mesma fila do banco, com a isca contra robôs, sem nome nem e-mail", /rpc\("denunciar", \{ p_alvo: item\.trim\(\), p_motivo: d\.motivos\[motivo\], p_detalhes: detalhes\.trim\(\), p_site: isca/.test(tela) && !/email|e-mail|nome/i.test(tela.replace(/\/\/.*$/gm, "")));
  const motivos = JSON.parse(ler("i18n/rede/lei/pt.json")).denunciar.motivos;
  ok("os motivos cabem no banco (2 a 80 letras)", motivos.every((m) => m.length >= 2 && m.length <= 80));
  const tokens = ler("styles/alumia-tokens.css");
  ok("o voltar ao topo e o ? do site somem na Alumia; ela tem o próprio subir", /:root:has\(\[data-al="2"\]\) :is\(\.voltar-ao-topo, \.assistente-flutua\) \{ display: none; \}/.test(tokens) && /<SubirAoTopo /.test(ler("app/[lang]/alumia/layout.tsx")));
  const textos = ["pt", "en", "es", "fr", "ru", "zh"].map((l) => JSON.parse(ler(`i18n/rede/lei/${l}.json`)));
  ok("o contato da lei aponta o Denunciar da Alumia em todos os idiomas", textos.every((t) => t.comum.contato.includes("(/alumia/denunciar)") && !t.comum.contato.includes("(/denunciar)")));
}

// ═══════════════════ 0f. A2: o desenho do codinome (e do rosto na rede) ═══════════════════
{
  ok("os símbolos têm 12 × 12 ladrilhos e só as letras conhecidas", Object.values(SIMBOLOS).every((l) => l.length === 12 && l.every((x) => x.length === 12 && /^[.#ordd1-4]+$/.test(x))));
  ok("os símbolos pedidos estão lá (foice e martelo, estrela, anarquia, anarcocomunista, Marx, raposa)", ["foice-e-martelo", "estrela", "anarquia", "anarcocomunista", "marx", "raposa"].every((n) => NOMES_DOS_SIMBOLOS.includes(n)));
  igual("o mesmo @nome dá sempre o mesmo desenho", desenhoDe("rosavermelha").grade.join() === desenhoDe("rosavermelha").grade.join(), true);
  const vistos = new Map();
  const nomes = new Set();
  for (let i = 0; i < 3000; i++) {
    const d = desenhoDe(`pessoa${i}`);
    vistos.set(`${d.cor}:${d.invertido}:${d.grade.join()}`, true);
    nomes.add(d.nome);
  }
  ok(`muitos desenhos diferentes (${vistos.size} em 3000 nomes; ${QUANTOS_ROSTOS} rostos possíveis)`, vistos.size >= 2000 && QUANTOS_ROSTOS >= 5000);
  ok("todo símbolo aparece para alguém, e os rostos também", NOMES_DOS_SIMBOLOS.every((n) => nomes.has(n)) && nomes.has("rosto"));
  ok("todo desenho tem o que ver (pelo menos 12 ladrilhos fora do fundo) e a tinta nunca é a cor do fundo", [...Array(500).keys()].every((i) => {
    const d = desenhoDe(`x${i}`);
    return d.grade.filter((t) => t !== "fundo").length >= 12 && corDaTinta("tinta", "#1fc2b5", d.invertido) !== corDaTinta("fundo", "#1fc2b5", d.invertido);
  }));
  const d = desenhoDe("faisca");
  const area = caminhosDoDesenho(d.grade).reduce((s, c) => s + [...c.d.matchAll(/h(\d+)/g)].reduce((t, m) => t + Number(m[1]), 0), 0);
  ok("os caminhos cobrem exatamente os ladrilhos fora do fundo", area === d.grade.filter((t) => t !== "fundo").length);
  ok("a entrada usa o mesmo desenho do rosto da rede (o painel VOCÊ e o rosto do formulário)", coresDoRosto("Faísca").length === LADO_DO_DESENHO * LADO_DO_DESENHO
    && painelDoCodinome("Faísca").slice(2 * COLUNAS_DO_PAINEL, 14 * COLUNAS_DO_PAINEL).join() === coresDoRosto("Faísca").join() && sementeDoCodinome("Faísca") === "faisca");
  const avatar = ler("components/rede/ui/Avatar16.tsx");
  ok("o rosto da rede: a foto escolhida, depois o rosto pintado em Editar perfil, depois o desenho", avatar.indexOf("if (foto)") < avatar.indexOf("if (px)") && avatar.indexOf("if (px)") < avatar.indexOf("desenhoDe(handle)") && /useRostoDe\(handle\)/.test(avatar));
  ok("o editor do rosto em Editar perfil continua lá", fs.existsSync(path.join(raiz, "components/rede/perfil/livre/Ferramentas.tsx")) && /lembrarRosto/.test(ler("components/rede/perfil/livre/dados.ts")));
}

// ═══════════════════ 0g. A12: a primeira vez na Alumia ═══════════════════
{
  const pv = ler("components/rede/lei/PrimeiraVez.tsx");
  ok("o passeio e os primeiros passos entram no alto do Início (encaixe da lei)", /PrimeiraVez as React\.ComponentType<ContextoDoEncaixe>/.test(ler("components/rede/lei/encaixe.tsx")));
  ok("só para quem entrou e é membro; dá para pular e para esconder", /!situacao\.logado \|\| !situacao\.membro/.test(pv) && /p\.pular/.test(pv) && /l\.esconder/.test(pv));
  ok("o que foi visto fica só no aparelho (nada vai ao servidor) e sobrevive sem armazenamento", /localStorage/.test(pv) && !/rpc\(|fetch\(|\blei\.(termos|aceitar)/.test(pv) && (pv.match(/catch \{/g) ?? []).length >= 2);
  const textos = ["pt", "en", "es", "fr", "ru", "zh"].map((l) => JSON.parse(ler(`i18n/rede/lei/${l}.json`)).primeiraVez);
  ok("quatro passos (linha, comunidades, núcleos e turmas, segurança) e quatro primeiros passos, nos seis idiomas", textos.every((t) => t.passos.length === 4 && t.lista.itens.length === 4)
    && textos[0].passos.map((p) => p.links.map((l) => l.href).join("+")).join() === ",/alumia/comunidades,/alumia/nucleos+/alumia/turmas,/alumia/seguranca");
  ok("os links do passeio são telas da Alumia que existem", textos.flatMap((t) => [...t.passos.flatMap((p) => p.links.map((l) => l.href)), ...t.lista.itens.map((i) => i.link)])
    .every((h) => fs.existsSync(path.join(raiz, "app/[lang]", h, "page.tsx"))));
  ok("a linha vazia diz por onde começar", /Comece pelas comunidades/.test(JSON.parse(ler("i18n/rede/pt.json")).estados.vazioSeguindo));
  ok("o aceite feito na janela acerta os outros leitores do aceite (Ajustes)", /TERMOS_MUDARAM/.test(ler("components/rede/lei/Reaceite.tsx")));
}

// ═══════════════════ 1. Banco ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const servico = { papel: "service_role" };

await exec(`
  create table auth.sessions (
    id uuid primary key default gen_random_uuid(), user_id uuid not null, created_at timestamptz default now(), updated_at timestamptz default now(),
    factor_id uuid, aal text, not_after timestamptz, refreshed_at timestamp, user_agent text, ip inet, tag text);
  create trigger alumia_agente_minimo before insert or update on auth.sessions for each row execute function interno.alumia_agente_reduzir('user_agent');
`);
await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("de novo (idempotente)", () => exec(sql));
await espera("o gatilho de sessão nova está em auth.sessions", () => dono("select count(*)::int as n from pg_trigger where tgrelid = 'auth.sessions'::regclass and tgname = 'alumia_sessao_nova'"), (r) => r.rows[0].n === 1);
await espera("a porta: nenhuma função aberta", () => dono("select interno.alumia_trancar() as r"), (r) => r.rows[0].r.abertas.length === 0);

await espera("o site e o banco dão o mesmo navegador e sistema (e o mínimo da R3 também, em até 20 letras)", async () => {
  const erros = [];
  for (const [a, n, s] of AGENTES) {
    const r = (await dono("select interno.alumia_navegador($1) as n, interno.alumia_navegador(interno.alumia_agente_minimo($1)) as m, interno.alumia_agente_minimo(interno.alumia_agente_minimo($1)) = interno.alumia_agente_minimo($1) as fixo, char_length(interno.alumia_agente_minimo($1)) <= 20 as cabe", [a])).rows[0];
    if (r.n.navegador !== n || r.n.sistema !== s || r.m.navegador !== n || r.m.sistema !== s || !r.fixo || !r.cabe) erros.push(a);
  }
  return erros;
}, (e) => e.length === 0);
await espera("o texto por extenso", () => dono("select interno.alumia_navegador_texto($1) as a, interno.alumia_navegador_texto('') as b, interno.alumia_navegador_rotulo('samsung', 'chromeos') as c", [AGENTES[11][0]]),
  (r) => r.rows[0].a === "Vivaldi em Windows" && r.rows[0].b === "Navegador desconhecido em sistema desconhecido" && r.rows[0].c === "Samsung Internet em ChromeOS");

const P = {};
for (const nome of ["ana", "bia", "caio"]) {
  P[nome] = await criarUsuario(`${nome}@p5.local`, `Pessoa ${nome}`);
  await rpc({ papel: "authenticated", sub: P[nome] }, "eu");
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of ["ana", "bia"]) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Codinome ${nome}`, `p5_${nome}`]);
}
const avisos = async (quem) => (await dono("select count(*)::int as n from interno.avisos where para = $1 and texto like 'Entrada nova na sua conta:%'", [quem])).rows[0].n;
const sessao = async (quem, agente, minutosAtras = 0) =>
  (await dono(`insert into auth.sessions (user_id, user_agent, ip, created_at) values ($1, $2, '192.0.2.50', now() - make_interval(mins => $3)) returning id`, [quem, agente, minutosAtras])).rows[0].id;
const entrou = (quem, s, hash, novo, nav = "chrome", sis = "windows") =>
  rpc(servico, "alumia_aparelho_entrou", { p_usuario: quem, p_sessao: s, p_hash: hash, p_hash_novo: novo, p_navegador: nav, p_sistema: sis });

const H1 = resumoDoIdentificador(identificadorNovo());
const H2 = resumoDoIdentificador(identificadorNovo());
const s1 = await sessao(P.ana, AGENTES[2][0]);
await espera("a sessão nova não avisa na hora: entra na fila, com o nome do navegador", async () => ({
  avisos: await avisos(P.ana),
  fila: (await dono("select rotulo, resolvida from interno.alumia_entradas_pendentes where sessao = $1", [s1])).rows,
}), (r) => r.avisos === 0 && r.fila.length === 1 && r.fila[0].rotulo === "Chrome em Windows" && !r.fila[0].resolvida);
await espera("o navegador sem cookie: novo, avisa uma vez, o site grava o cookie", () => entrou(P.ana, s1, null, H1), (r) => r.conhecido === false && r.cookie === "novo");
await espera("… e o aviso saiu (um)", () => avisos(P.ana), (n) => n === 1);
await espera("apresentar a mesma sessão de novo (F5) não avisa de novo", async () => { await entrou(P.ana, s1, H1, H2); return avisos(P.ana); }, (n) => n === 1);
const s2 = await sessao(P.ana, AGENTES[2][0]);
await espera("sessão nova no mesmo navegador (voltou do site, login único): conhecido, sem aviso, sem cookie novo", () => entrou(P.ana, s2, H1, H2), (r) => r.conhecido === true && r.cookie === null);
await espera("… nenhum aviso a mais, e a sessão saiu da fila", async () => ({ n: await avisos(P.ana), fila: (await dono("select resolvida from interno.alumia_entradas_pendentes where sessao = $1", [s2])).rows[0] }),
  (r) => r.n === 1 && r.fila.resolvida === true);
await espera("e a rotina dos 10 minutos não avisa a sessão já resolvida", async () => {
  await dono("update interno.alumia_entradas_pendentes set criada = now() - interval '11 minutes'");
  return { n: await dono("select interno.alumia_entradas_vencidas() as n"), avisos: await avisos(P.ana) };
}, (r) => r.n.rows[0].n === 0 && r.avisos === 1);
const s3 = await sessao(P.ana, AGENTES[0][0]);
await espera("sessão que ninguém apresentou (entrada pela API, fora do site): a rotina avisa depois de 10 minutos", async () => {
  const antes = (await dono("select interno.alumia_entradas_vencidas() as n")).rows[0].n;
  await dono("update interno.alumia_entradas_pendentes set criada = now() - interval '11 minutes' where sessao = $1", [s3]);
  const depois = (await dono("select interno.alumia_entradas_vencidas() as n")).rows[0].n;
  return { antes, depois, avisos: await avisos(P.ana) };
}, (r) => r.antes === 0 && r.depois === 1 && r.avisos === 2);
await espera("… com o nome do navegador e a hora em que a sessão abriu", () => dono("select texto from interno.avisos where para = $1 and texto like 'Entrada nova%' order by criado_em desc, id desc limit 1", [P.ana]),
  (r) => /^Entrada nova na sua conta: Firefox em Linux, em \d\d\/\d\d\/\d{4} às \d\d:\d\d \(hora de Brasília\)/.test(r.rows[0].texto));
await espera("… e apresentar depois essa sessão não avisa outra vez", async () => { await entrou(P.ana, s3, null, H2, "firefox", "linux"); return avisos(P.ana); }, (n) => n === 2);

await espera("o mesmo navegador (o mesmo cookie) com outra conta: novo para ela, o cookie continua o mesmo", async () => {
  const s = await sessao(P.bia, AGENTES[2][0]);
  return { r: await entrou(P.bia, s, H1, resumoDoIdentificador(identificadorNovo())), avisos: await avisos(P.bia) };
}, ({ r, avisos: n }) => r.conhecido === false && r.cookie === "renovar" && n === 1);
await espera("o banco não guarda o resumo do cookie nem liga duas contas pelo mesmo navegador", () => dono("select usuario, marca from interno.alumia_navegadores"),
  (r) => r.rows.length >= 3 && r.rows.every((l) => l.marca !== H1 && l.marca !== H2) && new Set(r.rows.map((l) => l.marca)).size === r.rows.length);
await espera("as colunas guardadas: conta, marca, navegador, sistema e dias (nada de endereço, nada de hora)", () => dono(`select table_name, string_agg(column_name || ':' || data_type, ',' order by column_name) as c
    from information_schema.columns where table_schema = 'interno' and table_name in ('alumia_navegadores', 'alumia_entradas_pendentes') group by table_name order by table_name`),
  (r) => r.rows[0].c === "criada:timestamp with time zone,resolvida:boolean,rotulo:text,sessao:uuid,usuario:uuid"
    && r.rows[1].c === "marca:text,navegador:text,renovar_em:date,sistema:text,usuario:uuid,visto_em:date");

await espera("o cookie se renova (o mesmo valor, prazo novo) depois de 30 dias", async () => {
  await dono("update interno.alumia_navegadores set renovar_em = current_date - 1 where usuario = $1", [P.ana]);
  const r1 = await entrou(P.ana, await sessao(P.ana, AGENTES[2][0]), H1, H2);
  const r2 = await entrou(P.ana, await sessao(P.ana, AGENTES[2][0]), H1, H2);
  return { r1, r2 };
}, ({ r1, r2 }) => r1.conhecido && r1.cookie === "renovar" && r2.conhecido && r2.cookie === null);
await espera("cookie mexido (valor fora da forma) conta como sem cookie", () => entrou(P.ana, null, "zz", H2), (r) => r.conhecido === false && r.cookie === "novo");
await espera("navegador e sistema fora da lista viram \"outro\"", async () => {
  await entrou(P.ana, null, null, resumoDoIdentificador(identificadorNovo()), "<script>", "x".repeat(200));
  return dono("select count(*)::int as n from interno.alumia_navegadores where navegador not in ('firefox','edge','opera','vivaldi','brave','samsung','chrome','safari','outro') or sistema not in ('android','ios','chromeos','windows','macos','linux','outro')");
}, (r) => r.rows[0].n === 0);

await recusa("quem tem só a sessão não apresenta sessão (nem a própria)", () => rpc({ papel: "authenticated", sub: P.ana }, "alumia_aparelho_entrou", { p_usuario: P.ana, p_sessao: null, p_hash: H1, p_hash_novo: H2, p_navegador: "chrome", p_sistema: "windows" }), "permission denied");
await recusa("nem quem não entrou", () => rpc({ papel: "anon" }, "alumia_aparelho_entrou", { p_usuario: P.ana, p_sessao: null, p_hash: H1, p_hash_novo: H2, p_navegador: "chrome", p_sistema: "windows" }), "permission denied");
await recusa("as tabelas não se leem de fora", () => banco.exclusivo(async () => {
  await banco.pg.exec("set role authenticated");
  try { return (await banco.pg.query("select * from interno.alumia_navegadores")).rows; } finally { await banco.pg.exec("reset role"); }
}), "permission denied");

await espera("quem não está na Alumia (só o site) não entra na fila nem recebe aviso", async () => {
  const s = await sessao(P.caio, AGENTES[0][0]);
  const r = await entrou(P.caio, s, null, resumoDoIdentificador(identificadorNovo()));
  return { r, fila: (await dono("select count(*)::int as n from interno.alumia_entradas_pendentes where usuario = $1", [P.caio])).rows[0].n, avisos: await avisos(P.caio) };
}, ({ r, fila, avisos: n }) => r.conhecido === false && fila === 0 && n === 0);

await espera("sem o gatilho (o projeto não deixou criar): o navegador novo avisa direto; o conhecido, não", async () => {
  await dono("drop trigger alumia_sessao_nova on auth.sessions");
  const antes = await avisos(P.bia);
  const s = await sessao(P.bia, AGENTES[3][0]);
  const novo = await entrou(P.bia, s, resumoDoIdentificador(identificadorNovo()), H2, "chrome", "android");
  const meio = await avisos(P.bia);
  const conhecido = await entrou(P.bia, await sessao(P.bia, AGENTES[2][0]), H1, H2);
  return { antes, meio, depois: await avisos(P.bia), novo, conhecido };
}, (r) => r.novo.conhecido === false && r.meio === r.antes + 1 && r.conhecido.conhecido === true && r.depois === r.meio);
await espera("a migração devolve o gatilho que sumiu", async () => { await exec(sql); return dono("select count(*)::int as n from pg_trigger where tgrelid = 'auth.sessions'::regclass and tgname = 'alumia_sessao_nova'"); }, (r) => r.rows[0].n === 1);

await espera("no máximo 30 navegadores por conta (sai o mais antigo)", async () => {
  await dono("update interno.alumia_navegadores set visto_em = current_date - 5 where usuario = $1", [P.ana]);
  for (let i = 0; i < 32; i++) await entrou(P.ana, null, null, resumoDoIdentificador(identificadorNovo()));
  return dono("select count(*)::int as n, count(*) filter (where visto_em < current_date)::int as velhos from interno.alumia_navegadores where usuario = $1", [P.ana]);
}, (r) => r.rows[0].n === 30 && r.rows[0].velhos === 0);
await espera("a faxina esquece o navegador que não aparece há 400 dias e a fila de mais de 1 dia", async () => {
  await dono("update interno.alumia_navegadores set visto_em = current_date - 401 where usuario = $1", [P.bia]);
  await dono("update interno.alumia_entradas_pendentes set criada = now() - interval '2 days'");
  const n = (await dono("select interno.alumia_navegadores_faxina() as n")).rows[0].n;
  await dono("select interno.alumia_entradas_vencidas()");
  return { n, sobrou: (await dono("select (select count(*) from interno.alumia_navegadores where usuario = $1)::int as a, (select count(*) from interno.alumia_entradas_pendentes)::int as b", [P.bia])).rows[0] };
}, ({ n, sobrou }) => n >= 1 && sobrou.a === 0 && sobrou.b === 0);
await espera("a conta que sai leva os navegadores junto", async () => {
  await entrou(P.bia, null, null, resumoDoIdentificador(identificadorNovo()));
  await dono("delete from auth.users where id = $1", [P.bia]);
  return dono("select count(*)::int as n from interno.alumia_navegadores where usuario = $1", [P.bia]);
}, (r) => r.rows[0].n === 0);

console.log(`\n${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
