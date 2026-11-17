// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import Link from "@/components/Link";
import { conversa } from "@/lib/rede/cliente-conversa";
import { linhaAberta, type TemaEmAlta } from "@/lib/rede/cliente-linha";
import { NUMEROS_DA_REGRA } from "@/lib/rede/linha-aberta";
import { preencher } from "@/lib/rede/preencher";
import { faltaFuncaoNoBanco } from "@/lib/rede/reserva";
import type { TextosDaLinha } from "@/lib/rede/textos-linha";
import type { ContextoDoEncaixe } from "../encaixes";
import { linhaAbertaLigada, previa, useTextosDaLinha } from "./base";

/** Os temas da prévia (sem banco): os das pranchas. */
const DE_EXEMPLO: TemaEmAlta[] = [
  { tag: "passelivre", nova: false, faixa: "dezenas" },
  { tag: "enem2026", nova: false, faixa: "dezenas" },
  { tag: "despejozero", nova: true, faixa: "algumas" },
  { tag: "greve", nova: true, faixa: "algumas" },
  { tag: "redacao", nova: false, faixa: "algumas" },
];

interface Estado {
  temas: TemaEmAlta[];
  horas: number;
  piso: number;
}

/** O que a lista já sabia nesta aba do navegador (5 minutos): a coluna da direita aparece em toda tela e não pergunta de novo a cada clique. */
const memoria: { quando: number; estado: Estado | null; seguidas: Set<string> | null } = { quando: 0, estado: null, seguidas: null };

/** A lista lembrada, se ainda vale (fora do componente: a hora não entra no desenho). */
function lembrada(): Estado | null {
  return memoria.estado && Date.now() - memoria.quando < 5 * 60_000 ? memoria.estado : null;
}

function lembrarEstado(e: Estado) {
  memoria.estado = e;
  memoria.quando = Date.now();
}

function lembrarSeguidas(s: Set<string>) {
  memoria.seguidas = s;
}

/**
 * "Assuntos em alta" sem manipulação: #temas usados por 3 pessoas ou mais nas últimas 48 horas e por mais gente do que nas 48
 * anteriores. O critério inteiro vai escrito embaixo da lista; a lista é a mesma para todo mundo (o banco não olha quem pergunta)
 * e não mostra número, só a faixa. Seguir um #tema daqui é acompanhar o assunto sem seguir pessoas.
 */
