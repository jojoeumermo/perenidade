// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O alerta da operação (monitor.yml e restaurar.yml). Por padrão vai só ao gancho da coordenação. A issue com etiqueta
// (monitor, restauracao) só existe se o repositório for PRIVADO: num repositório público, uma issue "algo parou" diria a
// qualquer pessoa, na hora, quando um ataque derrubou o serviço. Por isso, antes de abrir ou comentar, o script pergunta ao
// GitHub se o repositório é privado, e num público não abre nada. Com issue: se já há uma aberta com a mesma etiqueta, só
// comenta nela (sem enxurrada); quando tudo volta, comenta e fecha. O texto nunca leva dado de pessoa, endereço de rede nem
// e-mail, só o que falhou.
//
// Para onde mais o alerta vai é decisão da coordenação, por duas configurações do GitHub (Settings › Secrets and variables ›
// Actions), sem e-mail de ninguém no código:
//   variável OPERACAO_DESTINO   "gancho" (padrão), "issue" ou "os-dois" (a issue só num repositório privado)
//   segredo  OPERACAO_GANCHO    um endereço https que recebe POST {"titulo", "texto"} (ntfy, Matrix, um bot próprio...)
//
// Uso: node scripts/operacao/avisar.mjs falha  --etiqueta monitor --titulo "..." --arquivo relatorio.md
//      node scripts/operacao/avisar.mjs voltou --etiqueta monitor
// Precisa de GITHUB_TOKEN (permissão issues: write) e GITHUB_REPOSITORY, que o GitHub entrega à rotina.
import fs from "node:fs";
import { pathToFileURL } from "node:url";

/** O corpo da issue: título curto, texto com a origem. Puro (o teste chama direto). */
export function corpoDoAviso({ titulo, texto, rotina = "" }) {
  const t = String(titulo ?? "").replace(/\s+/g, " ").trim().slice(0, 120) || "Operação da Alumia";
  const corpo = [String(texto ?? "").slice(0, 6000), "", rotina ? `Aberto pela rotina: ${rotina}` : "Aberto pela rotina da operação."].join("\n");
  return { title: t, body: corpo };
}

function argumentos(lista) {
  const r = { modo: lista[0] };
  for (let i = 1; i < lista.length; i += 2) r[lista[i].replace(/^--/, "")] = lista[i + 1];
  return r;
}

async function github(caminho, { metodo = "GET", corpo } = {}) {
  const r = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "OperacaoAlumia/1.0", ...(corpo ? { "Content-Type": "application/json" } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok && r.status !== 422) throw new Error(`GitHub respondeu ${r.status} em ${caminho}`);
  return r.status === 204 ? null : r.json().catch(() => null);
}

async function issueAberta(etiqueta) {
  const lista = await github(`/issues?state=open&labels=${encodeURIComponent(etiqueta)}&per_page=1`);
  return Array.isArray(lista) && lista[0] ? lista[0] : null;
}

/** A issue só num repositório privado (na dúvida, não). Puro (o teste chama direto). */
export function podeAbrirIssue(repositorio) {
  return Boolean(repositorio && typeof repositorio === "object" && repositorio.private === true);
}

async function gancho(titulo, texto) {
  const url = String(process.env.OPERACAO_GANCHO ?? "").trim();
  if (!/^https:\/\/[^\s]+$/.test(url)) return false;
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ titulo, texto }), signal: AbortSignal.timeout(15_000) }).catch(() => null);
  return Boolean(r?.ok);
}

async function principal() {
  const a = argumentos(process.argv.slice(2));
  const etiqueta = /^[a-z-]{3,30}$/.test(a.etiqueta ?? "") ? a.etiqueta : "operacao";
  const destino = ["issue", "gancho", "os-dois"].includes(process.env.OPERACAO_DESTINO ?? "") ? process.env.OPERACAO_DESTINO : "gancho";
  const rotina = process.env.GITHUB_SERVER_URL && process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : "";
  let usaIssue = destino !== "gancho" && Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY);
  if (usaIssue && !podeAbrirIssue(await github("").catch(() => null))) {
    console.log("Repositório público (ou sem resposta): nada de issue. O aviso vai só ao gancho.");
    usaIssue = false;
  }

  if (a.modo === "falha") {
    const texto = a.arquivo && fs.existsSync(a.arquivo) ? fs.readFileSync(a.arquivo, "utf8") : "Falhou (sem relatório).";
    const { title, body } = corpoDoAviso({ titulo: a.titulo, texto, rotina });
    if (usaIssue) {
      await github("/labels", { metodo: "POST", corpo: { name: etiqueta, color: "e8321f", description: "Alerta da operação da Alumia" } });
      const aberta = await issueAberta(etiqueta);
      if (aberta) await github(`/issues/${aberta.number}/comments`, { metodo: "POST", corpo: { body } });
      else await github("/issues", { metodo: "POST", corpo: { title, body, labels: [etiqueta] } });
      console.log(aberta ? `Comentado na issue #${aberta.number}.` : "Issue aberta.");
    }
    if (destino !== "issue" || !usaIssue) console.log((await gancho(title, texto)) ? "Gancho avisado." : "Gancho não configurado ou sem resposta.");
    return;
  }
  if (a.modo === "voltou") {
    if (!usaIssue) return;
    const aberta = await issueAberta(etiqueta);
    if (!aberta) return;
    await github(`/issues/${aberta.number}/comments`, { metodo: "POST", corpo: { body: corpoDoAviso({ titulo: "", texto: "Voltou: a conferência seguinte passou.", rotina }).body } });
    await github(`/issues/${aberta.number}`, { metodo: "PATCH", corpo: { state: "closed", state_reason: "completed" } });
    console.log(`Issue #${aberta.number} fechada.`);
    return;
  }
  console.error("Uso: avisar.mjs falha|voltou --etiqueta <nome> [--titulo <texto>] [--arquivo <relatorio.md>]");
  process.exit(2);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await principal();
