// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { BadgeCheck, X } from "lucide-react";
import { useState } from "react";
import type { PedidoNaFila } from "@/lib/rede/tipos-org";
import { Aviso, dataHora, useAcao, useLista } from "./comum";
import { MoldeFila } from "./moldes";
import { Area, Botao, Cartao, Faixa, ItemDeLista, Lista, perguntar, Selo, type TomDoSelo, Vazio } from "./ui";

const SITUACAO: Record<PedidoNaFila["situacao"], string> = { esperando: "Aguardando decisão", aceito: "Selo dado", recusado: "Não aceito" };
const TOM: Record<PedidoNaFila["situacao"], TomDoSelo> = { esperando: "bordo", aceito: "ok", recusado: "neutro" };
const TIPO: Record<PedidoNaFila["tipo"], string> = {
  partido: "Partido", mandato: "Mandato", sindicato: "Sindicato", movimento: "Movimento", coletivo: "Coletivo", gremio: "Grêmio", dce: "DCE", outro: "Outra",
};

/**
 * "Alumia: selo das organizações" (PLANO-ALUMIA §4.3 e §8 F4): a fila dos pedidos do selo. Cada pedido mostra a organização (codinome
 * e @), o tipo, a cidade e o documento PÚBLICO a conferir (CNPJ, registro do partido, diploma, ata); nunca quem pediu nem quem
 * cuida da conta (o vínculo fica só no banco, LGPD art. 11). O selo diz só que a conta é de quem diz ser; não é apoio do
 * Instituto. Dar o selo avisa quem cuida da conta; recusar pede o motivo (ao menos 10 letras). O banco confere o papel de
 * coordenação de novo em cada função (rede_org_selo_fila, rede_org_selo_decidir).
 */
export function RedeOrganizacoes() {
  const lista = useLista<PedidoNaFila[]>("rede_org_selo_fila");
  const acao = useAcao(lista.recarregar);
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const itens = lista.dados ?? [];
  const esperando = itens.filter((p) => p.situacao === "esperando");
  const decididos = itens.filter((p) => p.situacao !== "esperando");

  const dar = (p: PedidoNaFila) => acao.agir("rede_org_selo_decidir", { p_id: p.id, p_aceitar: true, p_motivo: "" }, "Selo dado: quem cuida da conta recebe o aviso.");
  const recusar = (p: PedidoNaFila, motivo: string) => acao.agir("rede_org_selo_decidir", { p_id: p.id, p_aceitar: false, p_motivo: motivo.trim() }, "Recusado: quem cuida da conta recebe o motivo.");
  const recusarPelaPaleta = async (p: PedidoNaFila) => {
    let motivo = (motivos[p.id] ?? "").trim();
    if (motivo.length < 10) motivo = ((await perguntar({ titulo: "Recusar", rotulo: "Motivo da recusa (obrigatório, ao menos 10 letras)", valorInicial: motivo, multilinha: true, obrigatorio: true })) ?? "").trim();
    if (motivo.length >= 10) await recusar(p, motivo);
  };

  return (
    <div className="pn-tela">
      <p className="pn-sobre">
        Organizações pedem o selo da Alumia mandando um documento público (CNPJ, registro do partido, diploma do mandato ou ata). Confira o documento na fonte oficial antes de decidir. O selo diz só que a conta é de quem diz ser: não é apoio do Instituto e
        não dá alcance a mais. Quem pediu e quem cuida da conta não aparecem aqui.
      </p>
      {lista.erro && (
        <Faixa tom="erro" acao={<Botao pequeno onClick={lista.recarregar}>Tentar de novo</Botao>}>
          {lista.erro}
        </Faixa>
      )}
      <Aviso texto={acao.aviso} />
      <MoldeFila<PedidoNaFila>
        id="rede-organizacoes"
        rotulo="Pedidos do selo"
        itens={esperando}
        carregando={!lista.dados && !lista.erro}
        chave={(p) => p.id}
        vazio={<Vazio titulo="Nenhum pedido do selo esperando." />}
        linha={(p) => (
          <>
            <span className="pn-rotulo-mono">
              {dataHora(p.criadoEm)} · {TIPO[p.tipo]} · {p.cidade}
            </span>
            <strong>
              {p.codinome} (@{p.handle})
            </strong>
          </>
        )}
        comandos={(p) => [
          { id: "dar", nome: "Dar o selo", simbolo: BadgeCheck, fazer: () => void dar(p) },
          { id: "recusar", nome: "Recusar com motivo", simbolo: X, fazer: () => recusarPelaPaleta(p) },
        ]}
        detalhe={(p) => (
          <article className="pn-secao">
            <p className="pn-rotulo-mono">
              {dataHora(p.criadoEm)} · {TIPO[p.tipo]} · {p.cidade} · @{p.handle}
            </p>
            <h2 className="pn-cartao-titulo">{p.codinome}</h2>
            <p className="whitespace-pre-line">{p.sobre}</p>
            <p className="pn-rotulo-mono">Documento a conferir</p>
            <p>
              {p.documentoTipo}: <span className="break-all">{p.documento}</span>
            </p>
            <p className="pn-ajuda">Quem cuida da conta declarou ter 18 anos ou mais. Documento de pessoa (CPF, RG) é recusado antes de chegar aqui.</p>
            <Area rotulo="Motivo da recusa (obrigatório, ao menos 10 letras)" value={motivos[p.id] ?? ""} onChange={(e) => setMotivos((m) => ({ ...m, [p.id]: e.target.value }))} rows={2} maxLength={500} />
            <div className="flex flex-wrap gap-2">
              <Botao variante="principal" simbolo={BadgeCheck} disabled={acao.ocupado} onClick={() => void dar(p)}>
                Dar o selo
              </Botao>
              <Botao simbolo={X} disabled={acao.ocupado || (motivos[p.id] ?? "").trim().length < 10} onClick={() => void recusar(p, motivos[p.id] ?? "")}>
                Recusar
              </Botao>
            </div>
          </article>
        )}
      />
      {decididos.length > 0 && (
        <Cartao titulo="Decididos nos últimos 60 dias">
          <Lista rotulo="Decididos nos últimos 60 dias" plana>
            {decididos.map((p) => (
              <ItemDeLista
                key={p.id}
                titulo={`${p.codinome} (@${p.handle})`}
                meta={
                  <>
                    {dataHora(p.criadoEm)} · {TIPO[p.tipo]}
                    {p.motivo ? ` · ${p.motivo}` : ""}
                  </>
                }
                selo={<Selo tom={TOM[p.situacao]}>{SITUACAO[p.situacao]}</Selo>}
              />
            ))}
          </Lista>
        </Cartao>
      )}
    </div>
  );
}
