// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas dos avisos de local (Prompt 4, item 4; supabase/migracoes/20261127-p4-avisos-de-local.sql). Tudo vai direto ao banco
// com a sessão da pessoa: o banco confere o interruptor, a conta e o limite de uma ação por hora. O que sai do aparelho é só o
// pedido de lib/rede/mapa/avisos.ts (os dois inteiros da célula de cerca de 200 m e a categoria); a posição de verdade nunca chega
// aqui. As áreas seguidas ficam no aparelho e não passam por este arquivo. Com NEXT_PUBLIC_ALUMIA_PREVIA=sim, um dublê na memória
// responde (nada vai a lugar nenhum). Sem "@/" de propósito.
import { BackendError } from "../../backend";
import { chamar, type Chamar } from "../cliente";
import {
  HORAS, areaDe, areaOk, limparVizinhanca, pedidoDeAviso, type Area, type AvisoDeLocal, type Categoria, type Celula, type MotivoDaTrava,
  type Vizinhanca,
} from "./avisos";

export const PREVIA_DOS_AVISOS = process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim";

export type AvisoFeito = AvisoDeLocal & { novo: boolean };

/** O cliente dos avisos sobre uma função que chama o banco (a de verdade ou o dublê). */
export function criarClienteDosAvisos(c: Chamar) {
  return {
    /** Os avisos em volta de uma área (ela e as 8 vizinhas), já limpos (nada além dos campos conhecidos). */
    async ver(a: Area): Promise<Vizinhanca> {
      if (!areaOk(a)) throw new BackendError("invalido:area");
      return limparVizinhanca(await c<Partial<Vizinhanca>>("rede_local_ver", { p_ala: a.ala, p_alo: a.alo }));
    },
    /** Avisa (ou soma o relato ao aviso igual que já existe). Só a célula e a categoria saem. */
    avisar(celula: Celula, categoria: Categoria): Promise<AvisoFeito> {
      return c<AvisoFeito>("rede_local_avisar", pedidoDeAviso(celula, categoria));
    },
    aindaLa(id: string): Promise<AvisoDeLocal> {
      return c<AvisoDeLocal>("rede_local_ainda_la", { p_id: id });
    },
    apagar(id: string): Promise<void> {
      return c<void>("rede_local_apagar", { p_id: id });
    },
    travar(a: Area, horas: number, motivo: MotivoDaTrava): Promise<{ ala: number; alo: number; ate: string; apagados: boolean }> {
      return c("rede_local_travar", { p_ala: a.ala, p_alo: a.alo, p_horas: horas, p_motivo: motivo });
    },
    destravar(a: Area): Promise<void> {
      return c<void>("rede_local_destravar", { p_ala: a.ala, p_alo: a.alo });
    },
  };
}

/** O dublê da prévia: avisos inventados em volta da primeira área pedida, uma ação por hora como no banco. */
export function dubleDosAvisos(): Chamar {
  const avisos: AvisoDeLocal[] = [];
  const travas: { ala: number; alo: number; ate: string }[] = [];
  let agiu = false;
  let semeado = false;
  const dez = () => Math.floor(Date.now() / 600_000) * 600_000;
  const novo = (la: number, lo: number, categoria: Categoria, confirmado: boolean, minutos: number): AvisoDeLocal => {
    const criado = dez() - minutos * 60_000;
    return { id: crypto.randomUUID(), la, lo, categoria, confirmado, renovado: false, criado_em: new Date(criado).toISOString(), expira_em: new Date(criado + HORAS * 3600_000).toISOString() };
  };
  const gastar = () => {
    if (agiu) throw new BackendError("uma_por_hora");
    agiu = true;
  };
  return async <T,>(funcao: string, a: Record<string, unknown> = {}): Promise<T> => {
    await new Promise((r) => setTimeout(r, 150));
    switch (funcao) {
      case "rede_local_ver": {
        const ala = Number(a.p_ala), alo = Number(a.p_alo);
        if (!semeado) {
          semeado = true;
          const la = ala * 10 + 5, lo = alo * 10 + 5;
          avisos.push(novo(la + 1, lo, "rua_bloqueada", true, 30), novo(la - 2, lo + 3, "alagamento", false, 50), novo(la + 4, lo - 1, "obra", false, 10));
        }
        const perto = avisos.filter((x) => Date.parse(x.expira_em) > Date.now() && Math.abs(areaDe(x).ala - ala) <= 1 && Math.abs(areaDe(x).alo - alo) <= 1);
        return { area: { ala, alo }, avisos: perto, travadas: travas.filter((t) => Math.abs(t.ala - ala) <= 1 && Math.abs(t.alo - alo) <= 1), modera: true } as T;
      }
      case "rede_local_avisar": {
        const la = Number(a.p_la), lo = Number(a.p_lo), categoria = a.p_categoria as Categoria;
        const area = areaDe({ la, lo });
        if (travas.some((t) => t.ala === area.ala && t.alo === area.alo)) throw new BackendError("area_travada");
        gastar();
        const ja = avisos.find((x) => x.la === la && x.lo === lo && x.categoria === categoria);
        if (ja) return { ...ja, novo: false } as T;
        const n = novo(la, lo, categoria, false, 0);
        avisos.push(n);
        return { ...n, novo: true } as T;
      }
      case "rede_local_ainda_la": {
        const x = avisos.find((y) => y.id === a.p_id);
        if (!x) throw new BackendError("nao_encontrado");
        if (x.renovado) throw new BackendError("ja_renovado");
        gastar();
        x.renovado = true;
        x.expira_em = new Date(dez() + HORAS * 3600_000).toISOString();
        return x as T;
      }
      case "rede_local_apagar": {
        const i = avisos.findIndex((y) => y.id === a.p_id);
        if (i < 0) throw new BackendError("nao_encontrado");
        avisos.splice(i, 1);
        return undefined as T;
      }
      case "rede_local_travar": {
        const ala = Number(a.p_ala), alo = Number(a.p_alo);
        const ate = new Date(Date.now() + Number(a.p_horas) * 3600_000).toISOString();
        travas.push({ ala, alo, ate });
        for (let i = avisos.length - 1; i >= 0; i--) if (areaDe(avisos[i]).ala === ala && areaDe(avisos[i]).alo === alo) avisos.splice(i, 1);
        return { ala, alo, ate, apagados: false } as T;
      }
      case "rede_local_destravar": {
        const i = travas.findIndex((t) => t.ala === Number(a.p_ala) && t.alo === Number(a.p_alo));
        if (i >= 0) travas.splice(i, 1);
        return undefined as T;
      }
      default:
        throw new BackendError("desligado");
    }
  };
}

export const avisosDeLocal = criarClienteDosAvisos(PREVIA_DOS_AVISOS ? dubleDosAvisos() : chamar);
