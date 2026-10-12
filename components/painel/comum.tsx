// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useState } from "react";
import { BackendError, rpc, type Role } from "@/lib/backend";

// O painel é a mesa de trabalho da equipe e existe só em português.

export const campo = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2";
export const botao = "cursor-pointer bg-ink px-5 py-2.5 font-medium text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50";
export const botaoClaro = "cursor-pointer border-2 border-ink px-5 py-2 font-medium hover:border-oxblood hover:text-oxblood disabled:cursor-not-allowed disabled:opacity-50";
export const elo = "cursor-pointer underline hover:text-oxblood";
export const rotulo = "font-mono text-xs uppercase tracking-widest text-gold";

export const papeis: Record<Role["papel"], string> = {
  coordenacao: "Coordenação comunitária",
  vice: "Vice-coordenação",
  curadoria: "Curadoria",
  mediacao: "Mediação",
  educacao: "Educação",
  revisao: "Revisão",
  traducao: "Tradução",
  jornalismo: "Jornalismo",
  mentoria: "Aula de reforço",
  design: "Design",
  desenvolvimento: "Desenvolvimento",
};

/** O que cada papel enxerga e faz no painel. É a regra do banco, escrita para gente. */
export const oQueFaz: Record<Role["papel"], string> = {
  coordenacao: "Palavra final em tudo: confia e retira papéis, nomeia a vice-coordenação, define a sucessão, publica materiais e emite certificados.",
  vice: "Tudo o que a coordenação faz, menos mexer na coordenação, nomear outra vice-coordenação, definir a sucessão e emitir certificados.",
  curadoria: "Aprova ou recusa contribuições, cuida da comunidade, das denúncias e do filtro de palavras.",
  mediacao: "Lê primeiro o que o público envia: aprova, edita ou recusa mensagens da Comunidade e anúncios do Mural dos Trabalhadores, e faz a triagem das contribuições antes de elas chegarem à fila de revisão. Não aprova conteúdo de ensino nem mexe em pessoas.",
  educacao: "Escreve e revisa na disciplina confiada, cuida da comunidade e atende pedidos de reforço da disciplina.",
  revisao: "Lê a fila inteira e dá parecer; não aprova.",
  traducao: "Envia traduções; não vê a fila dos outros.",
  jornalismo: "Escreve para o jornal; toda matéria passa pela revisão antes de sair.",
  mentoria: "Atende pedidos de reforço da disciplina confiada e responde por e-mail.",
  design: "Prepara materiais gráficos e atende pedidos de ajuda das outras funções.",
  desenvolvimento: "Cuida do código e atende pedidos de ajuda das outras funções.",
};

export const situacoes: Record<string, string> = {
  pendente: "aguardando revisão",
  aprovada: "aprovada, vai ao ar na próxima publicação",
  recusada: "não aprovada",
  publicada: "no ar",
  resolvida: "resolvida",
  aceita: "aceita",
};

const erros: Record<string, string> = {
  entre_primeiro: "Entre na sua conta para continuar.",
  sem_permissao: "Você não tem permissão para isso.",
  muitos_pedidos: "Muitos pedidos em pouco tempo. Tente de novo mais tarde.",
  falta_fonte: "Cite pelo menos uma fonte.",
  conta_suspensa: "Esta conta está suspensa.",
  nao_encontrado: "Não encontrado.",
  ja_decidida: "Esta contribuição já foi decidida.",
  ja_pediu: "Você já fez esse pedido e ele está em análise.",
  limite_anuncios: "Cada pessoa pode ter até três anúncios no mural.",
  ultima_coordenacao: "O instituto precisa de uma pessoa na coordenação.",
  limite_pedidos: "Você já tem três pedidos em aberto.",
  confirme_segundo_fator: "Confirme primeiro o seu próprio código do aplicativo autenticador.",
  falta_termo: "Falta o aceite do termo de adesão ao trabalho voluntário.",
  sem_horas: "Não há horas confirmadas nesse período.",
  falta_assinatura: "Ainda faltam as assinaturas do educador e do vice-coordenador.",
  falta_vice: "É preciso um vice-coordenador para assinar o certificado.",
  topico_trancado: "Esta conversa está trancada.",
  falta_apoio: "Faltam apoios da equipe: são precisos dois antes de aprovar.",
  sem_chave: "A coordenação ainda não definiu a chave da conversa da equipe.",
  conteudo_recusado: "O texto tem palavras que o filtro não aceita.",
  sem_links: "Só texto: sem endereços, imagens ou arquivos.",
  envios_pausados: "Os envios do público estão pausados pela coordenação.",
  limite_colaboradores: "Cada contribuição pode ter até cinco pessoas trabalhando junto.",
  mudou_enquanto_editava: "Outra pessoa guardou alterações enquanto você editava. Copie o que escreveu, abra a versão nova e aplique de novo.",
  sem_conexao: "Sem conexão com o serviço.",
  falha: "Algo deu errado. Tente de novo.",
};

