// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Manda ao banco a lista do que existe para ser contado: as matérias do jornal (o slug, como em /jornal/<slug>) e as aulas
// ("trilha/aula", o mesmo valor que components/aula/BarraDaAula.tsx e components/Quiz.tsx mandam). Com a lista no banco,
// a função "contar" ignora alvo inventado, e a tabela de contagens não incha (supabase/migracoes/2026-11-seguranca.sql).
//
// Roda na publicação, depois do "npm run sincronizar" (que traz as matérias e aulas aprovadas no painel para content/).
// Lê os arquivos do mesmo jeito que lib/content.ts (originais, sem as traduções "x.en.md"); aula desativada também entra,
// porque sobrar alvo não faz mal, e faltar faria uma aula parar de contar em silêncio.
// Grupo sem nenhum arquivo não é mandado: a lista dele no banco fica como está (vazia = conta tudo, como antes).
//
// Uso:
//   node scripts/alvos-de-contagem.mjs            manda (precisa de SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY)
//   node scripts/alvos-de-contagem.mjs --mostrar  só mostra quantos acharia, sem mandar nada
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const conteudo = path.join(raiz, "content");
const FORMATO = /^[a-z0-9/_-]{1,160}$/;

/**
 * Arquivos originais de uma pasta, sem as traduções ("x.en.md"), como originals() de lib/content.ts, e sem as versões
 * fáceis das aulas ("x.facil.md", Etapa 4): a expressão de idioma não pega "facil", e "aula.facil" viraria alvo.
 */
function originais(pasta) {
  if (!fs.existsSync(pasta)) return [];
  return fs.readdirSync(pasta).filter((nome) => nome.endsWith(".md") && !/\.[a-z]{2}\.md$/.test(nome) && !nome.endsWith(".facil.md"));
}

/** As matérias do jornal: o nome do arquivo sem ".md". */
export function alvosDoJornal(base = conteudo) {
  return originais(path.join(base, "jornal"))
    .filter((nome) => /^[a-z0-9-]+\.md$/.test(nome))
    .map((nome) => nome.replace(/\.md$/, ""))
    .filter((alvo) => FORMATO.test(alvo));
}

/** As aulas: "pasta-da-trilha/slug", com o slug sem o número da frente ("03-fracoes.md" vira "fracoes"). */
export function alvosDasAulas(base = conteudo) {
  const trilhas = path.join(base, "trilhas");
  if (!fs.existsSync(trilhas)) return [];
  const alvos = [];
  for (const pasta of fs.readdirSync(trilhas, { withFileTypes: true })) {
    if (!pasta.isDirectory() || !fs.existsSync(path.join(trilhas, pasta.name, "_trilha.md"))) continue;
    for (const nome of originais(path.join(trilhas, pasta.name))) {
      if (nome === "_trilha.md") continue;
      const achado = /^(?:\d+-)?([a-z0-9-]+)\.md$/.exec(nome);
      if (achado) alvos.push(`${pasta.name}/${achado[1]}`);
    }
  }
  return [...new Set(alvos)].filter((alvo) => FORMATO.test(alvo)).sort();
}

const CURSO = /^[a-z0-9][a-z0-9-]{0,79}$/;
const ESCOLA = /^[a-z0-9/._-]{1,160}$/;

/**
 * Os alvos da Escola Lúcia Maria (supabase/migracoes/2026-11-escola.sql), por grupo: 'curso' (os slugs de
 * content/escola/cursos/*.json e 'escola', o alvo geral), 'curso-sensivel' (os cursos com "sensivel": true, cujo vínculo
 * revela opinião política) e 'assembleia' ('AAAA.S/trilha', de content/escola/assembleia.json). Arquivo que não existe:
 * o grupo não entra no resultado e a lista dele no banco fica como está. Curso com JSON estragado fica de fora (e avisa).
 */
