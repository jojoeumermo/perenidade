// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a cifra das conversas da equipe (lib/sigilo.ts), sem rede e sem banco: quem abre, quem não abre e o que acontece
// quando alguém mexe no texto cifrado. Uso: npm run testar:sigilo
import {
  abrirCopia, abrirPedido, abrirTexto, aparelhoCertificado, assinarTexto, certificarAparelho, chaveDeRecuperacaoValida, cifrar, codigoDeSeguranca, codigoEmGrupos,
  contextoDaConversa, contextoDaIdentidade, contextoDoEmbrulho, contextoDoMural, decifrar, desembrulhar, desembrulharBytes, embrulhar, embrulharBytes, exportarChave,
  exportarIdentidade, FORMATO_CODIGO, FORMATO_PUBLICA, importarChave, importarIdentidade, lerPublica, lerQrDaSeguranca, lerQrDoPedido, novaChave, novaChaveDeRecuperacao,
  novaIdentidade, novoAparelho, novoCodigo, origensDeEmbrulho, qrDaSeguranca, qrDoPedido, selarCopia, selarPedido, versaoDe,
} from "../lib/sigilo.ts";

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

// O embrulho novo, "h1": HPKE (RFC 9180, biblioteca @hpke) no modo autenticado, com os mesmos pares do aparelho.
const h1 = await embrulhar(chave, ana.privada, bia.publica, contexto, ana.publica);
await confere("o embrulho h1 (HPKE) tem o formato que o banco aceita", () => /^h1\.[A-Za-z0-9_-]{87}\.[A-Za-z0-9_-]{64}$/.test(h1));
await confere("h1: o aparelho de destino abre e chega à mesma chave", async () => {
  const aberta = await desembrulhar(h1, bia.privada, ana.publica, contexto, bia.publica);
  return aberta !== null && (await decifrar(aberta, await cifrar(chave, 1, "teste h1", "x"), "x")) === "teste h1";
});
await confere("h1: outro aparelho não abre", async () => (await desembrulhar(h1, intrusa.privada, ana.publica, contexto, intrusa.publica)) === null);
await confere("h1: com quem embrulhou trocado não abre (modo autenticado)", async () => (await desembrulhar(h1, bia.privada, intrusa.publica, contexto, bia.publica)) === null);
await confere("h1: levado para outra versão não abre", async () => (await desembrulhar(h1, bia.privada, ana.publica, contextoDoEmbrulho(conversa, 2, aparelhoDaBia), bia.publica)) === null);
await confere("h1: adulterado não abre", async () => (await desembrulhar(troca(h1, 100), bia.privada, ana.publica, contexto, bia.publica)) === null);
await confere("h1: sem a parte pública de quem recebe, não abre (não quebra)", async () => (await desembrulhar(h1, bia.privada, ana.publica, contexto)) === null);

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

// ── Identidade e certificado de aparelho ──
const idAna = await novaIdentidade();
const idBia = await novaIdentidade();
const idIntrusa = await novaIdentidade();
const contaDaAna = crypto.randomUUID();
await confere("a identidade tem o formato de chave pública que o banco aceita", () => FORMATO_PUBLICA.test(idAna.publica) && idAna.publica !== idBia.publica);
const certificado = await certificarAparelho(idAna, contaDaAna, ana.publica);
await confere("o certificado tem o formato que o banco aceita", () => /^[A-Za-z0-9_-]{86}$/.test(certificado));
await confere("aparelho certificado pela identidade da pessoa é aceito", () => aparelhoCertificado(idAna.publica, contaDaAna, ana.publica, certificado));
await confere("aparelho sem certificado não é aceito (não recebe chaves)", async () => (await aparelhoCertificado(idAna.publica, contaDaAna, ana.publica, null)) === false);
await confere("certificado feito por outra identidade é recusado", async () => (await aparelhoCertificado(idAna.publica, contaDaAna, intrusa.publica, await certificarAparelho(idIntrusa, contaDaAna, intrusa.publica))) === false);
await confere("certificado de um aparelho não serve para outro aparelho", async () => (await aparelhoCertificado(idAna.publica, contaDaAna, intrusa.publica, certificado)) === false);
await confere("certificado não serve para outra conta", async () => (await aparelhoCertificado(idAna.publica, crypto.randomUUID(), ana.publica, certificado)) === false);
await confere("certificado adulterado é recusado", async () => (await aparelhoCertificado(idAna.publica, contaDaAna, ana.publica, troca(certificado, 10))) === false);
await confere("lixo no lugar do certificado não quebra nada", async () => (await aparelhoCertificado(idAna.publica, contaDaAna, ana.publica, "nada")) === false);

