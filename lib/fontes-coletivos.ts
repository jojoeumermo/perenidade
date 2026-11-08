// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { Anton, Inter_Tight, Rubik_Spray_Paint, Titan_One } from "next/font/google";

// Uma letra de título por coletivo (docs/territorios/IDENTIDADES.md), só nas páginas de território que importam este
// arquivo. O navegador só baixa a fonte que a página usa de fato.
//  - NoizOcupa: a letra gorda e arredondada dos cartazes, anos 70 (Titan One).
//  - Coletivo Kamikaze: a condensada pesada do cartaz de cinema de rua (Anton).
//  - Coletivo Desordem: letra de spray, para o nome e os títulos curtos (Rubik Spray Paint).
//  - noismemo studios: a grotesca pesada e apertada da ficha técnica (Inter Tight 800/900).
export const letraNoiz = Titan_One({ variable: "--letra-noiz", subsets: ["latin", "latin-ext"], weight: "400", preload: false });
export const letraKamikaze = Anton({ variable: "--letra-kamikaze", subsets: ["latin", "latin-ext"], weight: "400", preload: false });
export const letraDesordem = Rubik_Spray_Paint({ variable: "--letra-desordem", subsets: ["latin", "latin-ext"], weight: "400", preload: false });
export const letraNoisme = Inter_Tight({ variable: "--letra-noisme", subsets: ["latin", "latin-ext"], weight: ["800", "900"], preload: false });
