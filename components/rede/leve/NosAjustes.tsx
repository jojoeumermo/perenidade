// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Em Ajustes (encaixe secoesDeAjustes, frente 13D): o que há em Leve e no seu tempo, com o caminho para /alumia/leve.
import type { ContextoDoEncaixe } from "../encaixes";
import { LinkBotao } from "../ui/Botao";
import { useTextosDoLeve } from "./textos";

export default function NosAjustes({ lang }: ContextoDoEncaixe) {
  const t = useTextosDoLeve(lang);
  if (!t) return null;
  return (
    <div>
      {/* Na Segurança, com o texto e o botão dos outros blocos (sg-texto, botão m): a coluna mantém uma hierarquia só. */}
      <p className="sg-texto">{t.ajustes.texto}</p>
      <p>
        <LinkBotao href={`/${lang}/alumia/leve`} variante="contorno" tamanho="m">
          {t.ajustes.abrir}
        </LinkBotao>
      </p>
    </div>
  );
}
