// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova os arquivos das conversas (lib/anexos.ts): tipo descoberto pelos bytes, cifra por arquivo com chave própria presa à
// conversa, resumo conferido, limites, forma de onda e a leitura do que vem dentro da mensagem. Uso: npm run testar:anexos
import { anexoValido, cifrarArquivo, deBase64, deBase64Comum, decifrarArquivo, identificar, LIMITE_BYTES, paraBase64, paraBase64Comum, picosDe } from "../lib/anexos.ts";
import { desempacotar, empacotar } from "../lib/mensagem.ts";

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
const bytes = (...valores) => new Uint8Array(new ArrayBuffer(valores.length)).map((_, i) => valores[i]);
const texto = (valor) => new TextEncoder().encode(valor);
const cabecalho = (inicio, tamanho = 32) => { const saida = new Uint8Array(new ArrayBuffer(tamanho)); saida.set(typeof inicio === "string" ? texto(inicio) : inicio); return saida; };

// ── Tipo pelos bytes ──
await confere("JPEG, PNG, WebP e GIF são imagens", () => identificar(cabecalho(bytes(0xff, 0xd8, 0xff, 0xe0))).mime === "image/jpeg" && identificar(cabecalho(bytes(0x89, 0x50, 0x4e, 0x47))).mime === "image/png" && identificar(cabecalho("RIFF\0\0\0\0WEBP")).tipo === "imagem" && identificar(cabecalho("GIF89a")).mime === "image/gif");
await confere("PDF pelo %PDF-", () => identificar(cabecalho("%PDF-1.7")).tipo === "pdf");
await confere("MP4 e MOV pelo ftyp; M4A é áudio", () => identificar(cabecalho(bytes(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d))).mime === "video/mp4" && identificar(cabecalho(bytes(0, 0, 0, 0x14, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20))).mime === "video/quicktime" && identificar(cabecalho(bytes(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20))).mime === "audio/mp4");
await confere("WebM é vídeo, salvo se o gravador disser que é áudio", () => identificar(cabecalho(bytes(0x1a, 0x45, 0xdf, 0xa3))).mime === "video/webm" && identificar(cabecalho(bytes(0x1a, 0x45, 0xdf, 0xa3)), "audio/webm").mime === "audio/webm");
await confere("OGG, MP3 e WAV são áudio", () => identificar(cabecalho("OggS")).tipo === "audio" && identificar(cabecalho("ID3")).mime === "audio/mpeg" && identificar(cabecalho(bytes(0xff, 0xfb))).mime === "audio/mpeg" && identificar(cabecalho("RIFF\0\0\0\0WAVE")).mime === "audio/wav");
await confere("DOCX só com a assinatura de zip e o MIME do Word; zip qualquer não entra", () => identificar(cabecalho(bytes(0x50, 0x4b, 3, 4)), "application/vnd.openxmlformats-officedocument.wordprocessingml.document").tipo === "docx" && identificar(cabecalho(bytes(0x50, 0x4b, 3, 4)), "application/zip") === null);
await confere("HTML, executável e texto são recusados, mesmo com MIME de imagem", () => identificar(cabecalho("<!doctype html>"), "image/png") === null && identificar(cabecalho("MZ\0\0"), "image/jpeg") === null && identificar(cabecalho("ola mundo")) === null);
await confere("arquivo curto demais é recusado", () => identificar(bytes(0xff, 0xd8, 0xff)) === null);

// ── Base64 ──
await confere("base64url vai e volta, inclusive com os bytes que viram + e /", () => { const original = bytes(0xfb, 0xff, 0xbf, 0, 1, 2, 250, 251, 252); const b = paraBase64(original); return !/[+/=]/.test(b) && deBase64(b).join(",") === original.join(","); });
await confere("base64 comum para o banco, com + e / e o = do fim (o Postgres exige)", () => { const original = bytes(0xfb, 0xff, 0xbf, 1); const b = paraBase64Comum(original); return /[+/]/.test(b) && b.length % 4 === 0 && b.endsWith("==") && b === Buffer.from(original).toString("base64") && deBase64Comum(b).join(",") === original.join(","); });

