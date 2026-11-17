// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova os posts restritos cifrados NAS TELAS (P21) e as sobras do chat nas telas (P13, P14, P15, P16, P17, P22, caronas), sem
// banco: a cifra e a abertura usam o MLS de verdade (ts-mls, lib/rede/grupo-mls.ts) com o chaveiro em memória, e um servidor de
// mentira na memória com as mesmas regras das funções rede_mls_* (supabase/migracoes/20261113-rede-grupos-mls.sql). As regras do
// banco de verdade estão em testar:cifra-grupo. O resto confere o código das telas (o que importa, quem carrega o quê, os textos).
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-posts-restritos.mjs
import fs from "node:fs";
import { criarChaveiroDeGrupo, epocaDoPost } from "../lib/rede/grupo-mls.ts";
import { abrirDoGrupo, cifrarParaOGrupo, FORMA_DO_GRUPO, grupoDoPost, LIMITE_DO_POST_CIFRADO, pedidoCifrado, postCifrado } from "../components/rede/publicar/restrito/grupo.ts";
import { codigoDaCasa } from "../lib/rede/publicar/servidor.ts";
import { basesParaApagar, BASES_CONHECIDAS } from "../lib/modo-seguro.ts";
import { combinarCarona, conversaDaCaronaPronta, registrarConversaDaCarona } from "../lib/rede/atos/combinar.ts";
import { criarDubleDosNucleos, NUCLEOS_DE_EXEMPLO } from "../lib/rede/nucleos-exemplos.ts";
import { ABERTOS_NA_PREVIA } from "../components/rede/publicar/restrito/previa.ts";

let certos = 0;
const falhas = [];
async function espera(nome, fazer, conferir = (v) => v === true) {
  try {
    const valor = await fazer();
    if (conferir(valor)) certos++;
    else falhas.push(`${nome}: veio ${JSON.stringify(valor)?.slice(0, 200)}`);
  } catch (erro) {
    falhas.push(`${nome}: ${erro?.message ?? erro}`);
  }
}
const ler = (caminho) => fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

// ── O servidor de mentira (as regras das funções rede_mls_*, na memória) ──
function servidorNaMemoria(membrosDoGrupo) {
  const pacotes = new Map(); // usuario → [b64]
  const commits = new Map(); // grupo → [{ epoca, commit }]
  const info = new Map(); // grupo → { epoca, info }
  const boasvindas = []; // { grupo, epoca, para, welcome }
  const erro = (c) => Object.assign(new Error(c), { code: c });
  const membro = (g, u) => (membrosDoGrupo.get(g) ?? []).includes(u);
  return (eu) => async (funcao, a = {}) => {
    const r = await (async () => {
      switch (funcao) {
        case "rede_mls_meus_pacotes":
          return { pacotes: (pacotes.get(eu) ?? []).length };
        case "rede_mls_pacotes_publicar": {
          const lista = pacotes.get(eu) ?? [];
          for (const x of a.p_pacotes ?? []) {
            if (!/^[A-Za-z0-9+/]+={0,2}$/.test(x)) throw erro("invalido:pacote");
            if (lista.length < 20) lista.push(x);
          }
          pacotes.set(eu, lista);
          return { pacotes: lista.length };
        }
        case "rede_mls_estado": {
          if (!membro(a.p_grupo, eu)) throw erro("nao_encontrado");
          const lista = commits.get(a.p_grupo) ?? [];
          const bv = boasvindas.filter((b) => b.grupo === a.p_grupo && b.para === eu).sort((x, y) => y.epoca - x.epoca)[0];
          return {
            epoca: lista.length ? Math.max(...lista.map((c) => c.epoca)) : null,
            membros: [...(membrosDoGrupo.get(a.p_grupo) ?? [])].sort(),
            commits: lista.filter((c) => c.epoca > (a.p_desde ?? 0)).slice(0, 200),
            info: info.get(a.p_grupo) ?? null,
            boasvindas: bv ? { epoca: bv.epoca, welcome: bv.welcome } : null,
          };
        }
        case "rede_mls_pacotes_pegar": {
          if (!membro(a.p_grupo, eu)) throw erro("nao_encontrado");
          const saida = {};
          for (const u of a.p_usuarios ?? []) {
            if (u === eu || !membro(a.p_grupo, u)) continue;
            const lista = pacotes.get(u) ?? [];
            if (lista.length) saida[u] = lista.shift();
          }
          return saida;
        }
        case "rede_mls_commit": {
          if (!membro(a.p_grupo, eu)) throw erro("nao_encontrado");
          const lista = commits.get(a.p_grupo) ?? [];
          const atual = lista.length ? Math.max(...lista.map((c) => c.epoca)) : 0;
          if (a.p_epoca !== atual + 1) throw erro("versao_ocupada");
          lista.push({ epoca: a.p_epoca, commit: a.p_commit });
          commits.set(a.p_grupo, lista);
          info.set(a.p_grupo, { epoca: a.p_epoca, info: a.p_info });
          for (const b of a.p_boasvindas ?? []) if (membro(a.p_grupo, b.para)) boasvindas.push({ grupo: a.p_grupo, epoca: a.p_epoca, para: b.para, welcome: b.welcome });
          return { epoca: a.p_epoca };
        }
        default:
          throw erro(`sem_funcao:${funcao}`);
      }
    })();
    return structuredClone(r);
  };
}
const guardaEmMemoria = () => {
  const m = new Map();
  return { ler: async (k) => m.get(k) ?? null, guardar: async (k, v) => void m.set(k, v), apagar: async (k) => void m.delete(k) };
};

