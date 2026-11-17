// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Aparência e leitura da Alumia: o tema (o do aparelho, claro ou escuro) e a opção de bem-estar "ocultar números". As duas
// escolhas ficam SÓ neste aparelho (localStorage), nunca vão ao servidor e somem com o "Sair rápido" (a chave começa com o
// prefixo da rede, lib/rede/saida.ts). O tamanho da letra, o contraste alto e o "menos movimento" são os do site (lib/prefs.ts):
// a tela de ajustes mexe neles, e eles valem no site inteiro.
//
// As escolhas viram atributos na caixa [data-al="2"] (app/[lang]/alumia/layout.tsx), que o CSS lê:
//   data-al-tema="claro"      os tokens do tema claro (styles/alumia-tokens.css); sem o atributo, o escuro das pranchas
//   data-al-sem-numeros       esconde o que está marcado com data-al-numero (seguidores e contagens)
// Sem DOM nas funções puras e sem "@/" de propósito (roda no Node nos testes: scripts/testar-alumia-aparencia.mjs).

/** A chave no armazenamento do navegador. Começa com "lucia:rede": o "Sair rápido" apaga. */
export const CHAVE_DA_APARENCIA = "lucia:rede:aparencia";

/** O aviso (na mesma aba) de que a escolha mudou. */
export const EVENTO_DA_APARENCIA = "alumia:aparencia";

export const TEMAS_DA_ALUMIA = ["sistema", "claro", "escuro"] as const;
export type TemaDaAlumia = (typeof TEMAS_DA_ALUMIA)[number];

export interface AparenciaDaAlumia {
  tema: TemaDaAlumia;
  /** Bem-estar: esconde seguidores e contagens (apoios, respostas, membros). Os números continuam existindo; só não aparecem. */
  semNumeros: boolean;
}

/** O padrão é o escuro das pranchas; "sistema" segue o aparelho. */
export const APARENCIA_PADRAO: AparenciaDaAlumia = { tema: "escuro", semNumeros: false };

/** Lê o que está guardado. Qualquer coisa fora do esperado (texto quebrado, valor desconhecido) vira o padrão. Pura. */
export function lerAparencia(bruto: string | null | undefined): AparenciaDaAlumia {
  if (!bruto) return { ...APARENCIA_PADRAO };
  try {
    const x = JSON.parse(bruto) as { tema?: unknown; semNumeros?: unknown } | null;
    const tema = (TEMAS_DA_ALUMIA as readonly unknown[]).includes(x?.tema) ? (x?.tema as TemaDaAlumia) : APARENCIA_PADRAO.tema;
    return { tema, semNumeros: x?.semNumeros === true };
  } catch {
    return { ...APARENCIA_PADRAO };
  }
}

/** O tema que vale agora: "sistema" segue o aparelho. Pura. */
export function temaQueVale(tema: TemaDaAlumia, aparelhoClaro: boolean): "claro" | "escuro" {
  if (tema === "sistema") return aparelhoClaro ? "claro" : "escuro";
  return tema;
}

/** Os atributos da caixa da Alumia para uma escolha: valor nulo = sem o atributo. Pura. */
export function atributosDaAparencia(a: AparenciaDaAlumia, aparelhoClaro: boolean): Record<"data-al-tema" | "data-al-sem-numeros", string | null> {
  return {
    "data-al-tema": temaQueVale(a.tema, aparelhoClaro) === "claro" ? "claro" : null,
    "data-al-sem-numeros": a.semNumeros ? "" : null,
  };
}

const CONSULTA_CLARO = "(prefers-color-scheme: light)";

/**
 * O mesmo que aplicarAparencia, em texto, para rodar ANTES da primeira pintura (um <script> no layout da Alumia): sem ele a
 * pessoa que escolheu o claro veria a noite piscar a cada página. Não usa nada de fora; qualquer erro deixa o padrão.
 */
export const scriptDaAparencia = `(function(){try{var e=document.querySelector('[data-al="2"]');if(!e)return;var a=JSON.parse(localStorage.getItem(${JSON.stringify(CHAVE_DA_APARENCIA)})||"{}")||{};var t=a.tema==="claro"||a.tema==="sistema"?a.tema:"escuro";if(t==="sistema")t=matchMedia(${JSON.stringify(CONSULTA_CLARO)}).matches?"claro":"escuro";if(t==="claro")e.setAttribute("data-al-tema","claro");if(a.semNumeros===true)e.setAttribute("data-al-sem-numeros","")}catch(x){}})()`;

/** Lê a escolha guardada neste aparelho (o padrão, sem armazenamento). Só no navegador. */
export function aparenciaGuardada(): AparenciaDaAlumia {
  try {
    return lerAparencia(window.localStorage.getItem(CHAVE_DA_APARENCIA));
  } catch {
    return { ...APARENCIA_PADRAO };
  }
}

/** Põe (ou tira) os atributos em todas as caixas da Alumia da página. Só no navegador. */
export function aplicarAparencia(a: AparenciaDaAlumia): void {
  let aparelhoClaro = false;
  try {
    aparelhoClaro = window.matchMedia(CONSULTA_CLARO).matches;
  } catch {
    aparelhoClaro = false;
  }
  const atributos = atributosDaAparencia(a, aparelhoClaro);
  document.querySelectorAll('[data-al="2"]').forEach((caixa) => {
    for (const [nome, valor] of Object.entries(atributos)) {
      if (valor === null) caixa.removeAttribute(nome);
      else caixa.setAttribute(nome, valor);
    }
  });
}

/** Guarda a escolha neste aparelho, aplica na hora e avisa as outras peças da tela. Só no navegador. */
export function guardarAparencia(mudanca: Partial<AparenciaDaAlumia>): AparenciaDaAlumia {
  const nova = lerAparencia(JSON.stringify({ ...aparenciaGuardada(), ...mudanca }));
  try {
    window.localStorage.setItem(CHAVE_DA_APARENCIA, JSON.stringify(nova));
  } catch {
    // sem armazenamento (janela privada, bloqueado): vale só até fechar a página
  }
  aplicarAparencia(nova);
  window.dispatchEvent(new CustomEvent(EVENTO_DA_APARENCIA, { detail: nova }));
  return nova;
}

/** Mantém a caixa da Alumia em dia: ao montar, quando o aparelho troca de tema e quando outra aba muda a escolha. Devolve como parar. */
export function acompanharAparencia(aoMudar?: (a: AparenciaDaAlumia) => void): () => void {
  const aplicar = () => {
    const a = aparenciaGuardada();
    aplicarAparencia(a);
    aoMudar?.(a);
  };
  aplicar();
  let consulta: MediaQueryList | null = null;
  try {
    consulta = window.matchMedia(CONSULTA_CLARO);
    consulta.addEventListener("change", aplicar);
  } catch {
    consulta = null;
  }
  const deOutraAba = (e: StorageEvent) => {
    if (e.key === null || e.key === CHAVE_DA_APARENCIA) aplicar();
  };
  window.addEventListener("storage", deOutraAba);
  window.addEventListener(EVENTO_DA_APARENCIA, aplicar);
  return () => {
    consulta?.removeEventListener("change", aplicar);
    window.removeEventListener("storage", deOutraAba);
    window.removeEventListener(EVENTO_DA_APARENCIA, aplicar);
  };
}
