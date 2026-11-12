// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a revisão da casca da Alumia (10/11): os dublês da prévia do chat privado (lib/rede/chat-exemplos.ts) e dos núcleos
// (lib/rede/nucleos-exemplos.ts), os atos embutidos nos posts de exemplo (lib/rede/atos/exemplos.ts), o Sair rápido para uma
// página DE FORA (lib/rede/saida.ts), o título de cada tela (lib/rede/textos.ts) e, lendo o código, o painel "Mais" do celular,
// o menu da conta com ícones e idiomas em grade, o aviso único de prévia e o tema sempre escuro. Sem banco: nada aqui muda o SQL.
// Uso: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --disable-warning=DEP0205 --import ./scripts/carregar-ts.mjs scripts/testar-alumia-casca.mjs
import fs from "node:fs";
import { criarDubleDoChat, EU_DA_PREVIA_NO_CHAT } from "../lib/rede/chat-exemplos.ts";
import { criarDubleDosNucleos, NUCLEOS_DE_EXEMPLO } from "../lib/rede/nucleos-exemplos.ts";
import { atoDeExemploRegistrado, criarDuble, registrarAtoDeExemplo } from "../lib/rede/atos/exemplos.ts";
import { DESTINO_DA_SAIDA } from "../lib/rede/saida.ts";
import { idOk } from "../lib/rede/tipos.ts";
import { postsDeExemplo } from "../lib/rede/publicar/exemplos-alumia2.ts";

let certos = 0;
const falhas = [];
function ok(nome, cond) {
  if (cond) certos++;
  else falhas.push(nome);
}
function lanca(nome, fazer, codigo) {
  try {
    fazer();
    falhas.push(`${nome}: não recusou`);
  } catch (e) {
    ok(nome, !codigo || e.message === codigo || e.code === codigo);
  }
}
const ler = (...p) => fs.readFileSync(new URL(`../${p.join("/")}`, import.meta.url), "utf8");

// ───── Chat privado na prévia ─────
{
  const d = criarDubleDoChat(Date.parse("2026-11-10T12:00:00Z"));
  const sit = d.rede_dm_situacao();
  ok("chat: eu da prévia e chave já ativa", sit.eu === EU_DA_PREVIA_NO_CHAT && sit.chave !== null);
  ok("chat: um pedido recebido e mensagens novas contadas", sit.pedidos === 1 && sit.novas === 2);
  const lista = d.rede_dm_conversas();
  ok("chat: lista em ordem da última mensagem", lista.length === 4 && lista.every((c, i) => i === 0 || lista[i - 1].ultima_em >= c.ultima_em));
  ok("chat: só codinomes (nenhum e-mail, nenhum telefone)", lista.every((c) => !/@|\d{4,}/.test(c.com.codinome)));
  const msgs = d.rede_dm_mensagens({ p_conversa: "exemplo-dm-rosa" });
  ok("chat: a conversa aberta tem mensagens dos dois lados", msgs.length === 5 && msgs.some((m) => m.autor === EU_DA_PREVIA_NO_CHAT) && msgs.some((m) => m.autor !== EU_DA_PREVIA_NO_CHAT));
  ok("chat: abrir a conversa zera as não lidas", d.rede_dm_conversas().find((c) => c.id === "exemplo-dm-rosa").nao_lidas === 0);
  const env = d.rede_dm_enviar({ p_conversa: "exemplo-dm-lia", p_corpo: "Até sábado!" });
  ok("chat: enviar guarda a mensagem com prazo para sumir", env.id && Date.parse(env.expira_em) > Date.parse(env.criado_em));
  lanca("chat: mensagem vazia recusada", () => d.rede_dm_enviar({ p_conversa: "exemplo-dm-lia", p_corpo: "   " }), "dm_vazia");
  lanca("chat: conversa desconhecida recusada", () => d.rede_dm_mensagens({ p_conversa: "nao-existe" }), "dm_nao_encontrada");
  lanca("chat: escrever em pedido ainda não aceito recusado", () => d.rede_dm_enviar({ p_conversa: "exemplo-dm-sara", p_corpo: "oi" }), "dm_fechada");
  const aceita = d.rede_dm_responder({ p_conversa: "exemplo-dm-sara", p_aceitar: true });
  ok("chat: aceitar o pedido abre a conversa", aceita.situacao === "aberta" && aceita.pode_escrever);
  const novo = d.rede_dm_abrir({ p_handle: "@NovaPessoa" });
  ok("chat: abrir por @ cria um pedido enviado", novo.situacao === "pedido" && novo.pedi === true);
  lanca("chat: @ inválido recusado", () => d.rede_dm_abrir({ p_handle: "a b" }), "dm_handle");
  d.rede_dm_denunciar({ p_conversa: "exemplo-dm-cohab", p_categoria: "spam", p_bloquear: true });
  lanca("chat: denunciar com bloqueio fecha a conversa", () => d.rede_dm_enviar({ p_conversa: "exemplo-dm-cohab", p_corpo: "oi" }), "dm_fechada");
  ok("chat: apagar tudo esvazia a lista", d.rede_dm_apagar_tudo().conversas >= 4 && d.rede_dm_conversas().length === 0);
  const chaveiro = ler("lib", "rede", "chat-chaveiro.ts");
  ok("chat: a cifra só é pulada com a prévia ligada", /PREVIA_DO_CHAT = process\.env\.NEXT_PUBLIC_ALUMIA_PREVIA === "sim"/.test(ler("lib", "rede", "cliente-chat.ts")) && (chaveiro.match(/if \(PREVIA_DO_CHAT\)/g) ?? []).length >= 5);
}

