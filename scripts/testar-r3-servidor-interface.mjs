// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a interface pequena entre a rede social e o servidor do chat separado (onda R3, item 3.1; docs/rede/CHAT-SEPARADO.md), do lado
// do site, sem servidor no ar (o servidor do chat é imitado por um fetch falso que faz a marca com o segredo DELE):
//   - a configuração: endereço interno e token da interface (curto, com letra estranha ou endereço torto = chat no site);
//   - a pergunta da franquia: vai com o token próprio no cabeçalho, leva só as marcas (nenhum campo de conta), e a resposta só vale se
//     vier inteira e com `true` de verdade; rede caída, status de erro, lista curta ou "true" em texto = nulo (a rota diz sem_servico,
//     nunca "confere" por falta de resposta);
//   - a conferência do trecho com a marca conferida de fora: a marca certa passa, a de outro segredo não; sem quem confira e sem
//     segredo, nada confere (a marca de uma chave vazia qualquer um faz);
//   - o endereço do servidor do chat: configuração torta vira o próprio site; o aparelho só aceita o ÚLTIMO endereço anotado no registro
//     público de transparência (linha 'servidor-chat'), e a vista do registro acompanha a troca (e a volta para o site).
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-r3-servidor-interface.mjs
import crypto from "node:crypto";
import { assinarDeclaracao, novoParEd25519 } from "../lib/rede/chat/r2/certificados.ts";
import {
  compromisso, juntar, novaChaveDeFranquia, provaDoPacote, resumoDaCaixa, resumoDoPasseDeDeposito,
} from "../lib/rede/franquia/protocolo.ts";
import { conferirTrecho, marcaDoServidor } from "../lib/rede/franquia/servidor.ts";
import { chatSeparado, conferirMarcasNoChat, nomeDaMarca } from "../lib/rede/caixas/franquia-servidor.ts";
import { caminhoDoChat, enderecoDoChat, enderecoValido, servidorDoChatConfere } from "../lib/rede/caixas/servidor-do-chat.ts";
import { INICIO, atualizarVista, resumoDaLinhaComTipo } from "../lib/rede/chat/transparencia.ts";

