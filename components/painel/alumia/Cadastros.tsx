// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { MarcaDoConvite, useFichasPorConvite } from "@/components/rede/convites/MarcaDoConvite";
import { PainelDaPorta } from "@/components/rede/convites/PainelDaPorta";
import { Botao } from "@/components/rede/ui/Botao";
import { rpc } from "@/lib/backend";
import type { Cadastro, Cadastros as Resposta, SituacaoDoCadastro } from "@/lib/rede/painel/tipos";
import { Campo, dias, Estado, Etiqueta, Fita, motivoDe, Nota, quando, Quadro, Titulo, useDado, useJanela, usePainelDaAlumia } from "./pecas";

type Filtro = SituacaoDoCadastro | "todas";

const NOME_DA_SITUACAO: Record<SituacaoDoCadastro, string> = { em_analise: "Na fila", aprovada: "Aprovada", recusada: "Recusada" };
const NOME_DA_ORIGEM: Record<string, string> = { cadastro: "pediu pela tela de entrada", ja_membro: "já era membro quando a trava ligou" };

/**
 * Cadastros: a fila de quem pediu a entrada, o histórico e as três decisões (aprovar, recusar com motivo, reabrir). A mesma fila
 * que a mediação vê em "Alumia: pedidos de entrada"; aqui a coordenação e o admin também mudam decisão já tomada. O pedido mostra
 * o codinome e o que a pessoa escreveu: nunca e-mail, nome civil ou endereço de rede.
 */
