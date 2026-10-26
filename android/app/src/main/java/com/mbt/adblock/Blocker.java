package com.mbt.adblock;

import android.content.Context;
import android.net.Uri;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** 네트워크 요청 차단: lists/domains.txt, lists/url-filters.txt + 사용자 도메인 */
final class Blocker {
    private final Set<String> domains = new HashSet<>();
    private final List<String[]> filters = new ArrayList<>(); // {host, pathPrefix}
    private volatile Set<String> user = Collections.emptySet();

    Blocker(Context c) {
        for (String l : read(c, "domains.txt")) domains.add(l.toLowerCase());
        for (String l : read(c, "url-filters.txt")) {
            if (!l.startsWith("||")) continue;
            String s = l.substring(2);
            int i = s.indexOf('/');
            filters.add(i < 0 ? new String[]{s, ""} : new String[]{s.substring(0, i), s.substring(i)});
        }
    }

    private static List<String> read(Context c, String name) {
        List<String> out = new ArrayList<>();
        try (BufferedReader r = new BufferedReader(new InputStreamReader(c.getAssets().open(name), "UTF-8"))) {
            String line;
            while ((line = r.readLine()) != null) {
                line = line.trim();
                if (!line.isEmpty() && !line.startsWith("#")) out.add(line);
            }
        } catch (Exception ignored) {
        }
        return out;
    }

    void setUserDomains(List<String> l) {
        Set<String> s = new HashSet<>();
        for (String d : l) s.add(d.toLowerCase());
        user = s;
    }

    private static boolean inSet(Set<String> set, String host) {
        String h = host;
        while (true) {
            if (set.contains(h)) return true;
            int i = h.indexOf('.');
            if (i < 0) return false;
            h = h.substring(i + 1);
        }
    }

    boolean shouldBlock(Uri u) {
        String host = u.getHost();
        if (host == null) return false;
        host = host.toLowerCase();
        if (inSet(domains, host) || inSet(user, host)) return true;
        String path = u.getEncodedPath();
        if (path == null) path = "/";
        for (String[] f : filters) {
            if ((host.equals(f[0]) || host.endsWith("." + f[0])) && path.startsWith(f[1])) return true;
        }
        return false;
    }
}
