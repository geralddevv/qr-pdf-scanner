import React, { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import ScannerScreen from "./src/screens/ScannerScreen";
import ResultScreen from "./src/screens/ResultScreen";

export default function App() {
  const [scannedData, setScannedData] = useState(null);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor="#0f0f0f" translucent={false} />
      {scannedData ? (
        <ResultScreen data={scannedData} onReset={() => setScannedData(null)} />
      ) : (
        <ScannerScreen onScanComplete={setScannedData} />
      )}
    </SafeAreaProvider>
  );
}