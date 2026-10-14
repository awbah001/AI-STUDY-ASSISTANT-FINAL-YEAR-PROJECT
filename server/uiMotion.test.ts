import { describe, expect, it, vi } from "vitest";
import { createElement as h } from "react";
import { Router } from "wouter";
import { renderToStaticMarkup } from "react-dom/server";
import { AnimatedCard } from "../client/src/components/motion/AnimatedCard";
import { AnimatedStatValue } from "../client/src/components/motion/AnimatedStatValue";
import { AnimatedProgressRing } from "../client/src/components/motion/AnimatedProgress";
import AIOrb3D from "../client/src/components/motion/AIOrb3D";
import { StudentRing } from "../client/src/components/StudentUi";
import { MaterialTile, CourseHeader } from "../client/src/components/student/CoursePage";
import { Progress } from "../client/src/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../client/src/components/ui/tabs";
import { FlashcardComponent } from "../client/src/components/FlashcardComponent";
import { AIChatBox } from "../client/src/components/AIChatBox";
import type { Flashcard } from "../shared/types";

vi.mock("@/lib/trpc", () => ({ trpc: {
  useUtils: () => ({ flashcards: { list: { invalidate: vi.fn() } }, progress: { get: { invalidate: vi.fn() } } }),
  flashcards: { toggleFavorite: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) }, markReviewed: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } },
} }));

describe("premium interface rendering and accessibility", () => {
  it("keeps semantic cards and ordinary keyboard-accessible links", () => {
    const html = renderToStaticMarkup(h(AnimatedCard, { as: "section", tilt: true, children: h("a", { href: "/course/7" }, "Networking") }));
    expect(html).toContain("<section"); expect(html).toContain('href="/course/7"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('role="button"');
  });
  it("exposes exact backend values to assistive technology during count animation", () => {
    expect(renderToStaticMarkup(h(AnimatedStatValue, { value: "82.5%" }))).toContain('aria-label="82.5%"');
    expect(renderToStaticMarkup(h(AnimatedStatValue, { value: "—" }))).toBe("—");
  });
  it("uses unique progress gradients and accessible current progress", () => {
    const html = renderToStaticMarkup(h("div", null, h(AnimatedProgressRing, { value: 40 }), h(AnimatedProgressRing, { value: 80 })));
    const ids = [...html.matchAll(/linearGradient id="([^"]+)"/g)].map(match => match[1]);
    expect(new Set(ids).size).toBe(2);
    const ring = renderToStaticMarkup(h(StudentRing, { value: 72, label: "Course progress" }));
    expect(ring).toContain('aria-valuenow="72"'); expect(ring).toContain('aria-label="Course progress"');
    const bar = renderToStaticMarkup(h(Progress, { value: 35, "aria-label": "Quiz progress" }));
    expect(bar).toContain('aria-valuenow="35"');
  });
  it("preserves resource actions and actual course counts", () => {
    const material = renderToStaticMarkup(h(Router, { ssrPath: "/", children: h(MaterialTile, { doc: { id: 7, title: "Networking & OSI", fileName: "notes.docx", fileUrl: "/uploads/notes.docx", fileSize: 2048 } }) }));
    expect(material).toContain('href="/document/7"'); expect(material).toContain("Networking &amp; OSI");
    expect(material).toContain("More options for Networking");
    const header = renderToStaticMarkup(h(CourseHeader, { course: { title: "Networking", code: "NET101", subject: "Computing", description: "Course description", coverImageUrl: null, lecturerName: "Lecturer", progressPct: 37 }, counts: { materials: 3, quizzes: 2, assignments: 1 } }));
    expect(header).toContain("37%"); expect(header).toContain('aria-label="3"');
  });
  it("retains Radix tab roles and hides inactive content", () => {
    const html = renderToStaticMarkup(h(Tabs, { defaultValue: "notes" }, h(TabsList, null, h(TabsTrigger, { value: "notes" }, "Notes"), h(TabsTrigger, { value: "quiz" }, "Quiz")), h(TabsContent, { value: "notes" }, "Active notes"), h(TabsContent, { value: "quiz" }, "Inactive quiz")));
    expect(html).toContain('role="tablist"'); expect(html).toContain('role="tabpanel"');
    expect(html).toContain("Active notes"); expect(html).not.toContain("Inactive quiz");
  });
  it("provides a static orb before visibility and distinguishes real request states", () => {
    const idle = renderToStaticMarkup(h(AIOrb3D));
    expect(idle).toContain('data-animate="false"'); expect(idle).toContain('aria-hidden="true"');
    const thinking = renderToStaticMarkup(h(AIOrb3D, { thinking: true }));
    expect(thinking).toContain("ai-orb--thinking");
    const loading = renderToStaticMarkup(h(AIChatBox, { messages: [{ role: "user", content: "My question" }], onSendMessage: () => undefined, isLoading: true, isGenerating: false }));
    expect(loading).toContain("Loading conversation"); expect(loading).not.toContain("Working on your request");
  });
  it("makes the flashcard focusable and exposes only the question face initially", () => {
    const html = renderToStaticMarkup(h(FlashcardComponent, { card: { id: 5, question: "What is a network?", answer: "Connected devices", isFavorite: false, reviewCount: 2 } as Flashcard }));
    expect(html).toContain('role="button"'); expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="Reveal answer"'); expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('aria-label="Add to favorites"');
  });
});
