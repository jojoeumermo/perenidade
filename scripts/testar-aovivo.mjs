// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a conferência da sala das aulas ao vivo (lib/aovivo.ts), com chaves de verdade e sem rede: só quem conduz, com a
// chave registrada no banco e a presença assinada, é tratado como quem ensina; quem assiste não aceita vídeo de mais
// ninguém; assinatura de outra aula, de outro destinatário ou de outro conteúdo não serve. Uso: npm run testar:aovivo
import { amarraDoSinal, conferirEducadores, Credencial, provaDaPresenca, sinalAceito } from "../lib/aovivo-conferencia.ts";

let certos = 0;
const falhas = [];
async function espera(nome, conferir) {
  try {
    if (!(await conferir())) throw new Error("resultado inesperado");
    certos++;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
  }
}

const AULA = "11111111-1111-1111-1111-111111111111";
const educadora = await Credencial.nova();
const intrusa = await Credencial.nova();
const presencaDe = async (chave, credencial, aula = AULA) => ({ chave, nome: "Profa.", papel: "educador", publica: credencial.publica, prova: await credencial.assinar(provaDaPresenca(aula, chave)) });

const verdadeira = await presencaDe("edu-1", educadora);
const copiada = { ...verdadeira, chave: "intrusa-1" };
const semChaveNoBanco = await presencaDe("intrusa-2", intrusa);
const deOutraAula = await presencaDe("edu-2", educadora, "22222222-2222-2222-2222-222222222222");
const declarada = { chave: "intrusa-3", nome: "Profa.", papel: "educador" };
const aluno = { chave: "aluno-1", nome: "Lia", papel: "aluno" };

const conferidos = await conferirEducadores(AULA, [verdadeira, copiada, semChaveNoBanco, deOutraAula, declarada, aluno], [educadora.publica]);
await espera("quem conduz, com a chave do banco e a presença assinada, é conferido", () => conferidos.get("edu-1") === educadora.publica);
await espera("copiar a presença de quem conduz para outra chave de navegador não serve", () => !conferidos.has("intrusa-1"));
await espera("chave que não está no banco não serve", () => !conferidos.has("intrusa-2"));
await espera("presença assinada para outra aula não serve", () => !conferidos.has("edu-2"));
await espera("dizer que é educador, sem assinatura, não serve", () => !conferidos.has("intrusa-3"));
await espera("quem assiste não entra na lista", () => !conferidos.has("aluno-1") && conferidos.size === 1);
await espera("banco antigo (sem chaves): vale o que cada um diz, como antes", async () => (await conferirEducadores(AULA, [declarada, aluno], undefined)).has("intrusa-3"));

const oferta = { t: "oferta", sdp: "v=0 o=- 1 2 IN IP4 127.0.0.1" };
const assinada = await educadora.assinar(amarraDoSinal(AULA, "edu-1", "aluno-1", oferta));
const base = { exigir: true, aula: AULA, eu: aluno, de: "edu-1", dados: oferta, assinatura: assinada, educadores: conferidos, temLigacao: false };
await espera("quem assiste aceita a oferta assinada de quem conduz", () => sinalAceito(base));
await espera("conteúdo trocado no caminho: recusado", () => sinalAceito({ ...base, dados: { ...oferta, sdp: "v=0 outro" } }).then((ok) => !ok));
await espera("assinatura feita para outra pessoa da sala: recusada", () => sinalAceito({ ...base, eu: { ...aluno, chave: "aluno-2" } }).then((ok) => !ok));
await espera("assinatura de outra aula: recusada", () => sinalAceito({ ...base, aula: "22222222-2222-2222-2222-222222222222" }).then((ok) => !ok));
await espera("sem assinatura: recusada", () => sinalAceito({ ...base, assinatura: "" }).then((ok) => !ok));
await espera("assinada por outra chave: recusada", async () => !(await sinalAceito({ ...base, assinatura: await intrusa.assinar(amarraDoSinal(AULA, "edu-1", "aluno-1", oferta)) })));
await espera("quem assiste não aceita oferta de quem não conduz", async () => !(await sinalAceito({ ...base, de: "intrusa-3", assinatura: await intrusa.assinar(amarraDoSinal(AULA, "intrusa-3", "aluno-1", oferta)) })));
await espera("quem assiste não aceita nem candidato de rede de quem não conduz", () => sinalAceito({ ...base, de: "intrusa-3", dados: { t: "ice", c: {} }, assinatura: "", temLigacao: true }).then((ok) => !ok));

const professora = { chave: "edu-1", nome: "Profa.", papel: "educador" };
const paraQuemConduz = { ...base, eu: professora, educadores: conferidos, assinatura: "" };
await espera("quem conduz aceita o pedido de vídeo de quem assiste", () => sinalAceito({ ...paraQuemConduz, de: "aluno-1", dados: { t: "pedir" } }));
await espera("quem conduz não aceita oferta de quem assiste", () => sinalAceito({ ...paraQuemConduz, de: "aluno-1", dados: oferta }).then((ok) => !ok));
await espera("resposta de quem assiste só numa ligação aberta por quem conduz", async () => !(await sinalAceito({ ...paraQuemConduz, de: "aluno-1", dados: { t: "resposta", sdp: "x" } })) && sinalAceito({ ...paraQuemConduz, de: "aluno-1", dados: { t: "resposta", sdp: "x" }, temLigacao: true }));
await espera("com a conferência desligada (banco antigo), tudo passa como antes", () => sinalAceito({ ...base, exigir: false, de: "intrusa-3", assinatura: "" }));

console.log(`${certos} conferências certas, ${falhas.length} com problema.`);
for (const falha of falhas) console.log("  ✗", falha);
process.exit(falhas.length ? 1 : 0);