export function textoDoErro(erro: unknown): string {
  const codigo = erro instanceof BackendError ? erro.code : "falha";
  const [tipo, qual] = codigo.split(":");
  if (tipo === "invalido") return `Confira o campo: ${qual}.`;
  return erros[tipo] ?? erros.falha;
}

export const data = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
export const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
/** Datas sem hora (AAAA-MM-DD) não podem passar pelo fuso: viram o dia anterior no Brasil. */
export const dia = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/** Carrega uma lista do serviço e devolve um jeito de recarregar. */
export function useLista<T>(funcao: string, argumentos: Record<string, unknown> = {}) {
  const [estado, setEstado] = useState<{ dados: T | null; erro: string }>({ dados: null, erro: "" });
  const [volta, setVolta] = useState(0);
  const chave = JSON.stringify(argumentos);

  useEffect(() => {
    let cancelado = false;
    rpc<T>(funcao, JSON.parse(chave) as Record<string, unknown>)
      .then((dados) => {
        if (!cancelado) setEstado({ dados, erro: "" });
      })
      .catch((erro: unknown) => {
        if (!cancelado) setEstado({ dados: null, erro: textoDoErro(erro) });
      });
    return () => {
      cancelado = true;
    };
  }, [funcao, chave, volta]);

  return { ...estado, recarregar: useCallback(() => setVolta((v) => v + 1), []) };
}

/** Executa uma ação e mostra o resultado em uma linha de aviso. */
export function useAcao(depois?: () => void) {
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  async function agir(funcao: string, argumentos: Record<string, unknown>, sucesso = "Feito.") {
    setOcupado(true);
    setAviso("");
    try {
      const resposta = await rpc<unknown>(funcao, argumentos);
      setAviso(sucesso);
      depois?.();
      return resposta;
    } catch (erro) {
      setAviso(textoDoErro(erro));
      return null;
    } finally {
      setOcupado(false);
    }
  }
  return { agir, aviso, setAviso, ocupado };
}

export function Aviso({ texto }: { texto: string }) {
  return (
    <p role="status" className="min-h-5 text-oxblood">
      {texto}
    </p>
  );
}

/** Divisões dentro de uma seção do painel, para aparecer uma coisa de cada vez. */
export function Abas<T extends string>({ opcoes, atual, escolher }: { opcoes: { id: T; nome: string; conta?: number }[]; atual: T; escolher: (id: T) => void }) {
  return (
    <div role="tablist" className="mb-6 flex flex-wrap gap-x-6 gap-y-1 border-b border-rule">
      {opcoes.map((opcao) => (
        <button
          key={opcao.id}
          type="button"
          role="tab"
          aria-selected={atual === opcao.id}
          onClick={() => escolher(opcao.id)}
          className={`-mb-px cursor-pointer border-b-2 pb-2 ${atual === opcao.id ? "border-ink font-semibold" : "border-transparent text-ink-soft hover:text-ink"}`}
        >
          {opcao.nome}
          {Boolean(opcao.conta) && <span className="ml-1.5 bg-oxblood px-1.5 py-0.5 font-mono text-[0.7rem] font-semibold text-parchment">{opcao.conta}</span>}
        </button>
      ))}
    </div>
  );
}
