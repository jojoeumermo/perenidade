// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { can, type Me, recoverPending } from "@/lib/backend";
import { Abas, Aviso, botao, botaoClaro, campo, data, elo, rotulo, useAcao, useLista } from "./comum";
import { RespostasProntas } from "./RespostasProntas";

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

/** Cuidado da comunidade: a fila de revisão e as anotações (mediação, curadoria e educadores), denúncias e filtro (curadoria). */
export function Comunidade({ me }: { me: Me }) {
  const curador = can(me, "coordenacao", "curadoria");
  const media = can(me, "coordenacao", "curadoria", "mediacao");
  const [aba, setAba] = useState<"retidas" | "banimentos" | "denuncias" | "anotacoes" | "filtro">("retidas");
  /** Cada banimento feito na fila refaz a lista de banimentos, que mora na aba ao lado. */
  const [banidos, setBanidos] = useState(0);
  return (
    <div>
      <Abas
        atual={aba}
        escolher={setAba}
        opcoes={[
          { id: "retidas" as const, nome: "Fila de revisão" },
          { id: "banimentos" as const, nome: "Banimentos" },
          { id: "denuncias" as const, nome: "Denúncias" },
          { id: "anotacoes" as const, nome: "Anotações" },
          { id: "filtro" as const, nome: "Filtro de palavras" },
        ].filter((opcao) => curador || opcao.id === "retidas" || opcao.id === "anotacoes" || (media && opcao.id === "banimentos"))}
      />
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
      <p className="mt-8 text-ink-soft">Para ocultar ou trancar uma conversa que já está no ar, abra o tópico na página Comunidade: os botões aparecem para quem cuida.</p>
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
    <section>
      <h2 className="font-serif text-2xl font-semibold">Banimentos</h2>
      <p className="mt-1 max-w-3xl text-ink-soft">
        Banir é o último recurso, para quem insiste em ataque, ódio ou propaganda depois de ter mensagens recusadas. A conta banida continua lendo o site, mas não envia mais nada. O banimento
        da origem de rede é para caso extremo (a pessoa volta com contas novas): ele barra todo envio vindo da mesma rede, e uma rede pode ser de uma escola, de um sindicato ou de uma lan
        house inteira. Todo banimento fica no registro e a coordenação é avisada na hora{desfaz ? "." : "; só ela desfaz."}
      </p>
      <Aviso texto={lista.erro || acao.aviso} />
      {lista.dados?.length === 0 && <p className="mt-2 text-ink-soft">Ninguém foi banido.</p>}
      <ul className="mt-3 divide-y divide-rule border-y border-rule">
        {lista.dados?.map((item) => (
          <li key={item.id} className={`py-3 ${item.ativo ? "" : "opacity-60"}`}>
            <p>
              <strong>{item.nome || "conta apagada"}</strong> · {item.ativo ? (item.origem ? "conta e origem de rede barradas" : "conta banida") : "banimento desfeito"}
            </p>
            <p className="text-ink-soft">
              {item.motivo} · por {item.por || "—"} · {data(item.criado_em)}
            </p>
            {desfaz && item.ativo && (
              <button type="button" className={elo} disabled={acao.ocupado} onClick={() => acao.agir("banimento_encerrar", { p_id: item.id }, "Banimento desfeito: a conta voltou a poder enviar.")}>
                Desfazer o banimento
              </button>
            )}
          </li>
        ))}
      </ul>
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

/** O que a avaliação automática deixou em dúvida e ainda espera leitura. Ninguém de fora vê nada daqui até alguém aprovar. */
function Retidos({ media, aoBanir }: { media: boolean; aoBanir: () => void }) {
  const lista = useLista<Retido[]>("comunidade_retidos");
  const acao = useAcao(lista.recarregar);
  const [edicao, setEdicao] = useState<{ id: string; titulo: string; corpo: string } | null>(null);
  const [banir, setBanir] = useState<{ id: string; motivo: string; origem: boolean } | null>(null);
  if (!lista.dados) return <Aviso texto={lista.erro || "Carregando…"} />;
  if (lista.dados.length === 0) {
    return (
      <div>
        <Aviso texto={acao.aviso} />
        <p className="text-ink-soft">Nenhuma mensagem esperando revisão. O que respeita as regras vai ao ar sozinho; aqui só chega o que ficou em dúvida.</p>
      </div>
    );
  }
  return (
    <section>
      <h2 className="font-serif text-2xl font-semibold">Fila de revisão</h2>
      <p className="mt-1 max-w-3xl text-ink-soft">
        As mensagens da Comunidade vão ao ar sozinhas quando respeitam as regras, e as que as violam claramente são barradas. Aqui chegam só os casos de dúvida. Aprove o que respeita as regras da página; edite para tirar um dado pessoal ou um palavrão sem perder a
        pergunta; recuse propaganda, ataque e discurso de ódio. O filtro de palavras erra para os dois lados: uma citação em aula de história pode vir marcada. Leia o contexto antes de decidir.
      </p>
      {lista.dados.some((item) => ["aguardando_avaliacao", "em_avaliacao", "avaliacao_externa_falhou"].includes(item.motivo ?? "")) && (
        <p className="mt-2">
          <button
            type="button"
            className={elo}
            onClick={async () => {
              const feito = await recoverPending();
              acao.setAviso(feito ? "Pedido feito: o que podia ser reavaliado foi. O que continuar aqui espera a sua leitura." : "O serviço não respondeu. As mensagens continuam aqui, esperando leitura.");
              lista.recarregar();
            }}
          >
            Tentar de novo a segunda avaliação das que ficaram esperando
          </button>
        </p>
      )}
      <Aviso texto={lista.erro || acao.aviso} />
      <ul className="mt-3 space-y-4">
        {lista.dados.map((item) => (
          <li key={item.id} className="border border-rule bg-parchment-deep p-4">
            <p className={rotulo}>
              {({ topico: "Conversa nova", resposta: "Resposta", comentario: "Comentário em aula em vídeo", aula_chat: "Bate-papo de aula ao vivo" } as Record<string, string>)[item.tipo] ?? item.tipo} · {item.autor || "—"} · {data(item.criado_em)}
              {(item.motivo || item.filtro) && <span className="text-oxblood"> · {motivos[item.motivo ?? ""] ?? "tem palavra do filtro"}</span>}
            </p>
            {edicao?.id === item.id ? (
              <div className="mt-2 space-y-3">
                {item.tipo === "topico" && (
                  <label className="block">
                    Título
                    <input value={edicao.titulo} onChange={(e) => setEdicao({ ...edicao, titulo: e.target.value })} maxLength={140} className={campo} />
                  </label>
                )}
                <label className="block">
                  Mensagem
                  <textarea value={edicao.corpo} onChange={(e) => setEdicao({ ...edicao, corpo: e.target.value })} rows={5} maxLength={8000} className={campo} />
                </label>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className={botao}
                    disabled={acao.ocupado}
                    onClick={async () => {
                      if (await acao.agir("comunidade_editar", { p_tipo: item.tipo, p_alvo: item.id, p_titulo: edicao.titulo, p_corpo: edicao.corpo }, "Texto guardado. A mensagem continua esperando a decisão.")) setEdicao(null);
                    }}
                  >
                    Guardar
                  </button>
                  <button type="button" className={elo} onClick={() => setEdicao(null)}>Cancelar</button>
                </div>
              </div>
            ) : (
              <>
                <p className="mt-1 font-semibold">{item.tipo === "resposta" ? `Em: ${item.titulo}` : item.titulo}</p>
                <p className="mt-1 whitespace-pre-line font-serif text-lg" data-original>{item.corpo}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button type="button" className={botao} disabled={acao.ocupado} onClick={() => acao.agir("comunidade_cuidar", { p_tipo: item.tipo, p_alvo: item.id, p_acao: "mostrar" }, "Mensagem aprovada: já aparece na Comunidade.")}>Aprovar</button>
                  <button type="button" className={botaoClaro} disabled={acao.ocupado} onClick={() => setEdicao({ id: item.id, titulo: item.titulo, corpo: item.corpo })}>Editar</button>
                  <button type="button" className={botaoClaro} disabled={acao.ocupado} onClick={() => acao.agir("comunidade_cuidar", { p_tipo: item.tipo, p_alvo: item.id, p_acao: "ocultar" }, "Mensagem recusada: não vai aparecer.")}>Recusar</button>
                  {media && item.autor_id && banir?.id !== item.id && (
                    <button type="button" className={elo} onClick={() => setBanir({ id: item.id, motivo: "", origem: false })}>Banir quem escreveu</button>
                  )}
                </div>
                {banir?.id === item.id && item.autor_id && (
                  <div className="mt-3 border-l-2 border-oxblood pl-4">
                    <label className="block">
                      Motivo do banimento (fica no registro e vai para a coordenação)
                      <input value={banir.motivo} onChange={(e) => setBanir({ ...banir, motivo: e.target.value })} maxLength={300} className={campo} />
                    </label>
                    <RespostasProntas tipo="banimento" usar={(texto) => setBanir({ ...banir, motivo: texto })} />
                    <label className="mt-2 flex items-start gap-2">
                      <input type="checkbox" checked={banir.origem} onChange={(e) => setBanir({ ...banir, origem: e.target.checked })} className="mt-1 h-4 w-4" />
                      <span>Caso extremo: barrar também a origem de rede desta pessoa (vale para qualquer conta e para envios sem conta vindos da mesma rede)</span>
                    </label>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <button
                        type="button"
                        className="cursor-pointer bg-oxblood px-5 py-2 font-medium text-parchment disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={acao.ocupado || banir.motivo.trim().length < 5}
                        onClick={async () => {
                          if (await acao.agir("mediacao_banir", { p_usuario: item.autor_id, p_motivo: banir.motivo, p_origem: banir.origem }, "Conta banida. A coordenação foi avisada.")) {
                            setBanir(null);
                            aoBanir();
                          }
                        }}
                      >
                        Confirmar o banimento
                      </button>
                      <button type="button" className={elo} onClick={() => setBanir(null)}>Cancelar</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
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
    <section>
      <h2 className="font-serif text-2xl font-semibold">Filtro de palavras</h2>
      <p className="mt-1 text-ink-soft">
        Mensagem da Comunidade com uma destas palavras ou expressões não é apagada: fica retida até alguém da equipe ler (as ameaças e a apologia ao ódio da lista inicial são barradas na hora). Evite palavras com sentido comum (nome de animal, de lugar): elas seguram conversa inocente.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block min-w-60">
          Acrescentar palavra ou expressão
          <input value={termo} onChange={(e) => setTermo(e.target.value)} maxLength={40} className={campo} />
        </label>
        <button type="button" className={botaoClaro} disabled={acao.ocupado || termo.trim().length < 3} onClick={async () => { if (await acao.agir("filtro_salvar", { p_termo: termo, p_incluir: true }, "Acrescentado ao filtro.")) setTermo(""); }}>
          Acrescentar
        </button>
        <button type="button" className={elo} onClick={() => setAberto(!aberto)}>
          {aberto ? "Esconder a lista" : `Mostrar a lista (${lista.dados?.length ?? 0})`}
        </button>
      </div>
      <Aviso texto={lista.erro || acao.aviso} />
      {aberto && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {lista.dados?.map((item) => (
            <li key={item} className="border border-rule bg-parchment-deep px-2 py-1">
              {item}{" "}
              <button type="button" aria-label={`Tirar ${item} do filtro`} className="cursor-pointer px-1 hover:text-oxblood" onClick={() => acao.agir("filtro_salvar", { p_termo: item, p_incluir: false }, "Retirado do filtro.")}>
                ✕
              </button>
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
    <section>
      <h2 className="font-serif text-2xl font-semibold">Denúncias</h2>
      <Aviso texto={lista.erro || acao.aviso} />
      {lista.dados?.length === 0 && <p className="mt-2 text-ink-soft">Nenhuma denúncia.</p>}
      <ul className="mt-3 space-y-4">
        {lista.dados?.map((item) => (
          <li key={item.id} className="border border-rule bg-parchment-deep p-4">
            <p className={rotulo}>
              {item.motivo} · {data(item.criado_em)} · {item.status}
            </p>
            <p className="mt-1 break-all font-mono text-xs">{item.alvo}</p>
            <p className="mt-2">{item.detalhes}</p>
            {item.status === "aberta" ? (
              <div className="mt-3">
                <input value={notas[item.id] ?? ""} onChange={(e) => setNotas({ ...notas, [item.id]: e.target.value })} placeholder="O que foi feito" aria-label="O que foi feito" maxLength={2000} className={campo} />
                <RespostasProntas tipo="denuncia" usar={(texto) => setNotas({ ...notas, [item.id]: texto })} />
                <button type="button" className={`mt-2 ${botaoClaro}`} disabled={acao.ocupado} onClick={() => acao.agir("denuncia_resolver", { p_id: item.id, p_nota: notas[item.id] ?? "" }, "Denúncia resolvida.")}>
                  Marcar como resolvida
                </button>
              </div>
            ) : (
              item.nota && <p className="mt-2 text-ink-soft">Encaminhamento: {item.nota}</p>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-ink-soft">
        Em denúncia de direitos autorais, tire o item do ar primeiro (campo <code>ativo: false</code> no arquivo) e analise depois.
      </p>
    </section>
  );
}

function Anotacoes() {
  const lista = useLista<Anotacao[]>("anotacoes_fila");
  const acao = useAcao(lista.recarregar);
  return (
    <section>
      <h2 className="font-serif text-2xl font-semibold">Anotações aguardando</h2>
      <Aviso texto={lista.erro || acao.aviso} />
      {lista.dados?.length === 0 && <p className="mt-2 text-ink-soft">Nenhuma anotação aguardando.</p>}
      <ul className="mt-3 space-y-4">
        {lista.dados?.map((item) => (
          <li key={item.id} className="border border-rule bg-parchment-deep p-4">
            <p className={rotulo}>
              {item.autor} · {data(item.criado_em)}
            </p>
            <p className="break-all font-mono text-xs">{item.caminho}</p>
            {item.trecho && <p className="mt-2 font-serif italic text-ink-soft">“{item.trecho}”</p>}
            <p className="mt-1 font-serif text-lg">{item.corpo}</p>
            <div className="mt-3 flex gap-3">
              <button type="button" className={botao} disabled={acao.ocupado} onClick={() => acao.agir("anotacao_decidir", { p_id: item.id, p_status: "aprovada" }, "Anotação publicada.")}>Publicar</button>
              <button type="button" className={botaoClaro} disabled={acao.ocupado} onClick={() => acao.agir("anotacao_decidir", { p_id: item.id, p_status: "oculta" }, "Anotação descartada.")}>Descartar</button>
            </div>
          </li>
        ))}
      </ul>
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
    <div>
      <p className="text-ink-soft">Só inclua o nome de quem autorizou aparecer no mural.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
        <label className="block">
          Nome
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} className={campo} />
        </label>
        <label className="block">
          Mensagem (opcional)
          <input value={mensagem} onChange={(e) => setMensagem(e.target.value)} maxLength={200} className={campo} />
        </label>
        <button
          type="button"
          className={botao}
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
        </button>
      </div>
      <Aviso texto={lista.erro || acao.aviso} />
      <ul className="mt-4 divide-y divide-rule border-y border-rule">
        {lista.dados?.map((item) => (
          <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-3 py-2">
            <span>
              <strong>{item.nome}</strong>
              {item.mensagem && <span className="text-ink-soft"> · “{item.mensagem}”</span>}
            </span>
            <button type="button" className={elo} onClick={() => acao.agir("apoiador_remover", { p_id: item.id }, "Nome retirado.")}>Retirar</button>
          </li>
        ))}
      </ul>
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
      const dados = await (await fetch(`/api/radios?por=${procura.por}&q=${encodeURIComponent(procura.texto.trim())}`)).json();
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
    <section className="border border-rule bg-parchment-deep p-5">
      <h2 className="font-serif text-2xl font-semibold">Sugerir uma emissora</h2>
      <p className="mt-1 text-ink-soft">
        A lista “Rádios do povo” da página da rádio reúne emissoras populares, comunitárias e de trabalhadores. Ela faz parte do acervo do site, então uma emissora nova entra como toda
        contribuição: você indica aqui, a curadoria confere e ela vai ao ar na publicação seguinte.
      </p>
      <div className="mt-4 border-l-2 border-gold pl-4">
        <p className={rotulo}>Procurar no diretório aberto (Radio Browser), só emissoras do Brasil</p>
        <form className="mt-2 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void procurar(); }}>
          <label className="block min-w-48 flex-1">
            Nome ou etiqueta
            <input value={procura.texto} onChange={(e) => setProcura({ ...procura, texto: e.target.value })} maxLength={60} placeholder="Ex.: comunitária, educativa, sindical" className={campo} />
          </label>
          <label className="block">
            Procurar por
            <select value={procura.por} onChange={(e) => setProcura({ ...procura, por: e.target.value })} className={campo}>
              <option value="name">nome</option>
              <option value="tag">etiqueta</option>
            </select>
          </label>
          <button type="submit" className={botaoClaro} disabled={buscando || procura.texto.trim().length < 2}>{buscando ? "Procurando…" : "Procurar"}</button>
        </form>
        <p className="mt-1 text-sm text-ink-soft">O diretório não diz a linha de ninguém: ouça a emissora antes de indicar. Só aparecem as que transmitem por endereço seguro (https).</p>
        {achadas && achadas.length === 0 && <p className="mt-2 text-ink-soft">Nenhuma emissora encontrada.</p>}
        {achadas && achadas.length > 0 && (
          <ul className="mt-2 max-h-72 divide-y divide-rule overflow-y-auto border-y border-rule">
            {achadas.map((emissora) => (
              <li key={emissora.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span className="min-w-0">
                  <strong>{emissora.nome}</strong>
                  <span className="block text-sm text-ink-soft">{[emissora.lugar, emissora.formato, emissora.etiquetas.join(", ")].filter(Boolean).join(" · ")}</span>
                </span>
                <button type="button" className={elo} onClick={() => setNova({ ...nova, nome: emissora.nome, lugar: [emissora.lugar, "Brasil"].filter(Boolean).join(", "), site: emissora.site || emissora.transmissao })}>
                  Usar na indicação
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          Nome da emissora
          <input value={nova.nome} onChange={(e) => setNova({ ...nova, nome: e.target.value })} maxLength={100} className={campo} />
        </label>
        <label className="block">
          Cidade e país
          <input value={nova.lugar} onChange={(e) => setNova({ ...nova, lugar: e.target.value })} maxLength={100} className={campo} />
        </label>
        <label className="block sm:col-span-2">
          Site da emissora (https)
          <input value={nova.site} onChange={(e) => setNova({ ...nova, site: e.target.value })} maxLength={300} placeholder="https://…" className={`${campo} font-mono`} />
        </label>
        <label className="block sm:col-span-2">
          Quem mantém a emissora e por que ela cabe na lista
          <textarea value={nova.porque} onChange={(e) => setNova({ ...nova, porque: e.target.value })} rows={3} maxLength={1500} className={campo} />
        </label>
      </div>
      <button
        type="button"
        className={`mt-3 ${botao}`}
        disabled={acao.ocupado || !pronta}
        onClick={async () => {
          const corpo = `Indicação de emissora para a lista "Rádios do povo".\n\nEmissora: ${nova.nome.trim()}\nLugar: ${nova.lugar.trim()}\nSite: ${nova.site.trim()}\n\n${nova.porque.trim()}`;
          if (await acao.agir("contribuir", { p: { tipo: "sugestao", titulo: `Emissora: ${nova.nome.trim()}`.slice(0, 160), corpo, alvo: "/radio" } }, "Indicação enviada para a fila de revisão.")) setNova({ nome: "", lugar: "", site: "", porque: "" });
        }}
      >
        Enviar a indicação
      </button>
      <Aviso texto={acao.aviso} />
    </section>
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

// A gestão da Rádio Lúcia própria saiu do painel em 18/10/2026: o projeto foi adiado. As tabelas radio_canais e radio_faixas e as
// funções radio_* continuam no banco, intactas, para a retomada (veja docs/RELATORIO-RODADA-3.md).

export function MuralFila({ me }: { me: Me }) {
  const [ver, setVer] = useState<"pendente" | "aprovado">("pendente");
  const lista = useLista<Anuncio[]>("mural_fila", { p_status: ver });
  const acao = useAcao(lista.recarregar);
  const retira = can(me, "coordenacao");
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [edicao, setEdicao] = useState<{ id: string; titulo: string; oficio: string; descricao: string; contato: string; link: string } | null>(null);
  return (
    <div>
      <p className="max-w-3xl text-ink-soft">
        O mural é para quem vive do próprio trabalho: cooperativas, associações, autônomos, artesãos, artistas e iniciativas comunitárias. Não aprove empresas à procura de mão de obra, revenda por
        catálogo, pirâmides, empréstimos, apostas, promessas de ganho fácil nem propaganda eleitoral. Na dúvida, recuse com uma nota explicando o motivo: a pessoa pode corrigir e reenviar.
      </p>
      <Abas
        opcoes={[
          { id: "pendente", nome: "Esperando decisão" },
          { id: "aprovado", nome: "No ar" },
        ]}
        atual={ver}
        escolher={setVer}
      />
      <Aviso texto={lista.erro || acao.aviso} />
      {lista.dados?.length === 0 && <p className="text-ink-soft">{ver === "pendente" ? "Nenhum anúncio aguardando." : "Nenhum anúncio no ar."}</p>}
      <ul className="mt-2 space-y-5">
        {lista.dados?.map((item) => (
          <li key={item.id} className="border border-rule bg-parchment-deep p-5">
            <p className={rotulo}>
              {tiposDeAnuncio[item.categoria] ?? item.categoria} · {item.cidade}
              {item.uf && `, ${item.uf}`} · {data(item.criado_em)}
            </p>
            {edicao?.id === item.id ? (
              <div className="mt-2 space-y-3">
                <label className="block">
                  Título
                  <input value={edicao.titulo} onChange={(e) => setEdicao({ ...edicao, titulo: e.target.value })} maxLength={100} className={campo} />
                </label>
                <label className="block">
                  Ofício (opcional)
                  <input value={edicao.oficio} onChange={(e) => setEdicao({ ...edicao, oficio: e.target.value })} maxLength={60} className={campo} />
                </label>
                <label className="block">
                  Descrição
                  <textarea value={edicao.descricao} onChange={(e) => setEdicao({ ...edicao, descricao: e.target.value })} rows={5} maxLength={1200} className={campo} />
                </label>
                <label className="block">
                  Contato
                  <input value={edicao.contato} onChange={(e) => setEdicao({ ...edicao, contato: e.target.value })} maxLength={160} className={campo} />
                </label>
                <label className="block">
                  Link (opcional, só https)
                  <input value={edicao.link} onChange={(e) => setEdicao({ ...edicao, link: e.target.value })} maxLength={300} className={campo} />
                </label>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className={botaoClaro}
                    disabled={acao.ocupado}
                    onClick={async () => {
                      const { id, ...p } = edicao;
                      if (await acao.agir("mural_editar", { p_id: id, p }, "Texto do anúncio guardado. Ele continua esperando a decisão.")) setEdicao(null);
                    }}
                  >
                    Guardar o texto
                  </button>
                  <button type="button" className={elo} onClick={() => setEdicao(null)}>Cancelar</button>
                </div>
              </div>
            ) : (
              <>
                <p className="mt-2 font-serif text-2xl font-semibold">{item.titulo}</p>
                {item.oficio && <p className="text-ink-soft">{item.oficio}</p>}
                <p className="mt-2 whitespace-pre-line font-serif text-lg" data-original>{item.descricao}</p>
                <p className="mt-2">Contato: {item.contato}</p>
                {item.link && <p className="break-all">Link: {item.link}</p>}
                {ver === "pendente" && (
                  <button type="button" className={`mt-1 ${elo}`} onClick={() => setEdicao({ id: item.id, titulo: item.titulo, oficio: item.oficio ?? "", descricao: item.descricao, contato: item.contato, link: item.link })}>
                    Editar o texto
                  </button>
                )}
              </>
            )}
            <p className="text-ink-soft">
              Enviado por {item.nome || "pessoa sem nome no perfil"}
              {ver === "aprovado" && item.validade && ` · no ar até ${data(item.validade)}`}
            </p>
            {ver === "aprovado" ? (
              retira ? (
                <>
                  <label className="mt-3 block">
                    Motivo da retirada, para quem anunciou (obrigatório)
                    <input value={notas[item.id] ?? ""} onChange={(e) => setNotas({ ...notas, [item.id]: e.target.value })} maxLength={500} className={campo} />
                  </label>
                  <RespostasProntas tipo="mural" usar={(texto) => setNotas({ ...notas, [item.id]: texto })} />
                  <button
                    type="button"
                    className={`mt-3 ${botaoClaro}`}
                    disabled={acao.ocupado || (notas[item.id] ?? "").trim().length < 5}
                    onClick={() => acao.agir("mural_decidir", { p_id: item.id, p_aprovar: false, p_nota: notas[item.id] ?? "" }, "Anúncio retirado do ar.")}
                  >
                    Retirar do ar
                  </button>
                </>
              ) : (
                <p className="mt-3 text-ink-soft">Retirar do ar um anúncio aprovado é com a coordenação.</p>
              )
            ) : (
              <>
                <label className="mt-3 block">
                  Nota para quem enviou (obrigatória ao recusar)
                  <input value={notas[item.id] ?? ""} onChange={(e) => setNotas({ ...notas, [item.id]: e.target.value })} maxLength={500} className={campo} />
                </label>
                <RespostasProntas tipo="mural" usar={(texto) => setNotas({ ...notas, [item.id]: texto })} />
                <div className="mt-3 flex flex-wrap gap-3">
                  <button type="button" className={botao} disabled={acao.ocupado} onClick={() => acao.agir("mural_decidir", { p_id: item.id, p_aprovar: true, p_nota: notas[item.id] ?? "" }, "Anúncio no ar por 180 dias.")}>
                    Aprovar
                  </button>
                  <button
                    type="button"
                    className={botaoClaro}
                    disabled={acao.ocupado || (notas[item.id] ?? "").trim().length < 5}
                    onClick={() => acao.agir("mural_decidir", { p_id: item.id, p_aprovar: false, p_nota: notas[item.id] ?? "" }, "Anúncio recusado.")}
                  >
                    Não aprovar
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
