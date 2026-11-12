// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O lado do aparelho do registro público das chaves do chat (supabase/migracoes/20261113-chat-transparencia.sql). Documento:
// docs/rede/CHAT-PRIVADO.md ("Registro público das chaves").
//
// O aparelho baixa o registro (só o que ainda não viu), refaz a corrente de resumos a partir do ponto que já conferiu e guarda a
// chave mais nova de cada pessoa. Se o servidor reescrever o passado, a corrente não fecha ("kt_quebrado"); se mostrar de alguém
// uma chave que não é a última do registro, `conferir` diz que não confere. Sem "@/"; roda no Node nos testes.

export interface LinhaDoRegistro {
  seq: number;
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
  ultimas: Record<string, { identidade: string; versao: number }>;
}

export const INICIO: VistaDoRegistro = { seq: 0, resumo: `${"A".repeat(43)}=`, ultimas: {} };

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
  const nova: VistaDoRegistro = { seq: vista.seq, resumo: vista.resumo, ultimas: { ...vista.ultimas } };
  while (nova.seq < ponta.seq) {
    const linhas = await transporte.trecho(nova.seq);
    if (!linhas.length) throw new Error("kt_quebrado");
    for (const l of linhas) {
      if (l.seq !== nova.seq + 1) throw new Error("kt_quebrado");
      const esperado = await resumoDaLinha(nova.resumo, l);
      if (esperado !== l.resumo) throw new Error("kt_quebrado");
      nova.seq = l.seq;
      nova.resumo = l.resumo;
      const antes = nova.ultimas[l.quem];
      // A versão da chave de uma conta só sobe.
      if (antes && l.versao <= antes.versao) throw new Error("kt_quebrado");
      nova.ultimas[l.quem] = { identidade: l.identidade, versao: l.versao };
      if (nova.seq >= ponta.seq) break;
    }
  }
  if (nova.seq !== ponta.seq || nova.resumo !== ponta.resumo) throw new Error("kt_quebrado");
  return nova;
}

/** A chave que o servidor mostra desta pessoa é a última do registro? ("sem_registro": a pessoa ainda não está no registro.) */
export async function conferir(vista: VistaDoRegistro, usuario: string, identidade: string, versao: number): Promise<"confere" | "nao_confere" | "sem_registro"> {
  const linha = vista.ultimas[await quemNoRegistro(usuario)];
  if (!linha) return "sem_registro";
  return linha.identidade === identidade && linha.versao === versao ? "confere" : "nao_confere";
}

/** O "carimbo" da vista, para duas pessoas compararem se veem o mesmo registro (vai junto do código de segurança). */
export const carimbo = (vista: VistaDoRegistro) => `${vista.seq}·${vista.resumo.slice(0, 8)}`;
