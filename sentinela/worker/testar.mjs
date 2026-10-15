// Sentinela Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later.
//
// Prova as partes puras do coletor, sem rede: normalização do HTML, terceiros, nota dos cabeçalhos, regras de alerta,
// índice de postura, domínios parecidos, leitura dos relatos de CSP e montagem das métricas da Cloudflare.
// Uso: npm run testar:worker
import { normalizar, notaDosCabecalhos, terceirosDe, eventoDeMudanca } from "./src/coletores/site.ts";
import { montar, gravidadeDoWaf } from "./src/coletores/cloudflare.ts";
import { parecidos, faltasDoDns, emissorDe } from "./src/coletores/integridade.ts";
import { deployDe } from "./src/coletores/plataformas.ts";
import { avaliar, postura } from "./src/regras.ts";
import { textoDoAviso } from "./src/email.ts";
import { lerRelatos } from "./src/index.ts";
import { ISCA } from "./src/util.ts";

let certos = 0;
const falhas = [];
async function confere(nome, fazer) {
  try {
    const r = await fazer();
    if (!r) throw new Error("não confere");
    certos++;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
  }
}

// ── Site ──
const html1 = `<html><head><script src="/_next/static/abc123/chunk.js"></script><script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script><link href="/_next/static/abc123/x.css"><script>self.__next_f.push([1,"x"])</script></head><body><p>Olá</p><img src="https://evil.example/pixel.gif"></body></html>`;
const html2 = html1.replace(/abc123/g, "def456").replace('self.__next_f.push([1,"x"])', 'self.__next_f.push([1,"y"])');
await confere("deploy novo não muda a impressão da página", () => normalizar(html1) === normalizar(html2));
await confere("conteúdo novo muda a impressão", () => normalizar(html1) !== normalizar(html1.replace("Olá", "Hackeado")));
const t = terceirosDe(html1, "/", "institutolucia.org");
await confere("terceiros: acha o desafio e o pixel, ignora o próprio site", () => t.length === 2 && t.some((x) => x.host === "challenges.cloudflare.com" && x.tipo === "script") && t.some((x) => x.host === "evil.example" && x.tipo === "img"));
await confere("terceiros: subdomínio do site não conta", () => terceirosDe('<img src="https://cdn.institutolucia.org/a.png">', "/", "institutolucia.org").length === 0);
const bons = { "strict-transport-security": "max-age=63072000; includeSubDomains", "content-security-policy": "default-src 'self'; frame-ancestors 'none'; object-src 'none'", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "referrer-policy": "strict-origin-when-cross-origin", "permissions-policy": "camera=()", "cross-origin-opener-policy": "same-origin", "cross-origin-resource-policy": "same-origin" };
await confere("cabeçalhos do site valem 100", () => notaDosCabecalhos(bons).nota === 100 && notaDosCabecalhos(bons).faltas.length === 0);
await confere("sem nada vale 0 e lista o que falta", () => notaDosCabecalhos({}).nota === 0 && notaDosCabecalhos({}).faltas.includes("sem HSTS"));
await confere("X-Powered-By desconta", () => notaDosCabecalhos({ ...bons, "x-powered-by": "Next.js" }).nota === 95);
await confere("mudança sem deploy é evento alto; com deploy é informativo", async () => (await eventoDeMudanca("site", "/", "a", "b", false))?.gravidade === "alta" && (await eventoDeMudanca("site", "/", "a", "b", true))?.gravidade === "info" && (await eventoDeMudanca("site", "/", "a", "a", false)) === null);

