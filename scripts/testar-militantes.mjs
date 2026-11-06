// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a inscrição de militantes da Frente Revolucionária Lúcia (T15): supabase/migracoes/20261106-t15-frente-militantes.sql
// num Postgres de verdade dentro do Node (o install.sql já traz o mesmo bloco no fim).
//   - o voluntariado de sempre continua igual (tipo 'voluntario' por padrão);
//   - militante sem consentimento destacado ou sem 18 anos declarados é recusado (LGPD, arts. 11, I, e 14);
//   - a inscrição militante guarda o momento do consentimento e chega na MESMA lista do painel, com o tipo;
//   - a mesma pessoa pode ter um pedido de voluntário e outro de militante, mas não dois militantes iguais;
//   - nem por fora da função entra militante sem consentimento (restrição na tabela);
//   - rodar a migração de novo não muda nada.
// E confere as peças do site: formulário, páginas, rotas e textos.
// Uso: npm run testar:militantes
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (...partes) => fs.readFileSync(path.join(raiz, ...partes), "utf8");
const sql = ler("supabase", "migracoes", "20261106-t15-frente-militantes.sql");

let certos = 0;
const falhas = [];
const confere = (nome, condicao) => (condicao ? certos++ : falhas.push(nome));
async function espera(nome, promessa, conferir) {
  try {
    const valor = await promessa();
    if (conferir && !(await conferir(valor))) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 300)}`);
    certos++;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
  }
}
async function recusa(nome, promessa, codigo) {
  try {
    const valor = await promessa();
    falhas.push(`${nome}: deveria recusar com "${codigo}", mas passou (${JSON.stringify(valor)?.slice(0, 160)})`);
  } catch (erro) {
    if (String(erro.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro.message}"`);
  }
}

// ── O banco ──
confere("install.sql traz o bloco da migração no fim", ler("supabase", "install.sql").trimEnd().endsWith(sql.trimEnd()));
const banco = await criarBanco();
const { rpc, dono, criarUsuario } = banco;
const anon = (ip) => ({ papel: "anon", ip });

const coord = await criarUsuario("coord@teste.local", "Jonathan");
await rpc({ papel: "authenticated", sub: coord }, "eu");
await dono("select public.promover_coordenacao('coord@teste.local')");
const comoCoord = { papel: "authenticated", sub: coord, aal: "aal2" };

const pedido = (extra = {}) => ({ nome: "Rosa Operária", email: "rosa@teste.local", papel: "jornalismo", mensagem: "Escrevo para o boletim do sindicato e quero somar na formação militante.", ...extra });
const militante = (extra = {}) => pedido({ tipo: "militante", consentimento: true, maior_idade: true, ...extra });

