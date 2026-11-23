// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
package org.institutolucia.app;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.security.SecureRandom;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import org.junit.Test;

/**
 * Onda R3, item 2.2, o lado nativo do sem internet com um TRANSPORTE FALSO (o emulador não tem Bluetooth): dois aparelhos ligados
 * por enlaces de mentira que entregam cada pedaço ao outro lado, com o tamanho de pedaço do Bluetooth (MTU 517 e o mínimo, 23).
 * Os ataques estão escritos como teste (cada um passaria sem a defesa de Malha.java).
 * Uso: cd android && ./gradlew :app:testDebugUnitTest
 */
public class MalhaTest {

    /** O que um aparelho viu subir para o TypeScript. */
    static final class Visto implements Malha.Ouvinte {
        final List<String> encontros = new ArrayList<>();
        final List<byte[]> pacotes = new ArrayList<>();
        final List<String> fins = new ArrayList<>();

        @Override
        public void encontro(String par) {
            encontros.add(par);
        }

        @Override
        public void pacote(String par, byte[] dados) {
            pacotes.add(dados);
        }

        @Override
        public void fim(String par) {
            fins.add(par);
        }
    }

    /** Um enlace falso: o que se escreve aqui chega do outro lado (na hora, como um rádio sem perda). */
    static final class Falso implements Malha.Enlace {
        final int pedaco;
        Malha meu;
        String meuPar;
        Malha outro;
        String parDoOutro;
        boolean fechado = false;
        final List<byte[]> escritos = new ArrayList<>();

        Falso(int pedaco) {
            this.pedaco = pedaco;
        }

        @Override
        public int tamanhoDoPedaco() {
            return pedaco;
        }

        @Override
        public boolean escrever(byte[] b) {
            if (fechado) return false;
            if (b.length > pedaco) throw new AssertionError("pedaço maior que o enlace aceita");
            escritos.add(b);
            outro.chegou(parDoOutro, b);
            meu.pedacoMandado(meuPar);
            return true;
        }

        @Override
        public void fechar() {
            fechado = true;
        }
    }

    static byte[] sorteados(int n) {
        byte[] b = new byte[n];
        new SecureRandom().nextBytes(b);
        return b;
    }

    /** Dois aparelhos ligados por um enlace falso em cada sentido. */
    static final class Dupla {
        final Visto va = new Visto();
        final Visto vb = new Visto();
        final Malha a = new Malha(va);
        final Malha b = new Malha(vb);
        final Falso ab;
        final Falso ba;
        final String parEmA;
        final String parEmB;

        Dupla(int pedaco) {
            ab = new Falso(pedaco);
            ba = new Falso(pedaco);
            parEmA = a.abrir(ab);
            parEmB = b.abrir(ba);
            ab.meu = a;
            ab.meuPar = parEmA;
            ab.outro = b;
            ab.parDoOutro = parEmB;
            ba.meu = b;
            ba.meuPar = parEmB;
            ba.outro = a;
            ba.parDoOutro = parEmA;
        }
    }

    @Test
    public void oPacoteDaAlumiaPassaInteiroNosDoisSentidos() {
        for (int pedaco : new int[] { 514, 20 }) {
            Dupla d = new Dupla(pedaco);
            byte[] p1 = sorteados(3254);
            byte[] p2 = sorteados(3254);
            assertTrue(d.a.mandar(d.parEmA, p1));
            assertTrue(d.b.mandar(d.parEmB, p2));
            assertEquals(1, d.vb.pacotes.size());
            assertArrayEquals(p1, d.vb.pacotes.get(0));
            assertEquals(1, d.va.pacotes.size());
            assertArrayEquals(p2, d.va.pacotes.get(0));
        }
    }

    @Test
    public void muitosPacotesEmSequenciaChegamNaOrdemSemSeMisturar() {
        Dupla d = new Dupla(514);
        List<byte[]> mandados = new ArrayList<>();
        for (int i = 0; i < 64; i++) {
            byte[] p = sorteados(3254);
            mandados.add(p);
            assertTrue(d.a.mandar(d.parEmA, p));
        }
        assertEquals(64, d.vb.pacotes.size());
        for (int i = 0; i < 64; i++) assertArrayEquals(mandados.get(i), d.vb.pacotes.get(i));
    }

    @Test
    public void oParEUmNumeroDaSessaoNuncaOEndereco() {
        Dupla d = new Dupla(514);
        assertTrue(d.parEmA.matches("^[0-9]+$"));
        assertEquals(1, d.va.encontros.size());
    }

    @Test
    public void ataquePacoteGrandeDemaisNaoSaiNemEntra() {
        Dupla d = new Dupla(514);
        assertFalse(d.a.mandar(d.parEmA, sorteados(Malha.MAXIMO + 1)));
        assertFalse(d.a.mandar(d.parEmA, new byte[0]));
        assertFalse(d.a.mandar(d.parEmA, null));
        // Um vizinho que anuncia 65535 bytes: recusado no começo.
        d.b.chegou(d.parEmB, new byte[] { Malha.COMECO, (byte) 0xff, (byte) 0xff, 1, 2, 3 });
        d.b.chegou(d.parEmB, new byte[] { Malha.CONTINUACAO, 4, 5, 6 });
        assertEquals(0, d.vb.pacotes.size());
    }

