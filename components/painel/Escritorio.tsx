// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Escritorio } from "../labs/Escritorio";

/** O escritório no painel: texto, planilha e apresentação para o trabalho da equipe, sem sair do site. */
export function EscritorioNoPainel() {
  return (
    <section>
      <p className="text-sm text-ink-soft">Documentos, planilhas e apresentações para o trabalho da equipe: abrem e salvam .docx, .xlsx e .pptx.</p>
      <Escritorio
        inicial="wordcraft"
        s={{
          code: "Código",
          insideNote: "O programa abre aqui dentro e não tem acesso à sua conta nem ao painel.",
          fullscreen: "Tela cheia",
          notYet: "Ainda não está no ar no endereço do instituto.",
          render: {
            label: "Modo de desenho",
            webgl: "Estável (WebGL)",
            webgpu: "Rápido (WebGPU)",
            cpu: "Compatível (sem placa de vídeo)",
            help: "Se o programa travar ou mostrar “graphics device was lost”, use o modo estável ou o compatível.",
          },
          tab: "Escolha o programa",
          local: "Tudo fica só no navegador deste aparelho: salve o arquivo ao terminar e guarde em Materiais e arquivos se for da equipe.",
          editors: {
            wordcraft: { text: "Documentos no estilo Word: textos, atas, roteiros e relatórios." },
            gridcraft: { text: "Planilhas no estilo Excel: fórmulas, filtros e gráficos." },
            deckcraft: { text: "Apresentações no estilo PowerPoint: slides para reunião, aula e divulgação." },
          },
        }}
      />
    </section>
  );
}
