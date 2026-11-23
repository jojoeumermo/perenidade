// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A lista completa do que o servidor guarda (onda R3, item 3.2), tirada do banco MONTADO (o install.sql inteiro no PGlite), não de
// memória: cada tabela do esquema interno, com as colunas e o tipo, o que a migração diz dela (o comentário logo acima do
// "create table"), as colunas que apontam para uma conta e o prazo em que o próprio banco apaga as linhas (quando há rotina).
// O resultado vai para content/transparencia/o-que-o-servidor-guarda.json, que a página /transparencia/o-que-o-servidor-guarda
// mostra inteiro. O serviço de contas (esquema auth, do Supabase) não está no install.sql: a parte dele é escrita à mão em
// SERVICO_DE_CONTAS, abaixo, com o que a Alumia faz com cada coluna.
//
// Uso:
//   node scripts/ferramentas/inventario-do-banco.mjs             grava a lista de novo
//   node scripts/ferramentas/inventario-do-banco.mjs --conferir  sai com 1 se a lista não bate com o banco montado (o teste e o CI)
// Tabela NOVA sem comentário logo acima do "create table" faz o --conferir falhar: quem cria uma tabela diz o que ela guarda.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "../banco-local.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const ARQUIVO = path.join(raiz, "content/transparencia/o-que-o-servidor-guarda.json");

/** As áreas, pelo começo do nome da tabela (a primeira que casa). O resto é "o site e a equipe". */
export const AREAS = [
  ["alumia", /^(rede_|rede3_|alumia_|fediverso_|caixa_|caixas_|caixas$|pacotes$|diretorio_|passes_|chat_novo_|urna_|voz_)/],
  ["escola", /^(escola_|turmas|turma_|aulas|aula_|trilhas|exercicios|questoes|progresso|certificado|cadernos|anotacoes|curriculo|reforco|inscricoes|atividade_|estudo_|disciplina)/],
  ["painel", /^(equipe_|cartao_|atividade$|conversa|chat_|reunioes|tarefas|departamento|votacao|votacoes|votos|papeis|perfis|horas|termos_|avisos|design|designs|segredos|sucessao|auditoria|audit_|codigos_|aparelhos|convites|banimentos|entradas_|origem_|limites|operacao|configuracoes|sumidos|criticas|bem_|saude_|apoio|agradecimentos|colaboradores|candidaturas|pareceres|amizades)/],
  ["jornal e conteúdo", /^(apoiadores|podcast|radio|boletim|vale_|materiais|arquivos|contribuicoes|conteudo|traducao|imprensa|pautas|divulgacao|marketing|instagram|links|destaques|mural|gaveta|videoaulas|audio|transmissoes|territorio|nucleos|eixos|topicos|respostas|comentarios|sugestoes|pedidos|ouvidoria|correcoes|rascunhos|resumo_|recursos|site_|emails|erros_|contagens|assistente|denuncias|confirmacoes|entradas)/],
];
const areaDe = (tabela) => AREAS.find(([, re]) => re.test(tabela))?.[0] ?? "site e equipe";

/** Colunas uuid com estes nomes apontam para uma conta mesmo sem chave estrangeira (o banco evita chave para poder apagar a conta). */
const NOMES_DE_CONTA = /^(usuario|autor|autora|conta|dono|dona|quem|membro|pessoa|criado_por|criada_por|decidido_por|revisor|revisora|de|para|alvo_conta|convidado|convidou|aprovado_por|moderador|mediadora|responsavel|iniciado_por|enviado_por|lido_por|denunciante|seguidor|seguido|bloqueado|bloqueou)$/;

/**
 * O serviço de contas (Supabase Auth, esquema auth): o que ele grava e o que a Alumia faz com isso. Escrito à mão porque não está no
 * install.sql; conferido no install.sql (os gatilhos alumia_sem_endereco e alumia_agente_minimo e a faxina do autenticador).
 */
