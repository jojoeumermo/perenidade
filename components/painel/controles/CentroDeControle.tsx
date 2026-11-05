// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { dataHora, useLista } from "../comum";
import { MoldeRegistro } from "../moldes";
import { Abas, Botao, Cartao, Esqueleto, Faixa, ItemDeLista, Lista } from "../ui";
import { BloquearArquivo } from "./BloquearArquivo";
import { CanaisDoCelular } from "./CanaisDoCelular";
import { ModeradoresDaRede } from "./ModeradoresDaRede";
import { NucleosFechados } from "./NucleosFechados";
import { PublicarAgora } from "./PublicarAgora";
import { RadioCanais } from "./RadioCanais";
import { cartoesDoCentro, type CartaoDoCentro, type ResumoDosControles } from "./regras";
import { SalaDaEquipe } from "./SalaDaEquipe";

type Aba = "resumo" | "canais" | "sala" | "radio" | "moderadores" | "nucleos" | "arquivos";

const ABAS: { id: Aba; nome: string }[] = [
  { id: "resumo", nome: "Resumo" },
  { id: "canais", nome: "Canais no celular" },
  { id: "sala", nome: "Sala da equipe" },
  { id: "radio", nome: "Rádio" },
  { id: "moderadores", nome: "Moderadores" },
  { id: "nucleos", nome: "Núcleos da Rede" },
  { id: "arquivos", nome: "Arquivos bloqueados" },
];

/** Cada cartão do resumo leva à aba do controle (a publicação não tem aba: o botão está no próprio cartão). */
const ABA_DO_CARTAO: Partial<Record<CartaoDoCentro["id"], Aba>> = { canais: "canais", sala: "sala", radio: "radio", moderadores: "moderadores", nucleos: "nucleos", arquivos: "arquivos" };

/** Os controles do site que já têm uma seção própria no painel, para pular direto. */
const OUTRAS_SECOES: { id: string; nome: string; sobre: string }[] = [
  { id: "site", nome: "Controles do site", sobre: "A faixa do alto, a pausa geral de envios e o cadastro aberto." },
  { id: "abertura", nome: "Aviso de abertura", sobre: "O quadro que aparece quando o site abre." },
  { id: "emissoras", nome: "Rádio no ar", sobre: "Pôr a Rádio Lúcia no ar pelo YouTube e indicar emissoras." },
  { id: "interdicao", nome: "Interdição e expurgo", sobre: "Tirar o site ou uma área do ar por um tempo." },
  { id: "seguranca", nome: "Segurança e sucessão", sobre: "Segundo fator obrigatório e ordem de sucessão." },
  { id: "apoiadores", nome: "Apoio e transparência", sobre: "A página de Apoie, metas, custos e apoiadores." },
  { id: "tecnico", nome: "Estado técnico", sobre: "Publicação, avaliação automática, faxina e varredura." },
];

interface Diagnostico {
  aprovadas: number;
  aprovada_mais_antiga: string | null;
  ultima_publicacao: string | null;
  arquivos_aprovados: number;
}

/**
 * Centro de controle (espaço Site e operação): reúne os controles do coordenador que antes ficavam espalhados. O resumo mostra
 * como cada um está agora (só liga/desliga e contagens, nenhum endereço nem pessoa), com o atalho para mexer; as outras abas
 * são os controles em si. "Publicar agora" fica à mão. Quem não é da coordenação nem chega aqui (a seção só aparece para ela).
 */
export function CentroDeControle({ ir }: { ir?: (id: string) => void }) {
  const [aba, setAba] = useState<Aba>("resumo");
  return (
    <Abas
      rotulo="Controles do coordenador"
      opcoes={ABAS}
      valor={aba}
      aoMudar={setAba}
      painel={(id) => {
        if (id === "canais") return <CanaisDoCelular />;
        if (id === "sala") return <SalaDaEquipe />;
        if (id === "radio") return <RadioCanais />;
        if (id === "moderadores") return <ModeradoresDaRede />;
        if (id === "nucleos") return <NucleosFechados />;
        if (id === "arquivos") return <BloquearArquivo />;
        return <Resumo irParaAba={setAba} ir={ir} />;
      }}
    />
  );
}

