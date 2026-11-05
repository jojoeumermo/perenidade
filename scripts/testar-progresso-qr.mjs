// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o "progresso por QR" (lib/progresso-qr.ts, supabase/migracoes/2026-11-progresso-qr.sql): cifrar e decifrar, juntar
// sem perder nada, o tamanho do QR (pequeno cabe, grande vai para o servidor), a função SQL num Postgres de verdade dentro
// do Node (só guarda texto cifrado, entrega uma vez, vence em 1 dia, tem limite de tamanho e de pedidos) e a ligação com a tela,
// a privacidade e o NOTICE.
// Uso: npm run testar:progresso-qr
import fs from "node:fs";
import QRCode from "qrcode";
import { criarBanco } from "./banco-local.mjs";
import {
  abrirPacote, cabeNoQr, chaveDeTexto, chaveParaTexto, codigoDigitavel, juntarDados, lerCodigoDigitado, lerQr, LIMITE_DO_QR, LIMITE_DO_SERVIDOR,
  montarDados, novaChaveBytes, novoId, qrComCodigo, qrComPacote, selarPacote,
} from "../lib/progresso-qr.ts";

let certos = 0;
const falhas = [];
async function confere(nome, fazer) {
  try {
    if (!(await fazer())) throw new Error("não confere");
    certos++;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
  }
}
const lerArq = (c) => fs.readFileSync(new URL(`../${c}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const troca = (t, i) => t.slice(0, i) + (t[i] === "A" ? "B" : "A") + t.slice(i + 1);
const versaoDoQr = (texto) => QRCode.create(texto, { errorCorrectionLevel: "M" }).version;

/** Um armazenamento de mentira, como o localStorage. */
function armazem(inicial = {}) {
  const m = new Map(Object.entries(inicial));
  return {
    get length() {
      return m.size;
    },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

// ── Chave, código e QR ──
const chave = novaChaveBytes();
await confere("a chave tem 128 bits e vira 26 caracteres do alfabeto sem 0, 1, I e O", () => chave.length === 16 && /^[A-HJ-NP-Z2-9]{26}$/.test(chaveParaTexto(chave)));
await confere("a chave vai e volta pelo texto, 200 vezes", () => {
  for (let i = 0; i < 200; i++) {
    const k = novaChaveBytes();
    const volta = chaveDeTexto(chaveParaTexto(k));
    if (!volta || volta.join() !== k.join()) return false;
  }
  return true;
});
await confere("texto de chave com tamanho ou símbolo errado é recusado", () => chaveDeTexto("A".repeat(25)) === null && chaveDeTexto("0".repeat(26)) === null);
await confere("o código do servidor tem 10 caracteres e muda a cada vez", () => /^[A-HJ-NP-Z2-9]{10}$/.test(novoId()) && novoId() !== novoId());
await confere("o código digitado aceita minúsculas, espaços e traços, e serve de volta", () => {
  const id = novoId();
  const digitado = codigoDigitavel(id, chave);
  const lido = lerCodigoDigitado(digitado.toLowerCase().replace(/ /g, "-"));
  return lido !== null && lido.id === id && lido.chave.join() === chave.join() && /^([A-Z2-9]{4} ){8}[A-Z2-9]{4}$/.test(digitado);
});
await confere("código digitado curto demais ou com símbolo errado é recusado", () => lerCodigoDigitado("ABCD EFGH") === null && lerCodigoDigitado("0".repeat(36)) === null);
await confere("o QR com o código tem 54 caracteres e cabe sempre (QR de versão pequena)", () => {
  const t = qrComCodigo(novoId(), chave);
  return t.length === "lucia:progresso:2:".length + 36 && cabeNoQr(t) && versaoDoQr(t) <= 6;
});
await confere("os dois textos de QR são lidos de volta; texto alheio não", () => {
  const id = novoId();
  const a = lerQr(qrComCodigo(id, chave));
  const b = lerQr(qrComPacote(chave, "A".repeat(60)));
  return (
    a?.tipo === "codigo" && a.id === id && a.chave.join() === chave.join() && b?.tipo === "pacote" && b.pacote === "A".repeat(60) &&
    lerQr("https://exemplo.org") === null && lerQr("lucia:aparelho:12345678:B") === null && lerQr(qrComCodigo(id, chave).replace("progresso:2", "progresso:3")) === null
  );
});

// ── Cifrar e decifrar ──
const dados = {
  "lucia:concluidas": JSON.stringify(["trilha-a/01", "trilha-a/02", "trilha-b/05"]),
  "lucia:fichamento": JSON.stringify({ anotacao: "Anotei aqui o que o patrão disse sobre as horas extras. ção ñ 日本語 🙂" }),
  "lucia:tema": "dark",
};
const selado = await selarPacote(dados);
await confere("o pacote é texto base64url e não mostra o conteúdo", () => /^[A-Za-z0-9_-]{40,}$/.test(selado.pacote) && !Buffer.from(selado.pacote, "base64url").toString("latin1").includes("concluidas"));
await confere("com a chave certa, o pacote abre igual ao que entrou (acentos, ideogramas e emoji inclusive)", async () => JSON.stringify(await abrirPacote(selado.chave, selado.pacote)) === JSON.stringify(dados));
await confere("com outra chave, não abre", async () => (await abrirPacote(novaChaveBytes(), selado.pacote)) === null);
await confere("mexer em qualquer ponto do pacote (vetor, meio, fim) o faz parar de abrir", async () => {
  for (const pos of [0, 5, 30, Math.floor(selado.pacote.length / 2), selado.pacote.length - 2]) if ((await abrirPacote(selado.chave, troca(selado.pacote, pos))) !== null) return false;
  return true;
});
await confere("pacote cortado ou com símbolo de fora não abre", async () => (await abrirPacote(selado.chave, selado.pacote.slice(0, -5))) === null && (await abrirPacote(selado.chave, `${selado.pacote}!`)) === null && (await abrirPacote(selado.chave, "x")) === null);
await confere("dois pacotes do mesmo conteúdo são diferentes (chave e vetor novos)", async () => {
  const outro = await selarPacote(dados);
  return outro.pacote !== selado.pacote && outro.chave.join() !== selado.chave.join();
});
await confere("pacote vazio é um pacote válido; texto que não é pacote não abre", async () => {
  const selo = await selarPacote({});
  return (await abrirPacote(selo.chave, selo.pacote)) !== null && (await abrirPacote(selo.chave, "B".repeat(80))) === null;
});

// ── O que viaja ──
await confere("montarDados leva só o permitido e só texto não vazio", () => {
  const a = armazem({ "lucia:concluidas": '["a/1"]', "lucia:sessao": "segredo", "outro:coisa": "x", "lucia:erros": "" });
  const d = montarDados(a, (k) => k === "lucia:concluidas" || k === "lucia:erros");
  return JSON.stringify(d) === '{"lucia:concluidas":"[\\"a/1\\"]"}';
});
await confere("com o padrão (as chaves da cópia de segurança), a sessão da conta e o privado da Escola não viajam", () => {
  const a = armazem({ "lucia:sessao": "x", "lucia:erros": "[]", "lucia:escola-privado:doc": "y", "lucia:caderno": '[{"id":"1"}]' });
  return Object.keys(montarDados(a)).sort().join() === "lucia:caderno,lucia:erros";
});

// ── Juntar sem perder ──
await confere("juntar: lista de textos se une; nada daqui se perde", () => {
  const a = armazem({ "lucia:concluidas": JSON.stringify(["x/1", "x/2"]) });
  juntarDados({ "lucia:concluidas": JSON.stringify(["x/2", "y/9"]) }, a);
  return JSON.stringify(JSON.parse(a.getItem("lucia:concluidas")).sort()) === '["x/1","x/2","y/9"]';
});
await confere("juntar: cadernos por id, vence o mais recente, e o que só existe aqui fica", () => {
  const a = armazem({ "lucia:caderno": JSON.stringify([{ id: "1", atualizado: 5, t: "aqui" }, { id: "2", atualizado: 1, t: "só aqui" }]) });
  juntarDados({ "lucia:caderno": JSON.stringify([{ id: "1", atualizado: 9, t: "veio" }, { id: "3", atualizado: 1, t: "novo" }]) }, a);
  const l = JSON.parse(a.getItem("lucia:caderno"));
  return l.length === 3 && l.find((x) => x.id === "1").t === "veio" && l.find((x) => x.id === "2").t === "só aqui" && l.find((x) => x.id === "3").t === "novo";
});
await confere("juntar: registros por item (testes) ficam com o mais recente de cada um", () => {
  const a = armazem({ "lucia:testes": JSON.stringify({ a: { quando: 10, n: 1 }, b: { quando: 1, n: 2 } }) });
  juntarDados({ "lucia:testes": JSON.stringify({ a: { quando: 5, n: 9 }, b: { quando: 8, n: 7 }, c: { quando: 1, n: 3 } }) }, a);
  const r = JSON.parse(a.getItem("lucia:testes"));
  return r.a.n === 1 && r.b.n === 7 && r.c.n === 3;
});
await confere("juntar: objeto comum se junta chave a chave e o item de cá não é trocado", () => {
  const a = armazem({ "lucia:lab:concluidos": JSON.stringify({ x: 1 }) });
  juntarDados({ "lucia:lab:concluidos": JSON.stringify({ x: 2, y: 3 }) }, a);
  const r = JSON.parse(a.getItem("lucia:lab:concluidos"));
  return r.x === 1 && r.y === 3;
});
await confere("juntar: escolha simples (tema) só entra se aqui está vazio; o que já está aqui não muda", () => {
  const a = armazem({ "lucia:tema": "light" });
  const n = juntarDados({ "lucia:tema": "dark", "lucia:voz": "pf_dora" }, a, (k) => k.startsWith("lucia:"));
  return a.getItem("lucia:tema") === "light" && a.getItem("lucia:voz") === "pf_dora" && n >= 1;
});
await confere("juntar: chave fora da lista permitida é ignorada (a sessão não entra)", () => {
  const a = armazem();
  juntarDados({ "lucia:sessao": "x", "lucia:concluidas": '["a/1"]' }, a, (k) => k === "lucia:concluidas");
  return a.getItem("lucia:sessao") === null && a.getItem("lucia:concluidas") === '["a/1"]';
});
await confere("juntar: dado local que não é JSON não é apagado", () => {
  const a = armazem({ "lucia:concluidas": "quebrado" });
  juntarDados({ "lucia:concluidas": '["a/1"]' }, a);
  return a.getItem("lucia:concluidas") === "quebrado";
});
await confere("de ponta a ponta: a origem monta e sela, o destino abre e junta; nenhum dos dois perde nada", async () => {
  const origem = armazem({ "lucia:concluidas": JSON.stringify(["a/1", "a/2"]), "lucia:erros": JSON.stringify([{ id: "e1", quando: 1 }]) });
  const destino = armazem({ "lucia:concluidas": JSON.stringify(["b/1"]), "lucia:erros": JSON.stringify([{ id: "e2", quando: 2 }]) });
  const s = await selarPacote(montarDados(origem));
  const lido = lerQr(qrComPacote(s.chave, s.pacote));
  const aberto = await abrirPacote(lido.chave, lido.pacote);
  juntarDados(aberto, destino);
  return JSON.parse(destino.getItem("lucia:concluidas")).length === 3 && JSON.parse(destino.getItem("lucia:erros")).length === 2 && origem.getItem("lucia:concluidas").includes("a/2");
});

// ── Tamanho do QR ──
const pequeno = await selarPacote({ "lucia:concluidas": JSON.stringify(["trilha/01", "trilha/02"]) });
const textoPequeno = qrComPacote(pequeno.chave, pequeno.pacote);
await confere("um progresso pequeno cabe no QR com o pacote dentro (versão de QR 14 ou menor)", () => cabeNoQr(textoPequeno) && versaoDoQr(textoPequeno) <= 14);
await confere("o limite do QR é uma versão que a câmera lê (o limite de caracteres fica na versão 14 ou menor)", () => versaoDoQr("x".repeat(LIMITE_DO_QR)) <= 14);
const ids = Array.from({ length: 400 }, (_, i) => `trilha-${i % 40}/aula-${Math.floor(i / 40)}-${(i * 7919) % 1000}`);
const grande = await selarPacote({ "lucia:concluidas": JSON.stringify(ids), "lucia:fichamento": JSON.stringify({ n: "texto ".repeat(500) }) });
await confere("um progresso de verdade (400 aulas e anotações) NÃO cabe no QR e vai para o servidor, com QR pequeno", () => {
  const t = qrComPacote(grande.chave, grande.pacote);
  return !cabeNoQr(t) && grande.pacote.length < LIMITE_DO_SERVIDOR && versaoDoQr(qrComCodigo(novoId(), grande.chave)) <= 6;
});
await confere("a compressão ajuda: o pacote cifrado é bem menor que o texto original", () => grande.pacote.length < JSON.stringify(ids).length);

// ── Banco ──
const sql = lerArq("supabase/migracoes/2026-11-progresso-qr.sql");
await confere("nenhuma tabela no esquema public, só em interno", () => !/create table (if not exists )?public\./i.test(sql) && /create table if not exists interno\.progresso_qr/.test(sql));
await confere("as funções públicas são security definer com search_path fixo e o RLS está ligado", () =>
  (sql.match(/security definer set search_path = interno, pg_temp/g) ?? []).length >= 3 && /alter table interno\.progresso_qr enable row level security/.test(sql));
await confere("o install.sql termina com a migração idêntica ao arquivo", () => lerArq("supabase/install.sql").trim().endsWith(sql.trim()));

const banco = await criarBanco();
const { rpc, dono } = banco;
let ip = 20;
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++}` });
const erroDe = async (promessa) => {
  try {
    await promessa();
    return "";
  } catch (e) {
    return String(e.message ?? e);
  }
};
const idA = novoId();
await confere("instalar de novo o install.sql não quebra", async () => {
  await banco.instalarDeNovo();
  return true;
});
await confere("a tabela tem RLS ligado e anon não lê nada diretamente", async () => {
  const r = (await dono("select relrowsecurity from pg_class where oid = 'interno.progresso_qr'::regclass")).rows[0];
  await dono("set role anon");
  const sem = await erroDe(() => dono("select * from interno.progresso_qr"));
  await dono("reset role");
  return r.relrowsecurity === true && /permission denied/i.test(sem);
});
await confere("o visitante sem conta guarda o pacote cifrado e a resposta traz só o prazo", async () => {
  const r = await rpc(visitante(), "progresso_qr_guardar", { p_id: idA, p_blob: grande.pacote });
  return r.ok === true && typeof r.expira_em === "string" && Object.keys(r).sort().join() === "expira_em,ok";
});
await confere("o banco guarda exatamente o texto cifrado, vence em até 1 dia e não guarda mais nada (sem endereço)", async () => {
  const r = (await dono("select * from interno.progresso_qr where id = $1", [idA])).rows[0];
  const colunas = (await dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'progresso_qr' order by 1")).rows.map((c) => c.column_name).join();
  const dia = new Date(r.expira_em).getTime() - new Date(r.criado_em).getTime();
  return r.blob === grande.pacote && dia > 0 && dia <= 86_400_000 + 1000 && colunas === "blob,criado_em,expira_em,id";
});
await confere("o mesmo código não pode ser usado duas vezes", async () => /id_em_uso/.test(await erroDe(() => rpc(visitante(), "progresso_qr_guardar", { p_id: idA, p_blob: grande.pacote }))));
await confere("outro aparelho lê com o código: recebe o pacote, que abre com a chave que só o QR tem", async () => {
  const r = await rpc(visitante(), "progresso_qr_buscar", { p_id: idA });
  const aberto = await abrirPacote(grande.chave, r.blob);
  return r.achou === true && aberto !== null && aberto["lucia:concluidas"] === JSON.stringify(ids);
});
await confere("a leitura apagou o pacote: ler de novo não acha", async () => {
  const r = await rpc(visitante(), "progresso_qr_buscar", { p_id: idA });
  const n = Number((await dono("select count(*) from interno.progresso_qr where id = $1", [idA])).rows[0].count);
  return r.achou === false && !("blob" in r) && n === 0;
});
await confere("código desconhecido ou malformado dá a mesma resposta, sem pista", async () => {
  const a = await rpc(visitante(), "progresso_qr_buscar", { p_id: novoId() });
  const b = await rpc(visitante(), "progresso_qr_buscar", { p_id: "abc" });
  return JSON.stringify(a) === '{"achou":false}' && JSON.stringify(b) === '{"achou":false}';
});
await confere("o que passa de 1 dia some: o pacote vencido não é entregue e é apagado", async () => {
  const id = novoId();
  await rpc(visitante(), "progresso_qr_guardar", { p_id: id, p_blob: pequeno.pacote });
  await dono("update interno.progresso_qr set expira_em = now() - interval '1 minute' where id = $1", [id]);
  const r = await rpc(visitante(), "progresso_qr_buscar", { p_id: id });
  const n = Number((await dono("select count(*) from interno.progresso_qr where id = $1", [id])).rows[0].count);
  return r.achou === false && n === 0;
});
await confere("a limpeza apaga os vencidos mesmo sem ninguém ler", async () => {
  const id = novoId();
  await rpc(visitante(), "progresso_qr_guardar", { p_id: id, p_blob: pequeno.pacote });
  await dono("update interno.progresso_qr set expira_em = now() - interval '1 minute' where id = $1", [id]);
  await dono("select interno.progresso_qr_limpar()");
  return Number((await dono("select count(*) from interno.progresso_qr where id = $1", [id])).rows[0].count) === 0;
});
await confere("limite de tamanho: pacote grande demais, curto demais ou com símbolo de fora é recusado", async () => {
  const a = await erroDe(() => rpc(visitante(), "progresso_qr_guardar", { p_id: novoId(), p_blob: "A".repeat(LIMITE_DO_SERVIDOR + 1) }));
  const b = await erroDe(() => rpc(visitante(), "progresso_qr_guardar", { p_id: novoId(), p_blob: "curto" }));
  const c = await erroDe(() => rpc(visitante(), "progresso_qr_guardar", { p_id: novoId(), p_blob: `${pequeno.pacote}!` }));
  const d = await erroDe(() => rpc(visitante(), "progresso_qr_guardar", { p_id: "0OIl1abcde", p_blob: pequeno.pacote }));
  return /pacote_grande/.test(a) && /invalido:pacote/.test(b) && /invalido:pacote/.test(c) && /invalido:id/.test(d);
});
await confere("o maior pacote permitido entra", async () => {
  const id = novoId();
  const r = await rpc(visitante(), "progresso_qr_guardar", { p_id: id, p_blob: "A".repeat(LIMITE_DO_SERVIDOR) });
  await dono("delete from interno.progresso_qr where id = $1", [id]);
  return r.ok === true;
});
await confere("limite de pedidos: o 7º pacote na mesma hora, do mesmo lugar, é barrado; outro lugar passa", async () => {
  const mesmo = { papel: "anon", ip: "198.51.100.77" };
  let barrado = "";
  for (let i = 0; i < 7; i++) barrado = await erroDe(() => rpc(mesmo, "progresso_qr_guardar", { p_id: novoId(), p_blob: pequeno.pacote }));
  const outro = await rpc(visitante(), "progresso_qr_guardar", { p_id: novoId(), p_blob: pequeno.pacote });
  return /muitos_pedidos/.test(barrado) && outro.ok === true;
});
await confere("limite de pedidos na leitura: depois de 30 tentativas em 10 minutos, barra", async () => {
  const mesmo = { papel: "anon", ip: "198.51.100.88" };
  let ultimo = "";
  for (let i = 0; i < 31; i++) ultimo = await erroDe(() => rpc(mesmo, "progresso_qr_buscar", { p_id: novoId() }));
  return /muitos_pedidos/.test(ultimo);
});
await confere("a casa cheia (100 pacotes) barra novos; um lugar vago depois de ler reabre", async () => {
  await dono("delete from interno.progresso_qr");
  const ids100 = Array.from({ length: 100 }, () => novoId());
  for (const id of ids100) await dono("insert into interno.progresso_qr (id, blob) values ($1, $2)", [id, pequeno.pacote]);
  const cheio = await erroDe(() => rpc(visitante(), "progresso_qr_guardar", { p_id: novoId(), p_blob: pequeno.pacote }));
  await rpc(visitante(), "progresso_qr_buscar", { p_id: ids100[0] });
  const vago = await rpc(visitante(), "progresso_qr_guardar", { p_id: novoId(), p_blob: pequeno.pacote });
  await dono("delete from interno.progresso_qr");
  return /servico_cheio/.test(cheio) && vago.ok === true;
});
await confere("as funções internas não são chamáveis por anon nem por authenticated; as duas públicas são", async () => {
  const r = (
    await dono(`select has_function_privilege('anon', 'interno.progresso_qr_limpar()', 'execute') as a, has_function_privilege('authenticated', 'interno.progresso_qr_limpar()', 'execute') as b,
    has_function_privilege('anon', 'public.progresso_qr_buscar(text)', 'execute') as c, has_function_privilege('anon', 'public.progresso_qr_guardar(text,text)', 'execute') as d`)
  ).rows[0];
  return r.a === false && r.b === false && r.c === true && r.d === true;
});

// ── Tela, privacidade, avisos ──
const tela = lerArq("components/progresso/LevarProgresso.tsx");
await confere("a tela usa o leitor nativo quando há e a biblioteca pequena só por dynamic import", () => /BarcodeDetector/.test(tela) && /import\("jsqr"\)/.test(tela) && !/^import .*from "jsqr"/m.test(tela));
await confere("a tela só gera o QR no aparelho (qrcode por dynamic import) e não lê disco", () => /import\("qrcode"\)/.test(tela) && !/node:fs|readFileSync/.test(tela) && tela.includes('"use client"'));
await confere("a tela só chama o servidor quando o pacote não cabe no QR e nunca manda a chave", () => {
  const chamadas = [...tela.matchAll(/rpc[^(]*\(\s*"progresso_qr_guardar"[^)]*\)/g)].map((m) => m[0]);
  return /cabeNoQr\(/.test(tela) && chamadas.length === 1 && /p_id: id, p_blob: pacote/.test(chamadas[0]) && !/chave/.test(chamadas[0]);
});
await confere("a página Meus dados mostra a tela", () => /LevarProgresso/.test(lerArq("app/[lang]/meus-dados/page.tsx")));
await confere("os 6 idiomas têm os mesmos textos", () => {
  const ref = Object.keys(JSON.parse(lerArq("i18n/progresso-qr/pt.json"))).sort().join();
  return ["en", "es", "fr", "ru", "zh"].every((l) => Object.keys(JSON.parse(lerArq(`i18n/progresso-qr/${l}.json`))).sort().join() === ref);
});
await confere("a privacidade diz que o recurso está no ar e não diz mais que está em construção", () => {
  const p = lerArq("content/paginas/privacidade.md");
  const par = p.split("\n").find((l) => l.includes("Levar o progresso para outro aparelho (por QR)")) ?? "";
  return par !== "" && !/em construção|ainda está/.test(par) && /já está no ar/.test(par) && /cifrado/.test(par);
});
await confere("o NOTICE registra a biblioteca de leitura de QR com a licença", () => {
  const linha = lerArq("docs/NOTICE.md").split("\n").find((l) => /jsQR/.test(l)) ?? "";
  return /Apache-2\.0/.test(linha);
});
await confere("jsqr está no package.json em versão exata e o teste está registrado", () => {
  const p = JSON.parse(lerArq("package.json"));
  return /^\d+\.\d+\.\d+$/.test(p.dependencies.jsqr) && Boolean(p.scripts["testar:progresso-qr"]);
});

console.log(`${certos} conferências certas, ${falhas.length} com problema.`);
for (const falha of falhas) console.log("  ✗", falha);
process.exit(falhas.length ? 1 : 0);
