// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o pacote "perfil" da Rede v2 (supabase/migracoes/2026-11-rede-perfil.sql) num Postgres de verdade dentro do Node: @handle
// (formato, único, reservado, uma troca a cada 30 dias), bio, rosto e capa (galeria e foto enviada com conferência dos bytes do
// WebP: sem EXIF, XMP, perfil de cor nem animação; só aparece para os outros depois que a mediação aceita), "estudando agora"
// (opt-in, some em 14 dias), selos (do papel e de trilha declarada), post fixado (só meu, só se a matriz deixa ver), seguir com
// perfil trancado (pedido pendente, aprovação), perfil invisível, bloqueio, suspensão, a correção da rede_seguir da Rede de hoje e
// as permissões. Também confere as regras puras (lib/rede/perfil.ts), o cliente, os textos nos seis idiomas e a galeria de SVGs.
// Carrega install.sql + 2026-11-rede-fundacao.sql + 2026-11-rede-perfil.sql. Uso: npm run testar:rede-perfil
import fs from "node:fs";
import { criarBanco } from "./banco-local.mjs";
import { criarClientePerfil } from "../lib/rede/cliente-perfil.ts";
import {
  arrumarHandle, AVATARES, CAPAS, escolherSelosDeTrilha, estudandoDaUltimaAula, handleBemFormado, handleReservado, nomeDaTrilha, origemDaImagem, slugDoSelo,
  tipoDoSelo, TIPOS_DE_SELO, trilhasComProgresso,
} from "../lib/rede/perfil.ts";

