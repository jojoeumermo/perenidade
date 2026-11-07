// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Vale o Escrito: confere os casos novos em content/vale-o-escrito/novos-casos/*.json (pedido "pelo menos mais 100 casos",
// NOVAS TAREFAS de 07/11/2026). Cada arquivo é um recorte com { recorte, pessoas, organizacoes, ligacoes, entradas } no
// formato de lib/vale-o-escrito/tipos.ts (as entradas podem ser de dossiês diferentes). Nada daqui é publicado: os casos
// chegam como "pendente-curadoria" e a curadoria humana aprova (decisão da coordenação: só publica com FONTE OFICIAL e
// SITUAÇÃO JURÍDICA preenchidas). O teste usa a MESMA conferência do site (dados.ts → regras.ts) e acrescenta as regras
// da casa: fonte primária, trecho curto, sem vítima/criança/testemunha, sem CPF, sem link repetido.
//
//   npm run testar:vale-o-escrito-novos-casos

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { SLUGS_DOS_DOSSIES } from "../lib/vale-o-escrito/catalogo.ts";
import { conferirArquivo } from "../lib/vale-o-escrito/dados.ts";
import { contemCpf, mencionaPapelProibido, temSegundoFonte, validarEntrada, validarPessoa } from "../lib/vale-o-escrito/regras.ts";
import { SITUACOES, TIPOS_PRIMARIOS } from "../lib/vale-o-escrito/tipos.ts";

