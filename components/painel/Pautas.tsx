// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { ArrowLeft, ArrowRight, CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";
import { type Me, rpc } from "@/lib/backend";
import { agirOtimista, localDoPainel, textoDoErro, useAcao, useLista } from "./comum";
import { Abas, Area, Botao, Campo, Cartao, Esqueleto, Faixa, ItemDeLista, Lista, Selecao, Selo, type TomDoSelo, Vazio } from "./ui";

// O banco de pautas e o calendário editorial único (supabase/install.sql, "Banco de pautas e calendário editorial"):
// matéria, episódio, post, aula e vídeo num lugar só; e um calendário que junta pautas, posts, aulas ao vivo e reuniões.

interface Pauta {
  id: string;
  titulo: string;
  descricao: string;
  tipo: Tipo;
  status: Situacao;
  data_prevista: string | null;
  link: string;
  responsavel: string | null;
  responsavel_nome: string;
  criado_por: string;
  mexo: boolean;
}
interface Evento {
  tipo: "pauta" | "post" | "aula" | "reuniao";
  subtipo: string;
  id: string;
  titulo: string;
  dia: string;
  hora: string;
  situacao: string;
  quem: string;
}
type Tipo = "jornal" | "podcast" | "instagram" | "aula" | "video" | "radio" | "outro";
type Situacao = "ideia" | "apurando" | "produzindo" | "revisao" | "publicada" | "descartada";

const TIPOS: [Tipo, string][] = [
  ["jornal", "Jornal"],
  ["podcast", "Podcast"],
  ["instagram", "Instagram"],
  ["aula", "Aula"],
  ["video", "Vídeo"],
  ["radio", "Rádio"],
  ["outro", "Outro"],
];
const SITUACOES: [Situacao, string][] = [
  ["ideia", "Ideia"],
  ["apurando", "Apurando"],
  ["produzindo", "Produzindo"],
  ["revisao", "Em revisão"],
  ["publicada", "Publicada"],
  ["descartada", "Descartada"],
];
const nomeDoTipo = Object.fromEntries(TIPOS) as Record<Tipo, string>;
// O tipo de cada coisa do calendário vai num selo (sempre com a palavra; a cor só acompanha, pelos tokens do tema).
const TOM: Record<Evento["tipo"], TomDoSelo> = { pauta: "bordo", post: "ouro", aula: "neutro", reuniao: "info" };
const NOME_DO_EVENTO: Record<Evento["tipo"], string> = { pauta: "Pauta", post: "Post", aula: "Aula ao vivo", reuniao: "Reunião" };
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function Pautas({ me, ir }: { me: Me; ir: (aba: string) => void }) {
  const [aba, setAba] = useState<"calendario" | "pautas">("calendario");
  return (
    <div className="pn-tela">
      <Abas
        rotulo="Pautas"
        opcoes={[
          { id: "calendario" as const, nome: "Calendário" },
          { id: "pautas" as const, nome: "Banco de pautas" },
        ]}
        valor={aba}
        aoMudar={setAba}
        painel={(atual) => (atual === "calendario" ? <Calendario ir={ir} /> : <BancoDePautas me={me} />)}
      />
    </div>
  );
}