let certos = 0;
const falhas = [];
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 260)}`);
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
const existe = (caminho) => fs.existsSync(new URL(`../${caminho}`, import.meta.url));

// ── WebP de mentira, só com a estrutura que o banco confere ──
const u32 = (n) => Buffer.from([n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255]);
const pedaco = (id, dados) => Buffer.concat([Buffer.from(id, "latin1"), u32(dados.length), dados, dados.length % 2 ? Buffer.from([0]) : Buffer.alloc(0)]);
const webp = (...pedacos) => {
  const corpo = Buffer.concat([Buffer.from("WEBP"), ...pedacos]);
  return Buffer.concat([Buffer.from("RIFF"), u32(corpo.length), corpo]);
};
const url = (b) => `data:image/webp;base64,${b.toString("base64")}`;
const vp8x = (flags) => pedaco("VP8X", Buffer.concat([Buffer.from([flags, 0, 0, 0]), Buffer.from([0, 0, 0, 0, 0, 0])]));
const imagem = pedaco("VP8L", Buffer.from("2f0000001007111188 88fe0700".replace(/ /g, ""), "hex"));
const BOA = url(webp(imagem));
const COM_EXIF = url(webp(vp8x(8), pedaco("EXIF", Buffer.from("Exif\0\0GPS fake", "latin1")), imagem));
const COM_XMP = url(webp(vp8x(4), imagem, pedaco("XMP ", Buffer.from("<x:xmpmeta/>", "latin1"))));
const COM_ICC = url(webp(vp8x(32), pedaco("ICCP", Buffer.from("perfil", "latin1")), imagem));
const ANIMADA = url(webp(vp8x(2), pedaco("ANIM", Buffer.from([0, 0, 0, 0, 0, 0])), imagem));
const COM_ALFA = url(webp(vp8x(16), pedaco("ALPH", Buffer.from([0, 1, 2, 3])), imagem));
const VERDADEIRA = "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";
const TAMANHO_ERRADO = url(Buffer.concat([webp(imagem), Buffer.from([0, 0])]));

const banco = await criarBanco({ semRede: true });
const { dono, criarUsuario, rpc } = banco;
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];
const todos = async (texto, valores = []) => (await dono(texto, valores)).rows;
const lerMigracao = (nome) => fs.readFileSync(new URL(`../supabase/migracoes/${nome}`, import.meta.url), "utf8");
const fundacao = lerMigracao("2026-11-rede-fundacao.sql");
const migracao = lerMigracao("2026-11-rede-perfil.sql");

await espera("a fundação e o perfil instalam sobre o install.sql", async () => {
  await banco.exclusivo(() => banco.pg.exec(fundacao));
  await banco.exclusivo(() => banco.pg.exec(migracao));
});
await espera("instalar o perfil de novo não quebra", () => banco.exclusivo(() => banco.pg.exec(migracao)));

let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++}` });
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++}` });

// ── As pessoas ──
const pessoas = {};
const nomes = ["ana", "bia", "carla", "dani", "edu", "fabi", "gabi", "heloisa", "irene", "julia", "kaua", "mediadora", "equipe"];
for (const [i, nome] of nomes.entries()) {
  pessoas[nome] = await criarUsuario(`${nome}@perfil.local`, nome);
  await rpc(como(pessoas[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true where id = $1", [pessoas[nome], `Pessoa ${i + 1} ${nome}`]);
}
await dono("delete from interno.papeis");
await dono("insert into interno.papeis (usuario, papel) values ($1, 'educacao'), ($2, 'mediacao')", [pessoas.equipe, pessoas.mediadora]);
const VERSAO = 1;
await dono("insert into interno.rede_regras (versao, texto) values ($1, $2) on conflict do nothing", [VERSAO, "Normas da Rede para o teste. ".repeat(4)]);
// Todos são membros (18+ e consentimento), menos a "irene" (declarou ter menos de 18) e a "julia" (sem consentimento).
for (const nome of nomes.filter((n) => n !== "irene" && n !== "julia")) {
  await dono("update interno.perfis set rede_18 = true, rede_consentimento = $2 where id = $1", [pessoas[nome], VERSAO]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, $2)", [pessoas[nome], VERSAO]);
}
await dono("update interno.perfis set rede_18 = true where id = $1", [pessoas.julia]);
await dono("update interno.perfis set suspenso = true where id = $1", [pessoas.kaua]);
await dono("update auth.users set created_at = now() - interval '30 days'");
const P = (nome) => como(pessoas[nome]);
// A mediação passa pelo segundo fator (o serviço pode exigi-lo para os papéis de mediação).
const M = { ...como(pessoas.mediadora), aal: "aal2" };
const cliente = (nome) => criarClientePerfil((funcao, args = {}) => rpc(P(nome), funcao, args));

// ── @handle ──
await espera("handle: primeira escolha livre", () => rpc(P("ana"), "rede_perfil_handle_definir", { p_handle: "@Ana_Luta" }), (r) => r.handle === "ana_luta");
await espera("handle: outras pessoas escolhem os seus", async () => {
  await rpc(P("bia"), "rede_perfil_handle_definir", { p_handle: "bia_luta" });
  await rpc(P("carla"), "rede_perfil_handle_definir", { p_handle: "carla_luta" });
  await rpc(P("dani"), "rede_perfil_handle_definir", { p_handle: "dani_luta" });
  await rpc(P("edu"), "rede_perfil_handle_definir", { p_handle: "edu_luta" });
  await rpc(P("fabi"), "rede_perfil_handle_definir", { p_handle: "fabi_luta" });
  await rpc(M, "rede_perfil_handle_definir", { p_handle: "mediacao_lu" });
  await rpc(P("equipe"), "rede_perfil_handle_definir", { p_handle: "profe_equipe" });
});
await recusa("handle: curto demais", () => rpc(P("gabi"), "rede_perfil_handle_definir", { p_handle: "ab" }), "invalido:handle");
await recusa("handle: com acento e espaço", () => rpc(P("gabi"), "rede_perfil_handle_definir", { p_handle: "gabi luta" }), "invalido:handle");
await recusa("handle: longo demais", () => rpc(P("gabi"), "rede_perfil_handle_definir", { p_handle: "a".repeat(21) }), "invalido:handle");
await recusa("handle: já tem dono", () => rpc(P("gabi"), "rede_perfil_handle_definir", { p_handle: "ana_luta" }), "handle_usado");
await recusa("handle: imita o instituto", () => rpc(P("gabi"), "rede_perfil_handle_definir", { p_handle: "instituto_oficial" }), "handle_reservado");
await recusa("handle: imita a equipe", () => rpc(P("gabi"), "rede_perfil_handle_definir", { p_handle: "equipe_lucia" }), "handle_reservado");
await recusa("handle: troca em menos de 30 dias", () => rpc(P("ana"), "rede_perfil_handle_definir", { p_handle: "ana_nova" }), "handle_recente");
await espera("handle: o mesmo nome de novo não conta como troca", () => rpc(P("ana"), "rede_perfil_handle_definir", { p_handle: "ana_luta" }), (r) => r.handle === "ana_luta");
await dono("update interno.perfis set rede_handle_em = now() - interval '31 days' where id = $1", [pessoas.ana]);
await espera("handle: passados 30 dias, troca", () => rpc(P("ana"), "rede_perfil_handle_definir", { p_handle: "ana_nova" }), (r) => r.handle === "ana_nova");
await espera("handle: o nome antigo fica livre", () => rpc(P("gabi"), "rede_perfil_handle_definir", { p_handle: "ana_luta" }), (r) => r.handle === "ana_luta");
await dono("update interno.perfis set rede_handle = 'gabi_luta' where id = $1", [pessoas.gabi]);
await dono("update interno.perfis set rede_handle = 'ana_luta' where id = $1", [pessoas.ana]);
await recusa("handle: quem não é membro (menos de 18) não escolhe", () => rpc(P("irene"), "rede_perfil_handle_definir", { p_handle: "irene_luta" }), "confirme_idade");
await recusa("handle: quem não deu o consentimento não escolhe", () => rpc(P("julia"), "rede_perfil_handle_definir", { p_handle: "julia_luta" }), "consentimento");
await recusa("handle: visitante não escolhe", () => rpc(visitante(), "rede_perfil_handle_definir", { p_handle: "visita_luta" }), "permission denied");

// ── Editar: bio, modo, rosto, capa, estudando, selos ──
await espera("bio: até 160, é salva e volta no meu perfil", () => rpc(P("ana"), "rede_perfil_editar", { p: { bio: "Estudo história e organizo a leitura do bairro." } }), (r) => r.bio === "Estudo história e organizo a leitura do bairro.");
await recusa("bio: 161 caracteres", () => rpc(P("ana"), "rede_perfil_editar", { p: { bio: "x".repeat(161) } }), "invalido:bio");
await recusa("bio: CPF", () => rpc(P("ana"), "rede_perfil_editar", { p: { bio: "meu cpf 123.456.789-09" } }), "dado_pessoal");
await recusa("bio: telefone", () => rpc(P("ana"), "rede_perfil_editar", { p: { bio: "me ligue (21) 98888-7777" } }), "dado_pessoal");
await recusa("bio: e-mail", () => rpc(P("ana"), "rede_perfil_editar", { p: { bio: "escreva para ana@exemplo.org" } }), "dado_pessoal");
await espera("bio: vazia limpa", () => rpc(P("ana"), "rede_perfil_editar", { p: { bio: "" } }), (r) => r.bio === "");
await recusa("editar: p não é objeto", () => rpc(P("ana"), "rede_perfil_editar", { p: [] }), "invalido:perfil");
await recusa("editar: quem não é membro", () => rpc(P("irene"), "rede_perfil_editar", { p: { bio: "oi" } }), "confirme_idade");
await recusa("editar: visitante", () => rpc(visitante(), "rede_perfil_editar", { p: { bio: "oi" } }), "permission denied");
await recusa("editar: conta suspensa", () => rpc(P("kaua"), "rede_perfil_editar", { p: { bio: "oi" } }), "conta_suspensa");
await recusa("modo: valor inválido", () => rpc(P("ana"), "rede_perfil_editar", { p: { modo: "secreto" } }), "invalido:modo");
await espera("rosto: galeria a01 e a24", async () => {
  const r1 = await rpc(P("ana"), "rede_perfil_editar", { p: { avatar: "a01" } });
  const r2 = await rpc(P("ana"), "rede_perfil_editar", { p: { avatar: "a24" } });
  return [r1.avatar, r2.avatar];
}, (r) => r[0].tipo === "galeria" && r[0].id === "a01" && r[1].id === "a24");
await recusa("rosto: a25 não existe", () => rpc(P("ana"), "rede_perfil_editar", { p: { avatar: "a25" } }), "invalido:avatar");
await recusa("rosto: a00 não existe", () => rpc(P("ana"), "rede_perfil_editar", { p: { avatar: "a00" } }), "invalido:avatar");
await recusa("rosto: caminho de arquivo", () => rpc(P("ana"), "rede_perfil_editar", { p: { avatar: "../x" } }), "invalido:avatar");
await recusa("rosto: 'envio' sem foto enviada", () => rpc(P("ana"), "rede_perfil_editar", { p: { avatar: "envio" } }), "invalido:avatar");
await espera("rosto: nulo volta às iniciais", () => rpc(P("ana"), "rede_perfil_editar", { p: { avatar: null } }), (r) => r.avatar.tipo === null);
await espera("capa: galeria c08", () => rpc(P("ana"), "rede_perfil_editar", { p: { capa: "c08" } }), (r) => r.capa.tipo === "galeria" && r.capa.id === "c08");
await recusa("capa: c09 não existe", () => rpc(P("ana"), "rede_perfil_editar", { p: { capa: "c09" } }), "invalido:capa");
await recusa("capa: 'envio' sem imagem enviada", () => rpc(P("ana"), "rede_perfil_editar", { p: { capa: "envio" } }), "invalido:capa");

await espera("estudando: liga com a aula do aparelho", () => rpc(P("ana"), "rede_perfil_editar", { p: { estudando: { ligado: true, trilha: "historia-do-brasil", aula: "/trilhas/historia-do-brasil/colonia", titulo: "A colônia" } } }),
  (r) => r.estudando?.ligado === true && r.estudando.aula === "/trilhas/historia-do-brasil/colonia");
await recusa("estudando: caminho fora de /trilhas", () => rpc(P("ana"), "rede_perfil_editar", { p: { estudando: { ligado: true, aula: "/painel/segredo" } } }), "invalido:estudando");
await recusa("estudando: endereço externo no lugar do caminho", () => rpc(P("ana"), "rede_perfil_editar", { p: { estudando: { ligado: true, aula: "https://evil.example/x" } } }), "invalido:estudando");
await recusa("estudando: título com link", () => rpc(P("ana"), "rede_perfil_editar", { p: { estudando: { ligado: true, titulo: "veja https://evil.example" } } }), "invalido:estudando");
await recusa("estudando: trilha malformada", () => rpc(P("ana"), "rede_perfil_editar", { p: { estudando: { ligado: true, trilha: "Má Trilha" } } }), "invalido:estudando");
await recusa("estudando: texto solto no lugar do objeto", () => rpc(P("ana"), "rede_perfil_editar", { p: { estudando: "oi" } }), "invalido:estudando");

await espera("selos de trilha: declarados, sem repetir", () => rpc(P("ana"), "rede_perfil_editar", { p: { selos_trilhas: ["historia-do-brasil", "historia-do-brasil", "ensino-medio-fisica"] } }),
  (r) => r.selos_trilhas.length === 2 && r.selos.includes("trilha:historia-do-brasil"));
await recusa("selos: mais de 12 trilhas", () => rpc(P("ana"), "rede_perfil_editar", { p: { selos_trilhas: Array.from({ length: 13 }, (_, i) => `trilha-${i}`) } }), "invalido:selos");
await recusa("selos: nome fora do formato (nada de opinião política ou filiação como selo)", () => rpc(P("ana"), "rede_perfil_editar", { p: { selos_trilhas: ["Filiado ao Partido X"] } }), "invalido:selos");
await recusa("selos: mostrar tem de ser verdadeiro ou falso", () => rpc(P("ana"), "rede_perfil_editar", { p: { selos_mostrar: "talvez" } }), "invalido:selos");

// ── O perfil de uma pessoa ──
const perfilDe = (quem, handle) => rpc(quem, "rede_perfil_de", { p_handle: handle });
await espera("perfil: traz o que a fundação trazia e o que o pacote acrescenta, sem contagem de seguidores", async () => {
  const r = await perfilDe(P("bia"), "ana_luta");
  const chaves = Object.keys(r);
  return { chaves, r };
}, ({ chaves, r }) => ["id", "codinome", "handle", "bio", "modo", "selos", "equipe", "meu", "sigo", "pendente", "fixado", "avatar", "capa", "estudando"].every((k) => chaves.includes(k))
  && !chaves.some((k) => /seguidor|follower|apoio|seguindo_total|total/.test(k)) && r.pedidos === null && r.meu === false);
await espera("perfil: nunca o nome civil do painel (o nome cadastrado é 'ana', o codinome é outro)", async () => JSON.stringify(await perfilDe(P("bia"), "ana_luta")), (j) => !/"nome"/.test(j) && !/"ana"/.test(j.replace(/ana_luta/g, "")));
await espera("perfil: o meu mostra os pedidos e o selo escondível", async () => (await perfilDe(P("ana"), "ana_luta")).pedidos, (n) => n === 0);
await espera("perfil: estudando agora aparece (ligado e recente)", async () => (await perfilDe(P("bia"), "ana_luta")).estudando, (e) => e?.aula === "/trilhas/historia-do-brasil/colonia" && e.titulo === "A colônia" && !("ligado" in e));
await dono("update interno.perfis set rede_estudando_em = now() - interval '15 days' where id = $1", [pessoas.ana]);
await espera("perfil: estudando agora some depois de 14 dias sem atualizar", async () => (await perfilDe(P("bia"), "ana_luta")).estudando, (e) => e === null);
await espera("perfil: o dono ainda vê o que ligou (para poder desligar)", async () => (await rpc(P("ana"), "rede_perfil_meu")).estudando?.ligado, (v) => v === true);
await espera("estudando: desliga", () => rpc(P("ana"), "rede_perfil_editar", { p: { estudando: null } }), (r) => r.estudando === null);
await espera("selos: equipe e educação saem do papel; moderação do papel de mediação", async () => [
  (await perfilDe(P("bia"), "profe_equipe")).selos, (await perfilDe(P("bia"), "mediacao_lu")).selos,
], (r) => r[0].includes("equipe") && r[0].includes("educador") && !r[0].includes("moderacao") && r[1].includes("equipe") && r[1].includes("moderacao") && !r[1].includes("educador"));
await espera("selos: moderação de comunidade também conta", async () => {
  await dono("insert into interno.rede_comunidades (slug, nome, categoria, tipo, publico_padrao) values ('moradia', 'Moradia', 'lutas', 'aberta', 'membros') on conflict do nothing");
  await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, papel) values ('moradia', $1, 'moderacao') on conflict do nothing", [pessoas.carla]);
  return (await perfilDe(P("bia"), "carla_luta")).selos;
}, (s) => s.includes("moderacao") && !s.includes("equipe"));
await espera("selos: de trilha aparecem para os outros", async () => (await perfilDe(P("bia"), "ana_luta")).selos, (s) => s.includes("trilha:historia-do-brasil") && s.includes("trilha:ensino-medio-fisica"));
await espera("selos: a pessoa pode esconder; o dono ainda os vê", async () => {
  await rpc(P("ana"), "rede_perfil_editar", { p: { selos_mostrar: false } });
  return [(await perfilDe(P("bia"), "ana_luta")).selos, (await perfilDe(P("ana"), "ana_luta")).selos];
}, (r) => r[0].length === 0 && r[1].length === 2);
await rpc(P("ana"), "rede_perfil_editar", { p: { selos_mostrar: true } });
await espera("selos: todos têm um dos 4 tipos do catálogo (o texto da trilha é declarado e só passa pela triagem de abuso)", async () => {
  const todosOsSelos = (await perfilDe(P("bia"), "ana_luta")).selos.concat((await perfilDe(P("bia"), "profe_equipe")).selos);
  return todosOsSelos.every((s) => tipoDoSelo(s) !== null);
}, (v) => v === true);

await espera("perfil: visitante não abre (precisa de conta)", async () => {
  try {
    await perfilDe(visitante(), "ana_luta");
    return "abriu";
  } catch (e) {
    return String(e.message);
  }
}, (m) => /permission denied|entre_primeiro/.test(m));
await recusa("perfil: handle que não existe", () => perfilDe(P("bia"), "ninguem_aqui"), "nao_encontrado");

// ── Perfil invisível, bloqueio, suspensão ──
await espera("invisível: o perfil some para os outros e some dos rostos em lote", async () => {
  await rpc(P("dani"), "rede_perfil_editar", { p: { modo: "invisivel", avatar: "a07" } });
  const r = await rpc(P("bia"), "rede_perfil_avatares", { p_usuarios: [pessoas.dani, pessoas.ana] });
  return r;
}, (r) => !(pessoas.dani in r));
await recusa("invisível: o handle dela não abre", () => perfilDe(P("bia"), "dani_luta"), "nao_encontrado");
await espera("invisível: ela mesma ainda abre o próprio perfil", async () => (await perfilDe(P("dani"), "dani_luta")).modo, (m) => m === "invisivel");
await espera("invisível: o campo legado rede_invisivel acompanha (a Rede de hoje também esconde)", async () => (await um("select rede_invisivel from interno.perfis where id = $1", [pessoas.dani])).rede_invisivel, (v) => v === true);
await recusa("invisível: ninguém novo a segue", () => rpc(P("bia"), "rede_perfil_seguir", { p_handle: "dani_luta", p_sim: true }), "nao_encontrado");
await espera("invisível: voltar para aberto desfaz o campo legado", async () => {
  await rpc(P("dani"), "rede_perfil_editar", { p: { modo: "aberto" } });
  return (await um("select rede_invisivel, rede_modo from interno.perfis where id = $1", [pessoas.dani]));
}, (r) => r.rede_invisivel === false && r.rede_modo === "aberto");
await espera("bloqueio: some nos dois sentidos", async () => {
  await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [pessoas.ana, pessoas.edu]);
  const a = await perfilDe(P("edu"), "ana_luta").then(() => "abriu", (e) => e.message);
  const b = await perfilDe(P("ana"), "edu_luta").then(() => "abriu", (e) => e.message);
  return [a, b];
}, (r) => /nao_encontrado/.test(r[0]) && /nao_encontrado/.test(r[1]));
await recusa("bloqueio: não segue", () => rpc(P("edu"), "rede_perfil_seguir", { p_handle: "ana_luta", p_sim: true }), "nao_encontrado");
await espera("bloqueio: o rosto não vai em lote para quem bloqueou ou foi bloqueado", async () => (await rpc(P("edu"), "rede_perfil_avatares", { p_usuarios: [pessoas.ana] })), (r) => !(pessoas.ana in r));
await dono("delete from interno.rede_bloqueios");
await dono("update interno.perfis set rede_handle = 'kaua_luta' where id = $1", [pessoas.kaua]);
await recusa("suspensão: perfil de conta suspensa não abre", () => perfilDe(P("bia"), "kaua_luta"), "nao_encontrado");
await recusa("suspensão: não se segue conta suspensa", () => rpc(P("bia"), "rede_perfil_seguir", { p_handle: "kaua_luta", p_sim: true }), "nao_encontrado");

// ── Seguir e perfil trancado ──
await espera("seguir (aberto): entra na hora, sem número", async () => rpc(P("bia"), "rede_perfil_seguir", { p_handle: "ana_luta", p_sim: true }), (r) => r.sigo === true && r.pendente === false && Object.keys(r).length === 2);
await espera("seguir: o perfil mostra 'sigo'", async () => (await perfilDe(P("bia"), "ana_luta")).sigo, (v) => v === true);
await espera("seguir: deixar de seguir", async () => rpc(P("bia"), "rede_perfil_seguir", { p_handle: "ana_luta", p_sim: false }), (r) => r.sigo === false && r.pendente === false);
await recusa("seguir: a si mesma", () => rpc(P("ana"), "rede_perfil_seguir", { p_handle: "ana_luta", p_sim: true }), "nao_encontrado");
await recusa("seguir: quem não é membro", () => rpc(P("irene"), "rede_perfil_seguir", { p_handle: "ana_luta", p_sim: true }), "confirme_idade");
await recusa("seguir: visitante", () => rpc(visitante(), "rede_perfil_seguir", { p_handle: "ana_luta", p_sim: true }), "permission denied");

await rpc(P("ana"), "rede_perfil_editar", { p: { modo: "trancado" } });
const postParaSeguidores = (await um("insert into interno.rede_posts (autor, texto, publico, alcance) values ($1, 'só para quem me segue', 'seguidores', 'seguidores') returning id", [pessoas.ana])).id;
const ve = async (post, quem) => (await um("select interno.rede_ve(p, $2) as v from interno.rede_posts p where p.id = $1", [post, quem])).v;
await espera("trancado: pedir vira pendente, não seguidor", () => rpc(P("bia"), "rede_perfil_seguir", { p_handle: "ana_luta", p_sim: true }), (r) => r.sigo === false && r.pendente === true);
await espera("trancado: o pedido não dá acesso ao que é só para seguidores", () => ve(postParaSeguidores, pessoas.bia), (v) => v === false);
await espera("trancado: a linha da Rede de hoje (regra de um argumento) também não entrega o post só para seguidores a quem só pediu", async () => {
  const linha = await rpc(P("bia"), "rede_linha", { p_modo: "perfil", p_usuario: pessoas.ana });
  return linha.some((x) => x.id === postParaSeguidores);
}, (v) => v === false);
await espera("trancado: pedir de novo não duplica nem avisa duas vezes", async () => {
  await rpc(P("bia"), "rede_perfil_seguir", { p_handle: "ana_luta", p_sim: true });
  return (await um("select count(*)::int as n from interno.avisos where para = $1 and texto like '%pediu para seguir%'", [pessoas.ana])).n;
}, (n) => n === 1);
await espera("trancado: o aviso não diz quem pediu", async () => (await um("select texto from interno.avisos where para = $1 and texto like '%pediu para seguir%'", [pessoas.ana])).texto, (t) => !/Pessoa 2|bia/.test(t));
await espera("trancado: a dona vê os pedidos, só com codinome e @nome", async () => rpc(P("ana"), "rede_perfil_pedidos"), (l) => l.length === 1 && l[0].codinome === "Pessoa 2 bia" && l[0].handle === "bia_luta" && !("email" in l[0]));
await espera("trancado: o perfil dela mostra quantos pedidos esperam (só para ela)", async () => [(await perfilDe(P("ana"), "ana_luta")).pedidos, (await perfilDe(P("bia"), "ana_luta")).pedidos, (await perfilDe(P("bia"), "ana_luta")).pendente], (r) => r[0] === 1 && r[1] === null && r[2] === true);
await recusa("trancado: quem não é a dona não decide", () => rpc(P("carla"), "rede_perfil_decidir", { p_quem: pessoas.bia, p_aceitar: true }), "nao_encontrado");
await espera("trancado: aprovar libera o que é só para seguidores", async () => {
  await rpc(P("ana"), "rede_perfil_decidir", { p_quem: pessoas.bia, p_aceitar: true });
  return [await ve(postParaSeguidores, pessoas.bia), (await perfilDe(P("bia"), "ana_luta")).sigo];
}, (r) => r[0] === true && r[1] === true);
await espera("trancado: recusar apaga o pedido, sem avisar", async () => {
  await rpc(P("carla"), "rede_perfil_seguir", { p_handle: "ana_luta", p_sim: true });
  const antes = (await um("select count(*)::int as n from interno.avisos where para = $1", [pessoas.carla])).n;
  await rpc(P("ana"), "rede_perfil_decidir", { p_quem: pessoas.carla, p_aceitar: false });
  const depois = (await um("select count(*)::int as n from interno.avisos where para = $1", [pessoas.carla])).n;
  return [antes, depois, (await perfilDe(P("carla"), "ana_luta")).pendente, await ve(postParaSeguidores, pessoas.carla)];
}, (r) => r[0] === r[1] && r[2] === false && r[3] === false);
await espera("trancado: abrir o perfil aprova os pedidos que esperavam", async () => {
  await rpc(P("carla"), "rede_perfil_seguir", { p_handle: "ana_luta", p_sim: true });
  await rpc(P("ana"), "rede_perfil_editar", { p: { modo: "aberto" } });
  return [await ve(postParaSeguidores, pessoas.carla), (await rpc(P("ana"), "rede_perfil_pedidos")).length];
}, (r) => r[0] === true && r[1] === 0);
await espera("invisível: ficar invisível apaga os pedidos pendentes e mantém quem já seguia", async () => {
  await rpc(P("ana"), "rede_perfil_editar", { p: { modo: "trancado" } });
  await rpc(P("fabi"), "rede_perfil_seguir", { p_handle: "ana_luta", p_sim: true });
  await rpc(P("ana"), "rede_perfil_editar", { p: { modo: "invisivel" } });
  const pendentes = (await um("select count(*)::int as n from interno.rede_seguindo where segue = $1 and pendente", [pessoas.ana])).n;
  const seguem = (await um("select count(*)::int as n from interno.rede_seguindo where segue = $1 and not pendente", [pessoas.ana])).n;
  await rpc(P("ana"), "rede_perfil_editar", { p: { modo: "aberto" } });
  return [pendentes, seguem];
}, (r) => r[0] === 0 && r[1] >= 2);
await recusa("decidir: pedido que não existe", () => rpc(P("ana"), "rede_perfil_decidir", { p_quem: pessoas.fabi, p_aceitar: true }), "nao_encontrado");

// A Rede de hoje: rede_seguir respeitava só o bloqueio e deixava entrar no perfil trancado.
await espera("rede_seguir (Rede de hoje): perfil trancado agora vira pedido pendente", async () => {
  await rpc(P("ana"), "rede_perfil_editar", { p: { modo: "trancado" } });
  await dono("delete from interno.rede_seguindo where quem = $1", [pessoas.gabi]);
  await rpc(P("gabi"), "rede_seguir", { p_usuario: pessoas.ana, p_sim: true });
  return (await um("select pendente from interno.rede_seguindo where quem = $1 and segue = $2", [pessoas.gabi, pessoas.ana])).pendente;
}, (v) => v === true);
await espera("rede_seguir (Rede de hoje): perfil aberto segue direto", async () => {
  await rpc(P("gabi"), "rede_seguir", { p_usuario: pessoas.bia, p_sim: true });
  return (await um("select pendente from interno.rede_seguindo where quem = $1 and segue = $2", [pessoas.gabi, pessoas.bia])).pendente;
}, (v) => v === false);
await recusa("rede_seguir (Rede de hoje): perfil invisível não se segue", async () => {
  await rpc(P("ana"), "rede_perfil_editar", { p: { modo: "invisivel" } });
  return rpc(P("gabi"), "rede_seguir", { p_usuario: pessoas.ana, p_sim: true });
}, "invalido:usuario");
await espera("rede_seguir (Rede de hoje): deixar de seguir continua funcionando", async () => (await rpc(P("gabi"), "rede_seguir", { p_usuario: pessoas.bia, p_sim: false })).ok, (v) => v === true);
await rpc(P("ana"), "rede_perfil_editar", { p: { modo: "aberto" } });
await dono("delete from interno.rede_seguindo where segue = $1", [pessoas.ana]);

// ── Post fixado ──
const postDeAna = (await um("insert into interno.rede_posts (autor, texto, publico, alcance) values ($1, 'meu post para fixar', 'membros', 'equipe') returning id", [pessoas.ana])).id;
const postDeBia = (await um("insert into interno.rede_posts (autor, texto, publico, alcance) values ($1, 'post da bia', 'membros', 'equipe') returning id", [pessoas.bia])).id;
await espera("fixar: um post meu", () => rpc(P("ana"), "rede_perfil_fixar", { p_post: postDeAna }), (r) => r.fixado?.id === postDeAna);
await espera("fixar: aparece no perfil para quem pode ver", async () => (await perfilDe(P("bia"), "ana_luta")).fixado?.id, (id) => id === postDeAna);
await recusa("fixar: post de outra pessoa", () => rpc(P("ana"), "rede_perfil_fixar", { p_post: postDeBia }), "nao_encontrado");
await espera("fixar: o dono do perfil pode trocar o fixado por um post só para seguidores, que quem não segue não vê", async () => {
  await rpc(P("ana"), "rede_perfil_fixar", { p_post: postParaSeguidores });
  const deFora = (await perfilDe(P("gabi"), "ana_luta")).fixado;
  const deDentro = (await dono("update interno.rede_seguindo set pendente = false where false returning 1"), null);
  return [deFora, deDentro];
}, (r) => r[0] === null);
await espera("fixar: quem segue vê o fixado de seguidores", async () => {
  await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2) on conflict do nothing", [pessoas.fabi, pessoas.ana]);
  return (await perfilDe(P("fabi"), "ana_luta")).fixado?.id;
}, (id) => id === postParaSeguidores);
await espera("fixar: quem foi bloqueado não vê o perfil nem o fixado", async () => {
  await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [pessoas.ana, pessoas.fabi]);
  const r = await perfilDe(P("fabi"), "ana_luta").then(() => "abriu", (e) => e.message);
  await dono("delete from interno.rede_bloqueios");
  return r;
}, (m) => /nao_encontrado/.test(m));
await espera("fixar: post retido não se fixa; o que foi retido depois não aparece", async () => {
  await dono("update interno.rede_posts set retido = true where id = $1", [postDeAna]);
  const recusado = await rpc(P("ana"), "rede_perfil_fixar", { p_post: postDeAna }).then(() => "passou", (e) => e.message);
  await rpc(P("ana"), "rede_perfil_fixar", { p_post: postParaSeguidores });
  await dono("update interno.rede_posts set retido = true where id = $1", [postParaSeguidores]);
  const fixado = (await perfilDe(P("fabi"), "ana_luta")).fixado;
  await dono("update interno.rede_posts set retido = false where id in ($1, $2)", [postDeAna, postParaSeguidores]);
  return [recusado, fixado];
}, (r) => /sem_permissao/.test(r[0]) && r[1] === null);
await espera("fixar: nulo desafixa", () => rpc(P("ana"), "rede_perfil_fixar", { p_post: null }), (r) => r.fixado === null);
await espera("fixar: o meu perfil devolve o id do fixado", async () => {
  await rpc(P("ana"), "rede_perfil_fixar", { p_post: postDeAna });
  return (await rpc(P("ana"), "rede_perfil_meu")).fixado;
}, (id) => id === postDeAna);

// ── Foto enviada: a conferência dos bytes do WebP ──
const aceita = async (dados, max = 40000) => (await um("select interno.rede3_perfil_webp_ok($1, $2) as v", [dados, max])).v;
await espera("webp: um WebP simples passa", () => aceita(BOA), (v) => v === true);
await espera("webp: a amostra real de 1x1 passa", () => aceita(VERDADEIRA), (v) => v === true);
await espera("webp: com bloco alfa (transparência) passa", () => aceita(COM_ALFA), (v) => v === true);
await espera("webp: com EXIF (GPS, câmera) é recusado", () => aceita(COM_EXIF), (v) => v === false);
await espera("webp: com XMP é recusado", () => aceita(COM_XMP), (v) => v === false);
await espera("webp: com perfil de cor (ICCP) é recusado", () => aceita(COM_ICC), (v) => v === false);
await espera("webp: animado é recusado", () => aceita(ANIMADA), (v) => v === false);
await espera("webp: tamanho declarado diferente do arquivo é recusado", () => aceita(TAMANHO_ERRADO), (v) => v === false);
await espera("webp: PNG disfarçado de WebP é recusado", () => aceita("data:image/webp;base64," + Buffer.from("\x89PNG\r\n\x1a\n0000000000000000", "latin1").toString("base64")), (v) => v === false);
await espera("webp: outro tipo de data URL é recusado", () => aceita("data:image/png;base64," + BOA.slice(23)), (v) => v === false);
await espera("webp: texto qualquer e nulo são recusados", async () => [await aceita("oi"), await aceita(null)], (r) => r[0] === false && r[1] === false);
await espera("webp: acima do limite é recusado", () => aceita(BOA, 40), (v) => v === false);
await espera("webp: base64 inválido é recusado sem estourar", () => aceita("data:image/webp;base64,@@@@"), (v) => v === false);
await espera("webp: sem pedaço de imagem é recusado", () => aceita(url(webp(pedaco("JUNK", Buffer.from("xx", "latin1"))))), (v) => v === false);

// ── Enviar e aceitar a imagem ──
await espera("enviar rosto: guarda, fica pendente e só o dono vê a imagem", async () => rpc(P("ana"), "rede_perfil_imagem_enviar", { p_tipo: "avatar", p_dados: BOA }),
  (r) => r.avatar.tipo === "envio" && r.avatar.pendente === true && r.avatar.dados === BOA);
await espera("enviar rosto: para os outros o perfil não leva a imagem (iniciais) enquanto não aceita", async () => (await perfilDe(P("bia"), "ana_luta")).avatar, (a) => a.tipo === null);
await espera("enviar rosto: o lote de rostos não inclui a foto pendente nem para quem tem conta", async () => await rpc(P("bia"), "rede_perfil_avatares", { p_usuarios: [pessoas.ana] }), (r) => !(pessoas.ana in r));
await espera("enviar rosto: o lote mostra a pendente para a própria pessoa", async () => (await rpc(P("ana"), "rede_perfil_avatares", { p_usuarios: [pessoas.ana] }))[pessoas.ana], (v) => v === "envio");
await espera("enviar rosto: rede_perfil_imagem não entrega a pendente a outras pessoas", async () => await rpc(P("bia"), "rede_perfil_imagem", { p_usuario: pessoas.ana, p_tipo: "avatar" }), (v) => v === null);
await espera("enviar rosto: entrega a pendente ao dono", async () => await rpc(P("ana"), "rede_perfil_imagem", { p_usuario: pessoas.ana, p_tipo: "avatar" }), (v) => v === BOA);
await recusa("enviar rosto: com EXIF o banco recusa", () => rpc(P("ana"), "rede_perfil_imagem_enviar", { p_tipo: "avatar", p_dados: COM_EXIF }), "invalido:imagem");
await recusa("enviar rosto: tipo inválido", () => rpc(P("ana"), "rede_perfil_imagem_enviar", { p_tipo: "fundo", p_dados: BOA }), "invalido:tipo");
await recusa("enviar rosto: quem não é membro", () => rpc(P("irene"), "rede_perfil_imagem_enviar", { p_tipo: "avatar", p_dados: BOA }), "confirme_idade");
await recusa("enviar rosto: visitante", () => rpc(visitante(), "rede_perfil_imagem_enviar", { p_tipo: "avatar", p_dados: BOA }), "permission denied");
await espera("enviar capa: usa o limite maior e também fica pendente", async () => rpc(P("ana"), "rede_perfil_imagem_enviar", { p_tipo: "capa", p_dados: BOA }), (r) => r.capa.tipo === "envio" && r.capa.pendente === true);
await espera("fila: quem não cuida da Rede não vê", async () => rpc(P("bia"), "rede_perfil_imagens_fila").then(() => "viu", (e) => e.message), (m) => /sem_permissao/.test(m));
await espera("fila: a mediação vê o rosto e a capa de quem enviou", async () => rpc(M, "rede_perfil_imagens_fila"), (l) => l.length === 2 && l.every((x) => x.usuario === pessoas.ana && x.dados === BOA) && l.some((x) => x.tipo === "capa"));
await recusa("decidir imagem: quem não cuida da Rede", () => rpc(P("bia"), "rede_perfil_imagem_decidir", { p_usuario: pessoas.ana, p_tipo: "avatar", p_aceitar: true }), "sem_permissao");
await espera("decidir imagem: aceitar libera para os outros", async () => {
  await rpc(M, "rede_perfil_imagem_decidir", { p_usuario: pessoas.ana, p_tipo: "avatar", p_aceitar: true });
  return [(await perfilDe(P("bia"), "ana_luta")).avatar, (await rpc(P("bia"), "rede_perfil_avatares", { p_usuarios: [pessoas.ana] }))[pessoas.ana], await rpc(P("bia"), "rede_perfil_imagem", { p_usuario: pessoas.ana, p_tipo: "avatar" })];
}, (r) => r[0].tipo === "envio" && r[0].dados === BOA && r[1] === "envio" && r[2] === BOA);
await espera("decidir imagem: visitante recebe só rostos de galeria, nunca a foto enviada", async () => [
  (await rpc(visitante(), "rede_perfil_avatares", { p_usuarios: [pessoas.ana] }))[pessoas.ana] ?? null, await rpc(visitante(), "rede_perfil_imagem", { p_usuario: pessoas.ana, p_tipo: "avatar" }).then((v) => v, () => "negado"),
], (r) => r[0] === null && (r[1] === null || r[1] === "negado"));
await espera("decidir imagem: recusar apaga a imagem, tira o rosto e avisa a pessoa", async () => {
  const antes = (await um("select count(*)::int as n from interno.avisos where para = $1 and texto like '%capa não foi aceita%'", [pessoas.ana])).n;
  await rpc(M, "rede_perfil_imagem_decidir", { p_usuario: pessoas.ana, p_tipo: "capa", p_aceitar: false });
  const depois = (await um("select count(*)::int as n from interno.avisos where para = $1 and texto like '%capa não foi aceita%'", [pessoas.ana])).n;
  const linha = await um("select rede_capa, rede_capa_dados from interno.perfis where id = $1", [pessoas.ana]);
  return [antes, depois, linha];
}, (r) => r[0] === 0 && r[1] === 1 && r[2].rede_capa === null && r[2].rede_capa_dados === null);
await espera("decidir imagem: a decisão fica no registro, sem a imagem", async () => (await um("select count(*)::int as n, bool_or(detalhes::text like '%data:image%') as vaza from interno.auditoria where acao = 'rede_imagem_decidir'")), (r) => r.n === 2 && r.vaza === false);
await recusa("decidir imagem: sem imagem enviada", () => rpc(M, "rede_perfil_imagem_decidir", { p_usuario: pessoas.bia, p_tipo: "avatar", p_aceitar: true }), "nao_encontrado");
await espera("remover a imagem enviada: some do banco e volta às iniciais", async () => {
  const r = await rpc(P("ana"), "rede_perfil_imagem_remover", { p_tipo: "avatar" });
  const linha = await um("select rede_avatar, rede_avatar_dados, rede_avatar_ok from interno.perfis where id = $1", [pessoas.ana]);
  return [r.avatar.tipo, linha];
}, (r) => r[0] === null && r[1].rede_avatar === null && r[1].rede_avatar_dados === null && r[1].rede_avatar_ok === false);
await espera("remover: quem tinha escolhido um rosto de galeria mantém a escolha", async () => {
  await rpc(P("ana"), "rede_perfil_editar", { p: { avatar: "a05" } });
  await rpc(P("ana"), "rede_perfil_imagem_remover", { p_tipo: "avatar" });
  return (await um("select rede_avatar from interno.perfis where id = $1", [pessoas.ana])).rede_avatar;
}, (v) => v === "a05");
await espera("enviar: a mediação (quem cuida) tem a própria imagem aceita na hora", async () => (await rpc(P("equipe"), "rede_perfil_imagem_enviar", { p_tipo: "avatar", p_dados: BOA })).avatar.pendente, (v) => v === false);
await espera("escolher 'envio' depois de enviar: usa a foto guardada", async () => {
  await rpc(P("bia"), "rede_perfil_imagem_enviar", { p_tipo: "avatar", p_dados: BOA });
  await rpc(P("bia"), "rede_perfil_editar", { p: { avatar: "a03" } });
  return (await rpc(P("bia"), "rede_perfil_editar", { p: { avatar: "envio" } })).avatar.tipo;
}, (t) => t === "envio");
await espera("enviar: no máximo 10 por dia", async () => {
  let ultimo = "";
  for (let i = 0; i < 11; i++) ultimo = await rpc(P("fabi"), "rede_perfil_imagem_enviar", { p_tipo: "avatar", p_dados: BOA }).then(() => "ok", (e) => e.message);
  return ultimo;
}, (m) => /muitos_pedidos/.test(m));

// ── Rosto em lote ──
await espera("rostos: galeria vai também para visitante", async () => {
  await rpc(P("carla"), "rede_perfil_editar", { p: { avatar: "a12" } });
  return (await rpc(visitante(), "rede_perfil_avatares", { p_usuarios: [pessoas.carla] }))[pessoas.carla];
}, (v) => v === "a12");
await espera("rostos: quem não escolheu não aparece (iniciais)", async () => await rpc(P("bia"), "rede_perfil_avatares", { p_usuarios: [pessoas.gabi] }), (r) => !(pessoas.gabi in r));
await espera("rostos: conta suspensa fica de fora", async () => {
  await dono("update interno.perfis set rede_avatar = 'a02' where id = $1", [pessoas.kaua]);
  return await rpc(P("bia"), "rede_perfil_avatares", { p_usuarios: [pessoas.kaua] });
}, (r) => !(pessoas.kaua in r));
await espera("rostos: lista nula ou vazia devolve objeto vazio", async () => [await rpc(P("bia"), "rede_perfil_avatares", { p_usuarios: [] }), await rpc(P("bia"), "rede_perfil_avatares", { p_usuarios: null })], (r) => Object.keys(r[0]).length === 0 && Object.keys(r[1]).length === 0);
await espera("rostos: no máximo 60 por chamada", async () => {
  const ids = [];
  for (let i = 0; i < 70; i++) ids.push((await um("select gen_random_uuid() as u")).u);
  for (const id of ids) await dono("insert into auth.users (id, email) values ($1, $2)", [id, `x${id}@p.local`]);
  for (const id of ids) await dono("insert into interno.perfis (id, nome, rede_avatar) values ($1, 'massa', 'a01') on conflict do nothing", [id]);
  const r = await rpc(P("bia"), "rede_perfil_avatares", { p_usuarios: ids });
  return Object.keys(r).length;
}, (n) => n === 60);

// ── Permissões ──
await espera("as funções internas do pacote não são chamáveis de fora", async () => {
  const fns = ["interno.rede3_perfil_webp_ok(text,integer)", "interno.rede3_perfil_selos(uuid)", "interno.rede3_perfil_meu(uuid)", "interno.rede3_perfil_exige_membro(uuid)", "interno.rede3_perfil_imagem(interno.perfis,text,uuid)"];
  const r = [];
  for (const f of fns) for (const papel of ["anon", "authenticated", "public"]) r.push((await um("select has_function_privilege($1, $2, 'execute') as v", [papel === "public" ? "public" : papel, f])).v);
  return r;
}, (r) => r.every((v) => v === false));
await espera("as públicas: só conta (menos rede_perfil_avatares, que vale para visitante)", async () => {
  const so_conta = ["rede_perfil_meu()", "rede_perfil_editar(jsonb)", "rede_perfil_handle_definir(text)", "rede_perfil_fixar(uuid)", "rede_perfil_seguir(text,boolean)", "rede_perfil_pedidos()", "rede_perfil_decidir(uuid,boolean)", "rede_perfil_imagem_enviar(text,text)", "rede_perfil_imagem_remover(text)", "rede_perfil_imagens_fila()", "rede_perfil_imagem_decidir(uuid,text,boolean)", "rede_perfil_imagem(uuid,text)"];
  const r = [];
  for (const f of so_conta) r.push([(await um("select has_function_privilege('anon', $1, 'execute') as v", [`public.${f}`])).v, (await um("select has_function_privilege('authenticated', $1, 'execute') as v", [`public.${f}`])).v]);
  r.push([(await um("select has_function_privilege('anon', 'public.rede_perfil_avatares(uuid[])', 'execute') as v")).v, (await um("select has_function_privilege('authenticated', 'public.rede_perfil_avatares(uuid[])', 'execute') as v")).v]);
  return r;
}, (r) => r.slice(0, -1).every((x) => x[0] === false && x[1] === true) && r.at(-1)[0] === true && r.at(-1)[1] === true);
await espera("rede_perfil_de e rede_seguir mantêm as permissões que tinham", async () => [
  (await um("select has_function_privilege('authenticated', 'public.rede_perfil_de(text)', 'execute') as v")).v, (await um("select has_function_privilege('anon', 'public.rede_perfil_de(text)', 'execute') as v")).v,
  (await um("select has_function_privilege('authenticated', 'public.rede_seguir(uuid,boolean)', 'execute') as v")).v,
], (r) => r[0] === true && r[1] === false && r[2] === true);
await espera("nenhuma função do pacote é 'security invoker' sem trava nem fica sem search_path", async () => {
  const linhas = await todos(`select p.proname, p.prosecdef, p.proconfig::text as cfg from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'public' and p.proname like 'rede_perfil%') or (n.nspname = 'interno' and p.proname like 'rede3_perfil%')`);
  return linhas.filter((l) => !l.prosecdef || !/search_path=interno, pg_temp/.test(l.cfg ?? "")).filter((l) => l.proname !== "rede3_perfil_webp_ok").map((l) => l.proname);
}, (m) => m.length === 0);
await espera("nada de tabela nova no esquema public e as novas colunas ficam em interno.perfis (sem permissão para o cliente)", async () => {
  const sql = lerTexto("supabase/migracoes/2026-11-rede-perfil.sql");
  const colunas = await todos("select grantee from information_schema.column_privileges where table_schema = 'interno' and table_name = 'perfis' and column_name like 'rede_avatar%' and grantee in ('anon', 'authenticated')");
  return [/create table/i.test(sql), /\bdrop\b/i.test(sql.replace(/--.*$/gm, "")), colunas.length];
}, (r) => r[0] === false && r[1] === false && r[2] === 0);
await espera("nenhuma imagem enviada vaza pelo perfil de quem está invisível (a imagem some junto)", async () => {
  await rpc(P("equipe"), "rede_perfil_editar", { p: { modo: "invisivel" } });
  const l = await rpc(P("bia"), "rede_perfil_avatares", { p_usuarios: [pessoas.equipe] });
  const img = await rpc(P("bia"), "rede_perfil_imagem", { p_usuario: pessoas.equipe, p_tipo: "avatar" });
  await rpc(P("equipe"), "rede_perfil_editar", { p: { modo: "aberto" } });
  return [l, img];
}, (r) => !(pessoas.equipe in r[0]) && r[1] === null);

// ── Regras puras, cliente e fiação ──
await espera("regras puras: galeria, @nome, imagem, estudando, selos e trilhas", async () => [
  AVATARES.length, CAPAS.length, AVATARES[0], AVATARES[23], CAPAS[7],
  handleBemFormado("ana_luta"), handleBemFormado("Ana"), handleBemFormado("ab"), arrumarHandle("  @@Ana_Luta "), handleReservado("lucia_oficial"), handleReservado("ana_luta"),
  origemDaImagem({ tipo: "galeria", id: "a07" }, "avatar"), origemDaImagem({ tipo: "galeria", id: "../../x" }, "avatar"), origemDaImagem({ tipo: "galeria", id: "c03" }, "capa"),
  origemDaImagem({ tipo: "envio", dados: BOA, pendente: false }, "avatar") === BOA, origemDaImagem({ tipo: "envio", dados: "javascript:alert(1)", pendente: false }, "avatar"), origemDaImagem({ tipo: null }, "avatar"),
], (r) => r[0] === 24 && r[1] === 8 && r[2] === "a01" && r[3] === "a24" && r[4] === "c08" && r[5] && !r[6] && !r[7] && r[8] === "ana_luta" && r[9] && !r[10]
  && r[11] === "/rede/avatares/a07.svg" && r[12] === null && r[13] === "/rede/capas/c03.svg" && r[14] === true && r[15] === null && r[16] === null);
await espera("regras puras: estudando agora só aceita aula sob /trilhas e título sem endereço", async () => [
  estudandoDaUltimaAula({ path: "/trilhas/matematica/fracoes", title: "Frações", track: "matematica" }),
  estudandoDaUltimaAula({ path: "/painel/x", title: "x", track: "matematica" }),
  estudandoDaUltimaAula({ path: "https://evil.example/trilhas/a", title: "x" }),
  estudandoDaUltimaAula({ path: "/trilhas/matematica/fracoes?x=1#a", title: "veja https://evil.example", track: "matematica" }),
  estudandoDaUltimaAula(null), estudandoDaUltimaAula("texto"),
], (r) => r[0]?.aula === "/trilhas/matematica/fracoes" && r[0].titulo === "Frações" && r[1] === null && r[2] === null && r[3]?.aula === "/trilhas/matematica/fracoes" && r[3].titulo === undefined && r[4] === null && r[5] === null);
await espera("regras puras: trilhas com progresso e selos", async () => [
  trilhasComProgresso(["historia/a1", "historia/a2", "fisica/b1", "lixo", "Maiuscula/x", "historia/a3"]),
  escolherSelosDeTrilha(["historia", "historia", "Ruim!", "fisica"]), escolherSelosDeTrilha(Array.from({ length: 30 }, (_, i) => `trilha-${i}`)).length,
  slugDoSelo("trilha:historia"), slugDoSelo("equipe"), nomeDaTrilha("ensino-medio-fisica"), tipoDoSelo("equipe"), tipoDoSelo("trilha:historia"), tipoDoSelo("filiado-partido"), TIPOS_DE_SELO.length,
], (r) => r[0].length === 2 && r[0][0].slug === "historia" && r[0][0].feitas === 3 && r[1].join() === "historia,fisica" && r[2] === 12 && r[3] === "historia" && r[4] === null
  && r[5] === "ensino medio fisica" && r[6] === "equipe" && r[7] === "trilha" && r[8] === null && r[9] === 4);
await espera("o cliente chama as funções do contrato pelos nomes e parâmetros certos", async () => {
  const chamadas = [];
  const c = criarClientePerfil(async (f, a) => (chamadas.push([f, a]), {}));
  await c.perfil("ana"); await c.meu(); await c.editar({ bio: "x" }); await c.definirHandle("ana"); await c.fixar("id"); await c.seguir("ana", true); await c.pedidos(); await c.decidir("u", true);
  await c.enviarImagem("avatar", "d"); await c.removerImagem("capa"); await c.fila(); await c.decidirImagem("u", "avatar", false); await c.avatares(["a"]); await c.imagem("u");
  return chamadas.map(([f, a]) => `${f}:${Object.keys(a ?? {}).join("+")}`);
}, (r) => r.join("|") === ["rede_perfil_de:p_handle", "rede_perfil_meu:", "rede_perfil_editar:p", "rede_perfil_handle_definir:p_handle", "rede_perfil_fixar:p_post", "rede_perfil_seguir:p_handle+p_sim", "rede_perfil_pedidos:", "rede_perfil_decidir:p_quem+p_aceitar", "rede_perfil_imagem_enviar:p_tipo+p_dados", "rede_perfil_imagem_remover:p_tipo", "rede_perfil_imagens_fila:", "rede_perfil_imagem_decidir:p_usuario+p_tipo+p_aceitar", "rede_perfil_avatares:p_usuarios", "rede_perfil_imagem:p_usuario+p_tipo"].join("|"));
await espera("o cliente de verdade edita e lê o próprio perfil", async () => {
  const c = cliente("edu");
  await c.editar({ bio: "Pelo cliente", avatar: "a09", modo: "trancado" });
  const meu = await c.meu();
  await c.editar({ modo: "aberto" });
  return [meu.bio, meu.avatar.id, meu.modo, (await c.perfil("edu_luta")).meu];
}, (r) => r[0] === "Pelo cliente" && r[1] === "a09" && r[2] === "trancado" && r[3] === true);
await espera("lib/rede/*-perfil.ts e perfil.ts não usam atalhos '@/' (rodam no Node)", async () => ["perfil.ts", "tipos-perfil.ts", "cliente-perfil.ts", "textos-perfil.ts"].map((a) => /from "@\//.test(lerTexto(`lib/rede/${a}`))), (r) => r.every((v) => v === false));
await espera("as 24 figuras e as 8 capas existem, são leves e não têm script nem link externo", async () => {
  const ruins = [];
  for (const [pasta, prefixo, n, teto] of [["avatares", "a", 24, 1000], ["capas", "c", 8, 1500]]) {
    for (let i = 1; i <= n; i++) {
      const id = `${prefixo}${String(i).padStart(2, "0")}`;
      const caminho = `public/rede/${pasta}/${id}.svg`;
      if (!existe(caminho)) { ruins.push(`${id}: falta`); continue; }
      const t = lerTexto(caminho);
      if (Buffer.byteLength(t) > teto) ruins.push(`${id}: pesado`);
      if (!/<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(t) || /<script|onload|onclick|href=|xlink|<image|<foreignObject|https?:\/\/(?!www\.w3\.org)/i.test(t)) ruins.push(`${id}: conteúdo`);
      if (!/Licença: AGPL-3\.0-or-later/.test(t)) ruins.push(`${id}: sem licença`);
    }
  }
  return ruins;
}, (r) => r.length === 0);
await espera("os seis idiomas têm as mesmas chaves; pt é final e os outros cinco são rascunho marcado; todos os desenhos têm nome", async () => {
  const achatar = (o, pre = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? achatar(v, `${pre}${k}.`) : [`${pre}${k}`]));
  const ptJ = JSON.parse(lerTexto("i18n/rede/perfil/pt.json"));
  const pt = achatar(ptJ).filter((k) => k !== "_rascunho").sort();
  const r = { pt: { rascunho: ptJ._rascunho === true, nomes: Object.keys(ptJ.avatar.nomes).length + Object.keys(ptJ.capa.nomes).length } };
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const j = JSON.parse(lerTexto(`i18n/rede/perfil/${l}.json`));
    r[l] = { iguais: JSON.stringify(achatar(j).filter((k) => k !== "_rascunho").sort()) === JSON.stringify(pt), rascunho: j._rascunho === true, nomes: Object.keys(j.avatar.nomes).length + Object.keys(j.capa.nomes).length };
  }
  return r;
}, (r) => r.pt.rascunho === false && r.pt.nomes === 32 && ["en", "es", "fr", "ru", "zh"].every((l) => r[l].iguais && r[l].rascunho && r[l].nomes === 32));
await espera("a rota editar-perfil existe, dá 404 com o recurso desligado e está no registro da casca; a página do perfil carrega sob demanda", async () => {
  const rota = lerTexto("app/[lang]/comunidade/editar-perfil/page.tsx");
  const registro = lerTexto("components/rede/registro.tsx");
  const telas = lerTexto("components/rede/Telas.tsx");
  const casca = lerTexto("components/rede/Casca.tsx");
  return [/ligado\("rede-v2"\)/.test(rota), /notFound\(\)/.test(rota), /robots: \{ index: false/.test(rota), /"editar-perfil": \{ componente: dynamic\(\(\) => import\("\.\/perfil\/EditarPerfil"\)/.test(registro),
    /dynamic\(\(\) => import\("\.\/perfil\/TelaDoPerfil"\)/.test(telas), /editar-perfil/.test(casca)];
}, (r) => r.every(Boolean));
await espera("os componentes não usam alert/confirm/prompt do navegador e o rosto vem em lote (sem pedir um por cartão)", async () => {
  const fontes = ["Avatar.tsx", "EditarPerfil.tsx", "TelaDoPerfil.tsx", "imagem.ts"].map((a) => lerTexto(`components/rede/perfil/${a}`)).join("\n");
  const avatar = lerTexto("components/rede/perfil/Avatar.tsx");
  const cartao = lerTexto("components/rede/CartaoDePost.tsx");
  return [/window\.(alert|confirm|prompt)|\b(alert|confirm|prompt)\(/.test(fontes), /redePerfil\.avatares\(ids\)/.test(avatar), /slice\(0, 60\)/.test(avatar), /<Avatar usuario=/.test(cartao)];
}, (r) => r[0] === false && r[1] && r[2] && r[3]);
await espera("a tela só lê do aparelho a última aula e as aulas feitas, e só na tela do próprio perfil e na de editar", async () => {
  const todos = ["Avatar.tsx", "EditarPerfil.tsx", "TelaDoPerfil.tsx", "imagem.ts", "useTextos.ts"].map((a) => lerTexto(`components/rede/perfil/${a}`)).join("\n");
  const chaves = [...todos.matchAll(/localStorage\.getItem\(([^)]*)\)|lerDoAparelho<[^>]*>\("([^"]+)"/g)].map((m) => m[2] ?? m[1]);
  return chaves.filter((k) => k !== "chave");
}, (c) => c.length >= 2 && c.every((k) => /lucia:ultima-aula|lucia:concluidas/.test(k)));
await espera("o script e o recurso: testar:rede-perfil registrado no package.json", async () => /"testar:rede-perfil":/.test(lerTexto("package.json")), (v) => v === true);

console.log(`Rede v2 (perfil): ${certos} certos, ${falhas.length} falhas.`);
for (const falha of falhas) console.log(`  ✗ ${falha}`);
process.exit(falhas.length ? 1 : 0);
