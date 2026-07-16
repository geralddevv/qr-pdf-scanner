import React, { useState, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { View, StyleSheet } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import SessionScreen from "./src/screens/SessionScreen";
import ScannerScreen from "./src/screens/ScannerScreen";
import ResultScreen from "./src/screens/ResultScreen";
import DeviceLockScreen from "./src/screens/DeviceLockScreen";
import { getDeviceId, isDeviceAuthorized } from "./src/utils/deviceLock";

SplashScreen.preventAutoHideAsync();

const STATUS_BAR_BG = "#002d8f";

export default function App() {
  // Session data entered on the first screen
  const [session, setSession] = useState(null);

  const [scanResult, setScanResult] = useState(null);
  // Persisted scanner state — survives the trip to ResultScreen and back
  const [persistedItems, setPersistedItems] = useState([]);
  const [persistedMode, setPersistedMode] = useState("camera");

  // Offline device lock — null while checking, then true/false
  const [deviceAuthorized, setDeviceAuthorized] = useState(null);
  const [deviceId, setDeviceId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const id = await getDeviceId();
        setDeviceId(id);
        setDeviceAuthorized(await isDeviceAuthorized());
      } catch (e) {
        // A device-id/secure-store hiccup must never leave the splash screen
        // up forever — fail closed to the activation screen instead.
        console.warn("Device authorization check failed:", e);
        setDeviceId(null);
        setDeviceAuthorized(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (deviceAuthorized !== null) {
      SplashScreen.hideAsync();
    }
  }, [deviceAuthorized]);

  const handleSessionStart = (sessionData) => {
    setSession(sessionData);
  };

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

  // If called with updated data (from the edit modal), just update the session.
  // If called with no args (intentional "change user"), go back to login.
  const handleChangeSession = (updatedSession) => {
    if (updatedSession) {
      setSession(updatedSession);
      return;
    }
    setPersistedItems([]);
    setPersistedMode("camera");
    setScanResult(null);
    setSession(null);
  };

  const renderScreen = () => {
    if (!session) {
      return <SessionScreen onSessionStart={handleSessionStart} />;
    }
    if (scanResult) {
      return (
        <ResultScreen
          data={scanResult}
          session={session}
          onReset={handleReset}
          onClearReset={handleClearReset}
          onChangeSession={handleChangeSession}
        />
      );
    }
    return (
      <ScannerScreen
        onScanComplete={handleScanComplete}
        initialItems={persistedItems}
        initialMode={persistedMode}
        session={session}
        onChangeSession={handleChangeSession}
      />
    );
  };

  return (
    <SafeAreaProvider>
      {/* Android 15+ / iOS both render edge-to-edge now, so the native
          status bar background color is ignored — paint it ourselves.
          ResultScreen owns the status bar style itself while it's mounted
          (it needs to switch to dark content for its white PDF preview),
          so we back off here to avoid two StatusBar components fighting
          over the same native merge stack. */}
      {!scanResult && <StatusBar style="light" />}
      <SafeAreaView edges={["top"]} style={styles.statusBarFill} />
      <View style={styles.root}>
        {deviceAuthorized === null
          ? null
          : deviceAuthorized
          ? renderScreen()
          : (
            <DeviceLockScreen
              deviceId={deviceId}
              onActivated={() => setDeviceAuthorized(true)}
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