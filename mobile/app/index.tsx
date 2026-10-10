import { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useAuth } from "../src/contexts/AuthContext";
import { colors, gradients } from "../src/theme/colors";

const bot = require("../assets/cognify-auth-bot.png");
const logo = require("../assets/logo.png");
const SPLASH_MS = 2400;

export default function SplashScreen() {
  const router = useRouter();
  const { loading } = useAuth();
  const fade = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const readyAt = useRef(Date.now() + SPLASH_MS);

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 520,
      useNativeDriver: true,
    }).start();
    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    bobLoop.start();
    glowLoop.start();
    return () => {
      bobLoop.stop();
      glowLoop.stop();
    };
  }, [bob, fade, glow]);

  useEffect(() => {
    if (loading) return;
    const wait = Math.max(0, readyAt.current - Date.now());
    const timer = setTimeout(() => {
      router.replace("/(auth)/login");
    }, wait);
    return () => clearTimeout(timer);
  }, [loading, router]);

  const robotY = bob.interpolate({ inputRange: [0, 1], outputRange: [8, -14] });
  const blobScale = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  const DOT_WAVE = [
    [1, 0.35, 0.3],
    [0.35, 1, 0.35],
    [0.3, 0.35, 1],
  ];
  const dotOpacity = (i: number) =>
    glow.interpolate({ inputRange: [0, 0.5, 1], outputRange: DOT_WAVE[i] });

  return (
    <LinearGradient
      colors={gradients.hero}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.safe}
    >
      <StatusBar style="light" />
      <View pointerEvents="none" style={styles.ringLg} />
      <View pointerEvents="none" style={styles.ringSm} />
      <Animated.View style={[styles.inner, { opacity: fade }]}>
        <View style={styles.logoClip}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={styles.brand}>Course-Specific</Text>
        <Text style={styles.tag}>AI Learning Assistant</Text>
        <View style={styles.scene}>
          <Animated.View
            style={[styles.halo, { transform: [{ scale: blobScale }] }]}
          />
          <Animated.View
            style={[styles.haloInner, { transform: [{ scale: blobScale }] }]}
          />
          <Animated.Image
            source={bot}
            style={[styles.bot, { transform: [{ translateY: robotY }] }]}
            resizeMode="contain"
          />
        </View>
        <View style={styles.dots}>
          {[0, 1, 2].map(i => (
            <Animated.View key={i} style={[styles.dot, { opacity: dotOpacity(i) }]} />
          ))}
        </View>
        <Text style={styles.hint}>Getting your study space ready…</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  ringLg: {
    position: "absolute",
    width: 460,
    height: 460,
    borderRadius: 230,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    top: -160,
    right: -180,
  },
  ringSm: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(52,211,153,0.08)",
    bottom: -120,
    left: -110,
  },
  inner: { alignItems: "center", paddingHorizontal: 24, width: "100%" },
  logoClip: {
    width: 64,
    height: 64,
    borderRadius: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 8,
  },
  logo: { width: 64, height: 64 },
  brand: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.white,
    letterSpacing: -1,
    textAlign: "center",
  },
  tag: { marginTop: 2, fontSize: 18, color: "#a7f3d0", fontWeight: "600", textAlign: "center" },
  scene: {
    height: 280,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  halo: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  haloInner: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "rgba(52,211,153,0.14)",
  },
  bot: { width: 260, height: 240, zIndex: 2 },
  dots: { flexDirection: "row", gap: 6, marginTop: 10 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  hint: {
    marginTop: 12,
    fontSize: 13,
    color: "#d1fae5",
    fontWeight: "600",
  },
});
