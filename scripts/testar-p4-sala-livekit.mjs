// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, item 141: as salas de vídeo do painel pelo LiveKit Cloud, atrás de "sala-livekit" (desligado). Confere:
//   · o token (lib/sala/livekit.ts): assinado no servidor, para UMA sala, 2 horas, identidade sorteada, sem nome, e-mail nem conta;
//     só quem conduz modera; ninguém grava nem transmite para fora;
//   · quem entra (lib/sala/entrada.ts) pelas MESMAS funções do banco de hoje, no banco de verdade (PGlite com o install.sql): a
//     reunião de convidados recusa quem não foi convidado, a sala que não existe é recusada, quem organiza conduz, a chamada de canal
//     vale para quem está na conversa; a turma, só para quem está nela; o estudo em grupo, com limite de pedidos e o desafio;
//   · a rota (app/api/sala/entrada): 404 com o interruptor desligado, 503 sem a configuração, o que devolve e o que não grava;
//   · desligado, tudo segue pelo Jitsi (os cinco lugares chamam a SalaDeVideo, que devolve a JitsiSala); as aulas e o podcast ficam;
//   · nenhuma chave no código do navegador; o connect-src só com o endereço do projeto; o texto de privacidade e os créditos;
//   · com ALUMIA_LIVEKIT_TESTE (http://endereço:porta de um LiveKit local, chaves de desenvolvimento devkey/secret), o servidor do
//     LiveKit de verdade aceita o token, recusa o mexido, e só o de quem conduz modera.
// Uso: npm run testar:p4-sala-livekit
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");

let certos = 0;
const falhas = [];
const confere = (nome, ok, detalhe = "") => (ok ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));

// O banco nasce antes de tudo (o PGlite).
const { criarBanco } = await import("./banco-local.mjs");
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;

const L = await import("../lib/sala/livekit.ts");
const E = await import("../lib/sala/entrada.ts");

// ═══════════════════ 1. O token ═══════════════════
const CFG = { chave: "APIchaveTeste", segredo: "segredo-de-teste-bem-comprido" };
{
  const agora = Date.UTC(2026, 10, 21, 12);
  const a = L.tokenDaSala(CFG, "InstitutoLucia-abc123def456", "assiste", agora);
  const b = L.tokenDaSala(CFG, "InstitutoLucia-abc123def456", "conduz", agora);
  const ca = L.lerToken(a.token, CFG.segredo);
  const cb = L.lerToken(b.token, CFG.segredo);
  confere("token: a assinatura confere e o emissor é a chave do projeto", ca?.iss === CFG.chave && cb?.iss === CFG.chave);
  confere("token: vale 2 horas", ca.exp - Math.floor(agora / 1000) === 7200 && a.expira === (Math.floor(agora / 1000) + 7200) * 1000);
  confere("token: para AQUELA sala", ca.video.room === "InstitutoLucia-abc123def456" && ca.video.roomJoin === true);
  confere("token: identidade sorteada a cada entrada (32 hex), nunca a mesma", /^[0-9a-f]{32}$/.test(ca.sub) && ca.sub !== cb.sub);
  confere("token: só quem conduz modera", cb.video.roomAdmin === true && ca.video.roomAdmin === false && L.permissoes("x-sala-1", "canal").roomAdmin === false && L.permissoes("x-sala-1", "estudo").roomAdmin === false);
  confere("token: ninguém grava, transmite para fora, cria ou lista sala, nem entra escondido", [ca, cb].every((c) => c.video.roomRecord === false && c.video.ingressAdmin === false && c.video.roomCreate === false && c.video.roomList === false && c.video.hidden === false && c.video.recorder === false));
  const claro = Buffer.from(a.token.split(".")[1], "base64url").toString("utf8");
  confere("token: sem nome, e-mail nem conta (só a sala e as permissões)", !/"name"|"metadata"|@|[0-9a-f]{8}-[0-9a-f]{4}-/.test(claro) && Object.keys(ca).sort().join() === "exp,iss,nbf,sub,video", claro);
  const mexido = a.token.slice(0, -3) + (a.token.endsWith("AAA") ? "BBB" : "AAA");
  confere("token: mexido ou com outro segredo não confere", L.lerToken(mexido, CFG.segredo) === null && L.lerToken(a.token, "outro-segredo") === null);
  let lancou = false;
  try {
    L.tokenDaSala(CFG, "../../x", "assiste");
  } catch {
    lancou = true;
  }
  confere("token: nome de sala fora do formato nem é assinado", lancou);
  confere("config: sem chave, segredo ou endereço, nada", L.configDoLivekit({}) === null && L.configDoLivekit({ NEXT_PUBLIC_LIVEKIT_URL: "wss://x.livekit.cloud", LIVEKIT_API_KEY: "k1k" }) === null);
  confere("config: só wss:// (ws:// só em localhost)", L.enderecoDoLivekit("https://x.livekit.cloud") === null && L.enderecoDoLivekit("ws://x.livekit.cloud") === null && L.enderecoDoLivekit("ws://localhost:7880") === "ws://localhost:7880" && L.enderecoDoLivekit("wss://proj.livekit.cloud/") === "wss://proj.livekit.cloud");
}

