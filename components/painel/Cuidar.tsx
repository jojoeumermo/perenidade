// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { can, getClient, storageUrl, type Me } from "@/lib/backend";
import { Aviso, botao, botaoClaro, campo, data, elo, rotulo, useAcao, useLista } from "./comum";

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

/** Cuidado da comunidade: denúncias (curadoria) e anotações de leitura aguardando (curadoria e educadores). */
export function Comunidade({ me }: { me: Me }) {
  const curador = can(me, "coordenacao", "curadoria");
  return (
    <div className="space-y-10">
      <Retidos />
      {curador && <Denuncias />}
      <Anotacoes />
      {curador && <Filtro />}
      <p className="text-ink-soft">Para ocultar ou trancar uma conversa, abra o tópico na página Comunidade: os botões aparecem para quem cuida.</p>
    </div>
  );
}

interface Retido {
  tipo: "topico" | "resposta";
  id: string;
  titulo: string;
  corpo: string;
  autor: string;
  criado_em: string;
}

/** Mensagens que o filtro de palavras segurou. Ninguém de fora as vê até alguém da equipe liberar. */
function Retidos() {
  const lista = useLista<Retido[]>("comunidade_retidos");
  const acao = useAcao(lista.recarregar);
  if (!lista.dados || lista.dados.length === 0) return null;
  return (
    <section>
      <h2 className="font-serif text-2xl font-semibold">Retidas pelo filtro</h2>
      <p className="mt-1 text-ink-soft">O filtro erra para os dois lados: uma citação em aula de história pode cair aqui. Leia o contexto antes de decidir.</p>
      <Aviso texto={lista.erro || acao.aviso} />
      <ul className="mt-3 space-y-4">
        {lista.dados.map((item) => (
          <li key={item.id} className="border border-rule bg-parchment-deep p-4">
            <p className={rotulo}>
              {item.tipo === "topico" ? "Conversa nova" : "Resposta"} · {item.autor || "—"} · {data(item.criado_em)}
            </p>
            <p className="mt-1 font-semibold">{item.titulo}</p>
            <p className="mt-1 whitespace-pre-line font-serif text-lg">{item.corpo}</p>
            <div className="mt-3 flex gap-3">
              <button type="button" className={botao} disabled={acao.ocupado} onClick={() => acao.agir("comunidade_cuidar", { p_tipo: item.tipo, p_alvo: item.id, p_acao: "mostrar" }, "Mensagem liberada.")}>Liberar</button>
              <button type="button" className={botaoClaro} disabled={acao.ocupado} onClick={() => acao.agir("comunidade_cuidar", { p_tipo: item.tipo, p_alvo: item.id, p_acao: "ocultar" }, "Mensagem mantida oculta.")}>Manter oculta</button>
            </div>
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
        Mensagem com uma destas palavras ou expressões não é apagada: fica retida até alguém da equipe ler. Evite palavras com sentido comum (nome de animal, de lugar): elas seguram conversa inocente.
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

interface Faixa {
  id: string;
  titulo: string;
  artista: string;
  url: string;
  duracao: number;
  ordem: number;
}
interface Canal {
  id: string;
  nome: string;
  descricao: string;
  ordem: number;
  faixas: Faixa[];
}
interface EstadoRadio {
  no_ar: boolean;
  ao_vivo: string;
  canais: Canal[];
}

/** Rádio: montar canais e faixas com calma e só depois pôr no ar. */
export function RadioAdmin() {
  const estado = useLista<EstadoRadio>("radio_estado");
  const acao = useAcao(estado.recarregar);
  const [canal, setCanal] = useState({ nome: "", descricao: "" });
  const [faixa, setFaixa] = useState({ canal: "", titulo: "", artista: "", url: "" });
  const [aoVivo, setAoVivo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const r = estado.dados;
  if (!r) return <Aviso texto={estado.erro || "Carregando…"} />;
  const vivo = aoVivo ?? r.ao_vivo;

  /** Envia o arquivo de áudio e devolve o endereço público dele. */
  async function enviarArquivo(arquivo: File | undefined) {
    if (!arquivo) return;
    setEnviando(true);
    try {
      const nome = `${Date.now()}-${arquivo.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-60)}`;
      const supabase = await getClient();
      const { error } = await supabase.storage.from("radio").upload(nome, arquivo, { contentType: arquivo.type || "audio/ogg" });
      if (error) throw error;
      setFaixa((antes) => ({ ...antes, url: storageUrl(`radio/${nome}`), titulo: antes.titulo || arquivo.name.replace(/\.[a-z0-9]+$/i, "") }));
      acao.setAviso("Arquivo enviado. Confira o título e adicione a faixa.");
    } catch {
      acao.setAviso("Não foi possível enviar o arquivo. Confira o formato (ogg, opus, mp3) e o tamanho (até 50 MB).");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-10">
      <section className="border-2 border-ink p-5">
        <p className={rotulo}>Situação</p>
        <p className="mt-1 font-serif text-2xl font-semibold">{r.no_ar ? "No ar para todo mundo" : "Fora do ar: o público vê “Em breve”"}</p>
        <p className="mt-1 text-ink-soft">Enquanto estiver fora do ar, só a coordenação enxerga e escuta a programação.</p>
        <label className="mt-4 block">
          Transmissão ao vivo (endereço https de um fluxo de áudio; deixe vazio para tocar a programação gravada)
          <input value={vivo} onChange={(e) => setAoVivo(e.target.value)} placeholder="https://…" className={`${campo} font-mono`} />
        </label>
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" className={botao} disabled={acao.ocupado} onClick={() => acao.agir("radio_configurar", { p_no_ar: !r.no_ar, p_ao_vivo: vivo }, r.no_ar ? "Rádio fora do ar." : "Rádio no ar.")}>
            {r.no_ar ? "Tirar do ar" : "Pôr no ar"}
          </button>
          <button type="button" className={botaoClaro} disabled={acao.ocupado} onClick={() => acao.agir("radio_configurar", { p_no_ar: r.no_ar, p_ao_vivo: vivo }, "Transmissão atualizada.")}>
            Guardar transmissão ao vivo
          </button>
        </div>
      </section>

      <section>
        <h2 className="font-serif text-2xl font-semibold">Canais</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
          <label className="block">
            Nome do canal
            <input value={canal.nome} onChange={(e) => setCanal({ ...canal, nome: e.target.value })} maxLength={60} className={campo} />
          </label>
          <label className="block">
            Descrição
            <input value={canal.descricao} onChange={(e) => setCanal({ ...canal, descricao: e.target.value })} maxLength={300} className={campo} />
          </label>
          <button
            type="button"
            className={botao}
            disabled={acao.ocupado || canal.nome.trim().length < 2}
            onClick={async () => {
              const ok = await acao.agir("radio_canal_salvar", { p_id: null, p_nome: canal.nome, p_descricao: canal.descricao, p_ordem: r.canais.length }, "Canal criado.");
              if (ok) setCanal({ nome: "", descricao: "" });
            }}
          >
            Criar canal
          </button>
        </div>
      </section>

      {r.canais.length > 0 && (
        <section>
          <h2 className="font-serif text-2xl font-semibold">Nova faixa</h2>
          <p className="mt-1 text-ink-soft">
            Só envie áudio que o instituto pode distribuir: gravações próprias, material em domínio público, com licença aberta ou com autorização. Música comercial exige licença.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              Canal
              <select value={faixa.canal || r.canais[0].id} onChange={(e) => setFaixa({ ...faixa, canal: e.target.value })} className={campo}>
                {r.canais.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              Arquivo de áudio (ogg/opus ou mp3, até 50 MB)
              <input type="file" accept="audio/*" disabled={enviando} onChange={(e) => enviarArquivo(e.target.files?.[0])} className={campo} />
            </label>
            <label className="block">
              Título
              <input value={faixa.titulo} onChange={(e) => setFaixa({ ...faixa, titulo: e.target.value })} maxLength={160} className={campo} />
            </label>
            <label className="block">
              Autoria ou intérprete
              <input value={faixa.artista} onChange={(e) => setFaixa({ ...faixa, artista: e.target.value })} maxLength={120} className={campo} />
            </label>
            <label className="block sm:col-span-2">
              Endereço do áudio (preenchido ao enviar o arquivo; também aceita um endereço https)
              <input value={faixa.url} onChange={(e) => setFaixa({ ...faixa, url: e.target.value })} placeholder="https://…" className={`${campo} font-mono`} />
            </label>
          </div>
          <button
            type="button"
            className={`mt-3 ${botao}`}
            disabled={acao.ocupado || enviando || !faixa.titulo.trim() || !faixa.url.trim()}
            onClick={async () => {
              const destino = r.canais.find((item) => item.id === (faixa.canal || r.canais[0].id));
              const ok = await acao.agir("radio_faixa_salvar", { p_id: null, p_canal: destino?.id, p_titulo: faixa.titulo, p_artista: faixa.artista, p_url: faixa.url, p_duracao: 0, p_ordem: destino?.faixas.length ?? 0 }, "Faixa adicionada.");
              if (ok) setFaixa({ canal: faixa.canal, titulo: "", artista: "", url: "" });
            }}
          >
            Adicionar faixa
          </button>
        </section>
      )}

      <Aviso texto={acao.aviso} />

      {r.canais.map((item) => (
        <section key={item.id} className="border border-rule bg-parchment-deep p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="font-serif text-xl font-semibold">{item.nome}</h3>
            <button type="button" className={elo} onClick={() => acao.agir("radio_canal_remover", { p_id: item.id }, "Canal removido.")}>Remover canal</button>
          </div>
          <p className="text-ink-soft">{item.descricao}</p>
          {item.faixas.length === 0 && <p className="mt-2 text-ink-soft">Sem faixas.</p>}
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            {item.faixas.map((musica) => (
              <li key={musica.id}>
                {musica.titulo}
                {musica.artista && <span className="text-ink-soft"> · {musica.artista}</span>}{" "}
                <button type="button" className={elo} onClick={() => acao.agir("radio_faixa_remover", { p_id: musica.id }, "Faixa removida.")}>remover</button>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

interface Anuncio {
  id: string;
  categoria: string;
  titulo: string;
  descricao: string;
  cidade: string;
  uf: string;
  contato: string;
  link: string;
  nome: string;
  criado_em: string;
}

const tiposDeAnuncio: Record<string, string> = { cooperativa: "Cooperativa ou associação", servico: "Serviço", produto: "Produto", arte: "Arte e cultura", iniciativa: "Iniciativa comunitária" };

/** Anúncios do Mural dos Trabalhadores à espera de leitura. */
export function MuralFila() {
  const lista = useLista<Anuncio[]>("mural_fila", { p_status: "pendente" });
  const acao = useAcao(lista.recarregar);
  const [notas, setNotas] = useState<Record<string, string>>({});
  return (
    <div>
      <p className="max-w-3xl text-ink-soft">
        O mural é para quem vive do próprio trabalho: cooperativas, associações, autônomos, artesãos, artistas e iniciativas comunitárias. Não aprove empresas à procura de mão de obra, revenda por
        catálogo, pirâmides, empréstimos, apostas, promessas de ganho fácil nem propaganda eleitoral. Na dúvida, recuse com uma nota explicando o motivo: a pessoa pode corrigir e reenviar.
      </p>
      <Aviso texto={lista.erro || acao.aviso} />
      {lista.dados?.length === 0 && <p className="text-ink-soft">Nenhum anúncio aguardando.</p>}
      <ul className="mt-2 space-y-5">
        {lista.dados?.map((item) => (
          <li key={item.id} className="border border-rule bg-parchment-deep p-5">
            <p className={rotulo}>
              {tiposDeAnuncio[item.categoria] ?? item.categoria} · {item.cidade}
              {item.uf && `, ${item.uf}`} · {data(item.criado_em)}
            </p>
            <p className="mt-2 font-serif text-2xl font-semibold">{item.titulo}</p>
            <p className="mt-2 whitespace-pre-line font-serif text-lg">{item.descricao}</p>
            <p className="mt-2">Contato: {item.contato}</p>
            {item.link && <p className="break-all">Link: {item.link}</p>}
            <p className="text-ink-soft">Enviado por {item.nome || "pessoa sem nome no perfil"}</p>
            <label className="mt-3 block">
              Nota para quem enviou (obrigatória ao recusar)
              <input value={notas[item.id] ?? ""} onChange={(e) => setNotas({ ...notas, [item.id]: e.target.value })} maxLength={500} className={campo} />
            </label>
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
          </li>
        ))}
      </ul>
    </div>
  );
}
