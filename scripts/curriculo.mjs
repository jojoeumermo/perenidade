// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Aplica as propostas de currículo aprovadas no painel (disciplinas e trilhas) aos arquivos do site: lib/areas.ts,
// os cinco dicionários (i18n/*.json) e content/trilhas. É chamado pela rotina de publicação (scripts/sincronizar.mjs):
// a rotina grava, o build confere e o Git guarda. Nada aqui executa conteúdo vindo do banco: são só textos e slugs,
// validados antes de entrar.
import fs from "node:fs";
import path from "node:path";

const IDIOMAS = ["pt", "en", "es", "ru", "zh", "fr"];
const ETAPAS = ["fundamental", "medio", "superior"];
const slugOk = (s) => /^[a-z0-9][a-z0-9-]{1,59}$/.test(String(s ?? ""));
const linha = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const slugDe = (t) => linha(t, 80).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** As trilhas de uma disciplina (as pastas de content/trilhas cujo _trilha.md diz "area: <disciplina>"). */
function trilhasDa(raiz, disciplina) {
  const base = path.join(raiz, "content/trilhas");
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base).filter((p) => {
    const f = path.join(base, p, "_trilha.md");
    return fs.existsSync(f) && new RegExp(`^area: ${disciplina}\\s*$`, "m").test(fs.readFileSync(f, "utf8"));
  });
}

/**
 * Onde mais a trilha é citada, fora das pastas dela: links /trilhas/<slug> no conteúdo e o slug escrito no código do
 * site (lib/, app/). Arquivar uma trilha citada quebraria o build e travaria a publicação de todo mundo; por isso a
 * aplicação recusa e diz onde está a citação.
 */
function citacoes(raiz, slug) {
  const proprias = new Set([path.join(raiz, "content/trilhas", slug), path.join(raiz, "content/exercicios", slug), path.join(raiz, "content/arquivo")]);
  const achadas = [];
  const andar = (dir, extensoes, teste) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const c = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!proprias.has(c) && e.name !== "node_modules") andar(c, extensoes, teste);
      } else if (extensoes.test(e.name) && teste(fs.readFileSync(c, "utf8")) && path.basename(c) !== `${slug}.yml`) achadas.push(path.relative(raiz, c).replaceAll("\\", "/"));
      if (achadas.length >= 5) return;
    }
  };
  andar(path.join(raiz, "content"), /\.(md|json|ya?ml)$/, (t) => t.includes(`/trilhas/${slug}/`) || t.includes(`/trilhas/${slug})`) || t.includes(`/trilhas/${slug}"`));
  for (const pasta of ["lib", "app"]) andar(path.join(raiz, pasta), /\.(ts|tsx)$/, (t) => t.includes(`"${slug}"`));
  return achadas;
}

/** Leva a trilha (aulas, roteiro, exercícios e mapa curricular) para content/arquivo: sai do site, nada se perde. */
function arquivarTrilha(raiz, slug, tocados) {
  const origem = path.join(raiz, "content/trilhas", slug);
  if (!fs.existsSync(path.join(origem, "_trilha.md"))) throw new Error(`a trilha ${slug} não existe`);
  const onde = citacoes(raiz, slug);
  if (onde.length) throw new Error(`a trilha ${slug} é citada em ${onde.join(", ")}: tire as citações antes de arquivar`);
  const quando = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const destino = (pasta, nome) => {
    const alvo = path.join(raiz, "content/arquivo", pasta, nome);
    return fs.existsSync(alvo) ? path.join(raiz, "content/arquivo", pasta, `${nome.replace(/\.yml$/, "")}-${quando}${nome.endsWith(".yml") ? ".yml" : ""}`) : alvo;
  };
  const mover = (de, pasta, nome) => {
    if (!fs.existsSync(de)) return;
    const para = destino(pasta, nome);
    fs.mkdirSync(path.dirname(para), { recursive: true });
    fs.renameSync(de, para);
    tocados.push(`${path.relative(raiz, de).replaceAll("\\", "/")} → ${path.relative(raiz, para).replaceAll("\\", "/")}`);
  };
  mover(origem, "trilhas", slug);
  mover(path.join(raiz, "content/exercicios", slug), "exercicios", slug);
  mover(path.join(raiz, "content/curriculo", `${slug}.yml`), "curriculo", `${slug}.yml`);
}

