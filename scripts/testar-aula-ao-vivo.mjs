// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a aula ao vivo (Etapa 9, B31), sem rede: o token de entrada na sala própria (JWT HS256 conferido com node:crypto,
// de forma independente do código do site), a escolha da sala, a classificação dos links (sala própria, PeerTube, YouTube,
// Meet), o tocador PeerTube sem P2P, a segurança da rota e os arquivos de infra/aula-ao-vivo/. Uso: npm run testar:aula-ao-vivo
import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { assinarJwt, configDaSala, embedPeerTube, entradaNaSala, ehGoogleMeet, grupoDaAula, GRUPOS_PADRAO, idDoYoutube, nomeNaSala, origemDoGalene, salaPropriaPronta, tipoDeLink, videoPeerTube, VALIDADE_DO_TOKEN_S } from "../lib/aula-sala.ts";

let certos = 0;
const falhas = [];
async function espera(nome, conferir) {
  try {
    if (!(await conferir())) throw new Error("resultado inesperado");
    certos++;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
  }
}
const ler = (...p) => readFileSync(path.join(process.cwd(), ...p), "utf8");

const CHAVE = Buffer.from("0123456789abcdef0123456789abcdef").toString("base64url");
const config = configDaSala({ NEXT_PUBLIC_GALENE_URL: "https://aula.institutolucia.org/", GALENE_JWT_KEY: CHAVE });
const AULA = "11111111-1111-1111-1111-111111111111";

// ---- configuração
await espera("endereço do Galène: só https com domínio (sem barra no fim)", () => origemDoGalene("https://aula.institutolucia.org/") === "https://aula.institutolucia.org");
await espera("endereço http, sem protocolo ou com lixo não vale", () => !origemDoGalene("http://aula.institutolucia.org") && !origemDoGalene("aula.institutolucia.org") && !origemDoGalene("javascript:alert(1)") && !origemDoGalene(""));
await espera("sem variáveis, a sala própria fica desligada (plano B)", () => !salaPropriaPronta(configDaSala({})) && configDaSala({}).url === "");
await espera("chave curta demais não liga a sala", () => !salaPropriaPronta(configDaSala({ NEXT_PUBLIC_GALENE_URL: "https://aula.institutolucia.org", GALENE_JWT_KEY: "curta" })));
await espera("com endereço e chave, a sala própria liga", () => salaPropriaPronta(config));
await espera("grupos e permissão do aluno têm padrão", () => config.grupos.join() === GRUPOS_PADRAO.join() && config.permissoesAluno.join() === "message");
await espera("grupos vêm da variável e descartam nomes ruins", () => configDaSala({ GALENE_GRUPOS: "sala-1, sala-2,../x,SALA" }).grupos.join() === "sala-1,sala-2");

// ---- token de entrada
const agora = Date.UTC(2026, 10, 4, 12, 0, 0);
const professor = await entradaNaSala({ aula: AULA, conduz: true, nome: "Profa. Lúcia", agora, site: "https://institutolucia.org" }, config);
const aluno = await entradaNaSala({ aula: AULA, conduz: false, nome: "Lia <script>", agora }, config);
const partes = (url) => new URL(url).searchParams.get("token").split(".");
const claims = (url) => JSON.parse(Buffer.from(partes(url)[1], "base64url").toString());
await espera("o endereço de entrada é do grupo da aula, com token", () => professor.url.startsWith(`https://aula.institutolucia.org/group/${professor.grupo}/?token=`) && GRUPOS_PADRAO.includes(professor.grupo));
await espera("a assinatura HS256 confere com a chave (verificação independente)", () => {
  const [c, p, a] = partes(professor.url);
  return createHmac("sha256", Buffer.from(CHAVE, "base64url")).update(`${c}.${p}`).digest("base64url") === a;
});
await espera("o cabeçalho é HS256/JWT", () => JSON.parse(Buffer.from(partes(professor.url)[0], "base64url").toString()).alg === "HS256");
await espera("outra chave não confere", () => {
  const [c, p, a] = partes(professor.url);
  return createHmac("sha256", Buffer.from("outra-chave-outra-chave-outra-chave-1"))
    .update(`${c}.${p}`).digest("base64url") !== a;
});
await espera("quem conduz entra com op, present e record", () => ["op", "present", "record"].every((x) => claims(professor.url).permissions.includes(x)));
await espera("quem assiste só tem o chat: nada de present, op nem record", () => {
  const perm = claims(aluno.url).permissions;
  return perm.join() === "message" && !perm.includes("present") && !perm.includes("record") && !perm.includes("op");
});
await espera("aud é o endereço do grupo", () => claims(professor.url).aud === `https://aula.institutolucia.org/group/${professor.grupo}/`);
await espera("o token vale poucos segundos", () => claims(professor.url).exp - claims(professor.url).iat === VALIDADE_DO_TOKEN_S && VALIDADE_DO_TOKEN_S <= 120 && claims(professor.url).iat === agora / 1000);
await espera("o nome vai limpo (sem marcação) e tem teto", () => claims(aluno.url).sub === "Lia script" && nomeNaSala("x".repeat(100)).length === 40 && nomeNaSala("") === "Participante" && nomeNaSala(undefined) === "Participante");
await espera("sem sala própria configurada, entrar falha (cai no plano B)", async () => {
  try {
    await entradaNaSala({ aula: AULA, conduz: true }, configDaSala({}));
    return false;
  } catch (e) {
    return e.message === "sala_propria_desligada";
  }
});
await espera("chave inválida não assina", async () => {
  try {
    await assinarJwt({ a: 1 }, "curta");
    return false;
  } catch {
    return true;
  }
});

