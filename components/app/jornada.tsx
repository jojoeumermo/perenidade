// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Peças da jornada de estudo própria do aplicativo instalado (disciplina → trilha → aula → concluir → progresso).
// O progresso vem do aparelho (lib/progress.ts, chave lucia:done): nada novo é guardado, nada é apagado.
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { localePath, type Locale } from "@/i18n/config";
import { rememberLesson, setCompleted, useCompleted, useLastLesson } from "@/lib/progress";
import { L, useI18n } from "../I18n";
import { textosDoAppNovo } from "./textos-app";

/** Os textos do app no idioma da página (as funções de texto não passam de servidor para cliente: cada peça os lê aqui). */
function useS() {
  return textosDoAppNovo(useI18n().lang);
}

export interface AulaDaJornada {
  id: string;
  href: string;
  title: string;
  minutos?: number;
  ready: boolean;
  /** Trilha da aula (só nas telas que misturam trilhas, como a da disciplina). */
  trilha?: { slug: string; titulo: string };
}

/** Barra fina de progresso com texto para leitor de tela. */
export function Barra({ feitas, total, rotulo }: { feitas: number; total: number; rotulo: string }) {
  const pct = total ? Math.round((feitas / total) * 100) : 0;
  return (
    <div className="app-barra" role="progressbar" aria-label={rotulo} aria-valuemin={0} aria-valuemax={total} aria-valuenow={feitas}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Um cartão de trilha na tela da disciplina: título, quanto já foi feito, barra. */
export function CartaoDaTrilha({ href, title, resumo, aulas }: { href: string; title: string; resumo: string; aulas: string[] }) {
  const s = useS();
  const feitas = useCompleted();
  const n = aulas.filter((id) => feitas.has(id)).length;
  return (
    <L href={href} className="app-item-lista app-trilha-cartao">
      <span className="app-item-texto">
        <span className="app-item-titulo">{title}</span>
        <span className="app-item-aux">{resumo}</span>
        <Barra feitas={n} total={aulas.length} rotulo={s.progressoDe(n, aulas.length)} />
        <span className="app-item-aux app-item-aux-livre">{s.progressoDe(n, aulas.length)}</span>
      </span>
      <span aria-hidden className="app-item-num">→</span>
    </L>
  );
}

/** O botão grande de "continuar": a primeira aula pronta ainda não concluída (ou a primeira, se nada foi feito). */
export function ContinuarEstudo({ aulas, comecar }: { aulas: AulaDaJornada[]; comecar?: boolean }) {
  const s = useS();
  const feitas = useCompleted();
  const prontas = aulas.filter((a) => a.ready);
  if (prontas.length === 0) return null;
  const alvo = prontas.find((a) => !feitas.has(a.id));
  if (!alvo) return null;
  // O contador é sempre o da trilha da aula que o botão abre; na tela da disciplina o nome da trilha vem junto.
  const daTrilha = alvo.trilha ? prontas.filter((a) => a.trilha?.slug === alvo.trilha!.slug) : prontas;
  const n = daTrilha.filter((a) => feitas.has(a.id)).length;
  return (
    <L href={alvo.href} className="app-cartao app-continuar-estudo">
      <span className="app-cartao-rotulo">{n === 0 || comecar ? s.comecarTrilha : s.continuarEstudo}</span>
      <span className="app-cartao-titulo">{alvo.title}</span>
      <span className="app-cartao-aux">
        {alvo.trilha ? `${alvo.trilha.titulo} · ` : ""}
        {s.progressoDe(n, daTrilha.length)}
      </span>
    </L>
  );
}

/** A lista de aulas da trilha, com a marca de concluída e a próxima destacada. */
export function ListaDaTrilha({ aulas }: { aulas: AulaDaJornada[] }) {
  const s = useS();
  const feitas = useCompleted();
  const proxima = aulas.find((a) => a.ready && !feitas.has(a.id))?.id;
  return (
    <ol className="app-lista app-passos">
      {aulas.map((a, i) => {
        const feita = feitas.has(a.id);
        const marca = (
          <span className="app-passo-marca" data-feita={feita || undefined} aria-hidden>
            {feita ? "✓" : String(i + 1).padStart(2, "0")}
          </span>
        );
        const texto = (
          <span className="app-item-texto">
            <span className="app-item-titulo">
              {a.title}
              {feita && <span className="sr-only"> ({s.aulaConcluida})</span>}
            </span>
            <span className="app-item-aux">{a.ready ? (a.minutos ? s.minutos(a.minutos) : "") : s.emPreparacao}</span>
          </span>
        );
        return (
          <li key={a.id}>
            {a.ready ? (
              <L href={a.href} className="app-item-lista" data-proxima={a.id === proxima || undefined}>
                {marca}
                {texto}
              </L>
            ) : (
              <div className="app-item-lista" data-pendente>
                {marca}
                {texto}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Guarda a aula aberta para o "continuar de onde parou" do Início, do Estudar e do Eu. */
export function GuardarAula({ path, title, track, area }: { path: string; title: string; track: string; area: string }) {
  useEffect(() => {
    rememberLesson({ path, title, track, area });
  }, [path, title, track, area]);
  return null;
}

/**
 * A barra fixa de baixo da aula (no lugar da barra de abas, que sai para não cobrir o texto): "Concluir e seguir" marca
 * a aula e vai para a próxima; na última, volta para a trilha. Aula já concluída: "Próxima aula" e "Desfazer".
 */
export function BarraDaAula({ id, proxima, trilha, posicao, lang }: { id: string; proxima?: string; trilha: string; posicao: string; lang: Locale }) {
  const s = useS();
  const feitas = useCompleted();
  const router = useRouter();
  const { t } = useI18n();
  const feita = feitas.has(id);
  const destino = proxima ?? trilha;
  const ir = () => router.push(localePath(lang, destino));
  return (
    <div className="app-barra-aula" role="region" aria-label={t.lesson.done}>
      <p className="app-barra-aula-pos">{posicao}</p>
      {feita ? (
        <>
          <button type="button" className="app-botao-sec" onClick={() => setCompleted(id, false)}>
            {s.desfazer}
          </button>
          <button type="button" className="app-botao" onClick={ir}>
            {proxima ? s.proximaAula : s.voltarParaTrilha} →
          </button>
        </>
      ) : (
        <button
          type="button"
          className="app-botao app-botao-largo"
          onClick={() => {
            setCompleted(id, true);
            ir();
          }}
        >
          {proxima ? s.concluirESeguir : s.concluirTrilha}
        </button>
      )}
    </div>
  );
}

/** O resumo de progresso do alto da aba Eu: aulas feitas e o caminho de volta ao estudo. */
export function ResumoDeProgresso({ total, continuar }: { total: number; continuar: string }) {
  const s = useS();
  const feitas = useCompleted();
  return (
    <section className="app-cartao app-resumo-progresso" aria-label={s.seuProgresso}>
      <span className="app-cartao-rotulo">{s.seuProgresso}</span>
      <span className="app-cartao-titulo">{s.aulasFeitas(feitas.size)}</span>
      {total > 0 && <Barra feitas={Math.min(feitas.size, total)} total={total} rotulo={s.progressoDe(Math.min(feitas.size, total), total)} />}
      <L href={continuar} className="app-link-forte">
        {s.continuarDeOndeParou} →
      </L>
    </section>
  );
}

/** O alto do Estudar: continuar de onde parou (a última aula aberta neste aparelho). Sem aula aberta, nada: a lista de disciplinas é o começo. */
export function RetomarEstudo() {
  const s = useS();
  const ultima = useLastLesson();
  const feitas = useCompleted();
  if (!ultima?.path) return null;
  return (
    <L href={ultima.path} className="app-cartao app-continuar-estudo">
      <span className="app-cartao-rotulo">{s.continuarDeOndeParou}</span>
      <span className="app-cartao-titulo">{ultima.title}</span>
      <span className="app-cartao-aux">
        {ultima.track} · {s.aulasFeitas(feitas.size)}
      </span>
    </L>
  );
}
