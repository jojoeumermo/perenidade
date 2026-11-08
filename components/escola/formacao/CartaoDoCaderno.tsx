// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { localePath, type Locale } from "@/i18n/config";
import type { TextosDaFormacao } from "@/i18n/escola/formacao";
import { preencher } from "@/lib/escola/textos";
import type { Contagem } from "@/lib/escola/cadernos";

export type EstadoDoCaderno = "feito" | "agora" | "proximo" | "preparo";

/** O que o cartão precisa de um caderno (vem do servidor, components/escola/formacao/vista.ts). */
export interface CadernoNoCartao {
  numero: number;
  nome: string;
  href: string;
  contagem: Contagem;
  /** Os ids das aulas prontas (o mesmo lessonId de /trilhas). */
  prontas: string[];
}

/** "11 de 11 aulas prontas · você fez 3", "12 etapas", "curso de um ano". */
export function contaDoCaderno(c: CadernoNoCartao, feitas: number, t: TextosDaFormacao["formacao"]["conta"], curta = false): string {
  if (c.contagem.tipo === "etapas") return preencher(t.etapas, { n: c.contagem.etapas });
  if (c.contagem.tipo === "curso") return t.curso;
  const base = preencher(curta ? t.prontasCurto : t.prontas, { prontas: c.contagem.prontas, previstas: c.contagem.previstas });
  if (curta || feitas === 0) return base;
  return `${base} · ${preencher(feitas === c.prontas.length ? t.voceFezTodas : t.voceFez, { n: feitas })}`;
}

/**
 * Um caderno na escada dos degraus (pranchas Formação e Cel-Formação): o posto redondo com o número (vermelho = feito,
 * preto com ouro = você está aqui, vazado = próximo, cinza = em preparação) e a folha de papel com o nome, a contagem
 * real e o selo do estado.
 */
export function CartaoDoCaderno({ lang, c, estado, feitas, t, discreto }: { lang: Locale; c: CadernoNoCartao; estado: EstadoDoCaderno; feitas: number; t: TextosDaFormacao["formacao"]; discreto: boolean }) {
  const n = String(c.numero).padStart(2, "0");
  return (
    <Link href={localePath(lang, c.href)} replace={discreto} className="eff-cad" data-estado={estado} aria-current={estado === "agora" ? "step" : undefined}>
      <span aria-hidden className="ef-t eff-posto">
        {n}
      </span>
      <span className="eff-folhinha">
        <span className="eff-cad-olho">{preencher(t.caderno, { n })}</span>
        <span className="ef-t eff-cad-nome">{c.nome}</span>
        <span className="eff-cad-linha">
          <span className="ef-so-computador">{contaDoCaderno(c, feitas, t.conta)}</span>
          <span className="ef-so-celular">{contaDoCaderno(c, feitas, t.conta, true)}</span>
          <span className="eff-selo">{t.estado[estado]}</span>
        </span>
      </span>
    </Link>
  );
}
