// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere o manual da coordenação (Etapa 8, pacote manual): o texto existe e é curto, cobre as tarefas pedidas, só cita
// seções e botões que existem, a cópia usada no painel está em dia e a aba Ajuda está ligada. Rodar: npm run testar:manual-painel
import fs from "node:fs";
import path from "node:path";
import { ESPACOS } from "../components/painel/estrutura.ts";
import { gerar } from "./gerar-manual-painel.mjs";

const raiz = path.join(import.meta.dirname, "..");
const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), "utf8");
let ok = 0;
const falhas = [];
const conferir = (nome, cond, detalhe = "") => (cond ? ok++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));

const md = ler("docs", "MANUAL-DA-COORDENACAO.md").replace(/\r\n/g, "\n");
// O registro de seções saiu de Painel.tsx para casca/Dentro.tsx no redesenho (docs/PAINEL-REDESENHO.md): lemos os dois.
const painel = ler("components", "painel", "Painel.tsx") + "\n" + ler("components", "painel", "casca", "Dentro.tsx");
const codigo = ["Fila", "Curriculo", "Cuidar", "RedePropostas", "ValeOEscrito", "ValeOEscritoEditor", "Interdicao", "Supervisao"]
  .map((n) => ler("components", "painel", `${n}.tsx`))
  .join("\n");

// 1. Curto e completo.
const linhas = md.split("\n").length;
conferir("manual curto (até 250 linhas)", linhas <= 250, String(linhas));
const titulos = [...md.matchAll(/^#{2,3} (.+)$/gm)].map((m) => m[1]);
for (const t of ["Aprovar uma aula", "Publicar agora", "Moderar a comunidade", "Ligar um recurso novo", "Responder à imprensa", "Curadoria do Vale o Escrito", "Rede Lúcia", "O que é seguro e o que pede uma segunda pessoa", "Como o painel está arrumado"]) {
  conferir(`tem a parte "${t}"`, titulos.some((x) => x.includes(t)));
}
conferir("cada tarefa é passo a passo (listas numeradas)", (md.match(/^1\. /gm) ?? []).length >= 7);
conferir("tem a divisão seguro, cuidado, segunda pessoa e nunca", ["**Seguro, pode fazer sozinho**", "**Pede cuidado", "**Pede uma segunda pessoa**", "**Nunca**"].every((s) => md.includes(s)));
conferir("sem a palavra proibida", !/universidade|diploma/i.test(md));
conferir("sem emoji", !/\p{Extended_Pictographic}/u.test(md));

// 2. Os oito espaços do menu estão no manual, com o nome exato.
for (const e of ESPACOS) conferir(`espaço "${e.nome}" no manual`, md.includes(`**${e.nome}**`));

// 3. Seções citadas existem no registro do painel.
const nomesDoRegistro = [...painel.matchAll(/\{ id: "[a-z-]+", nome: (?:cuidaDaSaude \? )?"([^"]+)"/g)].map((m) => m[1]);
for (const s of ["Fila de revisão", "Triagem", "Comunidade", "Rede: propostas de comunidade", "Vale o Escrito: curadoria", "Disciplinas e trilhas", "Controles do site", "Estado técnico", "Erros relatados", "Segurança e sucessão", "Interdição e expurgo", "Registro de atividades", "Termos assinados", "Departamentos", "Avisos à equipe", "Pesquisa dos 12 eixos", "Voluntários e convites", "Mural dos Trabalhadores", "Gaveta Aberta", "Aula de reforço"]) {
  conferir(`seção "${s}" existe no painel`, nomesDoRegistro.includes(s), s);
  conferir(`seção "${s}" aparece no manual`, md.includes(s), s);
}

// 4. Botões e frases citados existem na tela.
for (const b of ["Publicar agora", "Aprovar", "Não aprovar", "Liberar para a fila de revisão", "Barrar", "Banir quem escreveu", "Aprovar e publicar", "Retirar entrada", "Mesclar", "Devolver", "Recusar", "EXPURGAR", "Mudanças"]) {
  conferir(`"${b}" existe na tela`, codigo.includes(b), b);
}
conferir("recurso rede-v2 citado e real", md.includes("rede-v2") && ler("lib", "recursos.ts").includes('"rede-v2"'));
for (const r of ["escola", "vale-o-escrito", "rede-v2"]) conferir(`"${r}" só liga pelo nome`, new RegExp(`SO_PELO_NOME[^=]*=\\s*\\[[^\\]]*"${r}"`).test(ler("lib", "recursos.ts")) && md.includes(r));
conferir("caixa de imprensa descrita como existe",md.includes("Comunidade e atendimento, Caixa de imprensa"));
// O backend-1 entregou o interruptor e as confirmações; o manual agora diz o que existe e o limite (página montada no deploy).
conferir("diz o que existe e o limite do interruptor", ["Controles avançados", "pedido de segunda pessoa", "só mudam no próximo deploy", "Zerar o segundo fator ou os aparelhos de alguém", "Segurança, Confirmações"].every((s) => md.includes(s)));
conferir("não diz mais que o interruptor e o zerar 2FA não existem", !md.includes("Ainda não: ligar e desligar") && !md.includes("Ainda não existe: zerar"));

// 5. Dentro do painel: mesma fonte, aba ligada, sem cor à mão.
conferir("cópia do painel em dia (rode npm run manual-painel)", ler("components", "painel", "manual-texto.ts").replace(/\r\n/g, "\n") === gerar(md));
const ajuda = ler("components", "painel", "Ajuda.tsx");
conferir("Ajuda lê o texto gerado", ajuda.includes('from "./manual-texto"'));
conferir("Ajuda sem cor escrita à mão", !/#[0-9a-fA-F]{3,8}\b|rgb\(/.test(ajuda));
const conta = ler("components", "painel", "MinhaConta.tsx");
conferir("Minha conta tem a aba Ajuda", conta.includes('{ id: "ajuda", nome: "Ajuda" }') && conta.includes('aba === "ajuda"'));
conferir("Ajuda carrega só quando abre", /dynamic\(\(\) => import\("\.\/Ajuda"\)/.test(conta));

// 6. O manual em HTML aponta para o novo.
const html = ler("docs", "manual-do-painel.html");
conferir("manual-do-painel.html aponta para o novo", html.includes("MANUAL-DA-COORDENACAO.md") && html.includes("aba Ajuda"));

if (falhas.length) {
  console.error(`FALHOU: ${falhas.length}\n- ${falhas.join("\n- ")}\n(${ok} ok)`);
  process.exit(1);
}
console.log(`${ok} conferências ok, 0 falhas.`);
