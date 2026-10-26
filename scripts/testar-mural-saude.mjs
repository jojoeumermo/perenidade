// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Confere o Mural de Saúde sem banco: o filtro de publicidade (cada termo da lista, os disfarces e textos que não podem
// ser barrados), a sincronia entre content/saude/regras.json e o bloco gerado do banco, as categorias (só psicologia),
// os perfis do arquivo e uma varredura dos textos públicos nos 6 idiomas (telas, metadados, cartão da página inicial,
// e-mails e mapa do site) atrás de gratuidade, preço social, voluntariado e do lema antigo. O banco tem a bateria
// própria em scripts/testar-banco.mjs.
// Uso: npm run testar:mural
import fs from "node:fs";
import path from "node:path";
import { categoriaLigada, conferirCampos, conferirTexto, NOME_VITRINE, normalizar, REGRAS, TEXTOS } from "../lib/mural-saude.ts";
import { perfilDoArquivoVisivel } from "../lib/saude.ts";
import { TERMO_SAUDE } from "../lib/termos.ts";
import { blocoGerado } from "./mural-saude-sincronizar.mjs";

const raiz = path.resolve(import.meta.dirname, "..");
const ler = (arquivo) => fs.readFileSync(path.join(raiz, arquivo), "utf8");
let certos = 0;
const falhas = [];
const confere = (nome, cond) => (cond ? certos++ : falhas.push(nome));

// 1. Cada termo da lista é barrado, com motivo e sugestão, e também com acento, caixa alta e letras soltas.
for (const g of REGRAS.bloqueio) {
  for (const termo of g.termos) {
    const exemplo = termo.replace(/\*/g, "");
    const r = conferirTexto(`Atendo adultos. ${exemplo}.`, "bio");
    confere(`barra "${termo}" (${g.grupo})`, r?.grupo === g.grupo && r.motivo.length > 20 && r.sugestao.length > 5);
    confere(`barra "${termo}" em caixa alta`, conferirTexto(exemplo.toUpperCase())?.grupo === g.grupo);
    if (!exemplo.includes(" ") && exemplo.length > 3) confere(`barra "${termo}" com letras soltas`, conferirTexto(`Sessões ${exemplo.split("").join(" ")}`) !== null);
  }
}
const disfarces = ["Atendimento GRÁTIS", "g r á t i s", "gr4tis", "Grátis!!!", "de    graça", "Valor  Social", "R$ 80 a sessão", "sessão por 90 reais", "Dra. Ana", "Constelações familiares", "Psicóloga cristã", "cura garantida", "Sou a melhor", "100% de sucesso", "Veja os depoimentos", "Primeira consulta sem custo", "Pacote de 4 sessões", "atendimento voluntário"];
for (const d of disfarces) confere(`barra o disfarce "${d}"`, conferirTexto(d) !== null);
const informativos = ["Acompanho quem procura ajuda com ansiedade.", "Fiz curadoria de grupos terapêuticos.", "Tenho preferência por atendimento on-line.", "Terapia Cognitivo-Comportamental", "Adultos e adolescentes", "Atendo casais em Niterói.", "Psicanálise", "Orientação profissional e de carreira", "Luto e perdas"];
for (const t of informativos) confere(`deixa passar "${t}"`, conferirTexto(t) === null);
confere("a normalização junta letras soltas e troca números por letras", normalizar("Pr1me1ra s e s s a o", true) === "primeira sessao");
confere("confere vários campos e diz qual", conferirCampos({ nome: "Ana Lima", bio: "Sessões gratuitas" })?.campo === "bio");

// 2. O banco e o arquivo de regras estão iguais, e o termo usa a mesma versão.
const sql = ler("supabase/install.sql");
confere("o bloco gerado do banco está em dia com content/saude/regras.json (rode npm run mural:sincronizar)", sql.includes(blocoGerado()));
confere("a versão do termo do painel é a do arquivo de regras", TERMO_SAUDE.versao === REGRAS.termoVersao);
confere("o termo novo tem a cláusula de independência política", TERMO_SAUDE.clausulas.some((c) => c.startsWith("Independência política.")));
confere("o termo novo não fala mais de voluntariado", !TERMO_SAUDE.clausulas.some((c) => /voluntari/i.test(c)));