// ── As contas puras ──
const NUCLEO = "0d3b7d1e-5a2f-4c1b-9e7a-2f6c1d0b9a11";
await espera("núcleo: o grupo da chave é nucleo:<uuid>", () => grupoDoPost({ publico: "nucleo", nucleo: NUCLEO }), (g) => g === `nucleo:${NUCLEO}`);
await espera("comunidade fechada com público comunidade: comunidade:<slug>", () => grupoDoPost({ publico: "comunidade", comunidade: "turma-marxismo", tipoDaComunidade: "fechada" }), (g) => g === "comunidade:turma-marxismo");
await espera("comunidade aberta ou restrita, membros, internet, roda: o post segue aberto (sem grupo)", () => [
  grupoDoPost({ publico: "comunidade", comunidade: "lutas-moradia", tipoDaComunidade: "aberta" }),
  grupoDoPost({ publico: "comunidade", comunidade: "lutas-moradia", tipoDaComunidade: "restrita" }),
  grupoDoPost({ publico: "membros", comunidade: "turma-marxismo", tipoDaComunidade: "fechada" }),
  grupoDoPost({ publico: "internet", comunidade: "turma-marxismo", tipoDaComunidade: "fechada" }),
  grupoDoPost({ publico: "roda" }),
  grupoDoPost({ publico: "nucleo", nucleo: "nao-e-uuid" }),
], (l) => l.every((x) => x === null));
await espera("a forma do grupo é a mesma que a rota da voz aceita", () => FORMA_DO_GRUPO.test(`nucleo:${NUCLEO}`) && FORMA_DO_GRUPO.test("comunidade:ab") && !FORMA_DO_GRUPO.test("comunidade:A B"));
await espera("o post cifrado tem o teto do post curto", () => LIMITE_DO_POST_CIFRADO === 500);
await espera("o pedido cifrado vai com o texto vazio, o grupo e o corpo, sem título nem corpo longo", () => pedidoCifrado({ tipo: "post", texto: "segredo", corpo: "x", titulo: "y", publico: "nucleo", nucleo: NUCLEO }, { grupo: `nucleo:${NUCLEO}`, corpo_grupo: "p2.1.AAAAAAAAAAAAAAAA.BBBB" }), (p) => p.texto === "" && !("corpo" in p) && !("titulo" in p) && p.grupo === `nucleo:${NUCLEO}` && p.corpo_grupo.startsWith("p2.") && p.publico === "nucleo" && p.nucleo === NUCLEO && !JSON.stringify(p).includes("segredo"));
await espera("o cartão só trata como cifrado o que tem grupo e corpo p2 válidos", () => [
  postCifrado({ grupo: `nucleo:${NUCLEO}`, corpo_grupo: "p2.4.ZXhlbXBsby1wcmV2.ZXhlbXBsbw" }),
  postCifrado({ grupo: `nucleo:${NUCLEO}`, corpo_grupo: "p1.4.x.y" }),
  postCifrado({ grupo: "qualquer", corpo_grupo: "p2.4.ZXhlbXBsby1wcmV2.ZXhlbXBsbw" }),
  postCifrado({ grupo: null, corpo_grupo: null }),
], (l) => l.join() === "true,false,false,false");

