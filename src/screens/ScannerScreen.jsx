import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  ScrollView,
  FlatList,
  AppState,
  Dimensions,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";

// ─── Theme ────────────────────────────────────────────────────────────────────
const C = {
  bg:           "#f0f4ff",       // cool blue-tinted white page
  surface:      "#ffffff",       // pure white cards
  elevated:     "#e8edf8",       // slightly deeper for nested surfaces
  border:       "#d1d9f0",       // soft blue-grey border
  muted:        "#8e9bbf",       // muted blue-grey text
  subtle:       "#6b7a9e",       // mid-tone label text
  body:         "#3d4a6b",       // readable body
  strong:       "#1e2a4a",       // strong text
  heading:      "#0f1829",       // near-black headings
  accent:       "#2563eb",       // vivid blue
  accentLight:  "#3b82f6",       // lighter blue for hover/icons
  accentDim:    "rgba(37,99,235,0.08)",
  accentBorder: "rgba(37,99,235,0.22)",
  accentText:   "#1d4ed8",       // slightly darker for text on white
  success:      "#16a34a",
  successDim:   "rgba(22,163,74,0.08)",
  error:        "#dc2626",
  errorDim:     "rgba(220,38,38,0.08)",
  errorBorder:  "rgba(220,38,38,0.25)",
  overlay:      "rgba(10,18,40,0.62)",
  torchOn:      "#f59e0b",
};

