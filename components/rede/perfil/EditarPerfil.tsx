// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "@/components/Link";
import { rede } from "@/lib/rede/cliente";
import { redePerfil } from "@/lib/rede/cliente-perfil";
import {
  arrumarHandle, AVATARES, BIO_MAXIMA, CAPAS, caminhoDaCapa, caminhoDoAvatar, escolherSelosDeTrilha, estudandoDaUltimaAula, handleBemFormado, handleReservado,
  nomeDaTrilha, trilhasComProgresso,
} from "@/lib/rede/perfil";
import { preencher } from "@/lib/rede/preencher";
import { enderecos, type Post } from "@/lib/rede/tipos";
import type { ImagemNaFila, PedidoDeEdicao, PedidoDeSeguir, PerfilMeu } from "@/lib/rede/tipos-perfil";
import type { TextosDoPerfil } from "@/lib/rede/textos-perfil";
import type { TextosDaRede } from "@/lib/rede/textos";
import { codigoDoErro, textoDoErro } from "../erros";
import { EsqueletoDaLinha } from "../Esqueletos";
import type { PropsDaTelaDoPacote } from "../registro";
import { Avatar } from "./Avatar";
import { prepararImagem } from "./imagem";
import { useTextosDoPerfil } from "./useTextos";
import { orgLigada } from "@/lib/rede/org/flag";
import { previa } from "./livre/dados";
import EditorDoPerfil from "./livre/Editor";

/** O erro de uma chamada em texto: primeiro os do pacote (@nome, imagem…), depois os gerais da Rede. */
function textoDoErroDoPerfil(sp: TextosDoPerfil, s: TextosDaRede, e: unknown): string {
  const codigo = codigoDoErro(e);
  const erros = sp.erros as Record<string, string>;
  const [tipo, campo] = codigo.split(":");
  if (tipo === "invalido" && campo && erros[`invalido_${campo}`]) return erros[`invalido_${campo}`];
  if (erros[tipo]) return erros[tipo];
  return textoDoErro(s, e);
}

function lerDoAparelho<T>(chave: string, padrao: T): T {
  try {
    const bruto = window.localStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : padrao;
  } catch {
    return padrao;
  }
}

const caixa = "mt-6 border-t border-rule pt-5";
const botaoCheio = "min-h-11 cursor-pointer rounded-full bg-[#c21f16] px-5 font-bold text-white hover:bg-[#1f1a14] disabled:cursor-not-allowed disabled:opacity-50";
const botaoVazado = "min-h-11 cursor-pointer rounded-full border-[1.5px] border-ink px-4 font-bold hover:bg-parchment-deep disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Editar o perfil da Rede (/alumia/editar-perfil): @nome, bio, rosto (galeria de desenhos ou foto enviada), capa, quem pode achar
 * (aberto, trancado, invisível), "estudando agora" (opt-in), selos de trilha, post fixado e os pedidos para seguir. Cada bloco salva
 * sozinho e diz o que aconteceu dentro da página. Quem cuida da Rede também vê aqui a fila de imagens enviadas.
 */
export default function EditarPerfil(props: PropsDaTelaDoPacote) {
  // A Alumia nova (rede-v2 + alumia-2 + alumia-org): o editor do perfil livre, com a prévia ao vivo; os blocos de hoje ficam na
  // aba "Conta" dele. Com a frente desligada, a tela de hoje.
  if (orgLigada()) return <EditorDoPerfil {...props} conta={previa() ? null : <ContaDoPerfil {...props} embutido />} />;
  return <ContaDoPerfil {...props} />;
}