{
  const mural = criarDubleDosNucleos().rede_com_nucleo_linha({ p_id: NUCLEOS_DE_EXEMPLO.itaquera }).itens;
  const cifrados = mural.filter((p) => postCifrado(p));
  await espera("prévia: o mural de exemplo tem dois posts cifrados (texto vazio), um abre e o outro não", () => cifrados.length === 2 && cifrados.every((p) => p.texto === "" && p.autor.id) && cifrados.filter((p) => ABERTOS_NA_PREVIA[p.id]).length === 1);
}

// ── A cifra e a abertura de verdade (MLS), com o chaveiro em memória ──
const P = { ana: "a0000000-0000-4000-8000-000000000001", bia: "a0000000-0000-4000-8000-000000000002", caio: "a0000000-0000-4000-8000-000000000003", fora: "a0000000-0000-4000-8000-000000000009" };
const GRUPO = `nucleo:${NUCLEO}`;
const membros = new Map([[GRUPO, [P.ana, P.bia, P.caio]]]);
const servidor = servidorNaMemoria(membros);
const chaveiros = Object.fromEntries(Object.entries(P).map(([nome, id]) => [nome, criarChaveiroDeGrupo({ chamar: servidor(id), guarda: guardaEmMemoria() })]));
// Bia e Caio abriram a página do núcleo (o aparelho fica pronto: pacotes de chave publicados).
await chaveiros.bia.preparar(P.bia);
await chaveiros.caio.preparar(P.caio);

const TEXTO = "Ato de quinta: a concentração muda para a saída do metrô.";
const cifra = await cifrarParaOGrupo(chaveiros.ana, GRUPO, P.ana, TEXTO).catch((e) => ({ ok: false, codigo: e.message }));
await espera("o compositor cifra no aparelho: sai o par grupo + corpo p2 (época 1)", async () => cifra, (c) => c.ok && c.grupo === GRUPO && epocaDoPost(c.corpo_grupo) === 1);
const post = { id: "p1", grupo: cifra.grupo, corpo_grupo: cifra.corpo_grupo, autor: { id: P.ana } };
await espera("o corpo não tem o texto", async () => cifra.corpo_grupo, (c) => !c.includes("metr") && c.length < 11_500);
await espera("o cartão abre para quem é do núcleo (Bia)", () => abrirDoGrupo(chaveiros.bia, post, P.bia), (t) => t === TEXTO);
await espera("o cartão abre para quem é do núcleo (Caio)", () => abrirDoGrupo(chaveiros.caio, post, P.caio), (t) => t === TEXTO);
await espera("quem escreveu relê", () => abrirDoGrupo(chaveiros.ana, post, P.ana), (t) => t === TEXTO);
await espera("quem é de fora: nulo (Não dá para abrir neste aparelho)", () => abrirDoGrupo(chaveiros.fora, post, P.fora), (t) => t === null);
await espera("com o autor trocado: nulo", () => abrirDoGrupo(chaveiros.bia, { ...post, autor: { id: P.caio } }, P.bia), (t) => t === null);
await espera("post mexido: nulo", () => abrirDoGrupo(chaveiros.bia, { ...post, corpo_grupo: post.corpo_grupo.slice(0, -4) + "AAAA" }, P.bia), (t) => t === null);
await espera("sem sessão (eu nulo) ou autor sem id: nulo, sem lançar", async () => [await abrirDoGrupo(chaveiros.bia, post, null), await abrirDoGrupo(chaveiros.bia, { ...post, autor: { id: null } }, P.bia)], (l) => l.every((x) => x === null));
await espera("aparelho novo da mesma pessoa não abre o que veio antes", () => abrirDoGrupo(criarChaveiroDeGrupo({ chamar: servidor(P.bia), guarda: guardaEmMemoria() }), post, P.bia), (t) => t === null);
await espera("a chave de alguém mudou (outro aparelho com outra chave 'da Bia'): grupo_suspeito, e nada sai", () => cifrarParaOGrupo(criarChaveiroDeGrupo({ chamar: servidor(P.bia), guarda: guardaEmMemoria() }), GRUPO, P.bia, "não pode sair"), (r) => r.ok === false && r.codigo === "grupo_suspeito");
await espera("quem é de fora não consegue cifrar para o grupo (falha, nada sai)", () => cifrarParaOGrupo(chaveiros.fora, GRUPO, P.fora, "x"), (r) => r.ok === false);
{
  // sem_chave leva a preparar o aparelho e tentar de novo uma vez.
  let preparou = 0;
  let vezes = 0;
  const falso = { preparar: async () => void preparou++, cifrar: async () => (++vezes === 1 ? Promise.reject(new Error("sem_chave")) : "p2.2.AAAAAAAAAAAAAAAA.QUJD") };
  await espera("sem_chave: prepara o aparelho e cifra na segunda vez", () => cifrarParaOGrupo(falso, GRUPO, P.ana, "x"), (r) => r.ok && preparou === 1 && vezes === 2);
  const sempre = { preparar: async () => undefined, cifrar: async () => Promise.reject(new Error("sem_chave")) };
  await espera("sem_chave de novo: a tela pede para tentar em seguida (nada sai)", () => cifrarParaOGrupo(sempre, GRUPO, P.ana, "x"), (r) => r.ok === false && r.codigo === "sem_chave");
  const torto = { preparar: async () => undefined, cifrar: async () => "texto aberto" };
  await espera("se a cifra devolver algo fora do formato p2, nada sai", () => cifrarParaOGrupo(torto, GRUPO, P.ana, "x"), (r) => r.ok === false && r.codigo === "falha");
}

