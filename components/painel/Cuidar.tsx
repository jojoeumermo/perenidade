// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Ban, Check, EyeOff, Pencil, Plus, RotateCcw, Search, Send, Trash2, X } from "lucide-react";
import { useState } from "react";
import { can, getClient, type Me, recoverPending } from "@/lib/backend";
import { agirOtimista, Aviso, data, useAcao, useLista } from "./comum";
import { MoldeFila } from "./moldes";
import { RespostasProntas } from "./RespostasProntas";
import { Abas, Area, Botao, CabecalhoDeSecao, Campo, Cartao, confirmar, Esqueleto, Faixa, ItemDeLista, Lista, Marca, perguntar, Selecao, Selo, Vazio } from "./ui";

interface Denuncia {
  id: string;
  alvo: string;
  motivo: string;
  detalhes: string;
  status: string;
  nota: string;
  criado_em: string;
}

interface Anotacao {
  id: string;
  caminho: string;
  trecho: string;
  corpo: string;
  autor: string;
  criado_em: string;
}

/** O erro de leitura de uma lista, com o "Tentar de novo" (o mesmo desenho em todas as abas). */
function ErroDeLeitura({ erro, recarregar }: { erro: string; recarregar: () => void }) {
  if (!erro) return null;
  return (
    <Faixa tom="erro" acao={<Botao pequeno onClick={recarregar}>Tentar de novo</Botao>}>
      {erro}
    </Faixa>
  );
}

type AbaDaComunidade = "retidas" | "banimentos" | "denuncias" | "anotacoes" | "filtro";

/** Cuidado da comunidade: a fila de revisão e as anotações (mediação, curadoria e educadores), denúncias e filtro (curadoria). */
export function Comunidade({ me }: { me: Me }) {
  const curador = can(me, "coordenacao", "curadoria");
  const media = can(me, "coordenacao", "curadoria", "mediacao");
  const [aba, setAba] = useState<AbaDaComunidade>("retidas");
  /** Cada banimento feito na fila refaz a lista de banimentos, que mora na aba ao lado. */
  const [banidos, setBanidos] = useState(0);
  return (
    <div className="pn-tela">
      <Abas<AbaDaComunidade>
        rotulo="Comunidade"
        valor={aba}
        aoMudar={setAba}
        opcoes={(
          [
            { id: "retidas", nome: "Fila de revisão" },
            { id: "banimentos", nome: "Banimentos" },
            { id: "denuncias", nome: "Denúncias" },
            { id: "anotacoes", nome: "Anotações" },
            { id: "filtro", nome: "Filtro de palavras" },
          ] as { id: AbaDaComunidade; nome: string }[]
        ).filter((opcao) => curador || opcao.id === "retidas" || opcao.id === "anotacoes" || (media && opcao.id === "banimentos"))}
        // As abas ficam todas montadas (escondidas as outras): o que está sendo escrito numa não se perde ao olhar outra.
        painel={() => (
          <>
            <div hidden={aba !== "retidas"}>
              <Retidos media={media} aoBanir={() => setBanidos((n) => n + 1)} />
            </div>
            {media && (
              <div hidden={aba !== "banimentos"}>
                <Banimentos key={banidos} desfaz={can(me, "coordenacao")} />
              </div>
            )}
            {curador && (
              <div hidden={aba !== "denuncias"}>
                <Denuncias />
              </div>
            )}
            <div hidden={aba !== "anotacoes"}>
              <Anotacoes />
            </div>
            {curador && (
              <div hidden={aba !== "filtro"}>
                <Filtro />
              </div>
            )}
          </>
        )}
      />
      <p className="pn-ajuda">Para ocultar ou trancar uma conversa que já está no ar, abra o tópico na página Comunidade: os botões aparecem para quem cuida.</p>
    </div>
  );
}

interface Retido {
  tipo: "topico" | "resposta" | "comentario" | "aula_chat";
  id: string;
  titulo: string;
  corpo: string;
  autor: string;
  criado_em: string;
  /** Esbarrou na lista de palavras. */
  filtro?: boolean;
  /** Por que a avaliação automática não publicou direto. */
  motivo?: string;
  /** Só vem para quem pode banir. */
  autor_id?: string | null;
}

interface Banimento {
  id: string;
  nome: string;
  motivo: string;
  origem: boolean;
  ativo: boolean;
  por: string;
  criado_em: string;
}

