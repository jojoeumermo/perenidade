// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Botao } from "@/components/rede/ui/Botao";
import { rpc } from "@/lib/backend";
import { ligado, type Recurso } from "@/lib/recursos";
import { type FuncoesDaAlumia, VERSAO_ESPERADA_DO_BANCO } from "@/lib/rede/painel/tipos";
import { recursoValendo } from "./Geral";
import { FUNCOES_DO_FEDIVERSO, nomeDaFuncao } from "./nomes-das-funcoes";
import { Estado, Etiqueta, motivoDe, Nota, type PedidoDeAcao, quando, Quadro, Titulo, useDado, useJanela, usePainelDaAlumia } from "./pecas";

/**
 * A lista de conferência antes de ligar a trava (docs/rede/ENTRADA.md, seções 2 e 4). São cinco: o banco confere que vieram os
 * cinco marcados (public.alumia_painel_trava).
 */
export const CONFERENCIA = [
  "O SQL da onda rodou no banco: na Visão geral, a versão instalada é igual à esperada.",
  "O site novo está publicado: o Portão da Alumia, a tela do segundo fator e a fila de cadastros.",
  "Os membros foram avisados para cadastrar o aplicativo autenticador antes de hoje (quem souber a senha de uma conta sem aplicativo e chegar antes cadastra o dele).",
  "A fila de cadastros tem quem cuide: coordenação, admin ou mediação, com o segundo fator.",
  "Eu sei desfazer: este mesmo quadro desliga a trava, e tudo volta a abrir como antes.",
];

/** A janela de ligar ou desligar a trava (aqui e no quadro do beta fechado do painel único). */
export function pedidoDaTrava(ligar: boolean, depois: () => void): PedidoDeAcao {
  const frase = ligar ? "LIGAR A TRAVA" : "DESLIGAR A TRAVA";
  return {
    titulo: ligar ? "Ligar a trava da entrada" : "Desligar a trava da entrada",
    texto: ligar ? (
      <>
        <p>
          Com a trava ligada, só usa a Alumia quem tem conta <strong>aprovada</strong> e sessão com o <strong>segundo fator</strong>. Quem já é membro fica aprovado na primeira vez que a trava liga; depois disso, todo mundo passa pela fila.
        </p>
        <p>A trava e o recurso “alumia-entrada” ligam juntos, no mesmo instante. Se alguma função da rede estiver sem porta, o banco se recusa a ligar e nada muda.</p>
      </>
    ) : (
      <p>A Alumia volta a abrir como antes da triagem: as funções continuam com a porta, mas a porta deixa de barrar. Quem pediu conta e ainda não foi aprovado continua na fila, e ligar de novo não aprova ninguém que entrou no intervalo.</p>
    ),
    campos: [...(ligar ? [{ tipo: "lista" as const, rotulo: "Lista de conferência (marque uma a uma)", itens: CONFERENCIA }] : []), { tipo: "motivo" as const }, { tipo: "frase" as const, frase }],
    confirmar: ligar ? "Ligar a trava" : "Desligar a trava",
    perigo: true,
    fazer: (v) => rpc("alumia_painel_trava", { p_ligar: ligar, p_motivo: motivoDe(v), p_frase: String(v.frase).trim(), p_conferencia: ligar ? v.lista : [] }),
    sucesso: ligar ? "Trava ligada." : "Trava desligada.",
    depois,
  };
}

/**
 * Funções: ligar e desligar os recursos da Alumia sem publicar o site de novo, e a trava da entrada. A decisão fica no banco
 * (interno.recursos_vivos, a mesma tabela dos “Controles avançados” do painel interno) e vale por cima do código: desligado no
 * banco desliga sempre; sem decisão, vale o padrão do código.
 */
