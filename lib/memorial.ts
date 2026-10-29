// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

/** As regiões do muro do memorial: onde a pessoa tombou, não a nacionalidade (Ben Barka, marroquino, sumiu em Paris). */
export const regioesDoMemorial = ["brasil", "america-latina", "africa", "america-do-norte", "europa", "asia"] as const;
export type RegiaoDoMemorial = (typeof regioesDoMemorial)[number];

// O último pedaço do "local" da ficha original, em português. País novo no memorial entra aqui; sem ele, a pessoa só
// aparece em "Todas".
const paises: Record<string, RegiaoDoMemorial> = {
  Brasil: "brasil",
  Argentina: "america-latina",
  Bolívia: "america-latina",
  Chile: "america-latina",
  Colômbia: "america-latina",
  Cuba: "america-latina",
  "El Salvador": "america-latina",
  Guatemala: "america-latina",
  Honduras: "america-latina",
  México: "america-latina",
  Nicarágua: "america-latina",
  Paraguai: "america-latina",
  Peru: "america-latina",
  "Porto Rico": "america-latina",
  "República Dominicana": "america-latina",
  Uruguai: "america-latina",
  Venezuela: "america-latina",
  Haiti: "america-latina",
  "África do Sul": "africa",
  "Burkina Faso": "africa",
  Guiné: "africa",
  "Guiné-Bissau": "africa",
  Moçambique: "africa",
  Nigéria: "africa",
  "República Democrática do Congo": "africa",
  Tanzânia: "africa",
  Angola: "africa",
  Argélia: "africa",
  Marrocos: "africa",
  "Estados Unidos": "america-do-norte",
  Canadá: "america-do-norte",
  Alemanha: "europa",
  Espanha: "europa",
  França: "europa",
  Itália: "europa",
  Portugal: "europa",
  "Reino Unido": "europa",
  Tchecoslováquia: "europa",
  Índia: "asia",
  "Índia britânica": "asia",
  Palestina: "asia",
  Vietnã: "asia",
  Filipinas: "asia",
};

export function regiaoDoLocal(local: string): RegiaoDoMemorial | undefined {
  return paises[local.split(",").at(-1)?.trim() ?? ""];
}
