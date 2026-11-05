// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { BookOpen, CalendarPlus, Check, PenLine, Send, Undo2, UserCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { agirOtimista, data, useAcao, useLista } from "./comum";
import { Abas, Botao, CabecalhoDeSecao, Esqueleto, Estatistica, Estatisticas, Faixa, ItemDeLista, Lista, Selecao, Selo, Vazio } from "./ui";

// A fila de aulas a escrever (supabase/install.sql, "Fila de aulas a escrever"): cada aula prevista no roteiro de uma
// trilha é uma tarefa que alguém da equipe reserva, escreve no Escrever com o modelo da aula, manda para a revisão por
// pares e só então envia para a fila de revisão de sempre.

interface AulaPrevista {
  slug: string;
  titulo: string;
  pronta: boolean;
}
interface Disciplina {
  area: string;
  nome: string;
  trilhas: { slug: string; titulo: string; etapa: string; aulas: AulaPrevista[] }[];
}
interface Reserva {
  trilha: string;
  aula: string;
  titulo: string;
  situacao: "escrevendo" | "revisao" | "feita";
  prazo: string;
  quem: string;
  minha: boolean;
  revisor: string;
  reviso: boolean;
  vencida: boolean;
}

const ERROS: Record<string, string> = {
  "limite:tres_aulas": "Você já está escrevendo três aulas. Termine ou libere uma antes de pegar outra.",
  reservada: "Outra pessoa já está escrevendo esta aula.",
};

/**
 * A fila de aulas a escrever, por disciplina e trilha: os números de cima, o filtro em abas e cada aula numa linha com o
 * selo da situação e as ações (reservar, pedir revisão, mais prazo, liberar, revisar).
 */
