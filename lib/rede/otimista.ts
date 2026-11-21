// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Interface otimista da Alumia (Prompt 5, A17): o toque aparece na hora e o servidor confirma depois.
//
// 1. Interruptor otimista (acender, seguir): o botão muda no toque; o pedido ao banco leva o ESTADO querido ("aceso" ou "apagado",
//    "seguindo" ou não), nunca "inverta", então repetir o pedido não duplica nada (rede_reagir e rede_perfil_seguir gravam com
//    "on conflict do nothing" e apagam o que não vale). Um pedido por vez: tocar de novo enquanto um está no caminho só guarda o
//    último desejo, e ele sai quando o anterior voltar (a ordem no banco é a ordem dos toques). Deu erro: volta ao último estado
//    que o banco confirmou.
// 2. Posts a caminho: enquanto corre o "Enviando em N s" do Escrever, o post aparece no alto da linha (meio apagado, "Enviando…").
//    A chave do envio (lib/backend-envio.ts, A13) é a identidade dele: o mesmo envio repetido nunca vira dois cartões, e o banco
//    recusa a mesma chave de novo ("envio_repetido"). Confirmado, o post de verdade entra no lugar, sem recarregar a linha.
//
// Sem React e sem "@/": a parte de estado roda no Node dos testes (scripts/testar-p5-leve.mjs).

/** O que o interruptor precisa: mandar o estado querido e ler, da resposta, o estado que o banco confirmou. */
export interface OpcoesDoInterruptor<R> {
  enviar: (querido: boolean) => Promise<R>;
  /** O estado que a resposta confirma (ex.: r.apoiei, r.sigo || r.pendente). */
  confirmado: (r: R) => boolean;
  /** Chamado com o estado que deve aparecer na tela, no toque e quando o banco responde. */
  mostrar: (estado: boolean) => void;
  /** Chamado com a última resposta, quando não há mais nada na fila (para copiar outros campos, como "pendente"). */
  aoConfirmar?: (r: R) => void;
  /** Deu erro: a tela já voltou ao último estado confirmado. */
  aoFalhar?: (e: unknown) => void;
}

export interface Interruptor {
  /** A pessoa quer este estado. */
  querer: (estado: boolean) => void;
  /** O estado que aparece agora (o querido, se houver um no caminho). */
  atual: () => boolean;
  /** Há pedido no caminho? */
  ocupado: () => boolean;
  /** O banco mudou por fora (a tela recarregou): passa a valer este estado. */
  redefinir: (estado: boolean) => void;
}

/** Um interruptor otimista, a partir do estado que o banco disse por último. */
export function criarInterruptor<R>(inicial: boolean, o: OpcoesDoInterruptor<R>): Interruptor {
  let confirmado = inicial;
  let querido = inicial;
  let noCaminho = false;

  const mandar = () => {
    noCaminho = true;
    const pedido = querido;
    o.enviar(pedido).then(
      (r) => {
        confirmado = o.confirmado(r);
        // O banco pode dizer outra coisa que o pedido (perfil trancado vira "pedido enviado"): o que ele disse vale, a não ser que a
        // pessoa já tenha tocado de novo depois deste pedido.
        if (querido === pedido) querido = confirmado;
        if (querido !== confirmado) return mandar();
        noCaminho = false;
        o.mostrar(confirmado);
        o.aoConfirmar?.(r);
      },
      (e) => {
        noCaminho = false;
        querido = confirmado;
        o.mostrar(confirmado);
        o.aoFalhar?.(e);
      },
    );
  };

  return {
    querer(estado) {
      if (estado === querido) return;
      querido = estado;
      o.mostrar(estado);
      if (!noCaminho) mandar();
    },
    atual: () => querido,
    ocupado: () => noCaminho,
    redefinir(estado) {
      confirmado = estado;
      if (!noCaminho) querido = estado;
    },
  };
}

// ───────────── Posts a caminho ─────────────

