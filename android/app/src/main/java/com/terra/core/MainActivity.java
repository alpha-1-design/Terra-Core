package com.terra.core;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

/**
 * Stock Capacitor's WebView never enables "wide viewport" / "overview mode",
 * so a page's <meta name="viewport"> tag is effectively ignored on Android —
 * the WebView always lays content out at device-width and never rescales it.
 *
 * That silently broke two things at once:
 *   1) The "desktop site" toggle in index.html flips the viewport meta's
 *      content between device-width and width=1200, but without these two
 *      settings the WebView never re-renders to honor it — the button did
 *      nothing visible.
 *   2) Because index.html also defaults new native installs to the
 *      width=1200 "desktop" viewport, every fresh APK install rendered the
 *      whole UI at a 1200px layout width squeezed into a ~360-400dp screen
 *      with no scale-to-fit — this is what produced the cut-off buttons /
 *      content running off both edges of the screen.
 *
 * Enabling useWideViewPort + loadWithOverviewMode makes the WebView actually
 * respect the page's viewport meta tag and scale it to fit, which fixes both.
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = this.bridge.getWebView();
        WebSettings settings = webView.getSettings();
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
    }
}
