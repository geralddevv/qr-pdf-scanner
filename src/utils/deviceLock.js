import { Platform } from "react-native";
import * as Application from "expo-application";

// Devices allowed to run this app, offline, with no server check.
// To enroll a new device: install the app, copy the ID shown on the
// "Device Not Authorized" screen, add it below, then rebuild.
export const ALLOWED_DEVICE_IDS = [
  "8748d7df06196fda",
];

export async function getDeviceId() {
  if (Platform.OS === "android") {
    return Application.getAndroidId();
  }
  return await Application.getIosIdForVendorAsync();
}

export async function isDeviceAuthorized() {
  const id = await getDeviceId();
  return ALLOWED_DEVICE_IDS.includes(id);
}
