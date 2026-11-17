// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { PainelDaLei } from "@/components/rede/lei/PainelDaLei";
import { PainelDaTransparencia } from "@/components/rede/rotulos/PainelDaTransparencia";
import { Botao } from "@/components/rede/ui/Botao";
import { Pilula } from "@/components/rede/ui/Pilula";
import { rpc } from "@/lib/backend";
import type { DenunciaAberta, DenunciaNaFila } from "@/lib/rede/painel/tipos";
import { Estado, Etiqueta, Fita, motivoDe, Nota, quando, Quadro, Titulo, useDado, useJanela, usePainelDaAlumia } from "./pecas";

const CATEGORIAS: Record<string, string> = {
  menores: "Criança ou adolescente em risco",
  ameaca: "Ameaça",
  exposicao: "Exposição de dados pessoais",
  violencia: "Incitação à violência",
  autolesao: "Autolesão ou risco de vida",
  odio: "Discurso de ódio ou discriminação",
  assedio: "Assédio ou perseguição",
  golpe: "Golpe ou fraude",
  spam: "Propaganda ou repetição",
  outro: "Outro motivo",
};
// A prioridade vem da categoria (interno.rede2_prioridade): a legenda fica na dica do P e acima da fila.
const PRIORIDADE: Record<number, string> = {
  1: "prioridade 1, entra na frente (menores, ameaça, exposição de dados, incitação à violência, autolesão)",
  2: "prioridade 2 (ódio, assédio, golpe)",
  3: "prioridade 3 (o resto, por ordem de chegada)",
};
const ALVO: Record<DenunciaNaFila["alvo_tipo"], string> = { post: "Post", perfil: "Perfil", comunidade: "Comunidade" };
const SITUACAO: Record<DenunciaNaFila["situacao"], string> = { aberta: "aberta", em_analise: "em análise", resolvida: "resolvida", descartada: "descartada" };