// ── Cifra por arquivo ──
const conteudo = new Uint8Array(new ArrayBuffer(5000)).map((_, i) => (i * 7) % 256);
const conversa = "11111111-1111-4111-8111-111111111111";
const selado = await cifrarArquivo(conteudo, conversa);
await confere("cifra com chave e vetor novos, e o cifrado não é o conteúdo", () => selado.chave.length === 43 && selado.iv.length === 16 && selado.hash.length === 43 && selado.cifrado.length === conteudo.length + 16 && selado.cifrado.join(",") !== conteudo.join(","));
await confere("duas cifras do mesmo arquivo não se parecem (chave sorteada a cada vez)", async () => (await cifrarArquivo(conteudo, conversa)).chave !== selado.chave);
await confere("abre com a chave da mensagem e confere o resumo", async () => (await decifrarArquivo(selado.cifrado, selado, conversa))?.join(",") === conteudo.join(","));
await confere("em outra conversa não abre (o arquivo é preso à conversa)", async () => (await decifrarArquivo(selado.cifrado, selado, "22222222-2222-4222-8222-222222222222")) === null);
await confere("cifrado alterado não abre", async () => { const mexido = new Uint8Array(selado.cifrado); mexido[100] ^= 1; return (await decifrarArquivo(mexido, selado, conversa)) === null; });
await confere("resumo que não bate recusa (arquivo trocado por alguém com a chave)", async () => (await decifrarArquivo(selado.cifrado, { ...selado, hash: selado.hash.replace(/.$/, (c) => (c === "A" ? "B" : "A")) }, conversa)) === null);
await confere("acima do limite não cifra", async () => { try { await cifrarArquivo(new Uint8Array(new ArrayBuffer(LIMITE_BYTES + 1)), conversa); return false; } catch (erro) { return erro.message === "tamanho"; } });

// ── Forma de onda ──
await confere("picos: um número por fatia, de 0 a 100, com o maior em 100", () => { const picos = picosDe(Float32Array.from({ length: 1000 }, (_, i) => Math.sin(i / 10) * (i / 1000)), 20); return picos.length === 20 && Math.max(...picos) === 100 && picos.every((p) => p >= 0 && p <= 100) && picos[0] < picos[19]; });
await confere("silêncio vira zeros", () => picosDe(new Float32Array(100), 8).every((p) => p === 0));

// ── Dentro da mensagem ──
const anexo = { id: conversa, tipo: "imagem", mime: "image/webp", nome: "cartaz.webp", tamanho: 5000, chave: selado.chave, iv: selado.iv, hash: selado.hash, largura: 800, altura: 600 };
await confere("o anexo vai dentro do pacote e volta igual", () => { const lido = desempacotar(empacotar({ texto: "Legenda", anexos: [anexo] })); return lido.texto === "Legenda" && JSON.stringify(lido.anexos) === JSON.stringify([anexo]); });
await confere("anexo estranho é descartado: sem id, tipo fora da lista, MIME errado para o tipo, chave curta, tamanho acima do limite", () => [
  { ...anexo, id: "x" }, { ...anexo, tipo: "exe" }, { ...anexo, mime: "text/html" }, { ...anexo, chave: "curta" }, { ...anexo, tamanho: LIMITE_BYTES + 1 }, { ...anexo, hash: "<script>" },
].every((ruim) => anexoValido(ruim) === null));
await confere("campos opcionais são cortados e limitados", () => { const lido = anexoValido({ ...anexo, nome: "n".repeat(500), picos: [150, -5, 50.6], duracao: 12.345, uma_vez: "sim" }); return lido.nome.length === 120 && lido.picos.join(",") === "100,0,51" && lido.duracao === 12.35 && lido.uma_vez === undefined; });
await confere("no máximo seis anexos por mensagem", () => desempacotar(empacotar({ texto: "", anexos: Array.from({ length: 9 }, () => anexo) })).anexos.length === 6);
await confere("ver uma vez vai marcado", () => desempacotar(empacotar({ texto: "", anexos: [{ ...anexo, uma_vez: true }] })).anexos[0].uma_vez === true);

console.log(`${certos} conferências certas${falhas.length ? `, ${falhas.length} com problema.` : "."}`);
for (const falha of falhas) console.log(`  ✗ ${falha}`);
process.exit(falhas.length ? 1 : 0);
