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
  ok("chat: a cifra só é pulada com a prévia ligada", /PREVIA_DO_CHAT = process\.env\.NEXT_PUBLIC_ALUMIA_PREVIA === "sim"/.test(ler("lib", "rede", "cliente-chat.ts")) && (chaveiro.match(/if \(PREVIA_DO_CHAT( \|\| ![a-z.]+\.chat)?\)/g) ?? []).length >= 5);
}

// ───── Núcleos e turma na prévia ─────
{
  const d = criarDubleDosNucleos(Date.parse("2026-11-10T12:00:00Z"), "2026-11");
  const lista = d.rede_com_nucleos().itens;
  ok("núcleos: dois núcleos com id em forma de uuid (a tela confere o id)", lista.length === 2 && lista.every((n) => idOk(n.id)));
  const pag = d.rede_com_nucleo({ p_id: NUCLEOS_DE_EXEMPLO.itaquera });
  // Desde a R2 (membros escondidos) a página do núcleo traz só o perfil público e a entrada: mediação, encontros e mural moram no
  // grupo, nos aparelhos (o dublê faz como o servidor).
  ok("núcleos: a página traz só o perfil público e a entrada (sem mediação, encontros nem pessoas)", pag.id === NUCLEOS_DE_EXEMPLO.itaquera && typeof pag.nome === "string" && !("mediacao" in pag) && !("encontros" in pag) && "entrada" in pag);
  ok("turma: inscrita e ainda fora; entrar leva à comunidade da turma", d.rede_com_turma().inscrito && !d.rede_com_turma().entrou && d.rede_com_turma_entrar().slug === "marxismo" && d.rede_com_turma().entrou);
  // (Sair do núcleo é um commit do grupo MLS, nos aparelhos: o dublê, como o servidor, não tem mais "sair".)
  ok("núcleos: o dublê não tem mais sair pelo servidor", !("rede_com_nucleo_sair" in d));
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
  ok("casca: o Mais fica no alto do celular, com os destinos que não cabem na barra", casca.includes("<BotaoMais") && /\["conversas", "comunidades", "nucleos", "salvos"\]/.test(casca));
  ok("casca: nada de cartão da conta solto no fim de cada tela no celular", !/lg:hidden">\s*<Conta/.test(casca));
  ok("casca: telas da conta não acendem o Perfil", casca.includes('d.chave === "perfil" && naConta'));
  const conta = ler("components", "rede", "publicar", "alumia2", "ContaDaAlumia2.tsx");
  ok("conta: o painel é um <dialog> modal (foco preso, Esc fecha)", conta.includes("showModal()") && conta.includes("onCancel"));
  ok("conta: todos os itens com ícone", conta.includes("function ListaComIcones") && /type ItemComIcone = \{ chave: string; icone: NomeDoIcone \| React\.ReactNode; texto: string[;\s}]/.test(conta) && !/className="al2-conta-item"[^>]*>\s*\{t\./.test(conta));
  // P5 (A9): o menu reorganizado. Segurança num lugar só (o painel), a moderação só para quem modera, o resto num grupo "Mais".
  const destinos = casca.slice(casca.indexOf("const DESTINOS"), casca.indexOf("];", casca.indexOf("const DESTINOS")));
  ok("A9: o dia a dia na ordem (Início, Explorar, Avisos, Conversas, Comunidades, Núcleos e turmas, Atos, Salvos, Perfil)", /chave: "inicio"[\s\S]*chave: "explorar"[\s\S]*chave: "avisos"[\s\S]*chave: "conversas"[\s\S]*chave: "comunidades"[\s\S]*chave: "nucleos"[\s\S]*chave: "chamados"[\s\S]*chave: "salvos"[\s\S]*chave: "perfil"/.test(destinos));
  ok("A9: a Segurança não está no menu da conta (só no painel dela)", !/\["seguranca", "cadeado"/.test(conta) && conta.includes("export function BotaoSeguranca") && casca.includes("<BotaoSeguranca"));
  ok("A9: o item Segurança das frentes vai para o painel, não para o menu", ler("components", "rede", "seguranca", "encaixe.tsx").includes('lugar: "seguranca"') && casca.includes('(m.lugar ?? "mais") === "mais"'));
  ok("A9: convidar mora no menu da conta", ler("components", "rede", "convites", "encaixe.tsx").includes('lugar: "conta"') && conta.includes('encaixadosEm("conta"'));
  ok("A9: a moderação aparece só para quem modera", /situacao\.cuida && \(\s*<li>\s*<Link href=\{`\$\{linha\}\/moderacao`\}/.test(casca) && !/\["moderacao", "moderar"/.test(conta));
  ok("A9: o grupo Mais abre ali mesmo e se abre sozinho na tela de um item dele", casca.includes("function GrupoMais") && casca.includes("const mostrar = aberto || aquiDentro") && casca.includes("aria-expanded={mostrar}"));
  ok("A9: os termos reabrem a janela pelo painel de Segurança", conta.includes('"alumia:abrir-termos"') && ler("components", "rede", "lei", "JanelaDosTermos.tsx").includes('ABRIR_OS_TERMOS = "alumia:abrir-termos"'));
  // P5 (A17): o claro em branco neutro, o Desfazer e o Sair com a cara da Alumia, o formulário do ato sem grito antes da hora.
  const tokens = ler("styles", "alumia-tokens.css");
  const claro = tokens.slice(tokens.indexOf('[data-al="2"][data-al-tema="claro"],'), tokens.indexOf("/* Alto contraste do site"));
  ok("A17: o tema claro é branco neutro (nada do creme amarelado)", /--al-fundo: #ffffff;/.test(claro) && !/#f3efe6|#fbf8f2|#e6dfd2|#d5cdbf/.test(claro));
  const escrever = ler("components", "rede", "publicar", "alumia2", "EscreverDaAlumia2.tsx");
  ok("A17: o Desfazer é a ação da casa, não o botão vermelho de formulário", escrever.includes('className="al2-desfazer al2-aperta"') && ler("styles", "alumia.css").includes('[data-al="2"] .al2-desfazer {'));
  const saida = ler("components", "SaidaRapida.tsx");
  ok("A17: o Sair do Esc Esc Esc continua o mesmo botão (só o visual mudou)", saida.includes("onClick={() => void sairRapido()}") && saida.includes('className="saida-rapida al-pele no-print" data-saida-rapida') && saida.includes("tresEsc(instantes.current"));
  const formAto = ler("components", "rede", "atos", "FormularioDoAto.tsx");
  ok("A17: no ato, campo vazio só reclama depois de a pessoa escrever e apagar", formAto.includes('if (p === "vazio" && !sujo[campo]) return null;') && formAto.includes("onBlur: () => sair(campo)"));
  // A17: nenhuma tela do site, da Escola ou da Alumia usa o confirm()/prompt() do navegador; todas usam a janela da casa.
  const telasComConfirm = [];
  const varrer = (dir) => {
    for (const e of fs.readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true })) {
      const caminho = `${dir}/${e.name}`;
      if (e.isDirectory()) varrer(caminho);
      else if (/\.(tsx|ts)$/.test(e.name) && /window\.(confirm|prompt)\(/.test(ler(caminho))) telasComConfirm.push(caminho);
    }
  };
  varrer("components");
  varrer("app");
  ok(`A17: nenhuma tela com confirm()/prompt() do navegador${telasComConfirm.length ? ` (${telasComConfirm.join(", ")})` : ""}`, telasComConfirm.length === 0);
  const janela = ler("components", "perguntar.ts");
  ok("A17: a janela da casa é um <dialog> modal que começa em Cancelar, só com textContent e no idioma da página", janela.includes("dialogo.showModal()") && janela.includes("cancelar.focus()") && !/innerHTML/.test(janela) && janela.includes("document.documentElement.lang") && janela.includes('if (e.key === "Escape") e.stopPropagation();'));
  for (const l of ["pt", "en", "es", "fr", "ru", "zh"]) ok(`A17 (${l}): o exemplo do nome do ato é militante`, !/ESPERAN/.test(JSON.parse(ler("i18n", "rede", "atos", `${l}.json`)).formulario.nomeExemplo));
  for (const l of ["pt", "en", "es", "fr", "ru", "zh"]) {
    const a = JSON.parse(ler("i18n", "rede", "publicar", "alumia2", `${l}.json`));
    ok(`A9 (${l}): textos do menu, da conta e da Segurança`, ["moderacao", "maisMostrar", "maisEsconder"].every((k) => a.menu[k]) && a.conta.linhaDoTempo && ["titulo", "abrir", "intro", "conta", "aparelhos", "silenciados", "denuncias", "regras", "termos", "fediverso", "guardamos", "minhaConta", "fechar"].every((k) => a.seguranca[k]));
    ok(`A12 (${l}): Núcleos e turmas no menu e no título da tela`, JSON.parse(ler("i18n", "rede", "comunidades", `${l}.json`)).nucleos.titulo === a.menu.nucleos);
  }
  ok("conta: idiomas em grade e endereço cortado com reticências", conta.includes('"grid-cols-2"') && conta.includes("block truncate"));
  const css = ler("styles", "alumia.css") + ler("styles", "alumia-tokens.css");
  ok("conta: o menu do computador abre ao lado do menu", /\.al2-menu-pe \.al2-conta-menu \{\s*left: calc\(100% \+ 13px\)/.test(css));
  ok("prévia: um aviso só (os das áreas somem com a faixa da casca)", css.includes(".al2:has(> .al2-aviso-previa) :is(.al3-previa, .al-atos-previa, .al-st-previa"));
  ok("tema: a Alumia segue escura com o tema claro do site", /\[data-al="2"\]:not\(\[data-al-tema="claro"\]\)[^{}]*\{\s*--parchment: #141310;/.test(css));
  ok("contraste: carimbo confirmado e botão + puros no alto contraste", css.includes(":root[data-contrast] [data-al=\"2\"] .al2-mais { background: #ffd400; color: #000000;") && css.includes("--al-vermelho-sobre-escuro: #ff4f3a"));
  ok("movimento: o painel para com prefers-reduced-motion", /prefers-reduced-motion: reduce\)[^}]*\.al2-painel-mais/.test(css));
  ok("em construção: sem marca repetida dentro da casca", !ler("components", "rede", "onda5", "EmConstrucao.tsx").includes("<Lampiao"));
  ok("em construção (a Alumia fechada): o lampião junto do nome", /<p className="al-obras__marca">\s*<Lampiao /.test(ler("components", "rede", "EmConstrucao.tsx")));
}

// ── A marca fora da tela: cartão de compartilhamento, ícones e manifesto próprios da Alumia ──
{
  const { CARTAO_DA_ALUMIA, metadadosDaMarcaDaAlumia, montarManifestoDaAlumia } = await import("../lib/rede/marca-da-alumia.ts");
  /** Largura e altura de um PNG, lidas do cabeçalho (IHDR). */
  const png = (arquivo) => {
    const b = fs.readFileSync(new URL(`../public${arquivo}`, import.meta.url));
    return b.toString("ascii", 1, 4) === "PNG" ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null;
  };
  const m = metadadosDaMarcaDaAlumia("pt");
  const og = (m.openGraph?.images ?? [])[0];
  const tw = (m.twitter?.images ?? [])[0];
  ok("cartão: openGraph e twitter da Alumia apontam o cartão dela, não o do Instituto", og?.url === "/cartao-alumia.png" && tw?.url === "/cartao-alumia.png" && m.twitter?.card === "summary_large_image");
  ok("cartão: o arquivo existe e tem 1200 × 630", JSON.stringify(png(CARTAO_DA_ALUMIA.url)) === "[1200,630]" && CARTAO_DA_ALUMIA.width === 1200 && CARTAO_DA_ALUMIA.height === 630);
  ok("cartão: o resto do site continua com o do Instituto", ler("app", "[lang]", "layout.tsx").includes('images: ["/cartao-lucia.png"]'));
  const layout = ler("app", "[lang]", "alumia", "layout.tsx");
  ok("cartão: o layout da Alumia dá a marca a todas as páginas dela", /export async function generateMetadata[\s\S]*metadadosDaMarcaDaAlumia\(lang\)/.test(layout));
  ok("cartão: a página inicial, que tem openGraph próprio, repete a imagem da Alumia", /images: imagens\.openGraph/.test(ler("app", "[lang]", "alumia", "page.tsx")) && /images: imagens\.twitter/.test(ler("app", "[lang]", "alumia", "page.tsx")));
  // Nenhuma outra página da Alumia define openGraph ou twitter (senão trocaria o do layout, e o cartão sumiria).
  const paginas = fs.readdirSync(new URL("../app/[lang]/alumia/", import.meta.url), { recursive: true }).filter((p) => /page\.tsx$/.test(p) && p !== "page.tsx");
  const comCartaoProprio = paginas.filter((p) => /openGraph|twitter:/.test(ler("app", "[lang]", "alumia", ...p.split(/[\\/]/))));
  ok(`cartão: só a inicial define openGraph (${comCartaoProprio.join(", ") || "nenhuma outra"})`, paginas.length > 40 && comCartaoProprio.length === 0);
  const icones = [m.icons?.icon, m.icons?.apple].flat().filter(Boolean);
  ok("ícones: o vetorial primeiro (vence o favicon.ico do site), aba (32) e iPhone (180) da Alumia", icones[0]?.url === "/alumia/icone.svg" && icones[0]?.sizes === "any" && fs.readFileSync(new URL("../public/alumia/icone.svg", import.meta.url), "utf8").includes(`viewBox="480 330 745 1280"`) && icones.some((i) => i.url === "/alumia/icone-32.png") && icones.some((i) => i.url === "/alumia/apple-icone-180.png"));
  ok("ícones: os arquivos têm o tamanho que dizem", [["/alumia/icone-32.png", 32], ["/alumia/apple-icone-180.png", 180], ["/alumia/icone-192.png", 192], ["/alumia/icone-512.png", 512]].every(([a, n]) => JSON.stringify(png(a)) === `[${n},${n}]`));
  const mf = montarManifestoDaAlumia("en");
  ok("manifesto: o da Alumia no idioma, ligado pelo layout", m.manifest === "/pt/alumia/manifest.webmanifest" && mf.start_url === "/en/alumia" && mf.id === "/en/alumia" && mf.lang === "en");
  ok("manifesto: noite no fundo e lampião em 192, 512 e recortado", mf.background_color === "#0f0e0d" && mf.theme_color === "#0f0e0d" && mf.icons.some((i) => i.purpose === "maskable" && i.src === "/alumia/icone-512.png") && mf.icons.some((i) => i.sizes === "192x192"));
  ok("manifesto: a rota existe e é estática", /force-static/.test(ler("app", "[lang]", "alumia", "manifest.webmanifest", "route.ts")));
}

console.log(`${certos} certos${falhas.length ? `, ${falhas.length} falhas:` : ""}`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
