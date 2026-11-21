// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Onda R3, item 2.1 (mixnet PREPARADA e DESLIGADA). Prova:
//   - ACEITE: numa simulação da rede inteira (lib/rede/mixnet/simulacao.ts, modelo Loopix com cobertura, 50 aparelhos, 30 rodadas),
//     um observador que vê TODAS as ligações com o horário exato não liga o depósito a quem depositou nem a busca a quem buscou acima
//     do acaso (fica dentro do intervalo de 99% de 1/50); e o MESMO observador acerta muito acima do acaso pela via direta e pela
//     mixnet sem cobertura (prova que ele funciona e que a cobertura é parte da proteção);
//   - as vias: sem mixnet ligada, a via é a direta (ou o Tor, quando há); pedir a mixnet desligada diz "mixnet_desligada"; ligada, os
//     pedidos anônimos das caixas saem por ela (com os cabeçalhos fixos dos apps, sem credencial), e os com sessão não; o modo rápido
//     (só Tor) vale por cima da mixnet; o adaptador da Nym só liga com a configuração e cai para desligado se a rede falhar;
//   - nada da Nym entra no build enquanto desligada (nenhum import do pacote no código do site).
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-r3-mixnet.mjs
import fs from "node:fs";
import path from "node:path";

let certos = 0;
const falhas = [];
const confere = (nome, ok, detalhe = "") => (ok ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));

// Um armazenamento local de mentira (o modo da via mora nele).
const guardado = new Map();
globalThis.localStorage = { getItem: (k) => guardado.get(k) ?? null, setItem: (k, v) => void guardado.set(k, String(v)), removeItem: (k) => void guardado.delete(k) };

const { rodada, intervaloDoAcaso } = await import("../lib/rede/mixnet/simulacao.ts");
const { MODELO, OPCOES_DO_NYM } = await import("../lib/rede/mixnet/parametros.ts");

// ── Aceite: o observador global ───────────────────────────────────────────────────────────────────────────────────────────
const RODADAS = 30;
const N = 50;
const medir = (via) => {
  let eventos = 0;
  let acertos = 0;
  let conversas = 0;
  let pares = 0;
  for (let s = 1; s <= RODADAS; s++) {
    const r = rodada({ via, semente: s * 7919 + 13, pessoas: N });
    eventos += r.eventos;
    acertos += r.acertos;
    conversas += r.conversas;
    pares += r.paresCertos;
  }
  return { eventos, acertos, taxa: acertos / eventos, conversas, pares };
};
const t0 = Date.now();
const comMixnet = medir("mixnet");
const semCobertura = medir("mixnet_sem_cobertura");
const direta = medir("direta");
const ic = intervaloDoAcaso(comMixnet.eventos, N);
console.log(`  (modelo: ${MODELO.camadas} camadas × ${MODELO.nosPorCamada} nós, atraso médio ${MODELO.atrasoMedio * 1000} ms por nó, ${MODELO.taxaPorAparelho} pacotes/s por aparelho; ${N} aparelhos, ${RODADAS} rodadas, ${Date.now() - t0} ms)`);
console.log(`  (mixnet com cobertura: ${comMixnet.acertos}/${comMixnet.eventos} = ${comMixnet.taxa.toFixed(4)}; acaso ${ic.acaso}, intervalo de 99% [${ic.min.toFixed(4)}, ${ic.max.toFixed(4)}]; pares certos ${comMixnet.pares}/${comMixnet.conversas})`);
console.log(`  (mixnet sem cobertura: ${semCobertura.taxa.toFixed(4)}, pares ${semCobertura.pares}/${semCobertura.conversas}; via direta: ${direta.taxa.toFixed(4)}, pares ${direta.pares}/${direta.conversas})`);
confere("ACEITE 2.1: com a mixnet e a cobertura, o observador global liga depósito e busca a quem fez dentro do intervalo de 99% do acaso",
  comMixnet.taxa >= ic.min && comMixnet.taxa <= ic.max, `${comMixnet.taxa.toFixed(4)} fora de [${ic.min.toFixed(4)}, ${ic.max.toFixed(4)}]`);
