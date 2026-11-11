// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// O esqueleto enquanto a rota carrega (antes, a navegação mostrava tela vazia até o JavaScript chegar).
import { CarregandoDaAlumia } from "@/components/rede/EsqueletosDaAlumia2";

export default function Carregando() {
  return <CarregandoDaAlumia tipo="post" />;
}