    @Test
    public void ataqueContinuacaoSemComecoECabecalhoMentiroso() {
        Dupla d = new Dupla(514);
        d.b.chegou(d.parEmB, new byte[] { Malha.CONTINUACAO, 1, 2, 3 });
        // Diz 4 bytes e manda 6 de uma vez.
        d.b.chegou(d.parEmB, new byte[] { Malha.COMECO, 0, 4, 1, 2, 3, 4, 5, 6 });
        // Diz 4 bytes, manda 2 e depois uma continuação de 3 (passa do dito).
        d.b.chegou(d.parEmB, new byte[] { Malha.COMECO, 0, 4, 1, 2 });
        d.b.chegou(d.parEmB, new byte[] { Malha.CONTINUACAO, 3, 4, 5 });
        d.b.chegou(d.parEmB, new byte[] { Malha.CONTINUACAO, 6 });
        // Tipo desconhecido, pedaço vazio, nulo, tamanho zero.
        d.b.chegou(d.parEmB, new byte[] { 0x7f, 1, 2 });
        d.b.chegou(d.parEmB, new byte[0]);
        d.b.chegou(d.parEmB, null);
        d.b.chegou(d.parEmB, new byte[] { Malha.COMECO, 0, 0 });
        assertEquals(0, d.vb.pacotes.size());
    }

    @Test
    public void ataqueComecoNoMeioDeOutroPacoteNaoEmendaPedacoVelho() {
        Dupla d = new Dupla(514);
        d.b.chegou(d.parEmB, new byte[] { Malha.COMECO, 0, 6, 9, 9, 9 });
        d.b.chegou(d.parEmB, new byte[] { Malha.COMECO, 0, 3, 1, 2 });
        d.b.chegou(d.parEmB, new byte[] { Malha.CONTINUACAO, 3 });
        assertEquals(1, d.vb.pacotes.size());
        assertArrayEquals(new byte[] { 1, 2, 3 }, d.vb.pacotes.get(0));
    }

    @Test
    public void ataquePacoteDeParQueNaoExisteSome() {
        Dupla d = new Dupla(514);
        d.b.chegou("999", new byte[] { Malha.COMECO, 0, 1, 7 });
        assertFalse(d.b.mandar("999", sorteados(10)));
        assertEquals(0, d.vb.pacotes.size());
    }

    @Test
    public void filaDeSaidaTemTeto() {
        Visto v = new Visto();
        Malha m = new Malha(v);
        // Um enlace que nunca termina de mandar (rádio parado): a fila enche e para em FILA_MAXIMA.
        String par = m.abrir(new Malha.Enlace() {
            @Override
            public int tamanhoDoPedaco() {
                return 514;
            }

            @Override
            public boolean escrever(byte[] b) {
                return true;
            }

            @Override
            public void fechar() {}
        });
        int aceitos = 0;
        for (int i = 0; i < Malha.FILA_MAXIMA + 50; i++) if (m.mandar(par, sorteados(3254))) aceitos++;
        // O primeiro sai da fila para o rádio; cabem mais FILA_MAXIMA esperando.
        assertEquals(Malha.FILA_MAXIMA + 1, aceitos);
    }

    @Test
    public void desligarFechaTodosOsEnlacesEAvisaOFim() {
        Dupla d = new Dupla(514);
        d.a.fecharTudo();
        assertTrue(d.ab.fechado);
        assertEquals(1, d.va.fins.size());
        assertEquals(0, d.a.quantosPares());
        assertFalse(d.a.mandar(d.parEmA, sorteados(10)));
        // Fechar de novo não avisa de novo.
        d.a.fechado(d.parEmA);
        assertEquals(1, d.va.fins.size());
    }

    @Test
    public void radioQueRecusaEscritaFechaOPar() {
        Visto v = new Visto();
        Malha m = new Malha(v);
        String par = m.abrir(new Malha.Enlace() {
            @Override
            public int tamanhoDoPedaco() {
                return 514;
            }

            @Override
            public boolean escrever(byte[] b) {
                return false;
            }

            @Override
            public void fechar() {}
        });
        m.mandar(par, sorteados(100));
        assertEquals(1, v.fins.size());
        assertEquals(0, m.quantosPares());
    }

    @Test
    public void cortarRespeitaOTamanhoDoPedaco() {
        ArrayDeque<byte[]> fila = new ArrayDeque<>();
        Malha.cortar(sorteados(3254), 20, fila);
        for (byte[] p : fila) assertTrue(p.length <= 20);
        // 17 bytes no começo e 19 em cada continuação.
        assertEquals(1 + (int) Math.ceil((3254 - 17) / 19.0), fila.size());
    }
}
