// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { Botao } from "@/components/rede/ui/Botao";
import { rpc } from "@/lib/backend";
import { notificar } from "../../ui";
import { dia, Estado, Etiqueta, Nota, Quadro, textoDoErroDaAlumia, Titulo, useDado } from "../pecas";

type Situacao = "novo" | "visto" | "resolvido" | "descartado";
interface Relato {
  id: string;
  texto: string;
  tela: string;
  aparelho: string;
  medida: string;
  versao: string;
  situacao: Situacao;
  nota: string;
  dia: string;
}
interface ErroDaTela {
  mensagem: string;
  pagina: string;
  versao: string;
  navegador: string;
  vezes: number;
  primeiro: string;
  ultimo: string;
}

const NOMES: Record<Situacao, string> = { novo: "novo", visto: "visto", resolvido: "resolvido", descartado: "descartado" };

/**
 * A fila dos relatos de problema da Alumia (P5, A21): o que testadoras e testadores contaram pelo botão da ajuda. Sem conta, sem
 * endereço de rede, sem hora: só o texto, a tela (sem nada de quem é), o aparelho, a versão e o dia. Some em 180 dias.
 */
export function Relatos() {
  const lista = useDado<{ relatos: Relato[]; novos: number }>("alumia_admin_relatos");
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState("");

  async function mudar(r: Relato, situacao: Situacao) {
    setOcupado(r.id);
    try {
      await rpc("alumia_admin_relato_mudar", { p_id: r.id, p_situacao: situacao, p_nota: notas[r.id] ?? r.nota });
      notificar.ok(`Relato marcado como ${NOMES[situacao]}.`);
      lista.recarregar();
    } catch (erro) {
      notificar.erro(textoDoErroDaAlumia(erro));
    } finally {
      setOcupado("");
    }
  }

  const relatos = lista.dados?.relatos ?? [];
  return (
    <div className="ap-tela">
      <Titulo nome="Relatos do beta" sobre="O que as pessoas contaram pelo botão “Relatar um problema” da ajuda da Alumia. Sem conta, sem endereço de rede e sem hora: ninguém sabe quem relatou." />
      <Estado leitura={lista} vazio="Nenhum relato por enquanto." eVazio={lista.dados !== null && relatos.length === 0} />
      {relatos.map((r) => (
        <Quadro key={r.id} titulo={`${dia(r.dia)} · ${r.tela || "tela não informada"}`} lado={<Etiqueta tom={r.situacao === "novo" ? "vermelho" : r.situacao === "resolvido" ? "papel" : undefined}>{NOMES[r.situacao]}</Etiqueta>}>
          <p style={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{r.texto}</p>
          <p className="ap-miudo">{[r.aparelho, r.medida, r.versao && `versão ${r.versao}`].filter(Boolean).join(" · ") || "aparelho não informado"}</p>
          <label className="ap-miudo" style={{ display: "grid", gap: "0.25rem" }}>
            Nota da coordenação (só aqui)
            <textarea
              className="ap-campo"
              rows={2}
              maxLength={1000}
              value={notas[r.id] ?? r.nota}
              onChange={(e) => setNotas((n) => ({ ...n, [r.id]: e.target.value }))}
            />
          </label>
          <div className="ap-linha-acoes" style={{ justifyContent: "flex-start" }}>
            {(["visto", "resolvido", "descartado"] as const).filter((s) => s !== r.situacao).map((s) => (
              <Botao key={s} variante={s === "resolvido" ? "primario" : "contorno"} tamanho="p" disabled={ocupado === r.id} onClick={() => void mudar(r, s)}>
                {s === "visto" ? "Marcar como visto" : s === "resolvido" ? "Resolvido" : "Descartar"}
              </Botao>
            ))}
          </div>
        </Quadro>
      ))}
    </div>
  );
}

/**
 * Os erros que quebraram a tela de alguém nos últimos dias (P5, A21), somados: a mensagem (sem e-mail, link, @nome, id ou número),
 * a página (do mesmo jeito), a versão do site e a família do navegador. Para "Saúde e números". Somem em 30 dias.
 */
export function ErrosDaTela() {
  const [dias, setDias] = useState(7);
  const lista = useDado<{ dias: number; erros: ErroDaTela[] }>("alumia_admin_erros_tela", { p_dias: dias });
  const erros = lista.dados?.erros ?? [];
  return (
    <Quadro
      titulo="Erros da tela"
      lado={
        <div className="ap-linha-acoes">
          {[1, 7, 30].map((d) => (
            <Botao key={d} variante={d === dias ? "primario" : "contorno"} tamanho="p" aria-pressed={d === dias} onClick={() => setDias(d)}>
              {d === 1 ? "Hoje" : `${d} dias`}
            </Botao>
          ))}
        </div>
      }
    >
      <Estado leitura={lista} vazio="Nenhum erro de tela no período." eVazio={lista.dados !== null && erros.length === 0} />
      {erros.length > 0 ? (
        <ul className="ap-lista">
          {erros.map((e) => (
            <li key={`${e.mensagem}|${e.pagina}|${e.versao}|${e.navegador}`} className="ap-linha">
              <span className="ap-linha-texto">
                <span className="ap-forte" style={{ overflowWrap: "anywhere" }}>{e.mensagem}</span>
                <span className="ap-miudo" style={{ overflowWrap: "anywhere" }}>
                  {e.pagina} · {e.navegador} · {e.versao ? `versão ${e.versao}` : "versão desconhecida"} · {e.primeiro === e.ultimo ? dia(e.ultimo) : `${dia(e.primeiro)} a ${dia(e.ultimo)}`}
                </span>
              </span>
              <Etiqueta>{`${e.vezes}×`}</Etiqueta>
            </li>
          ))}
        </ul>
      ) : null}
      <Nota>Sem conta, sem endereço de rede e sem conteúdo: só a mensagem limpa, a página, a versão e o navegador, somados por dia.</Nota>
    </Quadro>
  );
}
