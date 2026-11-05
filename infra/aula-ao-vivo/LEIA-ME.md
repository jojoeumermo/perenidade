# Sala de aula ao vivo própria (Galène) — passo a passo para o Jonathan

Por que esta pasta existe e por que o Galène: `docs/plano-2026-11/notas/aula-ao-vivo.md`.
Resumo: o Jitsi público falha para gravar; o Jibri (gravação do Jitsi) pede uns 8 GB de memória por gravação e o BigBlueButton pede 8 núcleos e 16 GB. O Galène é leve, grava no próprio servidor, tem chat e tela compartilhada, e roda no ARM grátis da Oracle.

**Regra que muda tudo:** o vídeo é UDP e não passa pelo túnel do Cloudflare. A máquina da sala **precisa de IP público**. A máquina do site (`lucia-oracle`) foi feita sem IP público de propósito (`docs/HOSPEDAGEM.md`); **não mexa nela**. Crie uma segunda máquina só para a sala.

## Passo 1. Criar a máquina (Oracle, grátis)

1. Oracle Cloud, Compute, Criar instância. Imagem Ubuntu 24.04, formato Ampere A1 (ARM), 2 núcleos e 8 GB bastam para uma turma de ~50.
2. **Antes de criar, confira no painel da Oracle quanto da cota "sempre grátis" do Ampere A1 ainda resta** (a máquina do site já usa parte). Se não couber, use uma máquina pequena paga de outro provedor com Ubuntu e IP público; o resto deste passo a passo vale igual.
3. Em rede: **atribua um IP público** (efêmero serve; reservado é melhor, para não mudar se reiniciar). Anote o IP.
4. Chave SSH sua, como na máquina do site.

## Passo 2. Apontar o endereço

No Cloudflare, domínio `institutolucia.org`, DNS: registro **A** `aula` com o IP público, **nuvem cinza (somente DNS)**. Com a nuvem laranja o vídeo não funciona.

## Passo 3. Abrir as portas na Oracle

Rede, sua sub-rede, Lista de segurança, regras de entrada (origem `0.0.0.0/0`):

| Protocolo | Porta | Para quê |
|---|---|---|
| TCP | 80 e 443 | página da sala e certificado |
| UDP | 10000 | vídeo |
| UDP e TCP | 1194 | retransmissor embutido (ajuda quem está atrás de rede restrita ou no 3G) |

## Passo 4. Subir

```bash
ssh ubuntu@IP
sudo -i
git clone https://github.com/jojoeumermo/perenidade   # ou copie a pasta infra/aula-ao-vivo
cd perenidade/infra/aula-ao-vivo
bash preparar.sh        # 1ª vez: cria o .env e para
nano .env               # preencha DOMINIO (aula.institutolucia.org) e IP_PUBLICO
bash preparar.sh        # gera a chave, as 4 salas, abre as portas e sobe tudo
```

O script mostra a chave `GALENE_JWT_KEY` guardada no `.env`.

## Passo 5. Ligar o site (Vercel, variáveis de ambiente)

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_GALENE_URL` | `https://aula.institutolucia.org` |
| `GALENE_JWT_KEY` | a chave do `.env` da máquina (segredo; só no servidor do site) |
| `GALENE_GRUPOS` | opcional; o mesmo `GRUPOS` do `.env` (padrão `aula-a,aula-b,aula-c,aula-d`) |
| `NEXT_PUBLIC_VIDEO_HOSTS` | opcional; domínio do PeerTube do instituto, para o plano B e as gravações |

Publique de novo. Sem `NEXT_PUBLIC_GALENE_URL`/`GALENE_JWT_KEY` o site continua como antes e a opção "Sala do instituto" nem aparece no painel.

## Passo 6. Teste de verdade (faça antes da primeira aula)

1. Painel, Aulas ao vivo, Marcar a aula, "Sala do instituto". Abra a aula, "Começar agora".
2. Na página da aula: **Abrir a sala do professor**. A sala abre dentro da página (se ficar em branco, use "Abrir em outra aba"; a causa aparece no console do navegador).
3. Num celular com dados móveis (não no Wi-Fi), entre como aluno: "Entrar na aula". Veja o vídeo e escreva no chat. Se o aluno **não conseguir entrar** com "permissão", ajuste `GALENE_PERMISSOES_ALUNO` na Vercel (o padrão `message` é o chat sem câmera; não pude conferir o nome exato na documentação).
4. Compartilhe a tela (botão "Compartilhar tela").
5. Como professor, ligue a gravação (no menu da sala ou digitando `/record` no chat), fale um minuto, pare (`/unrecord`). Rode `bash listar-gravacoes.sh`: o arquivo precisa aparecer. Se nada aparecer, veja em que pasta o Galène gravou (`docker compose logs galene`) e ajuste o volume `recordings` do compose.
6. Se o vídeo não chegar (só som ou nada) para quem está no 3G: confira as portas do passo 3 e o `IP_PUBLICO` do `.env`.

## Depois de cada aula

1. `bash listar-gravacoes.sh`; baixe o arquivo (`scp`).
2. Suba no PeerTube (ou no YouTube) do instituto.
3. No painel, na aula, campo **Gravação**: cole o link. Ele toca na página da aula, só depois do clique de quem assiste.
4. Apague o arquivo da máquina para não encher o disco.

## Plano B (sem servidor próprio, ou se ele cair)

- A aula pode ter a transmissão do canal do instituto no YouTube (já existe no painel: "Transmitir pelo YouTube") ou um link de transmissão do PeerTube na sala. Os dois tocam embutidos, só depois do clique.
- Reunião interna: cole o link do Google Meet no endereço da sala; ele abre fora do site.

## Manutenção

- Atualizar o Galène: troque `GALENE_REF` no `.env` por uma tag nova e `docker compose build --no-cache galene && docker compose up -d`.
- Trocar a chave: apague a linha `GALENE_JWT_KEY=` do `.env`, rode `bash preparar.sh`, copie a nova para a Vercel e publique.
- Salas ocupadas: o site escolhe a sala pelo número da aula. Duas aulas ao mesmo tempo podem cair na mesma sala; aumente `GRUPOS` (e `GALENE_GRUPOS`) se isso acontecer.
