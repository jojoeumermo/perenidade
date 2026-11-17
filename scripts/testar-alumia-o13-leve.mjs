// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a frente 13D da onda 13 (leve e no seu tempo):
//   · a fila deste aparelho (components/rede/leve/regras.ts): o que entra (só texto, dois públicos, limite de tamanho e de itens,
//     sem repetir), o que sai sozinho (só da conta aberta, só os prontos, nada de três dias atrás), o que acontece quando o servidor
//     recusa (para e guarda o motivo) e quando a rede cai no meio (continua esperando), duas abas mandando juntas (sai uma vez só);
//   · a impressão do post que saiu (SHA-256 da biblioteca, por 15 minutos) e a hora de parar (uma vez por noite, dentro da janela);
//   · as chaves começam por "lucia:rede": o Sair rápido (lib/rede/saida.ts) apaga a fila sem saber dela;
//   · nada vai a serviço de fora, nenhum endereço de rede, nenhuma migração, nenhuma lista de pessoas; os textos nas seis línguas;
//   · a frente não mexe nos arquivos de quem junta nem nos da outra faixa.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-alumia-o13-leve.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CHAVES_DO_LEVE, codigoDoErro, DIAS_PARA_SAIR_SOZINHO, falhaDeRede, guardarNaFila, horaDeLembrar, impressaoDoPost, jaSaiu, lembrarQueSaiu, LIMITE_DA_FILA,
  LIMITE_DO_TEXTO, lerFila, mandarFila, minutosDoDia, MINUTOS_DA_IMPRESSAO, noiteDe, prontosParaSair, situacaoDoItem, textoLimpo, tirarDaFila,
} from "../components/rede/leve/regras.ts";
import { apagarChavesDaRede, PREFIXO_DA_REDE } from "../lib/rede/saida.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));

/** Um localStorage de mentira (com length/key, para o Sair rápido também). */
function armazem(inicial = {}) {
  const m = new Map(Object.entries(inicial));
  return {
    get length() {
      return m.size;
    },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    mapa: m,
  };
}
let n = 0;
const sorteio = () => `id-${++n}`;
const T0 = Date.UTC(2026, 10, 19, 15, 0, 0);

// ═══════════════════ 1. O que entra na fila ═══════════════════
{
  const a = armazem();
  ok("sem conta não guarda", guardarNaFila(a, { conta: null, texto: "oi", publico: "membros" }, T0, sorteio).motivo === "sem_conta");
  ok("texto vazio (só espaço) não guarda", guardarNaFila(a, { conta: "faisca", texto: "  \n ", publico: "membros" }, T0, sorteio).motivo === "vazio");
  ok("texto longo demais não guarda", guardarNaFila(a, { conta: "faisca", texto: "x".repeat(LIMITE_DO_TEXTO + 1), publico: "membros" }, T0, sorteio).motivo === "longo");
  ok("só os dois públicos do leve (nada de internet, comunidade, equipe)", ["internet", "comunidade", "equipe", "nucleo", ""].every((p) => guardarNaFila(a, { conta: "faisca", texto: "oi", publico: p }, T0, sorteio).motivo === "publico"));
  const r1 = guardarNaFila(a, { conta: "faisca", texto: "  Assembleia na quinta\r\n19h  ", publico: "membros" }, T0, sorteio);
  ok("guarda o texto limpo, como post curto", r1.ok && !r1.repetido && r1.item.pedido.texto === "Assembleia na quinta\n19h" && r1.item.pedido.tipo === "post" && r1.item.conta === "faisca");
  const r2 = guardarNaFila(a, { conta: "faisca", texto: "Assembleia na quinta\n19h", publico: "membros" }, T0 + 1000, sorteio);
  ok("o mesmo texto, público e conta não entra duas vezes", r2.ok && r2.repetido && r2.item.id === r1.item.id && lerFila(a).length === 1);
  ok("o mesmo texto com outro público é outro post", guardarNaFila(a, { conta: "faisca", texto: "Assembleia na quinta\n19h", publico: "seguidores" }, T0, sorteio).ok && lerFila(a).length === 2);
  for (let i = lerFila(a).length; i < LIMITE_DA_FILA; i++) guardarNaFila(a, { conta: "faisca", texto: `post ${i}`, publico: "membros" }, T0 + i, sorteio);
  ok(`no máximo ${LIMITE_DA_FILA} esperando neste aparelho`, lerFila(a).length === LIMITE_DA_FILA && guardarNaFila(a, { conta: "faisca", texto: "mais um", publico: "membros" }, T0, sorteio).motivo === "cheia");
  tirarDaFila(a, r1.item.id);
  ok("apagar tira só aquele", lerFila(a).length === LIMITE_DA_FILA - 1 && !lerFila(a).some((i) => i.id === r1.item.id));
  ok("a fila vem do mais antigo ao mais novo", lerFila(a).every((x, i, l) => i === 0 || l[i - 1].criado_em <= x.criado_em));
  // Um valor torto no aparelho (mexido à mão, versão velha) não quebra nem vira post.
  const torto = armazem({ [CHAVES_DO_LEVE.fila]: JSON.stringify([{ id: "x", conta: "faisca", pedido: { tipo: "chamado", texto: "a", publico: "membros" }, criado_em: 1 }, "lixo", null]) });
  ok("item torto no aparelho fica de fora", lerFila(torto).length === 0 && lerFila(armazem({ [CHAVES_DO_LEVE.fila]: "{quebrado" })).length === 0);
  // Aparelho sem espaço: a gravação falha em silêncio e a tela precisa saber.
  const cheio = { ...armazem(), setItem: () => { throw new Error("QuotaExceededError"); } };
  ok("aparelho sem espaço diz que não guardou", guardarNaFila(cheio, { conta: "faisca", texto: "oi", publico: "membros" }, T0, sorteio).motivo === "sem_espaco");
  ok("texto limpo mantém as quebras de linha", textoLimpo(" a\r\nb\rc ") === "a\nb\nc");
}

