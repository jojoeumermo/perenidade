// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
package org.institutolucia.app;

import android.content.Context;
import android.util.AttributeSet;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputConnection;
import com.getcapacitor.CapacitorWebView;

/**
 * O WebView da casca do chat, com o teclado SEM aprendizado: todo campo de texto pede ao teclado (IME_FLAG_NO_PERSONALIZED_LEARNING)
 * para não guardar o que foi digitado no dicionário pessoal nem usar para sugestões. O HTML não tem atributo para isso; por isso
 * o pedido é feito aqui, na ligação entre o WebView e o teclado. Entra no lugar do WebView do Capacitor pelo layout
 * res/layout/capacitor_bridge_layout_main.xml (o do app vence o da biblioteca).
 * Limite: é um PEDIDO ao teclado; teclados de terceiros podem ignorar (o Gboard e o teclado do AOSP respeitam).
 */
public class CampoSemAprendizado extends CapacitorWebView {

    public CampoSemAprendizado(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    @Override
    public InputConnection onCreateInputConnection(EditorInfo outAttrs) {
        InputConnection ligacao = super.onCreateInputConnection(outAttrs);
        outAttrs.imeOptions |= EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING;
        return ligacao;
    }
}
