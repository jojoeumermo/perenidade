// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { ArrowUpRight, Layers, LayoutTemplate } from "lucide-react";
import { useState } from "react";
import type { Me } from "@/lib/backend";
import { type Compatibilidade, conferirCompatibilidade, EDITORES, enderecoEstavelDo } from "@/lib/estudio";
import { rpc } from "@/lib/backend";
import { cleanImage, sendFile, UploadError, uploadMessages } from "@/lib/upload";
import { CampoArquivo } from "../Campos";
import { Aviso, textoDoErro } from "../comum";
import { Botao, Campo, Cartao, Faixa } from "../ui";
import { type Abertura, Estudio } from "./Estudio";
import { Inicio } from "./Inicio";
import { carregarImagem, COR, documentoVazio, imagem, miniatura, prepararImagem, texto } from "./motor";

const PHOTOCRAFT = EDITORES[0];

/** Em palavras simples: o navegador dá conta do editor avançado? */
export function VerificacaoDeCompatibilidade({ mb }: { mb: number }) {
  const [c, setC] = useState<Compatibilidade | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const veredito = !c ? null : !c.wasm ? "nao" : !c.webgpu || (c.memoria !== null && c.memoria < 4) ? "lento" : "ok";
  return (
    <div className="mt-3 grid gap-2 text-sm">
      <div>
        <Botao carregando={conferindo} onClick={async () => { setConferindo(true); try { setC(await conferirCompatibilidade()); } finally { setConferindo(false); } }}>
          {conferindo ? "Conferindo…" : "Conferir se este aparelho consegue"}
        </Botao>
      </div>
      {c && (
        <Faixa tom={veredito === "ok" ? "ok" : veredito === "lento" ? "aviso" : "erro"} titulo={veredito === "ok" ? "Seu navegador consegue." : veredito === "lento" ? "Pode ficar lento neste aparelho." : "Não vai funcionar aqui: tente o Chrome ou o Edge num computador."}>
          <ul className="mt-1 text-xs">
            <li>WebAssembly: {c.wasm ? "sim" : "não"}</li>
            <li>WebGPU (aceleração pela placa de vídeo): {c.webgpu ? "sim" : "não (funciona mais devagar, pelo processador)"}</li>
            <li>Memória do aparelho: {c.memoria === null ? "o navegador não informa" : `cerca de ${c.memoria} GB${c.memoria < 4 ? " (pouca para arquivos grandes)" : ""}`}</li>
            <li>Navegador: {c.navegador}{c.navegador === "Firefox" || c.navegador === "Safari" ? " (o Chrome e o Edge são os mais testados)" : ""}</li>
          </ul>
        </Faixa>
      )}
      <p className="text-xs text-ink-soft">Na primeira vez, o navegador baixa cerca de {mb} MB (cuidado com dados móveis). Depois fica guardado no aparelho.</p>
    </div>
  );
}

/**
 * Enviar arte do editor avançado: a imagem (ou PDF) exportada entra nos Trabalhos, com a assinatura de quem enviou,
 * e em Materiais e arquivos, pelo fluxo de aprovação de sempre. O PSD fica com a pessoa (não há armazenamento para ele).
 */
