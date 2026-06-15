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
import { Feather, MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import {
  C,
  // ModeToggle,
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
  // scannedItems holds only fully committed items.
  // currentInput is the live text in the hidden field — it is NOT in scannedItems.
  // We never put currentInput into scannedItems until a \n arrives or the user
  // manually commits, so there is no double-entry possible.
  const [currentInput, setCurrentInput] = useState("");
  const [scannedItems, setScannedItems] = useState(initialItems);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const inputRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const switchingModeRef = useRef(false);
  // justCommitted: set to true the moment we push an item, cleared as soon as
  // the field is wiped so the next scan starts fresh.
  const justCommitted = useRef(false);

  const refocus = useCallback(() => {
    setTimeout(() => {
      if (!switchingModeRef.current) inputRef.current?.focus();
    }, 80);
  }, []);

  // Mode switching disabled — toggle is commented out, kept here for reference
  // const handleSwitchMode = useCallback((newMode) => {
  //   switchingModeRef.current = true;
  //   inputRef.current?.blur();
  //   onSwitchMode(newMode);
  // }, [onSwitchMode]);

  useEffect(() => {
    refocus();
    const sub = AppState.addEventListener("change", (next) => {
      if (appStateRef.current.match(/inactive|background/) && next === "active")
        refocus();
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [refocus]);

  const handleTextChange = useCallback((text) => {
    // If a scan was just committed, the field still shows the old value.
    // The new scan arrives as text appended to that stale value — strip it.
    if (justCommitted.current) {
      justCommitted.current = false;
      // Everything before (and including) the first newline is the old value.
      // What remains after it is the first character(s) of the new scan.
      const fresh = text.includes("\n") ? text.slice(text.indexOf("\n") + 1) : text.replace(/^.*/, "");
      setCurrentInput(fresh);
      return;
    }

    setCurrentInput(text);

    // Hardware scanner appends \n at the end — that is our commit signal.
    if (text.endsWith("\n")) {
      const trimmed = text.trim();
      if (trimmed.length === 0) return;
      justCommitted.current = true;
      setScannedItems((prev) => [...prev, { raw: trimmed, scannedAt: new Date().toISOString() }]);
      // Show the value in the field so the user sees what was scanned.
      // The next onChange will detect justCommitted and wipe it.
      setCurrentInput(trimmed);
      refocus();
    }
  }, [refocus]);

  useEffect(() => {
    if (!inputRef.current) refocus();
  }, [refocus]);

  const handleRemoveItem = useCallback((index) => {
    setScannedItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // onSubmitEditing fires when the scanner sends \n.
  // By the time it fires, handleTextChange has already committed the item
  // (justCommitted is true). So we just refocus — never add again.
  const handleManualCommit = useCallback(() => {
    if (justCommitted.current) {
      // already handled by handleTextChange
      refocus();
      return;
    }
    // User typed something manually and pressed the keyboard "done" button.
    const trimmed = currentInput.trim();
    if (!trimmed) return;
    justCommitted.current = true;
    setScannedItems((prev) => [...prev, { raw: trimmed, scannedAt: new Date().toISOString() }]);
    setCurrentInput(trimmed);
    refocus();
  }, [currentInput, refocus]);

  // Generate: scannedItems already contains everything committed.
  // currentInput at this point is either the displayed last-committed value
  // (justCommitted=true, already in list) or something the user typed without
  // pressing enter (justCommitted=false, not yet in list).
  const handleGenerate = useCallback(() => {
    const items = [...scannedItems];
    if (!justCommitted.current) {
      const pending = currentInput.trim();
      if (pending) items.push({ raw: pending, scannedAt: new Date().toISOString() });
    }
    if (items.length === 0) return;
    onScanComplete({ items, source: "hardware" });
  }, [scannedItems, currentInput, onScanComplete]);

  const canGenerate = scannedItems.length > 0 || (!justCommitted.current && currentInput.trim().length > 0);
  const hasText = currentInput.trim().length > 0;

  return (
    <View style={s.hwWrap}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        {/* Header/Navbar */}
        <ScannerHeader
          session={session}
          onEditPress={() => setEditModalVisible(true)}
          isCameraMode={false}
        />

        {/* Mode Toggle */}
        {/* <View style={{ marginBottom: 20 }}>
          <ModeToggle mode="hardware" onChangeMode={handleSwitchMode} />
        </View> */}

        <ScrollView
          contentContainerStyle={s.hwScroll}
          bounces={false}
          keyboardShouldPersistTaps="always"
        >

          {/* Session card — above scan target */}
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
              {/* User | Location | Reference — single evenly-spaced row */}
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

          {/* ── Big scan target box ── */}
          <View style={s.inputGroup}>
            <Text style={s.inputLabel}>SCAN TARGET</Text>

            {/* Static outer ring */}
            <View style={s.scanRingOuter}>
              {/* Inner card */}
              <View
                style={[s.scanTargetBox, hasText && s.scanTargetBoxFilled]}
              >
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
                  <Text
                    style={s.scanTargetValue}
                    numberOfLines={3}
                  >
                    {currentInput}
                  </Text>
                ) : (
                  <View style={s.scanTargetIdle}>
                    <MaterialCommunityIcons
                      name="line-scan"
                      size={40}
                      color={C.accentBorder}
                      style={{ marginBottom: 12 }}
                    />
                    <Text style={s.scanTargetPlaceholder}>
                      Waiting for scan
                    </Text>
                    <Text style={s.scanTargetSub}>
                      Point your scanner at a QR code
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Sticky bottom strip */}
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

// ─── Hardware-specific Styles ──────────────────────────────────────────────────
const s = StyleSheet.create({
  hwWrap: { flex: 1, backgroundColor: C.bg },
  hwScroll: { padding: 20, paddingBottom: 16, paddingTop: 0 },

  // Session card
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
  // Single evenly-spaced row: user | location | reference
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
    // borderWidth: 1.5,
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

  // Invisible TextInput that sits on top, capturing all keystrokes
  hiddenInput: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
});