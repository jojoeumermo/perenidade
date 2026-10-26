// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { Pinyon_Script, Playfair_Display } from "next/font/google";

// As letras das páginas de território, as mesmas das capas do Na Atividade: a Playfair dos títulos de revista e a
// caligrafia da Pinyon ("Conceito", "Uma análise"). Só as páginas que importam este arquivo carregam as duas.
export const playfair = Playfair_Display({ variable: "--font-play", subsets: ["latin"], weight: ["600", "800", "900"] });
export const caligrafia = Pinyon_Script({ variable: "--font-caligrafia", subsets: ["latin"], weight: "400", preload: false });
