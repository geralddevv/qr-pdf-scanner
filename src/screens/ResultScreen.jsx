import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";

// ─── Theme ────────────────────────────────────────────────────────────────────
const C = {
  bg:           "#f0f4ff",
  surface:      "#ffffff",
  elevated:     "#e8edf8",
  border:       "#d1d9f0",
  muted:        "#8e9bbf",
  subtle:       "#6b7a9e",
  body:         "#3d4a6b",
  strong:       "#1e2a4a",
  heading:      "#0f1829",
  accent:       "#2563eb",
  accentLight:  "#3b82f6",
  accentDim:    "rgba(37,99,235,0.08)",
  accentBorder: "rgba(37,99,235,0.22)",
  accentText:   "#1d4ed8",
  success:      "#16a34a",
  successDim:   "rgba(22,163,74,0.08)",
  successBorder:"rgba(22,163,74,0.22)",
  error:        "#dc2626",
  errorDim:     "rgba(220,38,38,0.08)",
  errorBorder:  "rgba(220,38,38,0.25)",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function detectType(raw) {
  if (/^https?:\/\//i.test(raw))              return "URL";
  if (/^mailto:/i.test(raw))                  return "Email";
  if (/^tel:/i.test(raw))                     return "Phone";
  if (/^(BEGIN:VCARD|BEGIN:VCAL)/i.test(raw)) return "Contact / Calendar";
  if (/^WIFI:/i.test(raw))                    return "Wi-Fi";
  return "Text";
}

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

// ─── PDF builders ─────────────────────────────────────────────────────────────
function escapeHtml(raw) {
  return raw
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function pageBlock(item, index, total) {
  const escaped = escapeHtml(item.raw);
  const type    = detectType(item.raw);
  const isUrl   = type === "URL";
  const pageBreak = index < total - 1 ? "page-break-after:always;" : "";

  return `
  <div style="${pageBreak}padding:40px 48px;min-height:100vh;box-sizing:border-box;">
    <div class="page-header">
      <div class="logo">QR</div>
      <div>
        <div class="page-title">QR Scan Report</div>
        <div class="page-sub">Entry ${index + 1} of ${total}</div>
      </div>
      <div class="page-num">#${index + 1}</div>
    </div>

    <div class="badge">${type}</div>

    <div class="card">
      <div class="card-title">Scanned Content</div>
      <div class="card-value mono">${isUrl ? `<a class="url-link" href="${escaped}">${escaped}</a>` : escaped}</div>
    </div>

    <div class="meta-grid">
      <div class="card">
        <div class="card-title">Content Type</div>
        <div class="card-value">${type}</div>
      </div>
      <div class="card">
        <div class="card-title">Scanned At</div>
        <div class="card-value">${formatDate(item.scannedAt)}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Character Count</div>
      <div class="card-value">${item.raw.length} characters</div>
    </div>
  </div>`;
}

function buildMultiPageHtml(items, source) {
  const total = items.length;
  const pages = items.map((item, i) => pageBlock(item, i, total)).join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>QR Scan Report — ${total} code${total > 1 ? "s" : ""}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
       background:#f0f4ff;color:#1e2a4a;}
  .page-header{display:flex;align-items:center;gap:14px;padding-bottom:22px;
               border-bottom:2px solid #d1d9f0;margin-bottom:28px;}
  .logo{width:44px;height:44px;background:#2563eb;border-radius:10px;
        display:flex;align-items:center;justify-content:center;
        font-size:16px;font-weight:800;color:#fff;flex-shrink:0;
        line-height:44px;text-align:center;}
  .page-title{font-size:20px;font-weight:800;color:#0f1829;}
  .page-sub{font-size:12px;color:#6b7a9e;margin-top:2px;}
  .page-num{margin-left:auto;background:rgba(37,99,235,0.10);color:#1d4ed8;
            font-size:13px;font-weight:700;padding:4px 12px;
            border-radius:20px;border:1px solid rgba(37,99,235,0.22);}
  .badge{display:inline-block;background:rgba(37,99,235,0.10);color:#1d4ed8;
         font-size:11px;font-weight:700;letter-spacing:.5px;
         padding:3px 10px;border-radius:20px;margin-bottom:18px;text-transform:uppercase;
         border:1px solid rgba(37,99,235,0.22);}
  .card{background:#fff;border-radius:12px;border:1px solid #d1d9f0;
        padding:20px 24px;margin-bottom:16px;
        box-shadow:0 1px 4px rgba(37,99,235,0.06);}
  .card-title{font-size:10px;font-weight:700;letter-spacing:1px;
              text-transform:uppercase;color:#8e9bbf;margin-bottom:8px;}
  .card-value{font-size:14px;color:#0f1829;word-break:break-all;line-height:1.6;}
  .card-value.mono{font-family:'Courier New',Courier,monospace;background:#f0f4ff;
                   padding:10px 12px;border-radius:6px;font-size:12px;color:#3d4a6b;}
  .url-link{color:#2563eb;text-decoration:underline;}
  .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
  .footer-strip{background:#e8edf8;border-top:1px solid #d1d9f0;
                padding:14px 48px;text-align:center;font-size:11px;color:#8e9bbf;
                position:fixed;bottom:0;left:0;right:0;}
</style>
</head>
<body>
${pages}
<div class="footer-strip">
  QR PDF Scanner &nbsp;•&nbsp; ${total} QR code${total > 1 ? "s" : ""} &nbsp;•&nbsp; ${formatDate(new Date().toISOString())} &nbsp;•&nbsp; Source: ${source}
</div>
</body>
</html>`;
}

// ─── Summary row ──────────────────────────────────────────────────────────────
function ScanSummaryRow({ item, index }) {
  const type = detectType(item.raw);
  const typeIcon =
    type === "URL"     ? "globe-outline"         :
    type === "Email"   ? "mail-outline"           :
    type === "Phone"   ? "call-outline"           :
    type === "Wi-Fi"   ? "wifi-outline"           :
                         "document-text-outline";
  return (
    <View style={sr.row}>
      <View style={sr.indexCircle}>
        <Text style={sr.indexText}>{index + 1}</Text>
      </View>
      <View style={sr.rowBody}>
        <View style={sr.rowTop}>
          <Ionicons name={typeIcon} size={12} color={C.accentText} />
          <Text style={sr.typeLabel}>{type}</Text>
          <Text style={sr.charCount}>{item.raw.length} chars</Text>
        </View>
        <Text style={sr.rawPreview} numberOfLines={1}>{item.raw}</Text>
      </View>
    </View>
  );
}

// ─── Scan list with custom blue scrollbar ────────────────────────────────────
function ScanList({ items }) {
  const scrollY = useRef(new Animated.Value(0)).current;
  const [containerH, setContainerH] = useState(0);
  const [contentH, setContentH] = useState(0);

  const thumbH = contentH > 0
    ? Math.max(28, (containerH / contentH) * containerH)
    : 0;
  const scrollRange = contentH - containerH;
  const thumbRange = containerH - thumbH;

  const thumbTop = scrollRange > 0
    ? scrollY.interpolate({ inputRange: [0, scrollRange], outputRange: [0, thumbRange], extrapolate: "clamp" })
    : 0;

  const showBar = contentH > containerH;

  return (
    <View style={sl.wrapper}>
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={sl.listContent}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        onLayout={e => setContainerH(e.nativeEvent.layout.height)}
        onContentSizeChange={(_, h) => setContentH(h)}
      >
        {items.map((item, i) => (
          <ScanSummaryRow key={i} item={item} index={i} />
        ))}
      </ScrollView>

      {showBar && (
        <View style={sl.track}>
          <Animated.View style={[sl.thumb, { height: thumbH, transform: [{ translateY: thumbTop }] }]} />
        </View>
      )}
    </View>
  );
}

const sl = StyleSheet.create({
  wrapper: { flex: 1, flexDirection: "row" },
  listContent: { paddingRight: 4, flexGrow: 1 },
  track: {
    width: 3,
    borderRadius: 2,
    backgroundColor: "rgba(37,99,235,0.12)",
    marginLeft: 6,
    overflow: "hidden",
  },
  thumb: {
    width: 3,
    borderRadius: 2,
    backgroundColor: C.accent,
  },
});

// ─── Component ────────────────────────────────────────────────────────────────
export default function ResultScreen({ data, onReset, onClearReset }) {
  const { items, source } = data;
  const [status, setStatus] = useState("idle");
  const [pdfUri, setPdfUri] = useState(null);

  const generatePdf = useCallback(async () => {
    setStatus("generating");
    try {
      let Print;
      try { Print = await import("expo-print"); }
      catch { throw new Error("expo-print is not installed. Run: npx expo install expo-print"); }

      const html = buildMultiPageHtml(items, source);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const dest = FileSystem.cacheDirectory + `QR_Scan_${Date.now()}.pdf`;
      await FileSystem.moveAsync({ from: uri, to: dest });
      setPdfUri(dest);
      setStatus("done");
    } catch (err) {
      console.error(err);
      setStatus("error");
      Alert.alert("PDF Error", err.message || "Could not generate PDF.");
    }
  }, [items, source]);

  const sharePdf = useCallback(async () => {
    if (!pdfUri) return;
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert("Sharing unavailable", "This device does not support file sharing.");
      return;
    }
    await Sharing.shareAsync(pdfUri, { mimeType: "application/pdf" });
  }, [pdfUri]);

  const isSingle = items.length === 1;

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <View style={s.scroll}>

        {/* Top bar */}
        <View style={s.topBar}>
          <TouchableOpacity onPress={onClearReset} style={s.backBtn} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={18} color={C.accentText} />
            <Text style={s.backText}>Scan Again</Text>
          </TouchableOpacity>

          <View style={s.sourceBadge}>
            {source === "camera"
              ? <Ionicons name="camera-outline" size={12} color={C.subtle} />
              : <MaterialCommunityIcons name="barcode-scan" size={12} color={C.subtle} />
            }
            <Text style={s.sourceBadgeText}>{source === "camera" ? "Camera" : "Hardware"}</Text>
          </View>
        </View>

        {/* Hero */}
        <View style={s.hero}>
          <View style={s.heroIconRing}>
            <Ionicons name="checkmark" size={28} color="#fff" />
          </View>
          <Text style={s.heroTitle}>
            {isSingle ? "QR Code Scanned!" : `${items.length} QR Codes Scanned!`}
          </Text>
          <Text style={s.heroSub}>
            {isSingle
              ? "Ready to generate your PDF."
              : `Each code will appear on its own page in the PDF.`}
          </Text>
        </View>

        {/* Scan list — scrolls internally, page stays fixed */}
        <View style={[s.card, s.cardFlex]}>
          <View style={s.cardHeaderRow}>
            <Text style={s.cardLabel}>SCANNED ITEMS</Text>
            <View style={s.pillSmall}>
              <Text style={s.pillSmallText}>{items.length} total</Text>
            </View>
          </View>
          <ScanList items={items} />
        </View>

        {/* Actions */}
        <View style={s.actions}>
          {status === "idle" && (
            <TouchableOpacity style={s.primaryBtn} onPress={generatePdf} activeOpacity={0.85}>
              <Ionicons name="document-text-outline" size={18} color="#fff" />
              <Text style={s.primaryBtnText}>
                Generate PDF{items.length > 1 ? ` (${items.length} pages)` : ""}
              </Text>
            </TouchableOpacity>
          )}

          {status === "generating" && (
            <View style={s.loadingBox}>
              <ActivityIndicator color={C.accent} size="large" />
              <Text style={s.loadingText}>Building your PDF…</Text>
            </View>
          )}

          {status === "done" && (
            <>
              <View style={s.doneBox}>
                <MaterialCommunityIcons name="check-decagram" size={22} color={C.success} />
                <Text style={s.doneText}>PDF Ready!</Text>
              </View>
              <TouchableOpacity style={s.primaryBtn} onPress={sharePdf} activeOpacity={0.85}>
                <Ionicons name="share-outline" size={18} color="#fff" />
                <Text style={s.primaryBtnText}>Share PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.secondaryBtn} onPress={generatePdf} activeOpacity={0.8}>
                <Ionicons name="refresh-outline" size={16} color={C.subtle} />
                <Text style={s.secondaryBtnText}>Regenerate</Text>
              </TouchableOpacity>
            </>
          )}

          {status === "error" && (
            <>
              <View style={s.errorBox}>
                <Ionicons name="warning-outline" size={16} color={C.error} />
                <Text style={s.errorText}>Failed to generate PDF</Text>
              </View>
              <TouchableOpacity style={s.primaryBtn} onPress={generatePdf} activeOpacity={0.85}>
                <Text style={s.primaryBtnText}>Try Again</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={s.secondaryBtn} onPress={onReset} activeOpacity={0.8}>
            <Ionicons name="camera-outline" size={16} color={C.subtle} />
            <Text style={s.secondaryBtnText}>Scan More QR Codes</Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

// ─── Summary row styles ───────────────────────────────────────────────────────
const sr = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  indexCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.accentDim,
    borderWidth: 1,
    borderColor: C.accentBorder,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  indexText: { color: C.accentText, fontSize: 11, fontWeight: "800" },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  typeLabel: { color: C.accentText, fontSize: 11, fontWeight: "700" },
  charCount: { color: C.muted, fontSize: 10, marginLeft: "auto" },
  rawPreview: {
    color: C.body,
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    lineHeight: 17,
  },
});

// ─── Main styles ──────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1, padding: 20, paddingBottom: 20 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  backText: { color: C.accentText, fontSize: 14, fontWeight: "600" },
  sourceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: C.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  sourceBadgeText: { color: C.subtle, fontSize: 11, fontWeight: "600" },

  // Hero – replaced success-dim background with a bold blue gradient effect via border
  hero: {
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 28,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: C.accentBorder,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 3,
  },
  heroIconRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  heroTitle: { color: C.heading, fontSize: 19, fontWeight: "800", marginBottom: 6 },
  heroSub: { color: C.subtle, fontSize: 13, textAlign: "center", lineHeight: 19 },

  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  // Makes the scanned items card grow to fill remaining vertical space
  cardFlex: {
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cardLabel: { color: C.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1.2 },
  pillSmall: {
    backgroundColor: C.accentDim,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.accentBorder,
  },
  pillSmallText: { color: C.accentText, fontSize: 10, fontWeight: "700" },

  actions: { gap: 12 },
  primaryBtn: {
    backgroundColor: C.accent,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  secondaryBtn: {
    backgroundColor: C.surface,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  secondaryBtnText: { color: C.subtle, fontSize: 14, fontWeight: "600" },

  loadingBox: { alignItems: "center", gap: 12, paddingVertical: 24 },
  loadingText: { color: C.subtle, fontSize: 14 },

  doneBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    backgroundColor: C.successDim,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.successBorder,
  },
  doneText: { color: C.success, fontSize: 16, fontWeight: "700" },

  errorBox: {
    backgroundColor: C.errorDim,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: C.errorBorder,
  },
  errorText: { color: C.error, fontSize: 13, fontWeight: "600" },
});