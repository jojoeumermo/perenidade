// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
package org.institutolucia.app;

import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.Map;

/**
 * O meio do transporte sem internet (onda R3, item 2.2; contrato em lib/rede/malha/android.ts), sem Bluetooth: só os pares e os
 * pedaços. O Bluetooth (AlumiaMalha) entrega a esta classe cada conexão como um {@link Enlace}; esta classe corta cada pacote em
 * pedaços do tamanho que o enlace aceita, junta os pedaços que chegam e avisa o núcleo em TypeScript ("encontro", "pacote", "fim").
 *
 * SÓ MOVE BYTES: não lê, não guarda e não escolhe pacote (o núcleo, lib/rede/malha/no.ts, confere tamanho, validade, repetição).
 * O "par" que o núcleo vê é um número desta sessão, nunca o endereço Bluetooth.
 *
 * Formato de cada pedaço (só entre dois aparelhos da Alumia): 1 byte de tipo (0x01 começo, 0x02 continuação) e, no começo, o
 * tamanho total em 2 bytes (big-endian), seguido dos bytes. Defesas (cada uma vira teste em MalhaTest):
 *   - pacote maior que {@link MAXIMO} é recusado na ida e na volta (um vizinho não enche a memória);
 *   - continuação sem começo, começo no meio de outro pacote, pedaço que passa do tamanho dito: o que estava sendo juntado some;
 *   - fila de saída por par limitada a {@link FILA_MAXIMA} pacotes (o resto some: o núcleo repassa de novo no próximo encontro).
 */
public final class Malha {

    /** O núcleo aceita qualquer tamanho e confere; aqui só um teto (o pacote da Alumia tem 3254 bytes). */
    public static final int MAXIMO = 8192;
    public static final int FILA_MAXIMA = 128;
    static final byte COMECO = 0x01;
    static final byte CONTINUACAO = 0x02;

    /** Uma conexão com um aparelho (Bluetooth, ou falsa no teste). */
    public interface Enlace {
        /** Quantos bytes cabem num pedaço (o MTU combinado, menos o cabeçalho do GATT). */
        int tamanhoDoPedaco();
        /** Manda um pedaço. Quando o enlace terminar de mandar, chama {@link Malha#pedacoMandado(String)}. Falso se não deu. */
        boolean escrever(byte[] pedaco);
        void fechar();
    }

    /** O que sobe para o TypeScript. */
    public interface Ouvinte {
        void encontro(String par);
        void pacote(String par, byte[] dados);
        void fim(String par);
    }

    private static final class Par {
        final Enlace enlace;
        final ArrayDeque<byte[]> saida = new ArrayDeque<>();
        final ArrayDeque<byte[]> pedacos = new ArrayDeque<>();
        boolean escrevendo = false;
        byte[] juntando = null;
        int juntados = 0;

        Par(Enlace e) {
            enlace = e;
        }
    }

    private final Ouvinte ouvinte;
    private final Map<String, Par> pares = new HashMap<>();
    private long proximo = 1;

    public Malha(Ouvinte ouvinte) {
        this.ouvinte = ouvinte;
    }

    /** Um aparelho da Alumia por perto: devolve o número do par (o que o TypeScript vê). */
    public synchronized String abrir(Enlace e) {
        String par = Long.toString(proximo++);
        pares.put(par, new Par(e));
        ouvinte.encontro(par);
        return par;
    }

    /** A conexão acabou (do outro lado ou do rádio). */
    public void fechado(String par) {
        Par p;
        synchronized (this) {
            p = pares.remove(par);
        }
        if (p != null) ouvinte.fim(par);
    }

    /** Fecha tudo e esquece os pares (desligar). */
    public void fecharTudo() {
        Map<String, Par> todos;
        synchronized (this) {
            todos = new HashMap<>(pares);
            pares.clear();
        }
        for (Map.Entry<String, Par> e : todos.entrySet()) {
            try {
                e.getValue().enlace.fechar();
            } catch (RuntimeException ignorado) {
                // o rádio já pode ter fechado
            }
            ouvinte.fim(e.getKey());
        }
    }

    public synchronized int quantosPares() {
        return pares.size();
    }