/** Quem a mediação baniu. Desfazer é com a coordenação: é a instância de recurso. */
function Banimentos({ desfaz }: { desfaz: boolean }) {
  const lista = useLista<Banimento[]>("banimentos_listar");
  const acao = useAcao(lista.recarregar);
  return (
    <section className="pn-secao">
      <CabecalhoDeSecao
        titulo="Banimentos"
        simbolo={Ban}
        sobre={
          <>
            Banir é o último recurso, para quem insiste em ataque, ódio ou propaganda depois de ter mensagens recusadas. A conta banida continua lendo o site, mas não envia mais nada. O banimento
            da origem de rede é para caso extremo (a pessoa volta com contas novas): ele barra todo envio vindo da mesma rede, e uma rede pode ser de uma escola, de um sindicato ou de uma lan
            house inteira. Todo banimento fica no registro e a coordenação é avisada na hora{desfaz ? "." : "; só ela desfaz."}
          </>
        }
      />
      <ErroDeLeitura erro={lista.erro} recarregar={lista.recarregar} />
      <Aviso texto={acao.aviso} />
      {!lista.dados && !lista.erro && <Esqueleto forma="linhas" linhas={3} />}
      {lista.dados?.length === 0 && <Vazio titulo="Ninguém foi banido." />}
      {Boolean(lista.dados?.length) && (
        <Lista rotulo="Banimentos">
          {lista.dados?.map((item) => (
            <ItemDeLista
              key={item.id}
              className={item.ativo ? "" : "opacity-60"}
              titulo={item.nome || "conta apagada"}
              meta={
                <>
                  {item.motivo} · por {item.por || "—"} · {data(item.criado_em)}
                </>
              }
              selo={<Selo tom={item.ativo ? "erro" : "neutro"}>{item.ativo ? (item.origem ? "conta e origem de rede barradas" : "conta banida") : "banimento desfeito"}</Selo>}
              acoes={
                desfaz &&
                item.ativo && (
                  <Botao variante="discreto" pequeno simbolo={RotateCcw} disabled={acao.ocupado} onClick={() => acao.agir("banimento_encerrar", { p_id: item.id }, "Banimento desfeito: a conta voltou a poder enviar.")}>
                    Desfazer o banimento
                  </Botao>
                )
              }
            />
          ))}
        </Lista>
      )}
    </section>
  );
}

const motivos: Record<string, string> = {
  filtro: "tem palavra do filtro",
  endereco: "traz endereço de site",
  contato: "traz telefone ou e-mail",
  gritaria: "escrita quase toda em maiúsculas",
  repeticao: "tem repetição de letras ou sinais",
  historico: "quem escreveu teve mensagens ocultadas há pouco",
  avaliacao_falhou: "a avaliação automática não respondeu",
  disfarce: "parece expressão grave disfarçada",
  modo_seguranca: "modo de segurança ligado: espera aprovação manual",
  aguardando_avaliacao: "a segunda avaliação ainda não rodou",
  em_avaliacao: "a segunda avaliação começou e não terminou",
  avaliacao_externa: "a segunda avaliação ficou em dúvida",
  avaliacao_externa_falhou: "a segunda avaliação não respondeu",
  cuidado: "pode falar de autolesão: leia com cuidado e acolha",
};

const TIPO_DO_RETIDO: Record<string, string> = { topico: "Conversa nova", resposta: "Resposta", comentario: "Comentário em aula em vídeo", aula_chat: "Bate-papo de aula ao vivo" };