/** Os blocos de hoje (@nome, rosto e capa de desenho ou foto, quem acha, estudando, selos, pedidos, fila). `embutido`: dentro do editor novo. */
export function ContaDoPerfil({ lang, s, situacao, embutido = false }: PropsDaTelaDoPacote & { embutido?: boolean }) {
  const sp = useTextosDoPerfil(lang);
  const [meu, setMeu] = useState<PerfilMeu | null>(null);
  const [falha, setFalha] = useState("");
  const [aviso, setAviso] = useState<{ chave: string; texto: string; erro: boolean } | null>(null);
  const [ocupado, setOcupado] = useState("");

  const carregar = useCallback(() => {
    redePerfil
      .meu()
      .then(setMeu)
      .catch((e) => setFalha(textoDoErro(s, e)));
  }, [s]);
  useEffect(() => {
    if (situacao.membro) carregar();
  }, [situacao.membro, carregar]);

  if (!sp) return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />;
  if (!situacao.logado || !situacao.membro) {
    return (
      <p className="px-[18px] py-8 font-sans text-ink-soft" role="status">
        {sp.editar.entrarNaRede}
      </p>
    );
  }
  if (falha) return <p className="px-[18px] py-8 font-sans text-oxblood" role="alert">{falha}</p>;
  if (!meu) return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />;

  /** Roda uma ação do bloco `chave`: marca ocupado, mostra o resultado (ou o erro) no próprio bloco. */
  async function rodar<T>(chave: string, acao: () => Promise<T>, aoFim?: (r: T) => void): Promise<void> {
    setOcupado(chave);
    setAviso(null);
    try {
      const r = await acao();
      aoFim?.(r);
      setAviso({ chave, texto: sp!.editar.salvo, erro: false });
    } catch (e) {
      setAviso({ chave, texto: textoDoErroDoPerfil(sp!, s, e), erro: true });
    } finally {
      setOcupado("");
    }
  }
  const editar = (chave: string, pedido: PedidoDeEdicao) => rodar(chave, () => redePerfil.editar(pedido), setMeu);
  const mensagem = (chave: string) =>
    aviso?.chave === chave ? (
      <p role={aviso.erro ? "alert" : "status"} className={`mt-2 text-sm ${aviso.erro ? "text-oxblood" : "text-ink-soft"}`}>
        {aviso.texto}
      </p>
    ) : null;

  return (
    <div className={embutido ? "font-sans" : "px-[18px] py-5 font-sans"}>
      <div className={embutido ? "hidden" : "flex flex-wrap items-center justify-between gap-2"}>
        <h1 className="font-serif text-2xl font-extrabold">{sp.editar.titulo}</h1>
        {meu.handle && (
          <Link href={enderecos.perfil(lang, meu.handle)} className="text-sm underline">
            {sp.editar.verPerfil}
          </Link>
        )}
      </div>
      <p className={embutido ? "hidden" : "mt-1 flex items-center gap-2 text-sm text-ink-soft"}>
        <Avatar imagem={meu.avatar} codinome={meu.codinome ?? "?"} tamanho={28} />
        {preencher(s.postando, { codinome: meu.codinome ?? "" })}
      </p>

      <BlocoHandle sp={sp} meu={meu} ocupado={ocupado === "handle"} aviso={mensagem("handle")} aoSalvar={(h) => rodar("handle", () => redePerfil.definirHandle(h), () => carregar())} />

      <BlocoBio sp={sp} meu={meu} ocupado={ocupado === "bio"} aviso={mensagem("bio")} aoSalvar={(bio) => editar("bio", { bio })} />

      <BlocoImagem
        tipo="avatar"
        sp={sp}
        meu={meu}
        ocupado={ocupado === "avatar"}
        aviso={mensagem("avatar")}
        aoEscolher={(id) => editar("avatar", { avatar: id })}
        aoEnviar={(dados) => rodar("avatar", () => redePerfil.enviarImagem("avatar", dados), setMeu)}
        aoRemover={() => rodar("avatar", () => redePerfil.removerImagem("avatar"), setMeu)}
        aoFalhar={(texto) => setAviso({ chave: "avatar", texto, erro: true })}
      />

      <BlocoImagem
        tipo="capa"
        sp={sp}
        meu={meu}
        ocupado={ocupado === "capa"}
        aviso={mensagem("capa")}
        aoEscolher={(id) => editar("capa", { capa: id })}
        aoEnviar={(dados) => rodar("capa", () => redePerfil.enviarImagem("capa", dados), setMeu)}
        aoRemover={() => rodar("capa", () => redePerfil.removerImagem("capa"), setMeu)}
        aoFalhar={(texto) => setAviso({ chave: "capa", texto, erro: true })}
      />

      <section className={caixa} aria-labelledby="perfil-modo">
        <h2 id="perfil-modo" className="font-serif text-lg font-semibold">{sp.editar.modoTitulo}</h2>
        <div role="radiogroup" aria-labelledby="perfil-modo" className="mt-2 space-y-2">
          {(["aberto", "trancado", "invisivel"] as const).map((m) => {
            const nome = m === "aberto" ? sp.editar.modoAberto : m === "trancado" ? sp.editar.modoTrancado : sp.editar.modoInvisivel;
            const ajuda = m === "aberto" ? sp.editar.modoAbertoAjuda : m === "trancado" ? sp.editar.modoTrancadoAjuda : sp.editar.modoInvisivelAjuda;
            return (
              <label key={m} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-rule px-3 py-2 has-[:checked]:border-ink has-[:checked]:bg-folha">
                <input type="radio" name="modo" className="mt-1.5" checked={meu.modo === m} disabled={ocupado === "modo"} onChange={() => void editar("modo", { modo: m })} />
                <span>
                  <span className="font-bold">{nome}</span>
                  <span className="block text-sm text-ink-soft">{ajuda}</span>
                </span>
              </label>
            );
          })}
        </div>
        {mensagem("modo")}
      </section>

      <BlocoEstudando sp={sp} meu={meu} ocupado={ocupado === "estudando"} aviso={mensagem("estudando")} aoMudar={(pedido) => editar("estudando", pedido)} />

      <BlocoSelos sp={sp} meu={meu} ocupado={ocupado === "selos"} aviso={mensagem("selos")} aoSalvar={(pedido) => editar("selos", pedido)} />
      {meu.selos.includes("escola:carteirinha") && (
        <p className="-mt-2 px-1 text-sm">
          {sp.editar.escolaAtalho} <Link href={`/${lang}/escola/percurso`} className="font-bold underline">{sp.editar.escolaAtalhoLink}</Link>
        </p>
      )}

      {!embutido && <BlocoFixado sp={sp} s={s} meu={meu} aoFixar={(id) => rodar("fixar", () => redePerfil.fixar(id), () => carregar())} ocupado={ocupado === "fixar"} aviso={mensagem("fixar")} />}

      <BlocoPedidos sp={sp} s={s} pedidos={meu.pedidos} aoMudou={carregar} />

      {situacao.cuida && <BlocoFila sp={sp} s={s} />}
    </div>
  );
}

