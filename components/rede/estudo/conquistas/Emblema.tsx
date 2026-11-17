// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A medalha como ladrilho de 3 x 3 pedras (Mosaico da Arquibancada): a trilha acende o ladrilho inteiro em ouro; a redação e a
// monitoria acendem uma fileira por nível, de baixo para cima, e o último nível põe a pedra do meio em ouro. Só desenho: o nome
// da medalha vai no texto ao lado (o ladrilho é decorativo para o leitor de tela).
import type { Medalha } from "./regras";
import { por, type TextosDasConquistas } from "./textos";
import { nomeSemLista, type NomeDaTrilha } from "./usarNomesDasTrilhas";

export function Emblema({ medalha, nivel, pequeno = false }: { medalha: Medalha; nivel: number; pequeno?: boolean }) {
  const acesas = medalha === "trilha" ? 9 : Math.max(0, Math.min(3, nivel)) * 3;
  return (
    <span className={`cq-emblema${pequeno ? " cq-emblema-p" : ""}`} data-medalha={medalha} aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => {
        const aceso = 8 - i < acesas;
        return <i key={i} data-aceso={aceso ? "" : undefined} data-ouro={aceso && medalha !== "trilha" && nivel >= 3 && i === 4 ? "" : undefined} />;
      })}
    </span>
  );
}

/** O nome da medalha como a pessoa lê ("Terminou História do Brasil", "Corrige redações na roda"). */
export function nomeDaMedalha(t: TextosDasConquistas, medalha: Medalha, alvo: string, nivel: number, nomeDaTrilha: NomeDaTrilha = nomeSemLista): string {
  if (medalha === "trilha") return por(t.medalhas.trilha.nome, { trilha: nomeDaTrilha(alvo) });
  const niveis = t.medalhas[medalha].niveis;
  return nivel >= 1 ? niveis[Math.min(nivel, 3) - 1] : t.medalhas[medalha].rotulo;
}
