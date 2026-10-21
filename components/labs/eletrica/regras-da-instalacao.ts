// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A lógica do treino de instalação (sem desenho): os terminais, os fios, quem fica ligado a quem e o que acontece ao
// ligar o disjuntor. Separada do componente para poder ser testada no Node (scripts/testar-eletrica.mjs).

export const TERMINAIS = {
  "Q.F": "Quadro: saída do disjuntor (fase)",
  "Q.N": "Quadro: barramento de neutro",
  "Q.T": "Quadro: barramento de terra",
  "I.1": "Interruptor: borne 1",
  "I.2": "Interruptor: borne 2",
  "L.C": "Lâmpada: contato central do bocal",
  "L.R": "Lâmpada: rosca do bocal",
  "T.F": "Tomada: furo da fase",
  "T.N": "Tomada: furo do neutro",
  "T.T": "Tomada: pino de terra",
} as const;
export type Terminal = keyof typeof TERMINAIS;
export const CORES = [["preto", "#1b1b1b"], ["vermelho", "#c21f16"], ["marrom", "#7a4a24"], ["azul-claro", "#7fb2e5"], ["verde-amarelo", "#3c9a3c"], ["branco", "#e9e2d0"], ["amarelo", "#e8b520"]] as const;
export type Cor = (typeof CORES)[number][0];
export interface Fio { de: Terminal; para: Terminal; cor: Cor }

export function grupos(fios: Fio[], interruptorLigado: boolean) {
  const pai = new Map<Terminal, Terminal>();
  const achar = (t: Terminal): Terminal => {
    const p = pai.get(t) ?? t;
    if (p === t) return t;
    const r = achar(p);
    pai.set(t, r);
    return r;
  };
  const unir = (a: Terminal, b: Terminal) => pai.set(achar(a), achar(b));
  for (const f of fios) unir(f.de, f.para);
  if (interruptorLigado) unir("I.1", "I.2");
  return achar;
}

export interface Resultado { titulo: string; tipo: "ok" | "aviso" | "perigo"; itens: string[] }

