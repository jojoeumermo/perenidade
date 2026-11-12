// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";
import { Aviso, dataHora, useAcao, useLista } from "./comum";
import { MoldeFila } from "./moldes";
import { Area, Botao, Cartao, Faixa, ItemDeLista, Lista, perguntar, Selo, Vazio } from "./ui";

interface Pendente {
  id: string;
  codinome: string;
  motivo: string | null;
  pedido_em: string;
  vezes: number;
  conta_dias: number;
}
interface Decidido {
  id: string;
  codinome: string;
  situacao: "aprovada" | "recusada";
  motivo_decisao: string | null;
  decidido_em: string;
}
interface FilaDaEntrada {
  pendentes: Pendente[];
  decididos: Decidido[];
}

/**
 * "Alumia: pedidos de entrada" (20261110-alumia-entrada.sql): quem criou conta pela Alumia espera aqui até a coordenação ou a
 * mediação aprovar. Cada pedido mostra só o codinome, o que a pessoa escreveu e há quantos dias a conta existe: nada de e-mail,
 * nome civil ou endereço de rede. Aprovar libera a Alumia (a pessoa ainda liga o segundo fator antes de ver a rede); recusar pede o
 * motivo, que a pessoa recebe. Recusar quem já foi aprovado tira o acesso. Coordenação e militantes da Escola entram direto, sem
 * pedido. O banco confere o papel e o segundo fator de novo em cada função. O Fediverso não passa por aqui: servidor ou ator de
 * fora se bloqueia na moderação da federação.
 */
export function AlumiaEntrada() {
  const lista = useLista<FilaDaEntrada>("alumia_triagem_fila");
  const acao = useAcao(lista.recarregar);
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const pendentes = lista.dados?.pendentes ?? [];
  const decididos = lista.dados?.decididos ?? [];

  const aprovar = (p: { id: string }) => acao.agir("alumia_triagem_decidir", { p_id: p.id, p_aprovar: true, p_motivo: "" }, "Aprovado: a pessoa recebe o aviso e liga o segundo fator para entrar.");
  const recusar = (p: { id: string }, motivo: string) => acao.agir("alumia_triagem_decidir", { p_id: p.id, p_aprovar: false, p_motivo: motivo.trim() }, "Recusado: a pessoa recebe o motivo e pode pedir de novo em 30 dias.");
  const recusarPelaPaleta = async (p: { id: string }) => {
    let motivo = (motivos[p.id] ?? "").trim();
    if (motivo.length < 10) motivo = ((await perguntar({ titulo: "Recusar", rotulo: "Motivo da recusa (obrigatório, ao menos 10 letras; a pessoa lê)", valorInicial: motivo, multilinha: true, obrigatorio: true })) ?? "").trim();
    if (motivo.length >= 10) await recusar(p, motivo);
  };

  return (
    <div className="pn-tela">
      <p className="pn-sobre">
        A Alumia é fechada: quem cria conta por ela espera aqui. Leia o que a pessoa escreveu e decida. Aprovar não dá acesso à Escola de Formação. Quem é da coordenação ou
        militante da Escola já entra direto. O que vem do Fediverso não passa por aqui: a federação tem a própria moderação (bloquear o servidor ou a pessoa de fora).
      </p>
      {lista.erro && (
        <Faixa tom="erro" acao={<Botao pequeno onClick={lista.recarregar}>Tentar de novo</Botao>}>
          {lista.erro === "sem_permissao" ? "Só a coordenação e a mediação, com o código do aplicativo autenticador confirmado nesta sessão." : lista.erro}
        </Faixa>
      )}
      <Aviso texto={acao.aviso} />
      <MoldeFila<Pendente>
        id="alumia-entrada"
        rotulo="Pedidos de entrada"
        itens={pendentes}
        carregando={!lista.dados && !lista.erro}
        chave={(p) => p.id}
        vazio={<Vazio titulo="Nenhum pedido de entrada esperando." />}
        linha={(p) => (
          <>
            <span className="pn-rotulo-mono">
              {dataHora(p.pedido_em)} · conta de {p.conta_dias} {p.conta_dias === 1 ? "dia" : "dias"}
              {p.vezes > 1 ? ` · ${p.vezes}ª vez` : ""}
            </span>
            <strong>{p.codinome}</strong>
          </>
        )}
        comandos={(p) => [
          { id: "aprovar", nome: "Aprovar", simbolo: Check, fazer: () => void aprovar(p) },
          { id: "recusar", nome: "Recusar com motivo", simbolo: X, fazer: () => recusarPelaPaleta(p) },
        ]}
        detalhe={(p) => (
          <article className="pn-secao">
            <p className="pn-rotulo-mono">
              {dataHora(p.pedido_em)} · conta de {p.conta_dias} {p.conta_dias === 1 ? "dia" : "dias"}
              {p.vezes > 1 ? ` · ${p.vezes}ª vez que pede` : ""}
            </p>
            <h2 className="pn-cartao-titulo">{p.codinome}</h2>
            <p className="pn-rotulo-mono">Por que quer entrar</p>
            <p className="whitespace-pre-line">{p.motivo ?? "—"}</p>
            <p className="pn-ajuda">A pessoa declarou ter 18 anos ou mais e aceitou as normas e a privacidade. O motivo some 30 dias depois da decisão.</p>
            <Area rotulo="Motivo da recusa (obrigatório, ao menos 10 letras; a pessoa lê)" value={motivos[p.id] ?? ""} onChange={(e) => setMotivos((m) => ({ ...m, [p.id]: e.target.value }))} rows={2} maxLength={500} />
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
      {decididos.length > 0 && (
        <Cartao titulo="Decididos nos últimos 30 dias">
          <Lista rotulo="Decididos nos últimos 30 dias" plana>
            {decididos.map((d) => (
              <ItemDeLista
                key={d.id}
                titulo={d.codinome}
                meta={
                  <>
                    {dataHora(d.decidido_em)}
                    {d.motivo_decisao ? ` · ${d.motivo_decisao}` : ""}
                  </>
                }
                selo={<Selo tom={d.situacao === "aprovada" ? "ok" : "neutro"}>{d.situacao === "aprovada" ? "Aprovada" : "Recusada"}</Selo>}
                acoes={
                  d.situacao === "aprovada" ? (
                    <Botao pequeno simbolo={X} disabled={acao.ocupado} onClick={() => void recusarPelaPaleta(d)}>
                      Tirar o acesso
                    </Botao>
                  ) : (
                    <Botao pequeno simbolo={Check} disabled={acao.ocupado} onClick={() => void aprovar(d)}>
                      Aprovar
                    </Botao>
                  )
                }
              />
            ))}
          </Lista>
        </Cartao>
      )}
    </div>
  );
}