function BlocoHandle({ sp, meu, ocupado, aviso, aoSalvar }: { sp: TextosDoPerfil; meu: PerfilMeu; ocupado: boolean; aviso: React.ReactNode; aoSalvar: (h: string) => void }) {
  const [texto, setTexto] = useState(meu.handle ?? "");
  const h = arrumarHandle(texto);
  const bom = handleBemFormado(h);
  // O banco só devolve handle_troca_em enquanto a troca está travada (30 dias depois da última).
  const trava = Boolean(meu.handle_troca_em && meu.handle);
  return (
    <form
      className={caixa}
      onSubmit={(e) => {
        e.preventDefault();
        if (bom) aoSalvar(h);
      }}
    >
      <label htmlFor="perfil-handle" className="font-serif text-lg font-semibold">{sp.editar.handleTitulo}</label>
      <p id="perfil-handle-ajuda" className="text-sm text-ink-soft">{sp.editar.handleAjuda}</p>
      {trava && meu.handle_troca_em && <p className="text-sm text-ink-soft">{sp.erros.handle_recente} ({new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(meu.handle_troca_em))})</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span aria-hidden className="text-lg">@</span>
        <input
          id="perfil-handle"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={21}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby="perfil-handle-ajuda"
          aria-invalid={texto !== "" && !bom}
          className="min-h-11 w-56 rounded-lg border border-rule bg-folha px-3"
        />
        <button type="submit" disabled={ocupado || !bom || h === meu.handle || handleReservado(h)} className={botaoCheio}>
          {sp.editar.handleSalvar}
        </button>
      </div>
      {texto !== "" && !bom && <p className="mt-1 text-sm text-oxblood">{sp.erros.invalido_handle}</p>}
      {bom && handleReservado(h) && <p className="mt-1 text-sm text-oxblood">{sp.erros.handle_reservado}</p>}
      {aviso}
    </form>
  );
}