/** O que acontece ao ligar o disjuntor, com o interruptor ligado e desligado. */
export function avaliar(fios: Fio[]): Resultado {
  const ligado = grupos(fios, true);
  const desligado = grupos(fios, false);
  const itens: string[] = [];
  const mesmo = (achar: (t: Terminal) => Terminal, a: Terminal, b: Terminal) => achar(a) === achar(b);
  if (mesmo(ligado, "Q.F", "Q.N")) return { titulo: "Curto-circuito: o disjuntor desarmou na hora.", tipo: "perigo", itens: ["Algum caminho liga a fase direto ao neutro, sem nada no meio (com o interruptor ligado). Num caso real há faísca, o fio esquenta e o disjuntor desarma. Confira se o interruptor e a lâmpada estão no caminho, e não em paralelo com ele."] };
  if (mesmo(ligado, "Q.F", "Q.T")) return { titulo: "Fuga para a terra: o DR desarmou.", tipo: "perigo", itens: ["A fase encostou no terra. O dispositivo DR existe exatamente para desligar nesse caso e evitar choque."] };
  if (mesmo(ligado, "Q.N", "Q.T") && fios.some((f) => [f.de, f.para].some((t) => t.startsWith("T.") || t.startsWith("L.")))) itens.push("Neutro e terra ligados juntos fora do quadro: o DR pode desarmar sozinho e o terra deixa de proteger. Cada um no seu barramento.");
  // A lâmpada acende se um terminal dela está na fase e o outro no neutro.
  const acende = (achar: (t: Terminal) => Terminal) => (mesmo(achar, "L.C", "Q.F") && mesmo(achar, "L.R", "Q.N")) || (mesmo(achar, "L.R", "Q.F") && mesmo(achar, "L.C", "Q.N"));
  const acesaLigado = acende(ligado);
  const acesaDesligado = acende(desligado);
  if (!acesaLigado) itens.push("A lâmpada não acende com o interruptor ligado: falta o caminho fase → interruptor → lâmpada → neutro.");
  else if (acesaDesligado) itens.push("A lâmpada fica acesa mesmo com o interruptor desligado: ele não está no caminho da lâmpada (está solto, ou ligado só de um lado).");
  else itens.push("✓ A lâmpada acende e apaga pelo interruptor.");
  if (acesaLigado && !acesaDesligado) {
    // Interruptor no neutro: a lâmpada apaga, mas continua com fase.
    if (mesmo(desligado, "L.C", "Q.F") || mesmo(desligado, "L.R", "Q.F")) itens.push("Cuidado: o interruptor está cortando o neutro. A lâmpada apaga, mas continua com fase: quem for trocá-la com o interruptor desligado pode levar choque. O interruptor sempre corta a fase.");
    if (mesmo(ligado, "L.R", "Q.F")) itens.push("A fase (retorno) chegou na rosca do bocal: quem encostar na rosca ao trocar a lâmpada pode levar choque. O retorno vai no contato central; o neutro, na rosca.");
  }
  const tomadaFase = mesmo(ligado, "T.F", "Q.F") || mesmo(ligado, "T.N", "Q.F");
  const tomadaNeutro = mesmo(ligado, "T.N", "Q.N") || mesmo(ligado, "T.F", "Q.N");
  if (tomadaFase && tomadaNeutro) {
    itens.push(mesmo(ligado, "T.F", "Q.F") ? "✓ A tomada tem fase e neutro." : "A tomada funciona, mas fase e neutro estão trocados de furo. Padronizar sempre o mesmo lado facilita a manutenção.");
    if (mesmo(ligado, "T.T", "Q.T")) itens.push("✓ O pino de terra da tomada está ligado ao terra do quadro.");
    else itens.push("A tomada está sem terra. A NBR 5410 pede o condutor de proteção (terra) nas tomadas: sem ele, a carcaça de um aparelho com defeito pode dar choque.");
  } else if (tomadaFase || tomadaNeutro) itens.push("A tomada está ligada só de um lado: um aparelho ligado nela não funciona.");
  else itens.push("A tomada ainda não está ligada.");
  if (!tomadaFase && !tomadaNeutro && !acesaLigado) return { titulo: "Nada liga ainda.", tipo: "aviso", itens };
  // Cores dos fios.
  for (const f of fios) {
    const daFase = mesmo(desligado, f.de, "Q.F") || mesmo(desligado, f.para, "Q.F");
    const doNeutro = mesmo(desligado, f.de, "Q.N") || mesmo(desligado, f.para, "Q.N");
    const doTerra = mesmo(desligado, f.de, "Q.T") || mesmo(desligado, f.para, "Q.T");
    if (doTerra && f.cor !== "verde-amarelo") itens.push(`O fio de ${TERMINAIS[f.de]} a ${TERMINAIS[f.para]} é terra: pela norma ele é verde-amarelo (ou verde).`);
    else if (doNeutro && !doTerra && f.cor !== "azul-claro") itens.push(`O fio de ${TERMINAIS[f.de]} a ${TERMINAIS[f.para]} é neutro: pela norma ele é azul-claro.`);
    else if (!doNeutro && !doTerra && (f.cor === "azul-claro" || f.cor === "verde-amarelo")) itens.push(`O fio de ${TERMINAIS[f.de]} a ${TERMINAIS[f.para]} leva fase ou retorno, mas está em ${f.cor}: essa cor é reservada ${f.cor === "azul-claro" ? "ao neutro" : "ao terra"}. Quem mexer depois vai achar que não dá choque.`);
    else if (daFase) continue;
  }
  const perigo = itens.some((i) => i.startsWith("Cuidado") || i.includes("pode levar choque") || i.includes("pode dar choque"));
  const tudoCerto = itens.every((i) => i.startsWith("✓"));
  return { titulo: tudoCerto ? "Instalação certa: a lâmpada responde ao interruptor e a tomada tem fase, neutro e terra." : perigo ? "Funciona, mas com risco." : "Ainda falta acertar.", tipo: tudoCerto ? "ok" : perigo ? "perigo" : "aviso", itens };
}

