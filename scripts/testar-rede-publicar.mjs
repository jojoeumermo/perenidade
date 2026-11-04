// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o pacote publicar da Rede v2 (supabase/migracoes/2026-11-rede-publicar.sql, lib/rede/publicar/*, i18n/rede/publicar):
// o rede_publicar ampliado (e tudo o que a fundação conferia, que não pode afrouxar), enquete de voto secreto, imagens e áudio
// (pasta própria, limites), prévia de link, fio, "quem pode responder", editar (15 minutos sem marca, depois histórico),
// agendamento (ensaio, publicar ao ler, cancelar), os detalhes por lote com a matriz de visibilidade e as permissões. Também
// os módulos puros: tirar EXIF/GPS de JPEG, PNG e WebP, a trava contra SSRF, a leitura de Open Graph, a checagem de texto e
// os textos nos seis idiomas. Uso: npm run testar:rede-publicar
import fs from "node:fs";
import http from "node:http";
import { criarBanco } from "./banco-local.mjs";
import { checarTexto } from "../lib/rede/publicar/checagem.ts";
import { dimensoesDaImagem, identificarMidia, limparImagem, temMetadado } from "../lib/rede/publicar/midia.ts";
import { assinaturaConfere, enderecoDaImagem, extrairPrevia, ipPrivado, urlSegura } from "../lib/rede/publicar/previa.ts";
import { buscarSeguro } from "../lib/rede/publicar/buscar-seguro.ts";

