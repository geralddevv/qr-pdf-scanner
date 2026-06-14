import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  FlatList,
  Animated,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";

// ─── Theme (shared across all scanners) ────────────────────────────────────────
export const C = {
  bg:           "#f0f4ff",       // cool blue-tinted white page
  surface:      "#ffffff",       // pure white cards
  elevated:     "#e8edf8",       // slightly deeper for nested surfaces
  border:       "#d1d9f0",       // soft blue-grey border
  muted:        "#8e9bbf",       // muted blue-grey text
  subtle:       "#6b7a9e",       // mid-tone label text
  body:         "#3d4a6b",       // readable body
  strong:       "#1e2a4a",       // strong text
  heading:      "#0f1829",       // near-black headings
  accent:       "#2563eb",       // vivid blue
  accentLight:  "#3b82f6",       // lighter blue for hover/icons
  accentDim:    "rgba(37,99,235,0.08)",
  accentBorder: "rgba(37,99,235,0.22)",
  accentText:   "#1d4ed8",       // slightly darker for text on white
  success:      "#16a34a",
  successDim:   "rgba(22,163,74,0.08)",
  error:        "#dc2626",
  errorDim:     "rgba(220,38,38,0.08)",
  errorBorder:  "rgba(220,38,38,0.25)",
  overlay:      "rgba(10,18,40,0.62)",
  torchOn:      "#f59e0b",
};

// ─── Dimensions ────────────────────────────────────────────────────────────────
export const { width: SCREEN_W } = Dimensions.get("window");
export const SCAN_BOX = SCREEN_W * 0.7;
export const STRIP_SIZE = 80;