export function alvosDaEscola(base = conteudo) {
  const grupos = {};
  const pastaDosCursos = path.join(base, "escola", "cursos");
  const arquivos = fs.existsSync(pastaDosCursos) ? fs.readdirSync(pastaDosCursos).filter((nome) => nome.endsWith(".json")).sort() : [];
  if (arquivos.length) {
    const comuns = [];
    const sensiveis = [];
    for (const nome of arquivos) {
      const slug = nome.replace(/\.json$/, "");
      if (!CURSO.test(slug) || slug === "escola") continue;
      let curso;
      try {
        curso = JSON.parse(fs.readFileSync(path.join(pastaDosCursos, nome), "utf8"));
      } catch {
        console.log(`escola: ${nome} não é um JSON válido e ficou fora da lista.`);
        continue;
      }
      (curso && curso.sensivel === true ? sensiveis : comuns).push(slug);
    }
    grupos.curso = [...new Set([...comuns, "escola"])].sort();
    grupos["curso-sensivel"] = [...new Set(sensiveis)].sort();
  }
  const arquivoDaAssembleia = path.join(base, "escola", "assembleia.json");
  if (fs.existsSync(arquivoDaAssembleia)) {
    try {
      const pauta = JSON.parse(fs.readFileSync(arquivoDaAssembleia, "utf8"));
      const semestre = typeof pauta?.semestre === "string" && /^[0-9]{4}\.[12]$/.test(pauta.semestre) ? pauta.semestre : "";
      const candidatas = Array.isArray(pauta?.candidatas) ? pauta.candidatas.filter((t) => typeof t === "string" && /^[a-z0-9_-]{1,150}$/.test(t)) : [];
      if (semestre) grupos.assembleia = [...new Set(candidatas.map((t) => `${semestre}/${t}`))].filter((alvo) => ESCOLA.test(alvo)).sort();
    } catch {
      console.log("escola: assembleia.json não é um JSON válido; a lista da assembleia fica como está.");
    }
  }
  return grupos;
}

/** Manda uma lista ao banco. Falha não derruba a publicação: a lista antiga continua valendo até a próxima. */
async function mandar(base, servico, funcao, grupo, alvos, migracao) {
  try {
    const resposta = await fetch(`${base}/rest/v1/rpc/${funcao}`, {
      method: "POST",
      headers: { apikey: servico, Authorization: `Bearer ${servico}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_grupo: grupo, p_alvos: alvos }),
      signal: AbortSignal.timeout(30_000),
    });
    if (resposta.status === 404) {
      // Banco ainda sem a migração: nada a fazer, e a publicação não para por isso.
      console.log(`${grupo}: o banco ainda não tem a função ${funcao} (falta rodar a migração ${migracao}).`);
      return;
    }
    const corpo = await resposta.json().catch(() => null);
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    console.log(`${grupo}: ${corpo?.total ?? "?"} alvo(s) no banco.`);
  } catch (falha) {
    console.log(`${grupo}: não deu para mandar a lista (${falha instanceof Error ? falha.message : "falha"}).`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const grupos = { jornal: alvosDoJornal(), aula: alvosDasAulas() };
  const daEscola = alvosDaEscola();
  if (process.argv.includes("--mostrar")) {
    for (const [grupo, alvos] of Object.entries(grupos)) console.log(`${grupo}: ${alvos.length} alvo(s)${alvos.length ? `, por exemplo ${alvos.slice(0, 3).join(", ")}` : ""}`);
    for (const grupo of ["curso", "curso-sensivel", "assembleia"]) {
      const alvos = daEscola[grupo];
      console.log(`escola/${grupo}: ${alvos ? `${alvos.length} alvo(s)${alvos.length ? `, por exemplo ${alvos.slice(0, 3).join(", ")}` : ""}` : "sem arquivo, não seria mandado"}`);
    }
    process.exit(0);
  }
  const base = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  const servico = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!base || !servico) {
    console.log("Lista de contagens não mandada: faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(0);
  }
  // Falha aqui não derruba a publicação (sai sempre com 0): a lista antiga continua valendo até a próxima.
  for (const [grupo, alvos] of Object.entries(grupos)) {
    if (!alvos.length) {
      console.log(`${grupo}: nenhum arquivo, a lista do banco fica como está.`);
      continue;
    }
    try {
      const resposta = await fetch(`${base}/rest/v1/rpc/contagens_alvos_definir`, {
        method: "POST",
        headers: { apikey: servico, Authorization: `Bearer ${servico}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_grupo: grupo, p_alvos: alvos }),
        signal: AbortSignal.timeout(30_000),
      });
      if (resposta.status === 404) {
        // Banco ainda sem a migração: nada a fazer, e a publicação não para por isso.
        console.log(`${grupo}: o banco ainda não tem a função contagens_alvos_definir (falta rodar a migração de segurança).`);
        continue;
      }
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      console.log(`${grupo}: ${corpo?.total ?? "?"} alvo(s) no banco.`);
    } catch (falha) {
      console.log(`${grupo}: não deu para mandar a lista (${falha instanceof Error ? falha.message : "falha"}).`);
    }
  }
  // A Escola: grupo presente vai mesmo vazio (curso que deixou de ser sensível precisa sair da lista sensível).
  for (const grupo of ["curso", "curso-sensivel", "assembleia"]) {
    if (!daEscola[grupo]) {
      console.log(`escola/${grupo}: nenhum arquivo, a lista do banco fica como está.`);
      continue;
    }
    await mandar(base, servico, "escola_alvos_definir", grupo, daEscola[grupo], "da Escola (supabase/migracoes/2026-11-escola.sql)");
  }
}
