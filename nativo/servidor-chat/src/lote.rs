// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O juntador de lotes (o mesmo de lib/rede/caixas/rota.ts): cada pedido entrega os itens e recebe a promessa do resultado. O lote sai
// quando junta 64 itens, quando passam 2 s do primeiro, ou quando o dia (UTC) muda; chat.caixa_lote grava o lote inteiro numa
// transação só, em ordem sorteada (o mesmo xmin para todos; a posição no disco não diz quem chegou antes). Lote que o banco não grava
// responde "rede" a todos os itens dele.

use std::time::Duration;

use deadpool_postgres::Pool;
use serde_json::{Value, json};
use tokio::sync::{mpsc, oneshot};

pub const MAXIMO: usize = 64;

pub struct Item {
    pub item: Value,
    pub dia: String,
    pub volta: oneshot::Sender<Value>,
}

#[derive(Clone)]
pub struct Juntador {
    entrada: mpsc::Sender<Item>,
}

impl Juntador {
    pub fn novo(banco: Pool, espera: Duration) -> Self {
        let (entrada, mut saida) = mpsc::channel::<Item>(4096);
        tokio::spawn(async move {
            let mut guardado: Option<Item> = None;
            loop {
                let primeiro = match guardado.take() {
                    Some(i) => i,
                    None => match saida.recv().await {
                        Some(i) => i,
                        None => return,
                    },
                };
                let dia = primeiro.dia.clone();
                let mut lote = vec![primeiro];
                let fim = tokio::time::Instant::now() + espera;
                while lote.len() < MAXIMO {
                    match tokio::time::timeout_at(fim, saida.recv()).await {
                        Ok(Some(i)) if i.dia == dia => lote.push(i),
                        Ok(Some(i)) => {
                            guardado = Some(i);
                            break;
                        }
                        Ok(None) | Err(_) => break,
                    }
                }
                gravar(&banco, lote, &dia).await;
            }
        });
        Juntador { entrada }
    }

    /// Põe um item no lote e espera o resultado dele.
    pub async fn juntar(&self, item: Value, dia: String) -> Value {
        let (volta, resposta) = oneshot::channel();
        if self.entrada.send(Item { item, dia, volta }).await.is_err() {
            return json!({ "ok": false, "erro": "rede" });
        }
        resposta.await.unwrap_or_else(|_| json!({ "ok": false, "erro": "rede" }))
    }
}

async fn gravar(banco: &Pool, lote: Vec<Item>, dia: &str) {
    let itens = Value::Array(lote.iter().map(|i| i.item.clone()).collect());
    let resultados: Option<Vec<Value>> = async {
        let c = banco.get().await.ok()?;
        let linha = c.query_one("select chat.caixa_lote($1::jsonb, ($2::text)::date)", &[&itens, &dia]).await.ok()?;
        let r: Value = linha.try_get(0).ok()?;
        let lista = r.get("resultados")?.as_array()?.clone();
        (lista.len() == lote.len()).then_some(lista)
    }
    .await;
    for (i, item) in lote.into_iter().enumerate() {
        let r = resultados.as_ref().map(|l| l[i].clone()).unwrap_or_else(|| json!({ "ok": false, "erro": "rede" }));
        let _ = item.volta.send(r);
    }
}
