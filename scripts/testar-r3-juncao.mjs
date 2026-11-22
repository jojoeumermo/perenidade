// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Junção da onda R3: o que só existe quando as frentes se encontram.
//   1. O chat separado (servidor-chat) em TODA via (pq-trafego-mixnet): com o desvio ligado, as rotas das caixas vão ao servidor do
//      chat pela via direta E pela mixnet (antes, a mixnet ia ao site); o resto fica no site; sem laço; fora do registro, desligado.
//   2. Os apps mandam os mesmos cabeçalhos (android e o ritmo do tráfego: um lugar só) e a casca liga o ciclo de vida ao ritmo.
//   3. O chat ligado à malha sem internet (sem-internet-formal): Ana manda pelo transporte com a malha, o pacote da malha chega à Bia e
//      abre pelo mesmo caminho da caixa (ChatDoAparelho.caixasDaMalha/receberDaMalha); pacote para outra caixa é recusado.
//   4. O fim da R3 no banco: versão 16, o recurso novo, a marca da urna e a lista da porta.
// Uso: npm run testar:r3-juncao
import fs from "node:fs";

let certos = 0;
const falhas = [];
const ok = (nome, cond, detalhe = "") => (cond ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
const ler = (c) => fs.readFileSync(c, "utf8");

// ═══ 1. O desvio do servidor do chat em toda via ═══
{
  const vias = await import("../lib/rede/caixas/vias.ts");
  const sc = await import("../lib/rede/caixas/servidor-do-chat.ts");
  const nym = await import("../lib/rede/mixnet/nym.ts");
  const pedidos = { direta: [], mixnet: [] };
  vias.usarFetchDireto(async (u) => (pedidos.direta.push(String(u)), new Response("{}")));
  const E = "https://chat.exemplo.org";
  const recusada = async (nome) => {
    const antes = pedidos.direta.length;
    const erro = await vias.viaAtual().fetch("/api/alumia/caixa/lote", { method: "POST" }).then(() => null, (e) => e.code);
    ok(nome, erro === "servidor_do_chat_fora" && pedidos.direta.length === antes, String(erro));
  };
  ok("fora do registro: não liga o separado", sc.ligarServidorDoChat({ endereco: "https://outro.exemplo.org", seq: 3 }, E) === false);
  // Auditoria interna da R3: antes, aqui a caixa ia ao site em silêncio (os apps depositariam no banco do site enquanto o site usava o
  // servidor do chat: mensagem "entregue" que nunca chega). Agora nem ao site, nem ao outro: o erro aparece.
  await recusada("ATAQUE registro e configuração diferentes: a caixa NÃO sai (nem ao site, nem ao outro)");
  ok("o app sem o endereço configurado, com o servidor separado no registro: não liga", sc.ligarServidorDoChat({ endereco: E, seq: 3 }, "") === false);
  await recusada("ATAQUE o app sem o endereço, com o servidor separado no registro: a caixa NÃO vai ao site (falha fechada)");
  await vias.viaAtual().fetch("/api/alumia/passes/emitir", { method: "POST" });
  ok("e o que não é caixa continua no site", pedidos.direta.at(-1) === "/api/alumia/passes/emitir");
  ok("configurado mas sem a linha no registro: não liga", sc.ligarServidorDoChat(undefined, E) === false);
  await recusada("e a caixa também não sai");
  ok("sem nada no registro e sem configuração: o site, como na R2", sc.ligarServidorDoChat(undefined, "") === false);
  await vias.viaAtual().fetch("/api/alumia/caixa/lote", { method: "POST" });
  ok("sem servidor separado: a caixa vai ao site", pedidos.direta.at(-1) === "/api/alumia/caixa/lote");
  ok("no registro: liga o separado", sc.ligarServidorDoChat({ endereco: E, seq: 4 }, E) === true);
  await vias.viaAtual().fetch("/api/alumia/caixa/buscar", { method: "POST" });
  ok("via direta: a caixa vai ao servidor do chat", pedidos.direta.at(-1) === `${E}/caixa/buscar`, pedidos.direta.at(-1));
  await vias.viaAtual().fetch("/api/alumia/passes/emitir", { method: "POST" });
  ok("via direta: o que não é caixa fica no site", pedidos.direta.at(-1) === "/api/alumia/passes/emitir");
  nym.ligarMixnet(async (u) => (pedidos.mixnet.push(String(u)), new Response("{}")));
  ok("com a mixnet ligada, a via é a mixnet", vias.viaAtual().via === "mixnet");
  await vias.viaAtual().fetch("/api/alumia/caixa/confirmar", { method: "POST" });
  ok("ATAQUE de antes: pela mixnet, a caixa também vai ao servidor do chat (antes ia ao site)", pedidos.mixnet.at(-1) === `${E}/caixa/confirmar`, pedidos.mixnet.at(-1));
  ok("pela mixnet, nada sai pela via direta", pedidos.direta.at(-1) === "/api/alumia/passes/emitir");
  nym.desligarMixnet();
  // Sem laço: o transporte passa o fetch direto de novo (configurarTransporte chama usarFetchDireto) e nada se chama a si mesmo.
  const tr = await import("../lib/rede/caixas/transporte.ts");
  tr.configurarTransporte({ fetch: async (u) => (pedidos.direta.push(String(u)), new Response("{}")), base: "" });
  const r = await tr.postAnonimo("/api/alumia/caixa/apagar", {});
  ok("postAnonimo pelo transporte: chega ao servidor do chat, sem laço", r.status === 200 && pedidos.direta.at(-1) === `${E}/caixa/apagar`, pedidos.direta.at(-1));
  ok("endereço vazio desliga o desvio", sc.ligarServidorDoChat(undefined, "") === false);
  await vias.viaAtual().fetch("/api/alumia/caixa/lote", { method: "POST" });
  ok("desligado, a caixa volta ao site", pedidos.direta.at(-1) === "/api/alumia/caixa/lote");
}

// ═══ 2. Os mesmos cabeçalhos em todo app; o ciclo de vida no ritmo ═══
{
  const { CABECALHOS_DOS_APPS } = await import("../lib/rede/caixas/ritmo.ts");
  const android = ler("lib/rede/casca/android.ts");
  ok("a casca do Android usa os cabeçalhos do ritmo (um lugar só)", /import \{ CABECALHOS_DOS_APPS \} from "\.\.\/caixas\/ritmo"/.test(android) && !/CABECALHOS_FIXOS\s*=/.test(android));
  const rede = ler("desktop/src-tauri/src/rede.rs") + ler("desktop/src-tauri/src/lib.rs");
  ok("o computador manda o mesmo User-Agent", rede.includes(`"${CABECALHOS_DOS_APPS["User-Agent"]}"`));
  const iniciar = ler("casca/app/iniciar.ts");
  ok("a casca liga o ciclo de vida do app ao ritmo (Android e computador)", /appStateChange/.test(iniciar) && /definirEstado\(/.test(iniciar) && /cascaDoComputador\(\)/.test(iniciar));
  ok("a CSP da casca deixa a ponte do Tauri", /connect-src 'self' ipc: http:\/\/ipc\.localhost/.test(ler("casca/montar.mjs")));
  ok("a casca do computador usa a interface Casca de plataforma.ts (sem cópia)", /import type \{ Casca \} from "\.\/plataforma"/.test(ler("lib/rede/casca/computador.ts")));
}

// ═══ 2b. A CSP com o servidor do chat separado (next.config.ts) ═══
// Num processo à parte (a configuração lê o ambiente ao carregar): com o endereço, as políticas do site e da Alumia deixam o
// navegador falar com a ORIGEM do servidor do chat (e só ela); sem o endereço, nada muda. (A primeira versão da junção escreveu a
// expressão regular errada e punha "/^https:/" na política: este teste falha com ela.)
{
  const { spawnSync } = await import("node:child_process");
  const cspCom = (endereco) => {
    const codigo = "const m = await import(" + JSON.stringify(new URL("../next.config.ts", import.meta.url).href) + "); const h = await m.default.headers();" +
      " console.log(JSON.stringify(h.flatMap((r) => r.headers).filter((x) => /^content-security-policy/i.test(x.key)).map((x) => (x.value.match(/connect-src[^;]*/) ?? [''])[0])));";
    const r = spawnSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "--import", "./scripts/carregar-ts.mjs", "--input-type=module", "-e", codigo], {
      env: { ...process.env, NEXT_PUBLIC_ALUMIA_CHAT_SERVIDOR: endereco }, encoding: "utf8",
    });
    try {
      return JSON.parse(r.stdout.trim().split(String.fromCharCode(10)).at(-1));
    } catch {
      return null;
    }
  };
  const com = cspCom("https://chat.exemplo.org/caminho");
  const sem = cspCom("");
  const torto = cspCom("http://chat.exemplo.org");
  ok("CSP: com o servidor do chat, a política do site e a da Alumia deixam a origem dele (sem o caminho)", Array.isArray(com) && com.filter((c) => c.includes(" https://chat.exemplo.org ")).length >= 2 && !com.some((c) => c.includes("/caminho")), JSON.stringify(com));
  ok("CSP: nenhuma política leva lixo da configuração", Array.isArray(com) && !com.some((c) => c.includes("/^") || /undefined|null/.test(c)));
  ok("CSP: sem o endereço (o padrão), nada do chat entra", Array.isArray(sem) && !sem.some((c) => c.includes("chat.exemplo.org")) && sem.length === com.length);
  ok("CSP: endereço sem https não entra", Array.isArray(torto) && !torto.some((c) => c.includes("chat.exemplo.org")));
}

