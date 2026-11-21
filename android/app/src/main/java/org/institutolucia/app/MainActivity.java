// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
package org.institutolucia.app;

import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

/**
 * A tela do chat (onda R3, itens 1.2 e 2.3): a casca estática do chat, servida pelo próprio app em https://localhost, com a ponte
 * para os plugins próprios. Nenhuma página remota entra aqui (sem server.url; o AlumiaApp bloqueia toda navegação para fora).
 *
 * FLAG_SECURE: o sistema não deixa capturar a tela nem gravar, e a foto da troca de apps sai em branco. No Android 13+ a foto da
 * troca de apps também é desligada de vez (setRecentsScreenshotEnabled). O app não tem nenhum filtro de link (deep link): nenhum
 * endereço de fora abre nada aqui dentro.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AlumiaCofre.class);
        registerPlugin(AlumiaApp.class);
        registerPlugin(AlumiaMalha.class);
        registerPlugin(AlumiaAparelho.class);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        if (Build.VERSION.SDK_INT >= 33) setRecentsScreenshotEnabled(false);
        super.onCreate(savedInstanceState);
        AlumiaApp.reaplicarDisfarce(getApplicationContext());
        AlumiaApp.tituloDaTarefa(this);
    }
}