function Aberta({ id, depois }: { id: string; depois: () => void }) {
  const { ir } = usePainelDaAlumia();
  const leitura = useDado<DenunciaAberta>("alumia_painel_denuncia", { p_id: id });
  const { pedir, janela } = useJanela();
  const dado = leitura.dados;
  if (!dado) return <Estado leitura={leitura} />;
  const d = dado.denuncia;
  const alvo = dado.alvo;
  const fechada = d.situacao === "resolvida" || d.situacao === "descartada";

  const decidir = (decisao: "ocultar" | "avisar" | "descartar") => {
    const textos = {
      ocultar: { titulo: "Retirar o post", texto: "O post sai do ar (fica oculto; o autor continua vendo). O autor recebe a regra, o motivo e o caminho do recurso. Quem denunciou é avisado de que a Alumia tomou providências.", confirmar: "Retirar o post" },
      avisar: { titulo: "Avisar o autor", texto: "Nada sai do ar. O autor recebe um aviso com a regra e o motivo. Quem denunciou é avisado de que a Alumia tomou providências.", confirmar: "Mandar o aviso" },
      descartar: { titulo: "Descartar a denúncia", texto: "Não há violação: nada muda no que foi denunciado. Quem denunciou é avisado de que a denúncia foi analisada.", confirmar: "Descartar" },
    }[decisao];
    pedir({
      titulo: textos.titulo,
      texto: <p>{textos.texto}</p>,
      campos: [
        { tipo: "texto", nome: "regra", rotulo: "Regra das normas que se aplica (de 3 a 80 letras)", min: 3, max: 80, valor: decisao === "descartar" ? "Sem violação" : (CATEGORIAS[d.categoria] ?? "") },
        { tipo: "motivo", aviso: decisao === "descartar" ? "Fica no registro." : "O autor lê este motivo." },
        { tipo: "texto", nome: "resposta", rotulo: "Resposta a quem denunciou (opcional, até 300 letras)", max: 300, linhas: 2, aviso: "Vai junto no aviso de andamento. Você não sabe quem denunciou, e a pessoa não fica sabendo quem decidiu." },
      ],
      confirmar: textos.confirmar,
      perigo: decisao === "ocultar",
      fazer: (v) => rpc("alumia_painel_denuncia_decidir", { p_id: d.id, p_decisao: decisao, p_regra: String(v.regra).trim(), p_motivo: motivoDe(v), p_resposta: String(v.resposta).trim() }),
      sucesso: "Decisão registrada. Quem denunciou foi avisado.",
      depois,
    });
  };

  return (
    <div className="ap-tela">
      <Quadro
        titulo={CATEGORIAS[d.categoria] ?? d.categoria}
        tom={d.prioridade === 1 && !fechada ? "perigo" : undefined}
        lado={
          <span className="ap-etiquetas">
            <Etiqueta tom={d.prioridade === 1 ? "vermelho" : undefined}>prioridade {d.prioridade}</Etiqueta>
            <Etiqueta tom={fechada ? undefined : "dourado"}>{SITUACAO[d.situacao]}</Etiqueta>
          </span>
        }
      >
        <p className="ap-miudo">
          Protocolo {d.protocolo} · {quando(d.criado_em)} · {ALVO[d.alvo_tipo]}
          {d.mesmas > 1 ? ` · ${d.mesmas} denúncias sobre o mesmo alvo` : ""}
        </p>
        <div>
          <p className="ap-miudo">O que quem denunciou escreveu</p>
          <p className="ap-quebra">{d.texto || "(sem texto)"}</p>
        </div>
        <p className="ap-miudo">Quem denunciou nunca aparece, nem aqui nem para o autor.</p>
      </Quadro>

      <Quadro titulo="O que foi denunciado">
        {!alvo ? (
          <Nota>O alvo não existe mais (foi apagado). Descarte a denúncia com esse motivo.</Nota>
        ) : (
          <>
            <span className="ap-linha-cabeca">
              {alvo.autor ? <span className="ap-forte">{alvo.autor}</span> : null}
              {alvo.nome ? <span className="ap-forte">{alvo.nome}</span> : null}
              {alvo.comunidade ? <Pilula texto={alvo.comunidade} slug={alvo.comunidade} /> : null}
              {alvo.nucleo ? <Etiqueta tom="dourado">post de núcleo: este acesso ficou registrado</Etiqueta> : null}
              {alvo.oculto ? <Etiqueta tom="dourado">já está oculto</Etiqueta> : null}
              {alvo.retido ? <Etiqueta tom="dourado">retido por precaução</Etiqueta> : null}
              {alvo.criado_em ? <span className="ap-miudo">{quando(alvo.criado_em)}</span> : null}
            </span>
            {alvo.titulo ? <p className="ap-forte">{alvo.titulo}</p> : null}
            <p className="ap-quebra">{alvo.texto ?? alvo.bio ?? alvo.descricao ?? "(sem texto)"}</p>
            {alvo.autor_nivel !== undefined ? (
              <p className="ap-miudo">
                Autor: nível de confiança {alvo.autor_nivel} · {alvo.autor_procedentes_90 ?? 0} decisões contra nos últimos 90 dias
              </p>
            ) : null}
          </>
        )}
        {dado.historico.length > 0 ? (
          <div>
            <p className="ap-miudo">O que a moderação já fez neste alvo</p>
            <ul className="ap-lista">
              {dado.historico.map((h, i) => (
                <li key={i} className="ap-linha">
                  <span className="ap-linha-texto">
                    <span className="ap-miudo">
                      {quando(h.criado_em)} · {h.acao} · regra: {h.regra}
                    </span>
                    <span className="ap-quebra">{h.motivo}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Quadro>

      {fechada ? (
        <Nota>Esta denúncia já foi decidida. A decisão está no registro; quem foi atingido pode recorrer em até 30 dias, e o recurso é revisto por outra pessoa em “Alumia” no painel interno.</Nota>
      ) : (
        <Quadro titulo="Decidir">
          <div className="ap-fita">
            {d.alvo_tipo === "post" && alvo ? (
              <Botao variante="contorno" className="ap-destrutivo" onClick={() => decidir("ocultar")}>
                Retirar o post
              </Botao>
            ) : null}
            {d.alvo_tipo !== "comunidade" && alvo ? (
              <Botao variante="contorno" onClick={() => decidir("avisar")}>
                Avisar o autor
              </Botao>
            ) : null}
            <Botao variante="contorno" onClick={() => decidir("descartar")}>
              Descartar
            </Botao>
            {alvo?.autor_id ? (
              <Botao variante="fantasma" onClick={() => ir("pessoas", alvo.autor_id ?? undefined)}>
                Abrir a ficha de quem postou
              </Botao>
            ) : null}
          </div>
          <p className="ap-miudo">Suspender ou banir a conta é na ficha da pessoa. Em comunidade denunciada, encerrar é em “Comunidades e organizações”.</p>
        </Quadro>
      )}
      {janela}
    </div>
  );
}

/**
 * Denúncias: a fila única da Alumia, por prioridade (abuso de menores, ameaça, exposição de dados, incitação à violência e
 * autolesão na frente). A mediação do Instituto cuida da mesma fila pela tela dela (/alumia/moderacao), com os poderes que já tem.
 */
export function Denuncias() {
  const [situacao, setSituacao] = useState<"abertas" | "fechadas">("abertas");
  const leitura = useDado<DenunciaNaFila[]>("alumia_painel_denuncias", { p_situacao: situacao });
  const { pedir, janela } = useJanela();
  const { papel } = usePainelDaAlumia();
  const [aberta, setAberta] = useState<string | null>(null);
  const itens = leitura.dados ?? [];

  /** Abrir post de núcleo quebra o vidro: fica registrado e a mediação do núcleo é avisada. Por isso pergunta antes. */
  const abrir = (d: DenunciaNaFila) => {
    if (!d.nucleo || situacao === "fechadas") return setAberta(d.id);
    pedir({
      titulo: "Abrir um post de núcleo",
      texto: (
        <p>
          A equipe geral não lê post de núcleo. Abrir este, por causa da denúncia {d.protocolo}, fica no registro com o seu nome, e a mediação do núcleo recebe um aviso de que a moderação geral abriu o post.
        </p>
      ),
      confirmar: "Abrir e registrar",
      fazer: async () => setAberta(d.id),
    });
  };

  return (
    <div className="ap-tela">
      <Titulo nome="Denúncias" sobre="Uma fila só para tudo o que foi denunciado na Alumia. Toda decisão leva a regra e o motivo, avisa quem foi atingido e responde a quem denunciou, sem revelar ninguém." />
      <Fita
        rotulo="Situação"
        atual={situacao}
        escolher={(s) => {
          setSituacao(s);
          setAberta(null);
        }}
        opcoes={[
          { id: "abertas", nome: "Abertas", conta: situacao === "abertas" ? itens.length : undefined },
          { id: "fechadas", nome: "Decididas" },
        ]}
      />
      <Estado leitura={leitura} eVazio={Boolean(leitura.dados) && itens.length === 0} vazio={situacao === "abertas" ? "Nenhuma denúncia aberta. A fila está em dia." : "Nenhuma denúncia decidida ainda."} />
      {itens.length > 0 ? (
        <p className="ap-miudo">P1 entra na frente (menores, ameaça, exposição de dados, violência, autolesão), depois P2 (ódio, assédio, golpe) e P3; dentro de cada uma, por ordem de chegada.</p>
      ) : null}
      {itens.length > 0 ? (
        <div className="ap-lado">
          <Quadro>
            <div className="ap-lista">
              {itens.map((d) => (
                <button key={d.id} type="button" className="ap-escolher" aria-current={d.id === aberta} onClick={() => abrir(d)}>
                  <span className="ap-linha-cabeca">
                    <span title={PRIORIDADE[d.prioridade] ?? ""}>
                      <Etiqueta tom={d.prioridade === 1 ? "vermelho" : undefined}>
                        P{d.prioridade}
                        <span className="sr-only">: {PRIORIDADE[d.prioridade] ?? ""}</span>
                      </Etiqueta>
                    </span>
                    <span className="ap-forte">{CATEGORIAS[d.categoria] ?? d.categoria}</span>
                  </span>
                  <span className="ap-miudo">
                    {ALVO[d.alvo_tipo]}
                    {d.comunidade ? ` · ${d.comunidade}` : ""} · {quando(d.criado_em)} · {SITUACAO[d.situacao]}
                    {d.mesmas > 1 ? ` · ${d.mesmas} sobre o mesmo alvo` : ""}
                  </span>
                  <span className="ap-quebra">{d.nucleo ? "Post de núcleo: o texto só aparece ao abrir, com registro." : (d.titulo ?? d.trecho ?? d.texto ?? "").slice(0, 140)}</span>
                </button>
              ))}
            </div>
          </Quadro>
          {aberta ? (
            <Aberta
              key={aberta}
              id={aberta}
              depois={() => {
                setAberta(null);
                leitura.recarregar();
              }}
            />
          ) : (
            <Nota>Escolha uma denúncia para ler o que foi denunciado e decidir. Ao abrir, ela fica “em análise” no seu nome.</Nota>
          )}
        </div>
      ) : null}
      {/* A lei (onda 8): prazos das denúncias, contas retidas por precaução e pedidos de revisão de conta. */}
      <Quadro titulo="Prazos da lei">
        <PainelDaLei lang="pt" />
      </Quadro>
      {/* A transparência (onda 9): os pedidos de órgão público só por tipo e o aviso de ordem sigilosa. Só a coordenação (o banco confere). */}
      {papel === "coordenacao" && (
        <Quadro titulo="Relatório de transparência">
          <PainelDaTransparencia lang="pt" />
        </Quadro>
      )}
      {janela}
    </div>
  );
}
