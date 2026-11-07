// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Vale o Escrito: importa os casos pesquisados em lote (content/vale-o-escrito/novos-casos/*.json) pelo mesmo caminho da
// curadoria. Nada é publicado por aqui: todo caso entra como "pendente-curadoria" e só vira ficha pública quando a curadoria
// aprova (decisão da coordenação, 05/11/2026: só com fonte oficial e situação jurídica preenchidas e conferidas).
//
//   npm run vale-o-escrito:importar                  confere todos os arquivos e mostra o que entraria (não grava nada)
//   npm run vale-o-escrito:importar -- --gravar      grava os pendentes em content/vale-o-escrito/entradas/<dossie>.json
//   npm run vale-o-escrito:importar -- --fila        manda cada caso para a fila da curadoria no banco (vale_fila_criar)
//   ... -- --arquivo content/vale-o-escrito/novos-casos/x.json   só esse arquivo
//
// Formato de cada arquivo de novos casos: o mesmo de ArquivoDeEntradas (lib/vale-o-escrito/tipos.ts), mas as entradas podem
// ser de dossiês diferentes (cada Entrada diz o seu `dossie`); pode ter `recorte` e `descricao`. Também aceita uma lista
// de ArquivoDeEntradas ou { "dossies": ArquivoDeEntradas[] }.
//
// Conferência: cada caso passa por conferirDoc (lib/vale-o-escrito/curadoria.ts), a mesma que o painel usa antes de
// aprovar, sem exigir o arquivo do Internet Archive (feito na aprovação). Além disso exige o que a coordenação decidiu:
// pelo menos uma fonte oficial (processo, investigação oficial ou dado oficial) e a situação jurídica de cada pessoa.
// Sem duplicar: caso cujo id já existe, ou com uma fonte cujo link já está em outra entrada (publicada ou pendente),
// fica de fora e é listado. O link é comparado sem "#âncora", sem barra final e sem diferença de caixa no domínio.
//
// --fila: usa NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e VALE_CURADOR_TOKEN (o token de acesso de uma pessoa
// com papel curadoria ou coordenacao, copiado da sessão do painel; vale ~1 hora). A função do banco confere o papel de novo
// (interno.curador()). Antes de mandar, lê public.vale_publicadas() para não duplicar link já publicado.
//
// Sai com código 1 se algum caso foi barrado pelas regras e 2 se não conseguiu ler ou gravar.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SLUGS_DOS_DOSSIES } from "../../lib/vale-o-escrito/catalogo.ts";
import { conferirDoc } from "../../lib/vale-o-escrito/curadoria.ts";
import { TIPOS_PRIMARIOS } from "../../lib/vale-o-escrito/tipos.ts";

const argumentos = process.argv.slice(2);
const gravar = argumentos.includes("--gravar");
const fila = argumentos.includes("--fila");
const iArquivo = argumentos.indexOf("--arquivo");
const soUm = iArquivo >= 0 ? argumentos[iArquivo + 1] : null;

const PASTA_NOVOS = path.join(process.cwd(), "content", "vale-o-escrito", "novos-casos");
const PASTA_ENTRADAS = path.join(process.cwd(), "content", "vale-o-escrito", "entradas");

/** Link normalizado para comparar duplicatas. */
export function chaveDoLink(url) {
  try {
    const u = new URL(String(url).trim());
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    const texto = `${u.hostname}${u.port ? `:${u.port}` : ""}${u.pathname.replace(/\/+$/, "")}${u.search}`;
    return decodeURIComponent(texto);
  } catch {
    return String(url).trim();
  }
}

/** Lê um arquivo de novos casos e devolve uma lista de ArquivoDeEntradas "soltos" (entradas de qualquer dossiê). */
function lerNovos(arquivo) {
  const bruto = JSON.parse(fs.readFileSync(arquivo, "utf8"));
  const lista = Array.isArray(bruto) ? bruto : Array.isArray(bruto?.dossies) ? bruto.dossies : [bruto];
  return lista.map((a) => ({
    pessoas: a?.pessoas ?? [],
    organizacoes: a?.organizacoes ?? [],
    ligacoes: a?.ligacoes ?? [],
    entradas: (a?.entradas ?? []).map((en) => ({ ...en, dossie: en?.dossie ?? a?.dossie })),
  }));
}

