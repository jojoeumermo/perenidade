// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere o pacote "publico" do Vale o Escrito: os formulários de enviar fonte e de correção (parte pura), os textos nos 6
// idiomas, as rotas, a proteção contra spam sem rastreamento e a nota de privacidade. Sem rede, sem navegador.
// Rodar: npm run testar:vale-o-escrito-publico
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  CODIGO_DE_FICHA,
  montarCorrecao,
  montarEnvio,
  QUALIDADES_DE_QUEM_PEDE,
  ROTULO_DA_QUALIDADE,
  TEMPO_MINIMO_DA_TELA_MS,
  TEMPO_MINIMO_NO_BANCO_MS,
  tipoDeErro,
} from "../lib/vale-o-escrito/formularios.ts";
import { validarCorrecao, validarEnvio } from "../lib/vale-o-escrito/regras.ts";
import { IDIOMAS_VE, SITUACOES } from "../lib/vale-o-escrito/tipos.ts";
import { TEXTOS_DO_OBSERVATORIO } from "../lib/vale-o-escrito/textos.ts";

let total = 0;
const caso = (nome, fn) => {
  fn();
  total++;
  console.log(`  ok  ${nome}`);
};
const raiz = process.cwd();
const ler = (...partes) => fs.readFileSync(path.join(raiz, ...partes), "utf8");
const existe = (...partes) => fs.existsSync(path.join(raiz, ...partes));
const cr = (s) => s.replace(/\r\n/g, "\n");

const envioBase = { url: "https://exemplo.org/relatorio", descricao: "Relatório oficial sobre o caso, com a decisão do juiz.", trecho: "", dossie: "povos-indigenas", contato: "", leuOAviso: true, isca: "" };
const correcaoBase = { entradaId: "2026-exemplo-fazenda", tipo: "correcao", texto: "A situação mudou: houve absolvição em segunda instância.", comprovanteUrl: "", nome: "", contato: "", qualidade: "ofendido", isca: "" };

console.log("Vale o Escrito (publico): formulário de envio de fonte");
caso("envio válido, com tempo; campo vazio não vai; o isca vai como 'site'", () => {
  const p = montarEnvio(envioBase, 5200.4);
  assert.equal(validarEnvio(p).ok, true, validarEnvio(p).erros.join(";"));
  assert.equal(p.tempoMs, 5200);
  assert.equal("trecho" in p, false);
  assert.equal("contato" in p, false);
  assert.equal(p.site, "");
});
caso("envio barrado: isca, sem aviso lido, link ruim, CPF, links demais", () => {
  assert.equal(validarEnvio(montarEnvio({ ...envioBase, isca: "http://spam" }, 9000)).ok, false);
  assert.equal(validarEnvio(montarEnvio({ ...envioBase, leuOAviso: false }, 9000)).ok, false);
  assert.equal(validarEnvio(montarEnvio({ ...envioBase, url: "javascript:alert(1)" }, 9000)).ok, false);
  assert.equal(validarEnvio(montarEnvio({ ...envioBase, descricao: "O CPF dele é 123.456.789-09 e consta no processo." }, 9000)).ok, false);
  assert.equal(validarEnvio(montarEnvio({ ...envioBase, descricao: "http://a.com http://b.com http://c.com http://d.com muito spam" }, 9000)).ok, false);
});

