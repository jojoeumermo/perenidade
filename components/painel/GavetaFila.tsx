// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { ArrowDown, Archive, Check, ExternalLink, FileText, X } from "lucide-react";
import { useState } from "react";
import { baixarPdf, enderecoDaLicenca, type Trabalho } from "@/lib/gaveta";
import { safeLink } from "@/lib/text";
import { useI18n } from "../I18n";
import { dataHora, useAcao, useLista } from "./comum";
import { MoldeFila } from "./moldes";
import { Abas, Botao, CabecalhoDeSecao, Campo, type ComandoDaSecao, Faixa, perguntarTexto, Selo, type TomDoSelo, useComandosDaSecao, Vazio } from "./ui";

const tipos: Record<string, string> = { tcc: "TCC", monografia: "Monografia", dissertacao: "Dissertação ou tese", artigo: "Artigo", projeto: "Projeto", relatorio: "Relatório", apostila: "Apostila ou resumo", codigo: "Código", apresentacao: "Apresentação", outro: "Outro" };
const situacoes: Record<string, string> = { pendente: "esperando decisão", aprovado: "publicado", recusado: "recusado", retirado: "retirado por quem publicou" };
const TOM: Record<string, TomDoSelo> = { pendente: "bordo", aprovado: "ok", recusado: "erro", retirado: "neutro" };

/** A prévia do PDF para quem decide: abre numa aba nova, a partir do depósito fechado. */
function Previa({ caminho }: { caminho: string }) {
  const [erro, setErro] = useState("");
  return (
    <>
      <Botao
        pequeno
        variante="discreto"
        simbolo={FileText}
        onClick={async () => {
          setErro("");
          // A aba abre antes do download terminar, senão o navegador a trata como janela indesejada.
          const aba = window.open("", "_blank");
          try {
            const endereco = await baixarPdf(caminho);
            if (aba) aba.location.href = endereco;
            else window.location.href = endereco;
          } catch {
            aba?.close();
            setErro("O arquivo não abriu.");
          }
        }}
      >
        Ver o PDF
      </Botao>
      {erro && <span className="pn-erro"> {erro}</span>}
    </>
  );
}

/**
 * Gaveta Aberta: a fila do que estudantes publicaram. Quem decide confere se é mesmo trabalho de estudante, se o
 * arquivo não expõe dados de ninguém (nem nos metadados) e se o comentário está de acordo com as regras. Molde Fila:
 * a lista de um lado e o trabalho aberto do outro; Publicar, Recusar e Próximo também pela paleta (Ctrl K).
 */
export function GavetaFila() {
  const { t } = useI18n();
  const lista = useLista<Trabalho[]>("gaveta_fila");
  const [notas, setNotas] = useState<Record<string, string>>({});
  const acao = useAcao(lista.recarregar);
  const [mostrar, setMostrar] = useState<"pendente" | "decididos">("pendente");
  const visiveis = lista.dados?.filter((item) => (mostrar === "pendente" ? item.status === "pendente" : item.status !== "pendente")) ?? [];
  const nomeDaArea = (slug: string) => t.areas[slug as keyof typeof t.areas]?.[0] ?? slug;
  const esperando = lista.dados?.filter((item) => item.status === "pendente").length ?? 0;
  return (
    <div className="pn-tela">
      <p className="pn-sobre">
        Antes de aprovar: é trabalho de estudante, de quem publicou? O link ou o PDF abre e é o trabalho descrito? O arquivo não expõe dados de outras pessoas (entrevistados, endereços, documentos), nem nas
        propriedades do PDF? O comentário segue as regras de convivência? O nome completo do termo é só para o registro do aceite e nunca aparece no site.
      </p>
      <Abas
        rotulo="Gaveta Aberta"
        valor={mostrar}
        aoMudar={setMostrar}
        opcoes={[
          { id: "pendente", nome: "Esperando", conta: esperando },
          { id: "decididos", nome: "Decididos nos últimos 60 dias" },
        ]}
      />
      {lista.erro && (
        <Faixa
          tom="erro"
          acao={
            <Botao pequeno onClick={lista.recarregar}>
              Tentar de novo
            </Botao>
          }
        >
          {lista.erro}
        </Faixa>
      )}
      {acao.aviso && <Faixa tom="info">{acao.aviso}</Faixa>}
      {!lista.erro && (
        <MoldeFila
          id="gaveta"
          rotulo="Gaveta Aberta"
          itens={visiveis}
          chave={(item) => item.id}
          carregando={lista.dados === null}
          vazio={<Vazio simbolo={Archive} titulo="Nada aqui." />}
          linha={(item) => (
            <span style={{ display: "grid", gap: "0.2rem", minWidth: 0 }}>
              <span className="pn-rotulo-mono">
                {tipos[item.tipo] ?? item.tipo} · {nomeDaArea(item.disciplina)}
              </span>
              <span className="font-serif text-lg font-semibold leading-snug">{item.titulo}</span>
              <span className="pn-item-meta">{item.credito}</span>
              <span>
                <Selo tom={TOM[item.status ?? ""] ?? "neutro"}>{situacoes[item.status ?? ""] ?? item.status}</Selo>
              </span>
            </span>
          )}
          detalhe={(item, proximo) => (
            <DetalheDaGaveta
              key={item.id}
              item={item}
              nomeDaArea={nomeDaArea}
              nota={notas[item.id] ?? ""}
              mudarNota={(valor) => setNotas((antes) => ({ ...antes, [item.id]: valor }))}
              ocupado={acao.ocupado}
              agir={acao.agir}
              proximo={proximo}
            />
          )}
        />
      )}
    </div>
  );
}

