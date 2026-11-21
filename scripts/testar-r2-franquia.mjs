// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a denúncia com prova (message franking) da onda R2:
//   1. as primitivas chamadas direto, nos vetores oficiais (HMAC-SHA-256 do RFC 4231, HKDF-SHA-256 do RFC 5869);
//   2. os MESMOS bytes das outras frentes: a marca da rota das caixas e o compromisso da conversa a dois (vetores tirados do código
//      delas em 18/11 e, quando os arquivos delas estão na árvore, conferidos de novo contra o próprio código);
//   3. o protocolo (lib/rede/franquia/protocolo.ts e servidor.ts), com os ataques escritos como teste: texto reescrito, conteúdo
//      trocado, compromisso forjado, marca de outro dia, de outra caixa, de outro passe ou de outro segredo, prova vencida ou do
//      futuro, declaração de quem escreve ausente, de outra conta ou de outra identidade, e o limite dito (conluio de duas contas);
//   4. o banco (supabase/migracoes/20261124-r2-franquia.sql), montado no PGlite com o install.sql do ramo, a migração três vezes,
//      também por cima da versão curta da frente das caixas: só o servidor chama, a prova guardada não liga conta a caixa;
//   5. a rota (app/api/alumia/franquia/denunciar) de ponta a ponta, com o banco de verdade atrás (o fetch do servidor vai ao PGlite),
//      e o ataque da revisão final: qualquer conta deposita pela rota das caixas numa caixa inventada, com passe sorteado, recebe a
//      marca e tenta denunciar "com prova" um texto que ninguém mandou, atribuído a outra pessoa (tem de dar prova_nao_confere).
// Com R2_SEM_MIGRACAO=1, monta o banco sem a migração (mostra o que falhava antes dela).
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-r2-franquia.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hkdf } from "@noble/hashes/hkdf.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import {
  b64, compromisso, conferirCompromisso, iguais, juntar, novaChaveDeFranquia, provaDoPacote, provaInteira, resumoDaCaixa,
  resumoDoPasseDeDeposito, trechoNoConteudo,
} from "../lib/rede/franquia/protocolo.ts";
import { assinarDeclaracao, novoParEd25519 } from "../lib/rede/chat/r2/certificados.ts";
import { chaveDoDia, conferirDenuncia, conferirTrecho, diaValido, marcaDoServidor, segredoDaFranquia } from "../lib/rede/franquia/servidor.ts";
import { criarBanco } from "./banco-local.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const existe = (c) => fs.existsSync(path.join(raiz, c));
const SEM_MIGRACAO = process.env.R2_SEM_MIGRACAO === "1";

