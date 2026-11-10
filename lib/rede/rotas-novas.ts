// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As rotas novas da Alumia (Onda 5, PLANO-ALUMIA seção 8, F0) e a flag de cada uma, num lugar só: as páginas em
// app/[lang]/alumia/<rota>/page.tsx, o registro das telas (components/rede/registro.tsx), o host próprio
// (lib/rede/alumia.ts, ROTAS_DA_ALUMIA) e o teste (scripts/testar-alumia-rota.mjs) leem daqui. Cada rota só existe com "rede-v2"
// E "alumia-2" E a flag dela ligadas; desligada, a página responde 404 e nada aparece no menu.
// Sem os atalhos "@/" de propósito (roda no Node nos testes).
import { ligado, type Recurso } from "../recursos";

/** A Alumia nova (visual e telas novas) está ligada? Precisa das duas: a v2 da rede e a Alumia 2. */
export function alumia2Ligada(): boolean {
  return ligado("rede-v2") && ligado("alumia-2");
}

export interface RotaNova {
  /** O nome da tela no registro (components/rede/registro.tsx) e a chave dos textos em i18n/rede/onda5. */
  nome: string;
  /** O caminho depois de /[lang]/alumia ("/atos", "/ato/[id]"). */
  caminho: string;
  /** A flag própria (além de "rede-v2" e "alumia-2"). */
  flag: Recurso;
  /** A frente que é dona da tela (PLANO-ALUMIA, seção 9). */
  frente: "F2" | "F4" | "F5" | "F6" | "F8" | "F9";
  /** A página pode ser indexada? Só o que é público e não depende de quem está vendo. */
  indexar: boolean;
}

export const ROTAS_NOVAS: readonly RotaNova[] = [
  { nome: "atos", caminho: "/atos", flag: "alumia-2", frente: "F2", indexar: true },
  { nome: "ato", caminho: "/ato/[id]", flag: "alumia-2", frente: "F2", indexar: true },
  { nome: "calendario", caminho: "/calendario", flag: "alumia-2", frente: "F2", indexar: false },
  { nome: "organizacoes", caminho: "/organizacoes", flag: "alumia-org", frente: "F4", indexar: true },
  { nome: "stories", caminho: "/stories", flag: "alumia-stories", frente: "F5", indexar: false },
  { nome: "seguranca", caminho: "/seguranca", flag: "alumia-modo-ato", frente: "F6", indexar: false },
  { nome: "identidades", caminho: "/identidades", flag: "alumia-modo-ato", frente: "F6", indexar: false },
  { nome: "aparelhos", caminho: "/aparelhos", flag: "alumia-modo-ato", frente: "F6", indexar: false },
  { nome: "o-que-guardamos", caminho: "/o-que-guardamos", flag: "alumia-2", frente: "F6", indexar: true },
  { nome: "transparencia", caminho: "/transparencia", flag: "alumia-2", frente: "F8", indexar: true },
  { nome: "listas", caminho: "/listas", flag: "alumia-2", frente: "F9", indexar: false },
  { nome: "leve", caminho: "/leve", flag: "alumia-2", frente: "F9", indexar: true },
];

/** A rota nova pelo nome. */
export function rotaNova(nome: string): RotaNova | null {
  return ROTAS_NOVAS.find((r) => r.nome === nome) ?? null;
}

/** A tela nova pode abrir agora? "rede-v2" + "alumia-2" + a flag dela. Nome desconhecido: não. */
export function rotaNovaLigada(nome: string): boolean {
  const rota = rotaNova(nome);
  return !!rota && alumia2Ligada() && ligado(rota.flag);
}
