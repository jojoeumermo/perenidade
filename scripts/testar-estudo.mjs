// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere o estudo guardado no navegador: a conta da repetição espaçada, o caderno de erros e a cópia de segurança
// (que nunca pode levar chave de aparelho, de sala ou de sessão).
import { avaliarSenha } from "../lib/forca-senha.ts";
import { agendar, apagarErro, guardarCartoes, idDaQuestao, lerCartoes, lerCopia, lerErros, montarCopia, paraHoje, refazerErro, registrarErro, responderCartao, restaurarCopia, somarDias } from "../lib/estudo.ts";

let ok = 0;
const falhas = [];
const conferir = (nome, cond, detalhe = "") => (cond ? ok++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));

class Memoria {
  constructor(d = {}) { this.d = { ...d }; }
  get length() { return Object.keys(this.d).length; }
  key(i) { return Object.keys(this.d)[i] ?? null; }
  getItem(k) { return k in this.d ? this.d[k] : null; }
  setItem(k, v) { this.d[k] = String(v); }
  removeItem(k) { delete this.d[k]; }
}
globalThis.localStorage = new Memoria();

// Repetição espaçada
const dia = "2026-10-18";
conferir("errei volta hoje", agendar({ caixa: 4 }, "errei", dia).proxima === dia && agendar({ caixa: 4 }, "errei", dia).caixa === 0);
conferir("bom sobe uma caixa", agendar({ caixa: 2 }, "bom", dia).caixa === 3 && agendar({ caixa: 2 }, "bom", dia).proxima === somarDias(dia, 7));
conferir("fácil sobe duas", agendar({ caixa: 0 }, "facil", dia).caixa === 2);
conferir("difícil não desce", agendar({ caixa: 3 }, "dificil", dia).caixa === 3);
conferir("teto da caixa", agendar({ caixa: 6 }, "facil", dia).caixa === 6 && agendar({ caixa: 6 }, "facil", dia).proxima === somarDias(dia, 60));
conferir("virada de mês", somarDias("2026-01-31", 1) === "2026-02-01" && somarDias("2026-12-31", 1) === "2027-01-01");
conferir("guarda sem repetir", guardarCartoes([{ frente: "a", verso: "b", origem: "x" }, { frente: "a", verso: "b", origem: "y" }, { frente: "", verso: "z", origem: "x" }]) === 1);
conferir("cartão novo é para hoje", paraHoje().length === 1);
const [c] = lerCartoes();
responderCartao(c.id, "bom");
conferir("respondido sai de hoje", paraHoje().length === 0 && lerCartoes()[0].caixa === 1);

// Caderno de erros
const id = idDaQuestao("Quanto é 2+2?", ["3", "4"]);
conferir("id estável", id === idDaQuestao("Quanto é 2+2?", ["3", "4"]) && id !== idDaQuestao("Quanto é 2+2?", ["4", "3"]));
registrarErro({ pergunta: "Quanto é 2+2?", opcoes: ["3", "4"], resposta: 1, escolhida: 0, origem: "aula" });
registrarErro({ pergunta: "Quanto é 2+2?", opcoes: ["3", "4"], resposta: 1, escolhida: 0, origem: "simulado" });
conferir("o mesmo erro é um só", lerErros().length === 1 && lerErros()[0].origem === "simulado");
conferir("um acerto não basta", refazerErro(id, true, 1) === false && lerErros().length === 1);
refazerErro(id, false, 0);
conferir("erro zera a sequência", lerErros()[0].seguidos === 0);
refazerErro(id, true, 1);
conferir("dois acertos seguidos tiram da lista", refazerErro(id, true, 1) === true && lerErros().length === 0);
registrarErro({ id: "x1", pergunta: "p", opcoes: ["a", "b"], resposta: 0, escolhida: 1, origem: "caderno" });
apagarErro("x1");
conferir("apagar", lerErros().length === 0);

// Cópia de segurança
const origem = new Memoria({
  "lucia:caderno": JSON.stringify([{ id: "k1", titulo: "Velho", atualizado: 1 }]),
  "lucia:revisao": "[]",
  "lucia:lab:python:ex1": "print(1)",
  "lucia:ouvido:ep1": "120",
  "lucia:sala-chave": "SEGREDO",
  "lucia:sessao": "x",
  "lucia:aparelho:abc:def": "chave",
  "lucia:seguranca:1:eu": "y",
  "lucia:rascunho:conversa1": "oi",
  "outra-coisa": "z",
});
const copia = montarCopia(origem, new Date("2026-10-18T10:00:00Z"));
const chaves = Object.keys(copia.dados).sort();
conferir("só estudo entra na cópia", JSON.stringify(chaves) === JSON.stringify(["lucia:caderno", "lucia:lab:python:ex1", "lucia:ouvido:ep1", "lucia:revisao"]), JSON.stringify(chaves));
conferir("arquivo inválido é recusado", lerCopia("{}") === null && lerCopia("não é json") === null && lerCopia(JSON.stringify({ formato: "outro", versao: 1, dados: {} })) === null);
const forjada = lerCopia(JSON.stringify({ formato: "lucia-copia", versao: 1, dados: { "lucia:sala-chave": "X", "lucia:aparelho:1:2": "Y", "lucia:erros": "[]", "lucia:caderno": 5 } }));
conferir("cópia forjada não grava chave proibida", forjada && JSON.stringify(Object.keys(forjada.dados)) === JSON.stringify(["lucia:erros"]));
const destino = new Memoria({ "lucia:caderno": JSON.stringify([{ id: "k1", titulo: "Novo", atualizado: 5 }, { id: "k2", titulo: "Daqui", atualizado: 2 }]), "lucia:sala-chave": "MEU" });
const n = restaurarCopia(lerCopia(JSON.stringify(copia)), destino);
const cadernos = JSON.parse(destino.getItem("lucia:caderno"));
conferir("restaura e junta por id", n === 4 && cadernos.length === 2 && cadernos.find((x) => x.id === "k1").titulo === "Novo", JSON.stringify(cadernos));
conferir("restaurar não toca em chave de sala", destino.getItem("lucia:sala-chave") === "MEU");

// Senha nova: 12 ou mais, nada comum, nada de nome com número, nada de repetição; frase longa sem símbolo é forte.
conferir("curta não passa", !avaliarSenha("Ab1!xyz").aceita);
conferir("comum com enfeite não passa", !avaliarSenha("Senha123456!").aceita && !avaliarSenha("Flamengo2024").aceita && !avaliarSenha("qwertyuiop12").aceita);
conferir("sequência não passa", !avaliarSenha("123456789012").aceita && !avaliarSenha("abcdefghijkl").aceita);
conferir("repetição não passa", !avaliarSenha("aaaaaaaaaaaa").aceita && !avaliarSenha("121212121212").aceita && !avaliarSenha("abcabcabcabc").aceita);
conferir("nome com número não passa", !avaliarSenha("paulo2024abc", ["Paulo Professor"]).aceita);
conferir("frase longa com o nome passa", avaliarSenha("paulo e maria foram ao mercado", ["Paulo Professor"]).aceita);
conferir("frase longa sem símbolo é forte", avaliarSenha("minha avó plantava feijão no quintal").forca === 3);
conferir("aceita senha de gerenciador", avaliarSenha("k8#Qz!pW2vR9mT").aceita);

for (const f of falhas) console.log(`  ✗ ${f}`);
console.log(`estudo: ${ok} conferências certas, ${falhas.length} falhas`);
process.exit(falhas.length ? 1 : 0);
