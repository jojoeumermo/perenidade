// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { preencher } from "@/lib/rede/preencher";
import { Icone } from "../publicar/alumia2/icones";

/**
 * A pílula com o globo que marca gente de fora, num formato só em toda tela e largura: o globo e o `rotulo` inteiro, à vista
 * ("do Fediverso · mastodon.social"), porque o domínio sozinho não diz a quem não é técnico que é gente de fora, e o `title` não
 * aparece no toque do celular. O `title` explica mais ("Do Fediverso: esta conta é de mastodon.social, um servidor fora da Alumia"). Serve ao cartão daqui e
 * ao de fora, ao fio, ao perfil, à busca e aos avisos.
 */
export function SeloDoServidor({ servidor, rotulo, titulo, className = "" }: { servidor: string; rotulo?: string; titulo?: string; className?: string }) {
  if (!servidor) return null;
  const lido = rotulo ? preencher(rotulo, { servidor }) : servidor;
  return (
    <span
      title={titulo ? preencher(titulo, { servidor }) : lido}
      className={`inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--al-superficie-2)] px-1.5 py-0.5 text-xs font-semibold text-[var(--al-texto-2)] ${className}`.trim()}
    >
      <Icone nome="fediverso" className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{lido}</span>
    </span>
  );
}

export default SeloDoServidor;
