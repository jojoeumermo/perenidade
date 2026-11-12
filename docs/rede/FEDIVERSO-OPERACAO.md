# Fediverso da Alumia: operação na VPS

Como manter a fila de entrega do Fediverso andando e a ordem para pôr tudo no ar. O desenho da federação está em
`docs/rede/FEDIVERSO.md`.

## O que o timer faz

Quando alguém da Alumia publica, segue ou responde, o que precisa sair para outras instâncias entra numa fila no banco. Quem
esvazia a fila é o site, na rota `POST /api/fediverso/entregar`. Alguém precisa chamar essa rota de tempos em tempos.

Na VPS, o `lucia-fediverso.timer` chama a cada **30 segundos**, direto no contêiner do site (porta 3001; se ela falhar, 3002),
sem passar pelo Cloudflare. O pedido não leva segredo: a rota só entrega o que já está na fila.

- Federação desligada no site (a rota responde 404): o timer roda e não faz nada, em silêncio. Pode ficar instalado desde já.
- Erro de verdade nas duas portas (site fora do ar, banco fora do ar): a rodada falha e o motivo fica no registro.
- A rotina do banco (`pg_cron`, a cada minuto) continua de reserva. As duas podem conviver.

São três arquivos em `infra/contabo/`: `fediverso-entregar.sh` (o que roda), `lucia-fediverso.service` e
`lucia-fediverso.timer`.

## As imagens de fora (P12)

Na mesma rodada, depois da fila, o site busca as imagens de fora que chegaram com as notas (até 10 por rodada, em até 20 s) e
grava em `/var/lib/lucia/fed-midia` (dono: o usuário 1000, o mesmo do contêiner). `infra/contabo/atualizar.sh` cria a pasta e a
monta nos dois contêineres; vale a partir da próxima publicação. Ver quanto ocupa: `du -sh /var/lib/lucia/fed-midia`. O teto é
20 GB (`ALUMIA_FEDIVERSO_MIDIA_TETO_MB` no `site.env` muda). Apagar a pasta não quebra nada: as imagens voltam a ser buscadas.

## Instalar na VPS (uma vez)

**1. No computador da coordenação**, dentro da pasta do repositório, copie os três arquivos e entre na VPS:

```bash
scp -P 22222 -i ~/.ssh/contabo_lucia infra/contabo/fediverso-entregar.sh infra/contabo/lucia-fediverso.service infra/contabo/lucia-fediverso.timer root@<IP da VPS>:/root/lucia-infra/
ssh -p 22222 -i ~/.ssh/contabo_lucia root@<IP da VPS>
```

**2. Já na VPS, como root**, um comando por vez:

```bash
install -m 755 /root/lucia-infra/fediverso-entregar.sh /usr/local/sbin/lucia-fediverso
install -m 644 /root/lucia-infra/lucia-fediverso.service /root/lucia-infra/lucia-fediverso.timer /etc/systemd/system/
systemd-analyze verify /etc/systemd/system/lucia-fediverso.service /etc/systemd/system/lucia-fediverso.timer
/usr/local/sbin/lucia-fediverso; echo "saiu com $?"
systemctl daemon-reload
systemctl enable --now lucia-fediverso.timer
```

O que deve aparecer:

- os dois `install`: nada (sem mensagem é sucesso);
- `systemd-analyze verify`: nada. Se aparecer um aviso sobre `lucia-fediverso`, pare e confira se os arquivos chegaram inteiros;
- o teste à mão: `saiu com 0`. Se aparecer `ERRO: a entrega do Fediverso falhou: ...`, o site não respondeu em nenhuma das
  duas portas: confira `docker ps` (deve haver `site-a` ou `site-b`) antes de seguir;
- `systemctl enable`: `Created symlink /etc/systemd/system/timers.target.wants/lucia-fediverso.timer → ...`.

Quem prepara uma VPS nova não precisa destes passos: `infra/contabo/instalar.sh` já instala o timer.

## Conferir

```bash
systemctl list-timers lucia-fediverso.timer
journalctl -u lucia-fediverso -n 20 --no-pager
systemctl is-failed lucia-fediverso.service
```

