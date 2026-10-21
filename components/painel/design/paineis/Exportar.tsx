// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useMemo, useState } from "react";
import { rpc } from "@/lib/backend";
import { sendFile } from "@/lib/upload";
import { textoDoErro } from "../../comum";
import { conferirProjeto, creditosDo } from "../conferir";
import { baixarArquivo, baixarFormatos, baixarImagens, comPagina, EXTENSAO, gravarVideo, type OpcoesDeImagem, pacoteDaCampanha, pdfDaGrafica, separacaoDeCores, tipoDeVideo, type TipoDeImagem } from "../exportacao";
import { Icone } from "../Icone";
import { adaptar, exportar, formatoDe, formatoPorMedida, type FormatoId, FORMATOS, nomeDeArquivo } from "../motor";
import { BOTAO, BOTAO_PRIMARIO, Chave, Dialogo, Faixa, ItemDeMenu, Menu, Miniatura, ROTULO, useEditor } from "../ui";

/** O menu do botão Baixar: o que mais se usa, e "Mais opções" para o resto. */
export function MenuBaixar({ aberto, fechar }: { aberto: boolean; fechar: () => void }) {
  const ed = useEditor();
  const varias = ed.projeto.paginas.length > 1;
  const rapido = async (tipo: TipoDeImagem, todas = false) => {
    fechar();
    try {
      ed.progresso(0.1, "Exportando");
      await baixarImagens(ed.projeto, ed.titulo, { tipo, qualidade: 0.92, escala: 1 }, todas ? ed.projeto.paginas.map((_, i) => i) : [ed.pagina], ed.vars, (f) => ed.progresso(f, "Exportando"));
      ed.avisar(todas ? "Carrossel baixado (.zip numerado)." : "Imagem baixada.");
    } catch {
      ed.avisar("Não deu para exportar.", "erro");
    } finally {
      ed.progresso(null);
    }
  };
  return (
    <Menu aberto={aberto} fechar={fechar} alinhar="direita" className="w-72">
      <p className={`${ROTULO} px-2.5 pt-1 pb-1.5`}>Esta página</p>
      <ItemDeMenu icone="imagens" rotulo="PNG" onClick={() => void rapido("png")} />
      <ItemDeMenu icone="textura" rotulo="PNG transparente (sem fundo)" onClick={() => void rapido("png-transparente")} />
      <ItemDeMenu icone="imagens" rotulo="JPG" onClick={() => void rapido("jpeg")} />
      {varias && (
        <>
          <p className={`${ROTULO} px-2.5 pt-2 pb-1.5`}>Carrossel ({ed.projeto.paginas.length} páginas)</p>
          <ItemDeMenu icone="zip" rotulo="Todas as páginas (.zip numerado)" onClick={() => void rapido("png", true)} />
        </>
      )}
      <div className="my-1 border-t border-e-fio" />
      <ItemDeMenu icone="ajustes" rotulo="Mais opções: formatos, gráfica, vídeo…" atalho="Ctrl+E" onClick={() => { fechar(); ed.setJanela("baixar"); }} />
      <ItemDeMenu icone="copiar" rotulo="Copiar a legenda" onClick={() => { fechar(); void copiarLegenda(ed); }} />
    </Menu>
  );
}

async function copiarLegenda(ed: ReturnType<typeof useEditor>) {
  const creditos = creditosDo(ed.projeto);
  const texto = `${ed.projeto.legenda.trim()}${creditos.length ? `\n\nCréditos das imagens: ${creditos.join(" · ")}` : ""}`;
  try {
    await navigator.clipboard.writeText(texto);
    ed.avisar("Legenda copiada.");
  } catch {
    ed.avisar("O navegador não deixou copiar: selecione o texto da legenda e copie.", "erro");
  }
}

type Aba = "imagem" | "formatos" | "grafica" | "pacote" | "video" | "site";

