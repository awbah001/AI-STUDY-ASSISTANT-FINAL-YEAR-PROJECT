import { design } from "../theme/design";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";

const SCREEN_WIDTH = Dimensions.get("window").width;

type Props = {
  question: string;
  answer: string;
  flipped?: boolean;
  onFlip?: (showingAnswer: boolean) => void;
  allowFlipBack?: boolean;
  footer?: string;
  style?: StyleProp<ViewStyle>;
  height?: number;
};

export function FlippingFlashcard({
  question,
  answer,
  flipped: flippedProp,
  onFlip,
  allowFlipBack = true,
  footer,
  style,
  height,
}: Props) {
  const cardHeight =
    height ?? Math.min(380, Math.max(300, SCREEN_WIDTH * 0.78));
  const anim = useRef(new Animated.Value(flippedProp ? 1 : 0)).current;
  const [internalFlipped, setInternalFlipped] = useState(Boolean(flippedProp));
  const showingAnswer = flippedProp ?? internalFlipped;

  useEffect(() => {
    if (flippedProp === undefined) return;
    Animated.spring(anim, {
      toValue: flippedProp ? 1 : 0,
      friction: 8,
      tension: 64,
      useNativeDriver: true,
    }).start();
  }, [anim, flippedProp]);

  const handlePress = () => {
    if (showingAnswer && !allowFlipBack) return;
    const next = !showingAnswer;
    if (flippedProp === undefined) {
      setInternalFlipped(next);
      Animated.spring(anim, {
        toValue: next ? 1 : 0,
        friction: 8,
        tension: 64,
        useNativeDriver: true,
      }).start();
    }
    onFlip?.(next);
  };

  const frontRotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });
  const backRotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["180deg", "360deg"],
  });
  const frontOpacity = anim.interpolate({
    inputRange: [0, 0.49, 0.5, 1],
    outputRange: [1, 1, 0, 0],
  });
  const backOpacity = anim.interpolate({
    inputRange: [0, 0.49, 0.5, 1],
    outputRange: [0, 0, 1, 1],
  });

  const faceSize = { width: "100%" as const, height: cardHeight };

  return (
    <TouchableOpacity
      activeOpacity={0.96}
      onPress={handlePress}
      style={[styles.wrap, faceSize, style]}
    >
      <Animated.View
        pointerEvents={showingAnswer ? "none" : "auto"}
        style={[
          styles.face,
          styles.front,
          faceSize,
          {
            opacity: frontOpacity,
            transform: [{ rotateY: frontRotate }],
          },
        ]}
      >
        <View style={[styles.accent, { backgroundColor: colors.primary }]} />
        <View style={styles.topRow}>
          <View style={styles.badge}>
            <Ionicons
              name="help-circle-outline"
              size={16}
              color={colors.primary}
            />
            <Text style={styles.badgeText}>Question</Text>
          </View>
        </View>
        <View style={styles.bodyWrap}>
          <Text style={styles.body} selectable>
            {question}
          </Text>
        </View>
        <View style={styles.hintRow}>
          <Ionicons name="sync-outline" size={14} color={colors.textLight} />
          <Text style={styles.hint}>Tap to flip</Text>
        </View>
      </Animated.View>

      <Animated.View
        pointerEvents={showingAnswer ? "auto" : "none"}
        style={[
          styles.face,
          styles.back,
          faceSize,
          {
            opacity: backOpacity,
            transform: [{ rotateY: backRotate }],
          },
        ]}
      >
        <View style={styles.topRow}>
          <View style={[styles.badge, styles.badgeBack]}>
            <Ionicons name="bookmark-outline" size={16} color="#1d4ed8" />
            <Text style={[styles.badgeText, { color: "#1d4ed8" }]}>Answer</Text>
          </View>
        </View>
        <View style={styles.bodyWrap}>
          <Text style={styles.bodyBack} selectable>
            {answer}
          </Text>
        </View>
        {footer ? <Text style={styles.footer}>{footer}</Text> : null}
        {allowFlipBack ? (
          <View style={styles.hintRow}>
            <Ionicons name="sync-outline" size={14} color="#64748b" />
            <Text style={[styles.hint, { color: "#64748b" }]}>
              Tap to flip back
            </Text>
          </View>
        ) : (
          <View style={styles.hintRow} />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 18,
    position: "relative",
  },
  face: {
    position: "absolute",
    top: 0,
    left: 0,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 16,
    ...design.card,
  },
  front: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    zIndex: 2,
  },
  back: {
    backgroundColor: "#f8fbff",
    borderWidth: 1,
    borderColor: "#dbeafe",
    zIndex: 1,
  },
  accent: {
    position: "absolute",
    top: 0,
    left: 24,
    width: 48,
    height: 5,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primaryLight,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeBack: {
    backgroundColor: "#dbeafe",
  },
  badgeText: { ...design.eyebrow },
  bodyWrap: {
    flexGrow: 1,
    flexShrink: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 20,
    minHeight: 140,
  },
  body: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
    lineHeight: 32,
  },
  bodyBack: {
    fontSize: 18,
    fontWeight: "600",
    color: "#334155",
    textAlign: "center",
    lineHeight: 28,
  },
  hintRow: {
    minHeight: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  hint: { fontWeight: "600", ...design.caption },
  footer: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
    marginBottom: 6,
  },
});