let certos = 0;
const falhas = [];
const ok = (nome, cond, detalhe = "") => (cond ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 400)}`);
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
const hex = (b) => Buffer.from(b).toString("hex");
const deHex = (h) => new Uint8Array(Buffer.from(h, "hex"));
const T = (s) => new TextEncoder().encode(s);
const sorteio = (n) => crypto.getRandomValues(new Uint8Array(n));

// ═══════════════════ 0. Os arquivos ═══════════════════
const SQL = ler("supabase/migracoes/20261124-r2-franquia.sql");
const ARQUIVOS = ["lib/rede/franquia/protocolo.ts", "lib/rede/franquia/servidor.ts", "lib/rede/franquia/cliente.ts", "app/api/alumia/franquia/denunciar/route.ts"];
const CODIGO = ARQUIVOS.map(ler).join("\n");
ok("a migração termina trancando as funções na porta da Alumia", /select interno\.alumia_trancar\(\);\s*$/.test(SQL));
ok("não mexe na versão da Alumia", !/function public\.rede_alumia_versao/.test(SQL));
ok("nenhum parâmetro do tipo linha com valor padrão", !/interno\.[a-z_]+ default/.test(SQL));
ok("nenhuma permissão direta em tabela para anon ou authenticated", !/grant [a-z, ]+ on (table )?interno\./i.test(SQL));
ok("toda função tem search_path fixo; as que mexem no banco são security definer", (() => {
  const funcoes = SQL.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  return funcoes.length === 4 && funcoes.every((f) => /set search_path = interno, pg_temp/.test(f)) && funcoes.filter((f) => /security definer/.test(f)).length === 3;
})());
ok("nada escreve 'Rede Lúcia'", !/Rede Lúcia/.test(SQL.replace(/^--.*$/gm, "")));
ok("nenhum Math.random no código da franquia", !/Math\.random/.test(CODIGO));
ok("o segredo da franquia não sai para o navegador (sem NEXT_PUBLIC)", !/NEXT_PUBLIC_[A-Z_]*FRANQUIA/.test(CODIGO));
ok("a rota não lê endereço de rede nem escreve em log", !/x-forwarded-for|cf-connecting-ip|x-real-ip|console\./i.test(ler("app/api/alumia/franquia/denunciar/route.ts")));
ok("o código do navegador não importa o lado do servidor", ["lib/rede/franquia/cliente.ts", "lib/rede/franquia/protocolo.ts", "components/rede/franquia/DenunciaComProva.tsx"].every((c) => !/franquia\/servidor/.test(ler(c))));
ok("a rota da denúncia não chama nenhuma função das caixas (não liga a conta de quem denuncia a uma caixa)", !/rede_caixa_|rede_diretorio_/.test(ler("app/api/alumia/franquia/denunciar/route.ts")));

// ═══════════════════ 1. Vetores oficiais das primitivas chamadas direto ═══════════════════
ok("RFC 4231 caso 1 (HMAC-SHA-256)", hex(hmac(sha256, new Uint8Array(20).fill(0x0b), T("Hi There"))) === "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7");
ok("RFC 4231 caso 2 (HMAC-SHA-256)", hex(hmac(sha256, T("Jefe"), T("what do ya want for nothing?"))) === "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843");
ok("RFC 5869 caso 1 (HKDF-SHA-256)", hex(hkdf(sha256, new Uint8Array(22).fill(0x0b), deHex("000102030405060708090a0b0c"), deHex("f0f1f2f3f4f5f6f7f8f9"), 42))
  === "3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865");
ok("RFC 5869 caso 3 (HKDF-SHA-256, sem sal e sem info: o caso da chave do dia, que não tem sal)", hex(hkdf(sha256, new Uint8Array(22).fill(0x0b), undefined, new Uint8Array(0), 42))
  === "8da4e775a563c18f715f802a063c5a31b8a11f5c5ee1879ec3454e5f3c738d2d9d201395faa4b61a96c8");

// ═══════════════════ 2. Os mesmos bytes das outras frentes ═══════════════════
const SEGREDO = "segredo-da-franquia-de-teste-com-mais-de-32-letras"; // gitleaks:allow (valor de teste)
{
  // Vetores tirados em 18/11 do código da frente das caixas (marcaDoServidor) e da conversa a dois (compromisso), com estes valores.
  const c = new Uint8Array(32).fill(1), idH = new Uint8Array(32).fill(2), kf = new Uint8Array(32).fill(3), pdH = new Uint8Array(32).fill(4);
  const conteudo = T('\x02\x01{"t":"Olá, \\"mundo\\"\\nfim"}');
  ok("a marca v2 prende o resumo do passe (vetor, 18/11)", hex(marcaDoServidor(SEGREDO, c, idH, pdH, "2026-11-20")) === "6f5291c8f22f7b6df56607a7b9e6a9d75b93446a0e810e553375d66d424a9443");
  ok("a marca v2 refeita à parte com as primitivas: HMAC(HKDF(segredo, dia), rótulo ‖ c ‖ id_h ‖ pd_h ‖ dia)",
    hex(hmac(sha256, hkdf(sha256, T(SEGREDO), undefined, T("alumia/r2/marca/chave/v1|2026-11-20"), 32), juntar(T("alumia/r2/marca/v2"), c, idH, pdH, T("2026-11-20"))))
      === hex(marcaDoServidor(SEGREDO, c, idH, pdH, "2026-11-20")));
  ok("outro passe apresentado, outra marca", hex(marcaDoServidor(SEGREDO, c, idH, new Uint8Array(32).fill(5), "2026-11-20")) !== hex(marcaDoServidor(SEGREDO, c, idH, pdH, "2026-11-20")));
  ok("o resumo do passe é o mesmo do banco das caixas: SHA-256('alumia/r2/passe-deposito' ‖ pd)", hex(resumoDoPasseDeDeposito(new Uint8Array(32))) === hex(sha256(juntar(T("alumia/r2/passe-deposito"), new Uint8Array(32)))));
  ok("o compromisso é o mesmo da conversa a dois e das caixas (vetor)", hex(compromisso(kf, idH, conteudo)) === "85f567b91244d0abcc94e564c441d99617d3797f15bc6c03edb3babf8ba3f94d");
  ok("o resumo da caixa é o mesmo do banco das caixas: SHA-256('alumia/r2/caixa' ‖ id)", hex(resumoDaCaixa(new Uint8Array(32))) === hex(sha256(juntar(T("alumia/r2/caixa"), new Uint8Array(32)))));
  ok("um trecho com aspas e quebra de linha acha a forma escapada do JSON", trechoNoConteudo(conteudo, 'Olá, "mundo"\nfim') && trechoNoConteudo(conteudo, "mundo"));
  // Depois da junção, os arquivos das outras frentes estão aqui: confere contra o código delas, não só contra o vetor.
  const outra = async (arquivo) => (existe(arquivo) ? import(pathToFileURL(path.join(raiz, arquivo)).href) : null);
  const servidorDasCaixas = await outra("lib/rede/caixas/franquia-servidor.ts");
  if (servidorDasCaixas?.marcaDoServidor) {
    const x = sorteio(32), y = sorteio(32), z = sorteio(32);
    ok("JUNÇÃO: a marca é igual à da rota das caixas (código delas)", hex(servidorDasCaixas.marcaDoServidor(SEGREDO, x, y, z, "2026-11-21")) === hex(marcaDoServidor(SEGREDO, x, y, z, "2026-11-21")));
  }
  const conversa = await outra("lib/rede/chat/r2/conversa.ts");
  if (conversa?.compromisso) {
    const k = sorteio(32), y = sorteio(32), z = sorteio(300);
    ok("JUNÇÃO: o compromisso é igual ao da conversa a dois (código dela)", hex(conversa.compromisso(k, y, z)) === hex(compromisso(k, y, z)));
  }
}

// ═══════════════════ 3. O protocolo e os ataques ═══════════════════
ok("sem segredo, ou curto, nada se confere", segredoDaFranquia("") === null && segredoDaFranquia("curto") === null && segredoDaFranquia(SEGREDO) === SEGREDO);
ok("a chave da franquia vem do sorteio (duas nunca iguais)", hex(novaChaveDeFranquia()) !== hex(novaChaveDeFranquia()) && novaChaveDeFranquia().length === 32);
ok("chaves de dias diferentes são diferentes", hex(chaveDoDia(SEGREDO, "2026-11-20")) !== hex(chaveDoDia(SEGREDO, "2026-11-21")));
ok("dia que não existe é recusado", !diaValido("2026-02-31") && diaValido("2026-02-28"));
ok("a comparação de MAC recusa tamanho diferente e um byte trocado", iguais(T("abc"), T("abc")) && !iguais(T("abc"), T("abd")) && !iguais(T("ab"), T("abc")));
ok("a comparação de MAC não sai no meio do laço (tempo constante)", (() => {
  const corpo = ler("lib/rede/franquia/protocolo.ts").replace(/\r\n/g, "\n").split("export function iguais")[1].split("\n}\n")[0];
  return /d \|= a\[i\] \^ b\[i\]/.test(corpo) && (corpo.match(/return/g) ?? []).length === 2;
})());

const HOJE = "2026-11-24";
// Quem escreve: a Ana, com a identidade da conta dela (a que o registro público das chaves mostra) e o SEU passe de escrita.
const CONTA_ANA = "00000000-0000-4000-8000-00000000a0a0";
const ID_ANA = novoParEd25519();
const PASSE_DA_ANA = sorteio(32);
const AUTORIA_ANA = { conta: CONTA_ANA, identidades: [ID_ANA.publica] };
/**
 * Monta uma mensagem como a conversa a dois faria (bloco com o corpo em JSON), o pacote como a rota das caixas marcaria (com o
 * resumo do passe APRESENTADO) e a prova como o aparelho de quem recebe guarda (com a declaração de quem escreveu, se houver).
 */
function mensagem({ texto, id = sorteio(32), dia = "2026-11-20", origem = "conversa", conta = CONTA_ANA, identidade = ID_ANA, passe = PASSE_DA_ANA, declarado = passe, comDeclaracao = origem === "conversa" }) {
  const conteudo = juntar(new Uint8Array([2, 1]), sorteio(70), T(JSON.stringify({ t: texto })));
  const kf = novaChaveDeFranquia();
  const idH = resumoDaCaixa(id);
  const c = compromisso(kf, idH, conteudo);
  const marca = marcaDoServidor(SEGREDO, c, idH, resumoDoPasseDeDeposito(passe), dia);
  const pdH = resumoDoPasseDeDeposito(declarado);
  const autoria = comDeclaracao ? { pdH, declaracao: assinarDeclaracao(identidade, idH, pdH, conta), conta } : null;
  const prova = provaDoPacote({ origem, caixa: id, pacote: { franquia: c, marca, dia }, kf, conteudo, autoria });
  return { prova, id, idH, conteudo, kf, c, marca };
}
const conferir = (t, hoje = HOJE, segredo = SEGREDO, autoria = AUTORIA_ANA) => conferirTrecho(segredo, t, autoria, hoje);
const r = (x) => (x.ok ? "ok" : x.motivo);

const TEXTO = "Se você aparecer no ato de quinta, vai se arrepender. Sei onde você mora.";
const m = mensagem({ texto: TEXTO });
ok("a prova do pacote: o compromisso confere com a chave e o conteúdo de dentro do cifrado", m.prova !== null && conferirCompromisso(m.kf, m.idH, m.conteudo, m.c) && provaInteira(m.prova));
ok("a prova não guarda o id cru da caixa (só o resumo)", m.prova.caixa === b64(m.idH) && !JSON.stringify(m.prova).includes(b64(m.id)));
ok("pacote sem franquia ou sem marca não vira prova", provaDoPacote({ origem: "conversa", caixa: m.id, pacote: { franquia: null, marca: m.marca, dia: "2026-11-20" }, kf: m.kf, conteudo: m.conteudo }) === null
  && provaDoPacote({ origem: "conversa", caixa: m.id, pacote: { franquia: m.c, marca: null, dia: "2026-11-20" }, kf: m.kf, conteudo: m.conteudo }) === null);
ok("ATAQUE servidor que troca a franquia do pacote: o aparelho não aceita como prova", provaDoPacote({ origem: "conversa", caixa: m.id, pacote: { franquia: sorteio(32), marca: m.marca, dia: "2026-11-20" }, kf: m.kf, conteudo: m.conteudo }) === null);
ok("o compromisso não diz nada do texto sem a chave (o mesmo texto, outra chave, outro compromisso)", hex(compromisso(novaChaveDeFranquia(), m.idH, m.conteudo)) !== hex(m.c));
ok("a mensagem inteira confere", (() => { const x = conferir({ texto: TEXTO, prova: m.prova }); return x.ok && x.texto === TEXTO && x.origem === "conversa"; })());
ok("cortar pode (um pedaço da mensagem)", conferir({ texto: "Sei onde você mora.", prova: m.prova }).ok);
ok("o mesmo texto em outra forma Unicode (NFD) confere", conferir({ texto: TEXTO.normalize("NFD"), prova: m.prova }).ok);
ok("ATAQUE reescrever: trocar uma palavra é recusado", r(conferir({ texto: TEXTO.replace("vai se arrepender", "vai morrer"), prova: m.prova })) === "trecho");
ok("ATAQUE conteúdo trocado: outro conteúdo com o mesmo compromisso é recusado", r(conferir({ texto: "Oi", prova: { ...m.prova, conteudo: b64(T("Oi, tudo bem?")) } })) === "compromisso");
{
  // Quem denuncia escolhe outra chave e faz o compromisso de um texto inventado: a marca do servidor não bate.
  const kf2 = novaChaveDeFranquia();
  const inventado = T("Texto que a Ana nunca mandou.");
  ok("ATAQUE compromisso forjado com outra chave: a marca do servidor não bate", r(conferir({ texto: "Texto que a Ana nunca mandou.", prova: { ...m.prova, kf: b64(kf2), conteudo: b64(inventado), c: b64(compromisso(kf2, m.idH, inventado)) } })) === "marca");
  ok("ATAQUE marca inventada por quem denuncia (sem o segredo)", r(conferir({ texto: TEXTO, prova: { ...m.prova, marca: b64(hmac(sha256, sorteio(32), m.c)) } })) === "marca");
}
ok("ATAQUE marca de outro dia: recusada", r(conferir({ texto: TEXTO, prova: { ...m.prova, dia: "2026-11-21" } })) === "marca");
ok("ATAQUE servidor com outro segredo: a marca não bate", r(conferir({ texto: TEXTO, prova: m.prova }, HOJE, `${SEGREDO}-outro`)) === "marca");
ok("ATAQUE outra caixa no lugar: a declaração (e a marca) não batem", r(conferir({ texto: TEXTO, prova: { ...m.prova, caixa: b64(sorteio(32)) } })) === "autoria");
ok("prova com mais de 90 dias: recusada", r(conferir({ texto: TEXTO, prova: m.prova }, "2027-02-20")) === "prazo");
ok("prova do futuro: recusada", r(conferir({ texto: TEXTO, prova: m.prova }, "2026-11-19")) === "prazo");
ok("ATAQUE formato: base64 quebrado e campos do tamanho errado", r(conferir({ texto: TEXTO, prova: { ...m.prova, kf: "@@@" } })) === "formato" && r(conferir({ texto: TEXTO, prova: { ...m.prova, c: b64(sorteio(31)) } })) === "formato");
ok("ATAQUE formato: origem desconhecida, versão errada, prova ausente", r(conferir({ texto: TEXTO, prova: { ...m.prova, origem: "outra" } })) === "formato"
  && r(conferir({ texto: TEXTO, prova: { ...m.prova, v: 2 } })) === "formato" && r(conferir({ texto: TEXTO })) === "formato" && r(conferir(null)) === "formato");
ok("ATAQUE trecho vazio ou só espaços", r(conferir({ texto: "   ", prova: m.prova })) === "trecho");
ok("ATAQUE trecho com mais de 1000 letras", r(conferir({ texto: "a".repeat(1001), prova: m.prova })) === "trecho");
ok("ATAQUE um tipo de prova não passa por outro: o compromisso não serve de marca", r(conferir({ texto: TEXTO, prova: { ...m.prova, marca: m.prova.c } })) === "marca");
ok("o trecho é procurado byte a byte (não por letra parecida)", trechoNoConteudo(T("ação"), "ação") && !trechoNoConteudo(T("acao"), "ação"));
{
  // A Bia criou a própria caixa de entrada, mas o passe de ESCRITA nela é o da Ana (a Bia só recebeu o resumo). Ela deposita ali
  // um texto inventado com outro passe: o depósito "passa" (o bloqueio não se denuncia), mas a marca prende o passe dela, não o
  // que a Ana declarou.
  const forjada = mensagem({ texto: "Eu, Ana, confesso tudo.", id: m.id, passe: sorteio(32), declarado: PASSE_DA_ANA });
  ok("ATAQUE quem lê a caixa deposita nela com outro passe e usa a declaração da Ana: a marca não bate",
    r(conferir({ texto: "Eu, Ana, confesso tudo.", prova: forjada.prova })) === "marca");
  // E se ela puser o resumo do passe dela na prova, a declaração da Ana não cobre esse passe.
  const comOPasseDela = { ...forjada.prova, pd_h: b64(resumoDoPasseDeDeposito(sorteio(32))) };
  ok("ATAQUE ... e troca o pd_h da prova pelo do passe dela: a declaração não confere", r(conferir({ texto: "Eu, Ana, confesso tudo.", prova: comOPasseDela })) === "autoria");
  // Declaração feita pela própria Bia (outra identidade), dizendo que é da Ana.
  const BIA = novoParEd25519();
  const daBia = mensagem({ texto: "Eu, Ana, confesso tudo.", identidade: BIA });
  ok("ATAQUE declaração assinada por outra identidade, em nome da Ana: recusada", r(conferir({ texto: "Eu, Ana, confesso tudo.", prova: daBia.prova })) === "autoria");
  ok("ATAQUE declaração da Ana para outra conta (a prova diz uma conta, a denúncia outra): recusada",
    r(conferir({ texto: TEXTO, prova: m.prova }, HOJE, SEGREDO, { conta: "00000000-0000-4000-8000-00000000b1b1", identidades: [ID_ANA.publica] })) === "autoria");
  ok("ATAQUE prova sem declaração: recusada", r(conferir({ texto: TEXTO, prova: { ...m.prova, declaracao: undefined } })) === "autoria");
  ok("conta sem identidade no registro: recusada", r(conferir({ texto: TEXTO, prova: m.prova }, HOJE, SEGREDO, null)) === "autoria");
  ok("a identidade antiga da conta (de antes de uma troca) ainda vale para a declaração de antes",
    conferir({ texto: TEXTO, prova: m.prova }, HOJE, SEGREDO, { conta: CONTA_ANA, identidades: [novoParEd25519().publica, ID_ANA.publica] }).ok);
  // O LIMITE que fica: duas contas em conluio. Se a Ana entrega o passe dela à Bia, a Bia deposita em nome da Ana, mas só da Ana.
  const conluio = mensagem({ texto: "Combinado entre as duas.", id: m.id });
  ok("LIMITE conluio: quem tem o passe e a declaração de quem escreve deposita em nome dela (só dela, nunca de uma terceira)",
    conferir({ texto: "Combinado entre as duas.", prova: conluio.prova }).ok);
}
{
  const g = mensagem({ texto: "Mensagem do grupo.", origem: "grupo" });
  ok("grupo: sem declaração por conta, não sai com prova de autoria", r(conferir({ texto: "grupo", prova: g.prova })) === "autoria");
}
const deHoje = mensagem({ texto: TEXTO, dia: new Date().toISOString().slice(0, 10) });
ok("a conferência inteira: com_prova", conferirDenuncia({ trechos: [{ texto: TEXTO, prova: deHoje.prova }] }, AUTORIA_ANA, SEGREDO) === "com_prova");
ok("a conferência inteira: um trecho ruim derruba tudo", conferirDenuncia({ trechos: [{ texto: TEXTO, prova: deHoje.prova }, { texto: "inventado", prova: deHoje.prova }] }, AUTORIA_ANA, SEGREDO) === "sem_prova");
ok("a conferência inteira: sem segredo, sem prova", conferirDenuncia({ trechos: [{ texto: TEXTO, prova: deHoje.prova }] }, AUTORIA_ANA, null) === "sem_prova");
ok("a conferência inteira: sem autoria, sem prova", conferirDenuncia({ trechos: [{ texto: TEXTO, prova: deHoje.prova }] }, null, SEGREDO) === "sem_prova");
ok("a conferência inteira: lista vazia, sem prova", conferirDenuncia({ trechos: [] }, AUTORIA_ANA, SEGREDO) === "sem_prova");

// ═══════════════════ 4. O banco ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const um = async (s, v = []) => (await dono(s, v)).rows[0];
const linhas = async (s, v = []) => (await dono(s, v)).rows;
const como = (sub) => ({ papel: "authenticated", sub, aal: "aal2", ip: "198.51.100.10" });
const SERVICO = { papel: "service_role" };
const ANON = { papel: "anon" };

const itemAntes = (await um("select pg_get_functiondef('interno.rede3_mod_item(interno.rede_denuncias)'::regprocedure) as d")).d;
if (!SEM_MIGRACAO) {
  // A frente das caixas define a mesma função com outro nome no primeiro parâmetro (p_quem); a dela roda antes (ordem dos arquivos).
  await espera("a versão curta das caixas (p_quem) no banco antes, como na ordem das migrações", () =>
    exec("drop function if exists public.rede_franquia_denunciar(uuid, jsonb); create or replace function public.rede_franquia_denunciar(p_quem uuid, p jsonb) returns jsonb language sql security definer set search_path = interno, pg_temp as $$ select '{}'::jsonb $$;"));
  await espera("a migração instala por cima (substitui a das caixas)", () => exec(SQL));
  await espera("de novo (idempotente)", () => exec(SQL));
  await espera("e uma terceira vez sem estrago", () => exec(SQL));
}
await espera("nenhuma função da rede ficou sem a porta", () => um("select interno.alumia_trancar() as r"), (x) => Array.isArray(x.r.abertas) && x.r.abertas.length === 0);
await espera("uma definição só de cada função, com o parâmetro p_usuario", () => linhas(`select p.proname, count(*)::int n, min(pg_get_function_arguments(p.oid)) a from pg_proc p
  where p.proname in ('rede_franquia_denunciar', 'rede3_mod_item', 'rede_franquia_prova_ok', 'rede_franquia_autoria') group by 1`),
  (x) => x.length === 4 && x.every((y) => y.n === 1) && x.find((y) => y.proname === "rede_franquia_denunciar").a.startsWith("p_usuario uuid"));
await espera("o item da fila redefinido continua inteiro (cada linha do corpo de antes segue lá)", () => um("select pg_get_functiondef('interno.rede3_mod_item(interno.rede_denuncias)'::regprocedure) as d"), (x) => {
  const antes = itemAntes.split("\n").map((l) => l.trim()).filter((l) => l && !/corpo_grupo/.test(l));
  return antes.every((l) => x.d.includes(l)) && x.d.includes("'prova'");
});
await espera("permissões: só a chave de serviço chama a denúncia com prova; ninguém de fora chama as de dentro", () => um(`select
    has_function_privilege('anon', 'public.rede_franquia_denunciar(uuid, jsonb)', 'execute') a1,
    has_function_privilege('authenticated', 'public.rede_franquia_denunciar(uuid, jsonb)', 'execute') a2,
    has_function_privilege('service_role', 'public.rede_franquia_denunciar(uuid, jsonb)', 'execute') a3,
    has_function_privilege('authenticated', 'interno.rede_franquia_prova_ok(jsonb)', 'execute') a4,
    has_function_privilege('anon', 'interno.rede3_mod_item(interno.rede_denuncias)', 'execute') a5,
    has_function_privilege('anon', 'public.rede_franquia_autoria(text)', 'execute') a6,
    has_function_privilege('authenticated', 'public.rede_franquia_autoria(text)', 'execute') a7,
    has_function_privilege('service_role', 'public.rede_franquia_autoria(text)', 'execute') a8`), (x) => !x.a1 && !x.a2 && x.a3 && !x.a4 && !x.a5 && !x.a6 && !x.a7 && x.a8);
await espera("a coluna nova não guarda caixa, marca, compromisso, chave, passe nem endereço de rede", () => linhas(`select column_name, data_type from information_schema.columns
  where table_schema = 'interno' and table_name = 'rede_denuncias'`), (x) => x.some((c) => c.column_name === "prova")
  && !x.some((c) => /inet|cidr|bytea/.test(c.data_type) || /(^|_)(ip|caixa|marca|kf|passe|id_h|pd_h)($|_)/.test(c.column_name)));

const P = {};
for (const nome of ["ana", "bia", "caio", "suspensa", "mod"]) {
  P[nome] = await criarUsuario(`${nome}@r2franquia.local`, `Pessoa ${nome}`);
  await rpc(como(P[nome]), "eu");
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
await dono("delete from interno.papeis");
await dono("insert into interno.papeis (usuario, papel) values ($1, 'mediacao')", [P.mod]);
for (const nome of Object.keys(P)) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1, rede_modo = 'aberto' where id = $1", [P[nome], `Codinome ${nome}`, `c_${nome}`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
await dono("update interno.perfis set suspenso = true where id = $1", [P.suspensa]);
await dono("update auth.users set created_at = now() - interval '30 days'");

// A identidade da conta da Ana no registro público das chaves (o gatilho do diretório faz isto quando o aparelho publica a conta).
await dono("select interno.rede_kt_acrescentar('conta', interno.rede_kt_quem($1), 'r2:' || encode($2::bytea, 'base64'), 1)", [P.ana, Buffer.from(ID_ANA.publica)]);
await espera("a autoria: o banco devolve a conta do @ e as identidades dela no registro", () => rpc(SERVICO, "rede_franquia_autoria", { p_autor: "@c_ana" }),
  (x) => x?.conta === P.ana && x.identidades.length === 1 && x.identidades[0] === Buffer.from(ID_ANA.publica).toString("base64"));
await espera("a autoria: @ sem identidade no registro, ou que não existe, devolve nulo", async () => [await rpc(SERVICO, "rede_franquia_autoria", { p_autor: "c_bia" }), await rpc(SERVICO, "rede_franquia_autoria", { p_autor: "ninguem_aqui" })],
  (x) => x[0] === null && x[1] === null);
await recusa("a autoria: só o servidor do site chama", () => rpc(como(P.bia), "rede_franquia_autoria", { p_autor: "c_ana" }), "permission denied");
const guardavel = (texto = TEXTO, origem = "conversa", dia = "2026-11-20") => [{ texto, dia, origem }];
const denuncia = (quem, extra = {}) => rpc(SERVICO, "rede_franquia_denunciar", { p_usuario: P[quem], p: { categoria: "ameaca", autor: "c_ana", prova: guardavel(), ...extra } });

await recusa("quem tem conta não chama direto (sem o servidor conferir a prova)", () => rpc(como(P.bia), "rede_franquia_denunciar", { p_usuario: P.bia, p: { categoria: "ameaca", autor: "c_ana", prova: guardavel() } }), "permission denied");
await recusa("visitante também não", () => rpc(ANON, "rede_franquia_denunciar", { p_usuario: P.bia, p: {} }), "permission denied");
const d1 = await espera("o servidor grava a denúncia com prova da Bia contra a Ana", () => denuncia("bia"), (x) => x?.protocolo && x.ja === false && x.prioridade === 1);
await espera("a linha guardada: perfil da Ana, quem = Bia, a prova só com texto, dia e origem", () => um("select alvo_tipo, alvo, quem, prova from interno.rede_denuncias where protocolo = $1", [d1?.protocolo]),
  (x) => x.alvo_tipo === "perfil" && x.alvo === P.ana && x.quem === P.bia && x.prova.length === 1 && Object.keys(x.prova[0]).sort().join(",") === "dia,origem,texto");
await espera("campo a mais que chegue (caixa, marca, chave) é descartado, nunca gravado", async () => {
  await denuncia("bia", { prova: [{ texto: "Outro trecho.", dia: "2026-11-21", origem: "conversa", caixa: "abc", marca: "def", kf: "ghi" }] });
  return um("select prova::text p from interno.rede_denuncias where protocolo = $1", [d1?.protocolo]);
}, (x) => !/caixa|marca|"kf"|abc|def|ghi/.test(x.p));
await espera("de novo, com o mesmo trecho: entra na mesma denúncia (sem repetir o igual)", () => denuncia("bia"), (x) => x?.ja === true && x.protocolo === d1?.protocolo);
await espera("a denúncia tem os dois trechos", () => um("select jsonb_array_length(prova) n from interno.rede_denuncias where protocolo = $1", [d1?.protocolo]), (x) => x.n === 2);
await recusa("ATAQUE gravar direto uma prova com a caixa: a regra da tabela recusa", () =>
  dono("update interno.rede_denuncias set prova = '[{\"texto\":\"x\",\"dia\":\"2026-11-20\",\"origem\":\"conversa\",\"caixa\":\"abc\"}]' where protocolo = $1", [d1?.protocolo]), "rede_denuncias_prova");
await recusa("origem desconhecida", () => denuncia("caio", { autor: "c_bia", prova: [{ texto: "x", dia: "2026-11-20", origem: "total" }] }), "invalido:prova");
await recusa("dia fora do formato", () => denuncia("caio", { autor: "c_bia", prova: [{ texto: "x", dia: "ontem", origem: "conversa" }] }), "invalido:prova");
await recusa("prova vazia", () => denuncia("caio", { autor: "c_bia", prova: [] }), "invalido:prova");
await recusa("prova que não é lista", () => denuncia("caio", { autor: "c_bia", prova: { texto: "x" } }), "invalido:prova");
await recusa("mais de 10 trechos", () => denuncia("caio", { autor: "c_bia", prova: Array.from({ length: 11 }, (_, i) => ({ texto: `t${i}`, dia: "2026-11-20", origem: "conversa" })) }), "invalido:prova");
await recusa("trecho com mais de 1000 letras", () => denuncia("caio", { autor: "c_bia", prova: guardavel("a".repeat(1001)) }), "invalido:prova");
await recusa("categoria desconhecida", () => denuncia("caio", { categoria: "chato" }), "invalido:categoria");
await recusa("denunciar a si mesma", () => denuncia("ana"), "sem_permissao");
await recusa("conta suspensa não denuncia", () => denuncia("suspensa"), "sem_permissao");
await recusa("@ que não existe", () => denuncia("caio", { autor: "ninguem_aqui" }), "nao_encontrado");
await recusa("post que não é cifrado (ou não é do @)", async () => {
  const { id } = await um("insert into interno.rede_posts (autor, texto) values ($1, 'Um post aberto.') returning id", [P.ana]);
  return denuncia("caio", { post: id, prova: guardavel("x", "post") });
}, "nao_encontrado");
await espera("post cifrado de grupo (de antes da R2, ainda na linha): a denúncia fica no post", async () => {
  const { id } = await um("insert into interno.rede_posts (autor, texto, grupo, corpo_grupo) values ($1, '', 'comunidade:teste', 'p2.3.dmV0b3I.Y2lmcmFkbw') returning id", [P.ana]);
  const x = await denuncia("caio", { post: id, prova: guardavel("Trecho do post.", "post") });
  const linha = await um("select alvo_tipo, alvo from interno.rede_denuncias where protocolo = $1", [x.protocolo]);
  return linha.alvo_tipo === "post" && linha.alvo === id;
}, (x) => x === true);
let postCifrado = null;
await espera("post cifrado sem o @: o banco tira o autor do próprio post", async () => {
  postCifrado = (await um("insert into interno.rede_posts (autor, texto, grupo, corpo_grupo) values ($1, '', 'comunidade:teste', 'p2.3.dmV0b3I.Y2lmcmFkbw') returning id", [P.ana])).id;
  await dono("delete from interno.rede_denuncias where quem = $1 and alvo = $2", [P.bia, postCifrado]);
  const x = await denuncia("bia", { autor: "", post: postCifrado, prova: guardavel("Do post.", "post") });
  return um("select alvo_tipo, alvo from interno.rede_denuncias where protocolo = $1", [x.protocolo]);
}, (x) => x.alvo_tipo === "post" && x.alvo === postCifrado);
await recusa("ATAQUE post cifrado com o @ de outra pessoa: não é o autor do post", () => denuncia("caio", { autor: "c_bia", post: postCifrado, prova: guardavel("x", "post") }), "nao_encontrado");
await recusa("a autora não denuncia o próprio post", () => denuncia("ana", { autor: "", post: postCifrado, prova: guardavel("x", "post") }), "sem_permissao");
await recusa("sem @ e sem post: ninguém a denunciar", () => denuncia("caio", { autor: "" }), "nao_encontrado");
await espera("a fila da moderação e o painel único mostram a prova", async () => {
  const d = await um("select interno.rede3_mod_item(d) as i from interno.rede_denuncias d where protocolo = $1", [d1?.protocolo]);
  return d.i;
}, (i) => Array.isArray(i.prova) && i.prova.length === 2 && i.prova[0].texto === TEXTO);
await espera("e a fila de quem modera (rede_mod_fila) traz o campo", () => rpc(como(P.mod), "rede_mod_fila", {}), (x) => {
  const lista = Array.isArray(x) ? x : (x?.itens ?? x?.denuncias ?? []);
  return lista.some((i) => Array.isArray(i.prova));
});
await espera("a fila não traz quem denunciou", () => rpc(como(P.mod), "rede_mod_fila", {}), (x) => !JSON.stringify(x).includes(P.bia));
await espera("teto: 20 denúncias por hora por pessoa", async () => {
  await dono("delete from interno.rede_denuncias where quem = $1", [P.caio]);
  const alvos = [];
  for (let i = 0; i < 20; i++) {
    const id = await criarUsuario(`alvo${i}@r2franquia.local`, `Alvo ${i}`);
    await rpc(como(id), "eu");
    await dono("update interno.perfis set rede_handle = $2, rede_modo = 'aberto' where id = $1", [id, `alvo_${i}`]);
    alvos.push(`alvo_${i}`);
  }
  for (const a of alvos) await denuncia("caio", { autor: a });
  try {
    await denuncia("caio", { autor: "c_bia" });
    return "passou";
  } catch (e) {
    return String(e.message);
  }
}, (x) => x.includes("muitos_pedidos"));

// ═══════════════════ 5. A rota, de ponta a ponta ═══════════════════
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://banco.teste.invalid";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "chave-publica-de-teste"; // gitleaks:allow (valor de teste)
process.env.SUPABASE_SERVICE_ROLE_KEY = "chave-de-servico-de-teste"; // gitleaks:allow (valor de teste)
process.env.ALUMIA_FRANQUIA_SEGREDO = SEGREDO;
const TOKENS = { "token-da-bia-0123456789": P.bia, "token-do-caio-0123456789": P.caio };
const chamadasAoBanco = [];
const fetchDeVerdade = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.endsWith("/auth/v1/user")) {
    const id = TOKENS[String(init.headers?.Authorization ?? "").replace(/^Bearer /, "")];
    return id ? Response.json({ id, email_confirmed_at: "2026-11-01" }) : new Response("{}", { status: 401 });
  }
  const m2 = /\/rest\/v1\/rpc\/([a-z_]+)$/.exec(u);
  if (m2) {
    chamadasAoBanco.push({ funcao: m2[1], corpo: init.body });
    try {
      return Response.json(await rpc(SERVICO, m2[1], JSON.parse(init.body)));
    } catch (e) {
      return Response.json({ message: String(e.message).replace(/^.*?(?=[a-z_:]+$)/, "") }, { status: 400 });
    }
  }
  return fetchDeVerdade(url, init);
};
const { POST } = await import("../app/api/alumia/franquia/denunciar/route.ts");
const postar = (corpo, token = "token-da-bia-0123456789", extra = {}) => POST(new Request("https://alumia.teste.invalid/api/alumia/franquia/denunciar", {
  method: "POST", headers: { "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra }, body: JSON.stringify(corpo),
})).then(async (x) => ({ status: x.status, ...(await x.json()), cache: x.headers.get("cache-control") }));

const daAna = mensagem({ texto: "Se você for ao ato, apanha.", dia: new Date().toISOString().slice(0, 10), conta: P.ana });
await espera("sem sessão: entre primeiro", () => postar({}, null), (x) => x.status === 401 && x.motivo === "entre_primeiro");
await espera("de outra origem: recusa", () => postar({}, "token-da-bia-0123456789", { "Sec-Fetch-Site": "cross-site" }), (x) => x.status === 403);
await espera("corpo fora do formato", () => postar({ categoria: "ameaca", autor: "c_ana", trechos: [] }), (x) => x.status === 400 && x.motivo === "invalido");
await dono("delete from interno.rede_denuncias");
const pelaRota = await espera("a Bia denuncia pela rota, com a mensagem inteira: com prova, sem cache", () => postar({ categoria: "ameaca", autor: "@c_ana", trechos: [{ texto: "Se você for ao ato, apanha.", prova: daAna.prova }] }),
  (x) => x.status === 200 && x.ok && /no-store/.test(x.cache ?? ""));
await espera("o banco recebeu só texto, dia e origem (nada da caixa, da marca, da chave nem o conteúdo inteiro)", async () => chamadasAoBanco.filter((c) => c.funcao === "rede_franquia_denunciar").at(-1)?.corpo ?? "",
  (corpo) => !/caixa|marca|"kf"|conteudo/.test(corpo) && corpo.includes("Se você for ao ato, apanha.") && !corpo.includes(daAna.prova.conteudo));
await espera("a rota não chamou nenhuma função das caixas nem do diretório (só a autoria e a denúncia)", async () => chamadasAoBanco.map((c) => c.funcao),
  (x) => !x.some((f) => /caixa|diretorio/.test(f)) && x.includes("rede_franquia_autoria"));
await espera("na fila: com prova", () => um("select prova from interno.rede_denuncias where protocolo = $1", [pelaRota?.protocolo]), (x) => x.prova[0].texto === "Se você for ao ato, apanha." && x.prova[0].origem === "conversa");
await espera("ATAQUE pela rota: trecho reescrito recusa a denúncia inteira", () => postar({ categoria: "ameaca", autor: "c_ana", trechos: [{ texto: "Se você for ao ato, morre.", prova: daAna.prova }] }),
  (x) => x.status === 400 && x.motivo === "prova_nao_confere" && x.porque === "trecho");
await espera("ATAQUE pela rota: um trecho bom e um inventado: recusa tudo (nada gravado a mais)", async () => {
  const antes = (await um("select count(*)::int n from interno.rede_denuncias")).n;
  const x = await postar({ categoria: "spam", autor: "c_ana", trechos: [{ texto: "apanha", prova: daAna.prova }, { texto: "inventado", prova: daAna.prova }] }, "token-do-caio-0123456789");
  const depois = (await um("select count(*)::int n from interno.rede_denuncias")).n;
  return x.status === 400 && x.trecho === 1 && antes === depois;
}, (x) => x === true);
{
  const doPost = mensagem({ texto: "Trecho do post cifrado.", origem: "post", dia: new Date().toISOString().slice(0, 10) });
  await espera("denúncia de post cifrado pela rota, sem o @: sem declaração de quem escreveu, não sai com prova", () => postar({ categoria: "odio", autor: "", post: postCifrado, trechos: [{ texto: "post cifrado", prova: doPost.prova }] }, "token-do-caio-0123456789"),
    (x) => x.status === 400 && x.motivo === "prova_nao_confere" && x.porque === "autoria");
  await espera("sem @ e sem post, a rota recusa", () => postar({ categoria: "odio", autor: "", trechos: [{ texto: "post cifrado", prova: doPost.prova }] }), (x) => x.status === 400 && x.motivo === "invalido");
}
await espera("prova de conversa não serve para denúncia de post", () => postar({ categoria: "ameaca", autor: "c_ana", post: "00000000-0000-4000-8000-000000000000", trechos: [{ texto: "apanha", prova: daAna.prova }] }),
  (x) => x.status === 400 && x.porque === "origem");
await espera("ATAQUE pela rota: a prova da Ana atribuída à Bia (outro @): a declaração não é dela", () => postar({ categoria: "ameaca", autor: "c_bia", trechos: [{ texto: "apanha", prova: daAna.prova }] }, "token-do-caio-0123456789"),
  (x) => x.status === 400 && x.motivo === "prova_nao_confere" && x.porque === "autoria");
{
  // O ataque da revisão final (antes do conserto: 200 e "com prova" na fila). A Bia, sem caixa nenhuma, deposita pela rota das
  // caixas numa caixa que nem existe, com um passe sorteado; a rota responde {ok, marca} de propósito (bloqueio não se denuncia).
  const lote = await import("../app/api/alumia/caixa/lote/route.ts");
  const { TAMANHOS_DO_PACOTE } = await import("../lib/rede/chat/r2/envelope.ts");
  const caixa = sorteio(32), kf = sorteio(32), passeSorteado = sorteio(32);
  const texto = "Amanha eu levo a arma ao ato.";
  const conteudo = T(texto);
  const idH = resumoDaCaixa(caixa);
  const c = compromisso(kf, idH, conteudo);
  const caixasAntes = (await um("select count(*)::int n from interno.caixas")).n;
  const rd = await lote.POST(new Request("https://alumia.teste.invalid/api/alumia/caixa/lote", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itens: [{ acao: "depositar", id: b64(caixa), pd: b64(passeSorteado), envelope: b64(sorteio(TAMANHOS_DO_PACOTE[0])), franquia: b64(c) }] }) }));
  const jr = await rd.json();
  const marca = jr.resultados?.[0]?.marca;
  ok("a rota das caixas responde igual numa caixa que não existe (o bloqueio não se denuncia) e não cria nada", jr.resultados?.[0]?.ok === true && typeof marca === "string"
    && (await um("select count(*)::int n from interno.caixas")).n === caixasAntes, JSON.stringify(jr).slice(0, 200));
  const antes = (await um("select count(*)::int n from interno.rede_denuncias")).n;
  const base = { v: 1, origem: "conversa", caixa: b64(idH), dia: jr.resultados?.[0]?.dia, kf: b64(kf), c: b64(c), marca, conteudo: b64(conteudo) };
  await espera("ATAQUE da revisão: prova forjada sem declaração, atribuída à Ana: prova_nao_confere", () => postar({ categoria: "ameaca", autor: "c_ana", trechos: [{ texto, prova: base }] }),
    (x) => x.status === 400 && x.motivo === "prova_nao_confere");
  const pdSorteado = resumoDoPasseDeDeposito(passeSorteado);
  const declaradoPorOutraChave = { ...base, pd_h: b64(pdSorteado), conta: P.ana, declaracao: b64(assinarDeclaracao(novoParEd25519(), idH, pdSorteado, P.ana)) };
  await espera("ATAQUE da revisão: com o pd_h do passe sorteado e uma declaração assinada por outra chave: prova_nao_confere", () => postar({ categoria: "ameaca", autor: "c_ana", trechos: [{ texto, prova: declaradoPorOutraChave }] }),
    (x) => x.status === 400 && x.motivo === "prova_nao_confere" && x.porque === "autoria");
  const comADeclaracaoDeVerdade = { ...base, pd_h: daAna.prova.pd_h, conta: P.ana, declaracao: daAna.prova.declaracao };
  await espera("ATAQUE da revisão: com uma declaração de verdade da Ana (de outra caixa): prova_nao_confere", () => postar({ categoria: "ameaca", autor: "c_ana", trechos: [{ texto, prova: comADeclaracaoDeVerdade }] }),
    (x) => x.status === 400 && x.motivo === "prova_nao_confere");
  ok("ATAQUE da revisão: nada entrou na fila da moderação", (await um("select count(*)::int n from interno.rede_denuncias")).n === antes);
}
{
  const antigo = process.env.ALUMIA_FRANQUIA_SEGREDO;
  process.env.ALUMIA_FRANQUIA_SEGREDO = "";
  await espera("sem o segredo no servidor: sem serviço (nunca 'com prova' sem conferir)", () => postar({ categoria: "ameaca", autor: "c_ana", trechos: [{ texto: "apanha", prova: daAna.prova }] }), (x) => x.status === 503);
  process.env.ALUMIA_FRANQUIA_SEGREDO = antigo;
}
globalThis.fetch = fetchDeVerdade;

await banco.fechar?.();
console.log(`\n${certos} certos, ${falhas.length} falhas${SEM_MIGRACAO ? " (SEM a migração)" : ""}`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
