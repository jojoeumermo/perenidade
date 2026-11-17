// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A lista ABERTA de termos do "aviso antes de publicar" (L3-22): qualquer pessoa lê aqui o que dispara o aviso e pode propor
// mudança. Fica no aparelho: o texto nunca sai para ser conferido em lugar nenhum, e a lista só AVISA (o segundo toque publica).
// O banco tem a regra própria de retenção para a mediação ler (interno.rede_triagem e a regra simples de ódio do rede_publicar);
// esta lista é outra coisa, um espelho para a pessoa pensar antes.
//
// Como escrever: minúsculas, sem acento (a comparação tira acento, troca 4→a, 3→e, 0→o, 1→i, 5→s, @→a, $→s e junta letra
// repetida: "viadooo" vira "viado"). Expressão de mais de uma palavra entra com espaço. Palavra inteira: "bichano" não casa com
// "bicha". Sem gíria que mude de sentido conforme a região sem o agravo: o aviso que dispara à toa vira ruído.
//
// Grupos: racismo, LGBTfobia, capacitismo, machismo, xenofobia e classe, e o insulto pessoal forte.

export const TERMOS_OFENSIVOS: readonly string[] = [
  // racismo
  "macaco", "macaca", "crioulo", "crioula", "negro imundo", "preto imundo", "cabelo ruim", "serviço de preto", "judeu imundo",
  // LGBTfobia
  "viado", "bicha", "baitola", "boiola", "sapatão", "sapatona", "traveco",
  // capacitismo
  "retardado", "retardada", "mongoloide", "débil mental", "aleijado", "aleijada", "demente",
  // machismo
  "vagabunda", "vadia", "piranha", "puta", "biscate", "lugar de mulher é na cozinha",
  // xenofobia e classe
  "nordestino imundo", "baiano burro", "paraíba burro", "favelado imundo", "bando de pobre",
  // insulto pessoal forte
  "filho da puta", "fdp", "arrombado", "arrombada", "desgraçado", "desgraçada", "escroto", "escrota", "verme", "lixo humano",
  "imbecil", "otário", "otária", "idiota", "babaca", "cretino", "cretina", "vai se foder", "vai tomar no cu", "se mata",
];