let certos = 0;
const falhas = [];
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 240)}`);
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
const lerTexto = (caminho) => fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

// ═══════════════════ Módulos puros ═══════════════════

// ── Imagens de mentira, com metadado de verdade ──
const u8 = (...n) => Uint8Array.from(n);
const cat = (...p) => {
  const s = new Uint8Array(p.reduce((a, x) => a + x.length, 0));
  let o = 0;
  for (const x of p) (s.set(x, o), (o += x.length));
  return s;
};
const ascii = (t) => Uint8Array.from([...t].map((c) => c.charCodeAt(0)));
const seg = (marca, dados) => cat(u8(0xff, marca, (dados.length + 2) >> 8, (dados.length + 2) & 255), dados);
const GPS = ascii("Exif\0\0GPS -22.9068 -43.1729 Niteroi iPhone 15");
const jpegCru = cat(
  u8(0xff, 0xd8),
  seg(0xe0, ascii("JFIF\0\x01\x01\0\0\x01\0\x01\0\0")),
  seg(0xe1, GPS),
  seg(0xe1, ascii("http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>autor</x:xmpmeta>")),
  seg(0xe2, ascii("ICC_PROFILE\0\0\0\0\0")),
  seg(0xed, ascii("Photoshop 3.0\0")),
  seg(0xfe, ascii("comentario com nome")),
  seg(0xdb, cat(u8(0), new Uint8Array(64).fill(8))),
  seg(0xc0, u8(8, 0, 20, 0, 30, 1, 1, 0x11, 0)), // 8 bits, altura 20, largura 30
  seg(0xda, u8(1, 1, 0, 0, 63, 0)),
  u8(0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd9),
  ascii("SOBRA-DEPOIS-DO-FIM miniatura"),
);
const jpegLimpo = limparImagem(jpegCru);
await espera("JPEG: identificado pelos bytes", async () => identificarMidia(jpegCru), (m) => m?.ext === "jpg" && m.tipo === "imagem");
await espera("JPEG: EXIF, XMP, ICC, Photoshop, comentário e sobra saem", async () => jpegLimpo, (l) => l && !/GPS|Niteroi|iPhone|xmpmeta|ICC_PROFILE|Photoshop|comentario|SOBRA/.test(Buffer.from(l).toString("latin1")));
await espera("JPEG: o que desenha a imagem fica (JFIF, quadro, dados, fim)", async () => Buffer.from(jpegLimpo).toString("latin1"), (t) => t.includes("JFIF") && t.endsWith("\xff\xd9") && t.includes("\xff\xda"));
await espera("JPEG: continua com o mesmo tamanho de quadro", async () => dimensoesDaImagem(jpegLimpo), (d) => d?.largura === 30 && d.altura === 20);
await espera("JPEG: limpar duas vezes dá o mesmo", async () => limparImagem(jpegLimpo), (l) => Buffer.compare(Buffer.from(l), Buffer.from(jpegLimpo)) === 0);
await espera("JPEG cru acusa metadado; o limpo não", async () => [temMetadado(jpegCru), temMetadado(jpegLimpo)], (r) => r[0] === true && r[1] === false);
await espera("JPEG truncado é recusado", async () => limparImagem(jpegCru.subarray(0, 40)), (l) => l === null);

const crc = u8(0, 0, 0, 0);
const bloco = (tipo, dados) => cat(u8((dados.length >>> 24) & 255, (dados.length >> 16) & 255, (dados.length >> 8) & 255, dados.length & 255), ascii(tipo), dados, crc);
const ihdr = cat(u8(0, 0, 0, 40, 0, 0, 0, 25), u8(8, 6, 0, 0, 0));
const pngCru = cat(u8(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), bloco("IHDR", ihdr), bloco("eXIf", GPS), bloco("tEXt", ascii("Author\0Fulana de Tal")), bloco("tIME", u8(7, 234, 11, 4, 1, 2, 3)), bloco("iCCP", ascii("perfil\0\0xx")), bloco("IDAT", u8(1, 2, 3, 4)), bloco("IEND", u8()), ascii("LIXO-DEPOIS"));
const pngLimpo = limparImagem(pngCru);
await espera("PNG: eXIf, texto, data, perfil e sobra saem", async () => Buffer.from(pngLimpo).toString("latin1"), (t) => !/eXIf|tEXt|tIME|iCCP|Fulana|GPS|LIXO/.test(t) && t.includes("IHDR") && t.includes("IDAT") && t.endsWith("IEND\0\0\0\0"));
await espera("PNG: tamanho lido do cabeçalho", async () => dimensoesDaImagem(pngLimpo), (d) => d?.largura === 40 && d.altura === 25);

const le32 = (n) => u8(n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255);
const blocoWebp = (tipo, dados) => cat(ascii(tipo), le32(dados.length), dados, dados.length & 1 ? u8(0) : u8());
const vp8x = cat(u8(0x08 | 0x04 | 0x20), u8(0, 0, 0), u8(49, 0, 0), u8(29, 0, 0)); // flags EXIF+XMP+ICC; 50x30
const corpoWebp = cat(ascii("WEBP"), blocoWebp("VP8X", vp8x), blocoWebp("ICCP", ascii("perfil-icc")), blocoWebp("VP8 ", new Uint8Array(20).fill(7)), blocoWebp("EXIF", GPS), blocoWebp("XMP ", ascii("<xmp>autor</xmp>")));
const webpCru = cat(ascii("RIFF"), le32(corpoWebp.length), corpoWebp);
const webpLimpo = limparImagem(webpCru);
await espera("WebP: EXIF, XMP e ICC saem, com o tamanho do contêiner acertado", async () => webpLimpo, (l) => {
  const t = Buffer.from(l).toString("latin1");
  return !/EXIF|XMP |ICCP|GPS|autor/.test(t) && t.startsWith("RIFF") && ((l[4] | (l[5] << 8) | (l[6] << 16)) === l.length - 8);
});
await espera("WebP: os bits de EXIF, XMP e ICC do VP8X foram limpos", async () => webpLimpo[20], (f) => (f & (0x08 | 0x04 | 0x20)) === 0);
await espera("WebP: tamanho lido do VP8X", async () => dimensoesDaImagem(webpLimpo), (d) => d?.largura === 50 && d.altura === 30);
await espera("arquivo que não é imagem não passa (texto, PDF, SVG)", async () => [limparImagem(ascii("<svg onload=alert(1)></svg>....")), identificarMidia(ascii("%PDF-1.7 aaaaaaaa")), limparImagem(ascii("GIF89a......abc"))], (r) => r.every((x) => x === null));
await espera("áudio: WebM, Ogg e MP4 são identificados; imagem não é áudio", async () => [identificarMidia(cat(u8(0x1a, 0x45, 0xdf, 0xa3), new Uint8Array(12)))?.ext, identificarMidia(cat(ascii("OggS"), new Uint8Array(12)))?.ext, identificarMidia(cat(u8(0, 0, 0, 24), ascii("ftypM4A "), new Uint8Array(8)))?.ext, identificarMidia(jpegCru)?.tipo], (r) => r.join() === "webm,ogg,m4a,imagem");

// ── SSRF ──
const bloqueados = ["127.0.0.1", "10.1.2.3", "172.16.0.9", "172.31.255.255", "192.168.0.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "64:ff9b::7f00:1", "2002:7f00:1::1", "2001:db8::1", "ff02::1"];
for (const ip of bloqueados) await espera(`IP privado bloqueado: ${ip}`, async () => ipPrivado(ip), (b) => b === true);
for (const ip of ["8.8.8.8", "1.1.1.1", "200.160.2.3", "2606:4700:4700::1111", "172.32.0.1", "::ffff:8.8.8.8"]) await espera(`IP público passa: ${ip}`, async () => ipPrivado(ip), (b) => b === false);
for (const u of ["ftp://exemplo.com/a", "file:///etc/passwd", "javascript:alert(1)", "http://localhost/", "http://localhost:3000/", "http://127.0.0.1/", "http://[::1]/", "http://10.0.0.5/admin", "http://169.254.169.254/latest/meta-data/", "http://usuario:senha@exemplo.com/", "https://exemplo.com:8443/", "http://servidor.local/", "http://intranet/", "http://exemplo.internal/", "http://2130706433/", "http://0x7f.0.0.1/", "http://0177.0.0.1/", "http://[::ffff:7f00:1]/", "http://exemplo.com:22/"])
  await espera(`URL recusada: ${u}`, async () => urlSegura(u), (r) => r === null);
await espera("URL pública passa e perde o #fragmento", async () => urlSegura("https://www.exemplo.org/materia?id=3#topo")?.href, (h) => h === "https://www.exemplo.org/materia?id=3");
await espera("buscar-seguro recusa nome que aponta para dentro de casa (DNS enganoso)", () => buscarSeguro("http://site-inocente.exemplo.com/", { resolver: async () => ["127.0.0.1"] }), (r) => r === null);
await espera("buscar-seguro recusa quando QUALQUER endereço do nome é privado", () => buscarSeguro("http://misto.exemplo.com/", { resolver: async () => ["8.8.8.8", "10.0.0.1"] }), (r) => r === null);
await espera("buscar-seguro recusa IP privado escrito na URL", () => buscarSeguro("http://127.0.0.1:80/"), (r) => r === null);
{
  // Um servidor de verdade (só no teste, liberado pelo ipAceito): tamanho máximo, tipo, redirecionamento para dentro e tempo limite.
  const html = '<html><head><meta property="og:title" content="Greve &amp; Luta"><meta property="og:description" content="A prévia"><meta property="og:image" content="/capa.jpg"></head><body>' + "x".repeat(3000) + "</body></html>";
  const servidor = http.createServer((req, res) => {
    if (req.url === "/ok") (res.writeHead(200, { "content-type": "text/html; charset=utf-8" }), res.end(html));
    else if (req.url === "/grande") (res.writeHead(200, { "content-type": "text/html" }), res.end("y".repeat(200_000)));
    else if (req.url === "/binario") (res.writeHead(200, { "content-type": "application/octet-stream" }), res.end("zzz"));
    else if (req.url === "/para-dentro") (res.writeHead(302, { location: "http://169.254.169.254/latest/meta-data/" }), res.end());
    else if (req.url === "/volta") (res.writeHead(302, { location: "/volta" }), res.end());
    else if (req.url === "/lento") setTimeout(() => (res.writeHead(200, { "content-type": "text/html" }), res.end("tarde")), 1500);
    else (res.writeHead(404), res.end());
  });
  await new Promise((r) => servidor.listen(0, "127.0.0.1", r));
  const porta = servidor.address().port;
  const liberar = { resolver: async () => ["127.0.0.1"], ipAceito: () => true, qualquerPorta: true, tempoMs: 800 };
  const base = `http://exemplo.test:${porta}`;
  await espera("busca real: lê a página, no limite de tamanho, e a prévia sai do HTML", async () => {
    const r = await buscarSeguro(`${base}/ok`, { ...liberar, tipos: ["text/html"] });
    return extrairPrevia(Buffer.from(r.corpo).toString("utf8"), r.url);
  }, (p) => p.titulo === "Greve & Luta" && p.descricao === "A prévia" && p.imagem === null /* a porta do servidor de teste não é 80 nem 443: a imagem não é aceita */);
  await espera("busca real: corpo grande é cortado no máximo (e marcado)", async () => buscarSeguro(`${base}/grande`, { ...liberar, maxBytes: 50_000 }), (r) => r && r.corpo.length === 50_000 && r.truncado === true);
  await espera("busca real: tipo que não é o pedido é recusado", async () => buscarSeguro(`${base}/binario`, { ...liberar, tipos: ["text/html"] }), (r) => r === null);
  await espera("busca real: redirecionamento para dentro (metadados de nuvem) é barrado", async () => buscarSeguro(`${base}/para-dentro`, { ...liberar, tipos: ["text/html"] }), (r) => r === null);
  await espera("busca real: redirecionamento em círculo termina", async () => buscarSeguro(`${base}/volta`, { ...liberar }), (r) => r === null);
  await espera("busca real: servidor lento estoura o tempo limite", async () => buscarSeguro(`${base}/lento`, { ...liberar, tempoMs: 300 }), (r) => r === null);
  await espera("busca real: 404 vira nulo", async () => buscarSeguro(`${base}/nada`, { ...liberar }), (r) => r === null);
  await espera("busca real: sem a liberação de teste o mesmo servidor é recusado (127.0.0.1)", async () => buscarSeguro(`${base}/ok`, { resolver: async () => ["127.0.0.1"], qualquerPorta: true }), (r) => r === null);
  servidor.close();
}
await espera("a regra de porta recusa porta de serviço interno (a busca real só usa 80 e 443)", async () => urlSegura("http://exemplo.com:6379/"), (r) => r === null);

