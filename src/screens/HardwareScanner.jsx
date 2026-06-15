import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  AppState,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  C,
  ScannedStrip,
  EditSessionModal,
  ScannerHeader,
} from "./scannerUtils";

// ─── Hardware Scanner Component ────────────────────────────────────────────────
export default function HardwareScanner({
  onScanComplete,
  onSwitchMode,
  initialItems = [],
  session,
  onChangeSession,
}) {
  const [displayText, setDisplayText] = useState("");
  const [scannedItems, setScannedItems] = useState(initialItems);
  const [editModalVisible, setEditModalVisible] = useState(false);

  const inputRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const isMountedRef = useRef(true);
  // Uncontrolled: we track the current value ourselves via ref, not React state
  const currentValueRef = useRef("");

  // ── focus without showing soft keyboard ───────────────────────────────────
  const silentFocus = useCallback(() => {
    setTimeout(() => {
      if (isMountedRef.current) {
        inputRef.current?.focus();
      }
    }, 100);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    silentFocus();
    const sub = AppState.addEventListener("change", (next) => {
      if (appStateRef.current.match(/inactive|background/) && next === "active") {
        silentFocus();
      }
      appStateRef.current = next;
    });
    return () => {
      isMountedRef.current = false;
      sub.remove();
    };
  }, [silentFocus]);

  // ── commit whatever is currently in the input ─────────────────────────────
  // Called by onSubmitEditing — hardware scanners send \n which triggers this.
  const commitScan = useCallback(() => {
    const value = currentValueRef.current.trim();
    currentValueRef.current = "";

    // Clear the native input
    inputRef.current?.clear();
    setDisplayText("");

    if (!value) {
      silentFocus();
      return;
    }

    setDisplayText(value);
    setScannedItems((prev) => [
      ...prev,
      { raw: value, scannedAt: new Date().toISOString() },
    ]);

    silentFocus();
  }, [silentFocus]);

  // ── track value changes (uncontrolled) ────────────────────────────────────
  const handleTextChange = useCallback((text) => {
    currentValueRef.current = text;
    setDisplayText(text);
  }, []);

  // ── remove from strip ─────────────────────────────────────────────────────
  const handleRemoveItem = useCallback((index) => {
    setScannedItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ── generate / proceed ────────────────────────────────────────────────────
  const handleGenerate = useCallback(() => {
    if (scannedItems.length === 0) return;
    onScanComplete({ items: scannedItems, source: "hardware" });
  }, [scannedItems, onScanComplete]);

  const canGenerate = scannedItems.length > 0;
  const hasText = displayText.length > 0;

  return (
    <View style={s.hwWrap}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>

        <ScannerHeader
          session={session}
          onEditPress={() => setEditModalVisible(true)}
          isCameraMode={false}
        />

        <ScrollView
          contentContainerStyle={s.hwScroll}
          bounces={false}
          keyboardShouldPersistTaps="always"
        >
          {/* Session card */}
          {session && (
            <View style={s.sessionCard}>
              <View style={s.sessionCardHeader}>
                <Text style={s.sessionCardTitle}>Login Details</Text>
                <TouchableOpacity
                  style={s.sessionEditBtn}
                  onPress={() => setEditModalVisible(true)}
                  activeOpacity={0.75}
                >
                  <Feather name="edit-2" size={13} color={C.accentText} />
                  <Text style={s.sessionEditBtnText}>Edit</Text>
                </TouchableOpacity>
              </View>
              <View style={s.sessionHeaderDivider} />
              <View style={s.sessionRowSingle}>
                <Text style={s.sessionSingleValue} numberOfLines={1} ellipsizeMode="tail">
                  {session.username}
                </Text>
                <Text style={s.sessionSingleSep}>|</Text>
                <Text style={s.sessionSingleValue} numberOfLines={1} ellipsizeMode="tail">
                  {session.location}
                </Text>
                <Text style={s.sessionSingleSep}>|</Text>
                <Text style={s.sessionSingleValue} numberOfLines={1} ellipsizeMode="tail">
                  {session.reference}
                </Text>
              </View>
            </View>
          )}

          {/* Scan target box */}
          <View style={s.inputGroup}>
            <Text style={s.inputLabel}>SCAN TARGET</Text>

            <View style={s.scanRingOuter}>
              <View style={[s.scanTargetBox, hasText && s.scanTargetBoxFilled]}>

                {/*
                  Uncontrolled TextInput — no `value` prop.
                  Hardware scanner sends characters rapidly then \n.
                  onSubmitEditing fires on \n — that is our commit signal.
                  showSoftInputOnFocus + visible-password suppress the soft keyboard.
                */}
                <TextInput
                  ref={inputRef}
                  style={s.hiddenInput}
                  defaultValue=""
                  onChangeText={handleTextChange}
                  onSubmitEditing={commitScan}
                  multiline={false}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  showSoftInputOnFocus={false}
                  keyboardType={Platform.OS === "android" ? "visible-password" : "default"}
                  caretHidden={true}
                  onBlur={silentFocus}
                  returnKeyType="done"
                />

                {hasText ? (
                  <Text style={s.scanTargetValue} numberOfLines={4}>
                    {displayText}
                  </Text>
                ) : (
                  <View style={s.scanTargetIdle}>
                    <MaterialCommunityIcons
                      name="line-scan"
                      size={40}
                      color={C.accentBorder}
                      style={{ marginBottom: 12 }}
                    />
                    <Text style={s.scanTargetPlaceholder}>Waiting for scan</Text>
                    <Text style={s.scanTargetSub}>Point your scanner at a QR code</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </ScrollView>

        <ScannedStrip
          items={scannedItems}
          onRemove={handleRemoveItem}
          onGenerate={canGenerate ? handleGenerate : null}
        />

        <EditSessionModal
          visible={editModalVisible}
          session={session}
          onSave={(updated) => { onChangeSession(updated); setEditModalVisible(false); }}
          onDismiss={() => setEditModalVisible(false)}
        />
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  hwWrap: { flex: 1, backgroundColor: C.bg },
  hwScroll: { padding: 20, paddingBottom: 16, paddingTop: 0 },

  sessionCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 16,
    overflow: "hidden",
  },
  sessionCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 4,
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
    paddingHorizontal: 10,
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
  sessionRowSingle: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sessionSingleValue: {
    flex: 1,
    color: C.heading,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  sessionSingleSep: {
    color: C.muted,
    fontSize: 13,
    fontWeight: "600",
    paddingHorizontal: 8,
  },

  inputGroup: { marginBottom: 16 },
  inputLabel: {
    color: C.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 12,
  },

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

  scanTargetBox: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderColor: C.border,
    minHeight: 170,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    overflow: "hidden",
  },
  scanTargetBoxFilled: {
    borderColor: C.accent,
    backgroundColor: "#f5f8ff",
  },

  hiddenInput: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    color: "transparent",
  },

  scanTargetIdle: {
    alignItems: "center",
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

  scanTargetValue: {
    color: C.heading,
    fontSize: 15,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    textAlign: "center",
    lineHeight: 22,
  },
});