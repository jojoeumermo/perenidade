// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";
//
// O lado do navegador de "Meus dados": a situação, confirmar o código do aplicativo autenticador (a sessão é renovada com o
// "totp" de agora, que o banco exige nos últimos 10 minutos), baixar a cópia (app/api/rede/exportar), pedir e cancelar o
// apagamento e (onda 9) a saída só da Alumia, que tira a pessoa da rede e deixa a conta do Instituto. Na prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim) nada vai a banco nenhum: um dublê na memória da aba faz a tela andar,
// e o "baixar" só mostra a mensagem, sem arquivo.
import { BackendError, getClient, hasBackend, rpc } from "../../backend";
import { lerLinhas } from "../linha-aberta";
import { previaLigada } from "../publicar/alumia2";

export interface SituacaoDeMeusDados {
  palavra: string;
  tem_funcao: boolean;
  /** Onda 9: administra a Alumia (não sai por aqui: pede à coordenação). */
  admin_alumia?: boolean;
  fator_recente: boolean;
  exportou_hoje: boolean;
  /** O pedido em andamento. `so_alumia`: é a saída só da Alumia (a conta do Instituto fica), não o apagamento da conta. */
  apagamento: { pedido_em: string; apagar_em: string; so_alumia?: boolean } | null;
}

export type ResultadoDoCodigo = "ok" | "errado" | "sem_fator";

const previa = () => previaLigada();

// O dublê da prévia: uma conta de exemplo, sem nada guardado fora desta aba.
let exemplo: SituacaoDeMeusDados = { palavra: "@faisca", tem_funcao: false, fator_recente: false, exportou_hoje: false, apagamento: null };
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function token(): Promise<string> {
  const supabase = await getClient();
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  if (!t) throw new BackendError("entre_primeiro");
  return t;
}

export const meusDados = {
  situacao: async (): Promise<SituacaoDeMeusDados> => {
    if (previa()) return { ...exemplo };
    return rpc<SituacaoDeMeusDados>("rede_meusdados_situacao");
  },

  /** Confere o código de 6 números com o fator do aplicativo autenticador da conta. */
  confirmarCodigo: async (codigo: string): Promise<ResultadoDoCodigo> => {
    const digitos = codigo.replace(/\D/g, "");
    if (previa()) {
      await espera(300);
      if (digitos.length !== 6) return "errado";
      exemplo = { ...exemplo, fator_recente: true };
      return "ok";
    }
    if (!hasBackend) throw new BackendError("sem_servico");
    const supabase = await getClient();
    const { data } = await supabase.auth.mfa.listFactors();
    const fator = (data?.totp ?? []).find((f) => f.status === "verified");
    if (!fator) return "sem_fator";
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fator.id, code: digitos });
    return error ? "errado" : "ok";
  },

  /** Baixa a cópia: o servidor monta o .zip e o navegador salva. Devolve o nome do arquivo e quantos vieram como link. */
  baixar: async (lang: string): Promise<{ nome: string; links: number }> => {
    if (previa()) {
      await espera(900);
      exemplo = { ...exemplo, exportou_hoje: true };
      return { nome: `alumia-meus-dados-${new Date().toISOString().slice(0, 10)}.zip`, links: 0 };
    }
    let linhas: unknown[] = [];
    try {
      linhas = lerLinhas();
    } catch {
      linhas = [];
    }
    let r: Response;
    try {
      r = await fetch("/api/rede/exportar", {
        method: "POST",
        headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ lang, linhas }),
        cache: "no-store",
      });
    } catch {
      throw new BackendError("sem_conexao");
    }
    if (!r.ok) {
      const corpo = (await r.json().catch(() => null)) as { erro?: string } | null;
      throw new BackendError(corpo?.erro ?? "falha");
    }
    const nome = /filename="([^"]+)"/.exec(r.headers.get("content-disposition") ?? "")?.[1] ?? "alumia-meus-dados.zip";
    const blob = await r.blob();
    const endereco = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = endereco;
    a.download = nome;
    a.rel = "noopener";
    document.body.append(a);
    a.click();
    a.remove();
    // O arquivo já foi entregue ao navegador: o endereço na memória sai logo depois.
    setTimeout(() => URL.revokeObjectURL(endereco), 30_000);
    return { nome, links: Number(r.headers.get("x-links-temporarios") ?? "0") || 0 };
  },

  apagar: async (palavra: string): Promise<{ pedido_em: string; apagar_em: string }> => {
    if (previa()) {
      await espera(400);
      if (palavra.trim().toLowerCase() !== exemplo.palavra.toLowerCase()) throw new BackendError("confirmacao_errada");
      const pedido = { pedido_em: new Date().toISOString(), apagar_em: new Date(Date.now() + 7 * 86_400_000).toISOString() };
      exemplo = { ...exemplo, apagamento: pedido };
      return pedido;
    }
    return rpc("rede_meusdados_apagar", { p_palavra: palavra });
  },

  /** Sair só da Alumia: o mesmo prazo de 7 dias do apagamento, e a conta do Instituto continua. */
  sair: async (palavra: string): Promise<{ pedido_em: string; apagar_em: string; so_alumia: boolean }> => {
    if (previa()) {
      await espera(400);
      if (palavra.trim().toLowerCase() !== exemplo.palavra.toLowerCase()) throw new BackendError("confirmacao_errada");
      const pedido = { pedido_em: new Date().toISOString(), apagar_em: new Date(Date.now() + 7 * 86_400_000).toISOString(), so_alumia: true };
      exemplo = { ...exemplo, apagamento: pedido };
      return pedido;
    }
    return rpc("rede_meusdados_sair", { p_palavra: palavra });
  },

  cancelar: async (): Promise<{ ok: boolean; fediverso_desligado?: boolean }> => {
    if (previa()) {
      await espera(400);
      exemplo = { ...exemplo, apagamento: null };
      return { ok: true, fediverso_desligado: false };
    }
    return rpc("rede_meusdados_cancelar");
  },
};