// 3. Só a psicologia está aberta; outra categoria nunca aparece, nem pelo arquivo.
const ligadas = Object.entries(REGRAS.categorias).filter(([, c]) => c.ligada).map(([k]) => k);
confere("só a psicologia está ligada", ligadas.join() === "psicologia");
confere("CRM está fechado", !categoriaLigada("CRM") && categoriaLigada("crp"));
const base = { id: "x", nome: "Ana Lima", profissao: "Psicóloga", conselho: "CRP", uf: "RJ", registro: "05/12345", abordagem: "", areas: [], modalidade: null, bio: "", contatos: {}, foto: "", termo_versao: REGRAS.termoVersao };
confere("perfil do arquivo em dia aparece", perfilDoArquivoVisivel(base));
confere("perfil do arquivo de categoria fechada nunca aparece", !perfilDoArquivoVisivel({ ...base, conselho: "CRM" }));
confere("perfil do arquivo com termo antigo fica oculto", !perfilDoArquivoVisivel({ ...base, termo_versao: "2026-10-20" }));
confere("perfil do arquivo com texto proibido fica oculto", !perfilDoArquivoVisivel({ ...base, bio: "Atendo de graça." }));

// 4. Varredura dos textos públicos: nada de gratuidade, preço social, voluntariado nem lema antigo.
const PROIBIDOS = /gr[aá]tis|gratuit|de gra[cç]a|sem custo|valor social|pre[cç]o social|precio social|social rate|tarif social|volunt[aá]ri|volunteer|voluntari|bénévol|волонт|бесплатн|免费|志愿|solid[aá]ri|solidarity|солидарн|cuidar tamb[eé]m|care belongs/i;
const publicos = [TEXTOS.descricao, TEXTOS.avisoCurto, TEXTOS.ciencia, TEXTOS.convite, ...TEXTOS.avisoCompleto, ...TEXTOS.comoFunciona.flat(), TEXTOS.avisoPolitico.texto, ...TEXTOS.neutralidade.paragrafos, TEXTOS.declaracaoEtica, TEXTOS.declaracaoPolitica, NOME_VITRINE];
for (const t of publicos) confere(`texto público sem termo proibido: "${t.slice(0, 50)}…"`, !PROIBIDOS.test(t) && conferirTexto(t)?.grupo !== "preco");
for (const l of ["pt", "en", "es", "fr", "ru", "zh"]) {
  const d = JSON.parse(ler(`i18n/${l}.json`));
  const textos = [...Object.values(d.saude), d.more.items.health, d.more.short["/saude"]];
  confere(`${l}: título, descrição e chamadas do mural sem gratuidade nem lema`, textos.every((t) => !PROIBIDOS.test(t)));
  confere(`${l}: o lema antigo saiu`, !("slogan" in d.saude) && !("lead" in d.saude));
}
const telas = ["app/[lang]/saude/page.tsx", "app/[lang]/saude/termo/page.tsx", "app/[lang]/saude/neutralidade/page.tsx", "components/saude/Vitrine.tsx", "components/saude/FaixaDaSaude.tsx", "components/saude/cartao.ts"];
for (const arquivo of telas) {
  const fonte = ler(arquivo).replace(/^\s*(\/\/|\*|\/\*).*$/gm, "");
  confere(`${arquivo}: sem termo proibido nas telas`, !PROIBIDOS.test(fonte));
  confere(`${arquivo}: sem estrela, sem vermelho do instituto, sem cartaz preto`, !/<Star\b|estrela\(|#c21f16|jornal-preto|Cartaz/.test(fonte));
}
const inicial = ler("components/saude/FaixaDaSaude.tsx");
confere("a página inicial não mostra nenhum nome (o cartão não lê perfis)", !/profissionais\.json|\.nome\b|todos\.map|perfis/.test(inicial));
confere("a página inicial não passa os perfis ao cartão", !/FaixaDaSaude estaticos/.test(ler("app/[lang]/page.tsx")));
for (const arquivo of fs.readdirSync(path.join(raiz, "supabase/templates"))) confere(`e-mail ${arquivo} sem o nome antigo nem gratuidade do mural`, !/Saúde Solidária|valor social/i.test(ler(`supabase/templates/${arquivo}`)));
const mapa = ler("app/sitemap.ts");
confere("o mapa do site não lista o mural (fica fora dos buscadores)", !/"\/saude"/.test(mapa) && /\/saude\/neutralidade/.test(mapa));
confere("a página do mural fica fora dos buscadores", /"\/saude"/.test(ler("lib/seo.ts").match(/PRIVADAS = new Set\(\[[^\]]*\]/)?.[0] ?? ""));
confere("o aviso político de abertura não aparece no mural", /painel\|entrar\|apoie\|saude/.test(ler("components/OpeningNotice.tsx")));
confere("o modelo de post com cartão de profissional saiu do estúdio", !/post-saude/.test(ler("components/painel/design/modelos.ts")));

if (falhas.length) {
  console.error(`${certos} conferências certas, ${falhas.length} com problema:`);
  for (const f of falhas) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`Mural de Saúde: ${certos} conferências certas, 0 com problema.`);
