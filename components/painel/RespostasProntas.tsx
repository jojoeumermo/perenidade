// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Respostas prontas para a mediação (uma das ideias do painel): as frases que mais se repetem ao recusar, banir ou
// resolver uma denúncia. Escolher uma preenche o campo; dá para mudar o texto antes de mandar.

export const RESPOSTAS = {
  banimento: [
    "Spam repetido depois de aviso.",
    "Ofensa racista, machista, LGBTfóbica ou capacitista.",
    "Ameaça ou exposição de dados de outra pessoa.",
    "Golpe ou propaganda enganosa.",
    "Conta criada só para atacar ou tumultuar.",
  ],
  denuncia: [
    "Mensagem ocultada e a pessoa foi lembrada da regra.",
    "Conversamos com a pessoa e ela corrigiu.",
    "Não fere as regras de convivência: mantida.",
    "Conta banida; a coordenação foi avisada.",
    "Encaminhado à coordenação.",
  ],
  mural: [
    "Falta o contato de quem anuncia.",
    "Parece golpe ou promessa de ganho fácil.",
    "Propaganda eleitoral não entra no mural.",
    "Venda de produto ou catálogo: o mural é para trabalho e serviço.",
    "Faltam informações: pagamento, local ou como se candidatar.",
  ],
} as const;

export function RespostasProntas({ tipo, usar }: { tipo: keyof typeof RESPOSTAS; usar: (texto: string) => void }) {
  return (
    <select
      value=""
      onChange={(e) => {
        if (e.target.value) usar(e.target.value);
      }}
      aria-label="Usar uma resposta pronta"
      className="painel-campo mt-1 max-w-full border border-ink bg-parchment px-2 py-1 text-xs"
    >
      <option value="">Resposta pronta…</option>
      {RESPOSTAS[tipo].map((texto) => (
        <option key={texto} value={texto}>{texto}</option>
      ))}
    </select>
  );
}
