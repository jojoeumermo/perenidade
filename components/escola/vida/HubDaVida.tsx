// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "@/components/Link";
import { type Locale, localePath } from "@/i18n/config";
import type { TextosDaVida } from "@/i18n/escola/vida";
import { ResumoDaVida } from "./ResumoDaVida";

const CARTOES = [
  { chave: "tarefas", caminho: "/vida/tarefas" },
  { chave: "missoes", caminho: "/vida/missoes" },
  { chave: "caso", caminho: "/vida/caso-do-bairro" },
  { chave: "documentos", caminho: "/vida/documentos" },
] as const;
// F7 (prancha Mapa): a vida real é aberta, então o hub só aponta para endereços abertos. Vozes e lutas foram para a
// Biblioteca e o círculo de cultura digital para o Núcleo, os dois dentro da Escola fechada: ficam fora daqui para que
// ninguém do site aberto bata na porta da Escola.

/** O hub "Vida real": reúne as peças abertas da vida real. Links puros, funciona sem JavaScript. */
export function HubDaVida({ s, lang, totalDeTarefas, totalDeMissoes }: { s: TextosDaVida["hub"]; lang: Locale; totalDeTarefas: number; totalDeMissoes: number }) {
  return (
    <div data-hub-da-vida="">
      <ResumoDaVida tarefas={totalDeTarefas} missoes={totalDeMissoes} s={{ tarefas: s.resumoTarefas, missoes: s.resumoMissoes }} />
      <ul className="vida-grade">
        {CARTOES.map(({ chave, caminho }) => (
          <li key={chave}>
            <Link href={localePath(lang, caminho)} className="vida-cartao vida-cartao-link" data-vida-cartao={chave}>
              <h2>{s.cartoes[chave].titulo}</h2>
              <p>{s.cartoes[chave].texto}</p>
              <p className="font-semibold">{s.abrir} →</p>
            </Link>
          </li>
        ))}
      </ul>
      <p className="vida-nota">{s.nota}</p>
    </div>
  );
}