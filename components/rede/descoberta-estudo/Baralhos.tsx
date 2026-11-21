// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Item 70: baralhos de revisão (repetição espaçada), o mesmo baralho do site (lib/estudo.ts), só neste aparelho. Mostra a frente,
// a pessoa tenta lembrar, vê o verso e diz como foi: "errei" volta para hoje, "fácil" afasta mais. Sem placar e sem sequência.
import { useEffect, useId, useState } from "react";
import { apagarCartao, guardarCartoes, lerCartoes, responderCartao, type CartaoDeRevisao, type Nota } from "@/lib/estudo";
import { baralhos, filaDeHoje } from "@/lib/rede/descoberta-estudo/baralhos";
import { Botao } from "../ui/Botao";
import { Bloco, Mensagem, por, type PropsDaParte } from "./comum";

const NOTAS: readonly Nota[] = ["errei", "dificil", "bom", "facil"];

export default function Baralhos({ t }: PropsDaParte) {
  const ids = { baralho: useId(), frente: useId(), verso: useId(), qual: useId() };
  const k = t.baralhos;
  const [lista, setLista] = useState<CartaoDeRevisao[] | null>(null);
  const [qual, setQual] = useState<string>("");
  const [virado, setVirado] = useState(false);
  const [novo, setNovo] = useState({ baralho: "", frente: "", verso: "" });
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);
  useEffect(() => {
    const ler = () => setLista(lerCartoes());
    const x = window.setTimeout(ler, 0);
    window.addEventListener("lucia:estudo", ler);
    return () => {
      window.clearTimeout(x);
      window.removeEventListener("lucia:estudo", ler);
    };
  }, []);
  if (!lista) return <p role="status" className="de-miudo">{t.carregando}</p>;
  const grupos = baralhos(lista);
  const fila = filaDeHoje(lista, qual || null);
  const atual = fila[0] ?? null;
  const responder = (n: Nota) => {
    if (!atual) return;
    responderCartao(atual.id, n);
    setVirado(false);
    setLista(lerCartoes());
  };
  const guardar = () => {
    const entrou = guardarCartoes([{ frente: novo.frente, verso: novo.verso, origem: novo.baralho.trim() || k.semNome }]);
    setMensagem(entrou ? { texto: k.guardado, erro: false } : { texto: k.naoEntrou, erro: true });
    if (entrou) setNovo({ ...novo, frente: "", verso: "" });
    setLista(lerCartoes());
  };
  return (
    <div className="de-colunas">
      <Bloco titulo={k.titulo} ajuda={k.ajuda}>
        <label className="de-campo de-campo-comunidade" htmlFor={ids.qual}>
          <span>{k.qual}</span>
          <select id={ids.qual} className="al2-campo" value={qual} onChange={(e) => { setQual(e.target.value); setVirado(false); }}>
            <option value="">{k.todos}</option>
            {grupos.map((b) => <option key={b.nome} value={b.nome}>{por(k.baralhoComHoje, { nome: b.nome, hoje: b.hoje, total: b.total })}</option>)}
          </select>
        </label>
        {!atual ? (
          <p className="de-texto" role="status">{lista.length ? k.emDia : k.vazio}</p>
        ) : (
          <section className="de-cartao" aria-live="polite">
            <p className="de-miudo">{por(k.faltam, { n: fila.length })}</p>
            <p className="de-frente">{atual.frente}</p>
            {virado ? (
              <>
                <p className="de-verso">{atual.verso}</p>
                <div className="de-acoes" role="group" aria-label={k.comoFoi}>
                  {NOTAS.map((n) => <Botao key={n} variante={n === "errei" ? "contorno" : "claro"} onClick={() => responder(n)}>{k.notas[n]}</Botao>)}
                </div>
              </>
            ) : (
              <Botao onClick={() => setVirado(true)}>{k.virar}</Botao>
            )}
            <Botao variante="fantasma" onClick={() => { apagarCartao(atual.id); setVirado(false); setLista(lerCartoes()); }}>{k.apagar}</Botao>
          </section>
        )}
        <p className="de-miudo">{k.mesmoDoSite}</p>
      </Bloco>
      <div className="de-form">
        <h3 className="de-form-titulo">{k.novoTitulo}</h3>
        <label className="de-campo" htmlFor={ids.baralho}>
          <span>{k.baralho}</span>
          <input id={ids.baralho} className="al2-campo" list={`${ids.baralho}-lista`} value={novo.baralho} maxLength={120} onChange={(e) => setNovo({ ...novo, baralho: e.target.value })} />
          <datalist id={`${ids.baralho}-lista`}>{grupos.map((b) => <option key={b.nome} value={b.nome} />)}</datalist>
        </label>
        <label className="de-campo" htmlFor={ids.frente}>
          <span>{k.frente}</span>
          <textarea id={ids.frente} className="al2-campo" value={novo.frente} maxLength={500} onChange={(e) => setNovo({ ...novo, frente: e.target.value })} />
        </label>
        <label className="de-campo" htmlFor={ids.verso}>
          <span>{k.verso}</span>
          <textarea id={ids.verso} className="al2-campo" value={novo.verso} maxLength={2000} onChange={(e) => setNovo({ ...novo, verso: e.target.value })} />
        </label>
        <Botao disabled={!novo.frente.trim() || !novo.verso.trim()} onClick={guardar}>{k.guardar}</Botao>
        <Mensagem mensagem={mensagem} />
        <p className="de-miudo">{k.aparelho}</p>
      </div>
    </div>
  );
}