// ─── Helper Functions ──────────────────────────────────────────────────────────
export function detectType(raw) {
  if (/^https?:\/\//i.test(raw))              return "URL";
  if (/^mailto:/i.test(raw))                  return "Email";
  if (/^tel:/i.test(raw))                     return "Phone";
  if (/^(BEGIN:VCARD|BEGIN:VCAL)/i.test(raw)) return "Contact";
  if (/^WIFI:/i.test(raw))                    return "Wi-Fi";
  return "Text";
}

export function shortPreview(raw, max = 28) {
  const s = raw.trim();
  return s.length > max ? s.slice(0, max) + "…" : s;
}

// ─── Mode Toggle Component ────────────────────────────────────────────────────
export function ModeToggle({ mode, onChangeMode }) {
  return (
    <View style={tog.wrap}>
      <TouchableOpacity
        style={[tog.tab, mode === "camera" && tog.active]}
        onPress={() => onChangeMode("camera")}
        activeOpacity={0.8}
      >
        <Ionicons name="camera-outline" size={20} color={mode === "camera" ? "#fff" : C.subtle} />
        <Text style={[tog.label, mode === "camera" && tog.labelActive]}>Camera</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[tog.tab, mode === "hardware" && tog.active]}
        onPress={() => onChangeMode("hardware")}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="barcode-scan" size={20} color={mode === "hardware" ? "#fff" : C.subtle} />
        <Text style={[tog.label, mode === "hardware" && tog.labelActive]}>Hardware</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Scanned Strip Item Component ──────────────────────────────────────────────
export function StripItem({ item, index, onRemove, isNew }) {
  const type = detectType(item.raw);
  const opacity = useRef(new Animated.Value(isNew ? 0.4 : 1)).current;

  useEffect(() => {
    if (!isNew) return;
    Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={[strip.item, { opacity }]}>
      <TouchableOpacity style={strip.removeBtn} onPress={() => onRemove(index)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <View style={strip.removeBtnInner}>
          <Ionicons name="close" size={11} color="#fff" />
        </View>
      </TouchableOpacity>

      <View style={strip.indexBadge}>
        <Text style={strip.indexText}>{index + 1}</Text>
      </View>

      <MaterialCommunityIcons
        name={type === "URL" ? "web" : type === "Email" ? "email-outline" : type === "Phone" ? "phone-outline" : type === "Wi-Fi" ? "wifi" : "text"}
        size={20}
        color={C.accent}
        style={{ marginBottom: 4 }}
      />

      <Text style={strip.preview} numberOfLines={2}>
        {shortPreview(item.raw, 18)}
      </Text>
    </Animated.View>
  );
}

// ─── Scanned Strip Component ───────────────────────────────────────────────────
export function ScannedStrip({ items, onRemove, onGenerate }) {
  const listRef = useRef(null);
  const prevLenRef = useRef(items.length); // track length at mount to skip initial scroll
  const shouldScrollRef = useRef(false);   // flag: scroll on next content-size change
  const newestKeyRef = useRef(null);       // scannedAt of the freshly-added item

  useEffect(() => {
    if (items.length > prevLenRef.current) {
      shouldScrollRef.current = true;
      newestKeyRef.current = items[items.length - 1]?.scannedAt ?? null;
    }
    prevLenRef.current = items.length;
  }, [items.length]);

  const handleContentSizeChange = useCallback((contentWidth, _contentHeight) => {
    if (shouldScrollRef.current) {
      shouldScrollRef.current = false;
      // scrollToOffset to the true end (includes trailing paddingRight from contentContainerStyle)
      listRef.current?.scrollToOffset({ offset: contentWidth, animated: true });
    }
  }, []);

  if (items.length === 0) return null;

  return (
    <View style={strip.wrap}>
      <View style={strip.header}>
        <View style={strip.countRow}>
          <Text style={strip.countText}>{items.length} QR scanned</Text>
        </View>
        {onGenerate && (
          <TouchableOpacity style={strip.generateBtn} onPress={onGenerate} activeOpacity={0.85}>
            <Ionicons name="document-text-outline" size={16} color="#fff" />
            <Text style={strip.generateBtnText}>Generate PDF</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={{ overflow: "visible" }}>
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item, index }) => (
            <StripItem item={item} index={index} onRemove={onRemove} isNew={item.scannedAt === newestKeyRef.current} />
          )}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={strip.list}
          onContentSizeChange={handleContentSizeChange}
        />
      </View>
    </View>
  );
}

// ─── Session Badge Component ───────────────────────────────────────────────────
export function SessionBadge({ session, onChangeSession }) {
  if (!session) return null;
  return (
    <TouchableOpacity style={sb.wrap} onPress={onChangeSession} activeOpacity={0.75}>
      <Ionicons name="person-circle-outline" size={13} color={C.accentText} />
      <Text style={sb.name} numberOfLines={1}>{session.username}</Text>
      <Text style={sb.sep}>·</Text>
      <Text style={sb.ref} numberOfLines={1}>{session.reference}</Text>
      <Ionicons name="chevron-down" size={11} color={C.muted} />
    </TouchableOpacity>
  );
}

// ─── Edit Session Modal ───────────────────────────────────────────────────────
export function EditSessionModal({ visible, session, onSave, onDismiss }) {
  const [username, setUsername]   = useState(session?.username  ?? "");
  const [location, setLocation]   = useState(session?.location  ?? "");
  const [reference, setReference] = useState(session?.reference ?? "");

  const locationRef  = useRef(null);
  const referenceRef = useRef(null);

  // Sync fields when the modal (re-)opens with fresh session data
  useEffect(() => {
    if (visible) {
      setUsername(session?.username  ?? "");
      setLocation(session?.location  ?? "");
      setReference(session?.reference ?? "");
    }
  }, [visible]);

  const allFilled = username.trim() && location.trim() && reference.trim();

  const handleSave = () => {
    if (!allFilled) return;
    onSave({ username: username.trim(), location: location.trim(), reference: reference.trim() });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Backdrop */}
        <Pressable style={em.backdrop} onPress={onDismiss} />

        {/* Sheet */}
        <View style={em.sheetWrap} pointerEvents="box-none">
          <View style={em.sheet}>
            {/* Header */}
            <View style={em.header}>
              <View style={em.headerLeft}>
                <MaterialCommunityIcons name="account-details" size={17} color={C.accent} />
                <Text style={em.title}>Edit Login Details</Text>
              </View>
              <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Ionicons name="close" size={20} color={C.muted} />
              </TouchableOpacity>
            </View>

            <View style={em.divider} />

            {/* Fields */}
            <View style={em.fields}>
              <ModalField
                label="Username / Operator"
                icon={<Ionicons name="person-outline" size={16} color={C.muted} />}
                placeholder="Username"
                value={username}
                onChangeText={setUsername}
                onSubmitEditing={() => locationRef.current?.focus()}
                returnKeyType="next"
                autoCapitalize="words"
              />
              <ModalField
                label="Location"
                icon={<Ionicons name="location-outline" size={16} color={C.muted} />}
                placeholder="Location"
                value={location}
                onChangeText={setLocation}
                inputRef={locationRef}
                onSubmitEditing={() => referenceRef.current?.focus()}
                returnKeyType="next"
                autoCapitalize="words"
              />
              <ModalField
                label="Lot / Invoice / Batch No."
                icon={<MaterialCommunityIcons name="pound-box-outline" size={16} color={C.muted} />}
                placeholder="Lot / Invoice / Batch No."
                value={reference}
                onChangeText={setReference}
                inputRef={referenceRef}
                onSubmitEditing={handleSave}
                returnKeyType="done"
                autoCapitalize="characters"
              />
            </View>

            {/* Actions */}
            <View style={em.actions}>
              <TouchableOpacity style={em.cancelBtn} onPress={onDismiss} activeOpacity={0.8}>
                <Text style={em.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[em.saveBtn, !allFilled && em.saveBtnOff]}
                onPress={handleSave}
                disabled={!allFilled}
                activeOpacity={0.85}
              >
                <Feather name="check" size={15} color="#fff" />
                <Text style={em.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Modal field (compact version for the dialog) ─────────────────────────────
function ModalField({ label, icon, placeholder, value, onChangeText, inputRef, onSubmitEditing, returnKeyType, autoCapitalize }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={em.fieldGroup}>
      <Text style={em.fieldLabel}>{label}</Text>
      <View style={[em.fieldWrap, focused && em.fieldWrapFocus]}>
        <View style={em.fieldIcon}>{icon}</View>
        <TextInput
          ref={inputRef}
          style={em.fieldInput}
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
      </View>
    </View>
  );
}

const em = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,18,40,0.55)",
  },
  sheetWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  sheet: {
    width: "100%",
    backgroundColor: C.surface,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#0a1228",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    color: C.heading,
    fontSize: 15,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: C.border,
  },
  fields: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 6,
    gap: 14,
  },
  fieldGroup: {},
  fieldLabel: {
    color: C.muted,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  fieldWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.bg,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: C.border,
    overflow: "hidden",
  },
  fieldWrapFocus: {
    borderColor: C.accent,
    backgroundColor: "#f8faff",
  },
  fieldIcon: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: C.border,
    paddingVertical: 11,
  },
  fieldInput: {
    flex: 1,
    color: C.heading,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontWeight: "500",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.bg,
  },
  cancelText: {
    color: C.subtle,
    fontSize: 14,
    fontWeight: "700",
  },
  saveBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 13,
    borderRadius: 11,
    backgroundColor: C.accent,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 5,
  },
  saveBtnOff: {
    opacity: 0.4,
    shadowOpacity: 0,
    elevation: 0,
  },
  saveText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
});