// ---- grupo da aula
await espera("a mesma aula cai sempre no mesmo grupo", () => grupoDaAula(AULA, GRUPOS_PADRAO) === grupoDaAula(AULA, GRUPOS_PADRAO));
await espera("aulas diferentes se espalham pelos grupos", () => {
  const usados = new Set();
  for (let i = 0; i < 40; i++) usados.add(grupoDaAula(`aula-${i}-${i * 7919}`, GRUPOS_PADRAO));
  return usados.size === GRUPOS_PADRAO.length;
});

// ---- links
const dominio = ["tv.institutolucia.org"];
const c = { galene: "https://aula.institutolucia.org", peertube: dominio };
const PT = "https://tv.institutolucia.org/w/9Gcd6mXJd3ZfPTs3CoFGJt";
await espera("origem do Galène é a sala própria", () => tipoDeLink("https://aula.institutolucia.org/", c) === "propria");
await espera("PeerTube só no domínio da lista (/w/ e /videos/watch/)", () => tipoDeLink(PT, c) === "peertube" && tipoDeLink("https://tv.institutolucia.org/videos/watch/52a10666-3a18-4e73-93da-e8d3c12c305a", c) === "peertube" && tipoDeLink("https://outro.example.org/w/9Gcd6mXJd3ZfPTs3CoFGJt", c) === "outro");
await espera("PeerTube: caminho estranho ou http não embute", () => !videoPeerTube("https://tv.institutolucia.org/w/../admin", dominio) && !videoPeerTube("http://tv.institutolucia.org/w/9Gcd6mXJd3ZfPTs3CoFGJt", dominio) && !videoPeerTube("https://tv.institutolucia.org/w/a/b", dominio));
await espera("o tocador PeerTube entra sem P2P e autoplay só depois do clique", () => {
  const url = embedPeerTube(videoPeerTube(PT, dominio));
  return url.startsWith("https://tv.institutolucia.org/videos/embed/9Gcd6mXJd3ZfPTs3CoFGJt?") && url.includes("p2p=0") && url.includes("autoplay=1");
});
await espera("YouTube em três formas", () => idDoYoutube("https://www.youtube.com/watch?v=dQw4w9WgXcQ") === "dQw4w9WgXcQ" && idDoYoutube("https://youtu.be/dQw4w9WgXcQ") === "dQw4w9WgXcQ" && idDoYoutube("https://www.youtube.com/live/dQw4w9WgXcQ") === "dQw4w9WgXcQ" && idDoYoutube("https://www.youtube.com/watch?v=curto") === null);
await espera("Google Meet é só link", () => ehGoogleMeet("https://meet.google.com/abc-defg-hij") && !ehGoogleMeet("https://meet.google.com.evil.org/abc-defg-hij") && tipoDeLink("https://meet.google.com/abc-defg-hij", c) === "meet");
await espera("sem endereço: nenhum; http: outro", () => tipoDeLink("", c) === "nenhum" && tipoDeLink("http://meet.google.com/abc-defg-hij", c) === "outro");

