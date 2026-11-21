// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que é público (onda R3, itens 1.3 e 3.2): as páginas de transparência, o SECURITY.md, o security.txt, o plano de auditorias e
// o canário.
//   1. Cada página (app/[lang]/transparencia/**) tem o texto em content/paginas e está no mapa do site.
//   2. Os dados de content/transparencia passam na conferência, e a conferência RECUSA dado malformado (um relatório sem resumo
//      SHA-256, um pedido de tipo inventado, um canário publicado sem data ou sem as marcas, um trimestral com nome trocado).
//   3. O canário: o modelo de hoje não pode ser assinado (está "aguardando"); um canário pronto passa; validade longa ou invertida
//      não passa; o pacote de assinatura malformado é recusado antes de ir à rede; o vencido aparece como vencido.
//   4. SECURITY.md: canal cifrado, prazos, divulgação responsável, gravidades, sem faixas de recompensa. security.txt: aponta para
//      ele e não venceu. docs/AUDITORIAS.md: quando, a ordem e o "na íntegra".
//   5. Nada de interno nos arquivos públicos novos (endereço de IP, caminho do computador, porta, nome de máquina).
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-r3-publico-paginas.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canarioVencido, pedidosDeOrgaos, prazoEmPortugues, relatoriosDeAuditoria, relatoriosTrimestrais, canario, inventario, validarCanario, validarPedidos, validarRelatorios, validarTrimestral } from "../lib/transparencia.ts";
import { formaDoPacote, problemasDoCanario } from "./ferramentas/canario.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (f) => fs.readFileSync(path.join(raiz, f), "utf8");
let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  if (cond) console.log(`  ok    ${nome}`);
  else {
    falhas++;
    console.log(`  FALHA ${nome}${detalhe ? `\n        ${detalhe}` : ""}`);
  }
};
const recusa = (nome, fn, trecho) => {
  try {
    fn();
    ok(nome, false, "passou sem erro");
  } catch (erro) {
    ok(nome, String(erro.message).includes(trecho), String(erro.message));
  }
};

console.log("1. as páginas");
const ROTAS = { "": "transparencia", "o-que-o-servidor-guarda": "transparencia-o-que-o-servidor-guarda", pedidos: "transparencia-pedidos", trimestral: "transparencia-trimestral", canario: "transparencia-canario", relatorios: "transparencia-relatorios" };
const mapa = ler("app/sitemap.ts");
for (const [sub, slug] of Object.entries(ROTAS)) {
  const rota = `/transparencia${sub ? `/${sub}` : ""}`;
  const pagina = path.join("app/[lang]/transparencia", sub, "page.tsx");
  const existe = fs.existsSync(path.join(raiz, pagina));
  const texto = existe ? ler(pagina) : "";
  const md = path.join("content/paginas", `${slug}.md`);
  const cab = fs.existsSync(path.join(raiz, md)) ? ler(md) : "";
  ok(`${rota}: página, texto (${slug}.md com título e resumo) e mapa do site`, existe && texto.includes(`slug="${slug}"`) && /\ntitulo: ".+"/.test(cab) && /\nresumo: ".+"/.test(cab) && mapa.includes(`"${rota}",`));
}
ok("a página 'O que a Alumia guarda' aponta para a lista completa (pt, en, es)", ["pt", "en", "es"].every((l) => ler(`i18n/rede/lei/${l}.json`).includes("/transparencia/o-que-o-servidor-guarda")));