console.log("Vale o Escrito (publico): formulário de correção e direito de resposta");
caso("correção simples vale sem nome nem contato; o código da ficha é conferido", () => {
  const p = montarCorrecao(correcaoBase, 6000);
  assert.equal(validarCorrecao(p).ok, true, validarCorrecao(p).erros.join(";"));
  assert.equal(p.texto, correcaoBase.texto);
  assert.ok(CODIGO_DE_FICHA.test("2026-exemplo-fazenda"));
  for (const ruim of ["", "A", "Ficha Com Espaço", "../../etc", "ficha_ruim", "-começa"]) assert.equal(CODIGO_DE_FICHA.test(ruim), false, ruim);
  assert.equal(montarCorrecao({ ...correcaoBase, entradaId: "  2026-EXEMPLO-fazenda " }, 6000).entradaId, "2026-exemplo-fazenda");
});
caso("direito de resposta (Lei 13.188/2015, art. 3º): exige nome, contato e põe a qualidade no texto", () => {
  const base = { ...correcaoBase, tipo: "direito_de_resposta" };
  assert.equal(validarCorrecao(montarCorrecao(base, 6000)).ok, false, "sem nome nem contato");
  assert.equal(validarCorrecao(montarCorrecao({ ...base, contato: "fulano@exemplo.org" }, 6000)).ok, false, "sem nome");
  assert.equal(validarCorrecao(montarCorrecao({ ...base, nome: "Fulano de Tal" }, 6000)).ok, false, "sem contato");
  for (const q of QUALIDADES_DE_QUEM_PEDE) {
    const p = montarCorrecao({ ...base, nome: "Fulano de Tal", contato: "fulano@exemplo.org", qualidade: q }, 6000);
    assert.equal(validarCorrecao(p).ok, true, validarCorrecao(p).erros.join(";"));
    assert.ok(p.texto.startsWith(`[Qualidade: ${ROTULO_DA_QUALIDADE[q]}] `), q);
  }
  // na correção simples a qualidade não entra no texto
  assert.ok(!montarCorrecao({ ...correcaoBase, qualidade: "familiar" }, 6000).texto.includes("Qualidade"));
});
caso("correção barrada: isca e CPF; remoção de dado vale sem contato", () => {
  assert.equal(validarCorrecao(montarCorrecao({ ...correcaoBase, isca: "x" }, 6000)).ok, false);
  assert.equal(validarCorrecao(montarCorrecao({ ...correcaoBase, texto: "Meu CPF é 123.456.789-09 e o dado está errado." }, 6000)).ok, false);
  assert.equal(validarCorrecao(montarCorrecao({ ...correcaoBase, tipo: "remocao_de_dado" }, 6000)).ok, true);
});
caso("tipoDeErro separa limite, dado inválido e falha geral", () => {
  assert.equal(tipoDeErro("muitos_pedidos"), "muitos");
  assert.equal(tipoDeErro("invalido:url"), "invalido");
  assert.equal(tipoDeErro("sem_conexao"), "erro");
  assert.equal(tipoDeErro(undefined), "erro");
});

