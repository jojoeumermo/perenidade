// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useId, useRef, useState, type FormEvent } from "react";
import { Botao } from "../ui/Botao";
import { Icone } from "./partes";
import { frase } from "./usar";
import { useAnuncio, useQuadro } from "./usarQuadro";
import { codigoDoErro } from "@/lib/rede/atos/erros";
import { conferirTarefa } from "@/lib/rede/atos/quadros";
import { atos as cliente } from "@/lib/rede/cliente-atos";
import { preencherAto, type TextosDosAtos } from "@/lib/rede/textos-atos";
import { LIMITES_DO_ATO, type Ato, type QuadroDeTarefas as Quadro, type TarefaDoAto } from "@/lib/rede/tipos-atos";
import "./quadros.css";

/**
 * "Quem leva o quê" (PLANO-ALUMIA §4.2): cada tarefa é um ladrilho que vira dourado quando já tem quem leve. O público vê só o item,
 * quantas pessoas a organização pediu e se falta gente; o codinome de quem assumiu aparece SÓ para quem organiza (o servidor nem
 * manda para os outros; lib/rede/atos/quadros.ts confere de novo). Quem assume vê só que ela mesma leva.
 */
export function QuadroDeTarefas({ ato, t, logado }: { ato: Ato; t: TextosDosAtos; logado: boolean }) {
  const carregar = useCallback(() => cliente.tarefas(ato.id), [ato.id]);
  const { estado, trocar } = useQuadro<Quadro>(carregar, ato.id);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [anuncio, anunciar] = useAnuncio();
  const idTitulo = useId();
  const fechado = ato.situacao === "cancelado";

  if (estado.fase === "desligado") return null;
  const q = estado.fase === "pronto" ? estado.dados : null;
  // Sem tarefa e sem poder pôr: o quadro nem aparece (nada só de enfeite).
  if (q && q.tarefas.length === 0 && !q.organiza) return null;

  const assumir = async (tarefa: TarefaDoAto) => {
    if (ocupado) return;
    setOcupado(tarefa.id);
    setErro(null);
    try {
      const novo = await cliente.tarefaAssumir(tarefa.id, !tarefa.eu);
      trocar(novo);
      anunciar(preencherAto(tarefa.eu ? t.tarefas.desfeito : t.tarefas.assumido, { item: tarefa.item }));
    } catch (e) {
      setErro(frase(t, e));
    } finally {
      setOcupado(null);
    }
  };
  const apagar = async (tarefa: TarefaDoAto) => {
    if (ocupado) return;
    setOcupado(tarefa.id);
    setErro(null);
    try {
      trocar(await cliente.tarefaApagar(tarefa.id));
      anunciar(t.tarefas.tirado);
    } catch (e) {
      setErro(frase(t, e));
    } finally {
      setOcupado(null);
    }
  };

  return (
    <section className="al-q al-q-tarefas" aria-labelledby={idTitulo} aria-busy={estado.fase === "carregando" || undefined}>
      <header className="al-q-cabeca">
        <h2 id={idTitulo} className="al-cond al-q-titulo">
          {t.tarefas.titulo}
        </h2>
        <p className="al-q-explica">{t.tarefas.explica}</p>
      </header>
      {estado.fase === "carregando" ? <p className="al-q-ajuda">{t.tela.carregando}</p> : null}
      {estado.fase === "erro" ? (
        <p className="al-q-ajuda" role="alert">
          {codigoDoErro(estado.erro) === "generico" ? t.tela.erro : frase(t, estado.erro)}
        </p>
      ) : null}
      {q ? (
        q.tarefas.length === 0 ? (
          <p className="al-q-ajuda">{q.organiza ? t.tarefas.vazioOrg : t.tarefas.vazio}</p>
        ) : (
          <ul className="al-q-ladrilhos" role="list">
            {q.tarefas.map((tarefa, i) => {
              const estadoTexto = tarefa.completa ? t.tarefas.completa : t.tarefas.falta;
              const pedido = tarefa.quantos === 1 ? t.tarefas.pedidoUm : preencherAto(t.tarefas.pedido, { n: tarefa.quantos });
              const bloqueado = fechado || !logado || (tarefa.completa && !tarefa.eu);
              return (
                <li key={tarefa.id} className="al-q-ladrilho" data-completa={tarefa.completa ? "sim" : undefined} data-eu={tarefa.eu ? "sim" : undefined} style={{ ["--al-q-i" as string]: i }}>
                  <span className="al-q-selo" aria-hidden>
                    {tarefa.completa || tarefa.eu ? Icone.visto(20) : null}
                  </span>
                  <div className="al-q-corpo">
                    <p className="al-q-item">{tarefa.item}</p>
                    <p className="al-q-linha">
                      <span>{pedido}</span>
                      <span aria-hidden> · </span>
                      <span className="al-q-estado">{estadoTexto}</span>
                    </p>
                    {q.organiza ? (
                      <p className="al-q-org">
                        {preencherAto(t.tarefas.assumidas, { a: tarefa.assumidas ?? 0, q: tarefa.quantos })}
                        {" · "}
                        {tarefa.quem && tarefa.quem.length ? preencherAto(t.tarefas.quem, { nomes: tarefa.quem.join(", ") }) : t.tarefas.ninguem}
                      </p>
                    ) : null}
                  </div>
                  <div className="al-q-botoes">
                    <Botao
                      tamanho="p"
                      variante={tarefa.eu ? "dourado" : "contorno"}
                      pressionado={tarefa.eu}
                      disabled={bloqueado || ocupado === tarefa.id}
                      aria-busy={ocupado === tarefa.id || undefined}
                      aria-label={`${tarefa.eu ? t.tarefas.euLevo : t.tarefas.eu}: ${tarefa.item}`}
                      title={!logado ? t.tarefas.entrar : undefined}
                      onClick={() => void assumir(tarefa)}
                    >
                      {tarefa.eu ? t.tarefas.euLevo : t.tarefas.eu}
                    </Botao>
                    {q.organiza ? (
                      <button type="button" className="al-q-tirar" aria-label={preencherAto(t.tarefas.tirar, { item: tarefa.item })} disabled={ocupado === tarefa.id} onClick={() => void apagar(tarefa)}>
                        <span aria-hidden>×</span>
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : null}
      {!logado && q && q.tarefas.length ? <p className="al-q-ajuda">{t.tarefas.entrar}</p> : null}
      {q?.organiza && !fechado ? (
        <NovaTarefa
          t={t}
          aoPor={async (item, quantos) => {
            const novo = await cliente.tarefaCriar(ato.id, item, quantos);
            trocar(novo);
            anunciar(t.tarefas.posto);
          }}
        />
      ) : null}
      {erro ? (
        <p role="alert" className="al-ato-erro">
          {erro}
        </p>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {anuncio}
      </p>
    </section>
  );
}

/** O formulário de quem organiza: o item e quantas pessoas. Confere com os limites do banco antes de mandar. */
function NovaTarefa({ t, aoPor }: { t: TextosDosAtos; aoPor: (item: string, quantos: number) => Promise<void> }) {
  const [item, setItem] = useState("");
  const [quantos, setQuantos] = useState(1);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);
  const id = useId();
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const p = conferirTarefa(item, quantos);
    if (p.item || p.quantos) {
      setErro(p.item === "dado_pessoal" ? t.erros.dado_pessoal : p.quantos ? t.formulario.problemas.numero : t.formulario.problemas[p.item === "longo" ? "longo" : p.item === "curto" ? "curto" : "vazio"]);
      campo.current?.focus();
      return;
    }
    setOcupado(true);
    setErro(null);
    try {
      await aoPor(item.replace(/\s+/g, " ").trim(), quantos);
      setItem("");
      setQuantos(1);
      campo.current?.focus();
    } catch (e) {
      setErro(frase(t, e));
    } finally {
      setOcupado(false);
    }
  };
  return (
    <form className="al-q-form al-q-form-linha" onSubmit={(e) => void enviar(e)} noValidate>
      <label className="al-q-campo al-q-campo-largo">
        <span>{t.tarefas.item}</span>
        <input
          ref={campo}
          className="al-ato-form-campo"
          value={item}
          onChange={(e) => {
            setItem(e.target.value);
            if (erro) setErro(null);
          }}
          placeholder={t.tarefas.itemExemplo}
          maxLength={LIMITES_DO_ATO.tarefaMax}
          autoComplete="off"
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? `${id}-erro` : undefined}
        />
      </label>
      <label className="al-q-campo al-q-campo-numero">
        <span>{t.tarefas.quantos}</span>
        <input className="al-ato-form-campo" type="number" inputMode="numeric" min={1} max={LIMITES_DO_ATO.tarefaQuantosMax} value={quantos} onChange={(e) => setQuantos(Math.trunc(Number(e.target.value) || 0))} />
      </label>
      <Botao type="submit" variante="primario" disabled={ocupado} aria-busy={ocupado || undefined}>
        {t.tarefas.por}
      </Botao>
      {erro ? (
        <p id={`${id}-erro`} role="alert" className="al-ato-erro al-q-form-erro">
          {erro}
        </p>
      ) : null}
    </form>
  );
}
