// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A parte das tarefas ("Para você hoje") na rotina de publicação, em dois passos:
//   node scripts/tarefas.mjs aplicar    antes do build: leva ao acervo as fichas aprovadas (ano, sinopse, licença, link)
//   node scripts/tarefas.mjs verificar  depois do envio: marca o que foi aplicado, leva ao banco as lacunas do verificador
//                                       (do site publicado) e confere um lote pequeno de links das obras
// Variáveis: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (as mesmas da publicação); SITE_URL (padrão: institutolucia.org).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const RAIZ = process.cwd();
const ANOTACAO = path.join(RAIZ, ".tarefas-aplicadas.json");
const LICENCAS = ["Domínio público", "CC BY", "CC BY-SA", "CC BY-NC", "CC BY-NC-SA", "CC BY-ND", "CC BY-NC-ND", "CC0", "Direitos reservados", "Conforme a fonte"];

const aspas = (v) => `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/**
 * Aplica uma entrega aprovada ao arquivo da obra. Devolve o texto novo, ou lança o motivo de não dar (o banco devolve a
 * tarefa para a revisão com esse motivo). Não mexe em nada além do campo da tarefa.
 */
export function aplicarNaObra(texto, tarefa) {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(texto);
  if (!m) throw new Error("o arquivo da obra não tem cabeçalho");
  let [, cabeca, corpo] = m;
  const trocar = (campo, valor) => {
    const linha = `${campo}: ${aspas(valor)}`;
    cabeca = new RegExp(`^${campo}:.*$`, "m").test(cabeca) ? cabeca.replace(new RegExp(`^${campo}:.*$`, "m"), linha) : `${cabeca}\n${linha}`;
  };
  const e = tarefa.entrega ?? {};
  switch (tarefa.tipo) {
    case "ficha_ano":
      if (!/^-?\d{1,4}$/.test(String(e.ano ?? ""))) throw new Error("ano inválido");
      trocar("ano", e.ano);
      break;
    case "ficha_sinopse": {
      const s = String(e.sinopse ?? e.texto ?? "").trim();
      if (s.length < 60 || s.length > 6000) throw new Error("sinopse curta ou longa demais");
      if (/^---$|<script|<iframe/im.test(s)) throw new Error("sinopse com marcação proibida");
      corpo = `${s}\n`;
      break;
    }
    case "licenca":
      if (!LICENCAS.includes(e.licenca)) throw new Error("licença desconhecida");
      trocar("licenca", e.licenca);
      break;
    case "link":
      if (!/^https:\/\/[^\s"'<>]+$/.test(String(e.url ?? ""))) throw new Error("endereço inválido");
      trocar("url", e.url);
      break;
    default:
      throw new Error(`tipo ${tarefa.tipo} não se aplica sozinho`);
  }
  return `---\n${cabeca}\n---\n\n${corpo.replace(/^\n+/, "")}`;
}

/** O arquivo da obra do alvo "/acervo/<id>", dentro de content/acervo (nada fora). */
export function arquivoDaObra(raiz, alvo) {
  const id = /^\/acervo\/([a-z0-9-]{1,120})$/.exec(String(alvo ?? ""))?.[1];
  if (!id) throw new Error("alvo fora do acervo");
  const arquivo = path.join(raiz, "content", "acervo", `${id}.md`);
  if (!fs.existsSync(arquivo)) throw new Error("a obra não existe mais");
  return arquivo;
}

export function aplicarTodas(raiz, tarefas) {
  const ok = [];
  const falhas = {};
  for (const t of tarefas) {
    try {
      const arquivo = arquivoDaObra(raiz, t.alvo);
      fs.writeFileSync(arquivo, aplicarNaObra(fs.readFileSync(arquivo, "utf8"), t));
      ok.push(t.id);
    } catch (erro) {
      falhas[t.id] = String(erro.message ?? erro).slice(0, 200);
    }
  }
  return { ok, falhas };
}

/** Confere um endereço sem baixar a página: HEAD (e GET de reserva, que alguns servidores exigem), com prazo curto. */
async function conferir(url) {
  for (const metodo of ["HEAD", "GET"]) {
    try {
      const r = await fetch(url, { method: metodo, redirect: "follow", headers: { "User-Agent": "InstitutoLucia-conferencia-de-links/1.0 (+https://institutolucia.org)" }, signal: AbortSignal.timeout(12_000) });
      if (r.ok) return { status: r.status, ok: true };
      if (metodo === "GET" || ![403, 405, 501].includes(r.status)) return { status: r.status, ok: r.status === 429 };
    } catch {
      if (metodo === "GET") return { status: 0, ok: false };
    }
  }
  return { status: 0, ok: false };
}

async function principal() {
  const modo = process.argv[2];
  const base = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const site = (process.env.SITE_URL ?? "https://institutolucia.org").replace(/\/$/, "");
  if (!base || !chave) {
    console.log("Sem SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY: nada a fazer.");
    return;
  }
  const chamar = async (funcao, argumentos = {}) => {
    const r = await fetch(`${base}/rest/v1/rpc/${funcao}`, { method: "POST", headers: { apikey: chave, Authorization: `Bearer ${chave}`, "Content-Type": "application/json" }, body: JSON.stringify(argumentos), signal: AbortSignal.timeout(60_000) });
    if (!r.ok) throw new Error(`${funcao}: HTTP ${r.status}`);
    return r.json();
  };
  if (modo === "aplicar") {
    const tarefas = await chamar("tarefas_aplicaveis").catch(() => []);
    const { ok, falhas } = aplicarTodas(RAIZ, Array.isArray(tarefas) ? tarefas : []);
    fs.writeFileSync(ANOTACAO, JSON.stringify({ ok, falhas }));
    console.log(`Fichas aplicadas ao acervo: ${ok.length}${Object.keys(falhas).length ? `; sem aplicar: ${Object.keys(falhas).length}` : ""}.`);
    return;
  }
  if (modo === "verificar") {
    if (fs.existsSync(ANOTACAO)) {
      const { ok, falhas } = JSON.parse(fs.readFileSync(ANOTACAO, "utf8"));
      if (ok.length || Object.keys(falhas).length) await chamar("tarefas_aplicadas", { p_ids: ok, p_falhas: falhas });
      fs.rmSync(ANOTACAO);
    }
    try {
      const dados = await (await fetch(`${site}/pt/lacunas.json`, { signal: AbortSignal.timeout(60_000) })).json();
      const r = await chamar("tarefas_sincronizar", { p_lacunas: dados.lacunas ?? [], p_saude: dados.saude ?? null });
      console.log(`Tarefas: ${r.novas} novas, ${r.concluidas} concluídas, ${r.encerradas} encerradas.`);
    } catch (erro) {
      console.log(`Verificador não rodou nesta vez (${erro.message}).`);
    }
    try {
      const fichas = await (await fetch(`${site}/pt/acervo-fichas.json`, { signal: AbortSignal.timeout(60_000) })).json();
      const lote = await chamar("links_para_conferir", { p_urls: fichas.filter((f) => /^https:\/\//.test(f.url)).map((f) => ({ url: f.url, alvo: `/acervo/${f.id}` })), p_limite: 25 });
      const resultados = [];
      for (const item of lote) {
        resultados.push({ ...item, ...(await conferir(item.url)) });
        await new Promise((fim) => setTimeout(fim, 1000));
      }
      if (resultados.length) await chamar("links_resultado", { p: resultados });
      console.log(`Links conferidos: ${resultados.length}, com problema: ${resultados.filter((r) => !r.ok).length}.`);
    } catch (erro) {
      console.log(`Conferência de links não rodou nesta vez (${erro.message}).`);
    }
    return;
  }
  console.log("Uso: node scripts/tarefas.mjs aplicar | verificar");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await principal();
