// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { localePath, type Locale } from "@/i18n/config";
import type { TextosDaFormacaoBase } from "@/i18n/escola/formacao-base";
import { useDaEscola } from "@/lib/escola/acesso";
import { TELAS_DA_ESCOLA } from "@/lib/escola/contratos";

/**
 * A pergunta geradora da semana (círculo de cultura de Paulo Freire; PLANO-ESCOLA.md, seção 3), definida pela
 * coordenação e lida da F4 (escola_pergunta_da_semana). Sem pergunta, ou com a função ainda fora do banco, o bloco diz
 * que ela ainda não foi definida, sem quebrar. "Responder para o núcleo" leva à tela do núcleo (F4).
 */
export function PerguntaGeradora({ lang, t }: { lang: Locale; t: TextosDaFormacaoBase["hoje"] }) {
  const lido = useDaEscola("escola_pergunta_da_semana");
  const pergunta = lido?.ok ? lido.dados : null;
  return (
    <section aria-labelledby="ef-pergunta" className="ef-pergunta ef-o-pergunta" aria-busy={lido === null}>
      <div>
        <h2 id="ef-pergunta" className="ef-t">
          {t.pergunta}
        </h2>
        {pergunta?.texto ? (
          <p className="ef-t ef-pergunta-texto">{pergunta.texto}</p>
        ) : (
          <p className="ef-pergunta-vazia">{lido === null ? t.carregando : lido.ok || lido.motivo === "ausente" ? t.perguntaVazia : t.falha}</p>
        )}
      </div>
      {pergunta?.texto && (
        <Link href={localePath(lang, `${TELAS_DA_ESCOLA.nucleo}#pergunta`)} className="ef-botao-escuro">
          {t.responder}
        </Link>
      )}
    </section>
  );
}