// ───── Núcleos e turma na prévia ─────
{
  const d = criarDubleDosNucleos(Date.parse("2026-11-10T12:00:00Z"), "2026-11");
  const lista = d.rede_com_nucleos().itens;
  ok("núcleos: dois núcleos com id em forma de uuid (a tela confere o id)", lista.length === 2 && lista.every((n) => idOk(n.id)));
  const pag = d.rede_com_nucleo({ p_id: NUCLEOS_DE_EXEMPLO.itaquera });
  ok("núcleos: mediação por codinome e encontros só em lugar público, em ordem", pag.mediacao.length === 2 && pag.encontros.length === 2 && pag.encontros[0].quando <= pag.encontros[1].quando && pag.encontros.every((e) => e.local_tipo !== "outro"));
  ok("núcleos: o mural tem posts do núcleo", d.rede_com_nucleo_linha({ p_id: NUCLEOS_DE_EXEMPLO.itaquera }).itens.every((p) => p.publico === "nucleo"));
  const novo = d.rede_com_encontro_salvar({ p: { nucleo: NUCLEOS_DE_EXEMPLO.itaquera, quando: "2026-11-20T22:00:00Z", local_tipo: "biblioteca", local_texto: "Sala 3" } });
  ok("núcleos: a mediação marca encontro", d.rede_com_nucleo({ p_id: NUCLEOS_DE_EXEMPLO.itaquera }).encontros.some((e) => e.id === novo.id));
  lanca("núcleos: quem é só membro não marca encontro", () => d.rede_com_encontro_salvar({ p: { nucleo: NUCLEOS_DE_EXEMPLO.ufpe, quando: "2026-11-20T22:00:00Z", local_tipo: "praca", local_texto: "" } }), "sem_permissao");
  ok("turma: inscrita e ainda fora; entrar leva à comunidade da turma", d.rede_com_turma().inscrito && !d.rede_com_turma().entrou && d.rede_com_turma_entrar().slug === "marxismo" && d.rede_com_turma().entrou);
  d.rede_com_nucleo_sair({ p_id: NUCLEOS_DE_EXEMPLO.ufpe });
  ok("núcleos: sair tira o núcleo da lista", d.rede_com_nucleos().itens.length === 1);
  lanca("núcleos: núcleo de que saiu não abre", () => d.rede_com_nucleo({ p_id: NUCLEOS_DE_EXEMPLO.ufpe }), "nao_encontrado");
}

