// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a Alumia (nome, endereço próprio) e a federação com o Fediverso (docs/rede/FEDIVERSO.md, docs/rede/ALUMIA-DOMINIO.md,
// supabase/migracoes/2026-11-alumia.sql, lib/rede/alumia.ts, lib/rede/fediverso/*): o roteamento por host, WebFinger, o ator,
// a assinatura HTTP (assinar e conferir), a cifra das chaves privadas, o texto que entra e sai, a federação desligada por padrão
// (opt-in), que nada privado sai (alcance, núcleo, comunidade fechada, equipe, antes de ligar), a caixa de entrada (Follow com
// assinatura conferida, sem assinatura recusado), a fila de entrega, desligar retira o que saiu, Salvos, e o bloco no fim do
// install.sql. Uso: npm run testar:fediverso
import fs from "node:fs";
import { semPosteriores } from "./install-posteriores.mjs";
import { criarBanco } from "./banco-local.mjs";

// O ambiente da federação ligada, ANTES de importar os módulos (eles leem as variáveis ao carregar).
const SEGREDO = "segredo-de-teste-da-federacao-com-mais-de-32-caracteres";
const BASE = "https://alumia.teste";
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://banco.teste";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "chave-publica-de-teste";
process.env.ALUMIA_FEDIVERSO_SEGREDO = SEGREDO;
process.env.NEXT_PUBLIC_ALUMIA_URL = BASE;
process.env.NEXT_PUBLIC_RECURSOS = "rede-v2";

const alumia = await import("../lib/rede/alumia.ts");
const { assinarPedido, conferirAssinatura, gerarParDeChaves, digestDe } = await import("../lib/rede/fediverso/assinatura.ts");
const { cifrar, decifrar } = await import("../lib/rede/fediverso/cifra.ts");
const { htmlParaTexto, textoParaHtml, hashtagsDe } = await import("../lib/rede/fediverso/texto.ts");
const doc = await import("../lib/rede/fediverso/documentos.ts");
const { enderecosDaFederacao, lerConta, handleDoWebfinger } = await import("../lib/rede/fediverso/enderecos.ts");
const servidor = await import("../lib/rede/fediverso/servidor.ts");
const { receber } = await import("../lib/rede/fediverso/caixa.ts");
const { processarFila } = await import("../lib/rede/fediverso/entrega.ts");

let certos = 0;
const falhas = [];
async function espera(nome, promessa, conferir = (v) => v !== false) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 300)}`);
    certos++;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
  }
}
async function recusa(nome, promessa, codigo) {
  try {
    const valor = await promessa();
    falhas.push(`${nome}: deveria recusar com "${codigo}", mas passou (${JSON.stringify(valor)?.slice(0, 160)})`);
  } catch (erro) {
    if (String(erro.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro.message}"`);
  }
}
const lerTexto = (caminho) => fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const UUID = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

// ═══════════════════ O endereço próprio (lib/rede/alumia.ts) ═══════════════════
const rota = alumia.rotaNaAlumia;
const AP = "application/activity+json";
await espera("o host alumia.* é da Alumia; o do instituto não", async () => [alumia.hostDaAlumia("alumia.institutolucia.org"), alumia.hostDaAlumia("alumia.localhost:3107"), alumia.hostDaAlumia("institutolucia.org"), alumia.hostDaAlumia("")], (r) => r.join() === "true,true,false,false");
await espera("no host da Alumia, / é a linha em português e /en a linha em inglês (reescrita, a URL não muda)", async () => [rota("/"), rota("/en")], (r) => r[0].tipo === "reescrever" && r[0].destino === "/pt/alumia" && r[1].destino === "/en/alumia");
await espera("/p/<id> e /@nome viram as telas da Alumia; com Accept de ActivityPub, o documento da federação", async () => [rota(`/p/${UUID}`), rota(`/p/${UUID}`, AP), rota("/@ana_1"), rota("/@ana_1", AP), rota("/pt/u/ana_1", AP)], (r) =>
  r[0].destino === `/pt/alumia/p/${UUID}` && r[1].destino === `/api/fediverso/p/${UUID}` && r[2].destino === "/pt/alumia/u/ana_1" && r[3].destino === "/api/fediverso/u/ana_1" && r[4].destino === "/api/fediverso/u/ana_1");
await espera("o endereço completo (/pt/alumia/…) e as páginas livres (entrar, regras) seguem no host da Alumia", async () => [rota("/pt/alumia/buscar"), rota("/pt/entrar"), rota("/entrar"), rota("/salvos"), rota("/fediverso")], (r) =>
  r[0].tipo === "seguir" && r[1].tipo === "seguir" && r[2].destino === "/pt/entrar" && r[3].destino === "/pt/alumia/salvos" && r[4].destino === "/pt/alumia/fediverso");
await espera("o resto do site vai para o endereço do instituto; o painel depois de entrar volta para a linha", async () => [rota("/trilhas"), rota("/en/acervo"), rota("/pt/painel")], (r) => r[0].tipo === "site" && r[0].destino === "/pt/trilhas" && r[1].destino === "/en/acervo" && r[2].tipo === "redirecionar" && r[2].destino === "/pt");
await espera("sem NEXT_PUBLIC_ALUMIA_URL, os links ficam no caminho do site (/[lang]/alumia)", async () => [alumia.enderecoDaAlumia("pt", "", ""), alumia.enderecoDaAlumia("en", "/p/1", ""), alumia.caminhoDoSiteParaAlumia("/pt/comunidade", "", "")], (r) => r[0] === "/pt/alumia" && r[1] === "/en/alumia/p/1" && r[2] === null);
await espera("com o endereço próprio, os links vão para lá (português sem prefixo) e /pt/alumia/** (e o antigo /pt/comunidade/**) do site é levado para lá", async () => [alumia.enderecoDaAlumia("pt", "", BASE), alumia.enderecoDaAlumia("en", "/p/1", BASE), alumia.caminhoDoSiteParaAlumia("/pt/comunidade/p/1", "?x=1", BASE), alumia.caminhoDoSiteParaAlumia("/pt/trilhas", "", BASE)], (r) =>
  r[0] === `${BASE}/` && r[1] === `${BASE}/en/p/1` && r[2] === `${BASE}/p/1?x=1` && r[3] === null);
