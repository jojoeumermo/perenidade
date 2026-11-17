// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import type { PropsDaTelaDoPacote } from "../registro";
import { CarregandoALei } from "./base";
import { TextoDaLei } from "./TextoDaLei";
import { useTextosDaLei } from "./usarTextos";

/** A política de privacidade da Alumia (/alumia/privacidade), escrita a partir do que o banco guarda (docs/rede/PRIVACIDADE.md). */
export default function TelaDaPrivacidade({ lang, s }: PropsDaTelaDoPacote) {
  const t = useTextosDaLei(lang);
  if (!t) return <CarregandoALei rotulo={s.estados.carregando} />;
  return <TextoDaLei lang={lang} t={t} pagina="privacidade" titulo={t.privacidade.titulo} chamada={t.privacidade.chamada} secoes={t.privacidade.secoes} />;
}
