// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { AlarmClock, Check, Heart, HeartPulse, Send, Siren, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getClient, type Me, rpc } from "@/lib/backend";
import { BuscaDePessoa, type PessoaAchada } from "./BuscaDePessoa";
import { Aviso, data, textoDoErro, useAcao, useLista } from "./comum";
import type { Membro } from "./Equipe";
import { RedeDeApoio } from "./Biblioteca";
import { Area, Botao, CabecalhoDeSecao, Campo, Cartao, Esqueleto, Faixa, ItemDeLista, Lista, Selecao, Selo, Vazio } from "./ui";

// Cuidado com a equipe (supabase/install.sql, "Cuidado com a equipe"): agradecer em público, férias de verdade, o
// termômetro de bem-estar da semana, a caixa de críticas anônimas e o botão de pânico. O termômetro e as críticas
// são anônimos de fato: o banco não guarda quem respondeu.

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
    <Cartao aria-labelledby="termometro">
      <p id="termometro" className="pn-rotulo-mono">Termômetro da semana</p>
      {resposta === null ? (
        <>
          <p className="mt-1.5 text-lg font-semibold leading-snug" style={{ fontFamily: "var(--pn-fonte-titulo)" }}>Como você está esta semana?</p>
          <p className="pn-ajuda mt-0.5">Anônimo de verdade: o banco não guarda quem respondeu. A coordenação só vê a média, e só com cinco respostas ou mais.</p>
          <p role="group" aria-label="Como você está" className="mt-3 flex flex-wrap gap-1.5">
            {NIVEIS.map(([nivel, nome]) => (
              <Botao key={nivel} pequeno onClick={() => void responder(nivel)}>
                {nome}
              </Botao>
            ))}
          </p>
          <Aviso texto={erro} />
        </>
      ) : (
        <div className="mt-1.5 text-sm">
          <p className="flex items-center gap-1.5 font-semibold">
            <Check aria-hidden className="h-4 w-4" />
            Obrigado por responder.
          </p>
          {resposta <= 2 && (
            <p className="mt-1 leading-snug text-ink-soft">
              Pegar leve também é militância. Marque férias em Minha conta › Cuidado, ou converse com alguém de confiança da equipe nas Conversas. Nada aqui é mais urgente que você.
            </p>
          )}
        </div>
      )}
    </Cartao>
  );
}