// ── As telas: quem chama o quê ──
const compositor = ler("components/rede/comunidades/Compositor.tsx");
const escrever = ler("components/rede/publicar/alumia2/EscreverDaAlumia2.tsx");
const cartao = ler("components/rede/publicar/alumia2/CartaoDaAlumia2.tsx");
const naTela = ler("components/rede/publicar/restrito/NaTela.tsx");
const aparelho = ler("components/rede/publicar/restrito/aparelho.ts");
await espera("o compositor do mural cifra (cifrarNoAparelho + pedidoCifrado) antes do rede_publicar, e mostra o selo", () => /cifrarNoAparelho\(grupo, texto\.trim\(\)\)/.test(compositor) && /rede\.publicar\(pedidoCifrado\(pedido, cifra\)\)/.test(compositor) && compositor.includes("<SeloDaCifra"));
await espera("recusa da cifra não publica (o compositor volta antes do rede_publicar)", () => [compositor, escrever].every((f) => /if \(!cifra\.ok\) \{[\s\S]{0,200}?return;\s*\}/.test(f) && f.indexOf("if (!cifra.ok)") < f.indexOf("pedidoCifrado(")));
await espera("o Escrever cifra o post curto na comunidade fechada e recusa agendar, prazo e arranjos com cifra", () => escrever.includes("grupoDoPost({ publico, comunidade: onde, tipoDaComunidade: lugar?.tipo })") && escrever.includes("pedidoCifrado(montado, cifra)") && /grupoCifrado && \(pub\.agendar \|\| pub\.aposAto \|\| comVida \|\| pub\.usaCompositor\)/.test(escrever));
await espera("o cartão abre com TextoDoGrupo (e o texto vazio não aparece no lugar)", () => cartao.includes("<TextoDoGrupo") && cartao.includes("postCifrado(post)"));
await espera("a biblioteca do MLS só é baixada quando precisa (import dinâmico do aparelho)", () => naTela.includes('import("./aparelho")') && !/^import .*aparelho/m.test(naTela) && !/^import .*restrito\/aparelho/m.test(compositor + escrever + cartao));
await espera("o aparelho usa a guarda do navegador (o IndexedDB que o Sair rápido apaga) e esquece as chaves junto com o chat", () => aparelho.includes("guardaNoNavegador()") && aparelho.includes("aoApagarTudoDoChat") && aparelho.includes("esquecer()"));

