// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { usePathname } from "next/navigation";
import { useI18n } from "@/components/I18n";
import { Conversa } from "@/components/escola/acompanhante/Conversa";
import { useTextosDoAcompanhante } from "@/components/escola/acompanhante/textos";
import { aulaDoEndereco } from "@/lib/agir";
import { LIMITES } from "@/lib/escola/acompanhante";

/**
 * O retorno do assistente sobre uma resposta escrita (Etapa 3, lacuna "resposta aberta com retorno"). Reaproveita a
 * Conversa do acompanhante (E4-10): a mesma função `assistente`, o mesmo limite do dia, o aviso do que vai ANTES do
 * botão e o histórico só no aparelho. Só existe depois que a pessoa aperta "Pedir um retorno ao assistente", e só o texto
 * escrito segue: o áudio nunca sai do aparelho. Modo "socratico" (já existente): a função não mudou.
 */
export function RetornoDoAssistente({ pergunta, resposta }: { pergunta: string; resposta: string }) {
  const { t, lang } = useI18n();
  const pathname = usePathname();
  const s = useTextosDoAcompanhante(lang);
  const b = t.lesson.blocks;
  const aula = aulaDoEndereco(pathname);
  if (!s) return null;
  const inicial = `${b.retornoPergunta}\n\n${resposta}`.slice(0, 1400);
  return (
    <div className="no-print mt-3" data-retorno-do-assistente="">
      <Conversa
        s={s}
        modo="socratico"
        contexto={{ ...(aula ? { aula } : {}), trecho: pergunta.slice(0, LIMITES.trecho) }}
        itens={aula ? ["trecho", "aula", "pergunta"] : ["trecho", "pergunta"]}
        campo={{ rotulo: b.retornoRotulo, max: 1500, min: 10, linhas: 5 }}
        botao={b.retornoBotao}
        inicial={inicial}
        umaVez
        semServidor="aviso"
      />
    </div>
  );
}
