// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import type { PropsDaTelaDoPacote } from "../registro";
import { CarregandoALei } from "./base";
import { Reaceite } from "./Reaceite";
import { TextoDaLei } from "./TextoDaLei";
import { useTextosDaLei } from "./usarTextos";

/** Os termos de uso da Alumia (/alumia/termos), com a versão no alto e, para quem entrou e ainda não aceitou esta versão, o aceite no fim. */
export default function TelaDosTermos({ lang, s, situacao }: PropsDaTelaDoPacote) {
  const t = useTextosDaLei(lang);
  if (!t) return <CarregandoALei rotulo={s.estados.carregando} />;
  return (
    <TextoDaLei lang={lang} t={t} pagina="termos" titulo={t.termos.titulo} chamada={t.termos.chamada} secoes={t.termos.secoes}
      depois={situacao.logado ? <Reaceite lang={lang} naPagina /> : null} />
  );
}
