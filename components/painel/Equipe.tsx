// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
"use client";

import { useEffect, useState } from "react";
import type { Role } from "@/lib/backend";
import { Aviso, botao, botaoClaro, campo, dataHora, elo, papeis, rotulo, useAcao, useLista } from "./comum";

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

const nomes: Record<string, string> = {
  geral: "Geral",
  pedidos: "Pedidos de ajuda",
  coordenacao: "Liderança",
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

/**
 * Conversa de trabalho da equipe: um canal geral, um por função e um de pedidos entre funções
 * (é por ele que um educador pede um desenho ao design, sem que o design precise ver a fila dos educadores).
 */
export function Equipe() {
  const canais = useLista<{ sala: string; canais: string[] }>("equipe_canais");
  const [canal, setCanal] = useState("geral");
  const lista = useLista<Recado[]>("equipe_listar", { p_canal: canal });
  const { recarregar } = lista;
  const acao = useAcao(recarregar);
  const [texto, setTexto] = useState("");
  const [para, setPara] = useState<Role["papel"]>("design");
  const [respostas, setRespostas] = useState<Record<string, string>>({});

  // Novos recados aparecem sozinhos, sem a pessoa precisar recarregar.
  useEffect(() => {
    const relogio = window.setInterval(() => {
      if (document.visibilityState === "visible") recarregar();
    }, 45000);
    return () => window.clearInterval(relogio);
  }, [recarregar]);

  const enviar = async () => {
    if (await acao.agir("equipe_escrever", { p_canal: canal, p_corpo: texto, p_resposta_a: null, p_para: canal === "pedidos" ? para : null }, "")) setTexto("");
  };

  return (
    <div>
      {canais.dados?.sala ? (
        <p className="border-l-2 border-ok pl-4">
          Voz, vídeo e assuntos sensíveis:{" "}
          <a href={canais.dados.sala} target="_blank" rel="noopener noreferrer" className={elo}>
            abrir a sala cifrada da equipe
          </a>
          .
        </p>
      ) : (
        <p className="border-l-2 border-rule pl-4 text-ink-soft">A liderança ainda não indicou a sala cifrada da equipe (voz, vídeo e assuntos sensíveis).</p>
      )}
      <p className="mt-2 text-ink-soft">
        Este mural serve para combinar o trabalho. Ele fica guardado no banco do site, sem criptografia de ponta a ponta: não escreva aqui endereço, telefone, documento nem nada que possa expor alguém.
      </p>

      <nav aria-label="Canais da equipe" className="mt-5 flex flex-wrap gap-2">
        {canais.dados?.canais.map((id) => (
          <button key={id} type="button" onClick={() => setCanal(id)} aria-current={canal === id ? "page" : undefined} className={`cursor-pointer border-2 px-3 py-1.5 ${canal === id ? "border-ink bg-ink text-parchment" : "border-rule hover:border-gold"}`}>
            {nomes[id] ?? id}
          </button>
        ))}
      </nav>

      <form className="mt-5" onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
        {canal === "pedidos" && (
          <label className="mb-3 block max-w-sm">
            Preciso da ajuda de
            <select value={para} onChange={(e) => setPara(e.target.value as Role["papel"])} className={campo}>
              {funcoes.map((funcao) => (
                <option key={funcao} value={funcao}>
                  {papeis[funcao]}
                </option>
              ))}
            </select>
          </label>
        )}
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} maxLength={4000} aria-label={`Escrever em ${nomes[canal] ?? canal}`} placeholder={canal === "pedidos" ? "Do que você precisa, para quando e para qual aula ou página" : "Escreva para a equipe"} className={campo} />
        <button type="submit" className={`mt-2 ${botao}`} disabled={acao.ocupado || texto.trim().length === 0}>
          {canal === "pedidos" ? "Pedir ajuda" : "Publicar"}
        </button>
      </form>
      <Aviso texto={canais.erro || lista.erro || acao.aviso} />

      <ul className="mt-4 space-y-5">
        {lista.dados?.map((recado) => (
          <li key={recado.id} className={`border border-rule p-4 ${recado.resolvido ? "opacity-70" : "bg-parchment-deep"}`}>
            <p className={rotulo}>
              {recado.autor || "—"} · {dataHora(recado.criado_em)}
              {recado.para && ` · para ${papeis[recado.para]}`}
              {recado.resolvido && " · resolvido"}
            </p>
            <p className="mt-2 whitespace-pre-line font-serif text-lg">{recado.corpo}</p>
            <ul className="mt-3 space-y-2 border-l-2 border-rule pl-4">
              {recado.respostas.map((resposta) => (
                <li key={resposta.id}>
                  <span className={rotulo}>
                    {resposta.autor || "—"} · {dataHora(resposta.criado_em)}
                  </span>
                  <p className="whitespace-pre-line">{resposta.corpo}</p>
                </li>
              ))}
            </ul>
            <form
              className="mt-3 flex flex-wrap gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await acao.agir("equipe_escrever", { p_canal: canal, p_corpo: respostas[recado.id] ?? "", p_resposta_a: recado.id, p_para: null }, "")) setRespostas({ ...respostas, [recado.id]: "" });
              }}
            >
              <input value={respostas[recado.id] ?? ""} onChange={(e) => setRespostas({ ...respostas, [recado.id]: e.target.value })} maxLength={4000} aria-label="Responder" placeholder="Responder" className={`${campo} mt-0 min-w-52 flex-1`} />
              <button type="submit" className={botaoClaro} disabled={acao.ocupado || !(respostas[recado.id] ?? "").trim()}>
                Responder
              </button>
            </form>
            <p className="mt-2 flex gap-4 text-ink-soft">
              <button type="button" className={elo} onClick={() => acao.agir("equipe_marcar", { p_id: recado.id, p_resolvido: !recado.resolvido }, "")}>
                {recado.resolvido ? "Reabrir" : "Marcar como resolvido"}
              </button>
              {recado.meu && (
                <button type="button" className={elo} onClick={() => acao.agir("equipe_apagar", { p_id: recado.id }, "Recado apagado.")}>
                  Apagar
                </button>
              )}
            </p>
          </li>
        ))}
      </ul>
      {lista.dados?.length === 0 && <p className="mt-4 text-ink-soft">Nada por aqui ainda.</p>}
    </div>
  );
}
