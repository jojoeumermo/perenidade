// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// "Voltar" do aplicativo: voltar de verdade quando a pessoa andou dentro do site; senão, subir para a página de cima
// (quem chegou por um link de fora, WhatsApp ou busca, não sai do site ao tocar em voltar). Só no navegador.
import { paginaDeCima, trechosDoEndereco } from "./modo";

let andou = false;
let primeira = true;
let ultimo = "";

/**
 * Chamada a cada mudança de endereço (a casca e a barra de cima); a primeira, a do carregamento, não conta. Só vale como
 * "andou" quando o endereço mudou de verdade: um remonte da casca (erro de hidratação, por exemplo) repete o mesmo endereço
 * e não pode virar histórico, senão o voltar de um link direto sairia do site em vez de subir.
 */
export function registrarPagina(caminho = ""): void {
  if (primeira) {
    primeira = false;
    ultimo = caminho;
    return;
  }
  if (caminho !== "" && caminho === ultimo) return;
  ultimo = caminho;
  andou = true;
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
  // A raiz da experiência do aplicativo instalado (/app) é como a raiz do site: não há "voltar" nela.
  if (trechos[0] === "app" && trechos.length === 1) return "raiz";
  if (andou && historico.length > 1) {
    roteador.back();
    return "voltou";
  }
  const cima = paginaDeCima(trechos);
  roteador.push(cima === "/" ? `/${lang}` : `/${lang}${cima}`);
  return "subiu";
}