/** Na Mesa: quem está de férias vê o lembrete (e volta com um clique). */
export function FeriasNaMesa() {
  const ferias = useLista<{ ferias_ate: string | null }>("ferias_ver");
  const acao = useAcao(ferias.recarregar);
  const ate = ferias.dados?.ferias_ate;
  if (!ate) return null;
  return (
    <Faixa
      tom="aviso"
      acao={
        <Botao pequeno carregando={acao.ocupado} onClick={() => void acao.agir("ferias_marcar", { p_ate: null }, "Bem-vindo de volta.")}>
          Voltar agora
        </Botao>
      }
    >
      <strong>Você está de férias até {data(`${ate}T12:00:00`)}.</strong> Descanse: nada aqui é urgente, e a equipe sabe.
    </Faixa>
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
    <Cartao aria-labelledby="agradecimentos">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id="agradecimentos" className="pn-rotulo-mono">Agradecimentos da equipe</p>
        <Botao variante="discreto" pequeno simbolo={aberto ? X : Heart} aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
          {aberto ? "Fechar" : "Agradecer alguém"}
        </Botao>
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
          <Area rotulo="O que a pessoa fez" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={280} rows={2} placeholder="Obrigado por revisar a minha aula no domingo!" />
          <Botao type="submit" variante="principal" simbolo={Send} disabled={!pessoa || texto.trim().length < 3} carregando={acao.ocupado}>
            Publicar o agradecimento
          </Botao>
        </form>
      )}
      <Aviso texto={lista.erro || acao.aviso} />
      {lista.dados.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">Ninguém agradeceu ainda. Que tal começar?</p>
      ) : (
        <Lista rotulo="Agradecimentos da equipe" plana className="mt-2">
          {lista.dados.slice(0, 5).map((a) => (
            <ItemDeLista
              key={a.id}
              simbolo={Heart}
              titulo={
                <span className="whitespace-normal">
                  <span className="font-semibold">{a.de || "Alguém"}</span> agradeceu <span className="font-semibold">{a.para_mim ? "você" : a.para}</span>: “{a.texto}”
                </span>
              }
              meta={data(a.criado_em)}
              acoes={
                a.meu && (
                  <Botao variante="discreto" pequeno perigo simbolo={Trash2} disabled={acao.ocupado} onClick={() => void acao.agir("agradecimento_apagar", { p_id: a.id }, "Agradecimento apagado.")}>
                    apagar
                  </Botao>
                )
              }
            />
          ))}
        </Lista>
      )}
    </Cartao>
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
      <Cartao titulo="Férias de verdade" nivelDoTitulo={3} sobre="Marque até quando você vai estar fora. A equipe vê “de férias” ao lado do seu nome e ninguém espera resposta.">
        {ferias.dados?.ferias_ate ? (
          <p className="mt-3 flex flex-wrap items-center gap-3">
            <Selo tom="aviso" ponto>
              De férias até {data(`${ferias.dados.ferias_ate}T12:00:00`)}.
            </Selo>
            <Botao carregando={acao.ocupado} onClick={() => void acao.agir("ferias_marcar", { p_ate: null }, "Bem-vindo de volta.")}>
              Voltar agora
            </Botao>
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <Campo rotulo="Até" type="date" value={ate} min={hoje} max={limite} onChange={(e) => setAte(e.target.value)} className="w-auto" />
            <Botao variante="principal" simbolo={AlarmClock} disabled={!ate} carregando={acao.ocupado} onClick={() => void acao.agir("ferias_marcar", { p_ate: ate }, "Férias marcadas. Bom descanso!")}>
              Marcar férias
            </Botao>
          </div>
        )}
      </Cartao>

      <RedeDeApoio />

      {voluntario && (
        <Cartao titulo="Caixa de críticas anônimas" nivelDoTitulo={3} sobre="O que não vai bem, sem medo. O banco não guarda quem mandou nem a hora; quem cuida da equipe lê. No máximo três por dia.">
          <div className="mt-3 space-y-2">
            <Selecao rotulo="Para quem" value={para} onChange={(e) => setPara(e.target.value)} className="w-auto">
              {PARA.map(([id, nome]) => (
                <option key={id} value={id}>
                  {nome}
                </option>
              ))}
            </Selecao>
            <Area rotulo="A crítica" value={critica} onChange={(e) => setCritica(e.target.value)} maxLength={2000} rows={4} />
            <Botao
              simbolo={Send}
              disabled={critica.trim().length < 10}
              carregando={acao.ocupado}
              onClick={async () => {
                const ok = await acao.agir("critica_enviar", { p_texto: critica, p_para: para }, "Crítica enviada, sem o seu nome. Obrigado pela coragem.");
                if (ok !== null) setCritica("");
              }}
            >
              Enviar sem o meu nome
            </Botao>
          </div>
        </Cartao>
      )}

      <Cartao variante="alerta" titulo="Botão de pânico" nivelDoTitulo={3}>
        <p className="mt-1 text-sm">
          Para quando a sua conta pode ter sido tomada, o celular foi roubado ou você está em risco: encerra a sua sessão em todos os aparelhos e avisa a
          coordenação, que vai falar com você por outro canal. Depois, entre de novo e troque a senha.
        </p>
        {!confirmar ? (
          <Botao perigo simbolo={Siren} className="mt-3" onClick={() => setConfirmar(true)}>
            Apertar o botão de pânico
          </Botao>
        ) : (
          <div className="mt-3 space-y-2">
            <Campo rotulo="O que aconteceu (opcional, vai para a coordenação)" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} placeholder="Roubaram meu celular" />
            <p className="flex flex-wrap gap-2">
              <Botao perigo simbolo={Siren} carregando={acao.ocupado} onClick={() => void panico()}>
                Confirmar: sair de tudo e avisar
              </Botao>
              <Botao onClick={() => setConfirmar(false)}>Cancelar</Botao>
            </p>
          </div>
        )}
      </Cartao>
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
      <CabecalhoDeSecao id="cuidado-equipe" titulo="Cuidado com a equipe" simbolo={HeartPulse} />
      <Cartao titulo="Termômetro das últimas semanas" nivelDoTitulo={3} sobre="De 1 (no limite) a 5 (muito bem). Com menos de cinco respostas, só o total aparece, para ninguém ser identificado.">
        <Aviso texto={resumo.erro} />
        {!resumo.dados && !resumo.erro && <Esqueleto linhas={2} />}
        {resumo.dados && resumo.dados.length === 0 && <Vazio titulo="Ninguém respondeu ainda." />}
        {!!resumo.dados?.length && (
          <Lista rotulo="Termômetro das últimas semanas" plana className="mt-3">
            {resumo.dados.map((s) => (
              <ItemDeLista
                key={s.semana}
                titulo={
                  <>
                    {s.respostas} {s.respostas === 1 ? "resposta" : "respostas"}
                    {s.media !== null && <span className="ml-3 font-semibold">média {String(s.media).replace(".", ",")}</span>}
                  </>
                }
                meta={<span className="font-mono">semana de {data(`${s.semana}T12:00:00`)}</span>}
                selo={s.baixas ? <Selo tom="erro">{s.baixas} no limite ou cansadas: hora de aliviar a carga</Selo> : null}
              />
            ))}
          </Lista>
        )}
      </Cartao>
      <Cartao
        titulo="Caixa de críticas anônimas"
        nivelDoTitulo={3}
        acoes={
          <Botao variante="discreto" pequeno onClick={() => setTodas(!todas)}>
            {todas ? "Só as não lidas" : "Ver também as lidas"}
          </Botao>
        }
      >
        <Aviso texto={criticas.erro || acao.aviso} />
        {!criticas.dados && !criticas.erro && <Esqueleto linhas={2} />}
        {criticas.dados && vistas.length === 0 && <Vazio titulo={todas ? "Nenhuma crítica no último ano." : "Nenhuma crítica nova."} />}
        <ul className="mt-2 space-y-3">
          {vistas.map((c) => (
            <li key={c.id}>
              {/* Não lida: em destaque (fio bordô à esquerda); lida: plana e mais apagada. */}
              <Cartao as="article" variante={c.lida ? "plano" : "destaque"} className={c.lida ? "opacity-70" : undefined}>
                <p className="pn-rotulo-mono">
                  {nomeDe[c.para] ?? c.para} · {data(`${c.dia}T12:00:00`)}
                </p>
                <p className="mt-1 whitespace-pre-line" data-original>
                  {c.texto}
                </p>
                <Botao variante="discreto" pequeno className="mt-1" simbolo={Check} disabled={acao.ocupado} onClick={() => void acao.agir("critica_marcar", { p_id: c.id, p_lida: !c.lida }, c.lida ? "Marcada como não lida." : "Marcada como lida.")}>
                  {c.lida ? "Marcar como não lida" : "Marcar como lida"}
                </Botao>
              </Cartao>
            </li>
          ))}
        </ul>
      </Cartao>
    </section>
  );
}