export const SERVICO_DE_CONTAS = [
  { tabela: "auth.users", guarda: "e-mail, resumo da senha (bcrypt), quando a conta foi criada, quando entrou pela última vez, quando confirmou o e-mail", prazo: "enquanto a conta existir", nota: "é a meta do item 3.2: a conta existe, quando foi criada e quando acessou pela última vez; o e-mail serve para entrar e para recuperar a senha" },
  { tabela: "auth.sessions", guarda: "cada sessão aberta: quando abriu, quando renovou, o nível do segundo fator e o navegador e o sistema (só o nome, sem versão)", prazo: "até a pessoa sair ou a sessão vencer", nota: "o endereço de rede (ip) é apagado antes de gravar (gatilho alumia_sem_endereco); o 'user agent' inteiro vira só o nome do navegador e do sistema (gatilho alumia_agente_minimo)" },
  { tabela: "auth.refresh_tokens", guarda: "o token que renova a sessão", prazo: "até a sessão acabar", nota: "não guarda endereço" },
  { tabela: "auth.mfa_factors", guarda: "o segredo do aplicativo autenticador de quem ligou o segundo fator", prazo: "até a pessoa tirar o aplicativo", nota: "" },
  { tabela: "auth.mfa_challenges", guarda: "o pedido de código do autenticador e o endereço de quem pediu", prazo: "o endereço é zerado depois de 15 minutos", nota: "o serviço de contas compara o endereço de quem pediu com o de quem responde; por isso ele fica uns minutos (interno.mfa_endereco_zerar)" },
  { tabela: "auth.audit_log_entries", guarda: "o registro de ações do serviço de contas (entrou, saiu, trocou a senha)", prazo: "30 dias", nota: "o endereço é apagado antes de gravar (gatilho alumia_sem_endereco)" },
  { tabela: "auth.identities", guarda: "a forma de entrar (e-mail)", prazo: "enquanto a conta existir", nota: "" },
  { tabela: "auth.one_time_tokens", guarda: "o resumo do código de confirmação ou de recuperação mandado por e-mail", prazo: "até ser usado ou vencer", nota: "" },
];

