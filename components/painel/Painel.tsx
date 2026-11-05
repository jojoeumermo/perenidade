// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getClient, hasBackend, rpc, signOut, useMe } from "@/lib/backend";
import { limparIndice } from "@/lib/busca-local";
import { registerDevice } from "@/lib/device";
import { travarAgora } from "@/lib/trava";
import { senhaVazada } from "@/lib/senha";
import { getItem, KEYS, setItem } from "@/lib/storage";
import { minutosOcioso } from "./ocioso";
import { L, useI18n } from "../I18n";
import { Star } from "../Masthead";
import { IdiomaDoPainel, TraduzirPainel } from "./Idioma";
import "@/styles/painel-tema.css";

/** O código do aplicativo autenticador (porta do segundo fator), também só no navegador: traz o resto do painel junto. */
const SegundoFator = dynamic(() => import("./Seguranca").then((m) => m.SegundoFator), { ssr: false });

/**
 * O painel aberto (a casca e as seções), carregado só no navegador: as bibliotecas do painel (Framer Motion, Zustand,
 * Lucide, react-resizable-panels) não entram em nenhuma função do servidor nem pesam no site público. As portas abaixo
 * (carregando, sem conta, segundo fator, senha nova) continuam aqui. Contrato: docs/PAINEL-REDESENHO.md, seção 4.
 */
const Dentro = dynamic(() => import("./casca/Dentro").then((m) => m.Dentro), {
  ssr: false,
  loading: () => (
    <Porta>
      <p className="font-mono text-xs">Abrindo…</p>
    </Porta>
  ),
});

/** Tela inteira para os estados em que o painel ainda não abriu (carregando, sem conta, segundo fator). */
function Porta({ children }: { children: React.ReactNode }) {
  return (
    <div className="painel painel-porta relative flex min-h-screen items-center justify-center overflow-hidden bg-[#17130e] px-4 py-10 font-sans text-sm text-[#efe4c8]">
      <span aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ background: "var(--pn-lutas)" }} />
      <Star className="pointer-events-none absolute -right-24 -bottom-28 h-[28rem] w-[28rem] rotate-12 text-[#6e1f1a]" />
      <TraduzirPainel />
      <div className="painel-surge relative w-full max-w-md">
        <p className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/marca-96.png" alt="" width={40} height={40} className="h-10 w-10" />
          <span>
            <span className="block font-serif text-2xl font-semibold leading-none">Instituto Lúcia</span>
            <span className="mt-1 block font-mono text-[0.65rem] uppercase tracking-[0.3em] text-[#c9a84a]">Painel</span>
          </span>
        </p>
        <div className="mt-8 rounded-[10px] border border-[#3a3226] border-t-[3px] border-t-[#c21f16] bg-[#1f1a14] p-6">{children}</div>
        <p className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
          <L href="/" className="underline hover:text-white">← Voltar ao site</L>
          <IdiomaDoPainel />
        </p>
      </div>
    </div>
  );
}

/**
 * O ambiente de trabalho de quem faz o instituto. É uma tela à parte do site: menu lateral por espaço, uma seção de
 * cada vez, e cada pessoa vê só o que diz respeito à função que recebeu. O registro de seções e a casca moram em
 * casca/Dentro.tsx.
 */