/** Um post que a pessoa mandou e que o banco ainda não confirmou. */
export interface PostACaminho {
  /** A chave do envio (lib/backend-envio.ts): a identidade do post até ele existir no banco. */
  chave: string;
  /** O que aparece no cartão: o texto, o título do texto longo ou o nome do ato. */
  texto: string;
  /** Quantas imagens vão junto (o cartão diz "+ N imagens"; a imagem só aparece depois de conferida no servidor). */
  imagens: number;
  /** A comunidade onde vai (nula = perfil). */
  comunidade: string | null;
  desde: number;
}

type Ouvinte = () => void;
const ouvintes = new Set<Ouvinte>();
let aCaminho: readonly PostACaminho[] = [];
/** Os posts já confirmados nesta aba do navegador (mais novo primeiro), para a linha pôr no alto sem pedir tudo de novo. */
let confirmados: readonly { id: string; post: unknown; comunidade: string | null; quando: number }[] = [];
/** Quantos confirmados a memória guarda: os mais velhos já vêm do banco quando a linha recarrega. */
const LIMITE_DE_CONFIRMADOS = 10;

const avisar = () => ouvintes.forEach((f) => f());

export function assinarPostsACaminho(f: Ouvinte): () => void {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}

export const postsACaminho = (): readonly PostACaminho[] => aCaminho;
export const postsConfirmados = () => confirmados;

/** O post começou a ir (o "Enviando em N s" apareceu). A mesma chave de novo só atualiza o cartão: nunca aparece duas vezes. */
export function anunciarPostACaminho(p: Omit<PostACaminho, "desde"> & { desde?: number }): void {
  const ja = aCaminho.find((x) => x.chave === p.chave);
  const novo: PostACaminho = { ...p, desde: ja?.desde ?? p.desde ?? Date.now() };
  aCaminho = ja ? aCaminho.map((x) => (x.chave === p.chave ? novo : x)) : [novo, ...aCaminho];
  avisar();
}

/** O post saiu da fila: confirmado, desfeito ou recusado. */
export function retirarPostACaminho(chave: string): void {
  if (!aCaminho.some((x) => x.chave === chave)) return;
  aCaminho = aCaminho.filter((x) => x.chave !== chave);
  avisar();
}

/** O banco confirmou o post: ele entra no alto das linhas abertas (uma vez só, pelo id). */
export function confirmarPost(post: { id: string; comunidade?: string | null }): void {
  if (!post?.id || confirmados.some((x) => x.id === post.id)) return;
  confirmados = [{ id: post.id, post, comunidade: post.comunidade ?? null, quando: Date.now() }, ...confirmados].slice(0, LIMITE_DE_CONFIRMADOS);
  avisar();
}

/** Esquece tudo (Sair rápido, troca de conta, testes). */
export function esquecerPostsACaminho(): void {
  aCaminho = [];
  confirmados = [];
  avisar();
}

/**
 * Os posts que cabem numa linha: as abas do Início (seguindo, comunidades, tudo, geral…) recebem todos; a linha de uma comunidade
 * ("c:<slug>") só os dela; a de um perfil ou outra linha com ":" (tema, lista…) não recebe nenhum (ela recarrega do banco).
 */
export function cabeNaLinha(aba: string, comunidade: string | null): boolean {
  if (!aba.includes(":")) return true;
  return aba.startsWith("c:") && comunidade !== null && aba.slice(2) === comunidade;
}

/**
 * Junta no alto dos itens da linha os posts confirmados DEPOIS de `desde` (o instante em que a lista foi pedida ao banco) que ainda
 * não estão nela. O que foi confirmado antes já veio do banco, ou foi apagado depois: não volta. Devolve os mesmos itens quando não
 * há nada a juntar (a linha não redesenha à toa).
 */
export function juntarConfirmados<T extends { id: string }>(aba: string, itens: readonly T[], desde: number): T[] {
  const tem = new Set(itens.map((p) => p.id));
  const novos = confirmados.filter((c) => c.quando > desde && !tem.has(c.id) && cabeNaLinha(aba, c.comunidade)).map((c) => c.post as T);
  return novos.length ? [...novos, ...itens] : (itens as T[]);
}
