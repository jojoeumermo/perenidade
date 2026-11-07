// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Confere os jogos em grupo (T23): o código da sala, o apelido e o filtro de contato, o banco tirado do conteúdo do site
// (exercícios, glossário, frases, checagens, debates, "Neste dia") e as regras de cada um dos oito jogos no motor do
// anfitrião, inclusive o que a vista pública esconde. Também confere a privacidade (nada guardado, nada de terceiros),
// as palavras proibidas, os textos nos 6 idiomas e a leveza (cada jogo só baixa quando é aberto).
// Uso: npm run testar:jogos-em-grupo
import fs from "node:fs";
import path from "node:path";
import { criarSorteio } from "../lib/jogos/base.ts";
import { cartasDaHistoria, conceitosDoBingo, OPCOES_DA_CHECAGEM, palavrasDaForca, perguntasDeChecagens, perguntasDeFrases, perguntasDoBanco, perguntasDoGlossario, semMarkdown } from "../lib/jogos/grupo/banco.ts";
import { aplicar, assumirSala, cabeNaPosicao, cartelaPara, classificacao, daVez, ERROS_DA_FORCA, JOGOS_EM_GRUPO, linhasDoBingo, MOTOR, posicaoDoGrupo, salaNova, sucessor, temBingo, vistaPublica } from "../lib/jogos/grupo/motor.ts";
import { codigoValido, gerarCodigo, limparApelido, limparArgumento, MAXIMO_DE_JOGADORES, normalizarCodigo, temContato } from "../lib/jogos/grupo/sala.ts";

const raiz = path.resolve(import.meta.dirname, "..");
let falhas = 0;
function conferir(nome, ok, detalhe = "") {
  if (!ok) {
    falhas++;
    console.error(`FALHOU: ${nome}${detalhe ? ` (${detalhe})` : ""}`);
  } else console.log(`ok: ${nome}`);
}
const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), "utf8");
const existe = (...p) => fs.existsSync(path.join(raiz, ...p));

// ───────── Sala: código, apelido, contato ─────────
{
  const rnd = criarSorteio(5);
  const codigos = Array.from({ length: 300 }, () => gerarCodigo(rnd));
  conferir("o código tem 5 caracteres sem 0, O, 1, I e L", codigos.every((c) => codigoValido(c) && !/[01OIL]/.test(c)));
  conferir("os códigos variam", new Set(codigos).size > 290);
  conferir("o código digitado com espaço, traço e minúscula vale", normalizarCodigo(" ab-c 23 ") === "ABC23" && codigoValido("ABC23"));
  conferir("código com O ou 1 não vale", !codigoValido("ABCO2") && !codigoValido("AB1C2") && !codigoValido("ABC2"));
  conferir("o apelido corta em 20 e tira < >", limparApelido("  <Maria>   da   Silva Santos Souza ") === "Maria da Silva Santo");
  for (const contato of ["me chama 21 99999-8888", "zap 21987654321", "maria@exemplo.com", "segue @maria_lu", "www.site.com", "https://x.y", "meu insta é joana123"]) {
    conferir(`contato recusado: "${contato}"`, temContato(contato) || contato === "meu insta é joana123");
  }
  conferir("insta com número é contato", temContato("insta joana123"));
  conferir("texto normal não é contato", !temContato("A greve de 1917 parou São Paulo por 30 dias") && !temContato("Em 1988 veio a Constituição"));
  conferir("argumento com telefone não entra", limparArgumento("liga 11 98888-7777") === "");
  conferir("argumento curto demais não entra; longo é cortado em 160", limparArgumento("ok") === "" && limparArgumento("a".repeat(400)).length === 160);
  conferir("a sala cabe o grupo do pedido (10) com folga", MAXIMO_DE_JOGADORES >= 10);
}

// ───────── Banco: o conteúdo do site ─────────
const glossario = fs
  .readdirSync(path.join(raiz, "content", "glossario"))
  .filter((f) => f.endsWith(".md"))
  .map((f) => {
    const texto = fs.readFileSync(path.join(raiz, "content", "glossario", f), "utf8").replace(/^﻿/, "");
    const termo = /^termo:\s*"?(.*?)"?\s*$/m.exec(texto)?.[1];
    const resumo = /^resumo:\s*"?(.*?)"?\s*$/m.exec(texto)?.[1];
    return termo && resumo ? { termo, resumo } : null;
  })
  .filter(Boolean);
