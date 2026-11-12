// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { usePathname } from "next/navigation";
import Link from "@/components/Link";
import { localePath, locales } from "@/i18n/config";
import { Icone } from "@/components/rede/publicar/alumia2/icones";
import { useTextosAlumia2 } from "@/components/rede/publicar/alumia2/textos";
import { EstadoDaAlumia } from "@/components/rede/ui/Estado";
import { Faixa } from "@/components/rede/ui/Faixa";
import { LinkBotao } from "@/components/rede/ui/Botao";
import { Lampiao } from "@/components/rede/ui/Lampiao";
import { alumia2Ligada } from "@/lib/rede/rotas-novas";
import NotFoundDoSite from "../not-found";

/**
 * O "não encontrado" de dentro da Alumia (/alumia/p/…, /alumia/c/… que não existem): a noite das pranchas, a faixa tecida, a marca,
 * o mosaico apagado e dois caminhos (voltar ao início da Alumia, buscar). Com a Alumia nova desligada, o 404 do site, como antes.
 */
export default function NaoEncontradaNaAlumia() {
  const primeiro = (usePathname() ?? "").split("/").filter(Boolean)[0] ?? "pt";
  const lang = (locales as readonly string[]).includes(primeiro) ? primeiro : "pt";
  const ligada = alumia2Ligada();
  const t = useTextosAlumia2(lang, ligada);
  if (!ligada) return <NotFoundDoSite />;
  return (
    <div className="al2 min-h-screen bg-[var(--al-fundo)]">
      <Faixa />
      <header className="mx-auto flex max-w-[1100px] items-center px-4 pt-5">
        <Link href={localePath(lang, "/alumia")} className="flex items-center gap-3" aria-label={t?.marca.inicio}>
          <Lampiao tamanho={30} />
          <span className="leading-none">
            <span className="al-cond block text-[1.75rem] font-black uppercase tracking-tight">{t?.marca.nome ?? "Alumia"}</span>
            <span className="al-marca-instituto block text-[0.85rem] text-[var(--al-texto-2)]">{t?.marca.instituto ?? "Instituto Lúcia"}</span>
          </span>
        </Link>
      </header>
      <div id="rede-linha" className="mx-auto max-w-[640px] px-4 pt-[8vh]">
        {t ? (
          <EstadoDaAlumia mosaico titulo={t.naoEncontrada.titulo} texto={t.naoEncontrada.texto}>
            <LinkBotao href={localePath(lang, "/alumia")} variante="primario" pilula className="al2-aperta" icone={<Icone nome="inicio" />}>
              {t.naoEncontrada.voltar}
            </LinkBotao>
            <LinkBotao href={localePath(lang, "/alumia/buscar")} variante="claro" pilula className="al2-aperta" icone={<Icone nome="lupa" />}>
              {t.naoEncontrada.buscar}
            </LinkBotao>
          </EstadoDaAlumia>
        ) : (
          <div aria-hidden className="al-esq mx-auto mt-10 h-40 w-full max-w-md rounded-2xl" />
        )}
      </div>
    </div>
  );
}
