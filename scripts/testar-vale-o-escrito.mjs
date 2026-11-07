// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere a fundação do Vale o Escrito (docs/vale-o-escrito/ESPEC.md): as regras puras (lib/vale-o-escrito/regras.ts), o
// formato dos dados em content/vale-o-escrito/, os textos nos 6 idiomas, o recurso "só pelo nome" e a migração do banco
// (conferência estática do SQL: não há Postgres aqui). Sem rede, sem navegador.
import assert from "node:assert/strict";
import fs from "node:fs";
import { semPosteriores } from "./install-posteriores.mjs";
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
  // As migrações datadas (AAAAMMDD-*.sql) vêm por último, inteiras: saem primeiro (scripts/install-posteriores.mjs).
  let install = semPosteriores(ler("supabase", "install.sql"));
  // Só os 10 blocos da Rede v2 e os 5 do lote seguinte podem vir depois dele; cada um inteiro, do último para o primeiro.
  for (const n of ["alumia", "progresso-qr", "backend-2", "backend-1", "controles", "eixos-equipe", "departamentos-termos", "integracao", "moderacao", "avisos", "comunidades", "descoberta", "conversa", "publicar", "perfil", "consertos", "fundacao"]) {
    const bloco = ler("supabase", "migracoes", `2026-11-${/^(backend|controles|eixos|departamentos|progresso|alumia)/.test(n) ? n : `rede-${n}`}.sql`).replace(/\r\n/g, "\n").trim();
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
caso("casos iniciais: de 2 a 5 por dossiê, todos 'aprovada', com arquivo do Internet Archive e publicados", () => {
  let total = 0;
  const ids = new Set();
  for (const slug of SLUGS_DOS_DOSSIES) {
    const lido = lerDossie(slug);
    const bruto = lerJson("content", "vale-o-escrito", "entradas", `${slug}.json`);
    assert.deepEqual(lido.descartadas, [], `${slug}: ${lido.descartadas.join(" | ")}`);
    assert.equal(lido.pendentes.length, 0, `${slug}: caso inicial ainda pendente`);
    assert.equal(lido.entradas.length, bruto.entradas.length, `${slug}: caso aprovado não saiu como publicado`);
    assert.ok(lido.entradas.length >= 2 && lido.entradas.length <= 5, `${slug}: ${lido.entradas.length} casos`);
    for (const en of lido.entradas) {
      assert.equal(en.revisao, "aprovada", en.id);
      valida(validarEntrada(en, { publicada: true, pessoas: bruto.pessoas, organizacoesIds: bruto.organizacoes.map((o) => o.id) }));
      for (const f of en.fontes)
        assert.ok(/^https:\/\/web\.archive\.org\/web\/\d{4,14}\/https?:\/\//.test(f.arquivoUrl ?? "") || f.arquivoFalhou === true, `${en.id}/${f.id}: sem arquivo do Internet Archive`);
      assert.ok(!ids.has(en.id), `id repetido: ${en.id}`);
      ids.add(en.id);
      total++;
    }
  }
  assert.ok(total >= 15, `só ${total} casos`);
});
caso("casos iniciais: fonte com link, data e trecho de até 25 palavras; situação escrita e conferida; 'segundo [fonte]'", () => {
  for (const slug of SLUGS_DOS_DOSSIES) {
    for (const en of lerDossie(slug).entradas) {
      assert.ok(SITUACOES.includes(en.situacao), en.id);
      assert.ok(diaValido(en.situacaoConferidaEm), `${en.id}: situacaoConferidaEm`);
      assert.ok(en.notaDaCuradoria && en.notaDaCuradoria.length > 40, `${en.id}: nota da curadoria`);
      assert.ok(temSegundoFonte(en.resumo, en.fontes), `${en.id}: resumo sem "segundo [veículo]"`);
      for (const f of en.fontes) {
        assert.match(f.url, /^https:\/\//, `${en.id}/${f.id}: url`);
        assert.ok(f.trecho.trim().split(/\s+/).length <= 25, `${en.id}/${f.id}: trecho com mais de 25 palavras`);
        assert.ok(diaValido(f.data) && diaValido(f.acessadoEm), `${en.id}/${f.id}: datas`);
        assert.ok(f.arquivoUrl || f.arquivoFalhou === true, `${en.id}/${f.id}: aprovada exige o arquivo do Internet Archive (ou arquivoFalhou)`);
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
    assert.equal(lido.ligacoes.length, bruto.ligacoes.length, `${slug}: ligação descartada`);
    assert.deepEqual(lido.ligacoesPendentes, [], `${slug}: ligação ainda pendente`);
    for (const l of bruto.ligacoes) assert.ok(l.fonteIds.length > 0, l.id);
    // Casos aprovados: as pessoas e organizações citadas saem nas listas publicadas (só as que passam nas regras).
    assert.equal(lido.pessoas.length, bruto.pessoas.length, `${slug}: pessoa descartada`);
    assert.equal(lido.organizacoes.length, bruto.organizacoes.length, `${slug}: organização descartada`);
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

// ── Página própria, letras, rede viva e sons (pedido da coordenação de 05/11/2026) ──────────────────────────────────
const semComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const arquivosDe = (pasta, exts) => {
  const fora = [];
  const andar = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) andar(p);
      else if (exts.some((x) => e.name.endsWith(x))) fora.push(p);
    }
  };
  andar(path.join(raiz, pasta));
  return fora;
};

caso("página própria: todas as rotas do Vale saem da casca do site e do app, com um único 'Voltar ao site'", () => {
  const lay = ler("app", "[lang]", "vale-o-escrito", "layout.tsx");
  assert.match(lay, /notFound\(\)/, "desligado continua 404");
  assert.match(lay, /<MolduraDoVale/);
  const mol = ler("components", "vale-o-escrito", "Moldura.tsx");
  for (const casca of [".cabecalho-site", ".faixa-de-avisos", ".barra-do-celular", ".abas-do-celular", ".rodape-do-site"]) assert.ok(mol.includes(`"${casca}"`), `esconde ${casca}`);
  assert.match(mol, /display: none !important/);
  assert.equal((semComentarios(mol).match(/className="ve-voltar-ao-site"/g) ?? []).length, 1, "um único botão de voltar");
  assert.match(mol, /aria-label=\{s\.voltarAoSiteAria\}/);
  assert.match(mol, /href=\{site\}/);
  assert.match(mol, /<NavDoVale/);
  assert.match(mol, /<BotaoDeSom/);
  // A moldura não traz a casca do site para dentro (nem cabeçalho nem rodapé).
  for (const f of arquivosDe("components/vale-o-escrito", [".tsx", ".ts"])) assert.doesNotMatch(fs.readFileSync(f, "utf8"), /components\/(Header|Footer|BottomNav)"/, f);
  // O CSS da barra: botão fixo (sticky no alto) e grande o bastante para o dedo (44 px).
  const css = ler("styles", "vale-o-escrito.css");
  assert.match(css, /\.ve-barra \{[^}]*position: sticky/);
  assert.match(css, /\.ve-voltar-ao-site \{[^}]*min-height: 44px/);
  for (const i of IDIOMAS_VE) assert.ok(TEXTOS_DO_OBSERVATORIO[i].casca.voltarAoSite.trim(), `${i}: casca.voltarAoSite`);
});

caso("páginas de texto do Vale usam o cabeçalho do Vale (não o PageHeading de papel do site)", () => {
  for (const r of [["page.tsx"], ["sobre", "page.tsx"], ["enviar", "page.tsx"], ["correcao", "page.tsx"], ["correcao", "[id]", "page.tsx"]]) {
    const t = ler("app", "[lang]", "vale-o-escrito", ...r);
    assert.doesNotMatch(t, /PageHeading/, r.join("/"));
  }
  for (const r of ["sobre", "enviar", "correcao"]) assert.match(ler("app", "[lang]", "vale-o-escrito", r, "page.tsx"), /<CabecaDoVale/, r);
});

caso("letras livres (OFL) por next/font, carregadas só nas rotas do Vale", () => {
  const f = ler("lib", "vale-o-escrito", "fontes.ts");
  assert.match(f, /from "next\/font\/google"/);
  for (const nome of ["Barlow_Condensed", "JetBrains_Mono", "Schibsted_Grotesk"]) assert.ok(f.includes(nome), nome);
  assert.match(f, /Open Font License/);
  const quem = [...arquivosDe("app", [".tsx", ".ts"]), ...arquivosDe("components", [".tsx", ".ts"]), ...arquivosDe("lib", [".ts", ".tsx"])].filter((x) => /vale-o-escrito\/fontes"/.test(fs.readFileSync(x, "utf8")));
  assert.deepEqual(quem.map((x) => path.relative(raiz, x).replace(/\\/g, "/")), ["app/[lang]/vale-o-escrito/layout.tsx"]);
  const css = ler("styles", "vale-o-escrito.css");
  for (const v of ["--fonte-ve-display", "--fonte-ve-mono", "--fonte-ve-leitura"]) assert.ok(css.includes(v), v);
  assert.doesNotMatch(css, /@import|fonts\.googleapis|fonts\.gstatic/, "nenhuma letra baixada de terceiros no navegador");
});

caso("rede viva no fundo: canvas leve, por import() dinâmico, pausa fora da tela e respeita 'reduzir movimento'", () => {
  const fundo = ler("components", "vale-o-escrito", "FundoVivo.tsx");
  assert.match(fundo, /import\("\.\/redeNeural"\)/);
  assert.match(fundo, /requestIdleCallback/);
  assert.match(fundo, /prefers-reduced-motion: reduce/);
  assert.match(fundo, /aria-hidden="true"/);
  const rede = ler("components", "vale-o-escrito", "redeNeural.ts");
  for (const t of ["requestAnimationFrame", "cancelAnimationFrame", "IntersectionObserver", "visibilitychange", "ResizeObserver", "calmo", "Math.min(1.5"]) assert.ok(rede.includes(t), t);
  assert.doesNotMatch(rede, /^import /m, "sem dependências");
  // Ninguém importa a rede de forma estática (ela não pode entrar no pacote inicial).
  for (const f of [...arquivosDe("components", [".tsx", ".ts"]), ...arquivosDe("app", [".tsx", ".ts"])]) assert.doesNotMatch(fs.readFileSync(f, "utf8"), /^import .*redeNeural/m, f);
  const css = ler("styles", "vale-o-escrito.css");
  assert.match(css, /\.ve-fundo-vivo \{[^}]*pointer-events: none/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

caso("sons: Web Audio gerado no navegador, desligado até a pessoa ligar, escolha guardada com try/catch", () => {
  const som = semComentarios(ler("components", "vale-o-escrito", "som.ts"));
  assert.match(som, /AudioContext/);
  assert.match(som, /createOscillator/);
  assert.doesNotMatch(som, /fetch\(|new Audio\(|\.mp3|\.ogg|\.wav|https?:\/\//, "nenhum arquivo nem endereço de fora");
  assert.match(som, /let ligado = false/, "começa desligado");
  assert.match(som, /try \{\s*ligado = window\.localStorage\.getItem\(CHAVE\) === "1";\s*\} catch/);
  assert.match(som, /try \{\s*if \(v\) window\.localStorage\.setItem/);
  assert.match(som, /prefers-reduced-motion: reduce/);
  // Sem gesto, nada toca: o contexto nasce no clique do botão ou no primeiro clique ou tecla da visita.
  assert.match(som, /"pointerdown", retomar/);
  assert.match(som, /"keydown", retomar/);
  assert.match(som, /if \(!somLigado\(\) \|\| !ctx/);
  const botao = ler("components", "vale-o-escrito", "BotaoDeSom.tsx");
  assert.match(botao, /aria-pressed=\{ligado\}/);
  assert.match(botao, /useSyncExternalStore\(assinarSom, somLigado, \(\) => false\)/, "no servidor, desligado");
  const obs = ler("components", "vale-o-escrito", "Observatorio.tsx");
  assert.match(obs, /tocar\("abrir"\)/);
  assert.match(obs, /tocar\("ligacao"\)/);
  for (const i of IDIOMAS_VE) for (const k of ["ligar", "desligar", "rotulo", "explica"]) assert.ok(TEXTOS_DO_OBSERVATORIO[i].casca.som[k].trim(), `${i}: casca.som.${k}`);
});

caso("painel: visão geral com contadores e barra da situação jurídica; texto que se revela sem esconder do leitor de tela", () => {
  const obs = ler("components", "vale-o-escrito", "Observatorio.tsx");
  assert.match(obs, /<Contador valor=/);
  assert.match(obs, /<Revelar como="h1"/);
  assert.match(obs, /ve-barra-situacao/);
  const vivos = ler("components", "vale-o-escrito", "Vivos.tsx");
  assert.match(vivos, /<span className="ve-so-leitor">\{texto\}<\/span>/);
  assert.match(vivos, /<span aria-hidden="true">\{visto\}<\/span>/);
  assert.match(vivos, /prefers-reduced-motion: reduce/);
});

caso("robô: workflow passa as quatro chaves de IA gratuita e ROBO.md diz como criar cada uma", () => {
  const wf = ler(".github", "workflows", "vale-o-escrito.yml");
  for (const k of ["GEMINI_API_KEY", "GROQ_API_KEY", "CEREBRAS_API_KEY", "OPENROUTER_API_KEY"]) assert.match(wf, new RegExp(`${k}: \\$\\{\\{ secrets\\.${k} \\}\\}`), k);
  const doc = ler("docs", "vale-o-escrito", "ROBO.md");
  for (const t of ["aistudio.google.com", "console.groq.com", "cloud.cerebras.ai", "openrouter.ai", "naoECaso", "arquivoFalhou", "Save Page Now"]) assert.ok(doc.includes(t), t);
});

caso("acessibilidade da moldura: botão de som com nome fixo, um só 'pular', rótulos apagados com contraste AA", () => {
  const botao = semComentarios(ler("components", "vale-o-escrito", "BotaoDeSom.tsx"));
  // O estado vai no aria-pressed; o nome não muda junto (e contém o texto visível, WCAG 2.5.3).
  assert.doesNotMatch(botao, /aria-label=/);
  assert.match(botao, /<b aria-hidden="true">\{ligado \? "ON" : "OFF"\}<\/b>/);
  const mol = ler("components", "vale-o-escrito", "Moldura.tsx");
  assert.ok(mol.includes('"a[href=\\\\#conteudo]"'), "o 'pular' do site sai: fica só o do Vale");
  const css = ler("styles", "vale-o-escrito.css");
  // No celular o texto do botão de som some só da vista: com display: none o botão ficaria sem nome.
  assert.doesNotMatch(css, /\.ve-som-texto \{\s*display: none/);
  const cor = css.match(/--ve-apagado: #([0-9a-f]{6})/i)?.[1];
  const fundo = css.match(/--ve-fundo: #([0-9a-f]{6})/i)?.[1];
  const lum = (hex) => {
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  assert.ok(cor && fundo);
  assert.ok((lum(cor) + 0.05) / (lum(fundo) + 0.05) >= 4.5, "--ve-apagado com contraste de pelo menos 4,5:1 sobre o fundo");
});

const { chaveDoLink, conferirCaso, documentoDoCaso } = await import("./vale-o-escrito/importar-novos-casos.mjs");
caso("novos casos em lote (content/vale-o-escrito/novos-casos): passam na curadoria, têm fonte oficial, chegam pendentes e não duplicam link", () => {
  const pasta = path.join(raiz, "content", "vale-o-escrito", "novos-casos");
  if (!fs.existsSync(pasta)) return;
  // Links já usados nos arquivos de entradas (publicadas e pendentes): o lote não pode repeti-los.
  const usados = new Map();
  for (const slug of SLUGS_DOS_DOSSIES) for (const en of lerDossie(slug).entradas) for (const f of en.fontes) usados.set(chaveDoLink(f.url), en.id);
  const ids = new Set(SLUGS_DOS_DOSSIES.flatMap((slug) => lerDossie(slug).entradas.map((x) => x.id)));
  let n = 0;
  for (const nome of fs.readdirSync(pasta).filter((x) => x.endsWith(".json"))) {
    const bruto = JSON.parse(fs.readFileSync(path.join(pasta, nome), "utf8"));
    const soltos = Array.isArray(bruto) ? bruto : Array.isArray(bruto?.dossies) ? bruto.dossies : [bruto];
    for (const solto of soltos)
      for (const en of solto.entradas ?? []) {
        const doc = documentoDoCaso({ ...en, dossie: en.dossie ?? solto.dossie }, solto);
        assert.deepEqual(conferirCaso(doc), [], `${nome} / ${en.id}`);
        assert.equal(en.revisao, "pendente-curadoria", `${nome} / ${en.id}: tem de chegar pendente`);
        assert.ok(!ids.has(en.id), `${nome} / ${en.id}: id repetido`);
        ids.add(en.id);
        for (const k of new Set(en.fontes.map((f) => chaveDoLink(f.url)))) {
          assert.ok(!usados.has(k) || usados.get(k) === en.id, `${nome} / ${en.id}: link ${k} já está em ${usados.get(k)}`);
          usados.set(k, en.id);
        }
        // Sem nome de quem morreu nos títulos das fontes deste recorte (os nomes foram trocados por [nome omitido]).
        for (const f of en.fontes) assert.doesNotMatch(f.titulo, /Mãe Bernadete|Dorothy Stang/, `${nome} / ${en.id}: título com nome de quem morreu`);
        n++;
      }
  }
  assert.ok(n > 0);
  // O importador barra caso só com imprensa (decisão da coordenação) e caso que chega "aprovado".
  const soImprensa = entrada({ pessoas: [] });
  assert.ok(conferirCaso(documentoDoCaso(soImprensa, {})).some((e) => e.includes("fonte oficial")));
  assert.ok(conferirCaso(documentoDoCaso(entrada({ revisao: "aprovada" }), { pessoas: [pessoa()] })).some((e) => e.startsWith("revisao")));
  assert.equal(chaveDoLink("https://WWW.Exemplo.gov.br/a/b/#x"), chaveDoLink("https://exemplo.gov.br/a/b"));
});

console.log(`\n${total} conferências do Vale o Escrito passaram.`);
