// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A lista das atividades do Cantinho da Lua, num arquivo comum (sem "use client"): o servidor lê para gerar as páginas.
export const ATIVIDADES = [
  { id: "letras", nome: "Letras e sílabas", idade: "4 a 7 anos", desenho: "🔤", cor: "#FFD9A0", texto: "Toque na letra e ouça. Monte palavras com sílabas." },
  { id: "historias", nome: "Parlendas e fábulas", idade: "4 a 7 anos", desenho: "📖", cor: "#C9E4FF", texto: "Ouça e leia junto, com a palavra acendendo." },
  { id: "contas", nome: "Tabuada e frações", idade: "8 a 12 anos", desenho: "✖️", cor: "#D6F0C8", texto: "Contas sem pressa e pizzas para dividir." },
  { id: "robo", nome: "Programe o robô", idade: "8 a 12 anos", desenho: "🤖", cor: "#E6D6FF", texto: "Monte os blocos e leve o robô até a estrela." },
  { id: "seguranca", nome: "Internet segura", idade: "8 a 12 anos", desenho: "🛡️", cor: "#FFD6DC", texto: "Histórias para saber se proteger na internet." },
  { id: "imprimir", nome: "Para imprimir", idade: "4 a 12 anos", desenho: "🖨️", cor: "#F4EBDB", texto: "Caça-palavras e labirintos para o papel." },
] as const;
export type AtividadeId = (typeof ATIVIDADES)[number]["id"];
