package com.mbt.adblock;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/** SharedPreferences 에 JSON 한 덩어리로 저장하는 설정. UI 스레드에서만 사용. */
final class Settings {
    private final SharedPreferences sp;
    private JSONObject o;

    Settings(Context c) {
        sp = c.getSharedPreferences("adb", Context.MODE_PRIVATE);
        try {
            o = new JSONObject(sp.getString("cfg", "{}"));
        } catch (JSONException e) {
            o = new JSONObject();
        }
    }

    private void put(String k, Object v) {
        try {
            o.put(k, v);
        } catch (JSONException ignored) {
        }
        sp.edit().putString("cfg", o.toString()).apply();
    }

    boolean bool(String k, boolean def) {
        return o.optBoolean(k, def);
    }

    void setBool(String k, boolean v) {
        put(k, v);
    }

    List<String> list(String k) {
        List<String> r = new ArrayList<>();
        JSONArray a = o.optJSONArray(k);
        if (a != null) for (int i = 0; i < a.length(); i++) r.add(a.optString(i));
        return r;
    }

    boolean has(String k, String v) {
        return list(k).contains(v);
    }

    void set(String k, String v, boolean on) {
        if (v == null || v.isEmpty()) return;
        List<String> l = list(k);
        l.remove(v);
        if (on) l.add(v);
        put(k, new JSONArray(l));
    }

    private JSONObject rulesObj() {
        JSONObject r = o.optJSONObject("userRules");
        return r != null ? r : new JSONObject();
    }

    List<String> rules(String host) {
        List<String> r = new ArrayList<>();
        JSONArray a = rulesObj().optJSONArray(host);
        if (a != null) for (int i = 0; i < a.length(); i++) r.add(a.optString(i));
        return r;
    }

    void setRules(String host, List<String> l) {
        JSONObject r = rulesObj();
        try {
            if (l.isEmpty()) r.remove(host);
            else r.put(host, new JSONArray(l));
        } catch (JSONException ignored) {
        }
        put("userRules", r);
    }

    void addRule(String host, String sel) {
        if (host.isEmpty() || sel == null || sel.isEmpty()) return;
        List<String> l = rules(host);
        if (!l.contains(sel)) l.add(sel);
        setRules(host, l);
    }

    /** 페이지에 주입할 설정 (adb.js 의 __ADB_CFG) */
    String jsConfig() {
        JSONObject c = new JSONObject();
        try {
            c.put("enabled", bool("enabled", true));
            c.put("youtube", bool("youtube", true));
            c.put("popups", bool("popups", true));
            c.put("cosmetic", bool("cosmetic", true));
            c.put("paused", new JSONArray(list("paused")));
            c.put("popupAllow", new JSONArray(list("popupAllow")));
            c.put("userRules", rulesObj());
        } catch (JSONException ignored) {
        }
        return c.toString();
    }
}
