// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
package org.institutolucia.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattServer;
import android.bluetooth.BluetoothGattServerCallback;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.os.Build;
import android.os.ParcelUuid;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * O transporte sem internet no Android (onda R3, item 2.2; o núcleo é lib/rede/malha/**, o contrato é lib/rede/malha/android.ts):
 * Bluetooth LE, com o UUID de serviço da Alumia no anúncio e uma característica GATT por onde passam os pedaços (Malha.java).
 *
 *   ligar()                  pede a licença do Bluetooth (Android 12+), anuncia, procura, abre o servidor GATT
 *   desligar()               para tudo e esquece os pares
 *   mandar({ par, dados })   dados em base64url (o pacote de 3254 bytes)
 *   eventos "encontro" { par }, "pacote" { par, dados }, "fim" { par }
 *
 * O que este código NÃO faz, de propósito:
 *   - não lê, não guarda e não escolhe pacote (o núcleo em TypeScript decide tudo);
 *   - não manda o nome do aparelho no anúncio; o endereço Bluetooth é o aleatório do Android e nunca sobe para o TypeScript;
 *   - não usa o Google Play Services (Nearby Connections): funciona em aparelho sem Google;
 *   - não pede localização: só Android 12+ (BLUETOOTH_SCAN com neverForLocation). Em aparelho mais velho, recusa com
 *     "so_android_12" e a tela diz.
 * Só liga quando a pessoa ativa o modo, com o aviso (lib/rede/malha/ativacao.ts).
 */
@CapacitorPlugin(
    name = "AlumiaMalha",
    permissions = {
        @Permission(
            alias = "bluetooth",
            strings = { Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_ADVERTISE, Manifest.permission.BLUETOOTH_CONNECT }
        )
    }
)
@SuppressLint("MissingPermission") // toda chamada ao rádio passa por temLicenca() antes
public class AlumiaMalha extends Plugin {

    /** O serviço da Alumia (sorteado uma vez; fixo para todos os aparelhos). */
    static final UUID SERVICO = UUID.fromString("6c8f1d2a-4b7e-4f0c-9a51-3e2d7b9c0a14");
    static final UUID CARACTERISTICA = UUID.fromString("6c8f1d2b-4b7e-4f0c-9a51-3e2d7b9c0a14");
    static final UUID CCCD = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");
    static final int MTU_PEDIDO = 517;

    private Malha malha;
    private BluetoothManager gerente;
    private BluetoothGattServer servidor;
    private BluetoothGattCharacteristic caracteristicaDoServidor;
    private BluetoothLeAdvertiser anunciante;
    private BluetoothLeScanner procurador;
    private boolean ligado = false;
    /** Endereços (aleatórios) com conexão aberta ou abrindo: não abre outra com o mesmo. Nunca sai daqui. */
    private final Set<String> conectados = Collections.synchronizedSet(new HashSet<>());
    private final Map<String, String> parDoServidor = Collections.synchronizedMap(new HashMap<>());
    private final Map<String, Integer> mtuDoServidor = Collections.synchronizedMap(new HashMap<>());

    @Override
    public void load() {
        malha = new Malha(new Malha.Ouvinte() {
            @Override
            public void encontro(String par) {
                JSObject e = new JSObject();
                e.put("par", par);
                notifyListeners("encontro", e);
            }

            @Override
            public void pacote(String par, byte[] dados) {
                JSObject e = new JSObject();
                e.put("par", par);
                e.put("dados", Base64.encodeToString(dados, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING));
                notifyListeners("pacote", e);
            }

            @Override
            public void fim(String par) {
                JSObject e = new JSObject();
                e.put("par", par);
                notifyListeners("fim", e);
            }
        });
    }

    private boolean temLicenca() {
        return Build.VERSION.SDK_INT >= 31 && getPermissionState("bluetooth") == PermissionState.GRANTED;
    }

    @PluginMethod
    public void ligar(PluginCall call) {
        if (Build.VERSION.SDK_INT < 31) {
            call.reject("so_android_12", "so_android_12");
            return;
        }
        if (!temLicenca()) {
            requestPermissionForAlias("bluetooth", call, "depoisDaLicenca");
            return;
        }
        comecar(call);
    }

    @PermissionCallback
    private void depoisDaLicenca(PluginCall call) {
        if (!temLicenca()) {
            call.reject("sem_licenca", "sem_licenca");
            return;
        }
        comecar(call);
    }

    private synchronized void comecar(PluginCall call) {
        if (ligado) {
            call.resolve();
            return;
        }
        Context ctx = getContext();
        gerente = (BluetoothManager) ctx.getSystemService(Context.BLUETOOTH_SERVICE);
        BluetoothAdapter adaptador = gerente == null ? null : gerente.getAdapter();
        if (adaptador == null || !adaptador.isEnabled()) {
            call.reject("bluetooth_desligado", "bluetooth_desligado");
            return;
        }
        anunciante = adaptador.getBluetoothLeAdvertiser();
        procurador = adaptador.getBluetoothLeScanner();
        if (anunciante == null || procurador == null) {
            call.reject("sem_bluetooth_le", "sem_bluetooth_le");
            return;
        }
        // O servidor GATT: uma característica de escrita (os pedaços que chegam) e de aviso (os que saem).
        servidor = gerente.openGattServer(ctx, retornoDoServidor);
        if (servidor == null) {
            call.reject("sem_servidor", "sem_servidor");
            return;
        }
        BluetoothGattService servico = new BluetoothGattService(SERVICO, BluetoothGattService.SERVICE_TYPE_PRIMARY);
        caracteristicaDoServidor = new BluetoothGattCharacteristic(
            CARACTERISTICA,
            BluetoothGattCharacteristic.PROPERTY_WRITE | BluetoothGattCharacteristic.PROPERTY_NOTIFY,
            BluetoothGattCharacteristic.PERMISSION_WRITE
        );
        caracteristicaDoServidor.addDescriptor(new BluetoothGattDescriptor(CCCD, BluetoothGattDescriptor.PERMISSION_READ | BluetoothGattDescriptor.PERMISSION_WRITE));
        servico.addCharacteristic(caracteristicaDoServidor);
        servidor.addService(servico);
        // O anúncio: só o UUID do serviço; sem nome do aparelho, sem dado do fabricante.
        AdvertiseSettings ajustes = new AdvertiseSettings.Builder()
            .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_BALANCED)
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM)
            .setConnectable(true)
            .build();
        AdvertiseData dados = new AdvertiseData.Builder().setIncludeDeviceName(false).setIncludeTxPowerLevel(false).addServiceUuid(new ParcelUuid(SERVICO)).build();
        anunciante.startAdvertising(ajustes, dados, retornoDoAnuncio);
        ScanFilter filtro = new ScanFilter.Builder().setServiceUuid(new ParcelUuid(SERVICO)).build();
        ScanSettings comoProcurar = new ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_BALANCED).build();
        procurador.startScan(Collections.singletonList(filtro), comoProcurar, retornoDaProcura);
        ligado = true;
        call.resolve();
    }

    @PluginMethod
    public void desligar(PluginCall call) {
        parar();
        call.resolve();
    }

    private synchronized void parar() {
        if (!ligado) return;
        ligado = false;
        try {
            if (temLicenca()) {
                if (procurador != null) procurador.stopScan(retornoDaProcura);
                if (anunciante != null) anunciante.stopAdvertising(retornoDoAnuncio);
            }
        } catch (RuntimeException ignorado) {
            // o rádio pode ter sido desligado no meio
        }
        malha.fecharTudo();
        if (servidor != null && temLicenca()) servidor.close();
        servidor = null;
        conectados.clear();
        parDoServidor.clear();
        mtuDoServidor.clear();
    }

    @Override
    protected void handleOnDestroy() {
        parar();
    }

    @PluginMethod
    public void mandar(PluginCall call) {
        String par = call.getString("par");
        String dados = call.getString("dados");
        byte[] bytes;
        try {
            bytes = dados == null || dados.length() > 12000 ? null : Base64.decode(dados, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
        } catch (IllegalArgumentException e) {
            bytes = null;
        }
        if (par == null || bytes == null || !malha.mandar(par, bytes)) {
            call.reject("nao_mandado", "nao_mandado");
            return;
        }
        call.resolve();
    }

    // ── Procurar e conectar (este aparelho como cliente) ──

    private final ScanCallback retornoDaProcura = new ScanCallback() {
        @Override
        public void onScanResult(int tipo, ScanResult r) {
            BluetoothDevice d = r.getDevice();
            if (!ligado || d == null || !temLicenca() || !conectados.add(d.getAddress())) return;
            d.connectGatt(getContext(), false, new Cliente(d.getAddress()), BluetoothDevice.TRANSPORT_LE);
        }
    };

    private final AdvertiseCallback retornoDoAnuncio = new AdvertiseCallback() {};

    /** A conexão em que este aparelho é o cliente: escreve na característica do outro e recebe pelos avisos dela. */
    private final class Cliente extends BluetoothGattCallback {
        private final String endereco;
        private String par;
        private BluetoothGattCharacteristic c;
        private int mtu = 23;

        Cliente(String endereco) {
            this.endereco = endereco;
        }

        @Override
        public void onConnectionStateChange(BluetoothGatt g, int status, int estado) {
            if (estado == BluetoothProfile.STATE_CONNECTED && ligado) {
                g.requestMtu(MTU_PEDIDO);
            } else if (estado == BluetoothProfile.STATE_DISCONNECTED || !ligado) {
                conectados.remove(endereco);
                if (par != null) malha.fechado(par);
                g.close();
            }
        }

        @Override
        public void onMtuChanged(BluetoothGatt g, int mtu, int status) {
            this.mtu = mtu;
            g.discoverServices();
        }

        @Override
        public void onServicesDiscovered(BluetoothGatt g, int status) {
            BluetoothGattService s = g.getService(SERVICO);
            c = s == null ? null : s.getCharacteristic(CARACTERISTICA);
            BluetoothGattDescriptor d = c == null ? null : c.getDescriptor(CCCD);
            if (d == null) {
                g.disconnect();
                return;
            }
            g.setCharacteristicNotification(c, true);
            if (Build.VERSION.SDK_INT >= 33) {
                g.writeDescriptor(d, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
            } else {
                d.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                g.writeDescriptor(d);
            }
        }

        @Override
        public void onDescriptorWrite(BluetoothGatt g, BluetoothGattDescriptor d, int status) {
            if (status != BluetoothGatt.GATT_SUCCESS || par != null) return;
            final int pedaco = mtu - 3;
            par = malha.abrir(new Malha.Enlace() {
                @Override
                public int tamanhoDoPedaco() {
                    return pedaco;
                }

                @Override
                public boolean escrever(byte[] b) {
                    if (!temLicenca()) return false;
                    if (Build.VERSION.SDK_INT >= 33) {
                        return g.writeCharacteristic(c, b, BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT) == BluetoothGatt.GATT_SUCCESS;
                    }
                    c.setWriteType(BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT);
                    c.setValue(b);
                    return g.writeCharacteristic(c);
                }

                @Override
                public void fechar() {
                    if (temLicenca()) g.disconnect();
                }
            });
        }

        @Override
        public void onCharacteristicWrite(BluetoothGatt g, BluetoothGattCharacteristic ch, int status) {
            if (par == null) return;
            if (status != BluetoothGatt.GATT_SUCCESS) g.disconnect();
            else malha.pedacoMandado(par);
        }

        @Override
        public void onCharacteristicChanged(BluetoothGatt g, BluetoothGattCharacteristic ch, byte[] valor) {
            if (par != null) malha.chegou(par, valor);
        }

        @Override
        @SuppressWarnings("deprecation")
        public void onCharacteristicChanged(BluetoothGatt g, BluetoothGattCharacteristic ch) {
            if (Build.VERSION.SDK_INT >= 33) return; // no 13+ vem pelo de cima
            if (par != null) malha.chegou(par, ch.getValue());
        }
    }

    // ── O servidor (o outro aparelho é o cliente) ──

    private final BluetoothGattServerCallback retornoDoServidor = new BluetoothGattServerCallback() {
        @Override
        public void onConnectionStateChange(BluetoothDevice d, int status, int estado) {
            if (estado == BluetoothProfile.STATE_DISCONNECTED) {
                String par = parDoServidor.remove(d.getAddress());
                mtuDoServidor.remove(d.getAddress());
                if (par != null) malha.fechado(par);
            }
        }

        @Override
        public void onMtuChanged(BluetoothDevice d, int mtu) {
            mtuDoServidor.put(d.getAddress(), mtu);
        }

        @Override
        public void onDescriptorWriteRequest(BluetoothDevice d, int pedido, BluetoothGattDescriptor desc, boolean preparado, boolean resposta, int deslocamento, byte[] valor) {
            BluetoothGattServer s = servidor;
            if (s == null || !temLicenca()) return;
            if (resposta) s.sendResponse(d, pedido, BluetoothGatt.GATT_SUCCESS, 0, null);
            // O outro lado pediu os avisos: agora dá para mandar nos dois sentidos. É um encontro.
            if (CCCD.equals(desc.getUuid()) && java.util.Arrays.equals(valor, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE) && !parDoServidor.containsKey(d.getAddress())) {
                Integer mtu = mtuDoServidor.get(d.getAddress());
                final int pedaco = (mtu == null ? 23 : mtu) - 3;
                String par = malha.abrir(new Malha.Enlace() {
                    @Override
                    public int tamanhoDoPedaco() {
                        return pedaco;
                    }

                    @Override
                    @SuppressWarnings("deprecation")
                    public boolean escrever(byte[] b) {
                        BluetoothGattServer s2 = servidor;
                        if (s2 == null || !temLicenca()) return false;
                        if (Build.VERSION.SDK_INT >= 33) {
                            return s2.notifyCharacteristicChanged(d, caracteristicaDoServidor, false, b) == BluetoothGatt.GATT_SUCCESS;
                        }
                        caracteristicaDoServidor.setValue(b);
                        return s2.notifyCharacteristicChanged(d, caracteristicaDoServidor, false);
                    }

                    @Override
                    public void fechar() {
                        BluetoothGattServer s2 = servidor;
                        if (s2 != null && temLicenca()) s2.cancelConnection(d);
                    }
                });
                parDoServidor.put(d.getAddress(), par);
            }
        }

        @Override
        public void onCharacteristicWriteRequest(BluetoothDevice d, int pedido, BluetoothGattCharacteristic c, boolean preparado, boolean resposta, int deslocamento, byte[] valor) {
            BluetoothGattServer s = servidor;
            if (s == null || !temLicenca()) return;
            // Escrita preparada (em partes do próprio GATT) não é usada pela Alumia: recusada.
            boolean aceita = !preparado && deslocamento == 0 && CARACTERISTICA.equals(c.getUuid());
            if (resposta) s.sendResponse(d, pedido, aceita ? BluetoothGatt.GATT_SUCCESS : BluetoothGatt.GATT_FAILURE, 0, null);
            String par = parDoServidor.get(d.getAddress());
            if (aceita && par != null) malha.chegou(par, valor);
        }

        @Override
        public void onNotificationSent(BluetoothDevice d, int status) {
            String par = parDoServidor.get(d.getAddress());
            if (par == null) return;
            if (status != BluetoothGatt.GATT_SUCCESS) malha.fechado(par);
            else malha.pedacoMandado(par);
        }
    };
}
