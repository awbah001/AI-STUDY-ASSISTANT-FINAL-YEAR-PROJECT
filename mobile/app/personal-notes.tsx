import { useState } from "react";
import {
  Alert,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { randomUUID } from "expo-crypto";
import { trpc } from "../src/lib/api";
import { colors } from "../src/theme/colors";

type Draft = {
  courseId?: number | null;
  topic?: string;
  collection?: string;
  id?: number;
  version?: number;
  title: string;
  body: string;
  requestId: string;
};
export default function PersonalNotes() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [courseFilter, setCourseFilter] = useState<number | undefined>();
  const [topicFilter, setTopicFilter] = useState("");
  const [collectionFilter, setCollectionFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const utils = trpc.useUtils();
  const organization = trpc.personalNotes.organization.useQuery();
  const courses = [
    ...(organization.data?.courses ?? []),
    ...(organization.data?.linkedCourseIds ?? [])
      .filter(id => !organization.data?.courses.some(c => c.id === id))
      .map(id => ({
        id,
        code: `Course ${id}`,
        title: "Previously linked course",
      })),
  ];
  const notes = trpc.personalNotes.list.useQuery({
    search,
    offset,
    courseId: courseFilter,
    topic: topicFilter.trim() || undefined,
    collection: collectionFilter.trim() || undefined,
  });
  const done = () => {
    setDraft(null);
    setDirty(false);
    void utils.personalNotes.list.invalidate();
    void utils.personalNotes.organization.invalidate();
  };
  const failed = (error: { message: string }) =>
    Alert.alert("Could not save note", error.message);
  const create = trpc.personalNotes.create.useMutation({
    onSuccess: done,
    onError: failed,
  });
  const update = trpc.personalNotes.update.useMutation({
    onSuccess: done,
    onError: failed,
  });
  const remove = trpc.personalNotes.remove.useMutation({
    onSuccess: () => {
      setOffset(0);
      void utils.personalNotes.list.invalidate();
      void utils.personalNotes.organization.invalidate();
    },
    onError: failed,
  });
  const busy = create.isPending || update.isPending;
  const hasFilters = Boolean(
    search ||
    courseFilter !== undefined ||
    topicFilter.trim() ||
    collectionFilter.trim()
  );
  function open(next: Draft | null) {
    const apply = () => {
      setDraft(next);
      setDirty(false);
    };
    if (dirty)
      Alert.alert("Unsaved changes", "Discard your unsaved note changes?", [
        { text: "Keep editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: apply },
      ]);
    else apply();
  }
  return (
    <SafeAreaView style={s.screen}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.content}
      >
        <View style={s.row}>
          <TouchableOpacity
            accessibilityRole="button"
            style={s.button}
            onPress={() => {
              if (draft) open(null);
              else router.back();
            }}
          >
            <Text style={s.link}>{draft ? "Close editor" : "Back"}</Text>
          </TouchableOpacity>
          <Text style={s.heading}>Personal notes</Text>
        </View>
        <Text style={s.text}>Private study notes and saved AI responses.</Text>
        <TouchableOpacity
          accessibilityRole="button"
          disabled={busy}
          style={s.button}
          onPress={() => open({ title: "", body: "", requestId: randomUUID() })}
        >
          <Text style={s.link}>New note</Text>
        </TouchableOpacity>
        <TextInput
          accessibilityLabel="Search personal notes"
          style={s.input}
          value={search}
          maxLength={200}
          placeholder="Search titles and note text"
          onChangeText={text => {
            setSearch(text);
            setOffset(0);
          }}
        />
        <TouchableOpacity
          accessibilityRole="button"
          style={s.button}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Text style={s.link}>
            {showFilters
              ? "Hide organization filters"
              : "Filter by course, topic or collection"}
          </Text>
        </TouchableOpacity>
        {showFilters && (
          <View style={s.card}>
            <Text style={s.text}>Course filter</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={s.row}>
                {[
                  { id: undefined, code: "All courses" },
                  { id: 0, code: "Personal" },
                  ...courses,
                ].map(course => (
                  <TouchableOpacity
                    key={String(course.id)}
                    style={s.button}
                    onPress={() => {
                      setCourseFilter(course.id);
                      setOffset(0);
                    }}
                  >
                    <Text
                      style={{
                        color:
                          courseFilter === course.id
                            ? colors.primary
                            : colors.text,
                        fontWeight: courseFilter === course.id ? "700" : "400",
                      }}
                    >
                      {course.code}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TextInput
              accessibilityLabel="Filter notes by topic"
              style={s.input}
              placeholder="Exact topic name"
              value={topicFilter}
              maxLength={100}
              onChangeText={value => {
                setTopicFilter(value);
                setOffset(0);
              }}
            />
            <TextInput
              accessibilityLabel="Filter notes by collection"
              style={s.input}
              placeholder="Exact collection name"
              value={collectionFilter}
              maxLength={80}
              onChangeText={value => {
                setCollectionFilter(value);
                setOffset(0);
              }}
            />
            {!!organization.data?.collections.length && (
              <ScrollView horizontal>
                <View style={s.row}>
                  {organization.data.collections.map(name => (
                    <TouchableOpacity
                      style={s.button}
                      key={name}
                      onPress={() => {
                        setCollectionFilter(name);
                        setOffset(0);
                      }}
                    >
                      <Text style={s.link}>{name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            )}
            <TouchableOpacity
              style={s.button}
              onPress={() => {
                setCourseFilter(undefined);
                setTopicFilter("");
                setCollectionFilter("");
                setOffset(0);
              }}
            >
              <Text style={s.link}>Clear organization filters</Text>
            </TouchableOpacity>
          </View>
        )}
        {draft && (
          <View style={s.card}>
            <Text style={s.heading}>{draft.id ? "Edit note" : "New note"}</Text>
            <Text style={s.text}>Title</Text>
            <TextInput
              accessibilityLabel="Note title"
              style={s.input}
              value={draft.title}
              maxLength={160}
              editable={!busy}
              onChangeText={title => {
                setDraft({ ...draft, title });
                setDirty(true);
              }}
            />
            <Text style={s.text}>Course</Text>
            <ScrollView horizontal>
              <View style={s.row}>
                {[{ id: null, code: "Personal" }, ...courses].map(course => (
                  <TouchableOpacity
                    style={s.button}
                    key={String(course.id)}
                    disabled={busy}
                    onPress={() => {
                      setDraft({ ...draft, courseId: course.id });
                      setDirty(true);
                    }}
                  >
                    <Text
                      style={{
                        color:
                          (draft.courseId ?? null) === course.id
                            ? colors.primary
                            : colors.text,
                        fontWeight:
                          (draft.courseId ?? null) === course.id
                            ? "700"
                            : "400",
                      }}
                    >
                      {course.code}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            {organization.error && (
              <TouchableOpacity onPress={() => void organization.refetch()}>
                <Text style={s.text}>
                  Course choices could not load. Tap to retry.
                </Text>
              </TouchableOpacity>
            )}
            <TextInput
              accessibilityLabel="Note topic"
              style={s.input}
              value={draft.topic ?? ""}
              placeholder="Topic (optional)"
              maxLength={100}
              editable={!busy}
              onChangeText={topic => {
                setDraft({ ...draft, topic });
                setDirty(true);
              }}
            />
            <TextInput
              accessibilityLabel="Note collection"
              style={s.input}
              value={draft.collection ?? ""}
              placeholder="Choose or create a collection"
              maxLength={80}
              editable={!busy}
              onChangeText={collection => {
                setDraft({ ...draft, collection });
                setDirty(true);
              }}
            />
            {!!organization.data?.collections.length && (
              <ScrollView horizontal>
                <View style={s.row}>
                  {organization.data.collections.map(name => (
                    <TouchableOpacity
                      style={s.button}
                      key={name}
                      disabled={busy}
                      onPress={() => {
                        setDraft({ ...draft, collection: name });
                        setDirty(true);
                      }}
                    >
                      <Text style={s.link}>{name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            )}
            <Text style={s.text}>Note</Text>
            <TextInput
              accessibilityLabel="Note text"
              style={[s.input, { minHeight: 220, textAlignVertical: "top" }]}
              multiline
              value={draft.body}
              maxLength={50000}
              editable={!busy}
              onChangeText={body => {
                setDraft({ ...draft, body });
                setDirty(true);
              }}
            />
            <TouchableOpacity
              accessibilityRole="button"
              style={s.button}
              disabled={busy || !draft.title.trim() || !draft.body.trim()}
              onPress={() => {
                if (draft.id)
                  update.mutate({
                    id: draft.id,
                    version: draft.version!,
                    title: draft.title,
                    body: draft.body,
                    courseId: draft.courseId,
                    topic: draft.topic,
                    collection: draft.collection,
                  });
                else
                  create.mutate({
                    title: draft.title,
                    body: draft.body,
                    requestId: draft.requestId,
                    courseId: draft.courseId,
                    topic: draft.topic,
                    collection: draft.collection,
                  });
              }}
            >
              <Text style={s.link}>{busy ? "Saving…" : "Save note"}</Text>
            </TouchableOpacity>
          </View>
        )}
        {notes.isLoading && <Text style={s.text}>Loading notes…</Text>}
        {notes.error && (
          <TouchableOpacity
            style={s.button}
            onPress={() => void notes.refetch()}
          >
            <Text style={s.text}>{notes.error.message} Tap to retry.</Text>
          </TouchableOpacity>
        )}
        {notes.data && !notes.data.items.length && (
          <Text style={s.text}>
            {hasFilters
              ? "No notes match your search."
              : "Create a note or save an AI response to get started."}
          </Text>
        )}
        {notes.data && !notes.data.items.length && hasFilters && (
          <TouchableOpacity
            style={s.button}
            onPress={() => {
              setSearch("");
              setCourseFilter(undefined);
              setTopicFilter("");
              setCollectionFilter("");
              setOffset(0);
            }}
          >
            <Text style={s.link}>Clear all filters</Text>
          </TouchableOpacity>
        )}
        {notes.data?.items.map(note => (
          <View key={note.id} style={s.card}>
            <Text style={s.heading}>{note.title}</Text>
            {!!(note.courseId || note.topic || note.collection) && (
              <Text style={s.link}>
                {[
                  note.courseId
                    ? courses.find(c => c.id === note.courseId)?.code ||
                      `Course ${note.courseId}`
                    : "",
                  note.topic,
                  note.collection,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            )}
            <Text style={s.text}>
              {note.body.slice(0, 600)}
              {note.body.length > 600 ? "…" : ""}
            </Text>
            <Text style={s.text}>
              {note.sourceMessageId ? "Saved AI response · " : ""}
              {new Date(note.updatedAt).toLocaleDateString()}
            </Text>
            <View style={s.row}>
              <TouchableOpacity
                style={s.button}
                disabled={busy}
                onPress={() => open({ ...note, requestId: randomUUID() })}
              >
                <Text style={s.link}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.button}
                disabled={busy || remove.isPending}
                onPress={() =>
                  Alert.alert("Delete note?", note.title, [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () =>
                        remove.mutate({ id: note.id, version: note.version }),
                    },
                  ])
                }
              >
                <Text style={{ color: colors.error }}>Delete</Text>
              </TouchableOpacity>
            </View>
            {!!note.documentId && (
              <TouchableOpacity
                style={s.button}
                onPress={() =>
                  router.push({
                    pathname: "/document/[id]",
                    params: { id: String(note.documentId), tab: "chat" },
                  })
                }
              >
                <Text style={s.link}>Source conversation</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        <View style={s.row}>
          <TouchableOpacity
            style={s.button}
            disabled={offset === 0 || notes.isFetching}
            onPress={() => setOffset(Math.max(0, offset - 50))}
          >
            <Text style={s.link}>Previous</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.button}
            disabled={!notes.data?.hasMore || notes.isFetching}
            onPress={() => setOffset(offset + 50)}
          >
            <Text style={s.link}>Next</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, gap: 14 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  heading: { fontSize: 19, fontWeight: "700", color: colors.text },
  text: { color: colors.text, lineHeight: 23 },
  link: { color: colors.primary, fontWeight: "600" },
  button: { minHeight: 44, paddingHorizontal: 10, justifyContent: "center" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    color: colors.text,
    backgroundColor: colors.white,
    minHeight: 48,
  },
  card: {
    padding: 16,
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
