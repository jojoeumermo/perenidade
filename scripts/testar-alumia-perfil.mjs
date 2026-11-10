// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o perfil livre da Alumia (supabase/migracoes/20261110-alumia-perfil.sql + lib/rede/aparencia.ts): as regras puras (contraste
// garantido para qualquer cor, faixa, rosto de pixels, capa, abas, links sem rastreio, bio sem HTML) e o banco (num Postgres de
// verdade dentro do Node, com a migração rodada DUAS vezes): só valores conhecidos passam (nada de CSS, HTML ou URL livre), fixados e
// destaques só da própria pessoa, organizações só com selo, "tocando agora" some no prazo, campos até 6 com link limpo, a matriz
// visitante / membro / bloqueado / invisível, e o Tear de encaminhamentos (a função responsável só para quem é de dentro).
// Uso: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --disable-warning=DEP0205 --import ./scripts/carregar-ts.mjs scripts/testar-alumia-perfil.mjs
import fs from "node:fs";
import { criarBanco } from "./banco-local.mjs";
import {
  alternarAba, APARENCIA_PADRAO, arrumarAbas, arrumarAparencia, arrumarPalavraDaCapa, CORES_DA_PALETA, contraste, corLegivel, FUNDO_NOITE, FUNDO_PAPEL, gradienteDaFaixa,
  hexDoAcento, laudoDeContraste, linkLimpo, pedacosDaBio, pedidoDaAparencia, pintarRosto, rostoSorteado, rostoValido, textoSobre, variaveisDoAcento,
} from "../lib/rede/aparencia.ts";

let certos = 0;
const falhas = [];
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 400)}`);
    certos++;
    return valor;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
    return undefined;
  }
}
async function recusa(nome, promessa, codigo) {
  try {
    const valor = await promessa();
    falhas.push(`${nome}: deveria recusar com "${codigo}", mas passou (${JSON.stringify(valor)?.slice(0, 200)})`);
  } catch (erro) {
    if (String(erro.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro.message}"`);
  }
}
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
const ler = (c) => fs.readFileSync(new URL(`../${c}`, import.meta.url), "utf8");

