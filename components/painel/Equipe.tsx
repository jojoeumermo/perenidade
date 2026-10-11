// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { rpc, type Role } from "@/lib/backend";
import { deriveKey, PROOF, recallKey, rememberKey, seal, unseal } from "@/lib/cipher";
import { previewFile } from "@/lib/upload";
import { Aviso, botao, botaoClaro, campo, data, dataHora, elo, papeis, rotulo, textoDoErro, useAcao, useLista } from "./comum";

interface Resposta {
  id: string;
  autor: string;
  meu: boolean;
  corpo: string;
  criado_em: string;
}

interface Recado extends Resposta {
  para: Role["papel"] | null;
  resolvido: boolean;
  respostas: Resposta[];
}

interface Canais {
  sala: string;
  sal: string;
  prova: string;
  canais: string[];
}

const nomes: Record<string, string> = {
  geral: "Geral",
  pedidos: "Pedidos de ajuda",
  coordenacao: "Coordenação",
  curadoria: "Curadoria",
  educacao: "Educadores",
  revisao: "Revisão",
  traducao: "Tradução",
  jornalismo: "Jornal",
  mentoria: "Reforço",
  design: "Design",
  desenvolvimento: "Desenvolvimento",
};

const funcoes: Role["papel"][] = ["design", "desenvolvimento", "educacao", "curadoria", "revisao", "traducao", "jornalismo", "mentoria", "coordenacao"];
/** O texto cifrado ocupa mais espaço do que o aberto: este limite garante que ele cabe no banco. */
const MAXIMO = 2000;
const ILEGIVEL = "[não foi possível abrir esta mensagem com a chave atual]";

/**
 * Conversa de trabalho da equipe: um canal geral, um por função e um de pedidos entre funções.
 * Tudo é cifrado neste aparelho com a chave da equipe antes de ser enviado, e some depois de trinta dias.
 */