// ── Open Graph ──
const base = new URL("https://www.exemplo.org/materia/3");
const og = extrairPrevia('<html><head><title>Título velho</title><meta property="og:title" content="Greve &amp; Luta &#233;"><meta name="description" content="Descrição comum"><meta property="og:description" content="Uma &quot;prévia&quot;  com\nquebra"><meta property="og:image" content="/img/capa.jpg"><meta property="og:image:alt" content="x"></head><body><meta property="og:title" content="de dentro do corpo"></body></html>', base);
await espera("Open Graph: título, descrição e imagem relativa resolvida", async () => og, (r) => r.titulo === "Greve & Luta é" && r.descricao === 'Uma "prévia" com quebra' && r.imagem === "https://www.exemplo.org/img/capa.jpg" && r.dominio === "exemplo.org");
await espera("Open Graph: sem og vale o <title> e a meta description", async () => extrairPrevia("<head><title> Só o título </title><meta name='description' content='desc simples'></head>", base), (r) => r.titulo === "Só o título" && r.descricao === "desc simples" && r.imagem === null);
await espera("Open Graph: imagem para dentro de casa é descartada", async () => extrairPrevia('<head><meta property="og:image" content="http://127.0.0.1/segredo.png"></head>', base).imagem, (i) => i === null);
await espera("Open Graph: título gigante é cortado e controle some", async () => extrairPrevia(`<head><meta property="og:title" content="${"a".repeat(900)}\u0007"></head>`, base).titulo.length, (n) => n === 200);
await espera("a imagem só sai pelo proxy assinado; sem segredo, não há imagem", async () => {
  const e = enderecoDaImagem("https://www.exemplo.org/capa.jpg", "segredo-de-teste");
  const u = new URL(e, "https://site.test");
  return [enderecoDaImagem("https://x.org/a.jpg", undefined), u.pathname, assinaturaConfere(u.searchParams.get("u"), u.searchParams.get("s"), "segredo-de-teste"), assinaturaConfere("https://outro.org/b.jpg", u.searchParams.get("s"), "segredo-de-teste"), assinaturaConfere(u.searchParams.get("u"), u.searchParams.get("s"), "outro-segredo"), assinaturaConfere("x", "zz", "segredo-de-teste")];
}, (r) => r[0] === null && r[1] === "/api/rede/previa/imagem" && r[2] === true && r[3] === false && r[4] === false && r[5] === false);

// ── Checagem de texto ──
await espera("checagem: CPF, telefone, e-mail e endereço com número bloqueiam", async () => [
  checarTexto("meu cpf 123.456.789-09").bloqueia[0]?.tipo, checarTexto("liga (21) 98888-7777").bloqueia[0]?.tipo, checarTexto("fulana@exemplo.com").bloqueia[0]?.tipo,
  checarTexto("moro na Rua das Flores, 123 perto da praça").bloqueia[0]?.tipo, checarTexto("Avenida Brasil nº 4500").bloqueia[0]?.tipo,
], (r) => r.join() === "cpf,telefone,email,endereco,endereco");
await espera("checagem: texto comum passa; rua sem número passa", async () => [checarTexto("A greve começou ontem na escola da Rua Direita.").bloqueia.length, checarTexto("Somos 120 professores, ato às 14h").bloqueia.length], (r) => r[0] === 0 && r[1] === 0);
await espera("checagem: ódio só avisa (vai para a mediação), não bloqueia", async () => checarTexto("seu macaco!"), (r) => r.bloqueia.length === 0 && r.avisa[0]?.tipo === "odio");
await espera("checagem: 'macaco' de carro não é xingamento (palavra inteira, mas sem contexto: avisa)", async () => checarTexto("o macaco hidráulico quebrou").avisa.length, (n) => n === 1);

// ═══════════════════ Banco ═══════════════════
const banco = await criarBanco({ semRede: true });
const { dono, criarUsuario, rpc } = banco;
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];
const todos = async (texto, valores = []) => (await dono(texto, valores)).rows;
// Por padrão só a fundação e este pacote; com REDE_TODAS=1 carrega todas as migrações rede na ordem de docs/rede/V2.md (a integração).
const ORDEM = ["fundacao", "consertos", "perfil", "publicar", "conversa", "descoberta", "comunidades", "avisos", "moderacao"];
const migracoes = (process.env.REDE_TODAS ? ORDEM.filter((n) => fs.existsSync(new URL(`../supabase/migracoes/2026-11-rede-${n}.sql`, import.meta.url))) : ["fundacao", "publicar"]).map((n) => fs.readFileSync(new URL(`../supabase/migracoes/2026-11-rede-${n}.sql`, import.meta.url), "utf8"));

for (const m of migracoes) await espera("a migração instala sobre o install.sql", () => banco.exclusivo(() => banco.pg.exec(m)));
await espera("instalar de novo não quebra", () => banco.exclusivo(async () => { for (const m of migracoes) await banco.pg.exec(m); }));

let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++}` });
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++}` });
const servico = () => ({ papel: "service_role", ip: `203.0.113.${ip++}` });

const pessoas = {};
const nomes = ["autora", "membro", "seguidor", "mencionada", "estranho", "semconsent", "menor"];
for (const [i, nome] of nomes.entries()) {
  pessoas[nome] = await criarUsuario(`${nome}@pub.local`, nome);
  await rpc(como(pessoas[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true where id = $1", [pessoas[nome], `Pessoa ${i + 1} ${nome}`]);
}
await dono("delete from interno.papeis");
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of ["autora", "membro", "seguidor", "mencionada", "estranho", "semconsent"]) await dono("update interno.perfis set rede_18 = true, rede_consentimento = 1 where id = $1", [pessoas[nome]]);
for (const nome of ["autora", "membro", "seguidor", "mencionada", "estranho"]) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1)", [pessoas[nome]]);
await dono("update auth.users set created_at = now() - interval '30 days'");
await dono("update interno.perfis set rede_handle = 'autora_luta' where id = $1", [pessoas.autora]);
await dono("update interno.perfis set rede_handle = 'mencionada_luta' where id = $1", [pessoas.mencionada]);
await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2)", [pessoas.autora, pessoas.seguidor]); // a autora SEGUE o seguidor
await dono(`insert into interno.rede_comunidades (slug, nome, categoria, tipo, publico_padrao) values ('matematica', 'Matemática', 'disciplinas', 'aberta', 'internet') on conflict (slug) do update set categoria = 'disciplinas', tipo = 'aberta', publico_padrao = 'internet'`);

// Na integração completa, os níveis de confiança do pacote moderação limitam imagens, links e posts por dia de quem é novo: aqui
// o teste abre os limites para provar o NOSSO pacote (os limites deles têm o teste deles).
if (process.env.REDE_TODAS) await dono("update interno.rede_niveis set imagens = 4, links = 50, posts_dia = 5000").catch(() => undefined);
const ID = "[a-f0-9-]{36}";
const pub = (quem, p) => rpc(como(pessoas[quem]), "rede_publicar", { p });
const novoId = () => crypto.randomUUID();
const zerar = () => dono("delete from interno.limites");
const caminhoDe = (quem, ext = "webp") => `${pessoas[quem]}/${novoId()}.${ext}`;

