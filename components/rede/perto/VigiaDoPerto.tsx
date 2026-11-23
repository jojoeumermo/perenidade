// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A vigia do "Perto" (Prompt 4, itens 7 e 8), em TODA tela da Alumia (encaixe colunaDireita, que existe em toda tela; o cartão sai
// num portal para dentro da pele da Alumia):
//   - a volta para casa: quando o prazo vence, o último aviso ("Você chegou?") com 2 min; sem resposta, ESTE aparelho manda o pedido
//     de ajuda ao círculo (uma vez só, mesmo com outra aba aberta: lib/rede/perto/cliente.ts, volta.venceu);
//   - o pedido de ajuda que chegou de alguém do círculo, com o caminho para o Perto.
// Na própria tela do Perto, a vigia não desenha nada (a tela já mostra), mas continua mandando o pedido de ajuda na hora.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "@/components/Link";
import { compartilhar, volta } from "@/lib/rede/perto/cliente";
import { faseDaVolta } from "@/lib/rede/perto/volta";
import { guardaDePosicoes } from "@/lib/rede/perto/guarda";
import type { ContextoDoEncaixe } from "../encaixes";
import { horaNoIdioma, por, tempoCurto, textoDoErro } from "./textos";
import { PedidosDeLocalizacao } from "./Pedidos";
import { useAgora, useCompartilhar, useRecebidas, useVolta } from "./usar";
import { useTextosDoPerto } from "./usarTextos";
import "./perto.css";

const RAIZ = '[data-al="2"]';

export function VigiaDoPerto({ lang, situacao }: ContextoDoEncaixe) {
  const t = useTextosDoPerto(lang);
  const v = useVolta();
  const agora = useAgora(1000);
  const { posicoes, pedidos, nomes } = useRecebidas();
  const estado = useCompartilhar();
  // Só no navegador (o encaixe carrega a vigia sem SSR).
  const [raiz] = useState<Element | null>(() => (typeof document === "undefined" ? null : (document.querySelector(RAIZ) ?? document.body)));
  const [recado, setRecado] = useState("");
  const mandando = useRef(false);
  const naTela = typeof window !== "undefined" && /\/alumia\/perto(\/|$)/.test(window.location.pathname);
  const fase = v ? faseDaVolta(v, agora) : null;

  // Venceu o último aviso: manda o pedido de ajuda (uma vez).
  useEffect(() => {
    if (fase?.fase !== "mandar" || mandando.current || !t) return;
    mandando.current = true;
    volta.venceu().then(
      (r) => r && setRecado(t.volta.saiu),
      (e) => setRecado(textoDoErro(t.erros, e)),
    ).finally(() => {
      mandando.current = false;
    });
  }, [fase?.fase, t]);

  if (!t || !raiz || !situacao.logado || naTela) return null;
  const sos = posicoes.filter((p) => p.sos);
  const ultimo = fase?.fase === "ultimo_aviso" ? fase : null;
  if (!sos.length && !ultimo && !recado && !pedidos.length && !estado.ligado) return null;
  return createPortal(
    <div className="pt-vigia" data-pt-vigia="">
      {estado.ligado && (
        // A faixa fixa enquanto compartilha (item 2): para quem, até quando, e o botão de parar.
        <section className="pt-vigia-cartao pt-faixa" role="status" data-pt-faixa="">
          <p>
            {estado.prazo === "parar"
              ? por(t.compartilhar.faixaParar, { n: estado.conversas.length })
              : por(t.compartilhar.faixa, { n: estado.conversas.length, hora: horaNoIdioma(lang, estado.comecou + estado.prazo * 60_000) })}
          </p>
          <div className="pt-acoes">
            <button type="button" className="al-botao al-botao-primario al-botao-m" onClick={() => void compartilhar.parar()}>{t.compartilhar.parar}</button>
          </div>
        </section>
      )}
      <PedidosDeLocalizacao t={t} />
      {ultimo && (
        <section className="pt-vigia-cartao" role="alertdialog" aria-labelledby="pt-vigia-volta">
          <h2 id="pt-vigia-volta" className="al-cond">{t.volta.ultimoTitulo}</h2>
          <p role="timer">{por(t.volta.ultimo, { tempo: tempoCurto(ultimo.faltaMs) })}</p>
          <div className="pt-acoes">
            <button type="button" className="al-botao al-botao-claro al-botao-m" onClick={() => void volta.cheguei(false)}>{t.volta.cheguei}</button>
            <button type="button" className="al-botao al-botao-contorno al-botao-m" onClick={() => void volta.cheguei(true).catch(() => undefined)}>{t.volta.chegueiEstouBem}</button>
            <button type="button" className="al-botao al-botao-fantasma al-botao-m" onClick={() => volta.mais(15)}>{t.volta.mais}</button>
            <button type="button" className="al-botao al-botao-primario al-botao-m" onClick={() => v && volta.trocar({ ...v, ate: Date.now() - 2 * 60_000 - 1 })}>{t.volta.mandarAgora}</button>
          </div>
        </section>
      )}
      {sos.map((p) => (
        <section key={`${p.origem}|${p.autor}`} className="pt-vigia-cartao" role="alert">
          <h2 className="al-cond">{por(p.volta ? t.recebidas.sosVolta : t.recebidas.sos, { nome: nomes[p.origem] ? `@${nomes[p.origem]}` : t.recebidas.alguem })}</h2>
          <div className="pt-acoes">
            <Link className="al-botao al-botao-primario al-botao-m" href={`/${lang}/alumia/perto`}>{t.naConversa.ver}</Link>
            <button type="button" className="al-botao al-botao-fantasma al-botao-m" onClick={() => guardaDePosicoes.tirar(p.origem, p.autor)}>{t.recebidas.entendi}</button>
          </div>
        </section>
      ))}
      {recado && (
        <section className="pt-vigia-cartao" role="status">
          <p>{recado}</p>
          <button type="button" className="al-botao al-botao-fantasma al-botao-m" onClick={() => setRecado("")}>{t.recebidas.entendi}</button>
        </section>
      )}
    </div>,
    raiz,
  );
}