function Calendario({ ir }: { ir: (aba: string) => void }) {
  const [inicio, setInicio] = useState(() => iso(new Date()));
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [erro, setErro] = useState("");
  // "Tentar de novo" pede outra leitura do mesmo período.
  const [volta, setVolta] = useState(0);
  const fim = iso(new Date(new Date(`${inicio}T12:00:00`).getTime() + 30 * 86_400_000));
  useEffect(() => {
    let vivo = true;
    rpc<Evento[]>("calendario_equipe", { p_de: inicio, p_ate: fim })
      .then((r) => {
        if (!vivo) return;
        setEventos(r);
        setErro("");
      })
      .catch((e) => vivo && setErro(textoDoErro(e)));
    return () => {
      vivo = false;
    };
  }, [inicio, fim, volta]);
  const andar = (dias: number) => setInicio(iso(new Date(new Date(`${inicio}T12:00:00`).getTime() + dias * 86_400_000)));
  const dias = [...new Set((eventos ?? []).map((e) => e.dia))].sort();
  const destino: Record<Evento["tipo"], string> = { pauta: "pautas", post: "divulgacao", aula: "aovivo", reuniao: "conversas" };
  return (
    <div className="pn-tela">
      <div className="pn-tela-cabeca">
        <p className="pn-sobre" style={{ marginTop: 0 }}>
          Tudo o que a equipe tem com data, num lugar só: pautas, posts da divulgação, aulas ao vivo e reuniões. De {new Date(`${inicio}T12:00:00`).toLocaleDateString(localDoPainel())} a {new Date(`${fim}T12:00:00`).toLocaleDateString(localDoPainel())}.
        </p>
        <div className="pn-barra-ferramentas">
          {/* As duas setas mostram "30 dias"; o nome para o leitor de tela diz para que lado vai. */}
          <Botao pequeno simbolo={ArrowLeft} aria-label="30 dias antes" onClick={() => andar(-30)}>
            30 dias
          </Botao>
          <Botao pequeno onClick={() => setInicio(iso(new Date()))}>
            Hoje
          </Botao>
          <Botao pequeno simboloFim={ArrowRight} aria-label="30 dias depois" onClick={() => andar(30)}>
            30 dias
          </Botao>
        </div>
      </div>
      <p className="pn-barra-ferramentas" aria-hidden>
        {(Object.keys(TOM) as Evento["tipo"][]).map((t) => (
          <Selo key={t} tom={TOM[t]} ponto>
            {NOME_DO_EVENTO[t]}
          </Selo>
        ))}
      </p>
      {erro && (
        <Faixa
          tom="erro"
          acao={
            <Botao pequeno onClick={() => setVolta((v) => v + 1)}>
              Tentar de novo
            </Botao>
          }
        >
          {erro}
        </Faixa>
      )}
      {eventos === null && !erro && <Esqueleto forma="linhas" linhas={5} />}
      {eventos && dias.length === 0 && <Vazio simbolo={CalendarDays} titulo="Nada com data nestes 30 dias." texto="Ponha a data prevista nas pautas e nos posts para aparecerem aqui." />}
      {dias.length > 0 && (
        <ol className="grid gap-5" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {dias.map((dia) => {
            const nomeDoDia = new Date(`${dia}T12:00:00`).toLocaleDateString(localDoPainel(), { weekday: "long", day: "numeric", month: "short" });
            return (
              <li key={dia} className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
                <p className="pn-cartao-titulo first-letter:uppercase sm:pt-2">{nomeDoDia}</p>
                <Lista rotulo={nomeDoDia}>
                  {(eventos ?? [])
                    .filter((e) => e.dia === dia)
                    .map((e) => (
                      <ItemDeLista
                        key={`${e.tipo}-${e.id}`}
                        aoClicar={() => ir(destino[e.tipo])}
                        titulo={
                          <>
                            {e.hora && <span className="pn-rotulo-mono" style={{ marginRight: "0.5rem" }}>{e.hora}</span>}
                            {e.titulo}
                          </>
                        }
                        meta={[e.situacao, e.quem].filter(Boolean).join(" · ") || undefined}
                        selo={<Selo tom={TOM[e.tipo]}>{e.tipo === "pauta" ? (nomeDoTipo[e.subtipo as Tipo] ?? "Pauta") : NOME_DO_EVENTO[e.tipo]}</Selo>}
                      />
                    ))}
                </Lista>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function BancoDePautas({ me }: { me: Me }) {
  const lista = useLista<Pauta[]>("pautas_listar");
  const acao = useAcao(lista.recarregar);
  const [tipo, setTipo] = useState<Tipo | "">("");
  const [nova, setNova] = useState({ titulo: "", descricao: "", tipo: "jornal" as Tipo, data_prevista: "" });
  const [aberta, setAberta] = useState<string | null>(null);
  const pautas = (lista.dados ?? []).filter((p) => !tipo || p.tipo === tipo);
  // Mudar a situação ou a data é simples e reversível: a tela muda na hora e volta sozinha se o banco recusar.
  const mudar = (id: string, campos: Partial<Pauta>, sucesso: string) =>
    void agirOtimista<Pauta[]>({
      lista: { funcao: "pautas_listar" },
      remendo: (dados) => dados.map((p) => (p.id === id ? { ...p, ...campos } : p)),
      funcao: "pauta_salvar",
      argumentos: { p_id: id, p: campos },
      sucesso,
    });
  return (
    <div className="pn-tela">
      <Cartao as="section" titulo="Propor uma pauta" nivelDoTitulo={3}>
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await acao.agir("pauta_salvar", { p_id: null, p: nova }, "Pauta no banco. Quem cuida do tipo vê na hora.");
            if (ok !== null) setNova({ titulo: "", descricao: "", tipo: nova.tipo, data_prevista: "" });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_11rem]">
            <Campo rotulo="A ideia" value={nova.titulo} onChange={(e) => setNova({ ...nova, titulo: e.target.value })} maxLength={160} placeholder="A greve dos entregadores por aplicativo" />
            <Selecao rotulo="Para" value={nova.tipo} onChange={(e) => setNova({ ...nova, tipo: e.target.value as Tipo })}>
              {TIPOS.map(([id, nome]) => (
                <option key={id} value={id}>
                  {nome}
                </option>
              ))}
            </Selecao>
            <Campo rotulo="Data prevista" type="date" value={nova.data_prevista} onChange={(e) => setNova({ ...nova, data_prevista: e.target.value })} />
          </div>
          <Area rotulo="Por que importa, fontes, quem ouvir (opcional)" value={nova.descricao} onChange={(e) => setNova({ ...nova, descricao: e.target.value })} maxLength={3000} rows={2} />
          <div>
            <Botao type="submit" variante="principal" carregando={acao.ocupado} disabled={nova.titulo.trim().length < 3}>
              Pôr no banco
            </Botao>
          </div>
        </form>
      </Cartao>

      <div role="group" aria-label="Filtrar por tipo" className="pn-barra-ferramentas">
        {([["", "Todas"], ...TIPOS] as [Tipo | "", string][]).map(([id, nome]) => (
          <Botao key={id || "todas"} pequeno variante={tipo === id ? "padrao" : "discreto"} aria-pressed={tipo === id} onClick={() => setTipo(id)}>
            {nome}
          </Botao>
        ))}
      </div>
      {lista.erro && (
        <Faixa
          tom="erro"
          acao={
            <Botao pequeno onClick={lista.recarregar}>
              Tentar de novo
            </Botao>
          }
        >
          {lista.erro}
        </Faixa>
      )}
      {acao.aviso && <Faixa tom="info">{acao.aviso}</Faixa>}
      {lista.dados === null && !lista.erro ? (
        <Esqueleto forma="cartoes" linhas={5} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-5">
          {SITUACOES.filter(([s]) => s !== "descartada").map(([situacao, nome]) => {
            const daqui = pautas.filter((p) => p.status === situacao);
            return (
              <Cartao key={situacao} as="section" aria-label={nome} variante="plano" className="min-w-0" style={{ padding: "0.75rem" }}>
                <p className="pn-rotulo-mono">
                  {nome} · {daqui.length}
                </p>
                <ul className="mt-2 grid gap-2" style={{ listStyle: "none", margin: "0.5rem 0 0", padding: 0 }}>
                  {daqui.map((p) => (
                    <li key={p.id}>
                      <Cartao as="div" style={{ padding: "0.6rem 0.7rem" }}>
                        <button type="button" className="w-full cursor-pointer text-left" aria-expanded={aberta === p.id} onClick={() => setAberta(aberta === p.id ? null : p.id)}>
                          <span className="pn-rotulo-mono">{nomeDoTipo[p.tipo]}</span>
                          <span className="block text-sm font-semibold leading-snug">{p.titulo}</span>
                          <span className="pn-ajuda">
                            {p.data_prevista ? new Date(`${p.data_prevista}T12:00:00`).toLocaleDateString(localDoPainel()) : "sem data"} · {p.responsavel_nome || "sem quem cuide"}
                          </span>
                        </button>
                        {aberta === p.id && (
                          <div className="mt-2 grid gap-2 border-t border-rule pt-2">
                            {p.descricao && (
                              <p className="whitespace-pre-line text-xs" data-original>
                                {p.descricao}
                              </p>
                            )}
                            <p className="pn-ajuda">Proposta por {p.criado_por || "alguém"}</p>
                            {p.mexo ? (
                              <>
                                <select value={p.status} onChange={(e) => mudar(p.id, { status: e.target.value as Situacao }, "Situação mudada.")} aria-label="Situação" className="pn-campo">
                                  {SITUACOES.map(([id, n]) => (
                                    <option key={id} value={id}>
                                      {n}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="date"
                                  defaultValue={p.data_prevista ?? ""}
                                  onBlur={(e) => e.target.value !== (p.data_prevista ?? "") && mudar(p.id, { data_prevista: e.target.value }, "Data mudada.")}
                                  aria-label="Data prevista"
                                  className="pn-campo"
                                />
                                {p.responsavel !== me.id && (
                                  <Botao pequeno variante="discreto" disabled={acao.ocupado} onClick={() => void acao.agir("pauta_salvar", { p_id: p.id, p: { responsavel: me.id } }, "Agora você cuida desta pauta.")}>
                                    Eu cuido desta
                                  </Botao>
                                )}
                              </>
                            ) : (
                              <p className="pn-ajuda">Quem cuida do tipo ({nomeDoTipo[p.tipo]}) mexe nesta pauta.</p>
                            )}
                          </div>
                        )}
                      </Cartao>
                    </li>
                  ))}
                </ul>
              </Cartao>
            );
          })}
        </div>
      )}
    </div>
  );
}
