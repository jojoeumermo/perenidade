// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O DUBLÊ da abertura dos posts cifrados, só para a prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim): sem banco não há grupo MLS, então o
// cartão da prévia mostra o texto de exemplo de um post e o "Não dá para abrir neste aparelho" do outro (os posts estão em
// lib/rede/nucleos-exemplos.ts). A cifra de verdade é provada em scripts/testar-posts-restritos.mjs e testar-cifra-grupo.mjs.

/** Os posts cifrados de exemplo que "abrem" neste aparelho da prévia (id → texto). O que não está aqui não abre. */
export const ABERTOS_NA_PREVIA: Record<string, string> = {
  "exemplo-nucleo-cifrado-1":
    "Ato de quinta: a concentração muda para a saída do metrô, lado da praça. Quem leva a faixa grande chega 30 min antes. Combinem a volta em grupo.",
};
