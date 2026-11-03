// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere o Som do campus (Etapa 4, pacote E4-06; docs/escola/som.md), sem rede e sem navegador:
// - o "Continuar" da rádio (lucia:radio-retomar): prazo de 24 h, forma errada, endereço que não é público, ao vivo;
// - o som para estudar: amostras finitas e sem estouro, laço sem estalo, 30% com a voz;
// - o roteiro do Hoje no campus: no máximo 300 palavras, nenhum fato sem fonte, roteiro sem fatos, nos 6 idiomas;
// - o cordel da aula: estrofes de 6 versos, sem verso vazio, baseado_em existente, faixa de rascunho quando
//   revisado: false, autoria nunca atribuída sem revisão, no máximo 5 folhetos, todos de aulas do "Por onde começar".
// Uso: npm run testar:som
import fs from "node:fs";
import path from "node:path";
import { existeAula } from "../lib/escola/cursos-servidor.ts";
import { autoriaDe, AUTORIA_RASCUNHO, avisosDeRima, emRascunho, estrofesDe, folhetoDe, lerFolheto, lerFolhetosComErros, MAX_FOLHETOS, validarFolheto } from "../lib/cordel.ts";
import { SO_APAGAR } from "../lib/estudo.ts";
import { contarPalavras, dataPorExtenso, fatosCuradosDoDia, fonteDe, LIMITE_DE_PALAVRAS, montarRoteiro } from "../lib/hoje-no-campus.ts";
import { CHAVE_RETOMAR, enderecoPublico, faixaDaRetomada, lerRetomada, montarRetomada, PRAZO_RETOMAR } from "../lib/radio-retomar.ts";
import { amostrasDe, CHAVE_DO_VOLUME, esperaDepoisDaVoz, fecharLaco, NIVEL_COM_VOZ, nivelDoSom, normalizar, ruidoMarrom, ruidoRosa, sorteio, TIPOS_DE_SOM } from "../lib/som-de-estudo.ts";

