// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O cofre da Escola (lib/escola/cofre.ts): cria com a frase, leva o privado para dentro e apaga a cópia em claro, fecha,
// recusa a frase errada, abre com a certa e grava cifrado. Roda no Node: `npm run testar:escola-cofre`.

class Armazem {
  m = new Map();
  get length() {
    return this.m.size;
  }
  key(i) {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k) {
    return this.m.has(k) ? this.m.get(k) : null;
  }
  setItem(k, v) {
    this.m.set(k, String(v));
  }
  removeItem(k) {
    this.m.delete(k);
  }
}
globalThis.localStorage = new Armazem();

const cofre = await import("../lib/escola/cofre.ts");
let certos = 0;
const falhas = [];
const confere = (nome, ok) => (ok ? certos++ : falhas.push(nome));
const espera = () => new Promise((r) => setTimeout(r, 50));

localStorage.setItem("lucia:escola-privado:conversas", '[{"id":"a","texto":"onde eu trabalho"}]');
localStorage.setItem("lucia:escola:caderneta", "{}");
confere("sem cofre: o armazenamento é o localStorage", cofre.estadoDoCofre() === "sem-cofre" && cofre.armazemPrivado() === localStorage);
confere("frase curta é recusada", (await cofre.criarCofre("1234567")) === false && cofre.estadoDoCofre() === "sem-cofre");
confere("cria o cofre com a frase", (await cofre.criarCofre("uma frase longa")) === true && cofre.estadoDoCofre() === "aberto");
confere("o privado em claro sumiu", localStorage.getItem("lucia:escola-privado:conversas") === null);
confere("o estudo comum ficou", localStorage.getItem("lucia:escola:caderneta") === "{}");
confere("o bloco guardado não mostra o texto", !String(localStorage.getItem("lucia:escola-cofre:dados")).includes("trabalho"));
const aberto = cofre.armazemPrivado();
confere("aberto: lê o que foi levado", aberto?.getItem("lucia:escola-privado:conversas")?.includes("onde eu trabalho"));
aberto?.setItem("lucia:escola-privado:diario", '{"x":1}');
aberto?.setItem("lucia:qualquer", "fora");
confere("aberto: não grava chave de fora do privado", aberto?.getItem("lucia:qualquer") === null && localStorage.getItem("lucia:qualquer") === null);
await espera();
cofre.fecharCofre();
confere("fechado: nada para ler", cofre.estadoDoCofre() === "fechado" && cofre.armazemPrivado() === null);
confere("frase errada não abre", (await cofre.abrirCofre("outra frase qualquer")) === false && cofre.estadoDoCofre() === "fechado");
confere("frase certa abre", (await cofre.abrirCofre("uma frase longa")) === true);
confere("o que foi gravado aberto voltou", cofre.armazemPrivado()?.getItem("lucia:escola-privado:diario") === '{"x":1}');
cofre.apagarCofre();
confere("apagar o cofre leva tudo", cofre.estadoDoCofre() === "sem-cofre" && localStorage.getItem("lucia:escola-cofre:dados") === null && localStorage.getItem("lucia:escola-cofre:meta") === null);

console.log(`escola-cofre: ${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
