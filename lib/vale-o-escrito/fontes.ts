// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { Barlow_Condensed, JetBrains_Mono, Schibsted_Grotesk } from "next/font/google";

// As letras do Vale o Escrito, todas livres (SIL Open Font License 1.1, Google Fonts) e servidas pelo próprio site (next/font
// baixa no build: nenhum pedido ao Google no navegador de quem lê). Só app/[lang]/vale-o-escrito/layout.tsx importa este
// arquivo, então só as rotas do Vale carregam as três:
//  - Barlow Condensed (Jeremy Tribby): a display condensada e forte dos títulos e dos números grandes;
//  - JetBrains Mono (JetBrains): a mono técnica dos rótulos, códigos, coordenadas e contadores;
//  - Schibsted Grotesk (Schibsted Media): a grotesca de leitura dos resumos, fichas e textos longos.
// Cirílico e chinês caem nas letras do sistema (as três não têm esses alfabetos, ou a mono só o cirílico).
export const letraDisplay = Barlow_Condensed({ variable: "--fonte-ve-display", subsets: ["latin", "latin-ext"], weight: ["600", "700", "800"], display: "swap", preload: false });
export const letraMono = JetBrains_Mono({ variable: "--fonte-ve-mono", subsets: ["latin", "latin-ext", "cyrillic"], display: "swap" });
export const letraLeitura = Schibsted_Grotesk({ variable: "--fonte-ve-leitura", subsets: ["latin", "latin-ext"], display: "swap" });

/** As três classes que põem as variáveis das letras na moldura do Vale. */
export const classesDasLetras = `${letraDisplay.variable} ${letraMono.variable} ${letraLeitura.variable}`;
