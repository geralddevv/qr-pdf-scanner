const { withAndroidManifest } = require("@expo/config-plugins");

/**
 * Forces the main Android activity to never auto-show the soft keyboard,
 * including when the app is resumed from the background. This is the reliable
 * fix for the hardware-scanner screen where a hidden TextInput keeps focus but
 * the on-screen keyboard must never appear.
 *
 * "stateAlwaysHidden" => the soft keyboard is always hidden when the activity's
 * window gains focus. "adjustResize" keeps the normal layout-resize behavior.
 */
const SOFT_INPUT_MODE = "stateAlwaysHidden|adjustResize";

module.exports = function withSoftInputHidden(config) {
  return withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults.manifest.application?.[0];
    if (!application) return cfg;

    const activities = application.activity || [];
    const mainActivity = activities.find(
      (a) => a.$?.["android:name"] === ".MainActivity"
    );
    if (mainActivity) {
      mainActivity.$["android:windowSoftInputMode"] = SOFT_INPUT_MODE;
    }
    return cfg;
  });
};