// ═══════════════════ 2. O que sai sozinho e como ═══════════════════
{
  const a = armazem();
  const meu = guardarNaFila(a, { conta: "faisca", texto: "primeiro", publico: "membros" }, T0, sorteio).item;
  const meu2 = guardarNaFila(a, { conta: "faisca", texto: "segundo", publico: "seguidores" }, T0 + 1, sorteio).item;
  const dela = guardarNaFila(a, { conta: "rosavermelha", texto: "de outra conta", publico: "membros" }, T0 + 2, sorteio).item;
  const velho = guardarNaFila(a, { conta: "faisca", texto: "de dias atrás", publico: "membros" }, T0 - (DIAS_PARA_SAIR_SOZINHO * 86_400_000 + 1), sorteio).item;
  const agora = T0 + 60_000;
  ok("situação de cada um", situacaoDoItem(meu, "faisca", agora) === "pronto" && situacaoDoItem(dela, "faisca", agora) === "outra_conta" && situacaoDoItem(velho, "faisca", agora) === "parado");
  ok("só os prontos da conta aberta saem sozinhos, em ordem", JSON.stringify(prontosParaSair(lerFila(a), "faisca", agora).map((i) => i.id)) === JSON.stringify([meu.id, meu2.id]));
  ok("sem conta aberta, nada sai", prontosParaSair(lerFila(a), null, agora).length === 0);

  const enviados = [];
  const r = await mandarFila({ armazem: a, conta: "faisca", publicar: async (p) => (enviados.push(p), { id: `post-${enviados.length}` }), agora: () => agora, semRede: () => false });
  ok("mandou os dois prontos, com o pedido inteiro de post curto", r.saiu.length === 2 && enviados.length === 2 && enviados[0].texto === "primeiro" && enviados[1].publico === "seguidores"
    && enviados.every((p) => JSON.stringify(Object.keys(p).sort()) === '["publico","texto","tipo"]' && p.tipo === "post"));
  ok("o que saiu some da fila; o de outra conta e o velho ficam", JSON.stringify(lerFila(a).map((i) => i.id).sort()) === JSON.stringify([dela.id, velho.id].sort()));
  ok("o que saiu deixa a impressão (o mesmo texto não sai de novo pelo Escrever de sempre)", jaSaiu(a, await impressaoDoPost("faisca", "membros", "primeiro"), agora + 1000));
  ok("a impressão vale só por um tempo", !jaSaiu(a, await impressaoDoPost("faisca", "membros", "primeiro"), agora + MINUTOS_DA_IMPRESSAO * 60_000 + 1));
  ok("a impressão é da conta, do público e do texto", !jaSaiu(a, await impressaoDoPost("faisca", "seguidores", "primeiro"), agora) && !jaSaiu(a, await impressaoDoPost("rosavermelha", "membros", "primeiro"), agora));
  ok("a impressão não guarda o texto", !(a.getItem(CHAVES_DO_LEVE.saiu) ?? "").includes("primeiro"));

  const rv = await mandarFila({ armazem: a, conta: "faisca", publicar: async () => ({ id: "post-velho" }), agora: () => agora, semRede: () => false, soEstes: [velho.id, dela.id] });
  ok("o velho só sai quando a pessoa manda; o de outra conta nunca sai nesta conta", rv.saiu.length === 1 && rv.saiu[0].id === velho.id && lerFila(a).length === 1 && lerFila(a)[0].id === dela.id);
}
{
  // O servidor recusou: guarda o motivo e não tenta sozinho de novo. A rede caiu: continua esperando e para ali.
  const a = armazem();
  const x = guardarNaFila(a, { conta: "faisca", texto: "com CPF 123", publico: "membros" }, T0, sorteio).item;
  const y = guardarNaFila(a, { conta: "faisca", texto: "segundo", publico: "membros" }, T0 + 1, sorteio).item;
  const z = guardarNaFila(a, { conta: "faisca", texto: "terceiro", publico: "membros" }, T0 + 2, sorteio).item;
  let chamadas = 0;
  const r = await mandarFila({
    armazem: a, conta: "faisca", agora: () => T0 + 5000, semRede: () => false,
    publicar: async (p) => {
      chamadas++;
      if (p.texto.includes("CPF")) throw new Error("dado_pessoal: o texto tem um dado pessoal");
      throw new TypeError("Failed to fetch");
    },
  });
  ok("recusado guarda o código e para de tentar sozinho", r.recusado.length === 1 && r.recusado[0].codigo === "dado_pessoal" && lerFila(a).find((i) => i.id === x.id)?.erro === "dado_pessoal"
    && situacaoDoItem(lerFila(a).find((i) => i.id === x.id), "faisca", T0 + 6000) === "recusado");
  ok("a rede caiu no segundo: ele e o terceiro continuam esperando, sem marca de envio", chamadas === 2 && r.esperando === 2 && [y.id, z.id].every((id) => {
    const i = lerFila(a).find((k) => k.id === id);
    return i && i.enviando_desde === null && i.erro === null;
  }));
  ok("na próxima volta da rede, só os dois prontos saem", prontosParaSair(lerFila(a), "faisca", T0 + 7000).map((i) => i.id).join() === [y.id, z.id].join());
}
{
  // Duas abas abertas, a rede volta nas duas ao mesmo tempo: cada post sai uma vez só.
  const a = armazem();
  for (let i = 0; i < 3; i++) guardarNaFila(a, { conta: "faisca", texto: `post ${i}`, publico: "membros" }, T0 + i, sorteio);
  const saidos = [];
  const publicar = async (p) => {
    await new Promise((r) => setTimeout(r, 5));
    saidos.push(p.texto);
    return { id: p.texto };
  };
  await Promise.all([1, 2].map(() => mandarFila({ armazem: a, conta: "faisca", publicar, agora: () => T0 + 10_000, semRede: () => false })));
  ok("duas abas juntas: cada post sai uma vez", saidos.length === 3 && new Set(saidos).size === 3 && lerFila(a).length === 0);
  // Uma aba fechou no meio do envio: depois de 2 minutos, o item volta a valer.
  const b = armazem();
  const preso = guardarNaFila(b, { conta: "faisca", texto: "preso", publico: "membros" }, T0, sorteio).item;
  b.setItem(CHAVES_DO_LEVE.fila, JSON.stringify([{ ...preso, enviando_desde: T0 }]));
  ok("envio preso segura por pouco tempo e depois volta", situacaoDoItem(lerFila(b)[0], "faisca", T0 + 30_000) === "enviando" && situacaoDoItem(lerFila(b)[0], "faisca", T0 + 3 * 60_000) === "pronto");
}
ok("falha de rede ou recusa do servidor", falhaDeRede(new TypeError("Failed to fetch"), false) && falhaDeRede(new Error("qualquer"), true) && falhaDeRede(new Error("sem_conexao"), false)
  && falhaDeRede(undefined, false) && !falhaDeRede(new Error("dado_pessoal: x"), false) && !falhaDeRede(new Error("limite_diario"), false));
