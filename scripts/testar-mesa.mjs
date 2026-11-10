// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere a Mesa organizada e por função (Etapa 8, B39) e os "departamentos com pouca gente" (B14).
// Rodar: npm run testar:mesa
import fs from "node:fs";
import path from "node:path";
import { atalhosDaFuncao, ATALHOS_COMUNS, dadosDaFuncao, dasPendencias, dosAvisosDeSeguranca, FUNCAO_DO_PAPEL, FUNCOES_DA_MESA, funcoesDaPessoa, ITENS, LIMITE_DE_POUCA_GENTE, montarPendencias, somar } from "../components/painel/mesa-funcoes.ts";
import { MAPA } from "../components/painel/estrutura.ts";
import { agruparRecados, grupoDoRecado, ORDEM_DOS_GRUPOS } from "../components/painel/recados-grupos.ts";

const raiz = path.join(import.meta.dirname, "..");
const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), "utf8");
let ok = 0;
const falhas = [];
const conferir = (nome, cond, detalhe = "") => (cond ? ok++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));

// 1. As sete funções do plano mais a geral.
const ids = FUNCOES_DA_MESA.map((f) => f.id);
conferir("as 7 funções do plano e a geral", ["coordenacao", "revisao", "comunicacao", "desenvolvimento", "curadoria", "moderacao", "educador", "geral"].every((id) => ids.includes(id)) && ids.length === 8, ids.join(","));
const PARTES = ["pendencias", "recados", "seguranca", "casa", "atalhos"];
for (const f of FUNCOES_DA_MESA) {
  conferir(`${f.id}: as cinco partes, sem repetir`, f.ordem.length === 5 && PARTES.every((p) => f.ordem.includes(p)));
  conferir(`${f.id}: prioridade só com campos que existem`, f.prioridade.every((c) => ITENS.some((i) => i.chave === c)), f.prioridade.join(","));
  conferir(`${f.id}: atalhos são seções do painel`, f.atalhos.every((a) => MAPA[a]), f.atalhos.filter((a) => !MAPA[a]).join(","));
  conferir(`${f.id}: nome e frase`, f.nome.length > 2 && f.sobre.length > 20);
}
conferir("atalhos comuns são seções", ATALHOS_COMUNS.every((a) => MAPA[a]));
conferir("a Mesa de desenvolvimento usa o nome fundido (B10)", dadosDaFuncao("desenvolvimento").nome === "UI/UX e Desenvolvimento");
conferir("coordenação começa pela segurança; revisão, pelas pendências", dadosDaFuncao("coordenacao").ordem[0] === "seguranca" && dadosDaFuncao("revisao").ordem[0] === "pendencias");