// ── Cloudflare ──
const brutos = [
  { action: "block", clientIP: "203.0.113.9", clientCountryName: "BR", clientASNDescription: "Exemplo", clientAsn: "64500", clientRequestPath: "/wp-admin/setup.php", userAgent: "x", ruleId: "r1", source: "waf", datetime: "2026-10-15T12:03:10Z", rayName: "ray1" },
  { action: "managed_challenge", clientIP: "198.51.100.7", clientCountryName: "US", clientASNDescription: "Y", clientAsn: "1", clientRequestPath: "/pt/entrar", userAgent: "x", ruleId: "r2", source: "firewallManaged", datetime: "2026-10-15T12:04:00Z", rayName: "ray2" },
];
const grupos = [{ count: 100, sum: { edgeResponseBytes: 5000 }, dimensions: { datetimeFiveMinutes: "2026-10-15T12:00:00Z", clientCountryName: "BR", edgeResponseStatus: 200 } }, { count: 7, sum: { edgeResponseBytes: 10 }, dimensions: { datetimeFiveMinutes: "2026-10-15T12:00:00Z", clientCountryName: "US", edgeResponseStatus: 404 } }];
const cf = await montar(grupos, brutos);
await confere("métricas por janela de 5 min", () => cf.metricas.length === 1 && cf.metricas[0].em === "2026-10-15T12:00:00Z" && cf.metricas[0].requisicoes === 107 && cf.metricas[0].bloqueios === 1 && cf.metricas[0].desafios === 1 && cf.metricas[0].por_pais.BR === 100 && cf.metricas[0].por_status["404"] === 7);
await confere("evento em caminho-isca vira 'isca', os outros 'waf'", () => cf.eventos[0].fonte === "isca" && cf.eventos[1].fonte === "waf" && cf.eventos[0].impressao === "cf:ray1" && cf.eventos[0].asn === "AS64500");
await confere("gravidade do WAF", () => gravidadeDoWaf(brutos[0]) === "media" && gravidadeDoWaf(brutos[1]) === "baixa");
await confere("lista de iscas é a do site", () => ISCA.test("/.env") && ISCA.test("/wp-login.php") && ISCA.test("/backup.sql") && !ISCA.test("/pt/trilhas") && !ISCA.test("/arquivos/x.pdf"));

// ── Integridade ──
const p = parecidos("institutolucia.org");
await confere("domínios parecidos: terminações, hífen, trocas", () => p.includes("institutolucia.com") && p.includes("instituto-lucia.org") && p.includes("institutolucla.org") && p.includes("institutolucia.com.br") && !p.includes("institutolucia.org") && p.length <= 120 && p.every((d) => /^[a-z0-9-]+(\.[a-z]+)+$/.test(d)));
await confere("faltas do DNS", () => {
  const f = faltasDoDns([{ nome: "x.org", tipo: "TXT", valores: ["v=spf1 include:_spf.resend.com ~all"] }, { nome: "_dmarc.x.org", tipo: "TXT", valores: ["v=DMARC1; p=none"] }]);
  return f.some((x) => /CAA/.test(x)) && f.some((x) => /p=none/.test(x)) && f.some((x) => /-all/.test(x));
});
await confere("DNS completo não tem faltas", () => faltasDoDns([{ nome: "x.org", tipo: "CAA", valores: ['0 issue "letsencrypt.org"'] }, { nome: "x.org", tipo: "TXT", valores: ["v=spf1 -all"] }, { nome: "_dmarc.x.org", tipo: "TXT", valores: ["v=DMARC1; p=reject"] }]).length === 0);
await confere("emissor do certificado", () => emissorDe("C=US, O=Let's Encrypt, CN=R11") === "Let's Encrypt" && emissorDe("C=US, O=Google Trust Services, CN=WE1") === "Google Trust Services");
await confere("deploy da Vercel", () => { const d = deployDe({ uid: "dpl_1", readyState: "READY", target: "production", url: "x.vercel.app", created: 1760000000000, meta: { githubCommitRef: "master", githubCommitSha: "abcdef1234567890", githubCommitMessage: "m", githubCommitAuthorLogin: "jojo" } }); return d.estado === "READY" && d.ramo === "master" && d.commit === "abcdef123456" && d.url === "https://x.vercel.app"; });

