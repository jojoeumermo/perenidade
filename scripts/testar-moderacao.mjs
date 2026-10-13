// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a chamada ao serviço de moderação sem tocar na rede: o serviço é trocado por respostas montadas aqui.
// O que o banco faz com cada resultado é provado em testar-banco.mjs. Uso: npm run testar:moderacao
import { ENDERECO, MODELO, moderar } from "../supabase/functions/avaliar-comunidade/moderacao.mjs";

let certos = 0;
const falhas = [];
async function espera(nome, promessa, conferir) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 200)}`);
    certos++;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
  }
}

const CHAVE = "sk-chave-de-teste-que-nao-pode-vazar";
const notas = (extra = {}) => ({ hate: 0.001, "hate/threatening": 0.0001, harassment: 0.002, "harassment/threatening": 0.0001, sexual: 0.0001, "sexual/minors": 0.00001, violence: 0.001, "violence/graphic": 0.0001, "self-harm": 0.0001, ...extra });
const categorias = (extra = {}) => Object.fromEntries(Object.keys(notas()).map((nome) => [nome, extra[nome] ?? false]));
const servico = (corpo, status = 200) => {
  const pedidos = [];
  const buscar = async (endereco, opcoes) => {
    pedidos.push({ endereco, opcoes });
    return new Response(typeof corpo === "string" ? corpo : JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
  };
  return { buscar, pedidos };
};

// ── O pedido ──
const limpo = servico({ results: [{ flagged: false, categories: categorias(), category_scores: notas() }] });
await espera("conteúdo adequado volta sem sinalização", () => moderar("Alguém explica o que é mais-valia?", CHAVE, { buscar: limpo.buscar }), (r) => r.sinalizado === false && r.notas.hate < 0.01 && r.categorias.hate === false);
await espera("o pedido vai ao endereço oficial, com o modelo e o texto", async () => limpo.pedidos[0], (p) => p.endereco === ENDERECO && ENDERECO === "https://api.openai.com/v1/moderations" && JSON.parse(p.opcoes.body).model === MODELO && JSON.parse(p.opcoes.body).input === "Alguém explica o que é mais-valia?" && p.opcoes.method === "POST");
await espera("a chave vai só no cabeçalho do pedido", async () => limpo.pedidos[0].opcoes, (o) => o.headers.Authorization === `Bearer ${CHAVE}` && !o.body.includes(CHAVE));
await espera("o pedido tem prazo para terminar", async () => limpo.pedidos[0].opcoes.signal, (s) => s instanceof AbortSignal);
await espera("texto enorme é cortado antes de sair", async () => { const s = servico({ results: [{ flagged: false, categories: categorias(), category_scores: notas() }] }); await moderar("a".repeat(50000), CHAVE, { buscar: s.buscar }); return JSON.parse(s.pedidos[0].opcoes.body).input.length; }, (n) => n === 8200);

// ── Conteúdo nocivo e ambíguo: o resultado chega inteiro ao banco, que decide ──
await espera("conteúdo nocivo volta sinalizado, com as categorias", () => moderar("texto de ameaça", CHAVE, { buscar: servico({ results: [{ flagged: true, categories: categorias({ "harassment/threatening": true }), category_scores: notas({ "harassment/threatening": 0.97 }) }] }).buscar }), (r) => r.sinalizado === true && r.categorias["harassment/threatening"] === true && r.notas["harassment/threatening"] === 0.97);
await espera("caso ambíguo volta com as notas, sem decisão tomada aqui", () => moderar("texto duvidoso", CHAVE, { buscar: servico({ results: [{ flagged: false, categories: categorias(), category_scores: notas({ harassment: 0.62 }) }] }).buscar }), (r) => r.sinalizado === false && r.notas.harassment === 0.62 && !("veredito" in r));

// ── Falhas: toda falha vira { erro }, nunca um resultado limpo ──
await espera("sem chave, nem chama o serviço", async () => { const s = servico({}); return [await moderar("texto", "", { buscar: s.buscar }), await moderar("texto", undefined, { buscar: s.buscar }), s.pedidos.length]; }, (r) => r[0].erro === "sem_chave" && r[1].erro === "sem_chave" && r[2] === 0);
await espera("texto vazio não é avaliado como limpo", () => moderar("   ", CHAVE, { buscar: limpo.buscar }), (r) => r.erro === "sem_texto");
await espera("limite de requisições (429)", () => moderar("texto", CHAVE, { buscar: servico({ error: { message: "Rate limit" } }, 429).buscar }), (r) => r.erro === "limite");
await espera("serviço fora do ar (500)", () => moderar("texto", CHAVE, { buscar: servico("erro interno", 500).buscar }), (r) => r.erro === "indisponivel");
await espera("chave recusada (401)", () => moderar("texto", CHAVE, { buscar: servico({ error: { message: `Incorrect API key provided: ${CHAVE}` } }, 401).buscar }), (r) => r.erro === "chave_recusada" && !JSON.stringify(r).includes(CHAVE));
// O relógio do prazo não segura o processo aberto sozinho; este intervalo segura enquanto a conferência roda.
const acordado = setInterval(() => {}, 10);
await espera("tempo esgotado", () => moderar("texto", CHAVE, { prazo: 30, buscar: (_endereco, opcoes) => new Promise((_resolve, reject) => opcoes.signal.addEventListener("abort", () => reject(opcoes.signal.reason))) }), (r) => r.erro === "tempo_esgotado");
clearInterval(acordado);
await espera("sem conexão", () => moderar("texto", CHAVE, { buscar: async () => { throw new TypeError("fetch failed"); } }), (r) => r.erro === "sem_conexao");
await espera("resposta que não é JSON", () => moderar("texto", CHAVE, { buscar: servico("<html>manutenção</html>").buscar }), (r) => r.erro === "resposta_invalida");
await espera("resposta sem resultado", () => moderar("texto", CHAVE, { buscar: servico({ results: [] }).buscar }), (r) => r.erro === "resposta_invalida");
await espera("resultado pela metade (sem as notas)", () => moderar("texto", CHAVE, { buscar: servico({ results: [{ flagged: false, categories: categorias() }] }).buscar }), (r) => r.erro === "resposta_invalida");
await espera("resultado com as notas vazias", () => moderar("texto", CHAVE, { buscar: servico({ results: [{ flagged: false, categories: {}, category_scores: {} }] }).buscar }), (r) => r.erro === "resposta_invalida");
await espera("resultado com nota que não é número", () => moderar("texto", CHAVE, { buscar: servico({ results: [{ flagged: false, categories: categorias(), category_scores: notas({ hate: "baixa" }) }] }).buscar }), (r) => r.erro === "resposta_invalida");
await espera("nenhuma falha devolve a chave", async () => JSON.stringify([
  await moderar("texto", CHAVE, { buscar: servico({}, 429).buscar }),
  await moderar("texto", CHAVE, { buscar: servico({}, 500).buscar }),
  await moderar("texto", CHAVE, { buscar: async () => { throw new Error(`falha com ${CHAVE}`); } }),
]), (r) => !r.includes(CHAVE));

console.log(`${certos} conferências certas, ${falhas.length} com problema.`);
for (const falha of falhas) console.log("  ✗", falha);
process.exit(falhas.length ? 1 : 0);