// A rota mudou de /comunidade para /alumia (PLANO-ALUMIA, F0): no host da Alumia o endereço antigo vai com 308 para o caminho
// curto do host próprio (busca mantida pelo proxy); "completo" é o mesmo lugar em /pt/alumia/… (para o ?t=/?post= do Fórum).
await espera("no host da Alumia, /pt/comunidade/… e /comunidade/… vão (mover = 308) para o caminho curto; /pt/alumia/… segue", async () => [rota("/pt/comunidade/buscar"), rota("/comunidade"), rota("/en/comunidade/p/1"), rota("/pt/alumia/salvos"), rota("/alumia/salvos"), rota("/pt/comunidade/nao-existe")], (r) =>
  r[0].tipo === "mover" && r[0].destino === "/buscar" && r[0].completo === "/pt/alumia/buscar" && r[1].tipo === "mover" && r[1].destino === "/" && r[1].completo === "/pt/alumia"
  && r[2].destino === "/en/p/1" && r[3].tipo === "seguir" && r[4].tipo === "reescrever" && r[4].destino === "/pt/alumia/salvos" && r[5].destino === "/pt/alumia/nao-existe");
await espera("um servidor do Fediverso que guardou o url antigo (/pt/comunidade/p|u/…) recebe o documento, sem redirecionamento", async () => [rota(`/pt/comunidade/p/${UUID}`, AP), rota("/pt/comunidade/u/ana_1", AP), rota(`/comunidade/p/${UUID}`, AP), rota(`/pt/comunidade/p/${UUID}`)], (r) =>
  r[0].tipo === "reescrever" && r[0].destino === `/api/fediverso/p/${UUID}` && r[1].destino === "/api/fediverso/u/ana_1" && r[2].destino === `/api/fediverso/p/${UUID}` && r[3].tipo === "mover" && r[3].destino === `/p/${UUID}`);
await espera("no host da Alumia, as telas novas da Onda 5 e as conversas viram /pt/alumia/…", async () => [rota("/atos"), rota("/organizacoes"), rota("/conversas"), rota("/en/transparencia")], (r) =>
  r[0].destino === "/pt/alumia/atos" && r[1].destino === "/pt/alumia/organizacoes" && r[2].destino === "/pt/alumia/conversas" && r[3].destino === "/en/alumia/transparencia");
