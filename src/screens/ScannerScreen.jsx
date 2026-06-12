import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  AppState,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

// ─── Theme ────────────────────────────────────────────────────────────────────
const C = {
  bg:        "#0f0f0f",   // bianco-50  — page background
  surface:   "#242424",   // bianco-100 — cards, inputs
  elevated:  "#3a3a3a",   // bianco-200 — elevated surfaces
  border:    "#4a4a4a",   // bianco-300 — borders
  muted:     "#6f6f6f",   // bianco-400 — muted text / placeholders
  subtle:    "#8b8b8b",   // bianco-500 — secondary text
  body:      "#cbcbcb",   // bianco-700 — body text
  strong:    "#e2e2e2",   // bianco-800 — strong text
  heading:   "#eeeeee",   // bianco-900 — headings / primary text
  accent:    "#6366f1",   // indigo — interactive accent
  accentDim: "rgba(99,102,241,0.15)",
  accentBorder: "rgba(99,102,241,0.35)",
  success:   "#4ade80",
  error:     "#f87171",
  overlay:   "rgba(10,10,10,0.74)",
};

const { width: SCREEN_W } = require("react-native").Dimensions.get("window");
const SCAN_BOX = SCREEN_W * 0.7;

// ─── Mode Toggle ──────────────────────────────────────────────────────────────
function ModeToggle({ mode, onChangeMode }) {
  return (
    <View style={tog.wrap}>
      <TouchableOpacity
        style={[tog.tab, mode === "camera" && tog.active]}
        onPress={() => onChangeMode("camera")}
        activeOpacity={0.8}
      >
        <Ionicons
          name="camera-outline"
          size={15}
          color={mode === "camera" ? C.heading : C.muted}
        />
        <Text style={[tog.label, mode === "camera" && tog.labelActive]}>
          Camera
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[tog.tab, mode === "hardware" && tog.active]}
        onPress={() => onChangeMode("hardware")}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons
          name="barcode-scan"
          size={15}
          color={mode === "hardware" ? C.heading : C.muted}
        />
        <Text style={[tog.label, mode === "hardware" && tog.labelActive]}>
          Hardware
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Camera Scanner ───────────────────────────────────────────────────────────
function CameraScanner({ onScanComplete, onSwitchMode }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torch, setTorch] = useState(false);

  useEffect(() => {
    if (scanned) {
      const t = setTimeout(() => setScanned(false), 2000);
      return () => clearTimeout(t);
    }
  }, [scanned]);

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
        <Ionicons name="camera-outline" size={64} color={C.accent} style={{ marginBottom: 24 }} />
        <Text style={s.permTitle}>Camera Access Needed</Text>
        <Text style={s.permSub}>
          Camera permission is required to scan QR codes and generate PDFs from them.
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

  const handleBarcode = ({ type, data }) => {
    if (scanned) return;
    setScanned(true);
    onScanComplete({ raw: data, type, scannedAt: new Date().toISOString(), source: "camera" });
  };

  return (
    <View style={s.camWrap}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={handleBarcode}
      />

      {/* Dim overlay */}
      <View style={s.overlay}>
        {/* Header row */}
        <View style={s.camTop}>
          <SafeAreaView edges={["top"]} style={s.camHeader}>
            <Text style={s.camTitle}>QR → PDF</Text>
            <ModeToggle mode="camera" onChangeMode={onSwitchMode} />
          </SafeAreaView>
        </View>

        {/* Scan box row */}
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

        {/* Bottom row */}
        <View style={s.camBottom}>
          <Text style={s.hint}>
            {scanned ? (
              <Text>
                <Ionicons name="checkmark-circle" size={15} color={C.success} /> Detected!
              </Text>
            ) : (
              "Point your camera at a QR code"
            )}
          </Text>
          <TouchableOpacity
            style={[s.torchBtn, torch && s.torchBtnOn]}
            onPress={() => setTorch((p) => !p)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={torch ? "flashlight" : "flashlight-outline"}
              size={17}
              color={torch ? "#fde047" : C.body}
            />
            <Text style={[s.torchLabel, torch && { color: "#fde047" }]}>
              {torch ? "Torch On" : "Torch Off"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Hardware Scanner ─────────────────────────────────────────────────────────
function HardwareScanner({ onScanComplete, onSwitchMode }) {
  const [scannedData, setScannedData] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  // Re-focus whenever the screen comes back into view or app resumes
  const refocus = useCallback(() => {
    // Small delay lets the UI settle before focusing
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  useEffect(() => {
    // Initial focus
    refocus();

    // Re-focus when app comes back from background
    const sub = AppState.addEventListener("change", (next) => {
      if (appStateRef.current.match(/inactive|background/) && next === "active") {
        refocus();
      }
      appStateRef.current = next;
    });

    return () => sub.remove();
  }, [refocus]);

  const handleSubmit = () => {
    const trimmed = scannedData.trim();
    if (!trimmed) {
      Alert.alert("Nothing scanned", "Press the scanner button while the field is focused.");
      return;
    }
    setIsProcessing(true);
    setTimeout(() => {
      onScanComplete({
        raw: trimmed,
        type: "barcode",
        scannedAt: new Date().toISOString(),
        source: "hardware",
      });
      setIsProcessing(false);
    }, 300);
  };

  const handleClear = () => {
    setScannedData("");
    refocus();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={s.hwWrap}
    >
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

          {/* Device card */}
          <View style={s.deviceCard}>
            <MaterialCommunityIcons name="barcode-scan" size={28} color={C.accent} />
            <View style={{ flex: 1 }}>
              <Text style={s.deviceTitle}>Scanning Mode</Text>
              <Text style={s.deviceSub}>
                Press the scanner button on your device. Data will appear in the field below automatically.
              </Text>
            </View>
          </View>

          {/* Input group */}
          <View style={s.inputGroup}>
            <Text style={s.inputLabel}>SCAN TARGET</Text>
            {/*
              showSoftInputOnFocus={false} → field stays focused (accepts hardware
              scanner input) but the software keyboard never auto-opens.
              Tapping it while it's already focused will open the keyboard so the
              user can type manually if needed.
            */}
            <TextInput
              ref={inputRef}
              style={[s.input, scannedData.length > 0 && s.inputFilled]}
              placeholder="Waiting for scan…"
              placeholderTextColor={C.muted}
              value={scannedData}
              onChangeText={setScannedData}
              multiline
              numberOfLines={4}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              editable={!isProcessing}
              onSubmitEditing={handleSubmit}
              // Keep hardware scanners working without popping the soft keyboard
              showSoftInputOnFocus={false}
              // Re-focus if somehow blurred
              onBlur={refocus}
            />
          </View>

          {/* Preview */}
          {scannedData.length > 0 && (
            <View style={s.previewCard}>
              <View style={s.previewRow}>
                <Ionicons name="checkmark-circle" size={14} color={C.success} />
                <Text style={s.previewLabel}>DATA CAPTURED — {scannedData.length} chars</Text>
              </View>
              <Text style={s.previewValue} numberOfLines={3} selectable>
                {scannedData}
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={s.actions}>
            {!isProcessing ? (
              <>
                <TouchableOpacity
                  style={[s.primaryBtn, !scannedData.trim() && s.primaryBtnOff]}
                  onPress={handleSubmit}
                  disabled={!scannedData.trim()}
                  activeOpacity={0.85}
                >
                  <Ionicons name="document-text-outline" size={18} color="#fff" />
                  <Text style={s.primaryBtnText}>Generate PDF</Text>
                </TouchableOpacity>

                {scannedData.length > 0 && (
                  <TouchableOpacity style={s.secondaryBtn} onPress={handleClear} activeOpacity={0.8}>
                    <Ionicons name="refresh-outline" size={16} color={C.subtle} />
                    <Text style={s.secondaryBtnText}>Clear & Re-scan</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <View style={s.processingBox}>
                <Text style={s.processingText}>Processing scan…</Text>
              </View>
            )}
          </View>

          {/* Tips */}
          <View style={s.tipsCard}>
            <View style={s.tipsRow}>
              <Ionicons name="information-circle-outline" size={16} color={C.accent} />
              <Text style={s.tipsTitle}>Tips for Scanning</Text>
            </View>
            {[
              "Scan to enter data",
              "Tap to type",
              "Tap and rescan if needed",
              "Paste or type manually",
            ].map((tip, i) => (
              <View key={i} style={s.tipRow}>
                <Ionicons name="ellipse" size={5} color={C.muted} style={{ marginTop: 6 }} />
                <Text style={s.tipText}>{tip}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function ScannerScreen({ onScanComplete }) {
  const [mode, setMode] = useState("camera");
  return mode === "camera" ? (
    <CameraScanner onScanComplete={onScanComplete} onSwitchMode={setMode} />
  ) : (
    <HardwareScanner onScanComplete={onScanComplete} onSwitchMode={setMode} />
  );
}

// ─── Toggle Styles ────────────────────────────────────────────────────────────
const tog = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 20,
    padding: 3,
    marginTop: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 17,
  },
  active: { backgroundColor: C.accent },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: C.muted,
  },
  labelActive: { color: C.heading },
});

// ─── Main Styles ──────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  centered: {
    flex: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: C.bg,
  },
  infoText: { color: C.subtle, fontSize: 15 },

  // Permission screen
  permWrap: {
    flex: 1, backgroundColor: C.bg,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 36,
  },
  permTitle: {
    fontSize: 22, fontWeight: "700", color: C.heading,
    marginBottom: 12, textAlign: "center",
  },
  permSub: {
    fontSize: 14, color: C.subtle, textAlign: "center",
    lineHeight: 21, marginBottom: 28,
  },
  grantBtn: {
    backgroundColor: C.accent,
    paddingHorizontal: 32, paddingVertical: 14,
    borderRadius: 12, marginBottom: 16,
  },
  grantBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  switchLink: {
    flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4,
  },
  switchLinkText: { color: C.accent, fontSize: 13, fontWeight: "600" },

  // Camera
  camWrap: { flex: 1, backgroundColor: "#000" },
  overlay: { ...StyleSheet.absoluteFillObject, flexDirection: "column" },
  camTop: {
    flex: 1,
    backgroundColor: C.overlay,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 10,
  },
  camHeader: { alignItems: "center", paddingTop: 8, paddingBottom: 12 },
  camTitle: {
    color: C.heading, fontSize: 21, fontWeight: "800", letterSpacing: 1.5,
  },
  camMid: { flexDirection: "row", height: SCAN_BOX },
  dimSide: { flex: 1, backgroundColor: C.overlay },
  scanBox: { width: SCAN_BOX, height: SCAN_BOX, borderRadius: 4 },
  corner: {
    position: "absolute", width: 26, height: 26,
    borderColor: C.accent, borderWidth: 3,
  },
  cTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 },
  cTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 4 },
  cBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 4 },
  cBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 4 },
  camBottom: {
    flex: 1.2, backgroundColor: C.overlay,
    alignItems: "center", paddingTop: 28, gap: 20,
  },
  hint: { color: C.body, fontSize: 14, fontWeight: "500", textAlign: "center" },
  torchBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(255,255,255,0.10)",
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
  },
  torchBtnOn: {
    backgroundColor: "rgba(253,224,71,0.15)", borderColor: "#fde047",
  },
  torchLabel: { color: C.body, fontSize: 13, fontWeight: "600" },

  // Hardware
  hwWrap: { flex: 1, backgroundColor: C.bg },
  hwScroll: { padding: 20, paddingBottom: 52 },
  hwHeader: { alignItems: "center", marginBottom: 24 },

  deviceCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: C.accentDim,
    borderRadius: 14, padding: 16, marginBottom: 22,
    borderWidth: 1, borderColor: C.accentBorder,
  },
  deviceTitle: { color: C.heading, fontSize: 15, fontWeight: "700", marginBottom: 4 },
  deviceSub: { color: C.subtle, fontSize: 13, lineHeight: 19 },

  inputGroup: { marginBottom: 16 },
  inputLabel: {
    color: C.muted, fontSize: 10, fontWeight: "700",
    letterSpacing: 1.2, marginBottom: 8,
  },
  input: {
    backgroundColor: C.surface,
    borderRadius: 12, borderWidth: 2, borderColor: C.accent,
    color: C.heading, fontSize: 15, padding: 16,
    minHeight: 108, textAlignVertical: "top",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  inputFilled: {
    borderColor: C.accent,
    backgroundColor: "#1a1a1a",
  },

  previewCard: {
    backgroundColor: C.surface, borderRadius: 12, padding: 14,
    marginBottom: 16, borderWidth: 1, borderColor: C.border,
  },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  previewLabel: {
    color: C.success, fontSize: 10, fontWeight: "700", letterSpacing: 1,
  },
  previewValue: { color: C.body, fontSize: 13, lineHeight: 20 },

  actions: { gap: 12, marginBottom: 20 },
  primaryBtn: {
    backgroundColor: C.accent, borderRadius: 12,
    paddingVertical: 15, alignItems: "center",
    flexDirection: "row", justifyContent: "center", gap: 8,
  },
  primaryBtnOff: { opacity: 0.38 },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  secondaryBtn: {
    backgroundColor: C.surface, borderRadius: 12,
    paddingVertical: 15, alignItems: "center",
    flexDirection: "row", justifyContent: "center", gap: 8,
    borderWidth: 1, borderColor: C.border,
  },
  secondaryBtnText: { color: C.subtle, fontSize: 14, fontWeight: "600" },
  processingBox: { alignItems: "center", paddingVertical: 20 },
  processingText: { color: C.subtle, fontSize: 14 },

  tipsCard: {
    backgroundColor: C.surface, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: C.border, gap: 8,
  },
  tipsRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 4 },
  tipsTitle: { color: C.strong, fontSize: 13, fontWeight: "700" },
  tipRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  tipText: { color: C.muted, fontSize: 12, lineHeight: 19, flex: 1 },
});