const raiz = process.cwd();
const pasta = path.join(raiz, "content", "vale-o-escrito", "novos-casos");
let total = 0;
const caso = (nome, fn) => {
  fn();
  total++;
  console.log(`  ok  ${nome}`);
};
const lerJson = (...p) => JSON.parse(fs.readFileSync(path.join(raiz, ...p), "utf8"));
/** Link sem protocolo, "www.", barra final, "#" e utm_*: o mesmo critério do robô para "repetido". */
const chaveDoLink = (url) => {
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) if (k.startsWith("utm_")) u.searchParams.delete(k);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}${u.search}`.toLowerCase();
  } catch {
    return url;
  }
};

const arquivos = fs.existsSync(pasta) ? fs.readdirSync(pasta).filter((f) => f.endsWith(".json")).sort() : [];
const recortes = arquivos.map((nome) => ({ nome, dados: JSON.parse(fs.readFileSync(path.join(pasta, nome), "utf8")) }));

// O que já existe em content/vale-o-escrito/entradas/: ids e links (os casos novos não podem repetir nenhum).
const existentes = SLUGS_DOS_DOSSIES.map((slug) => lerJson("content", "vale-o-escrito", "entradas", `${slug}.json`));
const idsExistentes = new Set(existentes.flatMap((a) => a.entradas.map((e) => e.id)));
const linksExistentes = new Map(existentes.flatMap((a) => a.entradas.flatMap((e) => e.fontes.map((f) => [chaveDoLink(f.url), e.id]))));

caso("a pasta novos-casos existe e cada arquivo tem o formato de recorte (pessoas, organizações, ligações, entradas)", () => {
  assert.ok(recortes.length >= 1, "nenhum arquivo em content/vale-o-escrito/novos-casos/");
  for (const { nome, dados } of recortes) {
    assert.match(nome, /^[a-z0-9-]+\.json$/, nome);
    for (const chave of ["pessoas", "organizacoes", "ligacoes", "entradas"]) assert.ok(Array.isArray(dados[chave]), `${nome}: ${chave}`);
    assert.ok(dados.entradas.length > 0, `${nome}: sem entradas`);
  }
});

caso("toda entrada passa na conferência do site (dados.ts/regras.ts) como pendente, dossiê a dossiê, sem descarte", () => {
  for (const { nome, dados } of recortes) {
    for (const slug of new Set(dados.entradas.map((e) => e.dossie))) {
      assert.ok(SLUGS_DOS_DOSSIES.includes(slug), `${nome}: dossiê desconhecido ${slug}`);
      const doDossie = dados.entradas.filter((e) => e.dossie === slug);
      const ids = new Set(doDossie.map((e) => e.id));
      const lido = conferirArquivo({ dossie: slug, pessoas: dados.pessoas, organizacoes: dados.organizacoes, ligacoes: dados.ligacoes.filter((l) => ids.has(l.entradaId)), entradas: doDossie });
      assert.deepEqual(lido.descartadas, [], `${nome}/${slug}: ${lido.descartadas.join(" | ")}`);
      assert.equal(lido.entradas.length, 0, `${nome}/${slug}: caso novo saiu como publicado sem curadoria`);
      assert.equal(lido.pendentes.length, doDossie.length, `${nome}/${slug}: caso novo descartado`);
    }
    for (const en of dados.entradas) {
      const c = validarEntrada(en, { publicada: false, pessoas: dados.pessoas, organizacoesIds: dados.organizacoes.map((o) => o.id) });
      assert.ok(c.ok, `${nome}/${en.id}: ${c.erros.join("; ")}`);
    }
  }
});

caso("decisão da coordenação: toda entrada tem FONTE OFICIAL (primária) e SITUAÇÃO JURÍDICA conferida, e aguarda a curadoria", () => {
  for (const { nome, dados } of recortes) {
    for (const en of dados.entradas) {
      assert.equal(en.revisao, "pendente-curadoria", `${nome}/${en.id}: caso novo precisa da curadoria humana`);
      assert.ok(en.fontes.some((f) => TIPOS_PRIMARIOS.includes(f.tipo)), `${nome}/${en.id}: sem fonte oficial`);
      assert.ok(SITUACOES.includes(en.situacao), `${nome}/${en.id}: situação`);
      assert.match(en.situacaoConferidaEm ?? "", /^\d{4}-\d{2}-\d{2}$/, `${nome}/${en.id}: situacaoConferidaEm`);
      assert.ok((en.notaDaCuradoria ?? "").length > 40, `${nome}/${en.id}: nota da curadoria`);
      assert.ok(temSegundoFonte(en.resumo, en.fontes), `${nome}/${en.id}: resumo sem "segundo [veículo]"`);
      // Sem condenação definitiva, o resumo não afirma culpa: diz "réu", "supostamente", "sem condenação" ou "cabe recurso".
      if (en.situacao !== "condenado_transitado")
        assert.match(en.resumo, /supostamente|sem condena|não há condena|cabe recurso|recorreu|sem julgamento|não há (decisão|julgamento|denúncia)|trânsito|investigad|não diz se/i, `${nome}/${en.id}: resumo sem ressalva`);
    }
  }
});

caso("fonte: link https, trecho de até 25 palavras, datas; nunca CPF, nunca 'universidade' ou 'diploma'", () => {
  for (const { nome, dados } of recortes) {
    for (const en of dados.entradas) {
      for (const f of en.fontes) {
        assert.match(f.url, /^https:\/\//, `${nome}/${en.id}/${f.id}`);
        assert.ok(f.trecho.trim().split(/\s+/).length <= 25, `${nome}/${en.id}/${f.id}: trecho com mais de 25 palavras`);
        assert.ok(!contemCpf(f.trecho), `${nome}/${en.id}/${f.id}: CPF`);
        assert.ok(f.data <= f.acessadoEm, `${nome}/${en.id}/${f.id}: lida antes de publicada?`);
      }
      for (const campo of [en.titulo, en.resumo, ...en.etiquetas]) assert.doesNotMatch(campo, /universidade|diploma/i, `${nome}/${en.id}`);
      assert.ok(!contemCpf(`${en.titulo} ${en.resumo}`), `${nome}/${en.id}: CPF`);
    }
  }
});

caso("pessoas: só públicas no caso, com fonte e situação; nunca vítima, criança, adolescente ou testemunha (ECA arts. 17, 143, 247; LGPD art. 14)", () => {
  for (const { nome, dados } of recortes) {
    for (const p of dados.pessoas) {
      const c = validarPessoa(p);
      assert.ok(c.ok, `${nome}/${p.id}: ${c.erros.join("; ")}`);
      assert.ok(dados.entradas.some((e) => e.pessoas.some((x) => x.pessoaId === p.id)), `${nome}/${p.id}: pessoa sem caso`);
    }
    const livres = JSON.stringify(dados.entradas.flatMap((e) => [...e.etiquetas, ...e.pessoas.map((x) => x.papelNoCaso ?? "")]));
    assert.equal(mencionaPapelProibido(livres.replace(/[[\]",]/g, " ")), null, `${nome}: etiqueta ou papel com termo proibido`);
    // Pessoa física privada (não agente público) só com decisão judicial: situação de réu para cima.
    for (const en of dados.entradas)
      for (const x of en.pessoas) {
        const p = dados.pessoas.find((y) => y.id === x.pessoaId);
        if (p && !["autoridade", "agente_publico", "parlamentar", "agente_de_seguranca"].includes(p.papel))
          assert.ok(["reu", "condenado_1a_instancia", "condenado_transitado", "absolvido"].includes(x.situacao), `${nome}/${en.id}/${p.id}: pessoa privada sem decisão judicial`);
      }
  }
});

caso("ligações sempre com fonte da própria entrada; organizações citadas existem", () => {
  for (const { nome, dados } of recortes) {
    const porId = new Map(dados.entradas.map((e) => [e.id, e]));
    for (const l of dados.ligacoes) {
      const en = porId.get(l.entradaId);
      assert.ok(en, `${nome}/${l.id}: entrada inexistente`);
      for (const f of l.fonteIds) assert.ok(en.fontes.some((x) => x.id === f), `${nome}/${l.id}: fonte ${f}`);
      if (l.de.tipo === "organizacao") assert.ok(dados.organizacoes.some((o) => o.id === l.de.id), `${nome}/${l.id}: organização`);
      if (l.de.tipo === "pessoa") assert.ok(dados.pessoas.some((o) => o.id === l.de.id), `${nome}/${l.id}: pessoa`);
    }
    for (const o of dados.organizacoes) assert.ok(!o.cnpj || /^\d{14}$/.test(o.cnpj), `${nome}/${o.id}: CNPJ`);
  }
});

caso("sem repetição: id e link de fonte não repetem entre os recortes nem com os casos já cadastrados", () => {
  const ids = new Map();
  const links = new Map();
  for (const { nome, dados } of recortes) {
    for (const en of dados.entradas) {
      assert.ok(!idsExistentes.has(en.id), `${nome}/${en.id}: id já existe em entradas/`);
      assert.ok(!ids.has(en.id), `${nome}/${en.id}: id repetido (também em ${ids.get(en.id)})`);
      ids.set(en.id, nome);
      for (const f of en.fontes) {
        const k = chaveDoLink(f.url);
        assert.ok(!linksExistentes.has(k), `${nome}/${en.id}: link já usado no caso ${linksExistentes.get(k)}`);
        // O mesmo link pode sustentar mais de uma fonte dentro do MESMO caso, nunca dois casos.
        assert.ok(!links.has(k) || links.get(k) === en.id, `${nome}/${en.id}: link repetido do caso ${links.get(k)}`);
        links.set(k, en.id);
      }
    }
  }
});

caso("recorte indigenas-garimpo-barragens-ambiente (frente T12): pelo menos 25 casos, nos dossiês de povos indígenas e crimes ambientais", () => {
  const meu = recortes.find((r) => r.nome === "indigenas-garimpo-barragens-ambiente.json");
  assert.ok(meu, "arquivo da frente T12");
  assert.ok(meu.dados.entradas.length >= 25, `só ${meu.dados.entradas.length} casos`);
  assert.deepEqual([...new Set(meu.dados.entradas.map((e) => e.dossie))].sort(), ["crimes-ambientais", "povos-indigenas"]);
  // Barragens e mineração (Braskem, Vale, garimpo no Amapá), garimpo na Terra Yanomami e desmatamento com Ibama.
  const etiquetas = meu.dados.entradas.flatMap((e) => e.etiquetas.map((t) => t.toLowerCase()));
  for (const t of ["barragem", "yanomami", "desmatamento", "munduruku", "garimpo ilegal"]) assert.ok(etiquetas.includes(t), t);
});

const casos = recortes.reduce((n, r) => n + r.dados.entradas.length, 0);
console.log(`\n${total} conferências dos casos novos do Vale o Escrito passaram (${recortes.length} recorte(s), ${casos} casos pendentes de curadoria).`);
