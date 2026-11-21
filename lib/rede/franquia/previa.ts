// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Só na PRÉVIA (NEXT_PUBLIC_ALUMIA_PREVIA=sim, sem banco nem servidor de caixas): uma prova de exemplo para cada mensagem do dublê do
// chat, para a tela da denúncia com prova aparecer como vai ser. O compromisso é de verdade (confere com o texto); a caixa e a marca
// são sorteadas, então nenhum servidor aceitaria esta prova: na prévia, a denúncia nem sai do aparelho.
//
// Sem "@/" de propósito.
import { b64, bytesDe, compromisso, novaChaveDeFranquia, type ProvaDeFranquia } from "./protocolo";

const feitas = new Map<string, ProvaDeFranquia>();

/** A prova de exemplo de uma mensagem do dublê (a mesma enquanto a página vive). */
export function provaDeExemplo(id: string, texto: string, dia = new Date().toISOString().slice(0, 10)): ProvaDeFranquia {
  const ja = feitas.get(id);
  if (ja) return ja;
  const conteudo = bytesDe(JSON.stringify({ t: texto }));
  const kf = novaChaveDeFranquia();
  const idH = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const prova: ProvaDeFranquia = {
    v: 1, origem: "conversa", caixa: b64(idH), dia, kf: b64(kf), c: b64(compromisso(kf, idH, conteudo)),
    marca: b64(globalThis.crypto.getRandomValues(new Uint8Array(32))), conteudo: b64(conteudo),
  };
  feitas.set(id, prova);
  return prova;
}
