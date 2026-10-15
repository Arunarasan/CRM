package com.arudra.kiosk;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Full-screen WebView that opens the CRM kiosk page and gives it the USB fingerprint bridge. */
public class MainActivity extends Activity {
    private WebView webView;
    private FingerprintBridge bridge;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);                    // kiosk keeps its pairing token in localStorage
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setGeolocationEnabled(true);

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> request.grant(request.getResources()));   // camera for the selfie
            }
            @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
                cb.invoke(origin, true, false);
            }
        });

        bridge = new FingerprintBridge(this, webView);
        webView.addJavascriptInterface(bridge, "AndroidFingerprint");

        requestPermissions(new String[] { Manifest.permission.CAMERA, Manifest.permission.ACCESS_FINE_LOCATION }, 1);
        webView.loadUrl(BuildConfig.KIOSK_URL);
    }

    @Override protected void onStart() {
        super.onStart();
        hideSystemBars();
        bridge.scan();
    }

    @Override protected void onNewIntent(Intent intent) {   // scanner plugged in while app is open
        super.onNewIntent(intent);
        bridge.scan();
    }

    @Override public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        super.onRequestPermissionsResult(code, perms, results);
        for (int r : results) if (r != PackageManager.PERMISSION_GRANTED) return;
        webView.reload();   // camera/location now allowed
    }

    @Override public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        bridge.destroy();
        webView.destroy();
        super.onDestroy();
    }

    private void hideSystemBars() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }
}
