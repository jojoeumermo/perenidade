// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { Botao } from "@/components/rede/ui/Botao";
import { Pilula } from "@/components/rede/ui/Pilula";
import { getClient, rpc } from "@/lib/backend";
import type { AvisoFixado, ComunidadeNoPainel, MidiaNoPainel, PostNoPainel, StoryNoPainel } from "@/lib/rede/painel/tipos";
import { Campo, Estado, Etiqueta, falta, Fita, motivoDe, quando, Quadro, textoDoErroDaAlumia, Titulo, useDado, useJanela, usePainelDaAlumia } from "./pecas";

type Parte = "posts" | "stories" | "midias" | "aviso";

interface Filtros {
  busca: string;
  comunidade: string;
  pessoa: string;
  de: string;
  ate: string;
  estado: string;
  tipo: string;
  pagina: number;
}

const ESTADOS = [
  { id: "todos", nome: "Todos" },
  { id: "denunciados", nome: "Denunciados" },
  { id: "visiveis", nome: "No ar" },
  { id: "ocultos", nome: "Ocultos" },
  { id: "retidos", nome: "Retidos (esperando leitura)" },
  { id: "lixeira", nome: "Lixeira" },
];

/** O arquivo de um story ou a imagem de um post, por um endereço assinado de 2 minutos que o servidor só dá a quem tem o painel. */
async function abrirArquivo(tipo: "story" | "post", caminho: string): Promise<string> {
  const supabase = await getClient();
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) throw new Error("sem sessão");
  const r = await fetch("/api/alumia/painel/midia", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ tipo, caminho }),
    cache: "no-store",
  });
  const dado = r.ok ? ((await r.json().catch(() => null)) as { url?: string } | null) : null;
  if (!dado?.url) throw new Error("arquivo");
  return dado.url;
}

function Arquivo({ tipo, caminho, alt, story }: { tipo: "story" | "post"; caminho: string; alt: string; story?: boolean }) {
  const [estado, setEstado] = useState<{ url: string; erro: boolean; ocupado: boolean }>({ url: "", erro: false, ocupado: false });
  const video = /\.(mp4|webm)$/.test(caminho);
  const abrir = async () => {
    setEstado({ url: "", erro: false, ocupado: true });
    try {
      setEstado({ url: await abrirArquivo(tipo, caminho), erro: false, ocupado: false });
    } catch {
      setEstado({ url: "", erro: true, ocupado: false });
    }
  };
  return (
    <div className="ap-ficha-quadro" data-story={story ? "" : undefined}>
      {estado.url ? (
        video ? (
          <video src={estado.url} controls playsInline preload="metadata" aria-label={alt} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- endereço assinado de 2 minutos, de depósito privado: não passa pelo otimizador
          <img src={estado.url} alt={alt} referrerPolicy="no-referrer" />
        )
      ) : (
        <div className="ap-tela" style={{ gap: "0.4rem", justifyItems: "center" }}>
          <Botao variante="contorno" tamanho="p" disabled={estado.ocupado} onClick={() => void abrir()}>
            {estado.ocupado ? "Abrindo…" : video ? "Abrir o vídeo" : "Abrir a imagem"}
          </Botao>
          {estado.erro ? <span>Não abriu. O arquivo pode já ter saído do depósito.</span> : null}
        </div>
      )}
    </div>
  );
}

