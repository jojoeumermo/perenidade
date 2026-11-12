// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { notFound } from "next/navigation";

// Endereço que não existe dentro da Alumia (/alumia/qualquer-coisa): sem esta rota coringa, o Next mostrava o "não encontrado"
// do site do instituto (creme, serifa, "buscar no acervo"). Com ela, vale o not-found.tsx da própria Alumia (a noite das
// pranchas, com "voltar ao início" e "buscar"). Não cria endereço novo: toda rota de verdade ganha desta, e esta só responde 404.
export const dynamicParams = true;

export default function EnderecoQueNaoExiste() {
  notFound();
}
