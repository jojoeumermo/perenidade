// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Testes de fumaça: os fluxos críticos, pedidos do jeito que o navegador pede, para saber que nada quebrou.
//
//   npm run testar:fumaca                               contas, cargos, painel e comunidade, no banco de teste em memória
//   npm run testar:fumaca -- http://localhost:3000      também as páginas do site que estiver rodando nesse endereço
//
// Nada aqui toca o banco de verdade: as contas e os dados são os de scripts/backend-local.mjs.
import net from "node:net";

// Uma porta livre, para não esbarrar num npm run dev:local que esteja rodando na mesma máquina.
process.env.PORTA_BANCO ??= String(
  await new Promise((resolve) => {
    const sonda = net.createServer().listen(0, "127.0.0.1", () => {
      const { port } = sonda.address();
      sonda.close(() => resolve(port));
    });
  }),
);
const { CHAVE_ANON, URL_LOCAL, iniciar } = await import("./backend-local.mjs");

const site = (process.argv[2] ?? "").replace(/\/$/, "");
let certos = 0;
const falhas = [];

async function confere(nome, tarefa) {
  try {
    const motivo = await tarefa();
    if (motivo) throw new Error(motivo);
    certos++;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
  }
}

// ───────────────────────────── Banco e contas, pelo mesmo caminho do navegador ─────────────────────────────

const { servidor } = await iniciar({ silencioso: true });