// ── Regras ──
const regras = ["site_fora", "site_lento", "pico_bloqueios", "pico_requisicoes", "logins_falhos", "pagina_mudou", "dns_mudou", "certificado_novo", "terceiro_novo", "dominio_parecido", "deploy_falhou", "deploy_desconhecido", "github_alerta", "supabase_fora", "cabecalho_sumiu", "csp_violacoes", "isca_pico", "reputacao_ruim", "assetlinks_mudou"];
const config = (extra = {}) => ({
  configuracoes: { site: { url: "https://institutolucia.org", terceiros_permitidos: ["challenges.cloudflare.com"] } },
  regras: regras.map((id) => ({ id, ligada: true, gravidade: "alta", parametros: id === "logins_falhos" ? { maximo_10min: 3 } : id === "pico_bloqueios" ? { vezes_mediana: 5, minimo: 10 } : id === "github_alerta" ? { minimo: "high" } : {} })),
  terceiros_conhecidos: [], certificados_conhecidos: [], dominios: {}, dns_atual: [], ultimo_hash: { "pagina:/.well-known/assetlinks.json": "h1" }, ultimo_deploy_em: null,
  verificacoes_recentes: [{ alvo: "site", no_ar: false, ms: 100, em: "2026-10-15T11:55:00Z" }, { alvo: "site", no_ar: true, ms: 100, em: "2026-10-15T11:50:00Z" }],
  mediana_bloqueios: 2, mediana_requisicoes: 100, ultima_metrica: null, ultimo_evento_waf: null, ultimo_evento_auth: null, deploys_conhecidos: [], github_conhecidos: {}, alertas_recentes: [],
  ...extra,
});
const vazio = () => ({ verificacoes: [], metricas: [], eventos: [], dnsMudancas: [], certificadosNovos: [], terceirosNovos: [], dominiosNovos: [], deploysMudaram: [], githubNovos: [], cspNovas: 0 });
await confere("site fora em duas coletas seguidas alerta; em uma só, não", () => {
  const a = avaliar(config(), { ...vazio(), verificacoes: [{ alvo: "site", no_ar: false, erro: "sem resposta" }] });
  const b = avaliar(config({ verificacoes_recentes: [{ alvo: "site", no_ar: true, ms: 100, em: "2026-10-15T11:55:00Z" }] }), { ...vazio(), verificacoes: [{ alvo: "site", no_ar: false, erro: "sem resposta" }] });
  return a.some((x) => x.regra === "site_fora" && x.impressao === "site_fora") && !b.some((x) => x.regra === "site_fora");
});
await confere("regra desligada não alerta", () => !avaliar(config({ regras: [] }), { ...vazio(), verificacoes: [{ alvo: "site", no_ar: false }] }).length);
await confere("pico de bloqueios respeita mínimo e mediana", () => {
  const a = avaliar(config(), { ...vazio(), metricas: [{ em: "x", requisicoes: 50, bloqueios: 12, desafios: 0 }] });
  const b = avaliar(config(), { ...vazio(), metricas: [{ em: "x", requisicoes: 50, bloqueios: 9, desafios: 0 }] });
  return a.some((x) => x.regra === "pico_bloqueios") && !b.some((x) => x.regra === "pico_bloqueios");
});
await confere("logins falhos acima do limite", () => avaliar(config(), { ...vazio(), eventos: [1, 2, 3].map((i) => ({ fonte: "auth", tipo: "login_falho", gravidade: "baixa", ip: `1.1.1.${i}`, impressao: `a${i}` })) }).some((x) => x.regra === "logins_falhos" && /3 origem/.test(x.resumo)));
await confere("página mudou sem deploy alerta; com deploy não", () => {
  const sem = avaliar(config(), { ...vazio(), eventos: [{ fonte: "pagina", tipo: "mudou_sem_deploy", gravidade: "alta", caminho: "/", impressao: "p1" }] });
  const com = avaliar(config(), { ...vazio(), eventos: [{ fonte: "pagina", tipo: "mudou_com_deploy", gravidade: "info", caminho: "/", impressao: "p2" }] });
  return sem.some((x) => x.regra === "pagina_mudou") && !com.some((x) => x.regra === "pagina_mudou");
});
await confere("DNS, certificado estranho, terceiro fora da lista, domínio parecido", () => {
  const a = avaliar(config(), { ...vazio(), dnsMudancas: [{ nome: "x.org", tipo: "A", de: ["1.1.1.1"], para: ["2.2.2.2"] }], certificadosNovos: [{ crt_id: 1, emissor: "Desconhecida CA", nomes: ["x.org"], conhecido: false }, { crt_id: 2, emissor: "Let's Encrypt", nomes: ["x.org"], conhecido: true }], terceirosNovos: [{ pagina: "/", tipo: "script", host: "evil.example" }, { pagina: "/", tipo: "script", host: "challenges.cloudflare.com" }], dominiosNovos: [{ dominio: "institutolucia.com", resolve: true, registros: { A: ["9.9.9.9"], MX: ["mx"] } }] });
  const r = (id) => a.filter((x) => x.regra === id).length;
  return r("dns_mudou") === 1 && r("certificado_novo") === 1 && r("terceiro_novo") === 1 && r("dominio_parecido") === 1 && a.find((x) => x.regra === "dominio_parecido").resumo.includes("recebe e-mail");
});
await confere("deploy falhou e deploy fora do ramo principal", () => {
  const a = avaliar(config(), { ...vazio(), deploysMudaram: [{ id: "1", estado: "ERROR", ambiente: "production", ramo: "master", mensagem: "m" }, { id: "2", estado: "READY", ambiente: "production", ramo: "feature-x", mensagem: "m" }, { id: "3", estado: "READY", ambiente: "production", ramo: "master", mensagem: "m" }] });
  return a.filter((x) => x.regra === "deploy_falhou").length === 1 && a.filter((x) => x.regra === "deploy_desconhecido").length === 1;
});
await confere("GitHub: só a partir do mínimo, segredo sempre e crítico", () => {
  const a = avaliar(config(), { ...vazio(), githubNovos: [{ id: "dependabot:1", tipo: "dependabot", gravidade: "low", titulo: "x" }, { id: "dependabot:2", tipo: "dependabot", gravidade: "high", titulo: "y" }, { id: "segredo:1", tipo: "segredo", gravidade: "", titulo: "chave" }] });
  return a.filter((x) => x.regra === "github_alerta").length === 2 && a.find((x) => x.titulo.includes("segredo")).gravidade === "critica";
});
await confere("cabeçalho sumiu e assetlinks", () => {
  const a = avaliar(config(), { ...vazio(), eventos: [{ fonte: "cabecalho", tipo: "sumiu", gravidade: "alta", detalhes: { cabecalho: "strict-transport-security" }, impressao: "c1" }], verificacoes: [{ alvo: "pagina:/.well-known/assetlinks.json", no_ar: true, hash: "h2" }] });
  const b = avaliar(config(), { ...vazio(), verificacoes: [{ alvo: "pagina:/.well-known/assetlinks.json", no_ar: false, status: 404 }] });
  return a.some((x) => x.regra === "cabecalho_sumiu") && a.some((x) => x.regra === "assetlinks_mudou" && /mudou/.test(x.titulo)) && b.some((x) => x.regra === "assetlinks_mudou" && /sumiu/.test(x.titulo));
});
await confere("enxurrada vira no máximo 20 alertas", () => avaliar(config(), { ...vazio(), dnsMudancas: Array.from({ length: 30 }, (_, i) => ({ nome: `n${i}.org`, tipo: "A", de: [], para: ["1.1.1.1"] })) }).length === 20);

