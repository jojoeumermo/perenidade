// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Só para a imagem do servidor (Dockerfile, estágio de montagem): troca os arquivos de conteúdo idêntico das páginas prontas
// (.next/standalone/.next/server/app) por ligações para um só arquivo (hardlink). O Next grava cada página três vezes do
// mesmo jeito: a página.rsc, a cópia inteira dela em página.segments/_full.segment.rsc e, muitas vezes, o mesmo pedaço em
// idiomas diferentes. Na imagem, cada conteúdo repetido passa a existir uma vez só: a camada fica menor para baixar e para
// desempacotar no servidor, e o site lê exatamente os mesmos bytes nos mesmos caminhos.
//
// Gravar por cima continua seguro: o contêiner roda sobre overlayfs, e escrever num arquivo da imagem copia só aquele
// caminho para a camada do contêiner (a ligação se desfaz ali); o outro caminho segue com o conteúdo de antes.
// Uso: node scripts/imagem-juntar-iguais.mjs <pasta>
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const pasta = process.argv[2];
if (!pasta || !fs.statSync(pasta, { throwIfNoEntry: false })?.isDirectory()) {
  console.error("Uso: node scripts/imagem-juntar-iguais.mjs <pasta>");
  process.exit(1);
}

// Primeiro agrupa por tamanho (barato); só os tamanhos repetidos têm o conteúdo conferido.
const porTamanho = new Map();
const andar = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) andar(p);
    else if (e.isFile()) {
      const { size } = fs.statSync(p);
      if (size === 0) continue;
      const lista = porTamanho.get(size);
      if (lista) lista.push(p);
      else porTamanho.set(size, [p]);
    }
  }
};
andar(pasta);

const resumo = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
let ligados = 0;
let poupados = 0;
for (const [tamanho, arquivos] of porTamanho) {
  if (arquivos.length < 2) continue;
  const primeiro = new Map();
  for (const p of arquivos) {
    const h = resumo(p);
    const original = primeiro.get(h);
    if (!original) {
      primeiro.set(h, p);
      continue;
    }
    // Confere byte a byte antes de ligar (o resumo já basta, mas a conferência é barata perto do risco).
    if (!fs.readFileSync(original).equals(fs.readFileSync(p))) continue;
    const temporario = `${p}.ligando`;
    fs.linkSync(original, temporario);
    fs.renameSync(temporario, p);
    ligados += 1;
    poupados += tamanho;
  }
}
console.log(`Arquivos iguais ligados: ${ligados.toLocaleString("pt-BR")} (${(poupados / 1024 ** 3).toFixed(2)} GB a menos na imagem).`);
