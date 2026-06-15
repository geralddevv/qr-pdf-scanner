import React, { useState, useCallback, useRef, useEffect } from "react";
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
  Modal,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";

// ─── Theme ────────────────────────────────────────────────────────────────────
const C = {
  bg: "#f0f4ff",
  surface: "#ffffff",
  elevated: "#e8edf8",
  border: "#d1d9f0",
  muted: "#8e9bbf",
  subtle: "#6b7a9e",
  body: "#3d4a6b",
  strong: "#1e2a4a",
  heading: "#0f1829",
  accent: "#2563eb",
  accentLight: "#3b82f6",
  accentDim: "rgba(37,99,235,0.08)",
  accentBorder: "rgba(37,99,235,0.22)",
  accentText: "#1d4ed8",
  success: "#16a34a",
  successDim: "rgba(22,163,74,0.08)",
  successBorder: "rgba(22,163,74,0.22)",
  error: "#dc2626",
  errorDim: "rgba(220,38,38,0.08)",
  errorBorder: "rgba(220,38,38,0.25)",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function detectType(raw) {
  if (/^https?:\/\//i.test(raw)) return "URL";
  if (/^mailto:/i.test(raw)) return "Email";
  if (/^tel:/i.test(raw)) return "Phone";
  if (/^(BEGIN:VCARD|BEGIN:VCAL)/i.test(raw)) return "Contact / Calendar";
  if (/^WIFI:/i.test(raw)) return "Wi-Fi";
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

function buildMultiPageHtml(items, source, session) {
  const total = items.length;

  // Build session table (Table 1)
  const sessionTableHtml = session ? `
    <table class="session-table">
      <thead>
        <tr>
          <th>Username / Operator</th>
          <th>Location</th>
          <th>Lot / Invoice / Batch No.</th>
          <th>Generated</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${escapeHtml(session.username)}</td>
          <td>${escapeHtml(session.location)}</td>
          <td>${escapeHtml(session.reference)}</td>
          <td>${formatDate(new Date().toISOString())}</td>
        </tr>
      </tbody>
    </table>
  ` : `
    <table class="session-table">
      <thead>
        <tr>
          <th>Generated</th>
          <th>Source</th>
          <th>Total Items</th>
          <th colspan="1"></th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${formatDate(new Date().toISOString())}</td>
          <td>${source}</td>
          <td>${total}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  `;

  // Build individual item tables
  const itemTablesHtml = items.map((item, i) => {
    const type = detectType(item.raw);
    const displayValue = item.raw;
    return `
      <div class="table-wrapper">
        <div class="table-label">Scanned Item #${i + 1}</div>
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Content</th>
              <th>Date</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="type">${type}</td>
              <td class="content">${escapeHtml(displayValue)}</td>
              <td class="date">${new Date(item.scannedAt).toLocaleDateString()}</td>
              <td class="time">${new Date(item.scannedAt).toLocaleTimeString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=800, shrink-to-fit=yes"/>
<title>QR Scan Report</title>
<style>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  @page {
    size: A4;
    margin: 20mm;
  }
  body {
    font-family: Arial, Helvetica, sans-serif;
    background: #fff;
    color: #000;
    padding: 40px;
    width: 210mm;
    height: 297mm;
    margin: 0 auto;
  }
  .table-wrapper {
    margin-bottom: 20px;
    page-break-inside: avoid;
  }
  .table-label {
    font-size: 12px;
    font-weight: bold;
    text-transform: uppercase;
    color: #555;
    margin-bottom: 8px;
    letter-spacing: 1px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }
  thead {
    background-color: #f5f5f5;
  }
  th {
    border: 1px solid #000;
    padding: 8px;
    text-align: left;
    font-weight: bold;
    font-size: 10px;
    text-transform: uppercase;
    background-color: #e8e8e8;
  }
  td {
    border: 1px solid #000;
    padding: 8px;
  }
  tr:nth-child(even) {
    background-color: #f9f9f9;
  }
  .type {
    text-align: center;
    width: 15%;
    font-weight: 600;
  }
  .content {
    width: 50%;
    word-break: break-word;
    font-family: monospace;
    font-size: 10px;
  }
  .date {
    width: 17.5%;
    text-align: center;
  }
  .time {
    width: 17.5%;
    text-align: center;
  }
  .session-table {
    width: 100%;
  }
  @media print {
    body {
      padding: 20px;
    }
  }
</style>
</head>
<body>
  <div class="table-wrapper">
    <div class="table-label">Login Information</div>
    ${sessionTableHtml}
  </div>

  ${itemTablesHtml}

</body>
</html>`;
}

// ─── Summary row ──────────────────────────────────────────────────────────────
function ScanSummaryRow({ item, index }) {
  const type = detectType(item.raw);
  const typeIcon =
    type === "URL" ? "globe-outline" :
      type === "Email" ? "mail-outline" :
        type === "Phone" ? "call-outline" :
          type === "Wi-Fi" ? "wifi-outline" :
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
export default function ResultScreen({ data, session, onReset, onClearReset, onChangeSession }) {
  const { items, source } = data;
  const [status, setStatus] = useState("idle");
  const [pdfUri, setPdfUri] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const tickScale = useRef(new Animated.Value(1)).current;

  const generatePdf = useCallback(async () => {
    setStatus("generating");
    try {
      let Print;
      try { Print = await import("expo-print"); }
      catch { throw new Error("expo-print is not installed. Run: npx expo install expo-print"); }

      const html = buildMultiPageHtml(items, source, session);
      // Let expo-print write to its own temp location — don't move it,
      // moving across directories on Android can fail
      const { uri } = await Print.printToFileAsync({ html });
      setPdfUri(uri);
      setStatus("done");
    } catch (err) {
      console.error(err);
      setStatus("error");
      Alert.alert("PDF Error", err.message || "Could not generate PDF.");
    }
  }, [items, source, session]);

  const previewPdf = useCallback(() => {
    setShowPreview(true);
  }, []);

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
          <View style={[s.heroIconRing, status === "done" && s.heroIconRingSuccess]}>
            <Ionicons name="checkmark" size={28} color="#fff" />
          </View>
          <View style={s.heroText}>
            <Text style={s.heroTitle}>
              {status === "done" ? "PDF Generated!" : (isSingle ? "QR Code Scanned!" : `${items.length} QR Codes Scanned!`)}
            </Text>
            <Text style={s.heroSub}>
              {status === "done" ? (isSingle ? "1 QR Code" : `${items.length} QR Codes`) : "Ready to generate PDF"}
            </Text>
          </View>
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
              <TouchableOpacity style={s.primaryBtn} onPress={sharePdf} activeOpacity={0.85}>
                <Ionicons name="share-outline" size={18} color="#fff" />
                <Text style={s.primaryBtnText}>Share PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.secondaryBtn} onPress={previewPdf} activeOpacity={0.8}>
                <Ionicons name="eye-outline" size={16} color={C.subtle} />
                <Text style={s.secondaryBtnText}>Preview</Text>
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

      {/* ── In-app HTML Preview Modal ── */}
      <Modal
        visible={showPreview}
        animationType="slide"
        onRequestClose={() => setShowPreview(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#f0f4ff" }} edges={["top", "bottom"]}>
          <View style={s.previewHeader}>
            <TouchableOpacity onPress={() => setShowPreview(false)} activeOpacity={0.8} style={s.previewClose}>
              <Ionicons name="close" size={22} color="#1e2a4a" />
            </TouchableOpacity>
            <Text style={s.previewTitle}>PDF Preview</Text>
            <TouchableOpacity onPress={sharePdf} activeOpacity={0.8} style={s.previewShare}>
              <Ionicons name="share-outline" size={20} color="#2563eb" />
            </TouchableOpacity>
          </View>
          <WebView
            style={{ flex: 1 }}
            originWhitelist={["*"]}
            source={{ html: buildMultiPageHtml(items, source, session) }}
            startInLoadingState
            scalesPageToFit={true}
            builtInZoomControls={true}
            displayZoomControls={false}
            renderLoading={() => (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator size="large" color="#2563eb" />
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>
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
    marginBottom: 12,
  },
  sessionStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: C.accentDim,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.accentBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  sessionStripText: {
    flex: 1,
    color: C.body,
    fontSize: 11,
    lineHeight: 16,
  },
  sessionKey: {
    color: C.muted,
    fontWeight: "700",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sessionSep: {
    color: C.border,
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
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 18,
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
    flexShrink: 0,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  heroIconRingSuccess: {
    backgroundColor: C.success,
    shadowColor: C.success,
  },
  heroText: {
    flex: 1,
  },
  heroTitle: { color: C.heading, fontSize: 19, fontWeight: "800", marginBottom: 2 },
  heroSub: { color: C.subtle, fontSize: 13, lineHeight: 19 },

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

  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  previewTitle: {
    color: C.heading,
    fontSize: 16,
    fontWeight: "700",
  },
  previewClose: {
    padding: 4,
  },
  previewShare: {
    padding: 4,
  },
});