function BlocoBio({ sp, meu, ocupado, aviso, aoSalvar }: { sp: TextosDoPerfil; meu: PerfilMeu; ocupado: boolean; aviso: React.ReactNode; aoSalvar: (b: string) => void }) {
  const [bio, setBio] = useState(meu.bio);
  return (
    <form
      className={caixa}
      onSubmit={(e) => {
        e.preventDefault();
        aoSalvar(bio.trim());
      }}
    >
      <label htmlFor="perfil-bio" className="font-serif text-lg font-semibold">{sp.editar.bioTitulo}</label>
      <p id="perfil-bio-ajuda" className="text-sm text-ink-soft">{sp.editar.bioAjuda}</p>
      <textarea id="perfil-bio" value={bio} onChange={(e) => setBio(e.target.value.slice(0, BIO_MAXIMA))} rows={3} maxLength={BIO_MAXIMA} aria-describedby="perfil-bio-ajuda" className="mt-2 w-full rounded-lg border border-rule bg-folha px-3 py-2" />
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-ink-soft">{preencher(sp.editar.contador, { n: bio.length })}</span>
        <button type="submit" disabled={ocupado || bio.trim() === meu.bio} className={botaoCheio}>
          {ocupado ? sp.editar.salvando : sp.editar.salvar}
        </button>
      </div>
      {aviso}
    </form>
  );
}