/** A janela de exportação: tudo o que sai do estúdio, com a conferência antes. */
export function JanelaBaixar({ fechar }: { fechar: () => void }) {
  const ed = useEditor();
  const [aba, setAba] = useState<Aba>("imagem");
  const [tipo, setTipo] = useState<TipoDeImagem>("png");
  const [qualidade, setQualidade] = useState(0.9);
  const [escala, setEscala] = useState(1);
  const [todas, setTodas] = useState(ed.projeto.paginas.length > 1);
  const [formatos, setFormatos] = useState<FormatoId[]>(["post", "story", "quadrado"]);
  const [sangria, setSangria] = useState(3);
  const [marcas, setMarcas] = useState(true);
  const [segundos, setSegundos] = useState(ed.projeto.duracao);
  const [ocupado, setOcupado] = useState(false);
  const [nomeNoSite, setNomeNoSite] = useState(ed.titulo);
  const problemas = useMemo(() => conferirProjeto(ed.projeto), [ed.projeto]);
  const erros = problemas.filter((p) => p.nivel === "erro");
  const avisos = problemas.filter((p) => p.nivel === "aviso");
  const opcoes: OpcoesDeImagem = { tipo, qualidade, escala };
  const impresso = Boolean(formatoPorMedida(ed.doc.w, ed.doc.h)?.mm);
  const video = tipoDeVideo();
  const temAnimacao = ed.doc.camadas.some((c) => c.anim);

  const fazer = async (rotulo: string, f: () => Promise<void>) => {
    setOcupado(true);
    try {
      ed.progresso(0.05, rotulo);
      await f();
    } catch (erro) {
      ed.avisar(`${rotulo}: ${erro instanceof Error && erro.message === "video" ? "este navegador não grava vídeo" : textoDoErro(erro)}`, "erro");
    } finally {
      ed.progresso(null);
      setOcupado(false);
    }
  };
  const andamento = (rotulo: string) => (f: number) => ed.progresso(f, rotulo);
  const abas: [Aba, string][] = [
    ["imagem", "Imagem"],
    ["formatos", "Formatos"],
    ["grafica", "Gráfica"],
    ["pacote", "Pacote da campanha"],
    ["video", "Vídeo"],
    ["site", "No site"],
  ];

  return (
    <Dialogo titulo="Baixar" fechar={fechar} largura="max-w-4xl">
      {(erros.length > 0 || avisos.length > 0) && (
        <div className={`mb-4 flex items-start gap-3 rounded-lg border p-3 text-sm ${erros.length ? "border-[#c21f16] bg-[#c21f16]/8" : "border-e-ouro bg-e-ouro/10"}`} role="status">
          <Icone nome="alerta" className={`mt-0.5 h-5 w-5 ${erros.length ? "text-[#c21f16]" : "text-e-ouro"}`} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{erros.length ? `${erros.length} problema(s) para resolver antes de postar` : `${avisos.length} ponto(s) para conferir`}</p>
            <ul className="mt-1 list-disc pl-4 text-e-suave">
              {[...erros, ...avisos].slice(0, 4).map((p, i) => (
                <li key={i}>
                  {p.pagina >= 0 && ed.projeto.paginas.length > 1 ? `Página ${p.pagina + 1}: ` : ""}
                  {p.mensagem}
                </li>
              ))}
            </ul>
          </div>
          <button type="button" className={BOTAO} onClick={() => ed.setJanela("conferir")}>Ver tudo</button>
        </div>
      )}
      <div role="tablist" className="mb-4 flex flex-wrap gap-1 border-b border-e-fio">
        {abas.map(([id, nome]) => (
          <button key={id} type="button" role="tab" aria-selected={aba === id} onClick={() => setAba(id)} className={`-mb-px cursor-pointer border-b-2 px-3 py-2 text-sm ${aba === id ? "border-e-bordo font-semibold text-e-bordo" : "border-transparent text-e-suave hover:text-e-tinta"}`}>
            {nome}
          </button>
        ))}
      </div>

      {aba === "imagem" && (
        <div className="grid gap-5 md:grid-cols-[1fr_16rem]">
          <div className="space-y-4">
            <fieldset>
              <legend className={ROTULO}>Tipo de arquivo</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(
                  [
                    ["png", "PNG", "Melhor qualidade, para posts."],
                    ["png-transparente", "PNG transparente", "Sem o fundo: para pôr sobre outra coisa."],
                    ["jpeg", "JPG", "Arquivo menor; escolha a qualidade."],
                    ["webp", "WebP", "Menor ainda, para o site."],
                  ] as [TipoDeImagem, string, string][]
                ).map(([id, nome, dica]) => (
                  <label key={id} className={`cursor-pointer rounded-lg border p-3 text-sm ${tipo === id ? "border-e-bordo bg-e-bordo-claro" : "border-e-fio"}`}>
                    <input type="radio" name="tipo" className="sr-only" checked={tipo === id} onChange={() => setTipo(id)} />
                    <span className="block font-semibold">{nome}</span>
                    <span className="text-xs text-e-suave">{dica}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {(tipo === "jpeg" || tipo === "webp") && <Faixa rotulo="Qualidade" valor={Math.round(qualidade * 100)} min={50} max={100} sufixo="%" mudar={(v) => setQualidade(v / 100)} />}
            <fieldset>
              <legend className={ROTULO}>Tamanho</legend>
              <div className="mt-2 flex gap-2">
                {[1, 2].map((e) => (
                  <button key={e} type="button" className={`${BOTAO} ${escala === e ? "border-e-bordo text-e-bordo" : ""}`} onClick={() => setEscala(e)}>
                    {e}× ({ed.doc.w * e} × {ed.doc.h * e})
                  </button>
                ))}
              </div>
            </fieldset>
            {ed.projeto.paginas.length > 1 && <Chave rotulo={`Todas as ${ed.projeto.paginas.length} páginas, num .zip numerado (01, 02, 03…)`} ligado={todas} mudar={setTodas} />}
          </div>
          <div className="space-y-3">
            <Miniatura doc={ed.doc} largura={240} className="rounded border border-e-fio" />
            <button type="button" className={`${BOTAO_PRIMARIO} w-full`} disabled={ocupado} onClick={() => void fazer("Exportando", async () => {
              await baixarImagens(ed.projeto, ed.titulo, opcoes, todas ? ed.projeto.paginas.map((_, i) => i) : [ed.pagina], ed.vars, andamento("Exportando"));
              ed.avisar("Pronto.");
            })}>
              <Icone nome="baixar" className="h-4 w-4" /> Baixar {EXTENSAO[tipo].toUpperCase()}
            </button>
          </div>
        </div>
      )}

      {aba === "formatos" && (
        <div className="space-y-4">
          <p className="text-sm text-e-suave">A mesma arte em vários formatos, lado a lado. As camadas se reposicionam sozinhas; confira cada um antes de baixar (o texto pode quebrar em outro lugar).</p>
          <div className="flex flex-wrap gap-4">
            {FORMATOS.filter((f) => f.grupo === "Instagram" || f.id === "banner" || f.id === "video").map((f) => {
              const marcado = formatos.includes(f.id);
              const versao = ed.doc.w === f.w && ed.doc.h === f.h ? ed.doc : adaptar(ed.doc, f.w, f.h);
              return (
                <label key={f.id} className={`w-36 cursor-pointer rounded-lg border p-2 text-sm ${marcado ? "border-e-bordo bg-e-bordo-claro" : "border-e-fio"}`}>
                  <input type="checkbox" className="sr-only" checked={marcado} onChange={() => setFormatos((l) => (marcado ? l.filter((x) => x !== f.id) : [...l, f.id]))} />
                  <span className="flex h-40 items-center justify-center">
                    <Miniatura doc={versao} largura={Math.min(128, (160 * f.w) / f.h)} className="border border-black/10" />
                  </span>
                  <span className="mt-1 flex items-center gap-1 font-semibold">
                    {marcado && <Icone nome="check" className="h-4 w-4 text-e-bordo" />}
                    {f.curto}
                  </span>
                  <span className="text-xs text-e-suave">{f.w} × {f.h}</span>
                </label>
              );
            })}
          </div>
          <button type="button" className={BOTAO_PRIMARIO} disabled={ocupado || !formatos.length} onClick={() => void fazer("Formatos", async () => {
            await baixarFormatos(ed.projeto, ed.titulo, formatos, { tipo: "png", qualidade: 0.92, escala: 1 }, ed.vars, andamento("Formatos"));
            ed.avisar("Formatos baixados (.zip).");
          })}>
            <Icone nome="zip" className="h-4 w-4" /> Baixar {formatos.length} formato(s) em .zip
          </button>
        </div>
      )}

      {aba === "grafica" && (
        <div className="grid gap-5 md:grid-cols-2">
          <section className="space-y-3">
            <h3 className="font-serif text-lg font-semibold">PDF para a gráfica</h3>
            <p className="text-sm text-e-suave">
              {impresso
                ? `Na medida final (${formatoPorMedida(ed.doc.w, ed.doc.h)?.mm?.join(" × ")} mm), em 300 dpi, com sangria (a cor da borda continua para fora do corte) e marcas de corte.`
                : "Esta arte é de tela (pixels). O PDF sai no tamanho dela, sem marcas de corte. Para imprimir, use um formato impresso (cartaz, folheto, convite)."}
            </p>
            {impresso && (
              <>
                <Faixa rotulo="Sangria" valor={sangria} min={0} max={5} sufixo=" mm" mudar={setSangria} />
                <Chave rotulo="Marcas de corte" ligado={marcas} mudar={setMarcas} />
              </>
            )}
            <button type="button" className={BOTAO_PRIMARIO} disabled={ocupado} onClick={() => void fazer("PDF da gráfica", async () => {
              const pdf = await pdfDaGrafica(ed.projeto, ed.titulo, ed.vars, { sangria, marcas, dpi: 300 }, andamento("PDF da gráfica"));
              baixarArquivo(pdf, `${nomeDeArquivo(ed.titulo)}-grafica.pdf`);
              ed.avisar("PDF da gráfica baixado.");
            })}>
              <Icone nome="impressora" className="h-4 w-4" /> Baixar o PDF
            </button>
          </section>
          <section className="space-y-3">
            <h3 className="font-serif text-lg font-semibold">Separação de cores (serigrafia)</h3>
            <p className="text-sm text-e-suave">Um fotolito por cor de tinta (preto onde a tinta vai), para camiseta, faixa ou cartaz em serigrafia. Fotos e degradês vão num fotolito à parte, em tons de cinza.</p>
            <button type="button" className={BOTAO} disabled={ocupado} onClick={() => void fazer("Separação de cores", async () => {
              baixarArquivo(await separacaoDeCores(ed.projeto, ed.pagina, ed.titulo, ed.vars, 2), `${nomeDeArquivo(ed.titulo)}-separacao-de-cores.zip`);
              ed.avisar("Fotolitos baixados (.zip).");
            })}>
              <Icone nome="camadas" className="h-4 w-4" /> Baixar os fotolitos
            </button>
          </section>
        </div>
      )}

      {aba === "pacote" && (
        <div className="space-y-4">
          <p className="text-sm text-e-suave">Tudo da campanha num .zip só: as páginas nos formatos escolhidos (uma pasta por formato), a legenda com os créditos, os textos alternativos e a lista de créditos das imagens.</p>
          <div className="flex flex-wrap gap-2">
            {FORMATOS.filter((f) => f.grupo !== "Impressos").map((f) => {
              const marcado = formatos.includes(f.id);
              return (
                <button key={f.id} type="button" className={`${BOTAO} ${marcado ? "border-e-bordo bg-e-bordo-claro text-e-bordo" : ""}`} aria-pressed={marcado} onClick={() => setFormatos((l) => (marcado ? l.filter((x) => x !== f.id) : [...l, f.id]))}>
                  {marcado && <Icone nome="check" className="h-4 w-4" />}
                  {f.curto}
                </button>
              );
            })}
          </div>
          <button type="button" className={BOTAO_PRIMARIO} disabled={ocupado} onClick={() => void fazer("Pacote da campanha", async () => {
            baixarArquivo(await pacoteDaCampanha(ed.projeto, ed.titulo, formatos, { tipo: "png", qualidade: 0.92, escala: 1 }, ed.vars, andamento("Pacote da campanha")), `${nomeDeArquivo(ed.titulo)}-campanha.zip`);
            ed.avisar("Pacote da campanha baixado.");
          })}>
            <Icone nome="zip" className="h-4 w-4" /> Baixar o pacote
          </button>
        </div>
      )}

      {aba === "video" && (
        <div className="space-y-4">
          <p className="text-sm text-e-suave">
            As animações das camadas (subir, aparecer, revelar, cortina vermelha, contador) viram um vídeo para Reels e Stories. Escolha a animação de cada camada nas propriedades, em “Animação”.
            {!temAnimacao && " Esta página ainda não tem nenhuma camada animada."}
          </p>
          <Faixa rotulo="Duração" valor={segundos} min={2} max={20} sufixo=" s" mudar={(v, fim) => {
            setSegundos(v);
            if (fim) ed.setProjeto((p) => ({ ...p, duracao: v }), false);
          }} />
          <p className="text-xs text-e-suave">{video ? `O navegador grava em ${video.extensao.toUpperCase()}. A gravação leva o mesmo tempo do vídeo.` : "Este navegador não grava vídeo; use o Chrome ou o Edge."}</p>
          <button type="button" className={BOTAO_PRIMARIO} disabled={ocupado || !video} onClick={() => void fazer("Gravando o vídeo", async () => {
            const r = await comPagina(ed.projeto, ed.pagina, () => gravarVideo(ed.doc, segundos, andamento("Gravando o vídeo")), ed.vars);
            baixarArquivo(r.blob, `${nomeDeArquivo(ed.titulo)}.${r.extensao}`);
            ed.avisar(r.extensao === "mp4" ? "Vídeo baixado (MP4)." : "Vídeo baixado em WebM: se o Instagram recusar, converta para MP4 (por exemplo, no HandBrake, que é livre).");
          })}>
            <Icone nome="video" className="h-4 w-4" /> Gravar e baixar o vídeo
          </button>
        </div>
      )}

      {aba === "site" && (
        <div className="space-y-4">
          <p className="text-sm text-e-suave">Manda a página aberta para <strong>Materiais e arquivos</strong>, com a sua assinatura. Depois da aprovação da coordenação, ela pode virar capa de notícia, imagem de compartilhamento (OG) ou capa de episódio do podcast.</p>
          <label className="block text-sm">
            Nome do arquivo no site
            <input value={nomeNoSite} onChange={(e) => setNomeNoSite(e.target.value)} maxLength={100} className="mt-1 h-9 w-full rounded-md border border-e-fio bg-e-campo px-2.5" />
          </label>
          <button type="button" className={BOTAO_PRIMARIO} disabled={ocupado || nomeNoSite.trim().length < 3} onClick={() => void fazer("Enviando para o site", async () => {
            const blob = await comPagina(ed.projeto, ed.pagina, () => exportar(ed.doc, "webp", { qualidade: 0.9 }), ed.vars);
            const caminho = await sendFile(blob, "webp");
            await rpc("arquivo_registrar", { p_caminho: caminho, p_nome: `Arte: ${nomeNoSite.trim()}`.slice(0, 120) });
            ed.avisar("Enviada para Materiais e arquivos. Assim que a coordenação aprovar, ela fica disponível para o site.");
          })}>
            <Icone nome="enviar" className="h-4 w-4" /> Enviar para o site
          </button>
          <p className="text-xs text-e-suave">Formatos recomendados: capa de notícia {formatoDe("capa-noticia")?.w} × {formatoDe("capa-noticia")?.h}, cartão de link {formatoDe("banner")?.w} × {formatoDe("banner")?.h}, capa de podcast {formatoDe("capa-podcast")?.w} × {formatoDe("capa-podcast")?.h}.</p>
        </div>
      )}
    </Dialogo>
  );
}
