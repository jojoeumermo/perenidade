// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas da identidade pública opcional ao banco (supabase/migracoes/20261113-alumia-o7-identidade-publica.sql). Na prévia
// (NEXT_PUBLIC_ALUMIA_PREVIA=sim) nada vai a banco nenhum: a escolha da pessoa de exemplo fica na sessão da aba. Sem a migração
// no banco, a pessoa aparece como sempre (codinome) e a escolha fica indisponível.
import { chamar } from "./cliente";
import { CHAVE_DA_PREVIA_DO_PERFIL } from "./codinome-da-conta";
import { arrumarNomePublico, fotoAceitavel, type MinhaIdentidade } from "./identidade";
import { faltaFuncaoNoBanco } from "./reserva";
import { trocarRostoDaConta } from "./rosto-da-conta";

/** Depois de trocar a foto da identidade, o rosto do menu relê o perfil (A10 do Prompt 5). */
function releRostoDaConta(): void {
  chamar<{ avatar?: unknown } | null>("rede_perfil_meu").then(
    (m) => trocarRostoDaConta((m?.avatar ?? null) as Parameters<typeof trocarRostoDaConta>[0]),
    () => undefined,
  );
}

const previa = () => process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim";

/** O que `rede_identidade_de` devolve: só os @ que estão em público; `foto` é o carimbo da foto (nulo = sem foto para mostrar). */
export type IdentidadesPublicas = Record<string, { foto: string | null }>;

// ───────────────────────────── Prévia ─────────────────────────────

const CHAVE = "alumia:previa:identidade";
const HANDLE_DA_PREVIA = "faisca";
const CODINOME_DA_PREVIA = "Faísca";

function lerPrevia(): MinhaIdentidade {
  const padrao: MinhaIdentidade = { modo: "codinome", nome: null, codinome: CODINOME_DA_PREVIA, foto: null, desde: null, disponivel: true, federa: false };
  try {
    const bruto = window.sessionStorage.getItem(CHAVE);
    return bruto ? { ...padrao, ...(JSON.parse(bruto) as Partial<MinhaIdentidade>) } : padrao;
  } catch {
    return padrao;
  }
}

function guardarPrevia(i: MinhaIdentidade): MinhaIdentidade {
  try {
    window.sessionStorage.setItem(CHAVE, JSON.stringify(i));
    // O nome mostrado no perfil de exemplo é o da prévia do perfil livre (components/rede/perfil/livre/dados.ts).
    const bruto = window.sessionStorage.getItem(CHAVE_DA_PREVIA_DO_PERFIL);
    const g = bruto ? (JSON.parse(bruto) as Record<string, unknown>) : {};
    const antes = (g[`meu:${HANDLE_DA_PREVIA}`] as Record<string, unknown> | undefined) ?? {};
    g[`meu:${HANDLE_DA_PREVIA}`] = { ...antes, codinome: i.modo === "publica" ? i.nome : i.codinome };
    window.sessionStorage.setItem(CHAVE_DA_PREVIA_DO_PERFIL, JSON.stringify(g));
  } catch {
    // sem armazenamento: a prévia só não lembra depois de recarregar
  }
  return i;
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hoje = () => new Date().toISOString().slice(0, 10);
const carimbo = (dados: string) => `${dados.length.toString(16)}${dados.slice(-6).replace(/[^A-Za-z0-9]/g, "")}`.slice(0, 8);

// ───────────────────────────── As chamadas ─────────────────────────────

export const redeIdentidade = {
  /** A coordenação abriu a escolha? Responde também a quem não tem conta (o cadastro pergunta). Banco sem a migração: não. */
  async aberta(): Promise<boolean> {
    if (previa()) return true;
    try {
      return (await chamar<boolean>("identidade_publica_aberta")) === true;
    } catch {
      return false;
    }
  },
  /** A minha identidade. Banco sem a migração: codinome, indisponível. */
  async minha(): Promise<MinhaIdentidade> {
    if (previa()) return lerPrevia();
    try {
      return await chamar<MinhaIdentidade>("rede_identidade_minha");
    } catch (e) {
      if (faltaFuncaoNoBanco(e)) return { modo: "codinome", nome: null, codinome: null, foto: null, desde: null, disponivel: false, federa: false };
      throw e;
    }
  },
  /** Passar a aparecer com o nome (ou trocar o nome). Só se chama depois de a pessoa marcar que leu o que muda. */
  async publicar(nome: string): Promise<MinhaIdentidade> {
    if (previa()) {
      await espera(500);
      const antes = lerPrevia();
      return guardarPrevia({ ...antes, modo: "publica", nome: arrumarNomePublico(nome), desde: antes.desde ?? hoje() });
    }
    return chamar<MinhaIdentidade>("rede_identidade_publicar", { p_nome: nome, p_ciente: true });
  },
  /**
   * Voltar ao codinome: o nome sai dos posts, do perfil e dos avisos, e a foto é apagada. Com `novoHandle`, o @ é trocado junto
   * (a ligação entre o nome e o @ antigo fica na memória de quem viu; o @ novo desfaz a ligação daqui em diante).
   */
  async voltar(novoHandle?: string | null): Promise<MinhaIdentidade & { handle?: string | null }> {
    if (previa()) {
      await espera(500);
      return { ...guardarPrevia({ ...lerPrevia(), modo: "codinome", nome: null, foto: null, desde: null }), codinome_trocado: false, handle: novoHandle ?? null };
    }
    return chamar<MinhaIdentidade & { handle?: string | null }>("rede_identidade_codinome", novoHandle ? { p_novo_handle: novoHandle } : {});
  },
  /** Envia a foto já recortada e reencodada (data URL WebP). Confere os bytes antes de mandar; o banco confere de novo. */
  async enviarFoto(dados: string): Promise<MinhaIdentidade> {
    if (!fotoAceitavel(dados)) throw Object.assign(new Error("invalido:imagem"), { code: "invalido:imagem" });
    if (previa()) {
      await espera(500);
      return guardarPrevia({ ...lerPrevia(), foto: { dados, pendente: true } });
    }
    const r = await chamar<MinhaIdentidade>("rede_identidade_foto_enviar", { p_dados: dados });
    releRostoDaConta();
    return r;
  },
  async removerFoto(): Promise<MinhaIdentidade> {
    if (previa()) return guardarPrevia({ ...lerPrevia(), foto: null });
    const r = await chamar<MinhaIdentidade>("rede_identidade_foto_remover");
    releRostoDaConta();
    return r;
  },
  /** Dos @ pedidos, quais estão em público (e o carimbo da foto de cada um). */
  async de(handles: string[]): Promise<IdentidadesPublicas> {
    if (previa()) {
      const eu = lerPrevia();
      return eu.modo === "publica" && handles.includes(HANDLE_DA_PREVIA) ? { [HANDLE_DA_PREVIA]: { foto: eu.foto ? carimbo(eu.foto.dados) : null } } : {};
    }
    return chamar<IdentidadesPublicas>("rede_identidade_de", { p_handles: handles });
  },
  /** A foto pública de um @ (data URL) ou nulo. */
  async foto(handle: string): Promise<string | null> {
    if (previa()) {
      const eu = lerPrevia();
      return handle === HANDLE_DA_PREVIA && eu.modo === "publica" ? (eu.foto?.dados ?? null) : null;
    }
    return chamar<string | null>("rede_identidade_foto", { p_handle: handle });
  },
};
