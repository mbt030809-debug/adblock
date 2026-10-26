package com.mbt.adblock;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Message;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.webkit.ScriptHandler;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final String HOME = "https://www.google.com";

    private Settings settings;
    private Blocker blocker;
    private String adbJs = "";
    private String regionJs = "";

    private WebView web;
    private EditText urlBar;
    private LinearLayout popupBar;
    private TextView popupText;
    private FrameLayout fullscreen;
    private View mainLayout;

    private final List<ScriptHandler> handlers = new ArrayList<>();
    private final List<String> blocked = new ArrayList<>();
    private boolean docStartSupported;

    private volatile boolean netOn = true;
    private String pageHost = "";

    private View customView;
    private WebChromeClient.CustomViewCallback customCb;

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        settings = new Settings(this);
        blocker = new Blocker(this);
        blocker.setUserDomains(settings.list("userDomains"));
        adbJs = readAsset("adb.js");
        regionJs = readAsset("region-picker.js");

        buildUi();
        setupWebView();
        registerScripts();

        Uri data = getIntent() != null ? getIntent().getData() : null;
        web.loadUrl(data != null ? data.toString() : HOME);
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        if (i.getData() != null) web.loadUrl(i.getData().toString());
    }

    private String readAsset(String name) {
        StringBuilder sb = new StringBuilder();
        try (BufferedReader r = new BufferedReader(new InputStreamReader(getAssets().open(name), "UTF-8"))) {
            String l;
            while ((l = r.readLine()) != null) sb.append(l).append('\n');
        } catch (Exception ignored) {
        }
        return sb.toString();
    }

    // ---------------------------------------------------------------- UI
    private Button btn(String t, View.OnClickListener l) {
        Button b = new Button(this);
        b.setText(t);
        b.setAllCaps(false);
        b.setOnClickListener(l);
        return b;
    }

    private void buildUi() {
        FrameLayout root = new FrameLayout(this);

        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        mainLayout = col;

        LinearLayout top = new LinearLayout(this);
        top.setOrientation(LinearLayout.HORIZONTAL);
        top.setGravity(Gravity.CENTER_VERTICAL);
        urlBar = new EditText(this);
        urlBar.setSingleLine(true);
        urlBar.setHint("주소 또는 검색어");
        urlBar.setImeOptions(EditorInfo.IME_ACTION_GO);
        urlBar.setOnEditorActionListener((v, id, e) -> {
            go(urlBar.getText().toString());
            return true;
        });
        top.addView(urlBar, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        top.addView(btn("이동", v -> go(urlBar.getText().toString())));
        col.addView(top, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        web = new WebView(this);
        col.addView(web, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        popupBar = new LinearLayout(this);
        popupBar.setOrientation(LinearLayout.HORIZONTAL);
        popupBar.setGravity(Gravity.CENTER_VERTICAL);
        popupBar.setBackgroundColor(Color.parseColor("#222222"));
        popupBar.setPadding(dp(8), dp(4), dp(8), dp(4));
        popupText = new TextView(this);
        popupText.setTextColor(Color.WHITE);
        popupBar.addView(popupText, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        popupBar.addView(btn("열기", v -> showBlockedList()));
        popupBar.addView(btn("닫기", v -> {
            blocked.clear();
            updatePopupBar();
        }));
        popupBar.setVisibility(View.GONE);
        col.addView(popupBar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        LinearLayout nav = new LinearLayout(this);
        nav.setOrientation(LinearLayout.HORIZONTAL);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        nav.addView(btn("◀", v -> {
            if (web.canGoBack()) web.goBack();
        }), lp);
        nav.addView(btn("▶", v -> {
            if (web.canGoForward()) web.goForward();
        }), lp);
        nav.addView(btn("⟳", v -> web.reload()), lp);
        nav.addView(btn("영역지정", v -> web.evaluateJavascript("window.__adbPick && window.__adbPick()", null)), lp);
        nav.addView(btn("⋮", v -> showMenu()), lp);
        col.addView(nav, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        root.addView(col, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        fullscreen = new FrameLayout(this);
        fullscreen.setBackgroundColor(Color.BLACK);
        fullscreen.setVisibility(View.GONE);
        root.addView(fullscreen, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        setContentView(root);
    }

    private void go(String in) {
        String s = in.trim();
        if (s.isEmpty()) return;
        String url;
        if (s.matches("^[a-zA-Z][a-zA-Z0-9+.-]*://.*")) url = s;
        else if (!s.contains(" ") && s.contains(".")) url = "https://" + s;
        else url = "https://www.google.com/search?q=" + Uri.encode(s);
        web.loadUrl(url);
        InputMethodManager imm = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
        if (imm != null) imm.hideSoftInputFromWindow(urlBar.getWindowToken(), 0);
        web.requestFocus();
    }

    private void updatePopupBar() {
        if (blocked.isEmpty()) {
            popupBar.setVisibility(View.GONE);
        } else {
            popupText.setText("팝업 " + blocked.size() + "개 차단됨");
            popupBar.setVisibility(View.VISIBLE);
        }
    }

    private void addBlocked(String url) {
        if (url == null || url.isEmpty() || url.equals("about:blank") || blocked.contains(url) || blocked.size() >= 20) return;
        blocked.add(url);
        updatePopupBar();
    }

    private void showBlockedList() {
        if (blocked.isEmpty()) return;
        final List<String> snapshot = new ArrayList<>(blocked);
        new AlertDialog.Builder(this)
                .setTitle("차단된 팝업 (탭하면 열기)")
                .setItems(snapshot.toArray(new String[0]), (d, i) -> {
                    String u = snapshot.get(i);
                    blocked.remove(u);
                    updatePopupBar();
                    web.loadUrl(u);
                })
                .setNegativeButton("닫기", null)
                .show();
    }

    // ------------------------------------------------------------ settings UI
    private void showMenu() {
        final String host = pageHost;
        final String[] items = {"전체 사용", "유튜브/영상 광고 차단", "팝업 차단", "배너 숨김", "이 사이트 일시중지", "이 사이트 팝업 허용"};
        final boolean[] on = {
                settings.bool("enabled", true), settings.bool("youtube", true), settings.bool("popups", true),
                settings.bool("cosmetic", true), settings.has("paused", host), settings.has("popupAllow", host)
        };
        new AlertDialog.Builder(this)
                .setTitle("My AdBlock  " + host)
                .setMultiChoiceItems(items, on, (d, i, c) -> on[i] = c)
                .setPositiveButton("적용", (d, w) -> {
                    settings.setBool("enabled", on[0]);
                    settings.setBool("youtube", on[1]);
                    settings.setBool("popups", on[2]);
                    settings.setBool("cosmetic", on[3]);
                    settings.set("paused", host, on[4]);
                    settings.set("popupAllow", host, on[5]);
                    applySettings();
                })
                .setNeutralButton("규칙 관리", (d, w) -> showRules(host))
                .setNegativeButton("도메인 추가", (d, w) -> showDomains())
                .show();
    }

    private void applySettings() {
        blocker.setUserDomains(settings.list("userDomains"));
        updatePageHost(web.getUrl());
        registerScripts();
        web.reload();
    }

    private void showRules(final String host) {
        final List<String> rules = settings.rules(host);
        if (rules.isEmpty()) {
            Toast.makeText(this, "이 사이트에 지정한 숨김 규칙이 없습니다", Toast.LENGTH_SHORT).show();
            return;
        }
        new AlertDialog.Builder(this)
                .setTitle("숨김 규칙 (탭하면 삭제)")
                .setItems(rules.toArray(new String[0]), (d, i) -> {
                    rules.remove(i);
                    settings.setRules(host, rules);
                    applySettings();
                })
                .setNegativeButton("닫기", null)
                .show();
    }

    private void showDomains() {
        final EditText et = new EditText(this);
        et.setSingleLine(true);
        et.setHint("예: ads.example.com");
        new AlertDialog.Builder(this)
                .setTitle("차단 도메인 추가")
                .setView(et)
                .setPositiveButton("추가", (d, w) -> {
                    String v = et.getText().toString().trim().toLowerCase(Locale.ROOT).replaceFirst("^https?://", "");
                    int slash = v.indexOf('/');
                    if (slash >= 0) v = v.substring(0, slash);
                    if (!v.isEmpty()) {
                        settings.set("userDomains", v, true);
                        applySettings();
                    }
                })
                .setNeutralButton("목록/삭제", (d, w) -> {
                    final List<String> doms = settings.list("userDomains");
                    if (doms.isEmpty()) {
                        Toast.makeText(this, "추가한 도메인이 없습니다", Toast.LENGTH_SHORT).show();
                        return;
                    }
                    new AlertDialog.Builder(this)
                            .setTitle("차단 도메인 (탭하면 삭제)")
                            .setItems(doms.toArray(new String[0]), (dd, i) -> {
                                settings.set("userDomains", doms.get(i), false);
                                applySettings();
                            })
                            .setNegativeButton("닫기", null)
                            .show();
                })
                .setNegativeButton("취소", null)
                .show();
    }

    // ---------------------------------------------------------------- WebView
    private void updatePageHost(String url) {
        String h = "";
        if (url != null) {
            Uri u = Uri.parse(url);
            if (u.getHost() != null) h = u.getHost().toLowerCase(Locale.ROOT).replaceFirst("^www\\.", "");
        }
        pageHost = h;
        netOn = settings.bool("enabled", true) && !settings.has("paused", h);
    }

    private void registerScripts() {
        for (ScriptHandler h : handlers) h.remove();
        handlers.clear();
        docStartSupported = WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT);
        if (docStartSupported) {
            handlers.add(WebViewCompat.addDocumentStartJavaScript(web, bootstrap(), Collections.singleton("*")));
        }
    }

    private String bootstrap() {
        return regionJs + "\n;window.__ADB_CFG=" + settings.jsConfig() + ";\n" + adbJs;
    }

    private void setupWebView() {
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setSupportMultipleWindows(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(web, true);

        web.addJavascriptInterface(new Bridge(), "AdbBridge");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                if (netOn && !r.isForMainFrame() && blocker.shouldBlock(r.getUrl())) {
                    return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream(new byte[0]));
                }
                return null;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                String scheme = r.getUrl().getScheme();
                if (scheme == null) return true;
                scheme = scheme.toLowerCase(Locale.ROOT);
                if (scheme.equals("http") || scheme.equals("https") || scheme.equals("about")
                        || scheme.equals("data") || scheme.equals("blob") || scheme.equals("javascript")) {
                    updatePageHost(r.getUrl().toString());
                    return false;
                }
                // 외부 앱 호출은 사용자가 직접 누른 tel/mailto/sms 만 허용, 나머지는 차단
                if (r.hasGesture() && (scheme.equals("tel") || scheme.equals("mailto") || scheme.equals("sms"))) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, r.getUrl()));
                    } catch (Exception ignored) {
                    }
                }
                return true;
            }

            @Override
            public void onPageStarted(WebView v, String url, Bitmap icon) {
                updatePageHost(url);
                urlBar.setText(url);
                if (!docStartSupported) v.evaluateJavascript(bootstrap(), null);
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onCreateWindow(WebView v, boolean isDialog, final boolean isUserGesture, Message resultMsg) {
                final WebView tmp = new WebView(MainActivity.this);
                tmp.setWebViewClient(new WebViewClient() {
                    private boolean done;

                    private void handle(String url) {
                        if (done || url == null || url.equals("about:blank")) return;
                        done = true;
                        boolean block = settings.bool("enabled", true) && settings.bool("popups", true)
                                && !settings.has("popupAllow", pageHost) && !isUserGesture;
                        if (block) addBlocked(url);
                        else web.loadUrl(url);
                        tmp.post(() -> {
                            tmp.stopLoading();
                            tmp.destroy();
                        });
                    }

                    @Override
                    public boolean shouldOverrideUrlLoading(WebView w, WebResourceRequest r) {
                        handle(r.getUrl().toString());
                        return true;
                    }

                    @Override
                    public void onPageStarted(WebView w, String url, Bitmap icon) {
                        handle(url);
                    }
                });
                WebView.WebViewTransport t = (WebView.WebViewTransport) resultMsg.obj;
                t.setWebView(tmp);
                resultMsg.sendToTarget();
                return true;
            }

            @Override
            public void onShowCustomView(View view, CustomViewCallback cb) {
                if (customView != null) {
                    cb.onCustomViewHidden();
                    return;
                }
                customView = view;
                customCb = cb;
                fullscreen.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                fullscreen.setVisibility(View.VISIBLE);
                mainLayout.setVisibility(View.INVISIBLE);
                getWindow().getDecorView().setSystemUiVisibility(
                        View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
            }

            @Override
            public void onHideCustomView() {
                if (customView == null) return;
                fullscreen.removeView(customView);
                fullscreen.setVisibility(View.GONE);
                mainLayout.setVisibility(View.VISIBLE);
                getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
                customCb.onCustomViewHidden();
                customView = null;
                customCb = null;
            }
        });
    }

    /** 페이지 JS → 앱. 현재 페이지 호스트에만 규칙을 저장한다. */
    private final class Bridge {
        @JavascriptInterface
        public void blocked(final String url) {
            runOnUiThread(() -> addBlocked(url));
        }

        @JavascriptInterface
        public void saveRules(final String json) {
            runOnUiThread(() -> {
                if (json == null || json.length() > 20000) return;
                try {
                    org.json.JSONArray a = new org.json.JSONArray(json);
                    int n = Math.min(a.length(), 50);
                    for (int i = 0; i < n; i++) {
                        String sel = a.optString(i);
                        if (!sel.isEmpty() && sel.length() <= 500) settings.addRule(pageHost, sel);
                    }
                    registerScripts();
                    Toast.makeText(MainActivity.this, n + "개 숨김 규칙 저장됨", Toast.LENGTH_SHORT).show();
                } catch (org.json.JSONException ignored) {
                }
            });
        }
    }

    @Override
    public void onBackPressed() {
        if (customView != null) {
            customCb.onCustomViewHidden();
            fullscreen.removeView(customView);
            fullscreen.setVisibility(View.GONE);
            mainLayout.setVisibility(View.VISIBLE);
            customView = null;
            customCb = null;
        } else if (web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
