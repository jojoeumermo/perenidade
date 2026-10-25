// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { getClient, type Me, rpc } from "@/lib/backend";
import { BuscaDePessoa, type PessoaAchada } from "./BuscaDePessoa";
import { Aviso, botao, botaoClaro, campo, data, elo, textoDoErro, useAcao, useLista } from "./comum";
import type { Membro } from "./Equipe";
import { RedeDeApoio } from "./Biblioteca";

// Cuidado com a equipe (supabase/install.sql, "Cuidado com a equipe"): agradecer em público, férias de verdade, o
// termômetro de bem-estar da semana, a caixa de críticas anônimas e o botão de pânico. O termômetro e as críticas
// são anônimos de fato: o banco não guarda quem respondeu.

const cartao = "border-2 border-ink bg-folha p-4 shadow-[4px_4px_0_var(--sombra)]";
const titulo = "font-mono text-[0.66rem] uppercase tracking-[0.2em] text-prelo-texto";
const NIVEIS: [number, string][] = [
  [1, "No limite"],
  [2, "Cansado"],
  [3, "Mais ou menos"],
  [4, "Bem"],
  [5, "Muito bem"],
];

/** Na Mesa: a pergunta da semana. Some depois de responder (dá para mudar até domingo, abrindo de novo). */
export function Termometro() {
  const situacao = useLista<{ respondeu: boolean }>("bem_estar_situacao");
  const [resposta, setResposta] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  if (!situacao.dados || (situacao.dados.respondeu && resposta === null)) return null;
  async function responder(nivel: number) {
    setErro("");
    try {
      await rpc("bem_estar_responder", { p_nivel: nivel });
      setResposta(nivel);
    } catch (e) {
      setErro(textoDoErro(e));
    }
  }
  return (
    <section aria-labelledby="termometro" className={cartao}>
      <p id="termometro" className={titulo}>Termômetro da semana</p>
      {resposta === null ? (
        <>
          <p className="mt-1.5 font-serif text-lg font-semibold leading-snug">Como você está esta semana?</p>
          <p className="mt-0.5 text-xs text-ink-soft">Anônimo de verdade: o banco não guarda quem respondeu. A coordenação só vê a média, e só com cinco respostas ou mais.</p>
          <p role="group" aria-label="Como você está" className="mt-3 flex flex-wrap gap-1.5">
            {NIVEIS.map(([nivel, nome]) => (
              <button key={nivel} type="button" onClick={() => void responder(nivel)} className="cursor-pointer border-2 border-ink bg-parchment px-2.5 py-1 text-[0.82rem] font-semibold hover:bg-ink hover:text-parchment">
                {nome}
              </button>
            ))}
          </p>
          <Aviso texto={erro} />
        </>
      ) : (
        <div className="mt-1.5 text-sm">
          <p className="font-semibold">Obrigado por responder.</p>
          {resposta <= 2 && (
            <p className="mt-1 leading-snug text-ink-soft">
              Pegar leve também é militância. Marque férias em Minha conta › Cuidado, ou converse com alguém de confiança da equipe nas Conversas. Nada aqui é mais urgente que você.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/** Na Mesa: quem está de férias vê o lembrete (e volta com um clique). */
export function FeriasNaMesa() {
  const ferias = useLista<{ ferias_ate: string | null }>("ferias_ver");
  const acao = useAcao(ferias.recarregar);
  const ate = ferias.dados?.ferias_ate;
  if (!ate) return null;
  return (
    <p role="status" className="flex flex-wrap items-center gap-x-4 gap-y-2 border-2 border-ink bg-[#f9e7a6] px-4 py-3 text-[#1f1a14]">
      <span className="min-w-0 flex-1">
        <strong>Você está de férias até {data(`${ate}T12:00:00`)}.</strong> Descanse: nada aqui é urgente, e a equipe sabe.
      </span>
      <button type="button" className={`${elo} font-bold`} disabled={acao.ocupado} onClick={() => void acao.agir("ferias_marcar", { p_ate: null }, "Bem-vindo de volta.")}>
        Voltar agora
      </button>
    </p>
  );
}

interface Agradecimento {
  id: string;
  texto: string;
  de: string;
  para: string;
  criado_em: string;
  meu: boolean;
  para_mim: boolean;
}

/** Na Mesa: o mural de agradecimentos da equipe, sem pontos nem ranking, e o formulário para agradecer alguém. */
export function Agradecimentos() {
  const lista = useLista<Agradecimento[]>("agradecimentos_listar");
  const membros = useLista<Membro[]>("equipe_membros");
  const acao = useAcao(lista.recarregar);
  const [aberto, setAberto] = useState(false);
  const [pessoa, setPessoa] = useState<PessoaAchada | null>(null);
  const [texto, setTexto] = useState("");
  if (!lista.dados) return null;
  const colegas: PessoaAchada[] = (membros.dados ?? []).filter((m) => !m.eu).map((m) => ({ id: m.id, nome: m.nome, email: "" }));
  return (
    <section aria-labelledby="agradecimentos" className={cartao}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id="agradecimentos" className={titulo}>Agradecimentos da equipe</p>
        <button type="button" className={`${elo} text-sm font-bold`} aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
          {aberto ? "Fechar" : "Agradecer alguém"}
        </button>
      </div>
      {aberto && (
        <form
          className="mt-3 space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!pessoa) return;
            const ok = await acao.agir("agradecer", { p_para: pessoa.id, p_texto: texto }, "Agradecimento publicado. A pessoa recebeu um recado.");
            if (ok !== null) {
              setTexto("");
              setPessoa(null);
              setAberto(false);
            }
          }}
        >
          <BuscaDePessoa escolhida={pessoa} escolher={setPessoa} entre={colegas} rotulo="Quem você quer agradecer" />
          <label className="block text-sm">
            O que a pessoa fez
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={280} rows={2} className={campo} placeholder="Obrigado por revisar a minha aula no domingo!" />
          </label>
          <button type="submit" className={botao} disabled={acao.ocupado || !pessoa || texto.trim().length < 3}>Publicar o agradecimento</button>
        </form>
      )}
      <Aviso texto={lista.erro || acao.aviso} />
      {lista.dados.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">Ninguém agradeceu ainda. Que tal começar?</p>
      ) : (
        <ul className="mt-2 divide-y divide-dashed divide-rule">
          {lista.dados.slice(0, 5).map((a) => (
            <li key={a.id} className="py-2 text-sm leading-snug">
              <span className="font-semibold">{a.de || "Alguém"}</span> agradeceu <span className="font-semibold">{a.para_mim ? "você" : a.para}</span>: “{a.texto}”
              <span className="ml-1 text-xs text-ink-soft">· {data(a.criado_em)}</span>
              {a.meu && (
                <button type="button" className={`${elo} ml-2 text-xs text-ink-soft`} disabled={acao.ocupado} onClick={() => void acao.agir("agradecimento_apagar", { p_id: a.id }, "Agradecimento apagado.")}>
                  apagar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const PARA: [string, string][] = [
  ["geral", "A equipe toda"],
  ["coordenacao", "A coordenação"],
  ["comunicacao", "A comunicação"],
  ["educacao", "A educação"],
  ["curadoria", "A curadoria e a revisão"],
  ["mediacao", "A mediação"],
  ["painel", "O painel e o site"],
];

/** Em Minha conta: férias, a caixa de críticas anônimas e o botão de pânico. */
export function CuidadoNaConta({ me, sair }: { me: Me; sair: () => void }) {
  const ferias = useLista<{ ferias_ate: string | null }>("ferias_ver");
  const acao = useAcao(ferias.recarregar);
  const [ate, setAte] = useState("");
  const [critica, setCritica] = useState("");
  const [para, setPara] = useState("geral");
  const [motivo, setMotivo] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  // De hoje até 120 dias (o limite do banco), fixados quando a aba abre.
  const [[hoje, limite]] = useState(() => [new Date().toISOString().slice(0, 10), new Date(Date.now() + 120 * 86_400_000).toISOString().slice(0, 10)]);
  const voluntario = me.papeis.length > 0;

  async function panico() {
    const ok = await acao.agir("panico", { p_motivo: motivo }, "Pronto. As sessões foram encerradas e a coordenação foi avisada.");
    if (ok === null) return;
    // Sai também neste navegador e nos outros aparelhos (o banco já derrubou as sessões guardadas).
    try {
      const supabase = await getClient();
      await supabase.auth.signOut({ scope: "global" });
    } catch {
      // Sem resposta do serviço: o sair local abaixo resolve este aparelho.
    }
    sair();
  }

  return (
    <div className="space-y-6">
      <Aviso texto={acao.aviso} />
      <section aria-labelledby="ferias-titulo" className="painel-cartao p-5">
        <h3 id="ferias-titulo" className="font-serif text-xl font-semibold">Férias de verdade</h3>
        <p className="mt-1 text-sm text-ink-soft">Marque até quando você vai estar fora. A equipe vê “de férias” ao lado do seu nome e ninguém espera resposta.</p>
        {ferias.dados?.ferias_ate ? (
          <p className="mt-3 flex flex-wrap items-center gap-3">
            <strong>De férias até {data(`${ferias.dados.ferias_ate}T12:00:00`)}.</strong>
            <button type="button" className={botaoClaro} disabled={acao.ocupado} onClick={() => void acao.agir("ferias_marcar", { p_ate: null }, "Bem-vindo de volta.")}>Voltar agora</button>
          </p>
        ) : (
          <p className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-sm">
              Até
              <input type="date" value={ate} min={hoje} max={limite} onChange={(e) => setAte(e.target.value)} className={`${campo} w-auto`} />
            </label>
            <button type="button" className={botao} disabled={acao.ocupado || !ate} onClick={() => void acao.agir("ferias_marcar", { p_ate: ate }, "Férias marcadas. Bom descanso!")}>Marcar férias</button>
          </p>
        )}
      </section>

      <RedeDeApoio />

      {voluntario && (
        <section aria-labelledby="critica-titulo" className="painel-cartao p-5">
          <h3 id="critica-titulo" className="font-serif text-xl font-semibold">Caixa de críticas anônimas</h3>
          <p className="mt-1 text-sm text-ink-soft">O que não vai bem, sem medo. O banco não guarda quem mandou nem a hora; quem cuida da equipe lê. No máximo três por dia.</p>
          <label className="mt-3 block text-sm">
            Para quem
            <select value={para} onChange={(e) => setPara(e.target.value)} className={`${campo} w-auto`}>
              {PARA.map(([id, nome]) => (
                <option key={id} value={id}>{nome}</option>
              ))}
            </select>
          </label>
          <label className="mt-2 block text-sm">
            A crítica
            <textarea value={critica} onChange={(e) => setCritica(e.target.value)} maxLength={2000} rows={4} className={campo} />
          </label>
          <button
            type="button"
            className={`${botao} mt-2`}
            disabled={acao.ocupado || critica.trim().length < 10}
            onClick={async () => {
              const ok = await acao.agir("critica_enviar", { p_texto: critica, p_para: para }, "Crítica enviada, sem o seu nome. Obrigado pela coragem.");
              if (ok !== null) setCritica("");
            }}
          >
            Enviar sem o meu nome
          </button>
        </section>
      )}

      <section aria-labelledby="panico-titulo" className="border-2 border-[#c21f16] bg-folha p-5">
        <h3 id="panico-titulo" className="font-serif text-xl font-semibold text-prelo-texto">Botão de pânico</h3>
        <p className="mt-1 text-sm">
          Para quando a sua conta pode ter sido tomada, o celular foi roubado ou você está em risco: encerra a sua sessão em todos os aparelhos e avisa a
          coordenação, que vai falar com você por outro canal. Depois, entre de novo e troque a senha.
        </p>
        {!confirmar ? (
          <button type="button" className="mt-3 cursor-pointer border-2 border-ink bg-[#c21f16] px-4 py-2 font-bold text-white hover:bg-[#a51810]" onClick={() => setConfirmar(true)}>
            Apertar o botão de pânico
          </button>
        ) : (
          <div className="mt-3 space-y-2">
            <label className="block text-sm">
              O que aconteceu (opcional, vai para a coordenação)
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} className={campo} placeholder="Roubaram meu celular" />
            </label>
            <p className="flex flex-wrap gap-2">
              <button type="button" className="cursor-pointer border-2 border-ink bg-[#c21f16] px-4 py-2 font-bold text-white hover:bg-[#a51810]" disabled={acao.ocupado} onClick={() => void panico()}>
                Confirmar: sair de tudo e avisar
              </button>
              <button type="button" className={botaoClaro} onClick={() => setConfirmar(false)}>Cancelar</button>
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

/** Para a coordenação, a coordenação pedagógica e a supervisão: o termômetro das últimas semanas e a caixa de críticas. */
export function CuidadoDaEquipe() {
  const resumo = useLista<{ semana: string; respostas: number; media: number | null; baixas: number | null }[]>("bem_estar_resumo");
  const criticas = useLista<{ id: string; para: string; texto: string; lida: boolean; dia: string }[]>("criticas_listar");
  const acao = useAcao(criticas.recarregar);
  const [todas, setTodas] = useState(false);
  useEffect(() => {
    // Recarrega quando a seção abre de novo (as respostas chegam ao longo da semana).
    resumo.recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao montar
  }, []);
  if (resumo.erro && criticas.erro) return null;
  const nomeDe = Object.fromEntries(PARA);
  const vistas = (criticas.dados ?? []).filter((c) => todas || !c.lida);
  return (
    <section aria-labelledby="cuidado-equipe" className="mt-10 space-y-6">
      <h2 id="cuidado-equipe" className="font-serif text-2xl font-semibold">Cuidado com a equipe</h2>
      <div className="painel-cartao p-5">
        <h3 className="font-semibold">Termômetro das últimas semanas</h3>
        <p className="text-xs text-ink-soft">De 1 (no limite) a 5 (muito bem). Com menos de cinco respostas, só o total aparece, para ninguém ser identificado.</p>
        {resumo.dados && resumo.dados.length === 0 && <p className="mt-2 text-sm text-ink-soft">Ninguém respondeu ainda.</p>}
        <ul className="mt-3 divide-y divide-rule text-sm">
          {resumo.dados?.map((s) => (
            <li key={s.semana} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
              <span className="w-32 font-mono text-xs">semana de {data(`${s.semana}T12:00:00`)}</span>
              <span>{s.respostas} {s.respostas === 1 ? "resposta" : "respostas"}</span>
              {s.media !== null && <span className="font-semibold">média {String(s.media).replace(".", ",")}</span>}
              {s.baixas ? <span className="text-oxblood">{s.baixas} no limite ou cansadas: hora de aliviar a carga</span> : null}
            </li>
          ))}
        </ul>
      </div>
      <div className="painel-cartao p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Caixa de críticas anônimas</h3>
          <button type="button" className={`${elo} text-sm`} onClick={() => setTodas(!todas)}>{todas ? "Só as não lidas" : "Ver também as lidas"}</button>
        </div>
        <Aviso texto={criticas.erro || acao.aviso} />
        {vistas.length === 0 && <p className="mt-2 text-sm text-ink-soft">{todas ? "Nenhuma crítica no último ano." : "Nenhuma crítica nova."}</p>}
        <ul className="mt-2 space-y-3">
          {vistas.map((c) => (
            <li key={c.id} className={`border-l-4 pl-3 ${c.lida ? "border-rule opacity-70" : "border-[#c21f16]"}`}>
              <p className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-ink-soft">{nomeDe[c.para] ?? c.para} · {data(`${c.dia}T12:00:00`)}</p>
              <p className="mt-1 whitespace-pre-line" data-original>{c.texto}</p>
              <button type="button" className={`${elo} mt-1 text-xs`} disabled={acao.ocupado} onClick={() => void acao.agir("critica_marcar", { p_id: c.id, p_lida: !c.lida }, c.lida ? "Marcada como não lida." : "Marcada como lida.")}>
                {c.lida ? "Marcar como não lida" : "Marcar como lida"}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