export function Cadastros() {
  const { ir, papel } = usePainelDaAlumia();
  const [filtro, setFiltro] = useState<Filtro>("em_analise");
  const [busca, setBusca] = useState("");
  const [buscado, setBuscado] = useState("");
  const [pagina, setPagina] = useState(0);
  const [aberto, setAberto] = useState<string | null>(null);
  const leitura = useDado<Resposta>("alumia_painel_cadastros", { p_situacao: filtro, p_busca: buscado, p_pagina: pagina });
  const { pedir, janela } = useJanela();
  const itens = leitura.dados?.itens ?? [];
  const contagem = leitura.dados?.contagem;
  const atual = itens.find((c) => c.id === aberto) ?? itens[0] ?? null;
  // A marca "veio por convite" (onda 8, porta de entrada): só os números das fichas, nunca de quem; some quando a triagem decide.
  const porConvite = useFichasPorConvite(leitura.dados);

  const aprovar = (c: Cadastro) =>
    pedir({
      titulo: "Aprovar a entrada",
      texto: (
        <p>
          <strong>{c.codinome}</strong> passa a poder usar a Alumia. Antes de ver a rede, a pessoa ainda cadastra o aplicativo autenticador. Ela recebe um aviso na conta.
        </p>
      ),
      campos: [{ tipo: "motivo", opcional: true, rotulo: "Anotação para o registro (opcional)" }],
      confirmar: "Aprovar",
      fazer: (v) => rpc("alumia_painel_cadastro_decidir", { p_id: c.id, p_aprovar: true, p_motivo: motivoDe(v) }),
      sucesso: "Aprovado. A pessoa foi avisada.",
      depois: leitura.recarregar,
    });
  const recusar = (c: Cadastro) =>
    pedir({
      titulo: c.situacao === "aprovada" ? "Tirar o acesso" : "Recusar o pedido",
      texto: (
        <p>
          {c.situacao === "aprovada" ? (
            <>
              <strong>{c.codinome}</strong> deixa de poder usar a Alumia na hora.
            </>
          ) : (
            <>
              O pedido de <strong>{c.codinome}</strong> é recusado. A pessoa pode pedir de novo depois de 30 dias.
            </>
          )}
        </p>
      ),
      campos: [{ tipo: "motivo", aviso: "A pessoa lê este motivo no aviso que recebe." }],
      confirmar: c.situacao === "aprovada" ? "Tirar o acesso" : "Recusar",
      perigo: true,
      fazer: (v) => rpc("alumia_painel_cadastro_decidir", { p_id: c.id, p_aprovar: false, p_motivo: motivoDe(v) }),
      sucesso: "Recusado. A pessoa recebeu o motivo.",
      depois: leitura.recarregar,
    });
  const reabrir = (c: Cadastro) =>
    pedir({
      titulo: "Reabrir o pedido",
      texto: (
        <p>
          O pedido de <strong>{c.codinome}</strong> volta para a fila, sem decisão, para ser lido de novo.
          {c.situacao === "aprovada" ? " Enquanto estiver na fila, a conta fica sem acesso à Alumia." : ""}
        </p>
      ),
      campos: [{ tipo: "motivo" }],
      confirmar: "Reabrir",
      fazer: (v) => rpc("alumia_painel_cadastro_reabrir", { p_id: c.id, p_motivo: motivoDe(v) }),
      sucesso: "O pedido voltou para a fila.",
      depois: leitura.recarregar,
    });

  return (
    <div className="ap-tela">
      <Titulo nome="Cadastros" sobre="Quem cria conta pela Alumia espera aqui. Leia o que a pessoa escreveu e decida. Coordenação e militantes da Escola entram direto, sem pedido." />
      <div className="ap-filtros">
        <Fita
          rotulo="Situação"
          atual={filtro}
          escolher={(f) => {
            setFiltro(f);
            setPagina(0);
            setAberto(null);
          }}
          opcoes={[
            { id: "em_analise", nome: "Na fila", conta: contagem?.em_analise },
            { id: "aprovada", nome: `Aprovados${contagem ? ` · ${contagem.aprovada}` : ""}` },
            { id: "recusada", nome: `Recusados${contagem ? ` · ${contagem.recusada}` : ""}` },
            { id: "todas", nome: "Todos" },
          ]}
        />
        <form
          className="ap-filtros"
          style={{ marginLeft: "auto" }}
          onSubmit={(e) => {
            e.preventDefault();
            setBuscado(busca.trim());
            setPagina(0);
          }}
        >
          <Campo rotulo="Codinome ou @">
            <input className="ap-entrada" value={busca} maxLength={60} onChange={(e) => setBusca(e.target.value)} placeholder="faísca" />
          </Campo>
          <Botao type="submit" variante="contorno">
            Buscar
          </Botao>
        </form>
      </div>

      <Estado leitura={leitura} eVazio={Boolean(leitura.dados) && itens.length === 0} vazio={filtro === "em_analise" ? "Nenhum pedido esperando. A fila está em dia." : "Nada com esse filtro."} />

      {itens.length > 0 && atual ? (
        <div className="ap-lado">
          <Quadro>
            <div className="ap-lista">
              {itens.map((c) => (
                <button key={c.id} type="button" className="ap-escolher" aria-current={c.id === atual.id} onClick={() => setAberto(c.id)}>
                  <span className="ap-linha-cabeca">
                    <span className="ap-forte">{c.codinome}</span>
                    <MarcaDoConvite ficha={c.id} fichas={porConvite} />
                    {filtro !== "em_analise" ? <Etiqueta tom={c.situacao === "aprovada" ? "papel" : c.situacao === "em_analise" ? "dourado" : undefined}>{NOME_DA_SITUACAO[c.situacao]}</Etiqueta> : null}
                  </span>
                  <span className="ap-miudo">
                    {quando(c.situacao === "em_analise" ? c.pedido_em : (c.decidido_em ?? c.pedido_em))} · conta de {dias(c.conta_dias)}
                    {c.vezes > 1 ? ` · ${c.vezes}ª vez` : ""}
                  </span>
                </button>
              ))}
            </div>
            <div className="ap-linha-acoes">
              {pagina > 0 ? (
                <Botao variante="contorno" tamanho="p" onClick={() => setPagina((p) => p - 1)}>
                  Anteriores
                </Botao>
              ) : null}
              {itens.length === 50 ? (
                <Botao variante="contorno" tamanho="p" onClick={() => setPagina((p) => p + 1)}>
                  Próximos 50
                </Botao>
              ) : null}
            </div>
          </Quadro>

          <Quadro titulo={atual.codinome} lado={<Etiqueta tom={atual.situacao === "aprovada" ? "papel" : atual.situacao === "em_analise" ? "dourado" : undefined}>{NOME_DA_SITUACAO[atual.situacao]}</Etiqueta>}>
            <div className="ap-etiquetas">
              {atual.handle ? <Etiqueta>@{atual.handle}</Etiqueta> : null}
              <MarcaDoConvite ficha={atual.id} fichas={porConvite} />
              {atual.da_casa ? <Etiqueta tom="dourado">tem função na casa</Etiqueta> : null}
              {atual.suspensa ? <Etiqueta tom="vermelho">conta suspensa</Etiqueta> : null}
            </div>
            <dl className="ap-dados">
              <div className="ap-dado">
                <dt>Pediu em</dt>
                <dd>{quando(atual.pedido_em)}</dd>
              </div>
              <div className="ap-dado">
                <dt>Conta existe há</dt>
                <dd>{dias(atual.conta_dias)}</dd>
              </div>
              <div className="ap-dado">
                <dt>Vezes que pediu</dt>
                <dd>{atual.vezes}</dd>
              </div>
              <div className="ap-dado">
                <dt>Como chegou</dt>
                <dd style={{ fontSize: "0.875rem" }}>{NOME_DA_ORIGEM[atual.origem ?? ""] ?? atual.origem ?? "—"}</dd>
              </div>
            </dl>
            <div>
              <p className="ap-miudo">Por que quer entrar</p>
              <p className="ap-quebra">{atual.motivo ?? "— (o texto do pedido some 30 dias depois da decisão)"}</p>
            </div>
            {atual.situacao !== "em_analise" ? (
              <div>
                <p className="ap-miudo">
                  Decidido em {quando(atual.decidido_em)}
                  {atual.decidido_por ? ` por ${atual.decidido_por}` : ""}
                </p>
                <p className="ap-quebra">{atual.motivo_decisao ?? "Sem motivo anotado."}</p>
              </div>
            ) : (
              <Nota>A pessoa declarou ter 18 anos ou mais e aceitou as normas e a privacidade. Conta criada há minutos com texto sem sentido costuma ser robô ou curioso.</Nota>
            )}
            <div className="ap-linha-acoes" style={{ justifyContent: "flex-start" }}>
              {atual.situacao !== "aprovada" ? (
                <Botao variante="claro" className="ap-positivo" onClick={() => aprovar(atual)}>
                  Aprovar
                </Botao>
              ) : null}
              {atual.situacao !== "recusada" ? (
                <Botao variante="contorno" className="ap-destrutivo" onClick={() => recusar(atual)}>
                  {atual.situacao === "aprovada" ? "Tirar o acesso" : "Recusar com motivo"}
                </Botao>
              ) : null}
              {atual.situacao !== "em_analise" ? (
                <Botao variante="contorno" onClick={() => reabrir(atual)}>
                  Reabrir
                </Botao>
              ) : null}
              {atual.handle ? (
                <Botao variante="fantasma" onClick={() => ir("pessoas", `@${atual.handle}`)}>
                  Ver a ficha
                </Botao>
              ) : null}
            </div>
          </Quadro>
        </div>
      ) : null}
      {/* A porta de entrada (onda 8): o passe exigido no banco, os tetos e os números das últimas 24 horas. */}
      <PainelDaPorta papel={papel} />
      {janela}
    </div>
  );
}