// ── Postura ──
const pos = postura({ cabecalhos: bons, dns: [{ nome: "x.org", tipo: "CAA", valores: ["0 issue x"] }, { nome: "x.org", tipo: "TXT", valores: ["v=spf1 -all"] }, { nome: "_dmarc.x.org", tipo: "TXT", valores: ["v=DMARC1; p=reject"] }], certificados: [{ crt_id: 1, emissor: "Let's Encrypt", conhecido: true, nao_depois: new Date(Date.now() + 60 * 86400000).toISOString() }], supabaseNoAr: true, githubAbertos: [], alertasCriticos: 0, ultimoDeployOk: true, segundoFatorTodos: true });
await confere("postura perfeita vale 100", () => pos.nota === 100 && pos.componentes.every((c) => c.pontos === c.maximo));
const ruim = postura({ cabecalhos: {}, dns: [], certificados: [{ crt_id: 1, emissor: "X", conhecido: false, nao_depois: new Date(Date.now() + 86400000).toISOString() }], supabaseNoAr: false, githubAbertos: [{ id: "a", tipo: "segredo", gravidade: "", titulo: "x" }], alertasCriticos: 2, ultimoDeployOk: false, segundoFatorTodos: false });
await confere("postura ruim é baixa e explica", () => ruim.nota <= 25 && ruim.componentes.find((c) => c.nome === "Certificados").faltas.length >= 1 && ruim.componentes.some((c) => c.faltas.includes("fora do ar")));

// ── E-mail e CSP ──
const aviso = textoDoAviso({ regra: "site_fora", gravidade: "critica", titulo: "O site caiu em 203.0.113.9", resumo: "detalhe sensível", impressao: "x" }, "https://app.exemplo");
await confere("aviso por e-mail não leva título nem detalhe", () => !aviso.texto.includes("203.0.113.9") && !aviso.texto.includes("detalhe sensível") && /CRÍTICA/.test(aviso.assunto) && aviso.texto.includes("https://app.exemplo"));
await confere("relatos de CSP nos dois formatos", () => {
  const antigo = lerRelatos({ "csp-report": { "document-uri": "https://institutolucia.org/pt?x=1", "effective-directive": "script-src", "blocked-uri": "https://evil.example/x.js" } });
  const novo = lerRelatos([{ type: "csp-violation", url: "https://institutolucia.org/pt/entrar", body: { effectiveDirective: "img-src", blockedURL: "https://evil.example/p.gif" } }]);
  return antigo.length === 1 && antigo[0].documento === "https://institutolucia.org/pt" && antigo[0].diretiva === "script-src" && novo.length === 1 && novo[0].diretiva === "img-src" && lerRelatos("lixo").length === 0 && lerRelatos([{ type: "outro" }]).length === 0;
});

console.log(`${certos} conferências certas, ${falhas.length} com problema.`);
for (const falha of falhas) console.log(`  ✗ ${falha}`);
process.exit(falhas.length ? 1 : 0);