export function FilaDeAulas() {
  const [disciplinas, setDisciplinas] = useState<Disciplina[] | null>(null);
  const reservas = useLista<Reserva[]>("aulas_reservas_listar");
  const acao = useAcao(reservas.recarregar);
  const [area, setArea] = useState("");
  const [filtro, setFiltro] = useState<"livres" | "minhas" | "revisao" | "todas">("livres");
  // As trilhas vêm do site; se não vierem, a tela diz isso (em vez de "Nada aqui.") e deixa tentar de novo.
  const [erroDasTrilhas, setErroDasTrilhas] = useState(false);
  const [volta, setVolta] = useState(0);
  useEffect(() => {
    fetch("/api/aprendizado")
      .then((r) => r.json())
      .then((d: { disciplinas: Disciplina[] }) => {
        setDisciplinas(d.disciplinas);
        setErroDasTrilhas(false);
      })
      .catch(() => {
        setDisciplinas([]);
        setErroDasTrilhas(true);
      });
  }, [volta]);
  const porChave = useMemo(() => new Map((reservas.dados ?? []).map((r) => [`${r.trilha}/${r.aula}`, r])), [reservas.dados]);
  const minhas = (reservas.dados ?? []).filter((r) => r.minha && r.situacao !== "feita");
  const paraRevisar = (reservas.dados ?? []).filter((r) => r.situacao === "revisao" && !r.minha);
  const faltam = (disciplinas ?? []).reduce((n, d) => n + d.trilhas.reduce((m, t) => m + t.aulas.filter((a) => !a.pronta).length, 0), 0);
  const recado = acao.aviso ? (ERROS[acao.aviso] ?? acao.aviso) : "";

  /** Liberar a reserva é simples e reversível: some da tela na hora; se o banco recusar, volta. */
  const liberar = (trilha: string, aula: string) =>
    void agirOtimista<Reserva[]>({
      lista: { funcao: "aulas_reservas_listar" },
      remendo: (dados) => dados.filter((r) => !(r.trilha === trilha && r.aula === aula)),
      funcao: "aula_reserva_mudar",
      argumentos: { p_trilha: trilha, p_aula: aula, p_acao: "liberar" },
      sucesso: "Liberada para outra pessoa.",
    });

  const visiveis = (disciplinas ?? [])
    .filter((d) => !area || d.area === area)
    .map((d) => ({
      ...d,
      trilhas: d.trilhas
        .map((t) => ({
          ...t,
          aulas: t.aulas.filter((a) => {
            if (a.pronta) return false;
            const r = porChave.get(`${t.slug}/${a.slug}`);
            if (filtro === "livres") return !r || r.vencida;
            if (filtro === "minhas") return r?.minha;
            if (filtro === "revisao") return r?.situacao === "revisao" && !r.minha;
            return true;
          }),
        }))
        .filter((t) => t.aulas.length > 0),
    }))
    .filter((d) => d.trilhas.length > 0);

  return (
    <div className="pn-tela">
      <Estatisticas rotulo="Aulas a escrever">
        <Estatistica rotulo="aulas previstas ainda sem texto" valor={faltam} tom={faltam ? "bordo" : "neutro"} />
        <Estatistica rotulo="sendo escritas por você (até 3)" valor={minhas.length} />
        <Estatistica rotulo="esperando revisão por pares" valor={paraRevisar.length} tom={paraRevisar.length ? "aviso" : "neutro"} />
      </Estatisticas>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48">
          <Selecao rotulo="Disciplina" value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">Todas</option>
            {(disciplinas ?? []).map((d) => (
              <option key={d.area} value={d.area}>
                {d.nome}
              </option>
            ))}
          </Selecao>
        </div>
        <div className="min-w-0 flex-1">
          <Abas
            rotulo="Filtro"
            valor={filtro}
            aoMudar={setFiltro}
            opcoes={[
              { id: "livres", nome: "Livres para pegar" },
              { id: "minhas", nome: "Minhas", conta: minhas.length },
              { id: "revisao", nome: "Para revisar", conta: paraRevisar.length },
              { id: "todas", nome: "Todas" },
            ]}
          />
        </div>
      </div>
      {reservas.erro && (
        <Faixa
          tom="erro"
          acao={
            <Botao pequeno onClick={reservas.recarregar}>
              Tentar de novo
            </Botao>
          }
        >
          {reservas.erro}
        </Faixa>
      )}
      {recado && <Faixa tom="info">{recado}</Faixa>}
      {!disciplinas && <Esqueleto forma="linhas" linhas={4} rotulo="Carregando as trilhas…" />}
      {erroDasTrilhas && (
        <Faixa
          tom="erro"
          acao={
            <Botao pequeno onClick={() => setVolta((v) => v + 1)}>
              Tentar de novo
            </Botao>
          }
        >
          As trilhas não carregaram.
        </Faixa>
      )}
      {disciplinas && !erroDasTrilhas && visiveis.length === 0 && <Vazio simbolo={BookOpen} titulo="Nada aqui." />}

      {visiveis.map((d) => (
        <section key={d.area} className="pn-secao">
          <CabecalhoDeSecao titulo={d.nome} />
          {d.trilhas.map((t) => (
            <details key={t.slug} className="pn-cartao group" style={{ padding: 0 }} open={Boolean(area) || filtro !== "livres"}>
              <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-2.5 font-semibold">
                {t.titulo}
                <span className="pn-rotulo-mono">
                  {t.etapa} · {t.aulas.length}
                </span>
              </summary>
              <Lista rotulo={t.titulo} plana className="border-t border-rule">
                {t.aulas.map((a) => {
                  const r = porChave.get(`${t.slug}/${a.slug}`);
                  const escrever = `/pt/painel?aba=escrever&tipo=aula&trilha=${encodeURIComponent(t.slug)}&tema=${encodeURIComponent(a.titulo)}`;
                  const situacao = !r || r.vencida ? (r?.vencida ? `prazo de ${r.quem} venceu: livre para pegar` : "livre") : r.situacao === "escrevendo" ? `${r.minha ? "você está escrevendo" : `${r.quem} está escrevendo`} · prazo ${data(r.prazo)}` : r.situacao === "revisao" ? `pronta, esperando revisão${r.revisor ? `: ${r.revisor} revisa` : ""}` : `revisada por ${r.revisor || "a coordenação"}: falta enviar pelo Escrever`;
                  const tom = !r || r.vencida ? "neutro" : r.situacao === "escrevendo" ? "info" : r.situacao === "revisao" ? "aviso" : "ok";
                  return (
                    <ItemDeLista
                      key={a.slug}
                      className="flex-wrap"
                      titulo={a.titulo}
                      meta={
                        <Selo tom={tom} className="mt-0.5">
                          {situacao}
                        </Selo>
                      }
                      acoes={
                        <span className="flex flex-wrap items-center justify-end gap-1">
                          {(!r || r.vencida) && (
                            <Botao pequeno simbolo={PenLine} disabled={acao.ocupado} onClick={() => void acao.agir("aula_reservar", { p_trilha: t.slug, p_aula: a.slug, p_titulo: a.titulo }, "Reservada para você. Prazo sugerido: 14 dias.")}>
                              Eu escrevo esta
                            </Botao>
                          )}
                          {r?.minha && r.situacao !== "feita" && (
                            <>
                              <a href={escrever} className="pn-botao pn-botao-pequeno pn-botao-discreto">
                                Escrever com o modelo
                              </a>
                              {r.situacao === "escrevendo" && (
                                <Botao pequeno variante="discreto" simbolo={Send} onClick={() => void acao.agir("aula_reserva_mudar", { p_trilha: t.slug, p_aula: a.slug, p_acao: "revisao" }, "Na fila da revisão por pares.")}>
                                  Pedir revisão de um par
                                </Botao>
                              )}
                              {r.situacao === "escrevendo" && (
                                <Botao pequeno variante="discreto" simbolo={CalendarPlus} onClick={() => void acao.agir("aula_reserva_mudar", { p_trilha: t.slug, p_aula: a.slug, p_acao: "prazo" }, "Mais uma semana de prazo.")}>
                                  Mais 7 dias
                                </Botao>
                              )}
                              <Botao pequeno variante="discreto" simbolo={Undo2} onClick={() => liberar(t.slug, a.slug)}>
                                Liberar
                              </Botao>
                            </>
                          )}
                          {r?.minha && r.situacao === "feita" && (
                            <a href={escrever} className="pn-botao pn-botao-pequeno pn-botao-principal">
                              Enviar pelo Escrever
                            </a>
                          )}
                          {r && !r.minha && r.situacao === "revisao" && !r.revisor && (
                            <Botao pequeno simbolo={UserCheck} onClick={() => void acao.agir("aula_reserva_mudar", { p_trilha: t.slug, p_aula: a.slug, p_acao: "revisar" }, "Você vai revisar. Combine com quem escreveu nas Conversas.")}>
                              Eu reviso
                            </Botao>
                          )}
                          {r?.reviso && r.situacao === "revisao" && (
                            <Botao pequeno simbolo={Check} onClick={() => void acao.agir("aula_reserva_mudar", { p_trilha: t.slug, p_aula: a.slug, p_acao: "feita" }, "Revisão concluída. Quem escreveu foi avisado.")}>
                              Revisão concluída
                            </Botao>
                          )}
                        </span>
                      }
                    />
                  );
                })}
              </Lista>
            </details>
          ))}
        </section>
      ))}
      <p className="pn-ajuda text-xs">A revisão por pares é uma leitura de colega antes da fila de revisão oficial: conteúdo, fontes, linguagem simples e o modelo da aula (provocação, na vida real, leve para a sua comunidade).</p>
    </div>
  );
}
