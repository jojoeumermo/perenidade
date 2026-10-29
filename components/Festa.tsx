// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useSyncExternalStore } from "react";

/**
 * As datas da festa: um enfeite pequeno pendurado no fio das fitas, logo abaixo da faixa preta, só nos dias de cada
 * festa (bandeirinhas no São João, pisca-pisca no Natal, papel picado no Dia dos Mortos, a faixa tecida no mês da
 * Consciência Negra...). O resto do ano, nada. A data é a de Brasília e quem decide é o navegador, então o enfeite
 * aparece e some no dia certo mesmo numa página montada semanas antes.
 */

const nunca = () => () => {};

/** O domingo de Páscoa (algoritmo anônimo do calendário gregoriano), em milissegundos UTC. */
function pascoa(ano: number): number {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(ano, mes - 1, dia);
}

const DIA = 86_400_000;

export type Festa = "natal" | "reis" | "carnaval" | "mulher" | "pascoa" | "indigena" | "trabalho" | "junina" | "orgulho" | "arvore" | "criancas" | "mortos" | "consciencia";

/** Qual festa cai na data (em Brasília), ou null. */
export function festaDe(agora: Date): Festa | null {
  const brasilia = new Date(agora.getTime() - 3 * 3600 * 1000);
  const ano = brasilia.getUTCFullYear();
  const mes = brasilia.getUTCMonth() + 1;
  const dia = brasilia.getUTCDate();
  const hoje = Date.UTC(ano, mes - 1, dia);
  const p = pascoa(ano);
  // Carnaval: da sexta-feira antes do sábado de Carnaval até a Quarta-feira de Cinzas (46 dias antes da Páscoa).
  if (hoje >= p - 51 * DIA && hoje <= p - 46 * DIA) return "carnaval";
  // Semana Santa: do Domingo de Ramos ao domingo de Páscoa.
  if (hoje >= p - 7 * DIA && hoje <= p) return "pascoa";
  const md = mes * 100 + dia;
  if (md >= 1201 && md <= 1225) return "natal";
  if (md >= 1226 || md <= 106) return "reis";
  if (md === 308) return "mulher";
  if (md === 419) return "indigena";
  if (md === 430 || md === 501) return "trabalho";
  if (md === 628) return "orgulho";
  if (md >= 601 && md <= 731) return "junina";
  if (md >= 915 && md <= 925) return "arvore";
  if (md >= 1010 && md <= 1012) return "criancas";
  if (md === 1101 || md === 1102) return "mortos";
  if (md >= 1103 && md <= 1130) return "consciencia";
  return null;
}

const TINTA = "#1f1a14";
const cordao = (largura: number, queda = 2.5) => `<path d="M0 1.5 Q${largura / 2} ${1.5 + queda * 2} ${largura} 1.5" stroke="${TINTA}" stroke-width=".8" fill="none"/>`;
/** A altura do cordão em x (curva de Bézier quadrática com o ponto de controle no meio). */
const altura = (x: number, largura: number, queda = 2.5) => 1.5 + 4 * queda * (x / largura) * (1 - x / largura);

/** Bandeirinhas de São João: retângulo com o bico cortado embaixo. */
function bandeirinhas(cores: string[]) {
  const passo = 22;
  const largura = cores.length * passo;
  const bandeiras = cores
    .map((cor, i) => {
      const x = 4 + i * passo;
      const y = altura(x + 7, largura) - 0.3;
      return `<path d="M${x} ${y}h14v13l-7-3.6-7 3.6z" fill="${cor}"/>`;
    })
    .join("");
  return { largura, svg: cordao(largura) + bandeiras };
}

