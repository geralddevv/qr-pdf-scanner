import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";

// ─── Theme (matches the rest of the app) ─────────────────────────────────────
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
  error:        "#dc2626",
  errorDim:     "rgba(220,38,38,0.08)",
  errorBorder:  "rgba(220,38,38,0.25)",
};

// ─── Field component ──────────────────────────────────────────────────────────
function Field({ label, icon, placeholder, value, onChangeText, inputRef, onSubmitEditing, returnKeyType = "next", autoCapitalize = "words" }) {
  const [focused, setFocused] = useState(false);
  const filled = value.trim().length > 0;

  return (
    <View style={f.group}>
      <Text style={f.label}>{label}</Text>
      <View style={[f.inputWrap, focused && f.inputWrapFocus, filled && !focused && f.inputWrapFilled]}>
        <View style={f.iconWrap}>
          {icon}
        </View>
        <TextInput
          ref={inputRef}
          style={f.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.muted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          blurOnSubmit={returnKeyType === "done"}
        />
        {filled && (
          <View style={f.checkWrap}>
            <Ionicons name="checkmark-circle" size={18} color={C.success} />
          </View>
        )}
      </View>
    </View>
  );
}

const f = StyleSheet.create({
  group: { marginBottom: 18 },
  label: {
    color: C.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    overflow: "hidden",
  },
  inputWrapFocus: {
    borderColor: C.accent,
    backgroundColor: "#f8faff",
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 2,
  },
  inputWrapFilled: {
    borderColor: "rgba(22,163,74,0.35)",
    backgroundColor: "rgba(22,163,74,0.03)",
  },
  iconWrap: {
    width: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: C.border,
    paddingVertical: 14,
  },
  input: {
    flex: 1,
    color: C.heading,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontWeight: "500",
  },
  checkWrap: {
    paddingRight: 12,
  },
});

// ─── SessionScreen ────────────────────────────────────────────────────────────
export default function SessionScreen({ onSessionStart }) {
  const [username, setUsername]   = useState("");
  const [location, setLocation]   = useState("");
  const [reference, setReference] = useState("");

  const locationRef  = useRef(null);
  const referenceRef = useRef(null);

  const allFilled = username.trim() && location.trim() && reference.trim();

  const handleStart = () => {
    if (!allFilled) return;
    onSessionStart({
      username:  username.trim(),
      location:  location.trim(),
      reference: reference.trim(),
    });
  };

  const filledCount = [username, location, reference].filter(v => v.trim()).length;

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          bounces={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Logo / Title — single row ── */}
          <View style={s.hero}>
            <View style={s.logoInner}>
              <Text style={s.logoText}>QR</Text>
            </View>
            <View style={s.heroText}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={s.appTitle}>QR</Text>
                  <Ionicons name="arrow-forward" size={18} color={C.heading} style={{ marginHorizontal: 8 }} />
                  <Text style={s.appTitle}>PDF</Text>
                </View>
                <Text style={s.appSub}>Enter your Login details to begin scanning</Text>
              </View>
          </View>

          {/* ── Progress dots ── */}
          <View style={s.progressRow}>
            {[0, 1, 2].map(i => (
              <View
                key={i}
                style={[
                  s.progressDot,
                  i < filledCount ? s.progressDotFilled : null,
                  i === filledCount && filledCount < 3 ? s.progressDotActive : null,
                ]}
              />
            ))}
          </View>

          {/* ── Form card ── */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <MaterialCommunityIcons name="account-details" size={18} color={C.accent} />
              <Text style={s.cardTitle}>Login Details</Text>
            </View>

            <Field
              label="Username / Operator"
              icon={<Ionicons name="person-outline" size={17} color={C.muted} />}
              placeholder="Username"
              value={username}
              onChangeText={setUsername}
              onSubmitEditing={() => locationRef.current?.focus()}
              returnKeyType="next"
              autoCapitalize="words"
            />

            <Field
              label="Location"
              icon={<Ionicons name="location-outline" size={17} color={C.muted} />}
              placeholder="Location"
              value={location}
              onChangeText={setLocation}
              inputRef={locationRef}
              onSubmitEditing={() => referenceRef.current?.focus()}
              returnKeyType="next"
              autoCapitalize="words"
            />

            <Field
              label="Lot / Invoice / Batch No."
              icon={<MaterialCommunityIcons name="pound-box-outline" size={17} color={C.muted} />}
              placeholder="Lot / Invoice / Batch No."
              value={reference}
              onChangeText={setReference}
              inputRef={referenceRef}
              onSubmitEditing={handleStart}
              returnKeyType="done"
              autoCapitalize="characters"
            />
          </View>

          {/* ── CTA ── */}
          <TouchableOpacity
            style={[s.startBtn, !allFilled && s.startBtnOff]}
            onPress={handleStart}
            disabled={!allFilled}
            activeOpacity={0.85}
          >
            <Feather name="arrow-right-circle" size={20} color="#fff" />
            <Text style={s.startBtnText}>Start Scanning</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: {
    padding: 24,
    paddingBottom: 32,
  },

  // Hero — icon left, text right, single row
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingTop: 12,
    paddingBottom: 28,
  },
  logoInner: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  logoText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 1,
  },
  heroText: {
    flex: 1,
  },
  appTitle: {
    color: C.heading,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  appSub: {
    color: C.subtle,
    fontSize: 12,
    lineHeight: 18,
  },

  // Progress indicator
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 24,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.border,
  },
  progressDotActive: {
    width: 24,
    backgroundColor: C.accentBorder,
  },
  progressDotFilled: {
    backgroundColor: C.accent,
  },

  // Card
  card: {
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 20,
    marginBottom: 24,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  cardTitle: {
    color: C.heading,
    fontSize: 15,
    fontWeight: "700",
  },

  // CTA button
  startBtn: {
    backgroundColor: C.accent,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 6,
  },
  startBtnOff: {
    opacity: 0.4,
    shadowOpacity: 0,
    elevation: 0,
  },
  startBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
});