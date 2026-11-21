// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Item 45: assuntos em movimento. Só #temas (nunca pessoas nem posts), cada um com a faixa de comunidades onde aparece, e o "como
// contamos isso?" com a regra que o banco devolve (supabase/migracoes/20261127-p4-descoberta-estudo.sql, public.rede_p4_de_assuntos).
import Link from "@/components/Link";
import { de } from "@/lib/rede/descoberta-estudo/cliente";
import { Botao } from "../ui/Botao";
import { EstadoDaAlumia } from "../ui/Estado";
import { Bloco, fraseDoErro, por, useLeitura, type PropsDaParte } from "./comum";

export default function Assuntos({ t, lang }: PropsDaParte) {
  const leitura = useLeitura("assuntos", () => de.assuntos());
  const a = t.assuntos;
  return (
    <Bloco titulo={a.titulo} ajuda={a.ajuda}>
      {leitura.erro ? (
        <EstadoDaAlumia erro texto={fraseDoErro(t, leitura.erro)}>
          <Botao variante="contorno" onClick={leitura.recarregar}>{t.tentar}</Botao>
        </EstadoDaAlumia>
      ) : !leitura.dado ? (
        <p role="status" className="de-miudo">{t.carregando}</p>
      ) : leitura.dado.temas.length === 0 ? (
        <p className="de-miudo">{a.vazio}</p>
      ) : (
        <ul className="de-lista de-temas">
          {leitura.dado.temas.map((x) => (
            <li key={x.tag}>
              <Link href={`/${lang}/alumia/tag/${x.tag}`} className="de-tema">
                <strong>#{x.tag}</strong>
                <span className="de-miudo">{a.faixa[x.faixa]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {leitura.dado && (
        <details className="de-privacidade">
          <summary>{a.como}</summary>
          <p>{por(a.regra, { ...leitura.dado.regra })}</p>
        </details>
      )}
    </Bloco>
  );
}
