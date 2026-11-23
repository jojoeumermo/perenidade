// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Arquivo de TESTE das regras de alumia-kotlin.yml (semgrep --test .semgrep). Não é código do app.
package teste

import android.util.Log
import android.webkit.WebView
import java.security.SecureRandom
import javax.crypto.spec.SecretKeySpec

fun sorteios(): ByteArray {
    // ruleid: alumia-kotlin-sorteio-fraco
    val fraco = java.util.Random(42)
    // ok: alumia-kotlin-sorteio-fraco
    val forte = SecureRandom()
    val b = ByteArray(32)
    forte.nextBytes(b)
    fraco.nextInt()
    return b
}

fun registro(pacote: ByteArray) {
    // ruleid: alumia-kotlin-sem-log-de-conteudo
    Log.d("Alumia", "pacote ${pacote.size}")
}

fun ponte(w: WebView, objeto: Any) {
    // ruleid: alumia-kotlin-webview-ponte-remota
    w.addJavascriptInterface(objeto, "Alumia")
}

fun chave(bytes: ByteArray): SecretKeySpec {
    // ruleid: alumia-kotlin-chave-exportavel
    return SecretKeySpec(bytes, "AES")
}
