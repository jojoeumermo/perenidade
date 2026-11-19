// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { Anton, Bungee, Inter_Tight, Rubik_Spray_Paint, Sedgwick_Ave_Display, Titan_One } from "next/font/google";

// Uma letra de título por coletivo (docs/territorios/IDENTIDADES.md), só nas páginas de território que importam este
// arquivo. O navegador só baixa a fonte que a página usa de fato.
//  - NoizOcupa: a letra gorda e arredondada dos cartazes, anos 70 (Titan One).
//  - Coletivo Kamikaze: a condensada pesada do cartaz de cinema de rua (Anton).
//  - Coletivo Desordem: letra de spray, para o nome e os títulos curtos (Rubik Spray Paint).
//  - noismemo studios: a grotesca pesada e apertada da ficha técnica (Inter Tight 800/900).
//  - Oriki Futuro: a letra gorda e redonda do nome na capa do portfólio (Bungee).
//  - Quebrada Fênix: a letra de mão do pixo e do cartaz de rua, na pegada da logo tribal (Sedgwick Ave Display).
export const letraNoiz = Titan_One({ variable: "--letra-noiz", subsets: ["latin", "latin-ext"], weight: "400", preload: false });
export const letraKamikaze = Anton({ variable: "--letra-kamikaze", subsets: ["latin", "latin-ext"], weight: "400", preload: false });
export const letraDesordem = Rubik_Spray_Paint({ variable: "--letra-desordem", subsets: ["latin", "latin-ext"], weight: "400", preload: false });
export const letraNoisme = Inter_Tight({ variable: "--letra-noisme", subsets: ["latin", "latin-ext"], weight: ["800", "900"], preload: false });
export const letraOriki = Bungee({ variable: "--letra-oriki", subsets: ["latin", "latin-ext"], weight: "400", preload: false });
export const letraFenix = Sedgwick_Ave_Display({ variable: "--letra-fenix", subsets: ["latin", "latin-ext"], weight: "400", preload: false });
