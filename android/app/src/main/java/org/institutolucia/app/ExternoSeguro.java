// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
package org.institutolucia.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;

/** Abre um endereço https no navegador do aparelho (só depois da confirmação nativa de quem chama). */
final class ExternoSeguro {

    private ExternoSeguro() {}

    static boolean abrir(Activity a, Uri u) {
        if (u == null || !"https".equals(u.getScheme())) return false;
        Intent i = new Intent(Intent.ACTION_VIEW, u).addCategory(Intent.CATEGORY_BROWSABLE);
        try {
            a.startActivity(i);
            return true;
        } catch (ActivityNotFoundException semNavegador) {
            return false;
        }
    }
}
