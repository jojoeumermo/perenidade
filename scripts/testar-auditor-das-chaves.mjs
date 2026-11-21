// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o auditor de fora do registro público das chaves (scripts/auditar-registro-das-chaves.mjs) contra o banco de verdade
// dentro do Node (PGlite com o install.sql), pelas funções públicas, como visitante sem conta: o auditor refaz a corrente, dá o
// mesmo resumo que o banco e o aparelho, e ACUSA o servidor que reescreve o passado (o caso que um aparelho novo não nota),
// encolhe o registro, quebra a corrente, volta a versão de uma chave, ou quando a cópia de fora foi mexida.
// Uso: npm run testar:auditor-das-chaves
import { criarBanco } from "./banco-local.mjs";
import { auditar, COMECO, resumoDaLinha } from "./auditar-registro-das-chaves.mjs";
import { atualizarVista, INICIO, resumoDaLinha as resumoDoAparelho } from "../lib/rede/chat/transparencia.ts";

let certos = 0;
const falhas = [];
async function espera(nome, promessa, conferirValor = () => true) {
  try {
    const valor = await promessa();
    if (conferirValor(valor)) certos++;
    else falhas.push(`${nome}: veio ${JSON.stringify(valor)?.slice(0, 300)}`);
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
  }
}

const banco = await criarBanco();
const { dono, rpc } = banco;
let ip = 10;
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++ % 250}` });
const publico = { ponta: () => rpc(visitante(), "rede_kt_ponta"), trecho: (desde) => rpc(visitante(), "rede_kt_trecho", { p_desde: desde }) };

// Linhas postas como o gatilho põe (o resumo calculado pelo próprio banco), sem precisar de aparelhos.
const QUEM = ["Q", "R", "S"].map((c) => `${c.repeat(43)}=`);
async function acrescentar(quem, identidade, versao, dia = "2026-11-10") {
  await dono(`
    insert into interno.rede_kt (seq, quem, identidade, versao, dia, resumo)
    select n, $1, $2, $3, $4::date, interno.rede_kt_resumo(coalesce((select resumo from interno.rede_kt order by seq desc limit 1), repeat('A', 43) || '='), n, $1, $2, $3, $4::date)
    from (select coalesce(max(seq), 0) + 1 as n from interno.rede_kt) x`, [quem, identidade, versao, dia]);
}

await espera("registro vazio: o auditor confere e começa a cópia sem linhas", () => auditar(publico, ""), (r) => r.problemas.length === 0 && r.ponta.seq === 0 && !/^\d/m.test(r.texto));

for (let i = 0; i < 3; i++) await acrescentar(QUEM[i], `oIDENTIDADE${i}`, 1);
let copia = "";
await espera("três chaves: o auditor refaz a corrente pela função pública, sem conta, e escreve as três linhas", async () => {
  const r = await auditar(publico, copia);
  copia = r.texto ?? copia;
  return r;
}, (r) => r.problemas.length === 0 && r.novas === 3 && r.texto.split("\n").filter((l) => /^\d/.test(l)).length === 3);

await espera("o banco, o aparelho e o auditor calculam o mesmo resumo", async () => {
  const linha = (await rpc(visitante(), "rede_kt_trecho", { p_desde: 0 }))[0];
  return [linha.resumo, resumoDaLinha(COMECO, linha), await resumoDoAparelho(COMECO, linha)];
}, ([banco_, auditor, aparelho]) => banco_ === auditor && auditor === aparelho);

await acrescentar(QUEM[1], "oIDENTIDADE1b", 2, "2026-11-12");
await espera("o registro cresceu: confere, e a cópia ganha só a linha nova", async () => {
  const r = await auditar(publico, copia);
  copia = r.texto ?? copia;
  return r;
}, (r) => r.problemas.length === 0 && r.novas === 1 && /\n4 [A-Za-z0-9+/]{43}=\n$/.test(r.texto));
const copiaBoa = copia;

// O ataque: o servidor troca a chave de uma linha antiga e refaz TODOS os resumos dali em diante. A corrente nova fecha.
await dono(`
  do $$ declare l record; v_ant text := repeat('A', 43) || '=';
  begin
    update interno.rede_kt set identidade = 'oFALSA' where seq = 2;
    for l in select * from interno.rede_kt order by seq loop
      update interno.rede_kt set resumo = interno.rede_kt_resumo(v_ant, l.seq, l.quem, l.identidade, l.versao, l.dia) where seq = l.seq returning resumo into v_ant;
    end loop;
  end $$`);
await espera("passado reescrito com a corrente refeita: um aparelho novo NÃO nota (a corrente fecha)", async () => (await atualizarVista(INICIO, publico)).seq, (n) => n === 4);
await espera("passado reescrito: o auditor ACUSA a linha 2, pela cópia de fora", () => auditar(publico, copiaBoa),
  (r) => r.problemas.some((p) => p.includes("o passado mudou") && p.includes("linha 2")) && r.texto === null);
await espera("sem a cópia de fora, nem o auditor notaria (por isso a cópia é publicada todo dia)", () => auditar(publico, ""), (r) => r.problemas.length === 0);

// Desfaz a troca (de volta ao registro honesto) para os outros ataques.
await dono(`
  do $$ declare l record; v_ant text := repeat('A', 43) || '=';
  begin
    update interno.rede_kt set identidade = 'oIDENTIDADE1' where seq = 2;
    for l in select * from interno.rede_kt order by seq loop
      update interno.rede_kt set resumo = interno.rede_kt_resumo(v_ant, l.seq, l.quem, l.identidade, l.versao, l.dia) where seq = l.seq returning resumo into v_ant;
    end loop;
  end $$`);
await espera("registro de volta ao que foi publicado: confere de novo", () => auditar(publico, copiaBoa), (r) => r.problemas.length === 0 && r.novas === 0);

await dono("delete from interno.rede_kt where seq = 4");
await espera("o registro encolheu (a última linha sumiu): o auditor acusa", () => auditar(publico, copiaBoa), (r) => r.problemas.some((p) => p.includes("encolheu")));
await acrescentar(QUEM[1], "oIDENTIDADE1b", 2, "2026-11-12");

await dono("update interno.rede_kt set identidade = 'oMEXIDA' where seq = 3");
await espera("uma linha mexida sem refazer os resumos: a corrente não fecha", () => auditar(publico, copiaBoa), (r) => r.problemas.some((p) => p.includes("não fecha na linha 3")));
await dono("update interno.rede_kt set identidade = 'oIDENTIDADE2' where seq = 3");

await acrescentar(QUEM[0], "oVOLTOU", 1, "2026-11-13");
await espera("a versão da chave de uma conta volta (1 depois de 1): o auditor acusa", () => auditar(publico, copiaBoa), (r) => r.problemas.some((p) => p.includes("volta a versão")));
await dono("delete from interno.rede_kt where seq = 5");

// Um servidor que mente na resposta (não no banco): trecho que pula, ponta que não bate, resposta sem fim.
const mentiroso = (mexer) => ({ ponta: publico.ponta, trecho: async (desde) => mexer(await publico.trecho(desde), desde) });
await espera("trecho que pula uma linha: acusa", () => auditar(mentiroso((t) => t.filter((l) => l.seq !== 2)), copiaBoa), (r) => r.problemas.some((p) => p.includes("número")));
await espera("ponta que não é a última linha: acusa", () => auditar({ ponta: async () => ({ seq: 4, resumo: `${"Z".repeat(43)}=` }), trecho: publico.trecho }, copiaBoa), (r) => r.problemas.some((p) => p.includes("ponta")));
await espera("trecho vazio antes da ponta: acusa", () => auditar({ ponta: async () => ({ seq: 9, resumo: `${"Z".repeat(43)}=` }), trecho: publico.trecho }, copiaBoa).then(() => "passou", (e) => e.codigo), (c) => c === "registro_estranho");

await espera("cópia de fora mexida (pula linha): o auditor recusa a cópia", () => auditar(publico, copiaBoa.replace(/\n2 [^\n]+/, "")).then(() => "passou", (e) => e.codigo), (c) => c === "copia_estranha");
await espera("a cópia não leva o resumo da conta, a chave nem o dia", async () => copiaBoa, (t) => !QUEM.some((q) => t.includes(q)) && !t.includes("IDENTIDADE") && !t.includes("2026-11"));

// Linhas com tipo da R2 (interno.rede_kt_resumo2, posto pela frente das caixas): o auditor dá o mesmo resumo que o aparelho, o
// tipo entra na corrente, e a versão da identidade da conta conta à parte da chave do chat do beta (sem falso alarme).
const { conferirCorrente } = await import("./auditar-registro-das-chaves.mjs");
const { resumoDaLinhaComTipo } = await import("../lib/rede/chat/transparencia.ts");
const linhaR2 = { seq: 1, tipo: "conta", quem: QUEM[0], identidade: "oCONTA0", versao: 1, dia: "2026-11-20" };
await espera("linha R2 com tipo: o auditor dá o mesmo resumo que o aparelho", async () => [resumoDaLinha(COMECO, linhaR2), await resumoDaLinhaComTipo(COMECO, linhaR2)], ([a, b]) => a === b);
await espera("linha R2: trocar o tipo muda o resumo (um tipo não passa por outro)", async () => [resumoDaLinha(COMECO, linhaR2), resumoDaLinha(COMECO, { ...linhaR2, tipo: "aparelho" })], ([a, b]) => a !== b);
await espera("linha do beta (sem tipo ou 'olm'): o resumo é o de antes", async () => [resumoDaLinha(COMECO, { ...linhaR2, tipo: undefined }), resumoDaLinha(COMECO, { ...linhaR2, tipo: "olm" })], ([a, b]) => a === b);
{
  const montar = (cruas) => {
    let anterior = COMECO;
    return cruas.map((l, i) => {
      const comSeq = { ...l, seq: i + 1 };
      anterior = resumoDaLinha(anterior, comSeq);
      return { ...comSeq, resumo: anterior };
    });
  };
  const mistas = montar([
    { quem: QUEM[0], identidade: "oBETA", versao: 3, dia: "2026-11-10" },
    { tipo: "conta", quem: QUEM[0], identidade: "oCONTA0", versao: 1, dia: "2026-11-20" },
    { tipo: "aparelho", quem: QUEM[0], identidade: "oAPARELHO", versao: 1, dia: "2026-11-20" },
    { tipo: "aparelho", quem: QUEM[0], identidade: "oAPARELHO2", versao: 1, dia: "2026-11-21" },
  ]);
  const ponta = (ls) => ({ seq: ls.length, resumo: ls[ls.length - 1].resumo });
  await espera("corrente com linhas do beta e da R2: a versão da conta conta à parte (sem falso alarme)", async () => conferirCorrente({ ponta: ponta(mistas), linhas: mistas }).problemas, (p) => p.length === 0);
  const volta = montar([
    { tipo: "conta", quem: QUEM[0], identidade: "oCONTA0", versao: 2, dia: "2026-11-20" },
    { tipo: "conta", quem: QUEM[0], identidade: "oCONTAVELHA", versao: 1, dia: "2026-11-21" },
  ]);
  await espera("a identidade da conta volta de versão: o auditor acusa", async () => conferirCorrente({ ponta: ponta(volta), linhas: volta }).problemas, (p) => p.some((x) => x.includes("volta a versão")));
}

console.log(`${certos} conferências certas${falhas.length ? `, ${falhas.length} com problema.` : "."}`);
for (const falha of falhas) console.log(`  ✗ ${falha}`);
await banco.fechar?.();
process.exit(falhas.length ? 1 : 0);