    /** Manda um pacote a um par. Falso se o par não existe, o pacote é grande demais ou a fila está cheia. */
    public boolean mandar(String par, byte[] dados) {
        if (dados == null || dados.length == 0 || dados.length > MAXIMO) return false;
        Par p;
        synchronized (this) {
            p = pares.get(par);
            if (p == null || p.saida.size() >= FILA_MAXIMA) return false;
            p.saida.add(dados.clone());
        }
        bombear(par);
        return true;
    }

    /** O enlace terminou de mandar o último pedaço: segue com o próximo. */
    public void pedacoMandado(String par) {
        synchronized (this) {
            Par p = pares.get(par);
            if (p == null) return;
            p.escrevendo = false;
        }
        bombear(par);
    }

    private void bombear(String par) {
        byte[] pedaco;
        Enlace enlace;
        synchronized (this) {
            Par p = pares.get(par);
            if (p == null || p.escrevendo) return;
            if (p.pedacos.isEmpty()) {
                byte[] proximoPacote = p.saida.poll();
                if (proximoPacote == null) return;
                cortar(proximoPacote, p.enlace.tamanhoDoPedaco(), p.pedacos);
            }
            pedaco = p.pedacos.poll();
            if (pedaco == null) return;
            p.escrevendo = true;
            enlace = p.enlace;
        }
        if (!enlace.escrever(pedaco)) {
            // O rádio recusou: o par acabou.
            fechado(par);
        }
    }

    /** Corta um pacote em pedaços de até `tamanho` bytes, com o cabeçalho. */
    static void cortar(byte[] dados, int tamanho, ArrayDeque<byte[]> fila) {
        if (tamanho < 4) throw new IllegalArgumentException("pedaco_pequeno");
        int pos = 0;
        boolean primeiro = true;
        while (pos < dados.length || primeiro) {
            int cabecalho = primeiro ? 3 : 1;
            int n = Math.min(tamanho - cabecalho, dados.length - pos);
            byte[] pedaco = new byte[cabecalho + n];
            pedaco[0] = primeiro ? COMECO : CONTINUACAO;
            if (primeiro) {
                pedaco[1] = (byte) ((dados.length >>> 8) & 0xff);
                pedaco[2] = (byte) (dados.length & 0xff);
            }
            System.arraycopy(dados, pos, pedaco, cabecalho, n);
            fila.add(pedaco);
            pos += n;
            primeiro = false;
        }
    }

    /** Um pedaço chegou deste par. Quando o pacote fica inteiro, sobe para o TypeScript. */
    public void chegou(String par, byte[] pedaco) {
        byte[] inteiro = null;
        synchronized (this) {
            Par p = pares.get(par);
            if (p == null || pedaco == null || pedaco.length < 1) return;
            if (pedaco[0] == COMECO) {
                if (pedaco.length < 3) {
                    p.juntando = null;
                    return;
                }
                int total = ((pedaco[1] & 0xff) << 8) | (pedaco[2] & 0xff);
                if (total == 0 || total > MAXIMO || pedaco.length - 3 > total) {
                    p.juntando = null;
                    return;
                }
                // Um começo no meio de outro pacote: o anterior some (não se emenda pedaço velho em pacote novo).
                p.juntando = new byte[total];
                System.arraycopy(pedaco, 3, p.juntando, 0, pedaco.length - 3);
                p.juntados = pedaco.length - 3;
            } else if (pedaco[0] == CONTINUACAO) {
                if (p.juntando == null) return; // continuação sem começo
                int n = pedaco.length - 1;
                if (p.juntados + n > p.juntando.length) {
                    p.juntando = null; // passou do tamanho dito
                    return;
                }
                System.arraycopy(pedaco, 1, p.juntando, p.juntados, n);
                p.juntados += n;
            } else {
                p.juntando = null; // tipo desconhecido
                return;
            }
            if (p.juntando != null && p.juntados == p.juntando.length) {
                inteiro = p.juntando;
                p.juntando = null;
                p.juntados = 0;
            }
        }
        if (inteiro != null) ouvinte.pacote(par, inteiro);
    }
}
