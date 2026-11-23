// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
package org.institutolucia.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Ao ligar o aparelho, reaplica o nome e o ícone disfarçados que a pessoa escolheu (AlumiaApp.aplicarDisfarce guarda a escolha).
 * Não abre tela, não faz rede, não lê nada além da escolha guardada. Qualquer outro aviso é ignorado.
 */
public class Reaplicar extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        if (intent == null || !Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        AlumiaApp.reaplicarDisfarce(ctx.getApplicationContext());
    }
}