/** Monta o documento da curadoria (DocumentoDeEntrada) de uma entrada: ela mais as pessoas, organizações e ligações dela. */
export function documentoDoCaso(en, solto) {
  const idsPessoas = new Set((en.pessoas ?? []).map((p) => p.pessoaId));
  const idsOrgs = new Set(en.organizacoes ?? []);
  const ligacoes = (solto.ligacoes ?? []).filter((l) => l?.entradaId === en.id);
  for (const l of ligacoes)
    for (const no of [l.de, l.para]) {
      if (no?.tipo === "pessoa") idsPessoas.add(no.id);
      if (no?.tipo === "organizacao") idsOrgs.add(no.id);
    }
  return {
    ...en,
    pessoasPublicas: (solto.pessoas ?? []).filter((p) => idsPessoas.has(p.id)),
    organizacoesPublicas: (solto.organizacoes ?? []).filter((o) => idsOrgs.has(o.id)),
    ligacoes,
  };
}

/** Conferência do lote: regras da curadoria + decisão da coordenação (fonte oficial e situação de cada pessoa). */
export function conferirCaso(doc) {
  const erros = [...conferirDoc(doc, { publicada: false }).erros];
  if (!(SLUGS_DOS_DOSSIES).includes(doc.dossie)) erros.push(`dossie: "${doc.dossie}" não existe`);
  if (!(doc.fontes ?? []).some((f) => TIPOS_PRIMARIOS.includes(f.tipo))) erros.push("fontes: falta fonte oficial (processo, investigação oficial ou dado oficial)");
  for (const [i, p] of (doc.pessoas ?? []).entries()) if (!p?.situacao) erros.push(`pessoas[${i}].situacao: falta a situação jurídica`);
  if (doc.revisao === "aprovada") erros.push("revisao: caso importado não pode chegar aprovado (a curadoria aprova)");
  return erros;
}

/** Os links e ids que já existem nos arquivos de entradas (publicadas e pendentes). */
function existentes() {
  const links = new Map();
  const ids = new Set();
  for (const slug of SLUGS_DOS_DOSSIES) {
    let a;
    try {
      a = JSON.parse(fs.readFileSync(path.join(PASTA_ENTRADAS, `${slug}.json`), "utf8"));
    } catch {
      continue;
    }
    for (const en of a.entradas ?? []) {
      ids.add(en.id);
      for (const f of en.fontes ?? []) links.set(chaveDoLink(f.url), en.id);
    }
  }
  return { links, ids };
}

