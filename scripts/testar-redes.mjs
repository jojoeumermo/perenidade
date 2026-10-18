// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// O motor do Laboratório de Redes: ARP, tabela MAC, encaminhamento, TTL, VLAN e rota padrão, sem navegador.
// Rode com: npm run testar:redes
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const { ping, traceroute, estadoNovo, verificar, validarTopologia, comandoDeIos } = await import(pathToFileURL(new URL("../lib/redes/motor.ts", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")).href);
const exercicios = JSON.parse(readFileSync(new URL("../content/laboratorios/redes.json", import.meta.url), "utf8"));
let certos = 0;
const falhas = [];
const confere = (nome, ok, detalhe = "") => { if (ok) certos++; else falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`); };
const clonar = (t) => JSON.parse(JSON.stringify(t));
const porNome = (t, n) => t.dispositivos.find((d) => d.nome === n);
const ipDe = (t, n) => porNome(t, n).portas.find((p) => p.ip).ip;

// Cada exercício: a topologia inicial NÃO passa (pelo menos uma verificação falha) e a solução passa.
for (const ex of exercicios) {
  const inicial = verificar(validarTopologia(clonar(ex.topologia)), ex);
  confere(`${ex.id} começa sem passar`, inicial.some((r) => !r.passou));
}
// Soluções aplicadas à mão.
{
  const t = validarTopologia(clonar(exercicios[0].topologia)); porNome(t, "PC2").portas[0].ip = "192.168.1.11"; porNome(t, "PC2").portas[0].mascara = "255.255.255.0";
  confere("rd-01 resolvido", verificar(t, exercicios[0]).every((r) => r.passou));
  const r = ping(t, estadoNovo(), porNome(t, "PC1").id, "192.168.1.11");
  confere("ping direto gera ARP e resposta", r.sucesso && r.eventos.some((e) => e.pacote?.protocolo === "ARP"));
}
{
  const t = validarTopologia(clonar(exercicios[2].topologia)); porNome(t, "PC2").portas[0].mascara = "255.255.255.0";
  confere("rd-03 (máscara) resolvido", verificar(t, exercicios[2]).every((r) => r.passou));
  const errado = validarTopologia(clonar(exercicios[2].topologia));
  const r = ping(errado, estadoNovo(), porNome(errado, "PC2").id, ipDe(errado, "PC1"));
  confere("máscara errada explica o erro", !r.sucesso && /gateway|rede/.test(r.resumo), r.resumo);
}
{
  const t = validarTopologia(clonar(exercicios[3].topologia));
  const r1 = porNome(t, "R1");
  for (const [cmd] of [["enable"], ["configure terminal"], ["interface Gi0/0"], ["ip address 192.168.1.1 255.255.255.0"], ["no shutdown"], ["exit"], ["interface Gi0/1"], ["ip address 10.0.0.1 255.255.255.0"], ["no shutdown"]]) {
    // Sessão encadeada pelo terminal.
    globalThis.__s ??= { modo: "usuario" };
    globalThis.__s = comandoDeIos(t, estadoNovo(), r1, globalThis.__s, cmd).sessao;
  }
  porNome(t, "PC1").gateway = "192.168.1.1"; porNome(t, "PC2").gateway = "10.0.0.1";
  confere("rd-04 pelo terminal do roteador", verificar(t, exercicios[3]).every((r) => r.passou), JSON.stringify(verificar(t, exercicios[3]).filter((r) => !r.passou).map((r) => r.detalhe)));
  const tr = traceroute(t, estadoNovo(), porNome(t, "PC1").id, "10.0.0.10");
  confere("traceroute mostra o roteador como salto 1", tr.saltos.length === 2 && tr.saltos[0].includes("192.168.1.1"), tr.saltos.join(" | "));
  const semGw = validarTopologia(clonar(exercicios[3].topologia));
  const r = ping(semGw, estadoNovo(), porNome(semGw, "PC1").id, "10.0.0.10");
  confere("sem gateway, erro claro", !r.sucesso && /gateway/.test(r.resumo), r.resumo);
}
{
  const t = validarTopologia(clonar(exercicios[4].topologia));
  porNome(t, "R1").rotas.push({ rede: "10.0.0.0", mascara: "255.255.255.0", via: "172.16.0.2" });
  confere("só a ida: a volta falha sem rota em R2", !ping(t, estadoNovo(), porNome(t, "PC1").id, "10.0.0.10").sucesso);
  porNome(t, "R2").rotas.push({ rede: "192.168.1.0", mascara: "255.255.255.0", via: "172.16.0.1" });
  confere("rd-05 resolvido", verificar(t, exercicios[4]).every((r) => r.passou));
  // Laço: R1 manda para R2 e R2 manda de volta para R1 → TTL expira.
  const laco = validarTopologia(clonar(exercicios[4].topologia));
  porNome(laco, "R1").rotas.push({ rede: "10.9.9.0", mascara: "255.255.255.0", via: "172.16.0.2" });
  porNome(laco, "R2").rotas.push({ rede: "10.9.9.0", mascara: "255.255.255.0", via: "172.16.0.1" });
  const r = ping(laco, estadoNovo(), porNome(laco, "PC1").id, "10.9.9.9");
  confere("laço de roteamento termina em TTL expirado", !r.sucesso && /TTL/.test(r.resumo), r.resumo);
}
{
  const t = validarTopologia(clonar(exercicios[5].topologia));
  porNome(t, "R1").rotas.push({ rede: "0.0.0.0", mascara: "0.0.0.0", via: "203.0.113.1" });
  confere("rd-06 rota padrão", verificar(t, exercicios[5]).every((r) => r.passou));
}
{
  const t = validarTopologia(clonar(exercicios[6].topologia));
  porNome(t, "PC2").portas[0].ip = "192.168.1.20"; porNome(t, "PC2").portas[0].mascara = "255.255.255.0";
  const sw = porNome(t, "SW1");
  sw.vlans.push({ id: 10, nome: "ALUNOS" }, { id: 20, nome: "PROFESSORES" });
  sw.portas.find((p) => p.nome === "Fa0/1").vlan = 10; sw.portas.find((p) => p.nome === "Fa0/2").vlan = 10; sw.portas.find((p) => p.nome === "Fa0/3").vlan = 20;
  const res = verificar(t, exercicios[6]);
  confere("rd-07 VLANs isolam", res.every((r) => r.passou), JSON.stringify(res.filter((r) => !r.passou).map((r) => r.verificacao.texto)));
  const estado = estadoNovo();
  ping(t, estado, porNome(t, "PC1").id, "192.168.1.20");
  confere("switch aprendeu os MACs na VLAN 10", Object.values(estado.mac[sw.id] ?? {}).every((v) => v.vlan === 10) && Object.keys(estado.mac[sw.id] ?? {}).length === 2);
}
{
  const t = validarTopologia(clonar(exercicios[7].topologia));
  confere("sem tronco, a VLAN 10 não atravessa", !ping(t, estadoNovo(), porNome(t, "PC1").id, "192.168.1.20").sucesso);
  for (const n of ["SW1", "SW2"]) porNome(t, n).portas.find((p) => p.nome === "Fa0/8").modo = "trunk";
  confere("rd-08 tronco", verificar(t, exercicios[7]).every((r) => r.passou));
}
{
  // Topologia vinda de arquivo: campos estranhos somem, caminhos e tamanhos são limitados.
  let recusou = false;
  try { validarTopologia({ dispositivos: "x" }); } catch { recusou = true; }
  confere("arquivo inválido é recusado", recusou);
  const t = validarTopologia({ dispositivos: [{ tipo: "pc", nome: "A", portas: [{ nome: "eth0", ip: "1.1.1.1", mascara: "255.0.0.0" }], exec: "alert(1)" }], cabos: [] });
  confere("campos desconhecidos são descartados", !("exec" in t.dispositivos[0]) && t.dispositivos[0].portas[0].ip === "1.1.1.1");
}
console.log(`redes: ${certos} conferências certas, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