/** O comentário logo acima de cada "create table" (a primeira vez que a tabela aparece), no install.sql e nas migrações novas. */
function comentarios() {
  const fontes = [path.join(raiz, "supabase/install.sql")];
  for (const extra of (process.env.ALUMIA_BANCO_EXTRAS ?? "").split(",").map((x) => x.trim()).filter(Boolean)) fontes.push(path.isAbsolute(extra) ? extra : path.join(raiz, extra));
  const achado = new Map();
  for (const f of fontes) {
    const linhas = fs.readFileSync(f, "utf8").split(/\r?\n/);
    for (let i = 0; i < linhas.length; i++) {
      const m = /^create table (?:if not exists )?(?:interno\.)?([a-z0-9_]+)\s*\(/i.exec(linhas[i]);
      if (!m || achado.get(m[1])) continue;
      const acima = [];
      for (let j = i - 1; j >= 0 && /^\s*(--|\/\*\*|\*)/.test(linhas[j]) && !/^-- ─/.test(linhas[j]); j--) acima.unshift(linhas[j]);
      const texto = acima
        .map((l) => l.replace(/^\s*(--|\/\*\*|\*\/|\*)\s?/, "").trim())
        .filter((l) => l && l !== "*/")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      achado.set(m[1], texto.length > 400 ? `${texto.slice(0, 397).replace(/\s+\S*$/, "")}…` : texto);
    }
  }
  return achado;
}

/**
 * O prazo em que o banco apaga as linhas sozinho, em qualquer função: "delete from <tabela> where ... interval '<n> <unidade>'" e, nas
 * rotinas das caixas e dos passes (que contam em dias, sem interval), "delete from <tabela> where dia < v_hoje - <n>" e "... vence <
 * v_hoje" (auditoria interna da R3: a lista dizia que pacotes e passes não se apagavam sozinhos).
 */
function prazos(sqls) {
  const p = new Map();
  const por = (tabela, prazo) => p.set(tabela, new Set([...(p.get(tabela) ?? []), prazo]));
  for (const sql of sqls) {
    for (const m of sql.matchAll(/delete from (?:interno\.)?([a-z0-9_]+)\b[^;]{0,300}?interval '(\d+\s*[a-z]+)'/gi)) por(m[1], m[2].replace(/\s+/g, " "));
    for (const m of sql.matchAll(/delete from (?:interno\.)?([a-z0-9_]+)(?:\s+[a-z]\b)?\s+where\s+(?:[a-z]\.)?(dia|vence)\s*<\s*v_hoje(?:\s*-\s*(\d+))?\b/gi)) {
      const [, tabela, campo, n] = m;
      if (campo.toLowerCase() === "vence") por(tabela, "no vencimento");
      else por(tabela, Number(n ?? 0) <= 1 ? "1 day" : `${Number(n)} days`);
    }
  }
  return p;
}

/**
 * O que guardam as tabelas do chat e dos passes (R2), que a migração de origem criou sem o comentário acima do "create table". Vale só
 * quando não há comentário. Quem tem o banco inteiro é o leitor que estas frases têm em mente (auditoria interna da R3).
 */
export const DESCRICOES = {
  caixas: "As caixas anônimas do chat: o resumo do id da caixa e os resumos dos passes de depósito e de leitura, se é de vários leitores, o vencimento. Nenhuma conta. A caixa de PEDIDOS de cada conta é a única que se liga a uma conta (pelo diretório).",
  pacotes: "Os pacotes cifrados de tamanho fixo de cada caixa, com a ordem, o compromisso da franquia, a marca do servidor e o dia. Saem quando quem lê confirma; o que ninguém buscou sai em 30 dias. Na caixa de pedidos, quem tem o banco sabe quantos pedidos esperam leitura.",
  caixa_contagem: "Quantos depósitos cada caixa recebeu no dia (o teto por caixa). Não vale para a caixa de pedidos (essa não tem contagem por dia). Sai no dia seguinte.",
  passes_gastos: "Os resumos dos passes anônimos e dos desafios já gastos (para não valerem duas vezes), com o dia. Nenhuma conta.",
  passes_emitidos: "A marca do dia de quem pegou o lote de passes: HMAC de um segredo do servidor com a conta. O banco sozinho não liga a marca à conta; quem opera a rede, com o segredo, liga: sabe quem pegou passes (usou o chat) em cada dia. Sai no dia seguinte.",
  diretorio_contas: "A parte pública do chat de cada conta: a identidade, a chave e a caixa de pedidos, a chave do voto. Lida por qualquer um pelo codinome.",
  diretorio_aparelhos: "Os aparelhos do chat de cada conta: o certificado, a impressão Proteus, a chave X-Wing da semana e a semana em que entrou. Lidos por qualquer um pelo codinome.",
  diretorio_pre_chaves: "As pré-chaves Proteus de cada aparelho, entregues uma vez cada (sorteada) a quem começa conversa.",
  diretorio_pacotes_mls: "Os pacotes MLS de cada aparelho, entregues uma vez cada a quem põe a pessoa num grupo.",
  rede_kt: "O registro público de transparência das chaves (corrente de resumos): a linha de cada conta tem o resumo do id da conta e a identidade.",
};

export async function montarInventario() {
  const banco = await criarBanco();
  const { pg } = banco;
  const versao = (await pg.query("select public.rede_alumia_versao() as v").catch(() => ({ rows: [{ v: null }] }))).rows[0]?.v ?? null;
  const tabelas = (
    await pg.query(`
      select c.relname as tabela
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'interno' and c.relkind in ('r', 'p') and not c.relispartition
      order by 1`)
  ).rows.map((r) => r.tabela);
  const colunas = (
    await pg.query(`
      select table_name as tabela, column_name as coluna, case when data_type = 'ARRAY' then udt_name else data_type end as tipo
      from information_schema.columns where table_schema = 'interno' order by table_name, ordinal_position`)
  ).rows;
  // Chave estrangeira para uma conta: auth.users ou interno.perfis (o perfil tem o mesmo id da conta).
  const chaves = (
    await pg.query(`
      select cl.relname as tabela, a.attname as coluna
      from pg_constraint k
      join pg_class cl on cl.oid = k.conrelid join pg_namespace n on n.oid = cl.relnamespace
      join pg_class alvo on alvo.oid = k.confrelid join pg_namespace na on na.oid = alvo.relnamespace
      join lateral unnest(k.conkey) as u(num) on true
      join pg_attribute a on a.attrelid = k.conrelid and a.attnum = u.num
      where k.contype = 'f' and n.nspname = 'interno'
        and ((na.nspname = 'auth' and alvo.relname = 'users') or (na.nspname = 'interno' and alvo.relname = 'perfis'))`)
  ).rows;
  const sqls = [fs.readFileSync(path.join(raiz, "supabase/install.sql"), "utf8")];
  const funcoes = (await pg.query("select pg_get_functiondef(p.oid) as d from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('interno', 'public') and p.prokind = 'f'")).rows;
  sqls.push(funcoes.map((f) => f.d).join("\n"));
  const prazo = prazos(sqls);
  const coment = comentarios();
  await pg.close();

  const porTabela = new Map(tabelas.map((t) => [t, []]));
  for (const c of colunas) porTabela.get(c.tabela)?.push([c.coluna, c.tipo]);
  const contaPorChave = new Map();
  for (const k of chaves) contaPorChave.set(k.tabela, new Set([...(contaPorChave.get(k.tabela) ?? []), k.coluna]));

  const lista = tabelas.map((t) => {
    const cols = porTabela.get(t);
    const conta = new Set(contaPorChave.get(t) ?? []);
    for (const [nome, tipo] of cols) if (tipo === "uuid" && NOMES_DE_CONTA.test(nome)) conta.add(nome);
    return {
      tabela: `interno.${t}`,
      area: areaDe(t),
      o_que_e: coment.get(t) || DESCRICOES[t] || "",
      colunas: cols,
      aponta_para_conta: [...conta].sort(),
      apaga_sozinho: [...(prazo.get(t) ?? [])].sort(),
    };
  });
  return {
    sobre:
      "Tudo o que o banco do site guarda, tabela por tabela, tirado do banco montado com supabase/install.sql. Gerado por scripts/ferramentas/inventario-do-banco.mjs; não edite à mão.",
    versao_do_banco: versao,
    total: { tabelas: lista.length, colunas: lista.reduce((s, t) => s + t.colunas.length, 0), com_conta: lista.filter((t) => t.aponta_para_conta.length).length },
    servico_de_contas: SERVICO_DE_CONTAS,
    tabelas: lista,
  };
}

/** As diferenças entre a lista gravada e a do banco montado, em frases curtas (vazio: bate). */
export function diferencas(gravado, atual) {
  const d = [];
  const g = new Map((gravado?.tabelas ?? []).map((t) => [t.tabela, t]));
  const a = new Map(atual.tabelas.map((t) => [t.tabela, t]));
  for (const [nome, t] of a) {
    const antes = g.get(nome);
    if (!antes) {
      d.push(`tabela nova fora da lista: ${nome}`);
      if (!t.o_que_e) d.push(`tabela nova sem comentário acima do "create table" (diga o que ela guarda): ${nome}`);
      continue;
    }
    const cg = new Map(antes.colunas.map(([c, tipo]) => [c, tipo]));
    for (const [c, tipo] of t.colunas) {
      if (!cg.has(c)) d.push(`coluna nova fora da lista: ${nome}.${c}`);
      else if (cg.get(c) !== tipo) d.push(`coluna mudou de tipo: ${nome}.${c} (${cg.get(c)} → ${tipo})`);
    }
    for (const c of cg.keys()) if (!t.colunas.some(([x]) => x === c)) d.push(`coluna que saiu do banco e continua na lista: ${nome}.${c}`);
    for (const campo of ["area", "o_que_e", "aponta_para_conta", "apaga_sozinho"]) {
      if (JSON.stringify(antes[campo]) !== JSON.stringify(t[campo])) d.push(`${campo} mudou: ${nome}`);
    }
  }
  for (const nome of g.keys()) if (!a.has(nome)) d.push(`tabela que saiu do banco e continua na lista: ${nome}`);
  if (JSON.stringify(gravado?.servico_de_contas) !== JSON.stringify(atual.servico_de_contas)) d.push("a parte do serviço de contas mudou");
  if (gravado?.versao_do_banco !== atual.versao_do_banco) d.push(`versão do banco: ${gravado?.versao_do_banco} → ${atual.versao_do_banco}`);
  return d;
}

const direto = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (direto) {
  const atual = await montarInventario();
  if (process.argv.includes("--conferir")) {
    const gravado = fs.existsSync(ARQUIVO) ? JSON.parse(fs.readFileSync(ARQUIVO, "utf8")) : null;
    const d = diferencas(gravado, atual);
    if (d.length) {
      console.error(`A lista do que o servidor guarda não bate com o banco (${d.length}):\n  ${d.slice(0, 60).join("\n  ")}`);
      console.error("Rode node scripts/ferramentas/inventario-do-banco.mjs e confira o que entrou.");
      process.exit(1);
    }
    console.log(`A lista bate com o banco: ${atual.total.tabelas} tabelas, ${atual.total.colunas} colunas.`);
  } else {
    fs.mkdirSync(path.dirname(ARQUIVO), { recursive: true });
    fs.writeFileSync(ARQUIVO, `${JSON.stringify(atual, null, 1)}\n`);
    console.log(`Gravado: ${path.relative(raiz, ARQUIVO)} (${atual.total.tabelas} tabelas, ${atual.total.colunas} colunas, ${atual.total.com_conta} com conta).`);
  }
  process.exit(0);
}