function DetalheDaGaveta({
  item,
  nomeDaArea,
  nota,
  mudarNota,
  ocupado,
  agir,
  proximo,
}: {
  item: Trabalho;
  nomeDaArea: (slug: string) => string;
  nota: string;
  mudarNota: (valor: string) => void;
  ocupado: boolean;
  agir: (funcao: string, argumentos: Record<string, unknown>, sucesso?: string) => Promise<unknown>;
  proximo: () => void;
}) {
  // Publicar põe no ar: espera o banco responder (não é otimista).
  const publicar = () => agir("gaveta_decidir", { p_id: item.id, p_aprovar: true, p_nota: nota }, "Publicado na Gaveta.");
  const recusar = (recado = nota) => agir("gaveta_decidir", { p_id: item.id, p_aprovar: false, p_nota: recado }, item.status === "aprovado" ? "Tirado do ar." : "Recusado.");
  const decidivel = item.status !== "retirado";

  const comandos: ComandoDaSecao[] = [
    ...(decidivel && item.status !== "aprovado" ? [{ id: "gaveta-publicar", nome: "Publicar", simbolo: Check, fazer: () => void publicar() }] : []),
    ...(decidivel && item.status !== "recusado"
      ? [
          {
            id: "gaveta-recusar",
            nome: item.status === "aprovado" ? "Tirar do ar" : "Recusar",
            simbolo: X,
            fazer: async () => {
              // A nota é obrigatória para recusar: se ainda não foi escrita, a paleta pergunta.
              const recado = nota.trim().length >= 5 ? nota : await perguntarTexto(`Nota para quem publicou ${item.status === "pendente" ? "(obrigatória para recusar)" : ""}`.trim(), "", { multilinha: true, obrigatorio: true });
              if (recado && recado.trim().length >= 5) {
                mudarNota(recado);
                await recusar(recado);
              }
            },
          },
        ]
      : []),
    { id: "gaveta-proximo", nome: "Próximo", simbolo: ArrowDown, atalho: "j", fazer: proximo },
  ];
  useComandosDaSecao(comandos, [item.id, item.status]);

  return (
    <article className="pn-secao">
      <CabecalhoDeSecao
        rotulo={
          <>
            {tipos[item.tipo] ?? item.tipo} · {nomeDaArea(item.disciplina)} · {item.licenca} · enviado em {item.criado_em ? dataHora(item.criado_em) : "?"}
          </>
        }
        titulo={item.titulo}
        sobre={[item.curso, item.instituicao, item.ano ? String(item.ano) : ""].filter(Boolean).join(" · ") || undefined}
      />
      <p>
        <Selo tom={TOM[item.status ?? ""] ?? "neutro"}>{situacoes[item.status ?? ""] ?? item.status}</Selo>
      </p>
      <p>
        Crédito público: <strong>{item.credito}</strong> · conta: {item.autor || "apagada"}
      </p>
      <p className="whitespace-pre-line" data-original>
        {item.comentario}
      </p>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {item.link && safeLink(item.link) && (
          <a href={item.link} target="_blank" rel="noopener noreferrer" className="pn-elo inline-flex items-center gap-1 break-all">
            <ExternalLink aria-hidden width={14} height={14} />
            Abrir o link: {item.link}
          </a>
        )}
        {item.arquivo && <Previa caminho={item.arquivo} />}
        <a href={enderecoDaLicenca[item.licenca]} target="_blank" rel="noopener noreferrer" className="pn-elo">
          A licença escolhida
        </a>
      </p>
      <p className="pn-ajuda text-xs">
        Termo versão {item.termo_versao} aceito por <strong>{item.termo_nome}</strong> em {item.termo_em ? dataHora(item.termo_em) : "?"}.
      </p>
      {item.status !== "pendente" && (item.decidido_por || item.nota) && (
        <p className="pn-ajuda">
          Decidido por {item.decidido_por || "?"}
          {item.nota && `: ${item.nota}`}
        </p>
      )}
      {decidivel && (
        <div className="grid gap-3 border-t border-rule pt-3">
          <Campo rotulo={`Nota para quem publicou ${item.status === "pendente" ? "(obrigatória para recusar)" : ""}`.trim()} value={nota} onChange={(e) => mudarNota(e.target.value)} maxLength={1000} />
          <p className="flex flex-wrap gap-2">
            {item.status !== "aprovado" && (
              <Botao variante="principal" simbolo={Check} disabled={ocupado} onClick={() => void publicar()}>
                Publicar
              </Botao>
            )}
            {item.status !== "recusado" && (
              <Botao simbolo={X} disabled={ocupado || nota.trim().length < 5} onClick={() => void recusar()}>
                {item.status === "aprovado" ? "Tirar do ar" : "Recusar"}
              </Botao>
            )}
          </p>
        </div>
      )}
    </article>
  );
}
