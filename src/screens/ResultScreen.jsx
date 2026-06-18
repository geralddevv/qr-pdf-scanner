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
  BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
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
  accent: "#002d8f",
  accentLight: "#1a4fbf",
  accentDim: "rgba(0,45,143,0.08)",
  accentBorder: "rgba(0,45,143,0.22)",
  accentText: "#002070",
  success: "#16a34a",
  successDim: "rgba(22,163,74,0.08)",
  successBorder: "rgba(22,163,74,0.22)",
  error: "#dc2626",
  errorDim: "rgba(220,38,38,0.08)",
  errorBorder: "rgba(220,38,38,0.25)",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function detectType(raw) {
  if (typeof raw !== "string") raw = raw == null ? "" : String(raw);
  if (/^https?:\/\//i.test(raw)) return "URL";
  if (/^mailto:/i.test(raw)) return "Email";
  if (/^tel:/i.test(raw)) return "Phone";
  if (/^(BEGIN:VCARD|BEGIN:VCAL)/i.test(raw)) return "Contact / Calendar";
  if (/^WIFI:/i.test(raw)) return "Wi-Fi";
  // Check if it looks like pharmaceutical/structured data (contains multiple key:value pairs)
  // Match patterns like "Key:value" with at least 2 occurrences
  const keyValueCount = (raw.match(/[A-Za-z0-9\s\-\/\.\(\)&]+?:\s*[^:]+/g) || []).length;
  if (keyValueCount >= 2) return "Pharma Data";
  return "Text";
}

// ─── Pharmaceutical Data Parser ────────────────────────────────────────────────
function parsePharmaData(raw) {
  const pairs = [];

  try {
    // More flexible regex to match keys with letters, numbers, spaces, periods, hyphens, parentheses, etc.
    // Matches: "key:", "Key Name:", "BATCH NO.:", "Date of Mfg:", etc.
    const keyRegex = /([A-Za-z0-9\s\-\/\.\(\)&]+?):\s*/g;
    let match;
    const keys = [];

    // Find all keys and their positions
    while ((match = keyRegex.exec(raw)) !== null) {
      const keyText = match[1].trim();
      // Only add if key is not empty and doesn't look like a sentence fragment
      if (keyText && keyText.length < 100) {
        keys.push({
          key: keyText,
          startIndex: match.index,
          endIndex: match.index + match[0].length
        });
      }
    }

    // If no structured data found, return null
    if (keys.length === 0) {
      return null;
    }

    // Extract values for each key
    for (let i = 0; i < keys.length; i++) {
      const currentKey = keys[i];
      const nextKeyIndex = i + 1 < keys.length ? keys[i + 1].startIndex : raw.length;

      // Get value from end of key to start of next key
      let value = raw.substring(currentKey.endIndex, nextKeyIndex).trim();

      // Remove trailing comma, period, or whitespace
      value = value.replace(/[\s,.\s]+$/, '').trim();

      // Only add pairs where both key and value exist and value isn't empty
      if (currentKey.key && value && value.length > 0) {
        pairs.push({ key: currentKey.key, value });
      }
    }

    return pairs.length > 0 ? pairs : null;
  } catch (error) {
    // If parsing fails, return null to fall back to text display
    console.warn("Pharma data parsing error:", error);
    return null;
  }
}

function formatDateForLogin(iso) {
  const date = new Date(iso);
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = date.getDate();
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ampm = date.getHours() >= 12 ? 'PM' : 'AM';
  return `${day} ${month}, ${hours}:${minutes}:${seconds} ${ampm}`;
}

function formatDateOnly(iso) {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Human-friendly name shown in the share sheet, based on the generation time
// (e.g. "Jun 18, 1.05.00 AM"). Colons are illegal in filenames, so we use
// periods — otherwise the OS/share target sanitizes them to underscores
// ("1_05_00"), which looks broken.
function buildPdfFileName(date = new Date()) {
  return date
    .toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    })
    .replace(/:/g, ".");
}

function formatTimeOnly(iso) {
  const date = new Date(iso);
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  hours = String(hours).padStart(2, '0');
  return `${hours}:${minutes}:${seconds} ${ampm}`;
}