export function lerAreas(raiz) {
  const texto = fs.readFileSync(path.join(raiz, "lib/areas.ts"), "utf8");
  const grupos = [...texto.matchAll(/id: "([a-z]+)",\s*areas: \[([^\]]*)\]/g)].map((m) => ({ id: m[1], areas: [...m[2].matchAll(/"([a-z0-9-]+)"/g)].map((x) => x[1]) }));
  return { texto, grupos, slugs: new Set(grupos.flatMap((g) => g.areas)) };
}

/** Aplica uma proposta. Devolve a lista de arquivos tocados; lança Error com o motivo quando recusa. */
export function aplicar(raiz, proposta) {
  const d = proposta.dados ?? {};
  const slug = String(d.slug ?? "");
  if (!slugOk(slug)) throw new Error("slug inválido");
  const tocados = [];
  const areasPath = path.join(raiz, "lib/areas.ts");
  const { texto: areas, grupos, slugs } = lerAreas(raiz);
  const dict = (lang) => path.join(raiz, `i18n/${lang}.json`);
  const lerDict = (lang) => fs.readFileSync(dict(lang), "utf8");
  const escrever = (arquivo, conteudo) => { fs.writeFileSync(arquivo, conteudo); tocados.push(path.relative(raiz, arquivo).replaceAll("\\", "/")); };

  if (proposta.tipo === "disciplina") {
    if (slugs.has(slug)) throw new Error(`a disciplina ${slug} já existe`);
    const grupo = grupos.find((g) => g.id === d.grupo);
    if (!grupo) throw new Error(`grupo desconhecido: ${d.grupo} (use ${grupos.map((g) => g.id).join(", ")})`);
    const etapas = (Array.isArray(d.etapas) ? d.etapas : ["medio"]).filter((e) => ETAPAS.includes(e));
    if (!etapas.length) throw new Error("escolha ao menos uma etapa");
    // areas.ts: o slug entra no fim do grupo e nas etapas.
    let novo = areas.replace(new RegExp(`(id: "${grupo.id}",\\s*areas: \\[)([^\\]]*)(\\])`), (_m, a, meio, z) => `${a}${meio.replace(/\s*$/, "")}${meio.trim() ? ", " : ""}"${slug}"${/\n\s*$/.test(meio) ? "\n    " : ""}${z}`);
    for (const e of etapas) novo = novo.replace(new RegExp(`(  ${e}: \\[[^\\]]*)(\\])`), `$1, "${slug}"$2`);
    if (novo === areas) throw new Error("não consegui editar lib/areas.ts");
    escrever(areasPath, novo);
    for (const lang of IDIOMAS) {
      const nome = linha(d.nomes?.[lang] || d.nomes?.pt, 60);
      const desc = linha(d.descricoes?.[lang] || d.descricoes?.pt || "", 300);
      if (!nome) throw new Error("falta o nome em português");
      const json = lerDict(lang);
      if (json.includes(`\n    "${slug}": [`)) continue;
      const novoJson = json.replace('  "areas": {\n', `  "areas": {\n    ${JSON.stringify(slug)}: [\n      ${JSON.stringify(nome)},\n      ${JSON.stringify(desc)}\n    ],\n`);
      JSON.parse(novoJson);
      escrever(dict(lang), novoJson);
    }
    return tocados;
  }
  if (proposta.tipo === "editar_disciplina") {
    if (!slugs.has(slug)) throw new Error(`a disciplina ${slug} não existe`);
    for (const lang of IDIOMAS) {
      const nome = linha(d.nomes?.[lang], 60);
      const desc = linha(d.descricoes?.[lang], 300);
      if (!nome && !desc) continue;
      const json = lerDict(lang);
      const re = new RegExp(`(\\n    ${JSON.stringify(slug)}: \\[\\n      )("[^"\\n]*")(,\\n      )("[^"\\n]*")(\\n    \\])`);
      const m = re.exec(json);
      if (!m) throw new Error(`entrada de ${slug} não encontrada em ${lang}.json`);
      const novoJson = json.replace(re, `$1${nome ? JSON.stringify(nome) : "$2"}$3${desc ? JSON.stringify(desc) : "$4"}$5`);
      JSON.parse(novoJson);
      escrever(dict(lang), novoJson);
    }
    return tocados;
  }
  if (proposta.tipo === "remover_disciplina") {
    if (!slugs.has(slug)) throw new Error(`a disciplina ${slug} não existe`);
    const pastas = trilhasDa(raiz, slug);
    // As trilhas vão junto para outra disciplina ("destino") ou para o arquivo ("arquivar"); sem nenhum dos dois, fica.
    if (pastas.length && d.destino) {
      const destino = String(d.destino);
      if (destino === slug || !slugs.has(destino)) throw new Error(`disciplina de destino inválida: ${destino}`);
      for (const p of pastas) {
        const f = path.join(raiz, "content/trilhas", p, "_trilha.md");
        escrever(f, fs.readFileSync(f, "utf8").replace(/^area: .*$/m, `area: ${destino}`));
      }
    } else if (pastas.length && d.arquivar === true) {
      // Confere todas antes de mover a primeira: ou arquiva tudo, ou nada.
      for (const p of pastas) {
        const onde = citacoes(raiz, p);
        if (onde.length) throw new Error(`a trilha ${p} é citada em ${onde.join(", ")}: tire as citações antes de arquivar`);
      }
      for (const p of pastas) arquivarTrilha(raiz, p, tocados);
    } else if (pastas.length) throw new Error(`a disciplina ainda tem trilhas (${pastas.join(", ")}): escolha para onde elas vão ou arquive-as`);
    let novo = areas.replace(new RegExp(`\\s*"${slug}",?`, "g"), (m) => (m.trim().endsWith(",") ? "" : ""));
    // Vírgula pendente antes de "]" e espaços duplos.
    novo = novo.replace(/,(\s*\])/g, "$1").replace(/\[\s*,/g, "[");
    if (novo === areas) throw new Error("não consegui editar lib/areas.ts");
    escrever(areasPath, novo);
    for (const lang of IDIOMAS) {
      const json = lerDict(lang);
      const novoJson = json.replace(new RegExp(`\\n    ${JSON.stringify(slug)}: \\[\\n      "[^"\\n]*",\\n      "[^"\\n]*"\\n    \\],`), "");
      JSON.parse(novoJson);
      if (novoJson !== json) escrever(dict(lang), novoJson);
    }
    return tocados;
  }
  if (proposta.tipo === "trilha") {
    const area = String(d.disciplina ?? "");
    if (!slugs.has(area)) throw new Error(`disciplina desconhecida: ${area}`);
    const pasta = path.join(raiz, "content/trilhas", slug);
    if (fs.existsSync(pasta)) throw new Error(`a trilha ${slug} já existe`);
    const titulo = linha(d.titulo, 120);
    const etapa = ETAPAS.includes(d.etapa) ? d.etapa : "medio";
    const ordem = Math.min(99, Math.max(1, Number(d.ordem) || 1));
    const resumo = linha(d.resumo, 220) || `Trilha de ${titulo}.`;
    const intro = String(d.intro ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, 4000);
    const aulas = (Array.isArray(d.aulas) ? d.aulas : []).map((a) => linha(typeof a === "string" ? a : a?.titulo, 120)).filter(Boolean).slice(0, 60);
    if (!titulo) throw new Error("falta o título");
    fs.mkdirSync(pasta, { recursive: true });
    escrever(path.join(pasta, "_trilha.md"), `---\ntitulo: ${JSON.stringify(titulo)}\narea: ${area}\netapa: ${etapa}\nordem: ${ordem}\nresumo: ${JSON.stringify(resumo)}\n---\n\n${intro || "As aulas desta trilha ainda estão em preparação: o roteiro abaixo é a proposta dos próximos conteúdos. Quer ajudar a escrever alguma delas? Veja [como contribuir](/contribuir)."}\n`);
    const vistos = new Set();
    const plano = aulas.map((t) => { let s = slugDe(t) || "aula"; let n = 2; while (vistos.has(s)) s = `${slugDe(t)}-${n++}`; vistos.add(s); return { slug: s, titulo: t }; });
    escrever(path.join(pasta, "plano.json"), JSON.stringify(plano, null, 2) + "\n");
    return tocados;
  }
  if (proposta.tipo === "editar_trilha") {
    const pasta = path.join(raiz, "content/trilhas", slug);
    const arquivo = path.join(pasta, "_trilha.md");
    if (!fs.existsSync(arquivo)) throw new Error(`a trilha ${slug} não existe`);
    let texto = fs.readFileSync(arquivo, "utf8");
    const trocar = (chave, valor) => { texto = texto.replace(new RegExp(`^${chave}: .*$`, "m"), `${chave}: ${valor}`); };
    if (d.titulo) trocar("titulo", JSON.stringify(linha(d.titulo, 120)));
    if (d.resumo) trocar("resumo", JSON.stringify(linha(d.resumo, 220)));
    if (ETAPAS.includes(d.etapa)) trocar("etapa", d.etapa);
    if (d.ordem) trocar("ordem", String(Math.min(99, Math.max(1, Number(d.ordem) || 1))));
    if (d.disciplina && slugs.has(d.disciplina)) trocar("area", d.disciplina);
    escrever(arquivo, texto);
    if (Array.isArray(d.aulas)) {
      const planoPath = path.join(pasta, "plano.json");
      const antigo = fs.existsSync(planoPath) ? JSON.parse(fs.readFileSync(planoPath, "utf8")) : [];
      const prontas = fs.readdirSync(pasta).filter((f) => /\.md$/.test(f) && f !== "_trilha.md" && !/\.(en|es|zh|ru|fr)\.md$/.test(f)).map((f) => f.replace(/^\d+-/, "").replace(/\.md$/, ""));
      const vistos = new Set();
      const plano = d.aulas.map((a) => linha(typeof a === "string" ? a : a?.titulo, 120)).filter(Boolean).slice(0, 80).map((t) => {
        const existente = antigo.find((p) => p.titulo === t);
        let s = existente?.slug ?? (slugDe(t) || "aula");
        let n = 2;
        while (vistos.has(s)) s = `${slugDe(t)}-${n++}`;
        vistos.add(s);
        return { slug: s, titulo: t };
      });
      // Aulas já escritas nunca saem do roteiro por uma edição.
      for (const p of antigo) if (prontas.includes(p.slug) && !vistos.has(p.slug)) plano.push(p);
      escrever(planoPath, JSON.stringify(plano, null, 2) + "\n");
    }
    return tocados;
  }
  if (proposta.tipo === "remover_trilha") {
    const pasta = path.join(raiz, "content/trilhas", slug);
    if (!fs.existsSync(path.join(pasta, "_trilha.md"))) throw new Error(`a trilha ${slug} não existe`);
    const escritas = fs.readdirSync(pasta).filter((f) => /\.md$/.test(f) && f !== "_trilha.md");
    if (escritas.length) throw new Error(`a trilha tem ${escritas.length} aula(s) escrita(s): mova-as antes de remover`);
    fs.rmSync(pasta, { recursive: true });
    tocados.push(`content/trilhas/${slug}/ (removida)`);
    return tocados;
  }
  if (proposta.tipo === "arquivar_trilha") {
    arquivarTrilha(raiz, slug, tocados);
    return tocados;
  }
  throw new Error(`tipo desconhecido: ${proposta.tipo}`);
}

/** Aplica todas as aprovadas; devolve o que deu certo (ids), o que falhou (id → motivo) e um resumo para o log. */
export function aplicarTodas(raiz, propostas) {
  const ids = [];
  const falhas = {};
  const resumo = [];
  for (const p of propostas) {
    try {
      const tocados = aplicar(raiz, p);
      ids.push(p.id);
      resumo.push(`currículo ${p.tipo} ${p.dados?.slug ?? ""} → ${tocados.join(", ")}`);
    } catch (e) {
      falhas[p.id] = String(e.message ?? e);
      resumo.push(`currículo ${p.tipo} ${p.dados?.slug ?? ""} RECUSADA: ${falhas[p.id]}`);
    }
  }
  return { ids, falhas, resumo };
}