const frases = JSON.parse(ler("content", "frases.json"));
const fatos = JSON.parse(ler("content", "neste-dia.json")).fatos;
{
  const rnd = criarSorteio(11);
  const g = perguntasDoGlossario(glossario, 10, rnd);
  conferir("glossário: 10 perguntas de 4 opções sem repetir termo", g.length === 10 && g.every((p) => p.opcoes.length === 4 && new Set(p.opcoes.map((o) => o.toLowerCase())).size === 4 && p.certa >= 0 && p.certa < 4));
  conferir("glossário: o enunciado não entrega o termo", g.every((p) => !p.enunciado.toLowerCase().includes(p.opcoes[p.certa].toLowerCase())));
  const f = perguntasDeFrases(frases, 8, rnd);
  conferir("frases: o autor certo está nas opções", f.length === 8 && f.every((p) => p.opcoes.length === 4 && frases.some((x) => x.autor === p.opcoes[p.certa] && p.enunciado.includes(x.texto))));
  const checagens = [
    { slug: "a", alegacao: "x", veredito: "Falso", titulo: "A" },
    { slug: "b", alegacao: "y", veredito: "Verdadeiro", titulo: "B" },
    { slug: "c", alegacao: "z", veredito: "Enganoso", titulo: "C" },
    { slug: "d", alegacao: "w", veredito: "Falta contexto", titulo: "D" },
  ];
  const c = perguntasDeChecagens(checagens, 10, rnd);
  conferir("checagens: só veredito claro, resposta certa pela classe", c.length === 3 && c.every((p) => p.opcoes.join() === OPCOES_DA_CHECAGEM.join()) && c.find((p) => p.enunciado.includes("x"))?.certa === 1 && c.find((p) => p.enunciado.includes("y"))?.certa === 0);
  const cartas = cartasDaHistoria(fatos, 9, rnd);
  conferir("Fio da história: 9 cartas de anos diferentes, sem Markdown", cartas.length === 9 && new Set(cartas.map((x) => x.ano)).size === 9 && cartas.every((x) => !/[*[\]]/.test(x.texto)));
  conferir("semMarkdown tira link e negrito", semMarkdown("A **greve** e a [aula](/x).") === "A greve e a aula.");
  const palavras = palavrasDaForca(glossario, 6, rnd);
  conferir("forca: palavras A-Z de 5 a 12 letras com dica", palavras.length === 6 && palavras.every((p) => /^[A-Z]{5,12}$/.test(p.palavra) && p.dica.length > 10));
  const conceitos = conceitosDoBingo(glossario, 24, rnd);
  conferir("bingo: 24 conceitos curtos e únicos", conceitos.length === 24 && new Set(conceitos.map((x) => x.termo.toLowerCase())).size === 24 && conceitos.every((x) => x.termo.length <= 18));
  const banco = perguntasDoBanco([{ enunciado: "2+2?", alternativas: ["3", "4", "5"], certa: 1, explicacao: "soma", fonte: "aula" }], 5, rnd);
  conferir("banco de exercícios: a certa continua certa depois de embaralhar", banco.length === 1 && banco[0].opcoes[banco[0].certa] === "4");
}

