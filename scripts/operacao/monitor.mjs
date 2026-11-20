// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O monitor da Alumia (rotina .github/workflows/monitor.yml): confere o site e a Alumia de fora, como uma visita faria, e diz o
// que está errado. Não entra em conta nenhuma, não lê dado de pessoa e o relatório não leva endereço de rede nem e-mail.
//
//   1. GET <site>/api/saude: o site responde, a versão do banco da Alumia é a que o código espera, as filas andam (e-mails,
//      posts agendados, faxina de mídia). Interditado pela coordenação (503 "area_interditada") não é alarme: é decisão da casa.
//   2. GET <alumia>: a página da Alumia abre (segue redirecionamentos; 2xx ou 3xx final vale).
//
// Uso: SITE_URL=https://institutolucia.org ALUMIA_URL=https://alumia.institutolucia.org node scripts/operacao/monitor.mjs
// Saída: o relatório em texto (e no resumo da rotina, quando roda no GitHub) e, no GitHub, as saídas "falhou" (sim/nao) e
// "estado" (ok/falha/interditado). O arquivo monitor-relatorio.md fica para o passo que abre a issue.
import fs from "node:fs";
import { pathToFileURL } from "node:url";

/** Busca com prazo. Devolve {status, json?, desafio?, erro?}; status 0 quando nem respondeu. */
async function buscar(url, { json = false, prazo = 15_000 } = {}) {
  try {
    const r = await fetch(url, { redirect: "follow", headers: { "User-Agent": "MonitorAlumia/1.0", Accept: json ? "application/json" : "text/html" }, signal: AbortSignal.timeout(prazo) });
    let corpo;
    if (json) corpo = await r.json().catch(() => undefined);
    else await r.arrayBuffer().catch(() => undefined);
    // A Cloudflare responde 403 com "cf-mitigated: challenge" ao desafio de robôs (até para um User-Agent de navegador:
    // sem JavaScript, nenhum buscador simples passa). A borda respondendo não é queda, então o aviso não dispara.
    const desafio = r.status === 403 && (r.headers.get("cf-mitigated") === "challenge" || (r.headers.get("server-timing") ?? "").includes("chlray"));
    return { status: r.status, ...(corpo !== undefined ? { json: corpo } : {}), ...(desafio ? { desafio: true } : {}) };
  } catch (erro) {
    return { status: 0, erro: erro?.name === "TimeoutError" ? "tempo" : "sem_resposta" };
  }
}

/**
 * Decide o que está errado, a partir das respostas. Pura (o teste chama direto).
 * @param {{ saude: {status: number, json?: any, desafio?: boolean, erro?: string}, alumia: {status: number, desafio?: boolean, erro?: string} }} r
 * @returns {{ estado: "ok" | "falha" | "interditado", problemas: string[], notas: string[] }}
 */
export function avaliar(r) {
  const problemas = [];
  const notas = [];
  const s = r.saude ?? { status: 0 };
  const j = s.json && typeof s.json === "object" ? s.json : {};
  if (s.status === 503 && j.erro === "area_interditada") {
    notas.push("O site está interditado pela coordenação (painel): nada a avisar.");
    return { estado: "interditado", problemas, notas };
  }
  if (s.desafio) notas.push("A conferência de saúde caiu no desafio de robôs da Cloudflare: a borda respondeu (não é queda), mas a leitura interna (banco, filas) ficou de fora desta rodada.");
  else if (s.status === 0) problemas.push(`O site não respondeu à conferência de saúde (${s.erro === "tempo" ? "passou do prazo" : "sem resposta"}).`);
  else if (s.status !== 200) problemas.push(`A conferência de saúde respondeu ${s.status}.`);
  else {
    if (j.banco === "sem_resposta") problemas.push("O site não alcança o banco.");
    else if (j.banco === "desatualizado") problemas.push(`O banco da Alumia está na versão ${j.versao ?? "?"}; o código espera a ${j.esperada ?? "?"}. Falta rodar o SQL da onda.`);
    const f = j.filas && typeof j.filas === "object" ? j.filas : {};
    if (f.emails === false) problemas.push("A fila de e-mails está parada (e-mail esperando há mais de 1 hora).");
    if (f.agendados === false) problemas.push("Os posts agendados não estão saindo (vencidos há mais de 15 minutos).");
    if (f.faxina === false) problemas.push("A faxina da mídia não roda há mais de 3 dias.");
    if (f.emails === undefined && f.agendados === undefined) notas.push("O banco ainda não tem a conferência das filas (falta a migração da operação).");
  }
  const a = r.alumia ?? { status: 0 };
  if (a.desafio) notas.push("A página da Alumia caiu no desafio de robôs da Cloudflare: a borda respondeu (não é queda).");
  else if (a.status === 0) problemas.push(`A página da Alumia não respondeu (${a.erro === "tempo" ? "passou do prazo" : "sem resposta"}).`);
  else if (a.status >= 400) problemas.push(`A página da Alumia respondeu ${a.status}.`);
  return { estado: problemas.length ? "falha" : "ok", problemas, notas };
}

/** O relatório em texto (Markdown curto), sem endereço de rede nem e-mail. */
export function textoDoRelatorio(resultado, quando = new Date().toISOString()) {
  const linhas = [`Conferência de ${quando.replace("T", " ").slice(0, 16)} UTC.`, ""];
  if (resultado.problemas.length) linhas.push(...resultado.problemas.map((p) => `- ${p}`));
  else linhas.push(resultado.estado === "interditado" ? "- Site interditado pela coordenação." : "- Tudo respondendo.");
  if (resultado.notas.length) linhas.push("", ...resultado.notas.map((n) => `> ${n}`));
  return linhas.join("\n");
}

const limpa = (u) => String(u ?? "").trim().replace(/\/+$/, "");

async function principal() {
  const site = limpa(process.env.SITE_URL) || "https://institutolucia.org";
  const alumia = limpa(process.env.ALUMIA_URL) || `${site}/pt/alumia`;
  if (!/^https:\/\//.test(site) || !/^https:\/\//.test(alumia)) {
    console.error("SITE_URL e ALUMIA_URL precisam começar com https://");
    process.exit(2);
  }
  const [saude, pagina] = await Promise.all([buscar(`${site}/api/saude`, { json: true }), buscar(alumia)]);
  const resultado = avaliar({ saude, alumia: pagina });
  const texto = textoDoRelatorio(resultado);
  console.log(texto);
  fs.writeFileSync("monitor-relatorio.md", texto);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Monitor da Alumia\n\n${texto}\n`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `falhou=${resultado.estado === "falha" ? "sim" : "nao"}\nestado=${resultado.estado}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await principal();