// ── A identidade é repassada, embrulhada, a um aparelho aprovado ──
const secreta = await exportarIdentidade(idAna);
await confere("a identidade exportada tem 32 bytes", () => secreta.length === 32);
const embrulhoDaIdentidade = await embrulharBytes(secreta, ana.privada, bia.publica, contextoDaIdentidade(contaDaAna, aparelhoDaBia));
const recebida = await desembrulharBytes(embrulhoDaIdentidade, bia.privada, ana.publica, contextoDaIdentidade(contaDaAna, aparelhoDaBia));
await confere("o aparelho aprovado desembrulha e reconstrói a identidade, que assina igual", async () => {
  const copia = await importarIdentidade(recebida, idAna.publica);
  const assinaturaDaCopia = await certificarAparelho(copia, contaDaAna, bia.publica);
  return aparelhoCertificado(idAna.publica, contaDaAna, bia.publica, assinaturaDaCopia);
});
await confere("outro aparelho não desembrulha a identidade", async () => (await desembrulharBytes(embrulhoDaIdentidade, intrusa.privada, ana.publica, contextoDaIdentidade(contaDaAna, aparelhoDaBia))) === null);
await confere("os 32 bytes secretos com a parte pública errada são recusados", async () => {
  try {
    await importarIdentidade(recebida, idBia.publica);
    return false;
  } catch {
    return true;
  }
});

// ── Assinatura do autor em cada mensagem ──
const assinado = await assinarTexto(idAna, "Reunião confirmada.", lugar, 3);
await confere("o texto assinado leva a assinatura na frente", () => /^s1\.[A-Za-z0-9_-]{86}\.Reunião confirmada\.$/.test(assinado));
await confere("quem conhece a identidade do autor confere a assinatura", async () => {
  const r = await abrirTexto(assinado, idAna.publica, lugar, 3);
  return r.texto === "Reunião confirmada." && r.autoria === "ok";
});
await confere("assinatura de outra pessoa não passa como do autor", async () => (await abrirTexto(assinado, idBia.publica, lugar, 3)).autoria === "invalida");
await confere("texto trocado depois de assinado é pego", async () => (await abrirTexto(assinado.replace("confirmada", "cancelada"), idAna.publica, lugar, 3)).autoria === "invalida");
await confere("assinatura não vale em outra conversa, outro autor ou outra versão", async () => {
  const outra = await abrirTexto(assinado, idAna.publica, contextoDaConversa(outraConversa, autora), 3);
  const outroAutor = await abrirTexto(assinado, idAna.publica, contextoDaConversa(conversa, crypto.randomUUID()), 3);
  const outraVersao = await abrirTexto(assinado, idAna.publica, lugar, 4);
  return outra.autoria === "invalida" && outroAutor.autoria === "invalida" && outraVersao.autoria === "invalida";
});
await confere("mensagem antiga, sem assinatura, abre e é marcada como sem assinatura", async () => {
  const r = await abrirTexto("Mensagem de antes das assinaturas.", idAna.publica, lugar, 1);
  return r.texto === "Mensagem de antes das assinaturas." && r.autoria === "sem_assinatura";
});
await confere("sem a identidade do autor, o texto abre mas a autoria fica em aberto", async () => (await abrirTexto(assinado, null, lugar, 3)).autoria === "sem_identidade");
await confere("o texto assinado e cifrado abre por inteiro, com acento e quebra de linha", async () => {
  const texto = "Linha 1\nLinha 2, com ç e 🌱";
  const corpo = await cifrar(chave, 3, await assinarTexto(idAna, texto, lugar, 3), lugar);
  const r = await abrirTexto(await decifrar(daBia, corpo, lugar), idAna.publica, lugar, 3);
  return r.texto === texto && r.autoria === "ok";
});

// ── Aprovação de aparelho novo pelo código ──
const codigo = novoCodigo();
await confere("o código tem oito números", () => FORMATO_CODIGO.test(codigo) && novoCodigo() !== codigo);
const pedido = await selarPedido(codigo, contaDaAna, bia.publica);
await confere("o pedido selado não mostra a chave pública", () => !JSON.stringify(pedido).includes(bia.publica.slice(0, 20)));
await confere("quem digita o código certo recebe a chave pública do aparelho novo", async () => (await abrirPedido(codigo, contaDaAna, pedido)) === bia.publica);
await confere("código errado não abre o pedido", async () => (await abrirPedido(codigo === "00000000" ? "00000001" : "00000000", contaDaAna, pedido)) === null);
await confere("código malformado não abre o pedido", async () => (await abrirPedido("abc", contaDaAna, pedido)) === null);
await confere("pedido de outra conta não abre", async () => (await abrirPedido(codigo, crypto.randomUUID(), pedido)) === null);
await confere("pedido adulterado não abre", async () => (await abrirPedido(codigo, contaDaAna, { ...pedido, cifrado: troca(pedido.cifrado, 5) })) === null);
await confere("o QR leva o código e a chave pública, e é lido de volta", () => {
  const lido = lerQrDoPedido(qrDoPedido(codigo, bia.publica));
  return lido?.codigo === codigo && lido.publica === bia.publica && lerQrDoPedido("qualquer coisa") === null;
});

