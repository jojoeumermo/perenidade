# Resposta a incidente

Para quando houver suspeita de invasão, vazamento ou uso indevido: conta da equipe tomada, chave exposta, dados vistos
por quem não devia, site alterado. Quem coordena o incidente é a coordenação; na ausência, a vice.

## Os primeiros 60 minutos

| Minuto | O que fazer | Onde |
| --- | --- | --- |
| 0–10 | **Isolar.** Tirar do ar a área afetada (ou o site inteiro) e pausar os envios. | Painel → Controles do site → Interdição / Pausa |
| 0–10 | Se for conta da equipe: suspender a conta e tirar os papéis. | Painel → Pessoas → Suspender |
| 10–25 | **Revogar sessões.** Redefinir a senha de quem foi afetado (encerra todas as sessões). Se não se sabe quem: diminuir o prazo das sessões e pedir troca de senha geral. | Painel → Pessoas → Redefinir senha; Supabase → Authentication → Sessions |
| 10–30 | **Rotacionar segredos** que possam ter vazado, na ordem de `ROTACAO.md` (service_role e JWT primeiro). | Supabase, Vercel, GitHub, Resend, Meta, Google |
| 25–40 | **Preservar provas** antes de limpar: exportar o registro de atividades e o livro de auditoria do painel; anotar horários. Não apagar nada. | Painel → Registro de atividades; SQL Editor (`interno.audit_logs`, `interno.auditoria`) |
| 40–60 | **Avaliar o alcance:** que dados, de quantas pessoas, desde quando. | Registro, logs da Vercel e do Supabase |
| 40–60 | **Decidir o aviso.** Se houve dado pessoal exposto com risco relevante: avisar as pessoas afetadas e comunicar a ANPD (LGPD, art. 48) em prazo razoável (orientação da ANPD: até 3 dias úteis). Dados de saúde e de menores contam como risco relevante. | gov.br/anpd → Comunicação de incidente |

## Depois
- Corrigir a causa (com teste que falha antes e passa depois) e só então reabrir as áreas.
- Escrever um resumo em `docs/auditoria/` (o que aconteceu, por quê, o que mudou), sem detalhes que ensinem a repetir.
- Revisar este plano.

## Contatos
- Relato de falha: institutolucia@tutamail.com, assunto "Segurança" (veja `SECURITY.md`).
- ANPD: https://www.gov.br/anpd