// O acaso para acertar os DOIS lados de uma conversa é 1/(50·49): em 600 conversas, espera-se ~0,24; mais de 3 já seria suspeito.
confere("ACEITE 2.1: com a mixnet e a cobertura, quase nunca acerta quem fala com quem (os dois lados de uma conversa)", comMixnet.pares <= 3, String(comMixnet.pares));
confere("controle: o mesmo observador acerta muito acima do acaso pela via direta", direta.taxa > 0.9, direta.taxa.toFixed(4));
confere("controle: ... e pela mixnet SEM cobertura (a cobertura é parte da proteção)", semCobertura.taxa > 10 / N && semCobertura.pares > comMixnet.pares + 100, `${semCobertura.taxa.toFixed(4)}, pares ${semCobertura.pares}`);
confere("simulação: as três vias veem os mesmos eventos de verdade (a comparação é justa)", comMixnet.eventos === direta.eventos && semCobertura.eventos === direta.eventos);
confere("simulação: a mesma semente dá o mesmo resultado (o teste se repete)", JSON.stringify(rodada({ via: "mixnet", semente: 5 })) === JSON.stringify(rodada({ via: "mixnet", semente: 5 })));

// ── As vias ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
const vias = await import("../lib/rede/caixas/vias.ts");
const nym = await import("../lib/rede/mixnet/nym.ts");
const transporte = await import("../lib/rede/caixas/transporte.ts");
const pedidos = { direta: [], mixnet: [], tor: [] };
const resposta = () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
const de = (onde) => async (url, init) => {
  pedidos[onde].push({ url: String(url), init });
  return resposta();
};
transporte.configurarTransporte({ fetch: de("direta"), base: "https://exemplo.invalid", tokenDaConta: async () => "token-de-teste" });

confere("vias: sem nada ligado, a via é a direta", vias.viaAtual().via === "direta");
confere("vias: a mixnet não vem configurada nesta versão", nym.mixnetConfigurada() === false && nym.mixnetLigada() === false);
const pediuMix = await vias.escolherVia("mixnet");
confere("vias: pedir a mixnet desligada responde \"mixnet_desligada\" e segue pela direta", pediuMix.via === "direta" && pediuMix.motivo === "mixnet_desligada");
await transporte.postAnonimo("/api/alumia/caixa/lote", { itens: [] });
confere("vias: o pedido anônimo saiu pela direta, com o endereço de sempre", pedidos.direta.length === 1 && pedidos.direta[0].url === "https://exemplo.invalid/api/alumia/caixa/lote");

nym.ligarMixnet(de("mixnet"));
confere("vias: com a mixnet ligada, ela é a via padrão", vias.viaAtual().via === "mixnet" && (await vias.viaAtual().pronta()));
await transporte.postAnonimo("/api/alumia/caixa/lote", { itens: [] });
await transporte.getAnonimo("/api/alumia/passes/chave");
const pelaMix = pedidos.mixnet.map((p) => [p.url, new Headers(p.init.headers).get("User-Agent"), p.init.credentials, p.init.referrerPolicy]);
confere("vias: os pedidos anônimos (POST e GET) saem pela mixnet, com o User-Agent fixo dos apps, sem credencial e sem referência",
  pelaMix.length === 2 && pelaMix.every(([u, ua, c, r]) => u.startsWith("https://exemplo.invalid/") && ua === "alumia/1" && c === "omit" && r === "no-referrer"), JSON.stringify(pelaMix));
confere("vias: nada foi pela direta enquanto a mixnet estava ligada", pedidos.direta.length === 1);
await transporte.postComSessao("/api/alumia/passes/emitir", { pedidos: [] });
confere("vias: o pedido COM sessão não passa pela mixnet (ele já diz quem é)", pedidos.mixnet.length === 2 && pedidos.direta.length === 2 && new Headers(pedidos.direta[1].init.headers).get("Authorization") === "Bearer token-de-teste");

// Modo rápido: só Tor.
const rapidoSemTor = await vias.escolherVia("tor");
confere("modo rápido sem Tor disponível: \"tor_indisponivel\", e a mixnet deixa de ser usada (a pessoa escolheu)", rapidoSemTor.via === "direta" && rapidoSemTor.motivo === "tor_indisponivel" && vias.viaAtual().via === "direta");
vias.ligarTor(de("tor"), "http://endereco-de-teste.onion");
confere("modo rápido com o Tor do app: a via é o Tor, falando com o .onion", vias.viaAtual().via === "tor" && vias.viaAtual().base === "http://endereco-de-teste.onion");
await transporte.postAnonimo("/api/alumia/caixa/lote", { itens: [] });
confere("modo rápido: o pedido saiu pelo Tor, para o .onion", pedidos.tor.length === 1 && pedidos.tor[0].url === "http://endereco-de-teste.onion/api/alumia/caixa/lote");
const volta = await vias.escolherVia("mixnet");
confere("voltar ao padrão: a mixnet de novo", volta.via === "mixnet" && !volta.motivo && vias.viaAtual().via === "mixnet");
confere("o modo fica guardado neste aparelho (rápido some ao voltar ao padrão)", vias.modoDaVia() === "padrao" && !guardado.has("alumia-via-r3"));
nym.desligarMixnet();
confere("mixnet desligada (a rede caiu): volta ao Tor, que estava ligado", vias.viaAtual().via === "tor");
vias.desligarTor();
confere("sem Tor e sem mixnet: direta", vias.viaAtual().via === "direta");

