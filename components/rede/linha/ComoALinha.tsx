// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import Link from "@/components/Link";
import { linhaAberta } from "@/lib/rede/cliente-linha";
import { NUMEROS_DA_REGRA, type NumerosDaRegra } from "@/lib/rede/linha-aberta";
import { preencher } from "@/lib/rede/preencher";
import { EsqueletoDaLinha } from "../Esqueletos";
import { Icone } from "../publicar/alumia2/icones";
import type { PropsDaTelaDoPacote } from "../registro";
import { previa, TrocaDeModo, useModoDaLinha, useTextosDaLinha } from "./base";

/** O desenho da roda: as mesmas sete publicações de quatro pessoas, por ordem de chegada e em roda (cada cor é uma pessoa). */
const CHEGADA = [1, 1, 1, 2, 1, 3, 4] as const;
const EM_RODA = [1, 2, 3, 4, 1, 1, 1] as const;

function Fileira({ ordem, rotulo }: { ordem: readonly number[]; rotulo: string }) {
  return (
    <div className="ro-desenho-fileira">
      <span className="ro-desenho-rotulo al-cond">{rotulo}</span>
      <span className="ro-desenho-ladrilhos" aria-hidden>
        {ordem.map((cor, i) => (
          <span key={i} className="ro-ladrilho" data-cor={cor} style={{ animationDelay: `${i * 70}ms` }} />
        ))}
      </span>
    </div>
  );
}

/**
 * "Como a linha é montada" (/alumia/como-a-linha): a regra "Em roda" por extenso, passo a passo, com os números que o banco usa
 * (rede_roda_regra; sem banco, os de lib/rede/linha-aberta.ts, que o teste compara com os do banco), com o ingrediente escolhido
 * pela pessoa (os interesses do questionário, onda 11). Diz também o que NÃO entra
 * na conta, o que a pessoa escolhe, o que fica só no aparelho, e o critério dos assuntos em alta e das respostas.
 */
