// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o histórico do chat no aparelho (lib/rede/chat/historico.ts) com um IndexedDB de teste (fake-indexeddb): fica cifrado,
// vence sozinho, a trava por senha fecha de verdade (senha errada não abre, sem senha nada sai), e o apagar.
// Uso: npm run testar:chat-historico
import "fake-indexeddb/auto";
import {
  apagarConversaDoHistorico, apagarDoHistorico, destravarHistorico, esquecerChavesDoHistorico, exigirHistoricoAberto, fecharHistorico, guardarNoHistorico, historicoTravado,
  mensagensDoHistorico, travarHistorico,
} from "../lib/rede/chat/historico.ts";

let certos = 0;
const falhas = [];
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (conferir(valor)) certos++;
    else falhas.push(`${nome}: veio ${JSON.stringify(valor)?.slice(0, 200)}`);
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

const CONTA = "11111111-1111-4111-8111-111111111111";
const OUTRA = "22222222-2222-4222-8222-222222222222";
const CONVERSA = "33333333-3333-4333-8333-333333333333";
const agora = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const msg = (id, texto, desloc = 0, vence = 86_400_000, autor = OUTRA) => ({
  id, conta: CONTA, conversa: CONVERSA, autor, quando: iso(agora + desloc), expira: iso(agora + desloc + vence), texto, idInterno: `id-${id}`, contador: 1, visto: { versao: 0, contador: 0 }, versao: 1, umaVez: false,
});

await guardarNoHistorico(msg("a", "primeira", 0));
await guardarNoHistorico(msg("b", "segunda", 1000));
await guardarNoHistorico(msg("c", "já venceu", 2000, -5000));
await espera("lê as mensagens em ordem e apaga a vencida no caminho", () => mensagensDoHistorico(CONTA, CONVERSA), (l) => l.map((m) => m.texto).join("|") === "primeira|segunda");
await espera("no IndexedDB, o texto está cifrado (nada legível)", async () => {
  const banco = await new Promise((r) => { const p = indexedDB.open("lucia-alumia-historico"); p.onsuccess = () => r(p.result); });
  const todos = await new Promise((r) => { const p = banco.transaction("mensagens").objectStore("mensagens").getAll(); p.onsuccess = () => r(p.result); });
  banco.close();
  return todos.map((x) => JSON.stringify({ ...x, cifrado: [...new Uint8Array(x.cifrado)] })).join("");
}, (t) => t.length > 0 && !t.includes("primeira") && !t.includes("segunda") && !t.includes("id-a"));
await espera("a chave do histórico não é exportável", async () => {
  const banco = await new Promise((r) => { const p = indexedDB.open("lucia-alumia-historico"); p.onsuccess = () => r(p.result); });
  const g = await new Promise((r) => { const p = banco.transaction("chaves").objectStore("chaves").get(CONTA); p.onsuccess = () => r(p.result); });
  banco.close();
  return g.chave.extractable;
}, (e) => e === false);
await espera("paginar: antes de um momento", () => mensagensDoHistorico(CONTA, CONVERSA, iso(agora + 500)), (l) => l.length === 1 && l[0].texto === "primeira");

// ── Trava ──
await recusa("senha curta não trava", () => travarHistorico(CONTA, "1234"), "senha_curta");
await travarHistorico(CONTA, "uma senha boa");
await espera("depois de travar, o histórico diz que está travado", () => historicoTravado(CONTA), (v) => v === true);
await espera("nesta aba, continua aberto até fechar", () => mensagensDoHistorico(CONTA, CONVERSA), (l) => l.length === 2);
fecharHistorico(CONTA);
await recusa("fechado: não lê", () => mensagensDoHistorico(CONTA, CONVERSA), "historico_travado");
await recusa("fechado: não guarda (e a caixa não é aberta)", () => exigirHistoricoAberto(CONTA), "historico_travado");
esquecerChavesDoHistorico(); // como uma aba nova
await recusa("senha errada não abre", () => destravarHistorico(CONTA, "outra senha"), "senha_errada");
await destravarHistorico(CONTA, "uma senha boa");
await espera("com a senha certa, abre o que estava antes da trava", () => mensagensDoHistorico(CONTA, CONVERSA), (l) => l.map((m) => m.texto).join("|") === "primeira|segunda");
await guardarNoHistorico(msg("d", "depois da trava", 3000));
await espera("e guarda as novas com a mesma chave", () => mensagensDoHistorico(CONTA, CONVERSA), (l) => l.length === 3);

// ── Apagar ──
await apagarDoHistorico(["a"]);
await espera("apagar uma mensagem", () => mensagensDoHistorico(CONTA, CONVERSA), (l) => !l.some((m) => m.id === "a"));
await apagarConversaDoHistorico(CONTA);
await espera("apagar tudo da conta leva as mensagens e a chave", async () => [await historicoTravado(CONTA), (await mensagensDoHistorico(CONTA, CONVERSA)).length], (r) => r[0] === false && r[1] === 0);

console.log(`${certos} conferências certas${falhas.length ? `, ${falhas.length} com problema.` : "."}`);
for (const falha of falhas) console.log(`  ✗ ${falha}`);
process.exit(falhas.length ? 1 : 0);
