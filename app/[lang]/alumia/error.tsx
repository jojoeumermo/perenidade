// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { locales } from "@/i18n/config";
import { useTextosAlumia2 } from "@/components/rede/publicar/alumia2/textos";
import { Botao } from "@/components/rede/ui/Botao";
import { EstadoDaAlumia } from "@/components/rede/ui/Estado";
import { ehPedacoPerdido, recarregarSePedacoPerdido } from "@/lib/pedaco-perdido";
import { registrarErroDaTela } from "@/lib/rede/beta/registrar";

/**
 * Quando uma tela da Alumia quebra, no lugar do "This page couldn't load" do Next: a frase na cara da Alumia, "Tentar de novo" e
 * "Recarregar a página". Se o erro é o "pedaço não encontrado" de depois de uma versão nova (ChunkLoadError), a página recarrega
 * sozinha UMA vez (lib/pedaco-perdido.ts); se isso não resolver, a tela fica com os botões. A mensagem técnica vai ao console
 * deste navegador e, limpa, ao registro de erros da tela (P5, A21: só a mensagem sem dado pessoal, a página sem ids, a versão e a
 * família do navegador; sem conta, sem endereço de rede).
 */
export default function ErroNaAlumia({ error, retry, reset }: { error: unknown; retry?: () => void; reset?: () => void }) {
  const primeiro = (usePathname() ?? "").split("/").filter(Boolean)[0] ?? "pt";
  const lang = (locales as readonly string[]).includes(primeiro) ? primeiro : "pt";
  const t = useTextosAlumia2(lang, true);
  // Versão nova: a frase diz que está atualizando (os botões ficam, para o caso de a guarda não deixar recarregar de novo).
  const atualizando = ehPedacoPerdido(error);

  useEffect(() => {
    console.error("Alumia:", error);
    void registrarErroDaTela(error);
    recarregarSePedacoPerdido(error);
  }, [error]);

  const tentar = () => (retry ?? reset)?.();

  return (
    <div id="rede-linha" className="al2 mx-auto max-w-[640px] px-4 pt-[8vh]">
      {t ? (
        <EstadoDaAlumia erro titulo={t.naoAbriu.titulo} texto={atualizando ? t.naoAbriu.atualizando : t.naoAbriu.texto}>
          <Botao variante="primario" pilula className="al2-aperta" onClick={tentar}>
            {t.naoAbriu.tentar}
          </Botao>
          <Botao variante="claro" pilula className="al2-aperta" onClick={() => window.location.reload()}>
            {t.naoAbriu.recarregar}
          </Botao>
        </EstadoDaAlumia>
      ) : (
        <div aria-hidden className="al-esq mx-auto mt-10 h-40 w-full max-w-md rounded-2xl" />
      )}
    </div>
  );
}