// ── O que a fundação conferia continua valendo ──
await recusa("visitante não publica", () => rpc(visitante(), "rede_publicar", { p: { texto: "oi" } }), "permission denied");
await recusa("sem 18 anos não publica", () => pub("menor", { texto: "oi" }), "confirme_idade");
await recusa("sem consentimento não publica", () => pub("semconsent", { texto: "oi" }), "consentimento");
await recusa("CPF recusado", () => pub("autora", { texto: "meu cpf 123.456.789-09" }), "dado_pessoal");
await recusa("telefone recusado", () => pub("autora", { texto: "me liga 21 98888-7777" }), "dado_pessoal");
await recusa("e-mail recusado", () => pub("autora", { texto: "escreve para fulana@exemplo.com" }), "dado_pessoal");
await recusa("endereço com número recusado", () => pub("autora", { texto: "ela mora na Rua das Flores, 123, ap 4" }), "dado_pessoal");
await recusa("endereço com número recusado (nº)", () => pub("autora", { texto: "ponto na Avenida Central nº 45" }), "dado_pessoal");
await espera("rua sem número passa", () => pub("autora", { texto: "A assembleia é na quadra da Rua Direita, depois do ato." }), (r) => r.id && r.retido === false);
await recusa("tipo inventado", () => pub("autora", { tipo: "video", texto: "x" }), "invalido:tipo");
await recusa("público 'internet' fora de disciplina", () => pub("autora", { texto: "x", publico: "internet" }), "invalido:publico");
await espera("público padrão da disciplina é a internet (ampliado não mudou)", async () => (await pub("autora", { texto: "Sobre frações.", comunidade: "matematica" })).publico, (p) => p === "internet");

// ── Enquete ──
const enq = await pub("autora", { tipo: "enquete", texto: "Qual dia para a assembleia?", enquete: { opcoes: ["Terça", "Quinta", "Sábado"], horas: 24, multipla: false } });
await espera("enquete nasce como post do tipo enquete", async () => enq, (r) => r.tipo === "enquete" && r.id);
await recusa("enquete com 1 opção", () => pub("autora", { tipo: "enquete", texto: "Pergunta?", enquete: { opcoes: ["só uma"], horas: 24 } }), "invalido:opcoes");
await recusa("enquete com 5 opções", () => pub("autora", { tipo: "enquete", texto: "Pergunta?", enquete: { opcoes: ["a", "b", "c", "d", "e"], horas: 24 } }), "invalido:opcoes");
await recusa("enquete com opções repetidas", () => pub("autora", { tipo: "enquete", texto: "Pergunta?", enquete: { opcoes: ["Sim", "sim"], horas: 24 } }), "invalido:opcoes");
await recusa("enquete com opção de 81 letras", () => pub("autora", { tipo: "enquete", texto: "Pergunta?", enquete: { opcoes: ["a".repeat(81), "b"], horas: 24 } }), "invalido:opcoes");
await recusa("enquete com prazo de 200 horas", () => pub("autora", { tipo: "enquete", texto: "Pergunta?", enquete: { opcoes: ["a", "b"], horas: 200 } }), "invalido:prazo");
await recusa("enquete sem as opções", () => pub("autora", { tipo: "enquete", texto: "Pergunta?" }), "invalido:enquete");
await recusa("opção da enquete com endereço com número", () => pub("autora", { tipo: "enquete", texto: "Onde?", enquete: { opcoes: ["Rua das Flores, 123", "Praça"], horas: 5 } }), "dado_pessoal");
await recusa("objeto 'enquete' num post que não é enquete", () => pub("autora", { texto: "x", enquete: { opcoes: ["a", "b"] } }), "invalido:enquete");
const opcoes = (await todos("select id, texto from interno.rede_opcoes where enquete = $1 order by ordem", [enq.id])).map((o) => o.id);
const det = (quem, ids) => rpc(quem === null ? visitante() : como(pessoas[quem]), "rede_pub_detalhes", { p_ids: ids });
await espera("quem não votou não vê os totais", async () => (await det("membro", [enq.id]))[enq.id].enquete, (e) => e.opcoes.length === 3 && e.opcoes.every((o) => o.votos === undefined || o.votos === null) && (e.total === undefined || e.total === null) && e.votei.length === 0);
await espera("a autora vê os totais da própria enquete", async () => (await det("autora", [enq.id]))[enq.id].enquete, (e) => e.total === 0 && e.opcoes.every((o) => o.votos === 0));
await recusa("visitante não vota", () => rpc(visitante(), "rede_pub_enquete_votar", { p_post: enq.id, p_opcoes: [opcoes[0]] }), "permission denied");
await recusa("sem consentimento não vota", () => rpc(como(pessoas.semconsent), "rede_pub_enquete_votar", { p_post: enq.id, p_opcoes: [opcoes[0]] }), "consentimento");
await recusa("duas opções em enquete simples", () => rpc(como(pessoas.membro), "rede_pub_enquete_votar", { p_post: enq.id, p_opcoes: [opcoes[0], opcoes[1]] }), "invalido:opcoes");
await recusa("opção de outra enquete", () => rpc(como(pessoas.membro), "rede_pub_enquete_votar", { p_post: enq.id, p_opcoes: [novoId()] }), "invalido:opcoes");
await espera("votar devolve os totais a quem votou", () => rpc(como(pessoas.membro), "rede_pub_enquete_votar", { p_post: enq.id, p_opcoes: [opcoes[1]] }), (e) => e.total === 1 && e.opcoes[1].votos === 1 && e.opcoes[0].votos === 0 && e.votei[0] === opcoes[1]);
await recusa("voto não se troca", () => rpc(como(pessoas.membro), "rede_pub_enquete_votar", { p_post: enq.id, p_opcoes: [opcoes[2]] }), "ja_votou");
await espera("segundo eleitor", () => rpc(como(pessoas.seguidor), "rede_pub_enquete_votar", { p_post: enq.id, p_opcoes: [opcoes[1]] }), (e) => e.total === 2 && e.opcoes[1].votos === 2);
await espera("voto secreto: nenhum retorno público tem o id de quem votou", async () => {
  const textos = [JSON.stringify(await det("autora", [enq.id])), JSON.stringify(await det("membro", [enq.id])), JSON.stringify(await rpc(como(pessoas.autora), "rede_post", { p_id: enq.id })), JSON.stringify(await rpc(como(pessoas.autora), "rede_linha", { p_aba: "tudo" }))];
  return textos.every((t) => !t.includes(pessoas.membro) && !t.includes(pessoas.seguidor));
}, (b) => b === true);
await espera("o banco não deixa ninguém ler a tabela de votos (sem permissão para authenticated e anon)", async () => [(await um("select has_table_privilege('authenticated', 'interno.rede_votos', 'select') as x")).x, (await um("select has_table_privilege('anon', 'interno.rede_votos', 'select') as x")).x], (x) => x[0] === false && x[1] === false);
await dono("update interno.rede_enquetes set prazo = now() - interval '1 minute' where post = $1", [enq.id]);
await recusa("depois do prazo não se vota", () => rpc(como(pessoas.estranho), "rede_pub_enquete_votar", { p_post: enq.id, p_opcoes: [opcoes[0]] }), "encerrada");
await espera("depois do prazo todos veem os totais", async () => (await det("estranho", [enq.id]))[enq.id].enquete, (e) => e.encerrada === true && e.total === 2 && e.opcoes[1].votos === 2);
const enqM = await pub("autora", { tipo: "enquete", texto: "O que levar?", enquete: { opcoes: ["Faixa", "Panfleto", "Água"], horas: 2, multipla: true } });
const opM = (await todos("select id from interno.rede_opcoes where enquete = $1 order by ordem", [enqM.id])).map((o) => o.id);
await espera("enquete múltipla aceita duas opções", () => rpc(como(pessoas.membro), "rede_pub_enquete_votar", { p_post: enqM.id, p_opcoes: [opM[0], opM[2]] }), (e) => e.total === 1 && e.opcoes[0].votos === 1 && e.opcoes[2].votos === 1);
await recusa("opção repetida no mesmo voto", () => rpc(como(pessoas.seguidor), "rede_pub_enquete_votar", { p_post: enqM.id, p_opcoes: [opM[0], opM[0]] }), "invalido:opcoes");
await recusa("enquete como resposta é recusada", () => pub("membro", { tipo: "enquete", texto: "x", resposta_a: enq.id, enquete: { opcoes: ["a", "b"] } }), "invalido:tipo");

