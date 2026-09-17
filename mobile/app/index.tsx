import { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/contexts/AuthContext";
import { colors } from "../src/theme/colors";

const bot = require("../assets/cognify-auth-bot.png");
const logo = require("../assets/logo.png");
const SPLASH_MS = 2400;

export default function SplashScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const fade = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const readyAt = useRef(Date.now() + SPLASH_MS);

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 520, useNativeDriver: true }).start();
    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
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
      router.replace(user ? "/(tabs)/dashboard" : "/(auth)/login");
    }, wait);
    return () => clearTimeout(timer);
  }, [loading, router, user]);

  const robotY = bob.interpolate({ inputRange: [0, 1], outputRange: [8, -14] });
  const blobScale = glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return (
    <View style={styles.safe}>
      <Animated.View style={[styles.inner, { opacity: fade }]}>
        <View style={styles.logoClip}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={styles.brand}>Cognify</Text>
        <Text style={styles.tag}>Your AI Learning Assistant</Text>
        <View style={styles.scene}>
          <Animated.View style={[styles.blob, styles.blobLeft, { transform: [{ scale: blobScale }] }]} />
          <Animated.View style={[styles.blob, styles.blobRight, { transform: [{ scale: blobScale }] }]} />
          <Animated.Image
            source={bot}
            style={[styles.bot, { transform: [{ translateY: robotY }] }]}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.hint}>Getting your study space ready…</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f4fffb",
    alignItems: "center",
    justifyContent: "center",
  },
  inner: { alignItems: "center", paddingHorizontal: 24, width: "100%" },
  logoClip: { width: 72, height: 52, overflow: "hidden", alignItems: "center", marginBottom: 8 },
  logo: { width: 92, height: 92, marginTop: -4 },
  brand: { fontSize: 36, fontWeight: "800", color: "#123047", letterSpacing: -0.8 },
  tag: { marginTop: 4, fontSize: 15, color: "#7d93a6", fontWeight: "500" },
  scene: {
    height: 280,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  blob: { position: "absolute", borderRadius: 140, backgroundColor: "#dff8ef" },
  blobLeft: { width: 200, height: 180, left: 24, top: 36 },
  blobRight: { width: 170, height: 150, right: 20, top: 20, backgroundColor: "#e9fbf4" },
  bot: { width: 280, height: 260, zIndex: 2 },
  hint: { marginTop: 8, fontSize: 13, color: colors.primary, fontWeight: "600" },
});
