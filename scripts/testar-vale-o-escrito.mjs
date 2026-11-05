// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere a fundação do Vale o Escrito (docs/vale-o-escrito/ESPEC.md): as regras puras (lib/vale-o-escrito/regras.ts), o
// formato dos dados em content/vale-o-escrito/, os textos nos 6 idiomas, o recurso "só pelo nome" e a migração do banco
// (conferência estática do SQL: não há Postgres aqui). Sem rede, sem navegador.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { CATALOGO_DE_FONTES, IDS_DO_CATALOGO, SLUGS_DOS_DOSSIES } from "../lib/vale-o-escrito/catalogo.ts";
import { conferirArquivo, lerDossie, lerDossies, lerTudo } from "../lib/vale-o-escrito/dados.ts";
import { menuDoObservatorio } from "../lib/vale-o-escrito/menu.ts";
import {
  dataParcialValida,
  diaValido,
  mencionaPapelProibido,
  temSegundoFonte,
  validarCorrecao,
  validarEntrada,
  validarEnvio,
  validarFonte,
  validarLigacao,
  validarLugar,
  validarPessoa,
} from "../lib/vale-o-escrito/regras.ts";
import { IDIOMAS_VE, ROTULO_SITUACAO, SITUACOES } from "../lib/vale-o-escrito/tipos.ts";
import { TEXTOS_DO_OBSERVATORIO } from "../lib/vale-o-escrito/textos.ts";
import { SO_PELO_NOME, ligado, lerRecursos } from "../lib/recursos.ts";

let total = 0;
const caso = (nome, fn) => {
  fn();
  total++;
  console.log(`  ok  ${nome}`);
};
const raiz = process.cwd();
const ler = (...partes) => fs.readFileSync(path.join(raiz, ...partes), "utf8");

// ───────────────────────────── Modelo de exemplo ─────────────────────────────
const fonte = (extra = {}) => ({
  id: "f1",
  catalogoId: "reporter-brasil",
  veiculo: "Repórter Brasil",
  tipo: "reportagem",
  titulo: "Fazenda é autuada por trabalho análogo ao de escravo",
  url: "https://reporterbrasil.org.br/exemplo",
  trecho: "A fiscalização encontrou trabalhadores alojados em barracos de lona, sem água potável.",
  data: "2026-03-10",
  acessadoEm: "2026-03-12",
  arquivoUrl: "https://web.archive.org/web/20260312100000/https://reporterbrasil.org.br/exemplo",
  ...extra,
});
const entrada = (extra = {}) => ({
  id: "2026-exemplo-fazenda",
  dossie: "trabalho-escravo",
  titulo: "Fazenda autuada por trabalho análogo ao de escravo",
  resumo: "Segundo a Repórter Brasil, a fiscalização autuou a fazenda por submeter trabalhadores a condições degradantes.",
  dataDoFato: "2026-03",
  lugar: { pais: "BR", regiao: "PA", municipioIbge: "1500602", nome: "Altamira" },
  situacao: "investigado",
  confianca: "reportado",
  fontes: [fonte()],
  pessoas: [{ pessoaId: "p1", situacao: "investigado", papelNoCaso: "Dono da fazenda, supostamente responsável pelo alojamento." }],
  organizacoes: [],
  etiquetas: ["fiscalização"],
  publicadoEm: "2026-03-15",
  atualizadoEm: "2026-03-15",
  ...extra,
});
const pessoa = (extra = {}) => ({ id: "p1", nome: "Fulano de Tal", publicaNoCaso: true, papel: "proprietario_rural", fonteIds: ["f1"], ...extra });
const valida = (c) => assert.ok(c.ok, c.erros.join(" | "));
const invalida = (c, trecho) => {
  assert.ok(!c.ok, "devia ser inválida");
  if (trecho) assert.ok(c.erros.some((e) => e.includes(trecho)), `sem erro com "${trecho}": ${c.erros.join(" | ")}`);
};

