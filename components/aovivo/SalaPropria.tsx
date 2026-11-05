// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { getClient, hasBackend } from "@/lib/backend";

type Fase = "fora" | "pedindo" | "dentro";

const MENSAGENS: Record<string, string> = {
  desligada: "A sala própria do instituto não está ligada agora. Use a transmissão indicada abaixo, se houver.",
  ainda_nao: "A aula ainda não começou. Volte quando quem ensina a iniciar.",
  encerrada: "A aula terminou. A gravação, quando houver, aparece nesta página.",
  outra_sala: "Esta aula usa outra sala de vídeo.",
  aula: "Não achei esta aula.",
};

/** Pede ao site um endereço de entrada novo (o token vale poucos segundos e só serve uma vez). */
async function pedirEntrada(aula: string, nome: string): Promise<{ url?: string; erro?: string }> {
  const cabecalho: Record<string, string> = { "Content-Type": "application/json" };
  if (hasBackend) {
    try {
      const { data } = await (await getClient()).auth.getSession();
      if (data.session?.access_token) cabecalho.Authorization = `Bearer ${data.session.access_token}`;
    } catch {
      // sem sessão: entra como quem assiste
    }
  }
  try {
    const r = await fetch("/api/aula-ao-vivo/entrada", { method: "POST", headers: cabecalho, body: JSON.stringify({ aula, nome }), cache: "no-store" });
    return (await r.json()) as { url?: string; erro?: string };
  } catch {
    return { erro: "rede" };
  }
}

/**
 * A sala de vídeo própria do instituto (Galène, em infra/aula-ao-vivo/): vídeo, chat, tela compartilhada e, para quem
 * conduz, gravação. Nada do servidor carrega antes do clique. No celular com internet fraca, a própria sala deixa entrar só
 * com o áudio e limitar a banda; "Abrir em outra aba" dá a tela inteira.
 */
export function SalaPropria({ aula, nome, conduzo, botao }: { aula: string; nome: string; conduzo: boolean; botao: string }) {
  const [fase, setFase] = useState<Fase>("fora");
  const [url, setUrl] = useState("");
  const [aviso, setAviso] = useState("");

  async function entrar(emOutraAba: boolean) {
    setAviso("");
    // A aba precisa abrir já no clique (senão o navegador bloqueia); o endereço entra quando o site responder.
    const aba = emOutraAba ? window.open("", "_blank") : null;
    if (!emOutraAba) setFase("pedindo");
    const r = await pedirEntrada(aula, nome);
    if (!r.url) {
      aba?.close();
      setFase("fora");
      return setAviso(MENSAGENS[r.erro ?? ""] ?? "Não consegui entrar agora. Tente de novo em instantes.");
    }
    if (aba) {
      aba.opener = null;
      aba.location.href = r.url;
    } else {
      setUrl(r.url);
      setFase("dentro");
    }
  }

  if (fase === "dentro" && url) {
    return (
      <section aria-label="Sala de vídeo da aula" className="space-y-2">
        <div className="relative aspect-video max-w-full overflow-hidden border-2 border-ink bg-[#17130e]">
          <iframe src={url} title="Sala de vídeo da aula" allow="camera; microphone; display-capture; fullscreen; autoplay" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full" />
        </div>
        <p className="font-sans text-xs text-ink-soft">
          <button type="button" className="underline hover:text-oxblood" onClick={() => { setUrl(""); setFase("fora"); }}>Sair da sala</button>
          {" · "}
          <button type="button" className="underline hover:text-oxblood" onClick={() => void entrar(true)}>Abrir em outra aba (tela cheia)</button>
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-2 font-sans text-sm">
      <p className="flex flex-wrap items-center gap-3">
        <button type="button" className={botao} disabled={fase === "pedindo"} onClick={() => void entrar(false)}>{fase === "pedindo" ? "Entrando…" : conduzo ? "Abrir a sala do professor" : "Entrar na aula"}</button>
        <button type="button" className="underline hover:text-oxblood" onClick={() => void entrar(true)}>Abrir em outra aba</button>
      </p>
      <p className="text-xs text-ink-soft">
        {conduzo
          ? "Você entra como moderador e pode gravar pelo menu da sala. A gravação fica no servidor do instituto."
          : "Vídeo, chat e tela compartilhada. A aula pode ser gravada: só quem ensina aparece e fala na gravação; você participa pelo chat. Com internet fraca, entre só com o áudio (menu da sala)."}
      </p>
      {aviso && <p role="status" className="text-xs text-oxblood">{aviso}</p>}
    </div>
  );
}
