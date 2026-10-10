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
  const shadowScale = bob.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] });
  const shadowOpacity = bob.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.3] });
  const haloScale = glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <View style={styles.hero}>
      <View style={styles.brandRow}>
        <View style={styles.logoTile}>
          <View style={styles.logoClip}>
            <Image source={brandLogo} style={styles.logo} resizeMode="contain" />
          </View>
        </View>
        <View>
          <Text style={styles.brandName}>Course-Specific</Text>
          <Text style={styles.brandTagline}>AI Learning Assistant</Text>
        </View>
      </View>

      <View style={[styles.robotScene, compact && styles.robotSceneCompact]}>
        <Animated.View style={[styles.haloOuter, compact && styles.haloOuterCompact, { transform: [{ scale: haloScale }] }]} />
        <View style={[styles.haloInner, compact && styles.haloInnerCompact]} />
        <Animated.View style={[styles.spark, styles.sparkViolet, { opacity: glow }]} />
        <View style={[styles.spark, styles.sparkAmber]} />
        <Animated.View style={[styles.spark, styles.sparkSky, { opacity: glow }]} />
        <View style={[styles.spark, styles.sparkPink]} />
        <Animated.View style={[styles.groundShadow, { opacity: shadowOpacity, transform: [{ scaleX: shadowScale }] }]} />
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
  brandRow: { alignItems: "center", flexDirection: "row", gap: 12 },
  logoTile: {
    alignItems: "center",
    justifyContent: "center",
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e1f3ec",
    shadowColor: "#0b5d45",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  logoClip: { width: 38, height: 38, overflow: "hidden", alignItems: "center" },
  logo: { width: 86, height: 86, marginTop: -13 },
  brandName: { color: "#123047", fontSize: 21, fontWeight: "800", letterSpacing: -0.4 },
  brandTagline: { color: "#6d5dfc", fontSize: 13, marginTop: 1, fontWeight: "700" },
  robotScene: {
    height: 218,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  robotSceneCompact: { height: 170 },
  haloOuter: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#eeeaff",
  },
  haloOuterCompact: { width: 150, height: 150, borderRadius: 75 },
  haloInner: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#d2f3e5",
  },
  haloInnerCompact: { width: 110, height: 110, borderRadius: 55 },
  spark: { position: "absolute", borderRadius: 99 },
  sparkViolet: { width: 12, height: 12, top: 22, left: "22%", backgroundColor: "#8b7bff" },
  sparkAmber: { width: 9, height: 9, top: 44, right: "21%", backgroundColor: "#f5b740" },
  sparkSky: { width: 10, height: 10, bottom: 46, right: "18%", backgroundColor: "#38bdf8" },
  sparkPink: { width: 7, height: 7, bottom: 64, left: "19%", backgroundColor: "#f472b6" },
  groundShadow: {
    position: "absolute",
    bottom: 10,
    width: 110,
    height: 12,
    borderRadius: 60,
    backgroundColor: "rgba(11, 93, 69, 0.35)",
  },
  robot: { width: 220, height: 200 },
  robotCompact: { width: 170, height: 156 },
});
