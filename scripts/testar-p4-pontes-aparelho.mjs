// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As peças do lote "pontes" que rodam no aparelho ou nas rotas do servidor (Node, sem rede): chamado por scripts/testar-p4-pontes.mjs
// (npm run testar:p4-pontes), depois das partes do banco. Cada parte prova o item e a regra de privacidade dele; nada aqui chama a
// rede (o teste principal troca o fetch por um que anota e recusa).
import { register } from "node:module";

// As rotas importam "next/server"; fora do Next, o Node só acha "next/server.js".
register("data:text/javascript," + encodeURIComponent(`
export async function resolve(especificador, contexto, proximo) {
  if (especificador === "next/server") return proximo("next/server.js", contexto);
  return proximo(especificador, contexto);
}`), import.meta.url);

export async function conferir({ ok, passa, parte, chamadas, ler, existe }) {
  // As peças do aparelho leem as flags da montagem (NEXT_PUBLIC_RECURSOS) ao carregar: aqui, com o lote ligado. O "desligado" é
  // conferido pela lista explícita (ligado(..., lista)) e pela leitura do código.
  process.env.NEXT_PUBLIC_RECURSOS = "rede-v2,alumia-2,alumia-p4-pontes";
  // ═══ 81. O ato como Event ═══
  await parte("81 (documento)", async () => {
    const doc = await import("../lib/rede/fediverso/documentos.ts");
    const end = await import("../lib/rede/fediverso/enderecos.ts");
    const { CHAVES_PROIBIDAS_NO_EVENTO } = await import("../lib/rede/p4/pontes/evento.ts");
    const e = end.enderecosDaFederacao("https://alumia.example");
    const base = { id: "11111111-1111-4111-8111-111111111111", tipo: "chamado", titulo: "Ato pela educação", texto: "Ato com bateria e faixa.", corpo: null, aviso: "",
      criado_em: "2026-11-27T12:00:00Z", editado_em: null, resposta_a: null, handle: "coletivo_ponte" };
    const ato = { titulo: "Ato pela educação", inicio: "2026-12-01T15:00:00Z", fim: null, onde: "Praça do Derby", cidade: "Recife", situacao: "cancelado", tipo: "ato" };
    for (const total of [false, true]) {
      const opcoes = { total, grupos: false };
      const nota = doc.documentoDoPost(e, base, true, opcoes);
      ok(`81: sem o ato (lote desligado), sai a Note de sempre (total=${total})`, nota.type === "Note" && !("startTime" in nota));
      const ev = doc.documentoDoPost(e, { ...base, ato }, true, opcoes);
      ok(`81: com o ato, sai Event com nome, começo e lugar (total=${total})`, ev.type === "Event" && ev.name === "Ato pela educação" && ev.startTime === "2026-12-01T15:00:00.000Z"
        && ev.location?.type === "Place" && ev.location.name === "Praça do Derby" && ev.location.address?.addressLocality === "Recife");
      ok(`81: a situação vai no iCalendar e a confirmação é só na Alumia (total=${total})`, ev["ical:status"] === "CANCELLED" && ev.joinMode === "external" && ev.externalParticipationUrl === e.paginaDoPost(base.id));
      ok(`81: nenhuma chave de quem vai ou de quantos (total=${total})`, CHAVES_PROIBIDAS_NO_EVENTO.every((c) => !(c in ev)) && !/participantCount|attendee|vou|total|meta/.test(JSON.stringify(ev)));
      ok(`81: o contexto leva os termos do evento (total=${total})`, JSON.stringify(ev["@context"]).includes("joinmobilizon.org/ns#"));
      const cria = doc.atividadeCreate(e, { ...base, ato }, opcoes);
      ok(`81: o Create leva o Event e o contexto com os termos (total=${total})`, cria.object.type === "Event" && JSON.stringify(cria["@context"]).includes("ical"));
      const muda = doc.atividadeUpdate(e, { ...base, ato }, new Date("2026-11-28T10:00:00Z"), opcoes);
      ok(`81: o Update também (total=${total})`, muda.object.type === "Event");
    }
    const ruim = doc.documentoDoPost(e, { ...base, ato: { ...ato, inicio: "ontem" } }, true, { total: false, grupos: false });
    ok("81: ato sem data válida não vira Event (sai a Note)", ruim.type === "Note");
  });

  // ═══ 82. A tela da mediação ═══
  await parte("82 (tela)", async () => {
    const tela = ler("components/painel/alumia/admin/Fediverso.tsx");
    ok("82: a lista de aprovados só aparece com o lote ligado", /pontesP4LigadoNoSite\(\) \? <ServidoresAprovados/.test(tela));
    const comp = ler("components/painel/alumia/admin/ServidoresAprovados.tsx");
    ok("82: a tela chama só as funções da mediação (lista, aprovar, modo)", /rede_p4_fed_aprovados_ver/.test(comp) && /rede_p4_fed_aprovar/.test(comp) && /rede_p4_fed_modo/.test(comp));
    ok("82: ligar o modo pede confirmação e avisa da lista vazia", /A lista está vazia/.test(comp) && /perigo: sim/.test(comp));
  });

  // ═══ 86. O aviso de ato no Telegram ═══
  await parte("86 (mensagem)", async () => {
    const { mensagemDoAto, quandoDoAto } = await import("../lib/rede/p4/pontes/telegram-ato.ts");
    const p = { post: "22222222-2222-4222-8222-222222222222", canal: "@canal", titulo: "Ato", texto: "Venham todas e todos.",
      ato: { titulo: "Ato pela educação", inicio: "2026-12-05T18:00:00Z", onde: "Praça do Derby", cidade: "Recife", situacao: "confirmado", motivo: "" } };
    const m = mensagemDoAto(p, "https://alumia.example/");
    ok(`86: o aviso traz o nome, a hora de Brasília, o ponto, a cidade e o endereço (${JSON.stringify(m)})`, m.startsWith("ATO: Ato pela educação\nQuando: ") && m.includes("15:00")
      && m.includes("Onde: Praça do Derby, Recife") && m.includes("Venham todas") && m.endsWith("https://alumia.example/pt/alumia/p/22222222-2222-4222-8222-222222222222"));
    ok("86: a hora é a de Brasília (18h UTC = 15h)", quandoDoAto("2026-12-05T18:00:00Z").includes("15:00"));
    const c = mensagemDoAto({ ...p, texto: "", ato: { ...p.ato, situacao: "cancelado", motivo: "chuva forte" } }, "https://alumia.example");
    ok("86: o cancelamento sai com o motivo e sem o texto de antes", c.startsWith("CANCELADO: Ato pela educação") && c.includes("Motivo: chuva forte") && !c.includes("Venham"));
    ok("86: sem o ato (ou sem o mínimo), nulo: sai como post comum", mensagemDoAto({ ...p, ato: null }, "https://a.example") === null && mensagemDoAto({ ...p, ato: { ...p.ato, inicio: "x" } }, "https://a.example") === null);
    const longo = mensagemDoAto({ ...p, texto: "a".repeat(5000) }, "https://alumia.example");
    ok("86: nunca passa do teto do Telegram", longo.length <= 4096);
    const rota = ler("app/api/rede/telegram/route.ts");
    ok("86: a rota usa o aviso de ato e só chama as mudanças com o lote ligado", /mensagemDoAto\(p, site\.url\) \?\? mensagemDoPost/.test(rota) && /if \(pontesP4Ligado\(\)\) \{[\s\S]*rede_p4_telegram_atos_pendentes/.test(rota));
    ok("86: a mensagem não leva campo de conta (autor, organização, quem vai)", !/autor|org\b|vou|total/.test(ler("lib/rede/p4/pontes/telegram-ato.ts").replace(/\/\/.*$/gm, "")));
  });

  // ═══ 83. Os cartões de vídeo e áudio de fora ═══
  await parte("83", async () => {
    const { lerNota } = await import("../lib/rede/fediverso/entrada/nota.ts");
    const { cartaoDeMidia } = await import("../lib/rede/p4/pontes/midia-de-fora.ts");
    const { pontesP4Ligado, pontesP4LigadoNoSite } = await import("../lib/rede/p4/pontes/ligado.ts");
    ok("83: o lote desligado (lista sem a flag) não liga nada", !pontesP4Ligado(new Set(["rede-v2", "alumia-2"])) && !pontesP4LigadoNoSite(new Set()) && pontesP4LigadoNoSite(new Set(["alumia-p4-pontes"])));
    const ator = "https://musica.example/federation/actors/ana";
    const faixa = { type: "Audio", id: "https://musica.example/federation/music/tracks/1", attributedTo: ator, to: ["https://www.w3.org/ns/activitystreams#Public"], name: "Canção da greve",
      url: [{ type: "Link", mediaType: "text/html", href: "https://musica.example/library/tracks/1" }, { type: "Link", mediaType: "audio/ogg", href: "https://musica.example/api/v1/listen/1" }],
      image: { type: "Image", url: "https://musica.example/media/capa.jpg", mediaType: "image/jpeg" } };
    const r = lerNota(faixa, ator);
    ok(`83: a faixa de áudio (Funkwhale) entra com o título, a capa e a marca de áudio (${JSON.stringify(r).slice(0, 200)})`, r.ok && r.nota.texto.startsWith("Canção da greve")
      && r.nota.midia.some((m) => m.tipo === "audio/ogg") && r.nota.midia.some((m) => m.tipo === "image/jpeg") && r.nota.url === "https://musica.example/library/tracks/1");
    const video = { type: "Video", id: "https://video.example/videos/watch/1", attributedTo: [{ type: "Person", id: "https://video.example/accounts/bia" }, { type: "Group", id: "https://video.example/video-channels/c" }],
      to: ["https://www.w3.org/ns/activitystreams#Public"], name: "Assembleia", content: "Gravação da assembleia", mediaType: "text/markdown",
      url: [{ type: "Link", mediaType: "text/html", href: "https://video.example/w/1" }], icon: [{ type: "Image", url: "https://video.example/thumb.jpg", mediaType: "image/jpeg" }],
      attachment: [{ type: "Video", mediaType: "video/mp4", url: "https://video.example/static/1.mp4" }] };
    const rv = lerNota(video, "https://video.example/accounts/bia");
    const cv = rv.ok && cartaoDeMidia({ midia: rv.nota.midia, servidor: "video.example", url: rv.nota.url });
    ok("83: o vídeo (PeerTube) vira cartão de vídeo com a página de origem", cv?.tipo === "video" && cv.servidor === "video.example" && cv.pagina === "https://video.example/w/1");
    const ca = cartaoDeMidia({ midia: r.nota.midia, servidor: "musica.example", url: r.nota.url });
    ok("83: a faixa vira cartão de áudio", ca?.tipo === "audio");
    ok("83: só imagem não é cartão; página que não é https não vira link", cartaoDeMidia({ midia: [{ tipo: "image/png", url: "/x" }], servidor: "a.example", url: null }) === null
      && cartaoDeMidia({ midia: [{ tipo: "video/mp4", url: "/x" }], servidor: "a.example", url: "http://a.example/v" })?.pagina === null);
    const comp = ler("components/rede/p4/pontes/CartaoDeMidiaDeFora.tsx");
    ok("83: o cartão nunca toca vídeo nem áudio de fora (nem imagem direta): só o link para a origem, com o aviso", !/<(video|audio|iframe|img|source|embed)\b/.test(comp) && /t\.midia\.aviso/.test(comp) && /referrerPolicy="no-referrer"/.test(comp));
    const proxy = ler("app/api/fediverso/midia/route.ts");
    ok("83: a rota-proxy continua servindo só imagem (o tipo conferido pelos bytes)", /buscarImagemDeFora/.test(proxy));
    const cartao = ler("components/rede/fediverso/CartaoRemoto.tsx");
    ok("83: o cartão só entra com o lote ligado; sem ele, o link de antes", /temOutraMidia && pontesP4Ligado\(\) \? <CartaoDeMidiaDeFora/.test(cartao) && /temOutraMidia && original && !pontesP4Ligado\(\)/.test(cartao));
  });

  // ═══ 131. A escolha na tela das preferências ═══
  await parte("131 (tela)", async () => {
    const tela = ler("components/rede/avisos/Tela.tsx");
    ok("131: a escolha aparece junto das notificações do aparelho, só com o lote ligado e fora da prévia", /pontesP4Ligado\(\) && !previa\(\) && <SoDeQuemSigo/.test(tela));
    const comp = ler("components/rede/p4/pontes/SoDeQuemSigo.tsx");
    ok("131: a tela só lê e grava a escolha da própria pessoa", /pontes\s*\.soSeguidos\(\)/.test(comp) && /soSeguidos\(sim\)/.test(comp) && !/usuario|handle|ator/.test(comp.replace(/\/\/.*$/gm, "")));
    ok("131: alvo de toque de 44 px", /min-h-11/.test(comp));
  });

  // ═══ 132. O botão na conversa ═══
  await parte("132 (tela)", async () => {
    const tela = ler("components/rede/conversa/TelaDaConversaAlumia.tsx");
    ok("132: o 'pouco útil' fica no '…' da resposta, só com o lote ligado, para quem entrou e não é a autora", /aberta && c\.logado && !p\.meu && !previa\(\) && pontesP4Ligado\(\) && <PoucoUtil/.test(tela));
    const comp = ler("components/rede/p4/pontes/PoucoUtil.tsx");
    ok("132: a tela só sabe o voto de quem lê (nenhum número)", /poucoUtilMeus\(\[post\]\)/.test(comp) && !/total|contagem|quantos|\bn\b:/.test(comp.replace(/\/\/.*$/gm, "")));
    ok("132: a regra (secreto, só a partir de 3, não some) está no texto do botão", /t\.poucoUtil\.ajuda/.test(comp));
  });

  // ═══ 133. O leitor de fios (a tela) ═══
  await parte("133 (tela)", async () => {
    const { paragrafosDoFio, textoDoFioParaOuvir } = await import("../lib/rede/p4/pontes/fio.ts");
    const { rotaNova } = await import("../lib/rede/rotas-novas.ts");
    const { ROTAS_DA_ALUMIA } = await import("../lib/rede/alumia.ts");
    const fio = { autor: "Pessoa AA", itens: [
      { id: "a", titulo: "História do bairro", texto: "Parte 1.\n\nO começo.", corpo: null, criado_em: "x" },
      { id: "b", titulo: null, texto: "Parte 2:   as casas.", corpo: "Mais um trecho.", criado_em: "y" }] };
    const b = paragrafosDoFio(fio);
    ok("133: cada parte vira um bloco, com o título e os parágrafos", b.length === 2 && b[0].titulo === "História do bairro" && b[0].linhas.join("|") === "Parte 1.|O começo." && b[1].linhas.join("|") === "Parte 2: as casas.|Mais um trecho.");
    ok("133: o texto para ouvir junta tudo, do começo ao fim", textoDoFioParaOuvir(fio).startsWith("História do bairro. Parte 1.") && textoDoFioParaOuvir(fio).endsWith("Mais um trecho."));
    const rota = rotaNova("fio-texto");
    ok("133: a rota nasce com a flag do lote, nunca indexada, no host próprio", rota?.flag === "alumia-p4-pontes" && rota.indexar === false && rota.caminho === "/fio/[id]" && ROTAS_DA_ALUMIA.includes("fio"));
    ok("133: a página dá 404 com id inválido e passa pela trava das rotas novas", /if \(!idOk\(id\) && !idDaPreviaOk\(id\)\) notFound\(\)/.test(ler("app/[lang]/alumia/fio/[id]/page.tsx")) && /PaginaNova nome="fio-texto"/.test(ler("app/[lang]/alumia/fio/[id]/page.tsx")));
    ok("133: o registro tem a tela", /"fio-texto": \{ componente: dynamic\(\(\) => import\("\.\/p4\/pontes\/TelaDoFio"\)/.test(ler("components/rede/registro.tsx")));
    const tela = ler("components/rede/p4/pontes/TelaDoFio.tsx");
    ok("133: a voz é só a do aparelho (escolherVoz pega a voz local) e nada mais é chamado além do fio", /escolherVoz\(s\.getVoices\(\), lang\)/.test(tela) && !/fetch\(/.test(tela) && (tela.match(/pontes\s*\.\w+/g) ?? []).every((x) => /\.fio$/.test(x.replace(/\s/g, ""))));
    ok("133: modo foco e botões de 44 px", /aria-pressed=\{foco\}/.test(tela) && /min-h-11/.test(tela));
    const conv = ler("components/rede/conversa/TelaDaConversaAlumia.tsx");
    ok("133: o 'Ler como texto' aparece na conversa só com o lote e quando a autora respondeu a si mesma", /pontesP4Ligado\(\) && post\.autor\.handle && dado\.respostas\.some\(\(r\) => r\.autor\.handle === post\.autor\.handle\)/.test(conv));
  });

  // ═══ 130. A busca nos salvos, só no aparelho ═══
  await parte("130", async () => {
    const { filtrarSalvos, juntarSalvos, termoValido, TETO_DA_BUSCA_NOS_SALVOS } = await import("../lib/rede/p4/pontes/busca-salvos.ts");
    const posts = Array.from({ length: 45 }, (_, i) => ({ id: `p${i}`, titulo: i === 7 ? "Assembleia da OCUPAÇÃO" : null, texto: i === 30 ? "Leitura sobre a ocupação do centro" : `Post ${i}`, corpo: i === 40 ? "corpo com Ocupacao" : null }));
    // O "servidor": só vê o cursor (a próxima página), nunca o termo.
    const pedidos = [];
    const buscar = async (cursor) => {
      pedidos.push(cursor);
      const i = Number(cursor);
      return { itens: posts.slice(i, i + 20), proximo: i + 20 < posts.length ? String(i + 20) : null };
    };
    const { itens, fim } = await juntarSalvos({ itens: posts.slice(0, 20), proximo: "20" }, buscar);
    ok("130: junta as páginas que faltam pelo caminho de sempre, sem repetir", itens.length === 45 && fim && new Set(itens.map((x) => x.id)).size === 45);
    ok("130: o servidor só recebe o cursor da página, nunca o termo", pedidos.every((c) => /^\d+$/.test(c)) && pedidos.length === 2);
    const achados = filtrarSalvos(itens, "ocupaçao");
    ok("130: acha no título, no texto e no corpo, sem acento e sem maiúscula", achados.map((x) => x.id).join() === "p7,p30,p40");
    ok("130: termo de menos de 2 letras não filtra", !termoValido(" a ") && filtrarSalvos(itens, "a").length === 45);
    const muito = Array.from({ length: 1000 }, (_, i) => ({ id: `q${i}`, texto: "x" }));
    const teto = await juntarSalvos({ itens: muito.slice(0, 20), proximo: "20" }, async (c) => ({ itens: muito.slice(Number(c), Number(c) + 50), proximo: String(Number(c) + 50) }));
    ok("130: para no teto (não baixa sem fim)", teto.itens.length === TETO_DA_BUSCA_NOS_SALVOS && !teto.fim);
    ok("130: nenhuma chamada à rede durante a busca", chamadas.length === 0);
    const comp = ler("components/rede/p4/pontes/BuscaNosSalvos.tsx");
    ok("130: a tela não manda o termo a lugar nenhum (só filtra no aparelho)", !/fetch\(|pontes\.|rpc\(|termo\s*[,)]\s*\)?\s*=>\s*buscar/.test(comp) && /filtrarSalvos\(/.test(comp) && /juntarSalvos\(base, buscar\)/.test(comp));
    const salvos = ler("components/rede/alumia/Salvos.tsx");
    ok("130: a busca só aparece com o lote ligado e para quem entrou (na prévia também: é só filtro no aparelho)", /ativo: pontesP4Ligado\(\) && situacao\.logado,/.test(salvos) && /const itens = busca\.achados \?\? daVez\?\.itens \?\? \[\]/.test(salvos));
    ok("130: o campo tem alvo de toque de 44 px e anuncia o resultado", /min-h-11/.test(comp) && /role="status"/.test(comp));
  });

  // ═══ 88. As legendas ao vivo, só no aparelho ═══
  await parte("88", async () => {
    const { legendasNoAparelho, legendarFaixa, juntarLegenda } = await import("../lib/rede/p4/pontes/legendas.ts");
    // Um reconhecedor de mentira, com e sem o modo local.
    const criados = [];
    class Local {
      constructor() { this.processLocally = false; criados.push(this); }
      start(faixa) { this.faixa = faixa; }
      stop() { this.parou = true; }
    }
    // Como no navegador: a propriedade do modo local mora no protótipo.
    Object.defineProperty(Local.prototype, "processLocally", { value: false, writable: true, configurable: true });
    Local.available = async ({ processLocally }) => (processLocally ? "available" : "unavailable");
    class SoDeFora {
      start() {}
      stop() {}
    }
    SoDeFora.available = async () => "available";
    ok("88: sem o modo local (o reconhecedor que manda o áudio para fora), a legenda não aparece", (await legendasNoAparelho("pt", SoDeFora)) === false && (await legendasNoAparelho("pt", null)) === false);
    ok("88: com o modo local garantido, aparece", (await legendasNoAparelho("pt", Local)) === true);
    let fimSemModo = "";
    legendarFaixa({ readyState: "live" }, "pt", () => undefined, (e) => (fimSemModo = e ?? ""), SoDeFora);
    ok("88: legendar sem o modo local nem liga", fimSemModo === "sem_legenda");
    const textos = [];
    const faixa = { readyState: "live" };
    const parar = legendarFaixa(faixa, "pt", (t, f) => textos.push([t, f]), () => undefined, Local);
    const r = criados.at(-1);
    ok("88: o reconhecedor nasce com processLocally ligado e recebe a faixa da sala", r.processLocally === true && r.faixa === faixa && r.lang === "pt-BR" && r.interimResults === true);
    r.onresult({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript: "boa noite" } }] });
    r.onresult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "boa noite a todas" } }] });
    ok("88: o texto chega à tela (provisório e final)", JSON.stringify(textos) === JSON.stringify([["boa noite", false], ["boa noite a todas", true]]));
    r.onend();
    ok("88: o navegador encerrou a fala longa: recomeça sozinho", criados.length === 2 && criados.at(-1).faixa === faixa);
    parar();
    const antes = criados.length;
    criados.at(-1).onend();
    ok("88: parar para de vez", criados.at(-1).parou === true && criados.length === antes);
    let l = [];
    l = juntarLegenda(l, { quem: "A", texto: "oi", final: false, em: 0 });
    l = juntarLegenda(l, { quem: "A", texto: "oi gente", final: true, em: 10 });
    l = juntarLegenda(l, { quem: "B", texto: "olá", final: true, em: 20 });
    ok("88: a fala provisória é trocada pela seguinte", l.map((x) => x.texto).join("|") === "oi gente|olá");
    l = juntarLegenda(l, { quem: "C", texto: "depois", final: true, em: 20_000 });
    ok("88: as legendas velhas somem (nada fica guardado)", l.map((x) => x.texto).join("|") === "depois");
    ok("88: nenhuma chamada à rede", chamadas.length === 0);
    const lib = ler("lib/rede/p4/pontes/legendas.ts").replace(/\/\/.*$/gm, "");
    ok("88: nada de webkitSpeechRecognition nem de rede no código das legendas", !/webkitSpeechRecognition|fetch\(|XMLHttpRequest|sendBeacon/.test(lib));
    const sala = ler("components/rede/voz/SalaDeVoz.tsx");
    ok("88: as legendas só entram com o lote ligado", /ligado\("alumia-p4-pontes"\) && <LegendasDaSala/.test(sala));
    ok("88: o botão diz que é ligar ou tirar (aria-pressed) e avisa sem suporte", /aria-pressed=\{ligadas\}/.test(ler("components/rede/p4/pontes/LegendasDaSala.tsx")) && /t\.legendas\.semSuporte/.test(ler("components/rede/p4/pontes/LegendasDaSala.tsx")));
  });

  // ═══ 87. A janela de Libras ═══
  await parte("87", async () => {
    const { estiloDaJanela, outroTamanho, LARGURA_DA_JANELA, LARGURA_MINIMA_PX } = await import("../lib/rede/p4/pontes/libras.ts");
    const e = estiloDaJanela("p", "esquerda");
    ok("87: a janela fica fixa num canto, por cima de tudo, longe da borda", e.position === "fixed" && e.left === "16px" && e.bottom === "16px" && !("right" in e) && Number(e.zIndex) >= 50);
    ok("87: nenhum tamanho fica abaixo da largura mínima", Object.keys(LARGURA_DA_JANELA).every((k) => estiloDaJanela(k, "direita").minWidth === `${LARGURA_MINIMA_PX}px`) && LARGURA_MINIMA_PX >= 160);
    ok("87: aumentar e diminuir param nas pontas", outroTamanho("g", true) === "g" && outroTamanho("p", false) === "p" && outroTamanho("m", true) === "g");
    const comp = ler("components/rede/p4/pontes/JanelaDeLibras.tsx");
    ok("87: a escolha fica só na tela (nada de banco, rede ou armazenamento)", !/localStorage|sessionStorage|indexedDB|fetch\(|rpc\(|pontes\./.test(comp.replace(/\/\/.*$/gm, "")));
    ok("87: sem animação (movimento reduzido) e botões de 44 px", !/transition|animate|animation/.test(comp) && /min-h-11 min-w-11/.test(comp));
    ok("87: o vídeo da janela é mudo (o som já toca na aula)", /<video[^>]*muted/.test(comp));
    const sala = ler("components/aovivo/Sala.tsx");
    ok("87: a janela entra na aula ao vivo só com o lote ligado", /pontesP4LigadoNoSite\(\) && videos\.length > 0 && <JanelaDeLibras/.test(sala));
  });

  // ═══ 85. A escolha da ponte com o Bluesky ═══
  await parte("85 (tela)", async () => {
    const mod = ler("components/rede/comunidades/Moderar.tsx");
    ok("85: a escolha fica nas ferramentas da moderação, só com o lote ligado", /pontesP4Ligado\(\) && <PonteBluesky slug=\{comunidade\.slug\}/.test(mod));
    const comp = ler("components/rede/p4/pontes/PonteBluesky.tsx");
    ok("85: a tela diz que a ponte está desligada por decisão do Instituto e só guarda a escolha", /t\.bluesky\.barrada/.test(comp) && /blueskyEscolher\(slug, sim\)/.test(comp) && !/brid\.gy|fetch\(/.test(comp.replace(/\/\/.*$/gm, "")));
    const fixo = ler("supabase/migracoes/20261110-fediverso-bloqueio-padrao.sql");
    ok("85: o bloqueio fixo do Bridgy Fed continua no arquivo de antes", /'brid\.gy', 'Bridgy Fed/.test(fixo));
    const migr = ler("supabase/migracoes/20261127-p4-pontes.sql").replace(/--.*$/gm, "");
    ok("85: a migração do lote não mexe no bloqueio fixo", !/(delete from|update)\s+(interno\.)?rede_fed_bloqueados/.test(migr));
  });
}
