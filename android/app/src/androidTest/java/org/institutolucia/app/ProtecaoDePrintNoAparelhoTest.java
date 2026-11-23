// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
package org.institutolucia.app;

import static org.junit.Assert.assertTrue;

import android.view.WindowManager;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Prompt 4, item 1 (a parte Android): as telas do app saem pretas no print, na gravação, no espelhamento e na miniatura de apps
 * recentes. O FLAG_SECURE vale para a janela inteira: a tela do chat (MainActivity: conversas, visualização única) e a rede social
 * (RedeActivity: stories, perfis e fotos protegidos). Uso: cd android && ./gradlew connectedDebugAndroidTest.
 */
@RunWith(AndroidJUnit4.class)
public class ProtecaoDePrintNoAparelhoTest {

    private static boolean segura(android.app.Activity a) {
        return (a.getWindow().getAttributes().flags & WindowManager.LayoutParams.FLAG_SECURE) != 0;
    }

    @Test
    public void aTelaDoChatSaiPretaNoPrint() {
        try (ActivityScenario<MainActivity> tela = ActivityScenario.launch(MainActivity.class)) {
            tela.onActivity(a -> assertTrue("FLAG_SECURE na tela do chat", segura(a)));
        }
    }

    @Test
    public void aRedeSocialSaiPretaNoPrint() {
        try (ActivityScenario<RedeActivity> tela = ActivityScenario.launch(RedeActivity.class)) {
            tela.onActivity(a -> assertTrue("FLAG_SECURE na rede social", segura(a)));
        }
    }
}
