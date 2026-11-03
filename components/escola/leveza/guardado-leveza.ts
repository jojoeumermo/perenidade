// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect } from "react";
import { useGuardado } from "@/components/estudo/guardado";
import { useMatricula } from "@/components/escola/guardado-escola";
import {
  CHAVES_DA_LEVEZA,
  deveConvidar,
  gravarRespostaDoConvite,
  lerRespostaDoConvite,
  type MotivoDoConvite,
  type Resposta,
  type RespostaDoConvite,
  type TipoDeRede,
} from "@/lib/escola/leveza";
import { hojeEmBrasilia } from "@/lib/escola/tempo";
import { usePrefs } from "@/lib/prefs";

// O que a leveza guarda no aparelho (lucia:modo-pacote-convite e lucia:escola:aula-leve), lido de novo a cada mudança de
// estudo. No servidor e na hidratação começa vazio, para o HTML ser igual dos dois lados. Toda leitura e escrita com try/catch.

function armazenamento(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

interface Sinais {
  resposta: RespostaDoConvite | null;
  saveData: boolean;
  tipoDeRede: TipoDeRede;
}
const SEM_SINAIS: Sinais = { resposta: null, saveData: false, tipoDeRede: undefined };

function lerSinais(): Sinais {
  const conexao = (navigator as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  const tipo = conexao?.effectiveType;
  return {
    resposta: lerRespostaDoConvite(armazenamento()),
    saveData: conexao?.saveData === true,
    tipoDeRede: tipo === "slow-2g" || tipo === "2g" || tipo === "3g" || tipo === "4g" ? tipo : undefined,
  };
}

export function useConviteDoPacote(): { convidar: boolean; motivo: MotivoDoConvite | null; responder: (r: Resposta) => void } {
  const matricula = useMatricula();
  const prefs = usePrefs();
  const [sinais, atualizar] = useGuardado<Sinais>(lerSinais, SEM_SINAIS);
  const { convidar, motivo } = deveConvidar({
    pacoteLigado: prefs.pacote,
    acesso: matricula?.acesso ?? null,
    saveData: sinais.saveData,
    tipoDeRede: sinais.tipoDeRede,
    resposta: sinais.resposta,
    hoje: hojeEmBrasilia(),
  });
  const responder = (r: Resposta) => {
    gravarRespostaDoConvite(armazenamento(), r, hojeEmBrasilia());
    atualizar();
  };
  return { convidar, motivo, responder };
}

function lerAulaLeve(): boolean {
  try {
    return window.localStorage.getItem(CHAVES_DA_LEVEZA.AULA_LEVE) === "1";
  } catch {
    return false;
  }
}

/** "Só o texto": lê e grava o interruptor e põe data-aula-leve em <html> enquanto a aula está na tela. */
export function useAulaLeve(): [boolean, (ligado: boolean) => void] {
  const [leve, atualizar] = useGuardado<boolean>(lerAulaLeve, false);
  useEffect(() => {
    const raiz = document.documentElement;
    if (leve) raiz.setAttribute("data-aula-leve", "");
    else raiz.removeAttribute("data-aula-leve");
    return () => raiz.removeAttribute("data-aula-leve");
  }, [leve]);
  const definir = (ligado: boolean) => {
    try {
      if (ligado) window.localStorage.setItem(CHAVES_DA_LEVEZA.AULA_LEVE, "1");
      else window.localStorage.removeItem(CHAVES_DA_LEVEZA.AULA_LEVE);
      window.dispatchEvent(new Event("lucia:estudo"));
    } catch {
      // sem armazenamento: vale só para esta visita
    }
    atualizar();
  };
  return [leve, definir];
}
