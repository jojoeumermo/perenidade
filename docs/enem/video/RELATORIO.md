# Vídeos curtos do ENEM: relatório (02/11/2026)

- **O que entrou:** 10 vídeos (3 pilotos e 7 da reta final), 9,4 minutos, 5,2 MB de áudio no repositório (Opus e AAC de reserva; o navegador baixa só um, cerca de 0,3 MB por vídeo, e só depois do clique).
- **Voz:** Kokoro-82M v1.0 (Apache-2.0), Voz 1 (pf_dora) e Voz 2 (pm_alex), gerada no Node desta máquina. Piper ficou de fora (licença incerta), e o Chatterbox também (não roda na CPU daqui). Detalhes em docs/enem/voz/COMPARATIVO.md.
- **Fundação:** roteiros em content/enem/videos/*.yml (fatos só de edicao.yml, contas refeitas com mathjs, clichês reprovados, tudo "em revisão"), palco determinista lib/videos/palco.ts, tocador acessível components/videos/Tocador.tsx, bloco `videocurto`, `npm run video:narrar | video:legendar | video:conferir | testar:video` (69 conferências). Fatos da TRI entraram em edicao.yml, com trechos do guia do Inep.
- **Ligar:** `NEXT_PUBLIC_RECURSOS=enem-curso,enem-video` (o vídeo aparece no topo da aula que tem vídeo). Hoje fica desligado.
- **Pilotos:** desconto sobre desconto, TRI e coerência, proposta de intervenção. **V1:** as duas provas, tempo por questão, horários do dia da prova, documentos que valem, cartão-resposta, o que zera a redação, quando dá para sair da sala.
- **Ficou para depois:** os outros 20+ vídeos da V1, as Ondas V2, V3 e V4, os recortes 9:16 e o MP4 (V5: não há renderização em arquivo), o guia de manutenção completo (V6), cenas de gráfico, mapa, tabela e KaTeX, alinhamento por palavra com Whisper (hoje as marcas casam com o início de cada frase), revisão humana e de áudio, teste com axe e no celular.
- **Desvio registrado:** a média de palavras por frase aceita de 9 a 20 (o pedido dizia 14 a 20), porque os ganchos curtos soam mais naturais.
- **Passos do dono:** ouvir os 10 áudios em public/videos-curtos/; decidir quando ligar `enem-video`; se quiser cache longo, pedir `Cache-Control` para /videos-curtos/* (não mexi no next.config).

## Como manter
1. Escreva ou mude content/enem/videos/<id>.yml (modelo: desconto-sobre-desconto.yml).
2. `npm run video:narrar <id>` (precisa de `npm run vozes:baixar` e do ffmpeg; leva cerca de 10 vezes a duração do vídeo).
3. `npm run video:legendar` e `npm run video:conferir`. Quando edicao.yml muda, o conferir aponta os vídeos com a fala desatualizada.
