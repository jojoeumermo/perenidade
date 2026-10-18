// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Leva para o acervo o que a coordenação aprovou no painel.
//
// O site publicado não lê o banco de dados: ele é montado a partir dos arquivos de content/.
// Este roteiro é a única ponte entre os dois. Ele busca as contribuições aprovadas, confere cada
// campo de novo (o banco nunca é tratado como confiável) e grava um arquivo de texto por item.
// Como tudo vira arquivo com histórico, qualquer publicação indevida se desfaz voltando uma versão.
//
//   node scripts/sincronizar.mjs            grava os arquivos e anota os itens em .publicados.json
//   node scripts/sincronizar.mjs --marcar   avisa o banco de que os itens anotados já foram publicados
//
// Variáveis: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (esta última nunca vai para o site).
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lerCabecalho, montarArquivo } from "./cabecalho.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const conteudo = path.join(raiz, "content");
const anotacao = path.join(raiz, ".publicados.json");
const pastaDeArquivos = path.join(raiz, "public", "arquivos");
const tipos = JSON.parse(fs.readFileSync(path.join(raiz, "lib/tipos.json"), "utf8"));
const base = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const LIMITE = 25; // por rodada: uma enxurrada de itens é sinal de problema, não de trabalho normal

const DISCIPLINAS = new Set(
  [...fs.readFileSync(path.join(raiz, "lib/areas.ts"), "utf8").matchAll(/areas: \[([^\]]+)\]/g)].flatMap((grupo) => [...grupo[1].matchAll(/"([a-z-]+)"/g)].map((m) => m[1])),
);
const LICENCAS = ["Domínio público", "CC BY", "CC BY-SA", "CC BY-NC", "CC BY-NC-SA", "CC BY-NC-ND", "Conforme a fonte", "Direitos reservados"];
const IDIOMAS = ["en", "es", "zh", "ru"];
const FORMATOS = tipos.avulso.campos.find((campo) => campo.nome === "formato").opcoes;

async function chamar(funcao, argumentos = {}) {
  const resposta = await fetch(`${base}/rest/v1/rpc/${funcao}`, {
    method: "POST",
    headers: { apikey: chave, Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify(argumentos),
    signal: AbortSignal.timeout(30_000),
  });
  if (!resposta.ok) throw new Error(`${funcao}: HTTP ${resposta.status} ${(await resposta.text()).slice(0, 200)}`);
  return resposta.json();
}

// ───────────── Conferência dos campos ─────────────

class Recusa extends Error {}
const recusar = (motivo) => {
  throw new Recusa(motivo);
};

/** Texto de uma linha, sem caracteres de controle. */
function linha(valor, nome, { max = 300, obrigatorio = true } = {}) {
  const texto = String(valor ?? "").replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, " ").replace(/\s+/g, " ").trim();
  if (!texto && obrigatorio) recusar(`falta "${nome}"`);
  if (texto.length > max) recusar(`"${nome}" passou de ${max} caracteres`);
  return texto;
}

