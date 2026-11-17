// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O dublê da ponte com a Escola para a prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim): as mesmas respostas do banco, na memória da aba.
// Pessoas e textos inventados; nada sai do aparelho.
import { faixaDe, nivelDa, type Inscricao, type Medalha, type MinhaInscricao } from "./regras";

interface MedalhaGuardada {
  medalha: Medalha;
  alvo: string;
  progresso: number;
  mostrar: boolean;
}

const estado = {
  medalhas: [
    { medalha: "trilha", alvo: "historia-do-brasil", progresso: 0, mostrar: true },
    { medalha: "trilha", alvo: "introducao-ao-marxismo", progresso: 0, mostrar: false },
    { medalha: "redacao", alvo: "", progresso: 12, mostrar: true },
    { medalha: "monitoria", alvo: "", progresso: 3, mostrar: false },
  ] as MedalhaGuardada[],
  ajudas: 11,
  faixaLigada: false,
  minha: null as (MinhaInscricao & { id: string }) | null,
  mural: [
    { id: "m1", nome: "Estrela do Sertão", handle: null, como: "codinome", curso: "Medicina", instituicao: "Federal da Bahia", recado: "Três anos de cursinho popular. A roda de sábado me segurou.", mes: "2026-11", minha: false },
    { id: "m2", nome: "Rosa Operária", handle: "rosa_operaria", como: "perfil", curso: "Pedagogia", instituicao: null, recado: "Primeira da família!", mes: "2026-10", minha: false },
    { id: "m3", nome: "Lampião Leitor", handle: null, como: "codinome", curso: "Engenharia Civil", instituicao: "Estadual do Ceará", recado: null, mes: "2026-10", minha: false },
    { id: "m4", nome: "Maré Cheia", handle: "mare_cheia", como: "perfil", curso: null, instituicao: null, recado: "Passei! Agora é ajudar quem vem.", mes: "2026-09", minha: false },
    { id: "m5", nome: "Quilombo em Pé", handle: null, como: "codinome", curso: "Direito", instituicao: "Federal de Pernambuco", recado: null, mes: "2026-08", minha: false },
  ] as Inscricao[],
};

const espera = () => new Promise((r) => setTimeout(r, 120));

export async function duble<T>(funcao: string, a: Record<string, unknown>): Promise<T> {
  await espera();
  const r = (() => {
    switch (funcao) {
      case "alumia_conquistas_minhas":
        return {
          medalhas: estado.medalhas.map((m) => ({ ...m, nivel: nivelDa(m.medalha, m.progresso) })),
          faixa: { mostrar: estado.faixaLigada, faixa: faixaDe(estado.ajudas) },
        };
      case "alumia_conquista_mostrar": {
        const m = estado.medalhas.find((x) => x.medalha === a.p_medalha && x.alvo === (a.p_alvo ?? ""));
        if (!m) throw new Error("nao_encontrado");
        m.mostrar = Boolean(a.p_mostrar);
        return { mostrar: m.mostrar };
      }
      case "alumia_conquista_trilha": {
        const t = String(a.p_trilha ?? "");
        estado.medalhas = estado.medalhas.filter((x) => !(x.medalha === "trilha" && x.alvo === t));
        if (a.p_ligar) estado.medalhas.push({ medalha: "trilha", alvo: t, progresso: 0, mostrar: false });
        estado.medalhas.sort((x, y) => x.medalha.localeCompare(y.medalha) || x.alvo.localeCompare(y.alvo));
        return { trilha: t, ligada: Boolean(a.p_ligar) };
      }
      case "alumia_conquista_apagar": {
        const antes = estado.medalhas.length;
        estado.medalhas = estado.medalhas.filter((x) => !(x.medalha === a.p_medalha && x.alvo === (a.p_alvo ?? "")));
        return { apagada: estado.medalhas.length < antes };
      }
      case "alumia_reputacao_mostrar":
        estado.faixaLigada = Boolean(a.p_mostrar);
        return { mostrar: estado.faixaLigada };
      case "alumia_conquistas_de":
        return {
          medalhas: estado.medalhas.filter((m) => m.mostrar).map((m) => ({ medalha: m.medalha, alvo: m.alvo, nivel: nivelDa(m.medalha, m.progresso) })),
          faixa: estado.faixaLigada ? faixaDe(estado.ajudas) : null,
          meu: true,
        };
      case "alumia_aula_topico":
        // Uma aula com tópico (o post de exemplo abre na prévia) e as outras sem, para as duas caras da tela aparecerem.
        return a.p_aula === "historia-do-brasil/a-era-vargas"
          ? { id: "exemplo-rosa", titulo: "Vargas: o que mudou para quem trabalhava?", comunidade: String(a.p_comunidade ?? "") }
          : { id: null, titulo: null, comunidade: String(a.p_comunidade ?? "") };
      case "alumia_mural": {
        const minha: Inscricao[] = estado.minha
          ? [{ id: estado.minha.id, nome: estado.minha.como === "codinome" ? (estado.minha.codinome ?? "") : "Você na prévia", handle: estado.minha.como === "perfil" ? "voce" : null, como: estado.minha.como, curso: estado.minha.curso, instituicao: estado.minha.instituicao, recado: estado.minha.recado, mes: estado.minha.mes, minha: true }]
          : [];
        return { itens: [...minha, ...estado.mural], proximo: null };
      }
      case "alumia_mural_meu":
        return estado.minha ? { ...estado.minha, id: undefined } : null;
      case "alumia_mural_entrar": {
        const p = (a.p ?? {}) as Record<string, string | undefined>;
        const limpo = (v: string | undefined) => (v && v.trim() ? v.trim() : null);
        estado.minha = { id: "eu", como: p.como === "codinome" ? "codinome" : "perfil", codinome: p.como === "codinome" ? limpo(p.codinome) : null, curso: limpo(p.curso), instituicao: limpo(p.instituicao), recado: limpo(p.recado), mes: estado.minha?.mes ?? "2026-11" };
        return { id: "eu", nome: estado.minha.codinome ?? "Você na prévia", handle: null, como: estado.minha.como, curso: estado.minha.curso, instituicao: estado.minha.instituicao, recado: estado.minha.recado, mes: estado.minha.mes, minha: true };
      }
      case "alumia_mural_sair": {
        const saiu = estado.minha !== null;
        estado.minha = null;
        return { saiu };
      }
      case "alumia_mural_tirar":
        estado.mural = estado.mural.filter((m) => m.id !== a.p_id);
        return { tirada: true };
      default:
        throw new Error("banco_desatualizado");
    }
  })();
  return r as T;
}