// ───── Atos embutidos nos posts de exemplo ─────
{
  const duble = criarDuble();
  lanca("atos: id de exemplo desconhecido ainda é 'não encontrado'", () => duble.rede_ato({ p_id: "exemplo-qualquer" }), "nao_encontrado");
  const rosa = postsDeExemplo().find((p) => p.id === "exemplo-rosa");
  ok("atos: o post da Rosa traz um chamado embutido", Boolean(rosa?.chamado?.quando));
  registrarAtoDeExemplo({ id: rosa.id, titulo: rosa.chamado.tipo, palavra: "", comunidade: { slug: rosa.comunidade, nome: rosa.comunidade }, chamado_por: "rosavermelha", inicio: rosa.chamado.quando, inicio_anterior: null, onde: rosa.chamado.onde, cidade: "", descricao: rosa.texto, situacao: "confirmado", motivo: "", acesos: null, total: null, vou_eu: false, meu: false, respostas: 14, link_apoio: null }, 12);
  ok("atos: registrado, o dublê acha o ato embutido", atoDeExemploRegistrado("exemplo-rosa") && duble.rede_ato({ p_id: "exemplo-rosa" }).titulo === "Panfletagem no RU");
  ok("atos: a página mostra o NOME da comunidade, não o slug", duble.rede_ato({ p_id: "exemplo-rosa" }).comunidade?.nome === "Estudantes UFPE");
  ok("atos: proporção agregada (passos de 10 %, nunca número de pessoas)", [null, 0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].includes(duble.rede_ato({ p_id: "exemplo-rosa" }).acesos));
  ok("atos: o ato embutido não entra na lista de atos das pranchas", !duble.rede_atos({ p_filtro: "seguindo" }).itens.some((a) => a.id === "exemplo-rosa"));
  const r = duble.rede_ato_vou({ p_id: "exemplo-rosa", p_sim: true });
  ok("atos: o Você vai funciona no ato embutido", r.vou_eu === true);
  lanca("atos: só ids 'exemplo-' entram como avulsos", () => {
    registrarAtoDeExemplo({ ...duble.rede_ato({ p_id: "exemplo-rosa" }), id: "0e1b6c1a-0000-4000-8000-000000000000" });
    duble.rede_ato({ p_id: "0e1b6c1a-0000-4000-8000-000000000000" });
  }, "nao_encontrado");
  const tipos = ler("lib", "rede", "tipos.ts");
  ok("rotas: ids de exemplo só passam com a prévia ligada", /idDaPreviaOk = \(s: string\): boolean => process\.env\.NEXT_PUBLIC_ALUMIA_PREVIA === "sim" &&/.test(tipos));
  for (const rota of ["p", "ato"]) ok(`rotas: /${rota}/[id] aceita o id de exemplo`, ler("app", "[lang]", "alumia", rota, "[id]", "page.tsx").includes("!idOk(id) && !idDaPreviaOk(id)"));
}