ok("o código do erro vem limpo", codigoDoErro(new Error("modo_lento: espere")) === "modo_lento" && codigoDoErro(new Error("Algo <b>estranho</b>")) === "desconhecido" && codigoDoErro(null) === "desconhecido");

// ═══════════════════ 3. Hora de parar ═══════════════════
{
  const d = (h, m, dia = 19) => new Date(2026, 10, dia, h, m);
  ok("hora torta não vale", minutosDoDia("25:00") === null && minutosDoDia("7:00") === null && minutosDoDia(null) === null && minutosDoDia("23:30") === 1410);
  ok("antes da hora, não lembra", !horaDeLembrar(d(22, 59), "23:00", null));
  ok("na hora e depois dela, lembra", horaDeLembrar(d(23, 0), "23:00", null) && horaDeLembrar(d(23, 40), "23:00", null));
  ok("depois da meia-noite ainda é a mesma noite", noiteDe(d(0, 30, 20), minutosDoDia("23:00")) === noiteDe(d(23, 10, 19), minutosDoDia("23:00")) && horaDeLembrar(d(1, 0, 20), "23:00", null));
  ok("visto nesta noite, não volta", !horaDeLembrar(d(0, 30, 20), "23:00", noiteDe(d(23, 10, 19), 1380)));
  ok("na noite seguinte volta", horaDeLembrar(d(23, 5, 20), "23:00", noiteDe(d(23, 10, 19), 1380)));
  ok("cinco horas depois, a janela fecha (ninguém é lembrado de manhã)", !horaDeLembrar(d(4, 1, 20), "23:00", null) && !horaDeLembrar(d(12, 0, 20), "23:00", null));
  ok("hora de parar de madrugada também funciona", horaDeLembrar(d(1, 15), "01:00", null) && !horaDeLembrar(d(0, 59), "01:00", null));
}

