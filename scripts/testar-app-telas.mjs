// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere o pacote "app-telas" (docs/APP.md): laboratório e aula em telas próprias, sem dois overlays ao mesmo tempo,
// trava de rolagem com contagem (a causa do "abrir um laboratório e a aula ao mesmo tempo quebra tudo"), voltar que
// fecha a tela aberta antes de sair da página. Lógica pura com um <html> de mentira, sem rede e sem navegador.
// Uso: npm run testar:app-telas
import assert from "node:assert/strict";
import fs from "node:fs";
import { fecharTelaDaVez, fecharTelas, haTelaAberta, pedirTela, travarRolagem } from "../components/app/telas.ts";

let n = 0;
const ok = (nome, f) => {
  try {
    f();
  } catch (erro) {
    console.error("FALHOU:", nome);
    throw erro;
  }
  n++;
};
const ler = (c) => fs.readFileSync(new URL(`../${c}`, import.meta.url), "utf8");

const estilo = new Map();
globalThis.window = new EventTarget();
globalThis.CustomEvent = globalThis.CustomEvent ?? class extends Event { constructor(t, o) { super(t); this.detail = o?.detail; } };
globalThis.document = { documentElement: { style: { getPropertyValue: (k) => estilo.get(k) ?? "", setProperty: (k, v) => estilo.set(k, v), removeProperty: (k) => estilo.delete(k) } } };
const rolagem = () => estilo.get("overflow");

ok("a trava de rolagem só solta quando a última tela solta", () => {
  const aula = travarRolagem();
  const gaveta = travarRolagem();
  assert.equal(rolagem(), "hidden");
  aula();
  assert.equal(rolagem(), "hidden", "fechar uma tela não pode soltar a rolagem da outra");
  gaveta();
  assert.equal(rolagem(), undefined, "a última solta e a página volta a rolar");
});
ok("soltar duas vezes a mesma trava não solta a trava de outra tela", () => {
  const a = travarRolagem();
  const b = travarRolagem();
  a();
  a();
  assert.equal(rolagem(), "hidden");
  b();
  assert.equal(rolagem(), undefined);
});
ok("a trava devolve o valor de overflow que a página já tinha", () => {
  estilo.set("overflow", "scroll");
  const t = travarRolagem();
  assert.equal(rolagem(), "hidden");
  t();
  assert.equal(rolagem(), "scroll");
  estilo.delete("overflow");
});
ok("laboratório aberto depois da aula fecha a aula, e a rolagem fica certa", () => {
  const fechadas = [];
  let soltaAula;
  let devolveAula;
  soltaAula = travarRolagem();
  devolveAula = pedirTela("folha-da-aula", () => {
    fechadas.push("aula");
    soltaAula();
    devolveAula();
  });
  const soltaLab = travarRolagem();
  const devolveLab = pedirTela("gaveta-mais", () => fechadas.push("gaveta"));
  assert.deepEqual(fechadas, ["aula"]);
  assert.equal(rolagem(), "hidden", "o laboratório continua com a página travada");
  devolveLab();
  soltaLab();
  assert.equal(rolagem(), undefined);
  assert.equal(haTelaAberta(), false);
});
ok("quem reabre com o mesmo id não fecha a si mesmo", () => {
  const fechadas = [];
  const d1 = pedirTela("cartao-do-trecho", () => fechadas.push("antiga"));
  const d2 = pedirTela("cartao-do-trecho", () => fechadas.push("nova"));
  assert.deepEqual(fechadas, []);
  d1();
  d2();
});
ok("o voltar fecha a tela aberta mais nova e só depois deixa navegar", () => {
  const fechadas = [];
  assert.equal(fecharTelaDaVez(), false, "sem tela aberta o voltar navega");
  const d = pedirTela("folha-da-aula", () => {
    fechadas.push("folha");
    d();
  });
  assert.equal(haTelaAberta(), true);
  assert.equal(fecharTelaDaVez(), true);
  assert.deepEqual(fechadas, ["folha"]);
  assert.equal(fecharTelaDaVez(), false);
});
ok("mudar de endereço fecha todas as telas abertas", () => {
  const fechadas = [];
  const ds = ["a", "b"].map((id) => pedirTela(id, () => fechadas.push(id)));
  fechadas.length = 0;
  fecharTelas();
  assert.deepEqual(fechadas.sort(), ["a", "b"]);
  ds.forEach((d) => d());
});

// ───── Cercas no código: ninguém mais trava o <html> por conta própria ─────
ok("nenhuma tela de ferramenta escreve overflow no <html> por conta própria", () => {
  for (const f of ["components/celular/AcoesDaAula.tsx", "components/MaisGaveta.tsx", "components/Editor.tsx"]) {
    const t = ler(f);
    assert.ok(!/setProperty\("overflow"/.test(t), `${f} ainda trava o <html> sozinho`);
    assert.ok(/app\/telas"/.test(t), `${f} deveria usar components/app/telas.ts`);
  }
});
ok("as telas de ferramenta da aula e da barra pedem a vaga da vez", () => {
  assert.match(ler("components/celular/AcoesDaAula.tsx"), /useTelaDaVez\("folha-da-aula"/);
  assert.match(ler("components/MaisGaveta.tsx"), /useTelaDaVez\("gaveta-mais"/);
  const b = ler("components/aula/BarraDeSelecao.tsx");
  assert.match(b, /useTelaDaVez\("cartao-do-trecho"/);
  assert.match(b, /useTelaDaVez\("consulta-de-palavra"/);
});
ok("a barra de cima e o gesto fecham a tela aberta antes de voltar; a casca fecha tudo ao mudar de página", () => {
  assert.match(ler("components/celular/BarraDoCelular.tsx"), /if \(fecharTelaDaVez\(\)\) return;/);
  const c = ler("components/app/CascaDoApp.tsx");
  assert.match(c, /if \(fecharTelaDaVez\(\)\) return;/);
  assert.match(c, /fecharTelas\(\);\s*\n\s*\}, \[pathname\]\)/);
});
ok("telas.ts não lê disco nem usa rede (rastreio e privacidade)", () => {
  const t = ler("components/app/telas.ts");
  assert.ok(!/from "(node:)?(fs|path)"|readFileSync|fetch\(|sendBeacon|import\(/.test(t));
});
ok("o teste de ponta a ponta do celular existe e cobre laboratório + aula", () => {
  const e = ler("e2e/app-telas.spec.ts");
  assert.match(e, /--project=celular/);
  assert.match(e, /laboratorios/);
  assert.match(e, /overflow/);
});

console.log(`app-telas: ${n} conferências passaram`);
