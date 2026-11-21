// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A cultura da Alumia (/alumia/cultura), Prompt 4, itens 38 a 42: obra seriada, mural de arte, cineclube, clube de leitura e
// playlist coletiva, cada uma numa aba. O cineclube, a estante e a playlist são de uma comunidade (a pessoa escolhe entre as dela);
// as obras e o mural são de cada pessoa, sob o codinome. Tudo fala só com o banco (lib/rede/cultura/cliente.ts) e, na playlist, com
// a prévia do nosso servidor; nada fica guardado no aparelho e nenhum serviço de fora é chamado pelo navegador.
import "./cultura.css";
import { useId, useState, type ComponentType, type KeyboardEvent } from "react";
import { cultura } from "@/lib/rede/cultura/cliente";
import { FaixaDaPrevia, useTextosAlumia3 } from "../conversa/base3";
import type { PropsDaTelaDoPacote } from "../registro";
import { Botao } from "../ui/Botao";
import { EstadoDaAlumia } from "../ui/Estado";
import { Faixa } from "../ui/Faixa";
import { fraseDoErro, useLeitura, useTextosDaCultura, type PropsDaParte, type T } from "./comum";
import Cine from "./Cine";
import Leitura from "./Leitura";
import Mural from "./Mural";
import Obras from "./Obras";
import Playlist from "./Playlist";

type Aba = keyof Omit<T["abas"], "rotulo">;

/** As abas na ordem da tela; "comunidade" diz se a parte vive dentro de uma comunidade. */
const ABAS: readonly { chave: Aba; Parte: ComponentType<PropsDaParte>; comunidade: boolean }[] = [
  { chave: "obras", Parte: Obras, comunidade: false },
  { chave: "mural", Parte: Mural, comunidade: false },
  { chave: "cine", Parte: Cine, comunidade: true },
  { chave: "leitura", Parte: Leitura, comunidade: true },
  { chave: "playlist", Parte: Playlist, comunidade: true },
];

export default function TelaDaCultura({ lang }: PropsDaTelaDoPacote) {
  const t = useTextosDaCultura(lang);
  const t3 = useTextosAlumia3(lang);
  const id = useId();
  const [aba, setAba] = useState<Aba>("obras");
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const inicio = useLeitura("inicio", () => cultura.inicio());

  if (!t) return <p role="status" className="cu-pagina cu-miudo">…</p>;

  const comunidades = inicio.dado?.comunidades ?? [];
  const comunidade = escolhida && comunidades.some((k) => k.slug === escolhida) ? escolhida : (comunidades[0]?.slug ?? null);
  const atual = ABAS.find((a) => a.chave === aba) ?? ABAS[0];
  const Parte = atual.Parte;

  // As setas andam entre as abas (o padrão de abas do WAI-ARIA).
  const teclas = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = ABAS.findIndex((a) => a.chave === aba);
    const passo = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!passo) return;
    e.preventDefault();
    const proxima = ABAS[(i + passo + ABAS.length) % ABAS.length].chave;
    setAba(proxima);
    document.getElementById(`${id}-aba-${proxima}`)?.focus();
  };

  return (
    <article className="cu-pagina" aria-labelledby={`${id}-titulo`}>
      {t3 && <FaixaDaPrevia t={t3} />}
      <header className="cu-cabeca">
        <Faixa className="cu-faixa" />
        <p className="cu-carimbo al-cond">{t.carimbo}</p>
        <h1 id={`${id}-titulo`} className="cu-titulo al-cond">{t.titulo}</h1>
        <p className="cu-chamada">{t.chamada}</p>
      </header>

      <details className="cu-privacidade">
        <summary>{t.privacidade.titulo}</summary>
        <p>{t.privacidade.semLista}</p>
        <p>{t.privacidade.semNumero}</p>
        <p>{t.privacidade.naoCifrado}</p>
      </details>

      <div className="cu-abas" role="tablist" aria-label={t.abas.rotulo} onKeyDown={teclas}>
        {ABAS.map((a) => (
          <button
            key={a.chave}
            id={`${id}-aba-${a.chave}`}
            type="button"
            role="tab"
            className="cu-aba"
            aria-selected={a.chave === aba}
            aria-controls={`${id}-painel`}
            tabIndex={a.chave === aba ? 0 : -1}
            onClick={() => setAba(a.chave)}
          >
            {t.abas[a.chave]}
          </button>
        ))}
      </div>

      <section id={`${id}-painel`} role="tabpanel" className="cu-painel" aria-labelledby={`${id}-aba-${atual.chave}`}>
        {atual.comunidade && (
          inicio.erro ? (
            <EstadoDaAlumia erro texto={fraseDoErro(t, inicio.erro)}>
              <Botao variante="contorno" onClick={inicio.recarregar}>{t.tentar}</Botao>
            </EstadoDaAlumia>
          ) : !inicio.dado ? (
            <p role="status" className="cu-miudo">{t.carregando}</p>
          ) : !comunidade ? (
            <p className="cu-miudo">{t.comunidade.nenhuma}</p>
          ) : (
            <label className="cu-campo cu-campo-comunidade">
              <span>{t.comunidade.rotulo}</span>
              <select className="al2-campo" value={comunidade} onChange={(e) => setEscolhida(e.target.value)}>
                {comunidades.map((k) => <option key={k.slug} value={k.slug}>{k.nome}</option>)}
              </select>
            </label>
          )
        )}
        {(!atual.comunidade || comunidade) && <Parte key={`${atual.chave}:${comunidade ?? ""}`} t={t} lang={lang} comunidade={atual.comunidade ? comunidade : null} />}
      </section>
    </article>
  );
}
