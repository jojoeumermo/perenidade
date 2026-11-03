// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import Link from "@/components/Link";
import { fill, type Locale, localePath } from "@/i18n/config";
import type { TextosDaOrganizacao } from "@/i18n/escola/organizacao";
import { hasBackend } from "@/lib/backend";
import { contarEscola } from "@/lib/escola/banco";
import { assembleiaAberta, type Pauta, type SituacaoDaAssembleia, VOTOS_POR_PESSOA, votar } from "@/lib/escola/organizacao";
import { ANO_LETIVO, hojeEmBrasilia, semestreDe } from "@/lib/escola/tempo";
import { useVotos } from "./guardado-organizacao";

type S = TextosDaOrganizacao["assembleia"];

/**
 * A votação da assembleia (E4-12): até 3 trilhas da pauta por semestre, sem identificação. O servidor só soma (+1 por
 * trilha, `contar_escola`); este aparelho guarda quais trilhas foram marcadas. Voto não se desfaz, e a tela avisa antes,
 * com a caixa "Entendi" que libera os botões.
 */
export function AssembleiaVotacao({ pauta, candidatas, situacaoInicial, s, lang }: { pauta: Pauta; candidatas: { slug: string; titulo: string }[]; situacaoInicial: SituacaoDaAssembleia; s: S; lang: Locale }) {
  const [situacao, setSituacao] = useState<SituacaoDaAssembleia>(situacaoInicial);
  const [entendi, setEntendi] = useState(false);
  const [aviso, setAviso] = useState("");
  const votos = useVotos(pauta.semestre);

  // O dia vale no aparelho (Brasília): refaz a conta depois de abrir, para a página guardada não ficar presa.
  useEffect(() => {
    const id = window.setTimeout(() => setSituacao(assembleiaAberta(pauta, hojeEmBrasilia(), ANO_LETIVO)), 0);
    return () => window.clearTimeout(id);
  }, [pauta]);

  const aberta = situacao === "aberta";
  const restam = Math.max(0, VOTOS_POR_PESSOA - votos.length);

  function marcar(trilha: string) {
    const r = votar(pauta, semestreDe(hojeEmBrasilia()).id, trilha, contarEscola);
    setAviso(r.ok ? "" : r.motivo === "armazenamento" ? s.naoGuardou : "");
  }

  return (
    <div data-assembleia-votacao="" data-situacao={situacao}>
      <p className="org-estado" role="status" data-assembleia-estado={situacao}>
        {situacao === "aberta" ? s.estadoAberta : situacao === "fechada" ? s.estadoFechada : situacao === "outro-semestre" ? fill(s.estadoOutro, { semestre: pauta.semestre }) : s.estadoSemPauta}
      </p>
      {aberta && (
        <>
          <p className="org-nota">{fill(s.comoVota, { n: VOTOS_POR_PESSOA })}</p>
          <div className="org-aviso-forte" data-assembleia-aviso-voto="">
            <p>{s.avisoVoto}</p>
            <label className="org-caixa">
              <input type="checkbox" checked={entendi} onChange={(e) => setEntendi(e.target.checked)} />
              <span>{s.entendi}</span>
            </label>
          </div>
          {!hasBackend && <p className="org-nota">{s.foraDoAr}</p>}
          <p className="org-nota" aria-live="polite" data-assembleia-restam="">
            {restam > 0 ? fill(s.restam, { n: restam }) : fill(s.esgotou, { n: VOTOS_POR_PESSOA })}
          </p>
        </>
      )}
      {aviso && (
        <p className="org-erro" role="alert">
          {aviso}
        </p>
      )}
      <ol className="org-pauta">
        {candidatas.map((c) => {
          const votou = votos.includes(c.slug);
          return (
            <li key={c.slug} className="org-candidata" data-trilha={c.slug} data-votado={votou ? "sim" : "nao"}>
              <p className="org-candidata-nome" lang="pt">
                {c.titulo}
              </p>
              <p className="org-nota">
                <Link href={localePath(lang, `/trilhas/${c.slug}`)} className="underline hover:text-oxblood">
                  {s.abrirTrilha}
                </Link>
              </p>
              {aberta &&
                (votou ? (
                  <p className="org-votado">✓ {s.votado}</p>
                ) : (
                  <button type="button" className="botao" data-votar={c.slug} disabled={!entendi || restam === 0 || !hasBackend} onClick={() => marcar(c.slug)}>
                    {s.votar}
                  </button>
                ))}
            </li>
          );
        })}
      </ol>
      <p className="org-nota">{s.naoEEleicao}</p>
    </div>
  );
}
