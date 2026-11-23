// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Onda R3, item 1.1 nos grupos (MLS, suíte híbrida 0xF002): a regra da FOLHA VELHA. Cada aparelho troca a chave da própria folha
// quando ela tem mais de 7 dias ou quando ele mandou 200 mensagens desde a última troca, para a cura pós-quântica do grupo não depender
// de alguém escrever. Com o motor de verdade (@wireapp/core-crypto) e o servidor de mentira das regras do banco (um commit por época).
//   - quem só lê também troca a folha depois de 7 dias (na sincronização);
//   - a 200ª mensagem dispara a troca; a 199ª não;
//   - a troca dá segredos novos: quem roubou o estado do aparelho ANTES da troca não deriva a época nova;
//   - dois aparelhos vencidos ao mesmo tempo: um commit por época, nada se parte; a troca que perdeu a corrida fica para a próxima;
//   - esquecer o grupo esquece a contagem.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-r3-pq-grupos.mjs
import { motorNoNode } from "./cifra-no-node.mjs";
import { prepararAparelho } from "../lib/rede/grupos/aparelho.ts";
import { criarMotorDeGrupo, FOLHA_DIAS, FOLHA_MENSAGENS } from "../lib/rede/grupos/motor-de-grupo.ts";
import { segredosDaEpoca } from "../lib/rede/grupos/epoca.ts";

