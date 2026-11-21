// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os pedidos de localização que chegaram (Prompt 4, item 2: "ninguém é localizado em silêncio"). Aceitar começa a compartilhar com
// quem pediu (1 h, só o bairro) ou a inclui no compartilhamento em curso; recusar só tira o pedido da tela e não avisa ninguém. Os
// pedidos ficam só na memória da aba (lib/rede/perto/guarda.ts) e somem em 15 min.
import { compartilhar } from "@/lib/rede/perto/cliente";
import { guardaDePosicoes } from "@/lib/rede/perto/guarda";
import { useAcao } from "./acao";
import { por, type TextosDoPerto } from "./textos";
import { useRecebidas } from "./usar";

type T = TextosDoPerto;

export function PedidosDeLocalizacao({ t, aoAceitar }: { t: T; aoAceitar?: () => void }) {
  const { pedidos, nomes } = useRecebidas();
  const { ocupado, fazer, avisos } = useAcao(t);
  if (!pedidos.length) return avisos;
  return (
    <div className="pt-pedidos" data-pt-pedidos="">
      {pedidos.map((p) => (
        <section key={`${p.origem}|${p.autor}`} className="pt-vigia-cartao" role="alert">
          <h2 className="al-cond">{por(t.pedido.chegou, { nome: nomes[p.origem] ? `@${nomes[p.origem]}` : t.recebidas.alguem })}</h2>
          <div className="pt-acoes">
            <button
              type="button"
              className="al-botao al-botao-claro al-botao-m"
              disabled={ocupado}
              onClick={() =>
                void fazer(async () => {
                  await compartilhar.incluir(p.origem.slice(2));
                  guardaDePosicoes.tirarPedido(p.origem, p.autor);
                  aoAceitar?.();
                  return t.pedido.aceito;
                })
              }
            >
              {t.pedido.aceitar}
            </button>
            <button type="button" className="al-botao al-botao-fantasma al-botao-m" disabled={ocupado} onClick={() => guardaDePosicoes.tirarPedido(p.origem, p.autor)}>
              {t.pedido.recusar}
            </button>
          </div>
          <p className="pt-nota">{t.pedido.recusarNota}</p>
        </section>
      ))}
      {avisos}
    </div>
  );
}