export function Painel() {
  const me = useMe();
  const params = useSearchParams();
  const router = useRouter();
  const { lang } = useI18n();
  const dentro = me.status === "in";

  // Avisa o serviço de que a conta foi aberta neste navegador (gera alerta se for um aparelho novo).
  useEffect(() => {
    if (dentro) void registerDevice();
  }, [dentro]);

  // Fecha a sessão depois do tempo escolhido sem ninguém mexer em nenhuma aba do painel neste navegador.
  useEffect(() => {
    if (!dentro) return;
    let ultimoLocal = 0;
    const tocar = () => {
      // No máximo uma escrita a cada 15 s: rolar a página não pode virar uma enxurrada no armazenamento.
      const agora = Date.now();
      if (agora - ultimoLocal < 15_000) return;
      ultimoLocal = agora;
      setItem(KEYS.painelUltimoUso, String(agora));
    };
    tocar();
    const sinais = ["pointerdown", "keydown", "scroll"] as const;
    for (const sinal of sinais) window.addEventListener(sinal, tocar, { passive: true });
    const relogio = window.setInterval(() => {
      const minutos = minutosOcioso();
      if (minutos === 0) return;
      const ultimo = Number(getItem(KEYS.painelUltimoUso)) || Date.now();
      if (Date.now() - ultimo > minutos * 60_000) void signOut().then(() => router.replace(`/${lang}/entrar`));
    }, 60_000);
    return () => {
      for (const sinal of sinais) window.removeEventListener(sinal, tocar);
      window.clearInterval(relogio);
    };
  }, [dentro, router, lang]);

  if (!hasBackend) return <Porta><p>O painel ainda não foi ligado neste endereço.</p></Porta>;
  if (me.status === "loading") return <Porta><p className="font-mono text-xs">Abrindo…</p></Porta>;
  if (me.status === "out") {
    return (
      <Porta>
        <p className="text-base">Esta é a área de trabalho da equipe.</p>
        <p className="mt-4">
          <L href="/entrar" className="inline-block rounded-md bg-[#efe4c8] px-5 py-2.5 font-medium text-[#17130e] hover:bg-white">Entrar com a minha conta</L>
        </p>
      </Porta>
    );
  }

  const eu = me.me;
  const sair = async () => {
    // O índice de busca das conversas é deste aparelho; sai com a conta.
    await limparIndice().catch(() => undefined);
    travarAgora();
    await signOut();
    router.replace(`/${lang}`);
  };

  // Função sensível com a exigência ligada: nada do painel abre antes do código do aplicativo autenticador.
  if (eu.exige_segundo_fator && !eu.segundo_fator) {
    return (
      <Porta>
        <h1 className="font-serif text-2xl font-semibold">Confirme que é você</h1>
        <p className="mt-2 text-[#b9ad90]">A sua função exige uma segunda confirmação antes de abrir o painel.</p>
        <div className="mt-5 rounded-md bg-parchment p-4 text-ink">
          <SegundoFator me={eu} recarregar={me.reload} />
        </div>
        <button type="button" className="mt-6 cursor-pointer underline hover:text-white" onClick={sair}>Sair</button>
      </Porta>
    );
  }

  // A coordenação redefiniu a senha: antes de qualquer coisa, a pessoa escolhe uma que só ela conhece.
  if (eu.trocar_senha) {
    return (
      <Porta>
        <SenhaNova recarregar={me.reload} sair={sair} />
      </Porta>
    );
  }

  return <Dentro eu={eu} recarregar={me.reload} sair={sair} aba={params.get("aba") ?? "mesa"} />;
}

/** A porta de quem teve a senha redefinida pela coordenação: a senha recebida serviu para entrar, não para ficar. */
function SenhaNova({ recarregar, sair }: { recarregar: () => void; sair: () => void }) {
  const [senha, setSenha] = useState("");
  const [repete, setRepete] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function trocar() {
    setOcupado(true);
    setAviso("");
    try {
      if ((await senhaVazada(senha)) === true) {
        setAviso("Essa senha já apareceu em vazamentos de outros sites. Escolha outra.");
        return;
      }
      const supabase = await getClient();
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;
      await rpc("senha_trocada");
      recarregar();
    } catch {
      setAviso("Não foi possível trocar a senha agora. Saia, entre de novo e tente outra vez.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <h1 className="font-serif text-2xl font-semibold">Escolha uma senha nova</h1>
      <p className="mt-2 text-[#b9ad90]">A coordenação redefiniu a sua senha. Escolha agora uma que só você conheça: pelo menos 12 caracteres (uma frase de quatro ou cinco palavras funciona bem).</p>
      <form className="mt-5 space-y-3" onSubmit={(e) => { e.preventDefault(); void trocar(); }}>
        <label className="block">
          Senha nova
          <input type="password" autoComplete="new-password" minLength={12} maxLength={72} value={senha} onChange={(e) => setSenha(e.target.value)} className="mt-1 w-full rounded-md border border-[#5a4e3a] bg-[#17130e] px-3 py-2 text-[#efe4c8]" />
        </label>
        <label className="block">
          Repita a senha
          <input type="password" autoComplete="new-password" maxLength={72} value={repete} onChange={(e) => setRepete(e.target.value)} className="mt-1 w-full rounded-md border border-[#5a4e3a] bg-[#17130e] px-3 py-2 text-[#efe4c8]" />
        </label>
        <button type="submit" disabled={ocupado || senha.length < 12 || senha !== repete} className="cursor-pointer rounded-md bg-[#efe4c8] px-5 py-2.5 font-medium text-[#17130e] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
          Guardar e abrir o painel
        </button>
      </form>
      <p role="status" className="mt-3 min-h-5 text-[#e0837a]">{aviso}</p>
      <button type="button" className="mt-4 cursor-pointer underline hover:text-white" onClick={sair}>Sair</button>
    </>
  );
}