// ── 1. Regras puras ──
// Contraste: QUALQUER cor livre vira legível nos dois fundos (testa uma grade de cores, inclusive as piores: preto, branco, amarelo).
{
  let piores = Infinity;
  for (let r = 0; r < 256; r += 51) for (let g = 0; g < 256; g += 51) for (let b = 0; b < 256; b += 51) {
    const cor = `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
    const v = variaveisDoAcento(cor);
    piores = Math.min(piores, contraste(v["--pf-acento-noite"], FUNDO_NOITE), contraste(v["--pf-acento-papel"], FUNDO_PAPEL), contraste(cor, textoSobre(cor)));
  }
  ok(`toda cor livre fica com contraste ≥ 4,5 nos dois fundos e no botão (pior: ${piores.toFixed(2)})`, piores >= 4.5);
}
ok("preto puro clareia no fundo noite", corLegivel("#000000", FUNDO_NOITE) !== "#000000" && contraste(corLegivel("#000000", FUNDO_NOITE), FUNDO_NOITE) >= 4.5);
ok("cor que já passa não muda", corLegivel("#ffffff", FUNDO_NOITE) === "#ffffff");
ok("o laudo avisa quando ajustou", laudoDeContraste("#ffff00").ajustada === true && laudoDeContraste("#8a5a00").noite < 4.5);
ok("as 8 cores da paleta existem", CORES_DA_PALETA.length === 8 && hexDoAcento("azul") === "#5b8cff" && hexDoAcento("url(javascript:1)") === "#e8321f");
ok("as variáveis só têm cor hexadecimal", Object.values(variaveisDoAcento("#123abc")).every((c) => /^#[0-9a-f]{6}$/.test(c)));
ok("a faixa só usa as cores da lista", /^linear-gradient\(to right, (#[0-9a-f]{6} [0-9.]+% [0-9.]+%(, )?){11}\)$/.test(gradienteDaFaixa([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0])));
ok("faixa inválida volta à da casa", gradienteDaFaixa([99]) === gradienteDaFaixa(null));
ok("rosto sorteado é válido e espelhado", (() => {
  const r = rostoSorteado(42);
  return rostoValido(r) && [...Array(8).keys()].every((y) => r.slice(y * 8, y * 8 + 8) === [...r.slice(y * 8, y * 8 + 8)].reverse().join(""));
})());
ok("rosto com menos de 6 ladrilhos não vale", !rostoValido("0".repeat(60) + "1111") && rostoValido("0".repeat(58) + "111111"));
ok("pintar com espelho pinta os dois lados", pintarRosto("0".repeat(64), 0, 3, true)[7] === "3" && pintarRosto("0".repeat(64), 0, 3, true)[0] === "3");
ok("pintar fora da grade não muda nada", pintarRosto("0".repeat(64), 64, 3) === "0".repeat(64));
ok("palavra da capa sem acento e só A–Z", arrumarPalavraDaCapa("Ação <b>já</b>!") === "ACAOBJAB" || arrumarPalavraDaCapa("Ação já!") === "ACAO JA");
ok("abas: posts sempre, sem repetir, sem desconhecida", JSON.stringify(arrumarAbas(["midia", "midia", "x", "atos"])) === JSON.stringify(["posts", "midia", "atos"]));
{
  // O editor: desmarcar uma aba a ESCONDE (some da lista, sem duplicar); marcar de novo põe no fim, uma vez só; "posts" não sai.
  const comeco = ["posts", "atos", "destaques", "respostas"];
  const sem = alternarAba(comeco, "atos", false);
  ok("abas: desmarcar esconde a aba (sem duplicar)", JSON.stringify(sem) === JSON.stringify(["posts", "destaques", "respostas"]));
  ok("abas: marcar põe no fim uma vez só", JSON.stringify(alternarAba(sem, "atos", true)) === JSON.stringify(["posts", "destaques", "respostas", "atos"]) && JSON.stringify(alternarAba(comeco, "atos", true)) === JSON.stringify(["posts", "destaques", "respostas", "atos"]));
  ok("abas: posts não sai", alternarAba(comeco, "posts", false).includes("posts"));
  const ferramentas = ler("components/rede/perfil/livre/Ferramentas.tsx");
  ok("abas: a caixa é lida antes da transição (o React devolve a caixa controlada dentro dela)", /const marcado = e\.currentTarget\.checked;\s*comTransicao\(\(\) => aoMudar\(alternarAba\(abas, a, marcado\)\)\)/.test(ferramentas));
}
ok("link: tira utm e fbclid e mostra o domínio", (() => {
  const l = linkLimpo("https://www.exemplo.org/a?utm_source=x&id=3&fbclid=abc");
  return l && l.href === "https://www.exemplo.org/a?id=3" && l.dominio === "exemplo.org" && l.tirados === 2;
})());
for (const ruim of ["http://exemplo.org", "javascript:alert(1)", "https://user:senha@exemplo.org", "https://exemplo.org:8080/", "https://exemplo", "data:text/html,oi", "https://exe mplo.org"]) {
  ok(`link recusado: ${ruim}`, linkLimpo(ruim) === null);
}
{
  const p = pedacosDaBio("Oi **forte** e _leve_ <script>x</script> https://a.org/x?utm_medium=y. #greve @rosavermelha\n\n\n\nfim");
  ok("bio: negrito, itálico, link limpo, tema e pessoa", p.some((x) => x.t === "negrito" && x.v === "forte") && p.some((x) => x.t === "italico" && x.v === "leve") && p.some((x) => x.t === "link" && x.href === "https://a.org/x") && p.some((x) => x.t === "tema" && x.v === "greve") && p.some((x) => x.t === "pessoa" && x.v === "rosavermelha"));
  ok("bio: o HTML fica como texto (nunca vira tag)", p.some((x) => x.t === "texto" && x.v.includes("<script>")) && !p.some((x) => x.t !== "texto" && JSON.stringify(x).includes("<script>")));
  ok("bio: no máximo duas quebras seguidas", p.filter((x) => x.t === "quebra").length === 2);
}
{
  const amanha = new Date(Date.now() + 86_400_000).toISOString();
  const a = arrumarAparencia({ acento: "url(x)", tema: "<b>", layout: "cartaz", faixa: [1, 2], rosto: "abc", capa: { tipo: "mosaico", palavra: "LUTA", semente: 7 }, abas: ["midia"], fixados: ["p-1", "p-1", "<x>"], orgs: ["Org!", "mandatapopular"], tocando: { texto: "Bella ciao", link: "https://x.org/?si=1", ate: amanha }, extra: "nada" });
  ok("aparência: o que não serve volta ao padrão", a.acento === "vermelho" && a.tema === "brasa" && a.layout === "cartaz" && a.faixa.length === 11 && a.rosto === null && a.capa?.palavra === "LUTA");
  ok("aparência: abas com posts, fixados sem repetir, orgs só @ bem formado", a.abas[0] === "posts" && a.fixados.length === 1 && a.orgs.length === 1);
  ok("aparência: tocando com link limpo", a.tocando?.link === "https://x.org/");
  ok("aparência: estrito (como o banco) só aceita uuid", arrumarAparencia({ fixados: ["p-1"] }, new Date(), true).fixados.length === 0);
  ok("aparência: tocando vencido some", arrumarAparencia({ tocando: { texto: "x", link: null, ate: "2020-01-01T00:00:00Z" } }).tocando === null);
  ok("o pedido não leva chave fora da lista", Object.keys(pedidoDaAparencia(a)).sort().join() === Object.keys(APARENCIA_PADRAO).sort().join());
}

// As telas: os 6 idiomas com as mesmas chaves; nada de HTML cru; a cor só por variáveis calculadas.
{
  const chaves = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (k === "_rascunho" ? [] : v && typeof v === "object" && !Array.isArray(v) ? chaves(v, `${p}${k}.`) : [`${p}${k}${Array.isArray(v) ? `[${v.length}]` : ""}`])).sort().join("|");
  const base = chaves(JSON.parse(ler("i18n/rede/perfil-livre/pt.json")));
  for (const l of ["en", "es", "fr", "ru", "zh"]) ok(`perfil-livre/${l}.json tem as mesmas chaves do pt`, chaves(JSON.parse(ler(`i18n/rede/perfil-livre/${l}.json`))) === base);
  const telas = ["Cabecalho.tsx", "Pecas.tsx", "Editor.tsx", "Ferramentas.tsx", "PaginaDoPerfil.tsx"].map((f) => ler(`components/rede/perfil/livre/${f}`)).join("\n") + ler("components/rede/org/Tear.tsx");
  ok("nenhuma tela do perfil livre usa dangerouslySetInnerHTML", !/dangerouslySetInnerHTML\s*=/.test(telas));
  ok("a cor do perfil entra só por variaveisDoAcento (nada de style com texto da pessoa)", /variaveisDoAcento\(acento\)/.test(ler("components/rede/perfil/livre/Cabecalho.tsx")) && !/style=\{\{[^}]*(bio|codinome|texto|palavra)/.test(telas));
  ok("a bio vira pedaços (pedacosDaBio), nunca HTML", /pedacosDaBio\(bio\)/.test(ler("components/rede/perfil/livre/Pecas.tsx")));
  ok("o editor respeita o alto contraste e o e-ink", /data-contrast\], \[data-eink\]\) \[data-al="2"\] :is\(\.pf, \.pf-pagina\)/.test(ler("components/rede/perfil/livre/livre.css")));
}

// ── 2. Banco ──
const banco = await criarBanco();
const { dono: sql, criarUsuario, rpc } = banco;
const migracao = ler("supabase/migracoes/20261110-alumia-perfil.sql");
ok("a migração está colada no fim do install.sql", ler("supabase/install.sql").replace(/\r\n/g, "\n").trim().endsWith(migracao.replace(/\r\n/g, "\n").trim()));
await espera("instala de novo sem estrago (idempotente)", () => banco.exclusivo(() => banco.pg.exec(migracao)));
await espera("e uma terceira vez", () => banco.exclusivo(() => banco.pg.exec(migracao)));

let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++ % 250}` });
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++ % 250}` });
const nomes = ["ana", "beto", "caio", "bloq", "menor", "invis", "orgdona", "nucleo1"];
const P = {};
for (const nome of nomes) {
  P[nome] = await criarUsuario(`${nome}@perfil.local`, nome);
  await rpc(como(P[nome]), "eu");
  await sql("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3 where id = $1", [P[nome], `Pessoa ${nome}`, `${nome}_pf`]);
}
await sql("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes.filter((n) => n !== "menor")) {
  await sql("update interno.perfis set rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome]]);
  await sql("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1)", [P[nome]]);
}
await sql("update auth.users set created_at = now() - interval '30 days'");
await sql("update interno.perfis set rede_modo = 'invisivel' where id = $1", [P.invis]);
await sql("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [P.ana, P.bloq]);
const A = (n) => como(P[n]);

// Uma organização com selo e outra sem.
const ORG = await criarUsuario("org@perfil.local", "Org");
await rpc(como(ORG), "eu");
await sql("update interno.perfis set rede_codinome = 'Coletivo Lume', rede_codinome_ok = true, rede_handle = 'coletivo_lume' where id = $1", [ORG]);
await sql("insert into interno.rede_orgs (perfil, tipo, verificada_em) values ($1, 'coletivo', now())", [ORG]);
await sql("insert into interno.rede_org_gestores (org, gestor, papel) values ($1, $2, 'dono')", [ORG, P.orgdona]);
const SEMSELO = await criarUsuario("semselo@perfil.local", "Sem");
await rpc(como(SEMSELO), "eu");
await sql("update interno.perfis set rede_codinome = 'Sem Selo', rede_codinome_ok = true, rede_handle = 'sem_selo' where id = $1", [SEMSELO]);
await sql("insert into interno.rede_orgs (perfil, tipo) values ($1, 'coletivo')", [SEMSELO]);
const NUC = (await sql("insert into interno.rede_nucleos (nome, org) values ('Núcleo Lume', $1) returning id", [ORG])).rows[0].id;
await sql("insert into interno.rede_nucleo_membros (nucleo, usuario) values ($1, $2)", [NUC, P.nucleo1]);

// Posts: da Ana (um comum, um ato, um retido) e do Beto.
const post = async (autor, extra = {}) =>
  (await sql("insert into interno.rede_posts (autor, texto, chamado, retido) values ($1, $2, $3, $4) returning id", [autor, "Um post de teste", extra.chamado ? JSON.stringify(extra.chamado) : null, extra.retido ?? false])).rows[0].id;
const pAna = await post(P.ana);
const pAna2 = await post(P.ana);
const atoAna = await post(P.ana, { chamado: { tipo: "ato", quando: "2026-12-01T18:00:00Z", onde: "Praça" } });
const retidoAna = await post(P.ana, { retido: true });
const pBeto = await post(P.beto);

const BOM = { acento: "#3a7bd5", tema: "tingido", layout: "centro", faixa: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0], rosto: "0".repeat(52) + "123456789123", capa: { tipo: "mosaico", palavra: "LUTA", semente: 42 }, abas: ["posts", "atos", "destaques", "organizacoes"] };
await recusa("visitante não edita", () => rpc(visitante(), "rede_perfil_aparencia_editar", { p: BOM }), "permission denied");
await recusa("menor (não membro) não edita", () => rpc(A("menor"), "rede_perfil_aparencia_editar", { p: BOM }), "confirme_idade");
const salvo = await espera("a Ana salva cor, tema, layout, faixa, rosto, capa e abas", () => rpc(A("ana"), "rede_perfil_aparencia_editar", { p: BOM }), (r) => r.acento === "#3a7bd5" && r.layout === "centro" && r.rosto === BOM.rosto && r.capa.semente === 42 && r.abas.length === 4);
ok("o que volta é só o que foi pedido", salvo && Object.keys(salvo).sort().join() === Object.keys(BOM).sort().join());
await espera("mudar só uma chave mantém as outras", () => rpc(A("ana"), "rede_perfil_aparencia_editar", { p: { tema: "papel" } }), (r) => r.tema === "papel" && r.layout === "centro");

// Nada livre passa.
const ruins = [
  ["chave desconhecida", { css: "body{display:none}" }, "invalido:aparencia"],
  ["cor com CSS", { acento: "red;background:url(x)" }, "invalido:acento"],
  ["cor sem #", { acento: "3a7bd5" }, "invalido:acento"],
  ["cor em maiúsculas (a tela manda minúsculas)", { acento: "#3A7BD5" }, "invalido:acento"],
  ["tema desconhecido", { tema: "neon" }, "invalido:tema"],
  ["layout desconhecido", { layout: "<div>" }, "invalido:layout"],
  ["faixa curta", { faixa: [1, 2, 3] }, "invalido:faixa"],
  ["faixa com cor fora", { faixa: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }, "invalido:faixa"],
  ["faixa com texto", { faixa: ["0", 1, 2, 3, 4, 5, 6, 7, 8, 9, 0] }, "invalido:faixa"],
  ["rosto quase vazio", { rosto: "0".repeat(60) + "1111" }, "invalido:rosto"],
  ["rosto com letra", { rosto: "a".repeat(64) }, "invalido:rosto"],
  ["capa com minúscula", { capa: { tipo: "mosaico", palavra: "luta", semente: 1 } }, "invalido:capa"],
  ["capa com chave a mais", { capa: { tipo: "mosaico", palavra: "LUTA", semente: 1, url: "https://x" } }, "invalido:capa"],
  ["capa com semente grande", { capa: { tipo: "mosaico", palavra: "LUTA", semente: 100000 } }, "invalido:capa"],
  ["abas sem posts", { abas: ["midia"] }, "invalido:abas"],
  ["abas repetidas", { abas: ["posts", "posts"] }, "invalido:abas"],
  ["aba desconhecida", { abas: ["posts", "seguidores"] }, "invalido:abas"],
  ["fixado de outra pessoa", { fixados: [pBeto] }, "invalido:fixados"],
  ["fixado retido", { fixados: [retidoAna] }, "invalido:fixados"],
  ["quatro fixados", { fixados: [pAna, pAna2, atoAna, pBeto] }, "invalido:fixados"],
  ["destaque de ato que não é ato", { destaques: [{ tipo: "ato", ref: pAna, titulo: "x", cor: "rosa" }] }, "invalido:destaques"],
  ["destaque com HTML no título", { destaques: [{ tipo: "post", ref: pAna, titulo: "<b>oi</b>", cor: "rosa" }] }, "invalido:destaques"],
  ["destaque de outra pessoa", { destaques: [{ tipo: "post", ref: pBeto, titulo: "oi", cor: "rosa" }] }, "invalido:destaques"],
  ["destaque com cor livre", { destaques: [{ tipo: "post", ref: pAna, titulo: "oi", cor: "#ff0000" }] }, "invalido:destaques"],
  ["organização sem selo", { orgs: ["sem_selo"] }, "invalido:orgs"],
  ["organização que é pessoa", { orgs: ["beto_pf"] }, "invalido:orgs"],
  ["tocando com link http", { tocando: { texto: "x", link: "http://x.org", ate: new Date(Date.now() + 3600e3).toISOString() } }, "invalido:tocando"],
  ["tocando com rastreio", { tocando: { texto: "x", link: "https://x.org/?utm_source=a", ate: new Date(Date.now() + 3600e3).toISOString() } }, "invalido:tocando"],
  ["tocando com javascript", { tocando: { texto: "x", link: "javascript:alert(1)", ate: new Date(Date.now() + 3600e3).toISOString() } }, "invalido:tocando"],
  ["tocando no passado", { tocando: { texto: "x", link: null, ate: "2020-01-01T00:00:00Z" } }, "invalido:tocando"],
  ["tocando por 3 meses", { tocando: { texto: "x", link: null, ate: new Date(Date.now() + 90 * 86400e3).toISOString() } }, "invalido:tocando"],
  ["tocando com HTML", { tocando: { texto: "<img src=x>", link: null, ate: new Date(Date.now() + 3600e3).toISOString() } }, "invalido:tocando"],
];
for (const [nome, p, codigo] of ruins) await recusa(`recusa: ${nome}`, () => rpc(A("ana"), "rede_perfil_aparencia_editar", { p }), codigo);
await espera("nada das recusas ficou guardado", () => sql("select rede_aparencia a from interno.perfis where id = $1", [P.ana]), (r) => JSON.stringify(r.rows[0].a) === JSON.stringify({ ...salvo, tema: "papel" }));

const ate = new Date(Date.now() + 2 * 3600e3).toISOString();
await espera("fixados, destaques, organização com selo e tocando agora", () => rpc(A("ana"), "rede_perfil_aparencia_editar", { p: { fixados: [pAna2, pAna], destaques: [{ tipo: "ato", ref: atoAna, titulo: " Passe Livre ", cor: "rosa" }], orgs: ["coletivo_lume"], tocando: { texto: "Canto de luta", link: "https://exemplo.org/musica", ate } } }),
  (r) => r.fixados[0] === pAna2 && r.destaques[0].titulo === "Passe Livre" && r.orgs[0].handle === "coletivo_lume" && r.orgs[0].codinome === "Coletivo Lume" && r.tocando.texto === "Canto de luta");

// Quem vê.
await espera("membro vê a aparência da Ana", () => rpc(A("beto"), "rede_perfil_aparencia", { p_handle: "ana_pf" }), (r) => r?.acento === "#3a7bd5" && r.orgs.length === 1);
await espera("visitante não vê perfil de pessoa", () => rpc(visitante(), "rede_perfil_aparencia", { p_handle: "ana_pf" }), (r) => r === null);
await espera("bloqueado não vê", () => rpc(A("bloq"), "rede_perfil_aparencia", { p_handle: "ana_pf" }), (r) => r === null);
await espera("invisível: ninguém vê", () => rpc(A("ana"), "rede_perfil_aparencia", { p_handle: "invis_pf" }), (r) => r === null);
await espera("invisível: a própria pessoa vê", () => rpc(A("invis"), "rede_perfil_aparencia", { p_handle: "invis_pf" }), (r) => r !== null);
await espera("perfil sem aparência devolve objeto vazio (a tela usa o padrão)", () => rpc(A("ana"), "rede_perfil_aparencia", { p_handle: "beto_pf" }), (r) => r && Object.keys(r).length === 0);

// O que deixa de servir some sozinho.
await sql("update interno.rede_posts set retido = true where id = $1", [pAna2]);
await sql("update interno.rede_orgs set verificada_em = null where perfil = $1", [ORG]);
await sql("update interno.perfis set rede_aparencia = jsonb_set(rede_aparencia, '{tocando,ate}', to_jsonb((now() - interval '1 minute')::text)) where id = $1", [P.ana]);
await espera("post retido sai dos fixados; organização sem selo sai; tocando vencido some", () => rpc(A("beto"), "rede_perfil_aparencia", { p_handle: "ana_pf" }), (r) => r.fixados.length === 1 && r.fixados[0] === pAna && r.orgs.length === 0 && r.tocando === null);
await sql("update interno.rede_orgs set verificada_em = now() where perfil = $1", [ORG]);

// Campos até 6 com link limpo.
const campos = (n) => Array.from({ length: n }, (_, i) => ({ rotulo: `Campo ${i + 1}`, valor: `valor ${i + 1}` }));
await espera("seis campos cabem", () => rpc(A("ana"), "rede_perfil_extras_editar", { p: { campos: campos(6) } }), (r) => r.campos.length === 6);
await recusa("sete não cabem", () => rpc(A("ana"), "rede_perfil_extras_editar", { p: { campos: campos(7) } }), "invalido:campos");
await recusa("campo com link http", () => rpc(A("ana"), "rede_perfil_extras_editar", { p: { campos: [{ rotulo: "Site", valor: "http://x.org" }] } }), "invalido:campos");
await recusa("campo com link de rastreio", () => rpc(A("ana"), "rede_perfil_extras_editar", { p: { campos: [{ rotulo: "Site", valor: "https://x.org/?fbclid=1" }] } }), "invalido:campos");
await espera("campo com link limpo passa", () => rpc(A("ana"), "rede_perfil_extras_editar", { p: { campos: [{ rotulo: "Site", valor: "https://x.org/a" }] } }), (r) => r.campos[0].valor === "https://x.org/a");
await recusa("status com horas em texto", () => rpc(A("ana"), "rede_perfil_extras_editar", { p: { status: { tipo: "greve", texto: "", horas: "1; drop" } } }), "invalido:status");
await espera("status com prazo", () => rpc(A("ana"), "rede_perfil_extras_editar", { p: { status: { tipo: "greve", texto: "com a categoria", horas: 8 } } }), (r) => r.status.tipo === "greve" && r.status.ate);

// As abas Respostas, Mídia e Atos (rede_perfil_linha).
{
  const resp = (await sql("insert into interno.rede_posts (autor, texto, resposta_a) values ($1, 'Concordo', $2) returning id", [P.ana, pBeto])).rows[0].id;
  const img = (await sql("insert into interno.rede_posts (autor, texto) values ($1, 'Cartaz https://exemplo.org/cartaz.webp') returning id", [P.ana])).rows[0].id;
  const ids = (r) => (r?.itens ?? []).map((x) => x.id);
  await espera("respostas: só o que responde a outro", () => rpc(A("beto"), "rede_perfil_linha", { p_handle: "ana_pf", p_aba: "respostas" }), (r) => ids(r).length === 1 && ids(r)[0] === resp);
  await espera("mídia: só o que tem imagem", () => rpc(A("beto"), "rede_perfil_linha", { p_handle: "ana_pf", p_aba: "midia" }), (r) => ids(r).length === 1 && ids(r)[0] === img);
  await espera("atos: só a convocação", () => rpc(A("beto"), "rede_perfil_linha", { p_handle: "ana_pf", p_aba: "atos" }), (r) => ids(r).includes(atoAna) && !ids(r).includes(pAna));
  await recusa("aba desconhecida", () => rpc(A("beto"), "rede_perfil_linha", { p_handle: "ana_pf", p_aba: "seguidores" }), "invalido:aba");
  await espera("bloqueado vê vazio", () => rpc(A("bloq"), "rede_perfil_linha", { p_handle: "ana_pf", p_aba: "respostas" }), (r) => ids(r).length === 0);
  await espera("invisível: vazio para os outros", () => rpc(A("ana"), "rede_perfil_linha", { p_handle: "invis_pf", p_aba: "atos" }), (r) => ids(r).length === 0);
  await recusa("cursor ruim", () => rpc(A("beto"), "rede_perfil_linha", { p_handle: "ana_pf", p_aba: "atos", p_cursor: "x|y" }), "invalido:cursor");
}

// Tear de encaminhamentos.
const prazo = new Date(Date.now() + 7 * 86400e3).toISOString().slice(0, 10);
await recusa("membro comum não tece fio", () => rpc(A("beto"), "rede_org_tear_fio", { p_handle: "coletivo_lume", p: { texto: "Fazer o cartaz", funcao: "comunicação", prazo } }), "sem_permissao");
const t1 = await espera("quem gerencia tece um fio", () => rpc(A("orgdona"), "rede_org_tear_fio", { p_handle: "coletivo_lume", p: { texto: "Fazer o cartaz do ato", funcao: "comunicação", prazo } }), (r) => r.decididos === 1 && r.cumpridos === 0 && r.fios[0].funcao === "comunicação");
await espera("e outro", () => rpc(A("orgdona"), "rede_org_tear_fio", { p_handle: "coletivo_lume", p: { texto: "Prestar contas da rifa", funcao: "tesouraria", prazo } }), (r) => r.decididos === 2);
await recusa("prazo no passado não vale", () => rpc(A("orgdona"), "rede_org_tear_fio", { p_handle: "coletivo_lume", p: { texto: "Algo velho", funcao: "secretaria", prazo: "2020-01-01" } }), "invalido:prazo");
await recusa("função vazia não vale", () => rpc(A("orgdona"), "rede_org_tear_fio", { p_handle: "coletivo_lume", p: { texto: "Algo", funcao: "", prazo } }), "invalido:fio");
await espera("cumprir um fio", () => rpc(A("orgdona"), "rede_org_tear_fio", { p_handle: "coletivo_lume", p: { id: t1?.fios[0].id, estado: "cumprido" } }), (r) => r.cumpridos === 1 && r.decididos === 2);
await espera("o público vê o agregado e o texto, sem função e sem prazo", () => rpc(visitante(), "rede_org_tear", { p_handle: "coletivo_lume" }), (r) => r.decididos === 2 && r.cumpridos === 1 && r.dentro === false && r.fios.every((f) => f.funcao === null && f.prazo === null && f.texto));
await espera("membro de fora também não vê a função", () => rpc(A("beto"), "rede_org_tear", { p_handle: "coletivo_lume" }), (r) => r.dentro === false && r.fios.every((f) => f.funcao === null));
await espera("quem é de um núcleo da organização vê a função e o prazo", () => rpc(A("nucleo1"), "rede_org_tear", { p_handle: "coletivo_lume" }), (r) => r.dentro === true && r.fios.every((f) => f.funcao && f.prazo));
await espera("organização sem selo não tem tear", () => rpc(A("beto"), "rede_org_tear", { p_handle: "sem_selo" }), (r) => r === null);
{
  const texto = JSON.stringify(await rpc(A("nucleo1"), "rede_org_tear", { p_handle: "coletivo_lume" }));
  ok("o tear nunca traz pessoa (nem id, nem @, nem codinome)", ![P.orgdona, P.nucleo1, "orgdona_pf", "Pessoa orgdona", "nucleo1_pf"].some((x) => texto.includes(x)));
}

// Permissões: nada direto nas tabelas, nem a função de conferir.
await recusa("ninguém lê a tabela do tear direto", () => banco.exclusivo(async () => {
  await banco.pg.exec("set role authenticated");
  try {
    return await banco.pg.query("select * from interno.rede_org_encaminhamentos");
  } finally {
    await banco.pg.exec("reset role");
  }
}), "permission denied");
await recusa("ninguém chama a função de conferir direto", () => banco.exclusivo(async () => {
  await banco.pg.exec("set role authenticated");
  try {
    return await banco.pg.query("select interno.alumia_aparencia_valida('{}'::jsonb, null)");
  } finally {
    await banco.pg.exec("reset role");
  }
}), "permission denied");

console.log(`testar-alumia-perfil: ${certos} certos, ${falhas.length} falhas`);
if (falhas.length) {
  for (const f of falhas) console.log("  ✗ " + f);
  process.exit(1);
}
