// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { localePath } from "@/i18n/config";
import { Icone } from "../publicar/alumia2/icones";
import { useTextosAlumia2 } from "../publicar/alumia2/textos";
import { LinkBotao } from "./Botao";
import { EstadoDaAlumia } from "./Estado";

/**
 * "Isto não existe (ou você não pode ver)" dentro de uma tela da Alumia: o mesmo desenho da página não encontrada (mosaico apagado,
 * título em caixa alta) e os dois caminhos de volta (início e busca). "Tentar de novo" não entra aqui: é só para falha de rede.
 */
export function NaoExiste({ lang, texto }: { lang: string; texto: string }) {
  const t = useTextosAlumia2(lang, true);
  return (
    <EstadoDaAlumia mosaico titulo={t?.naoEncontrada.titulo} texto={texto}>
      {t ? (
        <>
          <LinkBotao href={localePath(lang, "/alumia")} variante="primario" pilula className="al2-aperta" icone={<Icone nome="inicio" />}>
            {t.naoEncontrada.voltar}
          </LinkBotao>
          <LinkBotao href={localePath(lang, "/alumia/buscar")} variante="claro" pilula className="al2-aperta" icone={<Icone nome="lupa" />}>
            {t.naoEncontrada.buscar}
          </LinkBotao>
        </>
      ) : null}
    </EstadoDaAlumia>
  );
}
