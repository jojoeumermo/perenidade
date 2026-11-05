// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Contrato das telas do aplicativo (para o pacote "app-telas"). Duas coisas:
//  1. TELA CHEIA: a tela some com a barra de baixo e a de cima (laboratório aberto, leitura em foco);
//  2. UMA TELA POR VEZ: quem abre uma tela de ferramenta (laboratório, aula em janela) pede a vaga; a que estava aberta
//     recebe o aviso e se fecha. Era a causa de "abrir um laboratório e a aula ao mesmo tempo quebra tudo": dois donos
//     da mesma tela, do mesmo foco e do mesmo botão de voltar. Só no navegador.
import { useEffect } from "react";

const EVENTO = "lucia:tela-aberta";

// Conta pilha: duas telas cheias seguidas não se atropelam (a marca só sai quando a última fecha).
let cheias = 0;

/** Marca, no <html>, que há uma tela cheia aberta (data-tela-cheia) enquanto `ativa` for verdadeiro. */
export function useTelaCheia(ativa: boolean): void {
  useEffect(() => {
    if (!ativa) return;
    cheias += 1;
    document.documentElement.setAttribute("data-tela-cheia", "");
    return () => {
      cheias = Math.max(0, cheias - 1);
      if (cheias === 0) document.documentElement.removeAttribute("data-tela-cheia");
    };
  }, [ativa]);
}

// As telas de ferramenta abertas agora, da mais antiga para a mais nova: quem fecha ao voltar é a última.
const abertas: { id: string; fechar: () => void }[] = [];

/**
 * Pede a vaga de "a tela da vez". `fechar` é chamada se OUTRA tela pedir a vaga depois. Devolve a função que devolve a
 * vaga. Pedir de novo com o mesmo id (a mesma tela remontada) não fecha a si mesma.
 */
export function pedirTela(id: string, fechar: () => void): () => void {
  const ouvir = (e: Event) => {
    const outro = (e as CustomEvent<string>).detail;
    if (outro !== id) fechar();
  };
  window.addEventListener(EVENTO, ouvir);
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: id }));
  const registro = { id, fechar };
  abertas.push(registro);
  return () => {
    window.removeEventListener(EVENTO, ouvir);
    const i = abertas.indexOf(registro);
    if (i >= 0) abertas.splice(i, 1);
  };
}

/** Há uma tela de ferramenta aberta (folha da aula, gaveta, cartão, consulta de palavra)? */
export const haTelaAberta = (): boolean => abertas.length > 0;

/**
 * O "voltar" (botão da barra, gesto, tecla do sistema) fecha primeiro a tela de ferramenta aberta, em vez de sair da
 * página por baixo dela. Devolve true se fechou alguma (e então quem chamou não deve navegar).
 */
export function fecharTelaDaVez(): boolean {
  const ultima = abertas[abertas.length - 1];
  if (!ultima) return false;
  ultima.fechar();
  return true;
}

/** Fecha todas as telas de ferramenta (a casca chama ao mudar de endereço: nada fica aberto na tela seguinte). */
export function fecharTelas(): void {
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: "*" }));
}

/** O gancho de `pedirTela`: enquanto `aberta`, esta tela é a da vez. */
export function useTelaDaVez(id: string, aberta: boolean, fechar: () => void): void {
  useEffect(() => {
    if (!aberta) return;
    return pedirTela(id, fechar);
    // `fechar` costuma ser recriada a cada render; a vaga só muda quando a tela abre ou fecha.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, aberta]);
}

// Trava de rolagem com contagem. Antes cada tela travava e destravava o <html> por conta própria: com duas abertas,
// fechar uma soltava a trava da outra (a página rolava por baixo) ou deixava a página travada para sempre.
let travas = 0;
let valorAntes = "";

/** Trava a rolagem da página. Devolve a função que solta; a rolagem só volta quando a última trava é solta. */
export function travarRolagem(): () => void {
  const raiz = document.documentElement;
  if (travas === 0) {
    valorAntes = raiz.style.getPropertyValue("overflow");
    raiz.style.setProperty("overflow", "hidden");
  }
  travas += 1;
  let solta = false;
  return () => {
    if (solta) return;
    solta = true;
    travas = Math.max(0, travas - 1);
    if (travas === 0) {
      if (valorAntes) raiz.style.setProperty("overflow", valorAntes);
      else raiz.style.removeProperty("overflow");
    }
  };
}

/** Enquanto `ativa`, a página não rola por baixo da tela aberta. */
export function useTravaDeRolagem(ativa: boolean): void {
  useEffect(() => {
    if (!ativa) return;
    return travarRolagem();
  }, [ativa]);
}