// ── Código de segurança por par de pessoas ──
const seguranca = await codigoDeSeguranca(idAna.publica, idBia.publica);
await confere("o código de segurança tem sessenta números", () => /^[0-9]{60}$/.test(seguranca));
await confere("dá o mesmo nos dois lados, em qualquer ordem", async () => (await codigoDeSeguranca(idBia.publica, idAna.publica)) === seguranca);
await confere("muda se a identidade de uma das pessoas mudar", async () => (await codigoDeSeguranca(idAna.publica, idIntrusa.publica)) !== seguranca);
await confere("sai em doze grupos de cinco, e o QR é lido de volta", () => codigoEmGrupos(seguranca).split(" ").length === 12 && lerQrDaSeguranca(qrDaSeguranca(seguranca)) === seguranca);

// ── Cópia de recuperação ──
const frase = novaChaveDeRecuperacao();
await confere("a chave de recuperação tem oito grupos de quatro, sem letras que confundem", () => /^([ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-){7}[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/.test(frase) && chaveDeRecuperacaoValida(frase) && chaveDeRecuperacaoValida(frase.toLowerCase().replace(/-/g, " ")) && !chaveDeRecuperacaoValida("ABCD"));
const copia = { identidade: { secreta: (await import("../lib/sigilo.ts")).paraBase64(secreta), publica: idAna.publica }, chaves: [{ conversa, versao: 1, chave: await exportarChave(chave) }], quando: new Date().toISOString() };
const selada = await selarCopia(frase, contaDaAna, copia);
await confere("a cópia selada não mostra nada da identidade nem das chaves", () => !JSON.stringify(selada).includes(copia.identidade.secreta.slice(0, 12)) && !JSON.stringify(selada).includes(copia.chaves[0].chave.slice(0, 12)));
await confere("com a chave de recuperação, a cópia abre e a identidade e as chaves voltam", async () => {
  const aberta = await abrirCopia(frase.toLowerCase(), contaDaAna, selada);
  if (!aberta || aberta.identidade.publica !== idAna.publica) return false;
  const identidade = await importarIdentidade((await import("../lib/sigilo.ts")).deBase64(aberta.identidade.secreta), aberta.identidade.publica);
  const deVolta = await importarChave(aberta.chaves[0].chave);
  return (await aparelhoCertificado(idAna.publica, contaDaAna, bia.publica, await certificarAparelho(identidade, contaDaAna, bia.publica))) && (await decifrar(deVolta, mensagem, lugar)) === "Reunião às 19h, sala de sempre. Até lá! 🌱";
});
await confere("chave de recuperação errada não abre a cópia", async () => (await abrirCopia(novaChaveDeRecuperacao(), contaDaAna, selada)) === null);
await confere("cópia de outra conta não abre", async () => (await abrirCopia(frase, crypto.randomUUID(), selada)) === null);

// ── Injeção de chave no chat da equipe (lib/chaveiro.ts, carregar): só abre embrulho de aparelho certificado ──
{
  const meu = await novoAparelho();
  const daBia = await novoAparelho();
  const daIntrusa = await novoAparelho();
  const semCertificado = await novoAparelho();
  const conhecidas = { ana: idAna.publica, bia: idBia.publica };
  const aparelhos = [
    { usuario: "bia", publica: daBia.publica, certificado: await certificarAparelho(idBia, "bia", daBia.publica) },
    // Quem escreve no banco põe um aparelho seu na conversa, em nome da Bia, certificado por uma identidade que não é a dela.
    { usuario: "bia", publica: daIntrusa.publica, certificado: await certificarAparelho(idIntrusa, "bia", daIntrusa.publica) },
    { usuario: "bia", publica: semCertificado.publica, certificado: null },
    // Ou de alguém que este aparelho nunca viu (sem identidade conhecida): também não.
    { usuario: "fantasma", publica: (await novoAparelho()).publica, certificado: await certificarAparelho(idIntrusa, "fantasma", "x") },
  ];
  const origens = await origensDeEmbrulho(meu.publica, aparelhos, (u) => conhecidas[u] ?? null);
  await confere("injeção de chave: o embrulho só pode vir deste aparelho ou de um aparelho certificado pela identidade conhecida da pessoa", async () =>
    origens.has(meu.publica) && origens.has(daBia.publica) && !origens.has(daIntrusa.publica) && !origens.has(semCertificado.publica) && origens.size === 2);
  // A chave da conversa embrulhada pela intrusa abre com a chave do aparelho (a cifra deixa), mas o chaveiro nem tenta: a origem não está na lista.
  await confere("o embrulho da intrusa abriria (a cifra não sabe de quem é): por isso a conferência da origem é que segura", async () => {
    const chave = await novaChave();
    const embrulho = await embrulhar(chave, daIntrusa.privada, meu.publica, contextoDoEmbrulho("conv", 9, "meu-aparelho"));
    const aberta = await desembrulhar(embrulho, meu.privada, daIntrusa.publica, contextoDoEmbrulho("conv", 9, "meu-aparelho"));
    return aberta !== null && !origens.has(daIntrusa.publica);
  });
}

console.log(`${certos} conferências certas${falhas.length ? `, ${falhas.length} com problema.` : "."}`);
for (const falha of falhas) console.log(`  ✗ ${falha}`);
process.exit(falhas.length ? 1 : 0);