let certos = 0;
const falhas = [];
const confere = (nome, ok, detalhe = "") => (ok ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
const hex = (b) => Buffer.from(b).toString("hex");
const DIA = 86_400_000;

const M = await motorNoNode();
let relogio = Date.now();

function criarServidor() {
  const grupos = new Map();
  const folhasDe = new Map();
  const pacotesDe = new Map();
  const g = (grupo) => {
    if (!grupos.has(grupo)) grupos.set(grupo, { membros: new Set(), commits: new Map(), boas: new Map() });
    return grupos.get(grupo);
  };
  return {
    g,
    publicar(conta, nome, pacotes) {
      folhasDe.set(conta, new Set([...(folhasDe.get(conta) ?? []), nome]));
      pacotesDe.set(nome, [...(pacotesDe.get(nome) ?? []), ...pacotes]);
    },
    transporte(conta, nome) {
      return {
        async estado(grupo, desde) {
          const x = g(grupo);
          const epocas = [...x.commits.keys()];
          return {
            epoca: epocas.length ? Math.max(...epocas) : null, membros: [...x.membros], folhas: [...x.membros].flatMap((m) => [...(folhasDe.get(m) ?? [])]),
            commits: [...x.commits.entries()].filter(([e]) => e > desde).map(([epoca, corpo]) => ({ epoca, corpo })), boasvindas: x.boas.get(nome()) ?? null,
          };
        },
        async pacotes(_grupo, faltam) {
          const saida = [];
          for (const f of faltam) {
            const lista = pacotesDe.get(f) ?? [];
            if (lista.length) saida.push({ para: f, pacote: lista.shift() });
          }
          return saida;
        },
        async gravarCommit(grupo, epoca, corpo, boasvindas) {
          const x = g(grupo);
          const atual = x.commits.size ? Math.max(...x.commits.keys()) : 0;
          if (epoca !== atual + 1) return "ocupada";
          x.commits.set(epoca, corpo);
          for (const b of boasvindas) x.boas.set(b.para, { epoca, welcome: b.welcome });
          return "ok";
        },
      };
    },
  };
}
const memoria = () => {
  const m = new Map();
  return { ler: async (k) => m.get(k) ?? null, guardar: async (k, v) => void m.set(k, v), apagar: async (k) => void m.delete(k), m };
};
const S = criarServidor();
async function pessoa() {
  const conta = crypto.randomUUID();
  const cc = M.CoreCrypto.new(M.Database.inMemory());
  const aparelho = await prepararAparelho(M, cc, conta);
  const guarda = memoria();
  const motor = criarMotorDeGrupo({
    tipo: "grupo", aparelho: async () => aparelho, transporte: S.transporte(conta, () => aparelho.eu.nome), guarda, politica: { aceitarFolha: async () => true }, agora: () => relogio,
  });
  return { conta, aparelho, guarda, motor, publicar: async (n = 2) => S.publicar(conta, aparelho.eu.nome, await motor.gerarPacotes(n)) };
}

const G = "nucleo:00000000-0000-4000-8000-0000000000r3";
const ana = await pessoa();
const bia = await pessoa();
S.g(G).membros.add(ana.conta);
await ana.publicar(1);
await ana.motor.sincronizar(G);
S.g(G).membros.add(bia.conta);
await bia.publicar();
const e2 = await ana.motor.sincronizar(G);
const b2 = await bia.motor.sincronizar(G);
confere("começo: as duas na mesma época", e2?.epoca === 2n && b2?.epoca === 2n, `${e2?.epoca} ${b2?.epoca}`);
confere("regra: 7 dias e 200 mensagens", FOLHA_DIAS === 7 && FOLHA_MENSAGENS === 200);

// Sem prazo vencido, sincronizar não troca nada.
relogio += 6 * DIA;
const semTroca = await bia.motor.sincronizar(G);
confere("6 dias: quem sincroniza não troca a folha (a época fica)", semTroca?.epoca === 2n, String(semTroca?.epoca));

// O "ladrão" copia a guarda da Bia agora (os segredos das épocas que ela já viu).
const roubado = structuredClone(bia.guarda.m);

// 8 dias: a Bia, que só lê, troca a folha ao sincronizar.
relogio += 2 * DIA;
const depois = await bia.motor.sincronizar(G);
confere("mais de 7 dias: quem só lê troca a própria folha na sincronização (época nova)", depois?.epoca === 3n, String(depois?.epoca));
// A Ana também passou dos 7 dias: lê a troca da Bia (época 3) e troca a dela (época 4).
const a3 = await ana.motor.sincronizar(G);
const b4 = await bia.motor.sincronizar(G);
confere("a outra ponta lê a troca e, também vencida, troca a dela; as duas na mesma época com os mesmos segredos", a3?.epoca === 4n && b4?.epoca === 4n && hex(a3.segredos.conteudo) === hex(b4.segredos.conteudo), `${a3?.epoca} ${b4?.epoca}`);
confere("a troca dá segredos novos: o ladrão que levou a guarda antes (até a época 2) não tem a 3 nem a 4, e a 2 não serve nelas",
  !!roubado.get(`segredos:grupo:${G}`) && !Object.keys(roubado.get(`segredos:grupo:${G}`)).some((e) => Number(e) >= 3) && hex(segredosDaEpoca(Buffer.from(roubado.get(`segredos:grupo:${G}`)["2"], "base64"), new TextEncoder().encode(`alumia:grupo:${G}`), "grupo").conteudo) !== hex(a3.segredos.conteudo));
const ja = await bia.motor.sincronizar(G);
confere("logo depois da troca, a contagem recomeça (sincronizar de novo não troca)", ja?.epoca === 4n && (await ana.motor.sincronizar(G))?.epoca === 4n);

// 200 mensagens: a 199ª não dispara, a 200ª dispara na próxima sincronização.
for (let i = 0; i < FOLHA_MENSAGENS - 1; i++) await ana.motor.aoMandar(G);
const com199 = await ana.motor.sincronizar(G);
confere("199 mensagens mandadas: a folha fica", com199?.epoca === 4n, String(com199?.epoca));
await ana.motor.aoMandar(G);
const com200 = await ana.motor.sincronizar(G);
confere("200 mensagens mandadas: a próxima sincronização troca a folha", com200?.epoca === 5n, String(com200?.epoca));
confere("a Bia acompanha", (await bia.motor.sincronizar(G))?.epoca === 5n);

// As duas vencidas ao mesmo tempo: um commit por época, as duas acabam iguais.
relogio += 8 * DIA;
const [x, y] = await Promise.all([ana.motor.sincronizar(G), bia.motor.sincronizar(G)]);
await ana.motor.sincronizar(G);
await bia.motor.sincronizar(G);
const [x2, y2] = [await ana.motor.sincronizar(G), await bia.motor.sincronizar(G)];
confere("vencidas ao mesmo tempo: nada se parte; as duas na mesma época e com os mesmos segredos", x && y && x2?.epoca === y2?.epoca && hex(x2.segredos.conteudo) === hex(y2.segredos.conteudo), `${x?.epoca} ${y?.epoca} ${x2?.epoca} ${y2?.epoca}`);
confere("vencidas ao mesmo tempo: as duas trocaram (a que perdeu a corrida troca na seguinte)", x2.epoca === 7n, String(x2.epoca));

await ana.motor.esquecer(G);
confere("esquecer o grupo esquece a contagem da folha", !ana.guarda.m.has(`folha:grupo:${G}`));

console.log(`${certos} certos, ${falhas.length} falhas`);
if (falhas.length) {
  for (const f of falhas) console.log(`  FALHA ${f}`);
  process.exit(1);
}