function BlocoImagem({
  tipo, sp, meu, ocupado, aviso, aoEscolher, aoEnviar, aoRemover, aoFalhar,
}: {
  tipo: "avatar" | "capa";
  sp: TextosDoPerfil;
  meu: PerfilMeu;
  ocupado: boolean;
  aviso: React.ReactNode;
  aoEscolher: (id: string | null) => void;
  aoEnviar: (dados: string) => void;
  aoRemover: () => void;
  aoFalhar: (texto: string) => void;
}) {
  const atual = tipo === "avatar" ? meu.avatar : meu.capa;
  const ids = tipo === "avatar" ? AVATARES : CAPAS;
  const nomes = (tipo === "avatar" ? sp.avatar.nomes : sp.capa.nomes) as Record<string, string>;
  const t = tipo === "avatar" ? sp.avatar : sp.capa;
  const [previa, setPrevia] = useState<string | null>(null);
  const titulo = `perfil-${tipo}`;
  return (
    <section className={caixa} aria-labelledby={titulo}>
      <h2 id={titulo} className="font-serif text-lg font-semibold">{t.titulo}</h2>
      <p className="text-sm text-ink-soft">{t.galeria}</p>
      <ul className={`mt-2 grid gap-2 ${tipo === "avatar" ? "grid-cols-4 sm:grid-cols-6" : "grid-cols-2 sm:grid-cols-4"}`}>
        {ids.map((id) => {
          const marcado = atual.tipo === "galeria" && atual.id === id;
          return (
            <li key={id}>
              <button
                type="button"
                aria-pressed={marcado}
                aria-label={nomes[id] ?? id}
                disabled={ocupado}
                onClick={() => aoEscolher(id)}
                className={`block w-full cursor-pointer overflow-hidden rounded-lg border-2 p-0.5 disabled:opacity-50 ${marcado ? "border-[#c21f16]" : "border-transparent hover:border-ink"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- SVG pequeno do projeto. */}
                <img src={tipo === "avatar" ? caminhoDoAvatar(id) : caminhoDaCapa(id)} alt="" aria-hidden width={tipo === "avatar" ? 64 : 120} height={tipo === "avatar" ? 64 : 40} loading="lazy" decoding="async" className={`w-full ${tipo === "avatar" ? "aspect-square rounded-full" : "aspect-[3/1] rounded"} object-cover`} />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" disabled={ocupado || atual.tipo === null} onClick={() => aoEscolher(null)} className={botaoVazado}>
          {tipo === "avatar" ? sp.avatar.iniciais : sp.capa.nenhuma}
        </button>
        <label className={`${botaoVazado} inline-flex items-center ${ocupado ? "pointer-events-none opacity-50" : ""}`}>
          {t.enviar}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={ocupado}
            onChange={async (e) => {
              const arquivo = e.target.files?.[0];
              e.target.value = "";
              if (!arquivo) return;
              try {
                const dados = await prepararImagem(arquivo, tipo);
                if (dados) setPrevia(dados);
                else aoFalhar(sp.avatar.semSuporte);
              } catch {
                aoFalhar(sp.avatar.semSuporte);
              }
            }}
          />
        </label>
        {atual.tipo === "envio" && (
          <button type="button" disabled={ocupado} onClick={aoRemover} className={botaoVazado}>
            {sp.avatar.remover}
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-ink-soft">{sp.avatar.enviarAjuda}</p>
      {previa && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-rule bg-folha p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- pré-visualização local da imagem já reencodada. */}
          <img src={previa} alt="" aria-hidden className={tipo === "avatar" ? "h-20 w-20 rounded-full object-cover" : "aspect-[3/1] w-60 max-w-full rounded object-cover"} />
          <button
            type="button"
            disabled={ocupado}
            onClick={() => {
              const dados = previa;
              setPrevia(null);
              aoEnviar(dados);
            }}
            className={botaoCheio}
          >
            {t.enviar}
          </button>
          <button type="button" onClick={() => setPrevia(null)} className={botaoVazado}>
            {sp.editar.recusar}
          </button>
        </div>
      )}
      {atual.tipo === "envio" && atual.pendente && (
        <p className="mt-2 text-sm" role="status">
          {sp.avatar.pendente}
        </p>
      )}
      {aviso}
    </section>
  );
}

function BlocoEstudando({ sp, meu, ocupado, aviso, aoMudar }: { sp: TextosDoPerfil; meu: PerfilMeu; ocupado: boolean; aviso: React.ReactNode; aoMudar: (p: PedidoDeEdicao) => void }) {
  const ligado = meu.estudando !== null;
  return (
    <section className={caixa} aria-labelledby="perfil-estudando">
      <h2 id="perfil-estudando" className="font-serif text-lg font-semibold">{sp.editar.estudandoTitulo}</h2>
      <p className="text-sm text-ink-soft">{sp.editar.estudandoAjuda}</p>
      <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={ligado}
          disabled={ocupado}
          onChange={(e) => {
            if (!e.target.checked) return aoMudar({ estudando: null });
            // O site só olha a última aula do aparelho depois que a pessoa liga, e só esta chave.
            const atual = estudandoDaUltimaAula(lerDoAparelho<unknown>("lucia:ultima-aula", null));
            aoMudar({ estudando: { ligado: true, ...(atual ?? {}) } });
          }}
        />
        <span className="font-bold">{sp.editar.estudandoLigar}</span>
      </label>
      {ligado && (meu.estudando?.titulo || meu.estudando?.aula ? <p className="text-sm">{preencher(sp.editar.estudandoAtual, { titulo: meu.estudando?.titulo ?? meu.estudando?.aula ?? "" })}</p> : <p className="text-sm text-ink-soft">{sp.editar.estudandoNada}</p>)}
      {aviso}
    </section>
  );
}

function BlocoSelos({ sp, meu, ocupado, aviso, aoSalvar }: { sp: TextosDoPerfil; meu: PerfilMeu; ocupado: boolean; aviso: React.ReactNode; aoSalvar: (p: PedidoDeEdicao) => void }) {
  const [escolhidas, setEscolhidas] = useState<string[]>(meu.selos_trilhas);
  const [mostrar, setMostrar] = useState(meu.selos_mostrar);
  // O progresso fica no aparelho; só os nomes das trilhas que a pessoa marcar vão para o perfil.
  const [trilhas, setTrilhas] = useState<{ slug: string; feitas: number }[]>([]);
  useEffect(() => {
    const t = window.setTimeout(() => setTrilhas(trilhasComProgresso(lerDoAparelho<string[]>("lucia:concluidas", [])).slice(0, 40)), 0);
    return () => window.clearTimeout(t);
  }, []);
  const lista = [...new Set([...meu.selos_trilhas, ...trilhas.map((x) => x.slug)])];
  const alterou = mostrar !== meu.selos_mostrar || JSON.stringify([...escolhidas].sort()) !== JSON.stringify([...meu.selos_trilhas].sort());
  return (
    <form
      className={caixa}
      onSubmit={(e) => {
        e.preventDefault();
        aoSalvar({ selos_trilhas: escolherSelosDeTrilha(escolhidas), selos_mostrar: mostrar });
      }}
    >
      <h2 className="font-serif text-lg font-semibold">{sp.editar.selosTitulo}</h2>
      <label className="flex min-h-11 cursor-pointer items-center gap-3">
        <input type="checkbox" checked={mostrar} onChange={(e) => setMostrar(e.target.checked)} />
        <span className="font-bold">{sp.editar.selosMostrar}</span>
      </label>
      <fieldset className="mt-1">
        <legend className="text-sm font-bold">{sp.editar.selosTrilhas}</legend>
        <p className="text-xs text-ink-soft">{sp.perfil.selosAjuda}</p>
        {lista.length === 0 ? (
          <p className="mt-1 text-sm text-ink-soft">{sp.editar.selosSemProgresso}</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {lista.map((slug) => (
              <li key={slug}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3">
                  <input type="checkbox" checked={escolhidas.includes(slug)} onChange={(e) => setEscolhidas((a) => (e.target.checked ? [...a, slug] : a.filter((x) => x !== slug)))} />
                  <span>{nomeDaTrilha(slug)}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
      <button type="submit" disabled={ocupado || !alterou} className={`${botaoCheio} mt-2`}>
        {ocupado ? sp.editar.salvando : sp.editar.salvar}
      </button>
      {aviso}
    </form>
  );
}

function BlocoFixado({ sp, s, meu, aoFixar, ocupado, aviso }: { sp: TextosDoPerfil; s: TextosDaRede; meu: PerfilMeu; aoFixar: (id: string | null) => void; ocupado: boolean; aviso: React.ReactNode }) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const handle = meu.handle;
  useEffect(() => {
    if (!handle) return;
    let vivo = true;
    rede
      .linha(`u:${handle}`, null, 10)
      .then((p) => vivo && setPosts(p.itens.filter((x) => x.meu)))
      .catch(() => vivo && setPosts([]));
    return () => {
      vivo = false;
    };
  }, [handle]);
  if (!handle) return null;
  return (
    <section className={caixa} aria-labelledby="perfil-fixado">
      <h2 id="perfil-fixado" className="font-serif text-lg font-semibold">{sp.editar.fixarTitulo}</h2>
      <p className="text-sm text-ink-soft">{sp.editar.fixarAjuda}</p>
      {posts === null ? (
        <p className="mt-2 text-sm text-ink-soft" role="status">{s.estados.carregando}</p>
      ) : posts.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">{sp.editar.semPosts}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {posts.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-3 rounded-lg border border-rule bg-folha px-3 py-2">
              <span className="min-w-0 break-words text-sm">{(p.titulo ?? p.texto).slice(0, 140)}</span>
              {meu.fixado === p.id ? (
                <button type="button" disabled={ocupado} onClick={() => aoFixar(null)} className={`${botaoVazado} shrink-0`}>
                  {sp.editar.desafixar}
                </button>
              ) : (
                <button type="button" disabled={ocupado || p.retido} onClick={() => aoFixar(p.id)} className={`${botaoVazado} shrink-0`}>
                  {sp.editar.fixar}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {aviso}
    </section>
  );
}

function BlocoPedidos({ sp, s, pedidos, aoMudou }: { sp: TextosDoPerfil; s: TextosDaRede; pedidos: number; aoMudou: () => void }) {
  const [lista, setLista] = useState<PedidoDeSeguir[] | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    let vivo = true;
    redePerfil
      .pedidos()
      .then((l) => vivo && setLista(l))
      .catch((e) => vivo && (setErro(textoDoErro(s, e)), setLista([])));
    return () => {
      vivo = false;
    };
  }, [s, pedidos]);
  async function decidir(p: PedidoDeSeguir, aceitar: boolean) {
    setOcupado(true);
    setErro("");
    try {
      await redePerfil.decidir(p.id, aceitar);
      setLista((l) => (l ?? []).filter((x) => x.id !== p.id));
      aoMudou();
    } catch (e) {
      setErro(textoDoErro(s, e));
    } finally {
      setOcupado(false);
    }
  }
  return (
    <section className={caixa} aria-labelledby="perfil-pedidos">
      <h2 id="perfil-pedidos" className="font-serif text-lg font-semibold">{sp.editar.pedidosTitulo}</h2>
      {lista === null ? (
        <p className="mt-2 text-sm text-ink-soft" role="status">{s.estados.carregando}</p>
      ) : lista.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">{sp.editar.pedidosVazio}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {lista.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rule bg-folha px-3 py-2">
              <span className="flex min-w-0 items-center gap-2">
                <Avatar usuario={p.id} codinome={p.codinome} tamanho={32} />
                <span className="min-w-0">
                  <span className="font-bold">{p.codinome}</span>
                  {p.handle && <span className="ml-1 text-sm text-ink-soft">@{p.handle}</span>}
                </span>
              </span>
              <span className="flex gap-2">
                <button type="button" disabled={ocupado} onClick={() => void decidir(p, true)} className={botaoCheio}>
                  {sp.editar.aceitar}
                </button>
                <button type="button" disabled={ocupado} onClick={() => void decidir(p, false)} className={botaoVazado}>
                  {sp.editar.recusar}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {erro && <p role="alert" className="mt-2 text-sm text-oxblood">{erro}</p>}
    </section>
  );
}

function BlocoFila({ sp, s }: { sp: TextosDoPerfil; s: TextosDaRede }) {
  const [fila, setFila] = useState<ImagemNaFila[] | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    let vivo = true;
    redePerfil
      .fila()
      .then((l) => vivo && setFila(l))
      .catch((e) => vivo && (setErro(textoDoErro(s, e)), setFila([])));
    return () => {
      vivo = false;
    };
  }, [s]);
  async function decidir(x: ImagemNaFila, aceitar: boolean) {
    setOcupado(true);
    setErro("");
    try {
      await redePerfil.decidirImagem(x.usuario, x.tipo, aceitar);
      setFila((l) => (l ?? []).filter((y) => !(y.usuario === x.usuario && y.tipo === x.tipo)));
    } catch (e) {
      setErro(textoDoErro(s, e));
    } finally {
      setOcupado(false);
    }
  }
  return (
    <section className={caixa} aria-labelledby="perfil-fila">
      <h2 id="perfil-fila" className="font-serif text-lg font-semibold">{sp.editar.filaTitulo}</h2>
      {fila === null ? (
        <p className="mt-2 text-sm text-ink-soft" role="status">{s.estados.carregando}</p>
      ) : fila.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">{sp.editar.filaVazia}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {fila.map((x) => (
            <li key={`${x.usuario}:${x.tipo}`} className="flex flex-wrap items-center gap-3 rounded-lg border border-rule bg-folha px-3 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- imagem já reencodada em WebP, em data URL. */}
              <img src={x.dados} alt="" aria-hidden className={x.tipo === "avatar" ? "h-16 w-16 rounded-full object-cover" : "aspect-[3/1] w-40 rounded object-cover"} />
              <span className="min-w-0 flex-1 text-sm">{x.codinome}</span>
              <button type="button" disabled={ocupado} onClick={() => void decidir(x, true)} className={botaoCheio}>
                {sp.editar.aceitarImagem}
              </button>
              <button type="button" disabled={ocupado} onClick={() => void decidir(x, false)} className={botaoVazado}>
                {sp.editar.recusarImagem}
              </button>
            </li>
          ))}
        </ul>
      )}
      {erro && <p role="alert" className="mt-2 text-sm text-oxblood">{erro}</p>}
    </section>
  );
}
