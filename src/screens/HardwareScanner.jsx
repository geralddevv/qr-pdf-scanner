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
  Keyboard,
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
  // The hidden scanner input is unmounted while the app is backgrounded so
  // Android has no focused EditText to restore (and pop the keyboard for) on resume.
  const [inputMounted, setInputMounted] = useState(true);
  // Drives the accent focus-ring overlay — true only while the input holds focus.
  const [isFocused, setIsFocused] = useState(false);

  const inputRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const isMountedRef = useRef(true);
  // While true, silentFocus is a no-op. Used to stop the input from grabbing
  // focus (and popping the keyboard) while backgrounded / during resume.
  const suppressFocusRef = useRef(false);
  // Logical scan buffer — what we've accumulated but not yet committed.
  const currentValueRef = useRef("");
  // Last raw string seen from onChangeText. Used to compute deltas so that
  // already-committed data is never re-processed even if clear() hasn't fired yet.
  const nativeTextRef = useRef("");
  // Debounce timer that commits a scan once the input goes quiet.
  const commitTimerRef = useRef(null);

  // ── focus without showing soft keyboard ───────────────────────────────────
  const silentFocus = useCallback(() => {
    setTimeout(() => {
      if (
        isMountedRef.current &&
        !suppressFocusRef.current &&
        AppState.currentState === "active"
      ) {
        inputRef.current?.focus();
      }
    }, 100);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    silentFocus();
    const sub = AppState.addEventListener("change", (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;

      if (next.match(/inactive|background/)) {
        // Leaving the app: suppress refocus, unmount the input and blur/dismiss
        // so there's no focused EditText for Android to restore the keyboard for.
        suppressFocusRef.current = true;
        setInputMounted(false);
        setIsFocused(false);
        inputRef.current?.blur();
        Keyboard.dismiss();
      } else if (prev.match(/inactive|background/) && next === "active") {
        // Returning: keep the input unmounted and focus suppressed while Android
        // does its (sometimes delayed) keyboard restore, dismissing repeatedly to
        // beat it. Only then remount the input and silently refocus it.
        suppressFocusRef.current = true;
        setInputMounted(false);
        setIsFocused(false);
        [0, 80, 200, 400, 650].forEach((t) => {
          setTimeout(() => {
            if (isMountedRef.current) Keyboard.dismiss();
          }, t);
        });
        setTimeout(() => {
          if (!isMountedRef.current || AppState.currentState !== "active") return;
          suppressFocusRef.current = false;
          setInputMounted(true);
          // Focus shortly after the input has remounted.
          setTimeout(() => {
            if (isMountedRef.current && AppState.currentState === "active") {
              inputRef.current?.focus();
              Keyboard.dismiss();
            }
          }, 120);
        }, 750);
      }
    });
    return () => {
      isMountedRef.current = false;
      sub.remove();
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    };
  }, [silentFocus]);

  // ── commit whatever is in the logical buffer ─────────────────────────────
  // forceAll=true  → timeout path: commit the whole buffer as one scan.
  // forceAll=false → terminator path: split on \n so two payloads that arrived
  //                  in the same burst are stored as two separate items.
  const commitScan = useCallback((forceAll = false) => {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }

    const raw = currentValueRef.current;
    if (!raw) { silentFocus(); return; }

    let complete, remainder;
    if (forceAll || !/[\r\n]/.test(raw)) {
      complete = [raw.trim()].filter(Boolean);
      remainder = "";
    } else {
      const parts = raw.split(/[\r\n]+/);
      const endsWithTerminator = /[\r\n]$/.test(raw);
      complete = (endsWithTerminator ? parts : parts.slice(0, -1))
        .map((s) => s.trim())
        .filter(Boolean);
      remainder = endsWithTerminator ? "" : (parts[parts.length - 1] || "");
    }

    // Keep the partial next-scan in the logical buffer and clear the native input.
    // nativeTextRef is intentionally NOT reset here — handleTextChange uses it to
    // compute the delta on the very next onChangeText, even if clear() fires late.
    currentValueRef.current = remainder;
    inputRef.current?.clear();
    setDisplayText("");

    if (complete.length > 0) {
      const now = Date.now();
      setScannedItems((prev) => [
        ...prev,
        ...complete.map((r, i) => ({ raw: r, scannedAt: new Date(now + i).toISOString() })),
      ]);
    }

    if (remainder) {
      commitTimerRef.current = setTimeout(() => {
        if (isMountedRef.current && currentValueRef.current) commitScan(true);
      }, 160);
    } else {
      silentFocus();
    }
  }, [silentFocus]);

  // ── track value changes (uncontrolled) ────────────────────────────────────
  // onChangeText always gives the FULL current native input value. The key trick:
  // instead of using that value directly, we compute only the DELTA (new chars
  // appended) by comparing to nativeTextRef. This means already-committed data
  // is ignored even if clear() hasn't taken effect yet on the native side —
  // solving the "two scans merged into one box" race on rapid continuous scanning.
  const handleTextChange = useCallback((text) => {
    const prevNative = nativeTextRef.current;
    nativeTextRef.current = text;

    let append;
    if (text.length >= prevNative.length && text.startsWith(prevNative)) {
      // Normal: scanner added more characters to the existing input.
      append = text.slice(prevNative.length);
    } else {
      // Native was reset (clear() fired) — all of `text` is fresh data.
      // currentValueRef already holds any partial remainder from the last split.
      append = text;
    }

    if (!append) return;

    currentValueRef.current += append;
    setDisplayText(currentValueRef.current);

    if (commitTimerRef.current) clearTimeout(commitTimerRef.current);

    if (/[\r\n]/.test(currentValueRef.current)) {
      commitScan();
      return;
    }

    commitTimerRef.current = setTimeout(() => {
      if (isMountedRef.current && currentValueRef.current) commitScan(true);
    }, 160);
  }, [commitScan]);

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
      <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>

        <ScannerHeader
          session={session}
          onEditPress={() => setEditModalVisible(true)}
          isCameraMode={false}
        />

        <ScrollView
          style={{ flex: 1 }}
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

              {/* Focus-ring overlay — the RN equivalent of a ::before border.
                  Sits outside the input box with a gap, only while focused. */}
              {isFocused && <View style={s.focusRing} pointerEvents="none" />}

              <View style={[s.scanTargetBox, hasText && s.scanTargetBoxFilled]}>

                {/*
                  Uncontrolled TextInput — no `value` prop.
                  Hardware scanner sends characters rapidly then \n.
                  onSubmitEditing fires on \n — that is our commit signal.
                  showSoftInputOnFocus + visible-password suppress the soft keyboard.
                */}
                {inputMounted && (
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
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => { setIsFocused(false); silentFocus(); }}
                    returnKeyType="done"
                  />
                )}

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

        {/* Docked to the bottom so flex distribution can never push the strip
            off-screen on native (this was visible on web but clipped in Expo Go). */}
        <View style={s.stripDock} pointerEvents="box-none">
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
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  hwWrap: { flex: 1, backgroundColor: C.bg },
  hwScroll: { padding: 20, paddingBottom: 180, paddingTop: 0 },

  // Pins the scanned-items strip to the bottom edge, above the safe-area inset.
  stripDock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },

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
    marginBottom: 12,
    padding: 6,
    borderRadius: 20,
  },

  scanTargetBox: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 210,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    overflow: "hidden",
  },
  scanTargetBoxFilled: {
    backgroundColor: "#f5f8ff",
  },
  // Accent focus ring drawn on top of the box's minimal border when focused.
  focusRing: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: C.accent,
    zIndex: 5,
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
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    textAlign: "center",
    lineHeight: 18,
  },
});