function Resumo({ irParaAba, ir }: { irParaAba: (aba: Aba) => void; ir?: (id: string) => void }) {
  const resumo = useLista<ResumoDosControles>("controles_resumo");
  const diagnostico = useLista<Diagnostico>("diagnostico", {}, { quieta: true });
  if (!resumo.dados) {
    return resumo.erro ? (
      <Faixa
        tom="erro"
        acao={
          <Botao pequeno onClick={resumo.recarregar}>
            Tentar de novo
          </Botao>
        }
      >
        {resumo.erro}
      </Faixa>
    ) : (
      <Esqueleto linhas={4} rotulo="Carregando o resumo dos controles" />
    );
  }
  const cartoes = cartoesDoCentro(resumo.dados);
  const d = diagnostico.dados;
  return (
    <MoldeRegistro
      secoes={[
        {
          id: "agora",
          titulo: "Como está agora",
          conteudo: (
            <ul style={{ display: "grid", gap: "0.7rem", gridTemplateColumns: "repeat(auto-fill, minmax(17rem, 1fr))", listStyle: "none", padding: 0, margin: 0 }}>
              {cartoes.map((c) => {
                const destino = ABA_DO_CARTAO[c.id];
                return (
                  <li key={c.id} style={{ display: "grid" }}>
                    <Cartao
                      as="div"
                      titulo={c.titulo}
                      nivelDoTitulo={3}
                      variante={c.atencao ? "alerta" : "padrao"}
                      style={{ display: "grid", gap: "0.5rem", alignContent: "space-between" }}
                    >
                      <p className="pn-ajuda">{c.estado}</p>
                      <div>
                        {destino ? (
                          <Botao pequeno simboloFim={ArrowRight} onClick={() => irParaAba(destino)}>
                            Abrir
                          </Botao>
                        ) : (
                          <PublicarAgora pequeno />
                        )}
                      </div>
                    </Cartao>
                  </li>
                );
              })}
            </ul>
          ),
        },
        {
          id: "publicacao",
          titulo: "Publicação",
          conteudo: (
            <div style={{ display: "grid", gap: "0.5rem" }}>
              {d ? (
                <p className="pn-ajuda">
                  {d.aprovadas} {d.aprovadas === 1 ? "contribuição aprovada esperando" : "contribuições aprovadas esperando"} a rotina
                  {d.aprovada_mais_antiga ? ` (a mais antiga desde ${dataHora(d.aprovada_mais_antiga)})` : ""} · {d.arquivos_aprovados} {d.arquivos_aprovados === 1 ? "arquivo aprovado" : "arquivos aprovados"} · última publicação: {d.ultima_publicacao ? dataHora(d.ultima_publicacao) : "nenhuma ainda"}.
                </p>
              ) : (
                <p className="pn-ajuda">{diagnostico.erro || "Carregando o estado da publicação…"}</p>
              )}
              <div>
                <PublicarAgora explicar />
              </div>
            </div>
          ),
        },
        {
          id: "outras",
          titulo: "Outros controles do site",
          conteudo: (
            <Lista rotulo="Outros controles do site" plana>
              {OUTRAS_SECOES.map((s) => (
                <ItemDeLista
                  key={s.id}
                  titulo={<strong>{s.nome}</strong>}
                  meta={s.sobre}
                  acoes={
                    ir && (
                      <Botao pequeno variante="discreto" simboloFim={ArrowRight} onClick={() => ir(s.id)}>
                        Ir para a seção
                      </Botao>
                    )
                  }
                />
              ))}
            </Lista>
          ),
        },
      ]}
    />
  );
}