await zerar();
// ── Imagens ──
const reserva = await rpc(como(pessoas.autora), "rede_pub_midia_reservar", { p_ext: "webp" });
await espera("reservar dá um caminho na pasta da própria pessoa", async () => reserva, (r) => new RegExp(`^${pessoas.autora}/${ID}\\.webp$`).test(r.caminho));
await recusa("reservar extensão estranha", () => rpc(como(pessoas.autora), "rede_pub_midia_reservar", { p_ext: "svg" }), "invalido:arquivo");
await recusa("reservar sem consentimento", () => rpc(como(pessoas.semconsent), "rede_pub_midia_reservar", { p_ext: "webp" }), "consentimento");
await recusa("visitante não reserva", () => rpc(visitante(), "rede_pub_midia_reservar", { p_ext: "webp" }), "permission denied");
const imgs = [0, 1].map(() => ({ caminho: caminhoDe("autora"), alt: "Faixa de greve na porta da escola", largura: 800, altura: 600 }));
const comImg = await pub("autora", { texto: "Foto da porta da escola hoje.", publico: "membros", midia: imgs });
await espera("post com 2 imagens guarda alt, ordem e tamanho", async () => todos("select caminho, alt, ordem, largura, tipo from interno.rede_midia where post = $1 order by ordem", [comImg.id]), (r) => r.length === 2 && r[0].ordem === 0 && r[1].ordem === 1 && r[0].alt.startsWith("Faixa") && r[0].tipo === "image/webp" && r[0].largura === 800);
await espera("a resposta do post traz a mídia sem o caminho do arquivo", async () => comImg.midia, (m) => m.length === 2 && m[0].alt && !JSON.stringify(m).includes("/"));
await recusa("5 imagens", () => pub("autora", { texto: "x", midia: Array.from({ length: 5 }, () => ({ caminho: caminhoDe("autora"), alt: "" })) }), "invalido:midia");
await recusa("imagem na pasta de outra pessoa", () => pub("autora", { texto: "x", midia: [{ caminho: caminhoDe("membro"), alt: "" }] }), "invalido:midia");
await recusa("imagem com caminho inventado", () => pub("autora", { texto: "x", midia: [{ caminho: "../../etc/passwd", alt: "" }] }), "invalido:midia");
await recusa("imagem com extensão de script", () => pub("autora", { texto: "x", midia: [{ caminho: `${pessoas.autora}/${novoId()}.svg`, alt: "" }] }), "invalido:midia");
await recusa("o mesmo arquivo não vira imagem de dois posts", () => pub("autora", { texto: "x", midia: [imgs[0]] }), "invalido:midia");
await recusa("texto alternativo com endereço com número", () => pub("autora", { texto: "x", midia: [{ caminho: caminhoDe("autora"), alt: "placa da Rua das Flores, 123" }] }), "dado_pessoal");
await recusa("tamanho da imagem fora do limite", () => pub("autora", { texto: "x", midia: [{ caminho: caminhoDe("autora"), alt: "", largura: 99999, altura: 10 }] }), "invalido:post");
const idMidia = comImg.midia[0].id;
await espera("o caminho do arquivo sai para quem pode ver o post", async () => rpc(como(pessoas.membro), "rede_pub_midia_caminho", { p_id: idMidia }), (r) => r.bucket === "rede-midia" && r.caminho.startsWith(pessoas.autora));
await recusa("e não sai para visitante (post só de membros)", () => rpc(visitante(), "rede_pub_midia_caminho", { p_id: idMidia }), "nao_encontrado");
await espera("a regra do depósito: membro lê, visitante não", async () => [await rpc(como(pessoas.membro), "rede_pub_midia_pode", { p_caminho: imgs[0].caminho }), await rpc(visitante(), "rede_pub_midia_pode", { p_caminho: imgs[0].caminho })], (r) => r[0] === true && r[1] === false);
const imgPublica = await pub("autora", { texto: "Aula aberta de frações.", comunidade: "matematica", midia: [{ caminho: caminhoDe("autora"), alt: "Quadro com frações" }] });
await espera("imagem de post público (disciplina) o visitante pode pedir", async () => rpc(visitante(), "rede_pub_midia_caminho", { p_id: imgPublica.midia[0].id }), (r) => r.bucket === "rede-midia");

// ── Áudio ──
const aud = await pub("autora", { texto: "Recado em áudio.", audio: { caminho: caminhoDe("autora", "webm"), duracao: 42 } });
await espera("post com áudio de 42 s", async () => (await det("autora", [aud.id]))[aud.id].audio, (a) => a.duracao === 42 && a.tipo === "audio/webm" && a.id);
await recusa("áudio de 61 s", () => pub("autora", { texto: "x", audio: { caminho: caminhoDe("autora", "webm"), duracao: 61 } }), "invalido:audio");
await recusa("áudio de 0 s", () => pub("autora", { texto: "x", audio: { caminho: caminhoDe("autora", "webm"), duracao: 0 } }), "invalido:audio");
await recusa("áudio na pasta de outra pessoa", () => pub("autora", { texto: "x", audio: { caminho: caminhoDe("membro", "webm"), duracao: 10 } }), "invalido:audio");
await recusa("áudio com imagem no mesmo post", () => pub("autora", { texto: "x", audio: { caminho: caminhoDe("autora", "webm"), duracao: 10 }, midia: [{ caminho: caminhoDe("autora"), alt: "" }] }), "invalido:midia");
await espera("o caminho do áudio sai pelo id do áudio", async () => rpc(como(pessoas.autora), "rede_pub_midia_caminho", { p_id: (await det("autora", [aud.id]))[aud.id].audio.id }), (r) => r.tipo === "audio/webm");

