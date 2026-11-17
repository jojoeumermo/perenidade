// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As fotos de quem escolheu aparecer com nome e foto (identidade pública opcional). O rosto da rede inteira (Avatar16: cartões,
// conversa, stories, avisos, barra lateral) pergunta por aqui: os @ da mesma tela se juntam numa chamada só (até 60), que diz
// quais estão em público e o carimbo da foto; a foto vem depois, uma vez por carimbo. Quem não está em público, ou quem chama sem
// poder ver (visitante, bloqueio, perfil invisível), fica com o mosaico de sempre. Com a escolha fechada no banco (como nasce),
// a única chamada é a do sim ou não do interruptor, uma vez a cada cinco minutos.
//
// Nada disto é gravado no aparelho: as fotos dos outros moram só na memória desta aba e a resposta envelhece em cinco minutos.
// Assim, quando alguém volta ao codinome, a foto some das telas abertas sem deixar cópia para trás.
import { useEffect, useSyncExternalStore } from "react";
import { hasSession } from "../backend";
import { redeIdentidade } from "./cliente-identidade";
import { fotoAceitavel } from "./identidade";
import { faltaFuncaoNoBanco } from "./reserva";

interface Conhecido {
  publica: boolean;
  carimbo: string | null;
  foto: string | null;
  ate: number;
}

const VALIDADE = 5 * 60_000;
const MAXIMO = 400;
const conhecidos = new Map<string, Conhecido>();
const esperando = new Set<string>();
const ouvintes = new Set<() => void>();
let agendado = false;
/** O banco não tem a função, ou a chamada falhou duas vezes seguidas: não pergunta de novo nesta aba. */
let desligado = false;
let falhasSeguidas = 0;
const previa = () => process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim";

const handleBom = (h: string) => /^[a-z0-9_]{3,20}$/.test(h);
const avisar = () => {
  for (const f of ouvintes) f();
};

function guardar(handle: string, c: Conhecido) {
  conhecidos.delete(handle);
  conhecidos.set(handle, c);
  while (conhecidos.size > MAXIMO) conhecidos.delete(conhecidos.keys().next().value as string);
}

/** O interruptor do banco, perguntado uma vez a cada cinco minutos por aba. Desligado, a rede não busca identidade nem foto. */
let aberta: { sim: boolean; ate: number } | null = null;
async function escolhaAberta(): Promise<boolean> {
  if (aberta && aberta.ate > Date.now()) return aberta.sim;
  const sim = await redeIdentidade.aberta();
  aberta = { sim, ate: Date.now() + VALIDADE };
  return sim;
}

async function resolverLote() {
  agendado = false;
  if (!(await escolhaAberta())) {
    // Fechada: todo mundo fica com o mosaico, e os pedidos em espera não viram chamada.
    const ate = Date.now() + VALIDADE;
    for (const h of esperando) if (conhecidos.get(h)?.carimbo !== "local") guardar(h, { publica: false, carimbo: null, foto: null, ate });
    esperando.clear();
    avisar();
    return;
  }
  const lote = [...esperando].slice(0, 60);
  for (const h of lote) esperando.delete(h);
  const ate = Date.now() + VALIDADE;
  let achados: Record<string, { foto: string | null }> = {};
  try {
    achados = (await redeIdentidade.de(lote)) ?? {};
    falhasSeguidas = 0;
  } catch (e) {
    falhasSeguidas++;
    if (faltaFuncaoNoBanco(e) || falhasSeguidas >= 2) desligado = true;
  }
  for (const h of lote) {
    const a = achados[h];
    const antes = conhecidos.get(h);
    if (!a) {
      guardar(h, { publica: false, carimbo: null, foto: null, ate });
    } else if (!a.foto) {
      guardar(h, { publica: true, carimbo: null, foto: null, ate });
    } else if (antes && antes.carimbo === a.foto && antes.foto) {
      guardar(h, { ...antes, publica: true, ate });
    } else {
      let dados: string | null = null;
      try {
        dados = await redeIdentidade.foto(h);
      } catch {
        dados = null;
      }
      // Só entra na tela o que passa na mesma conferência do envio (WebP simples, sem metadados).
      guardar(h, { publica: true, carimbo: a.foto, foto: fotoAceitavel(dados) ? dados : null, ate });
    }
  }
  avisar();
  if (esperando.size) agendar();
}

function agendar() {
  if (agendado) return;
  agendado = true;
  setTimeout(() => void resolverLote(), 40);
}

function pedir(handle: string) {
  if (desligado || !handleBom(handle)) return;
  // Só quem tem conta recebe identidade e foto: visitante nem pergunta.
  if (!previa() && !hasSession()) return;
  const c = conhecidos.get(handle);
  if (c && c.ate > Date.now()) return;
  esperando.add(handle);
  agendar();
}

function assinar(f: () => void) {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}

/** A foto pública de um @ (data URL) ou nulo: nulo = o rosto em mosaico. No servidor, sempre nulo. */
export function useFotoPublica(handle: string): string | null {
  useEffect(() => pedir(handle), [handle]);
  return useSyncExternalStore(
    assinar,
    () => conhecidos.get(handle)?.foto ?? null,
    () => null,
  );
}

/** Este @ está em identidade pública (nome e foto por escolha)? Falso enquanto não se sabe. */
export function useIdentidadePublica(handle: string): boolean {
  useEffect(() => pedir(handle), [handle]);
  return useSyncExternalStore(
    assinar,
    () => conhecidos.get(handle)?.publica ?? false,
    () => false,
  );
}

/** A própria pessoa mudou a identidade ou a foto: as telas abertas trocam na hora, sem esperar a validade. */
export function definirIdentidadeLocal(handle: string, publica: boolean, foto: string | null) {
  if (!handleBom(handle)) return;
  guardar(handle, { publica, carimbo: foto ? "local" : null, foto: publica && fotoAceitavel(foto) ? foto : null, ate: Date.now() + VALIDADE });
  avisar();
}
