import { memo, useMemo, type ReactNode } from "react";
import { Alert, Linking, Platform, StyleSheet, Text, View } from "react-native";
import { Lexer, type Token, type MarkedToken } from "marked";
import { router } from "expo-router";
import { colors } from "../theme/colors";

async function openLink(url: string) {
  const source = url.match(/^\/document\/(\d+)\?tab=notes&source=([a-f0-9]{24})$/);
  if (source) {
    router.push({ pathname: "/document/[id]", params: { id: source[1], tab: "notes", source: source[2] } });
    return;
  }
  if (!/^(https?:\/\/|mailto:)/i.test(url)) return;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert("Unable to open link", "Please try again later.");
  }
}

function inline(tokens: Token[]): ReactNode[] {
  return tokens.map((rawToken, i) => {
    const token = rawToken as MarkedToken;
    const children =
      "tokens" in token && token.tokens
        ? inline(token.tokens)
        : "text" in token
          ? token.text
          : token.raw;
    switch (token.type) {
      case "strong":
        return (
          <Text key={i} style={s.bold}>
            {children}
          </Text>
        );
      case "em":
        return (
          <Text key={i} style={s.italic}>
            {children}
          </Text>
        );
      case "del":
        return (
          <Text key={i} style={s.deleted}>
            {children}
          </Text>
        );
      case "codespan":
        return (
          <Text key={i} style={s.inlineCode}>
            {token.text}
          </Text>
        );
      case "br":
        return "\n";
      case "html":
        return /^<br\s*\/?>$/i.test(token.raw.trim()) ? (
          "\n"
        ) : (
          <Text key={i}>{token.raw}</Text>
        );
      case "link":
        return (
          <Text
            key={i}
            accessibilityRole="link"
            style={s.link}
            onPress={() => void openLink(token.href)}
          >
            {children}
          </Text>
        );
      case "image":
        return <Text key={i}>{token.text || "Image"}</Text>;
      default:
        return <Text key={i}>{children}</Text>;
    }
  });
}

function blocks(tokens: Token[]): ReactNode[] {
  return tokens.map((rawToken, i) => {
    const token = rawToken as MarkedToken;
    switch (token.type) {
      case "space":
        return null;
      case "heading":
        return (
          <Text
            key={i}
            selectable
            accessibilityRole="header"
            style={[s.text, s.heading, token.depth <= 2 && s.largeHeading]}
          >
            {inline(token.tokens)}
          </Text>
        );
      case "paragraph":
      case "text":
        return (
          <Text key={i} selectable style={s.text}>
            {token.tokens ? inline(token.tokens) : token.text}
          </Text>
        );
      case "list":
        return (
          <View key={i} style={s.stack}>
            {token.items.map((item, index) => (
              <View key={index} style={s.listRow}>
                <Text style={[s.text, s.bullet]}>
                  {item.task
                    ? item.checked
                      ? "☑"
                      : "☐"
                    : token.ordered
                      ? `${Number(token.start) + index}.`
                      : "•"}
                </Text>
                <View style={s.listBody}>{blocks(item.tokens)}</View>
              </View>
            ))}
          </View>
        );
      case "table":
        return (
          <View key={i} style={s.stack}>
            {token.rows.map((row, rowIndex) => (
              <View key={rowIndex} style={s.tableCard}>
                {row.map((cell, columnIndex) => (
                  <View key={columnIndex} style={s.cell}>
                    <Text style={s.columnLabel}>
                      {inline(token.header[columnIndex]?.tokens ?? [])}
                    </Text>
                    <Text
                      selectable
                      style={[s.text, columnIndex === 0 && s.bold]}
                    >
                      {inline(cell.tokens)}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
            {token.rows.length === 0 && (
              <Text style={s.text}>
                {token.header.map((cell, index) => (
                  <Text key={index}>
                    {index ? " · " : ""}
                    {inline(cell.tokens)}
                  </Text>
                ))}
              </Text>
            )}
          </View>
        );
      case "blockquote":
        return (
          <View key={i} style={s.quote}>
            {blocks(token.tokens)}
          </View>
        );
      case "code":
        return (
          <View key={i} style={s.codeBlock}>
            {token.lang && <Text style={s.columnLabel}>{token.lang}</Text>}
            <Text selectable style={[s.text, s.code]}>
              {token.text}
            </Text>
          </View>
        );
      case "hr":
        return <View key={i} style={s.rule} />;
      default:
        return (
          <Text key={i} selectable style={s.text}>
            {"text" in token ? token.text : token.raw}
          </Text>
        );
    }
  });
}

/** Render model output natively; never execute generated HTML or scripts. */
export const AssistantMessage = memo(function AssistantMessage({
  content,
}: {
  content: string;
}) {
  const tokens = useMemo(
    () => Lexer.lex(content, { gfm: true, breaks: true }),
    [content]
  );
  return <View style={s.stack}>{blocks(tokens)}</View>;
});

const s = StyleSheet.create({
  stack: { gap: 12, flexShrink: 1 },
  text: { fontSize: 14, lineHeight: 22, color: colors.text },
  bold: { fontWeight: "700" },
  italic: { fontStyle: "italic" },
  deleted: { textDecorationLine: "line-through" },
  heading: { fontSize: 16, lineHeight: 24, fontWeight: "700" },
  largeHeading: { fontSize: 18, lineHeight: 26 },
  link: { color: colors.primary, textDecorationLine: "underline" },
  inlineCode: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    backgroundColor: colors.bgInput,
    fontSize: 13,
  },
  code: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 13,
  },
  codeBlock: {
    backgroundColor: colors.bgInput,
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  listRow: { flexDirection: "row", gap: 8 },
  bullet: { minWidth: 16, color: colors.primary },
  listBody: { flex: 1, gap: 6 },
  tableCard: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  cell: { gap: 3 },
  columnLabel: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
  },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primaryMuted,
    paddingLeft: 12,
    gap: 8,
  },
  rule: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
});