/** Texto longo (Markdown): só tira caracteres de controle. O site não aceita HTML dentro do Markdown. */
function corpo(valor, minimo = 0) {
  const texto = String(valor ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  if (texto.length < minimo) recusar(`texto com menos de ${minimo} caracteres`);
  if (texto.length > 60_000) recusar("texto grande demais");
  return texto;
}

function endereco(valor, nome) {
  const url = linha(valor, nome, { max: 500 });
  if (!/^https:\/\/[^\s<>"']+$/.test(url)) recusar(`"${nome}" precisa ser um endereço https`);
  if (/\.pdf($|\?)/i.test(url)) recusar(`"${nome}" aponta para um PDF; o acervo só indica a página da obra`);
  return url;
}

function fontes(lista, obrigatoria) {
  const itens = (Array.isArray(lista) ? lista : []).slice(0, 12).map((item) => {
    const fonte = { titulo: linha(item?.titulo, "fonte", { max: 300 }) };
    const autor = linha(item?.autor, "autor da fonte", { max: 200, obrigatorio: false });
    const ano = linha(item?.ano, "ano da fonte", { max: 20, obrigatorio: false });
    const url = linha(item?.url, "endereço da fonte", { max: 500, obrigatorio: false });
    if (autor) fonte.autor = autor;
    if (ano) fonte.ano = ano;
    if (url) {
      if (!/^https?:\/\/[^\s<>"']+$/.test(url)) recusar("endereço de fonte inválido");
      fonte.url = url;
    }
    return fonte;
  });
  if (obrigatoria && itens.length === 0) recusar("sem fonte");
  return itens;
}

function slug(texto) {
  const limpo = String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70).replace(/-+$/, "");
  return limpo.length >= 2 ? limpo : "";
}

/** Caminho dentro de content/, com a garantia de que não escapa da pasta. */
function destino(pasta, nome, extensao = ".md") {
  if (!/^[a-z0-9-]+(\/[a-z0-9-]+)?$/.test(pasta) || !/^[a-z0-9._-]+$/.test(nome) || nome.includes("..")) recusar("caminho inválido");
  const arquivo = path.join(conteudo, pasta, nome + extensao);
  if (!arquivo.startsWith(conteudo + path.sep)) recusar("caminho fora de content/");
  return arquivo;
}

/** Nunca sobrescreve: se o nome já existe, acrescenta -2, -3… */
function livre(pasta, nome) {
  let tentativa = nome;
  for (let n = 2; fs.existsSync(destino(pasta, tentativa)); n++) tentativa = `${nome}-${n}`;
  return destino(pasta, tentativa);
}

/** As questões de fim de aula que o painel manda em dados.quiz: pergunta, de duas a seis alternativas, a certa e a explicação. */
function questoes(lista) {
  if (!Array.isArray(lista)) return [];
  return lista.slice(0, 10).flatMap((q) => {
    const pergunta = linha(q?.pergunta, "pergunta", { max: 300, obrigatorio: false });
    const opcoes = (Array.isArray(q?.opcoes) ? q.opcoes : []).map((o) => linha(o, "alternativa", { max: 300, obrigatorio: false })).filter(Boolean);
    const resposta = Number(q?.resposta);
    if (!pergunta || opcoes.length < 2 || opcoes.length > 6 || !Number.isInteger(resposta) || resposta < 0 || resposta >= opcoes.length) return [];
    const explicacao = linha(q?.explicacao, "explicação", { max: 500, obrigatorio: false });
    return [{ pergunta, opcoes, resposta, ...(explicacao ? { explicacao } : {}) }];
  });
}

const data = (texto) => (/^\d{4}-\d{2}-\d{2}/.test(String(texto)) ? String(texto).slice(0, 10) : new Date().toISOString().slice(0, 10));
const assinatura = (item) => linha(item.nome_autor, "nome", { max: 80, obrigatorio: false }) || "Colaboração voluntária";

// ───────────── Imagens e arquivos enviados pela equipe ─────────────

const sha256 = (dados) => crypto.createHash("sha256").update(dados).digest("hex");

/** O arquivo é mesmo do tipo que diz ser? Confere pelos primeiros bytes, não pelo nome. */
const assinaturas = {
  webp: (b) => b.length > 16 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP",
  jpg: (b) => b.length > 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  pdf: (b) => b.toString("latin1", 0, 5) === "%PDF-",
};

/** Blocos de dados embutidos em uma imagem (local da foto, aparelho, autor, programa de edição). */
function temDadosEmbutidos(dados, extensao) {
  if (extensao === "webp") {
    for (let i = 12; i + 8 <= dados.length; ) {
      const bloco = dados.toString("latin1", i, i + 4);
      if (bloco === "EXIF" || bloco === "XMP ") return true;
      const tamanho = dados.readUInt32LE(i + 4);
      i += 8 + tamanho + (tamanho % 2);
    }
    return false;
  }
  // JPEG: percorre os segmentos até o começo da imagem; APP1 é onde moram Exif e XMP.
  for (let i = 2; i + 4 <= dados.length && dados[i] === 0xff; ) {
    const marca = dados[i + 1];
    if (marca === 0xda) break;
    if (marca === 0xe1 || marca === 0xed) return true;
    i += 2 + dados.readUInt16BE(i + 2);
  }
  return false;
}

/** Regrava o PDF sem autor, programa, datas nem histórico de edição. Precisa de exiftool e qpdf na máquina. */
function limparPdf(dados) {
  const temporario = path.join(os.tmpdir(), `lucia-${crypto.randomUUID()}.pdf`);
  fs.writeFileSync(temporario, dados);
  try {
    execFileSync("exiftool", ["-all:all=", "-overwrite_original", "-q", temporario], { stdio: "pipe" });
    // O exiftool só risca os dados; é regravar o arquivo que de fato os apaga.
    execFileSync("qpdf", ["--object-streams=disable", "--linearize", "--replace-input", temporario], { stdio: "pipe" });
    return fs.readFileSync(temporario);
  } catch {
    return recusar("não foi possível limpar o PDF (esta máquina precisa das ferramentas exiftool e qpdf)");
  } finally {
    for (const resto of [temporario, `${temporario}.~qpdf-orig`, `${temporario}_original`]) fs.rmSync(resto, { force: true });
  }
}

let bloqueados = null;

/**
 * Busca um arquivo do depósito fechado, confere e grava em public/arquivos. O nome final vem do próprio
 * conteúdo: o mesmo arquivo sempre cai no mesmo endereço, e ninguém troca um arquivo já publicado.
 */
async function publicarArquivo(caminho) {
  const extensao = /^[0-9a-f-]{36}\/[a-z0-9-]{8,60}\.(webp|jpg|pdf)$/.exec(String(caminho))?.[1];
  if (!extensao) recusar("caminho de arquivo inválido");
  const resposta = await fetch(`${base}/storage/v1/object/envios/${caminho}`, { headers: { apikey: chave, Authorization: `Bearer ${chave}` }, signal: AbortSignal.timeout(60_000) });
  if (!resposta.ok) recusar(`arquivo não encontrado no depósito (${caminho})`);
  let dados = Buffer.from(await resposta.arrayBuffer());
  if (dados.length === 0 || dados.length > 8 * 1024 * 1024) recusar("arquivo vazio ou maior que 8 MB");
  if (!assinaturas[extensao](dados)) recusar("o conteúdo do arquivo não é do tipo que o nome diz");
  bloqueados ??= new Set(await chamar("arquivos_bloqueados"));
  if (bloqueados.has(sha256(dados))) recusar("arquivo bloqueado pela curadoria");
  if (extensao === "pdf") {
    dados = limparPdf(dados);
    if (/\/(JavaScript|JS|Launch|EmbeddedFile|RichMedia)\b/.test(dados.toString("latin1"))) recusar("PDF com programa, anexo ou ação automática embutida");
  } else if (temDadosEmbutidos(dados, extensao)) {
    recusar("imagem com dados embutidos (local, aparelho ou autor): envie de novo pelo painel, que limpa o arquivo");
  }
  const nome = `${sha256(dados).slice(0, 20)}.${extensao}`;
  fs.mkdirSync(pastaDeArquivos, { recursive: true });
  fs.writeFileSync(path.join(pastaDeArquivos, nome), dados);
  return `/arquivos/${nome}`;
}

/** Troca, no texto de uma contribuição, cada imagem enviada pelo endereço dela dentro do site. */
async function trazerImagens(texto, usados) {
  const caminhos = [...new Set([...texto.matchAll(/envio:([0-9a-f-]{36}\/[a-z0-9-]{8,60}\.(?:webp|jpg))/g)].map((achado) => achado[1]))];
  if (caminhos.length > 12) recusar("imagens demais em um texto só (o limite é 12)");
  let saida = texto;
  for (const caminho of caminhos) {
    saida = saida.replaceAll(`envio:${caminho}`, await publicarArquivo(caminho));
    usados.push(caminho);
  }
  return saida;
}

// ───────────── Um arquivo por tipo de contribuição ─────────────

const montar = {
  aula(item) {
    const trilha = linha(item.dados?.trilha, "trilha", { max: 80 });
    if (!/^[a-z0-9-]{2,80}$/.test(trilha) || !fs.existsSync(path.join(conteudo, "trilhas", trilha, "_trilha.md"))) recusar("trilha desconhecida");
    const titulo = linha(item.titulo, "título", { max: 160 });
    const pedido = String(item.dados?.slug ?? "");
    const nome = /^[a-z0-9-]{2,80}$/.test(pedido) ? pedido : slug(titulo) || recusar("título sem letras");
    // A aula pode já existir com número na frente ("03-fracoes.md"): nesse caso também não se sobrescreve.
    const atual = fs.readdirSync(path.join(conteudo, "trilhas", trilha)).find((arquivo) => arquivo.replace(/^\d+-/, "") === `${nome}.md`);
    // Nova versão de uma aula publicada (dados.substitui = o slug dela, só de quem ensina a disciplina): sobrescreve o arquivo.
    const substitui = atual && String(item.dados?.substitui ?? "") === nome;
    const arquivo = substitui ? path.join(conteudo, "trilhas", trilha, atual) : atual ? livre(`trilhas/${trilha}`, `${nome}-nova-versao`) : destino(`trilhas/${trilha}`, nome);
    return {
      arquivo,
      dados: { titulo, resumo: linha(item.dados?.resumo, "resumo", { max: 220 }), autores: [assinatura(item)], revisada: true, fontes: fontes(item.fontes, true), ...(questoes(item.dados?.quiz).length ? { quiz: questoes(item.dados?.quiz) } : {}) },
      texto: corpo(item.corpo, tipos.aula.corpo.min),
    };
  },
  obra(item) {
    const titulo = linha(item.titulo, "título", { max: 200 });
    if (!DISCIPLINAS.has(item.disciplina)) recusar("disciplina desconhecida");
    const licenca = linha(item.dados?.licenca, "licença", { max: 40 });
    if (!LICENCAS.includes(licenca)) recusar("licença desconhecida");
    const dados = {
      titulo,
      autor: linha(item.dados?.autor, "autor", { max: 160 }),
      area: item.disciplina,
      licenca,
      fonte: linha(item.dados?.fonte, "fonte", { max: 80 }),
      url: endereco(item.dados?.url, "url"),
      idioma: linha(item.dados?.idioma, "idioma", { max: 40 }),
    };
    const ano = linha(item.dados?.ano, "ano", { max: 20, obrigatorio: false });
    if (ano) dados.ano = ano;
    return { arquivo: livre("acervo", slug(titulo) || recusar("título sem letras")), dados, texto: corpo(item.corpo, tipos.obra.corpo.min) };
  },
  artigo(item) {
    const titulo = linha(item.titulo, "título", { max: 160 });
    const dia = data(item.revisado_em);
    const dados = { titulo, autor: assinatura(item), data: dia, fontes: fontes(item.fontes, true) };
    const subtitulo = linha(item.dados?.subtitulo, "subtítulo", { max: 220, obrigatorio: false });
    const editoria = linha(item.dados?.editoria, "editoria", { max: 40, obrigatorio: false });
    if (subtitulo) dados.subtitulo = subtitulo;
    if (editoria) dados.editoria = editoria;
    return { arquivo: livre("jornal", `${dia}-${slug(titulo) || "materia"}`), dados, texto: corpo(item.corpo, tipos.artigo.corpo.min) };
  },
  checagem(item) {
    const veredito = linha(item.dados?.veredito, "veredito", { max: 20 });
    if (!["Falso", "Enganoso", "Falta contexto", "Verdadeiro"].includes(veredito)) recusar("veredito desconhecido");
    return {
      arquivo: livre("checagens", slug(item.titulo) || recusar("título sem letras")),
      dados: { titulo: linha(item.titulo, "título", { max: 160 }), alegacao: linha(item.dados?.alegacao, "alegação", { max: 300 }), veredito, data: data(item.revisado_em), fontes: fontes(item.fontes, true) },
      texto: corpo(item.corpo, tipos.checagem.corpo.min),
    };
  },
  debate(item) {
    return {
      arquivo: livre("debates", slug(item.titulo) || recusar("título sem letras")),
      dados: { afirmacao: linha(item.dados?.afirmacao, "afirmação", { max: 200 }), resposta: linha(item.dados?.resposta, "resposta", { max: 700 }), fontes: fontes(item.fontes, true) },
      texto: corpo(item.corpo),
    };
  },
  verbete(item) {
    const termo = linha(item.titulo, "termo", { max: 80 });
    return {
      arquivo: livre("glossario", slug(termo) || recusar("termo sem letras")),
      dados: { termo, resumo: linha(item.dados?.resumo, "resumo", { max: 220 }), fontes: fontes(item.fontes, true) },
      texto: corpo(item.corpo),
    };
  },
  memorial(item) {
    const nome = linha(item.titulo, "nome", { max: 120 });
    const morte = linha(item.dados?.morte, "ano da morte", { max: 4 });
    if (!/^\d{3,4}$/.test(morte)) recusar("ano da morte inválido");
    return {
      arquivo: livre("memorial", slug(nome) || recusar("nome sem letras")),
      dados: { nome, nascimento: linha(item.dados?.nascimento, "nascimento", { max: 12 }), morte, local: linha(item.dados?.local, "local", { max: 80 }), fontes: fontes(item.fontes, true) },
      texto: corpo(item.corpo, tipos.memorial.corpo.min),
    };
  },
  video(item) {
    if (!DISCIPLINAS.has(item.disciplina)) recusar("disciplina desconhecida");
    const titulo = linha(item.titulo, "título", { max: 160 });
    return {
      arquivo: livre("videos", slug(titulo) || recusar("título sem letras")),
      dados: { titulo, canal: linha(item.dados?.canal, "canal", { max: 80 }), url: endereco(item.dados?.url, "url"), area: item.disciplina, idioma: linha(item.dados?.idioma, "idioma", { max: 40 }) },
      texto: corpo(item.corpo, tipos.video.corpo.min),
    };
  },
  avulso(item) {
    if (!DISCIPLINAS.has(item.disciplina)) recusar("disciplina desconhecida");
    const titulo = linha(item.titulo, "título", { max: 160 });
    const formato = linha(item.dados?.formato, "formato", { max: 40 });
    if (!FORMATOS.includes(formato)) recusar("formato desconhecido");
    return {
      arquivo: livre("avulsos", slug(titulo) || recusar("título sem letras")),
      dados: { titulo, area: item.disciplina, formato, resumo: linha(item.dados?.resumo, "resumo", { max: 220 }), autores: [assinatura(item)], fontes: fontes(item.fontes, true), ...(questoes(item.dados?.quiz).length ? { quiz: questoes(item.dados?.quiz) } : {}) },
      texto: corpo(item.corpo, tipos.avulso.corpo.min),
    };
  },
  traducao(item) {
    const idioma = String(item.dados?.idioma ?? "");
    if (!IDIOMAS.includes(idioma)) recusar("idioma desconhecido");
    const alvo = String(item.alvo ?? item.dados?.alvo ?? "").replace(/^\/(pt|en|es|zh|ru)(?=\/)/, "");
    const aula = /^\/trilhas\/([a-z0-9-]{2,80})\/([a-z0-9-]{2,80})$/.exec(alvo);
    const trilha = /^\/trilhas\/([a-z0-9-]{2,80})$/.exec(alvo);
    const obra = /^\/acervo\/([a-z0-9-]{2,80})$/.exec(alvo);
    let original;
    if (aula) {
      const pasta = path.join(conteudo, "trilhas", aula[1]);
      const nome = fs.existsSync(pasta) && fs.readdirSync(pasta).find((arquivo) => /^[a-z0-9-]+\.md$/.test(arquivo) && arquivo.replace(/^\d+-/, "") === `${aula[2]}.md`);
      if (!nome) recusar("a aula original não existe");
      original = destino(`trilhas/${aula[1]}`, nome.replace(/\.md$/, ""));
    } else if (trilha) original = destino(`trilhas/${trilha[1]}`, "_trilha");
    else if (obra) original = destino("acervo", obra[1]);
    else recusar("por enquanto só aulas, trilhas e fichas do acervo recebem tradução pelo painel");
    if (!fs.existsSync(original)) recusar("a página original não existe");
    const dados = { titulo: linha(item.titulo, "título", { max: 200 }), tradutor: assinatura(item) };
    const resumo = linha(item.dados?.resumo, "resumo", { max: 220, obrigatorio: false });
    if (resumo) dados.resumo = resumo;
    // Tradução é o único caso em que um arquivo pode ser trocado: a versão anterior continua no histórico.
    return { arquivo: original.replace(/\.md$/, `.${idioma}.md`), dados, texto: corpo(item.corpo, tipos.traducao.corpo.min) };
  },
};

/**
 * Prática lúdica de idioma aprovada: os exercícios entram no cabeçalho da aula (campo "pratica"), que já existe.
 * A conferência fina é do site (lib/pratica.ts), na montagem; aqui só a forma: tipos conhecidos e tamanhos.
 */
function acrescentarPratica(item) {
  const alvo = /^([a-z0-9-]{2,80})\/([a-z0-9-]{2,80})$/.exec(String(item.alvo ?? ""));
  if (!alvo) recusar("a prática precisa apontar a aula (trilha/aula)");
  const pasta = path.join(conteudo, "trilhas", alvo[1]);
  const nome = fs.existsSync(pasta) && fs.readdirSync(pasta).find((arquivo) => /^[a-z0-9-]+\.md$/.test(arquivo) && arquivo.replace(/^\d+-/, "") === `${alvo[2]}.md`);
  if (!nome) recusar("a aula da prática não existe");
  const arquivo = destino(`trilhas/${alvo[1]}`, nome.replace(/\.md$/, ""));
  const tiposConhecidos = ["escolha", "traduzir", "pares", "lacuna", "ordenar", "ouvir", "falar", "cartoes"];
  const exercicios = Array.isArray(item.dados?.exercicios) ? item.dados.exercicios : [];
  if (exercicios.length < 1 || exercicios.length > 60) recusar("a prática precisa de 1 a 60 exercícios");
  for (const ex of exercicios) if (!ex || typeof ex !== "object" || !tiposConhecidos.includes(ex.tipo)) recusar("exercício de tipo desconhecido");
  if (JSON.stringify(exercicios).length > 60_000) recusar("prática grande demais");
  const { dados, corpo: textoDaAula } = lerCabecalho(fs.readFileSync(arquivo, "utf8"));
  fs.writeFileSync(arquivo, montarArquivo({ ...dados, pratica: exercicios, pratica_origem: item.id }, textoDaAula.trim()));
  return arquivo;
}

/** Frases vão todas para um arquivo só. */
function acrescentarFrase(item) {
  const arquivo = path.join(conteudo, "frases.json");
  const frases = JSON.parse(fs.readFileSync(arquivo, "utf8"));
  const [fonte] = fontes(item.fontes, true);
  const nova = { texto: corpo(item.corpo, 10).replace(/\s+/g, " ").slice(0, 400), autor: linha(item.titulo, "autor", { max: 120 }), fonte: fonte.ano ? `${fonte.titulo} (${fonte.ano})` : fonte.titulo, origem: item.id };
  if (frases.some((frase) => frase.origem === item.id || frase.texto === nova.texto)) return null;
  fs.writeFileSync(arquivo, JSON.stringify([...frases, nova], null, 2) + "\n");
  return arquivo;
}

/**
 * Temas aprovados entram no fim do roteiro da trilha, "em preparação": a meta da trilha cresce e qualquer educador
 * escreve as aulas depois. Tema que já está no roteiro (mesmo endereço) não entra de novo.
 */
function acrescentarTemas(item) {
  const trilha = linha(item.dados?.trilha, "trilha", { max: 80 });
  if (!/^[a-z0-9-]{2,80}$/.test(trilha) || !fs.existsSync(path.join(conteudo, "trilhas", trilha, "_trilha.md"))) recusar("trilha desconhecida");
  const arquivo = path.join(conteudo, "trilhas", trilha, "plano.json");
  const plano = fs.existsSync(arquivo) ? JSON.parse(fs.readFileSync(arquivo, "utf8")) : [];
  const usados = new Set(plano.map((aula) => aula.slug));
  const novos = [];
  for (const bruto of String(item.dados?.temas ?? "").split("\n").slice(0, 20)) {
    const titulo = linha(bruto, "tema", { max: 160, obrigatorio: false });
    if (titulo.length < 3) continue;
    const endereco = slug(titulo);
    if (!endereco || usados.has(endereco)) continue;
    usados.add(endereco);
    novos.push({ slug: endereco, titulo, origem: item.id });
  }
  if (novos.length === 0) recusar("nenhum tema novo (todos já estão no roteiro)");
  fs.writeFileSync(arquivo, JSON.stringify([...plano, ...novos], null, 2) + "\n");
  return { arquivo, quantos: novos.length };
}

/** Itens que já viraram arquivo em uma rodada anterior (o aviso ao banco pode ter falhado). */
function jaPublicados() {
  const ids = new Set();
  const visitar = (pasta) => {
    for (const entrada of fs.readdirSync(pasta, { withFileTypes: true })) {
      const caminho = path.join(pasta, entrada.name);
      if (entrada.isDirectory()) visitar(caminho);
      else if (/\.(md|json)$/.test(entrada.name)) for (const achado of fs.readFileSync(caminho, "utf8").matchAll(/"?(?:pratica_)?origem"?: "?([0-9a-f-]{36})"?/g)) ids.add(achado[1]);
    }
  };
  visitar(conteudo);
  return ids;
}

// ───────────── Execução ─────────────

if (!base || !chave) {
  console.log("Serviço de contas não configurado (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY): nada a publicar.");
  process.exit(0);
}

if (process.argv.includes("--marcar")) {
  if (!fs.existsSync(anotacao)) {
    console.log("Nada a marcar.");
    process.exit(0);
  }
  const lido = JSON.parse(fs.readFileSync(anotacao, "utf8"));
  const { ids = [], avulsos = [], apagar = [] } = Array.isArray(lido) ? { ids: lido } : lido;
  if (ids.length > 0) await chamar("publicacoes_marcar", { p_ids: ids });
  for (const avulso of avulsos) await chamar("arquivo_publicado", { p_id: avulso.id, p_destino: avulso.destino });
  // O que já está dentro do site sai do depósito: ele não é lugar de guardar nada.
  for (const caminho of apagar) {
    await fetch(`${base}/storage/v1/object/envios/${caminho}`, { method: "DELETE", headers: { apikey: chave, Authorization: `Bearer ${chave}` }, signal: AbortSignal.timeout(30_000) }).catch(() => {});
  }
  fs.rmSync(anotacao);
  console.log(`${ids.length} item(ns) e ${avulsos.length} arquivo(s) marcados como publicados.`);
  process.exit(0);
}

const pendentes = await chamar("publicacoes_pendentes");
if (!Array.isArray(pendentes)) throw new Error("resposta inesperada do serviço");
const feitos = jaPublicados();
const marcar = [];
const resumo = [];
const apagar = [];
let recusados = 0;

for (const item of pendentes.slice(0, LIMITE)) {
  const rotulo = `${item.tipo} “${String(item.titulo ?? "").slice(0, 60)}”`;
  try {
    if (!/^[0-9a-f-]{36}$/.test(String(item.id))) recusar("identificador inválido");
    if (feitos.has(item.id)) {
      marcar.push(item.id);
      continue;
    }
    if (item.tipo === "frase") {
      if (acrescentarFrase(item)) resumo.push(rotulo);
    } else if (item.tipo === "pratica") {
      const arquivo = acrescentarPratica(item);
      resumo.push(`${rotulo} → prática em ${path.relative(raiz, arquivo).replaceAll("\\", "/")}`);
    } else if (item.tipo === "temas") {
      const { arquivo, quantos } = acrescentarTemas(item);
      resumo.push(`${rotulo} → ${quantos} tema(s) em ${path.relative(raiz, arquivo).replaceAll("\\", "/")}`);
    } else if (montar[item.tipo]) {
      const { arquivo, dados, texto } = montar[item.tipo](item);
      const usados = [];
      const final = await trazerImagens(texto, usados);
      fs.mkdirSync(path.dirname(arquivo), { recursive: true });
      fs.writeFileSync(arquivo, montarArquivo({ ...dados, origem: item.id }, final));
      apagar.push(...usados);
      resumo.push(`${rotulo} → ${path.relative(raiz, arquivo).replaceAll("\\", "/")}`);
    }
    // Correções e sugestões aprovadas não geram arquivo: quem aprovou faz a mudança à mão.
    marcar.push(item.id);
  } catch (erro) {
    if (!(erro instanceof Recusa)) throw erro;
    recusados++;
    console.log(`RECUSADO ${rotulo}: ${erro.message}`);
  }
}

// Arquivos avulsos aprovados pela coordenação (imagem do aviso de abertura, panfleto em PDF).
const avulsos = [];
for (const avulso of (await chamar("arquivos_aprovados")).slice(0, LIMITE)) {
  try {
    const destinoFinal = await publicarArquivo(avulso.caminho);
    avulsos.push({ id: avulso.id, destino: destinoFinal });
    apagar.push(avulso.caminho);
    resumo.push(`arquivo → public${destinoFinal}`);
  } catch (erro) {
    if (!(erro instanceof Recusa)) throw erro;
    recusados++;
    avulsos.push({ id: avulso.id, destino: "" });
    apagar.push(avulso.caminho);
    console.log(`RECUSADO arquivo ${avulso.caminho}: ${erro.message}`);
  }
}

fs.writeFileSync(anotacao, JSON.stringify({ ids: marcar, avulsos, apagar }));
console.log(resumo.length ? `Publicado:\n${resumo.map((linhaDoResumo) => `- ${linhaDoResumo}`).join("\n")}` : "Nenhum arquivo novo.");
if (pendentes.length > LIMITE) console.log(`Ficaram ${pendentes.length - LIMITE} itens para a próxima rodada.`);
if (recusados) console.log(`${recusados} item(ns) recusados: continuam aprovados no painel até serem corrigidos ou recusados lá.`);
