// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Item 73: a trilha de segurança digital em microlições (lib/rede/descoberta-estudo/microlicoes.ts), ligadas às aulas da trilha
// "Autodefesa digital" do site. Uma por vez: três pontos, uma pergunta e o link para a aula inteira. O que já foi feito fica no aparelho.
import { useEffect, useState } from "react";
import Link from "@/components/Link";
import { enderecoDaAula, feitas, marcarFeita, MICROLICOES } from "@/lib/rede/descoberta-estudo/microlicoes";
import { Botao } from "../ui/Botao";
import { Bloco, por, type PropsDaParte } from "./comum";
import { TextoComGlossario } from "./Glossario";

export default function Microlicoes({ t, lang }: PropsDaParte) {
  const k = t.microlicoes;
  const [prontas, setProntas] = useState<string[] | null>(null);
  const [i, setI] = useState(0);
  const [resposta, setResposta] = useState<number | null>(null);
  useEffect(() => {
    const x = window.setTimeout(() => {
      const f = feitas();
      setProntas(f);
      const primeira = MICROLICOES.findIndex((m) => !f.includes(m.aula));
      setI(primeira < 0 ? 0 : primeira);
    }, 0);
    return () => window.clearTimeout(x);
  }, []);
  if (!prontas) return <p role="status" className="de-miudo">{t.carregando}</p>;
  const m = MICROLICOES[i];
  const ir = (n: number) => {
    setI((n + MICROLICOES.length) % MICROLICOES.length);
    setResposta(null);
  };
  return (
    <Bloco titulo={k.titulo} ajuda={k.ajuda}>
      <p className="de-miudo">{por(k.progresso, { feitas: prontas.length, total: MICROLICOES.length })}</p>
      <article className="de-cartao" aria-labelledby="de-micro-titulo">
        <p className="de-etiqueta">{por(k.numero, { n: i + 1, total: MICROLICOES.length })}{prontas.includes(m.aula) ? ` · ${k.feita}` : ""}</p>
        <h3 id="de-micro-titulo" className="de-frente">{m.titulo}</h3>
        <ul className="de-pontos">{m.pontos.map((p) => <li key={p}><TextoComGlossario texto={p} lang={lang} verMais={t.glossario.verMais} /></li>)}</ul>
        <fieldset className="de-pergunta">
          <legend>{m.pergunta.texto}</legend>
          {m.pergunta.opcoes.map((o, j) => (
            <label key={o} className="de-marca">
              <input type="radio" name={`de-micro-${m.aula}`} checked={resposta === j} onChange={() => {
                setResposta(j);
                if (j === m.pergunta.certa) setProntas(marcarFeita(m.aula, true));
              }} />
              <span>{o}</span>
            </label>
          ))}
        </fieldset>
        {resposta !== null && (
          <p role="status" className={resposta === m.pergunta.certa ? "de-ok" : "de-erro"}>
            {resposta === m.pergunta.certa ? k.certo : k.quaseLa} {m.pergunta.porque}
          </p>
        )}
        <div className="de-acoes">
          <Botao variante="contorno" onClick={() => ir(i - 1)}>{k.anterior}</Botao>
          <Botao onClick={() => ir(i + 1)}>{k.proxima}</Botao>
          <Link href={enderecoDaAula(lang, m.aula)} className="al-botao al-botao-claro al-botao-m">{k.aula}</Link>
        </div>
      </article>
      <p className="de-miudo">{k.aparelho}</p>
    </Bloco>
  );
}