export function EmAlta({ lang, t, membro, compacta = false }: { lang: string; t: TextosDaLinha; membro: boolean; compacta?: boolean }) {
  const [fresca] = useState(() => lembrada() !== null);
  const [estado, setEstado] = useState<Estado | null | "erro" | "sem">(() => (previa() ? { temas: DE_EXEMPLO, horas: NUMEROS_DA_REGRA.alta_horas, piso: NUMEROS_DA_REGRA.alta_piso } : lembrada()));
  const [seguidas, setSeguidas] = useState<Set<string>>(() => memoria.seguidas ?? new Set(previa() ? ["enem2026"] : []));
  const [ocupada, setOcupada] = useState<string | null>(null);

  useEffect(() => {
    if (previa() || !membro || fresca) return;
    let vivo = true;
    linhaAberta.emAlta().then(
      (r) => {
        lembrarEstado(r);
        if (vivo) setEstado(r);
      },
      // Banco sem a migração ainda: a caixa não aparece (não promete o que não faz).
      (e) => vivo && setEstado(faltaFuncaoNoBanco(e) ? "sem" : "erro"),
    );
    conversa.tagsSeguidas().then(
      (r) => {
        const lidas = new Set(r.tags);
        lembrarSeguidas(lidas);
        if (vivo) setSeguidas(lidas);
      },
      () => undefined,
    );
    return () => {
      vivo = false;
    };
  }, [membro, fresca]);

  async function seguir(tag: string) {
    const quer = !seguidas.has(tag);
    setOcupada(tag);
    try {
      if (!previa()) await conversa.seguirTag(tag, quer);
      const nova = new Set(seguidas);
      if (quer) nova.add(tag);
      else nova.delete(tag);
      lembrarSeguidas(nova);
      setSeguidas(nova);
    } catch {
      // o botão volta ao que era; a página do tema mostra o motivo se a pessoa abrir
    } finally {
      setOcupada(null);
    }
  }

  if (!membro && !previa()) return null;
  if (estado === "sem" || (compacta && (estado === null || estado === "erro"))) return null;
  const criterio = preencher(t.alta.criterio, {
    piso: typeof estado === "object" && estado ? estado.piso : NUMEROS_DA_REGRA.alta_piso,
    horas: typeof estado === "object" && estado ? estado.horas : NUMEROS_DA_REGRA.alta_horas,
  });
  return (
    <section className={`ro-alta${compacta ? " ro-alta-compacta" : ""}`} aria-labelledby={compacta ? "ro-alta-coluna" : "ro-alta-pagina"}>
      <h2 id={compacta ? "ro-alta-coluna" : "ro-alta-pagina"} className="ro-titulo al-cond">{t.alta.titulo}</h2>
      {estado === null ? (
        <p className="ro-cinza" aria-busy="true">…</p>
      ) : estado === "erro" ? (
        <p className="ro-cinza" role="alert">{t.alta.erro}</p>
      ) : estado.temas.length === 0 ? (
        <p className="ro-cinza">{t.alta.nada}</p>
      ) : (
        <ol className="ro-alta-lista">
          {estado.temas.slice(0, compacta ? 5 : NUMEROS_DA_REGRA.alta_maximo).map((x, i) => (
            <li key={x.tag}>
              <span className="ro-alta-n al-cond" aria-hidden>{i + 1}</span>
              <Link href={`/${lang}/alumia/tag/${x.tag}`} className="ro-alta-tema" aria-label={preencher(t.alta.abrir, { tag: x.tag })}>
                <strong>#{x.tag}</strong>
                <span>
                  <em className={`ro-alta-marca al-cond${x.nova ? " ro-alta-nova" : ""}`}>{x.nova ? t.alta.nova : t.alta.cresceu}</em>
                  {t.alta.faixa[x.faixa]}
                </span>
              </Link>
              <button type="button" className="ro-alta-seguir" aria-pressed={seguidas.has(x.tag)} disabled={ocupada === x.tag} onClick={() => void seguir(x.tag)}>
                {seguidas.has(x.tag) ? t.alta.seguindo : t.alta.seguir}
              </button>
            </li>
          ))}
        </ol>
      )}
      <p className="ro-alta-criterio">
        {criterio} {t.alta.igual}{" "}
        <Link href={`/${lang}/alumia/como-a-linha#em-alta`}>{t.alta.verCriterio}</Link>
      </p>
    </section>
  );
}

/** A caixa na coluna da direita do computador (encaixe da F1). Só com o interruptor ligado e para quem é membro. */
export function EmAltaNaColuna({ lang, situacao }: ContextoDoEncaixe) {
  const ligada = linhaAbertaLigada();
  const t = useTextosDaLinha(lang, ligada);
  if (!ligada || !t) return null;
  return <EmAlta lang={lang} t={t} membro={situacao.logado && situacao.membro} compacta />;
}

/**
 * Os assuntos em alta na busca vazia: o mesmo bloco, com o mesmo nome e a mesma regra (48 horas, 3 pessoas ou mais) da coluna
 * da direita e de Minhas linhas. Uma ideia, uma lista, um critério.
 */
export function EmAltaNaBusca({ lang, membro }: { lang: string; membro: boolean }) {
  const ligada = linhaAbertaLigada();
  const t = useTextosDaLinha(lang, ligada);
  if (!ligada || !t) return null;
  return <EmAlta lang={lang} t={t} membro={membro} />;
}