// ───── Sair rápido, títulos e a casca ─────
{
  ok("sair rápido: vai para uma página DE FORA, sem nada do Instituto", /^https:\/\//.test(DESTINO_DA_SAIDA) && !/lucia|alumia/i.test(DESTINO_DA_SAIDA));
  const casca = ler("components", "rede", "publicar", "alumia2", "CascaDaAlumia2.tsx");
  ok("sair rápido: as duas cascas usam o destino de fora", casca.includes("sairRapidoDaRede(DESTINO_DA_SAIDA, ENCAIXES.aoSairRapido)") && ler("components", "rede", "Casca.tsx").includes("sairRapidoDaRede(DESTINO_DA_SAIDA, ENCAIXES.aoSairRapido)"));
  const textos = ler("lib", "rede", "textos.ts");
  ok("títulos: tituloDaTela monta 'Tela · Alumia'", /return `\$\{s\.menu\[tela\]\} · \$\{s\.marca\}`/.test(textos));
  for (const tela of ["explorar", "buscar", "comunidades", "conversas", "avisos", "salvos", "editar-perfil", "nucleos"]) ok(`títulos: /${tela} tem título próprio`, ler("app", "[lang]", "alumia", tela, "page.tsx").includes("title: tituloDaTela(lang,"));
  for (const l of ["pt", "en", "es", "fr", "ru", "zh"]) {
    const j = JSON.parse(ler("i18n", "rede", `${l}.json`));
    ok(`títulos (${l}): Editar perfil traduzido`, typeof j.menu.editarPerfil === "string" && j.menu.editarPerfil.length > 2);
    const a = JSON.parse(ler("i18n", "rede", "publicar", "alumia2", `${l}.json`));
    ok(`painel Mais (${l}): textos`, ["mais", "maisTitulo", "maisAbrir", "fechar", "organizacoes", "calendario", "aqui"].every((k) => a.menu[k]) && a.conta.seguranca && a.escrever.tipoAnuncio.includes("{botao}") && a.escrever.textoGuardado);
  }
  ok("casca: o Mais fica no alto do celular, com os destinos que não cabem na barra", casca.includes("<BotaoMais") && /\["comunidades", "nucleos", "conversas", "salvos"\]/.test(casca));
  ok("casca: nada de cartão da conta solto no fim de cada tela no celular", !/lg:hidden">\s*<Conta/.test(casca));
  ok("casca: telas da conta não acendem o Perfil", casca.includes('d.chave === "perfil" && naConta'));
  const conta = ler("components", "rede", "publicar", "alumia2", "ContaDaAlumia2.tsx");
  ok("conta: o painel é um <dialog> modal (foco preso, Esc fecha)", conta.includes("showModal()") && conta.includes("onCancel"));
  ok("conta: todos os itens com ícone", (conta.match(/className="al2-conta-item"/g) ?? []).length >= 4 && !/className="al2-conta-item"[^>]*>\s*\{t\./.test(conta));
  ok("conta: idiomas em grade e endereço cortado com reticências", conta.includes('"grid-cols-2"') && conta.includes("block truncate"));
  const css = ler("styles", "alumia.css") + ler("styles", "alumia-tokens.css");
  ok("conta: o menu do computador abre ao lado do menu", /\.al2-menu-pe \.al2-conta-menu \{\s*left: calc\(100% \+ 13px\)/.test(css));
  ok("prévia: um aviso só (os das áreas somem com a faixa da casca)", css.includes(".al2:has(> .al2-aviso-previa) :is(.al3-previa, .al-atos-previa, .al-st-previa"));
  ok("tema: a Alumia segue escura com o tema claro do site", /\[data-al="2"\]:not\(\[data-al-tema="claro"\]\)[^{}]*\{\s*--parchment: #141310;/.test(css));
  ok("contraste: carimbo confirmado e botão + puros no alto contraste", css.includes(":root[data-contrast] [data-al=\"2\"] .al2-mais { background: #ffd400; color: #000000;") && css.includes("--al-vermelho-sobre-escuro: #ff4f3a"));
  ok("movimento: o painel para com prefers-reduced-motion", /prefers-reduced-motion: reduce\)[^}]*\.al2-painel-mais/.test(css));
  ok("em construção: sem marca repetida dentro da casca", !ler("components", "rede", "onda5", "EmConstrucao.tsx").includes("<Lampiao"));
}

console.log(`${certos} certos${falhas.length ? `, ${falhas.length} falhas:` : ""}`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
