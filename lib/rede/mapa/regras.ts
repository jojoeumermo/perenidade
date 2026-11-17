// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As regras puras do mapa (frente 13B): desconfiar do que vem do banco (número abaixo de 3 vira nulo), juntar os lugares que caem
// no mesmo município e separar os que o desenho não acha. Sem os atalhos "@/" de propósito (o teste roda no Node).
import { acharMunicipio, type Indice, type Municipio } from "./indice";
import { ehUF, type UF } from "./lugar";
import type { LugarDoMapa, Mapa, OrgDoMapa } from "./tipos";

/** O menor número que a tela mostra (docs/rede/PRIVACIDADE.md §8). */
export const MINIMO = 3;

const numero = (n: unknown): number | null => (typeof n === "number" && Number.isInteger(n) && n >= MINIMO ? n : null);
const handleValido = (h: unknown): h is string => typeof h === "string" && /^[a-z0-9_]{3,20}$/.test(h);

/** Desconfia do servidor: número abaixo de 3 vira nulo; organização só com @ válido; até 8 por lugar. */
export function limparMapa(m: Partial<Mapa> | null | undefined): Mapa {
  const lugares = Array.isArray(m?.lugares) ? m.lugares : [];
  return {
    dias: typeof m?.dias === "number" && m.dias > 0 && m.dias <= 365 ? m.dias : 60,
    lugares: lugares
      .filter((l): l is LugarDoMapa => !!l && typeof l.nome === "string" && l.nome.length >= 2)
      .map((l) => {
        const chamados = numero(l.chamados);
        const eventos = numero(l.eventos);
        const orgs = (Array.isArray(l.orgs) ? l.orgs : []).filter((o): o is OrgDoMapa => !!o && handleValido(o.handle) && typeof o.nome === "string").slice(0, 8);
        return {
          nome: l.nome,
          uf: typeof l.uf === "string" && ehUF(l.uf) ? l.uf : null,
          escrito: typeof l.escrito === "string" && l.escrito.trim() ? l.escrito.trim().slice(0, 80) : l.nome,
          chamados,
          chamados_ha: chamados !== null || l.chamados_ha === true,
          eventos,
          eventos_ha: eventos !== null || l.eventos_ha === true,
          nucleos_ha: l.nucleos_ha === true || orgs.length > 0,
          orgs,
        };
      }),
  };
}

/** Um ponto do desenho: um município com o que há nele (os lugares escritos de jeitos diferentes já juntos). */
export interface PontoDoMapa {
  chave: string;
  municipio: Municipio;
  chamados: number | null;
  chamados_ha: boolean;
  eventos: number | null;
  eventos_ha: boolean;
  nucleos_ha: boolean;
  orgs: OrgDoMapa[];
  /** Como a cidade foi escrita (a primeira forma), para pedir os atos dela. */
  escrito: string;
}

/** Um lugar que o desenho não acha: o nome existe em vários estados (sem UF escrita) ou não é município do IBGE. */
export interface LugarSemPonto {
  lugar: LugarDoMapa;
  motivo: "varios" | "nenhum";
  ufs: UF[];
}

/**
 * Junta somando só números conhecidos: dois "menos de 3" juntos continuam sem número (não dá para saber se passam de 3); um
 * número mais um "menos de 3" fica com o número (por baixo, nunca inventa).
 */
function somar(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return a + b;
}

/** Os pontos do desenho e os lugares fora dele. */
export function pontosDoMapa(mapa: Mapa, indice: Indice): { pontos: PontoDoMapa[]; fora: LugarSemPonto[] } {
  const porChave = new Map<string, PontoDoMapa>();
  const fora: LugarSemPonto[] = [];
  for (const l of mapa.lugares) {
    const achado = acharMunicipio(indice, l.nome, l.uf);
    if (achado.tipo !== "municipio") {
      fora.push({ lugar: l, motivo: achado.tipo, ufs: achado.tipo === "varios" ? achado.ufs : [] });
      continue;
    }
    const m = achado.municipio;
    const chave = `${m.uf}:${m.nome}`;
    const antes = porChave.get(chave);
    if (!antes) {
      porChave.set(chave, { chave, municipio: m, chamados: l.chamados, chamados_ha: l.chamados_ha, eventos: l.eventos, eventos_ha: l.eventos_ha, nucleos_ha: l.nucleos_ha, orgs: l.orgs, escrito: l.escrito });
      continue;
    }
    const orgs = [...antes.orgs];
    for (const o of l.orgs) if (!orgs.some((x) => x.handle === o.handle)) orgs.push(o);
    porChave.set(chave, {
      ...antes,
      chamados: somar(antes.chamados, l.chamados),
      chamados_ha: antes.chamados_ha || l.chamados_ha,
      eventos: somar(antes.eventos, l.eventos),
      eventos_ha: antes.eventos_ha || l.eventos_ha,
      nucleos_ha: antes.nucleos_ha || l.nucleos_ha,
      orgs: orgs.slice(0, 8),
    });
  }
  const pontos = [...porChave.values()].sort((a, b) => a.municipio.uf.localeCompare(b.municipio.uf) || a.municipio.nome.localeCompare(b.municipio.nome, "pt"));
  return { pontos, fora };
}

/** O que mostrar: cada tipo pode ser desligado na tela. */
export interface Filtro {
  chamados: boolean;
  eventos: boolean;
  nucleos: boolean;
}

export const temAlgo = (p: Pick<PontoDoMapa, "chamados_ha" | "eventos_ha" | "nucleos_ha">, f: Filtro) =>
  (f.chamados && p.chamados_ha) || (f.eventos && p.eventos_ha) || (f.nucleos && p.nucleos_ha);

/**
 * O tamanho do ladrilho do ponto: 1 (há, sem número), 2 (de 3 a 9) ou 3 (10 ou mais), pelo maior número conhecido entre os tipos
 * ligados. Assim o desenho também não mostra "1" e "2" diferentes.
 */
export function tamanhoDoPonto(p: PontoDoMapa, f: Filtro): 1 | 2 | 3 {
  const n = Math.max(f.chamados ? p.chamados ?? 0 : 0, f.eventos ? p.eventos ?? 0 : 0);
  return n >= 10 ? 3 : n >= MINIMO ? 2 : 1;
}

/** A caixa (x, y, largura, altura) de um caminho SVG feito só de M, L e Z com números absolutos. */
export function caixaDoCaminho(d: string): [number, number, number, number] {
  const n = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i + 1 < n.length; i += 2) {
    x0 = Math.min(x0, n[i]); x1 = Math.max(x1, n[i]);
    y0 = Math.min(y0, n[i + 1]); y1 = Math.max(y1, n[i + 1]);
  }
  return Number.isFinite(x0) ? [x0, y0, x1 - x0, y1 - y0] : [0, 0, 0, 0];
}

/** A caixa com folga e na proporção pedida (largura ÷ altura), para o zoom num estado não esticar o desenho. */
export function enquadrar([x, y, w, h]: [number, number, number, number], proporcao: number, folga = 0.12): [number, number, number, number] {
  let W = Math.max(w, 40) * (1 + folga * 2);
  let H = Math.max(h, 40) * (1 + folga * 2);
  if (W / H > proporcao) H = W / proporcao;
  else W = H * proporcao;
  return [Math.round(x + w / 2 - W / 2), Math.round(y + h / 2 - H / 2), Math.round(W), Math.round(H)];
}
