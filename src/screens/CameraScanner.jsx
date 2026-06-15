import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Platform,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons, Feather } from "@expo/vector-icons";
import {
  C,
  SCAN_BOX,
  ModeToggle,
  ScannedStrip,
  SessionBadge,
  EditSessionModal,
  ScannerHeader,
} from "./scannerUtils";

// ─── Camera Scanner Component ─────────────────────────────────────────────────
export default function CameraScanner({
  onScanComplete,
  onSwitchMode,
  initialItems = [],
  session,
  onChangeSession,
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [paused, setPaused] = useState(false); // true after each scan — waits for "Add QR" tap
  const [torch, setTorch] = useState(false);
  const [scannedItems, setScannedItems] = useState(initialItems);
  const [lastData, setLastData] = useState(null); // holds the most-recently scanned QR
  const [editModalVisible, setEditModalVisible] = useState(false);

  // ── handle a barcode from the camera ──────────────────────────────────────
  const handleBarcode = useCallback(
    ({ type, data }) => {
      if (paused) return;
      // auto-add to list and pause camera until user taps "Add QR" / Generate
      const newItem = { raw: data, type, scannedAt: new Date().toISOString() };
      setLastData(newItem);
      setScannedItems((prev) => [...prev, newItem]);
      setPaused(true);
    },
    [paused]
  );

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
        <TouchableOpacity
          style={s.grantBtn}
          onPress={requestPermission}
          activeOpacity={0.85}
        >
          <Text style={s.grantBtnText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.switchLink}
          onPress={() => onSwitchMode("hardware")}
        >
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

      {/* Header/Navbar with SafeAreaView - positioned on top */}
      <SafeAreaView edges={["top"]} style={s.headerSafeArea}>
        <ScannerHeader 
          session={session} 
          onEditPress={() => setEditModalVisible(true)}
          isCameraMode={true}
        />
      </SafeAreaView>

      <View style={s.overlay}>

        {/* Torch button — absolutely positioned on the viewport top-right */}
        <SafeAreaView
          edges={["top"]}
          style={s.torchWrap}
          pointerEvents="box-none"
        >
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
          </TouchableOpacity>
        </SafeAreaView>

        {/* Top dimmed area to push viewfinder down to the center */}
        <View style={s.dimTop}>
          <ModeToggle mode="camera" onChangeMode={onSwitchMode} />
        </View>

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
        <ScannedStrip
          items={scannedItems}
          onRemove={handleRemoveItem}
          onGenerate={canGenerate ? handleGenerate : null}
        />
      </View>

      <EditSessionModal
        visible={editModalVisible}
        session={session}
        onSave={(updated) => { onChangeSession(updated); setEditModalVisible(false); }}
        onDismiss={() => setEditModalVisible(false)}
      />
    </View>
  );
}

// ─── Camera-specific Styles ───────────────────────────────────────────────────
const s = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.bg,
  },
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
  headerSafeArea: {
    backgroundColor: "rgba(0,0,0,0.3)",
    zIndex: 10,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  overlay: { 
    flex: 1,
    flexDirection: "column",
  },
  dimTop: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.55)",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 16,
  },
  camMid: { flexDirection: "row", height: SCAN_BOX },
  dimSide: { flex: 1, backgroundColor: "rgba(255,255,255,0.55)" },
  scanBox: { width: SCAN_BOX, height: SCAN_BOX, borderRadius: 4 },
  corner: {
    position: "absolute",
    width: 26,
    height: 26,
    borderColor: C.accent,
    borderWidth: 3,
  },
  cTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  camBottom: {
    flex: 1,
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

  // Wrapper that lets ScannedStrip float above the camera view at the bottom
  camStripWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
});