// ---- a rota e a tela
const rota = ler("app", "api", "aula-ao-vivo", "entrada", "route.ts");
await espera("a rota confere no banco quem conduz, com a sessão da pessoa", () => rota.includes('"aula_ao_vivo_ver"') && rota.includes("conduzo === true") && rota.includes("bearer"));
await espera("a rota só serve aula marcada com a sala própria e no estado certo", () => rota.includes("config.url") && rota.includes('"ao_vivo"') && rota.includes("outra_sala"));
await espera("a rota não guarda resposta nem expõe a chave", () => rota.includes("no-store") && !rota.includes("console.") && !/chave\s*[:,]/.test(rota.split("Response.json").slice(1).join("")));
const telas = ["components/aovivo/SalaPropria.tsx", "components/aovivo/TocadorPeerTube.tsx", "components/aovivo/Sala.tsx", "components/painel/AoVivo.tsx"].map((f) => ler(...f.split("/")));
await espera("a chave secreta nunca aparece no navegador", () => telas.every((t) => !t.includes("GALENE_JWT_KEY") && !t.includes("configDaSala")));
await espera("nada do PeerTube carrega antes do clique", () => {
  const t = ler("components", "aovivo", "TocadorPeerTube.tsx");
  return t.includes("useState(false)") && t.indexOf("<iframe") > t.indexOf("carregado ?") && t.includes("sandbox=");
});
await espera("a sala própria pede câmera e microfone só ao quadro dela, e o next.config a libera", () => {
  const n = ler("next.config.ts");
  return n.includes("GALENE_URL") && /frame-src[^\n]*\$\{galene\}/.test(n) && n.includes("jitsiPermitidos");
});
await espera("o painel só oferece a sala do instituto com o servidor configurado", () => /GALENE_URL && \(\s*<button/.test(telas[3]));

// ---- infra
const infra = (n) => path.join("infra", "aula-ao-vivo", n);
for (const f of ["Dockerfile", "docker-compose.yml", "Caddyfile", ".env.exemplo", "preparar.sh", "listar-gravacoes.sh", "LEIA-ME.md", ".gitignore"]) await espera(`infra/aula-ao-vivo/${f} existe`, () => existsSync(path.join(process.cwd(), infra(f))));
const compose = ler("infra", "aula-ao-vivo", "docker-compose.yml");
await espera("o compose usa a rede do servidor, a porta UDP de vídeo e o TURN com o IP público", () => compose.includes("network_mode: host") && compose.includes('"10000"') && compose.includes("${IP_PUBLICO}:1194"));
await espera("o Galène é compilado numa versão fixa", () => /ARG GALENE_REF=galene-\d+\.\d+/.test(ler("infra", "aula-ao-vivo", "Dockerfile")));
const preparar = ler("infra", "aula-ao-vivo", "preparar.sh");
await espera("o script cria os grupos com authKeys HS256 e só com token (sem senha)", () => preparar.includes('"alg": "HS256"') && preparar.includes("authKeys") && !preparar.includes('"password"') && preparar.includes("allow-recording"));
await espera("o .env com a chave não vai para o Git", () => ler("infra", "aula-ao-vivo", ".gitignore").split("\n").includes(".env") && !ler("infra", "aula-ao-vivo", ".env.exemplo").match(/GALENE_JWT_KEY=\S/));
await espera("o passo a passo avisa do IP público e das portas", () => {
  const l = ler("infra", "aula-ao-vivo", "LEIA-ME.md");
  return l.includes("IP público") && l.includes("10000") && l.includes("1194") && l.includes("nuvem cinza") && l.includes("Plano B");
});
await espera("a decisão está registrada com fontes", () => {
  const n = ler("docs", "plano-2026-11", "notas", "aula-ao-vivo.md");
  return n.includes("Galène") && n.includes("Jibri") && n.includes("BigBlueButton") && n.includes("LiveKit") && n.includes("https://galene.org") && n.includes("LGPD");
});

// ---- palavras proibidas na interface
const novos = [...telas, rota, ler("lib", "aula-sala.ts"), ler("infra", "aula-ao-vivo", "LEIA-ME.md")].join("\n");
await espera('nenhum texto novo usa "universidade" nem "diploma"', () => !/universidade|diploma/i.test(novos));

console.log(`aula ao vivo: ${certos} conferências certas, ${falhas.length} falhas.`);
if (falhas.length) {
  for (const f of falhas) console.error(" - " + f);
  process.exit(1);
}