await espera("voluntariado de sempre continua entrando", () => rpc(anon("198.51.100.10"), "voluntariar", { p: pedido() }), (r) => Boolean(r.id));
await espera("sem tipo, a inscrição é de voluntário", () => dono("select tipo, consentimento_em, maior_idade from interno.inscricoes where email = 'rosa@teste.local'"), (r) => r.rows.length === 1 && r.rows[0].tipo === "voluntario" && r.rows[0].consentimento_em === null);
await recusa("tipo inventado é recusado", () => rpc(anon("198.51.100.11"), "voluntariar", { p: pedido({ tipo: "chefe", email: "x@teste.local" }) }), "invalido:tipo");
await recusa("militante sem consentimento é recusado (LGPD, art. 11, I)", () => rpc(anon("198.51.100.12"), "voluntariar", { p: militante({ consentimento: false }) }), "invalido:consentimento");
await recusa("militante sem 18 anos declarados é recusado (LGPD, art. 14)", () => rpc(anon("198.51.100.13"), "voluntariar", { p: militante({ maior_idade: false }) }), "invalido:idade");
await recusa("militante com a idade em texto não passa", () => rpc(anon("198.51.100.13"), "voluntariar", { p: militante({ maior_idade: "sim" }) }), "invalido:idade");
await espera("a mesma pessoa se inscreve como militante (pedido separado do voluntariado)", () => rpc(anon("198.51.100.14"), "voluntariar", { p: militante() }), (r) => Boolean(r.id));
await recusa("inscrição militante repetida não entra duas vezes", () => rpc(anon("198.51.100.15"), "voluntariar", { p: militante() }), "ja_pediu");
await espera("a inscrição militante guarda o momento do consentimento e a maioridade", () => dono("select consentimento_em, maior_idade from interno.inscricoes where tipo = 'militante'"), (r) => r.rows.length === 1 && r.rows[0].consentimento_em !== null && r.rows[0].maior_idade === true);
await espera("o campo-isca continua valendo para militante", async () => {
  await rpc(anon("198.51.100.16"), "voluntariar", { p: militante({ email: "robo@teste.local", site: "http://spam" }) });
  return dono("select count(*)::int as n from interno.inscricoes where email = 'robo@teste.local'");
}, (r) => r.rows[0].n === 0);
await espera("o e-mail de confirmação diz que é inscrição militante", () => dono("select count(*)::int as n from interno.emails where para = 'rosa@teste.local' and assunto = 'Recebemos sua inscrição de militante'"), (r) => r.rows[0].n === 1);
await recusa("nem por fora da função entra militante sem consentimento", () => dono("insert into interno.inscricoes (nome, email, papel, mensagem, tipo) values ('Fulano de Tal', 'f@teste.local', 'revisao', 'Mensagem longa o bastante para passar na regra.', 'militante')"), "inscricoes_militante_check");
await espera("a coordenação vê as duas inscrições na mesma lista, com o tipo", () => rpc(comoCoord, "inscricoes_listar"), (r) => r.filter((i) => i.email === "rosa@teste.local").map((i) => i.tipo).sort().join() === "militante,voluntario" && r.some((i) => i.tipo === "militante" && i.consentimento_em));
await recusa("quem não é da coordenação não vê a lista", () => rpc(anon("198.51.100.17"), "inscricoes_listar"), "");
await espera("rodar a migração de novo não muda nada", async () => {
  await banco.exclusivo(() => banco.pg.exec(sql));
  return dono("select count(*)::int as n, count(*) filter (where tipo = 'militante')::int as m from interno.inscricoes");
}, (r) => r.rows[0].n === 2 && r.rows[0].m === 1);

// ── O site ──
const form = ler("components", "VolunteerForm.tsx");
confere("o formulário manda tipo, consentimento e maioridade só no modo militante", /tipo: "militante"/.test(form) && /consentimento/.test(form) && /maior_idade/.test(form));
confere("o formulário militante tem as duas caixas obrigatórias", (form.match(/type="checkbox"/g) ?? []).length >= 2 && /required/.test(form));
const rotas = ler("lib", "escola", "rotas.ts");
confere("rotas da Frente na Escola", /\/escola\/militantes/.test(rotas) && /\/escola\/manifesto/.test(rotas));
for (const pagina of ["militantes", "manifesto"]) confere(`página /escola/${pagina}`, fs.existsSync(path.join(raiz, "app", "[lang]", "escola", pagina, "page.tsx")));
const porta = ler("components", "escola", "PortaDaEscola.tsx");
confere("manifesto e chamado militante são públicos (a porta deixa passar)", /PUBLICAS_DA_ESCOLA/.test(porta) && /PUBLICAS_DA_ESCOLA/.test(rotas));
const manifesto = ler("content", "escola", "manifesto.md");
confere("o manifesto está marcado como versão inicial, em discussão", /versão inicial/i.test(manifesto) && /em discussão/i.test(manifesto));
confere("o manifesto é o mesmo do docs", ler("docs", "escola-revolucionaria", "MANIFESTO.md").includes(manifesto.replace(/^---[\s\S]*?---\s*/, "").trim().split("\n")[0]));
const quemFoi = ler("content", "escola", "quem-foi-lucia-maria.md");
confere("Quem foi Lúcia Maria tem texto (não só o marcador)", !quemFoi.includes("[TEXTO A ENVIAR PELA COORDENAÇÃO]") && quemFoi.length > 1500);
confere("as fontes do texto estão anotadas", /DeuwQ7QmU5W/.test(ler("docs", "escola-revolucionaria", "FONTES-LUCIA-MARIA.md")));
const proibidas = /universidade|diploma/i;
confere("nem 'universidade' nem 'diploma' nos textos novos", !proibidas.test(manifesto) && !proibidas.test(quemFoi) && !proibidas.test(ler("i18n", "escola", "frente", "pt.json")));
const pessoas = ler("components", "painel", "Pessoas.tsx");
confere("o painel marca a inscrição militante", /militante/i.test(pessoas) && /tipo/.test(pessoas));

if (falhas.length) {
  console.error(`militantes: ${certos} certos, ${falhas.length} falhas:\n- ${falhas.join("\n- ")}`);
  process.exit(1);
}
console.log(`militantes: ${certos} conferências certas.`);
process.exit(0);
