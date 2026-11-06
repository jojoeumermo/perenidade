// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";
import { Aviso, dataHora, useAcao, useLista } from "./comum";
import { MoldeFila } from "./moldes";
import { Area, Botao, Cartao, Faixa, ItemDeLista, Lista, perguntar, Selo, type TomDoSelo, Vazio } from "./ui";

interface Proposta {
  id: string;
  slug: string;
  nome: string;
  objetivo: string;
  regras: string;
  situacao: "aberta" | "aprovada" | "recusada";
  motivo: string;
  criado_em: string;
  autor: string;
  moderadores: string[];
}

const SITUACAO: Record<Proposta["situacao"], string> = { aberta: "Aguardando decisão", aprovada: "Aprovada", recusada: "Não aprovada" };
const TOM: Record<Proposta["situacao"], TomDoSelo> = { aberta: "bordo", aprovada: "ok", recusada: "neutro" };

/**
 * "Rede: propostas de comunidade" (Rede Lúcia v2, R4 item 37, decisão 4 da ESPEC): comunidade nova só nasce por proposta aprovada
 * pela coordenação. Cada proposta traz o objetivo, as regras e os dois moderadores indicados (só codinomes: a Rede não mostra nome
 * civil). Aprovar cria a comunidade, com as regras e os moderadores, e avisa quem propôs; recusar pede o motivo (ao menos 10
 * letras), que quem propôs lê. O banco confere o papel de coordenação de novo em cada função. No molde Fila, com "Aprovar" e
 * "Recusar com motivo" também na paleta (Ctrl K).
 */
export function RedePropostas() {
  const lista = useLista<{ itens: Proposta[] }>("rede_com_propostas_fila");
  const acao = useAcao(lista.recarregar);
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const itens = lista.dados?.itens ?? [];
  const abertas = itens.filter((p) => p.situacao === "aberta");
  const decididas = itens.filter((p) => p.situacao !== "aberta");

  const aprovar = (p: Proposta) => acao.agir("rede_com_decidir", { p_id: p.id, p_aprova: true, p_motivo: "" }, "Aprovada: a comunidade já está no ar.");
  const recusar = (p: Proposta, motivo: string) => acao.agir("rede_com_decidir", { p_id: p.id, p_aprova: false, p_motivo: motivo.trim() }, "Recusada: quem propôs recebe o motivo.");
  /** Pela paleta: usa o motivo já escrito; sem ele, pergunta numa janela (as mesmas 10 letras de antes). */
  const recusarPelaPaleta = async (p: Proposta) => {
    let motivo = (motivos[p.id] ?? "").trim();
    if (motivo.length < 10) motivo = ((await perguntar({ titulo: "Recusar", rotulo: "Motivo da recusa (obrigatório, ao menos 10 letras)", valorInicial: motivo, multilinha: true, obrigatorio: true })) ?? "").trim();
    if (motivo.length >= 10) await recusar(p, motivo);
  };

  return (
    <div className="pn-tela">
      <p className="pn-sobre">
        Comunidade nova da Alumia só nasce por proposta, e a coordenação decide. Leia o objetivo e as regras, confira os moderadores indicados e aprove ou recuse com o motivo. Aprovada, a comunidade entra entre as lutas, aberta a quem está na Rede, e os dois
        moderadores recebem um aviso (eles podem sair quando quiserem).
      </p>
      {lista.erro && (
        <Faixa tom="erro" acao={<Botao pequeno onClick={lista.recarregar}>Tentar de novo</Botao>}>
          {lista.erro}
        </Faixa>
      )}
      <Aviso texto={acao.aviso} />
      <MoldeFila<Proposta>
        id="rede-propostas"
        rotulo="Propostas"
        itens={abertas}
        carregando={!lista.dados && !lista.erro}
        chave={(p) => p.id}
        vazio={<Vazio titulo="Nenhuma proposta esperando." />}
        linha={(p) => (
          <>
            <span className="pn-rotulo-mono">
              {dataHora(p.criado_em)} · proposta de {p.autor}
            </span>
            <strong>{p.nome}</strong>
          </>
        )}
        comandos={(p) => [
          { id: "aprovar", nome: "Aprovar", simbolo: Check, fazer: () => void aprovar(p) },
          { id: "recusar", nome: "Recusar com motivo", simbolo: X, fazer: () => recusarPelaPaleta(p) },
        ]}
        detalhe={(p) => (
          <article className="pn-secao">
            <p className="pn-rotulo-mono">
              {dataHora(p.criado_em)} · proposta de {p.autor} · endereço /{p.slug}
            </p>
            <h2 className="pn-cartao-titulo">{p.nome}</h2>
            <p className="whitespace-pre-line">{p.objetivo}</p>
            <p className="pn-rotulo-mono">Regras</p>
            <p className="whitespace-pre-line">{p.regras}</p>
            <p className="pn-ajuda">Moderação indicada: {p.moderadores.join(", ")}</p>
            <Area rotulo="Motivo da recusa (obrigatório, ao menos 10 letras)" value={motivos[p.id] ?? ""} onChange={(e) => setMotivos((m) => ({ ...m, [p.id]: e.target.value }))} rows={2} maxLength={500} />
            <div className="flex flex-wrap gap-2">
              <Botao variante="principal" simbolo={Check} disabled={acao.ocupado} onClick={() => void aprovar(p)}>
                Aprovar
              </Botao>
              <Botao simbolo={X} disabled={acao.ocupado || (motivos[p.id] ?? "").trim().length < 10} onClick={() => void recusar(p, motivos[p.id] ?? "")}>
                Recusar
              </Botao>
            </div>
          </article>
        )}
      />
      {decididas.length > 0 && (
        <Cartao titulo="Decididas nos últimos 60 dias">
          <Lista rotulo="Decididas nos últimos 60 dias" plana>
            {decididas.map((p) => (
              <ItemDeLista
                key={p.id}
                titulo={p.nome}
                meta={
                  <>
                    {dataHora(p.criado_em)} · {p.autor}
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
