// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o acompanhante do estudante (Etapa 4, E4-10) sem rede e sem navegador: o histórico só no aparelho (20
// conversas, 30 dias, nada no modo seguro), o pedido cortado nos limites da Edge Function, o modo sem servidor
// (responderLocal, trechos copiados das aulas), a lista pública de provedores igual à da função, a tarja gravada nos
// pixels, o filtro de nota da redação e as amarrações nas telas de outros pacotes.
// Uso: npm run testar:acompanhante
import { readFileSync, existsSync } from "node:fs";
import { aplicarTarjas, apagarConversas, CHAVE_CONVERSAS, CHAVE_TRABALHO, GUARDA, gravarConversa, gravarTrabalho, LIMITES, lerConversas, lerTrabalho, montarPedido, tirarNotas, validarConversa } from "../lib/escola/acompanhante.ts";
import { buscaDasAulas, melhorTrecho, QUANTOS, responderLocal, termosDe } from "../lib/escola/respostas-locais.ts";
import { LIMITE_PADRAO, limiteDoEstado, PROVEDORES_PUBLICOS } from "../lib/escola/provedores-publicos.ts";
import { LIMITES_DO_ACOMPANHANTE, validarEntrada } from "../supabase/functions/assistente/assistente.ts";
import { areaDoCaminho } from "../lib/interdicao.ts";