export function Funcoes() {
  const { geral, papel } = usePainelDaAlumia();
  const leitura = useDado<FuncoesDaAlumia>("alumia_painel_funcoes");
  const { pedir, janela } = useJanela();
  const dado = leitura.dados;

  const mudar = (nome: string, ligar: boolean | null, soPeloNome = false) => {
    const segunda = ligar === true && soPeloNome;
    const { nome: nomeNaTela, sobre } = nomeDaFuncao(nome);
    const titulo = ligar === null ? `Voltar “${nomeNaTela}” ao padrão` : ligar ? `Ligar “${nomeNaTela}”` : `Desligar “${nomeNaTela}”`;
    pedir({
      titulo,
      texto: (
        <>
          <p>{sobre}</p>
          <p>
            {ligar === null
              ? `A decisão gravada no banco é apagada e volta a valer o que o código diz (${ligado(nome as Recurso) ? "ligada" : "desligada"}).`
              : segunda
                ? "Esta função pede uma segunda pessoa para ligar: ela depende de banco, texto ou revisão. Ligar abre um pedido que outra pessoa da coordenação confirma (painel interno › Segurança › Confirmações). Confirmado, vale em até um minuto."
                : ligar
                ? "Passa a valer em até um minuto, sem publicar o site de novo."
                : "Desliga em até um minuto. É o interruptor de emergência: desligada aqui, fica desligada mesmo que o código diga o contrário."}
          </p>
          <p className="ap-miudo">Página que já saiu pronta na montagem do site só muda quando for montada de novo; o resto (telas da Alumia, rotas do servidor) segue a decisão.</p>
        </>
      ),
      campos: [{ tipo: "motivo" }],
      confirmar: ligar === null ? "Voltar ao padrão" : segunda ? "Pedir para ligar" : ligar ? "Ligar" : "Desligar",
      perigo: ligar === false,
      fazer: (v) => rpc("alumia_painel_recurso", { p_nome: nome, p_ligar: ligar, p_motivo: motivoDe(v) }),
      sucesso: segunda ? "Pedido aberto. Liga quando outra pessoa da coordenação confirmar." : "Decisão gravada. Vale em até um minuto.",
      depois: leitura.recarregar,
    });
  };

  const fediverso = (ligar: boolean) =>
    pedir({
      titulo: ligar ? "Ligar o Fediverso inteiro" : "Desligar o Fediverso inteiro",
      texto: ligar ? (
        <p>A Alumia volta a conversar com outras redes livres: perfis que consentiram, posts públicos, respostas, menções e as comunidades como grupos. Liga as duas chaves juntas, sem segunda pessoa, e vale em até um minuto.</p>
      ) : (
        <p>Para tudo de uma vez: o que entra de fora, o que sai daqui, os grupos e a fila de envio. Nada é apagado: ligar de novo volta de onde parou. Vale em até um minuto.</p>
      ),
      campos: [{ tipo: "motivo" }],
      confirmar: ligar ? "Ligar o Fediverso" : "Desligar o Fediverso",
      perigo: !ligar,
      fazer: (v) => rpc("alumia_painel_fediverso", { p_ligar: ligar, p_motivo: motivoDe(v) }),
      sucesso: ligar ? "Fediverso ligado. Vale em até um minuto." : "Fediverso desligado. Vale em até um minuto.",
      depois: leitura.recarregar,
    });

  const trava = (ligar: boolean) => pedir(pedidoDaTrava(ligar, leitura.recarregar));

  return (
    <div className="ap-tela">
      <Titulo nome="Funções e trava" sobre="Cada função da Alumia tem uma chave. A decisão daqui fica no banco, vale em até um minuto e não depende de publicar o site. Toda mudança pede o motivo e fica no registro." />
      <Estado leitura={leitura} />
      {dado ? (
        <>
          <Quadro
            titulo="Trava da entrada"
            tom="perigo"
            lado={
              <span className="ap-etiquetas">
                <Etiqueta tom={dado.trava.ligada ? "papel" : undefined}>{dado.trava.ligada ? "ligada" : "desligada"}</Etiqueta>
              </span>
            }
          >
            <p className="ap-sobre">
              {dado.trava.ligada ? "Sem conta aprovada e sem o segundo fator, ninguém vê a Alumia." : "A Alumia está aberta: a triagem e o segundo fator ainda não são exigidos."}
              {dado.trava.desde ? ` Ligada pela primeira vez em ${quando(dado.trava.desde)}.` : ""}
            </p>
            <dl className="ap-dados">
              <div className="ap-dado">
                <dt>Contas aprovadas</dt>
                <dd>{dado.trava.aprovadas}</dd>
              </div>
              <div className="ap-dado">
                <dt>Pedidos na fila</dt>
                <dd>{dado.trava.na_fila}</dd>
              </div>
              <div className="ap-dado">
                <dt>Banco da Alumia</dt>
                <dd>
                  {geral?.saude.versao ?? "?"} de {VERSAO_ESPERADA_DO_BANCO}
                </dd>
              </div>
              <div className="ap-dado">
                <dt>Você passa pela trava?</dt>
                <dd>{dado.trava.eu_passo ? "sim" : "não"}</dd>
              </div>
            </dl>
            <p className="ap-miudo">A função “Entrada com triagem” liga e desliga junto com a trava, no mesmo instante. Desligar a trava é só da coordenação, com o código do aplicativo autenticador.</p>
            {!dado.trava.ligada && !dado.trava.eu_passo ? (
              <Nota tom="perigo">Para ligar, esta sessão precisa estar com o código do aplicativo autenticador e a sua conta aprovada na Alumia. Sem isso você se trancaria do lado de fora, e o banco recusa.</Nota>
            ) : null}
            <div>
              {dado.trava.ligada ? (
                <Botao variante="contorno" disabled={papel !== "coordenacao"} title={papel !== "coordenacao" ? "Desligar a trava é só da coordenação." : undefined} onClick={() => trava(false)}>
                  Desligar a trava…
                </Botao>
              ) : (
                <Botao variante="primario" disabled={!dado.trava.eu_passo} onClick={() => trava(true)}>
                  Ligar a trava…
                </Botao>
              )}
            </div>
          </Quadro>

          {(() => {
            const chaves = dado.recursos.filter((r) => (FUNCOES_DO_FEDIVERSO as readonly string[]).includes(r.nome));
            if (chaves.length === 0) return null;
            const ligadas = chaves.filter((r) => recursoValendo(r.nome as Recurso, r.decisao));
            const aceso = ligadas.length > 0;
            return (
              <Quadro
                titulo="Fediverso"
                lado={
                  <span className="ap-etiquetas">
                    <Etiqueta tom={aceso ? "papel" : undefined}>{ligadas.length === chaves.length ? "ligado" : aceso ? "ligado em parte" : "desligado"}</Etiqueta>
                  </span>
                }
              >
                <p className="ap-sobre">Um botão só para a conversa com as outras redes livres inteira: entrada, saída, grupos e fila. Desligar não apaga nada.</p>
                <ul className="ap-lista">
                  {chaves.map((r) => {
                    const v = recursoValendo(r.nome as Recurso, r.decisao);
                    return (
                      <li key={r.nome} className="ap-linha">
                        <span className="ap-linha-texto">
                          <span className="ap-forte">
                            <span className="ap-luz" data-ligado={v} aria-hidden>
                              <span />
                              <span />
                              <span />
                            </span>
                            {nomeDaFuncao(r.nome).nome}
                          </span>
                          <span className="ap-miudo">{nomeDaFuncao(r.nome).sobre}</span>
                        </span>
                        <span className="ap-etiquetas">
                          <Etiqueta tom={v ? "papel" : undefined}>{v ? "ligada" : "desligada"}</Etiqueta>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <div className="ap-linha-acoes" style={{ justifyContent: "flex-start" }}>
                  {aceso ? (
                    <Botao variante="contorno" onClick={() => fediverso(false)}>
                      Desligar o Fediverso inteiro…
                    </Botao>
                  ) : (
                    <Botao variante="primario" disabled={papel !== "coordenacao"} title={papel !== "coordenacao" ? "Ligar o Fediverso é só da coordenação." : undefined} onClick={() => fediverso(true)}>
                      Ligar o Fediverso inteiro…
                    </Botao>
                  )}
                  {!aceso && papel !== "coordenacao" ? <span className="ap-miudo">Ligar é só da coordenação.</span> : null}
                </div>
              </Quadro>
            );
          })()}

          <Quadro titulo="Funções da Alumia">
            <div>
              {dado.recursos
                .filter((r) => r.nome !== "alumia-entrada" && !(FUNCOES_DO_FEDIVERSO as readonly string[]).includes(r.nome))
                .map((r) => {
                  const nome = r.nome as Recurso;
                  const valendo = recursoValendo(nome, r.decisao);
                  const { nome: nomeNaTela, sobre } = nomeDaFuncao(r.nome);
                  // "Voltar ao padrão" só tira uma decisão gravada; de uma função que só liga com segunda pessoa e está
                  // desligada aqui, o banco recusa (voltar ao padrão poderia ligar sem a segunda pessoa).
                  const podeVoltar = r.decisao !== null && !(r.so_pelo_nome && r.decisao === false);
                  return (
                    <div key={r.nome} className="ap-chave">
                      <div className="ap-linha-texto">
                        <span className="ap-linha-cabeca">
                          <span className="ap-forte">
                            <span className="ap-luz" data-ligado={valendo} aria-hidden>
                              <span />
                              <span />
                              <span />
                            </span>
                            {nomeNaTela}
                          </span>
                          <Etiqueta tom={valendo ? "papel" : undefined}>{valendo ? "ligada" : "desligada"}</Etiqueta>
                          {r.aguardando ? <Etiqueta tom="vermelho">esperando a segunda pessoa</Etiqueta> : null}
                          {r.decisao === null ? null : <Etiqueta tom="dourado">decisão do painel{r.em ? ` · ${quando(r.em)}` : ""}{r.por ? ` · ${r.por}` : ""}</Etiqueta>}
                        </span>
                        <span className="ap-miudo">{sobre}</span>
                      </div>
                      <div className="ap-chave-lado">
                        {/* Um botão só, conforme o estado: ligada oferece desligar; desligada oferece ligar (ou pedir). */}
                        {valendo ? (
                          <Botao variante="contorno" tamanho="p" onClick={() => mudar(r.nome, false)}>
                            Desligar
                          </Botao>
                        ) : r.aguardando ? (
                          <Botao variante="claro" tamanho="p" disabled title="Já há um pedido esperando a segunda pessoa.">
                            Pedido aberto
                          </Botao>
                        ) : (
                          <Botao variante="claro" tamanho="p" onClick={() => mudar(r.nome, true, r.so_pelo_nome)}>
                            {r.so_pelo_nome ? "Pedir para ligar" : "Ligar"}
                          </Botao>
                        )}
                        {podeVoltar ? (
                          <Botao variante="fantasma" tamanho="p" onClick={() => mudar(r.nome, null)}>
                            Voltar ao padrão
                          </Botao>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
            </div>
            {dado.recursos.length === 0 ? <Nota>O catálogo de recursos do banco ainda não tem as funções da Alumia. Falta rodar o SQL das ondas.</Nota> : null}
          </Quadro>
        </>
      ) : null}
      {janela}
    </div>
  );
}