export default function ComoALinha({ lang, s }: PropsDaTelaDoPacote) {
  const t = useTextosDaLinha(lang);
  const [modo, setModo] = useModoDaLinha();
  const [n, setN] = useState<NumerosDaRegra>(NUMEROS_DA_REGRA);

  useEffect(() => {
    if (previa()) return;
    let vivo = true;
    // Visitante, banco sem a migração ou falha de rede: valem os números do código (os mesmos; o teste confere).
    linhaAberta.regra().then(
      (r) => vivo && r && typeof r.teto === "number" && setN({ ...NUMEROS_DA_REGRA, ...r }),
      () => undefined,
    );
    return () => {
      vivo = false;
    };
  }, []);

  if (!t) return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />;
  const por = (texto: string) => preencher(texto, n as unknown as Record<string, number>);

  return (
    <article className="ro-pagina ro-regra">
      <header className="ro-cabeca">
        <p className="ro-sobre al-cond">{preencher(t.regra.versao, { n: n.versao })}</p>
        <h1 className="al-cond">{t.regra.titulo}</h1>
        <p className="ro-chamada">{t.regra.chamada}</p>
      </header>

      <section className="ro-escolha" aria-labelledby="ro-escolha-titulo">
        <div>
          <h2 id="ro-escolha-titulo" className="ro-titulo al-cond">{t.regra.trocar}</h2>
          <p className="ro-cinza">{modo === "roda" ? t.modo.rodaCurta : t.modo.chegadaCurta}. {t.modo.guardada}</p>
        </div>
        <TrocaDeModo t={t} modo={modo} aoMudar={setModo} grande />
      </section>

      <div className="ro-colunas">
        <div className="ro-coluna">
          <section className="ro-bloco" aria-labelledby="ro-roda">
            <h2 id="ro-roda" className="ro-titulo al-cond">{t.regra.emRoda}</h2>
            <p className="ro-texto">{t.regra.emRodaTexto}</p>
            <div className="ro-desenho" role="img" aria-label={`${t.modo.chegadaCurta}. ${t.modo.rodaCurta}.`}>
              <Fileira ordem={CHEGADA} rotulo={t.modo.chegada} />
              <Fileira ordem={EM_RODA} rotulo={t.modo.roda} />
            </div>
            <ol className="ro-passos">
              {t.regra.passos.map((p, i) => (
                <li key={i} className="ro-passo">
                  <span className="ro-passo-n al-cond" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{por(p.titulo)}</h3>
                    <p>{por(p.texto)}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="ro-cinza">{t.regra.repostes}</p>
            <p className="ro-cinza">{t.regra.deFora}</p>
          </section>

          <section className="ro-bloco" id="em-alta" aria-labelledby="ro-r-alta">
            <h2 id="ro-r-alta" className="ro-titulo al-cond">{t.regra.alta}</h2>
            <p className="ro-texto">{por(t.regra.altaTexto)}</p>
          </section>
          <section className="ro-bloco" aria-labelledby="ro-r-fora">
            <h2 id="ro-r-fora" className="ro-titulo al-cond">{t.regra.fora}</h2>
            <p className="ro-texto">{por(t.regra.foraTexto)}</p>
          </section>
          <section className="ro-bloco" aria-labelledby="ro-r-respostas">
            <h2 id="ro-r-respostas" className="ro-titulo al-cond">{t.regra.respostas}</h2>
            <p className="ro-texto">{t.regra.respostasTexto}</p>
          </section>
        </div>

        <div className="ro-coluna ro-coluna-lado">
          <section className="ro-bloco ro-nao" aria-labelledby="ro-nao">
            <h2 id="ro-nao" className="ro-carimbo al-cond">{t.regra.naoEntra}</h2>
            <ul className="ro-riscos">
              {t.regra.naoEntraLista.map((x) => (
                <li key={x}>
                  <Icone nome="fechar" className="h-4 w-4 shrink-0" grosso />
                  {x}
                </li>
              ))}
            </ul>
          </section>
          <section className="ro-bloco ro-sim" aria-labelledby="ro-sim">
            <h2 id="ro-sim" className="ro-titulo al-cond">{t.regra.entra}</h2>
            <ul className="ro-riscos">
              {t.regra.entraLista.map((x) => (
                <li key={x}>
                  <Icone nome="visto" className="h-4 w-4 shrink-0" grosso />
                  {x}
                </li>
              ))}
            </ul>
            <Link href={`/${lang}/alumia/linhas`} className="al-botao al-botao-contorno al-botao-p mt-3">{t.barra.todas}</Link>
          </section>
          <section className="ro-bloco" aria-labelledby="ro-ap">
            <h2 id="ro-ap" className="ro-titulo al-cond">{t.regra.aparelho}</h2>
            <p className="ro-texto">{t.regra.aparelhoTexto}</p>
          </section>
          {/* Onda 11 (11F): o questionário de interesses, o ingrediente escolhido pela pessoa (só no aparelho). */}
          <section className="ro-bloco" id="interesses" aria-labelledby="ro-int">
            <h2 id="ro-int" className="ro-titulo al-cond">{t.interesses.titulo}</h2>
            <p className="ro-texto">{t.interesses.texto}</p>
            <Link href={`/${lang}/alumia/seguranca#sg-ajuste-interesses`} className="al-botao al-botao-contorno al-botao-p mt-3">{t.interesses.ajustar}</Link>
          </section>
          <section className="ro-bloco" aria-labelledby="ro-prova">
            <h2 id="ro-prova" className="ro-titulo al-cond">{t.regra.prova}</h2>
            <p className="ro-texto">{t.regra.provaTexto}</p>
          </section>
        </div>
      </div>

      <p className="ro-volta">
        <Link href={`/${lang}/alumia`} className="al-botao al-botao-claro al-botao-m">
          <Icone nome="voltar" className="h-4 w-4" />
          {t.regra.voltar}
        </Link>
      </p>
    </article>
  );
}
