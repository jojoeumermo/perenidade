// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a senha de pânico da onda 11 (frente 11G: a conta isca só no aparelho):
//   · o cofre (lib/rede/seguranca/cofre-de-panico.ts): fechar e abrir com a senha de pânico, senha errada, cofre mexido, a forma
//     guardada (nada legível, nada em claro que aponte a conta), a chave fora do que a saída rápida apaga, o cofre de fachada de
//     todo aparelho e a senha gerada para a isca;
//   · o caminho da entrada (components/rede/entrada/Formularios.tsx): a senha de pânico é conferida ANTES de sair do aparelho e só
//     o e-mail e a senha da isca seguem para o servidor;
//   · o banco: o install.sql inteiro num Postgres de verdade (scripts/banco-local.mjs) não tem tabela nem coluna que ligue a conta
//     real à isca, e nenhuma migração fala da isca;
//   · os textos nas seis línguas (Ajustes de segurança e o parágrafo dos termos e da privacidade).
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-alumia-o11-panico.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import {
  abrirCofre, apagarCofre, CHAVE_DO_COFRE, cofreDeFachada, cofreValido, fecharCofre, garantirCofre, gerarSenhaDaIsca, guardarCofre, lerCofre, VOLTAS_DO_COFRE,
} from "../lib/rede/seguranca/cofre-de-panico.ts";
import { avaliarSenha } from "../lib/forca-senha.ts";
import { chavesParaApagar } from "../lib/modo-seguro.ts";
import { apagarChavesDaRede } from "../lib/rede/saida.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));

/** Um localStorage de mentira. */
function armazem() {
  const m = new Map();
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _mapa: m,
  };
}