// ═══ 3. O chat ligado à malha ═══
{
  const S = await import("../lib/rede/chat/r2/servico.ts");
  ok("o ChatDoAparelho tem as duas pontas da malha", typeof S.ChatDoAparelho.prototype.caixasDaMalha === "function" && typeof S.ChatDoAparelho.prototype.receberDaMalha === "function");
  const nav = ler("lib/rede/chat/r2/navegador.ts");
  ok("o navegador embrulha o transporte com a malha só no app, por import dinâmico", /await import\("\.\.\/\.\.\/malha\/estou-bem"\)/.test(nav) && /comMalha\(t,/.test(nav) && !/^import .*malha/m.test(nav));
  ok(
    "o navegador entrega a malha ao chat na fila e desliga ao sair",
    /definirDestino\(destinoComAtos\(\{ caixas: \(\) => chat\.caixasDaMalha\(\), mensagem: \(id, d\) => naFila/.test(nav) && /esquecerAtos\(\)/.test(nav) && /desligarMalha\(\)/.test(nav),
  );
  ok("o navegador liga o servidor do chat pela vista do registro", (nav.match(/ligarServidorDoChat\(vista\.servidorChat\)/g) ?? []).length === 2);
}

// ═══ 4. O fim da R3 no banco ═══
{
  const fim = ler("supabase/migracoes/20261125-r3-fim.sql");
  ok("r3-fim: versão 16", /select 16\n\$\$;/.test(fim));
  ok("r3-fim: o recurso alumia-chat-so-app no catálogo, só pelo nome", /\('alumia-chat-so-app', true\)/.test(fim));
  ok("r3-fim: o passe da urna marca quem pegou a cédula", /voto_cedula_tomada\(p_tipo, p_alvo, v\)/.test(fim));
  ok("r3-fim: a porta deixa de fora as três funções novas só do servidor do site", ["rede_urna_depositar_anonimo", "rede_urna_cedula_contar", "rede_passes_chave_ler", "rede_passes_chave_guardar"].every((n) => fim.includes(`'${n}'`)));
  ok("r3-fim: a votação da equipe na tela conta quem pegou a cédula da urna anônima", /votacao_cedulas_emitidas e where e.votacao = v.id/.test(fim));
  ok("r3-fim: termina trancando", /select interno\.alumia_trancar\(\);\s*$/.test(fim));
  // Desde o Prompt 5 (20261126-p5-fim.sql) o banco está na versão 17; o fim da R3 continua valendo por baixo dele.
  ok("o painel espera a versão da R3 ou depois", Number((ler("lib/rede/painel/tipos.ts").match(/VERSAO_ESPERADA_DO_BANCO = (\d+);/) ?? [])[1]) >= 16);
}

console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
