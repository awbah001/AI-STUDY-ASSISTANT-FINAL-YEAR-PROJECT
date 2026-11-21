import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, Text, type ActivityIndicatorProps } from "react-native";
import { colors } from "../../theme/colors";

/** Native concentric arc loader, adapted from Erasmus001's Uiverse design.
 * Uses native border arcs so no SVG package or web view is needed.
 */
export function WifiLoader({
  size = "small", color = colors.primary, animating = true, hidesWhenStopped = true,
  style, label, accessibilityLabel = label ?? "Loading", ...props
}: ActivityIndicatorProps & { label?: string }) {
  const [reducedMotion, setReducedMotion] = useState(true);
  const values = useRef(Array.from({ length: 6 }, () => new Animated.Value(0))).current;
  const dimension = typeof size === "number" ? size : size === "large" ? 64 : 20;

  useEffect(() => {
    let mounted = true;
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReducedMotion(enabled);
    }).catch(() => {});
    return () => { mounted = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    values.forEach((value) => value.setValue(0));
    if (!animating || reducedMotion) return;
    const delays = [300, 150, 250, 100, 200, 50];
    const animations = values.map((value, index) => Animated.sequence([
      Animated.delay(delays[index]!),
      Animated.loop(Animated.timing(value, {
        toValue: 1, duration: 1800, easing: Easing.linear,
        useNativeDriver: true, isInteraction: false,
      })),
    ]));
    animations.forEach((animation) => animation.start());
    return () => {
      animations.forEach((animation) => animation.stop());
      values.forEach((value) => value.stopAnimation());
    };
  }, [values, animating, reducedMotion]);

  if (!animating && hidesWhenStopped) return null;
  return (
    <View accessible {...props} accessibilityRole="progressbar" accessibilityLabel={accessibilityLabel} style={[styles.root, style]}>
      <View pointerEvents="none" accessible={false} style={{ width: dimension, height: dimension }}>
        {[1, 60 / 86, 34 / 86].map((ratio, ring) => {
          const width = dimension * ratio;
          return [0, 1].map((layer) => (
            <Animated.View key={`${ring}-${layer}`} style={{
              position: "absolute", width, height: width,
              left: (dimension - width) / 2, top: (dimension - width) / 2,
              borderRadius: width / 2,
              borderWidth: Math.max(1, dimension * 6 / 86),
              borderColor: "transparent", borderTopColor: color ?? colors.primary,
              opacity: layer === 0 ? 0.22 : 1,
              transform: [{ rotate: values[ring * 2 + layer]!.interpolate({
                inputRange: [0, 0.25, 0.65, 0.8, 1],
                outputRange: ["-136deg", "-100deg", "-532deg", "-496deg", "-496deg"],
              }) }],
            }} />
          ));
        })}
      </View>
      {label ? <Text accessible={false} style={[styles.label, { color: color ?? colors.primary }]}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: "center", justifyContent: "center" },
  label: { marginTop: 16, fontSize: 14, fontWeight: "500", textAlign: "center", letterSpacing: 0.2 },
});
