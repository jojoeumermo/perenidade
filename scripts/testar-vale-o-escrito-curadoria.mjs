// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere o pacote "curadoria" do Vale o Escrito: a lógica pura (lib/vale-o-escrito/curadoria.ts), o pedido de arquivo no
// Internet Archive, o exportador, o registro da função no painel e o SQL novo. Sem rede, sem navegador.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  acrescentarResposta,
  arquivoDaResposta,
  atualizarSituacao,
  conferirDoc,
  docEmBranco,
  docPublico,
  enderecoParaArquivar,
  idDaEntrada,
  LEI_13188,
  limparDoc,
  mesclarDuplicata,
  montarArquivos,
  prazoDaCorrecao,
  rascunhoDoItem,
  slugDe,
} from "../lib/vale-o-escrito/curadoria.ts";

let total = 0;
const caso = (nome, fn) => {
  fn();
  total++;
  console.log(`  ok  ${nome}`);
};
const raiz = process.cwd();
const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), "utf8");
const ARQ = "https://web.archive.org/web/20260312100000/https://reporterbrasil.org.br/exemplo";

const fonte = (extra = {}) => ({
  id: "f1",
  veiculo: "Repórter Brasil",
  tipo: "reportagem",
  titulo: "Fazenda é autuada por trabalho análogo ao de escravo",
  url: "https://reporterbrasil.org.br/exemplo",
  trecho: "A fiscalização encontrou trabalhadores alojados em barracos de lona, sem água potável.",
  data: "2026-03-10",
  acessadoEm: "2026-03-12",
  arquivoUrl: ARQ,
  ...extra,
});
const doc = (extra = {}) => ({
  id: "2026-exemplo-fazenda",
  dossie: "trabalho-escravo",
  titulo: "Fazenda autuada por trabalho análogo ao de escravo",
  resumo: "Segundo a Repórter Brasil, a fiscalização autuou a fazenda por submeter trabalhadores a condições degradantes.",
  dataDoFato: "2026-03",
  lugar: { pais: "BR", regiao: "PA", municipioIbge: "1500602", nome: "Altamira" },
  situacao: "investigado",
  confianca: "reportado",
  fontes: [fonte()],
  pessoas: [{ pessoaId: "fulano-de-tal", situacao: "investigado", papelNoCaso: "Segundo a Repórter Brasil, é dono da fazenda." }],
  organizacoes: ["fazenda-x"],
  etiquetas: ["trabalho escravo"],
  publicadoEm: "2026-03-15",
  atualizadoEm: "2026-03-15",
  pessoasPublicas: [{ id: "fulano-de-tal", nome: "Fulano de Tal", publicaNoCaso: true, papel: "proprietario_rural", fonteIds: ["f1"] }],
  organizacoesPublicas: [{ id: "fazenda-x", nome: "Fazenda X", tipo: "empresa", fonteIds: ["f1"] }],
  ligacoes: [{ id: "l1", de: { tipo: "pessoa", id: "fulano-de-tal" }, para: { tipo: "entrada", id: "2026-exemplo-fazenda" }, tipo: "citado_em", fonteIds: ["f1"], entradaId: "2026-exemplo-fazenda" }],
  ...extra,
});
const fonteNova = (extra = {}) => ({
  id: "f2",
  veiculo: "TRF-1",
  tipo: "processo",
  titulo: "Sentença absolve o proprietário",
  url: "https://portal.trf1.jus.br/exemplo",
  trecho: "O juízo julgou improcedente a denúncia por insuficiência de provas e absolveu o réu.",
  data: "2026-09-01",
  acessadoEm: "2026-09-02",
  arquivoUrl: "https://web.archive.org/web/20260902100000/https://portal.trf1.jus.br/exemplo",
  ...extra,
});