const { width: SCREEN_W } = Dimensions.get("window");
const SCAN_BOX   = SCREEN_W * 0.7;
const STRIP_SIZE = 80;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function detectType(raw) {
  if (/^https?:\/\//i.test(raw))              return "URL";
  if (/^mailto:/i.test(raw))                  return "Email";
  if (/^tel:/i.test(raw))                     return "Phone";
  if (/^(BEGIN:VCARD|BEGIN:VCAL)/i.test(raw)) return "Contact";
  if (/^WIFI:/i.test(raw))                    return "Wi-Fi";
  return "Text";
}

function shortPreview(raw, max = 28) {
  const s = raw.trim();
  return s.length > max ? s.slice(0, max) + "…" : s;
}

// ─── Mode Toggle ──────────────────────────────────────────────────────────────
function ModeToggle({ mode, onChangeMode }) {
  return (
    <View style={tog.wrap}>
      <TouchableOpacity
        style={[tog.tab, mode === "camera" && tog.active]}
        onPress={() => onChangeMode("camera")}
        activeOpacity={0.8}
      >
        <Ionicons name="camera-outline" size={20} color={mode === "camera" ? "#fff" : C.subtle} />
        <Text style={[tog.label, mode === "camera" && tog.labelActive]}>Camera</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[tog.tab, mode === "hardware" && tog.active]}
        onPress={() => onChangeMode("hardware")}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="barcode-scan" size={20} color={mode === "hardware" ? "#fff" : C.subtle} />
        <Text style={[tog.label, mode === "hardware" && tog.labelActive]}>Hardware</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Scanned strip item ───────────────────────────────────────────────────────
function StripItem({ item, index, onRemove, isNew }) {
  const type = detectType(item.raw);
  const opacity = useRef(new Animated.Value(isNew ? 0.4 : 1)).current;

  useEffect(() => {
    if (!isNew) return;
    Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={[strip.item, { opacity }]}>
      <TouchableOpacity style={strip.removeBtn} onPress={() => onRemove(index)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <View style={strip.removeBtnInner}>
          <Ionicons name="close" size={11} color="#fff" />
        </View>
      </TouchableOpacity>

      <View style={strip.indexBadge}>
        <Text style={strip.indexText}>{index + 1}</Text>
      </View>

      <MaterialCommunityIcons
        name={type === "URL" ? "web" : type === "Email" ? "email-outline" : type === "Phone" ? "phone-outline" : type === "Wi-Fi" ? "wifi" : "text"}
        size={20}
        color={C.accent}
        style={{ marginBottom: 4 }}
      />

      <Text style={strip.preview} numberOfLines={2}>
        {shortPreview(item.raw, 18)}
      </Text>
    </Animated.View>
  );
}

// ─── Scanned strip ────────────────────────────────────────────────────────────
function ScannedStrip({ items, onRemove, onGenerate }) {
  const listRef = useRef(null);
  const prevLenRef = useRef(items.length); // track length at mount to skip initial scroll
  const shouldScrollRef = useRef(false);   // flag: scroll on next content-size change
  const newestKeyRef = useRef(null);       // scannedAt of the freshly-added item

  useEffect(() => {
    if (items.length > prevLenRef.current) {
      shouldScrollRef.current = true;
      newestKeyRef.current = items[items.length - 1]?.scannedAt ?? null;
    }
    prevLenRef.current = items.length;
  }, [items.length]);

  const handleContentSizeChange = useCallback((contentWidth, _contentHeight) => {
    if (shouldScrollRef.current) {
      shouldScrollRef.current = false;
      // scrollToOffset to the true end (includes trailing paddingRight from contentContainerStyle)
      listRef.current?.scrollToOffset({ offset: contentWidth, animated: true });
    }
  }, []);

  if (items.length === 0) return null;

  return (
    <View style={strip.wrap}>
      <View style={strip.header}>
        <View style={strip.countRow}>
          <Text style={strip.countText}>{items.length} QR scanned</Text>
        </View>
        {onGenerate && (
          <TouchableOpacity style={strip.generateBtn} onPress={onGenerate} activeOpacity={0.85}>
            <Ionicons name="document-text-outline" size={16} color="#fff" />
            <Text style={strip.generateBtnText}>Generate PDF</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={{ overflow: "visible" }}>
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item, index }) => (
            <StripItem item={item} index={index} onRemove={onRemove} isNew={item.scannedAt === newestKeyRef.current} />
          )}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={strip.list}
          onContentSizeChange={handleContentSizeChange}
        />
      </View>
    </View>
  );
}

// ─── Camera Scanner ───────────────────────────────────────────────────────────
function SessionBadge({ session, onChangeSession }) {
  if (!session) return null;
  return (
    <TouchableOpacity style={sb.wrap} onPress={onChangeSession} activeOpacity={0.75}>
      <Ionicons name="person-circle-outline" size={13} color={C.accentText} />
      <Text style={sb.name} numberOfLines={1}>{session.username}</Text>
      <Text style={sb.sep}>·</Text>
      <Text style={sb.ref} numberOfLines={1}>{session.reference}</Text>
      <Ionicons name="chevron-down" size={11} color={C.muted} />
    </TouchableOpacity>
  );
}

const sb = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: C.surface,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: C.border,
    marginTop: 8,
    alignSelf: "center",
    maxWidth: "85%",
  },
  name: { color: C.accentText, fontSize: 11, fontWeight: "700", flexShrink: 1 },
  sep:  { color: C.muted, fontSize: 11 },
  ref:  { color: C.subtle, fontSize: 11, flexShrink: 1 },
});

