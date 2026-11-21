// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { localePath, type Locale } from "@/i18n/config";
import type { TextosDaFormacaoBase } from "@/i18n/escola/formacao-base";
import { useDaEscola } from "@/lib/escola/acesso";
import { caminhoDaSalaAoVivo } from "@/lib/escola/contratos";
import { preencher } from "@/lib/escola/textos";
import { diaEHora, horaCurta } from "./tempo";

/**
 * O lugar da aula ao vivo na tela Hoje (P5, B4): um bloco fixo, mesmo sem aula hoje. Reaproveita o sistema de aulas ao vivo
 * que já existe (F3: escola_aulas_hoje, a sala com o vídeo do YouTube sem cookies, o bate-papo da turma e a presença); não é
 * outro sistema. Mostra as de hoje (entrar na sala), as dos próximos 7 dias e as gravadas recentes. Quem marca aula da Escola
 * são os educadores e a coordenação, pelo painel. Sem a função no banco, o bloco fica com a explicação e sem lista.
 */
export function AulaAoVivoDeHoje({ lang, t }: { lang: Locale; t: TextosDaFormacaoBase["hoje"] }) {
  const lido = useDaEscola("escola_aulas_hoje");
  const dados = lido?.ok ? lido.dados : null;
  const hoje = (dados?.hoje ?? []).filter((a) => a.status !== "encerrada");
  const proximas = (dados?.proximas ?? []).slice(0, 3);
  const gravadas = (dados?.gravadas ?? []).slice(0, 3);
  const av = t.aoVivo;
  return (
    <section aria-labelledby="ef-aovivo" className="ef-cartao ef-aovivo ef-o-aovivo" data-aula-ao-vivo="">
      <h2 id="ef-aovivo" className="ef-t">
        {hoje.length > 0 ? av.titulo : av.lugar}
      </h2>
      {hoje.length > 0 ? (
        <ul>
          {hoje.map((a) => (
            <li key={a.id}>
              <strong>{a.titulo}</strong> · {a.status === "ao_vivo" ? av.agora : preencher(av.as, { hora: horaCurta(lang, a.inicio) })}
              <br />
              <Link href={localePath(lang, caminhoDaSalaAoVivo(a.id))} className="ef-botao-linha">
                {av.entrar}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <p className="ef-aovivo-texto">{av.texto}</p>
          {lido === null ? <p className="ef-aovivo-nota">{t.carregando}</p> : <p className="ef-aovivo-nota">{av.nenhuma}</p>}
        </>
      )}
      {proximas.length > 0 && (
        <>
          <h3 className="ef-aovivo-sub">{av.proximas}</h3>
          <ul>
            {proximas.map((a) => (
              <li key={a.id}>
                <strong>{a.titulo}</strong> · {diaEHora(lang, a.inicio)}
              </li>
            ))}
          </ul>
        </>
      )}
      {gravadas.length > 0 && (
        <>
          <h3 className="ef-aovivo-sub">{av.gravadas}</h3>
          <ul>
            {gravadas.map((a) => (
              <li key={a.id}>
                <Link href={localePath(lang, caminhoDaSalaAoVivo(a.id))}>
                  {a.titulo} · {av.assistir}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
