// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As letras e o desenho do KaTeX, que vêm do próprio pacote (node_modules/katex): o Next empacota a folha e as fontes junto com o
// site, nada é pedido a outro servidor. Separado em um módulo para só ser baixado quando a tela tem uma fórmula.
import "katex/dist/katex.min.css";

export const estiloDoKatex = true;