console.log("Lei 13.188/2015 e prazos");
caso("a meta é de 7 dias (art. 5º) e a decadência de 60 (art. 3º)", () => {
  assert.equal(LEI_13188.respostaDias, 7);
  assert.equal(LEI_13188.decadenciaDias, 60);
  assert.equal(LEI_13188.decisaoDoJuizHoras, 24);
  assert.match(LEI_13188.citacao, /13\.188\/2015/);
});
caso("prazoDaCorrecao: no prazo, vence hoje e vencido", () => {
  assert.deepEqual(prazoDaCorrecao("2026-11-11", "2026-11-04"), { dias: 7, estado: "no_prazo" });
  assert.deepEqual(prazoDaCorrecao("2026-11-04", "2026-11-04"), { dias: 0, estado: "vence_hoje" });
  assert.deepEqual(prazoDaCorrecao("2026-11-01", "2026-11-04"), { dias: -3, estado: "vencido" });
  assert.equal(prazoDaCorrecao("2026-03-02", "2026-02-27").dias, 3); // virada de mês sem fuso
});

console.log("Documento da entrada");
caso("slug e id da entrada", () => {
  assert.equal(slugDe("Altamira: conflito na Fazenda X!"), "altamira-conflito-na-fazenda-x");
  assert.equal(idDaEntrada("2026", "Ação em São Félix"), "2026-acao-em-sao-felix");
  assert.ok(slugDe("a".repeat(200)).length <= 80);
});
caso("conferirDoc aceita o documento completo e bate com regras.ts", () => {
  const c = conferirDoc(doc(), { publicada: true });
  assert.deepEqual(c.erros, []);
  assert.ok(c.ok);
});
caso("sem situação, sem trecho, sem data ou sem fonte: barra", () => {
  assert.ok(!conferirDoc(doc({ situacao: undefined })).ok);
  assert.ok(!conferirDoc(doc({ fontes: [fonte({ trecho: "curto" })] })).ok);
  assert.ok(!conferirDoc(doc({ fontes: [fonte({ data: "" })] })).ok);
  assert.ok(!conferirDoc(doc({ fontes: [] })).ok);
});
caso("sem 'segundo [fonte]' no resumo: barra", () => {
  const c = conferirDoc(doc({ resumo: "A fiscalização autuou a fazenda por condições degradantes de trabalho." }));
  assert.ok(c.erros.some((e) => /segundo/.test(e)));
});
caso("publicada sem arquivo do Internet Archive: barra; com arquivoFalhou: passa", () => {
  assert.ok(!conferirDoc(doc({ fontes: [fonte({ arquivoUrl: undefined })] }), { publicada: true }).ok);
  assert.ok(conferirDoc(doc({ fontes: [fonte({ arquivoUrl: undefined, arquivoFalhou: true })] }), { publicada: true }).ok);
});
caso("pessoa sem a marca 'pública no caso', sem fonte ou como vítima: barra", () => {
  assert.ok(!conferirDoc(doc({ pessoasPublicas: [{ id: "fulano-de-tal", nome: "Fulano de Tal", publicaNoCaso: false, papel: "acusado", fonteIds: ["f1"] }] })).ok);
  assert.ok(!conferirDoc(doc({ pessoasPublicas: [{ id: "fulano-de-tal", nome: "Fulano de Tal", publicaNoCaso: true, papel: "acusado", fonteIds: [] }] })).ok);
  assert.ok(!conferirDoc(doc({ pessoasPublicas: [{ id: "fulano-de-tal", nome: "Fulano de Tal", publicaNoCaso: true, papel: "vitima", fonteIds: ["f1"] }] })).ok);
  assert.ok(!conferirDoc(doc({ pessoas: [{ pessoaId: "fulano-de-tal", situacao: "investigado", papelNoCaso: "Segundo a Repórter Brasil, é testemunha do caso." }] })).ok);
  assert.ok(!conferirDoc(doc({ etiquetas: ["crianças vítimas"] })).ok);
});
caso("ligação sem fonte ou com ponta inexistente: barra", () => {
  const l = doc().ligacoes[0];
  assert.ok(!conferirDoc(doc({ ligacoes: [{ ...l, fonteIds: [] }] })).ok);
  assert.ok(!conferirDoc(doc({ ligacoes: [{ ...l, de: { tipo: "pessoa", id: "ninguem" } }] })).ok);
  assert.ok(!conferirDoc(doc({ ligacoes: [{ ...l, fonteIds: ["f9"] }] })).ok);
});
caso("docPublico só leva campos da Entrada (nada interno vaza)", () => {
  const pub = docPublico(doc({ revisor: "uuid-secreto", nomeDoCurador: "Maria", nota: "interna", pessoasPublicas: [{ id: "x" }] }));
  const texto = JSON.stringify(pub);
  for (const proibido of ["revisor", "uuid-secreto", "nomeDoCurador", "Maria", "nota", "pessoasPublicas", "organizacoesPublicas", "ligacoes"]) assert.ok(!texto.includes(`"${proibido}"`) && !texto.includes(proibido === "Maria" ? "Maria" : "@@"), proibido);
  assert.equal(pub.id, "2026-exemplo-fazenda");
});
caso("limparDoc tira campos opcionais vazios (as regras não aceitam texto vazio como 'sem valor')", () => {
  const d = limparDoc(doc({ lugar: { pais: "BR", regiao: "PA", municipioIbge: "", nome: "" }, etiquetas: ["a b", " ", ""] }));
  assert.ok(!("municipioIbge" in d.lugar) && !("nome" in d.lugar));
  assert.deepEqual(d.etiquetas, ["a b"]);
  assert.ok(conferirDoc(d, { publicada: true }).ok);
});
caso("limparDoc deixa passar só campos conhecidos: o que o robô ou o público põem no rascunho não vai para a coluna pública", () => {
  const d = limparDoc(doc({ revisor: "uuid-secreto", contato: "a@b.c", resumo_ia: "texto da IA", nota: "interna" }));
  for (const k of ["revisor", "contato", "resumo_ia", "nota"]) assert.ok(!(k in d), k);
  assert.ok(d.fontes.length > 0 && d.titulo);
});
caso("o banco também exige nota para recusar ou devolver (vale_fila_decidir e vale_correcao_decidir), nos dois arquivos SQL", () => {
  for (const f of ["supabase/install.sql", "supabase/migracoes/2026-11-vale-o-escrito.sql"]) {
    const sql = fs.readFileSync(path.join(process.cwd(), f), "utf8");
    assert.ok(/p_decisao in \('recusar', 'devolver'\) and length\(btrim\(coalesce\(p_nota/.test(sql), f);
    assert.ok(/p_estado = 'recusada' and length\(btrim\(coalesce\(p_nota/.test(sql), f);
  }
});
caso("entrada manual em branco não passa (é preciso preencher) e o rascunho da sugestão traz o link", () => {
  assert.ok(!conferirDoc(docEmBranco("2026-11-04")).ok);
  const r = rascunhoDoItem({ id: "x", origem: "publico", rascunho: {}, estado: "pendente", nota: null, criado_em: "", decidido_em: null, envio_url: "https://exemplo.org/a", envio_trecho: "um trecho qualquer da fonte pública" }, "2026-11-04");
  assert.equal(r.fontes[0].url, "https://exemplo.org/a");
  assert.equal(r.fontes[0].trecho, "um trecho qualquer da fonte pública");
});

console.log("Atualizar situação (absolvição, arquivamento)");
caso("absolvição com fonte nova: muda a situação, a data e acrescenta histórico sem nome de ninguém", () => {
  const r = atualizarSituacao(doc(), "absolvido", fonteNova(), "Segundo o TRF-1, o réu foi absolvido em primeira instância.", "2026-09-03");
  assert.ok(r.ok, r.ok ? "" : r.erros.join("; "));
  assert.equal(r.doc.situacao, "absolvido");
  assert.equal(r.doc.atualizadoEm, "2026-09-03");
  assert.equal(r.doc.fontes.length, 2);
  assert.deepEqual(r.doc.historico, [{ em: "2026-09-03", de: "investigado", para: "absolvido", fonteId: "f2", nota: "Segundo o TRF-1, o réu foi absolvido em primeira instância." }]);
  const texto = JSON.stringify(docPublico(r.doc));
  assert.ok(!/revisor|usuario|curador\"/.test(texto));
});
caso("a mesma situação, sem fonte ou sem 'segundo': recusa", () => {
  assert.ok(!atualizarSituacao(doc(), "investigado", fonteNova(), "Segundo o TRF-1, nada mudou.", "2026-09-03").ok);
  assert.ok(!atualizarSituacao(doc(), "arquivado", fonteNova({ trecho: "curto" }), "Segundo o MPF, arquivou.", "2026-09-03").ok);
  assert.ok(!atualizarSituacao(doc(), "arquivado", fonteNova(), "O caso foi arquivado.", "2026-09-03").ok);
  assert.ok(!atualizarSituacao(doc(), "arquivado", fonteNova({ id: "f1" }), "Segundo o MPF, arquivou.", "2026-09-03").ok);
});
caso("condenação exige fonte de processo", () => {
  const sem = atualizarSituacao(doc(), "condenado_1a_instancia", fonteNova({ tipo: "reportagem" }), "Segundo o TRF-1, houve condenação.", "2026-09-03");
  assert.ok(!sem.ok);
  const com = atualizarSituacao(doc(), "condenado_1a_instancia", fonteNova(), "Segundo o TRF-1, houve condenação.", "2026-09-03");
  assert.ok(com.ok, com.ok ? "" : com.erros.join("; "));
});
caso("resposta aceita fica na ficha com data", () => {
  const novo = acrescentarResposta(doc(), "direito_de_resposta", "  Nota do citado: nega a acusação.  ", "2026-11-04");
  assert.deepEqual(novo.respostas, [{ em: "2026-11-04", tipo: "direito_de_resposta", texto: "Nota do citado: nega a acusação." }]);
});

console.log("Mesclar duplicata");
caso("junta fontes (mesmo link = mesma fonte), pessoas e etiquetas; renumera ids e mantém as ligações com fonte", () => {
  const outro = doc({
    id: "2026-outro",
    etiquetas: ["denúncia"],
    fontes: [fonte({ id: "f1" }), fonte({ id: "f2", veiculo: "G1", url: "https://g1.globo.com/exemplo", titulo: "Outra reportagem" })],
    pessoas: [{ pessoaId: "sicrano", situacao: "denunciado", papelNoCaso: "Segundo o G1, é gerente." }],
    pessoasPublicas: [{ id: "sicrano", nome: "Sicrano Souza", publicaNoCaso: true, papel: "dirigente", fonteIds: ["f2"] }],
    ligacoes: [{ id: "l2", de: { tipo: "pessoa", id: "sicrano" }, para: { tipo: "entrada", id: "2026-outro" }, tipo: "citado_em", fonteIds: ["f2"], entradaId: "2026-outro" }],
  });
  const m = mesclarDuplicata(doc(), outro);
  assert.equal(m.fontes.length, 2);
  assert.equal(m.fontes[1].veiculo, "G1");
  assert.deepEqual(m.etiquetas, ["trabalho escravo", "denúncia"]);
  assert.equal(m.pessoasPublicas.length, 2);
  assert.equal(m.id, "2026-exemplo-fazenda");
  const l2 = m.ligacoes.find((l) => l.id === "l2");
  assert.equal(l2.entradaId, "2026-exemplo-fazenda");
  assert.equal(l2.para.id, "2026-exemplo-fazenda");
  assert.equal(conferirDoc(m, { publicada: true }).ok, true, conferirDoc(m, { publicada: true }).erros.join("; "));
});

console.log("Internet Archive (Save Page Now)");
caso("só links públicos http(s) viram pedido de arquivo", () => {
  assert.equal(enderecoParaArquivar("https://reporterbrasil.org.br/a?b=1"), "https://web.archive.org/save/https://reporterbrasil.org.br/a?b=1");
  for (const ruim of ["ftp://x.org/a", "javascript:alert(1)", "http://localhost:3000/x", "http://127.0.0.1/x", "http://10.0.0.5/x", "http://192.168.1.2/", "http://169.254.169.254/latest", "http://172.20.0.1/", "http://[::1]/", "http://intranet/x", "https://user:senha@site.org/x", "https://web.archive.org/web/2026/https://a.org", "não é link", "http://x.local/a"])
    assert.equal(enderecoParaArquivar(ruim), null, ruim);
  assert.equal(enderecoParaArquivar(`https://exemplo.org/${"a".repeat(2100)}`), null);
});
caso("acha o link da cópia na resposta e só aceita o do próprio Internet Archive", () => {
  const h = (o) => ({ get: (n) => o[n] ?? null });
  assert.equal(arquivoDaResposta(h({ "content-location": "/web/20260312100000/https://reporterbrasil.org.br/exemplo" })), ARQ);
  assert.equal(arquivoDaResposta(h({}), ARQ), ARQ);
  assert.equal(arquivoDaResposta(h({ location: "https://evil.example/web/20260312100000/https://a.org" })), null);
  assert.equal(arquivoDaResposta(h({ "content-location": "/web/2026/https://a.org" })), null);
  assert.equal(arquivoDaResposta(h({})), null);
});

console.log("Exportação para o site");
caso("agrupa por dossiê, tira o que é interno e deixa de fora retiradas e entradas inválidas", () => {
  const linhas = [
    { id: "2026-exemplo-fazenda", dossie: "trabalho-escravo", doc: doc({ revisor: "uuid-secreto" }) },
    { id: "2026-retirada", dossie: "trabalho-escravo", doc: doc({ id: "2026-retirada" }), retirado_em: "2026-10-01T00:00:00Z" },
    { id: "2026-sem-fonte", dossie: "crimes-ambientais", doc: doc({ id: "2026-sem-fonte", dossie: "crimes-ambientais", fontes: [] }) },
    { id: "2026-dossie-falso", dossie: "inventado", doc: doc({ id: "2026-dossie-falso", dossie: "inventado" }) },
    { id: "2026-id-trocado", dossie: "trabalho-escravo", doc: doc({ id: "outro-id" }) },
  ];
  const { arquivos, barradas } = montarArquivos(linhas);
  assert.equal(arquivos["trabalho-escravo"].entradas.length, 1);
  assert.equal(arquivos["trabalho-escravo"].pessoas[0].id, "fulano-de-tal");
  assert.equal(arquivos["trabalho-escravo"].organizacoes[0].id, "fazenda-x");
  assert.equal(arquivos["trabalho-escravo"].ligacoes.length, 1);
  assert.equal(arquivos["crimes-ambientais"].entradas.length, 0);
  assert.equal(barradas.length, 3);
  const texto = JSON.stringify(arquivos["trabalho-escravo"].entradas);
  assert.ok(!texto.includes("uuid-secreto") && !texto.includes("revisor") && !texto.includes("pessoasPublicas"));
  assert.equal(Object.keys(arquivos).length, 6);
});
caso("exportar.mjs --seco --de lê as linhas, não grava e avisa o que foi barrado", () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "vale-"));
  const arq = path.join(pasta, "linhas.json");
  fs.writeFileSync(arq, JSON.stringify([{ id: "2026-exemplo-fazenda", dossie: "trabalho-escravo", doc: doc() }, { id: "2026-ruim", dossie: "trabalho-escravo", doc: doc({ id: "2026-ruim", fontes: [] }) }]));
  const antes = ler("content", "vale-o-escrito", "entradas", "trabalho-escravo.json");
  const r = spawnSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "--import", "./scripts/carregar-ts.mjs", "scripts/vale-o-escrito/exportar.mjs", "--seco", "--de", arq], { cwd: raiz, encoding: "utf8" });
  fs.rmSync(pasta, { recursive: true, force: true });
  assert.equal(r.status, 1, r.stderr + r.stdout);
  assert.match(r.stdout, /mudaria {2}trabalho-escravo\.json \(1 entrada/);
  assert.match(r.stderr, /1 entrada\(s\) barrada/);
  assert.equal(ler("content", "vale-o-escrito", "entradas", "trabalho-escravo.json"), antes);
});

console.log("Painel, rota e banco");
caso("a função está registrada no painel para curadoria e coordenação, com guia", () => {
  const painel = ler("components", "painel", "Painel.tsx");
  assert.match(painel, /id: "vale-curadoria", nome: "Vale o Escrito: curadoria"[^\n]*can\(eu, "coordenacao", "curadoria"\)/);
  assert.match(painel, /atual\.id === "vale-curadoria" && <ValeOEscritoCuradoria/);
  assert.match(ler("components", "painel", "guias.ts"), /"vale-curadoria": \{/);
});
caso("a rota do arquivo confere o papel no banco, tem limite e não lê disco", () => {
  const rota = ler("app", "api", "vale-o-escrito", "arquivar", "route.ts");
  assert.match(rota, /vale_arquivo_pedir/);
  assert.match(rota, /enderecoParaArquivar/);
  assert.match(rota, /429/);
  assert.doesNotMatch(rota, /node:fs|readFileSync/);
});
caso("o painel pede a confirmação antes de publicar, recusar e retirar; nada de nome de curador na ficha", () => {
  const editor = ler("components", "painel", "ValeOEscritoEditor.tsx");
  const tela = ler("components", "painel", "ValeOEscrito.tsx");
  // As janelas do painel (ui/Dialogo) trocaram o window.confirm do navegador, com a mesma pergunta antes de cada ação.
  const confirma = (texto) => (texto.match(/\b(?:await\s+)?confirm(?:ar|arFrase)\(/g) ?? []).length;
  assert.ok(confirma(editor) >= 3, "editor: menos de 3 confirmações");
  assert.ok(confirma(tela) >= 3, "tela: menos de 3 confirmações");
  assert.doesNotMatch(editor + tela, /window\.confirm/);
  assert.match(editor, /vale_fila_decidir/);
  assert.match(tela, /vale_entrada_atualizar/);
  assert.match(tela, /vale_correcao_decidir/);
  for (const f of [editor, tela]) {
    assert.doesNotMatch(f, /lib\/vale-o-escrito\/dados|node:fs|readFileSync/);
    assert.doesNotMatch(f, /universidade|diploma/i);
  }
});
caso("SQL novo: funções só para a curadoria, com limite, nos dois arquivos, e o $$ de vale_doc_ok", () => {
  for (const sql of [ler("supabase", "migracoes", "2026-11-vale-o-escrito.sql"), ler("supabase", "install.sql")]) {
    for (const fn of ["vale_fila_salvar", "vale_historico_listar", "vale_arquivo_pedir"]) {
      assert.match(sql, new RegExp(`create or replace function public\\.${fn}\\(`));
      assert.match(sql, new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from anon`));
      assert.match(sql, new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to authenticated`));
    }
    assert.match(sql, /perform interno\.limite\('vale_arquivar', 40, 60\)/);
    assert.match(sql, /vale_doc_ok\(p jsonb\) returns void language plpgsql as \$\$/);
    assert.doesNotMatch(sql, /language plpgsql as \$\r?\ndeclare f jsonb/);
  }
  const bloco = ler("supabase", "migracoes", "2026-11-vale-o-escrito.sql").split("-- 16. Curadoria")[1];
  assert.match(bloco, /not interno\.curador\(\)/g);
  assert.equal((bloco.match(/not interno\.curador\(\)/g) ?? []).length, 3);
});
caso("o exportador usa pasta literal e o arquivo novo de teste está no package.json", () => {
  const exp = ler("scripts", "vale-o-escrito", "exportar.mjs");
  assert.match(exp, /path\.join\(process\.cwd\(\), "content", "vale-o-escrito", "entradas"/);
  const pacote = JSON.parse(ler("package.json"));
  assert.ok(pacote.scripts["vale-o-escrito:exportar"]);
  assert.ok(pacote.scripts["testar:vale-o-escrito-curadoria"]);
});

console.log(`\n${total} conferências passaram.`);