console.log("Vale o Escrito: regras");
caso("a entrada de exemplo passa (e com a pessoa e a fonte publicada)", () => {
  valida(validarEntrada(entrada()));
  valida(validarEntrada(entrada(), { publicada: true, pessoas: [pessoa()], organizacoesIds: [] }));
});
caso("entrada sem fonte, sem trecho, sem data ou sem situação é inválida", () => {
  invalida(validarEntrada(entrada({ fontes: [] })), "fontes");
  invalida(validarEntrada(entrada({ fontes: [fonte({ trecho: "" })] })), "trecho");
  invalida(validarEntrada(entrada({ fontes: [fonte({ data: "" })] })), "fonte.data");
  invalida(validarEntrada(entrada({ fontes: [fonte({ data: "2026-02-31" })] })), "fonte.data");
  invalida(validarEntrada(entrada({ situacao: undefined })), "situacao");
  invalida(validarEntrada(entrada({ situacao: "culpado" })), "situacao");
  invalida(validarEntrada(entrada({ dataDoFato: "ontem" })), "dataDoFato");
});
caso("trecho tem teto de 400 caracteres (guarda trecho, nunca a página)", () => {
  invalida(validarFonte(fonte({ trecho: "x".repeat(401) })), "trecho");
  valida(validarFonte(fonte({ trecho: "x".repeat(400) })));
});
caso("resumo precisa de \"segundo [veículo]\" de uma das fontes", () => {
  invalida(validarEntrada(entrada({ resumo: "A fazenda foi autuada por submeter trabalhadores a condições degradantes." })), "segundo");
  invalida(validarEntrada(entrada({ resumo: "Segundo outro jornal, a fazenda foi autuada por condições degradantes." })), "segundo");
  assert.equal(temSegundoFonte("SEGUNDO a reporter brasil, houve autuação.", [fonte()]), true);
});
caso("confiança: 'primaria' exige fonte primária; condenação exige decisão", () => {
  invalida(validarEntrada(entrada({ confianca: "primaria" })), "primaria");
  valida(validarEntrada(entrada({ confianca: "primaria", fontes: [fonte({ tipo: "dado_oficial", veiculo: "Repórter Brasil" })] })));
  invalida(validarEntrada(entrada({ situacao: "condenado_1a_instancia" })), "condenação exige");
  const processo = fonte({ id: "f2", tipo: "processo", veiculo: "TJPA", titulo: "Sentença", url: "https://www.tjpa.jus.br/exemplo" });
  valida(validarEntrada(entrada({ situacao: "condenado_1a_instancia", fontes: [fonte(), processo], resumo: "Segundo a Repórter Brasil e segundo o TJPA, houve condenação." })));
  invalida(validarEntrada(entrada({ situacao: "condenado_transitado", fontes: [fonte(), processo] })), "trânsito");
});
caso("arquivo do Internet Archive é exigido na entrada publicada e só aceita web.archive.org", () => {
  valida(validarEntrada(entrada({ fontes: [fonte({ arquivoUrl: undefined })] })));
  invalida(validarEntrada(entrada({ fontes: [fonte({ arquivoUrl: undefined })] }), { publicada: true }), "arquivo");
  valida(validarEntrada(entrada({ fontes: [fonte({ arquivoUrl: undefined, arquivoFalhou: true })] }), { publicada: true }));
  invalida(validarFonte(fonte({ arquivoUrl: "https://archive.ph/abc" })), "Internet Archive");
});
caso("pessoa: só com a marca \"pública no caso\", com fonte, e nunca vítima, criança ou testemunha", () => {
  valida(validarPessoa(pessoa()));
  invalida(validarPessoa(pessoa({ publicaNoCaso: false })), "publicaNoCaso");
  invalida(validarPessoa(pessoa({ publicaNoCaso: undefined })), "publicaNoCaso");
  invalida(validarPessoa(pessoa({ fonteIds: [] })), "fonteIds");
  for (const papel of ["vitima", "crianca", "adolescente", "testemunha"]) invalida(validarPessoa(pessoa({ papel })), "papel");
  invalida(validarPessoa(pessoa({ cargo: "Testemunha protegida" })), "testemunha");
  invalida(validarPessoa(pessoa({ cargo: "pai de uma vítima" })), "vitima");
  invalida(validarPessoa(pessoa({ foto: { url: "https://exemplo.org/a.jpg", credito: "", licenca: "CC BY", origem: "https://exemplo.org" } })), "foto");
  assert.equal(mencionaPapelProibido("Menor de idade ouvido"), "menor de idade");
  assert.equal(mencionaPapelProibido("Vítima do caso"), "vitima");
  assert.equal(mencionaPapelProibido("Diretor da empresa"), null);
});
caso("pessoa citada na entrada precisa existir no arquivo e ter situação e \"segundo/supostamente\"", () => {
  invalida(validarEntrada(entrada(), { pessoas: [] }), "não existe");
  invalida(validarEntrada(entrada({ pessoas: [{ pessoaId: "p1", situacao: "x" }] })), "situacao");
  invalida(validarEntrada(entrada({ pessoas: [{ pessoaId: "p1", situacao: "reu", papelNoCaso: "Dono da fazenda." }] })), "segundo");
  invalida(validarEntrada(entrada({ pessoas: [{ pessoaId: "p1", situacao: "reu", papelNoCaso: "Segundo a fonte, a vítima trabalhava lá." }] })), "menciona");
});
caso("situação de encerramento (absolvido, arquivado) pede a data da atualização", () => {
  valida(validarEntrada(entrada({ situacao: "absolvido", atualizadoEm: "2026-09-01" })));
  invalida(validarEntrada(entrada({ situacao: "arquivado", atualizadoEm: "" })), "atualizadoEm");
  invalida(validarEntrada(entrada({ atualizadoEm: "2026-01-01" })), "anterior");
});
caso("lugar: país → UF → município IBGE conferidos entre si", () => {
  valida(validarLugar({ pais: "BR" }));
  valida(validarLugar({ pais: "BR", regiao: "PA", municipioIbge: "1500602" }));
  invalida(validarLugar({ pais: "BR", regiao: "SP", municipioIbge: "1500602" }), "não pertence");
  invalida(validarLugar({ pais: "BR", regiao: "XX" }), "UF");
  invalida(validarLugar({ pais: "BR", regiao: "PA", municipioIbge: "150" }), "7 dígitos");
  invalida(validarLugar({ pais: "AR", regiao: "B", municipioIbge: "1500602" }), "só vale no Brasil");
});
caso("datas: dia real, e parcial (ano, mês)", () => {
  assert.equal(diaValido("2024-02-29"), true);
  assert.equal(diaValido("2023-02-29"), false);
  assert.equal(dataParcialValida("2026"), true);
  assert.equal(dataParcialValida("2026-13"), false);
});
caso("ligação: exige fonte, nós válidos e proíbe laço", () => {
  const lig = { id: "l1", de: { tipo: "pessoa", id: "p1" }, para: { tipo: "organizacao", id: "o1" }, tipo: "dirige", fonteIds: ["f1"], entradaId: "2026-exemplo-fazenda" };
  valida(validarLigacao(lig, ["f1"]));
  invalida(validarLigacao({ ...lig, fonteIds: [] }), "fonteIds");
  invalida(validarLigacao({ ...lig, fonteIds: ["zz"] }, ["f1"]), "não existe");
  invalida(validarLigacao({ ...lig, para: lig.de }), "si mesmo");
  invalida(validarLigacao({ ...lig, tipo: "ama" }), "tipo");
  invalida(validarLigacao({ ...lig, rotulo: "ajudou a vítima" }), "rotulo");
});
caso("correção: direito de resposta exige contato; isca e CPF barram", () => {
  const c = { entradaId: "2026-exemplo-fazenda", tipo: "correcao", texto: "O nome da fazenda está errado; o correto é Fazenda Esperança." };
  valida(validarCorrecao(c));
  invalida(validarCorrecao({ ...c, tipo: "direito_de_resposta" }), "contato");
  invalida(validarCorrecao({ ...c, tipo: "direito_de_resposta", contato: "fulano@exemplo.org" }), "nome");
  valida(validarCorrecao({ ...c, tipo: "direito_de_resposta", contato: "fulano@exemplo.org", nome: "Fulano de Tal" }));
  invalida(validarCorrecao({ ...c, site: "http://spam" }), "isca");
  invalida(validarCorrecao({ ...c, texto: "Meu CPF é 123.456.789-09 e o dado está errado." }), "CPF");
  invalida(validarCorrecao({ ...c, texto: "curto" }), "texto");
});
caso("envio do público: aviso lido, link válido, sem isca, sem spam", () => {
  const v = { url: "https://exemplo.org/relatorio", descricao: "Relatório mostra a decisão do tribunal.", leuOAviso: true };
  valida(validarEnvio(v));
  invalida(validarEnvio({ ...v, leuOAviso: false }), "aviso");
  invalida(validarEnvio({ ...v, url: "javascript:alert(1)" }), "url");
  invalida(validarEnvio({ ...v, site: "x" }), "isca");
  invalida(validarEnvio({ ...v, descricao: "veja http://a.com http://b.com http://c.com http://d.com" }), "spam");
  invalida(validarEnvio({ ...v, dossie: "inexistente" }), "dossie");
});

