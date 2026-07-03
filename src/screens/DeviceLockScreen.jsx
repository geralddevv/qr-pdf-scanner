import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";

export default function DeviceLockScreen({ deviceId }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Device Not Authorized</Text>
      <Text style={styles.message}>
        This app is locked to specific devices and cannot run here.
      </Text>
      <Text style={styles.idLabel}>Device ID:</Text>
      <Text selectable style={styles.id}>
        {deviceId ?? "unavailable"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#c0392b",
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    textAlign: "center",
    color: "#333",
    marginBottom: 24,
  },
  idLabel: {
    fontSize: 12,
    color: "#666",
  },
  id: {
    fontSize: 14,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    color: "#000",
    marginTop: 4,
  },
});