// ═══════════════════ 1. O cofre ═══════════════════
const conteudo = { email: "isca.teste@exemplo.org", senha: gerarSenhaDaIsca(), codinome: "Sabiá Comum", criada: "2026-11-17T12:00:00.000Z" };
{
  const cofre = await fecharCofre("Corre pro mato 22", conteudo);
  ok("o cofre fechado tem a forma esperada (v2, Argon2id 64 MiB e 3 passadas)", cofreValido(cofre) && cofre.v === 2 && cofre.m === 65536 && cofre.t === 3 && cofre.p === 1 && !cofre.isca);
  const aberto = await abrirCofre("Corre pro mato 22", cofre);
  ok("a senha de pânico abre o cofre e devolve a isca inteira", JSON.stringify(aberto) === JSON.stringify(conteudo));
  ok("senha errada não abre (nulo, sem lançar)", (await abrirCofre("Corre pro mato 23", cofre)) === null && (await abrirCofre("", cofre)) === null);
  ok("a senha real (outra) não abre o cofre", (await abrirCofre("MinhaSenhaReal#2026", cofre)) === null);
  ok("nada legível no cofre guardado: nem o e-mail, nem a senha, nem o codinome", (() => {
    const t = JSON.stringify(cofre);
    return !t.includes("isca.teste") && !t.includes(conteudo.senha) && !t.includes("Sabiá") && !t.includes("exemplo.org");
  })());
  const virar = (b64) => {
    const b = Buffer.from(b64, "base64");
    b[b.length - 1] ^= 1;
    return b.toString("base64");
  };
  ok("cifra mexida: não abre", (await abrirCofre("Corre pro mato 22", { ...cofre, cifra: virar(cofre.cifra) })) === null);
  ok("verificador mexido: não abre", (await abrirCofre("Corre pro mato 22", { ...cofre, verificador: virar(cofre.verificador) })) === null);
  ok("iv mexido: não abre", (await abrirCofre("Corre pro mato 22", { ...cofre, iv: virar(cofre.iv) })) === null);
  ok("sal mexido: não abre", (await abrirCofre("Corre pro mato 22", { ...cofre, sal: virar(cofre.sal) })) === null);
  ok("valores do Argon2id mexidos: não abre", (await abrirCofre("Corre pro mato 22", { ...cofre, m: 32768 })) === null && (await abrirCofre("Corre pro mato 22", { ...cofre, t: 2 })) === null);
  const outro = await fecharCofre("Corre pro mato 22", conteudo);
  ok("fechar de novo gera sal, iv, verificador e cifra novos", outro.sal !== cofre.sal && outro.iv !== cofre.iv && outro.verificador !== cofre.verificador && outro.cifra !== cofre.cifra);
  // A mesma senha com acento composto ou decomposto.
  const acento = await fecharCofre("Paçoca do sábado", conteudo);
  ok("a senha com acento vale escrita de qualquer jeito (NFC)", JSON.stringify(await abrirCofre("Paçoca do sábado", acento)) === JSON.stringify(conteudo));
  ok("o verificador e a chave não são o mesmo segredo (a cifra não repete o verificador)", !Buffer.from(cofre.cifra, "base64").includes(Buffer.from(cofre.verificador, "base64").subarray(0, 8)));
}
{
  const t0 = Date.now();
  const cofre = await fecharCofre("Senha de pânico de verdade", conteudo);
  const aberto = await abrirCofre("Senha de pânico de verdade", cofre);
  ok("com os valores de verdade (Argon2id; o PBKDF2 de 600 mil só para o cofre de antes) o cofre fecha e abre", VOLTAS_DO_COFRE === 600_000 && cofre.m === 65536 && aberto?.email === conteudo.email);
  console.log(`  (fechar e abrir com o Argon2id, mais o PBKDF2 de antes que a abertura sempre roda: ${Date.now() - t0} ms neste computador)`);
}
{
  const a = armazem();
  ok("sem cofre: nulo", lerCofre(a) === null);
  const cofre = await fecharCofre("Corre pro mato 22", conteudo);
  guardarCofre(cofre, a);
  ok("guardar e ler devolve o mesmo cofre", JSON.stringify(lerCofre(a)) === JSON.stringify(cofre));
  a.setItem(CHAVE_DO_COFRE, "{torto");
  ok("cofre torto no armazenamento conta como sem cofre", lerCofre(a) === null);
  a.setItem(CHAVE_DO_COFRE, JSON.stringify({ ...cofre, m: 1024 }));
  ok("cofre com memória de menos é recusado", lerCofre(a) === null);
  a.setItem(CHAVE_DO_COFRE, JSON.stringify({ v: 1, voltas: 10, sal: cofre.sal, iv: cofre.iv, verificador: cofre.verificador, cifra: cofre.cifra }));
  ok("cofre de antes com voltas de menos é recusado", lerCofre(a) === null);
  a.setItem(CHAVE_DO_COFRE, JSON.stringify({ ...cofre, isca: "a".repeat(64) }));
  ok("a marca em claro das versões antigas é descartada ao ler", lerCofre(a) !== null && !("isca" in lerCofre(a)));
  garantirCofre(a);
  ok("e o cofre é gravado de novo sem ela", !a.getItem(CHAVE_DO_COFRE).includes("isca") && JSON.stringify(lerCofre(a)) === JSON.stringify(cofre));
  guardarCofre(cofre, a);
  a.setItem("lucia:sessao", "{}");
  a.setItem("lucia:rede:convite", "{}");
  a.setItem("lucia-prefs", "{}");
  ok("a saída rápida do site não apaga o cofre (a chave não começa com \"lucia\")", !chavesParaApagar(a).includes(CHAVE_DO_COFRE) && chavesParaApagar(a).length === 3);
  apagarChavesDaRede([a]);
  ok("o Sair rápido da Alumia também não apaga o cofre", lerCofre(a) !== null && a.getItem("lucia:rede:convite") === null);
  apagarCofre(a);
  ok("desativar troca o cofre por um de fachada (a chave continua lá, e a senha de pânico não abre mais)",
    lerCofre(a) !== null && lerCofre(a).cifra !== cofre.cifra && (await abrirCofre("Corre pro mato 22", lerCofre(a))) === null);
  ok("sem armazenamento: guardar lança, ler e apagar não", (() => {
    try {
      guardarCofre(cofre, null);
      return false;
    } catch {
      return lerCofre(null) === null && (apagarCofre(null), true);
    }
  })());
}
{
  const fachada = cofreDeFachada();
  const real = await fecharCofre("Corre pro mato 22", conteudo);
  const tam = (c) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, typeof v === "string" ? Buffer.from(v, "base64").length : v]));
  ok("o cofre de fachada tem a forma de um de verdade (os mesmos valores, sal, iv e verificador do mesmo tamanho, cifra do tamanho de uma isca)",
    cofreValido(fachada) && Object.keys(fachada).sort().join() === Object.keys(real).sort().join() && fachada.m === real.m && fachada.t === real.t
    && ["sal", "iv", "verificador"].every((k) => tam(fachada)[k] === tam(real)[k]) && tam(fachada).cifra >= 136 && tam(fachada).cifra < 200 && tam(real).cifra >= 120 && tam(real).cifra < 220);
  ok("nenhuma senha abre o cofre de fachada", (await abrirCofre("", fachada, null)) === null && (await abrirCofre("Corre pro mato 22", fachada, null)) === null);
  const b = armazem();
  ok("aparelho sem cofre ganha um de fachada", garantirCofre(b) !== null && lerCofre(b) !== null);
  const antes = b.getItem(CHAVE_DO_COFRE);
  ok("e não troca de fachada a cada entrada", garantirCofre(b) && b.getItem(CHAVE_DO_COFRE) === antes);
  guardarCofre(real, b);
  ok("o cofre de verdade fica como está", JSON.stringify(garantirCofre(b)) === JSON.stringify(real));
  const cofreTxt = ler("lib/rede/seguranca/cofre-de-panico.ts");
  ok("nada no cofre aponta a conta (nenhum resumo de id em claro)", !/marcaDaConta|digest\(/.test(cofreTxt));
  const senhas = Array.from({ length: 40 }, () => gerarSenhaDaIsca());
  ok("a senha gerada para a isca passa na regra de senha do site e não se repete", senhas.every((s) => avaliarSenha(s).aceita && s.length >= 30) && new Set(senhas).size === senhas.length);
}

