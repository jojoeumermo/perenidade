// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o conteúdo das mensagens das conversas (lib/mensagem.ts): empacotar e ler citação, encaminhada, menções, prévia e
// reação; menções @nome; links e prévia feita só do endereço; formatação simples. Uso: npm run testar:mensagens
import { desempacotar, empacotar, extrairMencoes, formatar, linksDe, previaDoLink, reacoes, semFormatacao, trechoDe } from "../lib/mensagem.ts";

let certos = 0;
const falhas = [];
function confere(nome, fazer) {
  try {
    if (!fazer()) throw new Error("não confere");
    certos++;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
  }
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── Empacotar e ler ──
confere("texto puro vai como está", () => empacotar({ texto: "Bom dia." }) === "Bom dia.");
confere("texto puro lido como está", () => igual(desempacotar("Bom dia."), { texto: "Bom dia." }));
const citacao = { id: "m1", autor: "u1", nome: "Ana", trecho: "Reunião às 19h" };
confere("citação, encaminhada, menções e prévia vão dentro do pacote e voltam iguais", () => {
  const pacote = empacotar({ texto: "Confirmo.", citando: citacao, encaminhada: true, mencoes: ["u2"], previa: { url: "https://exemplo.org/aula-de-fracoes", dominio: "exemplo.org", titulo: "Aula de fracoes" } });
  const lido = desempacotar(pacote);
  return pacote.startsWith("j1.") && lido.texto === "Confirmo." && igual(lido.citando, citacao) && lido.encaminhada === true && igual(lido.mencoes, ["u2"]) && lido.previa.dominio === "exemplo.org";
});
confere("campos vazios não geram pacote", () => empacotar({ texto: "Oi", mencoes: [], encaminhada: false }) === "Oi");
confere("texto que começa com o prefixo é protegido num pacote", () => desempacotar(empacotar({ texto: "j1.não sou json" })).texto === "j1.não sou json");
confere("pacote quebrado vira texto", () => desempacotar("j1.{isto não é json").texto === "j1.{isto não é json");
confere("campos estranhos no pacote são ignorados e os longos cortados", () => {
  const lido = desempacotar(`j1.${JSON.stringify({ texto: "x".repeat(5000), citando: { id: 5 }, mencoes: ["a", 7, "b"], previa: { url: "javascript:alert(1)" }, emoji: "💣", lixo: true })}`);
  return lido.texto.length === 4000 && lido.citando === undefined && igual(lido.mencoes, ["a", "b"]) && lido.previa === undefined && lido.emoji === undefined && !("lixo" in lido);
});
confere("reação só com emoji da lista", () => desempacotar(empacotar({ texto: "", emoji: reacoes[0] })).emoji === reacoes[0] && desempacotar(empacotar({ texto: "", emoji: "🍕" })).emoji === undefined);
confere("trecho corta com reticências e junta espaços", () => trechoDe("Linha um\n\n   linha dois", 12) === "Linha um li…" && trechoDe("curto") === "curto");

confere("enquete, evento, voto e resposta vão dentro do pacote e são conferidos", () => {
  const lido = desempacotar(empacotar({ texto: "", enquete: { pergunta: "Que dia?", opcoes: ["Sábado", "Domingo", "", 7], varias: true }, evento: { titulo: "Reunião", quando: "2026-11-01T18:00:00.000Z", local: "Sede" } }));
  const voto = desempacotar(empacotar({ texto: "", voto: [1, 1, 99, -1, "x"] }));
  const rsvp = desempacotar(empacotar({ texto: "", rsvp: "talvez" }));
  const ruim = desempacotar(`j1.${JSON.stringify({ texto: "", enquete: { pergunta: "Só uma opção", opcoes: ["a"] }, evento: { titulo: "Sem data", quando: "ontem" }, rsvp: "sim" })}`);
  return igual(lido.enquete, { pergunta: "Que dia?", opcoes: ["Sábado", "Domingo"], varias: true }) && igual(lido.evento, { titulo: "Reunião", quando: "2026-11-01T18:00:00.000Z", local: "Sede" }) && igual(voto.voto, [1]) && rsvp.rsvp === "talvez" && ruim.enquete === undefined && ruim.evento === undefined && ruim.rsvp === undefined;
});

// ── Menções ──
const membros = [{ id: "u1", nome: "Ana Clara" }, { id: "u2", nome: "José da Silva" }, { id: "u3", nome: "Lúcia" }];
confere("@primeiro-nome e @nome-inteiro, sem acento e sem maiúsculas", () => igual(extrairMencoes("Oi @ana e @jose da silva, vejam com a @LUCIA", membros).sort(), ["u1", "u2", "u3"]));
confere("@ colado em outra palavra não é menção", () => extrairMencoes("e-mail: fulano@ana.com", membros).length === 0);
confere("nome parecido não pega", () => extrairMencoes("@an não é a Ana", membros).length === 0);

// ── Links e prévia ──
confere("acha links http e www, sem a pontuação do fim", () => igual(linksDe("Veja https://exemplo.org/aula, e www.site.br/pagina."), ["https://exemplo.org/aula", "https://www.site.br/pagina"]));
confere("prévia feita só do endereço: domínio e título do caminho", () => igual(previaDoLink("https://www.marxists.org/portugues/marx/1867/capital/index.htm"), { url: "https://www.marxists.org/portugues/marx/1867/capital/index.htm", dominio: "marxists.org", titulo: "Index" }));
confere("prévia de endereço sem caminho usa o domínio", () => previaDoLink("https://institutolucia.org").titulo === "institutolucia.org");
confere("prévia recusa o que não é http", () => previaDoLink("javascript:alert(1)") === null && previaDoLink("não é link") === null);

// ── Formatação ──
confere("negrito, itálico, tachado e mono", () => {
  const [linha] = formatar("um *dois* _três_ ~quatro~ `cinco` seis");
  return igual(linha.pedacos.map((p) => `${p.tipo}:${p.valor}`), ["texto:um ", "negrito:dois", "texto: ", "italico:três", "texto: ", "tachado:quatro", "texto: ", "mono:cinco", "texto: seis"]);
});
confere("marca solta no meio da palavra não formata", () => {
  const [linha] = formatar("2*3 = 6 e a_b_c");
  return linha.pedacos.length === 1 && linha.pedacos[0].valor === "2*3 = 6 e a_b_c";
});
confere("marca sem fechamento fica como texto", () => formatar("*sem fim")[0].pedacos[0].valor === "*sem fim");
confere("lista com traço e numerada", () => {
  const linhas = formatar("Pauta:\n- um\n- dois\n1. três");
  return linhas[0].item === undefined && linhas[1].item && linhas[1].item.numero === undefined && linhas[1].pedacos[0].valor === "um" && linhas[3].item.numero === 1;
});
confere("link e menção dentro da linha", () => {
  const [linha] = formatar("Veja https://exemplo.org/x, @Ana.", membros);
  return igual(linha.pedacos.map((p) => p.tipo), ["texto", "link", "texto", "mencao", "texto"]) && linha.pedacos[1].href === "https://exemplo.org/x" && linha.pedacos[3].id === "u1";
});
confere("negrito com link dentro vira só negrito (sem exagero)", () => formatar("*veja https://x.org*")[0].pedacos[0].tipo === "negrito");
confere("sem formatação para a lista de conversas", () => semFormatacao("*oi* _tudo_ bem\n- sim") === "oi tudo bem\nsim");

confere("||spoiler|| fica escondido e some da prévia", () => { const [linha] = formatar("o fim é ||ela vence|| mesmo"); return linha.pedacos[1].tipo === "spoiler" && linha.pedacos[1].valor === "ela vence" && semFormatacao("o fim é ||ela vence||") === "o fim é ▒▒▒"; });
confere(":estrela: vira emoji do instituto; :nada: fica texto", () => { const [linha] = formatar("valeu :estrela: e :nada:"); return linha.pedacos.some((p) => p.tipo === "emoji" && p.nome === "estrela") && linha.pedacos.some((p) => p.tipo === "texto" && p.valor.includes(":nada:")); });
confere("> citação em bloco", () => { const linhas = formatar("> o povo unido\njamais será vencido"); return linhas[0].citacao === true && linhas[0].pedacos[0].valor === "o povo unido" && !linhas[1].citacao; });
confere("bloco de código vai como está", () => { const linhas = formatar("veja:\n```\n*não* é negrito\n```\nfim"); return linhas.length === 3 && linhas[1].codigo === "*não* é negrito" && linhas[2].pedacos[0].valor === "fim"; });
confere("os emojis do instituto entram nas reações", () => reacoes.includes(":estrela:") && desempacotar(empacotar({ texto: "", emoji: ":punho:" })).emoji === ":punho:");

console.log(`${certos} conferências certas${falhas.length ? `, ${falhas.length} com problema.` : "."}`);
for (const falha of falhas) console.log(`  ✗ ${falha}`);
process.exit(falhas.length ? 1 : 0);