console.log("Vale o Escrito: dados e catálogo");
caso("catálogo: ids únicos e de formato seguro", () => {
  assert.equal(new Set(IDS_DO_CATALOGO).size, CATALOGO_DE_FONTES.length);
  for (const f of CATALOGO_DE_FONTES) assert.match(f.id, /^[a-z0-9-]{2,60}$/);
  assert.equal(CATALOGO_DE_FONTES.length, 48);
});
caso("dossies.json: os 6 dossiês, na ordem, com título e descrição nos 6 idiomas", () => {
  const dossies = lerDossies();
  assert.deepEqual(dossies.map((d) => d.slug), [...SLUGS_DOS_DOSSIES]);
  for (const d of dossies) {
    for (const idioma of IDIOMAS_VE) {
      assert.ok(d.titulo[idioma], `${d.slug}: título ${idioma}`);
      assert.ok(d.descricao[idioma], `${d.slug}: descrição ${idioma}`);
    }
    assert.ok(["amarelo", "azul", "vermelho"].includes(d.cor));
    assert.ok(d.temas.length > 0);
  }
  assert.deepEqual(dossies.map((d) => d.ordem), [1, 2, 3, 4, 5, 6]);
});
caso("entradas/<dossiê>.json: um arquivo por dossiê, todas as entradas passam nas regras", () => {
  for (const slug of SLUGS_DOS_DOSSIES) {
    const bruto = JSON.parse(ler("content", "vale-o-escrito", "entradas", `${slug}.json`));
    assert.equal(bruto.dossie, slug);
    for (const chave of ["pessoas", "organizacoes", "ligacoes", "entradas"]) assert.ok(Array.isArray(bruto[chave]), `${slug}.${chave}`);
    const lido = lerDossie(slug);
    assert.deepEqual(lido.descartadas, [], `${slug}: ${lido.descartadas.join(" | ")}`);
    assert.equal(lido.entradas.length + lido.pendentes.length, bruto.entradas.length);
  }
  assert.equal(lerTudo().length, 6);
  assert.deepEqual(lerDossie("../../package").entradas, [], "slug fora da lista nunca vira caminho");
});
caso("conferirArquivo descarta entrada ruim, pessoa sem marca e ligação sem fonte", () => {
  const bom = entrada({ fontes: [fonte()] });
  const lido = conferirArquivo({
    dossie: "trabalho-escravo",
    pessoas: [pessoa(), pessoa({ id: "p2", publicaNoCaso: false })],
    organizacoes: [],
    ligacoes: [
      { id: "l1", de: { tipo: "pessoa", id: "p1" }, para: { tipo: "entrada", id: bom.id }, tipo: "citado_em", fonteIds: ["f1"], entradaId: bom.id },
      { id: "l2", de: { tipo: "pessoa", id: "p1" }, para: { tipo: "entrada", id: bom.id }, tipo: "citado_em", fonteIds: [], entradaId: bom.id },
    ],
    entradas: [bom, entrada({ id: "2026-ruim", fontes: [] }), entrada({ id: "2026-com-p2", pessoas: [{ pessoaId: "p2", situacao: "reu", papelNoCaso: "Supostamente dono." }] })],
  });
  assert.deepEqual(lido.entradas.map((x) => x.id), [bom.id]);
  assert.deepEqual(lido.pessoas.map((x) => x.id), ["p1"]);
  assert.deepEqual(lido.ligacoes.map((x) => x.id), ["l1"]);
  assert.equal(lido.descartadas.length, 4);
});

