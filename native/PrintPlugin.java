package com.aqualima.shams;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.HashMap;
import java.util.Map;

@CapacitorPlugin(name = "PrintPlugin")
public class PrintPlugin extends Plugin {
    private WebView printView; // keep a reference so it is not garbage collected
    private final Map<String, StringBuilder> buffers = new HashMap<>();

    /** Receives the page HTML in chunks (big pages), then opens Android's print dialog (Save as PDF / printers). */
    @PluginMethod
    public void printHtmlChunk(final PluginCall call) {
        final String id = call.getString("id", "x");
        final int index = call.getInt("index", 0);
        final int total = call.getInt("total", 1);
        final String chunk = call.getString("chunk", "");
        final String name = call.getString("name", "AQUALIMA");

        final String html;
        synchronized (buffers) {
            StringBuilder sb;
            if (index == 0) {
                sb = new StringBuilder();
                buffers.put(id, sb);
            } else {
                sb = buffers.get(id);
            }
            if (sb == null) {
                call.reject("print buffer missing");
                return;
            }
            sb.append(chunk);
            if (index < total - 1) {
                call.resolve();
                return;
            }
            html = sb.toString();
            buffers.remove(id);
        }

        getActivity().runOnUiThread(() -> {
            try {
                final boolean[] started = {false};
                printView = new WebView(getContext());
                printView.getSettings().setJavaScriptEnabled(false);
                printView.setWebViewClient(new WebViewClient() {
                    @Override
                    public void onPageFinished(final WebView view, String url) {
                        if (started[0]) return;
                        started[0] = true;
                        new Handler(Looper.getMainLooper()).postDelayed(() -> {
                            try {
                                PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                                PrintAttributes attrs = new PrintAttributes.Builder()
                                        .setMediaSize(PrintAttributes.MediaSize.ISO_A4).build();
                                pm.print(name, view.createPrintDocumentAdapter(name), attrs);
                                call.resolve();
                            } catch (Exception e) {
                                call.reject(String.valueOf(e.getMessage()));
                            }
                        }, 400);
                    }
                });
                printView.loadDataWithBaseURL("https://localhost/", html, "text/html", "UTF-8", null);
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()));
            }
        });
    }
}
