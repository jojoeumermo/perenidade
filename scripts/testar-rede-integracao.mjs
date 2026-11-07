// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova que os nove pacotes da Rede v2 se encaixam: o install.sql traz as migrações rede-* inteiras e na ordem, instala várias
// vezes sobre si mesmo, a trava do espaço fechado vale em rede2_pode_ver, quem declarou menos de 18 não segue nem bloqueia, a
// migração do Fórum deixa de fora o que ainda está retido, os textos fecham nos seis idiomas em todos os pacotes, o recurso
// rede-v2 só liga pelo nome (com ele desligado, as rotas novas dão 404 e a Rede de hoje fica como está) e as telas dos pacotes
// estão no registro da casca. Uso: npm run testar:rede-integracao
import fs from "node:fs";
import { criarBanco } from "./banco-local.mjs";
import { ligado, lerRecursos, SO_PELO_NOME } from "../lib/recursos.ts";

let certos = 0;
const falhas = [];
async function espera(nome, promessa, conferir = () => true) {
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
const ORDEM = ["fundacao", "consertos", "perfil", "publicar", "conversa", "descoberta", "comunidades", "avisos", "moderacao", "integracao"];

// ── O install.sql e as migrações ──
const install = lerTexto("supabase/install.sql");
await espera("o install.sql traz cada migração rede-* inteira, uma depois da outra, na ordem de docs/rede/V2.md, no fim", async () => {
  let resto = install.trim();
  // Depois da Rede vêm, inteiras e nesta ordem, as migrações do lote 5/6/8/9.
  // As migrações de 6/11 vêm por último, inteiras; tiram-se do fim primeiro.
  for (const m of ["20261106-t32-alumia-vitrine", "20261106-t18-alumia-entrada", "20261106-pessoas-painel", "20261106-t15-frente-militantes"]) {
    const bloco = lerTexto(`supabase/migracoes/${m}.sql`).trim();
    if (!resto.endsWith(bloco)) throw new Error(`o fim do install.sql não é a migração ${m}`);
    resto = resto.slice(0, -bloco.length).trim();
  }
  for (const n of ["alumia", "progresso-qr", "backend-2", "backend-1", "controles", "eixos-equipe", "departamentos-termos"]) {
    const bloco = lerTexto(`supabase/migracoes/2026-11-${n}.sql`).trim();
    if (!resto.endsWith(bloco)) throw new Error(`o fim do install.sql não é a migração ${n}`);
    resto = resto.slice(0, -bloco.length).trim();
  }
  for (const n of [...ORDEM].reverse()) {
    const bloco = lerTexto(`supabase/migracoes/2026-11-rede-${n}.sql`).trim();
    if (!resto.endsWith(bloco)) throw new Error(`o fim do install.sql não é a migração rede-${n}`);
    resto = resto.slice(0, -bloco.length).trim();
  }
  return resto.endsWith("end $$;");
});

const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];
await espera("instalar o install.sql de novo, já com a Rede v2 dentro, não quebra", () => banco.instalarDeNovo());
await espera("e mais uma vez (idempotente)", () => banco.instalarDeNovo());