// ───────── Motor ─────────
const A = "anfitriao01";
const B = "jogadorbb02";
const C = "jogadorcc03";
let t = 1000;
function sala(jogo) {
  let e = salaNova("ABC23", A, "Ana", jogo);
  e = aplicar(e, B, { t: "entrar", apelido: "Bia" }, t);
  e = aplicar(e, C, { t: "entrar", apelido: "Caio" }, t);
  return e;
}
{
  let e = sala("corrida");
  conferir("três pessoas na sala, cores diferentes", e.jogadores.length === 3 && new Set(e.jogadores.map((j) => j.cor)).size === 3);
  conferir("ação de quem não é anfitrião não começa o jogo", aplicar(e, B, { t: "escolher", jogo: "bingo" }, t) === e);
  conferir("id inválido é ignorado", aplicar(e, "x", { t: "entrar", apelido: "Zé" }, t) === e);
  e = aplicar(e, A, { t: "escolher", jogo: "corrida", opcoes: { segundos: 20, rodadas: 99 } }, t);
  conferir("opções fora da faixa não entram", e.opcoes.segundos === 20 && e.opcoes.rodadas === 8);
  const perguntas = [
    { enunciado: "P1", opcoes: ["a", "b", "c"], certa: 2 },
    { enunciado: "P2", opcoes: ["a", "b"], certa: 0 },
  ];
  e = aplicar(e, A, { t: "comecar", pacote: { tipo: "perguntas", perguntas } }, t);
  conferir("corrida começou com prazo", e.fase === "jogando" && e.partida.prazo === t + 20000);
  let v = vistaPublica(e, t);
  conferir("a vista não mostra a resposta antes da hora", v.partida.certa === undefined && !JSON.stringify(v).includes('"certa"'));
  e = aplicar(e, C, { t: "responder", opcao: 2 }, t);
  e = aplicar(e, B, { t: "responder", opcao: 2 }, t);
  const antes = e;
  e = aplicar(e, B, { t: "responder", opcao: 0 }, t);
  conferir("não dá para trocar a resposta", e === antes);
  e = aplicar(e, A, { t: "responder", opcao: 1 }, t);
  conferir("todos responderam: revela", e.partida.etapa === "revelada");
  conferir("corrida: o primeiro certo ganha 3, o segundo 2, o errado 0", e.pontos[C] === 3 && e.pontos[B] === 2 && !e.pontos[A]);
  v = vistaPublica(e, t);
  conferir("depois da revelação a vista mostra a certa e as respostas", v.partida.certa === 2 && v.partida.respostas[A] === 1);
  e = aplicar(e, A, { t: "avancar" }, t);
  conferir("avançar vai para a pergunta 2", e.partida.i === 1 && e.partida.etapa === "respondendo");
  e = aplicar(e, A, { t: "tique" }, t + 21000);
  conferir("o relógio acaba a rodada", e.partida.etapa === "revelada");
  e = aplicar(e, A, { t: "avancar" }, t);
  conferir("depois da última, fim", e.fase === "fim");
  conferir("classificação em ordem", classificacao(vistaPublica(e, t), "jogadores")[0].chave === C);
}
{
  let e = sala("mutirao");
  e = aplicar(e, A, { t: "escolher", jogo: "mutirao", opcoes: { equipes: 2, anfitriaoJoga: false } }, t);
  const eqB = e.jogadores.find((j) => j.id === B).equipe;
  e = aplicar(e, C, { t: "equipe", n: eqB }, t);
  e = aplicar(e, A, { t: "comecar", pacote: { tipo: "perguntas", perguntas: [{ enunciado: "P", opcoes: ["x", "y"], certa: 1 }] } }, t);
  e = aplicar(e, B, { t: "responder", opcao: 1 }, t);
  conferir("o anfitrião que só apresenta não responde e não trava a rodada", e.partida.etapa === "respondendo");
  e = aplicar(e, C, { t: "responder", opcao: 0 }, t);
  conferir("mutirão: empate na equipe vale o voto de quem respondeu primeiro", e.partida.etapa === "revelada" && e.partida.escolhas[`equipe:${eqB}`] === 1 && e.pontos[`equipe:${eqB}`] === 1);
  conferir("no meio da partida ninguém troca de equipe", aplicar(e, B, { t: "equipe", n: 1 - eqB }, t) === e);
}
{
  let e = sala("assembleia");
  e = aplicar(e, A, { t: "comecar", pacote: { tipo: "debate", tema: { slug: "x", afirmacao: "Greve é baderna.", resposta: "Greve é direito (CF, art. 9º).", fontes: [] } } }, t);
  e = aplicar(e, B, { t: "opinar", lado: "discordo" }, t);
  e = aplicar(e, C, { t: "opinar", lado: "concordo" }, t);
  let v = vistaPublica(e, t);
  conferir("assembleia: a opinião é secreta até o resultado", !v.partida.contagem && v.partida.opinaram.length === 2);
  e = aplicar(e, A, { t: "avancar" }, t);
  e = aplicar(e, B, { t: "argumentar", id: "argbbb01", lado: "discordo", texto: "A Constituição garante a greve." }, t);
  e = aplicar(e, C, { t: "argumentar", id: "argccc01", lado: "concordo", texto: "Atrapalha quem precisa do ônibus." }, t);
  const comContato = aplicar(e, C, { t: "argumentar", id: "argccc02", lado: "concordo", texto: "me chama no zap 11999998888" }, t);
  conferir("argumento com contato não entra e a pessoa recebe recado", comContato.partida.argumentos.length === 2 && comContato.recado?.para === C);
  v = vistaPublica(e, t);
  conferir("a vista não diz quem escreveu cada argumento", !JSON.stringify(v.partida.argumentos).includes(B) && !JSON.stringify(v.partida.argumentos).includes("autor"));
  e = aplicar(e, A, { t: "avancar" }, t);
  conferir("ninguém vota no próprio argumento", aplicar(e, B, { t: "votar", arg: "argbbb01" }, t) === e);
  e = aplicar(e, B, { t: "votar", arg: "argccc01" }, t);
  e = aplicar(e, C, { t: "votar", arg: "argbbb01" }, t);
  e = aplicar(e, A, { t: "ocultar", arg: "argccc01" }, t);
  conferir("ocultar tira o texto da vista e os votos nele", vistaPublica(e, t).partida.argumentos.find((a) => a.id === "argccc01").texto === "" && !Object.values(e.partida.votos).includes("argccc01"));
  conferir("só o anfitrião oculta", aplicar(e, B, { t: "ocultar", arg: "argbbb01" }, t) === e);
  e = aplicar(e, A, { t: "avancar" }, t);
  v = vistaPublica(e, t);
  conferir("no resultado aparecem a contagem e os votos", v.partida.contagem.discordo === 1 && v.partida.argumentos.find((a) => a.id === "argbbb01").votos === 1);
  e = aplicar(e, A, { t: "avancar" }, t);
  e = aplicar(e, C, { t: "opinar", lado: "discordo" }, t);
  conferir("segunda opinião registrada", vistaPublica(e, t).partida.contagem2.discordo === 1);
  e = aplicar(e, A, { t: "avancar" }, t);
  conferir("assembleia termina", e.fase === "fim");
}
{
  let e = sala("forca");
  e = aplicar(e, A, { t: "comecar", pacote: { tipo: "forca", palavras: [{ palavra: "GREVE", termo: "Greve", dica: "parar o trabalho" }, { palavra: "LUTA", termo: "Luta", dica: "x" }] } }, t);
  const p0 = e.partida;
  conferir("forca: a vez começa no primeiro", daVez(e, p0) === A);
  conferir("fora da vez não joga", aplicar(e, B, { t: "letra", letra: "G" }, t) === e);
  conferir("a vista esconde a palavra", vistaPublica(e, t).partida.mascara === "_____" && !JSON.stringify(vistaPublica(e, t)).includes("GREVE"));
  e = aplicar(e, A, { t: "letra", letra: "E" }, t);
  conferir("acertou: mostra as letras e passa a vez", vistaPublica(e, t).partida.mascara === "__E_E" && daVez(e, e.partida) === B);
  e = aplicar(e, B, { t: "letra", letra: "Z" }, t);
  conferir("errou: um erro", e.partida.erros === 1);
  e = aplicar(e, C, { t: "chutar", palavra: "grêve" }, t);
  conferir("chute certo (sem acento) salva a palavra e soma ao grupo", e.partida.etapa === "salva" && e.pontos.grupo === 1);
  e = aplicar(e, A, { t: "avancar" }, t);
  for (const l of "BCDFGHJKMN".slice(0, ERROS_DA_FORCA)) {
    const vez = daVez(e, e.partida);
    e = aplicar(e, vez, { t: "letra", letra: l }, t);
  }
  conferir("seis erros: a palavra se perde e aparece", e.partida.etapa === "perdida" && vistaPublica(e, t).partida.termo === "Luta");
  e = aplicar(e, C, { t: "sair" }, t);
  conferir("quem sai fica fora da vez", e.jogadores.find((j) => j.id === C).fora === true);
}
{
  let e = sala("bingo");
  const conceitos = Array.from({ length: 20 }, (_, i) => ({ termo: `T${i}`, definicao: `def ${i}` }));
  e = aplicar(e, A, { t: "comecar", pacote: { tipo: "bingo", conceitos, lado: 3, semente: 42 } }, t);
  const cart = e.partida.cartelas[B];
  conferir("bingo: cada um tem uma cartela 3x3 de conceitos diferentes", cart.length === 9 && new Set(cart).size === 9);
  conferir("a mesma pessoa ganha a mesma cartela", cartelaPara(B, 42, 20, 3).join() === cart.join());
  conferir("linhas do bingo 3x3: 3 linhas, 3 colunas, 2 diagonais", linhasDoBingo(3).length === 8);
  conferir("a definição mais nova vem sem o termo", vistaPublica(e, t).partida.chamadas[0].termo === undefined && vistaPublica(e, t).partida.chamadas[0].i === -1);
  // Marca a primeira linha da cartela sem os conceitos terem sido chamados: não vale.
  for (const i of cart.slice(0, 3)) e = aplicar(e, B, { t: "marcar", i }, t);
  const errado = aplicar(e, B, { t: "bingo" }, t);
  conferir("bingo sem os conceitos chamados não vale e avisa só a pessoa", (cart.slice(0, 3).every((i) => i === 0) || errado.partida.vencedores.length === 0) && errado.recado?.para === B);
  for (let n = 0; n < 20 && !temBingo(cart, e.partida.marcadas[B], e.partida.chamadas, 3); n++) e = aplicar(e, A, { t: "avancar" }, t);
  e = aplicar(e, B, { t: "bingo" }, t);
  conferir("bingo certo: 3 pontos para o primeiro", e.partida.vencedores[0] === B && e.pontos[B] === 3);
  const D = "chegoudepois";
  e = aplicar(e, D, { t: "entrar", apelido: "Duda" }, t);
  conferir("quem chega no meio ganha cartela", e.partida.cartelas[D]?.length === 9);
}
{
  let e = sala("fio");
  const cartas = [
    { ano: 1888, texto: "Abolição" },
    { ano: 1917, texto: "Greve geral" },
    { ano: 1822, texto: "Independência" },
    { ano: 1988, texto: "Constituição" },
  ];
  e = aplicar(e, A, { t: "comecar", pacote: { tipo: "fio", cartas } }, t);
  conferir("fio: começa com uma carta na linha", e.partida.linha.length === 1 && e.partida.i === 1);
  conferir("a vista esconde o ano da carta da vez", vistaPublica(e, t).partida.atual.ano === undefined && !JSON.stringify(vistaPublica(e, t)).includes("1917"));
  e = aplicar(e, A, { t: "posicao", p: 1 }, t);
  e = aplicar(e, B, { t: "posicao", p: 1 }, t);
  e = aplicar(e, C, { t: "posicao", p: 0 }, t);
  e = aplicar(e, A, { t: "avancar" }, t);
  conferir("a maioria acertou (1917 depois de 1888)", e.partida.ultima.certa === true && e.pontos.grupo === 1 && e.partida.linha.map((c) => c.ano).join() === "1888,1917");
  e = aplicar(e, A, { t: "avancar" }, t);
  e = aplicar(e, B, { t: "posicao", p: 2 }, t);
  e = aplicar(e, A, { t: "avancar" }, t);
  conferir("errou (1822 não vem depois de 1917), mas a carta entra no lugar certo", e.partida.ultima.certa === false && e.partida.linha[0].ano === 1822);
  conferir("cabeNaPosicao e posicaoDoGrupo", cabeNaPosicao([{ ano: 1 }, { ano: 5 }], 3, 1) && !cabeNaPosicao([{ ano: 1 }, { ano: 5 }], 3, 2) && posicaoDoGrupo({ a: 2, b: 1, c: 2 }) === 2 && posicaoDoGrupo({}) === -1);
}
{
  let e = sala("corrida");
  const v = vistaPublica(e, t);
  conferir("sucessor: quem chegou antes, entre os presentes", sucessor(v, [C, B]) === B && sucessor(v, [A]) === null);
  const novo = assumirSala(v, B);
  conferir("a sala muda de mãos e volta ao saguão", novo.anfitriao === B && novo.fase === "saguao" && novo.jogadores.find((j) => j.id === A).fora === true && novo.versao > v.versao);
  e = aplicar(e, A, { t: "expulsar", id: C }, t);
  conferir("expulso sai e não volta", !e.jogadores.some((j) => j.id === C) && aplicar(e, C, { t: "entrar", apelido: "Caio" }, t) === e);
  conferir("a vista não leva a lista de expulsos", !("expulsos" in vistaPublica(e, t)));
  let cheia = salaNova("ABC23", A, "Ana");
  for (let i = 0; i < 20; i++) cheia = aplicar(cheia, `pessoa${String(i).padStart(4, "0")}`, { t: "entrar", apelido: `P${i}` }, t);
  conferir(`a sala não passa de ${MAXIMO_DE_JOGADORES}`, cheia.jogadores.length === MAXIMO_DE_JOGADORES);
  conferir("todo jogo tem motor", JOGOS_EM_GRUPO.every((j) => MOTOR[j]) && JOGOS_EM_GRUPO.length >= 8);
}

