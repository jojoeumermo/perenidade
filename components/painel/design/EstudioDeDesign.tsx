// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import type { Me } from "@/lib/backend";
import { type Compatibilidade, conferirCompatibilidade, EDITORES, enderecoDo } from "@/lib/estudio";
import { rpc } from "@/lib/backend";
import { cleanImage, sendFile, UploadError, uploadMessages } from "@/lib/upload";
import { CampoArquivo } from "../Campos";
import { Aviso, botao, botaoClaro, campo, elo, rotulo, textoDoErro } from "../comum";
import { Estudio } from "./Estudio";
import { carregarImagem, COR, documentoVazio, imagem, miniatura, prepararImagem, texto } from "./motor";

const PHOTOCRAFT = EDITORES[0];

/** Em palavras simples: o navegador dá conta do editor avançado? */
export function VerificacaoDeCompatibilidade({ mb }: { mb: number }) {
  const [c, setC] = useState<Compatibilidade | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const veredito = !c ? null : !c.wasm ? "nao" : !c.webgpu || (c.memoria !== null && c.memoria < 4) ? "lento" : "ok";
  return (
    <div className="mt-2 text-sm">
      <button type="button" className={botaoClaro} disabled={conferindo} onClick={async () => { setConferindo(true); setC(await conferirCompatibilidade()); setConferindo(false); }}>
        {conferindo ? "Conferindo…" : "Conferir se este aparelho consegue"}
      </button>
      {c && (
        <div className={`mt-2 border-l-4 p-2 ${veredito === "ok" ? "border-ok" : veredito === "lento" ? "border-gold" : "border-oxblood"}`} role="status">
          <p className="font-semibold">{veredito === "ok" ? "Seu navegador consegue." : veredito === "lento" ? "Pode ficar lento neste aparelho." : "Não vai funcionar aqui: tente o Chrome ou o Edge num computador."}</p>
          <ul className="mt-1 text-xs text-ink-soft">
            <li>WebAssembly: {c.wasm ? "sim" : "não"}</li>
            <li>WebGPU (aceleração pela placa de vídeo): {c.webgpu ? "sim" : "não (funciona mais devagar, pelo processador)"}</li>
            <li>Memória do aparelho: {c.memoria === null ? "o navegador não informa" : `cerca de ${c.memoria} GB${c.memoria < 4 ? " (pouca para arquivos grandes)" : ""}`}</li>
            <li>Navegador: {c.navegador}{c.navegador === "Firefox" || c.navegador === "Safari" ? " (o Chrome e o Edge são os mais testados)" : ""}</li>
          </ul>
        </div>
      )}
      <p className="mt-2 text-xs text-ink-soft">Na primeira vez, o navegador baixa cerca de {mb} MB (cuidado com dados móveis). Depois fica guardado no aparelho.</p>
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
    <div className="mt-3 space-y-2">
      <label className="block text-sm">Título da arte<input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={100} className={campo} /></label>
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

/** "Estúdio de design" no painel: as duas opções lado a lado, e o Estúdio rápido logo abaixo. */
export function EstudioDeDesign({ me }: { me: Me }) {
  const [aberto, setAberto] = useState<"rapido" | "avancado">("rapido");
  const [recarga, setRecarga] = useState(0);
  const endereco = enderecoDo("photocraft");
  return (
    <div>
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <button type="button" onClick={() => setAberto("rapido")} aria-pressed={aberto === "rapido"} className={`painel-cartao cursor-pointer p-4 text-left ${aberto === "rapido" ? "border-2 border-ink" : ""}`}>
          <p className={rotulo}>Estúdio rápido</p>
          <p className="font-serif text-lg font-semibold">Modelos da marca</p>
          <p className="text-sm text-ink-soft">Posts, stories, cartazes e capas prontos para trocar o texto e publicar. Use quase sempre.</p>
        </button>
        <button type="button" onClick={() => setAberto("avancado")} aria-pressed={aberto === "avancado"} className={`painel-cartao cursor-pointer p-4 text-left ${aberto === "avancado" ? "border-2 border-ink" : ""}`}>
          <p className={rotulo}>Editor avançado</p>
          <p className="font-serif text-lg font-semibold">PhotoCraft</p>
          <p className="text-sm text-ink-soft">Para retocar foto, recortar, máscaras e camadas como no Photoshop. Use quando o modelo não basta.</p>
        </button>
      </div>

      {aberto === "rapido" ? (
        <Estudio key={recarga} me={me} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="painel-cartao p-5">
            <h2 className="font-serif text-2xl font-semibold">Editor avançado: PhotoCraft</h2>
            <p className="mt-1 text-sm">Editor de imagens de código aberto do projeto ArtCraft ({PHOTOCRAFT.licenca}), versão {PHOTOCRAFT.versao}, hospedado sem modificação num endereço separado do painel: ele não vê a sua sessão nem os dados do instituto.</p>
            <p className="mt-2 border-l-4 border-gold pl-2 text-sm">Fase de testes (alfa): pode ter falhas. Os arquivos ficam só no navegador deste aparelho: exporte sempre o PNG e guarde o PSD.</p>
            <VerificacaoDeCompatibilidade mb={PHOTOCRAFT.mb} />
            <p className="mt-3 flex flex-wrap gap-3">
              {endereco ? <a href={endereco} target="_blank" rel="noopener noreferrer" className={botao}>Abrir o PhotoCraft ↗</a> : <span className="text-sm text-oxblood">O endereço do editor avançado ainda não está no ar (estudio.institutolucia.org). Veja docs/ESTUDIO-EDITORES.md.</span>}
              <a href={PHOTOCRAFT.repositorio} target="_blank" rel="noopener noreferrer" className={elo}>Código e licença ↗</a>
            </p>
            <p className="mt-3 text-xs text-ink-soft">PhotoCraft é feito pelo time e pela comunidade ArtCraft (getartcraft.com). Não é produto da Adobe nem afiliado a ela.</p>
          </section>

          <section className="painel-cartao p-5">
            <h2 className="font-serif text-xl font-semibold">Enviar arte do editor avançado</h2>
            <p className="text-sm text-ink-soft">Exportou do PhotoCraft? Envie aqui: entra nos Trabalhos e em Materiais e arquivos, com a sua assinatura.</p>
            <EnviarArte me={me} depois={() => setRecarga((n) => n + 1)} />
          </section>

          <section className="painel-cartao p-5 lg:col-span-2">
            <h2 className="font-serif text-xl font-semibold">Ajuda rápida</h2>
            <div className="mt-2 grid gap-4 text-sm md:grid-cols-3">
              <div>
                <p className="font-semibold">Usar um modelo</p>
                <p className="text-ink-soft">No Estúdio rápido, escolha o modelo, clique no texto para trocar, guarde na conta e baixe o PNG.</p>
              </div>
              <div>
                <p className="font-semibold">Quando passar para o avançado</p>
                <p className="text-ink-soft">Foto para retocar, recorte com máscara, muitas camadas. No Estúdio rápido, “Abrir no editor avançado” baixa o PSD com as camadas; abra o arquivo no PhotoCraft (File › Open… ou arrastando para a janela). Cada modelo também tem o botão “PSD”.</p>
              </div>
              <div>
                <p className="font-semibold">Exportar e enviar</p>
                <p className="text-ink-soft">No PhotoCraft, File › Export › Export As… em PNG ou JPG; volte aqui e use “Enviar arte do editor avançado”.</p>
              </div>
            </div>
            <table className="mt-4 w-full text-left text-sm">
              <caption className="text-left text-xs text-ink-soft">No Photoshop é assim → no PhotoCraft é assim (conferido nos guias do PhotoCraft; os menus do programa estão em inglês)</caption>
              <thead className="text-xs text-ink-soft"><tr><th className="font-normal">Photoshop</th><th className="font-normal">PhotoCraft</th></tr></thead>
              <tbody className="divide-y divide-rule">{MAPA.map(([a, b]) => <tr key={a}><td className="py-1">{a}</td><td>{b}</td></tr>)}</tbody>
            </table>
            <p className="mt-3 text-xs text-ink-soft">O que se perde do Estúdio rápido para o PSD: filtros de imagem e a tarja atrás do texto chegam desenhados (não editáveis); textos girados ou com tarja chegam como imagem. As fontes do instituto (EB Garamond, Inter, IBM Plex Mono) são livres: instale pelo Google Fonts para editar os textos.</p>
          </section>
        </div>
      )}
    </div>
  );
}