- `list-timers`: uma linha com `lucia-fediverso.timer`; a coluna `LEFT` mostra menos de 30 s e a `LAST`, alguns segundos atrás.
- `journalctl`: pares de linhas `Starting Instituto Lucia: entrega a fila...` e `Finished Instituto Lucia: entrega a fila...`,
  de 30 em 30 segundos. Uma linha com `ERRO:` diz o que cada porta respondeu (`sem resposta`, `respondeu 503`...). Uma linha
  com `muitos pedidos neste minuto (429)` é só aviso.
- `is-failed`: `inactive` (ou `activating`, se pegar uma rodada no meio). `failed` quer dizer que a última rodada deu erro.

Uma rodada à mão, a qualquer hora: `systemctl start lucia-fediverso.service`.

Uma falha isolada durante a troca de versão do site ou logo depois de a VPS ligar é esperada: a rodada seguinte conserta.
Falha seguida é sinal de site ou banco fora do ar.

## Parar

```bash
systemctl disable --now lucia-fediverso.timer
```

Para de chamar na hora. A fila não se perde: a rotina do banco continua de reserva e, ligando de novo
(`systemctl enable --now lucia-fediverso.timer`), a entrega retoma de onde parou.

Para tirar de vez:

```bash
systemctl disable --now lucia-fediverso.timer
rm /etc/systemd/system/lucia-fediverso.service /etc/systemd/system/lucia-fediverso.timer /usr/local/sbin/lucia-fediverso
systemctl daemon-reload
```

Parar o timer **não desliga a federação**: as outras instâncias continuam entregando aqui. Para desligar a federação, veja
"Para desligar tudo" em `docs/rede/FEDIVERSO.md`.

## Ordem para pôr o Fediverso no ar

Uma etapa só começa quando a anterior deu certo.

1. **SQL.** Rodar `supabase/migracoes/20261109-fediverso-total.sql` no SQL Editor do Supabase (o segredo e a configuração
   `fediverso` do banco já devem estar feitos: `docs/rede/FEDIVERSO.md`, "Como ligar"). A migração entra com tudo desligado:
   nada muda para quem usa.
2. **Publicar.** Pôr a versão nova do site no ar e esperar a VPS trocar (até 2 minutos; `cat /opt/lucia/versao-no-ar` mostra
   a versão). O segredo `ALUMIA_FEDIVERSO_SEGREDO` precisa estar em `/opt/lucia/site.env` (`infra/contabo/segredos.ps1`).
3. **Ligar `fediverso-total` nos DOIS lados**, site e banco. Um lado só ligado deixa a federação pela metade.
   - Pelo painel: Painel › Site e operação › Controles avançados › Recursos › `fediverso-total` › Ligar. O site e o banco leem a
     mesma decisão.
   - Conferir o banco, no SQL Editor: `select interno.rede_fed_total();` deve responder `true`.
   - Conferir o site: abrir `https://alumia.institutolucia.org/.well-known/nodeinfo`. Com o modo total ligado aparecem DOIS
     endereços na lista (um termina em `schema/2.1` e o outro em `schema/2.0`); com um só, o site ainda está no modo antigo;
     com 404, a federação inteira está desligada (falta o segredo ou o recurso `rede-v2`).
   - Sem decisão no painel, cada lado segue a sua configuração: o site, a lista `NEXT_PUBLIC_RECURSOS` (com `fediverso-total`
     escrito pelo nome, e publicar de novo); o banco, a chave `total` da configuração `fediverso`.
   - Decisão do Instituto: o Threads **não entra** (bloqueio fixo, sem interruptor desde 12/11/2026) e o Bridgy Fed fica
     **desligado**. Os dois aparecem como fixos na lista de instâncias bloqueadas da moderação. Confira antes de seguir.
4. **Timer.** Instalar como está acima e conferir que as rodadas terminam sem `ERRO:`.
5. **Teste de caixa-preta.** Olhar de fora, como outra instância olharia: WebFinger, ator e NodeInfo nos dois endereços
   (`docs/plano-2026-11/PLANO-FEDIVERSO.md`, "Etapa A: caixa-preta"). Depois, a prova com uma conta de verdade num Mastodon:
   seguir, publicar, responder e ver chegar dos dois lados em menos de 1 minuto (`docs/rede/FEDIVERSO.md`, passo 6).

**Para voltar atrás:** desligar `fediverso-total` no painel (vale para os dois lados) e, se quiser, parar o timer. Não é
preciso desfazer o SQL.