// ─── PDF builders ─────────────────────────────────────────────────────────────
function escapeHtml(raw) {
  // Coerce anything (null, undefined, numbers, objects) to a string so a stray
  // value can never throw and abort PDF generation.
  if (raw == null) return "";
  return String(raw)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Last-resort builder: a dead-simple document that cannot fail to assemble,
// used only if the rich builder ever throws on malformed scan data.
function buildFallbackHtml(items) {
  const rows = (items || []).map((item, i) => `
    <div style="margin:0 0 14px;padding:10px;border:1px solid #000;">
      <div style="font-weight:bold;margin-bottom:4px;">Scanned Item #${i + 1}</div>
      <div style="white-space:pre-wrap;word-break:break-word;font-size:11px;">${escapeHtml(item && item.raw)}</div>
    </div>
  `).join("");
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
    <style>@page{size:A4;margin:15mm;}body{font-family:Arial,sans-serif;font-size:12px;color:#000;}</style>
    </head><body><h3 style="margin-bottom:12px;">QR Scan Report</h3>${rows}</body></html>`;
}

function buildMultiPageHtml(items, source, session, isPreview = false) {
  const total = items.length;

  // ── helpers ──────────────────────────────────────────────────────────────
  const sessionTableHtml = session ? `
    <table class="session-table">
      <thead>
        <tr>
          <th>Username</th>
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
          <td>${formatDateForLogin(new Date().toISOString())}</td>
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
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${formatDateForLogin(new Date().toISOString())}</td>
          <td>${source}</td>
          <td>${total}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  `;

  // Build one HTML block per scanned item — no manual pagination
  const itemBlocksHtml = items.map((item, i) => {
    const type = detectType(item.raw);
    const parsedData = type === "Pharma Data" ? parsePharmaData(item.raw) : null;

    if (parsedData) {
      const rowsHtml = parsedData.map((pair) => `
        <tr>
          <td class="pharma-key">${escapeHtml(pair.key)}</td>
          <td class="pharma-value">${escapeHtml(pair.value)}</td>
        </tr>
      `).join('');
      return `
        <div class="item-block">
          <div class="table-label">Scanned Item #${i + 1}</div>
          <table class="pharma-table">
            <tbody>${rowsHtml}</tbody>
          </table>
          <div class="table-meta">
            <span>${formatDateOnly(item.scannedAt)}</span>
            <span>${formatTimeOnly(item.scannedAt)}</span>
          </div>
        </div>
      `;
    } else {
      return `
        <div class="item-block">
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
                <td class="content">${escapeHtml(item.raw)}</td>
                <td class="date">${formatDateOnly(item.scannedAt)}</td>
                <td class="time">${formatTimeOnly(item.scannedAt)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>QR Scan Report</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  @page {
    size: A4;
    margin: 15mm;
  }

  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    color: #000;
    background: #fff;
    ${isPreview ? 'padding: 50px 100px;' : ''}
  }

  .section-label {
    font-size: 10px;
    font-weight: bold;
    letter-spacing: 1.2px;
    color: #555;
    text-transform: uppercase;
    margin-bottom: 6px;
  }

  /* Keep every item whole — never split across a page break */
  .item-block {
    margin-top: 20px;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .table-label {
    font-size: 10px;
    font-weight: bold;
    letter-spacing: 1px;
    color: #555;
    text-transform: uppercase;
    margin-bottom: 6px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }

  th {
    border: 1px solid #000;
    padding: 7px 8px;
    text-align: left;
    font-size: 10px;
    font-weight: bold;
    text-transform: uppercase;
    background-color: #e8e8e8;
  }

  td {
    border: 1px solid #000;
    padding: 7px 8px;
  }

  tr:nth-child(even) td {
    background-color: #f9f9f9;
  }

  .session-table { margin-bottom: 0; }

  .type   { text-align: center; width: 15%; font-weight: 600; }
  .content { width: 50%; word-break: break-word; font-size: 10px; }
  .date   { width: 17.5%; text-align: center; }
  .time   { width: 17.5%; text-align: center; }

  .pharma-table td { border: 1px solid #000; padding: 7px 8px; font-size: 10px; }
  .pharma-key   { font-weight: bold; width: 35%; background-color: #e8e8e8; }
  .pharma-value { word-break: break-word; }

  .table-meta {
    display: flex;
    justify-content: space-between;
    margin-top: 5px;
    font-size: 9px;
    color: #555;
  }
${isPreview ? `
  /* Preview-only: give every scanned item an identical gap above it so the
     spacing reads evenly regardless of item type. Does not affect the PDF. */
  .item-block { margin-top: 0; }
  .session-table + .item-block,
  .item-block + .item-block { margin-top: 18px; }
` : ''}
</style>
</head>
<body>
  <div class="section-label">LOGIN INFORMATION</div>
  ${sessionTableHtml}
  ${itemBlocksHtml}
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
        style={{ flex: 1 }}
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
  wrapper: { flex: 1 },
  listContent: { paddingRight: 10, flexGrow: 1 },
  track: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderRadius: 2,
    backgroundColor: "rgba(0,45,143,0.12)",
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
  const [pdfFileName, setPdfFileName] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const tickScale = useRef(new Animated.Value(1)).current;
  // Mirror showPreview into a ref so the back handler always sees the latest
  // value without needing to re-subscribe on every toggle.
  const showPreviewRef = useRef(showPreview);
  useEffect(() => { showPreviewRef.current = showPreview; }, [showPreview]);

  // ── Handle Android back button ──────────────────────────────────────────
  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      // If the preview modal is open, back should close it, not the screen.
      if (showPreviewRef.current) {
        setShowPreview(false);
        return true;
      }
      onReset();
      return true; // Indicate we've handled the back button
    });

    return () => backHandler.remove();
  }, [onReset]);

  const generatePdf = useCallback(async () => {
    setStatus("generating");

    // 1) Build the HTML. A malformed scan must never abort generation, so on the
    //    off chance the builder throws we fall back to a minimal plain-text dump.
    let html;
    try {
      html = buildMultiPageHtml(items, source, session);
    } catch (buildErr) {
      console.warn("PDF HTML build failed, using fallback:", buildErr);
      html = buildFallbackHtml(items);
    }

    // 2) Render to a file. expo-print fails transiently on Android (WebView init
    //    races, memory pressure), so retry a few times with backoff before
    //    giving up — this is what makes generation reliable instead of "random".
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        // Let expo-print write to its own temp location — don't move it,
        // moving across directories on Android can fail.
        const { uri } = await Print.printToFileAsync({ html });
        setPdfUri(uri);
        setPdfFileName(buildPdfFileName());
        setStatus("done");
        return;
      } catch (err) {
        console.warn(`PDF generation attempt ${attempt}/${MAX_ATTEMPTS} failed:`, err);
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
        }
      }
    }

    // 3) Every attempt failed. Don't pop an alert — quietly return to the idle
    //    state so the "Generate PDF" button is right there to tap again.
    setStatus("idle");
  }, [items, source, session]);

  const previewPdf = useCallback(() => {
    setShowPreview(true);
  }, []);

  const sharePdf = useCallback(async () => {
    if (!pdfUri) return;
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert("Sharing unavailable", "This device does not support file sharing.");
        return;
      }

      // Share a copy named after the generation time (e.g. "Jun 18, 1:05:00 AM").
      // If the named copy fails for any reason, fall back to sharing the original
      // temp file so Share never silently no-ops.
      let uriToShare = pdfUri;
      try {
        const baseName = pdfFileName || buildPdfFileName();
        const namedUri = FileSystem.cacheDirectory + baseName + ".pdf";
        await FileSystem.copyAsync({ from: pdfUri, to: namedUri });
        uriToShare = namedUri;
      } catch (copyErr) {
        console.warn("Named copy failed, sharing original:", copyErr);
      }

      await Sharing.shareAsync(uriToShare, { mimeType: "application/pdf" });
    } catch (err) {
      // Treat a user-dismissed share sheet as a no-op; surface real failures.
      console.warn("Share failed:", err);
    }
  }, [pdfUri, pdfFileName]);

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
            {/* <Text style={s.sourceBadgeText}>{source === "camera" ? "Camera" : "Hardware"}</Text> */}
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
                Generate PDF
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
              <View style={s.rowBtns}>
                <TouchableOpacity style={[s.secondaryBtn, s.rowBtn]} onPress={onReset} activeOpacity={0.8}>
                  <Ionicons name="camera-outline" size={16} color={C.subtle} />
                  <Text style={s.secondaryBtnText}>Scan More</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.secondaryBtn, s.rowBtn]} onPress={previewPdf} activeOpacity={0.8}>
                  <Ionicons name="eye-outline" size={16} color={C.subtle} />
                  <Text style={s.secondaryBtnText}>Preview</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={s.primaryBtn} onPress={sharePdf} activeOpacity={0.85}>
                <Ionicons name="share-outline" size={18} color="#fff" />
                <Text style={s.primaryBtnText}>Share PDF</Text>
              </TouchableOpacity>
            </>
          )}

          {status !== "done" && (
            <TouchableOpacity style={s.secondaryBtn} onPress={onReset} activeOpacity={0.8}>
              <Ionicons name="camera-outline" size={16} color={C.subtle} />
              <Text style={s.secondaryBtnText}>Scan More QR Codes</Text>
            </TouchableOpacity>
          )}
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
              <Ionicons name="share-outline" size={20} color="#002d8f" />
            </TouchableOpacity>
          </View>
          {showPreview && (
            <WebView
              style={{ flex: 1 }}
              originWhitelist={["*"]}
              source={{ html: buildMultiPageHtml(items, source, session, true) }}
              startInLoadingState
              scalesPageToFit={true}
              builtInZoomControls={true}
              displayZoomControls={false}
              renderLoading={() => (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                  <ActivityIndicator size="large" color="#002d8f" />
                </View>
              )}
            />
          )}
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
    shadowColor: "#002d8f",
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
    shadowColor: "#002d8f",
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
  rowBtns: {
    flexDirection: "row",
    gap: 10,
  },
  rowBtn: {
    flex: 1,
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