console.log("Vale o Escrito (publico): proteção contra spam sem rastreamento");
caso("tempo mínimo: a tela espera mais que o banco; os dois estão no código", () => {
  assert.ok(TEMPO_MINIMO_DA_TELA_MS > TEMPO_MINIMO_NO_BANCO_MS && TEMPO_MINIMO_NO_BANCO_MS >= 2000);
  const sql = cr(ler("supabase", "migracoes", "2026-11-vale-o-escrito.sql"));
  assert.match(sql, new RegExp(`< ${TEMPO_MINIMO_NO_BANCO_MS} then return jsonb_build_object`));
  for (const f of ["vale_enviar", "vale_corrigir"]) {
    const corpo = sql.slice(sql.indexOf(`function public.${f}(`)).split("end $$;")[0];
    assert.match(corpo, /'tempoMs'/, `${f}: sem tempoMs`);
    assert.ok(corpo.indexOf("tempoMs") < corpo.indexOf("interno.limite("), `${f}: o tempo vem antes do limite`);
    assert.ok(corpo.indexOf("'site'") < corpo.indexOf("tempoMs"), `${f}: a isca vem primeiro`);
  }
  assert.match(sql, /function public\.vale_corrigir[\s\S]*?direito_de_resposta' and length\(btrim\(coalesce\(p ->> 'nome'/);
});
caso("limpeza do que o público enviou, como promete a privacidade (e igual no install.sql)", () => {
  const sql = cr(ler("supabase", "migracoes", "2026-11-vale-o-escrito.sql"));
  assert.match(sql, /function interno\.vale_limpeza\(\)/);
  assert.match(sql, /interval '90 days'/);
  assert.match(sql, /interval '1 year'/);
  assert.match(sql, /revoke all on function interno\.vale_limpeza\(\) from public/);
  assert.ok(cr(ler("supabase", "install.sql")).includes(sql), "install.sql não leva a migração inteira");
});
caso("os formulários não usam CAPTCHA de terceiros, cookie, armazenamento nem rastreio; têm isca e tempo", () => {
  for (const arq of ["FormularioEnviar.tsx", "FormularioCorrecao.tsx"]) {
    const t = ler("components", "vale-o-escrito", arq);
    assert.doesNotMatch(t, /turnstile|recaptcha|hcaptcha|captchaKey|Captcha/i, arq);
    assert.doesNotMatch(t, /localStorage|sessionStorage|document\.cookie|gtag|analytics|fingerprint/i, arq);
    assert.match(t, /TEMPO_MINIMO_DA_TELA_MS/, arq);
    assert.match(t, /aria-hidden/, `${arq}: sem campo-isca`);
  }
  assert.match(ler("components", "vale-o-escrito", "FormularioEnviar.tsx"), /rpc\("vale_enviar", \{ p: pedido \}\)/);
  assert.match(ler("components", "vale-o-escrito", "FormularioCorrecao.tsx"), /rpc\("vale_corrigir", \{ p: pedido \}\)/);
  assert.doesNotMatch(ler("lib", "vale-o-escrito", "formularios.ts"), /from "@\//);
});

console.log("Vale o Escrito (publico): rotas, textos e privacidade");
caso("as quatro rotas existem; só o enviar lê a lista de dossiês; todas herdam o layout", () => {
  const base = ["app", "[lang]", "vale-o-escrito"];
  for (const r of [["sobre"], ["enviar"], ["correcao"], ["correcao", "[id]"]]) assert.ok(existe(...base, ...r, "page.tsx"), r.join("/"));
  for (const r of [["sobre"], ["correcao"], ["correcao", "[id]"]]) assert.doesNotMatch(ler(...base, ...r, "page.tsx"), /vale-o-escrito\/dados|node:fs/, r.join("/"));
  assert.match(ler(...base, "enviar", "page.tsx"), /lerDossies/);
  assert.doesNotMatch(ler(...base, "layout.tsx"), /dados"|node:fs/);
  assert.match(ler(...base, "correcao", "[id]", "page.tsx"), /notFound\(\)/);
  assert.match(ler("lib", "seo.ts"), /"\/vale-o-escrito\/enviar", "\/vale-o-escrito\/correcao"/, "as páginas de formulário saem com noindex");
});
caso("textos: sobre, enviar e correção completos nos 6 idiomas; as leis citadas; nada de universidade ou diploma", () => {
  const chaves = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? chaves(v, `${p}${k}.`) : [`${p}${k}`]));
  const ptChaves = chaves(TEXTOS_DO_OBSERVATORIO.pt);
  for (const i of IDIOMAS_VE) {
    const t = TEXTOS_DO_OBSERVATORIO[i];
    assert.deepEqual(chaves(t).sort(), [...ptChaves].sort(), i);
    for (const s of SITUACOES) assert.ok(t.sobre.situacao[s].trim(), `${i}: sobre.situacao.${s}`);
    for (const q of QUALIDADES_DE_QUEM_PEDE) assert.ok(t.correcao.qualidades[q].trim(), `${i}: ${q}`);
    assert.doesNotMatch(JSON.stringify(t), /universidade|diploma|university|universidad|université|университет|大学/i, i);
    assert.match(t.sobre.base.direitoDeResposta, /13\.188/, `${i}: Lei 13.188`);
    assert.match(t.sobre.base.lgpd, /13\.709/, `${i}: LGPD`);
    assert.match(t.sobre.base.eca, /8\.069/, `${i}: ECA`);
    assert.match(t.sobre.base.codigoPenal, /138/, `${i}: CP`);
    assert.match(t.sobre.base.marcoCivil, /12\.965/, `${i}: Marco Civil`);
    assert.match(t.sobre.base.lai, /12\.527/, `${i}: LAI`);
    assert.match(t.correcao.identificacao, /13\.188/, `${i}: identificação`);
  }
  const pt = TEXTOS_DO_OBSERVATORIO.pt;
  assert.match(pt.sobre.base.lgpd, /art\. 4º, II, "a"/);
  assert.match(pt.sobre.base.lgpd, /art\. 11/);
  assert.match(pt.sobre.base.eca, /17, 143 e 247/);
  assert.match(pt.sobre.base.codigoPenal, /138 a 140/);
  assert.match(pt.correcao.identificacao, /art\. 3º/);
});
caso("privacidade.md fala do envio de fontes e das correções: o que guarda, por quanto tempo e a base legal", () => {
  const md = cr(ler("content", "paginas", "privacidade.md"));
  assert.match(md, /Fonte enviada ao observatório Vale o Escrito/);
  assert.match(md, /Pedido de correção, direito de resposta ou remoção de dado/);
  assert.match(md, /art\. 7º, IX/);
  assert.match(md, /art\. 7º, II/);
  assert.match(md, /Lei 13\.188\/2015/);
  assert.match(md, /não usam CAPTCHA de terceiros/);
  assert.match(md, /sal que muda todo dia/);
});

console.log(`\n${total} conferências do pacote publico passaram.`);
