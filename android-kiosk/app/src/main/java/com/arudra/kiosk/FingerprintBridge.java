package com.arudra.kiosk;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.arudra.kiosk.sensor.SensorAdapter;
import com.arudra.kiosk.sensor.SensorRegistry;

import org.json.JSONObject;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Exposed to the CRM page as window.AndroidFingerprint (matches frontend/src/lib/fingerprintBridge.ts).
 * Fingerprint data is passed straight to the page and never stored on the phone.
 */
public class FingerprintBridge {
    private static final String ACTION_USB_PERMISSION = "com.arudra.kiosk.USB_PERMISSION";
    private static final int CAPTURE_TIMEOUT_MS = 20000;

    private final Context context;
    private final WebView webView;
    private final UsbManager usb;
    private final SensorAdapter[] adapters = SensorRegistry.create();
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final AtomicReference<String> activeRequest = new AtomicReference<>();

    private volatile SensorAdapter ready;   // adapter opened and ready to capture
    private volatile String lastError = "";

    public FingerprintBridge(Context context, WebView webView) {
        this.context = context;
        this.webView = webView;
        this.usb = (UsbManager) context.getSystemService(Context.USB_SERVICE);
        IntentFilter f = new IntentFilter(ACTION_USB_PERMISSION);
        if (Build.VERSION.SDK_INT >= 33) {
            context.registerReceiver(permissionReceiver, f, Context.RECEIVER_NOT_EXPORTED);
        } else {
            context.registerReceiver(permissionReceiver, f);
        }
    }

    /** Look for a supported scanner and ask for USB permission if needed. Call on start and on attach. */
    public void scan() {
        for (UsbDevice d : usb.getDeviceList().values()) {
            if (SensorRegistry.forDevice(adapters, d) == null) continue;
            if (usb.hasPermission(d)) {
                openDevice(d);
            } else {
                int flags = PendingIntent.FLAG_UPDATE_CURRENT
                        | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
                Intent i = new Intent(ACTION_USB_PERMISSION).setPackage(context.getPackageName());
                usb.requestPermission(d, PendingIntent.getBroadcast(context, 0, i, flags));
            }
            return;
        }
        closeReady();
    }

    private final BroadcastReceiver permissionReceiver = new BroadcastReceiver() {
        @Override public void onReceive(Context c, Intent intent) {
            UsbDevice d = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
            if (d != null && intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)) openDevice(d);
        }
    };

    private void openDevice(UsbDevice d) {
        SensorAdapter a = SensorRegistry.forDevice(adapters, d);
        if (a == null) return;
        worker.execute(() -> {
            try {
                closeReady();
                a.open(context, d);
                ready = a;
                lastError = "";
            } catch (SensorAdapter.SensorException e) {
                lastError = e.getMessage();
            }
        });
    }

    private void closeReady() {
        SensorAdapter a = ready;
        ready = null;
        if (a != null) a.close();
    }

    // ---- JavaScript interface (called on a binder thread) ----

    @JavascriptInterface public boolean isReady() { return ready != null; }

    @JavascriptInterface public void capture(final String requestId) {
        activeRequest.set(requestId);
        worker.execute(() -> {
            SensorAdapter a = ready;
            if (a == null) {
                reply(requestId, error(lastError.isEmpty() ? "Plug in the fingerprint scanner." : lastError));
                return;
            }
            try {
                SensorAdapter.Capture c = a.capture(CAPTURE_TIMEOUT_MS);
                if (!requestId.equals(activeRequest.get())) return;   // cancelled
                JSONObject o = new JSONObject();
                o.put("ok", true);
                o.put("format", c.format);
                o.put("width", c.width);
                o.put("height", c.height);
                o.put("dpi", c.dpi);
                o.put("data", Base64.encodeToString(c.data, Base64.NO_WRAP));
                reply(requestId, o.toString());
            } catch (SensorAdapter.SensorException e) {
                reply(requestId, error(e.getMessage()));
            } catch (Exception e) {
                reply(requestId, error("Could not read the finger. Try again."));
            }
        });
    }

    @JavascriptInterface public void cancel() {
        activeRequest.set(null);
        SensorAdapter a = ready;
        if (a != null) a.cancel();
    }

    private static String error(String msg) {
        try { return new JSONObject().put("ok", false).put("error", msg).toString(); }
        catch (Exception e) { return "{\"ok\":false,\"error\":\"Scanner error\"}"; }
    }

    private void reply(String requestId, String json) {
        if (!requestId.equals(activeRequest.get())) return;
        activeRequest.set(null);
        final String js = "window.onFingerprintCapture&&window.onFingerprintCapture("
                + JSONObject.quote(requestId) + "," + JSONObject.quote(json) + ")";
        main.post(() -> webView.evaluateJavascript(js, null));
    }

    public void destroy() {
        try { context.unregisterReceiver(permissionReceiver); } catch (Exception ignored) { }
        closeReady();
        worker.shutdownNow();
    }
}