/** O que a avaliação automática deixou em dúvida e ainda espera leitura. Ninguém de fora vê nada daqui até alguém aprovar. */
function Retidos({ media, aoBanir }: { media: boolean; aoBanir: () => void }) {
  const lista = useLista<Retido[]>("comunidade_retidos");
  const acao = useAcao(lista.recarregar);
  const [edicao, setEdicao] = useState<{ id: string; titulo: string; corpo: string } | null>(null);
  const [banir, setBanir] = useState<{ id: string; motivo: string; origem: boolean } | null>(null);

  // Aprovar e recusar mudam só a situação da mensagem: a linha sai da fila na hora e volta se o banco recusar.
  const cuidar = (item: Retido, acaoDoCuidado: "mostrar" | "ocultar") =>
    agirOtimista<Retido[]>({
      lista: { funcao: "comunidade_retidos" },
      remendo: (dados) => dados.filter((x) => x.id !== item.id),
      funcao: "comunidade_cuidar",
      argumentos: { p_tipo: item.tipo, p_alvo: item.id, p_acao: acaoDoCuidado },
      sucesso: acaoDoCuidado === "mostrar" ? "Mensagem aprovada: já aparece na Comunidade." : "Mensagem recusada: não vai aparecer.",
    });

  async function confirmarBanimento(item: Retido) {
    if (!banir) return;
    // Banir pede a confirmação na janela do painel e espera o banco (nada de otimista aqui).
    if (!(await confirmar({ titulo: "Banir quem escreveu", texto: banir.motivo, confirmar: "Confirmar o banimento", perigo: true }))) return;
    if (await acao.agir("mediacao_banir", { p_usuario: item.autor_id, p_motivo: banir.motivo, p_origem: banir.origem }, "Conta banida. A coordenação foi avisada.")) {
      setBanir(null);
      aoBanir();
    }
  }

  const reavaliar = lista.dados?.some((item) => ["aguardando_avaliacao", "em_avaliacao", "avaliacao_externa_falhou"].includes(item.motivo ?? ""));

  return (
    <section className="pn-secao">
      <CabecalhoDeSecao
        titulo="Fila de revisão"
        sobre="As mensagens da Comunidade vão ao ar sozinhas quando respeitam as regras, e as que as violam claramente são barradas. Aqui chegam só os casos de dúvida. Aprove o que respeita as regras da página; edite para tirar um dado pessoal ou um palavrão sem perder a pergunta; recuse propaganda, ataque e discurso de ódio. O filtro de palavras erra para os dois lados: uma citação em aula de história pode vir marcada. Leia o contexto antes de decidir."
      />
      {reavaliar && (
        <div>
          <Botao
            variante="discreto"
            simbolo={RotateCcw}
            onClick={async () => {
              const feito = await recoverPending();
              acao.setAviso(feito ? "Pedido feito: o que podia ser reavaliado foi. O que continuar aqui espera a sua leitura." : "O serviço não respondeu. As mensagens continuam aqui, esperando leitura.");
              lista.recarregar();
            }}
          >
            Tentar de novo a segunda avaliação das que ficaram esperando
          </Botao>
        </div>
      )}
      <ErroDeLeitura erro={lista.erro} recarregar={lista.recarregar} />
      <Aviso texto={acao.aviso} />
      <MoldeFila<Retido>
        id="comunidade"
        rotulo="Fila de revisão"
        itens={lista.dados ?? []}
        carregando={!lista.dados && !lista.erro}
        chave={(item) => item.id}
        vazio={<Vazio titulo="Nenhuma mensagem esperando revisão. O que respeita as regras vai ao ar sozinho; aqui só chega o que ficou em dúvida." />}
        linha={(item) => (
          <>
            <span className="pn-rotulo-mono">
              {TIPO_DO_RETIDO[item.tipo] ?? item.tipo} · {item.autor || "—"} · {data(item.criado_em)}
            </span>
            <strong>{item.tipo === "resposta" ? `Em: ${item.titulo}` : item.titulo}</strong>
            {(item.motivo || item.filtro) && (
              <span>
                <Selo tom={item.motivo === "cuidado" ? "aviso" : "bordo"}>{motivos[item.motivo ?? ""] ?? "tem palavra do filtro"}</Selo>
              </span>
            )}
          </>
        )}
        comandos={(item) => [
          { id: "liberar", nome: "Liberar", sobre: "Aprovar", simbolo: Check, fazer: () => void cuidar(item, "mostrar") },
          { id: "ocultar", nome: "Ocultar", sobre: "Recusar", simbolo: EyeOff, fazer: () => void cuidar(item, "ocultar") },
          { id: "editar", nome: "Editar", simbolo: Pencil, fazer: () => setEdicao({ id: item.id, titulo: item.titulo, corpo: item.corpo }) },
          ...(media && item.autor_id ? [{ id: "banir", nome: "Banir quem escreveu", simbolo: Ban, fazer: () => setBanir({ id: item.id, motivo: "", origem: false }) }] : []),
        ]}
        detalhe={(item) => (
          <article className="pn-secao">
            <p className="pn-rotulo-mono">
              {TIPO_DO_RETIDO[item.tipo] ?? item.tipo} · {item.autor || "—"} · {data(item.criado_em)}
            </p>
            {(item.motivo || item.filtro) && (
              <Faixa tom={item.motivo === "cuidado" ? "aviso" : "bordo"} semSimbolo={item.motivo !== "cuidado"}>
                {motivos[item.motivo ?? ""] ?? "tem palavra do filtro"}
              </Faixa>
            )}
            {edicao?.id === item.id ? (
              <div className="pn-secao">
                {item.tipo === "topico" && <Campo rotulo="Título" value={edicao.titulo} onChange={(e) => setEdicao({ ...edicao, titulo: e.target.value })} maxLength={140} />}
                <Area rotulo="Mensagem" value={edicao.corpo} onChange={(e) => setEdicao({ ...edicao, corpo: e.target.value })} rows={5} maxLength={8000} />
                <div className="flex flex-wrap gap-2">
                  <Botao
                    variante="principal"
                    disabled={acao.ocupado}
                    carregando={acao.ocupado}
                    onClick={async () => {
                      if (await acao.agir("comunidade_editar", { p_tipo: item.tipo, p_alvo: item.id, p_titulo: edicao.titulo, p_corpo: edicao.corpo }, "Texto guardado. A mensagem continua esperando a decisão.")) setEdicao(null);
                    }}
                  >
                    Guardar
                  </Botao>
                  <Botao variante="discreto" onClick={() => setEdicao(null)}>
                    Cancelar
                  </Botao>
                </div>
              </div>
            ) : (
              <>
                <h3 className="pn-cartao-titulo">{item.tipo === "resposta" ? `Em: ${item.titulo}` : item.titulo}</h3>
                <p className="whitespace-pre-line font-serif text-lg" data-original>
                  {item.corpo}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Botao variante="principal" simbolo={Check} disabled={acao.ocupado} onClick={() => void cuidar(item, "mostrar")}>
                    Aprovar
                  </Botao>
                  <Botao simbolo={Pencil} disabled={acao.ocupado} onClick={() => setEdicao({ id: item.id, titulo: item.titulo, corpo: item.corpo })}>
                    Editar
                  </Botao>
                  <Botao simbolo={EyeOff} disabled={acao.ocupado} onClick={() => void cuidar(item, "ocultar")}>
                    Recusar
                  </Botao>
                  {media && item.autor_id && banir?.id !== item.id && (
                    <Botao variante="discreto" perigo simbolo={Ban} onClick={() => setBanir({ id: item.id, motivo: "", origem: false })}>
                      Banir quem escreveu
                    </Botao>
                  )}
                </div>
                {banir?.id === item.id && item.autor_id && (
                  <Cartao as="div" variante="alerta">
                    <div className="pn-secao">
                      <Campo rotulo="Motivo do banimento (fica no registro e vai para a coordenação)" value={banir.motivo} onChange={(e) => setBanir({ ...banir, motivo: e.target.value })} maxLength={300} />
                      <RespostasProntas tipo="banimento" usar={(texto) => setBanir({ ...banir, motivo: texto })} />
                      <Marca
                        rotulo="Caso extremo: barrar também a origem de rede desta pessoa (vale para qualquer conta e para envios sem conta vindos da mesma rede)"
                        checked={banir.origem}
                        onChange={(e) => setBanir({ ...banir, origem: e.target.checked })}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Botao variante="principal" perigo simbolo={Ban} disabled={acao.ocupado || banir.motivo.trim().length < 5} onClick={() => void confirmarBanimento(item)}>
                          Confirmar o banimento
                        </Botao>
                        <Botao variante="discreto" onClick={() => setBanir(null)}>
                          Cancelar
                        </Botao>
                      </div>
                    </div>
                  </Cartao>
                )}
              </>
            )}
          </article>
        )}
      />
    </section>
  );
}