let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++}` });
const pessoas = {};
for (const nome of ["autor", "fora", "membro", "menor", "alvo"]) {
  pessoas[nome] = await criarUsuario(`${nome}@integracao.local`, nome);
  await rpc(como(pessoas[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_18 = true, rede_consentimento = 1 where id = $1", [pessoas[nome], `Pessoa ${nome}`]);
}

// ── A trava do espaço fechado, também em rede2_pode_ver ──
await espera("post público de espaço fechado: só autor e membro do espaço", async () => {
  await dono("insert into interno.rede_espacos (slug, nome, descricao, criado_por, codigo) values ('fechado-integracao', 'Espaço de teste', '', $1, 'abcdefghijkl')", [pessoas.autor]);
  const postFechado = (await um("insert into interno.rede_posts (autor, texto, comunidade, publico, alcance) values ($1, 'só do espaço', 'fechado-integracao', 'internet', 'publico') returning id", [pessoas.autor])).id;
  const ve = async (quem) => (await um("select interno.rede2_pode_ver(p, $2::uuid) as v from interno.rede_posts p where p.id = $1", [postFechado, quem])).v;
  const antes = [await ve(null), await ve(pessoas.fora), await ve(pessoas.autor)];
  await dono("insert into interno.rede_espaco_membros (espaco, usuario) values ('fechado-integracao', $1)", [pessoas.membro]);
  const depois = await ve(pessoas.membro);
  return antes.join() === "false,false,true" && depois === true;
});

// ── Idade mínima em seguir, bloquear e seguir comunidade ──
await dono("update interno.perfis set rede_18 = false, rede_menor_em = now() where id = $1", [pessoas.menor]);
await recusa("quem declarou menos de 18 não segue ninguém", () => rpc(como(pessoas.menor), "rede_seguir", { p_usuario: pessoas.alvo, p_sim: true }), "idade_minima");
await recusa("nem bloqueia", () => rpc(como(pessoas.menor), "rede_bloquear", { p_usuario: pessoas.alvo, p_sim: true }), "idade_minima");
await recusa("nem segue comunidade", () => rpc(como(pessoas.menor), "rede_comunidade_seguir", { p_comunidade: "moradia", p_sim: true }), "idade_minima");
await espera("quem tem 18 anos segue normalmente", () => rpc(como(pessoas.membro), "rede_seguir", { p_usuario: pessoas.alvo, p_sim: true }));

// ── A migração do Fórum deixa o que está retido para depois ──
await espera("tópico e resposta retidos não vão para a Rede nova; os aprovados vão; depois de aprovados, entram", async () => {
  const t1 = (await um("insert into interno.topicos (autor, titulo, corpo, disciplina) values ($1, 'Tópico aprovado do fórum', 'Corpo do tópico aprovado do fórum.', 'historia') returning id", [pessoas.autor])).id;
  const t2 = (await um("insert into interno.topicos (autor, titulo, corpo, disciplina, retido, motivo) values ($1, 'Tópico retido do fórum', 'Corpo do tópico retido do fórum.', 'historia', true, 'aguardando_avaliacao') returning id", [pessoas.autor])).id;
  const r1 = (await um("insert into interno.respostas (topico, autor, corpo, retido, motivo) values ($1, $2, 'Resposta retida no tópico aprovado.', true, 'aguardando_avaliacao') returning id", [t1, pessoas.membro])).id;
  await dono("select interno.rede_migrar_forum()");
  const mapa = async (tipo, id) => (await um("select count(*)::int as n from interno.rede_migracao where tipo = $1 and antigo = $2", [tipo, String(id)])).n;
  const antes = [await mapa("topico", t1), await mapa("topico", t2), await mapa("resposta", r1)];
  const retidosNovos = (await um("select count(*)::int as n from interno.rede_posts where retido and motivo = 'aguardando_avaliacao'")).n;
  await dono("update interno.topicos set retido = false where id = $1", [t2]);
  await dono("update interno.respostas set retido = false where id = $1", [r1]);
  await dono("select interno.rede_migrar_forum()");
  const depois = [await mapa("topico", t2), await mapa("resposta", r1)];
  return antes.join() === "1,0,0" && retidosNovos === 0 && depois.join() === "1,1";
});

// ── Pendências de integração aplicadas no install.sql ──
await espera("a faxina diária troca códigos antigos de convite, e o painel conta posts da Rede esperando a avaliação", async () => {
  const faxina = install.slice(install.indexOf("create or replace function interno.limpeza()"));
  const controles = install.slice(install.indexOf("'esperando_avaliacao'"));
  return /rede_fix_expirar_codigos/.test(faxina.slice(0, 9000)) && /from rede_posts where retido and motivo in \('aguardando_avaliacao'/.test(controles.slice(0, 900));
});
await espera("a faxina inteira roda sem erro com a Rede v2 instalada", () => dono("select interno.limpeza()"));
await espera("a manutenção de convites abre para o serviço", async () => (await rpc({ papel: "service_role" }, "rede_fix_manutencao"))?.ok === true);
await recusa("e não para quem está logado", () => rpc(como(pessoas.autor), "rede_fix_manutencao"), "permission denied");

// ── Textos nos seis idiomas, pacote por pacote ──
const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"];
const chaves = (obj, prefixo = "") => Object.entries(obj).flatMap(([k, v]) => (k === "_rascunho" ? [] : v && typeof v === "object" && !Array.isArray(v) ? chaves(v, `${prefixo}${k}.`) : [`${prefixo}${k}`]));
const lerJson = (caminho) => JSON.parse(lerTexto(caminho));
for (const pacote of ["", "consertos", "perfil", "publicar", "conversa", "descoberta", "comunidades", "avisos", "moderacao"]) {
  await espera(`i18n/rede${pacote ? `/${pacote}` : ""}: as mesmas chaves nos seis idiomas, e os cinco que não são português marcados como rascunho`, async () => {
    const pasta = pacote ? `${pacote}/` : "";
    const base = chaves(lerJson(`i18n/rede/${pasta}pt.json`)).sort();
    for (const l of IDIOMAS) {
      const j = lerJson(`i18n/rede/${pasta}${l}.json`);
      const c = chaves(j).sort();
      const falta = base.filter((k) => !c.includes(k));
      if (falta.length) throw new Error(`${l} sem ${falta.slice(0, 5).join(", ")}`);
      if (l !== "pt" && j._rascunho !== true) throw new Error(`${l} sem a marca _rascunho`);
    }
    return true;
  });
}
await espera("os textos novos da casca (cuidados) existem nos seis idiomas", async () => IDIOMAS.every((l) => lerJson(`i18n/rede/${l}.json`).casca.cuidados?.moderacao));

// ── O recurso rede-v2 e as rotas ──
await espera("rede-v2 só liga pelo nome: 'todos' não liga, o nome liga, '-rede-v2' desliga", async () =>
  SO_PELO_NOME.includes("rede-v2") &&
  !ligado("rede-v2", lerRecursos("todos")) &&
  ligado("rede-v2", lerRecursos("rede-v2")) &&
  ligado("rede-v2", lerRecursos("todos,rede-v2")) &&
  !ligado("rede-v2", lerRecursos("rede-v2,-rede-v2")) &&
  !ligado("rede-v2", lerRecursos("")));
const ROTAS = ["aula/[track]/[lesson]", "avisos", "buscar", "c/[slug]", "comunidades", "cuidado", "denuncias", "editar-perfil", "explorar", "moderacao", "nucleos", "nucleos/[id]", "p/[id]", "propor", "tag/[tag]", "u/[handle]", "silenciados"];
for (const rota of ROTAS) {
  await espera(`rota /comunidade/${rota}: 404 com rede-v2 desligado e sem indexar`, async () => {
    const t = lerTexto(`app/[lang]/comunidade/${rota}/page.tsx`);
    if (!/ligado\("rede-v2"\)/.test(t) || !/notFound\(\)/.test(t)) throw new Error("sem o portão do recurso");
    if (!/index: false/.test(t)) throw new Error("sem noindex");
    return true;
  });
}
await espera("a página /comunidade escolhe a v2 só com o recurso ligado, e o ramo antigo continua lá", async () => {
  const t = lerTexto("app/[lang]/comunidade/page.tsx");
  return /ligado\("rede-v2"\)/.test(t) && /ComunidadeComRede/.test(t);
});
await espera("o botão 'Discutir esta aula' só existe com rede-v2 ligado", async () => /ligado\("rede-v2"\)/.test(lerTexto("app/[lang]/trilhas/[track]/[lesson]/page.tsx")));
await espera("o proxy só redireciona ?t= e ?sala= com o recurso ligado", async () => /ligado\("rede-v2"\)/.test(lerTexto("proxy.ts")));

// ── A casca e o registro ──
const registro = lerTexto("components/rede/registro.tsx");
for (const tela of ["comunidades", "propor", "aula", "nucleos", "avisos", "explorar", "buscar", "tag", "editar-perfil", "moderacao", "denuncias", "silenciados", "cuidado"]) {
  await espera(`o registro da casca tem a tela "${tela}", e o arquivo dela existe`, async () => {
    const m = registro.match(new RegExp(`"?${tela}"?: \\{ componente: dynamic\\(\\(\\) => import\\("\\./([^"]+)"\\)`));
    if (!m) throw new Error("sem linha no registro");
    return ["tsx", "ts"].some((ext) => fs.existsSync(new URL(`../components/rede/${m[1]}.${ext}`, import.meta.url)));
  });
}
const casca = lerTexto("components/rede/Casca.tsx");
await espera("a casca mostra o número de avisos, os links de cuidado e tem a barra de baixo só no celular", async () =>
  /avisos\.contar\(\)/.test(casca) && /cuidados\.denuncias/.test(casca) && /md:hidden/.test(casca));
