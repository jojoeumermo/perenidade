// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { diaEHora } from "@/components/escola/hoje/tempo";
import { localePath, type Locale } from "@/i18n/config";
import type { TextosDaFormacao } from "@/i18n/escola/formacao";
import { useDaEscola } from "@/lib/escola/acesso";
import { TELAS_DA_ESCOLA } from "@/lib/escola/contratos";
import { preencher } from "@/lib/escola/textos";
import { useDiscreto } from "./discreto";

/**
 * A roda no núcleo (prancha Caderno): quando é a próxima, lida da função do núcleo (public.escola_nucleo, F4, pelo
 * contrato em lib/escola/contratos.ts; enquanto ela não existe no banco, o vazio honesto), e o que o kit de quem facilita
 * traz. O kit inteiro mora na tela Núcleo (F4).
 */
export function RodaDoCaderno({ lang, t }: { lang: Locale; t: TextosDaFormacao["caderno"]["roda"] }) {
  const nucleo = useDaEscola("escola_nucleo");
  const discreto = useDiscreto();
  const dados = nucleo?.ok ? nucleo.dados : null;
  const quando = dados?.proximo?.quando ?? null;
  return (
    <section aria-labelledby="eff-roda" className="eff-cartao eff-roda">
      <h2 id="eff-roda" className="ef-t">
        {t.titulo}
      </h2>
      {nucleo && <p>{dados && !dados.nucleo ? t.semNucleo : quando ? preencher(t.proxima, { quando: diaEHora(lang, quando) }) : t.semData}</p>}
      <p>
        <strong>{t.kit}</strong> {t.kitTexto}
      </p>
      <Link href={localePath(lang, TELAS_DA_ESCOLA.nucleo)} replace={discreto} className="ef-botao-escuro eff-botao-pequeno">
        {t.abrir}
      </Link>
    </section>
  );
}