console.log("Vale o Escrito: textos e situação");
caso("os rótulos de situação em pt são os da ESPEC e o JSON em pt os repete", () => {
  assert.equal(SITUACOES.length, 8);
  const pt = TEXTOS_DO_OBSERVATORIO.pt;
  for (const s of SITUACOES) assert.equal(pt.situacao[s], ROTULO_SITUACAO[s]);
});
caso("i18n: as mesmas chaves nos 6 idiomas, sem valor vazio", () => {
  const chaves = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? chaves(v, `${p}${k}.`) : [`${p}${k}`]));
  const base = chaves(TEXTOS_DO_OBSERVATORIO.pt).sort();
  for (const idioma of IDIOMAS_VE) {
    const arquivo = JSON.parse(ler("i18n", "vale-o-escrito", `${idioma}.json`));
    assert.deepEqual(chaves(arquivo).sort(), base, idioma);
    for (const k of chaves(arquivo)) assert.ok(k.split(".").reduce((a, c) => a[c], arquivo).trim() !== "", `${idioma}: ${k} vazio`);
  }
});
caso("o texto da interface nunca diz universidade nem diploma", () => {
  for (const idioma of IDIOMAS_VE) assert.doesNotMatch(ler("i18n", "vale-o-escrito", `${idioma}.json`), /universidade|diploma/i);
});
caso("menu: um rótulo por idioma", () => {
  for (const idioma of IDIOMAS_VE) assert.ok(menuDoObservatorio(idioma).rotulo.length > 3);
  assert.equal(menuDoObservatorio("xx").rotulo, "Vale o Escrito");
});

