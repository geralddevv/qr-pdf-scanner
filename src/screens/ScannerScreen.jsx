import React, { useState } from "react";
import CameraScanner from "./CameraScanner";
import HardwareScanner from "./HardwareScanner";

// ─── Root Scanner Router ───────────────────────────────────────────────────────
export default function ScannerScreen({
  onScanComplete,
  initialItems = [],
  initialMode = "camera",
  session,
  onChangeSession,
}) {
  const [mode, setMode] = useState(initialMode);

  // Camera mode disabled — always render the hardware scanner
  return (
    // mode === "camera" ? (
    //   <CameraScanner
    //     onScanComplete={onScanComplete}
    //     onSwitchMode={setMode}
    //     initialItems={initialItems}
    //     session={session}
    //     onChangeSession={onChangeSession}
    //   />
    // ) : (
    <HardwareScanner
      onScanComplete={onScanComplete}
      onSwitchMode={setMode}
      initialItems={initialItems}
      session={session}
      onChangeSession={onChangeSession}
    />
  )
  // );
}