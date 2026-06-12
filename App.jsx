import React, { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { View, StyleSheet, Platform } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import ScannerScreen from "./src/screens/ScannerScreen";
import ResultScreen from "./src/screens/ResultScreen";

const STATUS_BAR_BG = "#f0f4ff";

export default function App() {
  const [scanResult, setScanResult] = useState(null);
  // Persisted scanner state — survives the trip to ResultScreen and back
  const [persistedItems, setPersistedItems] = useState([]);
  const [persistedMode, setPersistedMode]   = useState("camera");

  const handleScanComplete = (result) => {
    setPersistedItems(result.items);
    setPersistedMode(result.source === "hardware" ? "hardware" : "camera");
    setScanResult(result);
  };

  // "Scan More" — go back but keep previous items pre-loaded
  const handleReset = () => {
    setScanResult(null);
  };

  // "Scan Again" (back button) — clear everything and start fresh
  const handleClearReset = () => {
    setPersistedItems([]);
    setPersistedMode("camera");
    setScanResult(null);
  };

  return (
    <SafeAreaProvider>
      {/* White status bar background that works on both iOS and Android */}
      <StatusBar style="dark" backgroundColor={STATUS_BAR_BG} translucent={false} />
      {Platform.OS === "ios" && (
        <SafeAreaView edges={["top"]} style={styles.statusBarFill} />
      )}
      <View style={styles.root}>
        {scanResult ? (
          <ResultScreen
            data={scanResult}
            onReset={handleReset}
            onClearReset={handleClearReset}
          />
        ) : (
          <ScannerScreen
            onScanComplete={handleScanComplete}
            initialItems={persistedItems}
            initialMode={persistedMode}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  // Fills the iOS status bar area with the desired background colour
  statusBarFill: {
    backgroundColor: STATUS_BAR_BG,
  },
  // Takes up all remaining space below the status bar
  root: {
    flex: 1,
    backgroundColor: STATUS_BAR_BG,
  },
});