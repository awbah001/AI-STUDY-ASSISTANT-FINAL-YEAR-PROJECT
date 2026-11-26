import { test, expect, type Page } from "@playwright/test";
import superjson from "superjson";

// Deterministic UI integration: real screens and navigation, synthetic API data.
// Backend authorization, source validation, and persistence are tested separately.
const user = { id: 1, openId: "fixture-student", role: "user", name: "Test Student", email: "student@central.edu.sl", avatarUrl: null };
const course = { id: 4, title: "Biology 101", code: "BIO101", subject: "Biology", lecturerName: "Test Lecturer", progressPct: 25, description: "Cell biology", isActive: true };
const doc = { id: 5, userId: 7, courseId: 4, title: "Lecture notes", fileName: "lecture.txt", fileUrl: "/uploads/7/documents/lecture.txt", fileSize: 100, mimeType: "text/plain", extractedText: "Photosynthesis converts light energy into chemical energy.", processingStatus: "completed", createdAt: new Date("2026-01-01") };
const card = { id: 8, question: "What does photosynthesis convert?", answer: "Light energy into chemical energy.", isFavorite: false };

test.beforeEach(async ({ page }) => { page.on("pageerror", error => console.error("Browser error:", error.message)); });

async function fixtureApi(page: Page, options: { signedIn?: boolean; slow?: boolean; denied?: boolean; disconnected?: () => boolean } = {}) {
  let signedIn = options.signedIn ?? false;
  let rated = false;
  await page.route("**/api/trpc/**", async route => {
    const url = new URL(route.request().url());
    const methods = decodeURIComponent(url.pathname.split("/api/trpc/")[1]).split(",");
    if (methods.includes("documents.get") && options.disconnected?.()) { await route.abort("internetdisconnected"); return; }
    if (options.slow) await new Promise(resolve => setTimeout(resolve, 900));
    const values = methods.map(method => {
      if (method === "documents.get" && options.denied) return { error: { json: { message: "Material unavailable.", code: -32004, data: { code: "NOT_FOUND", httpStatus: 404 } } } };
      let value: unknown = [];
      switch (method) {
        case "auth.me": value = signedIn ? user : null; break;
        case "auth.login": signedIn = true; value = { token: "synthetic-fixture-token", user }; break;
        case "studentLearning.onboardingStatus": value = { completed: true }; break;
        case "studentLearning.dashboard": value = { student: user, progress: { courses: 1, quizAccuracy: 80, streak: 2, studyMinutes: 30, completedPct: 25 }, today: [], upcoming: [], continueLearning: { href: "/course/4" } }; break;
        case "studentCourses.list": value = [course]; break;
        case "discussions.list": value = { threads: [], canModerate: false }; break;
        case "studentCourses.materials": case "documents.list": value = [doc]; break;
        case "documents.get": value = doc; break;
        case "documents.preview": value = null; break;
        case "chat.send": value = { userMessage: "Explain photosynthesis", aiResponse: "Photosynthesis converts light energy into chemical energy. [Source: Lecture notes, page 1](/document/5?source=aaaaaaaaaaaaaaaaaaaaaaaa)" }; break;
        case "flashcards.due": value = rated ? [] : [card]; break;
        case "flashcards.list": value = [card]; break;
        case "flashcards.rateCard": rated = true; value = { success: true }; break;
        case "studentLearning.recordActivity": value = { success: true }; break;
        case "admin.settings.preferences": value = {}; break;
        case "summary.get": case "progress.get": value = null; break;
      }
      return { result: { data: superjson.serialize(value) } };
    });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(url.searchParams.has("batch") ? values : values[0]) });
  });
}

test("student signs in, reads course material, asks a sourced question, and reviews a card", async ({ page }) => {
  await fixtureApi(page);
  await page.goto("/login");
  await page.getByLabel("Email address", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("Synthetic-test-password-1!");
  await page.getByRole("button", { name: /^Sign in$/i }).click();
  await expect(page).toHaveURL(/student\/dashboard/);
  await page.getByRole("link", { name: /Continue learning/i }).click();
  await page.getByRole("link", { name: "Lecture notes", exact: true }).first().click();
  await expect(page.getByText(doc.extractedText, { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Ask about document" }).click();
  await page.getByLabel("Answer sources").selectOption("document");
  await page.getByPlaceholder(/Ask the AI anything/).fill("Explain photosynthesis");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByRole("link", { name: "Source: Lecture notes, page 1" })).toBeVisible();
  await page.getByRole("tab", { name: "Flashcards", exact: true }).click();
  await page.getByRole("button", { name: "Show answer", exact: true }).click();
  await expect(page.getByText(card.answer, { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Good", exact: true }).click();
  await expect(page.getByText(/All caught up|reviewed/i).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("shows loading and recovers on a slow connection", async ({ page }) => {
  await fixtureApi(page, { signedIn: true, slow: true });
  await page.goto("/student/library");
  await expect(page.getByRole("status").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Open workspace" })).toBeVisible({ timeout: 20_000 });
});

test("shows a retryable denied-material error without rendering document content", async ({ page }) => {
  await fixtureApi(page, { signedIn: true, denied: true });
  await page.goto("/document/5");
  await expect(page.getByRole("alert").filter({ hasText: "Material unavailable." })).toBeVisible();
  await expect(page.getByText(doc.extractedText, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("recovers a document after a connection failure", async ({ page }) => {
  let disconnected = true;
  await fixtureApi(page, { signedIn: true, disconnected: () => disconnected });
  await page.goto("/document/5");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible({ timeout: 20_000 });
  disconnected = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText(doc.extractedText, { exact: true })).toBeVisible();
});


test("student dashboard adapts to 375px and navigation traps and restores keyboard focus", async ({ page }, testInfo) => {
  await fixtureApi(page, { signedIn: true });
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
  for (const theme of ["light", "dark"]) {
    for (const width of [375, 820, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/student/dashboard");
      await expect(page.getByRole("heading", { name: "Test Student", exact: true })).toBeVisible();
      if (theme === "dark") await page.getByRole("button", { name: "Toggle theme" }).click();
      await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*dark)/);
      await expect(page.getByRole("link", { name: /Continue learning/i })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      const actionContrast = await page.locator(".student-hero .student-go").evaluate(node => {
        const style = getComputedStyle(node);
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const context = canvas.getContext("2d")!;
        const luminance = (color: string) => {
          context.clearRect(0, 0, 1, 1);
          context.fillStyle = color; context.fillRect(0, 0, 1, 1);
          const rgb = Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4);
          return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
        };
        const values = [luminance(style.color), luminance(style.backgroundColor)].sort((a, b) => a - b);
        return (values[1] + .05) / (values[0] + .05);
      });
      expect(actionContrast).toBeGreaterThanOrEqual(4.5);
      if (width === 375) {
        const open = page.getByRole("button", { name: "Open navigation", exact: true });
        await open.click();
        const drawer = page.getByRole("dialog", { name: "Workspace navigation" });
        await expect(drawer).toBeVisible();
        await expect(page.getByRole("button", { name: "Close navigation" })).toBeFocused();
        await page.keyboard.press("Shift+Tab");
        await expect(page.getByRole("button", { name: "Sign out" })).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(page.getByRole("button", { name: "Close navigation" })).toBeFocused();
        await page.keyboard.press("Escape");
        await expect(open).toBeFocused();
        await expect(drawer).toHaveCount(0);
      }
      await page.screenshot({ path: testInfo.outputPath(`dashboard-${theme}-${width}.png`), fullPage: true });
    }
  }
});