/** A lista de palavras e expressões que seguram uma mensagem para leitura. Só a curadoria vê e edita. */
function Filtro() {
  const lista = useLista<string[]>("filtro_listar");
  const acao = useAcao(lista.recarregar);
  const [termo, setTermo] = useState("");
  const [aberto, setAberto] = useState(false);
  return (
    <section className="pn-secao">
      <CabecalhoDeSecao
        titulo="Filtro de palavras"
        sobre="Mensagem da Comunidade com uma destas palavras ou expressões não é apagada: fica retida até alguém da equipe ler (as ameaças e a apologia ao ódio da lista inicial são barradas na hora). Evite palavras com sentido comum (nome de animal, de lugar): elas seguram conversa inocente."
      />
      <Cartao as="div">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (acao.ocupado || termo.trim().length < 3) return;
            if (await acao.agir("filtro_salvar", { p_termo: termo, p_incluir: true }, "Acrescentado ao filtro.")) setTermo("");
          }}
        >
          <div className="min-w-60 flex-1">
            <Campo rotulo="Acrescentar palavra ou expressão" value={termo} onChange={(e) => setTermo(e.target.value)} maxLength={40} />
          </div>
          <Botao type="submit" simbolo={Plus} disabled={acao.ocupado || termo.trim().length < 3}>
            Acrescentar
          </Botao>
          <Botao variante="discreto" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
            {aberto ? "Esconder a lista" : `Mostrar a lista (${lista.dados?.length ?? 0})`}
          </Botao>
        </form>
      </Cartao>
      <ErroDeLeitura erro={lista.erro} recarregar={lista.recarregar} />
      <Aviso texto={acao.aviso} />
      {aberto && (
        <ul className="flex flex-wrap gap-2" aria-label="Filtro de palavras">
          {lista.dados?.map((item) => (
            <li key={item} className="pn-etiqueta">
              {item}
              <Botao
                variante="discreto"
                pequeno
                icone
                simbolo={X}
                aria-label={`Tirar ${item} do filtro`}
                onClick={() => acao.agir("filtro_salvar", { p_termo: item, p_incluir: false }, "Retirado do filtro.")}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Denuncias() {
  const lista = useLista<Denuncia[]>("denuncias_listar");
  const acao = useAcao(lista.recarregar);
  const [notas, setNotas] = useState<Record<string, string>>({});
  return (
    <section className="pn-secao">
      <CabecalhoDeSecao titulo="Denúncias" />
      <ErroDeLeitura erro={lista.erro} recarregar={lista.recarregar} />
      <Aviso texto={acao.aviso} />
      {!lista.dados && !lista.erro && <Esqueleto forma="cartoes" linhas={2} />}
      {lista.dados?.length === 0 && <Vazio titulo="Nenhuma denúncia." />}
      {lista.dados?.map((item) => (
        <Cartao key={item.id} as="article">
          <div className="pn-secao">
            <p className="flex flex-wrap items-center gap-2">
              <span className="pn-rotulo-mono">
                {item.motivo} · {data(item.criado_em)}
              </span>
              <Selo tom={item.status === "aberta" ? "bordo" : "ok"} ponto>
                {item.status}
              </Selo>
            </p>
            <p className="break-all font-mono text-xs">{item.alvo}</p>
            <p>{item.detalhes}</p>
            {item.status === "aberta" ? (
              <div className="pn-secao">
                <Campo rotulo="O que foi feito" value={notas[item.id] ?? ""} onChange={(e) => setNotas({ ...notas, [item.id]: e.target.value })} placeholder="O que foi feito" maxLength={2000} />
                <RespostasProntas tipo="denuncia" usar={(texto) => setNotas({ ...notas, [item.id]: texto })} />
                <div>
                  <Botao simbolo={Check} disabled={acao.ocupado} onClick={() => acao.agir("denuncia_resolver", { p_id: item.id, p_nota: notas[item.id] ?? "" }, "Denúncia resolvida.")}>
                    Marcar como resolvida
                  </Botao>
                </div>
              </div>
            ) : (
              item.nota && <p className="pn-ajuda">Encaminhamento: {item.nota}</p>
            )}
          </div>
        </Cartao>
      ))}
      <p className="pn-ajuda">
        Em denúncia de direitos autorais, tire o item do ar primeiro (campo <code>ativo: false</code> no arquivo) e analise depois.
      </p>
    </section>
  );
}

function Anotacoes() {
  const lista = useLista<Anotacao[]>("anotacoes_fila");
  const acao = useAcao(lista.recarregar);
  // Descartar só muda a situação da anotação: a linha sai na hora e volta se o banco recusar. Publicar espera o banco.
  const descartar = (item: Anotacao) =>
    agirOtimista<Anotacao[]>({
      lista: { funcao: "anotacoes_fila" },
      remendo: (dados) => dados.filter((x) => x.id !== item.id),
      funcao: "anotacao_decidir",
      argumentos: { p_id: item.id, p_status: "oculta" },
      sucesso: "Anotação descartada.",
    });
  return (
    <section className="pn-secao">
      <CabecalhoDeSecao titulo="Anotações aguardando" />
      <ErroDeLeitura erro={lista.erro} recarregar={lista.recarregar} />
      <Aviso texto={acao.aviso} />
      {!lista.dados && !lista.erro && <Esqueleto forma="cartoes" linhas={2} />}
      {lista.dados?.length === 0 && <Vazio titulo="Nenhuma anotação aguardando." />}
      {lista.dados?.map((item) => (
        <Cartao
          key={item.id}
          as="article"
          rodape={
            <div className="flex flex-wrap gap-2">
              <Botao variante="principal" simbolo={Send} disabled={acao.ocupado} onClick={() => acao.agir("anotacao_decidir", { p_id: item.id, p_status: "aprovada" }, "Anotação publicada.")}>
                Publicar
              </Botao>
              <Botao simbolo={Trash2} disabled={acao.ocupado} onClick={() => void descartar(item)}>
                Descartar
              </Botao>
            </div>
          }
        >
          <p className="pn-rotulo-mono">
            {item.autor} · {data(item.criado_em)}
          </p>
          <p className="break-all font-mono text-xs">{item.caminho}</p>
          {item.trecho && <p className="mt-2 font-serif italic text-ink-soft">“{item.trecho}”</p>}
          <p className="mt-1 font-serif text-lg">{item.corpo}</p>
        </Cartao>
      ))}
    </section>
  );
}

interface Apoiador {
  id: string;
  nome: string;
  mensagem: string;
}

/** Mural de apoiadores: a coordenação acrescenta o nome de quem apoiou a campanha. */
export function Apoiadores() {
  const lista = useLista<Apoiador[]>("apoiadores_listar");
  const acao = useAcao(lista.recarregar);
  const [nome, setNome] = useState("");
  const [mensagem, setMensagem] = useState("");
  return (
    <div className="pn-secao">
      <p className="pn-ajuda">Só inclua o nome de quem autorizou aparecer no mural.</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
        <Campo rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} />
        <Campo rotulo="Mensagem (opcional)" value={mensagem} onChange={(e) => setMensagem(e.target.value)} maxLength={200} />
        <Botao
          variante="principal"
          simbolo={Plus}
          disabled={acao.ocupado || nome.trim().length < 2}
          onClick={async () => {
            const ok = await acao.agir("apoiador_salvar", { p_id: null, p_nome: nome, p_mensagem: mensagem }, "Nome adicionado ao mural.");
            if (ok) {
              setNome("");
              setMensagem("");
            }
          }}
        >
          Adicionar
        </Botao>
      </div>
      <ErroDeLeitura erro={lista.erro} recarregar={lista.recarregar} />
      <Aviso texto={acao.aviso} />
      {Boolean(lista.dados?.length) && (
        <Lista rotulo="Mural de apoiadores">
          {lista.dados?.map((item) => (
            <ItemDeLista
              key={item.id}
              titulo={item.nome}
              meta={item.mensagem ? `“${item.mensagem}”` : undefined}
              acoes={
                <Botao variante="discreto" pequeno onClick={() => acao.agir("apoiador_remover", { p_id: item.id }, "Nome retirado.")}>
                  Retirar
                </Botao>
              }
            />
          ))}
        </Lista>
      )}
    </div>
  );
}

/** Quem cuida da rádio indica uma emissora nova para a lista "Rádios do povo": a indicação entra na fila de revisão, como toda contribuição. */
interface Emissora {
  id: string;
  nome: string;
  lugar: string;
  site: string;
  transmissao: string;
  etiquetas: string[];
  formato: string;
}

export function SugerirEmissora() {
  const acao = useAcao();
  const [nova, setNova] = useState({ nome: "", lugar: "", site: "", porque: "" });
  const [procura, setProcura] = useState({ texto: "", por: "name" });
  const [achadas, setAchadas] = useState<Emissora[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  async function procurar() {
    if (procura.texto.trim().length < 2) return;
    setBuscando(true);
    try {
      // A busca é só da equipe: vai com o token da sessão, que o servidor confere no banco.
      const { data } = await (await getClient()).auth.getSession();
      const token = data.session?.access_token;
      const resposta = await fetch(`/api/radios?por=${procura.por}&q=${encodeURIComponent(procura.texto.trim())}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (resposta.status === 401) {
        acao.setAviso("A busca de emissoras é só para quem tem função no painel. Saia e entre de novo se acabou de receber a função.");
        return;
      }
      const dados = await resposta.json();
      setAchadas(dados.emissoras ?? []);
      if (dados.erro) acao.setAviso("O diretório de rádios não respondeu agora. Tente de novo em instantes.");
    } catch {
      acao.setAviso("O diretório de rádios não respondeu agora. Tente de novo em instantes.");
    } finally {
      setBuscando(false);
    }
  }
  const pronta = nova.nome.trim().length >= 3 && nova.lugar.trim().length >= 2 && /^https:\/\/\S+$/.test(nova.site.trim()) && nova.porque.trim().length >= 20;
  return (
    <Cartao
      titulo="Sugerir uma emissora"
      sobre="A lista “Rádios do povo” da página da rádio reúne emissoras populares, comunitárias e de trabalhadores. Ela faz parte do acervo do site, então uma emissora nova entra como toda contribuição: você indica aqui, a curadoria confere e ela vai ao ar na publicação seguinte."
    >
      <div className="pn-secao">
        <Cartao as="div" variante="plano">
          <div className="pn-secao">
            <p className="pn-rotulo-mono">Procurar no diretório aberto (Radio Browser), só emissoras do Brasil</p>
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void procurar();
              }}
            >
              <div className="min-w-48 flex-1">
                <Campo rotulo="Nome ou etiqueta" simbolo={Search} value={procura.texto} onChange={(e) => setProcura({ ...procura, texto: e.target.value })} maxLength={60} placeholder="Ex.: comunitária, educativa, sindical" />
              </div>
              <Selecao rotulo="Procurar por" value={procura.por} onChange={(e) => setProcura({ ...procura, por: e.target.value })}>
                <option value="name">nome</option>
                <option value="tag">etiqueta</option>
              </Selecao>
              <Botao type="submit" carregando={buscando} disabled={buscando || procura.texto.trim().length < 2}>
                {buscando ? "Procurando…" : "Procurar"}
              </Botao>
            </form>
            <p className="pn-ajuda">O diretório não diz a linha de ninguém: ouça a emissora antes de indicar. Só aparecem as que transmitem por endereço seguro (https).</p>
            {achadas && achadas.length === 0 && <Vazio titulo="Nenhuma emissora encontrada." />}
            {achadas && achadas.length > 0 && (
              <div className="max-h-72 overflow-y-auto">
                <Lista rotulo="Emissoras encontradas">
                  {achadas.map((emissora) => (
                    <ItemDeLista
                      key={emissora.id}
                      titulo={emissora.nome}
                      meta={[emissora.lugar, emissora.formato, emissora.etiquetas.join(", ")].filter(Boolean).join(" · ")}
                      acoes={
                        <Botao variante="discreto" pequeno onClick={() => setNova({ ...nova, nome: emissora.nome, lugar: [emissora.lugar, "Brasil"].filter(Boolean).join(", "), site: emissora.site || emissora.transmissao })}>
                          Usar na indicação
                        </Botao>
                      }
                    />
                  ))}
                </Lista>
              </div>
            )}
          </div>
        </Cartao>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Nome da emissora" value={nova.nome} onChange={(e) => setNova({ ...nova, nome: e.target.value })} maxLength={100} />
          <Campo rotulo="Cidade e país" value={nova.lugar} onChange={(e) => setNova({ ...nova, lugar: e.target.value })} maxLength={100} />
          <div className="sm:col-span-2">
            <Campo rotulo="Site da emissora (https)" value={nova.site} onChange={(e) => setNova({ ...nova, site: e.target.value })} maxLength={300} placeholder="https://…" className="font-mono" />
          </div>
          <div className="sm:col-span-2">
            <Area rotulo="Quem mantém a emissora e por que ela cabe na lista" value={nova.porque} onChange={(e) => setNova({ ...nova, porque: e.target.value })} rows={3} maxLength={1500} />
          </div>
        </div>
        <div>
          <Botao
            variante="principal"
            simbolo={Send}
            carregando={acao.ocupado}
            disabled={acao.ocupado || !pronta}
            onClick={async () => {
              const corpo = `Indicação de emissora para a lista "Rádios do povo".\n\nEmissora: ${nova.nome.trim()}\nLugar: ${nova.lugar.trim()}\nSite: ${nova.site.trim()}\n\n${nova.porque.trim()}`;
              if (await acao.agir("contribuir", { p: { tipo: "sugestao", titulo: `Emissora: ${nova.nome.trim()}`.slice(0, 160), corpo, alvo: "/radio" } }, "Indicação enviada para a fila de revisão.")) setNova({ nome: "", lugar: "", site: "", porque: "" });
            }}
          >
            Enviar a indicação
          </Botao>
        </div>
        <Aviso texto={acao.aviso} />
      </div>
    </Cartao>
  );
}

interface Anuncio {
  id: string;
  categoria: string;
  oficio: string;
  titulo: string;
  descricao: string;
  cidade: string;
  uf: string;
  contato: string;
  link: string;
  nome: string;
  criado_em: string;
  validade?: string | null;
}

const tiposDeAnuncio: Record<string, string> = { cooperativa: "Cooperativa ou associação", servico: "Serviço", produto: "Produto", arte: "Arte e cultura", iniciativa: "Iniciativa comunitária" };

// A gestão da Rádio Lúcia própria saiu do painel em 18/10/2026: o projeto foi adiado. As tabelas radio_canais e radio_faixas e as
// funções radio_* continuam no banco, intactas, para a retomada (veja docs/RELATORIO-RODADA-3.md).

/** O Mural dos Trabalhadores: os anúncios esperando decisão e os que estão no ar, no molde Fila (com "Aprovar anúncio" e "Recusar com motivo" na paleta). */
export function MuralFila({ me }: { me: Me }) {
  const [ver, setVer] = useState<"pendente" | "aprovado">("pendente");
  const lista = useLista<Anuncio[]>("mural_fila", { p_status: ver });
  const acao = useAcao(lista.recarregar);
  const retira = can(me, "coordenacao");
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [edicao, setEdicao] = useState<{ id: string; titulo: string; oficio: string; descricao: string; contato: string; link: string } | null>(null);

  // Aprovar, recusar e retirar mudam só a situação do anúncio: ele sai desta lista na hora e volta se o banco recusar.
  const decidir = (item: Anuncio, aprovar: boolean, nota: string, sucesso: string) =>
    agirOtimista<Anuncio[]>({
      lista: { funcao: "mural_fila", argumentos: { p_status: ver } },
      remendo: (dados) => dados.filter((x) => x.id !== item.id),
      funcao: "mural_decidir",
      argumentos: { p_id: item.id, p_aprovar: aprovar, p_nota: nota },
      sucesso,
    });
  /** Recusar ou retirar pela paleta: usa a nota já escrita; sem ela, pergunta numa janela (as mesmas 5 letras de antes). */
  const comMotivo = async (item: Anuncio, rotulo: string, sucesso: string) => {
    let nota = (notas[item.id] ?? "").trim();
    if (nota.length < 5) nota = ((await perguntar({ titulo: "Recusar com motivo", rotulo, valorInicial: nota, multilinha: true, obrigatorio: true })) ?? "").trim();
    if (nota.length >= 5) await decidir(item, false, nota, sucesso);
  };

  return (
    <div className="pn-tela">
      <p className="pn-sobre">
        O mural é para quem vive do próprio trabalho: cooperativas, associações, autônomos, artesãos, artistas e iniciativas comunitárias. Não aprove empresas à procura de mão de obra, revenda por
        catálogo, pirâmides, empréstimos, apostas, promessas de ganho fácil nem propaganda eleitoral. Na dúvida, recuse com uma nota explicando o motivo: a pessoa pode corrigir e reenviar.
      </p>
      <Abas<"pendente" | "aprovado">
        rotulo="Mural dos Trabalhadores"
        opcoes={[
          { id: "pendente", nome: "Esperando decisão" },
          { id: "aprovado", nome: "No ar" },
        ]}
        valor={ver}
        aoMudar={setVer}
        painel={() => (
          <div className="pn-tela">
            <ErroDeLeitura erro={lista.erro} recarregar={lista.recarregar} />
            <Aviso texto={acao.aviso} />
            <MoldeFila<Anuncio>
              id="mural"
              rotulo={ver === "pendente" ? "Esperando decisão" : "No ar"}
              itens={lista.dados ?? []}
              carregando={!lista.dados && !lista.erro}
              chave={(item) => item.id}
              vazio={<Vazio titulo={ver === "pendente" ? "Nenhum anúncio aguardando." : "Nenhum anúncio no ar."} />}
              linha={(item) => (
                <>
                  <span className="pn-rotulo-mono">
                    {tiposDeAnuncio[item.categoria] ?? item.categoria} · {item.cidade}
                    {item.uf && `, ${item.uf}`} · {data(item.criado_em)}
                  </span>
                  <strong>{item.titulo}</strong>
                </>
              )}
              comandos={(item) =>
                ver === "pendente"
                  ? [
                      { id: "aprovar", nome: "Aprovar anúncio", simbolo: Check, fazer: () => void decidir(item, true, notas[item.id] ?? "", "Anúncio no ar por 180 dias.") },
                      { id: "recusar", nome: "Recusar com motivo", simbolo: X, fazer: () => comMotivo(item, "Nota para quem enviou (obrigatória ao recusar)", "Anúncio recusado.") },
                      { id: "editar", nome: "Editar o texto", simbolo: Pencil, fazer: () => setEdicao({ id: item.id, titulo: item.titulo, oficio: item.oficio ?? "", descricao: item.descricao, contato: item.contato, link: item.link }) },
                    ]
                  : retira
                    ? [{ id: "retirar", nome: "Retirar do ar", simbolo: EyeOff, fazer: () => comMotivo(item, "Motivo da retirada, para quem anunciou (obrigatório)", "Anúncio retirado do ar.") }]
                    : []
              }
              detalhe={(item) => (
                <article className="pn-secao">
                  <p className="pn-rotulo-mono">
                    {tiposDeAnuncio[item.categoria] ?? item.categoria} · {item.cidade}
                    {item.uf && `, ${item.uf}`} · {data(item.criado_em)}
                  </p>
                  {edicao?.id === item.id ? (
                    <div className="pn-secao">
                      <Campo rotulo="Título" value={edicao.titulo} onChange={(e) => setEdicao({ ...edicao, titulo: e.target.value })} maxLength={100} />
                      <Campo rotulo="Ofício (opcional)" value={edicao.oficio} onChange={(e) => setEdicao({ ...edicao, oficio: e.target.value })} maxLength={60} />
                      <Area rotulo="Descrição" value={edicao.descricao} onChange={(e) => setEdicao({ ...edicao, descricao: e.target.value })} rows={5} maxLength={1200} />
                      <Campo rotulo="Contato" value={edicao.contato} onChange={(e) => setEdicao({ ...edicao, contato: e.target.value })} maxLength={160} />
                      <Campo rotulo="Link (opcional, só https)" value={edicao.link} onChange={(e) => setEdicao({ ...edicao, link: e.target.value })} maxLength={300} />
                      <div className="flex flex-wrap gap-2">
                        <Botao
                          disabled={acao.ocupado}
                          carregando={acao.ocupado}
                          onClick={async () => {
                            const { id, ...p } = edicao;
                            if (await acao.agir("mural_editar", { p_id: id, p }, "Texto do anúncio guardado. Ele continua esperando a decisão.")) setEdicao(null);
                          }}
                        >
                          Guardar o texto
                        </Botao>
                        <Botao variante="discreto" onClick={() => setEdicao(null)}>
                          Cancelar
                        </Botao>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h2 className="pn-cartao-titulo">{item.titulo}</h2>
                      {item.oficio && <p className="pn-ajuda">{item.oficio}</p>}
                      <p className="whitespace-pre-line font-serif text-lg" data-original>
                        {item.descricao}
                      </p>
                      <p>Contato: {item.contato}</p>
                      {item.link && <p className="break-all">Link: {item.link}</p>}
                      {ver === "pendente" && (
                        <div>
                          <Botao variante="discreto" pequeno simbolo={Pencil} onClick={() => setEdicao({ id: item.id, titulo: item.titulo, oficio: item.oficio ?? "", descricao: item.descricao, contato: item.contato, link: item.link })}>
                            Editar o texto
                          </Botao>
                        </div>
                      )}
                    </>
                  )}
                  <p className="pn-ajuda">
                    Enviado por {item.nome || "pessoa sem nome no perfil"}
                    {ver === "aprovado" && item.validade && ` · no ar até ${data(item.validade)}`}
                  </p>
                  {ver === "aprovado" ? (
                    retira ? (
                      <div className="pn-secao">
                        <Campo rotulo="Motivo da retirada, para quem anunciou (obrigatório)" value={notas[item.id] ?? ""} onChange={(e) => setNotas({ ...notas, [item.id]: e.target.value })} maxLength={500} />
                        <RespostasProntas tipo="mural" usar={(texto) => setNotas({ ...notas, [item.id]: texto })} />
                        <div>
                          <Botao simbolo={EyeOff} disabled={acao.ocupado || (notas[item.id] ?? "").trim().length < 5} onClick={() => void decidir(item, false, notas[item.id] ?? "", "Anúncio retirado do ar.")}>
                            Retirar do ar
                          </Botao>
                        </div>
                      </div>
                    ) : (
                      <p className="pn-ajuda">Retirar do ar um anúncio aprovado é com a coordenação.</p>
                    )
                  ) : (
                    <div className="pn-secao">
                      <Campo rotulo="Nota para quem enviou (obrigatória ao recusar)" value={notas[item.id] ?? ""} onChange={(e) => setNotas({ ...notas, [item.id]: e.target.value })} maxLength={500} />
                      <RespostasProntas tipo="mural" usar={(texto) => setNotas({ ...notas, [item.id]: texto })} />
                      <div className="flex flex-wrap gap-2">
                        <Botao variante="principal" simbolo={Check} disabled={acao.ocupado} onClick={() => void decidir(item, true, notas[item.id] ?? "", "Anúncio no ar por 180 dias.")}>
                          Aprovar
                        </Botao>
                        <Botao simbolo={X} disabled={acao.ocupado || (notas[item.id] ?? "").trim().length < 5} onClick={() => void decidir(item, false, notas[item.id] ?? "", "Anúncio recusado.")}>
                          Não aprovar
                        </Botao>
                      </div>
                    </div>
                  )}
                </article>
              )}
            />
          </div>
        )}
      />
    </div>
  );
}
