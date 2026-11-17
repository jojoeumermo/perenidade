// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O fecho da onda 11: as migrações 20261117-alumia-o11-*.sql e o fim (20261117-alumia-onda11-fim.sql) estão coladas, inteiras e
// na ordem, no fim do install.sql; o que as frentes deixaram para quem junta está nas telas; e, num Postgres de verdade
// (scripts/banco-local.mjs):
//   · o install.sql sobe do zero, com a versão 8 e nenhuma função public.rede_*/alumia_* sem porta;
//   · por cima dele, a onda inteira roda DUAS vezes seguidas sem estrago;
//   · as fotos do álbum dos atos contam na cota da pessoa, a foto nova para quando a cota enche e a foto que sai do registro vai
//     para a fila de arquivos do servidor (as sobras da onda 10);
//   · montado como o banco estava depois da onda 10 (o install.sql até o começo da primeira migração da onda 11), a onda roda duas
//     vezes, sobe a versão de 7 para 8 e deixa o relatório de transparência, o servidor da federação e o diretório sem a porta.
// Uso: npm run testar:alumia-onda11
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { noFimDoInstall } from "./install-posteriores.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const normal = (t) => t.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
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

// ═══════════════════ 0. Os arquivos ═══════════════════
/** A ordem da onda 11 (a mesma do fim do install.sql e do SQL único da onda). */
const ORDEM = [
  "20261117-alumia-o11-texto.sql",
  "20261117-alumia-o11-turma.sql",
  "20261117-alumia-o11-redacao.sql",
  "20261117-alumia-o11-escola.sql",
  "20261117-alumia-o11-interesses.sql",
  "20261117-alumia-o11-porta.sql",
  "20261117-alumia-onda11-fim.sql",
];
const pasta = path.join(raiz, "supabase", "migracoes");
const daOnda = fs.readdirSync(pasta).filter((n) => /^20261117-alumia-(o11-.+|onda11-fim)\.sql$/.test(n));
ok(`toda migração da onda 11 está na ordem (fora dela: ${daOnda.filter((n) => !ORDEM.includes(n)).join(", ") || "nenhuma"})`, daOnda.length === ORDEM.length && daOnda.every((n) => ORDEM.includes(n)));
const migracoes = ORDEM.map((n) => ({ nome: n, sql: ler(`supabase/migracoes/${n}`) }));
const install = normal(ler("supabase/install.sql"));
const posicoes = migracoes.map(({ sql }) => install.lastIndexOf(normal(sql)));
ok("cada migração da onda está inteira (idêntica) no install.sql", posicoes.every((i) => i > 0));
ok("e na ordem certa, depois do fim da onda 10", posicoes.every((i, k) => k === 0 || i > posicoes[k - 1]) && posicoes[0] > install.lastIndexOf(normal(ler("supabase/migracoes/20261116-alumia-onda10-fim.sql"))));
ok("o fim da onda está no fim do install.sql (depois dele, só migrações datadas que entraram depois)", noFimDoInstall(migracoes.at(-1).sql));
const fim = migracoes.at(-1).sql;
ok("o fim sobe a versão para 8", /create or replace function public\.rede_alumia_versao\(\)[\s\S]*?select 8\s*\$\$/.test(fim));
ok("só o fim mexe na versão", migracoes.slice(0, -1).every(({ sql }) => !/function public\.rede_alumia_versao/.test(sql)));
ok("toda migração da onda termina passando a porta", migracoes.every(({ sql }) => /interno\.alumia_trancar\(\)/.test(normal(sql).slice(-400))));
ok("o código espera a versão 8 do banco ou mais", Number((ler("lib/rede/painel/tipos.ts").match(/VERSAO_ESPERADA_DO_BANCO = (\d+);/) ?? [])[1]) >= 8);
ok("nenhuma migração da onda redefine a lista de exceções da porta (a da onda 9, com a federação e o diretório, vale)", migracoes.every(({ sql }) => !/function interno\.alumia_porta_aberta\(/.test(sql)));
{
  // Duas migrações da onda não redefinem a mesma função (o git não acusa esse conflito; a segunda apagaria a primeira).
  const nomes = (sql) => new Set([...sql.matchAll(/create (?:or replace )?function ([a-z_]+\.[a-z0-9_]+)\s*\(/gi)].map((m) => m[1].toLowerCase()));
  const vistos = new Map();
  const repetidas = [];
  for (const { nome, sql } of migracoes.slice(0, -1)) {
    for (const f of nomes(sql)) {
      if (vistos.has(f)) repetidas.push(`${f} (${vistos.get(f)} e ${nome})`);
      else vistos.set(f, nome);
    }
  }
  ok(`nenhuma função redefinida por duas migrações da onda (${repetidas.join("; ") || "nenhuma"})`, repetidas.length === 0);
  const pisadas = [...nomes(fim)].filter((f) => vistos.has(f));
  ok(`o fim não redefine função de nenhuma frente (${pisadas.join(", ") || "nenhuma"})`, pisadas.length === 0);
  ok("nenhuma frente redefine a regra de quem vê (rede2_pode_ver, rede_ve, rede_silenciado, rede_post_v2)", migracoes.every(({ sql }) => !/function interno\.(rede2_pode_ver|rede_ve|rede_silenciado|rede_post_v2)\(/.test(sql)));
  // As funções que o fim redefine são as da cota e do painel (onda 8), com a mesma assinatura.
  ok("o fim redefine só a cota, o painel do espaço e as peças novas do álbum", [...nomes(fim)].sort().join() === [
    "interno.alumia_midia_uso", "interno.rede_ato_album_na_cota", "interno.rede_ato_album_para_a_fila", "public.alumia_painel_espaco", "public.rede_alumia_versao",
  ].join());
}
// Nenhuma tabela nova da onda guarda endereço de rede (decisão de 13/11).
for (const { nome, sql } of migracoes) {
  const tabelas = [...sql.matchAll(/create table if not exists (interno\.[a-z0-9_]+)\s*\(([\s\S]*?)\n\);/gi)];
  const comIp = tabelas.filter(([, , corpo]) => /\b(ip|endereco_ip|ip_origem|inet)\b/i.test(corpo.replace(/--.*$/gm, ""))).map(([, t]) => t);
  ok(`${nome}: nenhuma tabela com coluna de endereço de rede (${comIp.join(", ") || "nenhuma"})`, comIp.length === 0);
  ok(`${nome}: nenhuma tabela nova fora do esquema interno`, !/create table (?:if not exists )?(?!interno\.)[a-z_]+\./i.test(sql.replace(/--.*$/gm, "")));
}

// ═══════════════════ 0b. O que as frentes deixaram para quem junta ═══════════════════
{
  const encaixes = ler("components/rede/encaixes.tsx");
  for (const [nome, caminho] of [["questoes", "questoes"], ["turma", "turma"], ["agenda", "agenda"], ["redacao", "redacao"], ["conquistas", "conquistas"]]) {
    ok(`o encaixe ${nome} da onda 11 está na lista das frentes`, new RegExp(`import \\{ encaixe as ${nome} \\} from "\\./estudo/${caminho}/encaixe"`).test(encaixes) && /questoes, turma, agenda, redacao, conquistas,/.test(encaixes));
  }
  ok("o lugar do alto da comunidade existe nos encaixes", /altoDaComunidade\?: ComponentType/.test(encaixes) && /altoDaComunidade: \[\]/.test(encaixes));
  ok("o carimbo da comunidade de avisos é pendurado pela estrutura no alto da comunidade", /altoDaComunidade: \[AvisoDeSoLeitura\]/.test(ler("components/rede/comunidades/estrutura/encaixe.tsx")));
  const pagina = ler("components/rede/comunidades/PaginaDaComunidadeAlumia.tsx");
  ok("a página da comunidade desenha o alto pelo encaixe e troca o Escrever aqui pela regra quando a pessoa não abre post", /ENCAIXES\.altoDaComunidade\.map/.test(pagina) && /motivoSemEscrever \?/.test(pagina) && !/from "\.\/estrutura\//.test(pagina));

  const registro = ler("components/rede/registro.tsx");
  for (const [nome, arquivo] of [["questoes", "estudo/questoes/TelaDasQuestoes"], ["turmas", "estudo/turma/TelaDasTurmas"], ["agenda", "estudo/agenda/TelaDaAgenda"], ["redacao", "estudo/redacao/TelaDaRedacao"], ["conquistas", "estudo/conquistas/TelaConquistas"], ["aprovados", "estudo/conquistas/TelaMural"]]) {
    ok(`${nome} está no registro com import dinâmico`, registro.includes(`${nome}: { componente: dynamic(() => import("./${arquivo}"), { ssr: false })`));
    ok(`a página /alumia/${nome} existe`, fs.existsSync(path.join(raiz, `app/[lang]/alumia/${nome}/page.tsx`)));
  }
  const recursos = ler("lib/recursos.ts");
  ok("alumia-estudo existe e só liga pelo nome", /"alumia-estudo": "/.test(recursos) && /SO_PELO_NOME[^;]*"alumia-estudo"/.test(recursos));
  ok("o catálogo de interruptores leva alumia-estudo, só pelo nome, no install.sql, no backend-1 e no fim", [install, ler("supabase/migracoes/2026-11-backend-1.sql")].every((t) => t.includes("('alumia-estudo', true)")) && fim.includes("('alumia-estudo', true)"));
  ok("turma e agenda ligam com alumia-estudo", /ligado\("alumia-estudo"\)/.test(ler("components/rede/estudo/turma/ligado.ts")));
  const rotas = ler("lib/rede/rotas-novas.ts");
  ok("questões e redação são rotas novas atrás de alumia-estudo, sem indexar", /nome: "questoes", caminho: "\/questoes", flag: "alumia-estudo", frente: "11A", indexar: false/.test(rotas) && /nome: "redacao", caminho: "\/redacao", flag: "alumia-estudo", frente: "11D", indexar: false/.test(rotas));
  ok("as rotas da onda 11 abrem no endereço próprio da Alumia", ["questoes", "turmas", "agenda", "redacao", "conquistas", "aprovados"].every((r) => new RegExp(`"${r}"`).test(ler("lib/rede/alumia.ts"))));
  const cartoes = [ler("components/rede/CartaoDePost.tsx"), ler("components/rede/publicar/alumia2/CartaoDaAlumia2.tsx")];
  ok("os dois cartões desenham o texto pelo TextoDoPost (formatado quando há marca, o parágrafo de antes quando não há)", cartoes.every((c) => /<TextoDoPost /.test(c) && !/<TextoComTags /.test(c)));
  ok("o texto longo do compositor usa o editor com a barra de formatação", /<EditorDeTexto/.test(ler("components/rede/publicar/alumia2/EscreverDaAlumia2.tsx")));
  const pacote = JSON.parse(ler("package.json")).scripts;
  for (const t of ["texto", "turma", "redacao", "escola", "interesses", "porta", "links", "panico"]) ok(`package.json: testar:alumia-o11-${t}`, (pacote[`testar:alumia-o11-${t}`] ?? "").includes(`scripts/testar-alumia-o11-${t}.mjs`));
  ok("package.json: testar:alumia-onda11", (pacote["testar:alumia-onda11"] ?? "").includes("scripts/testar-alumia-onda11.mjs"));
  // A entrada: a senha de pânico e o questionário juntos, com o desafio da Cloudflare de volta (conserto da onda 10).
  const entrada = ler("components/rede/entrada/Formularios.tsx");
  ok("a entrada leva a senha de pânico e o questionário de interesses", /import \{ trocaDePanico \} from "\.\.\/seguranca\/encaixe-da-entrada";/.test(entrada) && /<Questionario/.test(entrada));
  ok("a senha de pânico é conferida antes de a senha sair e a isca entra pelo mesmo caminho, com o desafio da Cloudflare", /const conta = \(await trocaDePanico\(senha\)\) \?\? \{ email, senha \};/.test(entrada) && /entrarPelaPorta\(\{ email: conta\.email, senha: conta\.senha, turnstile: desafio\.token \}\)/.test(entrada));
  ok("o desafio da Cloudflare segue no criar conta, no reenviar e no esqueci a senha", /criarConta\(\{[^}]*turnstile: desafio\.token \}\)/.test(entrada) && (entrada.match(/avisoPelaPorta\(\{[^}]*turnstile: desafio\.token \}\)/g) ?? []).length >= 2);
  const panico = ler("components/rede/seguranca/SenhaDePanico.tsx");
  ok("criar e abrir a isca também passam pelo desafio da Cloudflare", /criarIsca\(\{[^}]*turnstile: desafio\.token \}\)/.test(panico) && /abrirIsca\(conteudo, desafio\.token\)/.test(panico));
  ok("as respostas do questionário ficam com o prefixo que a troca de pânico apaga", /CHAVE_DOS_INTERESSES = "lucia:rede:/.test(ler("lib/rede/interesses.ts")) && /apagarDoAparelho\(\)/.test(ler("components/rede/seguranca/encaixe-da-entrada.ts")));
  ok("a política de conteúdo ainda deixa o desafio da Cloudflare quando a chave pública existe", /challenges\.cloudflare\.com/.test(ler("next.config.ts")));
  // A faxina dos arquivos esvazia a fila também do depósito do álbum.
  ok("a rota da faxina apaga da fila também o depósito do álbum", /\["rede-midia", "rede-stories", "rede-album"(, "[a-z-]+")*\]/.test(ler("app/api/rede/exportar/faxina/route.ts")));
  for (const l of ["pt", "en", "es", "fr", "ru", "zh"]) ok(`${l}: a frase da cota cheia no álbum`, typeof JSON.parse(ler(`i18n/rede/atos/${l}.json`)).eventos?.erros?.midia_cheia === "string");
}

const onda = migracoes.map(({ sql }) => sql).join("\n");
const FUNCOES_DA_REDE = `
  select p.proname as nome, pg_get_function_identity_arguments(p.oid) as args, p.prosrc ~ 'interno\\.alumia_(porta|passa)\\(\\)' as porta,
    interno.alumia_porta_aberta(p.proname, pg_get_function_identity_arguments(p.oid)) as aberta
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype and (p.proname like 'rede\\_%' or p.proname like 'alumia\\_%')
    and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`;
const semPorta = async (dono) => (await dono(FUNCOES_DA_REDE)).rows.filter((f) => !f.porta && !f.aberta).map((f) => `${f.nome}(${f.args})`);
/** As funções públicas que as frentes da onda 11 criaram (pelo texto das migrações): todas têm de ter a porta. */
const DA_ONDA = [...new Set([...onda.matchAll(/create (?:or replace )?function public\.([a-z0-9_]+)\s*\(/gi)].map((m) => m[1].toLowerCase()))].filter((n) => n !== "rede_alumia_versao");
const comPorta = async (dono) =>
  (await dono(`select p.proname, bool_and(p.prosrc ~ 'interno\\.alumia_(porta|passa)\\(\\)' or interno.alumia_porta_aberta(p.proname, pg_get_function_identity_arguments(p.oid))
        or not (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))) as porta
      from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = any ($1::text[]) group by p.proname`, [DA_ONDA])).rows;
const todasComPorta = (r) => {
  const faltam = DA_ONDA.filter((n) => !r.some((x) => x.proname === n && x.porta));
  if (faltam.length) console.log("  sem porta ou ausentes:", faltam.join(", "));
  return DA_ONDA.length > 40 && faltam.length === 0;
};

// ═══════════════════ 1. Do zero ═══════════════════
{
  const banco = await criarBanco();
  const { dono, rpc } = banco;
  const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
  await espera("o install.sql sobe do zero e responde a versão 8 ou mais (as ondas seguintes sobem), para visitante também", () => rpc({ papel: "anon", ip: "203.0.113.5" }, "rede_alumia_versao"), (v) => v >= 8);
  await espera("nenhuma função da rede ficou sem porta", async () => (await dono("select interno.alumia_trancar() as r")).rows[0].r, (r) => Array.isArray(r?.abertas) && r.abertas.length === 0);
  await espera("toda public.rede_*/alumia_* que anon ou authenticated chamam tem a porta ou está na lista de exceções", () => semPorta(dono), (l) => l.length === 0);
  await espera(`as ${DA_ONDA.length} funções públicas da onda 11 passam pela porta (ou só o servidor as chama)`, () => comPorta(dono), todasComPorta);
  await espera("o interruptor alumia-estudo está no catálogo, só pelo nome", async () => (await dono("select so_pelo_nome from interno.recursos_catalogo where nome = 'alumia-estudo'")).rows[0]?.so_pelo_nome, (v) => v === true);
  await espera("a onda roda de novo por cima do install.sql", () => exec(onda));
  await espera("e mais uma vez, sem estrago (idempotente)", () => exec(onda));
  await espera("a versão é a da onda 11 (8), já que o fim dela rodou por último, e sem porta aberta", async () => [await rpc({ papel: "anon", ip: "203.0.113.6" }, "rede_alumia_versao"), (await dono("select interno.alumia_trancar() as r")).rows[0].r], ([v, r]) => v === 8 && r.abertas.length === 0);
  await espera("e sem função pública sem porta", () => semPorta(dono), (l) => l.length === 0);
  await espera("os gatilhos do álbum estão lá uma vez só", async () => (await dono("select tgname from pg_trigger where tgrelid = 'interno.rede_ato_album'::regclass and not tgisinternal order by 1")).rows.map((r) => r.tgname),
    (t) => t.filter((n) => n === "rede_ato_album_na_cota").length === 1 && t.filter((n) => n === "rede_ato_album_para_a_fila").length === 1);
  await espera("a fila de arquivos aceita o depósito do álbum (uma regra só sobre o depósito)", async () => (await dono("select pg_get_constraintdef(oid) as d from pg_constraint where conrelid = 'interno.alumia_arquivos_a_apagar'::regclass and contype = 'c' and pg_get_constraintdef(oid) ~ 'deposito'")).rows.map((r) => r.d),
    (d) => d.length === 1 && ["rede-midia", "rede-stories", "rede-album"].every((x) => d[0].includes(x)));

  // ── As fotos do álbum na cota e na fila (com um depósito de mentira: o banco local não tem o Storage) ──
  const ana = await banco.criarUsuario("ana@onda11.local", "ana");
  const outra = await banco.criarUsuario("bia@onda11.local", "bia");
  // O perfil nasce na primeira chamada da pessoa.
  for (const [i, p] of [ana, outra].entries()) await rpc({ papel: "authenticated", sub: p, aal: "aal2", ip: `198.51.100.${30 + i}` }, "eu");
  const ATO = "11111111-1111-4111-8111-111111111111";
  const caminho = (n) => `${ATO}/2222222${n}-2222-4222-8222-222222222222.webp`;
  await espera("um depósito de mentira para a conta da cota", () => exec(`
    create schema if not exists storage;
    create table if not exists storage.objects (id bigserial primary key, bucket_id text not null, name text not null, metadata jsonb, created_at timestamptz not null default now());`));
  await espera("a cota vai para 10 MB (o mínimo aceito)", () => dono("insert into interno.configuracoes (chave, valor) values ('midia_cota', '{\"bytes\": 10485760}'::jsonb) on conflict (chave) do update set valor = excluded.valor"));
  await espera("6 MB de posts na pasta dela, 5 MB de uma foto do álbum (registro de ato de mentira) e 3 MB de foto de outra pessoa", () => banco.exclusivo(async () => {
    await banco.pg.query("insert into storage.objects (bucket_id, name, metadata) values ('rede-midia', $1, '{\"size\": \"6000000\"}'), ('rede-album', $2, '{\"size\": \"5000000\"}'), ('rede-album', $3, '{\"size\": \"3000000\"}')", [`${ana}/a.webp`, caminho(1), caminho(2)]);
    // O registro da foto aponta para um ato que o teste não monta: as chaves estrangeiras e os gatilhos ficam de fora só nesta inserção.
    await banco.pg.exec("set session_replication_role = replica");
    try {
      await banco.pg.query("insert into interno.rede_ato_album (ato, quem, caminho, estado) values ($1, $2, $3, 'aprovada'), ($1, $4, $5, 'aprovada')", [ATO, ana, caminho(1), outra, caminho(2)]);
    } finally {
      await banco.pg.exec("set session_replication_role = origin");
    }
  }));
  await espera("o uso dela soma a pasta e as fotos do álbum que ela mandou (e não as da outra pessoa)", async () => (await dono("select interno.alumia_midia_uso($1)::bigint as a, interno.alumia_midia_uso($2)::bigint as b", [ana, outra])).rows[0],
    (r) => Number(r.a) === 11000000 && Number(r.b) === 3000000);
  await espera("com a cota cheia, o lugar de uma foto nova não é reservado (midia_cheia, antes de qualquer arquivo)", () =>
    dono("insert into interno.rede_ato_album (ato, quem, caminho) values ($1, $2, $3)", [ATO, ana, caminho(3)]).then(() => "passou", (e) => String(e.message)), (m) => /midia_cheia/.test(m));
  await espera("quem ainda cabe passa da cota (o erro seguinte é o do ato que não existe)", () =>
    dono("insert into interno.rede_ato_album (ato, quem, caminho) values ($1, $2, $3)", [ATO, outra, caminho(4)]).then(() => "passou", (e) => String(e.message)), (m) => !/midia_cheia/.test(m));
  await espera("a foto que sai do registro vai para a fila de arquivos do servidor, no depósito do álbum", async () => {
    await dono("delete from interno.rede_ato_album where caminho = $1", [caminho(1)]);
    return (await dono("select deposito, caminho from interno.alumia_arquivos_a_apagar where caminho = $1", [caminho(1)])).rows;
  }, (r) => r.length === 1 && r[0].deposito === "rede-album");
  await espera("apagar a conta leva as fotos dela para a fila (pela ligação com o perfil)", async () => {
    await dono("delete from interno.perfis where id = $1", [outra]);
    return (await dono("select deposito from interno.alumia_arquivos_a_apagar where caminho = $1", [caminho(2)])).rows;
  }, (r) => r.length === 1 && r[0].deposito === "rede-album");
  await espera("o painel do espaço mostra o depósito do álbum (só totais)", async () => {
    await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao') on conflict do nothing", [ana]);
    return rpc({ papel: "authenticated", sub: ana, aal: "aal2", ip: "198.51.100.40" }, "alumia_painel_espaco");
  }, (r) => r?.depositos?.["rede-album"]?.arquivos === 2 && r.depositos["rede-album"].bytes === 8000000 && r.perto_da_cota === null);
  await banco.pg.close?.();
}

// ═══════════════════ 2. O banco depois da onda 10 ═══════════════════
{
  const banco = await criarBanco({ antesDe: migracoes[0].sql });
  const { dono, rpc } = banco;
  const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
  await espera("o banco de antes responde a versão 7 (onda 10)", () => rpc({ papel: "anon", ip: "203.0.113.7" }, "rede_alumia_versao"), (v) => v === 7);
  await espera("a onda 11 inteira roda sobre o banco da onda 10", () => exec(onda));
  await espera("e de novo, logo em seguida, sem estrago (idempotente)", () => exec(onda));
  await espera("rede_alumia_versao() = 8, para visitante também", () => rpc({ papel: "anon", ip: "203.0.113.8" }, "rede_alumia_versao"), (v) => v === 8);
  await espera("nenhuma função da rede ficou sem porta", async () => (await dono("select interno.alumia_trancar() as r")).rows[0].r, (r) => Array.isArray(r?.abertas) && r.abertas.length === 0);
  await espera("toda public.rede_*/alumia_* que anon ou authenticated chamam tem a porta ou está na lista de exceções", () => semPorta(dono), (l) => l.length === 0);
  await espera(`as ${DA_ONDA.length} funções públicas da onda 11 passam pela porta (ou só o servidor as chama)`, () => comPorta(dono), todasComPorta);
  await espera("o relatório de transparência, o servidor da federação, o diretório e a revisão de conta continuam sem a porta", async () => (await dono("select bool_or(prosrc ~ 'interno\\.alumia_porta\\(\\)') as t, count(*)::int as n from pg_proc where proname in ('alumia_transparencia', 'rede_fed_servidor', 'rede_org_diretorio', 'rede_org_mapa', 'alumia_lei_minha_conta', 'alumia_triagem_convites')")).rows[0], (r) => r.t === false && r.n >= 6);
  await espera("a coordenação liga a trava (nenhuma porta aberta)", async () => (await dono("select interno.alumia_entrada_ligar(true) as r")).rows[0].r, (r) => r?.exigir === true);
  await espera("com a trava ligada, visitante ainda lê o relatório de transparência e o diretório das organizações", async () => [await rpc({ papel: "anon", ip: "203.0.113.9" }, "alumia_transparencia"), await rpc({ papel: "anon", ip: "203.0.113.10" }, "rede_org_diretorio", { p: {} })],
    ([t, d]) => t && typeof t === "object" && Array.isArray(d?.itens));
  await dono("select interno.alumia_entrada_ligar(false)");
  await banco.pg.close?.();
}

console.log(`\nfecho da onda 11: ${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log("  ✗", f);
process.exit(falhas.length ? 1 : 0);
