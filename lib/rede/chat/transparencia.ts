// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O lado do aparelho do registro público das chaves do chat (supabase/migracoes/20261113-chat-transparencia.sql e, na onda R2,
// 20261124-r2-caixas.sql, que acrescenta o tipo da linha: "conta" (a identidade da conta), "aparelho", "aparelho-fora" e "passes").
// Documento: docs/rede/CHAT-PRIVADO.md ("Registro público das chaves").
//
// O aparelho baixa o registro (só o que ainda não viu), refaz a corrente de resumos a partir do ponto que já conferiu e guarda a
// chave mais nova de cada pessoa. Se o servidor reescrever o passado, a corrente não fecha ("kt_quebrado"); se mostrar de alguém
// uma chave que não é a última do registro, `conferir` diz que não confere. Sem "@/"; roda no Node nos testes.

export interface LinhaDoRegistro {
  seq: number;
  /** O tipo da linha (R2). As linhas do chat do beta não têm tipo, ou vêm como "olm": o resumo delas é o de antes. */
  tipo?: string;
  quem: string;
  identidade: string;
  versao: number;
  dia: string;
  resumo: string;
}

/** O que o aparelho guarda: até onde conferiu a corrente e a chave mais nova de cada pessoa (pelo resumo da conta). */
export interface VistaDoRegistro {
  seq: number;
  resumo: string;
  /** A identidade mais nova de cada pessoa: a do chat do beta (linhas sem tipo) e, na R2, a da conta (linhas "conta"). */
  ultimas: Record<string, { identidade: string; versao: number }>;
  /** R2: a identidade da conta mais nova de cada pessoa ("r2:" + Ed25519 em base64). */
  contas?: Record<string, { identidade: string; versao: number }>;
  /**
   * R2: a chave dos passes anônimos de cada dia, como a corrente conferida mostra ("p2:<dia>:<chave>"), com a linha. `duas`: o
   * registro tem mais de uma chave para o mesmo dia (o servidor tentou dar chaves diferentes a pessoas diferentes): nenhuma vale.
   * Só os dias mais recentes ficam guardados.
   */
  passes?: Record<string, { identidade: string; seq: number; duas: boolean }>;
  /**
   * R3: as chaves RSA dos passes ("passes-rsa", "p3:<semana>:<contexto>:<chave>"), pelo nome "s<semana>" (a geral da semana) ou
   * "c<contexto em base64>" (a da urna de uma votação). `duas`: o registro tem mais de uma chave para o mesmo nome: nenhuma vale.
   */
  passesRsa?: Record<string, { identidade: string; seq: number; duas: boolean }>;
  /** R3: o último endereço do servidor do chat separado anotado no registro ("servidor-chat", "sc1:<endereço>"; "" = o próprio site). */
  servidorChat?: { endereco: string; seq: number };
}

export const INICIO: VistaDoRegistro = { seq: 0, resumo: `${"A".repeat(43)}=`, ultimas: {}, contas: {}, passes: {}, passesRsa: {} };
/** Quantos dias de chave de passes a vista guarda. */
const DIAS_DE_PASSES_NA_VISTA = 10;
/** Quantas semanas de chave RSA de passes e quantas chaves de urna a vista guarda. */
const SEMANAS_DE_PASSES_NA_VISTA = 6;
const URNAS_NA_VISTA = 200;

export interface TransporteDoRegistro {
  ponta(): Promise<{ seq: number; resumo: string }>;
  trecho(desde: number): Promise<LinhaDoRegistro[]>;
}

async function sha256B64(texto: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto)));
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

/** O resumo da conta no registro (quem sabe o id da conta acha a linha; quem só baixa o registro, não). */
export const quemNoRegistro = (usuario: string) => sha256B64(`alumia-kt:1:${usuario}`);

export const resumoDaLinha = (anterior: string, l: Omit<LinhaDoRegistro, "resumo">) => sha256B64(`${anterior}|${l.seq}|${l.quem}|${l.identidade}|${l.versao}|${l.dia}`);
/** O resumo das linhas com tipo (R2, interno.rede_kt_resumo2): o tipo entra na corrente. */
export const resumoDaLinhaComTipo = (anterior: string, l: Omit<LinhaDoRegistro, "resumo">) =>
  sha256B64(`${anterior}|${l.seq}|${l.tipo}|${l.quem}|${l.identidade}|${l.versao}|${l.dia}`);
const doBeta = (l: Pick<LinhaDoRegistro, "tipo">) => l.tipo === undefined || l.tipo === "olm";

/**
 * Traz o registro até a ponta, conferindo a corrente a partir do que este aparelho já tinha visto. Lança "kt_quebrado" se a
 * corrente não fecha (o servidor reescreveu o passado ou mostrou um registro diferente a outra pessoa e depois a este aparelho).
 */
