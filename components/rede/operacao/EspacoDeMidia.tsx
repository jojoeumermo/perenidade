// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O espaço de mídia da Alumia no painel de controle (Onda 8, operação): o total de cada depósito, a cota de cada pessoa, os
// arquivos órfãos e a última faxina. Só totais, do banco (public.alumia_painel_espaco): nenhum nome, nenhuma lista, e "perto da
// cota" só a partir de 3 pessoas. Quem junta a onda põe este quadro na Visão geral (components/painel/alumia/Geral.tsx), dentro
// do contexto do painel (usa as peças dele). O painel é em português, como o resto dele.
import { Botao } from "@/components/rede/ui/Botao";
import { Estado, Etiqueta, Quadro, quando, useDado } from "@/components/painel/alumia/pecas";

interface Deposito {
  bytes: number;
  arquivos: number;
}
export interface EspacoDaAlumia {
  cota: number;
  /** "rede-album" (as fotos do álbum dos atos) só vem com o banco da onda 11 em diante. */
  depositos: { "rede-midia": Deposito; "rede-stories": Deposito; "rede-album"?: Deposito };
  perto_da_cota: number | null;
  orfaos: number;
  faxina: { quando: string; detalhes: { apagados?: number; bytes?: number; falhas?: number } } | null;
  faxina_ligada: boolean;
  deposito: boolean;
}

/** Bytes em texto curto, em português (1,2 GB; 340 MB). */
export function tamanho(bytes: number): string {
  const n = Math.max(0, Number(bytes) || 0);
  const formato = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: v < 10 ? 1 : 0 });
  if (n >= 1024 ** 3) return `${formato(n / 1024 ** 3)} GB`;
  if (n >= 1024 ** 2) return `${formato(n / 1024 ** 2)} MB`;
  if (n >= 1024) return `${formato(n / 1024)} KB`;
  return `${n} bytes`;
}

function Linha({ nome, valor, nota, tom }: { nome: string; valor: string; nota?: string; tom?: "vermelho" | "dourado" | "papel" }) {
  return (
    <li className="ap-linha">
      <span className="ap-linha-texto">
        <span className="ap-forte">{nome}</span>
        {nota ? <span className="ap-miudo">{nota}</span> : null}
      </span>
      <Etiqueta tom={tom}>{valor}</Etiqueta>
    </li>
  );
}

export function EspacoDeMidia() {
  const leitura = useDado<EspacoDaAlumia>("alumia_painel_espaco");
  const e = leitura.dados;
  return (
    <Quadro
      titulo="Espaço de mídia"
      lado={
        <Botao variante="contorno" tamanho="p" onClick={leitura.recarregar}>
          Atualizar
        </Botao>
      }
    >
      <Estado leitura={leitura} />
      {e ? (
        <ul className="ap-lista">
          <Linha nome="Imagens e áudios dos posts" valor={tamanho(e.depositos["rede-midia"].bytes)} nota={`${e.depositos["rede-midia"].arquivos.toLocaleString("pt-BR")} arquivos`} />
          <Linha nome="Stories (imagem e vídeo)" valor={tamanho(e.depositos["rede-stories"].bytes)} nota={`${e.depositos["rede-stories"].arquivos.toLocaleString("pt-BR")} arquivos`} />
          {e.depositos["rede-album"] ? (
            <Linha nome="Fotos do álbum dos atos" valor={tamanho(e.depositos["rede-album"].bytes)} nota={`${e.depositos["rede-album"].arquivos.toLocaleString("pt-BR")} arquivos`} />
          ) : null}
          <Linha
            nome="Cota de cada pessoa"
            valor={tamanho(e.cota)}
            nota={`Somando posts${e.depositos["rede-album"] ? ", stories e fotos do álbum dos atos" : " e stories"}. Muda em interno.configuracoes, chave midia_cota.`}
          />
          <Linha
            nome="Perto da cota"
            valor={e.perto_da_cota === null ? "menos de 3" : `${e.perto_da_cota.toLocaleString("pt-BR")} pessoas`}
            nota="Com 80% da cota ou mais. Nunca quem: só a conta."
            tom={e.perto_da_cota === null ? undefined : "dourado"}
          />
          <Linha
            nome="Arquivos órfãos"
            valor={e.orfaos.toLocaleString("pt-BR")}
            nota="Imagens e áudios sem post há mais de 24 horas: a faxina apaga."
            tom={e.orfaos > 0 && !e.faxina_ligada ? "dourado" : undefined}
          />
          <Linha
            nome="Faxina da mídia"
            valor={!e.faxina_ligada ? "não ligada" : e.faxina ? quando(e.faxina.quando) : "ainda não rodou"}
            nota={
              !e.faxina_ligada
                ? "Falta publicar a função faxina-midia e dizer ao banco onde ela está."
                : e.faxina
                  ? `Última vez: ${(e.faxina.detalhes.apagados ?? 0).toLocaleString("pt-BR")} arquivos, ${tamanho(e.faxina.detalhes.bytes ?? 0)}${e.faxina.detalhes.falhas ? `, ${e.faxina.detalhes.falhas} lote(s) com falha` : ""}.`
                  : "Roda todo dia às 4h30."
            }
            tom={!e.faxina_ligada ? "vermelho" : "papel"}
          />
          {!e.deposito ? <Linha nome="Depósito" valor="sem depósito" nota="Este banco não tem o depósito de arquivos (cópia local)." /> : null}
        </ul>
      ) : null}
    </Quadro>
  );
}