// ═══════════════════ 2. O pedido ═══════════════════
{
  confere("pedido: origem desconhecida, sala fora do formato ou estudo com outro nome: recusados", [
    { origem: "painel", sala: "InstitutoLucia-abc123" },
    { origem: "reuniao", sala: "a b" },
    { origem: "reuniao", sala: "x".repeat(81) },
    { origem: "estudo", sala: "InstitutoLucia-abc123" },
    { origem: "turma-mes", sala: "InstitutoLucia-abc123", mes: "2026-13" },
    { origem: "turma-curso", sala: "InstitutoLucia-abc123", mes: "2026-11", curso: "Curso Grande" },
    null,
  ].every((p) => E.lerPedido(p) === null));
  const p = E.lerPedido({ origem: "reuniao", sala: "InstitutoLucia-abc123", extra: "x", conduzo: true });
  confere("pedido: só os campos conhecidos passam (nada de 'conduzo' vindo do navegador)", JSON.stringify(p) === JSON.stringify({ origem: "reuniao", sala: "InstitutoLucia-abc123" }));
}

// ═══════════════════ 3. Quem entra, no banco de verdade ═══════════════════
const P = {};
for (const nome of ["coord", "ana", "bia", "caio", "visita"]) {
  P[nome] = await criarUsuario(`${nome}@sala.local`, `Pessoa ${nome}`);
  await rpc({ papel: "authenticated", sub: P[nome], ip: "198.51.100.7" }, "eu");
}
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao'), ($2, 'educacao'), ($3, 'educacao'), ($4, 'revisao')", [P.coord, P.ana, P.bia, P.caio]);
const como = (sub) => ({ papel: "authenticated", sub, ip: "198.51.100.7" });
const rpcComo = async (sessao, f, a) => {
  try {
    return await rpc(como(sessao), f, a);
  } catch {
    return null;
  }
};
const salaConv = (await dono("insert into interno.reunioes (titulo, inicio, tipo, organizador) values ('Reunião só de convidados', now() + interval '1 hour', 'convidados', $1) returning id, sala", [P.coord])).rows[0];
await dono("insert into interno.reunioes_convites (reuniao, usuario) values ($1, $2)", [salaConv.id, P.ana]);
const salaAberta = (await dono("insert into interno.reunioes (titulo, inicio, tipo, organizador) values ('Reunião aberta da equipe', now(), 'aberta', $1) returning sala", [P.ana])).rows[0].sala;
const salaEncerrada = (await dono("insert into interno.reunioes (titulo, inicio, tipo, organizador, status) values ('Reunião que acabou', now() - interval '2 days', 'aberta', $1, 'encerrada') returning sala", [P.coord])).rows[0].sala;
const conversa = (await dono("insert into interno.conversas (tipo, nome, criada_por) values ('grupo', 'Canal da formação', $1) returning id", [P.ana])).rows[0].id;
await dono("insert into interno.conversa_membros (conversa, usuario) values ($1, $2), ($1, $3)", [conversa, P.ana, P.bia]);
const chamada = await rpc(como(P.ana), "chat_chamada_iniciar", { p_conversa: conversa, p_video: true });
const deps = { rpcComo, conferirDesafio: async () => "ok", limitar: () => ({ ok: true }) };
const decide = (quem, pedido) => E.decidirEntrada(pedido, quem ? P[quem] : null, deps);
{
  const r = (x) => JSON.stringify(x);
  confere("reunião de convidados: a convidada entra e assiste", r(await decide("ana", { origem: "reuniao", sala: salaConv.sala })) === r({ ok: true, papel: "assiste", video: null }));
  confere("reunião de convidados: quem não foi convidada é recusada (404)", (await decide("bia", { origem: "reuniao", sala: salaConv.sala })).status === 404);
  confere("reunião de convidados: a coordenação conduz", (await decide("coord", { origem: "reuniao", sala: salaConv.sala })).papel === "conduz");
  confere("reunião aberta: quem organiza conduz; outra pessoa da equipe assiste", (await decide("ana", { origem: "reuniao", sala: salaAberta })).papel === "conduz" && (await decide("caio", { origem: "reuniao", sala: salaAberta })).papel === "assiste");
  confere("reunião: quem não é da equipe é recusada", (await decide("visita", { origem: "reuniao", sala: salaAberta })).ok === false);
  confere("reunião: sem sessão, 401", (await decide(null, { origem: "reuniao", sala: salaAberta })).status === 401);
  confere("reunião encerrada: recusada", (await decide("coord", { origem: "reuniao", sala: salaEncerrada })).status === 404);
  confere("sala que não existe: recusada", (await decide("coord", { origem: "reuniao", sala: "InstitutoLucia-naoexiste000000" })).status === 404);
  confere("chamada de canal: quem está na conversa entra, com o vídeo dito pelo banco", r(await decide("bia", { origem: "reuniao", sala: chamada.sala })) === r({ ok: true, papel: "canal", video: true }));
  confere("chamada de canal: quem não está na conversa é recusada", (await decide("caio", { origem: "reuniao", sala: chamada.sala })).ok === false);
  // Turma do mês.
  const mes = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 7);
  await rpc(como(P.caio), "turma_mes_entrar", { p_mes: mes, p_entrar: true }).catch(() => null);
  const turma = await rpcComo(P.caio, "turma_mes", { p_mes: mes });
  if (turma?.sala) {
    confere("turma do mês: quem está nela entra", (await decide("caio", { origem: "turma-mes", sala: turma.sala, mes })).ok === true);
    confere("turma do mês: quem não está, não", (await decide("bia", { origem: "turma-mes", sala: turma.sala, mes })).ok === false);
  } else {
    confere("turma do mês: a sala nasce para quem entra", false, JSON.stringify(turma));
  }
  confere("turma: sala que não é a da turma é recusada", (await decide("caio", { origem: "turma-mes", sala: "InstitutoLucia-outra000000", mes })).ok === false);
  // Estudo em grupo (sem conta).
  let vezes = 0;
  const limitado = { ...deps, limitar: () => (++vezes > 2 ? { ok: false, tentarEm: 60 } : { ok: true }) };
  const est = { origem: "estudo", sala: "instituto-lucia-estudo-abc123def456ghi", desafio: "x" };
  confere("estudo: abre sem conta, sem moderar", r(await E.decidirEntrada(est, null, limitado)) === r({ ok: true, papel: "estudo", video: null }));
  await E.decidirEntrada(est, null, limitado);
  confere("estudo: passou do limite, 429", (await E.decidirEntrada(est, null, limitado)).status === 429);
  confere("estudo: desafio recusado, 403", (await E.decidirEntrada(est, null, { ...deps, conferirDesafio: async () => "recusado" })).status === 403);
  // Auditoria do P4 (B3): sem a chave do Turnstile no servidor ("sem_chave"), o estudo em grupo (que abre sem conta) dava o token do
  // LiveKit a qualquer robô, até o teto do dia. Agora só "ok" passa; qualquer outra resposta (inclusive uma desconhecida) recusa.
  const semChave = await E.decidirEntrada(est, null, { ...deps, conferirDesafio: async () => "sem_chave" });
  confere(`estudo: sem a chave do desafio no servidor, não entra (${JSON.stringify(semChave)})`, semChave.ok === false && semChave.status === 503);
  const estranho = await E.decidirEntrada(est, null, { ...deps, conferirDesafio: async () => "talvez" });
  confere("estudo: resposta desconhecida do desafio, não entra", estranho.ok === false);
}