// ── Os textos (seis idiomas, a frase do grupo_suspeito, os custos) ──
const idiomas = ["pt", "en", "es", "fr", "ru", "zh"];
const textos = Object.fromEntries(idiomas.map((l) => [l, JSON.parse(ler(`i18n/rede/publicar/restrito/${l}.json`))]));
const chaves = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? chaves(v, `${p}${k}.`) : [`${p}${k}${Array.isArray(v) ? `[${v.length}]` : ""}`])).sort().join();
await espera("os seis idiomas têm as mesmas chaves e nenhum texto vazio", () => idiomas.every((l) => chaves(textos[l]) === chaves(textos.pt)) && idiomas.every((l) => !JSON.stringify(textos[l]).includes('""')));
await espera("a frase do grupo_suspeito é a combinada", () => textos.pt.suspeito === "Não dá para escrever neste grupo agora: a chave de alguém mudou");
await espera("o cartão diz 'Não dá para abrir neste aparelho'", () => textos.pt.naoAbre === "Não dá para abrir neste aparelho");
await espera("os quatro custos de docs/rede/POSTS-RESTRITOS.md estão na tela", () => textos.pt.custos.length === 4 && /busca/i.test(textos.pt.custos[0]) && /prévia/.test(textos.pt.custos[1]) && /denuncia/.test(textos.pt.custos[2]) && /Fediverso/.test(textos.pt.custos[3]));

