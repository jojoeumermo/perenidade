// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Os componentes únicos do painel (contrato: docs/PAINEL-REDESENHO.md, seção 10). Tudo que uma seção do painel precisa
// desenhar vem daqui: estilo shadcn (Radix por baixo quando há interação, estilo por classe pn-* e token, API pequena).
export { Abas, type OpcaoDeAba } from "./Abas";
export { Botao, type PropsDoBotao, type VarianteDoBotao } from "./Botao";
export { CabecalhoDeSecao } from "./CabecalhoDeSecao";
export { Area, Busca, Campo, Marca, Selecao } from "./Campo";
export { Cartao, type PropsDoCartao, type VarianteDoCartao } from "./Cartao";
export { Composer, type ComandoDoComposer, type PropsDoComposer } from "./Composer";
export { cx } from "./cx";
export { confirmar, confirmarFrase, Dialogo, DialogosDoPainel, type OpcoesDeConfirmacao, type OpcoesDePergunta, perguntar, perguntarTexto } from "./Dialogo";
export { Dica } from "./Dica";
export { Esqueleto, type FormaDoEsqueleto } from "./Esqueleto";
export { Estatistica, Estatisticas, type TomDaEstatistica } from "./Estatistica";
export { Faixa, type TomDaFaixa } from "./Faixa";
export { Kbd } from "./Kbd";
export { ItemDeLista, Lista } from "./Lista";
export { type ItemDoMenuSuspenso, MenuSuspenso } from "./MenuSuspenso";
export { ContagemAnimada, curva, ListaAnimada, mola, Surgir } from "./movimento";
export { type PainelAjustavel, PaineisAjustaveis } from "./PaineisAjustaveis";
export { type ComandoDaPaleta, type ItemDaPaleta, Paleta, useFocoDeVolta } from "./Paleta";
export { Contador, Selo, type TomDoSelo } from "./Selo";
export { Separador } from "./Separador";
export { type ColumnDef, Tabela } from "./Tabela";
export { AvisosDoPainel, notificar } from "./Toast";
export { Vazio } from "./Vazio";
// O estado da casca e a ajuda dos comandos da paleta, para as seções importarem de um lugar só.
export { type ComandoDaSecao, useComandosDaSecao } from "../estado";
