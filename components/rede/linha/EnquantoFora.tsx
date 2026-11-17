// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import Link from "@/components/Link";
import { linhaAberta, type AbaDaRegra, type PostDaLinha } from "@/lib/rede/cliente-linha";
import { desligarFora, esteveFora, foraDesligado, marcarVisita, NUMEROS_DA_REGRA, ultimaVisita } from "@/lib/rede/linha-aberta";
import { foraMinimo } from "@/lib/rede/interesses";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaLinha } from "@/lib/rede/textos-linha";
import { Icone } from "../publicar/alumia2/icones";
import { previa } from "./base";

interface Achado {
  desde: string;
  novos: number;
  destaques: PostDaLinha[];
}

/**
 * O que a faixa achou nesta aba do navegador (cada rota da Alumia monta a Rede de novo): voltar ao Início não pergunta outra
 * vez nem faz a faixa sumir sozinha. Só na memória da página; "dispensada" vale até recarregar.
 */
const memoria: { achado: Achado | null; dispensada: boolean; pergunta: Promise<Achado | null> | null } = { achado: null, dispensada: false, pergunta: null };

/** "ter., 18:40": o dia e a hora da última visita, no idioma da tela. */
function quando(lang: string, iso: string): string {
  try {
    return new Intl.DateTimeFormat(lang, { weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * "Enquanto você esteve fora": quando a pessoa volta depois de 8 horas ou mais, as primeiras publicações que chegaram desde a
 * última visita, pela MESMA regra da linha (nunca por curtidas). A hora da última visita mora só neste aparelho: o servidor
 * recebe um instante na pergunta e não grava nada (supabase/migracoes/20261113-alumia-o7-linha.sql, rede_roda_desde).
 */
export function EnquantoFora({ lang, t, aba }: { lang: string; t: TextosDaLinha; aba: AbaDaRegra }) {
  const [achado, setAchado] = useState<Achado | null>(() => (memoria.dispensada ? null : memoria.achado));

  useEffect(() => {
    let vivo = true;
    if (!memoria.pergunta) {
      const ultima = ultimaVisita();
      if (previa()) {
        // Prévia: a faixa com os posts de exemplo (nada vai ao banco).
        memoria.pergunta = import("@/lib/rede/publicar/exemplos-alumia2").then((m) => ({
          desde: new Date(Date.now() - 14 * 3600_000).toISOString(),
          novos: 12,
          destaques: m.postsDeExemplo().slice(0, 3).map((p): PostDaLinha => ({ ...p, o7_porque: p.chamado ? "ato" : "roda" })),
        }));
      } else if (ultima && esteveFora(ultima, Date.now(), foraMinimo()) && !foraDesligado()) {
        memoria.pergunta = linhaAberta.desde(aba, ultima).then(
          (r) => (r.novos > 0 ? { desde: r.desde ?? ultima, novos: r.novos, destaques: r.destaques } : null),
          () => null,
        );
      } else {
        memoria.pergunta = Promise.resolve(null);
      }
      marcarVisita();
    }
    // A resposta vale para a página inteira: quem montar a faixa de novo (outra aba, voltar ao Início) recebe a mesma.
    void memoria.pergunta.then((a) => {
      memoria.achado = a;
      if (vivo && a && !memoria.dispensada && !foraDesligado()) setAchado(a);
    });
    // A última visita é a última vez em que a página esteve à vista.
    const aoSair = () => document.visibilityState === "hidden" && marcarVisita();
    document.addEventListener("visibilitychange", aoSair);
    return () => {
      vivo = false;
      document.removeEventListener("visibilitychange", aoSair);
    };
  }, [aba]);

  if (!achado) return null;
  const dispensar = (deVez: boolean) => {
    memoria.dispensada = true;
    if (deVez) desligarFora(true);
    setAchado(null);
  };
  const cheio = achado.novos >= NUMEROS_DA_REGRA.maximo;
  return (
    <section className="ro-fora" aria-labelledby="ro-fora-titulo">
      <header className="ro-fora-cabeca">
        <h2 id="ro-fora-titulo" className="al-cond">{t.fora.titulo}</h2>
        <p>
          {preencher(t.fora.desdeQuando, { quando: quando(lang, achado.desde) })} · {achado.novos === 1 ? t.fora.novosUm : preencher(cheio ? t.fora.novosMuitos : t.fora.novos, { n: achado.novos })}
        </p>
        <button type="button" className="ro-fora-fechar" aria-label={t.fora.dispensar} title={t.fora.dispensar} onClick={() => dispensar(false)}>
          <Icone nome="fechar" className="h-4 w-4" />
        </button>
      </header>
      <ol className="ro-fora-lista">
        {achado.destaques.map((p, i) => (
          <li key={p.id}>
            <Link href={`/${lang}/alumia/p/${p.id}`} className="ro-fora-item" aria-label={`${t.fora.abrir}: ${p.autor.codinome}`}>
              <span className="ro-fora-n al-cond" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
              <span className="ro-fora-texto">
                <strong>{p.autor.codinome}</strong>
                {p.o7_porque === "aviso" || p.o7_porque === "ato" || p.o7_porque === "ajudou" ? <em className={`ro-fora-marca al-cond ro-porque-${p.o7_porque}`}>{t.porque[p.o7_porque]}</em> : null}
                <span>{(p.titulo || p.texto).replace(/\s+/g, " ").slice(0, 110)}</span>
              </span>
              <Icone nome="chevron" className="h-4 w-4 shrink-0" />
            </Link>
          </li>
        ))}
      </ol>
      <footer className="ro-fora-pe">
        <p>
          {t.fora.criterio} {t.fora.guardado}
        </p>
        <button type="button" className="ro-fora-desligar" onClick={() => dispensar(true)}>{t.fora.desligar}</button>
      </footer>
    </section>
  );
}