// ── P22: a sala de voz na página do núcleo e da comunidade fechada ──
const nucleos = ler("components/rede/comunidades/Nucleos.tsx");
const comunidade = ler("components/rede/comunidades/PaginaDaComunidadeAlumia.tsx");
const salaDoGrupo = ler("components/rede/voz/SalaDoGrupo.tsx");
const salaDeVoz = ler("components/rede/voz/SalaDeVoz.tsx");
await espera("a sala entra no núcleo e na comunidade fechada só por import dinâmico sem SSR", () => [nucleos, comunidade].every((f) => f.includes('dynamic(() => import("../voz/SalaDoGrupo").then((m) => m.SalaDoGrupo), { ssr: false })') && !/^import .*voz\/SalaD/m.test(f)));
await espera("na comunidade, só para membro de comunidade FECHADA", () => /comunidade\.tipo === "fechada" && situacaoAqui === "membro"/.test(comunidade) && comunidade.includes("{grupoFechado && ("));
await espera("o código da sala só baixa ao abrir a parte de voz", () => /const SalaDeVoz = dynamic\(\(\) => import\("\.\/SalaDeVoz"\)[^;]*ssr: false/.test(salaDoGrupo) && /aberta && \(/.test(salaDoGrupo));
await espera("pelo .onion a sala fica fechada: nem o Entrar nem a explicação da voz aparecem", () => /peloTor && !aberta \? \(\s*<p role="note"[^>]*>\{t\.pelOnion\}<\/p>\s*\) : !aberta/.test(salaDeVoz));
await espera("o .onion só serve o chat: a página do núcleo e a da comunidade vão para o site", () => /h\.endsWith\("\.onion"\)/.test(ler("lib/rede/chat/origem.ts")) && /return \{ tipo: "site", destino: caminho \}/.test(ler("lib/rede/chat/origem.ts")));
await espera("nenhum texto da Alumia promete voz pelo Tor", () => idiomas.every((l) => !/voz[^.]*pelo Tor|voice[^.]*over Tor/i.test(ler(`i18n/rede/chat/${l}.json`).replace(/"pelOnion": "[^"]*"/, ""))));
await espera("sem cor literal nas peças da sala e dos posts restritos", () => [salaDeVoz, salaDoGrupo, ler("components/rede/voz/voz.css"), ler("components/rede/publicar/restrito/restrito.css"), naTela].every((f) => !/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/.test(f)));

// ── P13: a mensagem crua do banco não sai para a tela ──
await espera("P13: só os códigos da casa saem; a mensagem crua vira 'falha'", () => [codigoDaCasa("nao_encontrado"), codigoDaCasa("invalido:post"), codigoDaCasa("muitos_pedidos"), codigoDaCasa('relation "interno.rede_posts" does not exist'), codigoDaCasa("duplicate key value violates unique constraint \"rede_x_pkey\""), codigoDaCasa("JWT expired"), codigoDaCasa(null)].join(), (v) => v === "nao_encontrado,invalido:post,muitos_pedidos,falha,falha,entre_primeiro,falha");
await espera("P13: chamarComoPessoa passa pela regra", () => /codigo: codigoDaCasa\(mensagem\)/.test(ler("lib/rede/publicar/servidor.ts")));

// ── P14, P17: o texto do Sair rápido e a sessão ──
await espera("P14: o texto do Sair rápido diz que as chaves do chat (e dos grupos) saem, nos seis idiomas", () => idiomas.every((l) => /chat|聊天|чат|messagerie/.test(ler(`i18n/rede/${l}.json`).match(/"sairRapidoAjuda": "([^"]*)"/)?.[1] ?? "")));
await espera("P17: o Sair rápido encerra a sessão antes de apagar o token, e o texto do chat não diz mais que a conta continua aberta", () => {
  const saida = ler("lib/rede/saida.ts");
  return saida.indexOf("revogarSessao(local);") > 0 && saida.indexOf("revogarSessao(local);") < saida.indexOf("apagarChavesDaSessao(armazens);") && !ler("i18n/rede/chat/pt.json").includes("continua aberta");
});

// ── P15, P16 ──
await espera("P15: o NOTICE registra jsqr e qrcode no chat (Qr.tsx)", () => /components\/rede\/chat\/Qr\.tsx[^\n]*mesmas duas bibliotecas/.test(ler("docs/NOTICE.md")));
await espera("P16: os três Esc apagam também o histórico do chat e os pares dos grupos (mesmo sem a lista das bases)", () => ["lucia-alumia-chat", "lucia-alumia-historico", "lucia-alumia-grupos"].every((b) => BASES_CONHECIDAS.includes(b) && basesParaApagar([b]).includes(b)));
await espera("P16: a casca da Alumia registra as limpezas do Sair rápido na saída do site, e o encaixe do chat apaga chat e grupos", () => ler("components/rede/publicar/alumia2/CascaDaAlumia2.tsx").includes("registrarLimpezaDaSaida(() => rodarLimpezas(ENCAIXES.aoSairRapido))") && /aoSairRapido: \[\(\) => apagarTudoDoChat\(\), \(\) => apagarParesDeGrupo\(\)\]/.test(ler("components/rede/chat/encaixe.tsx")));

// ── Caronas: "Combinar pelo chat" de ponta a ponta no mesmo ramo ──
await espera("caronas: o encaixe do chat registra o abridor ao carregar, e a casca carrega o encaixe", () => ler("components/rede/chat/encaixe.tsx").includes("registrarConversaDaCarona(abrirConversaDaCarona);") && /import \{ encaixe as chat \} from "\.\/chat\/encaixe";/.test(ler("components/rede/encaixes.tsx")));
await espera("caronas: o quadro aparece sem flag quando o chat registrou (chatPronto || emConstrucao)", () => /const mostrar = chatPronto \|\| emConstrucao;/.test(ler("components/rede/atos/Caronas.tsx")));
await espera("caronas: o abridor chama rede_dm_abrir_carona só com o id da carona e leva à conversa", () => /abrirCarona: \(carona: string\) => c<[^>]*>\("rede_dm_abrir_carona", \{ p_carona: carona \}\)/.test(ler("lib/rede/cliente-chat.ts")) && ler("lib/rede/chat/carona.ts").includes("chat.abrirCarona(carona.id)") && ler("components/rede/chat/Tela.tsx").includes('busca.get("conversa")'));
await espera("caronas: a migração do chat das caronas está no install.sql", () => ler("supabase/install.sql").includes("create or replace function public.rede_dm_abrir_carona("));
{
  const abertos = [];
  const tirar = registrarConversaDaCarona((k) => void abertos.push(k));
  await espera("caronas: com o abridor registrado, combinar abre a conversa da carona tocada", async () => {
    await combinarCarona({ id: "k1", ato: "a1" });
    return conversaDaCaronaPronta() && abertos.length === 1 && abertos[0].id === "k1";
  });
  tirar();
  await espera("caronas: sem abridor, recusa com sem_chat (o quadro diz 'em breve')", () => combinarCarona({ id: "k1", ato: "a1" }).then(() => "passou", (e) => e.message), (m) => m === "sem_chat");
}

console.log(`${certos} conferências certas${falhas.length ? `, ${falhas.length} com problema.` : "."}`);
for (const falha of falhas) console.log(`  ✗ ${falha}`);
process.exit(falhas.length ? 1 : 0);
