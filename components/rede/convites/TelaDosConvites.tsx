// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os convites de quem já está dentro (/alumia/convite), dentro da casca da Alumia como as outras telas (registro "convite"): a
// mesma tela de MeusConvites, com o menu, a coluna da direita e o "Sair rápido" da casca em volta.
import "./convites.css";
import type { PropsDaTelaDoPacote } from "../registro";
import { MeusConvites } from "./MeusConvites";

export default function TelaDosConvites({ lang }: PropsDaTelaDoPacote) {
  return (
    <div className="alc-pagina alc-na-casca">
      <MeusConvites lang={lang} />
    </div>
  );
}