function EnviarArte({ me, depois }: { me: Me; depois: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [estado, setEstado] = useState("");
  async function enviar(arquivo: File) {
    if (titulo.trim().length < 3) {
      setEstado("Dê um título à arte antes de escolher o arquivo.");
      return;
    }
    setEstado("Preparando e enviando…");
    try {
      const pdf = arquivo.type === "application/pdf";
      const pronto = pdf ? { blob: arquivo as Blob, extension: "pdf" as const } : await cleanImage(arquivo);
      const caminho = await sendFile(pronto.blob, pronto.extension);
      await rpc("arquivo_registrar", { p_caminho: caminho, p_nome: `Arte: ${titulo.trim()}`.slice(0, 120) });
      // Nos Trabalhos: a imagem como única camada (reduzida para caber), ou um cartão dizendo onde está o PDF.
      let doc = documentoVazio("post");
      if (!pdf) {
        const src = await prepararImagem(arquivo);
        const img = await carregarImagem(src);
        const w = Math.min(1080, img.width);
        const h = Math.round((w * img.height) / img.width);
        doc = { ...doc, w, h, camadas: [imagem({ x: 0, y: 0, w, h, src, credito: `Feito por ${me.nome} no editor avançado.`, nome: "Arte do editor avançado" })] };
      } else {
        doc = { ...doc, camadas: [texto({ x: 88, y: 500, w: 904, texto: `PDF enviado do editor avançado: ${titulo.trim()}. O arquivo está em Materiais e arquivos.`, fonte: "serifa", tamanho: 48, peso: 600, cor: COR.Tinta })] };
      }
      await rpc("design_salvar", { p_id: null, p: { titulo: titulo.trim(), formato: "editor-avancado", largura: doc.w, altura: doc.h, dados: doc, miniatura: await miniatura(doc), compartilhado: true } });
      setEstado("Enviado ✓ A arte está nos Trabalhos (com a sua assinatura) e em Materiais e arquivos, esperando o apoio da equipe e a aprovação da coordenação.");
      setTitulo("");
      depois();
    } catch (erro) {
      setEstado(erro instanceof UploadError ? (uploadMessages[erro.message] ?? uploadMessages.envio) : textoDoErro(erro));
    }
  }
  return (
    <div className="mt-3 grid gap-3">
      <Campo rotulo="Título da arte" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={100} />
      <CampoArquivo aceita="image/jpeg,image/png,image/webp,application/pdf" escolher={(f) => void enviar(f)} dica="PNG, JPG ou PDF exportado do editor avançado, até 8 MB. O PSD fica com você: guarde junto do projeto." />
      <Aviso texto={estado} />
    </div>
  );
}

/**
 * Mapa rápido Photoshop → PhotoCraft: só o que os guias do próprio PhotoCraft confirmam (docs/user/guides, conferidos
 * pelo projeto na versão 0.8.2). Ao trocar de versão, confira de novo no programa.
 */
const MAPA: [string, string][] = [
  ["Ferramenta Texto horizontal (T)", "Horizontal Type Tool, também na tecla T; o texto continua editável"],
  ["Arquivo › Abrir (PSD)", "File › Open… (abre PSD e PSB; o que não dá para reproduzir igual vem com aviso)"],
  ["Salvar com camadas (Salvar como › PSD)", "File › Save As… › PSD Document"],
  ["Exportar como PNG ou JPG", "File › Export › Export As… (ou Quick Export as PNG)"],
  ["Painel Histórico", "Painel History: cada sessão de texto vira um passo"],
];

/** As duas portas do estúdio: cartões que se escolhem (o escolhido fica com o traço bordô à esquerda). */
const OPCOES = [
  { id: "rapido", simbolo: LayoutTemplate, rotulo: "Estúdio rápido", nome: "Modelos da marca", sobre: "Posts, stories, cartazes e capas prontos para trocar o texto e publicar. Use quase sempre." },
  { id: "avancado", simbolo: Layers, rotulo: "Editor avançado", nome: "PhotoCraft", sobre: "Para retocar foto, recortar, máscaras e camadas como no Photoshop. Use quando o modelo não basta." },
] as const;

/** "Estúdio de design" no painel: as duas opções lado a lado, e o Estúdio rápido logo abaixo. */
export function EstudioDeDesign({ me }: { me: Me }) {
  const [aberto, setAberto] = useState<"rapido" | "avancado">("rapido");
  const [recarga, setRecarga] = useState(0);
  // O editor abre em tela cheia por cima do painel; ao sair, volta para a entrada do estúdio.
  const [abertura, setAbertura] = useState<Abertura | null>(null);
  const endereco = enderecoEstavelDo("photocraft");
  return (
    <div className="grid gap-6">
      <div className="grid gap-3 md:grid-cols-2">
        {OPCOES.map(({ id, simbolo: Simbolo, rotulo, nome, sobre }) => (
          <Cartao key={id} as="div" interativo variante={aberto === id ? "destaque" : "padrao"} aria-pressed={aberto === id} onClick={() => setAberto(id)} className="flex items-start gap-3">
            <span aria-hidden className="pn-cabecalho-icone shrink-0">
              <Simbolo />
            </span>
            <span className="grid min-w-0 gap-0.5">
              <span className="pn-rotulo-mono">{rotulo}</span>
              <span className="pn-cartao-titulo">{nome}</span>
              <span className="pn-cartao-sobre">{sobre}</span>
            </span>
          </Cartao>
        ))}
      </div>

      {abertura && (
        <Estudio
          me={me}
          abertura={abertura}
          fechar={() => {
            setAbertura(null);
            setRecarga((n) => n + 1);
          }}
        />
      )}
      {aberto === "rapido" ? (
        <Inicio key={recarga} me={me} abrir={setAbertura} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Cartao titulo="Editor avançado: PhotoCraft">
            <p className="text-sm">Editor de imagens de código aberto do projeto ArtCraft ({PHOTOCRAFT.licenca}), versão {PHOTOCRAFT.versao}, hospedado sem modificação num endereço separado do painel: ele não vê a sua sessão nem os dados do instituto.</p>
            <Faixa tom="aviso" className="mt-3">
              <p>Fase de testes (alfa): pode ter falhas. Os arquivos ficam só no navegador deste aparelho: exporte sempre o PNG e guarde o PSD.</p>
            </Faixa>
            <VerificacaoDeCompatibilidade mb={PHOTOCRAFT.mb} />
            {!endereco && (
              <Faixa tom="aviso" className="mt-3">
                <p>O endereço do editor avançado ainda não está no ar (estudio.institutolucia.org). Veja docs/ESTUDIO-EDITORES.md.</p>
              </Faixa>
            )}
            <p className="mt-3 flex flex-wrap items-center gap-3">
              {endereco && (
                <a href={endereco} target="_blank" rel="noopener noreferrer" className="pn-botao pn-botao-principal">
                  Abrir o PhotoCraft <ArrowUpRight aria-hidden />
                  <span className="sr-only"> (abre em outra aba)</span>
                </a>
              )}
              <a href={PHOTOCRAFT.repositorio} target="_blank" rel="noopener noreferrer" className="pn-elo inline-flex items-center gap-1">
                Código e licença <ArrowUpRight aria-hidden className="h-4 w-4" />
                <span className="sr-only"> (abre em outra aba)</span>
              </a>
            </p>
            <p className="mt-3 text-xs text-ink-soft">PhotoCraft é feito pelo time e pela comunidade ArtCraft (getartcraft.com). Não é produto da Adobe nem afiliado a ela.</p>
          </Cartao>

          <Cartao titulo="Enviar arte do editor avançado" sobre="Exportou do PhotoCraft? Envie aqui: entra nos Trabalhos e em Materiais e arquivos, com a sua assinatura.">
            <EnviarArte me={me} depois={() => setRecarga((n) => n + 1)} />
          </Cartao>

          <Cartao titulo="Ajuda rápida" className="lg:col-span-2">
            <div className="grid gap-4 text-sm md:grid-cols-3">
              <div>
                <p className="font-semibold">Usar um modelo</p>
                <p className="text-ink-soft">No Estúdio rápido, escolha o modelo, dê duplo clique no texto para trocar, guarde na conta e baixe o PNG.</p>
              </div>
              <div>
                <p className="font-semibold">Quando passar para o avançado</p>
                <p className="text-ink-soft">Foto para retocar, recorte com máscara, muitas camadas. No Estúdio rápido, o botão “Avançado” (embaixo, no trilho da esquerda) baixa o PSD com as camadas; abra o arquivo no PhotoCraft (File › Open… ou arrastando para a janela).</p>
              </div>
              <div>
                <p className="font-semibold">Exportar e enviar</p>
                <p className="text-ink-soft">No PhotoCraft, File › Export › Export As… em PNG ou JPG; volte aqui e use “Enviar arte do editor avançado”.</p>
              </div>
            </div>
            <div className="pn-tabela-caixa mt-4">
              <table className="pn-tabela text-left">
                <caption className="px-3 py-2 text-left text-xs text-ink-soft">No Photoshop é assim → no PhotoCraft é assim (conferido nos guias do PhotoCraft; os menus do programa estão em inglês)</caption>
                <thead>
                  <tr>
                    <th scope="col">Photoshop</th>
                    <th scope="col">PhotoCraft</th>
                  </tr>
                </thead>
                <tbody>
                  {MAPA.map(([a, b]) => (
                    <tr key={a}>
                      <td>{a}</td>
                      <td>{b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-ink-soft">O que se perde do Estúdio rápido para o PSD: filtros de imagem e a tarja atrás do texto chegam desenhados (não editáveis); textos girados ou com tarja chegam como imagem. As fontes do instituto (EB Garamond, Inter, IBM Plex Mono) são livres: instale pelo Google Fonts para editar os textos.</p>
          </Cartao>
        </div>
      )}
    </div>
  );
}
