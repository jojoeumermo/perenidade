// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { BackendError, rpc } from "@/lib/backend";
import { type Chaveiro, chaveiroDe } from "@/lib/chaveiro";
import { Aviso, data, elo, rotulo, textoDoErro, useLista } from "./comum";

/** O texto cifrado precisa caber no banco (4000 caracteres); acento e emoji ocupam mais do que uma letra simples. */
export const LIMITE_CIFRADO = 4000;
export const ANTIGA = "Mensagem antiga, da época da frase da equipe. Ela não abre mais e some sozinha em até 30 dias.";
export const SEM_CHAVE = "Esta mensagem ainda não abre neste aparelho. A chave chega assim que alguém da conversa estiver com o painel aberto.";

/** O chaveiro deste aparelho, pronto para cifrar e abrir. Na primeira vez, cria e registra o par de chaves do aparelho. */
export function useChaveiro(usuario: string) {
  const [estado, setEstado] = useState<{ chaveiro: Chaveiro | null; erro: string }>({ chaveiro: null, erro: "" });
  useEffect(() => {
    let cancelado = false;
    chaveiroDe(usuario).then(
      (chaveiro) => !cancelado && setEstado({ chaveiro, erro: "" }),
      (erro) => !cancelado && setEstado({ chaveiro: null, erro: textoDoErro(erro) }),
    );
    return () => {
      cancelado = true;
    };
  }, [usuario]);
  return estado;
}

export interface Cifrado {
  /** Identificador único do item (a mensagem). */
  id: string;
  conversa: string;
  corpo: string;
  contexto: string;
}

/**
 * Abre neste aparelho os textos cifrados. Para cada item: o texto aberto; null enquanto a chave não chegou (é tentado de
 * novo a cada quinze segundos, até algum colega repassar a chave); ausente enquanto ainda está abrindo.
 */
export function useAbertos(chaveiro: Chaveiro | null, itens: Cifrado[]) {
  const [abertos, setAbertos] = useState<Record<string, string | null>>({});
  const [rodada, setRodada] = useState(0);
  const faltam = itens.filter((item) => typeof abertos[item.id] !== "string");
  const assinatura = faltam.map((item) => item.id).join(",");
  const esperando = faltam.some((item) => abertos[item.id] === null);
  const lista = useRef(faltam);
  useEffect(() => {
    lista.current = faltam;
  });

  useEffect(() => {
    if (!chaveiro || !assinatura) return;
    let cancelado = false;
    void Promise.all(
      lista.current.map(async (item) => {
        if (item.corpo.startsWith("c1.")) return [item.id, ANTIGA] as const;
        return [item.id, await chaveiro.abrir(item.conversa, item.corpo, item.contexto).catch(() => null)] as const;
      }),
    ).then((pares) => {
      if (!cancelado) setAbertos((antes) => ({ ...antes, ...Object.fromEntries(pares) }));
    });
    return () => {
      cancelado = true;
    };
  }, [chaveiro, assinatura, rodada]);

  useEffect(() => {
    if (!esperando) return;
    const relogio = window.setTimeout(() => setRodada((n) => n + 1), 15_000);
    return () => window.clearTimeout(relogio);
  }, [esperando, rodada]);

  return abertos;
}

/**
 * Enquanto o painel está aberto, este aparelho repassa as chaves que tem para aparelhos de colegas que ainda não as
 * receberam (alguém que entrou num grupo, um celular novo). É o que faz a conversa abrir para quem chegou depois.
 */
export function Repasse({ usuario }: { usuario: string }) {
  const { chaveiro } = useChaveiro(usuario);
  useEffect(() => {
    if (!chaveiro) return;
    const repassar = () => {
      if (document.visibilityState === "visible") void chaveiro.repassar().catch(() => undefined);
    };
    repassar();
    const relogio = window.setInterval(repassar, 30_000);
    return () => window.clearInterval(relogio);
  }, [chaveiro]);
  return null;
}

/** Cifra e envia; se a chave foi trocada nesse meio-tempo (alguém saiu), cifra de novo com a nova e tenta mais uma vez. */
export async function enviarCifrado(chaveiro: Chaveiro, conversa: string, texto: string, contexto: string, enviar: (corpo: string) => Promise<unknown>) {
  for (let tentativa = 0; ; tentativa++) {
    const corpo = await chaveiro.cifrar(conversa, texto, contexto);
    if (corpo.length > LIMITE_CIFRADO) throw new BackendError("mensagem_longa");
    try {
      return await enviar(corpo);
    } catch (erro) {
      if (tentativa > 0 || !(erro instanceof BackendError) || erro.code !== "chave_desatualizada") throw erro;
    }
  }
}

interface Aparelho {
  id: string;
  rotulo: string;
  criado_em: string;
  visto_em: string;
}

/** Os aparelhos que abrem as conversas desta conta. Remover um troca a chave de todas as conversas. */
export function Aparelhos({ atual }: { atual: string | null }) {
  const lista = useLista<Aparelho[]>("chat_aparelhos_meus");
  const [aviso, setAviso] = useState("");

  async function remover(aparelho: Aparelho) {
    if (!window.confirm(`Remover "${aparelho.rotulo || "aparelho sem nome"}"? Ele deixa de abrir as conversas, e as conversas trocam de chave.`)) return;
    setAviso("");
    try {
      await rpc("chat_aparelho_remover", { p_id: aparelho.id });
      lista.recarregar();
    } catch (erro) {
      setAviso(textoDoErro(erro));
    }
  }

  return (
    <details className="text-xs text-ink-soft">
      <summary className="cursor-pointer hover:text-ink">Aparelhos com acesso às suas conversas{lista.dados ? ` (${lista.dados.length})` : ""}</summary>
      <p className="mt-2">Cada aparelho tem a própria chave, criada no navegador. Se perder um celular ou não usar mais um computador, remova-o aqui. Remover não encerra a sessão: para isso, use “Sair de todos os aparelhos” em Minha conta.</p>
      <ul className="mt-2 divide-y divide-rule border-y border-rule">
        {lista.dados?.map((aparelho) => (
          <li key={aparelho.id} className="flex items-baseline justify-between gap-3 py-1.5">
            <span className="min-w-0">
              <span className="block truncate font-semibold text-ink">{aparelho.rotulo || "Aparelho sem nome"}{aparelho.id === atual && " (este)"}</span>
              <span className="block">desde {data(aparelho.criado_em)} · usado em {data(aparelho.visto_em)}</span>
            </span>
            {aparelho.id !== atual && (
              <button type="button" className={`${elo} shrink-0`} onClick={() => void remover(aparelho)}>
                Remover
              </button>
            )}
          </li>
        ))}
      </ul>
      <Aviso texto={lista.erro || aviso} />
    </details>
  );
}

/** Como a cifra funciona, em poucas linhas, para quem quiser saber. */
export function ComoFunciona() {
  return (
    <details className="text-xs text-ink-soft">
      <summary className={`${rotulo} cursor-pointer hover:text-ink`}>Sigilo</summary>
      <div className="mt-2 space-y-1.5">
        <p>Tudo é cifrado neste aparelho antes de sair, e só os aparelhos de quem participa da conversa abrem. O banco do instituto guarda apenas o texto cifrado: quem tiver acesso a ele, inclusive a coordenação, não lê as conversas.</p>
        <p>Quando alguém sai de um grupo, a chave é trocada na mensagem seguinte. Nada fica guardado por mais de 30 dias, e a autodestruição apaga antes.</p>
        <p>Não escreva endereço, telefone nem documento de ninguém, mesmo aqui.</p>
      </div>
    </details>
  );
}
