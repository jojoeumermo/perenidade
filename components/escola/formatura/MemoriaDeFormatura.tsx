// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { copiarTexto } from "@/components/escola/formatura/usar-formatura";
import { useInscricoes } from "@/components/escola/guardado-escola";
import Link from "@/components/Link";
import type { TextosDaFormatura } from "@/i18n/escola/formatura";
import { apelidoTemCaraDeDado, type GrupoDaMemoria, MAX_APELIDO_DA_MEMORIA, MAX_FRASE_DA_MEMORIA, textoDoPedidoDeMemoria } from "@/lib/escola/formatura";

/**
 * A memória de formatura: lista curada pela coordenação (só apelido e frase curta, com opt-in e maior de 18 anos) e, para
 * quem já se formou neste aparelho, o texto do pedido para aparecer nela. Nada é enviado sozinho: a pessoa copia o texto
 * e manda por /contribuir. Cursos sensíveis (opinião política) não entram.
 */
export function MemoriaDeFormatura({
  s,
  c,
  grupos,
  listaValida,
  cursos,
  contribuirHref,
}: {
  s: TextosDaFormatura["memoria"];
  c: TextosDaFormatura["comum"];
  grupos: GrupoDaMemoria[];
  listaValida: boolean;
  cursos: { slug: string; titulo: string; sensivel: boolean }[];
  contribuirHref: string;
}) {
  const inscricoes = useInscricoes();
  const [apelido, setApelido] = useState("");
  const [frase, setFrase] = useState("");
  const [maior, setMaior] = useState(false);
  const [escolhido, setEscolhido] = useState("");
  const [copiado, setCopiado] = useState<boolean | null>(null);
  const titulos = new Map(cursos.map((x) => [x.slug, x.titulo]));

  const formadas = inscricoes.flatMap((i) => {
    const curso = cursos.find((x) => x.slug === i.curso);
    return i.formadoEm && curso && !curso.sensivel ? [{ i, curso }] : [];
  });
  const atual = formadas.find((x) => x.curso.slug === escolhido) ?? formadas[0];
  const apelidoRuim = apelido.trim() !== "" && apelidoTemCaraDeDado(apelido);
  const pedido = atual && apelido.trim() && !apelidoRuim && maior ? textoDoPedidoDeMemoria({ curso: atual.curso.titulo, semestre: atual.i.semestre, apelido, frase }) : null;

  return (
    <div className="formatura-pilha" data-memoria="">
      <p className="formatura-aviso">
        {s.aviso} {c.revisar}
      </p>

      <section aria-labelledby="memoria-lista">
        <h2 id="memoria-lista" className="formatura-h2">
          {s.listaTitulo}
        </h2>
        {!listaValida ? (
          <p className="formatura-fraco" data-memoria-em-revisao="">
            {s.listaEmRevisao}
          </p>
        ) : grupos.length === 0 ? (
          <div className="formatura-cartao" data-memoria-vazia="">
            <p>{s.vazia}</p>
          </div>
        ) : (
          grupos.map((g) => (
            <div key={g.semestre} className="formatura-cartao">
              <h3 className="formatura-h3">{g.semestre}</h3>
              <ul className="formatura-lista">
                {g.itens.map((i) => (
                  <li key={`${i.curso}-${i.apelido}`}>
                    <strong>{i.apelido}</strong> · {titulos.get(i.curso) ?? i.curso}
                    {i.frase ? <em> — “{i.frase}”</em> : null}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
        <p className="formatura-fraco">{s.retirada}</p>
      </section>

      <section className="formatura-cartao formatura-form" aria-labelledby="memoria-pedido">
        <h2 id="memoria-pedido" className="formatura-h2">
          {s.pedidoTitulo}
        </h2>
        {!atual ? (
          <p>{s.semFormatura}</p>
        ) : (
          <>
            <p>{s.pedidoLead}</p>
            {formadas.length > 1 ? (
              <label>
                <span>{s.escolhaOCurso}</span>
                <select value={atual.curso.slug} onChange={(e) => setEscolhido(e.target.value)}>
                  {formadas.map((x) => (
                    <option key={x.curso.slug} value={x.curso.slug}>
                      {x.curso.titulo}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label>
              <span>{s.apelido}</span>
              <input type="text" value={apelido} maxLength={MAX_APELIDO_DA_MEMORIA} onChange={(e) => setApelido(e.target.value)} autoComplete="off" />
            </label>
            {apelidoRuim ? (
              <p role="alert" className="formatura-erro">
                {s.apelidoNaoServe}
              </p>
            ) : null}
            <label>
              <span>{s.frase}</span>
              <input type="text" value={frase} maxLength={MAX_FRASE_DA_MEMORIA} onChange={(e) => setFrase(e.target.value)} />
            </label>
            <label className="formatura-marca">
              <input type="checkbox" checked={maior} onChange={(e) => setMaior(e.target.checked)} />
              <span>{s.maiorDeIdade}</span>
            </label>
            <p className="formatura-fraco">{s.menores}</p>
            {pedido ? (
              <>
                <pre className="formatura-bloco" data-pedido="">
                  {pedido}
                </pre>
                <div className="formatura-barra">
                  <button type="button" className="formatura-botao" onClick={async () => setCopiado(await copiarTexto(pedido))}>
                    {s.copiarPedido}
                  </button>
                  <Link href={contribuirHref} className="formatura-link">
                    {s.abrirContribuir}
                  </Link>
                </div>
                {copiado !== null ? (
                  <p role="status" className="formatura-fraco">
                    {copiado ? s.copiado : s.naoCopiou}
                  </p>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