// ─── Shared Styles ────────────────────────────────────────────────────────────
export const strip = StyleSheet.create({
  wrap: {
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingBottom: 8,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  countText: {
    color: C.accent,
    fontSize: 20,
    fontWeight: "700",
  },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.accent,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 20,
  },
  generateBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  list: {
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 8,
  },
  item: {
    width: STRIP_SIZE,
    height: STRIP_SIZE,
    backgroundColor: C.elevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
    position: "relative",
    overflow: "visible",
  },
  removeBtn: {
    position: "absolute",
    top: -9,
    right: -9,
    zIndex: 10,
  },
  removeBtnInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  indexBadge: {
    position: "absolute",
    top: 4,
    left: 6,
    backgroundColor: C.accentDim,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  indexText: {
    color: C.accentText,
    fontSize: 9,
    fontWeight: "800",
  },
  preview: {
    color: C.subtle,
    fontSize: 9,
    textAlign: "center",
    lineHeight: 12,
    marginTop: 2,
  },
});

export const tog = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    backgroundColor: C.border,
    borderRadius: 12,
    padding: 3,
    gap: 3,
    marginTop: 8,
    alignSelf: "center",
    overflow: "hidden",
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  active: {
    backgroundColor: C.accent,
  },
  label: {
    color: C.subtle,
    fontSize: 13,
    fontWeight: "700",
  },
  labelActive: {
    color: "#fff",
  },
});

// ─── Scanner Header/Navbar Component ──────────────────────────────────────
export function ScannerHeader({ session, onEditPress, isCameraMode = false }) {
  return (
    <View style={[sh.header, isCameraMode && sh.headerCamera]}>
      <View style={sh.headerContent}>
        <View style={sh.titleGroup}>
          <Text style={sh.titleQR}>QR</Text>
          <Ionicons
            name="arrow-forward"
            size={16}
            color="#ffffff"
            style={{ marginHorizontal: 8 }}
          />
          <Text style={sh.titlePDF}>PDF</Text>
        </View>
        <TouchableOpacity
          style={[sh.profileBtn, isCameraMode && sh.profileBtnCamera]}
          onPress={onEditPress}
          activeOpacity={0.75}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <Ionicons 
            name="person-circle-outline" 
            size={22} 
            color="#ffffff" 
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Scanner Header Styles ────────────────────────────────────────────────
export const sh = StyleSheet.create({
  header: {
    backgroundColor: C.accent,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  headerCamera: {
    backgroundColor: C.accent,
    borderBottomColor: C.accent,
    shadowOpacity: 0.25,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  titleQR: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  titlePDF: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  profileBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  profileBtnCamera: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderColor: "rgba(255,255,255,0.4)",
  },
});