// ═══════════════════ 2. O caminho da entrada e a tela ═══════════════════
{
  const form = ler("components/rede/entrada/Formularios.tsx");
  const entrar = form.slice(form.indexOf("export function FormEntrar"), form.indexOf("function FormEsqueci"));
  const iTroca = entrar.indexOf("trocaDePanico(senha)");
  ok("a senha de pânico é conferida no aparelho ANTES de qualquer pedido ao servidor", iTroca > 0 && iTroca < entrar.indexOf("bloqueado(\"entrada_situacao\"") && iTroca < entrar.indexOf("entrarPelaPorta("));
  ok("ao servidor vão só o e-mail e a senha que a troca devolve (a da isca, ou os digitados)", /entrarPelaPorta\(\{ email: conta\.email, senha: conta\.senha,/.test(entrar)
    && /signInWithPassword\(\{ email: conta\.email/.test(entrar) && /bloqueado\("entrada_falhou", conta\.email\)/.test(entrar));
  const encaixe = ler("components/rede/seguranca/encaixe-da-entrada.ts");
  ok("a troca tira a conta real do aparelho antes da isca entrar (a limpeza da saída rápida, sem trocar de página)", /apagarDoAparelho\(\)/.test(encaixe) && /aoSairRapido/.test(encaixe) && !/location/.test(encaixe));
  const cofreTs = ler("lib/rede/seguranca/cofre-de-panico.ts");
  const importacoes = [...cofreTs.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]);
  ok("o cofre não fala com servidor nenhum e não faz cripto à mão (Web Crypto e o Argon2id da libsodium, por lib/rede/cofre/argon.ts)",
    !/fetch\(|rpc\(/.test(cofreTs.replace(/^\/\/.*$/gm, "")) && importacoes.join() === "../cifra/sodio,../cofre/argon" && /subtle\(\)\.(encrypt|decrypt|deriveKey|deriveBits)|s\.deriveBits/.test(cofreTs)
    && /derivar\(senha/.test(cofreTs) && /name: "HKDF"/.test(cofreTs) && /name: "AES-GCM"/.test(cofreTs));
  const isca = ler("lib/rede/seguranca/isca.ts");
  ok("a isca nunca usa a sessão da conta real (nada de rpc ou getClient do site; segundo cliente só na memória)",
    !/import \{[^}]*\b(rpc|getClient|chamar)\b[^}]*\} from "@\/lib\/backend"/.test(isca) && /persistSession: false/.test(isca) && /autoRefreshToken: false/.test(isca) && /detectSessionInUrl: false/.test(isca));
  ok("a isca nasce pela porta de entrada, como qualquer conta (com o desafio, quando ligado)", /criarContaPelaPorta\(/.test(isca) && /entrarPelaPorta\(/.test(isca) && /turnstile/.test(isca));
  const tela = ler("components/rede/seguranca/SenhaDePanico.tsx");
  ok("a tela fecha o cofre ANTES de criar a conta e confere o armazenamento antes", tela.indexOf("armazenamentoAceita()") < tela.indexOf("fecharCofre(senha") && tela.indexOf("fecharCofre(senha") < tela.indexOf("criarIsca({"));
  ok("a senha de pânico não pode ser a real e o e-mail da isca não pode ser o da conta", /real === senha \? "igual"/.test(tela) && /emailIgual/.test(tela));
  ok("a seção é a mesma em qualquer conta: não tenta reconhecer a isca e só sabe da senha de pânico depois de digitada",
    !/marcaDaConta|naIsca|contaAberta\(\)\)?\.id/.test(tela) && /garantirCofre\(\)/.test(tela) && /t\.ativarTroca/.test(tela) && /apagarCofre\(\)/.test(tela.slice(tela.indexOf("function Preparar"))));
  ok("todo aparelho que entra fica com um cofre (de fachada, sem senha de pânico)", /garantirCofre\(\)/.test(encaixe));
  ok("depois de um erro, mexer no campo tira o aviso antigo", /if \(erro\) setErro\(""\)/.test(tela));
  ok("sem número de pessoas nos pacotes da isca", !/pessoas/.test(isca) && !/pessoas/.test(tela));
  ok("a seção entra nos Ajustes de segurança (também quando a situação da conta não carrega)", (ler("components/rede/seguranca/TelaDaSeguranca.tsx").match(/<SenhaDePanico /g) ?? []).length === 2);
}

// ═══════════════════ 3. O banco não liga as contas ═══════════════════
{
  const migracoes = fs.readdirSync(path.join(raiz, "supabase/migracoes")).filter((f) => f.endsWith(".sql"));
  ok("nenhuma migração desta frente (nada no servidor)", !migracoes.some((f) => /o11-panico|panico-isca|isca/.test(f)));
  const SUSPEITO = /conta_isca|isca_conta|(^|[._])isca_(id|usuario|de)|decoy|panic_|senha_de_panico|panico_senha|conta_real|conta_ligada|conta_vinculada|conta_irma|segunda_conta|outra_conta/;
  ok("nenhuma migração nem o install.sql falam de conta isca ou ligação entre contas",
    ![...migracoes.map((f) => ler(`supabase/migracoes/${f}`)), ler("supabase/install.sql")].some((t) => /conta[ _-]isca|conta_real|decoy|senha[ _]de[ _]p[aâ]nico/i.test(t)));
  const banco = await criarBanco();
  const r = await banco.pg.query(`
    select table_schema, table_name, column_name from information_schema.columns
    where table_schema not in ('pg_catalog', 'information_schema', 'extensions', 'pg_toast')`);
  const tabelas = await banco.pg.query(`
    select table_schema, table_name from information_schema.tables where table_schema not in ('pg_catalog', 'information_schema', 'extensions', 'pg_toast')`);
  ok("o banco montado tem tabelas (o install.sql rodou)", tabelas.rows.length > 100 && r.rows.length > 500);
  const ruins = [...tabelas.rows.map((x) => `${x.table_schema}.${x.table_name}`), ...r.rows.map((x) => `${x.table_schema}.${x.table_name}.${x.column_name}`)].filter((n) => SUSPEITO.test(n));
  ok(`nenhuma tabela nem coluna liga a conta real à isca${ruins.length ? ` (achei: ${ruins.join(", ")})` : ""}`, ruins.length === 0);
  // ("campo-isca", o campo escondido contra robôs dos formulários antigos, não tem nada com isto: por isso a busca é por nome composto.)
  // O pânico que JÁ existe (o botão, onda 8) guarda só "escondido" e "quando", na própria conta: nenhuma coluna de outra conta.
  const doPanico = r.rows.filter((x) => /panico/.test(x.column_name));
  ok("as colunas de pânico que existem (o botão da onda 8) não apontam para outra conta", doPanico.every((x) => !/(conta|usuario|id)$/.test(x.column_name)));
  const funcoes = await banco.pg.query(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'interno')`);
  // public.isca é a armadilha de endereços de invasor (/wp-admin…), de antes: não tem nada com contas.
  const daIsca = funcoes.rows.filter((f) => /conta.*isca|isca.*conta|decoy|panico_(senha|conta)|senha_de_panico/.test(f.proname)).map((f) => f.proname);
  ok(`nenhuma função do banco fala de conta isca${daIsca.length ? ` (achei: ${daIsca.join(", ")})` : ""}`, daIsca.length === 0);
  await banco.pg.close();
}

// ═══════════════════ 4. Os textos nas seis línguas ═══════════════════
{
  const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"];
  const chaves = (v, p = "") => (v && typeof v === "object" && !Array.isArray(v) ? Object.entries(v).flatMap(([k, f]) => chaves(f, p ? `${p}.${k}` : k)) : [`${p}:${typeof v === "string" && v.trim() ? "t" : "vazio"}`]);
  const seg = Object.fromEntries(IDIOMAS.map((l) => [l, JSON.parse(ler(`i18n/rede/seguranca/${l}.json`))]));
  const ref = chaves(seg.pt.isca).sort().join("|");
  ok("o bloco da senha de pânico existe nas seis línguas, com as mesmas chaves e sem texto vazio",
    IDIOMAS.every((l) => seg[l].isca && chaves(seg[l].isca).sort().join("|") === ref) && !ref.includes(":vazio"));
  ok("as etapas da isca têm título, texto e botão em todas as línguas", IDIOMAS.every((l) => ["confirmar_email", "sem_pedido", "em_analise", "recusada", "suspensa", "cadastrar_fator", "pedir_codigo", "povoar", "pronta"].every((e) => {
    const x = seg[l].isca.etapas[e];
    return x && x.titulo && x.texto && x.botao;
  })));
  const lei = Object.fromEntries(IDIOMAS.map((l) => [l, JSON.parse(ler(`i18n/rede/lei/${l}.json`))]));
  const conta = (l) => lei[l].termos.secoes.find((s) => s.id === "conta").paragrafos;
  const aparelho = (l) => lei[l].privacidade.secoes.find((s) => s.id === "aparelho").paragrafos;
  ok("os termos (A sua conta) e a privacidade (No seu aparelho) ganharam o parágrafo nas seis línguas", IDIOMAS.every((l) => conta(l).length === 3 && aparelho(l).length === 3));
  // (O terceiro parágrafo de "No seu aparelho" é o do chat da R2: as chaves e a lista das conversas, apagadas no Sair rápido e no pânico.)
  const marcas = { pt: /ordens judiciais/, en: /court orders/, es: /órdenes judiciales/, fr: /décisions de justice/, ru: /решения суда/, zh: /法院命令/ };
  ok("o parágrafo diz que é segurança pessoal contra acesso forçado e que a lei e as ordens judiciais continuam valendo",
    IDIOMAS.every((l) => marcas[l].test(conta(l)[2]) && marcas[l].test(aparelho(l)[1]) && marcas[l].test(seg[l].isca.servidor)));
  ok("o pt diz que nada é apagado no servidor", /Nada é apagado no servidor/.test(conta("pt")[2]) && /Nada é apagado no servidor/.test(seg.pt.isca.servidor));
  ok("nenhuma língua promete que o banco não liga as duas contas (a impressão de rede e o serviço de contas guardam a entrada de cada uma)",
    !/não guarda ligação|keeps no link|no guarda vínculo|ne garde aucun lien|не хранит связи|之间的关联/.test(JSON.stringify([...IDIOMAS.map((l) => seg[l].isca), ...IDIOMAS.map((l) => [conta(l), aparelho(l)])])));
  const tudo = JSON.stringify([...IDIOMAS.map((l) => seg[l].isca), ...IDIOMAS.map((l) => [conta(l)[2], aparelho(l)[1]])]);
  ok("nenhuma palavra proibida no texto novo", !/diploma|universidade|algoritmo|university|algorithm|universidad|algoritmo|université|algorithme|университет|алгоритм|大学|算法/i.test(tudo));
  ok("os outros cinco dicionários da segurança não ficaram iguais ao português", IDIOMAS.filter((l) => l !== "pt").every((l) => seg[l].isca.titulo !== seg.pt.isca.titulo));
}

console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  FALHA: ${f}`);
process.exit(falhas.length ? 1 : 0);
