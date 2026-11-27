// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

/**
 * O arquivo é um PDF de verdade? O `type` que o navegador informa vem da extensão que o sistema viu,
 * então um "aviso.pdf" com HTML dentro chega dizendo ser PDF — e aberto num <object> ou <iframe> esse
 * conteúdo rodaria ativo na nossa origem. Aqui passam os dois crivos: o tipo declarado E o cabeçalho
 * "%PDF-", que o formato manda estar nos primeiros 1024 bytes. Um HTML/SVG disfarçado não passa; um
 * PDF legítimo, mesmo com bytes de sobra antes do cabeçalho, passa.
 */
export async function pdfDeVerdade(arquivo: Blob): Promise<boolean> {
  if (arquivo.type !== "application/pdf") return false;
  const trecho = new Uint8Array(await arquivo.slice(0, 1024).arrayBuffer());
  const cabecalho = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
  for (let i = 0; i + cabecalho.length <= trecho.length; i++) {
    if (cabecalho.every((b, j) => trecho[i + j] === b)) return true;
  }
  return false;
}
