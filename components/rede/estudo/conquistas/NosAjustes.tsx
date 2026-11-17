// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Em Ajustes (encaixe secoesDeAjustes, frente 11E): o que as conquistas e o mural fazem, com os dois caminhos.
import "./conquistas.css";
import type { ContextoDoEncaixe } from "../../encaixes";
import { LinkBotao } from "../../ui/Botao";
import { useTextosDasConquistas } from "./usarTextos";

export default function NosAjustes({ lang }: ContextoDoEncaixe) {
  const t = useTextosDasConquistas(lang);
  if (!t) return null;
  return (
    <div>
      <p className="sg-texto" style={{ marginBottom: 0 }}>{t.ajustes.texto}</p>
      <p className="sg-acoes">
        <LinkBotao variante="claro" tamanho="m" href={`/${lang}/alumia/conquistas`}>{t.ajustes.conquistas}</LinkBotao>
        <LinkBotao variante="contorno" tamanho="m" href={`/${lang}/alumia/aprovados`}>{t.ajustes.mural}</LinkBotao>
      </p>
    </div>
  );
}
