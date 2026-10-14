// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a rotina de envio de e-mails sem rede: o banco e o serviço de envio são trocados por respostas montadas aqui.
// O que entra na fila, e quando, é provado em testar-banco.mjs. Uso: npm run testar:emails
import { html, pedido, RESEND, rodada } from "./enviar-emails.mjs";

let certos = 0;
const falhas = [];
async function espera(nome, promessa, conferir) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 220)}`);
    certos++;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
  }
}

const CHAVE = "re_chave_de_teste_que_nao_pode_vazar";
const fila = (n = 2) => Array.from({ length: n }, (_, i) => ({ id: `00000000-0000-0000-0000-00000000000${i}`, para: `pessoa${i}@exemplo.org`, assunto: `Assunto ${i}`, texto: `Olá.\n\nLinha ${i}\nhttps://institutolucia.org/pt/entrar?convite=abc${i}`, sair: "" }));
/** Um banco de mentira: entrega a fila e anota cada resultado. */
const banco = (itens) => {
  const resultados = [];
  const chamar = async (funcao, argumentos) => {
    if (funcao === "emails_pendentes") return itens;
    if (funcao === "email_resultado") resultados.push(argumentos);
    return { ok: true };
  };
  return { chamar, resultados };
};
/** Um serviço de envio de mentira: responde com os códigos dados, um por pedido. */
const servico = (...codigos) => {
  const pedidos = [];
  const buscar = async (endereco, opcoes) => {
    pedidos.push({ endereco, opcoes });
    const codigo = codigos[Math.min(pedidos.length - 1, codigos.length - 1)];
    if (codigo instanceof Error) throw codigo;
    return new Response(JSON.stringify({ id: "x" }), { status: codigo });
  };
  return { buscar, pedidos };
};
const base = { chave: CHAVE, remetente: "Instituto Lúcia <contato@institutolucia.org>", pausa: 0 };

// ── Envio normal ──
await espera("envia a fila e devolve cada resultado ao banco", async () => {
  const b = banco(fila(2)); const s = servico(200);
  const r = await rodada({ ...base, chamar: b.chamar, buscar: s.buscar });
  return [r, b.resultados, s.pedidos.length];
}, ([r, res, n]) => r.enviados === 2 && r.falhas === 0 && n === 2 && res.every((x) => x.p_ok === true && x.p_erro === ""));
await espera("o pedido vai ao endereço do serviço, com a chave só no cabeçalho", async () => {
  const s = servico(200); await rodada({ ...base, chamar: banco(fila(1)).chamar, buscar: s.buscar }); return s.pedidos[0];
}, (p) => p.endereco === RESEND && p.opcoes.headers.Authorization === `Bearer ${CHAVE}` && !p.opcoes.body.includes(CHAVE));
await espera("cada e-mail leva uma chave de idempotência própria (nada sai duas vezes)", async () => {
  const s = servico(200); await rodada({ ...base, chamar: banco(fila(2)).chamar, buscar: s.buscar }); return s.pedidos.map((p) => p.opcoes.headers["Idempotency-Key"]);
}, (k) => k[0] === "lucia-00000000-0000-0000-0000-000000000000" && k[1] !== k[0]);
await espera("remetente, destinatário, assunto, texto e HTML", async () => JSON.parse(JSON.stringify(pedido(fila(1)[0], { remetente: base.remetente, resposta: "respostas@institutolucia.org" }))),
  (p) => p.from === base.remetente && p.to[0] === "pessoa0@exemplo.org" && p.subject === "Assunto 0" && p.text.includes("Linha 0") && p.html.includes("<p>") && p.reply_to === "respostas@institutolucia.org" && !p.headers);
await espera("boletim leva o cabeçalho de saída da lista", async () => pedido({ ...fila(1)[0], sair: "https://institutolucia.org/pt/jornal?boletim=sair&codigo=" + "a".repeat(32) }, base),
  (p) => p.headers["List-Unsubscribe"] === `<https://institutolucia.org/pt/jornal?boletim=sair&codigo=${"a".repeat(32)}>`);
await espera("o HTML escapa o texto e só transforma em link o que é https", async () => html('Oi <script>alert(1)</script> & "x"\n\nveja https://institutolucia.org/a?b=1 e javascript:alert(1)'),
  (h) => !h.includes("<script>") && h.includes("&lt;script&gt;") && h.includes('<a href="https://institutolucia.org/a?b=1">') && !h.includes('href="javascript'));

// ── Falhas: o e-mail volta para a fila (o banco decide quantas tentativas) ──
await espera("serviço fora do ar: falha anotada, nada dado como enviado", async () => { const b = banco(fila(2)); const r = await rodada({ ...base, chamar: b.chamar, buscar: servico(500).buscar }); return [r, b.resultados]; },
  ([r, res]) => r.enviados === 0 && r.falhas === 2 && res.every((x) => x.p_ok === false && x.p_erro === "http_500"));
await espera("limite de envios: para na hora e deixa o resto para a próxima rodada", async () => { const b = banco(fila(3)); const s = servico(429); const r = await rodada({ ...base, chamar: b.chamar, buscar: s.buscar }); return [r, s.pedidos.length, b.resultados.length]; },
  ([r, n, res]) => r.erros.limite === 1 && n === 1 && res === 1);
await espera("chave recusada: para na hora", async () => { const s = servico(401); const r = await rodada({ ...base, chamar: banco(fila(3)).chamar, buscar: s.buscar }); return [r, s.pedidos.length]; }, ([r, n]) => r.erros.chave_recusada === 1 && n === 1);
await espera("endereço recusado pelo serviço não impede os outros", async () => { const b = banco(fila(2)); const r = await rodada({ ...base, chamar: b.chamar, buscar: servico(422, 200).buscar }); return [r, b.resultados.map((x) => x.p_ok)]; },
  ([r, oks]) => r.enviados === 1 && r.erros.recusado === 1 && oks.join() === "false,true");
await espera("sem conexão", async () => { const b = banco(fila(1)); const r = await rodada({ ...base, chamar: b.chamar, buscar: servico(new TypeError("fetch failed")).buscar }); return [r, b.resultados[0]]; },
  ([r, res]) => r.erros.sem_conexao === 1 && res.p_ok === false);
await espera("fila vazia não chama o serviço", async () => { const s = servico(200); const r = await rodada({ ...base, chamar: banco([]).chamar, buscar: s.buscar }); return [r, s.pedidos.length]; }, ([r, n]) => r.enviados === 0 && n === 0);
await espera("nenhuma falha devolve a chave", async () => JSON.stringify(await rodada({ ...base, chamar: banco(fila(1)).chamar, buscar: async () => { throw new Error(`falha com ${CHAVE}`); } })), (texto) => !texto.includes(CHAVE));

console.log(`${certos} conferências certas, ${falhas.length} com problema.`);
for (const falha of falhas) console.log("  ✗", falha);
process.exit(falhas.length ? 1 : 0);