// 2. De qual função é cada papel do banco (a lista de papéis do backend).
const backend = ler("lib", "backend.ts");
const papeisDoBanco = [...backend.match(/papel: ("[a-z_]+"(?: \| "[a-z_]+")+);/)[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
conferir("li os papéis do backend", papeisDoBanco.length >= 15, String(papeisDoBanco.length));
const semFuncao = papeisDoBanco.filter((p) => !FUNCAO_DO_PAPEL[p] && p !== "representante");
conferir("todo papel tem Mesa (menos representante, que fica na geral)", semFuncao.length === 0, semFuncao.join(","));
conferir("sem papel cai na geral", funcoesDaPessoa([]).join() === "geral");
conferir("coordenação e vice na coordenação", funcoesDaPessoa(["vice"])[0] === "coordenacao");
conferir("design vai para comunicação (B10)", funcoesDaPessoa(["design"])[0] === "comunicacao");
conferir("mais de um papel: maior responsabilidade primeiro, sem repetir", funcoesDaPessoa(["marketing", "jornalismo", "revisao", "coordenacao"]).join() === "coordenacao,revisao,comunicacao");
conferir("representante sozinho cai na geral", funcoesDaPessoa(["representante"]).join() === "geral");

// 3. Pendências: nada some, a ordem muda, a segurança fica à parte.
const tudo = Object.fromEntries(ITENS.map((i, n) => [i.chave, n + 1]));
const abreTudo = () => true;
const total = (funcao, coordena = true) => montarPendencias(tudo, { funcao, coordena, abre: abreTudo });
for (const f of FUNCOES_DA_MESA) conferir(`${f.id}: nenhuma pendência some`, total(f.id).length === ITENS.length);
conferir("sem resumo, lista vazia", montarPendencias(null, { funcao: "geral", coordena: false, abre: abreTudo }).length === 0);
conferir("zero não aparece", montarPendencias({ fila: 0, juntas: 3 }, { funcao: "geral", coordena: false, abre: abreTudo }).map((p) => p.chave).join() === "juntas");
conferir("seção que a pessoa não abre não vira pendência", montarPendencias({ fila: 2, juntas: 1 }, { funcao: "geral", coordena: false, abre: (s) => s !== "fila" }).map((p) => p.chave).join() === "juntas");
conferir("revisão: a fila vem primeiro", total("revisao")[0].chave === "fila");
conferir("moderação: denúncias primeiro", total("moderacao")[0].chave === "denuncias");
conferir("coordenação: pedidos da supervisão primeiro", total("coordenacao")[0].chave === "pedidos_supervisao");
conferir("a prioridade mexe na ordem, não na soma", somar(total("revisao")) === somar(total("coordenacao")));
const seg = dosAvisosDeSeguranca(total("coordenacao")).map((p) => p.chave).sort().join();
conferir("avisos de segurança: suspensas, publicação parada, pedidos da supervisão, denúncias", seg === "denuncias,pedidos_supervisao,publicacao_atrasada,suspensas", seg);
conferir("segurança e pendências não se misturam", dasPendencias(total("geral")).length + dosAvisosDeSeguranca(total("geral")).length === ITENS.length && dasPendencias(total("geral")).every((p) => p.parte === "pendencias"));
conferir("pedido de voluntariado: coordenação vai a pessoas, os outros à supervisão", total("geral", true).find((p) => p.chave === "candidaturas").vai === "pessoas" && total("geral", false).find((p) => p.chave === "candidaturas").vai === "supervisao");
conferir("todo destino é seção do painel", ITENS.every((i) => MAPA[i.destino] && (!i.destinoDaCoordenacao || MAPA[i.destinoDaCoordenacao])), ITENS.filter((i) => !MAPA[i.destino]).map((i) => i.destino).join());
// O registro de seções, o Resumo e a Mesa moraram em Painel.tsx até o redesenho; hoje moram em casca/Dentro.tsx (o painel
// aberto carrega só no navegador, docs/PAINEL-REDESENHO.md). Lemos os dois: a conferência é a mesma.
const resumoDoPainel = ler("components", "painel", "Painel.tsx") + "\n" + ler("components", "painel", "casca", "Dentro.tsx");
conferir("todo campo de pendência existe no Resumo do painel", ITENS.every((i) => new RegExp(`\\b${i.chave}\\??:\\s*number`).test(resumoDoPainel)), ITENS.filter((i) => !new RegExp(`\\b${i.chave}\\??:\\s*number`).test(resumoDoPainel)).map((i) => i.chave).join());

// 4. Atalhos: só os que a pessoa abre, sem repetir.
const so = atalhosDaFuncao("comunicacao", (s) => ["divulgacao", "conta"].includes(s));
conferir("atalhos filtrados pelo que a pessoa abre", so.join() === "divulgacao,conta", so.join());
const todosAtalhos = atalhosDaFuncao("educador", abreTudo);
conferir("atalhos sem repetir", new Set(todosAtalhos).size === todosAtalhos.length);

// 5. A tela usa a regra, sem cor escrita à mão, e a Mesa antiga foi substituída sem perder peças.
const tela = ler("components", "painel", "MesaOrganizada.tsx");
conferir("tela sem cor escrita à mão", !/#[0-9a-fA-F]{3,8}\b|rgba?\(|\[#/.test(tela));
conferir("tela usa os componentes únicos", /from "\.\/ui"/.test(tela) && tela.includes("pn-cartao"));
conferir("tela mostra as cinco partes", PARTES.every((p) => tela.includes(`id="mesa-${p}"`)));
conferir("a escolha da Mesa fica só no aparelho, com try/catch", tela.includes("localStorage") && /try \{[\s\S]*localStorage[\s\S]*catch/.test(tela));
conferir("Painel usa a Mesa organizada", resumoDoPainel.includes("<MesaOrganizada") && !resumoDoPainel.includes("function CaixaDeEntrada") && !resumoDoPainel.includes("function TituloDaMesa"));
for (const peca of ["AgoraAoVivo", "FeriasNaMesa", "PrimeiraSemana", "Continuar", "SuasHoras", "ParaVoceHoje", "Recados", "Agradecimentos", "Situacao", "ConquistasDaEquipe", "Termometro", "NoSiteAgora", "Atalhos", "SugerirAoMarketing", "Candidatura", "PorOndeComecar", "DicaDoTutorial"]) {
  conferir(`a Mesa ainda traz ${peca}`, new RegExp(`<${peca}[ />]`).test(resumoDoPainel.slice(resumoDoPainel.indexOf("function Mesa("), resumoDoPainel.indexOf("function SugerirAoMarketing"))));
}

// 6. B14: departamentos com pouca gente, clicáveis.
const lista = ler("components", "painel", "ListaDePessoas.tsx");
conferir("limite de pouca gente é 1", LIMITE_DE_POUCA_GENTE === 1);
conferir("o quadro de departamentos com pouca gente abre a lista", lista.includes("setVendoPoucos") && lista.includes('id="departamentos-com-pouca-gente"') && lista.includes("aria-expanded"));
conferir("cada departamento da lista filtra as pessoas", /setDepartamento\(d\)/.test(lista) && lista.includes("ninguém ainda"));

// 7. Palavras proibidas na interface.
for (const [nome, texto] of [["mesa-funcoes", ler("components", "painel", "mesa-funcoes.ts")], ["MesaOrganizada", tela], ["ListaDePessoas", lista]]) {
  conferir(`${nome}: sem a palavra proibida`, !/universidade|diploma/i.test(texto));
}

// 8. T27: recados agrupados e a lateral direita da Mesa.
const recadosDeExemplo = [
  { id: "a", texto: "Sua conta foi aberta em um aparelho novo (Chrome em Windows). Se não foi você, avise a coordenação agora.", lido: false, criado_em: "2026-11-06T18:54:00Z" },
  { id: "b", texto: "Sua conta foi aberta em um aparelho novo (Chrome em Windows). Se não foi você, avise a coordenação agora.", lido: true, criado_em: "2026-11-06T18:54:00Z" },
  { id: "c", texto: "A conta de Lavinia foi aberta em um aparelho novo (Opera em Windows).", lido: true, criado_em: "2026-11-02T14:21:00Z" },
  { id: "d", texto: "Você recebeu a função de revisão.", lido: true, criado_em: "2026-11-01T10:00:00Z" },
  { id: "e", texto: "Sua contribuição foi publicada.", lido: false, criado_em: "2026-11-03T10:00:00Z" },
  { id: "f", texto: "Bom dia!", lido: true, criado_em: "2026-11-04T10:00:00Z" },
  { id: "g", texto: "Alguém respondeu ao seu post.", lido: false, criado_em: "2026-11-05T10:00:00Z", categoria: "rede" },
];
const grupos = agruparRecados(recadosDeExemplo);
conferir("recados: grupos na ordem combinada, só os que têm recado", grupos.map((g) => g.grupo).join() === "acesso,equipe,contribuicoes,rede,outros" && ORDEM_DOS_GRUPOS[0] === "acesso", grupos.map((g) => g.grupo).join());
const acesso = grupos.find((g) => g.grupo === "acesso");
conferir("recados iguais viram uma linha (2 vezes) e contam como novos", acesso.itens.length === 2 && acesso.itens[0].vezes === 2 && acesso.itens[0].novo && acesso.novos === 1);
conferir("dentro do grupo, o não lido vem antes", acesso.itens[0].novo && !acesso.itens[1].novo);
conferir("categoria rede manda para o grupo Rede", grupoDoRecado({ texto: "Alguém respondeu ao seu post.", categoria: "rede" }) === "rede");
conferir("aparelho novo é acesso mesmo falando da coordenação", grupoDoRecado({ texto: "Se não foi você, avise a coordenação: aparelho novo." }) === "acesso");
conferir("nada some: todo recado está num grupo", grupos.reduce((n, g) => n + g.itens.reduce((m, i) => m + i.vezes, 0), 0) === recadosDeExemplo.length);
const seguranca = ler("components", "painel", "Seguranca.tsx");
conferir("Recados com naMesa: sem título próprio, em grupos, marcar tudo como lido", seguranca.includes("naMesa = false") && seguranca.includes("function RecadosNaMesa") && seguranca.includes("agruparRecados(dados)") && /RecadosNaMesa[\s\S]*Marcar tudo como lido/.test(seguranca));
conferir("a Mesa pede os recados com naMesa", ler("components", "painel", "casca", "Dentro.tsx").includes("<Recados recarregar={recarregar} naMesa />"));
conferir("a Mesa leva recados para a lateral direita só quando cabe", tela.includes("LARGURA_DA_LATERAL") && tela.includes("ResizeObserver") && tela.includes('className="pn-mesa-lateral"') && tela.includes('.filter((p) => p !== "recados" && p !== "atalhos")'));
const temaDoPainel = ler("styles", "painel-tema.css");
conferir("o tema tem a grade da Mesa com lateral", /\.pn-mesa-grade\s*\{[^}]*grid-template-columns/.test(temaDoPainel) && temaDoPainel.includes(".pn-mesa-lateral"));
conferir("migração dos recados com a categoria", ler("supabase", "migracoes", "20261106-painel-recados.sql").includes("'categoria', a.categoria") && /avisos_meus\(\)[^$]*\$\$\s*select[^\n]*'categoria', a\.categoria/.test(ler("supabase", "install.sql")));
conferir("recados-grupos: sem a palavra proibida", !/universidade|diploma/i.test(ler("components", "painel", "recados-grupos.ts")));

console.log(`${ok} conferências ok, ${falhas.length} falhas.`);
for (const f of falhas) console.log(`FALHOU: ${f}`);
process.exit(falhas.length ? 1 : 0);