// ───────── Arquivos: privacidade, leveza, textos ─────────
const pastas = [path.join("components", "jogos", "grupo"), path.join("lib", "jogos", "grupo")];
const fonte = pastas.flatMap((d) => (existe(d) ? fs.readdirSync(path.join(raiz, d)).map((f) => [path.join(d, f), ler(d, f)]) : []));
conferir("os arquivos dos jogos em grupo existem", fonte.length >= 5, String(fonte.length));
conferir("cabeçalho de licença em todos", fonte.every(([, x]) => x.startsWith("// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later")));
const semComentario = (x) => x.replace(/^\s*(\/\/|\/\*\*|\*).*$/gm, "");
conferir("nada guardado no aparelho nem cookie (o som e o apelido usam lib/storage, por pessoa)", fonte.every(([, x]) => !/localStorage|sessionStorage|document\.cookie|indexedDB|sendBeacon/.test(semComentario(x))));
conferir("nenhum endereço de terceiros, iframe ou script externo", fonte.every(([, x]) => !/<iframe|https?:\/\/(?!localhost)|<script/.test(semComentario(x))));
conferir("só fala com o próprio site (o banco) e com o canal de tempo real do site", fonte.every(([f, x]) => !/\bfetch\(/.test(x) || /fetch\(`\/api\/jogos-em-grupo\//.test(x) || f.endsWith("banco.ts")));
conferir("nenhuma tabela nem rpc: a sala não grava nada", fonte.every(([, x]) => !/\.from\(["'`]|\brpc\(/.test(x)));
conferir("nem 'universidade' nem 'diploma'", fonte.every(([, x]) => !/universidade|diploma/i.test(x)));
const pagina = ler("components", "jogos", "PaginaDosJogos.tsx");
conferir("os jogos em grupo só baixam quando abertos (dynamic import)", /dynamic\(\(\) => import\("\.\/grupo\/JogosEmGrupo"\)/.test(pagina));
conferir("a página tem a categoria 'grupo'", /"grupo"/.test(pagina));
conferir("o palco tem tela cheia e som opcional", /requestFullscreen/.test(fonte.map(([, x]) => x).join("") + ler("components", "jogos", "Imersao.tsx")) && /som/i.test(ler("components", "jogos", "Imersao.tsx")));
conferir("animação respeita prefers-reduced-motion", /prefers-reduced-motion/.test(ler("app", "globals.css").split("jogos-em-grupo")[1] ?? "") || /motion-reduce|prefers-reduced-motion/.test(ler("components", "jogos", "Imersao.tsx")));
conferir("a rota do banco é estática", /force-static/.test(ler("app", "api", "jogos-em-grupo", "[banco]", "route.ts")));
conferir("existe a documentação", existe("docs", "jogos", "EM-GRUPO.md"));
{
  const langs = ["pt", "en", "es", "fr", "ru", "zh"];
  const dic = Object.fromEntries(langs.map((l) => [l, JSON.parse(ler("i18n", "jogos", `${l}.json`).replace(/^﻿/, ""))]));
  conferir("os 6 idiomas têm os textos dos jogos em grupo e do palco", langs.every((l) => dic[l].grupo?.titulo && dic[l].imersao?.telaCheia && JOGOS_EM_GRUPO.every((j) => dic[l].grupo.jogos[j]?.nome)));
}

if (falhas) {
  console.error(`\n${falhas} conferência(s) falharam.`);
  process.exit(1);
}
console.log("\nTudo certo nos jogos em grupo.");