async function pedir(caminho, { metodo = "POST", token = CHAVE_ANON, corpo } = {}) {
  const resposta = await fetch(`${URL_LOCAL}${caminho}`, {
    method: metodo,
    headers: { apikey: CHAVE_ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await resposta.text();
  let dados = null;
  try {
    dados = texto ? JSON.parse(texto) : null;
  } catch {
    dados = texto;
  }
  return { status: resposta.status, dados };
}

/** Recusa por falta de permissão. Outro erro (função ou argumento com nome errado) não conta como recusa. */
const negado = (r) => !r.ok && /^(sem_permissao|entre_primeiro)$/.test(r.codigo);

/** Chama uma função do banco. Devolve { ok, dados } ou { ok: false, codigo }. */
async function chamar(token, funcao, argumentos = {}) {
  const { status, dados } = await pedir(`/rest/v1/rpc/${funcao}`, { token, corpo: argumentos });
  return status === 200 ? { ok: true, dados } : { ok: false, codigo: String(dados?.message ?? status) };
}

async function entrar(conta) {
  const { status, dados } = await pedir("/auth/v1/token?grant_type=password", { token: CHAVE_ANON, corpo: { email: `${conta}@local`, password: "qualquer-uma" } });
  if (status !== 200 || !dados?.access_token) throw new Error(`não entrou como ${conta} (${status})`);
  return dados.access_token;
}

/** Cadastra o aplicativo autenticador de mentira e confirma o código: devolve a sessão confirmada (aal2). */
async function segundoFator(token) {
  const fator = await pedir("/auth/v1/factors", { token, corpo: { factor_type: "totp", friendly_name: "fumaça" } });
  await pedir(`/auth/v1/factors/${fator.dados.id}/challenge`, { token, corpo: {} });
  const confirmado = await pedir(`/auth/v1/factors/${fator.dados.id}/verify`, { token, corpo: { code: "123456" } });
  if (confirmado.status !== 200) throw new Error(`segundo fator recusado (${confirmado.status})`);
  return confirmado.dados.access_token;
}

const contas = ["coord", "vice", "super", "curadora", "prof", "mentora", "designer", "jornal", "revisor", "mediador", "leitora"];
const comFator = new Set(["coord", "vice", "super", "curadora", "mediador"]);
const sessao = {};

// Entrada e saída
for (const conta of contas) {
  await confere(`${conta} entra com e-mail e senha`, async () => {
    sessao[conta] = await entrar(conta);
  });
}
await confere("conta que não existe não entra", async () => {
  const { status } = await pedir("/auth/v1/token?grant_type=password", { corpo: { email: "ninguem@local", password: "x" } });
  return status === 400 ? "" : `esperava 400, veio ${status}`;
});
await confere("visitante sem conta: eu() é vazio", async () => {
  const r = await chamar(CHAVE_ANON, "eu");
  return r.ok && r.dados === null ? "" : JSON.stringify(r);
});
await confere("leitora: eu() traz o nome e nenhuma função", async () => {
  const r = await chamar(sessao.leitora, "eu");
  return r.ok && r.dados?.nome === "Lia Leitora" && r.dados.papeis.length === 0 && r.dados.nivel === 0 ? "" : JSON.stringify(r).slice(0, 200);
});
await confere("jornal: eu() traz as duas funções, jornalismo e tradução", async () => {
  const r = await chamar(sessao.jornal, "eu");
  return r.ok && r.dados.papeis.map((p) => p.papel).sort().join() === "jornalismo,traducao" && r.dados.nivel === 1 ? "" : JSON.stringify(r).slice(0, 200);
});
await confere("saída responde", async () => {
  const { status } = await pedir("/auth/v1/logout", { token: sessao.leitora });
  return status === 204 ? "" : `esperava 204, veio ${status}`;
});

// Cadastro aberto (o padrão) e cadastro fechado pela coordenação
await confere("cadastro aberto: conta nova sem convite é criada, sem função", async () => {
  const { status, dados } = await pedir("/auth/v1/signup", { corpo: { email: "nova@local", password: "senha-longa-de-teste" } });
  if (status !== 200) return `cadastro recusado (${status})`;
  const eu = await chamar(dados.access_token, "eu");
  return eu.ok && eu.dados.papeis.length === 0 ? "" : JSON.stringify(eu);
});

// Segundo fator: as funções com poder de decisão só valem em sessão confirmada
await confere("coordenação sem o código do aplicativo não abre a lista de voluntários", async () => {
  const r = await chamar(sessao.coord, "voluntarios_listar");
  return negado(r) ? "" : r.ok ? "abriu sem segundo fator" : r.codigo;
});
for (const conta of comFator) {
  await confere(`${conta} confirma o segundo fator`, async () => {
    sessao[conta] = await segundoFator(sessao[conta]);
  });
}
await confere("coordenação com o código abre a lista de voluntários", async () => {
  const r = await chamar(sessao.coord, "voluntarios_listar");
  return r.ok ? "" : r.codigo;
});

// Quem abre cada seção do painel: a mesma regra de components/painel/Painel.tsx, conferida no banco.
const equipe = contas.filter((conta) => conta !== "leitora");
const secoes = [
  ["painel_resumo", contas],
  ["equipe_canais", equipe],
  ["chat_conversas", equipe],
  ["equipe_membros", equipe],
  ["fila", equipe],
  ["triagem_fila", ["coord", "vice", "curadora", "mediador"]],
  ["comunidade_retidos", ["coord", "vice", "curadora", "prof", "mediador"]],
  ["anotacoes_fila", ["coord", "vice", "curadora", "prof", "mediador"]],
  ["banimentos_listar", ["coord", "vice", "curadora", "mediador"]],
  ["denuncias_listar", ["coord", "vice", "curadora"]],
  ["filtro_listar", ["coord", "vice", "curadora"]],
  ["reforco_fila", ["coord", "vice", "curadora", "prof", "mentora"]],
  ["mural_fila", ["coord", "vice", "mediador"]],
  ["boletim_listar", ["coord", "vice", "jornal"]],
  ["voluntarios_listar", ["coord", "vice", "super"]],
  ["papeis_historico_listar", ["coord", "vice"]],
  ["convites_listar", ["coord", "vice"]],
  ["inscricoes_listar", ["coord", "vice"]],
  ["seguranca_ver", ["coord", "vice"]],
  ["sucessao_ver", ["coord", "vice"]],
  ["auditoria_listar", ["coord", "vice"]],
  ["audit_logs_listar", ["coord", "vice"]],
  ["horas_fila", ["coord", "vice"]],
  ["emails_situacao", ["coord", "vice"]],
  ["comunidade_controles", ["coord", "vice"]],
];
for (const [funcao, podem] of secoes) {
  await confere(`painel: ${funcao} abre só para ${podem.length === contas.length ? "todas as contas" : podem.join(", ")}`, async () => {
    const erradas = [];
    for (const conta of contas) {
      const r = await chamar(sessao[conta], funcao);
      if (podem.includes(conta) ? !r.ok : !negado(r)) erradas.push(`${conta} ${r.ok ? "abriu" : `foi barrado (${r.codigo})`}`);
    }
    const anonimo = await chamar(CHAVE_ANON, funcao);
    if (!negado(anonimo)) erradas.push(`visitante sem conta: ${anonimo.ok ? "abriu" : anonimo.codigo}`);
    return erradas.join("; ");
  });
}

// Escalada de privilégio: ninguém dá a si mesmo o que não tem
const { ids } = await (async () => {
  const eu = async (conta) => (await chamar(sessao[conta], "eu")).dados.id;
  return { ids: Object.fromEntries(await Promise.all(contas.map(async (conta) => [conta, await eu(conta)]))) };
})();
const barrado = (nome, conta, funcao, argumentos) =>
  confere(nome, async () => {
    const r = await chamar(conta ? sessao[conta] : CHAVE_ANON, funcao, argumentos);
    return negado(r) ? "" : r.ok ? `passou: ${JSON.stringify(r.dados).slice(0, 120)}` : r.codigo;
  });
await barrado("leitora não se torna coordenação", "leitora", "papel_conceder", { p_usuario: ids.leitora, p_papel: "coordenacao", p_disciplina: null });
await barrado("educador não dá função a ninguém", "prof", "papel_conceder", { p_usuario: ids.leitora, p_papel: "curadoria", p_disciplina: null });
await barrado("mediação não dá função a ninguém", "mediador", "papel_conceder", { p_usuario: ids.mediador, p_papel: "vice", p_disciplina: null });
await barrado("vice não passa a coordenação", "vice", "lideranca_passar", { p_usuario: ids.vice });
await barrado("supervisão não dá função a quem está acima dela", "super", "papel_conceder", { p_usuario: ids.vice, p_papel: "revisao", p_disciplina: null });
await barrado("supervisão não confia curadoria", "super", "papel_conceder", { p_usuario: ids.leitora, p_papel: "curadoria", p_disciplina: null });
await confere("supervisão confia um papel de trabalho, que se soma aos que a pessoa já tem", async () => {
  const r = await chamar(sessao.super, "papel_conceder", { p_usuario: ids.jornal, p_papel: "revisao", p_disciplina: null });
  if (!r.ok) return r.codigo;
  const eu = await chamar(sessao.jornal, "eu");
  const fila = await chamar(sessao.jornal, "fila");
  return eu.ok && eu.dados.papeis.length === 3 && fila.ok ? "" : JSON.stringify({ eu: eu.dados?.papeis, fila: fila.ok }).slice(0, 200);
});
await confere("supervisão lista a equipe sem e-mail de ninguém", async () => {
  const r = await chamar(sessao.super, "voluntarios_listar");
  return r.ok && !JSON.stringify(r.dados).includes("@") ? "" : JSON.stringify(r).slice(0, 200);
});
await barrado("leitora não mexe nos controles do site", "leitora", "site_salvar", { p: { pausa: true } });
await barrado("jornalismo não suspende ninguém", "jornal", "usuario_suspender", { p_usuario: ids.leitora, p_suspenso: true });
await barrado("visitante não lê o registro de atividades", null, "auditoria_listar", {});

// Comunidade: escrever, ler, responder, denunciar e mediar
let topico = null;
await confere("leitora abre uma conversa na comunidade", async () => {
  const r = await chamar(sessao.leitora, "topico_criar", { p_titulo: "Como estudar frações", p_corpo: "Alguém tem uma dica para quem está começando a estudar frações?", p_disciplina: "matematica", p_tipo: "duvida" });
  if (!r.ok) return r.codigo;
  topico = r.dados;
  return r.dados.retido || r.dados.bloqueado ? `não foi ao ar: ${JSON.stringify(r.dados)}` : "";
});
await confere("visitante sem conta lê a conversa", async () => {
  const lista = await chamar(CHAVE_ANON, "topicos_listar", {});
  const aberto = await chamar(CHAVE_ANON, "topico_ver", { p_id: topico?.id });
  return lista.ok && lista.dados.some?.((t) => t.id === topico?.id) && aberto.ok ? "" : JSON.stringify({ lista: lista.ok, aberto }).slice(0, 200);
});
await confere("visitante sem conta não escreve", async () => {
  const r = await chamar(CHAVE_ANON, "topico_criar", { p_titulo: "Sem conta", p_corpo: "Tentando escrever sem conta nenhuma aqui.", p_disciplina: null });
  return negado(r) ? "" : r.ok ? "escreveu sem conta" : r.codigo;
});
await confere("revisor responde a conversa", async () => {
  const r = await chamar(sessao.revisor, "responder", { p_topico: topico?.id, p_corpo: "Comece pelas frações de pizza: metade, um terço, um quarto." });
  return r.ok ? "" : r.codigo;
});
await confere("mensagem com endereço de site fica retida para a mediação", async () => {
  const r = await chamar(sessao.leitora, "topico_criar", { p_titulo: "Material bom", p_corpo: "Vejam este material em https://exemplo.com.br/apostila agora mesmo.", p_disciplina: null });
  if (!r.ok) return r.codigo;
  if (!r.dados.retido) return `não ficou retida: ${JSON.stringify(r.dados)}`;
  const fila = await chamar(sessao.mediador, "comunidade_retidos");
  return fila.ok && JSON.stringify(fila.dados).includes(r.dados.id) ? "" : "não apareceu na fila da mediação";
});
await confere("visitante denuncia uma mensagem", async () => {
  const r = await chamar(CHAVE_ANON, "denunciar", { p_alvo: `/pt/comunidade?t=${topico?.id}`, p_motivo: "ofensa", p_detalhes: "Teste de fumaça: denúncia com detalhes suficientes." });
  return r.ok ? "" : r.codigo;
});
await barrado("leitora não oculta mensagem alheia", "leitora", "comunidade_cuidar", { p_tipo: "topico", p_alvo: topico?.id, p_acao: "ocultar" });
await confere("mediação oculta e mostra de novo uma mensagem", async () => {
  const ocultar = await chamar(sessao.mediador, "comunidade_cuidar", { p_tipo: "topico", p_alvo: topico?.id, p_acao: "ocultar" });
  const mostrar = await chamar(sessao.mediador, "comunidade_cuidar", { p_tipo: "topico", p_alvo: topico?.id, p_acao: "mostrar" });
  return ocultar.ok && mostrar.ok ? "" : `${ocultar.codigo ?? ""} ${mostrar.codigo ?? ""}`;
});

// Escrever e revisar: o envio do educador chega à curadoria, não à mediação
await confere("educador envia uma aula e a curadoria a vê na fila", async () => {
  const fonte = [{ titulo: "Matemática básica", autor: "Fulano", ano: "2020", url: "https://pt.wikipedia.org/wiki/Fra%C3%A7%C3%A3o" }];
  const envio = await chamar(sessao.prof, "contribuir", { p: { tipo: "aula", disciplina: "matematica", titulo: "Frações equivalentes", corpo: "Texto da aula com mais de vinte caracteres.", dados: { trilha: "matematica-fundamental", resumo: "Frações que valem o mesmo." }, fontes: fonte } });
  if (!envio.ok) return envio.codigo;
  const curadoria = await chamar(sessao.curadora, "fila");
  const mediacao = await chamar(sessao.mediador, "fila");
  if (!curadoria.ok || !curadoria.dados.some((c) => c.id === envio.dados.id)) return "não chegou à curadoria";
  return mediacao.ok && mediacao.dados.some((c) => c.id === envio.dados.id) ? "a mediação viu a fila de revisão" : "";
});

// O que o público lê sem conta
for (const funcao of ["site", "abertura", "mural_listar", "apoiadores_listar", "radio_estado", "materiais_listar", "mural_cidades"]) {
  await confere(`visitante lê ${funcao}`, async () => {
    const r = await chamar(CHAVE_ANON, funcao);
    return r.ok ? "" : r.codigo;
  });
}

servidor.close();

// ───────────────────────────── Páginas do site (só com um endereço) ─────────────────────────────

if (site) {
  const abrir = (caminho, opcoes = {}) => fetch(`${site}${caminho}`, { redirect: "manual", signal: AbortSignal.timeout(180_000), ...opcoes });

  const paginas = [
    ["/pt", "Instituto Lúcia"],
    ["/pt/acervo", "<h1"],
    ["/pt/busca", "<h1"],
    ["/pt/trilhas", "<h1"],
    ["/pt/comunidade", "<h1"],
    ["/pt/entrar", "<html"],
    ["/pt/painel", "<html"],
    ["/pt/noticias", "<h1"],
    ["/pt/radio", "<h1"],
    ["/pt/glossario", "<h1"],
    ["/pt/mural", "<h1"],
    ["/pt/jornal", "Giro de notícias"],
    ["/pt/memorial", "<h1"],
    ["/pt/ferramentas", "<h1"],
    ["/pt/contribuir", "<h1"],
    ["/pt/denunciar", "<h1"],
    ["/pt/voluntarios", "<h1"],
    ["/pt/historico", "<h1"],
    ["/pt/privacidade", "<h1"],
    ["/en", "<html"],
    ["/robots.txt", "User-Agent"],
    ["/sitemap.xml", "<urlset"],
    ["/manifest.webmanifest", "Instituto"],
    ["/.well-known/assetlinks.json", "org.institutolucia.app"],
  ];
  for (const [caminho, marca] of paginas) {
    await confere(`página ${caminho}`, async () => {
      const resposta = await abrir(caminho);
      const corpo = await resposta.text();
      if (resposta.status !== 200) return `status ${resposta.status}`;
      return corpo.includes(marca) ? "" : `não achei "${marca}"`;
    });
  }

  // Uma obra e uma aula de verdade, tiradas do índice de busca
  let indice = [];
  await confere("índice de busca tem obras e aulas", async () => {
    const resposta = await abrir("/pt/indice.json");
    indice = await resposta.json();
    const obras = indice.filter((item) => item.kind === "obra").length;
    const aulas = indice.filter((item) => item.kind === "aula").length;
    return obras >= 800 && aulas >= 100 ? "" : `${obras} obras, ${aulas} aulas`;
  });
  for (const tipo of ["obra", "aula", "trilha"]) {
    await confere(`abre uma ${tipo} do índice`, async () => {
      const item = indice.find((entrada) => entrada.kind === tipo);
      if (!item) return "nenhuma no índice";
      const resposta = await abrir(`/pt${item.href}`);
      return resposta.status === 200 && (await resposta.text()).includes("<h1") ? "" : `status ${resposta.status} em ${item.href}`;
    });
  }
  await confere("aula em texto puro", async () => {
    const aula = indice.find((entrada) => entrada.kind === "aula");
    const resposta = await abrir(`/pt${aula?.href}/texto`);
    return resposta.status === 200 && (resposta.headers.get("content-type") ?? "").startsWith("text/plain") ? "" : `status ${resposta.status}`;
  });
  await confere("catálogo ampliado", async () => {
    const resposta = await abrir("/pt/catalogo/todos");
    const lista = await resposta.json();
    return Array.isArray(lista) && lista.length > 0 ? "" : "vazio";
  });

  // Endereços sem idioma, iscas e o que não existe
  await confere("endereço sem idioma vai para o português", async () => {
    const resposta = await abrir("/acervo");
    return resposta.status >= 300 && resposta.status < 400 && (resposta.headers.get("location") ?? "").endsWith("/pt/acervo") ? "" : `status ${resposta.status} → ${resposta.headers.get("location")}`;
  });
  for (const isca of ["/wp-admin", "/.env", "/phpmyadmin/index.php", "/backup.sql"]) {
    await confere(`isca ${isca} responde 404`, async () => {
      const resposta = await abrir(isca);
      return resposta.status === 404 ? "" : `status ${resposta.status}`;
    });
  }
  await confere("página que não existe responde 404", async () => {
    const resposta = await abrir("/pt/acervo/obra-que-nao-existe-de-jeito-nenhum");
    return resposta.status === 404 ? "" : `status ${resposta.status}`;
  });

  // O histórico público diz só que tipo de conteúdo mudou e quando: nada da mensagem interna, do autor ou do código do registro.
  for (const caminho of ["/pt/historico", "/pt"]) {
    await confere(`histórico público sem dados internos em ${caminho}`, async () => {
      const resposta = await abrir(caminho);
      const html = await resposta.text();
      const registros = (await import("node:child_process"))
        .execFileSync("git", ["log", "-n", "40", "--format=%h%x1f%an%x1f%s", "--", "content"], { encoding: "utf8" })
        .split("\n")
        .filter(Boolean)
        .map((linha) => linha.split("\x1f"));
      // O código do registro só conta entre aspas (é assim que ele entrava na página, como chave de lista).
      const vazou = [
        ...registros.map(([codigo]) => codigo).filter((codigo) => html.includes(`"${codigo}"`) || html.includes(`\\"${codigo}\\"`)),
        ...registros.flatMap(([, autor, assunto]) => [autor, assunto]).filter((texto) => texto.length >= 7 && (html.includes(texto) || html.includes(texto.replace(/'/g, "&#x27;")))),
      ];
      if (/Merge branch/.test(html)) vazou.push("Merge branch");
      return vazou.length ? `aparece: ${[...new Set(vazou)].slice(0, 3).join(" | ")}` : "";
    });
  }

  // Cabeçalhos de segurança
  await confere("cabeçalhos de segurança na página inicial", async () => {
    const resposta = await abrir("/pt");
    const faltam = ["content-security-policy", "x-frame-options", "x-content-type-options", "referrer-policy", "permissions-policy", "strict-transport-security"].filter((nome) => !resposta.headers.get(nome));
    if (/frame-ancestors 'none'/.test(resposta.headers.get("content-security-policy") ?? "") === false) faltam.push("frame-ancestors");
    return faltam.length ? `faltam: ${faltam.join(", ")}` : "";
  });
  await confere("painel e entrada não ficam guardados em intermediários", async () => {
    const resposta = await abrir("/pt/painel");
    return /no-store/.test(resposta.headers.get("cache-control") ?? "") ? "" : resposta.headers.get("cache-control") ?? "sem cache-control";
  });
}

console.log(`${certos} conferências certas, ${falhas.length} com problema.${site ? "" : " (Páginas não conferidas: passe o endereço do site.)"}`);
for (const falha of falhas) console.log(`  ✗ ${falha}`);
process.exit(falhas.length ? 1 : 0);