await espera("com o endereço próprio, o antigo /pt/comunidade/… do site também vai para lá, num salto só", async () => [alumia.caminhoDoSiteParaAlumia("/pt/comunidade/p/1", "?x=1", BASE), alumia.caminhoDoSiteParaAlumia("/pt/comunidades", "", BASE)], (r) => r[0] === `${BASE}/p/1?x=1` && r[1] === null);
await espera("endereço próprio só com https (http só para localhost)", async () => [alumia.urlDaAlumiaOk("https://alumia.institutolucia.org"), alumia.urlDaAlumiaOk("http://alumia.institutolucia.org"), alumia.urlDaAlumiaOk("http://alumia.localhost:3107"), alumia.urlDaAlumiaOk("javascript:alert(1)")], (r) => r.join() === "true,false,true,false");
await espera("o proxy usa o roteamento da Alumia e o site aponta Comunidade para enderecoDaAlumia (menu, barra de baixo, rodapé)", async () => {
  const proxy = lerTexto("proxy.ts");
  return /rotaNaAlumia\(/.test(proxy) && /caminhoDoSiteParaAlumia\(/.test(proxy) && ["components/NavLinks.tsx", "components/BottomNav.tsx", "components/Footer.tsx"].every((c) => /enderecoDaAlumia\(lang\)/.test(lerTexto(c)));
});
await espera("a casca da Alumia tem o botão Voltar ao site em todas as telas (layout da Comunidade)", async () => /MolduraDaAlumia/.test(lerTexto("app/[lang]/alumia/layout.tsx")) && /voltarAoSite/.test(lerTexto("components/rede/MolduraDaAlumia.tsx")));

// ═══════════════════ O nome ═══════════════════
const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"];
await espera("a marca é Alumia nos seis idiomas, com o botão de voltar ao site", async () => IDIOMAS.every((l) => { const j = JSON.parse(lerTexto(`i18n/rede/${l}.json`)); return j.marca === "Alumia" && j.alumia?.voltarAoSite; }));
await espera("nenhum texto da interface da rede ainda diz Rede Lúcia (nem nos rascunhos)", async () => {
  const achados = [];
  const varrer = (pasta) => { for (const d of fs.readdirSync(new URL(`../${pasta}`, import.meta.url), { withFileTypes: true })) { if (d.isDirectory()) varrer(`${pasta}/${d.name}`); else if (d.name.endsWith(".json") && /Rede L[úu]cia|Lúcia Network|Red Lúcia|Réseau Lúcia|Сеть Лусии|卢西亚网络|露西亚网络/.test(lerTexto(`${pasta}/${d.name}`))) achados.push(`${pasta}/${d.name}`); } };
  varrer("i18n/rede");
  for (const l of IDIOMAS) if (/"nome": "(Rede Lúcia|Сеть Лусии|露西亚网络|Réseau Lúcia)"/.test(lerTexto(`i18n/${l}.json`))) achados.push(`i18n/${l}.json`);
  if (/Rede Lúcia|Lúcia Network/.test(lerTexto("public/sw.js"))) achados.push("public/sw.js");
  if (achados.length) throw new Error(achados.join(", "));
  return true;
});
await espera("i18n/rede/alumia: as mesmas chaves nos seis idiomas, e os cinco que não são português marcados como rascunho", async () => {
  const chaves = (obj, p = "") => Object.entries(obj).flatMap(([k, v]) => (k === "_rascunho" ? [] : v && typeof v === "object" && !Array.isArray(v) ? chaves(v, `${p}${k}.`) : [`${p}${k}`]));
  const base = chaves(JSON.parse(lerTexto("i18n/rede/alumia/pt.json"))).sort().join();
  return IDIOMAS.every((l) => { const j = JSON.parse(lerTexto(`i18n/rede/alumia/${l}.json`)); return chaves(j).sort().join() === base && (l === "pt" || j._rascunho === true); });
});

// ═══════════════════ Módulos puros da federação ═══════════════════
const fed = enderecosDaFederacao(BASE);
await espera("WebFinger: acct:nome@alumia.teste (e o endereço do ator) dão o @nome; outro domínio ou nome inválido, nada", async () => [
  handleDoWebfinger("acct:ana_1@alumia.teste", "alumia.teste"),
  handleDoWebfinger(`${BASE}/api/fediverso/u/ana_1`, "alumia.teste"),
  handleDoWebfinger("acct:ana_1@outra.teste", "alumia.teste"),
  handleDoWebfinger("acct:a@alumia.teste", "alumia.teste"),
  handleDoWebfinger("acct:ANA_1@alumia.teste", "alumia.teste"),
], (r) => r[0] === "ana_1" && r[1] === "ana_1" && r[2] === null && r[3] === null && r[4] === "ana_1");
await espera("o documento WebFinger aponta o ator em application/activity+json", async () => doc.documentoWebfinger(fed, "ana_1"), (w) => w.subject === "acct:ana_1@alumia.teste" && w.links.some((l) => l.rel === "self" && l.type === "application/activity+json" && l.href === `${BASE}/api/fediverso/u/ana_1`));
await espera("lerConta aceita @nome@instancia, nome@instancia e acct:; recusa sem domínio", async () => [lerConta("@ana@mastodon.social"), lerConta("ana@mastodon.social"), lerConta("acct:ana@mastodon.social"), lerConta("@ana"), lerConta("@ana@semponto")], (r) => r[0]?.dominio === "mastodon.social" && r[1]?.usuario === "ana" && r[2] && r[3] === null && r[4] === null);

const par = gerarParDeChaves();
await espera("o ator leva só a chave PÚBLICA, codinome, @nome e bio; fora de diretórios e da busca de texto", async () => doc.documentoDoAtor(fed, { handle: "ana_1", nome: "Ana", bio: "<b>oi</b>", ligado_em: new Date().toISOString(), chave_publica: par.publica }), (a) => {
  const json = JSON.stringify(a);
  return a.type === "Person" && a.publicKey.publicKeyPem.startsWith("-----BEGIN PUBLIC KEY-----") && !/PRIVATE/.test(json) && a.discoverable === false && a.indexable === false && a.summary === "<p>&lt;b&gt;oi&lt;/b&gt;</p>" && a.inbox === `${BASE}/api/fediverso/u/ana_1/inbox` && a.endpoints.sharedInbox === `${BASE}/api/fediverso/inbox`;
});
const postFed = { id: UUID, tipo: "post", titulo: null, texto: "Olá <script>x</script> #Estudo", corpo: null, aviso: "", criado_em: new Date().toISOString(), editado_em: null, resposta_a: null, handle: "ana_1" };
await espera("o post sai como Note para Public, com o texto escapado e a hashtag", async () => doc.documentoDoPost(fed, postFed), (n) => n.type === "Note" && n.to[0] === doc.PUBLICO && !/<script>/.test(n.content) && /&lt;script&gt;/.test(n.content) && n.tag[0]?.name === "#estudo" && n.attributedTo === `${BASE}/api/fediverso/u/ana_1`);
await espera("Create, Delete e Accept têm o ator certo e o objeto certo", async () => [doc.atividadeCreate(fed, postFed), doc.atividadeDelete(fed, "ana_1", UUID), doc.atividadeResposta(fed, "Accept", "ana_1", "https://remota.teste/u/b", "https://remota.teste/f/1", "x")], ([c, d, a]) => c.type === "Create" && c.object.id === `${BASE}/api/fediverso/p/${UUID}` && d.object.type === "Tombstone" && a.object.id === "https://remota.teste/f/1" && a.object.object === `${BASE}/api/fediverso/u/ana_1`);
await espera("NodeInfo 2.1: inscrições fechadas, números agregados sem nome", async () => doc.documentoNodeinfo({ usuarios: 2, posts: 5 }, "1.0"), (n) => n.version === "2.1" && n.protocols[0] === "activitypub" && n.openRegistrations === false && n.usage.users.total === 2);
await espera("HTML de fora vira texto puro (sem script, sem marcação; entidades decodificadas; caracteres de direção fora)", async () => htmlParaTexto('<p>oi <script>alert(1)</script><b>forte</b></p><p>&lt;tag&gt; &amp; ‮x</p><img src=x onerror=alert(1)>'), (t) => t === "oi forte\n\n<tag> & x");
await espera("texto daqui vira HTML escapado; hashtags sem repetir", async () => [textoParaHtml("a < b\n\nc", (t) => `/t/${t}`), hashtagsDe("#a1 #A1 #b2")], ([h, t]) => h === "<p>a &lt; b</p><p>c</p>" && t.join() === "a1,b2");

await espera("cifra das chaves privadas: volta com o segredo certo, nulo com outro, e não guarda o PEM aberto", async () => {
  const c = cifrar(par.privada, SEGREDO);
  return [c.startsWith("v1:"), !c.includes("PRIVATE"), decifrar(c, SEGREDO) === par.privada, decifrar(c, "outro-segredo-qualquer-com-mais-de-32-letras") === null, decifrar("lixo", SEGREDO) === null];
}, (r) => r.every(Boolean));

// Assinatura HTTP (draft-cavage): assina como o Mastodon, confere, e recusa o que foi mexido.
const URL_INBOX = `${BASE}/api/fediverso/u/autora/inbox`;
const corpoTeste = JSON.stringify({ type: "Follow" });
const cab = assinarPedido({ metodo: "POST", url: URL_INBOX, corpo: corpoTeste, chaveId: "https://remota.teste/users/ana#main-key", chavePrivada: par.privada });
const leitor = (c) => (n) => { const k = Object.keys(c).find((x) => x.toLowerCase() === n.toLowerCase()); return k ? c[k] : null; };
const conferir = (extra = {}) => conferirAssinatura({ metodo: "POST", caminho: "/api/fediverso/u/autora/inbox", ler: leitor({ ...cab, ...extra.cab }), corpo: extra.corpo ?? corpoTeste, chavePublica: extra.chave ?? par.publica, agora: extra.agora });
await espera("assinatura: confere com a chave do ator", async () => conferir(), (r) => r.ok === true);
await espera("assinatura: corpo mexido → digest diferente", async () => conferir({ corpo: '{"type":"Delete"}' }), (r) => !r.ok && r.motivo === "digest_diferente");
await espera("assinatura: outra chave → inválida", async () => conferir({ chave: gerarParDeChaves().publica }), (r) => !r.ok && r.motivo === "assinatura_invalida");
await espera("assinatura: data velha (mais de 12 h) → fora da janela", async () => conferir({ agora: Date.now() + 13 * 3_600_000 }), (r) => !r.ok && r.motivo === "data_fora_da_janela");
await espera("assinatura: host trocado → inválida (a assinatura cobre o host)", async () => conferir({ cab: { Host: "outro.teste" } }), (r) => !r.ok && r.motivo === "assinatura_invalida");
await espera("assinatura: sem o digest na lista assinada de um POST → recusada", async () => {
  const sem = cab.Signature.replace('headers="(request-target) host date digest content-type"', 'headers="(request-target) host date"');
  return conferir({ cab: { Signature: sem } });
}, (r) => !r.ok && r.motivo === "cabecalhos_faltando");
await espera("digest no formato do Mastodon (SHA-256=base64)", async () => digestDe("abc"), (d) => d === "SHA-256=ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=");

// ═══════════════════ O banco ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];
// As migrações de 6/11 vêm depois da da Alumia, inteiras; tiram-se do fim primeiro.
let install = semPosteriores(lerTexto("supabase/install.sql"));
const migracao = lerTexto("supabase/migracoes/2026-11-alumia.sql").trim();
await espera("o install.sql termina com a migração da Alumia, idêntica ao arquivo", async () => install.endsWith(migracao));
if (!install.endsWith(migracao)) await espera("a migração instala por cima do install.sql", () => banco.exclusivo(() => banco.pg.exec(migracao)));
await espera("rodar a migração de novo não quebra (idempotente)", () => banco.exclusivo(() => banco.pg.exec(migracao)));
await espera("nenhuma tabela nova no esquema public; as da federação em interno, com RLS e sem permissão direta", async () => {
  if (/create table (if not exists )?public\./i.test(migracao)) throw new Error("tabela em public");
  const r = await dono(`select c.relname, c.relrowsecurity, exists (select 1 from information_schema.role_table_grants g where g.table_schema = 'interno' and g.table_name = c.relname and g.grantee in ('anon', 'authenticated', 'PUBLIC')) as aberta
    from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'interno' and c.relkind = 'r' and c.relname like 'rede_fed_%'`);
  return r.rows.length === 8 && r.rows.every((x) => x.relrowsecurity && !x.aberta);
});
await espera("as funções públicas novas são security definer com search_path = interno, pg_temp", async () => {
  const r = await dono(`select p.proname, p.prosecdef, array_to_string(p.proconfig, ',') as cfg from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and (p.proname like 'rede_fed_%' or p.proname = 'rede_alumia_salvos')`);
  return r.rows.length >= 8 && r.rows.every((x) => x.prosecdef && /search_path=interno, pg_temp/.test(x.cfg));
});
await espera("nenhuma função do banco escreve mais 'Rede Lúcia' (avisos e e-mails dizem Alumia)", async () => (await um(`select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('interno','public') and p.prosrc like '%Rede Lúcia%'`)).n, (n) => n === 0);
await espera("o resumo semanal por e-mail sai com o nome novo", async () => (await um(`select count(*)::int as n from pg_proc where prosrc like '%Seu resumo da semana na Alumia%'`)).n, (n) => n >= 1);

let ip = 20;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++}` });
const anon = { papel: "anon" };
const pessoas = {};
for (const nome of ["autora", "leitora", "fechada"]) {
  pessoas[nome] = await criarUsuario(`${nome}@fediverso.local`, nome);
  await rpc(como(pessoas[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_18 = true, rede_consentimento = 1, rede_handle = $3, rede_modo = 'aberto' where id = $1", [pessoas[nome], `Pessoa ${nome}`, nome]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1)", [pessoas[nome]]);
}
await dono("update interno.perfis set rede_modo = 'trancado' where id = $1", [pessoas.fechada]);
const disciplina = (await um("select slug from interno.rede_comunidades where categoria = 'disciplinas' order by slug limit 1"))?.slug;
const lutaFechada = (await um("select slug from interno.rede_comunidades where categoria <> 'disciplinas' order by slug limit 1"))?.slug;
const postar = async (quem, texto, extra = {}) =>
  (await um("insert into interno.rede_posts (autor, texto, comunidade, publico, alcance) values ($1, $2, $3, $4, $5) returning id", [quem, texto, extra.comunidade ?? disciplina, extra.publico ?? "internet", extra.alcance ?? "publico"])).id;

const federavel = async (id) => (await um("select interno.rede_fed_federavel(p) as f from interno.rede_posts p where p.id = $1", [id])).f;
const antes = await postar(pessoas.autora, "Post público escrito ANTES de ligar a federação.");

await espera("a federação vem DESLIGADA por padrão (opt-in: LGPD art. 7º, I e art. 8º)", async () => rpc(como(pessoas.autora), "rede_fed_situacao"), (r) => r.logado && r.ligado === false && r.pode === true && r.versao === 1);
await espera("e nada sai de quem não ligou", () => federavel(antes), (f) => f === false);
await recusa("ligar sem a versão do consentimento em vigor é recusado", () => rpc(como(pessoas.autora), "rede_fed_ligar", { p_sim: true, p_versao: 99 }), "invalido:versao");
await recusa("perfil trancado não liga", () => rpc(como(pessoas.fechada), "rede_fed_ligar", { p_sim: true, p_versao: 1 }), "perfil_fechado");
await recusa("visitante não liga", () => rpc(anon, "rede_fed_ligar", { p_sim: true, p_versao: 1 }), "");
await espera("ligar com o consentimento em vigor", async () => rpc(como(pessoas.autora), "rede_fed_ligar", { p_sim: true, p_versao: 1 }), (r) => r.ligado === true && r.handle === "autora");
await espera("o consentimento fica registrado com versão e data", async () => um("select ligado, consentimento_versao, ligado_em from interno.rede_fed_atores where perfil = $1", [pessoas.autora]), (r) => r.ligado && r.consentimento_versao === 1 && r.ligado_em);
await espera("post escrito ANTES de ligar continua sem sair", () => federavel(antes), (f) => f === false);

await dono("update interno.rede_fed_atores set ligado_em = now() - interval '1 minute' where perfil = $1", [pessoas.autora]);
const publico = await postar(pessoas.autora, "Post público numa comunidade das disciplinas, depois de ligar. #estudo");
const membros = await postar(pessoas.autora, "Post só para membros.", { publico: "membros" });
const seguidores = await postar(pessoas.autora, "Post só para seguidores.", { publico: "seguidores", alcance: "seguidores" });
const equipe = await postar(pessoas.autora, "Post da equipe.", { publico: "equipe", alcance: "equipe" });
const luta = await postar(pessoas.autora, "Post 'internet' numa comunidade de luta (cai para membros).", { comunidade: lutaFechada });
const deOutra = await postar(pessoas.leitora, "Post público de quem não ligou.");
await espera("sai: o post público para a internet, depois de ligar", () => federavel(publico), (f) => f === true);
await espera("não sai: membros, seguidores, equipe, comunidade de luta, e quem não ligou", async () => Promise.all([membros, seguidores, equipe, luta, deOutra].map(federavel)), (r) => r.every((f) => f === false));
await espera("não sai: aviso do instituto e post de núcleo", async () => {
  const aviso = (await um("insert into interno.rede_posts (autor, texto, comunidade, publico, alcance, tipo) values ($1, 'Aviso do instituto para todos.', $2, 'internet', 'publico', 'aviso') returning id", [pessoas.autora, disciplina]).catch(() => null))?.id;
  const nucleo = await um("select interno.rede_fed_federavel(p) as f from (select (r).* from (select jsonb_populate_record(null::interno.rede_posts, to_jsonb(x) || jsonb_build_object('nucleo', gen_random_uuid())) as r from interno.rede_posts x where x.id = $1) y) p", [publico]);
  return [aviso ? await federavel(aviso) : false, nucleo.f];
}, (r) => r.every((f) => f === false));

// O servidor do site: só com o segredo.
await recusa("as funções do servidor não respondem sem a configuração do segredo", () => rpc(anon, "rede_fed_servidor", { p_segredo: SEGREDO, p_acao: "contagem", p: {} }), "sem_permissao");
await dono("insert into interno.configuracoes (chave, valor) values ('fediverso', jsonb_build_object('segredo_hash', encode(sha256(convert_to($1, 'UTF8')), 'hex'))) on conflict (chave) do update set valor = excluded.valor", [SEGREDO]);
await recusa("e com o segredo errado também não", () => rpc(anon, "rede_fed_servidor", { p_segredo: "x".repeat(40), p_acao: "contagem", p: {} }), "sem_permissao");
await espera("com o segredo certo: a contagem do NodeInfo (sem nome de ninguém)", async () => rpc(anon, "rede_fed_servidor", { p_segredo: SEGREDO, p_acao: "contagem", p: {} }), (r) => r.usuarios === 1 && Object.keys(r).sort().join() === "posts,usuarios");
await recusa("visitante não lê a tabela dos atores (chaves) direto", () => banco.exclusivo(async () => { await banco.pg.exec("set role anon"); try { return await banco.pg.query("select * from interno.rede_fed_atores"); } finally { await banco.pg.exec("reset role"); } }), "permission denied");

// O lado do servidor do site falando com o banco: o fetch do Supabase vai para o banco de teste.
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (!u.startsWith("http://banco.teste/rest/v1/rpc/")) throw new Error(`fetch inesperado: ${u}`);
  const funcao = u.slice("http://banco.teste/rest/v1/rpc/".length);
  try {
    const r = await rpc(anon, funcao, JSON.parse(String(init.body ?? "{}")));
    return new Response(JSON.stringify(r), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ message: e.message }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
};
await espera("federacaoLigada: rede-v2, endereço https, segredo e banco", async () => servidor.federacaoLigada(), (v) => v === true);
let ator;
await espera("o ator ganha um par de chaves na primeira vez; a privada fica CIFRADA no banco (interno), nunca em public", async () => {
  ator = await servidor.atorComChaves("autora");
  const guardado = await um("select chave_privada, chave_publica from interno.rede_fed_atores where perfil = $1", [pessoas.autora]);
  return [ator.estado === "ligado", ator.chave_publica?.startsWith("-----BEGIN PUBLIC KEY-----"), guardado.chave_privada.startsWith("v1:"), !guardado.chave_privada.includes("PRIVATE"), ator.privada?.includes("PRIVATE KEY")];
}, (r) => r.every(Boolean));
await espera("de novo: o mesmo par (não troca a chave a cada pedido)", async () => (await servidor.atorComChaves("autora")).chave_publica === ator.chave_publica);
await espera("quem não ligou não tem ator (WebFinger e ator respondem 404)", async () => (await servidor.banco("ator", { handle: "leitora" })).estado, (e) => e === "inexistente");
await espera("a caixa de saída só tem o post que pode sair", async () => servidor.banco("outbox", { handle: "autora", limite: 20 }), (r) => r.itens.length === 1 && r.itens[0].id === publico);
await espera("o documento de um post de membros não existe para o Fediverso", async () => servidor.banco("post", { id: membros }), (r) => r === null);

// A caixa de entrada: Follow de uma instância de fora, com assinatura.
const remoto = gerarParDeChaves();
const ATOR = "https://remota.teste/users/bia";
await servidor.banco("remoto_salvar", { ator: ATOR, chave_id: `${ATOR}#main-key`, chave_publica: remoto.publica, inbox: `${ATOR}/inbox`, compartilhada: "https://remota.teste/inbox", handle: "bia@remota.teste", nome: "Bia", resumo: "", url: "https://remota.teste/@bia" });
const pedidoAssinado = (atividade, chave = remoto.privada, url = URL_INBOX) => {
  const corpo = JSON.stringify(atividade);
  const c = assinarPedido({ metodo: "POST", url, corpo, chaveId: `${ATOR}#main-key`, chavePrivada: chave });
  return { ler: leitor(c), corpo: new TextEncoder().encode(corpo), caminho: new URL(url).pathname };
};
const follow = { "@context": "https://www.w3.org/ns/activitystreams", id: "https://remota.teste/f/1", type: "Follow", actor: ATOR, object: `${BASE}/api/fediverso/u/autora` };
await espera("sem assinatura: 401, nada gravado", async () => receber("POST", "/api/fediverso/u/autora/inbox", () => null, new TextEncoder().encode(JSON.stringify(follow))), (r) => r.status === 401);
await espera("assinatura com outra chave: 401, nada gravado", async () => { const p = pedidoAssinado(follow, gerarParDeChaves().privada); return receber("POST", p.caminho, p.ler, p.corpo); }, (r) => r.status === 401);
await espera("ninguém virou seguidor com pedido inválido", async () => (await um("select count(*)::int as n from interno.rede_fed_seguidores")).n, (n) => n === 0);
await espera("Follow assinado: 202, seguidor gravado e o Accept na fila", async () => {
  const p = pedidoAssinado(follow);
  const r = await receber("POST", p.caminho, p.ler, p.corpo);
  const s = await um("select ator, inbox_compartilhada, pedido from interno.rede_fed_seguidores where perfil = $1", [pessoas.autora]);
  const fila = await um("select count(*)::int as n from interno.rede_fed_fila where tipo = 'accept' and destino = $1", [`${ATOR}/inbox`]);
  return r.status === 202 && r.entregar && s.ator === ATOR && s.inbox_compartilhada === "https://remota.teste/inbox" && s.pedido === follow.id && fila.n === 1;
});
await espera("Follow para quem não ligou: aceito em silêncio (202), sem seguidor", async () => {
  const p = pedidoAssinado({ ...follow, id: "https://remota.teste/f/2", object: `${BASE}/api/fediverso/u/leitora` });
  const r = await receber("POST", p.caminho, p.ler, p.corpo);
  return r.status === 202 && (await um("select count(*)::int as n from interno.rede_fed_seguidores")).n === 1;
});
await espera("um post público novo vai para a fila (Create) para a caixa compartilhada de quem segue", async () => {
  const novo = await postar(pessoas.autora, "Outro post público depois de ter seguidor.");
  return (await um("select count(*)::int as n from interno.rede_fed_fila where tipo = 'create' and objeto = $1 and destino = 'https://remota.teste/inbox'", [novo])).n;
}, (n) => n === 1);
await espera("um post só para membros NÃO vai para a fila", async () => {
  const novo = await postar(pessoas.autora, "Mais um post só para membros.", { publico: "membros" });
  return (await um("select count(*)::int as n from interno.rede_fed_fila where objeto = $1", [novo])).n;
}, (n) => n === 0);
await espera("editar um post público para 'membros' manda retirar (Delete)", async () => {
  await dono("update interno.rede_posts set publico = 'membros' where id = $1", [publico]);
  return [(await um("select count(*)::int as n from interno.rede_fed_fila where tipo = 'delete' and objeto = $1", [publico])).n, await servidor.banco("post", { id: publico })];
}, ([n, doc2]) => n === 1 && doc2?.apagado === true);
await espera("a entrega: falha de conexão volta para a fila com nova tentativa (nada se perde)", async () => {
  const r = await processarFila(50);
  const pendente = await um("select count(*)::int as n, max(tentativas)::int as t from interno.rede_fed_fila where feito_em is null");
  return r.adiados + r.descartados + r.entregues > 0 && pendente.t >= 1;
});
await espera("Undo de Follow assinado: o seguidor sai", async () => {
  const p = pedidoAssinado({ "@context": "https://www.w3.org/ns/activitystreams", id: "https://remota.teste/u/1", type: "Undo", actor: ATOR, object: follow });
  const r = await receber("POST", p.caminho, p.ler, p.corpo);
  return r.status === 202 && (await um("select count(*)::int as n from interno.rede_fed_seguidores")).n === 0;
});
await espera("instância bloqueada pela mediação: 403", async () => {
  await dono("insert into interno.rede_fed_bloqueados (dominio, motivo) values ('remota.teste', 'teste')");
  const p = pedidoAssinado(follow);
  const r = await receber("POST", p.caminho, p.ler, p.corpo);
  await dono("delete from interno.rede_fed_bloqueados");
  return r.status;
}, (s) => s === 403);
await recusa("bloquear instância é só da mediação", () => rpc(como(pessoas.leitora), "rede_fed_bloquear", { p_dominio: "remota.teste", p_sim: true, p_motivo: "" }), "sem_permissao");

// Seguir alguém de fora e receber o post público dele.
await espera("seguir de fora põe o Follow na fila; o Accept de lá confirma", async () => {
  await servidor.banco("seguir", { perfil: pessoas.autora, ator: ATOR, pedido: `${BASE}/api/fediverso/atividades/follow/1`, sim: true });
  const p = pedidoAssinado({ "@context": "https://www.w3.org/ns/activitystreams", id: "https://remota.teste/a/1", type: "Accept", actor: ATOR, object: `${BASE}/api/fediverso/atividades/follow/1` });
  const r = await receber("POST", p.caminho, p.ler, p.corpo);
  return [r.status, (await um("select aceito from interno.rede_fed_seguindo where perfil = $1 and ator = $2", [pessoas.autora, ATOR])).aceito];
}, ([s, a]) => s === 202 && a === true);
await espera("um post PÚBLICO de quem se segue entra só como texto; um não público é ignorado", async () => {
  const nota = (id, publicoSim) => ({ id: `https://remota.teste/notes/${id}`, type: "Note", attributedTo: ATOR, content: "<p>Oi <script>x</script><a href='https://x'>link</a></p>", to: publicoSim ? ["https://www.w3.org/ns/activitystreams#Public"] : [`${ATOR}/followers`], published: new Date().toISOString() });
  for (const [id, sim] of [["1", true], ["2", false]]) {
    const p = pedidoAssinado({ "@context": "https://www.w3.org/ns/activitystreams", id: `https://remota.teste/c/${id}`, type: "Create", actor: ATOR, object: nota(id, sim) });
    await receber("POST", p.caminho, p.ler, p.corpo);
  }
  const linha = await rpc(como(pessoas.autora), "rede_fed_linha", { p_antes: null });
  return linha;
}, (l) => l.length === 1 && l[0].texto === "Oi link" && l[0].handle === "bia@remota.teste");
await espera("quem não segue não vê a linha de fora de ninguém", async () => rpc(como(pessoas.leitora), "rede_fed_linha", { p_antes: null }), (l) => l.length === 0);

// Desligar retira o que saiu.
await espera("desligar: retira os posts que saíram (Delete na fila), desfaz quem segue lá fora e esvazia as listas", async () => {
  const r = await rpc(como(pessoas.autora), "rede_fed_ligar", { p_sim: false, p_versao: null });
  const del = (await um("select count(*)::int as n from interno.rede_fed_fila where tipo = 'delete' and feito_em is null")).n;
  const undo = (await um("select count(*)::int as n from interno.rede_fed_fila where tipo = 'undo-follow'")).n;
  const listas = (await um("select (select count(*) from interno.rede_fed_seguidores)::int + (select count(*) from interno.rede_fed_seguindo)::int as n")).n;
  return r.ligado === false && del >= 1 && undo === 1 && listas === 0;
});
await espera("desligada com retiradas na fila: o ator só mostra a chave (para as instâncias conferirem a retirada)", async () => (await servidor.banco("ator", { handle: "autora" })).estado, (e) => e === "saindo");
await espera("e nenhum post sai mais", async () => (await servidor.banco("outbox", { handle: "autora", limite: 20 })).itens.length, (n) => n === 0);
await espera("perfil trancado depois de ligar: a federação se desliga sozinha", async () => {
  await rpc(como(pessoas.leitora), "rede_fed_ligar", { p_sim: true, p_versao: 1 });
  await dono("update interno.perfis set rede_modo = 'trancado' where id = $1", [pessoas.leitora]);
  return (await um("select ligado from interno.rede_fed_atores where perfil = $1", [pessoas.leitora])).ligado;
}, (l) => l === false);

// Salvos.
await espera("Salvos: lista o que a pessoa guardou e só para ela", async () => {
  await rpc(como(pessoas.leitora), "rede_salvar", { p_post: deOutra, p_sim: true });
  const minha = await rpc(como(pessoas.leitora), "rede_alumia_salvos", { p_cursor: null, p_limite: 20 });
  const outra = await rpc(como(pessoas.autora), "rede_alumia_salvos", { p_cursor: null, p_limite: 20 });
  return minha.itens.length === 1 && minha.itens[0].id === deOutra && outra.itens.length === 0;
});
await recusa("Salvos pede conta", () => rpc(anon, "rede_alumia_salvos", { p_cursor: null, p_limite: 20 }), "");

// Apagar a conta com a federação ligada (LGPD art. 18, VI): os pedidos de apagar ainda saem, assinados, depois que o perfil some.
await espera("apagar a conta com a federação ligada: o Delete e o Reject ficam na fila e o ator responde só com a chave", async () => {
  const quem = await criarUsuario("apaga@fediverso.local", "apaga");
  await rpc(como(quem), "eu");
  await dono("update interno.perfis set rede_codinome = 'Apaga', rede_codinome_ok = true, rede_18 = true, rede_consentimento = 1, rede_handle = 'apaga', rede_modo = 'aberto' where id = $1", [quem]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1)", [quem]);
  await rpc(como(quem), "rede_fed_ligar", { p_sim: true, p_versao: 1 });
  await dono("update interno.rede_fed_atores set ligado_em = now() - interval '1 minute' where perfil = $1", [quem]);
  await servidor.atorComChaves("apaga");
  await dono("insert into interno.rede_fed_seguidores (perfil, ator, inbox, pedido) values ($1, 'https://outra.teste/users/c', 'https://outra.teste/users/c/inbox', 'https://outra.teste/f/9')", [quem]);
  const post = await postar(quem, "Post público de quem vai apagar a conta.");
  await dono("update interno.rede_fed_fila set feito_em = now() where perfil = $1", [quem]);
  await dono("delete from interno.perfis where id = $1", [quem]);
  const fila = (await dono("select tipo, objeto from interno.rede_fed_fila where perfil = $1 and feito_em is null order by tipo", [quem])).rows;
  const estado = (await servidor.banco("ator", { handle: "apaga" })).estado;
  return [fila.some((x) => x.tipo === "delete" && x.objeto === post), fila.some((x) => x.tipo === "reject"), estado === "saindo", quem];
}, (r) => r.slice(0, 3).every(Boolean));
await espera("e a faxina apaga a linha e as chaves de quem apagou a conta assim que a fila esvazia", async () => {
  const quem = (await um("select perfil from interno.rede_fed_atores where handle = 'apaga'")).perfil;
  await dono("update interno.rede_fed_fila set feito_em = now() where perfil = $1", [quem]);
  await dono("select interno.rede_fed_limpar()");
  return (await um("select (select count(*) from interno.rede_fed_atores where perfil = $1)::int + (select count(*) from interno.rede_fed_fila where perfil = $1)::int as n", [quem])).n;
}, (n) => n === 0);
await espera("a mediação vê a lista de instâncias bloqueadas sem mudar nada (domínio vazio, p_sim nulo)", async () => {
  const cuida = await criarUsuario("cuida@fediverso.local", "cuida");
  await rpc(como(cuida), "eu");
  await dono("insert into interno.rede_fed_bloqueados (dominio, motivo) values ('ruim.teste', 'teste') on conflict do nothing");
  // Quem não é da mediação continua sem ver.
  let recusou = false;
  try { await rpc(como(cuida), "rede_fed_bloquear", { p_dominio: "", p_sim: null, p_motivo: "" }); } catch { recusou = true; }
  await dono("insert into interno.papeis (usuario, papel) values ($1, 'educacao')", [cuida]);
  const lista = await rpc(como(cuida), "rede_fed_bloquear", { p_dominio: "", p_sim: null, p_motivo: "" });
  const continua = (await um("select count(*)::int as n from interno.rede_fed_bloqueados where dominio = 'ruim.teste'")).n;
  await dono("delete from interno.rede_fed_bloqueados where dominio = 'ruim.teste'");
  return recusou && lista.some((b) => b.dominio === "ruim.teste") && continua === 1;
});

// ═══════════════════ As rotas e os documentos ═══════════════════
await espera("as rotas da federação existem (WebFinger, NodeInfo, ator, caixas, post, entrega, buscar, seguir)", async () =>
  ["app/.well-known/webfinger/route.ts", "app/.well-known/nodeinfo/route.ts", "app/api/fediverso/nodeinfo/route.ts", "app/api/fediverso/u/[handle]/route.ts", "app/api/fediverso/u/[handle]/inbox/route.ts", "app/api/fediverso/u/[handle]/outbox/route.ts", "app/api/fediverso/inbox/route.ts", "app/api/fediverso/p/[id]/route.ts", "app/api/fediverso/entregar/route.ts", "app/api/fediverso/buscar/route.ts", "app/api/fediverso/seguir/route.ts"].every((c) => fs.existsSync(new URL(`../${c}`, import.meta.url))));
await espera("toda rota da federação passa pelo teto de pedidos (e responde 404 com a federação desligada)", async () => {
  const pastas = ["app/.well-known/webfinger/route.ts", "app/.well-known/nodeinfo/route.ts", "app/api/fediverso/u/[handle]/route.ts", "app/api/fediverso/u/[handle]/outbox/route.ts", "app/api/fediverso/p/[id]/route.ts", "app/api/fediverso/entregar/route.ts", "app/api/fediverso/buscar/route.ts", "app/api/fediverso/seguir/route.ts"];
  return pastas.every((c) => /conferirTeto\(/.test(lerTexto(c))) && /caixaDeEntrada/.test(lerTexto("app/api/fediverso/inbox/route.ts")) && /semFederacao\(\)/.test(lerTexto("lib/rede/fediverso/rotas.ts"));
});
await espera("a chave privada nunca vai para o navegador nem para o documento do ator", async () => !/chave_privada|privada/.test(lerTexto("app/api/fediverso/u/[handle]/route.ts").replace(/atorComChaves/g, "")) && !/from "@\/lib\/rede\/fediverso\/(servidor|cifra|assinatura)"/.test(lerTexto("components/rede/alumia/Fediverso.tsx")));
await espera("os documentos dizem o que funciona e o que não (FEDIVERSO.md, ALUMIA-DOMINIO.md, V2.md)", async () => /O que funciona/.test(lerTexto("docs/rede/FEDIVERSO.md")) && /O que não funciona/.test(lerTexto("docs/rede/FEDIVERSO.md")) && /lucia-b323/.test(lerTexto("docs/rede/ALUMIA-DOMINIO.md")) && /Rede social completa/.test(lerTexto("docs/rede/V2.md")));

console.log(`${certos} conferências certas, ${falhas.length} com problema.`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