// ═══════════════════ 4. O Sair rápido apaga tudo desta frente ═══════════════════
{
  ok("toda chave desta frente começa pelo prefixo da Alumia", Object.values(CHAVES_DO_LEVE).every((k) => k.startsWith(`${PREFIXO_DA_REDE}:`)));
  const a = armazem({ "outra:coisa": "fica" });
  guardarNaFila(a, { conta: "faisca", texto: "segredo", publico: "membros" }, T0, sorteio);
  lembrarQueSaiu(a, "abc", T0);
  a.setItem(CHAVES_DO_LEVE.parar, "23:00");
  a.setItem(CHAVES_DO_LEVE.pararVisto, "2026-11-19");
  const apagadas = apagarChavesDaRede([a]);
  ok("o Sair rápido apaga a fila, a impressão e a hora de parar", apagadas === 4 && a.length === 1 && a.getItem("outra:coisa") === "fica");
}

// ═══════════════════ 5. O código e os textos ═══════════════════
{
  const pasta = "components/rede/leve";
  const arquivos = fs.readdirSync(path.join(raiz, pasta)).map((f) => `${pasta}/${f}`).concat(["components/rede/alcance/VersaoLeve.tsx"]);
  const codigo = arquivos.map((f) => ler(f)).join("\n");
  ok("nenhum endereço de fora (serviço, fonte, imagem ou script de terceiros)", !/https?:\/\/(?!localhost)/.test(codigo.replace(/\/\/.*$/gm, "")));
  ok("nada de endereço de rede, localização ou perfil de comportamento", !/\b(ipify|geolocation|getCurrentPosition|x-forwarded-for|remote_addr|inet)\b/i.test(codigo));
  ok("criptografia só da biblioteca (SubtleCrypto), nada feito à mão", /crypto\.subtle\.digest\("SHA-256"/.test(ler(`${pasta}/regras.ts`)) && !/function\s+(sha|hash|cifrar)/i.test(codigo));
  ok("só rede.publicar e rede.linha chamam o banco nesta frente", [...codigo.matchAll(/\brede\.([a-z]+)\(/g)].every((m) => ["publicar", "linha"].includes(m[1])));
  ok("o texto do post entra como texto (nada de HTML cru)", !/dangerouslySetInnerHTML/.test(codigo));
  ok("nenhuma migração nova nesta frente", !fs.readdirSync(path.join(raiz, "supabase", "migracoes")).some((f) => /o13-leve/.test(f)));
  ok("o encaixe fica atrás da chave da página /alumia/leve", /rotaNovaLigada\("leve"\)/.test(ler(`${pasta}/encaixe.tsx`)) && /ligada\s*\?/.test(ler(`${pasta}/encaixe.tsx`)));
  ok("a tela /alumia/leve é a desta frente", /from "\.\.\/leve\/TelaLeve"/.test(ler("components/rede/alcance/VersaoLeve.tsx")));
  ok("o modo leve guarda a foto do post sem tocar no arquivo de outra frente (só CSS e atributos)", /figure\[data-lv-guardada\]/.test(ler(`${pasta}/leve.css`)) && /data-lv-figura/.test(ler(`${pasta}/NaCasca.tsx`)));

  const formas = (o, pre = "") => {
    const m = new Map();
    for (const [k, v] of Object.entries(o)) {
      if (k === "_rascunho") continue;
      if (v && typeof v === "object") for (const [kk, vv] of formas(v, `${pre}${k}.`)) m.set(kk, vv);
      else m.set(`${pre}${k}`, String(v).match(/\{[a-z]+\}/gi)?.sort().join() ?? "");
    }
    return m;
  };
  const pt = JSON.parse(ler("i18n/rede/leve/pt.json"));
  const base = formas(pt);
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const j = JSON.parse(ler(`i18n/rede/leve/${l}.json`));
    const outro = formas(j);
    const dif = [...base].filter(([k, v]) => outro.get(k) !== v).map(([k]) => k).concat([...outro.keys()].filter((k) => !base.has(k)));
    ok(`textos em ${l}: as mesmas chaves e os mesmos espaços para preencher${dif.length ? ` (difere: ${dif.slice(0, 5).join(", ")})` : ""}`, dif.length === 0 && (j._rascunho === true || !("_rascunho" in j)));
  }
  const todos = ["pt", "en", "es", "fr", "ru", "zh"].map((l) => ler(`i18n/rede/leve/${l}.json`)).join("\n");
  ok("nenhuma palavra proibida nos textos", !/diploma|universidade|algoritmo/i.test(todos));
  // O que a tela promete tem de ser verdade: nada de "criptografado", "anônimo" ou "seguro" sem que a frente faça isso.
  ok("a tela não promete proteção que esta frente não dá", !/criptograf|anônim|anonim|100%|seguro contra/i.test(JSON.stringify(pt)));
}

// Só no ramo da frente: depois da junta, quem junta mexe nesses arquivos de propósito.
if (!fs.existsSync(path.join(raiz, "supabase", "migracoes", "20261119-alumia-onda13-fim.sql"))) {
  let mudados = [];
  try {
    mudados = execFileSync("git", ["diff", "--name-only", "alumia-onda12"], { cwd: raiz, encoding: "utf8" }).split("\n").filter(Boolean);
    mudados = mudados.concat(execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { cwd: raiz, encoding: "utf8" }).split("\n").filter(Boolean));
  } catch {
    mudados = null;
  }
  if (mudados) {
    const PERMITIDOS = [/^components\/rede\/leve\//, /^components\/rede\/alcance\/VersaoLeve\.tsx$/, /^app\/\[lang\]\/alumia\/leve\//, /^i18n\/rede\/leve\//, /^scripts\/testar-alumia-o13-leve\.mjs$/];
    const fora = mudados.filter((f) => !PERMITIDOS.some((r) => r.test(f)));
    ok(`a frente só mexe nos arquivos dela${fora.length ? ` (${fora.join(", ")})` : ""}`, fora.length === 0);
  }
}

if (falhas.length) {
  console.error(`\n${falhas.length} falha(s), ${certos} certo(s):`);
  for (const f of falhas) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`leve e no seu tempo (onda 13, frente 13D): ${certos} conferências certas.`);
process.exit(0);
