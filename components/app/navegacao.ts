// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// "Voltar" do aplicativo: voltar de verdade quando a pessoa andou dentro do site; senão, subir para a página de cima
// (quem chegou por um link de fora, WhatsApp ou busca, não sai do site ao tocar em voltar). Só no navegador.
import { paginaDeCima, trechosDoEndereco } from "./modo";

let andou = false;
let primeira = true;

/** Chamada a cada mudança de endereço (a casca e a barra de cima); a primeira, a do carregamento, não conta. */
export function registrarPagina(): void {
  if (primeira) primeira = false;
  else andou = true;
}

export const andouNoSite = () => andou;

export interface Roteador {
  back(): void;
  push(href: string): void;
}

/** Volta (histórico) ou sobe para a página de cima. `aoIr` recebe o destino quando a subida é por endereço. */
export function voltarOuSubir(roteador: Roteador, pathname: string, lang: string, historico: { length: number } = window.history): "voltou" | "subiu" | "raiz" {
  const trechos = trechosDoEndereco(pathname);
  if (trechos.length === 0) return "raiz";
  if (andou && historico.length > 1) {
    roteador.back();
    return "voltou";
  }
  const cima = paginaDeCima(trechos);
  roteador.push(cima === "/" ? `/${lang}` : `/${lang}${cima}`);
  return "subiu";
}