await espera("a linha filtra o silêncio só deste aparelho", async () => /silenciadoNoAparelho/.test(lerTexto("components/rede/Linha.tsx")));
await espera("Escrever tem o autocompletar de @, o aviso de modo lento e chama a avaliação externa do post retido", async () => {
  const t = lerTexto("components/rede/Escrever.tsx");
  return /CampoComMencoes/.test(t) && /redeMod\.lentoDe/.test(t) && /evaluatePost\("rede"/.test(t);
});
await espera("a Rede de hoje (v1) pede os 18 anos quando Apoiar ou Eu vou são recusados", async () => /recusaDeIdade/.test(lerTexto("components/comunidade/Rede.tsx")));
await espera("a Rede nova só chega ao navegador por import dinâmico sem SSR", async () => {
  const t = lerTexto("components/rede/RedeSobDemanda.tsx");
  return /ssr: false/.test(t) && /dynamic\(/.test(t);
});
await espera("a documentação do estado final tem as pendências para a coordenação", async () => /Pendências para a coordenação/.test(lerTexto("docs/rede/V2.md")));

console.log(`Rede v2 (integração): ${certos} certos, ${falhas.length} falhas.`);
if (falhas.length) {
  console.log(falhas.map((f) => `  ✗ ${f}`).join("\n"));
  process.exit(1);
}
process.exit(0);