// O adaptador da Nym: só liga com a configuração; falha = desligada.
let opcoesRecebidas = null;
const moduloFalso = { createMixFetch: async (o) => ((opcoesRecebidas = o), de("mixnet")) };
confere("Nym: sem a configuração, ligarNym não liga nada", (await nym.ligarNym(moduloFalso)) === false && !nym.mixnetLigada() && opcoesRecebidas === null);
process.env.NEXT_PUBLIC_ALUMIA_MIXNET = "nym";
confere("Nym: com a configuração, liga com as opções do parâmetro (cobertura e Poisson ligados, TLS por dentro)",
  (await nym.ligarNym(moduloFalso)) === true && nym.mixnetLigada() && opcoesRecebidas.disableCoverTraffic === false && opcoesRecebidas.disablePoissonTraffic === false && opcoesRecebidas.forceTls === true);
const quebrado = { createMixFetch: async () => { throw new Error("rede da Nym fora"); } };
confere("Nym: se a rede falhar ao ligar, fica desligada (as caixas seguem pela via de antes)", (await nym.ligarNym(quebrado)) === false && !nym.mixnetLigada());
delete process.env.NEXT_PUBLIC_ALUMIA_MIXNET;
confere("parâmetros: a cobertura e o Poisson vêm ligados", OPCOES_DO_NYM.disableCoverTraffic === false && OPCOES_DO_NYM.disablePoissonTraffic === false);

// ── Nada da Nym no build enquanto desligada ───────────────────────────────────────────────────────────────────────────────
{
  const raiz = path.resolve(import.meta.dirname, "..");
  const achados = [];
  const andar = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) andar(p);
      else if (/\.(ts|tsx|js|mjs)$/.test(e.name) && /from\s+["']@nymproject|import\(\s*["']@nymproject/.test(fs.readFileSync(p, "utf8"))) achados.push(path.relative(raiz, p));
    }
  };
  for (const d of ["app", "components", "lib"]) andar(path.join(raiz, d));
  const pacote = JSON.parse(fs.readFileSync(path.join(raiz, "package.json"), "utf8"));
  confere("desligada: nenhum arquivo do site importa o pacote da Nym", achados.length === 0, achados.join(", "));
  confere("desligada: o pacote da Nym não está nas dependências", !Object.keys({ ...pacote.dependencies, ...pacote.devDependencies }).some((n) => n.startsWith("@nymproject/")));
}

// ── A tela: por onde as mensagens passam e o modo rápido explicado (6 idiomas) ────────────────────────────────────────────────
{
  const raiz = path.resolve(import.meta.dirname, "..");
  const CHAVES = ["via", "viaDireta", "viaTor", "viaMixnet", "modoPadrao", "modoRapido", "modoRapidoExplica", "mixnetDesligada"];
  const idiomas = ["pt", "en", "es", "fr", "ru", "zh"];
  const textos = Object.fromEntries(idiomas.map((l) => [l, JSON.parse(fs.readFileSync(path.join(raiz, `i18n/rede/chat/${l}.json`), "utf8"))]));
  confere("tela: os textos das vias e do modo rápido existem nos 6 idiomas", idiomas.every((l) => CHAVES.every((k) => typeof textos[l].ajustes?.[k] === "string" && textos[l].ajustes[k].length > 3)));
  confere("tela: os 5 idiomas que não são o português continuam marcados como rascunho", idiomas.filter((l) => l !== "pt").every((l) => textos[l]._rascunho === true));
  confere("tela: o modo rápido diz o que se perde (vigiar a rede inteira, ligar pelo horário)", /rede inteira/.test(textos.pt.ajustes.modoRapidoExplica) && /horário/.test(textos.pt.ajustes.modoRapidoExplica));
  const ajustes = fs.readFileSync(path.join(raiz, "components/rede/chat/Ajustes.tsx"), "utf8");
  confere("tela: os ajustes do chat mostram a via de agora e a escolha do modo (desativada enquanto a mixnet está desligada)",
    /escolherVia\(/.test(ajustes) && /viaAtual\(\)/.test(ajustes) && /disabled=\{!comMixnet\}/.test(ajustes) && /t\.ajustes\.modoRapidoExplica/.test(ajustes) && /t\.ajustes\.mixnetDesligada/.test(ajustes));
}

console.log(`${certos} certos, ${falhas.length} falhas`);
if (falhas.length) {
  for (const f of falhas) console.log(`  FALHA ${f}`);
  process.exit(1);
}
