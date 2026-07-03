const { withAndroidStyles } = require("@expo/config-plugins");

/**
 * Android's automatic "Force Dark" adjustment (applied to DayNight themes on
 * API 29+ when the device is in system dark mode) can wash out or fully
 * nullify custom semi-transparent overlays like modal backdrops. This app is
 * fully custom-styled and doesn't rely on system dark/light theming, so
 * force-dark is disabled at the theme level.
 */
module.exports = function withForceDarkDisabled(config) {
  return withAndroidStyles(config, (cfg) => {
    const styles = cfg.modResults.resources.style || [];
    const appTheme = styles.find((s) => s.$.name === "AppTheme");
    if (!appTheme) return cfg;

    appTheme.item = appTheme.item || [];
    const existing = appTheme.item.find(
      (i) => i.$.name === "android:forceDarkAllowed"
    );
    if (existing) {
      existing._ = "false";
    } else {
      appTheme.item.push({
        _: "false",
        $: { name: "android:forceDarkAllowed" },
      });
    }
    return cfg;
  });
};