const raiz = path.resolve(import.meta.dirname, "..");
let ok = 0;
const falhas = [];
const avisos = [];
const conferir = (nome, cond, detalhe = "") => (cond ? ok++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
const ler = (...partes) => fs.readFileSync(path.join(raiz, ...partes), "utf8");
const json = (...partes) => JSON.parse(ler(...partes));

// ───────────── Rádio que continua (D1-3) ─────────────
const agora = Date.UTC(2026, 10, 3, 15, 0, 0);
const ao_vivo = { id: "emissora-x", titulo: "Rádio X", artista: "São Paulo", url: "https://stream.exemplo.org/ao-vivo", live: true };
const episodio = { id: "podcast:ep-1", titulo: "Episódio 1", artista: "Podcast", url: "https://exemplo.supabase.co/storage/v1/object/public/podcast/a.mp3", podcast: { episodio: "ep-1", capa: "capas/ep-1.jpg", href: "/podcasts/serie/ep-1", duracao: 1800 } };

conferir("chave do retomar na lista só apagar", SO_APAGAR.includes(CHAVE_RETOMAR) && CHAVE_RETOMAR === "lucia:radio-retomar");
conferir("prazo de 24 h", PRAZO_RETOMAR === 24 * 3600 * 1000);

const rVivo = montarRetomada(ao_vivo, 999, agora);
conferir("ao vivo: canal, posição 0", rVivo?.canal === "emissora-x" && rVivo.posicao === 0 && rVivo.aoVivo === true && !rVivo.episodio);
const rEp = montarRetomada(episodio, 750.7, agora);
conferir("episódio: posição em segundos inteiros", rEp?.episodio === "ep-1" && rEp.posicao === 750 && !rEp.canal && rEp.podcast?.href === "/podcasts/serie/ep-1");
conferir("só o que é público (sem dado da pessoa)", rEp && Object.keys(rEp).sort().join() === ["artista", "aoVivo", "em", "episodio", "faixa", "podcast", "posicao", "titulo", "url"].sort().join(), Object.keys(rEp ?? {}).join());

const gravado = JSON.stringify(rEp);
conferir("lê o que gravou", JSON.stringify(lerRetomada(gravado, agora + 1000)) === gravado);
conferir("lê com 23 h", lerRetomada(gravado, agora + 23 * 3600 * 1000) !== null);
conferir("não lê com mais de 24 h", lerRetomada(gravado, agora + PRAZO_RETOMAR + 1) === null);
conferir("não lê gravação do futuro", lerRetomada(gravado, agora - 60 * 60 * 1000) === null);
conferir("vazio", lerRetomada(null, agora) === null && lerRetomada("", agora) === null);
const formasErradas = {
  "JSON quebrado": "{faixa:",
  lista: "[]",
  número: "42",
  "sem título": JSON.stringify({ ...rEp, titulo: "" }),
  "posição negativa": JSON.stringify({ ...rEp, posicao: -3 }),
  "posição em texto": JSON.stringify({ ...rEp, posicao: "12" }),
  "em em texto": JSON.stringify({ ...rEp, em: String(agora) }),
  "endereço http": JSON.stringify({ ...rEp, url: "http://exemplo.org/a.mp3" }),
  "endereço javascript": JSON.stringify({ ...rEp, url: "javascript:alert(1)" }),
  "endereço de outro site sem protocolo": JSON.stringify({ ...rEp, url: "//malicioso.org/a.mp3" }),
  "canal e episódio juntos": JSON.stringify({ ...rEp, canal: "x" }),
  "nem canal nem episódio": JSON.stringify({ ...rEp, episodio: undefined }),
  "episódio sem dados do podcast": JSON.stringify({ ...rEp, podcast: undefined }),
  "link do episódio para fora": JSON.stringify({ ...rEp, podcast: { ...rEp.podcast, href: "https://fora.org/x" } }),
  "capa com subida de pasta": JSON.stringify({ ...rEp, podcast: { ...rEp.podcast, capa: "../../segredo" } }),
  "aoVivo ausente": JSON.stringify({ ...rEp, aoVivo: undefined }),
  "título enorme": JSON.stringify({ ...rEp, titulo: "x".repeat(500) }),
};
for (const [nome, bruto] of Object.entries(formasErradas)) conferir(`forma errada não lê: ${nome}`, lerRetomada(bruto, agora) === null);
conferir("endereço público", enderecoPublico("https://a.org/x") && enderecoPublico("/audio/a.mp3") && !enderecoPublico("//a.org") && !enderecoPublico("data:audio/mp3;base64,AA") && !enderecoPublico(""));
conferir("faixa sem endereço público não grava", montarRetomada({ ...ao_vivo, url: "http://a.org" }, 0, agora) === null);
const devolvida = faixaDaRetomada(rEp);
conferir("faixa de volta (episódio)", devolvida.id === episodio.id && devolvida.url === episodio.url && devolvida.podcast?.episodio === "ep-1" && Array.isArray(devolvida.podcast?.picos) && !devolvida.live);
conferir("faixa de volta (ao vivo)", faixaDaRetomada(rVivo).live === true && !faixaDaRetomada(rVivo).podcast);

// O tocador grava ao pausar, a cada 10 s e no pagehide, e não toca sozinho.
const tocador = ler("components", "RadioPlayer.tsx");
const libRadio = ler("lib", "radio.ts");
conferir("tocador grava a cada 10 s e no pagehide", /retomada\.gravar/.test(tocador) && /setInterval\(gravar, 10000\)/.test(tocador) && /"pagehide"/.test(tocador));
conferir("o Continuar só retoma com um toque", /retomada\.retomar\(r\)/.test(tocador) && !/retomada\.retomar\([^)]*\)\s*;?\s*\n\s*\}\s*,\s*\[\]/.test(tocador));
conferir("retomar usa a posição de positions (sem duplicar)", /radio\.play\(\[faixaDaRetomada\(r\) as Track\], 0\)/.test(libRadio));
conferir("fechar o tocador descarta o Continuar", /close\(\) \{[\s\S]*?retomada\.descartar\(\)/.test(libRadio));
conferir("retomar atrás do recurso escola", /ligado\("escola"\)/.test(libRadio));

// ───────────── Som para estudar (R1-70) ─────────────
conferir("três tipos", TIPOS_DE_SOM.join() === "marrom,rosa,chuva");
conferir("volume no prefixo da Escola", CHAVE_DO_VOLUME.startsWith("lucia:escola:"));
const r1 = sorteio(3);
const r2 = sorteio(3);
conferir("sorteio com semente repete", Array.from({ length: 5 }, r1).join() === Array.from({ length: 5 }, r2).join());
for (const tipo of TIPOS_DE_SOM) {
  const { base, gotas } = amostrasDe(tipo, 8000);
  const todas = gotas ? [base, gotas] : [base];
  for (const a of todas) {
    let maior = 0;
    let finitas = true;
    for (const v of a) {
      if (!Number.isFinite(v)) finitas = false;
      maior = Math.max(maior, Math.abs(v));
    }
    conferir(`${tipo}: amostras finitas, sem estouro e com som`, finitas && maior <= 1 && maior > 0.3, `pico ${maior}`);
  }
  // Laço sem estalo: a última amostra emenda na primeira com um passo parecido com o passo médio do próprio som.
  let passos = 0;
  for (let i = 1; i < base.length; i++) passos += Math.abs(base[i] - base[i - 1]);
  const medio = passos / (base.length - 1);
  const emenda = Math.abs(base[0] - base[base.length - 1]);
  conferir(`${tipo}: laço sem estalo`, emenda <= medio * 6 + 0.02, `emenda ${emenda.toFixed(4)}, passo médio ${medio.toFixed(4)}`);
}
conferir("chuva tem as gotas", Boolean(amostrasDe("chuva", 8000).gotas));
const rampa = Float32Array.from({ length: 100 }, (_, i) => i);
const fechado = fecharLaco(rampa, 10);
conferir("fecharLaco encurta pela emenda", fechado.length === 90 && fechado[0] === rampa[90] && fechado[89] === rampa[89]);
conferir("normalizar", Math.max(...normalizar(Float32Array.from([0.1, -0.2]), 0.9).map(Math.abs)) === 0.9 || Math.abs(Math.max(...normalizar(Float32Array.from([0.1, -0.2]), 0.9).map(Math.abs)) - 0.9) < 1e-6);
conferir("marrom mais grave que rosa", (() => {
  const passo = (a) => a.reduce((s, v, i) => (i ? s + Math.abs(v - a[i - 1]) : 0), 0) / a.length;
  const m = normalizar(ruidoMarrom(8000, sorteio(1)));
  const p = normalizar(ruidoRosa(8000, sorteio(1)));
  return passo(m) < passo(p);
})());
conferir("com a voz, 30%", nivelDoSom(0.8, true) === 0.8 * NIVEL_COM_VOZ && NIVEL_COM_VOZ === 0.3 && nivelDoSom(0.8, false) === 0.8 && nivelDoSom(2, false) === 1);
conferir("volta depois da voz", esperaDepoisDaVoz(4, "") === 6500 && esperaDepoisDaVoz(0, "x".repeat(140)) === 12500 && esperaDepoisDaVoz(0, "") === 5500);
const libSom = ler("lib", "som-de-estudo.ts");
conferir("ouve a voz da aula", /"lucia:voz-falou"/.test(libSom));
conferir("nenhum arquivo de som baixado", !/fetch\(|\.mp3|\.ogg|\.wav|new Audio\(/.test(libSom));
const canal = ler("components", "radio", "SomDeEstudo.tsx");
conferir("o canal não liga sozinho (só no clique)", !/useEffect\([^)]*ligar/.test(canal) && /onClick=\{\(\) => tocar\(t\)\}/.test(canal));

// ───────────── Hoje no campus (R1-74) ─────────────
const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"];
const textos = Object.fromEntries(IDIOMAS.map((l) => [l, json("i18n", "escola", "som", `${l}.json`)]));
const dia = new Date(Date.UTC(2026, 10, 3, 12));
const aula = { titulo: "O que é o capitalismo", trilha: "O que é o capitalismo", resumo: "Mercadoria, trabalho assalariado e lucro: as três peças que explicam o sistema em que vivemos.", minutos: 12 };
const fato = (ano, texto, link = "https://pt.wikipedia.org/wiki/Teste") => ({ ano, texto, link });
const longo = "palavra ".repeat(140).trim();

for (const l of IDIOMAS) {
  const frases = textos[l].hoje.roteiro;
  const r = montarRoteiro({ data: dia, fatos: [fato(1959, "Triunfa a Revolução Cubana."), fato(1994, "Levante zapatista."), fato(2003, "Posse.")], aulaDaSemana: aula, idioma: l, frases });
  conferir(`${l}: roteiro com saudação, fatos, aula e fechamento`, r.partes.map((p) => p.tipo).join() === "saudacao,fatosAbre,fato,fato,fato,aula,fechamento");
  conferir(`${l}: cada fato diz a fonte`, r.partes.filter((p) => p.tipo === "fato").every((p) => p.texto.includes(frases.wikipedia) && p.link));
  conferir(`${l}: até 300 palavras`, r.palavras <= LIMITE_DE_PALAVRAS, String(r.palavras));
  conferir(`${l}: a data entra na saudação`, r.partes[0].texto.includes(dataPorExtenso(dia, l)));
  const enorme = montarRoteiro({ data: dia, fatos: [fato(1, longo), fato(2, longo), fato(3, longo)], aulaDaSemana: { ...aula, resumo: longo }, idioma: l, frases });
  conferir(`${l}: roteiro grande cortado em 300 palavras`, enorme.palavras <= LIMITE_DE_PALAVRAS && enorme.fatos.length >= 1, String(enorme.palavras));
  const semFatos = montarRoteiro({ data: dia, fatos: [], aulaDaSemana: aula, idioma: l, frases });
  conferir(`${l}: sem fato, fala só da aula`, semFatos.partes.map((p) => p.tipo).join() === "saudacao,aula,fechamento" && semFatos.fatos.length === 0);
  const nada = montarRoteiro({ data: dia, fatos: [], aulaDaSemana: null, idioma: l, frases });
  conferir(`${l}: sem fato e sem aula, só saudação e fechamento`, nada.partes.map((p) => p.tipo).join() === "saudacao,fechamento");
  conferir(`${l}: nenhuma marca {…} sobrando`, ![r, semFatos].some((x) => /\{\w+\}/.test(x.texto)));
}
const frasesPt = textos.pt.hoje.roteiro;
const semFonte = montarRoteiro({ data: dia, fatos: [fato(1, "Sem link", ""), fato(2, "Link http", "http://pt.wikipedia.org/wiki/X"), fato(3, "Link quebrado", "não é endereço"), fato(4, "Com fonte.")], aulaDaSemana: aula, idioma: "pt", frases: frasesPt });
conferir("nenhum fato sem fonte", semFonte.fatos.length === 1 && semFonte.fatos[0].ano === 4 && !semFonte.texto.includes("Sem link") && !semFonte.texto.includes("Link http"));
conferir("no máximo 3 fatos", montarRoteiro({ data: dia, fatos: [1, 2, 3, 4, 5].map((n) => fato(n, `Fato ${n}.`)), aulaDaSemana: aula, idioma: "pt", frases: frasesPt }).fatos.length === 3);
conferir("fonte de outro site é dita pelo nome", fonteDe("https://www.exemplo.org/x", frasesPt) === "o site exemplo.org" && fonteDe("https://pt.wikipedia.org/wiki/X", frasesPt) === "a Wikipédia");
conferir("contar palavras", contarPalavras("Olá, mundo! Tudo bem?") === 4 && contarPalavras("今天是十一月三日") === 5 && contarPalavras("— · —") === 0);
const curadoria = json("content", "neste-dia.json").fatos;
conferir("todo fato curado tem fonte https", curadoria.every((f) => fonteDe(f.link, frasesPt) === "a Wikipédia"), curadoria.filter((f) => fonteDe(f.link, frasesPt) !== "a Wikipédia").map((f) => f.dia).join());
conferir("fatos curados do dia (fuso de Brasília)", fatosCuradosDoDia([{ dia: "01-01" }, { dia: "12-31" }], new Date(Date.UTC(2027, 0, 1, 2))).map((f) => f.dia).join() === "12-31");
conferir("roteiro em português usa a lista curada", /fatosCuradosDoDia\(curados/.test(ler("components", "radio", "HojeNoCampus.tsx")) && /curadoria\.fatos/.test(ler("app", "[lang]", "radio", "page.tsx")));
conferir("Hoje no campus e Para estudar atrás do recurso escola", /ligado\("escola"\) \? textosDoSom\(lang\)/.test(ler("app", "[lang]", "radio", "page.tsx")));

// ───────────── Cordel da aula (R1-71) ─────────────
const lidos = lerFolhetosComErros(raiz);
conferir("há folhetos", lidos.length >= 1);
conferir(`no máximo ${MAX_FOLHETOS} folhetos`, lidos.length <= MAX_FOLHETOS, String(lidos.length));
const comecar = new Set(json("content", "comecar.json").flatMap((p) => p.aulas));
for (const { arquivo, folheto, erros } of lidos) {
  conferir(`${arquivo} válido`, erros.length === 0, erros.join("; "));
  conferir(`${arquivo}: aula do "Por onde começar"`, comecar.has(`${folheto.trilha}/${folheto.aula}`));
  conferir(`${arquivo}: a aula existe no endereço`, existeAula(`${folheto.trilha}/${folheto.aula}`));
  conferir(`${arquivo}: baseado_em é o arquivo da mesma aula`, path.basename(folheto.baseadoEm, ".md").replace(/^\d+-/, "") === folheto.aula);
  conferir(`${arquivo}: em rascunho até alguém revisar`, folheto.revisado || (emRascunho(folheto) && autoriaDe(folheto) === AUTORIA_RASCUNHO && !folheto.revisadoPor));
  conferir(`${arquivo}: não é atribuído à equipe sem revisão`, folheto.revisado || !/equipe|instituto/i.test(folheto.autoria));
  conferir(`${arquivo}: folheto achado pela rota`, folhetoDe(folheto.trilha, folheto.aula, raiz)?.titulo === folheto.titulo);
  for (const a of avisosDeRima(folheto)) avisos.push(`${arquivo}: ${a}`);
}
const modelo = (cabecalho, corpo) => `---\n${cabecalho}\n---\n\n${corpo}\n`;
const estrofe = "um\ndois\ntrês\nquatro\ncinco\nseis";
const cab = (extra = {}) =>
  Object.entries({ aula: '"t/a"', titulo: '"Título"', autoria: `"${AUTORIA_RASCUNHO}"`, revisado: "false", revisadoPor: '""', baseado_em: '"content/trilhas/t/a.md"', xilogravura: '"livro/sol/chao"', ...extra })
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
const existe = (c) => c === "content/trilhas/t/a.md";
const erros = (cabecalho, corpo = `${estrofe}\n\n${estrofe}`) => validarFolheto(lerFolheto(modelo(cabecalho, corpo), "content/cordel/t/a.md"), existe);
conferir("modelo válido", erros(cab()).length === 0, erros(cab()).join("; "));
conferir("estrofe com 5 versos", erros(cab(), "um\ndois\ntrês\nquatro\ncinco").some((e) => e.includes("5 versos")));
conferir("estrofe com 7 versos", erros(cab(), `${estrofe}\nsete`).some((e) => e.includes("7 versos")));
conferir("verso sem letra", erros(cab(), "um\ndois\n—\nquatro\ncinco\nseis").some((e) => e.includes("verso vazio")));
conferir("sem estrofes", erros(cab(), "").some((e) => e.includes("não tem estrofes")));
conferir("baseado_em inexistente", erros(cab({ baseado_em: '"content/trilhas/t/outra.md"' })).some((e) => e.includes("não existe")));
conferir("baseado_em de outra trilha", erros(cab({ baseado_em: '"content/trilhas/u/a.md"' })).some((e) => e.includes("da trilha t")));
conferir("baseado_em fora das trilhas", erros(cab({ baseado_em: '"../segredo.md"' })).length > 0);
conferir("sem baseado_em", erros(cab({ baseado_em: null })).length > 0);
conferir("aula do cabeçalho diferente do caminho", erros(cab({ aula: '"t/b"' })).some((e) => e.includes('"aula"')));
conferir("autoria atribuída sem revisão", erros(cab({ autoria: '"Equipe do Instituto"' })).some((e) => e.includes("rascunho")));
conferir("revisadoPor sem revisão", erros(cab({ revisadoPor: '"Fulana"' })).some((e) => e.includes("revisadoPor")));
conferir("revisado sem nome", erros(cab({ revisado: "true", autoria: '"Fulana"' })).some((e) => e.includes("revisadoPor")));
conferir("revisado com nome é válido", erros(cab({ revisado: "true", autoria: '"Fulana de Tal"', revisadoPor: '"Fulana de Tal"' })).length === 0);
conferir("revisado em texto", erros(cab({ revisado: '"sim"' })).some((e) => e.includes('"revisado"')));
conferir("xilogravura desconhecida", erros(cab({ xilogravura: '"dragao/sol/chao"' })).some((e) => e.includes("xilogravura")));
const rasc = lerFolheto(modelo(cab(), estrofe), "content/cordel/t/a.md");
conferir("faixa de rascunho quando revisado: false", emRascunho(rasc) && autoriaDe(rasc) === AUTORIA_RASCUNHO);
const revisado = lerFolheto(modelo(cab({ revisado: "true", autoria: '"Fulana de Tal"', revisadoPor: '"Fulana de Tal"' }), estrofe), "content/cordel/t/a.md");
conferir("sem faixa quando revisado", !emRascunho(revisado) && autoriaDe(revisado) === "Fulana de Tal");
conferir("estrofes com linhas em branco a mais e CRLF", estrofesDe("a\r\nb\r\n\r\n\r\nc\n  \nd").length === 3);
conferir("aviso de rima", avisosDeRima(lerFolheto(modelo(cab(), "um\nmão\ntrês\npão\ncinco\nchão"), "content/cordel/t/a.md")).length === 0 && avisosDeRima(lerFolheto(modelo(cab(), estrofe), "content/cordel/t/a.md")).length === 1);
const pagina = ler("app", "[lang]", "trilhas", "[track]", "[lesson]", "cordel", "page.tsx");
conferir("página do cordel: só português (308 nos outros)", /permanentRedirect\(localePath\(defaultLocale/.test(pagina) && /nosIdiomasDoTexto/.test(pagina));
conferir("página do cordel: faixa de rascunho e link da aula", /data-cordel-rascunho/.test(pagina) && /c\.abrirAula/.test(pagina));
conferir("página do cordel: atrás do recurso escola", /if \(!ligado\("escola"\)\) return null/.test(pagina));
conferir("LEIA-ME do cordel", fs.existsSync(path.join(raiz, "content", "cordel", "LEIA-ME.md")));

// ───────────── Textos ─────────────
const chaves = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? chaves(v, `${p}${k}.`) : [`${p}${k}`]));
const referencia = chaves(textos.pt).sort().join();
for (const l of IDIOMAS) conferir(`textos ${l} completos`, chaves(textos[l]).sort().join() === referencia);
conferir("texto honesto do som para estudar", textos.pt.som.honesto === "Sons feitos no seu aparelho. Músicas livres entram quando a curadoria conferir a licença.");

for (const a of avisos) console.log(`aviso: ${a}`);
if (falhas.length) {
  console.error(`testar:som — ${falhas.length} falha(s), ${ok} ok:`);
  for (const f of falhas) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`testar:som — ${ok} conferências ok.`);