const estrela = (cx: number, cy: number, r: number) => {
  const pontos = Array.from({ length: 10 }, (_, i) => {
    const raio = i % 2 === 0 ? r : r * 0.45;
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${(cx + raio * Math.cos(ang)).toFixed(2)},${(cy + raio * Math.sin(ang)).toFixed(2)}`;
  });
  return `<polygon points="${pontos.join(" ")}"/>`;
};

const flor = (cx: number, cy: number, r: number, cor: string, miolo: string) =>
  Array.from({ length: 5 }, (_, i) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return `<circle cx="${(cx + r * Math.cos(ang)).toFixed(2)}" cy="${(cy + r * Math.sin(ang)).toFixed(2)}" r="${(r * 0.85).toFixed(2)}" fill="${cor}"/>`;
  }).join("") + `<circle cx="${cx}" cy="${cy}" r="${(r * 0.6).toFixed(2)}" fill="${miolo}"/>`;

function desenho(festa: Festa): { largura: number; svg: string } {
  switch (festa) {
    case "junina":
      return bandeirinhas(["#f0b323", "#c21f16", "#23408e", "#2e6b4f", "#e4577f"]);
    case "trabalho":
      return bandeirinhas(["#c21f16", "#6e1f1a", "#c21f16", "#6e1f1a"]);
    case "orgulho":
      return bandeirinhas(["#e40303", "#ff8c00", "#ffed00", "#008026", "#004dff", "#750787"]);
    case "natal": {
      // Pisca-pisca: o fio em ondas e uma lâmpada em cada vale.
      const cores = ["#f0b323", "#c21f16", "#2e6b4f", "#23408e", "#e4577f"];
      const fio = `<path d="M0 2 Q15 7 30 2 T60 2 T90 2 T120 2 T150 2" stroke="${TINTA}" stroke-width=".8" fill="none"/>`;
      const lampadas = cores.map((cor, i) => `<rect x="${13.8 + i * 30}" y="4" width="2.4" height="2" fill="${TINTA}"/><ellipse cx="${15 + i * 30}" cy="9.6" rx="2.6" ry="3.8" fill="${cor}"/>`).join("");
      return { largura: 150, svg: fio + lampadas };
    }
    case "reis": {
      // Estrelas de Reis penduradas em fios de comprimentos diferentes.
      const fios = [
        [16, 8, "#f0b323"],
        [48, 12, "#c21f16"],
        [80, 7, "#f0b323"],
      ] as const;
      const corpo = fios.map(([x, y, cor]) => `<path d="M${x} 1.5V${y - 3}" stroke="${TINTA}" stroke-width=".6"/><g fill="${cor}">${estrela(x, y, 3.4)}</g>`).join("");
      return { largura: 96, svg: `<path d="M0 1.5H96" stroke="${TINTA}" stroke-width=".8"/>` + corpo };
    }
    case "carnaval": {
      const serpentina = `<path d="M0 9 C10 3 20 15 30 9 S50 3 60 9 S80 15 90 9 S110 3 120 9" stroke="#e4577f" stroke-width="1.3" fill="none"/>`;
      const confetes = [
        [8, 4, "#f0b323"], [17, 14, "#23408e"], [26, 5, "#2e6b4f"], [38, 12, "#c21f16"], [47, 3, "#ea7a24"], [55, 15, "#1f8a85"],
        [66, 6, "#f0b323"], [74, 13, "#c21f16"], [84, 4, "#23408e"], [95, 15, "#2e6b4f"], [104, 6, "#e4577f"], [113, 12, "#f0b323"],
      ] as const;
      const pontos = confetes.map(([x, y, cor], i) => (i % 2 ? `<circle cx="${x}" cy="${y}" r="1.4" fill="${cor}"/>` : `<rect x="${x - 1.4}" y="${y - 1}" width="2.8" height="2" transform="rotate(${(i * 37) % 90} ${x} ${y})" fill="${cor}"/>`)).join("");
      return { largura: 120, svg: serpentina + pontos };
    }
    case "mulher": {
      const corpo = [
        [14, 8, "#8f5cc2"],
        [42, 11, "#e4577f"],
        [70, 7, "#8f5cc2"],
      ]
        .map(([x, y, cor]) => `<path d="M${x} 1.5V${Number(y) - 2}" stroke="${TINTA}" stroke-width=".6"/>${flor(Number(x), Number(y), 2.1, String(cor), "#f0b323")}`)
        .join("");
      return { largura: 84, svg: cordao(84) + corpo };
    }
    case "pascoa": {
      const corpo = (["#e4577f", "#f0b323", "#1f8a85"] as const)
        .map((cor, i) => {
          const x = 14 + i * 28;
          const y = 10 + (i % 2) * 1.5;
          return `<path d="M${x} ${altura(x, 84).toFixed(2)}V${y - 4.4}" stroke="${TINTA}" stroke-width=".6"/><ellipse cx="${x}" cy="${y}" rx="3.4" ry="4.6" fill="${cor}"/><path d="M${x - 3.3} ${y - 0.4}l1.6 1.4 1.7-1.4 1.7 1.4 1.6-1.4" stroke="#fbf6e8" stroke-width=".9" fill="none"/>`;
        })
        .join("");
      return { largura: 84, svg: cordao(84) + corpo };
    }
    case "indigena": {
      // Trançado de palha: uma faixa estreita, sem copiar o grafismo de nenhum povo.
      const palha = "#d9b46a";
      const barro = "#9c5a2b";
      return {
        largura: 16,
        svg: `<rect width="16" height="6" fill="${barro}"/><rect x="0" y="0" width="8" height="3" fill="${palha}"/><rect x="8" y="3" width="8" height="3" fill="${palha}"/><path d="M0 1.5H8M8 4.5H16" stroke="${barro}" stroke-width=".5"/>`,
      };
    }
    case "arvore": {
      // Dia da Árvore e começo da primavera: flores de ipê caindo.
      const corpo = [
        [12, 6, "#f0b323"], [34, 12, "#c4508f"], [58, 8, "#f0b323"], [80, 13, "#f0b323"],
      ]
        .map(([x, y, cor]) => flor(Number(x), Number(y), 2, String(cor), "#6e1f1a"))
        .join("");
      const petalas = `<ellipse cx="24" cy="15" rx="1.4" ry=".8" fill="#f0b323" transform="rotate(30 24 15)"/><ellipse cx="68" cy="4" rx="1.4" ry=".8" fill="#c4508f" transform="rotate(-20 68 4)"/><ellipse cx="90" cy="8" rx="1.4" ry=".8" fill="#f0b323"/>`;
      return { largura: 96, svg: corpo + petalas };
    }
    case "criancas": {
      // Pipas no céu, de rabiola comprida.
      const pipa = (x: number, y: number, a: string, b: string) =>
        `<path d="M${x} ${y - 5}L${x + 4} ${y}L${x} ${y + 5}L${x - 4} ${y}z" fill="${a}"/><path d="M${x} ${y - 5}L${x + 4} ${y}L${x} ${y}z M${x} ${y}L${x - 4} ${y}L${x} ${y + 5}z" fill="${b}"/><path d="M${x} ${y + 5}q2 3 -1 5 t1 4" stroke="${TINTA}" stroke-width=".5" fill="none"/>`;
      return { largura: 120, svg: pipa(26, 7, "#c21f16", "#f0b323") + pipa(86, 6, "#23408e", "#2e6b4f") };
    }
    case "mortos": {
      // Papel picado do Dia dos Mortos: bandeirolas recortadas.
      const corpo = (["#e4577f", "#ea7a24", "#1f8a85", "#f0b323"] as const)
        .map((cor, i) => {
          const x = 3 + i * 22;
          const y = altura(x + 9, 88) - 0.2;
          return `<path fill-rule="evenodd" fill="${cor}" d="M${x} ${y}h18v11.5l-1.5 1.5-1.5-1.5-1.5 1.5-1.5-1.5-1.5 1.5-1.5-1.5-1.5 1.5-1.5-1.5-1.5 1.5-1.5-1.5-1.5 1.5-1.5-1.5z M${x + 9} ${y + 2.5}l2.2 2.8-2.2 2.8-2.2-2.8z M${x + 3.5} ${y + 4.6}a1.1 1.1 0 1 0 .01 0z M${x + 14.5} ${y + 4.6}a1.1 1.1 0 1 0 .01 0z"/>`;
        })
        .join("");
      return { largura: 88, svg: cordao(88) + corpo };
    }
    case "consciencia": {
      // A faixa tecida, como a dos panos: blocos de cor sobre a trama escura.
      const blocos = [
        [1, 9, "#f0b323"], [11, 3, "#c21f16"], [15, 11, "#2e6b4f"], [27, 5, "#f0b323"], [33, 9, "#c21f16"], [43, 3, "#f4ecd8"], [47, 11, "#2e6b4f"], [59, 4, "#f0b323"],
      ] as const;
      const corpo = blocos.map(([x, w, cor]) => `<rect x="${x}" y="1" width="${w}" height="5" fill="${cor}"/>`).join("");
      return { largura: 64, svg: `<rect width="64" height="7" fill="${TINTA}"/>${corpo}<path d="M0 3.5H64" stroke="${TINTA}" stroke-width=".5" stroke-dasharray="1 2"/>` };
    }
  }
}

function fundo(festa: Festa): string {
  const { largura, svg } = desenho(festa);
  const completo = `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="18" viewBox="0 0 ${largura} 18">${svg}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(completo)}")`;
}

/** O enfeite do dia, pendurado logo abaixo do fio das fitas. Antes de o navegador saber a data, nada. */
export function EnfeiteDaFesta() {
  const festa = useSyncExternalStore(nunca, () => festaDe(new Date()), () => null);
  if (!festa) return null;
  return (
    <div
      aria-hidden
      data-festa={festa}
      className="festa no-print pointer-events-none absolute inset-x-0 top-full z-50 h-3 md:h-[18px]"
      style={{ backgroundImage: fundo(festa), backgroundRepeat: "repeat-x", backgroundSize: "auto 100%" }}
    />
  );
}