// ── Prévia de link ──
const prev = await pub("autora", { texto: "Vale ler.", previa: { url: "https://www.exemplo.org/materia?id=3", titulo: "Greve & Luta", descricao: "Uma matéria", imagem: "/api/rede/previa/imagem?u=https%3A%2F%2Fwww.exemplo.org%2Fcapa.jpg&s=abcdef0123456789abcdef0123456789" } });
await espera("prévia guardada com domínio calculado no banco", async () => (await det("autora", [prev.id]))[prev.id].previa, (p) => p.url.startsWith("https://www.exemplo.org") && p.dominio === "www.exemplo.org" && p.titulo === "Greve & Luta" && p.imagem.startsWith("/api/rede/previa/imagem?u="));
await espera("imagem de prévia que não é do nosso proxy é descartada", async () => (await det("autora", [(await pub("autora", { texto: "x", previa: { url: "https://exemplo.org/a", titulo: "t", imagem: "https://tracker.exemplo.org/pixel.gif" } })).id])), (r) => Object.values(r)[0].previa.imagem === undefined);
await recusa("prévia com javascript:", () => pub("autora", { texto: "x", previa: { url: "javascript:alert(1)", titulo: "t" } }), "invalido:previa");
await recusa("prévia com senha na URL", () => pub("autora", { texto: "x", previa: { url: "https://u:s@exemplo.org/", titulo: "t" } }), "invalido:previa");
await espera("título da prévia é cortado em 200", async () => (await det("autora", [(await pub("autora", { texto: "x", previa: { url: "https://exemplo.org/b", titulo: "t".repeat(500) } })).id])), (r) => Object.values(r)[0].previa.titulo.length === 200);

await zerar();
// ── Quem pode responder ──
const conversa = async (responde_quem, extra = {}) => pub("autora", { texto: `Conversa (${responde_quem}). @mencionada_luta, o que acha?`, publico: "membros", responde_quem, ...extra });
const cNinguem = await conversa("ninguem");
await recusa("ninguém: um membro não responde", () => pub("membro", { texto: "oi", resposta_a: cNinguem.id }), "sem_permissao");
await espera("ninguém: a autora ainda responde a si mesma", () => pub("autora", { texto: "complemento", resposta_a: cNinguem.id }), (r) => r.id);
const cSegue = await conversa("seguindo");
await recusa("seguindo: quem a autora não segue não responde", () => pub("membro", { texto: "oi", resposta_a: cSegue.id }), "sem_permissao");
await espera("seguindo: quem a autora segue responde", () => pub("seguidor", { texto: "oi, sou seguido", resposta_a: cSegue.id }), (r) => r.id);
const cMenc = await conversa("mencionados");
await recusa("mencionados: quem não foi citado não responde", () => pub("membro", { texto: "oi", resposta_a: cMenc.id }), "sem_permissao");
await espera("mencionados: quem foi citado responde", () => pub("mencionada", { texto: "acho que sim", resposta_a: cMenc.id }), (r) => r.id);
const cTodos = await conversa("todos");
await espera("todos: qualquer membro responde", () => pub("membro", { texto: "oi", resposta_a: cTodos.id }), (r) => r.id);
await espera("a restrição vale para respostas mais fundas (a raiz manda)", async () => {
  const r1 = await pub("seguidor", { texto: "oi, sou seguido (2)", resposta_a: cSegue.id });
  try { await pub("membro", { texto: "tentando por baixo", resposta_a: r1.id }); return "passou"; } catch (e) { return e.message; }
}, (m) => String(m).includes("sem_permissao"));
await recusa("valor inventado de 'quem pode responder'", () => pub("autora", { texto: "x", responde_quem: "amigos" }), "invalido:responde_quem");
await espera("o detalhe informa quem pode responder", async () => (await det("membro", [cNinguem.id, cTodos.id])), (r) => r[cNinguem.id].responde_quem === "ninguem" && r[cTodos.id].responde_quem === "todos");

await zerar();
// ── Fio ──
const f1 = await pub("autora", { texto: "Fio sobre a assembleia (1/3)", publico: "membros" });
const f2 = await pub("autora", { texto: "Segunda parte do fio (2/3)", resposta_a: f1.id, fio: true });
const f3 = await pub("autora", { texto: "Terceira parte (3/3)", resposta_a: f2.id, fio: true });
await espera("fio: a sequência do mesmo autor é guardada como fio, na árvore", async () => [f2.resposta_a === f1.id, f3.nivel, (await det("membro", [f2.id, f3.id]))[f2.id].fio, (await det("membro", [f1.id]))[f1.id].fio], (r) => r[0] && r[1] === 2 && r[2] === true && r[3] === false);
await recusa("fio sem resposta", () => pub("autora", { texto: "x", fio: true }), "invalido:fio");
await recusa("fio em cima de post de outra pessoa", () => pub("membro", { texto: "x", resposta_a: f1.id, fio: true }), "invalido:fio");
await recusa("o limite de 6 níveis continua valendo", async () => {
  let pai = f3;
  for (let i = 0; i < 6; i++) pai = await pub("autora", { texto: `nível ${i}`, resposta_a: pai.id });
  return pub("autora", { texto: "sétimo", resposta_a: pai.id });
}, "limite_de_niveis");

// ── Detalhes e a matriz ──
await espera("detalhes: o que a pessoa não pode ver não aparece", async () => {
  const restrito = await pub("autora", { texto: "Só para quem sigo", publico: "seguidores" });
  const r = await det("estranho", [restrito.id, cTodos.id]);
  return [restrito.id in r, cTodos.id in r];
}, (r) => r[0] === false && r[1] === true);
await espera("detalhes: visitante só vê detalhes de post de internet", async () => {
  const r = await det(null, [comImg.id, imgPublica.id]);
  return [comImg.id in r, imgPublica.id in r];
}, (r) => r[0] === false && r[1] === true);
await espera("detalhes: lote vazio e lote com id inexistente não quebram", async () => [Object.keys(await det("membro", [])).length, Object.keys(await det("membro", [novoId()])).length], (r) => r[0] === 0 && r[1] === 0);
await espera("detalhes: post retido só aparece para a própria autora", async () => {
  const x = await pub("autora", { texto: "Para revisão." });
  await dono("update interno.rede_posts set oculto = true, retido = true where id = $1", [x.id]);
  return [x.id in (await det("membro", [x.id])), x.id in (await det("autora", [x.id]))];
}, (r) => r[0] === false && r[1] === true);

