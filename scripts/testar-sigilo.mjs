// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a cifra das conversas da equipe (lib/sigilo.ts), sem rede e sem banco: quem abre, quem não abre e o que acontece
// quando alguém mexe no texto cifrado. Uso: npm run testar:sigilo
import { cifrar, contextoDaConversa, contextoDoEmbrulho, contextoDoMural, decifrar, desembrulhar, embrulhar, FORMATO_PUBLICA, lerPublica, novaChave, novoAparelho, versaoDe } from "../lib/sigilo.ts";

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
const troca = (texto, posicao) => texto.slice(0, posicao) + (texto[posicao] === "A" ? "B" : "A") + texto.slice(posicao + 1);

const ana = await novoAparelho();
const bia = await novoAparelho();
const intrusa = await novoAparelho();
const conversa = crypto.randomUUID();
const outraConversa = crypto.randomUUID();
const aparelhoDaBia = crypto.randomUUID();
const autora = crypto.randomUUID();

await confere("a parte pública tem o formato que o banco aceita", () => FORMATO_PUBLICA.test(ana.publica) && FORMATO_PUBLICA.test(bia.publica));
await confere("a parte privada não pode ser exportada", async () => {
  try {
    await crypto.subtle.exportKey("pkcs8", ana.privada);
    return false;
  } catch {
    return true;
  }
});
await confere("ponto fora da curva é recusado", async () => {
  try {
    await lerPublica(`B${"A".repeat(86)}`);
    return false;
  } catch {
    return true;
  }
});

const chave = await novaChave();
const contexto = contextoDoEmbrulho(conversa, 1, aparelhoDaBia);
const embrulho = await embrulhar(chave, ana.privada, bia.publica, contexto);
await confere("o embrulho tem o formato que o banco aceita", () => /^w1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{64}$/.test(embrulho));
const daBia = await desembrulhar(embrulho, bia.privada, ana.publica, contexto);
await confere("o aparelho de destino abre o embrulho e chega à mesma chave", async () => {
  const texto = await cifrar(chave, 1, "teste", "x");
  return daBia !== null && (await decifrar(daBia, texto, "x")) === "teste";
});
await confere("outro aparelho não abre o embrulho", async () => (await desembrulhar(embrulho, intrusa.privada, ana.publica, contexto)) === null);
await confere("embrulho levado para outra conversa não abre", async () => (await desembrulhar(embrulho, bia.privada, ana.publica, contextoDoEmbrulho(outraConversa, 1, aparelhoDaBia))) === null);
await confere("embrulho levado para outra versão não abre", async () => (await desembrulhar(embrulho, bia.privada, ana.publica, contextoDoEmbrulho(conversa, 2, aparelhoDaBia))) === null);
await confere("embrulho com quem embrulhou trocado não abre", async () => (await desembrulhar(embrulho, bia.privada, intrusa.publica, contexto)) === null);
await confere("embrulho adulterado não abre", async () => (await desembrulhar(troca(embrulho, 30), bia.privada, ana.publica, contexto)) === null);
await confere("lixo no lugar do embrulho não quebra nada", async () => (await desembrulhar("w1.qualquer.coisa", bia.privada, ana.publica, contexto)) === null);

const lugar = contextoDaConversa(conversa, autora);
const mensagem = await cifrar(chave, 3, "Reunião às 19h, sala de sempre. Até lá! 🌱", lugar);
await confere("a mensagem cifrada tem o formato que o banco aceita", () => /^c2\.3\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{23,}$/.test(mensagem));
await confere("a mensagem cifrada não contém o texto", () => !mensagem.includes("Reunião"));
await confere("a versão é lida do texto cifrado", () => versaoDe(mensagem) === 3 && versaoDe("c1.AAAAAAAAAAAAAAAA.BBBB") === null && versaoDe("texto aberto") === null);
await confere("quem tem a chave lê, com acento e emoji", async () => (await decifrar(daBia, mensagem, lugar)) === "Reunião às 19h, sala de sempre. Até lá! 🌱");
await confere("mensagem levada para outra conversa não abre", async () => (await decifrar(daBia, mensagem, contextoDaConversa(outraConversa, autora))) === null);
await confere("mensagem atribuída a outro autor não abre", async () => (await decifrar(daBia, mensagem, contextoDaConversa(conversa, crypto.randomUUID()))) === null);
await confere("mensagem com a versão trocada não abre", async () => (await decifrar(daBia, mensagem.replace(/^c2\.3\./, "c2.4."), lugar)) === null);
await confere("mensagem adulterada não abre", async () => (await decifrar(daBia, troca(mensagem, mensagem.length - 5), lugar)) === null);
await confere("outra chave não abre", async () => (await decifrar(await novaChave(), mensagem, lugar)) === null);
await confere("o mural amarra o canal: o que foi escrito num canal não abre em outro", async () => {
  const recado = await cifrar(chave, 1, "Preciso de uma capa.", contextoDoMural("pedidos", autora));
  return (await decifrar(chave, recado, contextoDoMural("pedidos", autora))) === "Preciso de uma capa." && (await decifrar(chave, recado, contextoDoMural("design", autora))) === null;
});
await confere("o mesmo texto cifrado duas vezes sai diferente", async () => (await cifrar(chave, 1, "oi", lugar)) !== (await cifrar(chave, 1, "oi", lugar)));

console.log(`${certos} conferências certas${falhas.length ? `, ${falhas.length} com problema.` : "."}`);
for (const falha of falhas) console.log(`  ✗ ${falha}`);
process.exit(falhas.length ? 1 : 0);