function CameraScanner({ onScanComplete, onSwitchMode, initialItems = [], session, onChangeSession }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [paused, setPaused]         = useState(false);   // true after each scan — waits for "Add QR" tap
  const [torch, setTorch]           = useState(false);
  const [scannedItems, setScannedItems] = useState(initialItems);
  const [lastData, setLastData]     = useState(null);    // holds the most-recently scanned QR

  // ── handle a barcode from the camera ──────────────────────────────────────
  const handleBarcode = useCallback(({ type, data }) => {
    if (paused) return;
    // auto-add to list and pause camera until user taps "Add QR" / Generate
    const newItem = { raw: data, type, scannedAt: new Date().toISOString() };
    setLastData(newItem);
    setScannedItems((prev) => [...prev, newItem]);
    setPaused(true);
  }, [paused]);

  // ── "Add QR" → resume camera for next scan ────────────────────────────────
  const handleAddAnother = useCallback(() => {
    setLastData(null);
    setPaused(false);
  }, []);

  // ── remove an item from the strip ─────────────────────────────────────────
  const handleRemoveItem = useCallback((index) => {
    setScannedItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ── generate PDF with all collected items ─────────────────────────────────
  const handleGenerate = useCallback(() => {
    if (scannedItems.length === 0) return;
    onScanComplete({ items: scannedItems, source: "camera" });
  }, [scannedItems, onScanComplete]);

  const canGenerate = scannedItems.length > 0;

  // ── permission screens ────────────────────────────────────────────────────
  if (!permission) {
    return (
      <View style={s.centered}>
        <Text style={s.infoText}>Initializing camera…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={s.permWrap} edges={["top", "bottom"]}>
        <View style={s.permIconWrap}>
          <Ionicons name="camera-outline" size={40} color={C.accent} />
        </View>
        <Text style={s.permTitle}>Camera Access Needed</Text>
        <Text style={s.permSub}>
          Camera permission is required to scan QR codes and generate PDFs.
        </Text>
        <TouchableOpacity style={s.grantBtn} onPress={requestPermission} activeOpacity={0.85}>
          <Text style={s.grantBtnText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.switchLink} onPress={() => onSwitchMode("hardware")}>
          <Text style={s.switchLinkText}>Use hardware scanner instead</Text>
          <Ionicons name="arrow-forward" size={13} color={C.accent} />
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={s.camWrap}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={paused ? undefined : handleBarcode}
      />

      <View style={s.overlay}>
        {/* Header */}
        <View style={s.camTop}>
          <SafeAreaView edges={["top"]} style={s.camHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
              <Text style={s.camTitle}>QR</Text>
              <Ionicons name="arrow-forward" size={18} color={C.heading} style={{ marginHorizontal: 8 }} />
              <Text style={s.camTitle}>PDF</Text>
            </View>
            <SessionBadge session={session} onChangeSession={onChangeSession} />
            <ModeToggle mode="camera" onChangeMode={onSwitchMode} />
          </SafeAreaView>
        </View>

        {/* Torch button — absolutely positioned on the viewport top-right */}
        <SafeAreaView edges={["top"]} style={s.torchWrap} pointerEvents="box-none">
          <TouchableOpacity
            style={[s.torchBtn, torch && s.torchBtnOn]}
            onPress={() => setTorch((p) => !p)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={torch ? "flashlight" : "flashlight-outline"}
              size={17}
              color={torch ? C.torchOn : C.heading}
            />
            {/* <Text style={[s.torchLabel, torch && { color: C.torchOn }]}>
              {torch ? "Torch On" : "Torch Off"}
            </Text> */}
          </TouchableOpacity>
        </SafeAreaView>

        {/* Viewfinder */}
        <View style={s.camMid}>
          <View style={s.dimSide} />
          <View style={s.scanBox}>
            <View style={[s.corner, s.cTL]} />
            <View style={[s.corner, s.cTR]} />
            <View style={[s.corner, s.cBL]} />
            <View style={[s.corner, s.cBR]} />
          </View>
          <View style={s.dimSide} />
        </View>

        {/* Bottom controls */}
        <View style={s.camBottom}>

          {/* "Add QR" button — appears after each scan so user can scan another */}
          {paused && (
            <TouchableOpacity
              style={s.addQrBtn}
              onPress={handleAddAnother}
              activeOpacity={0.85}
            >
              <Feather name="plus" size={17} color="#fff" />
              <Text style={s.addQrBtnText}>Add QR</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Scanned strip floats above the camera overlay at the very bottom */}
      <View style={s.camStripWrap}>
        <ScannedStrip items={scannedItems} onRemove={handleRemoveItem} onGenerate={canGenerate ? handleGenerate : null} />
      </View>
    </View>
  );
}

// ─── Hardware Scanner ─────────────────────────────────────────────────────────
function HardwareScanner({ onScanComplete, onSwitchMode, initialItems = [], session, onChangeSession }) {
  const [currentInput, setCurrentInput] = useState("");
  const [scannedItems, setScannedItems] = useState(initialItems);
  const inputRef    = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const prevLenRef  = useRef(0);

  const refocus = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  useEffect(() => {
    refocus();
    const sub = AppState.addEventListener("change", (next) => {
      if (appStateRef.current.match(/inactive|background/) && next === "active") refocus();
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [refocus]);

  const handleTextChange = useCallback((text) => {
    setCurrentInput(text);
    if (text.endsWith("\n")) {
      const trimmed = text.trim();
      if (trimmed.length > 0) {
        const newItem = { raw: trimmed, scannedAt: new Date().toISOString() };
        setScannedItems((prev) => [...prev, newItem]);
        // Keep the scanned data in the input field until the next scan overwrites it
        setCurrentInput(trimmed);
        prevLenRef.current = 0;
        refocus();
      }
    }
  }, [refocus]);

  const handleRemoveItem = useCallback((index) => {
    setScannedItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleGenerate = () => {
    const items = [...scannedItems];
    const pending = currentInput.trim();
    if (pending) items.push({ raw: pending, scannedAt: new Date().toISOString() });
    if (items.length === 0) return;
    onScanComplete({ items, source: "hardware" });
  };

  const handleManualCommit = () => {
    const trimmed = currentInput.trim();
    if (!trimmed) return;
    setScannedItems((prev) => [...prev, { raw: trimmed, scannedAt: new Date().toISOString() }]);
    // Keep the data in the input field until the next scan overwrites it
    setCurrentInput(trimmed);
    refocus();
  };

  const canGenerate = scannedItems.length > 0 || currentInput.trim().length > 0;
  const hasText     = currentInput.trim().length > 0;

  return (
    <View style={s.hwWrap}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <ScrollView
          contentContainerStyle={s.hwScroll}
          bounces={false}
          keyboardShouldPersistTaps="always"
        >
          {/* Header */}
          <View style={s.hwHeader}>
            <Text style={s.camTitle}>QR → PDF</Text>
            <ModeToggle mode="hardware" onChangeMode={onSwitchMode} />
          </View>

          {/* Session card */}
          {session && (
            <View style={s.sessionCard}>
              <View style={s.sessionCardHeader}>
                <Text style={s.sessionCardTitle}>Login Details</Text>
                <TouchableOpacity style={s.sessionEditBtn} onPress={onChangeSession} activeOpacity={0.75}>
                  <Feather name="edit-2" size={13} color={C.accentText} />
                  <Text style={s.sessionEditBtnText}>Edit</Text>
                </TouchableOpacity>
              </View>
              <View style={s.sessionHeaderDivider} />
              <View style={s.sessionRow}>
                <Text style={s.sessionRowLabel}>User</Text>
                <Text style={s.sessionRowValue} numberOfLines={1}>{session.username}</Text>
              </View>
              <View style={s.sessionRowDivider} />
              <View style={s.sessionRow}>
                <Text style={s.sessionRowLabel}>Location</Text>
                <Text style={s.sessionRowValue} numberOfLines={1}>{session.location}</Text>
              </View>
              <View style={s.sessionRowDivider} />
              <View style={s.sessionRow}>
                <Text style={s.sessionRowLabel}>Lot / Invoice / Batch No</Text>
                <Text style={s.sessionRowValue} numberOfLines={1}>{session.reference}</Text>
              </View>
            </View>
          )}

          {/* ── Big scan target box ── */}
          <View style={s.inputGroup}>
            <Text style={s.inputLabel}>SCAN TARGET</Text>

            {/* Static outer ring */}
            <View style={s.scanRingOuter}>
              {/* Inner card */}
              <View style={[s.scanTargetBox, hasText && s.scanTargetBoxFilled]}>

                {/* Hidden TextInput — captures hardware scanner input, invisible to user */}
                <TextInput
                  ref={inputRef}
                  style={s.hiddenInput}
                  value={currentInput}
                  onChangeText={handleTextChange}
                  multiline={false}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  showSoftInputOnFocus={false}
                  caretHidden={true}
                  onBlur={refocus}
                  returnKeyType="done"
                  onSubmitEditing={handleManualCommit}
                />

                {/* Visual display */}
                {hasText ? (
                  <Text style={s.scanTargetValue} numberOfLines={3}>{currentInput}</Text>
                ) : (
                  <View style={s.scanTargetIdle}>
                    <MaterialCommunityIcons name="line-scan" size={40} color={C.accentBorder} style={{ marginBottom: 12 }} />
                    <Text style={s.scanTargetPlaceholder}>Waiting for scan</Text>
                    <Text style={s.scanTargetSub}>Point your scanner at a QR code</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Add button — only shown when there's text */}
            {hasText && (
              <TouchableOpacity style={s.addBtnFull} onPress={handleManualCommit} activeOpacity={0.85}>
                <Feather name="plus" size={18} color="#fff" />
                <Text style={s.addBtnFullText}>Add to list</Text>
              </TouchableOpacity>
            )}

            {/* <Text style={s.inputHint}>
              Scans auto-add on each scan. Tap "Add to list" or press Enter to add manually.
            </Text> */}
          </View>
        </ScrollView>

        {/* Sticky bottom strip */}
        <ScannedStrip items={scannedItems} onRemove={handleRemoveItem} onGenerate={canGenerate ? handleGenerate : null} />
      </SafeAreaView>
    </View>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function ScannerScreen({ onScanComplete, initialItems = [], initialMode = "camera", session, onChangeSession }) {
  const [mode, setMode] = useState(initialMode);
  return mode === "camera" ? (
    <CameraScanner onScanComplete={onScanComplete} onSwitchMode={setMode} initialItems={initialItems} session={session} onChangeSession={onChangeSession} />
  ) : (
    <HardwareScanner onScanComplete={onScanComplete} onSwitchMode={setMode} initialItems={initialItems} session={session} onChangeSession={onChangeSession} />
  );
}

// ─── Strip Styles ─────────────────────────────────────────────────────────────
const strip = StyleSheet.create({
  wrap: {
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingBottom: 8,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  countText: {
    color: C.accent,
    fontSize: 20,
    fontWeight: "700",
  },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.accent,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 20,
  },
  generateBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  list: {
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 8,
  },
  item: {
    width: STRIP_SIZE,
    height: STRIP_SIZE,
    backgroundColor: C.elevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
    position: "relative",
    overflow: "visible",
  },
  removeBtn: {
    position: "absolute",
    top: -9,
    right: -9,
    zIndex: 10,
  },
  removeBtnInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  indexBadge: {
    position: "absolute",
    top: 4,
    left: 6,
    backgroundColor: C.accentDim,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  indexText: {
    color: C.accentText,
    fontSize: 9,
    fontWeight: "800",
  },
  preview: {
    color: C.subtle,
    fontSize: 9,
    textAlign: "center",
    lineHeight: 12,
    marginTop: 2,
  },
});

// ─── Toggle Styles ────────────────────────────────────────────────────────────
const tog = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    backgroundColor: C.elevated,
    borderRadius: 28,
    padding: 4,
    marginTop: 12,
    borderWidth: 1,
    borderColor: C.border,
    alignSelf: "center",
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 24,
  },
  active: {
    backgroundColor: C.accent,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  label: { fontSize: 16, fontWeight: "600", color: C.muted },
  labelActive: { color: "#fff" },
});

// ─── Main Styles ──────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg },
  infoText: { color: C.subtle, fontSize: 15 },

  // Permission screen
  permWrap: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
  },
  permIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: C.accentDim,
    borderWidth: 1.5,
    borderColor: C.accentBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  permTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: C.heading,
    marginBottom: 12,
    textAlign: "center",
  },
  permSub: {
    fontSize: 14,
    color: C.subtle,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 28,
  },
  grantBtn: {
    backgroundColor: C.accent,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  grantBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  switchLink: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  switchLinkText: { color: C.accentText, fontSize: 13, fontWeight: "600" },

  // Camera overlay (viewfinder stays dark regardless of theme)
  camWrap: { flex: 1, backgroundColor: "#000" },
  overlay: { ...StyleSheet.absoluteFillObject, flexDirection: "column" },
  camTop: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 10,
  },
  camHeader: {
    alignSelf: "stretch",
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 16,
    position: "relative",
  },
  camTitle: {
    color: C.heading,
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  camMid: { flexDirection: "row", height: SCAN_BOX },
  dimSide: { flex: 1, backgroundColor: "rgba(255,255,255,0.55)" },
  scanBox: { width: SCAN_BOX, height: SCAN_BOX, borderRadius: 4 },
  corner: { position: "absolute", width: 26, height: 26, borderColor: C.accent, borderWidth: 3 },
  cTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  camBottom: {
    flex: 1.2,
    backgroundColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    paddingTop: 28,
    gap: 20,
  },
  hintRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  hint: { color: C.heading, fontSize: 14, fontWeight: "500" },
  // Torch — absolutely pinned to viewport top-right, above everything
  torchWrap: {
    position: "absolute",
    top: 0,
    right: 16,
    alignItems: "flex-end",
    marginTop: 16,
  },
  torchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.7)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.border,
  },
  torchBtnOn: {
    backgroundColor: "rgba(245,158,11,0.15)",
    borderColor: C.torchOn,
  },
  torchLabel: { color: C.heading, fontSize: 13, fontWeight: "600" },

  // Camera multi-scan: "Add QR" button (appears after each scan)
  addQrBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.accent,
    paddingHorizontal: 28,
    paddingVertical: 11,
    borderRadius: 24,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  addQrBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },

  // Camera multi-scan: "Generate PDF" button inside the camera view
  camGenerateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.success,
    paddingHorizontal: 28,
    paddingVertical: 11,
    borderRadius: 24,
    shadowColor: C.success,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  camGenerateBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },

  // Wrapper that lets ScannedStrip float above the camera view at the bottom
  camStripWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },

  // Hardware screen
  hwWrap: { flex: 1, backgroundColor: C.bg },
  hwScroll: { padding: 20, paddingBottom: 16 },
  hwHeader: { alignItems: "center", marginBottom: 24 },

  // Session card
  sessionCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 22,
    overflow: "hidden",
  },
  sessionCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.accentDim,
  },
  sessionCardTitle: {
    color: C.accentText,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  sessionEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.surface,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.accentBorder,
  },
  sessionEditBtnText: {
    color: C.accentText,
    fontSize: 12,
    fontWeight: "700",
  },
  sessionHeaderDivider: {
    height: 1,
    backgroundColor: C.border,
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  sessionRowLabel: {
    color: C.muted,
    fontSize: 12,
    fontWeight: "600",
    flexShrink: 0,
  },
  sessionRowValue: {
    flex: 1,
    color: C.heading,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right",
  },
  sessionRowDivider: {
    height: 1,
    backgroundColor: C.border,
    marginHorizontal: 16,
  },

  inputGroup: { marginBottom: 16 },
  inputLabel: {
    color: C.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 12,
  },

  // Static outer ring — solid accent blue with a small gap between ring and inner card
  scanRingOuter: {
    borderRadius: 20,
    borderWidth: 2,
    borderColor: C.accent,
    padding: 1,
    marginBottom: 12,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },

  // The visible big card
  scanTargetBox: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.border,
    minHeight: 140,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    overflow: "hidden",
  },
  scanTargetBoxFilled: {
    borderColor: C.accent,
    backgroundColor: "#f5f8ff",
  },

  // Invisible TextInput that sits on top, capturing all keystrokes
  hiddenInput: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    opacity: 0,
    color: "transparent",
  },

  // Idle state (no text yet)
  scanTargetIdle: {
    alignItems: "center",
    pointerEvents: "none",
  },
  scanTargetPlaceholder: {
    color: C.muted,
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 6,
  },
  scanTargetSub: {
    color: C.muted,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 17,
  },

  // Active state — scanned text display
  scanTargetValue: {
    color: C.heading,
    fontSize: 16,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    textAlign: "center",
    lineHeight: 24,
    pointerEvents: "none",
  },

  // Full-width Add button shown below box when text is present
  addBtnFull: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 13,
    marginBottom: 8,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  addBtnFullText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

  // kept for any legacy reference but no longer used in HW scanner
  inputRow: { flexDirection: "row", alignItems: "stretch", gap: 8 },
  input: {
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    color: C.heading,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    height: 52,
  },
  inputFilled: {
    borderColor: C.accent,
    backgroundColor: "#f8faff",
  },
  addBtn: {
    backgroundColor: C.accent,
    borderRadius: 12,
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  inputHint: { color: C.muted, fontSize: 11, marginTop: 2, lineHeight: 16 },

  primaryBtn: {
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 5,
  },
  primaryBtnOff: { opacity: 0.38, shadowOpacity: 0 },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});