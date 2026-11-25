// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A aba Eu do aplicativo instalado: o resumo de estudo montado para o celular (retomar, números, disciplinas com progresso,
// atalhos). Lê do aparelho as mesmas chaves do painel do site (lib/meu-estudo, lib/estudo, lib/progress): nada novo é guardado.
import { fill } from "@/i18n/config";
import { lerCartoes, paraHoje, type CartaoDeRevisao } from "@/lib/estudo";
import { lerRespostas, lerTestes, paraRevisar, type RespostaGuardada, type Teste } from "@/lib/meu-estudo";
import { useCompleted, useLastLesson } from "@/lib/progress";
import { useHydrated } from "@/lib/storage";
import type { TextosDoEstudo } from "@/lib/textos-estudo";
import { L, useI18n } from "../I18n";
import { useGuardado } from "../estudo/guardado";
import { useIndice } from "../estudo/indice";
import { Barra } from "./jornada";
import { textosDoAppNovo } from "./textos-app";

export function EuDoApp({ s }: { s: TextosDoEstudo["meuEstudo"] }) {
  const { lang } = useI18n();
  const n = textosDoAppNovo(lang);
  const hidratado = useHydrated();
  const feitas = useCompleted();
  const ultima = useLastLesson();
  const indice = useIndice(lang);
  const [testes] = useGuardado<Record<string, Teste>>(lerTestes, {});
  const [respostas] = useGuardado<Record<string, RespostaGuardada>>(lerRespostas, {});
  const [cartoes] = useGuardado<CartaoDeRevisao[]>(lerCartoes, []);

  if (!hidratado) return <p className="app-vazio" role="status">{s.carregando}</p>;

  const total = (indice?.trilhas ?? []).reduce((soma, tr) => soma + tr[5].length, 0);
  const paraRevisarHoje = paraRevisar(respostas).length + paraHoje(cartoes).length;
  const ativas = new Set<string>([...feitas, ...Object.keys(testes)].map((id) => id.split("/")[0]));
  const trilhas = (indice?.trilhas ?? [])
    .filter((tr) => ativas.has(tr[0]))
    .map((tr) => {
      const ids = tr[5].map(([a]) => `${tr[0]}/${a}`);
      return { slug: tr[0], titulo: tr[1], area: tr[2], feitas: ids.filter((id) => feitas.has(id)).length, total: ids.length };
    });
  const vazio = feitas.size === 0 && Object.keys(testes).length === 0 && Object.keys(respostas).length === 0;

  return (
    <>
      <section className="app-cartao app-resumo-progresso" aria-label={n.seuProgresso}>
        <span className="app-cartao-rotulo">{n.seuProgresso}</span>
        <span className="app-cartao-titulo">{vazio ? n.nenhumaAulaAinda : n.aulasFeitas(feitas.size)}</span>
        {total > 0 && <Barra feitas={Math.min(feitas.size, total)} total={total} rotulo={n.progressoDe(Math.min(feitas.size, total), total)} />}
        {ultima?.path ? (
          <L href={ultima.path} className="app-link-forte">
            {s.continuar}: {ultima.title} →
          </L>
        ) : (
          <L href="/app/estudar" className="app-link-forte">
            {s.escolherAula} →
          </L>
        )}
      </section>

      {!vazio && (
        <ul className="app-numeros" aria-label={s.resumo}>
          <li>
            <strong>{Object.keys(testes).length}</strong>
            <span>{s.testesFeitos}</span>
          </li>
          <li>
            <strong>{Object.keys(respostas).length}</strong>
            <span>{s.exerciciosFeitos}</span>
          </li>
          <li>
            <strong>{paraRevisarHoje}</strong>
            <span>{s.paraHoje}</span>
          </li>
        </ul>
      )}

      {trilhas.length > 0 && (
        <section className="app-secao" aria-label={s.porDisciplina}>
          <h2 className="app-titulo-secao">{s.porDisciplina}</h2>
          <ul className="app-lista">
            {trilhas.map((tr) => (
              <li key={tr.slug}>
                <L href={`/app/estudar/${tr.area}/${tr.slug}`} className="app-item-lista">
                  <span className="app-item-texto">
                    <span className="app-item-titulo">{tr.titulo}</span>
                    <Barra feitas={tr.feitas} total={tr.total} rotulo={fill(s.progressoDa, { trilha: tr.titulo })} />
                    <span className="app-item-aux app-item-aux-livre">{fill(s.aulasDe, { a: tr.feitas, b: tr.total })}</span>
                  </span>
                  <span aria-hidden className="app-item-num">→</span>
                </L>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