await zerar();
// ── Editar ──
const e1 = await pub("autora", { texto: "Texto original da autora." });
await recusa("só a autora edita", () => rpc(como(pessoas.membro), "rede_pub_editar", { p_post: e1.id, p: { texto: "invadido" } }), "sem_permissao");
await recusa("visitante não edita", () => rpc(visitante(), "rede_pub_editar", { p_post: e1.id, p: { texto: "x" } }), "permission denied");
const e1b = await rpc(como(pessoas.autora), "rede_pub_editar", { p_post: e1.id, p: { texto: "Texto corrigido logo em seguida." } });
await espera("nos 15 minutos a edição passa sem marca e sem histórico", async () => [e1b.texto, e1b.editado_em, (await todos("select 1 from interno.rede_post_edicoes where post = $1", [e1.id])).length], (r) => r[0] === "Texto corrigido logo em seguida." && r[1] === null && r[2] === 0);
await espera("a janela livre aparece para a autora", async () => (await det("autora", [e1.id]))[e1.id].janela_livre, (j) => j === true);
await dono("update interno.rede_posts set criado_em = now() - interval '20 minutes' where id = $1", [e1.id]);
const e1c = await rpc(como(pessoas.autora), "rede_pub_editar", { p_post: e1.id, p: { texto: "Terceira versão, agora com marca." } });
await espera("depois dos 15 minutos o post ganha 'editado' e o texto anterior fica guardado", async () => [e1c.editado_em !== null, await rpc(como(pessoas.membro), "rede_pub_historico", { p_post: e1.id })], (r) => r[0] && r[1].length === 1 && r[1][0].texto === "Texto corrigido logo em seguida.");
await espera("o detalhe marca editado e histórico; a janela livre acabou", async () => (await det("membro", [e1.id]))[e1.id], (d) => d.editado === true && d.historico === true && !d.janela_livre);
await recusa("editar com dado pessoal", () => rpc(como(pessoas.autora), "rede_pub_editar", { p_post: e1.id, p: { texto: "agora com o cpf 123.456.789-09" } }), "dado_pessoal");
await recusa("editar com endereço com número", () => rpc(como(pessoas.autora), "rede_pub_editar", { p_post: e1.id, p: { texto: "na Rua das Flores, 123" } }), "dado_pessoal");
await recusa("histórico de post que não se vê", async () => {
  const r = await pub("autora", { texto: "restrito", publico: "seguidores" });
  return rpc(como(pessoas.estranho), "rede_pub_historico", { p_post: r.id });
}, "nao_encontrado");
await espera("editar um post longo: título e corpo", async () => {
  const d = await pub("autora", { tipo: "discussao", titulo: "Título da discussão", corpo: "Corpo longo da discussão sobre a greve. ".repeat(3) });
  await dono("update interno.rede_posts set criado_em = now() - interval '1 hour' where id = $1", [d.id]);
  const r = await rpc(como(pessoas.autora), "rede_pub_editar", { p_post: d.id, p: { titulo: "Título revisto da discussão", corpo: "Corpo revisto da discussão sobre a greve." } });
  const h = await rpc(como(pessoas.autora), "rede_pub_historico", { p_post: d.id });
  return [r.titulo, r.corpo, h[0].texto.includes("Título da discussão")];
}, (r) => r[0] === "Título revisto da discussão" && r[1].startsWith("Corpo revisto") && r[2]);
await recusa("enquete com voto não muda a pergunta", () => rpc(como(pessoas.autora), "rede_pub_editar", { p_post: enq.id, p: { texto: "Outra pergunta" } }), "sem_permissao");
await espera("editar sem mudar nada devolve o post sem marca", async () => (await rpc(como(pessoas.autora), "rede_pub_editar", { p_post: e1.id, p: { texto: "Terceira versão, agora com marca." } })).editado_em !== null, (b) => b === true);
await espera("o histórico não cresce quando nada mudou", async () => (await rpc(como(pessoas.autora), "rede_pub_historico", { p_post: e1.id })).length, (n) => n === 1);

await zerar();
// ── Regra simples de ódio ──
await espera("xingamento de ódio explícito (que o filtro antigo deixaria passar) nasce retido pela regra simples", async () => pub("autora", { texto: "seu macaco aqui" }), (r) => r.retido === true && r.motivo === "regra_simples_odio");
await espera("o que o filtro antigo já pega continua retido", async () => pub("autora", { texto: "seu macaco imundo" }), (r) => r.retido === true);
await espera("texto comum não é retido pela regra simples", async () => pub("autora", { texto: "A assembleia de hoje foi ótima." }), (r) => r.retido === false);
await espera("o post retido não aparece para os outros", async () => {
  const r = await pub("autora", { texto: "outro viado qualquer aqui" });
  return (await rpc(como(pessoas.membro), "rede_post", { p_id: r.id }).then(() => "viu", () => "nao-viu"));
}, (r) => r === "nao-viu");

await zerar();
// ── Agendar ──
const antes = (await um("select count(*)::int n from interno.rede_posts")).n;
const quandoOk = new Date(Date.now() + 3600e3).toISOString();
await recusa("agendar para daqui a 1 minuto", () => rpc(como(pessoas.autora), "rede_pub_agendar", { p: { texto: "x" }, p_quando: new Date(Date.now() + 60e3).toISOString() }), "invalido:quando");
await recusa("agendar para daqui a 40 dias", () => rpc(como(pessoas.autora), "rede_pub_agendar", { p: { texto: "x" }, p_quando: new Date(Date.now() + 40 * 86400e3).toISOString() }), "invalido:quando");
await recusa("o ensaio pega dado pessoal na hora de agendar", () => rpc(como(pessoas.autora), "rede_pub_agendar", { p: { texto: "cpf 123.456.789-09" }, p_quando: quandoOk }), "dado_pessoal");
await recusa("o ensaio pega comunidade que não existe", () => rpc(como(pessoas.autora), "rede_pub_agendar", { p: { texto: "x", comunidade: "nao-existe" }, p_quando: quandoOk }), "invalido:comunidade");
await recusa("visitante não agenda", () => rpc(visitante(), "rede_pub_agendar", { p: { texto: "x" }, p_quando: quandoOk }), "permission denied");
const ag = await rpc(como(pessoas.autora), "rede_pub_agendar", { p: { texto: "Bom dia, o ato começa às 14h.", publico: "membros" }, p_quando: quandoOk });
await espera("agendar guarda o pedido e NÃO cria o post ainda (o ensaio é desfeito)", async () => [ag.id, (await um("select count(*)::int n from interno.rede_posts")).n], (r) => r[0] && r[1] === antes);
await espera("ao ler, o que ainda não venceu continua pendente", async () => rpc(como(pessoas.autora), "rede_pub_agendados"), (l) => l.length === 1 && l[0].estado === "pendente" && l[0].texto.startsWith("Bom dia"));
await espera("só a dona vê a fila dela", async () => rpc(como(pessoas.membro), "rede_pub_agendados"), (l) => l.length === 0);
await dono("update interno.rede_agendados set quando = now() - interval '1 minute' where id = $1", [ag.id]);
await espera("depois da hora, a fila publica ao ler, em nome da autora", async () => {
  const l = await rpc(como(pessoas.autora), "rede_pub_agendados");
  const p = await um("select autor, texto, publico from interno.rede_posts where id = $1", [l[0].post]);
  return [l[0].estado, p.autor === pessoas.autora, p.texto, p.publico];
}, (r) => r[0] === "publicado" && r[1] && r[2].startsWith("Bom dia") && r[3] === "membros");
await espera("ler de novo não publica em dobro", async () => { await rpc(como(pessoas.autora), "rede_pub_agendados"); return (await um("select count(*)::int n from interno.rede_posts where texto like 'Bom dia, o ato%'")).n; }, (n) => n === 1);
await espera("o contexto de quem chama volta ao normal depois de publicar pela fila", async () => (await um("select coalesce(nullif(current_setting('request.jwt.claims', true), ''), 'vazio') c")).c, (c) => !c.includes(pessoas.autora));
const ag2 = await rpc(como(pessoas.autora), "rede_pub_agendar", { p: { texto: "Este vai ser cancelado." }, p_quando: quandoOk });
await recusa("outra pessoa não cancela o agendamento alheio", () => rpc(como(pessoas.membro), "rede_pub_agendar_cancelar", { p_id: ag2.id }), "nao_encontrado");
await espera("a dona cancela", () => rpc(como(pessoas.autora), "rede_pub_agendar_cancelar", { p_id: ag2.id }), (r) => r.cancelado === true);
await dono("update interno.rede_agendados set quando = now() - interval '1 minute' where id = $1", [ag2.id]);
await espera("cancelado não publica", async () => { await rpc(como(pessoas.autora), "rede_pub_agendados"); return (await um("select count(*)::int n from interno.rede_posts where texto = 'Este vai ser cancelado.'")).n; }, (n) => n === 0);
const ag3 = await rpc(como(pessoas.autora), "rede_pub_agendar", { p: { texto: "Quem manda é o banco.", comunidade: "matematica" }, p_quando: quandoOk });
await dono("update interno.rede_agendados set quando = now() - interval '1 minute' where id = $1", [ag3.id]);
await espera("o agendador (service_role) publica o que venceu de todo mundo", async () => rpc(servico(), "rede_pub_agendados_rodar"), (n) => n >= 1);
await espera("e o post saiu", async () => (await um("select count(*)::int n from interno.rede_posts where texto = 'Quem manda é o banco.'")).n, (n) => n === 1);
const ag4 = await rpc(como(pessoas.autora), "rede_pub_agendar", { p: { texto: "Vai falhar porque a conta perdeu a idade." }, p_quando: quandoOk });
await dono("update interno.perfis set rede_18 = false where id = $1", [pessoas.autora]);
await dono("update interno.rede_agendados set quando = now() - interval '1 minute' where id = $1", [ag4.id]);
await dono("update interno.perfis set rede_18 = true where id = $1", [pessoas.autora]);
await dono("update interno.perfis set rede_18 = false where id = $1", [pessoas.autora]);
await espera("o que falha na hora fica 'falhou' com o código, sem derrubar a fila", async () => { await rpc(servico(), "rede_pub_agendados_rodar"); return um("select estado, erro from interno.rede_agendados where id = $1", [ag4.id]); }, (r) => r.estado === "falhou" && r.erro.includes("confirme_idade"));
await dono("update interno.perfis set rede_18 = true where id = $1", [pessoas.autora]);
await zerar();
await espera("máximo de 10 agendamentos pendentes", async () => {
  for (let i = 0; i < 10; i++) await rpc(como(pessoas.membro), "rede_pub_agendar", { p: { texto: `agendado ${i}` }, p_quando: quandoOk });
  try { await rpc(como(pessoas.membro), "rede_pub_agendar", { p: { texto: "o 11º" }, p_quando: quandoOk }); return "passou"; } catch (e) { return e.message; }
}, (m) => String(m).includes("muitos_pedidos"));

