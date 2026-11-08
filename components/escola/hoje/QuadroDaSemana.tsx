// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { localePath, type Locale } from "@/i18n/config";
import type { TextosDaFormacaoBase } from "@/i18n/escola/formacao-base";
import type { EncontroDoNucleo } from "@/lib/escola/contratos";
import { preencher } from "@/lib/escola/textos";
import type { CadernoDoQuadro } from "./cadernos-do-quadro";
import { linhasDoQuadro } from "./quadro";
import { diaEHora } from "./tempo";

/**
 * O Quadro da semana (prancha Hoje): as aulas do caderno de agora, riscadas quando feitas NESTE aparelho (o mesmo
 * progresso de /trilhas), a próxima com o selo "agora" e, se a F4 já estiver no banco, o encontro do núcleo.
 * Celular (Cel-Hoje): sem os códigos F-0000 e sem o "Aula:", e só o botão "Continuar a aula".
 */
export function QuadroDaSemana({
  lang,
  t,
  caderno,
  feitas,
  encontro,
  tudoFeito,
}: {
  lang: Locale;
  t: TextosDaFormacaoBase["hoje"];
  caderno: CadernoDoQuadro | null;
  feitas: ReadonlySet<string>;
  encontro: EncontroDoNucleo | null;
  tudoFeito: boolean;
}) {
  const linhas = caderno ? linhasDoQuadro(caderno, feitas, encontro ? 5 : 6) : [];
  const agora = linhas.find((l) => l.agora);
  // O encontro do núcleo entra antes da aula de agora (a ordem da prancha).
  const indiceDoEncontro = encontro ? Math.max(0, linhas.findIndex((l) => l.agora)) : -1;
  const total = linhas.length + (encontro ? 1 : 0);
  const feitos = linhas.filter((l) => l.feita).length;

  return (
    <section aria-labelledby="ef-quadro" className="ef-quadro ef-o-quadro">
      <div className="ef-quadro-topo">
        <h2 id="ef-quadro" className="ef-t">
          {t.quadro}
        </h2>
        {total > 0 && (
          <span className="ef-quadro-legenda">
            <span className="ef-quadro-legenda-texto">{t.quadroLegenda} </span>
            <span className="ef-quadro-conta ef-so-computador">{preencher(t.feitos, { n: feitos, total })}</span>
            <span className="ef-quadro-conta ef-so-celular">{preencher(t.feitosCurto, { n: feitos, total })}</span>
          </span>
        )}
      </div>

      {linhas.length === 0 ? (
        <p className="ef-vazio">{tudoFeito ? t.tudoFeito : t.quadroVazio}</p>
      ) : (
        <ul>
          {linhas.map((l, i) => (
            <LinhaComEncontro key={l.aula.id} antes={i === indiceDoEncontro && encontro ? <ItemDoEncontro lang={lang} t={t} encontro={encontro} /> : null}>
              <li>
                <span className="ef-t ef-codigo" style={{ color: "#E63B2A" }}>
                  {l.aula.codigo}
                </span>
                <span className={l.feita ? "ef-riscado" : undefined} style={l.agora ? { fontWeight: 700 } : undefined}>
                  <span className="ef-prefixo">{t.aula} </span>
                  {l.aula.titulo}
                </span>
                {l.agora && <span className="ef-agora">{t.agora}</span>}
              </li>
            </LinhaComEncontro>
          ))}
        </ul>
      )}

      {caderno && (
        <div className="ef-quadro-acoes">
          {agora && (
            <Link href={localePath(lang, agora.aula.href)} className="ef-botao-vermelho">
              <span className="ef-so-computador">{preencher(t.continuar, { codigo: agora.aula.codigo, titulo: agora.aula.titulo })}</span>
              <span className="ef-so-celular">{t.continuarCurto}</span>
            </Link>
          )}
          <Link href={localePath(lang, caderno.href)} className="ef-botao-vazado">
            {t.verCaderno}
          </Link>
        </div>
      )}
    </section>
  );
}

function LinhaComEncontro({ antes, children }: { antes: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      {antes}
      {children}
    </>
  );
}

function ItemDoEncontro({ lang, t, encontro }: { lang: Locale; t: TextosDaFormacaoBase["hoje"]; encontro: EncontroDoNucleo }) {
  return (
    <li>
      <span className="ef-t ef-codigo" style={{ color: "#E8604C" }}>
        {t.rotuloNucleo}
      </span>
      {/* escola_nucleo devolve o PRÓXIMO encontro: ainda não aconteceu, então não se risca. */}
      <span>{preencher(t.encontro, { quando: diaEHora(lang, encontro.quando) })}</span>
    </li>
  );
}
