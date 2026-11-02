# Voz dos vídeos curtos: escolha e licenças (02/11/2026)

O dono já tinha ouvido e aprovado Kokoro, Chatterbox e Piper. Por decisão dele, não houve o teste às cegas grande.

| Voz | Licença (conferida em docs/VOZES.md e THIRD_PARTY_LICENSES.md) | Situação |
| --- | --- | --- |
| Kokoro-82M v1.0 (pf_dora = Voz 1, pm_alex = Voz 2), ONNX de onnx-community, revisão 1939ad2a | Apache-2.0; o cartão do modelo diz que o treino usou só áudio permissivo ou sem direitos | **Escolhida.** Roda no Node, sem placa de vídeo, com o mesmo motor do site (public/workers/voz-motor.js) |
| Chatterbox multilíngue | MIT | **Fora por agora.** Não é viável na CPU desta máquina: pede PyTorch (não instalado) e baixa vários GB de pesos. Sem medida própria de velocidade: é estimativa, não teste. Clonagem de voz nunca seria usada |
| Piper pt_BR (faber, cadu, jeff, edresson) | Dados CC0 ou CC BY 4.0, mas ajustados a partir de vozes inglesas de uso não comercial | **Fora:** licença incerta |

Motivo da escolha: é a única das três com licença limpa que roda aqui. O áudio gerado sai sob CC BY-SA 4.0, como o resto do
conteúdo. Nenhuma voz imita pessoa real; na tela, os nomes são "Voz 1" e "Voz 2", e cada vídeo diz "Narração: voz sintética".

Medida nesta máquina (Intel, 12 linhas, sem placa de vídeo, uma linha de execução por processo): o Kokoro gera cerca de
0,1 segundo de fala por segundo de conta (67,5 s de fala em 692 s). Com 9 processos ao mesmo tempo, os 10 vídeos saíram em
cerca de 10 minutos. O Kokoro não sorteia nada: três "tomadas" da mesma frase saem iguais, então foi uma tomada só, com
conferência automática de duração e volume de cada frase.

Trocar a voz: content/enem/videos/voz.yml, depois `npm run video:narrar --todos` e `npm run video:legendar`.