export async function atualizarVista(vista: VistaDoRegistro, transporte: TransporteDoRegistro): Promise<VistaDoRegistro> {
  const ponta = await transporte.ponta();
  if (ponta.seq < vista.seq) throw new Error("kt_quebrado");
  if (ponta.seq === vista.seq) {
    if (ponta.resumo !== vista.resumo) throw new Error("kt_quebrado");
    return vista;
  }
  const nova: VistaDoRegistro = { seq: vista.seq, resumo: vista.resumo, ultimas: { ...vista.ultimas }, contas: { ...(vista.contas ?? {}) }, passes: { ...(vista.passes ?? {}) }, passesRsa: { ...(vista.passesRsa ?? {}) }, ...(vista.servidorChat ? { servidorChat: vista.servidorChat } : {}) };
  const passes = nova.passes as NonNullable<VistaDoRegistro["passes"]>;
  const passesRsa = nova.passesRsa as NonNullable<VistaDoRegistro["passesRsa"]>;
  while (nova.seq < ponta.seq) {
    const linhas = await transporte.trecho(nova.seq);
    if (!linhas.length) throw new Error("kt_quebrado");
    for (const l of linhas) {
      if (l.seq !== nova.seq + 1) throw new Error("kt_quebrado");
      const esperado = doBeta(l) ? await resumoDaLinha(nova.resumo, l) : await resumoDaLinhaComTipo(nova.resumo, l);
      if (esperado !== l.resumo) throw new Error("kt_quebrado");
      nova.seq = l.seq;
      nova.resumo = l.resumo;
      // A versão da chave de uma conta só sobe (no chat do beta e na identidade da conta da R2, cada uma na sua conta).
      const onde = doBeta(l) ? nova.ultimas : l.tipo === "conta" ? (nova.contas as Record<string, { identidade: string; versao: number }>) : null;
      if (onde) {
        const antes = onde[l.quem];
        if (antes && l.versao <= antes.versao) throw new Error("kt_quebrado");
        onde[l.quem] = { identidade: l.identidade, versao: l.versao };
      }
      // A chave dos passes de cada dia: uma só por dia. Outra para o mesmo dia marca o dia inteiro como suspeito.
      const dia = l.tipo === "passes" ? /^p2:(\d{4}-\d{2}-\d{2}):/.exec(l.identidade)?.[1] : undefined;
      if (dia) {
        const antes = passes[dia];
        passes[dia] = antes ? { ...antes, duas: antes.duas || antes.identidade !== l.identidade } : { identidade: l.identidade, seq: l.seq, duas: false };
      }
      // R3: a chave RSA dos passes de cada semana (ou de cada urna): uma só por nome. Outra para o mesmo nome marca o nome como suspeito.
      const rsa = l.tipo === "passes-rsa" ? /^p3:(\d{1,7}):([A-Za-z0-9+/=]*):[A-Za-z0-9+/=]+$/.exec(l.identidade) : null;
      if (rsa) {
        const nome = rsa[2] ? `c${rsa[2]}` : `s${rsa[1]}`;
        const antes = passesRsa[nome];
        passesRsa[nome] = antes ? { ...antes, duas: antes.duas || antes.identidade !== l.identidade } : { identidade: l.identidade, seq: l.seq, duas: false };
      }
      // R3: o endereço do servidor do chat separado (vale o último).
      if (l.tipo === "servidor-chat" && l.identidade.startsWith("sc1:")) nova.servidorChat = { endereco: l.identidade.slice(4), seq: l.seq };
      if (nova.seq >= ponta.seq) break;
    }
  }
  if (nova.seq !== ponta.seq || nova.resumo !== ponta.resumo) throw new Error("kt_quebrado");
  for (const dia of Object.keys(passes).sort().slice(0, -DIAS_DE_PASSES_NA_VISTA)) delete passes[dia];
  const semanas = Object.keys(passesRsa).filter((n) => n.startsWith("s")).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  for (const n of semanas.slice(0, -SEMANAS_DE_PASSES_NA_VISTA)) delete passesRsa[n];
  const urnas = Object.keys(passesRsa).filter((n) => n.startsWith("c")).sort((a, b) => passesRsa[a].seq - passesRsa[b].seq);
  for (const n of urnas.slice(0, -URNAS_NA_VISTA)) delete passesRsa[n];
  return nova;
}

/**
 * A chave dos passes deste dia é a ÚNICA do dia na corrente conferida por este aparelho? `identidade`: "p2:<dia>:<chave em base64>".
 * Linha que a corrente não tem, outra chave para o dia, ou duas chaves no mesmo dia: não confere.
 */
export function chaveDePassesNaVista(vista: VistaDoRegistro, dia: string, identidade: string): boolean {
  const p = vista.passes?.[dia];
  return !!p && !p.duas && p.identidade === identidade;
}

/**
 * R3: a chave RSA de passes com este nome ("s<semana>" ou "c<contexto>") é a ÚNICA com esse nome na corrente conferida, e é esta?
 * `identidade`: "p3:<semana>:<contexto>:<chave>". Também confere a linha (`seq`) que o servidor indicou.
 */
export function chaveRsaDePassesNaVista(vista: VistaDoRegistro, nome: string, identidade: string, seq: number): boolean {
  const p = vista.passesRsa?.[nome];
  return !!p && !p.duas && p.identidade === identidade && p.seq === seq;
}

/** A chave que o servidor mostra desta pessoa é a última do registro? ("sem_registro": a pessoa ainda não está no registro.) */
export async function conferir(vista: VistaDoRegistro, usuario: string, identidade: string, versao: number): Promise<"confere" | "nao_confere" | "sem_registro"> {
  const linha = vista.ultimas[await quemNoRegistro(usuario)];
  if (!linha) return "sem_registro";
  return linha.identidade === identidade && linha.versao === versao ? "confere" : "nao_confere";
}

/**
 * R2: a identidade da conta que o diretório mostra é a última do registro? `identidade`: os 32 bytes da Ed25519. Conta sem linha no
 * registro não confere (toda conta que publica a identidade ganha uma linha, pelo gatilho do banco).
 */
export async function conferirConta(vista: VistaDoRegistro, usuario: string, identidade: Uint8Array): Promise<"confere" | "nao_confere"> {
  const linha = vista.contas?.[await quemNoRegistro(usuario)];
  let s = "";
  for (const b of identidade) s += String.fromCharCode(b);
  return linha && linha.identidade === `r2:${btoa(s)}` ? "confere" : "nao_confere";
}

/** O "carimbo" da vista, para duas pessoas compararem se veem o mesmo registro (vai junto do código de segurança). */
export const carimbo = (vista: VistaDoRegistro) => `${vista.seq}·${vista.resumo.slice(0, 8)}`;