let certos = 0;
const falhas = [];
const confere = (nome, condicao, detalhe = "") => (condicao ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
const igual = (nome, valor, esperado) => confere(nome, JSON.stringify(valor) === JSON.stringify(esperado), `veio ${JSON.stringify(valor)?.slice(0, 200)}, esperado ${JSON.stringify(esperado)?.slice(0, 200)}`);
const ler = (arquivo) => readFileSync(new URL(`../${arquivo}`, import.meta.url), "utf8");

/** Um localStorage/sessionStorage de mentira. */
function armazenamento(inicial = {}) {
  const m = new Map(Object.entries(inicial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    get length() {
      return m.size;
    },
    key: (i) => [...m.keys()][i] ?? null,
    mapa: m,
  };
}

const DIA = 24 * 60 * 60 * 1000;
const agora = Date.UTC(2026, 10, 3, 12);
const conversa = (i, atualizada = agora - i * 1000) => ({ id: `c-${String(i).padStart(4, "0")}`, modo: "socratico", titulo: `Conversa ${i}`, criada: atualizada, atualizada, falas: [{ de: "pessoa", texto: `pergunta ${i}`, em: atualizada }, { de: "assistente", texto: `resposta ${i}`, em: atualizada }] });

// ── Histórico só no aparelho ──
{
  const local = armazenamento();
  const sessao = armazenamento();
  for (let i = 25; i >= 1; i--) gravarConversa(conversa(i), { armazenamento: local, sessao, agora });
  const lidas = lerConversas(local, agora);
  igual("no máximo 20 conversas", lidas.length, GUARDA.conversas);
  igual("ficam as mais novas, da mais nova para a mais velha", [lidas[0].id, lidas.at(-1).id], ["c-0001", "c-0020"]);
  confere("a mais velha sai", !lidas.some((c) => c.id === "c-0021"));
  gravarConversa({ ...conversa(5), titulo: "Atualizada", atualizada: agora + 10 }, { armazenamento: local, sessao, agora: agora + 10 });
  igual("gravar de novo o mesmo id atualiza, sem repetir", [lerConversas(local, agora + 10).filter((c) => c.id === "c-0005").length, lerConversas(local, agora + 10)[0].titulo], [1, "Atualizada"]);

  const velhas = armazenamento();
  gravarConversa(conversa(1, agora - 31 * DIA), { armazenamento: velhas, sessao, agora: agora - 31 * DIA });
  gravarConversa(conversa(2, agora - 29 * DIA), { armazenamento: velhas, sessao, agora: agora - 29 * DIA });
  igual("conversa de mais de 30 dias não volta", lerConversas(velhas, agora).map((c) => c.id), ["c-0002"]);
  gravarConversa(conversa(3), { armazenamento: velhas, sessao, agora });
  igual("e sai do aparelho na gravação seguinte", JSON.parse(velhas.getItem(CHAVE_CONVERSAS)).map((c) => c.id), ["c-0003", "c-0002"]);

  const segura = armazenamento({ "lucia-seguro": "1" });
  const limpo = armazenamento();
  igual("modo seguro: não grava conversa", gravarConversa(conversa(1), { armazenamento: limpo, sessao: segura, agora }), false);
  igual("modo seguro: não grava o trabalho", gravarTrabalho("pedreiro", { armazenamento: limpo, sessao: segura }), false);
  igual("modo seguro: o aparelho fica vazio", limpo.length, 0);

  apagarConversas("c-0003", velhas);
  igual("apagar uma conversa", lerConversas(velhas, agora).map((c) => c.id), ["c-0002"]);
  apagarConversas(undefined, velhas);
  igual("apagar tudo", [velhas.getItem(CHAVE_CONVERSAS), lerConversas(velhas, agora).length], [null, 0]);

  igual("as chaves ficam no prefixo privado da Escola (fora da cópia, saem no apagar)", [CHAVE_CONVERSAS, CHAVE_TRABALHO], ["lucia:escola-privado:conversas", "lucia:escola-privado:trabalho"]);
  const t = armazenamento();
  gravarTrabalho("  motorista   de aplicativo  ", { armazenamento: t, sessao });
  igual("trabalho lembrado, limpo", lerTrabalho(t), "motorista de aplicativo");
  gravarTrabalho("x".repeat(200), { armazenamento: t, sessao });
  igual("trabalho cortado em 80", lerTrabalho(t).length, 80);
  gravarTrabalho("", { armazenamento: t, sessao });
  igual("trabalho vazio apaga", t.getItem(CHAVE_TRABALHO), null);

  igual("conversa estranha é descartada", [validarConversa({ id: "x", modo: "socratico" }), validarConversa({ ...conversa(1), modo: "outro" }), validarConversa([1])], [null, null, null]);
  igual("armazenamento quebrado vira lista vazia", lerConversas(armazenamento({ [CHAVE_CONVERSAS]: "{quebrado" }), agora), []);
  const muitas = { ...conversa(1), falas: Array.from({ length: 60 }, (_, i) => ({ de: "pessoa", texto: `f${i}`, em: agora })) };
  igual("no máximo 40 falas por conversa (as mais recentes)", validarConversa(muitas).falas.length, GUARDA.falas);
}

// ── O pedido, cortado nos limites da Edge Function ──
{
  igual("limites iguais aos da Edge Function", Object.fromEntries(Object.keys(LIMITES_DO_ACOMPANHANTE).map((k) => [k, LIMITES[k]])), LIMITES_DO_ACOMPANHANTE);
  const falas = Array.from({ length: 12 }, (_, i) => ({ de: i % 2 ? "assistente" : "pessoa", texto: `${i}:`.padEnd(1800, "y") }));
  const pedido = montarPedido({ modo: "socratico", pergunta: "  e agora?  ", idioma: "pt", falas, contexto: { aula: "biologia/celula", trecho: "t".repeat(3000), nivel: 7, idiomaAlvo: "de", trabalho: "" } });
  confere("histórico com até 8 falas", pedido.historico.length <= 8);
  confere("cada fala com até 1500", pedido.historico.every((f) => f.texto.length <= 1500));
  confere("histórico com até 6000 no total", pedido.historico.reduce((s, f) => s + f.texto.length, 0) <= 6000);
  igual("ficam as falas mais recentes", pedido.historico.at(-1).texto.split(":")[0], "11");
  igual("contexto cortado e sem o que não vale", pedido.contexto, { aula: "biologia/celula", trecho: "t".repeat(1200) });
  igual("pergunta sem espaços sobrando", pedido.pergunta, "e agora?");
  confere("a Edge Function aceita o pedido montado", "entrada" in validarEntrada(pedido));
  const semNada = montarPedido({ modo: "conversa", pergunta: "Hi", idioma: "en", contexto: { idiomaAlvo: "en" } });
  confere("sem histórico, o campo nem vai", !("historico" in semNada) && semNada.contexto.idiomaAlvo === "en");
  igual("redação vai até 2800", montarPedido({ modo: "redacao", pergunta: "r".repeat(5000), idioma: "pt" }).pergunta.length, 2800);
  confere("o pedido não leva disciplina nem aulas inventadas", semNada.disciplina === "" && semNada.aulas.length === 0);
}

// ── Modo sem servidor: trechos das aulas, sem IA ──
{
  const textoFoto = "A fotossíntese acontece nas folhas. A clorofila absorve a luz do sol e a planta produz glicose a partir de água e gás carbônico. O oxigênio sai pelas folhas.";
  const indice = [
    { kind: "aula", title: "Fotossíntese", href: "/trilhas/biologia/fotossintese", area: "Biologia", context: "Biologia", text: textoFoto },
    { kind: "aula", title: "Respiração celular", href: "/trilhas/biologia/respiracao", area: "Biologia", context: "Biologia", text: "A respiração celular usa a glicose e o oxigênio para liberar energia. A fotossíntese faz o caminho contrário." },
    { kind: "aula", title: "Cadeia alimentar", href: "/trilhas/biologia/cadeia", area: "Biologia", context: "Biologia", text: "As plantas fazem fotossíntese e são produtoras na cadeia alimentar." },
    { kind: "aula", title: "Ecologia", href: "/trilhas/biologia/ecologia", area: "Biologia", context: "Biologia", text: "A fotossíntese sustenta quase toda a vida na Terra." },
    { kind: "verbete", title: "Fotossíntese (glossário)", href: "/glossario#fotossintese", area: "", context: "", text: "Fotossíntese é o processo das plantas." },
    { kind: "aula", title: "Frações", href: "/trilhas/matematica/fracoes", area: "Matemática", context: "Matemática", text: "Uma fração divide o inteiro em partes iguais." },
  ];
  const r = responderLocal("Não entendi o que a clorofila faz na fotossíntese", indice);
  confere("até 3 trechos", r.length > 0 && r.length <= QUANTOS, `${r.length}`);
  igual("o primeiro é a aula que mais casa", r[0]?.href, "/trilhas/biologia/fotossintese");
  confere("só aulas (nada do glossário)", r.every((t) => t.href.startsWith("/trilhas/")));
  confere("o trecho é copiado da aula, sem mudar palavra", r.every((t) => indice.find((e) => e.href === t.href).text.replace(/\s+/g, " ").includes(t.trecho.replace(/^…/, "").replace(/…$/, ""))));
  confere("o trecho começa na frase que casa", r[0].trecho.includes("clorofila"));
  igual("sem casamento, nada (em vez de inventar)", responderLocal("xilofone quântico", indice), []);
  igual("dúvida só de palavras vazias, nada", responderLocal("o que é isso?", indice), []);
  igual("busca montada uma vez serve de novo", responderLocal("frações iguais", buscaDasAulas(indice))[0]?.href, "/trilhas/matematica/fracoes");
  igual("termos sem acento e sem as palavras vazias", termosDe("Não entendi o que é a FOTOSSÍNTESE"), ["fotossintese"]);
  const longo = Array.from({ length: 40 }, (_, i) => `Frase número ${i} sobre outro assunto.`).join(" ") + " Aqui fala de mitocôndria e energia.";
  const t = melhorTrecho(longo, ["mitocondria"]);
  confere("trecho de até ~320 caracteres, com reticências", t.length <= 330 && t.startsWith("…") && t.includes("mitocôndria"));
}

// ── Transparência: a lista pública é a da Edge Function ──
{
  const fonte = ler("supabase/functions/assistente/provedores.ts");
  const daFuncao = [...fonte.matchAll(/\{ id: "([^"]+)", nome: "([^"]+)",[^\n]*?visao: (true|false)/g)].map((m) => ({ id: m[1], nome: m[2], visao: m[3] === "true" }));
  confere("a função lista provedores", daFuncao.length >= 1);
  igual("lista pública de provedores igual à da Edge Function", PROVEDORES_PUBLICOS, daFuncao);
  const sql = ler("supabase/install.sql");
  const padrao = sql.match(/'\{"ligado": false, "por_pessoa": (\d+), "por_dia": (\d+)\}'::jsonb/);
  igual("limite padrão igual ao de interno.assistente_config()", padrao && { porPessoa: Number(padrao[1]), porDia: Number(padrao[2]) }, { ...LIMITE_PADRAO });
  igual("limite do banco só quando vier número válido", [limiteDoEstado({ ligado: true }), limiteDoEstado({ por_pessoa: 7 }), limiteDoEstado({ por_pessoa: "7" }), limiteDoEstado(null)], [null, 7, null, null]);
}

// ── A tarja muda os pixels (não é camada por cima) ──
{
  const largura = 10;
  const altura = 6;
  const dados = new Uint8ClampedArray(largura * altura * 4).fill(200);
  const copia = new Uint8ClampedArray(dados);
  const mudou = aplicarTarjas(dados, largura, altura, [{ x: 2, y: 1, w: 3, h: 2 }]);
  igual("pixels cobertos", mudou, 6);
  const px = (x, y) => [...dados.slice((y * largura + x) * 4, (y * largura + x) * 4 + 4)];
  igual("pixel coberto vira preto opaco", px(3, 2), [0, 0, 0, 255]);
  igual("pixel de fora fica igual", px(0, 0), [200, 200, 200, 200]);
  confere("os dados mudaram de verdade", dados.some((v, i) => v !== copia[i]));
  igual("tarja desenhada ao contrário (de baixo para cima) também vale", aplicarTarjas(new Uint8ClampedArray(largura * altura * 4).fill(9), largura, altura, [{ x: 5, y: 3, w: -3, h: -2 }]), 6);
  igual("tarja que passa da borda é cortada", aplicarTarjas(new Uint8ClampedArray(largura * altura * 4).fill(9), largura, altura, [{ x: 8, y: 4, w: 10, h: 10 }]), 4);
}

// ── Redação: sem nota ──
{
  const com = "**Competência 1: Escrever na norma formal**\n- Ponto forte: frases claras.\nNota estimada: 160 pontos\nNível 4 nesta competência\n- A melhorar: vírgulas.\nTotal: 880/1000";
  const r = tirarNotas(com);
  confere("tira as linhas com nota, pontos, nível e x/1000", r.tirou && !/160|880|Nível 4/.test(r.texto));
  confere("mantém o comentário", r.texto.includes("Ponto forte: frases claras.") && r.texto.includes("A melhorar: vírgulas."));
  igual("texto sem nota fica igual", tirarNotas("Bom uso de conectivos.\nRevise a proposta de intervenção."), { texto: "Bom uso de conectivos.\nRevise a proposta de intervenção.", tirou: false });
}

// ── Amarrações nas telas ──
{
  const B = "app/[lang]/escola/acompanhante";
  for (const pagina of ["page.tsx", "redacao/page.tsx", "documento/page.tsx", "conversa/page.tsx", "como-funciona/page.tsx"]) confere(`página ${pagina} existe`, existsSync(new URL(`../${B}/${pagina}`, import.meta.url)));
  confere("a entrada não é mais provisória", !ler(`${B}/page.tsx`).includes("EmConstrucao"));
  for (const caminho of ["/escola/acompanhante", "/escola/acompanhante/redacao", "/escola/acompanhante/documento", "/escola/acompanhante/conversa", "/escola/acompanhante/como-funciona"]) igual(`${caminho} está na interdição`, areaDoCaminho(caminho), "estudo");
  confere("o Não entendi está na faixa da aula", /<NaoEntendi aula=\{aula\}/.test(ler("components/aula/BarraDaAula.tsx")));
  confere("a página da aula não foi editada por este pacote", !ler("app/[lang]/trilhas/[track]/[lesson]/page.tsx").includes("acompanhante"));
  const ex = ler("components/estudo/Exercicio.tsx");
  confere("a pista entra no exercício só depois do erro e com a Escola", /primeira === false && !fechado && ligado\("escola"\) && <PistasDoExercicio/.test(ex));
  confere("a Oficina de Redação não muda (sem acompanhante)", !ler("components/enem/OficinaDeRedacao.tsx").includes("acompanhante"));
  const doc = ler("components/escola/acompanhante/LeitorDeDocumento.tsx");
  confere("documento: a foto só depois do aviso", doc.indexOf("{entendeu && (") > doc.indexOf("d.aviso") && /\{entendeu && foto && \(/.test(doc));
  confere("documento: vai a imagem riscada", doc.includes("imagem={riscada?.imagem ?? null}"));
  confere("a tarja grava nos pixels", ler("components/escola/acompanhante/Tarja.tsx").includes("aplicarTarjas(copia.data"));
  const conversa = ler("components/escola/acompanhante/Conversa.tsx");
  confere("o aviso do que vai fica antes do botão", conversa.indexOf("<AvisoDoQueVai") < conversa.indexOf('type="submit"'));
  confere("toda tela usa o selo do assistente", conversa.includes("SELOS_DE_FORA.assistente"));
  confere("a resposta usa o RespostaDoAssistente (com o aviso de resposta automática)", conversa.includes("<RespostaDoAssistente"));
  for (const lang of ["pt", "en", "es", "fr", "ru", "zh"]) {
    const t = JSON.parse(ler(`i18n/escola/acompanhante/${lang}.json`));
    confere(`${lang}: o aviso diz que os servidores ficam fora do Brasil`, /Brasil|Brazil|Brasil|Brésil|Бразил|巴西/.test(t.comum.oQueVai));
    confere(`${lang}: Como funciona cita o art. 33 da LGPD`, /33/.test(t.como.lei) && /13[.,]?709/.test(t.como.lei));
  }
}

console.log(`acompanhante: ${certos} conferências certas, ${falhas.length} com problema.`);
for (const falha of falhas) console.log(`  ✗ ${falha}`);
process.exit(falhas.length ? 1 : 0);