async function lerPublicadasDoBanco() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !chave) throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  const r = await fetch(`${url}/rest/v1/rpc/vale_publicadas`, {
    method: "POST",
    headers: { apikey: chave, Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`O banco respondeu ${r.status} ao ler vale_publicadas.`);
  const linhas = await r.json();
  return Array.isArray(linhas) ? linhas : [];
}

async function mandarParaFila(doc) {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const token = process.env.VALE_CURADOR_TOKEN ?? "";
  if (!token) throw new Error("Falta VALE_CURADOR_TOKEN (token de acesso de quem tem papel curadoria ou coordenacao).");
  // O rascunho vai inteiro (com a nota para a curadoria); na aprovação, limparDoc deixa só os campos da Entrada.
  const r = await fetch(`${url}/rest/v1/rpc/vale_fila_criar`, {
    method: "POST",
    headers: { apikey: chave, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_rascunho: doc }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`vale_fila_criar respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

async function principal() {
  const arquivos = soUm
    ? [path.resolve(soUm)]
    : fs.existsSync(PASTA_NOVOS)
      ? fs.readdirSync(PASTA_NOVOS).filter((n) => n.endsWith(".json")).sort().map((n) => path.join(PASTA_NOVOS, n))
      : [];
  if (arquivos.length === 0) {
    console.log("Nenhum arquivo em content/vale-o-escrito/novos-casos/.");
    return 0;
  }

  const { links, ids } = existentes();
  if (fila) {
    for (const linha of await lerPublicadasDoBanco()) {
      ids.add(linha.id);
      for (const f of linha.doc?.fontes ?? []) links.set(chaveDoLink(f.url), linha.id);
    }
  }

  const barrados = [];
  const duplicados = [];
  const aceitos = []; // { doc, solto, origem }
  for (const arquivo of arquivos) {
    let soltos;
    try {
      soltos = lerNovos(arquivo);
    } catch (erro) {
      console.error(`Não foi possível ler ${arquivo}: ${erro.message}`);
      return 2;
    }
    const nome = path.basename(arquivo);
    for (const solto of soltos)
      for (const en of solto.entradas) {
        const doc = documentoDoCaso(en, solto);
        const erros = conferirCaso(doc);
        if (erros.length) {
          barrados.push(`${nome} / ${en?.id}: ${erros.join("; ")}`);
          continue;
        }
        if (ids.has(en.id)) {
          duplicados.push(`${nome} / ${en.id}: id já existe`);
          continue;
        }
        // Âncoras (#) apontam para a mesma página: dentro do mesmo caso não contam como duplicata.
        const repetido = [...new Set(en.fontes.map((f) => chaveDoLink(f.url)))].find((k) => links.has(k));
        if (repetido) {
          duplicados.push(`${nome} / ${en.id}: o link ${repetido} já está em ${links.get(repetido)}`);
          continue;
        }
        ids.add(en.id);
        for (const f of en.fontes) links.set(chaveDoLink(f.url), en.id);
        aceitos.push({ doc, solto, origem: nome });
      }
  }

  console.log(`${aceitos.length} caso(s) novo(s) passam nas regras; ${duplicados.length} duplicado(s); ${barrados.length} barrado(s).`);
  for (const d of duplicados) console.log(`  = ${d}`);

  if (gravar && aceitos.length) {
    const porDossie = new Map();
    for (const a of aceitos) {
      const lista = porDossie.get(a.doc.dossie) ?? [];
      lista.push(a);
      porDossie.set(a.doc.dossie, lista);
    }
    for (const [slug, lista] of porDossie) {
      const destino = path.join(PASTA_ENTRADAS, `${slug}.json`);
      let atual;
      try {
        atual = JSON.parse(fs.readFileSync(destino, "utf8"));
      } catch {
        atual = { dossie: slug, pessoas: [], organizacoes: [], ligacoes: [], entradas: [] };
      }
      for (const { doc } of lista) {
        const { pessoasPublicas, organizacoesPublicas, ligacoes, ...entrada } = doc;
        // Pessoa ou organização com o mesmo id: fica a que já estava (a curadoria confere se é a mesma).
        for (const p of pessoasPublicas) if (!atual.pessoas.some((x) => x.id === p.id)) atual.pessoas.push(p);
        for (const o of organizacoesPublicas) if (!atual.organizacoes.some((x) => x.id === o.id)) atual.organizacoes.push(o);
        for (const l of ligacoes) if (!atual.ligacoes.some((x) => x.id === l.id)) atual.ligacoes.push(l);
        atual.entradas.push({ ...entrada, revisao: "pendente-curadoria" });
      }
      try {
        fs.writeFileSync(destino, `${JSON.stringify(atual, null, 2)}\n`, "utf8");
      } catch (erro) {
        console.error(`Não foi possível gravar ${destino}: ${erro.message}`);
        return 2;
      }
      console.log(`  gravou ${lista.length} pendente(s) em entradas/${slug}.json`);
    }
  }

  if (fila && aceitos.length) {
    for (const { doc } of aceitos) {
      try {
        await mandarParaFila(doc);
        console.log(`  fila: ${doc.id}`);
      } catch (erro) {
        console.error(`  fila: ${doc.id} falhou: ${erro.message}`);
        return 2;
      }
    }
  }

  if (!gravar && !fila) console.log("Só conferência (nada gravado). Use --gravar (arquivos) ou --fila (banco).");
  if (barrados.length) {
    console.error(`\n${barrados.length} caso(s) barrado(s):`);
    for (const b of barrados) console.error(`  - ${b}`);
    return 1;
  }
  return 0;
}

// Roda só quando chamado direto (o teste importa as funções).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await principal();
}