console.log("2. os dados e a conferência");
ok("relatórios de auditoria: lista vazia e válida (nenhuma auditoria feita ainda)", relatoriosDeAuditoria().length === 0);
const p = pedidosDeOrgaos();
ok("pedidos: válidos, sem data de atualização (nenhum publicado ainda)", p.pedidos.length === 0 && p.atualizado === null);
ok("trimestrais: nenhum publicado, e o MODELO.md não aparece como relatório", relatoriosTrimestrais().length === 0 && fs.existsSync(path.join(raiz, "content/transparencia/trimestral/MODELO.md")));
ok("inventário: a página lê a lista gerada do banco", inventario().total.tabelas > 400 && inventario().servico_de_contas.length >= 6);
const bom = { data: "2027-03-01", titulo: "Auditoria do chat", quem: "Empresa X", escopo: "Chat a dois", arquivo: "/transparencia/relatorios/2027-03-chat.pdf", sha256: "a".repeat(64), achados: { criticos: 0, altos: 1, medios: 2, baixos: 3 } };
ok("relatório bom passa", validarRelatorios({ relatorios: [bom] })[0].achados.altos === 1);
recusa("relatório sem resumo SHA-256 de 64 letras é recusado", () => validarRelatorios({ relatorios: [{ ...bom, sha256: "abc" }] }), "sha256");
recusa("relatório com arquivo fora da pasta pública é recusado", () => validarRelatorios({ relatorios: [{ ...bom, arquivo: "https://outro.site/x.pdf" }] }), "arquivo");
recusa("relatório com achado negativo é recusado", () => validarRelatorios({ relatorios: [{ ...bom, achados: { ...bom.achados, baixos: -1 } }] }), "achados.baixos");
const pedido = { recebido: "2027-02-10", tipo: "ordem judicial", orgao: "vara criminal", pediu: "dados de cadastro de uma conta", entregamos: "e-mail e data de criação", contestamos: false, situacao: "atendido" };
ok("pedido bom passa", validarPedidos({ desde: "2026-11-19", atualizado: "2027-04-01", pedidos: [pedido] }).pedidos.length === 1);
recusa("pedido de tipo inventado é recusado", () => validarPedidos({ pedidos: [{ ...pedido, tipo: "pedido informal" }] }), "tipo");
recusa("pedido sem 'contestamos' sim ou não é recusado", () => validarPedidos({ pedidos: [{ ...pedido, contestamos: "talvez" }] }), "contestamos");
recusa("pedido com data em outro formato é recusado", () => validarPedidos({ pedidos: [{ ...pedido, recebido: "10/02/2027" }] }), "recebido");
const tri = '---\ntrimestre: "2027-T1"\nperiodo: "janeiro a março de 2027"\npublicado: "2027-04-05"\n---\n\n## Em resumo\n\nTexto.';
ok("trimestral bom passa", validarTrimestral("2027-T1.md", tri).trimestre === "2027-T1");
recusa("trimestral com o nome do arquivo trocado é recusado", () => validarTrimestral("2027-T2.md", tri), "trimestre");

console.log("3. o canário");
const modelo = ler("content/transparencia/canario.md");
ok("o canário de hoje está 'aguardando' (sem data, sem valor de canário até a coordenação confirmar)", canario().situacao === "aguardando" && canario().emitido === null);
ok("o canário 'aguardando' não pode ser assinado", problemasDoCanario(modelo).some((x) => x.includes("situacao")));
const pronto = modelo.replace('situacao: "aguardando"', 'situacao: "publicado"').replace('emitido: ""', 'emitido: "2027-01-05"').replace('valido_ate: ""', 'valido_ate: "2027-02-05"');
ok("um canário pronto passa nas duas conferências (a do site e a da assinatura)", problemasDoCanario(pronto).length === 0 && validarCanario(pronto).texto.includes("2027-02-05") && !validarCanario(pronto).texto.includes("{emitido}"));
ok("validade de mais de 100 dias não pode ser assinada", problemasDoCanario(pronto.replace('valido_ate: "2027-02-05"', 'valido_ate: "2027-12-05"')).some((x) => x.includes("100 dias")));
ok("validade antes da emissão não pode ser assinada", problemasDoCanario(pronto.replace('valido_ate: "2027-02-05"', 'valido_ate: "2026-12-05"')).some((x) => x.includes("depois")));
recusa("canário publicado sem data é recusado pela página", () => validarCanario(pronto.replace('emitido: "2027-01-05"', 'emitido: ""')), "emitido");
recusa("canário publicado sem as marcas de data no texto é recusado pela página", () => validarCanario(pronto.replaceAll("{valido_ate}", "logo")), "marcas");
ok("canário vencido aparece como vencido; o válido, não", canarioVencido(validarCanario(pronto), "2027-03-01") && !canarioVencido(validarCanario(pronto), "2027-01-20"));
ok("pacote de assinatura que não é JSON é recusado antes de ir à rede", formaDoPacote("{x") === "o pacote não é JSON");
ok("pacote que não é do Sigstore é recusado antes de ir à rede", formaDoPacote(JSON.stringify({ mediaType: "application/json" }))?.includes("mediaType"));
ok("pacote do Sigstore sem a assinatura de um arquivo é recusado", formaDoPacote(JSON.stringify({ mediaType: "application/vnd.dev.sigstore.bundle.v0.3+json", verificationMaterial: {} }))?.includes("messageSignature"));
const paginaCanario = ler("content/paginas/transparencia-canario.md");
ok("a página do canário mostra a identidade exata do fluxo (a mesma do script)", paginaCanario.includes("https://github.com/jojoeumermo/perenidade/.github/workflows/canario.yml@refs/heads/master") && ler("scripts/ferramentas/canario.mjs").includes('"https://github.com/jojoeumermo/perenidade/.github/workflows/canario.yml@refs/heads/master"'));
ok("os prazos do banco aparecem em português", prazoEmPortugues("30 days") === "30 dias" && prazoEmPortugues("1 hour") === "1 hora" && prazoEmPortugues("13 months") === "13 meses" && prazoEmPortugues("2 years") === "2 anos");

