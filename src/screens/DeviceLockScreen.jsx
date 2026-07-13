import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { activateDevice } from "../utils/deviceLock";

const BRAND = "#002d8f";

// Mirrors the XXXXX-XXXXX-XXXXX-XXXXX-XXXXX format issued by the license
// admin panel (see /server) — formats as the user types.
const ACTIVATION_MASK = "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX";

const ERROR_MESSAGES = {
  invalid_license: "License code not recognized. Double-check and try again.",
  license_revoked: "This license has been revoked. Contact your administrator.",
  device_mismatch:
    "This license is already active on a different device. Contact your administrator to release it.",
  network_error: "Couldn't reach the activation server. Check your connection and try again.",
  server_error: "Something went wrong. Try again in a moment.",
};

function formatActivationInput(raw) {
  const clean = raw
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .slice(0, 25);
  return clean.match(/.{1,5}/g)?.join("-") ?? clean;
}

export default function DeviceLockScreen({ deviceId, onActivated }) {
  const [activationKey, setActivationKey] = useState("");
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyDeviceId = async () => {
    if (!deviceId) return;
    await Clipboard.setStringAsync(deviceId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleActivate = async () => {
    if (!activationKey.trim() || checking) return;
    setChecking(true);
    setError(null);
    const result = await activateDevice(activationKey);
    setChecking(false);
    if (result.ok) {
      onActivated();
    } else {
      setError(ERROR_MESSAGES[result.reason] ?? ERROR_MESSAGES.server_error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.iconBadge}>
            <Ionicons name="lock-closed" size={30} color={BRAND} />
          </View>

          <Text style={styles.title}>Device Not Authorized</Text>
          <Text style={styles.message}>
            This app is locked to specific devices. Enter the license code
            your administrator sent you to activate this device.
          </Text>

          <Text style={styles.inputLabel}>License code</Text>
          <View
            style={[
              styles.inputStack,
              inputFocused && styles.inputStackFocused,
            ]}
          >
            <View style={styles.inputInner}>
              {/* Invisible, normal-flow — sizes inputInner to fit the full
                  mask so the box below stays centered and never shifts. */}
              <Text style={styles.ghostText}>{ACTIVATION_MASK}</Text>
              <Text style={styles.maskOverlay} pointerEvents="none">
                {" ".repeat(activationKey.length) +
                  ACTIVATION_MASK.slice(activationKey.length)}
              </Text>
              <TextInput
                style={styles.input}
                value={activationKey}
                onChangeText={(text) => {
                  setActivationKey(formatActivationInput(text));
                  setError(null);
                }}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                autoCapitalize="characters"
                autoCorrect={false}
                spellCheck={false}
                autoComplete="off"
                importantForAutofill="no"
                maxLength={29}
                underlineColorAndroid="transparent"
              />
            </View>
          </View>

          {error ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={16} color="#c0392b" />
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[
              styles.button,
              (checking || !activationKey.trim()) && styles.buttonDisabled,
            ]}
            onPress={handleActivate}
            disabled={checking || !activationKey.trim()}
            activeOpacity={0.85}
          >
            {checking ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Activate Device</Text>
            )}
          </TouchableOpacity>

          <View style={styles.supportRow}>
            <Text style={styles.supportLabel}>
              Device ID (for support reference only):
            </Text>
            <TouchableOpacity
              style={styles.supportCopyRow}
              onPress={handleCopyDeviceId}
              disabled={!deviceId}
              activeOpacity={0.7}
            >
              <Text selectable style={styles.supportId}>
                {deviceId ?? "unavailable"}
              </Text>
              <Ionicons
                name={copied ? "checkmark" : "copy-outline"}
                size={13}
                color={copied ? "#2e7d32" : "#999"}
              />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f6f8",
  },
  flex: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#e7ecfa",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 21,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    color: "#666",
    marginBottom: 24,
    maxWidth: 320,
  },
  supportRow: {
    marginTop: 24,
    alignItems: "center",
  },
  supportLabel: {
    fontSize: 11,
    color: "#aaa",
    marginBottom: 4,
  },
  supportCopyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  supportId: {
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    color: "#999",
  },
  inputLabel: {
    alignSelf: "flex-start",
    fontSize: 16,
    fontWeight: "600",
    color: "#444",
    marginBottom: 6,
  },
  inputStack: {
    width: "100%",
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  inputStackFocused: {
    borderColor: BRAND,
  },
  // Content-width block, centered inside inputStack by its flex alignment.
  inputInner: {
    position: "relative",
  },
  ghostText: {
    fontSize: 16,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 1,
    opacity: 0,
  },
  maskOverlay: {
    position: "absolute",
    left: 0,
    top: 0,
    fontSize: 16,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 1,
    color: "#c2c2c2",
  },
  input: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    padding: 0,
    margin: 0,
    fontSize: 16,
    backgroundColor: "transparent",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    color: "#000",
    letterSpacing: 1,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    alignSelf: "flex-start",
  },
  error: {
    color: "#c0392b",
    fontSize: 13,
  },
  button: {
    marginTop: 20,
    width: "100%",
    backgroundColor: BRAND,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