console.log("Vale o Escrito: recurso só pelo nome");
caso("'todos' não liga; só o nome liga; '-nome' desliga", () => {
  assert.ok(SO_PELO_NOME.includes("vale-o-escrito"));
  assert.equal(ligado("vale-o-escrito", lerRecursos("")), false);
  assert.equal(ligado("vale-o-escrito", lerRecursos("todos")), false);
  assert.equal(ligado("vale-o-escrito", lerRecursos("todos,vale-o-escrito")), true);
  assert.equal(ligado("vale-o-escrito", lerRecursos("vale-o-escrito,-vale-o-escrito")), false);
});
caso("a rota existe, o layout dá 404 desligado e não lê disco; o layout raiz não importa o módulo de dados", () => {
  assert.match(ler("app", "[lang]", "vale-o-escrito", "layout.tsx"), /notFound\(\)/);
  assert.doesNotMatch(ler("app", "[lang]", "vale-o-escrito", "layout.tsx"), /^import .*(dados|node:fs)/m);
  assert.doesNotMatch(ler("app", "[lang]", "layout.tsx"), /vale-o-escrito/);
  assert.match(ler("lib", "vale-o-escrito", "dados.ts"), /path\.join\(process\.cwd\(\), "content", "vale-o-escrito"/);
  assert.match(ler("components", "NavLinks.tsx"), /ligado\("vale-o-escrito"\)/);
  assert.match(ler("lib", "secoes-do-site.ts"), /se\("vale-o-escrito"/);
});
caso("lib/vale-o-escrito/{tipos,regras,catalogo,menu,textos}.ts não usam \"@/\"", () => {
  for (const arq of ["tipos", "regras", "catalogo", "menu", "textos", "dados"]) assert.doesNotMatch(ler("lib", "vale-o-escrito", `${arq}.ts`), /from "@\//, arq);
});

console.log("Vale o Escrito: migração do banco (conferência estática)");
caso("tabelas vale_*, RLS ligada, nenhuma no esquema public, aviso por Broadcast (sem publicação do Realtime)", () => {
  const sql = ler("supabase", "migracoes", "2026-11-vale-o-escrito.sql");
  const tabelas = [...sql.matchAll(/create table if not exists ((?:interno|public)\.vale_\w+)/g)].map((m) => m[1]);
  assert.deepEqual(tabelas.sort(), ["interno.vale_correcoes", "interno.vale_entradas", "interno.vale_envios", "interno.vale_fila", "interno.vale_historico", "interno.vale_sal", "interno.vale_sugestoes"]);
  for (const t of tabelas) assert.match(sql, new RegExp(`alter table ${t.replace(".", "\\.")} enable row level security`), t);
  for (const t of tabelas.filter((x) => x.startsWith("interno."))) assert.match(sql, new RegExp(`revoke all on ${t.replace(".", "\\.")} from public`), t);
  assert.doesNotMatch(sql, /add table/i);
  assert.doesNotMatch(sql, /create policy|grant (select|insert|update|delete)[^;]*vale_entradas/i);
  assert.match(sql, /realtime\.send/);
  assert.match(sql, /to_regprocedure\('realtime\.send\(jsonb,text,text,boolean\)'\)/);
  assert.match(sql, /'mudou', 'vale-o-escrito', false/);
  for (const f of ["vale_publicadas", "vale_publicada"]) {
    assert.match(sql, new RegExp(String.raw`function public\.${f}[\s\S]*?security definer set search_path = interno, pg_temp`), f);
    assert.match(sql, new RegExp(String.raw`grant execute on function public\.${f}\(text\) to anon, authenticated, service_role`), f);
  }
});
caso("função do público: só enviar e corrigir; robô só o serviço; curadoria confere interno.curador()", () => {
  const sql = ler("supabase", "migracoes", "2026-11-vale-o-escrito.sql");
  assert.match(sql, /grant execute on function public\.vale_enviar\(jsonb\) to anon, authenticated/);
  assert.match(sql, /grant execute on function public\.vale_corrigir\(jsonb\) to anon, authenticated/);
  assert.match(sql, /grant execute on function public\.vale_robo_sugerir\(jsonb\) to service_role/);
  assert.match(sql, /function public\.vale_robo_sugerir[\s\S]*?interno\.servico\(\)/);
  for (const f of ["vale_fila_listar", "vale_fila_decidir", "vale_fila_criar", "vale_entrada_atualizar", "vale_entrada_retirar", "vale_correcoes_listar", "vale_correcao_decidir"])
    assert.match(sql, new RegExp(`function public\\.${f}[\\s\\S]*?interno\\.curador\\(\\)`), f);
  for (const f of ["vale_enviar", "vale_corrigir"]) assert.match(sql, new RegExp(`function public\\.${f}[\\s\\S]*?interno\\.limite\\(`), f);
});
caso("sem IP cru: o envio e a correção guardam só o hash com sal do dia", () => {
  const sql = ler("supabase", "migracoes", "2026-11-vale-o-escrito.sql");
  assert.match(sql, /origem_hash text not null/);
  assert.match(sql, /interno\.vale_hash_origem\(\)/);
  assert.doesNotMatch(sql, /\bip\b\s+(text|inet)/i);
  assert.match(sql, /vale_historico só aceita acréscimo/);
});
caso("o mesmo bloco está no fim do install.sql", () => {
  const sql = ler("supabase", "migracoes", "2026-11-vale-o-escrito.sql").replace(/\r\n/g, "\n").trim();
  let install = ler("supabase", "install.sql").replace(/\r\n/g, "\n").trim();
  // Só os 10 blocos da Rede v2 e os 5 do lote seguinte podem vir depois dele; cada um inteiro, do último para o primeiro.
  for (const n of ["progresso-qr", "backend-2", "backend-1", "controles", "eixos-equipe", "departamentos-termos", "integracao", "moderacao", "avisos", "comunidades", "descoberta", "conversa", "publicar", "perfil", "consertos", "fundacao"]) {
    const bloco = ler("supabase", "migracoes", `2026-11-${/^(backend|controles|eixos|departamentos|progresso)/.test(n) ? n : `rede-${n}`}.sql`).replace(/\r\n/g, "\n").trim();
    assert.ok(install.endsWith(bloco), `install.sql não termina com a migração rede-${n}`);
    install = install.slice(0, -bloco.length).trim();
  }
  assert.ok(install.endsWith(sql), "install.sql não termina com a migração");
});
caso("a ESPEC existe e nomeia os 6 pacotes", () => {
  const espec = ler("docs", "vale-o-escrito", "ESPEC.md");
  for (const pacote of ["visual", "mapa", "robo", "curadoria", "publico", "fontes-e-dossies"]) assert.match(espec, new RegExp(`\\b${pacote}\\b`), pacote);
});

console.log("Vale o Escrito: fontes e dossiês (pacote fontes-e-dossies)");
const lerJson = (...partes) => JSON.parse(ler(...partes));
caso("fontes.json: as 48 fontes do catálogo, com tipo, acesso, licença e a data da conferência", () => {
  const { fontes } = lerJson("content", "vale-o-escrito", "fontes.json");
  assert.deepEqual(fontes.map((f) => f.id).sort(), [...IDS_DO_CATALOGO].sort());
  for (const f of fontes) {
    const cat = CATALOGO_DE_FONTES.find((c) => c.id === f.id);
    assert.equal(f.tipo, cat.grupo, `${f.id}: tipo diferente do grupo do catálogo`);
    assert.ok(typeof f.nome === "string" && f.nome.length > 1, `${f.id}: nome`);
    assert.match(f.url, /^https?:\/\/[^\s]+\.[^\s]+/, `${f.id}: url`);
    for (const campo of ["rss", "api"]) assert.ok(f[campo] === null || (typeof f[campo] === "string" && f[campo].length > 8), `${f.id}: ${campo}`);
    assert.ok(typeof f.acesso === "string" && f.acesso.length > 2, `${f.id}: acesso`);
    assert.ok([true, false, "a_confirmar"].includes(f.pedeCadastro), `${f.id}: pedeCadastro`);
    assert.ok(typeof f.licenca === "string" && f.licenca.length > 10, `${f.id}: licença`);
    assert.ok(typeof f.observacao === "string" && f.observacao.length > 10, `${f.id}: observação`);
    assert.ok(["conferido", "parcial", "nao_respondeu"].includes(f.verificacao?.estado), `${f.id}: estado da conferência`);
    assert.ok(diaValido(f.verificacao?.data), `${f.id}: data da conferência`);
    if (f.rss === null && f.acesso === "rss") assert.fail(`${f.id}: acesso 'rss' sem endereço de RSS`);
  }
  assert.doesNotMatch(ler("content", "vale-o-escrito", "fontes.json"), /universidade|diploma/i);
});
caso("CADASTROS-PARA-O-JONATHAN.md cita toda fonte que pede cadastro (ou talvez peça)", () => {
  const { fontes } = lerJson("content", "vale-o-escrito", "fontes.json");
  const doc = ler("docs", "vale-o-escrito", "CADASTROS-PARA-O-JONATHAN.md");
  for (const f of fontes.filter((x) => x.pedeCadastro !== false)) assert.ok(doc.includes(f.nome.split(" (")[0]) || doc.includes(f.id), `${f.id} falta no documento de cadastros`);
  assert.doesNotMatch(doc, /universidade|diploma/i);
  assert.doesNotMatch(doc, /(senha|chave|token)\s*[:=]\s*\S{12,}/i, "nada de credencial escrita no documento");
});
caso("apresentacoes.json: 6 dossiês, texto nos 6 idiomas, fontes do catálogo e número com fonte, ano e endereço", () => {
  const ap = lerJson("content", "vale-o-escrito", "apresentacoes.json");
  assert.deepEqual(Object.keys(ap.dossies), [...SLUGS_DOS_DOSSIES]);
  for (const slug of SLUGS_DOS_DOSSIES) {
    const d = ap.dossies[slug];
    for (const campo of ["oQueE", "porQueImporta"]) for (const idioma of IDIOMAS_VE) assert.ok(d[campo][idioma]?.trim().length > 20, `${slug}.${campo}.${idioma}`);
    assert.ok(d.fontesPrincipais.length >= 5);
    for (const id of d.fontesPrincipais) assert.ok(IDS_DO_CATALOGO.includes(id), `${slug}: ${id} fora do catálogo`);
    assert.ok(d.dados.length >= 1, `${slug}: sem dado agregado`);
    for (const x of d.dados) {
      assert.ok(x.rotulo.pt && /\d/.test(x.valor), `${slug}: rótulo e valor com número`);
      assert.ok(Number.isInteger(x.ano) && x.ano >= 2000 && x.ano <= 2100, `${slug}: ano`);
      assert.ok(IDS_DO_CATALOGO.includes(x.fonteId), `${slug}: fonteId`);
      assert.ok(["oficial", "reportado"].includes(x.nivel), `${slug}: nível`);
      assert.match(x.url, /^https:\/\//, `${slug}: url`);
      assert.ok(diaValido(x.lidoEm), `${slug}: lidoEm`);
    }
    assert.ok(d.limites.pt.length > 40, `${slug}: limites`);
  }
  assert.doesNotMatch(ler("content", "vale-o-escrito", "apresentacoes.json"), /universidade|diploma/i);
});
caso("casos iniciais: de 2 a 5 por dossiê, todos 'pendente-curadoria' e NENHUM publicado", () => {
  let total = 0;
  const ids = new Set();
  for (const slug of SLUGS_DOS_DOSSIES) {
    const lido = lerDossie(slug);
    assert.deepEqual(lido.descartadas, [], `${slug}: ${lido.descartadas.join(" | ")}`);
    assert.equal(lido.entradas.length, 0, `${slug}: caso pendente saiu como publicado`);
    assert.ok(lido.pendentes.length >= 2 && lido.pendentes.length <= 5, `${slug}: ${lido.pendentes.length} casos`);
    for (const en of lido.pendentes) {
      assert.equal(en.revisao, "pendente-curadoria", en.id);
      assert.ok(!ids.has(en.id), `id repetido: ${en.id}`);
      ids.add(en.id);
      total++;
    }
  }
  assert.ok(total >= 15, `só ${total} casos`);
});
caso("casos iniciais: fonte com link, data e trecho de até 25 palavras; situação escrita e conferida; 'segundo [fonte]'", () => {
  for (const slug of SLUGS_DOS_DOSSIES) {
    for (const en of lerDossie(slug).pendentes) {
      assert.ok(SITUACOES.includes(en.situacao), en.id);
      assert.ok(diaValido(en.situacaoConferidaEm), `${en.id}: situacaoConferidaEm`);
      assert.ok(en.notaDaCuradoria && en.notaDaCuradoria.length > 40, `${en.id}: nota da curadoria`);
      assert.ok(temSegundoFonte(en.resumo, en.fontes), `${en.id}: resumo sem "segundo [veículo]"`);
      for (const f of en.fontes) {
        assert.match(f.url, /^https:\/\//, `${en.id}/${f.id}: url`);
        assert.ok(f.trecho.trim().split(/\s+/).length <= 25, `${en.id}/${f.id}: trecho com mais de 25 palavras`);
        assert.ok(diaValido(f.data) && diaValido(f.acessadoEm), `${en.id}/${f.id}: datas`);
        assert.equal(f.arquivoUrl, undefined, `${en.id}/${f.id}: arquivo do Internet Archive só se faz na aprovação`);
      }
      for (const campo of [en.titulo, en.resumo, ...en.etiquetas]) assert.doesNotMatch(campo, /universidade|diploma/i, en.id);
      // Entrada com absolvição ou arquivamento: a data da atualização é a da ficha.
      if (["absolvido", "arquivado"].includes(en.situacao)) assert.ok(diaValido(en.atualizadoEm));
    }
  }
});
caso("casos iniciais: só pessoa já pública no caso, nunca vítima, criança ou testemunha, e ligação sempre com fonte", () => {
  for (const slug of SLUGS_DOS_DOSSIES) {
    const bruto = lerJson("content", "vale-o-escrito", "entradas", `${slug}.json`);
    for (const p of bruto.pessoas) {
      valida(validarPessoa(p));
      assert.equal(p.publicaNoCaso, true);
      assert.equal(mencionaPapelProibido(`${p.nome} ${p.papel} ${p.cargo ?? ""}`), null, p.id);
    }
    const textos = JSON.stringify(bruto.entradas.flatMap((e) => [...e.etiquetas, ...e.pessoas.map((x) => x.papelNoCaso ?? "")]));
    assert.equal(mencionaPapelProibido(textos.replace(/[\[\]",]/g, " ")), null, `${slug}: etiqueta ou papel com termo proibido`);
    const lido = lerDossie(slug);
    assert.equal(lido.ligacoesPendentes.length, bruto.ligacoes.length, `${slug}: ligação descartada`);
    for (const l of bruto.ligacoes) assert.ok(l.fonteIds.length > 0, l.id);
    // Quem só aparece em caso pendente não sai nas listas publicadas.
    assert.deepEqual(lido.pessoas, [], `${slug}: pessoa de caso pendente vazou`);
    assert.deepEqual(lido.organizacoes, [], `${slug}: organização de caso pendente vazou`);
    assert.deepEqual(lido.ligacoes, [], `${slug}: ligação de caso pendente vazou`);
  }
});
caso("dados.ts: 'pendente-curadoria' nunca sai como publicada, mesmo passando nas regras", () => {
  const pendente = entrada({ revisao: "pendente-curadoria", fontes: [fonte({ arquivoUrl: undefined })] });
  const lido = conferirArquivo({ dossie: "trabalho-escravo", pessoas: [pessoa()], organizacoes: [], ligacoes: [], entradas: [pendente] });
  assert.deepEqual(lido.entradas, []);
  assert.deepEqual(lido.pendentes.map((x) => x.id), [pendente.id]);
  assert.deepEqual(lido.pessoas, [], "pessoa só de caso pendente não é publicada");
  // A mesma entrada, sem a marca, sem o arquivo do Internet Archive, é descartada (publicada exige o arquivo).
  const sem = conferirArquivo({ dossie: "trabalho-escravo", pessoas: [pessoa()], organizacoes: [], ligacoes: [], entradas: [entrada({ fontes: [fonte({ arquivoUrl: undefined })] })] });
  assert.equal(sem.entradas.length, 0);
  assert.equal(sem.descartadas.length, 1);
});

caso("integração: sitemap e menu só com o recurso ligado; i18n e ficha fecham", () => {
  const mapa = fs.readFileSync(path.join(process.cwd(), "app", "sitemap.ts"), "utf8");
  assert.match(mapa, /ligado\("vale-o-escrito"\)[^\n]*\/vale-o-escrito\/sobre/);
  assert.doesNotMatch(mapa, /vale-o-escrito\/(enviar|correcao)/, "enviar e correção são noindex: fora do mapa");
  const lista = fs.readFileSync(path.join(process.cwd(), "lib", "secoes-do-site.ts"), "utf8");
  assert.match(lista, /se\("vale-o-escrito"/);
  const nav = fs.readFileSync(path.join(process.cwd(), "components", "NavLinks.tsx"), "utf8");
  assert.match(nav, /ligado\("vale-o-escrito"\)/);
  const achata = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? achata(v, `${p}${k}.`) : [`${p}${k}`]));
  const base = achata(JSON.parse(fs.readFileSync(path.join(process.cwd(), "i18n", "vale-o-escrito", "pt.json"), "utf8")));
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const outra = new Set(achata(JSON.parse(fs.readFileSync(path.join(process.cwd(), "i18n", "vale-o-escrito", `${l}.json`), "utf8"))));
    assert.deepEqual(base.filter((k) => !outra.has(k)), [], `${l}: faltam chaves`);
  }
  const pagina = fs.readFileSync(path.join(process.cwd(), "app", "[lang]", "vale-o-escrito", "correcao", "[id]", "page.tsx"), "utf8");
  assert.match(pagina, /tipoInicial/, "a ficha manda ?tipo= e a página lê");
  const fontes = fs.readFileSync(path.join(process.cwd(), "content", "vale-o-escrito", "fontes.json"), "utf8");
  assert.doesNotMatch(fontes, /almapreta\.com[^.]/, "Alma Preta só em almapreta.com.br");
});

console.log(`\n${total} conferências do Vale o Escrito passaram.`);
