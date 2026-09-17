import { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";

const brandLogo = require("../../assets/logo.png");
const authBot = require("../../assets/cognify-auth-bot.png");

export function AuthBotHero({ compact = false }: { compact?: boolean }) {
  const bob = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bobAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    const glowAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    bobAnim.start();
    glowAnim.start();
    return () => {
      bobAnim.stop();
      glowAnim.stop();
    };
  }, [bob, glow]);

  const robotY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, compact ? -6 : -10] });
  const blobScale = glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <View style={styles.hero}>
      <View style={styles.logoClip}>
        <Image source={brandLogo} style={styles.logo} resizeMode="contain" />
      </View>
      <Text style={styles.brandName}>Cognify</Text>
      <Text style={styles.brandTagline}>Your AI Learning Assistant</Text>

      <View style={[styles.robotScene, compact && styles.robotSceneCompact]}>
        <Animated.View style={[styles.blobLeft, { transform: [{ scale: blobScale }] }]} />
        <Animated.View style={[styles.blobRight, { transform: [{ scale: blobScale }] }]} />
        <Animated.Image
          source={authBot}
          style={[styles.robot, compact && styles.robotCompact, { transform: [{ translateY: robotY }] }]}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center" },
  logoClip: {
    width: 72,
    height: 52,
    overflow: "hidden",
    alignItems: "center",
    marginBottom: 6,
  },
  logo: { width: 92, height: 92, marginTop: -4 },
  brandName: { color: "#123047", fontSize: 34, fontWeight: "700", letterSpacing: -0.6 },
  brandTagline: { color: "#8aa0b4", fontSize: 14, marginTop: 4, fontWeight: "500" },
  robotScene: {
    height: 236,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  robotSceneCompact: { height: 176 },
  blobLeft: {
    position: "absolute",
    left: 18,
    top: 28,
    height: 150,
    width: 170,
    borderRadius: 120,
    backgroundColor: "#dff8ef",
  },
  blobRight: {
    position: "absolute",
    right: 10,
    top: 18,
    height: 130,
    width: 150,
    borderRadius: 110,
    backgroundColor: "#e9fbf4",
  },
  robot: { width: 250, height: 230 },
  robotCompact: { width: 190, height: 172 },
});