export function Equipe({ lider }: { lider: boolean }) {
  const canais = useLista<Canais>("equipe_canais");
  const [chave, setChave] = useState<CryptoKey | null>(null);
  const [canal, setCanal] = useState("geral");
  const lista = useLista<Recado[]>("equipe_listar", { p_canal: canal });
  const { recarregar } = lista;
  const acao = useAcao(recarregar);
  const [texto, setTexto] = useState("");
  const [para, setPara] = useState<Role["papel"]>("design");
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [abertos, setAbertos] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState("");
  const dados = canais.dados;

  // A chave guardada nesta aba só vale se ainda abrir a prova que está no banco.
  useEffect(() => {
    if (!dados?.prova) return;
    let cancelado = false;
    void recallKey().then(async (guardada) => {
      if (!guardada || cancelado) return;
      if ((await unseal(guardada, dados.prova)) === PROOF) {
        if (!cancelado) setChave(guardada);
      } else {
        void rememberKey(null);
      }
    });
    return () => {
      cancelado = true;
    };
  }, [dados?.prova]);

  // Abre no aparelho o que veio cifrado do banco.
  useEffect(() => {
    if (!chave || !lista.dados) return;
    let cancelado = false;
    const todos = lista.dados.flatMap((recado) => [recado, ...recado.respostas]);
    void Promise.all(todos.map(async (item) => [item.id, (await unseal(chave, item.corpo)) ?? ILEGIVEL] as const)).then((pares) => {
      if (!cancelado) setAbertos(Object.fromEntries(pares));
    });
    return () => {
      cancelado = true;
    };
  }, [chave, lista.dados]);

  // Novos recados aparecem sozinhos, sem a pessoa precisar recarregar.
  useEffect(() => {
    const relogio = window.setInterval(() => {
      if (document.visibilityState === "visible") recarregar();
    }, 45000);
    return () => window.clearInterval(relogio);
  }, [recarregar]);

  async function escrever(corpo: string, respostaA: string | null) {
    if (!chave) return false;
    return Boolean(await acao.agir("equipe_escrever", { p_canal: canal, p_corpo: await seal(chave, corpo.trim()), p_resposta_a: respostaA, p_para: !respostaA && canal === "pedidos" ? para : null }, ""));
  }

  async function apagarTudo() {
    if (!window.confirm("Apagar agora todas as conversas da equipe, de todos os canais? Isso não tem volta.")) return;
    try {
      const resposta = await rpc<{ apagadas: number }>("equipe_apagar_tudo");
      setAviso(`Tudo apagado (${resposta.apagadas} mensagens).`);
      setAbertos({});
      recarregar();
    } catch (erro) {
      setAviso(textoDoErro(erro));
    }
  }

  if (!dados) return <Aviso texto={canais.erro || "Carregando…"} />;

  return (
    <div>
      {dados.sala ? (
        <p className="border-l-2 border-ok pl-4">
          Voz e vídeo:{" "}
          <a href={dados.sala} target="_blank" rel="noopener noreferrer" className={elo}>
            abrir a sala da equipe
          </a>
          .
        </p>
      ) : (
        <p className="border-l-2 border-rule pl-4 text-ink-soft">A coordenação ainda não indicou a sala de voz e vídeo da equipe.</p>
      )}
      <p className="mt-2 max-w-3xl text-ink-soft">
        As mensagens são cifradas neste aparelho antes de sair: o que fica guardado é ilegível sem a chave da equipe. Elas somem sozinhas depois de trinta dias, e a coordenação pode apagar tudo de uma vez. Mesmo assim, não escreva aqui endereço, telefone nem documento de ninguém.
      </p>

      {!chave ? (
        <Chave dados={dados} lider={lider} aoAbrir={(nova) => { setChave(nova); canais.recarregar(); recarregar(); }} />
      ) : (
        <>
          <nav aria-label="Canais da equipe" className="mt-5 flex flex-wrap gap-2">
            {dados.canais.map((id) => (
              <button key={id} type="button" onClick={() => setCanal(id)} aria-current={canal === id ? "page" : undefined} className={`cursor-pointer border-2 px-3 py-1.5 ${canal === id ? "border-ink bg-ink text-parchment" : "border-rule hover:border-ink"}`}>
                {nomes[id] ?? id}
              </button>
            ))}
          </nav>

          <form className="mt-5" onSubmit={async (e) => { e.preventDefault(); if (await escrever(texto, null)) setTexto(""); }}>
            {canal === "pedidos" && (
              <label className="mb-3 block max-w-sm">
                Preciso da ajuda de
                <select value={para} onChange={(e) => setPara(e.target.value as Role["papel"])} className={campo}>
                  {funcoes.map((funcao) => (
                    <option key={funcao} value={funcao}>{papeis[funcao]}</option>
                  ))}
                </select>
              </label>
            )}
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} maxLength={MAXIMO} aria-label={`Escrever em ${nomes[canal] ?? canal}`} placeholder={canal === "pedidos" ? "Do que você precisa, para quando e para qual aula ou matéria." : "Escreva para a equipe…"} className={campo} />
            <button type="submit" className={`mt-2 ${botao}`} disabled={acao.ocupado || texto.trim().length === 0}>
              {canal === "pedidos" ? "Pedir ajuda" : "Publicar"}
            </button>
          </form>
          <Aviso texto={lista.erro || acao.aviso || aviso} />

          <ul className="mt-4 space-y-5">
            {lista.dados?.map((recado) => (
              <li key={recado.id} className={`border border-rule p-4 ${recado.resolvido ? "opacity-70" : "bg-parchment-deep"}`}>
                <p className={rotulo}>
                  {recado.autor || "—"} · {dataHora(recado.criado_em)}
                  {recado.para && ` · para ${papeis[recado.para]}`}
                  {recado.resolvido && " · resolvido"}
                </p>
                <p className="mt-2 whitespace-pre-line font-serif text-lg">{abertos[recado.id] ?? "…"}</p>
                <ul className="mt-3 space-y-2 border-l-2 border-rule pl-4">
                  {recado.respostas.map((resposta) => (
                    <li key={resposta.id}>
                      <span className={rotulo}>
                        {resposta.autor || "—"} · {dataHora(resposta.criado_em)}
                      </span>
                      <p className="whitespace-pre-line">{abertos[resposta.id] ?? "…"}</p>
                    </li>
                  ))}
                </ul>
                <form
                  className="mt-3 flex flex-wrap gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (await escrever(respostas[recado.id] ?? "", recado.id)) setRespostas({ ...respostas, [recado.id]: "" });
                  }}
                >
                  <input value={respostas[recado.id] ?? ""} onChange={(e) => setRespostas({ ...respostas, [recado.id]: e.target.value })} maxLength={MAXIMO} aria-label="Responder" placeholder="Responder" className={`${campo} mt-0 min-w-40 flex-1`} />
                  <button type="submit" className={botaoClaro} disabled={acao.ocupado || !(respostas[recado.id] ?? "").trim()}>
                    Responder
                  </button>
                </form>
                <p className="mt-2 flex gap-4 text-ink-soft">
                  <button type="button" className={elo} onClick={() => acao.agir("equipe_marcar", { p_id: recado.id, p_resolvido: !recado.resolvido }, "")}>
                    {recado.resolvido ? "Reabrir" : "Marcar como resolvido"}
                  </button>
                  {(recado.meu || lider) && (
                    <button type="button" className={elo} onClick={() => acao.agir("equipe_apagar", { p_id: recado.id }, "Recado apagado.")}>
                      Apagar
                    </button>
                  )}
                </p>
              </li>
            ))}
          </ul>
          {lista.dados?.length === 0 && <p className="mt-4 text-ink-soft">Nada por aqui ainda.</p>}

          <p className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t border-rule pt-4 text-ink-soft">
            <button type="button" className={elo} onClick={() => { void rememberKey(null); setChave(null); setAbertos({}); }}>
              Fechar a conversa neste aparelho
            </button>
            {lider && (
              <button type="button" className={`${elo} text-oxblood`} onClick={() => void apagarTudo()}>
                Apagar todas as conversas agora
              </button>
            )}
          </p>
          {lider && (
            <details className="mt-3">
              <summary className="cursor-pointer text-ink-soft hover:text-oxblood">Trocar a chave da equipe</summary>
              <p className="mt-2 max-w-2xl text-ink-soft">Troque a chave quando alguém sair da equipe. As conversas guardadas são apagadas na troca, porque ficariam ilegíveis com a chave nova.</p>
              <Chave dados={{ ...dados, prova: "" }} lider aoAbrir={(nova) => { setChave(nova); setAbertos({}); canais.recarregar(); recarregar(); }} />
            </details>
          )}
        </>
      )}

      <Apoios />
    </div>
  );
}

