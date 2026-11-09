// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { montarMosaico, type TipoDoCartao } from "@/lib/rede/mosaico";

/** Passo da grade em unidades do SVG: cartão de 19 com 3 de respiro, como nas pranchas (19 px + 3 px no celular de 390 px). */
const PASSO = 22;
const CARTAO = 19;
const RAIO = 4;

const COR: Record<Exclude<TipoDoCartao, "voce">, string> = {
  aceso: "var(--al-cartao-aceso, #f3efe6)",
  apagado: "var(--al-cartao-apagado, #2a2622)",
  "letra-acesa": "var(--al-letra-acesa, #e8321f)",
  "letra-apagada": "var(--al-letra-apagada, #7a281d)",
};

export interface PropsDoMosaico {
  /** A palavra do ato (ex.: "PASSE LIVRE"): normalizada aqui (maiúsculas, sem acento, até 14 caracteres). */
  palavra: string;
  /** A semente da grade: o id do ato. Decide QUAIS cartões acendem; nada vem de quem confirmou. */
  semente: string;
  /** A proporção acesa que o servidor manda (0,1 … 1 em passos de 10 %; nulo abaixo de 3 confirmações = tudo apagado). */
  proporcao: number | null;
  /** Largura máxima em cartões; acima dela a palavra quebra nos espaços (o celular usa 31, como a prancha). */
  quebrar?: number;
  /** A pessoa confirmou neste aparelho: um cartão aceso vira o dela (dourado, com anel). */
  voce?: boolean;
  /** Semente guardada só no aparelho para escolher o cartão dourado (a posição não sai daqui). */
  sementeLocal?: string;
  /** O que o leitor de tela diz (ex.: "Mosaico do ato PASSE LIVRE: 80% aceso; você é o cartão dourado"). */
  rotulo: string;
  className?: string;
}

/**
 * O mosaico do ato (pranchas celular-modo-atos e computador-inicio): cada cartão aceso é alguém que confirmou, a palavra do ato
 * aparece em vermelho e fica mais nítida com mais gente. É um desenho só (um <svg role="img"> com rótulo), sem número de pessoas:
 * a regra de privacidade fica em lib/rede/mosaico.ts. Componente sem estado: serve no servidor e no navegador.
 */
export function Mosaico({ palavra, semente, proporcao, quebrar, voce, sementeLocal, rotulo, className = "" }: PropsDoMosaico) {
  const m = montarMosaico(palavra, semente, proporcao, { quebrar, voce, sementeLocal });
  const largura = m.colunas * PASSO - (PASSO - CARTAO);
  const altura = m.linhas * PASSO - (PASSO - CARTAO);
  const margem = 4;
  return (
    <div
      className={`al-mosaico ${className}`}
      style={{ background: "var(--al-mosaico-fundo, #0b0a09)", border: "1px solid var(--al-linha, #2a2622)", borderRadius: "var(--al-raio, 14px)", padding: "clamp(8px, 2.5%, 18px)" }}
    >
      <svg
        role="img"
        aria-label={rotulo}
        viewBox={`${-margem} ${-margem} ${largura + 2 * margem} ${altura + 2 * margem}`}
        width="100%"
        style={{ display: "block", height: "auto" }}
        data-colunas={m.colunas}
        data-linhas={m.linhas}
      >
        {m.cartoes.map((tipo, i) => {
          const x = (i % m.colunas) * PASSO;
          const y = Math.floor(i / m.colunas) * PASSO;
          if (tipo === "voce") {
            return (
              <g key={i} data-voce="">
                <rect x={x - 3} y={y - 3} width={CARTAO + 6} height={CARTAO + 6} rx={RAIO + 2} fill="none" stroke="var(--al-voce, #ffc21a)" strokeWidth={2} />
                <rect x={x} y={y} width={CARTAO} height={CARTAO} rx={RAIO} fill="var(--al-voce, #ffc21a)" />
              </g>
            );
          }
          return <rect key={i} x={x} y={y} width={CARTAO} height={CARTAO} rx={RAIO} fill={COR[tipo]} stroke="var(--al-cartao-borda, transparent)" strokeWidth={1} />;
        })}
      </svg>
    </div>
  );
}