// ═══════════════════ 4. A rota ═══════════════════
{
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://banco.teste";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "chave-anonima-de-teste";
  process.env.NEXT_PUBLIC_RECURSOS = "";
  const chamadas = [];
  const fetchDeVerdade = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    chamadas.push({ url: u, corpo: String(init.body ?? "") });
    if (u.endsWith("/rest/v1/rpc/recursos_lidos")) return Response.json({ ligados: ["sala-livekit"], desligados: [] });
    if (u.startsWith("https://challenges.cloudflare.com/")) return Response.json({ success: String(init.body ?? "").includes("aceita") });
    const m = /\/rest\/v1\/rpc\/([a-z_]+)$/.exec(u);
    if (m) {
      const sub = /^Bearer (.+)$/.exec(new Headers(init.headers).get("authorization") ?? "")?.[1];
      try {
        return Response.json(await rpc(como(sub), m[1], JSON.parse(String(init.body || "{}"))));
      } catch (e) {
        return Response.json({ message: e.message }, { status: 400 });
      }
    }
    return fetchDeVerdade(url, init);
  };
  const rota = await import("../app/api/sala/entrada/route.ts");
  const pedir = (corpo, quem, cab = {}) => rota.POST(new Request("http://site.teste/api/sala/entrada", { method: "POST", headers: { "Content-Type": "application/json", "cf-connecting-ip": "203.0.113.50", ...(quem ? { Authorization: `Bearer ${P[quem]}` } : {}), ...cab }, body: JSON.stringify(corpo) }));
  delete process.env.LIVEKIT_API_KEY;
  const sem = await pedir({ origem: "reuniao", sala: salaAberta }, "ana");
  confere("rota: sem a configuração do LiveKit, 503 'livekit_sem_config'", sem.status === 503 && (await sem.json()).erro === "livekit_sem_config");
  process.env.NEXT_PUBLIC_LIVEKIT_URL = "wss://projeto-teste.livekit.cloud";
  process.env.LIVEKIT_API_KEY = CFG.chave;
  process.env.LIVEKIT_API_SECRET = CFG.segredo;
  const ok = await pedir({ origem: "reuniao", sala: salaAberta }, "ana");
  const corpo = await ok.json();
  const lido = L.lerToken(corpo.token ?? "", CFG.segredo);
  confere("rota: quem organiza recebe o token da sala, conduzindo", ok.status === 200 && corpo.papel === "conduz" && corpo.url === "wss://projeto-teste.livekit.cloud" && lido?.video?.room === salaAberta && lido.video.roomAdmin === true, JSON.stringify(corpo));
  confere("rota: a resposta não guarda em cache nem leva a chave ou o segredo", ok.headers.get("cache-control")?.includes("no-store") && !JSON.stringify(corpo).includes(CFG.segredo) && !Object.values(corpo).includes(CFG.chave));
  confere("rota: a convidada que não foi convidada leva 404", (await pedir({ origem: "reuniao", sala: salaConv.sala }, "bia")).status === 404);
  confere("rota: o 'conduzo' do navegador não vale", (await (await pedir({ origem: "reuniao", sala: salaAberta, conduzo: true }, "caio")).json()).papel === "assiste");
  confere("rota: de outro site, 403", (await pedir({ origem: "reuniao", sala: salaAberta }, "ana", { "sec-fetch-site": "cross-site" })).status === 403);
  confere("rota: pedido fora do formato, 400", (await pedir({ origem: "reuniao", sala: "../x" }, "ana")).status === 400);
  const est = await pedir({ origem: "estudo", sala: "instituto-lucia-estudo-abc123def456ghi" }, null);
  confere("rota: estudo em grupo sem a chave do desafio no servidor não entra (503, sem token)", est.status === 503 && !("token" in ((await est.json()) ?? {})));
  process.env.TURNSTILE_SECRET_KEY = "segredo-do-desafio";
  const n = chamadas.length;
  const negado = await pedir({ origem: "estudo", sala: "instituto-lucia-estudo-abc123def456ghi", desafio: "resposta-de-teste-0123456789" }, null);
  confere("rota: com o desafio ligado e recusado pela Cloudflare, 403", negado.status === 403);
  const aceito = await pedir({ origem: "estudo", sala: "instituto-lucia-estudo-abc123def456ghi", desafio: "resposta-aceita-0123456789" }, null);
  confere("rota: com o desafio ligado e aceito, o estudo em grupo entra sem conta", aceito.status === 200 && (await aceito.json()).papel === "estudo");
  const aoDesafio = chamadas.slice(n).find((c) => c.url.startsWith("https://challenges.cloudflare.com/"));
  confere("rota: o endereço de rede não vai à Cloudflare (sem remoteip)", !!aoDesafio && !/remoteip|203\.0\.113\.50/.test(aoDesafio.corpo));
  delete process.env.TURNSTILE_SECRET_KEY;
  confere("rota: o endereço de rede nunca vai ao banco", chamadas.every((c) => !c.corpo.includes("203.0.113.50")));
  for (let i = 0; i < 40; i++) await pedir({ origem: "estudo", sala: "instituto-lucia-estudo-abc123def456ghi" }, null);
  confere("rota: o estudo em grupo tem limite de entradas por pessoa (429)", (await pedir({ origem: "estudo", sala: "instituto-lucia-estudo-abc123def456ghi" }, null)).status === 429);
  globalThis.fetch = fetchDeVerdade;
  const fonte = ler("app/api/sala/entrada/route.ts");
  confere("rota: não grava nada (sem escrita no banco, sem arquivo, sem registro de endereço)", !/rpcDeServico|insert|writeFile|console\.(log|info|warn|error)/.test(fonte) && /criarLimitador/.test(fonte));
  confere("rota: o interruptor é conferido no servidor antes de tudo", /if \(!\(await recursoLigado\("sala-livekit"\)\)\) return new Response\(null, \{ status: 404/.test(fonte));
}

// ═══════════════════ 5. Desligado: tudo pelo Jitsi ═══════════════════
{
  // Num processo à parte, com o interruptor desligado (a lista do painel vem vazia): a rota não existe.
  const roteiro = `
    globalThis.fetch = async (u) => String(u).endsWith("/rest/v1/rpc/recursos_lidos") ? Response.json({ ligados: [], desligados: ["sala-livekit"] }) : new Response(null, { status: 500 });
    const rota = await import(${JSON.stringify(new URL("../app/api/sala/entrada/route.ts", import.meta.url).href)});
    const r = await rota.POST(new Request("http://x/api/sala/entrada", { method: "POST", body: "{}" }));
    console.log(r.status);`;
  const saida = execFileSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "--import", "./scripts/carregar-ts.mjs", "--input-type=module", "-e", roteiro], { cwd: raiz, env: { ...process.env, NEXT_PUBLIC_RECURSOS: "todos", NEXT_PUBLIC_SUPABASE_URL: "http://banco.teste", NEXT_PUBLIC_SUPABASE_ANON_KEY: "x", LIVEKIT_API_KEY: "k1k", LIVEKIT_API_SECRET: "segredo", NEXT_PUBLIC_LIVEKIT_URL: "wss://x.livekit.cloud" }, encoding: "utf8" }).trim();
  confere("desligado (mesmo com 'todos'): a rota responde 404", saida.endsWith("404"), saida);
  const rec = ler("lib/recursos.ts");
  confere("interruptor: 'sala-livekit' é só pelo nome ('todos' não liga)", /"sala-livekit"\]/.test(rec.slice(rec.indexOf("export const SO_PELO_NOME"))));
  const sdv = ler("components/SalaDeVideo.tsx");
  confere("SalaDeVideo: desligado devolve a JitsiSala com as mesmas propriedades", /if \(!comLivekit\(\) \|\| noJitsi\) return <JitsiSala \{\.\.\.daJitsi\} \/>/.test(sdv) && /ligado\("sala-livekit"\)/.test(sdv));
  confere("SalaDeVideo: o LiveKit só é baixado ligado (import dinâmico)", /dynamic\(\(\) => import\("\.\/LivekitSala"\)/.test(sdv) && !/^import .*LivekitSala";?$/m.test(sdv.replace(/^import type .*$/gm, "")));
  for (const [arquivo, marca] of [["components/painel/Reunioes.tsx", "<SalaDeVideo sala={naSala.sala"], ["components/painel/Conversas.tsx", "<SalaDeVideo sala={chamada.sala"], ["components/EstudoEmGrupo.tsx", "<SalaDeVideo sala={`instituto-lucia-estudo-"]]) {
    const f = ler(arquivo);
    confere(`${arquivo}: chama a SalaDeVideo, não a JitsiSala direto`, f.includes(marca) && !f.includes("<JitsiSala"));
  }
  for (const [arquivo, origem] of [["components/TurmaDoMes.tsx", "turma-mes"], ["components/escola/turma/TurmaDoCurso.tsx", "turma-curso"]]) {
    const f = ler(arquivo);
    confere(`${arquivo}: o link do Jitsi fica igual desligado e abre dentro do site ligado`, f.includes("<SalaDaTurma") && f.includes(`origem: "${origem}"`) && f.includes("href={`https://${JITSI_DOMINIO}/${situacao.sala}`}"));
  }
  confere("SalaDaTurma: desligado, o mesmo link em outra aba", /if \(!comLivekit\(\)\) \{\s*return \(\s*<a href=\{href\} target="_blank" rel="noreferrer"/.test(sdv));
  const aovivo = ler("components/painel/AoVivo.tsx");
  confere("aulas ao vivo: só some a opção de criar sala NOVA no Jitsi (com o LiveKit ligado)", /\{!comLivekit\(\) && \(\s*<button type="button" aria-pressed=\{Boolean\(form\.sala_externa\) && !salaPropria\}/.test(aovivo));
  for (const f of ["components/aovivo/Sala.tsx", "lib/aovivo.ts", "lib/aula-sala.ts", "components/painel/podcast/Episodio.tsx"]) confere(`${f}: fica como está (não usa a sala nova)`, !/SalaDeVideo|LivekitSala|sala-livekit/.test(ler(f)));
  confere("a Alumia não usa a sala de vídeo", !fs.readdirSync(path.join(raiz, "components/rede"), { recursive: true }).filter((f) => /\.tsx?$/.test(f)).some((f) => /SalaDeVideo|LivekitSala/.test(ler(path.join("components/rede", f)))));
}

// ═══════════════════ 6. Chaves, página e textos ═══════════════════
{
  const doNavegador = ["components/LivekitSala.tsx", "components/SalaDeVideo.tsx", "lib/sala/textos.ts"].map(ler).join("\n");
  confere("nenhuma chave nem segredo no código do navegador", !/LIVEKIT_API_(KEY|SECRET)|lib\/sala\/livekit|node:crypto/.test(doNavegador));
  confere("o segredo só é lido no servidor (lib/sala/livekit.ts, com node:crypto)", /from "node:crypto"/.test(ler("lib/sala/livekit.ts")) && /LIVEKIT_API_SECRET/.test(ler("lib/sala/livekit.ts")));
  // O que o git tem (os arquivos novos ainda sem commit entram pelo --untracked).
  let achados = "";
  try {
    achados = execFileSync("git", ["grep", "-n", "--untracked", "-I", "-E", "LIVEKIT_API_(SECRET|KEY)[[:space:]]*[=:][[:space:]]*[\"']?[A-Za-z0-9]{12,}"], { cwd: raiz, encoding: "utf8" });
  } catch {
    achados = "";
  }
  const vazou = achados.split(/\r?\n/).filter(Boolean);
  confere("nenhum valor de segredo do LiveKit no repositório", vazou.length === 0, vazou.join(", "));
  const lk = ler("components/LivekitSala.tsx");
  confere("sala: o pedido de entrada vai sem cookie e com a sessão só no Authorization", /fetch\("\/api\/sala\/entrada", \{\s*method: "POST",\s*credentials: "omit"/.test(lk));
  confere("sala: sem gravação nem transmissão para fora, e a privacidade na tela", !/egress|startRecording|recorder|roomRecord/i.test(lk) && /t\.privacidade/.test(lk));
  confere("sala: quem assiste entra calada e sem câmera; quem conduz com tudo; no canal, a câmera só na de vídeo", /const falar = papel === "conduz" \|\| papel === "canal";/.test(lk) && /const camera = papel === "conduz" \|\| comVideo;/.test(lk));
  confere("sala: serviço fora do ar, o erro e o botão de abrir no Jitsi", /t\.acoes\.abrirNoJitsi/.test(lk) && /aoFalhar/.test(lk));
  confere("sala: o nome do painel é posto depois de entrar (o token não leva)", /setName\(dados\.current\.nome/.test(lk));
  confere("sala: alvos de toque de 44 px", /min-h-11 min-w-11/.test(lk));
  // A página: o connect-src com o endereço do projeto (só com a variável) e nada de quadro novo.
  const csp = (url) => execFileSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "--import", "./scripts/carregar-ts.mjs", "--input-type=module", "-e", `const c = (await import(${JSON.stringify(new URL("../next.config.ts", import.meta.url).href)})).default; const h = await c.headers(); const g = h.find((x) => x.source === "/:path*") ?? h[0]; console.log(JSON.stringify(g.headers.find((x) => x.key === "Content-Security-Policy")?.value ?? ""));`], { cwd: raiz, env: { ...process.env, NEXT_PUBLIC_LIVEKIT_URL: url }, encoding: "utf8" }).trim().split("\n").at(-1);
  const com = JSON.parse(csp("wss://projeto-teste.livekit.cloud"));
  const sem = JSON.parse(csp(""));
  const connect = (p) => p.split(";").find((x) => x.trim().startsWith("connect-src")) ?? "";
  const frame = (p) => p.split(";").find((x) => x.trim().startsWith("frame-src")) ?? "";
  confere("página: com a variável, o connect-src ganha só o projeto (wss e https)", connect(com).includes("wss://projeto-teste.livekit.cloud") && connect(com).includes("https://projeto-teste.livekit.cloud") && !connect(sem).includes("livekit"), connect(com));
  confere("página: nenhum quadro novo para o LiveKit", !frame(com).includes("livekit"));
  const priv = ler("content/paginas/privacidade.md");
  confere("privacidade: diz qual serviço, o que recebe, que não grava e o que fica no painel", /\*\*Salas de vídeo pelo LiveKit Cloud\.\*\*/.test(priv) && /endereço de rede, o nome que aparece na sala e o áudio e o vídeo/.test(priv) && /não têm cifra de ponta a ponta/.test(priv) && /no painel fica só quem entrou e quando/.test(priv.slice(priv.indexOf("LiveKit Cloud"))));
  confere("créditos e NOTICE: o LiveKit entra; o NOTICE não diz mais meet.jit.si como padrão", /LiveKit/.test(ler("content/paginas/creditos.md")) && ["en", "es", "ru", "zh"].every((l) => /LiveKit/.test(ler(`content/paginas/creditos.${l}.md`))) && /meet\.systemli\.org por padrão/.test(ler("docs/NOTICE.md")) && !/meet\.jit\.si por padrão/.test(ler("docs/NOTICE.md")));
  confere("montagem: NEXT_PUBLIC_LIVEKIT_URL repassada no producao.yml", (ler(".github/workflows/producao.yml").match(/NEXT_PUBLIC_LIVEKIT_URL/g) ?? []).length === 3);
  const chaves = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (k === "_rascunho" ? [] : v && typeof v === "object" ? chaves(v, `${p}${k}.`) : [`${p}${k}`])).sort().join();
  const pt = JSON.parse(ler("i18n/sala-livekit/pt.json"));
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const x = JSON.parse(ler(`i18n/sala-livekit/${l}.json`));
    confere(`textos: ${l} tem as chaves do português e é rascunho`, chaves(x) === chaves(pt) && x._rascunho === true);
  }
  confere("textos: cada erro da rota tem frase", ["livekit_sem_config", "nao_encontrado", "sem_sessao", "limite", "desafio", "conexao", "outro"].every((k) => typeof pt.erros[k] === "string"));
}

// ═══════════════════ 7. Contra um LiveKit de verdade (opcional) ═══════════════════
const LK = process.env.ALUMIA_LIVEKIT_TESTE ?? "";
if (LK) {
  const dev = { chave: process.env.ALUMIA_LIVEKIT_TESTE_CHAVE ?? "devkey", segredo: process.env.ALUMIA_LIVEKIT_TESTE_SEGREDO ?? "secret" };
  const sala = "InstitutoLucia-teste-livekit-local";
  const validar = async (token) => (await fetch(`${LK}/rtc/validate?access_token=${encodeURIComponent(token)}&auto_subscribe=1&protocol=15`)).status;
  const assiste = L.tokenDaSala(dev, sala, "assiste").token;
  const conduz = L.tokenDaSala(dev, sala, "conduz").token;
  confere("LiveKit de verdade: aceita o token de quem assiste", (await validar(assiste)) === 200);
  confere("LiveKit de verdade: aceita o token de quem conduz", (await validar(conduz)) === 200);
  confere("LiveKit de verdade: recusa o token assinado com outro segredo", (await validar(L.tokenDaSala({ ...dev, segredo: "outro-segredo" }, sala, "assiste").token)) === 401);
  const vencido = L.tokenDaSala(dev, sala, "assiste", Date.now() - 3 * 3600_000).token;
  confere("LiveKit de verdade: recusa o token vencido", (await validar(vencido)) === 401);
  const moderar = async (token) => (await fetch(`${LK}/twirp/livekit.RoomService/ListParticipants`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ room: sala }) })).status;
  const sConduz = await moderar(conduz);
  const sAssiste = await moderar(assiste);
  confere("LiveKit de verdade: só quem conduz modera a sala (a de quem assiste é recusada)", sConduz === 200 && sAssiste >= 400, `${sConduz} / ${sAssiste}`);
  const outraSala = L.tokenDaSala(dev, "InstitutoLucia-outra-sala-teste", "conduz").token;
  confere("LiveKit de verdade: quem conduz uma sala não modera outra", (await moderar(outraSala)) >= 400);
  console.log(`(conferido contra o LiveKit em ${LK})`);
} else {
  console.log("(sem ALUMIA_LIVEKIT_TESTE: a parte contra um LiveKit de verdade não rodou)");
}

console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