// ── Permissões ──
await espera("funções internas do pacote não são chamáveis de fora", async () => {
  const r = await todos(`select p.oid::regprocedure::text as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'interno' and p.proname like 'rede3\\_pub%' and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`);
  return r.map((x) => x.f);
}, (l) => l.length === 0);
await espera("nenhuma tabela do pacote é legível por anon ou authenticated", async () => (await todos(`select c.relname from pg_class c where c.relnamespace = 'interno'::regnamespace and c.relname in ('rede_pub_extras', 'rede_audios', 'rede_agendados') and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('authenticated', c.oid, 'select') or has_table_privilege('authenticated', c.oid, 'insert'))`)).length, (n) => n === 0);
await espera("nenhuma tabela do pacote no esquema public", async () => (await todos(`select 1 from pg_class where relnamespace = 'public'::regnamespace and relname like 'rede\\_%' and relkind = 'r'`)).length, (n) => n === 0);
await espera("o agendador em lote é só do service_role", async () => [(await um("select has_function_privilege('authenticated', 'public.rede_pub_agendados_rodar()', 'execute') a")).a, (await um("select has_function_privilege('anon', 'public.rede_pub_agendados_rodar()', 'execute') a")).a, (await um("select has_function_privilege('service_role', 'public.rede_pub_agendados_rodar()', 'execute') a")).a], (r) => r[0] === false && r[1] === false && r[2] === true);
await espera("escrita só para conta: anon não executa votar, editar, agendar, reservar", async () => {
  const fs_ = ["rede_pub_enquete_votar(uuid, uuid[])", "rede_pub_editar(uuid, jsonb)", "rede_pub_agendar(jsonb, timestamptz)", "rede_pub_agendados()", "rede_pub_midia_reservar(text)", "rede_publicar(jsonb)"];
  return Promise.all(fs_.map(async (f) => (await um(`select has_function_privilege('anon', 'public.${f}', 'execute') a`)).a));
}, (r) => r.every((x) => x === false));
await espera("leitura aberta (a matriz decide): anon executa detalhes, histórico, caminho e regra de leitura", async () => Promise.all(["rede_pub_detalhes(uuid[])", "rede_pub_historico(uuid)", "rede_pub_midia_caminho(uuid)", "rede_pub_midia_pode(text)"].map(async (f) => (await um(`select has_function_privilege('anon', 'public.${f}', 'execute') a`)).a)), (r) => r.every((x) => x === true));

// ── Rotas, componentes e textos ──
await espera("as rotas do servidor existem e usam as travas", async () => {
  const midia = lerTexto("app/api/rede/midia/route.ts");
  const previa = lerTexto("app/api/rede/previa/route.ts");
  const imagem = lerTexto("app/api/rede/previa/imagem/route.ts");
  return [/limparImagem/.test(midia), /rede_pub_midia_reservar/.test(midia), /tokenDe/.test(midia), /buscarSeguro/.test(previa), /tokenDe/.test(previa), /assinaturaConfere/.test(imagem), /buscarSeguro/.test(imagem), /nosniff/.test(imagem)];
}, (r) => r.every(Boolean));
await espera("a prévia e a imagem não usam fetch direto (só a busca com DNS conferido)", async () => ["app/api/rede/previa/route.ts", "app/api/rede/previa/imagem/route.ts"].map((a) => /\bfetch\(/.test(lerTexto(a))), (r) => r.every((x) => x === false));
await espera("nenhum componente do pacote usa alert, confirm ou prompt do navegador", async () => fs.readdirSync(new URL("../components/rede/publicar", import.meta.url)).filter((a) => /\.tsx?$/.test(a)).map((a) => /\b(window\.)?(alert|confirm|prompt)\(/.test(lerTexto(`components/rede/publicar/${a}`))), (r) => r.length > 0 && r.every((x) => x === false));
await espera("textos: as mesmas chaves nos seis idiomas, rascunho marcado, sem chave vazia", async () => {
  const achatar = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (k === "_rascunho" ? [] : typeof v === "object" ? achatar(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
  const dic = {};
  for (const l of ["pt", "en", "es", "fr", "ru", "zh"]) dic[l] = JSON.parse(lerTexto(`i18n/rede/publicar/${l}.json`));
  const base = achatar(dic.pt).map((x) => x[0]).sort().join();
  return Object.fromEntries(Object.entries(dic).map(([l, d]) => [l, { iguais: achatar(d).map((x) => x[0]).sort().join() === base, vazio: achatar(d).some(([, v]) => !String(v).trim()), rascunho: l === "pt" ? d._rascunho === undefined : d._rascunho === true, marcadores: achatar(d).every(([k, v]) => { const m = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((x) => x[1]).sort().join(); return m(v) === m(achatar(dic.pt).find((y) => y[0] === k)[1]); }) }]));
}, (r) => Object.values(r).every((x) => x.iguais && !x.vazio && x.rascunho && x.marcadores));

console.log(`Rede v2 (publicar): ${certos} certos, ${falhas.length} falhas.`);
for (const falha of falhas) console.log(`  ✗ ${falha}`);
process.exit(falhas.length ? 1 : 0);