let certos = 0;
const falhas = [];
const ok = (nome, cond, detalhe = "") => (cond ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
const sorteio = (n) => new Uint8Array(crypto.randomBytes(n));
const T = (s) => new TextEncoder().encode(s);

// ═══════════════════ 1. A configuração da interface ═══════════════════
const TOKEN = "token-da-interface-de-teste-com-mais-de-32"; // gitleaks:allow (valor de teste)
const SEGREDO_DO_CHAT = "segredo-da-franquia-do-chat-de-teste-32+"; // gitleaks:allow (valor de teste)
const SEGREDO_DA_REDE = "segredo-da-franquia-da-rede-de-teste-32+"; // gitleaks:allow (valor de teste)
const CHAT = chatSeparado("http://chat-interno:8080/", TOKEN);
ok("o endereço interno e o token valem (a barra do fim sai)", CHAT?.endereco === "http://chat-interno:8080" && CHAT?.token === TOKEN);
ok("sem endereço, o chat está no site", chatSeparado("", TOKEN) === null && chatSeparado(undefined, TOKEN) === null);
ok("token curto não vale", chatSeparado("http://chat-interno:8080", "curto") === null);
ok("token com letra fora de [A-Za-z0-9_-] não vale (não vai a cabeçalho)", chatSeparado("http://chat-interno:8080", `${TOKEN} x`) === null && chatSeparado("http://chat-interno:8080", `${TOKEN}\r\nX: 1`) === null);
ok("endereço com caminho, usuário ou outro esquema não vale", ["http://u:s@chat:8080", "ftp://chat", "http://chat/caminho", "javascript:alert(1)"].every((e) => chatSeparado(e, TOKEN) === null));

// ═══════════════════ 2. A pergunta da franquia ═══════════════════
// O servidor do chat imitado: confere o token e responde, para cada marca, se é a marca que ELE faria (com o segredo dele).
const pedidos = [];
function chatFalso({ segredo = SEGREDO_DO_CHAT, token = TOKEN, mexer = (r) => r } = {}) {
  return async (url, init) => {
    pedidos.push({ url, init });
    if (init.headers.Authorization !== `AlumiaInterface ${token}`) return new Response(JSON.stringify({ ok: false, erro: "token" }), { status: 401 });
    const corpo = JSON.parse(init.body);
    const de = (x) => new Uint8Array(Buffer.from(x, "base64url"));
    const confere = corpo.marcas.map((m) => Buffer.from(marcaDoServidor(segredo, de(m.c), de(m.id_h), de(m.pd_h), m.dia)).equals(Buffer.from(de(m.marca))));
    return new Response(JSON.stringify(mexer({ confere })), { status: 200, headers: { "Content-Type": "application/json" } });
  };
}
const marcaNova = (segredo = SEGREDO_DO_CHAT, dia = "2026-11-24") => {
  const c = sorteio(32), idH = sorteio(32), pdH = sorteio(32);
  return { c, idH, pdH, dia, marca: marcaDoServidor(segredo, c, idH, pdH, dia) };
};
const certa = marcaNova(), deOutro = marcaNova(SEGREDO_DA_REDE);
{
  const r = await conferirMarcasNoChat([certa, deOutro], CHAT, chatFalso());
  ok("a marca do chat confere; a feita com outro segredo, não", r?.has(nomeDaMarca(certa)) === true && r?.has(nomeDaMarca(deOutro)) === false && r?.size === 1);
  const p = pedidos.at(-1);
  ok("a pergunta vai ao endereço interno, na rota da interface", p.url === "http://chat-interno:8080/interno/franquia/conferir" && p.init.method === "POST");
  ok("com o token próprio da interface no cabeçalho (não o JWT de serviço da rede)", p.init.headers.Authorization === `AlumiaInterface ${TOKEN}` && !/Bearer|apikey/i.test(JSON.stringify(p.init.headers)));
  const corpo = JSON.parse(p.init.body);
  ok("a pergunta leva só as marcas (nenhum campo de conta, de texto ou de quem denunciou)",
    Object.keys(corpo).join() === "marcas" && corpo.marcas.every((m) => Object.keys(m).sort().join() === "c,dia,id_h,marca,pd_h"));
  ok("sem cache", p.init.cache === "no-store");
}
ok("token errado: o chat recusa e a rota diz sem_servico (nulo), nunca confere", (await conferirMarcasNoChat([certa], CHAT, chatFalso({ token: "outro-token-da-interface-com-mais-de-32" }))) === null);
ok("rede caída = nulo", (await conferirMarcasNoChat([certa], CHAT, async () => { throw new Error("rede"); })) === null);
ok("resposta curta = nulo (não completa com 'confere')", (await conferirMarcasNoChat([certa, deOutro], CHAT, chatFalso({ mexer: () => ({ confere: [true] }) }))) === null);
{
  const r = await conferirMarcasNoChat([deOutro], CHAT, chatFalso({ mexer: () => ({ confere: ["true"] }) }));
  ok("'true' em texto não é confere", r !== null && r.size === 0);
}
ok("resposta sem JSON = nulo", (await conferirMarcasNoChat([certa], CHAT, async () => new Response("<html>", { status: 200 }))) === null);
ok("mais de 10 marcas, ou nenhuma, nem pergunta", (await conferirMarcasNoChat(Array(11).fill(certa), CHAT, chatFalso())) === null && (await conferirMarcasNoChat([], CHAT, chatFalso())) === null);
ok("sem configuração, nem pergunta", (await conferirMarcasNoChat([certa], null, chatFalso())) === null);

// ═══════════════════ 3. O trecho conferido com a marca de fora ═══════════════════
const CONTA_ANA = "00000000-0000-4000-8000-00000000a0a0";
const ID_ANA = novoParEd25519();
const PASSE_DA_ANA = sorteio(32);
const AUTORIA = { conta: CONTA_ANA, identidades: [ID_ANA.publica] };
const TEXTO = "Se você aparecer no ato de quinta, vai se arrepender.";
function trecho(segredo) {
  const id = sorteio(32), dia = "2026-11-20";
  const conteudo = juntar(new Uint8Array([2, 1]), sorteio(70), T(JSON.stringify({ t: TEXTO })));
  const kf = novaChaveDeFranquia();
  const idH = resumoDaCaixa(id);
  const c = compromisso(kf, idH, conteudo);
  const pdH = resumoDoPasseDeDeposito(PASSE_DA_ANA);
  const marca = marcaDoServidor(segredo, c, idH, pdH, dia);
  const autoria = { pdH, declaracao: assinarDeclaracao(ID_ANA, idH, pdH, CONTA_ANA), conta: CONTA_ANA };
  const prova = provaDoPacote({ origem: "conversa", caixa: id, pacote: { franquia: c, marca, dia }, kf, conteudo, autoria });
  return { texto: "vai se arrepender", prova };
}
const HOJE = "2026-11-24";
// A rota faz isto: pergunta ao chat por todas as marcas e passa a resposta como `marcaConfere`.
async function conferirComChat(t, buscar = chatFalso()) {
  const de = (x) => new Uint8Array(Buffer.from(x, "base64"));
  const p = t.prova;
  const m = { c: de(p.c), idH: de(p.caixa), pdH: de(p.pd_h), dia: p.dia, marca: de(p.marca) };
  const certas = await conferirMarcasNoChat([m], CHAT, buscar);
  if (!certas) return { ok: false, motivo: "sem_servico" };
  return conferirTrecho("", t, AUTORIA, HOJE, (c, idH, pdH, dia, marca) => certas.has(nomeDaMarca({ c, idH, pdH, dia, marca })));
}
{
  const doChat = trecho(SEGREDO_DO_CHAT);
  ok("a prova com a marca do servidor do chat confere pela interface", (await conferirComChat(doChat)).ok === true);
  ok("e não confere com o segredo da rede (a rede não tem o do chat)", conferirTrecho(SEGREDO_DA_REDE, doChat, AUTORIA, HOJE).ok === false);
  const daRede = trecho(SEGREDO_DA_REDE);
  const r = await conferirComChat(daRede);
  ok("a marca feita com outro segredo não confere pela interface", r.ok === false && r.motivo === "marca", JSON.stringify(r));
  ok("chat fora do ar: sem_servico, não confere", (await conferirComChat(doChat, async () => { throw new Error("x"); })).motivo === "sem_servico");
  // O ataque: no modo separado a rota usa segredo "" e pergunta ao chat; se a pergunta fosse esquecida, a marca de chave vazia passaria.
  const deChaveVazia = trecho("");
  const sem = conferirTrecho("", deChaveVazia, AUTORIA, HOJE);
  ok("ATAQUE: sem quem confira e sem segredo, a marca de chave vazia NÃO confere", sem.ok === false && sem.motivo === "marca", JSON.stringify(sem));
  ok("a autoria continua conferida no site (outra conta não passa, mesmo com a marca certa)",
    conferirTrecho("", doChat, { conta: "00000000-0000-4000-8000-00000000b0b0", identidades: [ID_ANA.publica] }, HOJE, () => true).ok === false);
}

// ═══════════════════ 4. O endereço do servidor do chat ═══════════════════
ok("vazio = o próprio site (o modo da R2)", enderecoDoChat("") === "" && enderecoDoChat(undefined) === "" && caminhoDoChat("caixa/lote", "") === "/api/alumia/caixa/lote");
ok("o servidor separado recebe as mesmas rotas sem o /api/alumia", caminhoDoChat("caixa/buscar", "https://chat.exemplo.org") === "https://chat.exemplo.org/caixa/buscar");
ok("configuração torta vira o próprio site (nunca um lugar inesperado)", ["http://chat.exemplo.org", "https://chat.exemplo.org/", "https://u@chat.exemplo.org", "https://chat.exemplo.org?x=1", " javascript:1"].every((e) => enderecoDoChat(e) === ""));
ok("o endereço segue a regra do registro (https, sem barra no fim, até 200)", enderecoValido("https://chat.exemplo.org:8443/alumia") && !enderecoValido(`https://${"a".repeat(200)}.org`));
ok("o cofre anônimo só existe no servidor separado", (() => { try { caminhoDoChat("cofre/ler", ""); return false; } catch (e) { return e.message === "cofre_so_no_servidor_do_chat"; } })());
ok("sem linha no registro, só o próprio site vale", servidorDoChatConfere(undefined, "") && !servidorDoChatConfere(undefined, "https://chat.exemplo.org"));
ok("com linha, só o ÚLTIMO endereço anotado vale", servidorDoChatConfere({ endereco: "https://chat.exemplo.org", seq: 4 }, "https://chat.exemplo.org")
  && !servidorDoChatConfere({ endereco: "https://chat.exemplo.org", seq: 4 }, "https://outro.exemplo.org")
  && !servidorDoChatConfere({ endereco: "https://chat.exemplo.org", seq: 4 }, ""));

// A vista do registro: uma corrente com a anotação do servidor, a troca e a volta para o site.
const quem = Buffer.from(crypto.createHash("sha256").update("alumia-kt:servidor-chat").digest()).toString("base64");
const linhas = [];
let anterior = INICIO.resumo;
for (const [i, identidade] of ["sc1:https://chat.exemplo.org", "sc1:https://chat2.exemplo.org", "sc1:"].entries()) {
  const l = { seq: i + 1, tipo: "servidor-chat", quem, identidade, versao: 1, dia: "2026-11-25" };
  const resumo = await resumoDaLinhaComTipo(anterior, l);
  linhas.push({ ...l, resumo });
  anterior = resumo;
}
const registro = (ate) => ({ ponta: async () => ({ seq: ate, resumo: linhas[ate - 1].resumo }), trecho: async (desde) => linhas.slice(desde, ate) });
const v1 = await atualizarVista(INICIO, registro(1));
ok("a vista guarda o endereço anotado", v1.servidorChat?.endereco === "https://chat.exemplo.org" && servidorDoChatConfere(v1.servidorChat, "https://chat.exemplo.org"));
const v2 = await atualizarVista(v1, registro(2));
ok("na troca, o endereço velho deixa de valer", servidorDoChatConfere(v2.servidorChat, "https://chat2.exemplo.org") && !servidorDoChatConfere(v2.servidorChat, "https://chat.exemplo.org"));
const v3 = await atualizarVista(v2, registro(3));
ok("'sc1:' = o chat voltou para o site", servidorDoChatConfere(v3.servidorChat, "") && !servidorDoChatConfere(v3.servidorChat, "https://chat2.exemplo.org"));
const torta = linhas.map((l, i) => (i === 1 ? { ...l, identidade: "sc1:https://mal.exemplo.org" } : l));
ok("ATAQUE: o servidor troca o endereço no passado do registro: a corrente quebra",
  await atualizarVista(v1, { ponta: async () => ({ seq: 3, resumo: linhas[2].resumo }), trecho: async (d) => torta.slice(d, 3) }).then(() => false, (e) => e.message === "kt_quebrado"));

console.log(`\nInterface do servidor do chat (R3): ${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