console.log("4. SECURITY.md, security.txt e o plano de auditorias");
const sec = ler("SECURITY.md");
for (const [nome, trecho] of [["canal cifrado de ponta a ponta", "Cifrado de ponta a ponta"], ["prazo de confirmação (7 dias)", "até 7 dias"], ["prazo de avaliação (30 dias)", "até 30 dias"], ["divulgação responsável (90 dias)", "**90 dias**"], ["gravidades", "**Crítica:**"], ["relatório trimestral", "/transparencia/trimestral"], ["plano de auditorias", "docs/AUDITORIAS.md"]]) {
  ok(`SECURITY.md: ${nome}`, sec.includes(trecho));
}
ok("SECURITY.md: sem faixas de recompensa (corte do dono)", /Não há recompensa em dinheiro/.test(sec) && !/R\$|US\$|\$\s?\d|faixa/i.test(sec));
const txt = ler("public/.well-known/security.txt");
const expira = /^Expires: (.+)$/m.exec(txt)?.[1];
ok("security.txt: aponta para o SECURITY.md e não venceu", /^Policy: https:\/\/github\.com\/jojoeumermo\/perenidade\/blob\/master\/SECURITY\.md$/m.test(txt) && Date.parse(expira) > Date.now(), expira);
const aud = ler("docs/AUDITORIAS.md");
ok("AUDITORIAS.md: quando (uma vez por ano e a cada mudança grande), a ordem e o 'na íntegra'", aud.includes("uma vez por ano") && aud.includes("mudança grande") && aud.includes("## O que, em ordem") && aud.includes("na íntegra"));

console.log("5. nada de interno nos arquivos públicos novos");
const publicos = ["SECURITY.md", "docs/AUDITORIAS.md", "public/.well-known/security.txt", "content/transparencia/canario.md", "content/transparencia/trimestral/MODELO.md", "content/transparencia/pedidos.json", "content/transparencia/relatorios.json", ...Object.values(ROTAS).map((s) => `content/paginas/${s}.md`)];
const proibidos = [/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/, /[A-Z]:[\\/]Users/i, /\/home\/\w+/, /\blucia-vps\b/, /\/opt\/lucia/, /:\d{4,5}\b(?!\d)/, /cloudflare/i, /site-[ab]\b/];
const achados = publicos.flatMap((f) => proibidos.filter((re) => re.test(ler(f))).map((re) => `${f}: ${re}`));
ok(`nenhum IP, caminho, porta ou nome de máquina (${publicos.length} arquivos)`, achados.length === 0, achados.join("; "));

console.log(`\n${falhas ? `${falhas} falha(s)` : "tudo ok"}`);
process.exit(falhas ? 1 : 0);
