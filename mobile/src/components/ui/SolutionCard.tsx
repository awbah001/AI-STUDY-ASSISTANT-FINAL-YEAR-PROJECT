import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  TouchableOpacity,
  type TouchableOpacityProps,
  type ViewProps,
} from "react-native";
import { colors } from "../../theme/colors";
import { withAlpha } from "./icons";

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

/** Native version of the diagonal accent and rising bubble card treatment.
 * Touch events observe feedback without claiming the responder from child controls.
 */
export function SolutionCard({
  component = "view",
  accent = colors.primary,
  children,
  style,
  onLayout,
  onTouchStart,
  onTouchEnd,
  onTouchCancel,
  onPointerEnter,
  onPointerLeave,
  ...props
}: ViewProps & TouchableOpacityProps & { component?: "view" | "touchable"; accent?: string }) {
  const progress = useRef(new Animated.Value(0)).current;
  const reducedMotion = useRef(true);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    let mounted = true;
    const update = (enabled: boolean) => {
      reducedMotion.current = enabled;
      if (enabled) {
        progress.stopAnimation();
        progress.setValue(0);
      }
    };
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", update);
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) update(enabled);
    }).catch(() => {});
    return () => {
      mounted = false;
      subscription.remove();
      progress.stopAnimation();
    };
  }, [progress]);

  const animate = (active: boolean) => {
    if (reducedMotion.current) return;
    Animated.timing(progress, {
      toValue: active ? 1 : 0,
      duration: active ? 700 : 350,
      useNativeDriver: true,
    }).start();
  };
  const Surface = component === "touchable" ? AnimatedTouchable : Animated.View;
  const bubbleSize = Math.max(size.width, size.height, 160) * 2.4;
  const flatStyle = StyleSheet.flatten(style);

  return (
    <Surface
      {...props}
      style={[styles.card, style, {
        transform: typeof flatStyle?.transform === "string" ? flatStyle.transform : [...(flatStyle?.transform ?? []), {
          scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.015] }),
        }],
      }]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setSize((previous) => previous.width === width && previous.height === height ? previous : { width, height });
        onLayout?.(event);
      }}
      onTouchStart={(event) => { animate(true); onTouchStart?.(event); }}
      onTouchEnd={(event) => { animate(false); onTouchEnd?.(event); }}
      onTouchCancel={(event) => { animate(false); onTouchCancel?.(event); }}
      onPointerEnter={(event) => { animate(true); onPointerEnter?.(event); }}
      onPointerLeave={(event) => { animate(false); onPointerLeave?.(event); }}
    >
      <Animated.View
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[StyleSheet.absoluteFill, styles.decoration, {
          borderRadius: flatStyle?.borderRadius ?? 15,
        }]}
      >
        <Animated.View style={[styles.diagonal, { backgroundColor: withAlpha(accent, 0.05) }]} />
        <Animated.View style={{
          position: "absolute",
          left: -bubbleSize * 0.25,
          top: 0,
          width: bubbleSize,
          height: bubbleSize,
          borderRadius: bubbleSize / 2,
          backgroundColor: withAlpha(accent, 0.10),
          opacity: progress,
          transform: [{ translateY: progress.interpolate({
            inputRange: [0, 1], outputRange: [size.height + 40, 0],
          }) }],
        }} />
      </Animated.View>
      {children}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "relative",
    borderRadius: 15,
    shadowColor: "#0b2f2c",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.09,
    shadowRadius: 15,
    elevation: 2,
  },
  decoration: { overflow: "hidden" },
  diagonal: {
    position: "absolute",
    width: 170,
    height: 400,
    right: -56,
    top: -23,
    borderRadius: 35,
    transform: [{ rotate: "42deg" }],
  },
});