function Posts() {
  const { foco, ir } = usePainelDaAlumia();
  const inicial: Filtros = { busca: "", comunidade: "", pessoa: foco?.startsWith("@") ? foco : "", de: "", ate: "", estado: foco === "lixeira" ? "lixeira" : foco === "denunciados" ? "denunciados" : "todos", tipo: "todos", pagina: 0 };
  const [rascunho, setRascunho] = useState<Filtros>(inicial);
  const [filtros, setFiltros] = useState<Filtros>(inicial);
  const leitura = useDado<{ itens: PostNoPainel[]; mais: boolean }>("alumia_painel_posts", { p: filtros });
  const comunidades = useDado<ComunidadeNoPainel[]>("alumia_painel_comunidades");
  const { pedir, janela } = useJanela();
  const itens = leitura.dados?.itens ?? [];
  const mudar = (parte: Partial<Filtros>) => setRascunho((r) => ({ ...r, ...parte }));

  const agir = (p: PostNoPainel, acao: "ocultar" | "mostrar" | "apagar" | "restaurar") => {
    const oQue = p.resposta ? "a resposta" : "o post";
    const textos = {
      ocultar: { titulo: `Ocultar ${oQue}`, texto: `Some para todo mundo, menos para quem escreveu. Não é apagado: volta com “Mostrar de novo”.`, confirmar: "Ocultar", sucesso: "Ocultado. O autor foi avisado." },
      mostrar: { titulo: `Mostrar ${oQue} de novo`, texto: "Volta ao ar como estava.", confirmar: "Mostrar de novo", sucesso: "De volta ao ar." },
      apagar: { titulo: `Apagar ${oQue}`, texto: "Vai para a lixeira: some para todos e pode ser restaurado por 30 dias. Depois disso o texto e as imagens são apagados de vez, sem cópia.", confirmar: "Apagar", sucesso: "Na lixeira por 30 dias. O autor foi avisado." },
      restaurar: { titulo: `Restaurar ${oQue}`, texto: "Sai da lixeira e volta ao estado em que estava antes de ser apagado.", confirmar: "Restaurar", sucesso: "Restaurado." },
    }[acao];
    pedir({
      titulo: textos.titulo,
      texto: (
        <>
          <p>{textos.texto}</p>
          <p className="ap-miudo ap-quebra">
            {p.autor}: “{p.trecho.slice(0, 160)}
            {p.trecho.length > 160 ? "…" : ""}”
          </p>
        </>
      ),
      campos: [{ tipo: "motivo", aviso: acao === "ocultar" || acao === "apagar" ? "O autor lê este motivo e pode recorrer em até 30 dias." : undefined }],
      confirmar: textos.confirmar,
      perigo: acao === "ocultar" || acao === "apagar",
      fazer: (v) => rpc("alumia_painel_post_agir", { p_id: p.id, p_acao: acao, p_motivo: motivoDe(v) }),
      sucesso: textos.sucesso,
      depois: leitura.recarregar,
    });
  };

  return (
    <>
      <Quadro>
        <form
          className="ap-filtros"
          onSubmit={(e) => {
            e.preventDefault();
            setFiltros({ ...rascunho, pagina: 0 });
          }}
        >
          <Campo rotulo="Palavra no texto ou no título" largo>
            <input className="ap-entrada" value={rascunho.busca} maxLength={80} onChange={(e) => mudar({ busca: e.target.value })} />
          </Campo>
          <Campo rotulo="Pessoa (@ ou codinome exato)">
            <input className="ap-entrada" value={rascunho.pessoa} maxLength={60} onChange={(e) => mudar({ pessoa: e.target.value })} placeholder="@faisca" />
          </Campo>
          <Campo rotulo="Comunidade">
            <select className="ap-entrada" value={rascunho.comunidade} onChange={(e) => mudar({ comunidade: e.target.value })}>
              <option value="">Todas</option>
              {(comunidades.dados ?? []).map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Situação">
            <select className="ap-entrada" value={rascunho.estado} onChange={(e) => mudar({ estado: e.target.value })}>
              {ESTADOS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Tipo">
            <select className="ap-entrada" value={rascunho.tipo} onChange={(e) => mudar({ tipo: e.target.value })}>
              <option value="todos">Posts e respostas</option>
              <option value="posts">Só posts</option>
              <option value="respostas">Só respostas</option>
            </select>
          </Campo>
          <Campo rotulo="De">
            <input className="ap-entrada" type="date" value={rascunho.de} onChange={(e) => mudar({ de: e.target.value })} />
          </Campo>
          <Campo rotulo="Até">
            <input className="ap-entrada" type="date" value={rascunho.ate} onChange={(e) => mudar({ ate: e.target.value })} />
          </Campo>
          <Botao type="submit" variante="claro">
            Buscar
          </Botao>
        </form>
        <p className="ap-miudo">Post de núcleo e de espaço fechado não aparece nesta busca: a equipe geral só os abre a partir de uma denúncia, com o acesso registrado e a mediação do núcleo avisada.</p>
      </Quadro>

      <Estado leitura={leitura} eVazio={Boolean(leitura.dados) && itens.length === 0} vazio="Nenhum post com esses filtros." />

      {itens.length > 0 ? (
        <Quadro>
          <ul className="ap-lista">
            {itens.map((p) => (
              <li key={p.id} className="ap-linha">
                <span className="ap-linha-texto">
                  <span className="ap-linha-cabeca">
                    <span className="ap-forte">{p.autor}</span>
                    <span className="ap-miudo">{quando(p.criado_em)}</span>
                    {p.comunidade ? <Pilula texto={p.comunidade} slug={p.comunidade} /> : null}
                    {p.resposta ? <Etiqueta>resposta</Etiqueta> : null}
                    {p.denuncias > 0 ? <Etiqueta tom="vermelho">{p.denuncias === 1 ? "1 denúncia aberta" : `${p.denuncias} denúncias abertas`}</Etiqueta> : null}
                    {p.lixeira ? <Etiqueta tom="dourado">lixeira · some de vez {falta(p.lixeira.ate)}</Etiqueta> : p.retido ? <Etiqueta tom="dourado">retido</Etiqueta> : p.oculto ? <Etiqueta tom="dourado">oculto</Etiqueta> : null}
                    {p.travado ? <Etiqueta>conversa travada</Etiqueta> : null}
                    {p.midias > 0 ? <Etiqueta>{p.midias === 1 ? "1 imagem" : `${p.midias} imagens`}</Etiqueta> : null}
                  </span>
                  {p.titulo ? <span className="ap-forte">{p.titulo}</span> : null}
                  <span className="ap-quebra">{p.trecho}</span>
                  {p.lixeira ? <span className="ap-miudo ap-quebra">Apagado em {quando(p.lixeira.em)}: {p.lixeira.motivo}</span> : p.oculto && p.motivo ? <span className="ap-miudo ap-quebra">Motivo: {p.motivo}</span> : null}
                </span>
                <span className="ap-linha-acoes">
                  {p.lixeira ? (
                    <Botao variante="claro" tamanho="p" onClick={() => agir(p, "restaurar")}>
                      Restaurar
                    </Botao>
                  ) : (
                    <>
                      {p.oculto || p.retido ? (
                        <Botao variante="contorno" tamanho="p" onClick={() => agir(p, "mostrar")}>
                          Mostrar de novo
                        </Botao>
                      ) : (
                        <Botao variante="contorno" tamanho="p" onClick={() => agir(p, "ocultar")}>
                          Ocultar
                        </Botao>
                      )}
                      <Botao variante="contorno" className="ap-destrutivo" tamanho="p" onClick={() => agir(p, "apagar")}>
                        Apagar
                      </Botao>
                    </>
                  )}
                  {p.autor_id ? (
                    <Botao variante="fantasma" tamanho="p" onClick={() => ir("pessoas", p.autor_id ?? undefined)}>
                      Ficha
                    </Botao>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          <div className="ap-linha-acoes">
            {filtros.pagina > 0 ? (
              <Botao variante="contorno" tamanho="p" onClick={() => setFiltros((f) => ({ ...f, pagina: f.pagina - 1 }))}>
                Mais novos
              </Botao>
            ) : null}
            {leitura.dados?.mais ? (
              <Botao variante="contorno" tamanho="p" onClick={() => setFiltros((f) => ({ ...f, pagina: f.pagina + 1 }))}>
                Mais antigos
              </Botao>
            ) : null}
          </div>
        </Quadro>
      ) : null}
      {janela}
    </>
  );
}

function Stories() {
  const [retidos, setRetidos] = useState(false);
  const [pessoa, setPessoa] = useState("");
  const [buscada, setBuscada] = useState("");
  const leitura = useDado<StoryNoPainel[]>("alumia_painel_stories", { p: { pessoa: buscada, retidos } });
  const { pedir, janela } = useJanela();
  const itens = leitura.dados ?? [];
  const agir = (s: StoryNoPainel, acao: "reter" | "liberar" | "apagar") => {
    const textos = {
      reter: { titulo: "Reter o story", texto: "Some para todo mundo, menos para quem postou. Dá para liberar depois.", confirmar: "Reter", sucesso: "Story retido." },
      liberar: { titulo: "Liberar o story", texto: "Volta a aparecer para quem podia ver, até completar as 24 horas.", confirmar: "Liberar", sucesso: "Story liberado." },
      apagar: { titulo: "Apagar o story", texto: "Sai de vez, com as respostas e reações. Story não tem lixeira: ele já some sozinho em 24 horas.", confirmar: "Apagar de vez", sucesso: "Story apagado." },
    }[acao];
    pedir({
      titulo: textos.titulo,
      texto: (
        <p>
          {textos.texto} Story de <strong>{s.autor}</strong>.
        </p>
      ),
      campos: [{ tipo: "motivo", aviso: acao === "liberar" ? undefined : "Quem postou lê este motivo." }],
      confirmar: textos.confirmar,
      perigo: acao !== "liberar",
      fazer: (v) => rpc("alumia_painel_story_agir", { p_id: s.id, p_acao: acao, p_motivo: motivoDe(v) }),
      sucesso: textos.sucesso,
      depois: leitura.recarregar,
    });
  };
  return (
    <>
      <form
        className="ap-filtros"
        onSubmit={(e) => {
          e.preventDefault();
          setBuscada(pessoa.trim());
        }}
      >
        <Campo rotulo="Pessoa (@ ou codinome exato)">
          <input className="ap-entrada" value={pessoa} maxLength={60} onChange={(e) => setPessoa(e.target.value)} placeholder="@faisca" />
        </Campo>
        <Botao type="submit" variante="contorno">
          Filtrar
        </Botao>
        <label className="ap-marcar" style={{ alignSelf: "center" }}>
          <input type="checkbox" checked={retidos} onChange={(e) => setRetidos(e.target.checked)} />
          <span>Só os retidos</span>
        </label>
      </form>
      <Estado leitura={leitura} eVazio={Boolean(leitura.dados) && itens.length === 0} vazio="Nenhum story no ar agora." />
      {itens.length > 0 ? (
        <div className="ap-grade">
          {itens.map((s) => (
            <article key={s.id} className="ap-ficha">
              {s.caminho ? (
                <Arquivo tipo="story" caminho={s.caminho} alt={s.alt ?? `Story de ${s.autor}`} story />
              ) : (
                <div className="ap-ficha-quadro ap-quebra" data-story="" style={{ color: "var(--al-texto)" }}>
                  {s.texto ?? "(sem texto)"}
                </div>
              )}
              <span className="ap-linha-cabeca">
                <span className="ap-forte">{s.autor}</span>
                {s.retido ? <Etiqueta tom="dourado">retido</Etiqueta> : null}
              </span>
              {s.caminho && (s.texto || s.legenda) ? <span className="ap-quebra">{s.legenda ?? s.texto}</span> : null}
              <span className="ap-miudo">
                {quando(s.criado_em)} · some {falta(s.expira_em)} · {s.publico}
              </span>
              <span className="ap-linha-acoes" style={{ justifyContent: "flex-start" }}>
                <Botao variante="contorno" tamanho="p" onClick={() => agir(s, s.retido ? "liberar" : "reter")}>
                  {s.retido ? "Liberar" : "Reter"}
                </Botao>
                <Botao variante="contorno" className="ap-destrutivo" tamanho="p" onClick={() => agir(s, "apagar")}>
                  Apagar
                </Botao>
              </span>
            </article>
          ))}
        </div>
      ) : null}
      {janela}
    </>
  );
}

function Midias() {
  const [pessoa, setPessoa] = useState("");
  const [filtro, setFiltro] = useState({ pessoa: "", pagina: 0 });
  const leitura = useDado<{ itens: MidiaNoPainel[]; mais: boolean }>("alumia_painel_midias", { p: filtro });
  const { pedir, janela } = useJanela();
  const itens = leitura.dados?.itens ?? [];
  const apagar = (m: MidiaNoPainel) =>
    pedir({
      titulo: "Apagar a imagem",
      texto: (
        <p>
          Só esta imagem sai; o post de <strong>{m.autor}</strong> continua. Não tem volta: o arquivo sai do depósito na faxina.
        </p>
      ),
      campos: [{ tipo: "motivo", aviso: "O autor lê este motivo." }],
      confirmar: "Apagar a imagem",
      perigo: true,
      fazer: (v) => rpc("alumia_painel_midia_apagar", { p_id: m.id, p_motivo: motivoDe(v) }),
      sucesso: "Imagem apagada.",
      depois: leitura.recarregar,
    });
  return (
    <>
      <form
        className="ap-filtros"
        onSubmit={(e) => {
          e.preventDefault();
          setFiltro({ pessoa: pessoa.trim(), pagina: 0 });
        }}
      >
        <Campo rotulo="Pessoa (@ ou codinome exato)">
          <input className="ap-entrada" value={pessoa} maxLength={60} onChange={(e) => setPessoa(e.target.value)} placeholder="@faisca" />
        </Campo>
        <Botao type="submit" variante="contorno">
          Filtrar
        </Botao>
      </form>
      <p className="ap-miudo">As imagens moram num depósito privado. Cada uma só é baixada quando você pede para abrir, por um endereço que vale 2 minutos.</p>
      <Estado leitura={leitura} eVazio={Boolean(leitura.dados) && itens.length === 0} vazio="Nenhuma imagem em post." />
      {itens.length > 0 ? (
        <div className="ap-grade">
          {itens.map((m) => (
            <article key={m.id} className="ap-ficha">
              <Arquivo tipo="post" caminho={m.caminho} alt={m.alt ?? `Imagem de um post de ${m.autor}`} />
              <span className="ap-linha-cabeca">
                <span className="ap-forte">{m.autor}</span>
                {m.oculto ? <Etiqueta tom="dourado">post oculto</Etiqueta> : null}
              </span>
              {m.alt ? <span className="ap-miudo ap-quebra">Descrição: {m.alt}</span> : null}
              <span className="ap-quebra ap-miudo">{m.trecho}</span>
              <span className="ap-miudo">{quando(m.criado_em)}</span>
              <span className="ap-linha-acoes" style={{ justifyContent: "flex-start" }}>
                <Botao variante="contorno" className="ap-destrutivo" tamanho="p" onClick={() => apagar(m)}>
                  Apagar a imagem
                </Botao>
              </span>
            </article>
          ))}
        </div>
      ) : null}
      <div className="ap-linha-acoes">
        {filtro.pagina > 0 ? (
          <Botao variante="contorno" tamanho="p" onClick={() => setFiltro((f) => ({ ...f, pagina: f.pagina - 1 }))}>
            Mais novas
          </Botao>
        ) : null}
        {leitura.dados?.mais ? (
          <Botao variante="contorno" tamanho="p" onClick={() => setFiltro((f) => ({ ...f, pagina: f.pagina + 1 }))}>
            Mais antigas
          </Botao>
        ) : null}
      </div>
      {janela}
    </>
  );
}

function AvisoNoAlto() {
  const leitura = useDado<AvisoFixado[]>("alumia_painel_avisos");
  const { atualizar } = usePainelDaAlumia();
  const [texto, setTexto] = useState("");
  const [link, setLink] = useState("");
  const [prazo, setPrazo] = useState(7);
  const [estado, setEstado] = useState({ ocupado: false, erro: "" });
  const itens = leitura.dados ?? [];
  const ativos = itens.filter((a) => a.ativo).length;

  async function fixar() {
    setEstado({ ocupado: true, erro: "" });
    try {
      await rpc("alumia_painel_aviso_fixar", { p_texto: texto.trim(), p_link: link.trim(), p_dias: prazo });
      setTexto("");
      setLink("");
      setEstado({ ocupado: false, erro: "" });
      leitura.recarregar();
      atualizar();
    } catch (erro) {
      setEstado({ ocupado: false, erro: textoDoErroDaAlumia(erro) });
    }
  }
  async function tirar(a: AvisoFixado) {
    try {
      await rpc("alumia_painel_aviso_tirar", { p_id: a.id });
      leitura.recarregar();
      atualizar();
    } catch (erro) {
      setEstado({ ocupado: false, erro: textoDoErroDaAlumia(erro) });
    }
  }

  return (
    <div className="ap-duas">
      <Quadro titulo="Fixar um aviso" tom="dourado">
        <p className="ap-sobre">O aviso aparece no alto da Alumia para todo mundo que entra, até o prazo acabar. No máximo 3 de cada vez. Quem fixou não aparece na rede, só no registro.</p>
        <form
          className="ap-tela"
          style={{ gap: "0.75rem" }}
          onSubmit={(e) => {
            e.preventDefault();
            void fixar();
          }}
        >
          <Campo rotulo={`Texto (de 5 a 280 letras) · ${texto.trim().length}/280`}>
            <textarea className="ap-entrada" rows={3} maxLength={280} value={texto} onChange={(e) => setTexto(e.target.value)} />
          </Campo>
          <Campo rotulo="Link de dentro do site (opcional, começa com /)">
            <input className="ap-entrada" value={link} maxLength={200} onChange={(e) => setLink(e.target.value)} placeholder="/alumia/atos" />
          </Campo>
          <Campo rotulo="Fica por quantos dias (de 1 a 30)">
            <input className="ap-entrada" type="number" min={1} max={30} value={prazo} onChange={(e) => setPrazo(Math.trunc(Number(e.target.value)))} />
          </Campo>
          {estado.erro ? (
            <p role="alert" className="ap-janela-erro">
              {estado.erro}
            </p>
          ) : null}
          <div>
            <Botao type="submit" variante="dourado" disabled={estado.ocupado || texto.trim().length < 5 || ativos >= 3 || !(prazo >= 1 && prazo <= 30) || (link.trim() !== "" && !link.trim().startsWith("/"))}>
              {ativos >= 3 ? "Já há 3 avisos no alto" : "Fixar no alto da Alumia"}
            </Botao>
          </div>
        </form>
      </Quadro>
      <Quadro titulo="Avisos">
        <Estado leitura={leitura} eVazio={Boolean(leitura.dados) && itens.length === 0} vazio="Nenhum aviso fixado até hoje." />
        <ul className="ap-lista">
          {itens.map((a) => (
            <li key={a.id} className="ap-linha">
              <span className="ap-linha-texto">
                <span className="ap-linha-cabeca">
                  <Etiqueta tom={a.ativo ? "papel" : undefined}>{a.ativo ? `no alto · sai ${falta(a.ate)}` : "retirado"}</Etiqueta>
                  <span className="ap-miudo">
                    {quando(a.de)}
                    {a.por ? ` · por ${a.por}` : ""}
                  </span>
                </span>
                <span className="ap-quebra">{a.texto}</span>
                {a.link ? <span className="ap-miudo">{a.link}</span> : null}
              </span>
              <span className="ap-linha-acoes">
                {a.ativo ? (
                  <Botao variante="contorno" tamanho="p" onClick={() => void tirar(a)}>
                    Tirar
                  </Botao>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </Quadro>
    </div>
  );
}

/** Posts e respostas, stories, imagens e o aviso fixado no alto da Alumia. */
export function Conteudo() {
  const { foco } = usePainelDaAlumia();
  const [parte, setParte] = useState<Parte>(foco === "aviso" ? "aviso" : "posts");
  return (
    <div className="ap-tela">
      <Titulo nome="Posts e mídias" sobre="Buscar, ocultar, apagar e restaurar. Ocultar esconde e se desfaz a qualquer hora; apagar manda para a lixeira por 30 dias. O autor é sempre avisado com o motivo e pode recorrer." />
      <Fita
        rotulo="Parte"
        atual={parte}
        escolher={setParte}
        opcoes={[
          { id: "posts", nome: "Posts e respostas" },
          { id: "stories", nome: "Stories" },
          { id: "midias", nome: "Imagens" },
          { id: "aviso", nome: "Aviso no alto" },
        ]}
      />
      {parte === "posts" && <Posts />}
      {parte === "stories" && <Stories />}
      {parte === "midias" && <Midias />}
      {parte === "aviso" && <AvisoNoAlto />}
    </div>
  );
}