/** Pede a frase da equipe. A coordenação define a frase na primeira vez; os demais digitam a que receberam. */
function Chave({ dados, lider, aoAbrir }: { dados: Canais; lider: boolean; aoAbrir: (chave: CryptoKey) => void }) {
  const [frase, setFrase] = useState("");
  const [repete, setRepete] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const definir = dados.prova === "";

  if (definir && !lider) return <p className="mt-5 border-l-2 border-rule pl-4">A coordenação ainda não definiu a chave da conversa. Assim que definir, ela passa a frase para a equipe por fora do site.</p>;

  async function abrir() {
    setOcupado(true);
    setAviso("");
    try {
      const chave = await deriveKey(frase, dados.sal);
      if (definir) {
        await rpc("equipe_chave_definir", { p_prova: await seal(chave, PROOF) });
      } else if ((await unseal(chave, dados.prova)) !== PROOF) {
        setAviso("Essa não é a chave da equipe. Confira com a coordenação.");
        return;
      }
      await rememberKey(chave);
      setFrase("");
      setRepete("");
      aoAbrir(chave);
    } catch (erro) {
      setAviso(textoDoErro(erro));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form className="mt-5 max-w-xl space-y-3 border border-rule bg-parchment-deep p-4" onSubmit={(e) => { e.preventDefault(); void abrir(); }}>
      <h3 className="font-serif text-xl font-semibold">{definir ? "Definir a chave da equipe" : "Chave da equipe"}</h3>
      <p className="text-ink-soft">
        {definir
          ? "Escolha uma frase longa (quatro ou cinco palavras ao acaso) e passe para a equipe por fora do site, de preferência em pessoa. O site não guarda a frase: se ela se perder, as conversas guardadas não abrem mais."
          : "Digite a frase que a coordenação passou para você. Ela não é enviada a lugar nenhum: serve só para abrir as mensagens neste aparelho, e é pedida de novo quando você fechar a aba."}
      </p>
      <label className="block">
        Frase
        <input type="password" required minLength={definir ? 16 : 1} maxLength={200} autoComplete="off" value={frase} onChange={(e) => setFrase(e.target.value)} className={campo} />
      </label>
      {definir && (
        <label className="block">
          Repita a frase
          <input type="password" required maxLength={200} autoComplete="off" value={repete} onChange={(e) => setRepete(e.target.value)} className={campo} />
        </label>
      )}
      <button type="submit" className={botao} disabled={ocupado || (definir ? frase.length < 16 || frase !== repete : frase.length === 0)}>
        {definir ? "Definir a chave" : "Abrir a conversa"}
      </button>
      <Aviso texto={aviso} />
    </form>
  );
}

interface Arquivo {
  id: string;
  caminho: string;
  nome: string;
  status: string;
  criado_em: string;
  de: string;
  meu: boolean;
  apoios: number;
  apoiei: boolean;
}

/** Imagem ou PDF enviado por alguém da equipe só segue para a decisão da coordenação depois de dois apoios de colegas. */
function Apoios() {
  const lista = useLista<Arquivo[]>("arquivos_listar");
  const acao = useAcao(lista.recarregar);
  const esperando = lista.dados?.filter((arquivo) => arquivo.status === "pendente") ?? [];

  async function ver(caminho: string) {
    try {
      window.open(await previewFile(caminho), "_blank", "noopener,noreferrer");
    } catch {
      acao.setAviso("Não foi possível abrir o arquivo.");
    }
  }

  if (esperando.length === 0) return null;
  return (
    <section className="mt-10 border-t-2 border-ink pt-6">
      <h2 className="font-serif text-2xl font-semibold">Imagens e arquivos esperando o apoio da equipe</h2>
      <p className="mt-1 max-w-3xl text-ink-soft">Nada que tenha imagem vai ao ar por decisão de uma pessoa só. Abra, olhe com calma e apoie se estiver correto, bem-feito e dentro das regras da casa. Com dois apoios, a coordenação pode aprovar.</p>
      <Aviso texto={lista.erro || acao.aviso} />
      <ul className="mt-2 divide-y divide-rule border-y border-rule">
        {esperando.map((arquivo) => (
          <li key={arquivo.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
            <span>
              <strong>{arquivo.nome}</strong>{" "}
              <span className="text-ink-soft">
                · {arquivo.caminho.split(".").pop()?.toUpperCase()} · {data(arquivo.criado_em)} · {arquivo.meu ? "enviado por você" : `de ${arquivo.de || "—"}`} · {arquivo.apoios} de 2 apoios
              </span>
            </span>
            <span className="flex gap-4">
              <button type="button" className={elo} onClick={() => void ver(arquivo.caminho)}>
                Ver
              </button>
              {!arquivo.meu && (
                <button type="button" className={elo} disabled={acao.ocupado} onClick={() => acao.agir("arquivo_apoiar", { p_id: arquivo.id, p_apoiar: !arquivo.apoiei }, arquivo.apoiei ? "Apoio retirado." : "Apoio registrado.")}>
                  {arquivo.apoiei ? "Retirar apoio" : "Apoiar"}
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
