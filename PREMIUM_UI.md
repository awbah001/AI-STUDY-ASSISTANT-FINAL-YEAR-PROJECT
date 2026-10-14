# Cognify premium motion implementation

The existing React, Wouter, Tailwind/CSS and tRPC application now uses a shared motion system. This implementation preserves the existing routes, API contracts, authorization, and data calculations. It adds presentation behavior to the existing portals rather than replacing their screens.

## Completed

- Course workspace: refined forest/emerald/mint surfaces, course header entrance, SVG progress ring, real animated counts, resource-card lighting and restrained spring tilt, 50 ms resource staggering, and tab transitions. Course tabs support arrow keys, Home and End and retain all materials, announcements, assignments, quizzes, examinations and discussions.
- Student dashboard and course list: selected cards use gentle perspective and elevation; numeric statistics and streak totals animate from actual server values. Page transitions preserve component state.
- Shared navigation: animated active indicator, icon hover feedback, desktop compact-sidebar toggle, accessible icon labels, and existing mobile navigation. The account menu and sign-out remain available.
- Ask AI and document chat: lazy-loaded CSS 3D orb, static Suspense fallback, real generation/loading/listening states, typing dots, chat entrances, focus treatment and suggestion interactions. The orb is decorative and cannot obstruct chat controls.
- Flashcards and quizzes: spring-based front/back flips, Enter/Space support and visible focus, hidden-face accessibility attributes, animated review-answer reveal, selected-answer feedback and reduced-motion question/result transitions.
- Progress and lecturer portal: shared animated SVG rings and progress bars, animated lecturer statistics, restrained shared page styling, and 650 ms chart transitions with reduced-motion support. Large tables do not receive cursor tilt.
- Shared Radix tabs, dialogs and collapsible sections retain their existing semantics and controls with restrained transitions.

## Performance and accessibility

The implementation reuses the installed `framer-motion` package. **No dependencies were installed.** CSS perspective and geometry provide the requested 3D-inspired illustration without Three.js, React Three Fiber, GSAP or a WebGL requirement.

The orb is a separate lazy-loaded production chunk (2,657 bytes minified in the verified build). Continuous orb animation stops when offscreen, when the browser tab is hidden, when reduced motion is requested, or when the device reports four or fewer logical CPU cores. CPU count is a conservative heuristic, not a device performance benchmark. Touch interactions do not apply mouse tilt. Motion values update transforms without React rendering on every pointer movement. Statistic animation exposes the exact current server value through an accessible label.

`MotionConfig` and explicit reduced-motion checks disable spatial movement. CSS decorative animation follows the same preference. Rings and the orb reserve their size; navigation transitions do not introduce artificial loading delays. Browser frame rate and layout stability measurements remain unverified.

## Files added

- `client/src/components/motion/AnimatedCard.tsx` — shared springs, entrances, selective tilt and lighting.
- `client/src/components/motion/AnimatedPage.tsx` — page/content transitions without remounting state.
- `client/src/components/motion/AnimatedProgress.tsx` — shared SVG ring with unique gradient IDs.
- `client/src/components/motion/AnimatedStatValue.tsx` — real-value count animation.
- `client/src/components/motion/AIOrb3D.tsx` — state-responsive orb and animation gating.
- `client/src/premium.css` — surfaces, depth, orb geometry, compact navigation and shared transitions.
- `server/uiMotion.test.ts` — seven UI rendering and accessibility regression checks.

## Files modified

- `client/src/main.tsx` and `client/src/motion.css` — global motion preference and stylesheet integration; avoid duplicate card animation.
- `client/src/components/student/CoursePage.tsx`, `client/src/pages/student/StudentPortal.tsx`, `client/src/components/StudentUi.tsx` — student/course presentation and progress.
- `client/src/components/DashboardLayout.tsx` — shared navigation and page transitions.
- `client/src/components/AIChatBox.tsx`, `client/src/components/DocumentChatBox.tsx` — AI presentation and actual pending-request state.
- `client/src/components/FlashcardComponent.tsx`, `client/src/pages/student/FlashcardReview.tsx`, `client/src/components/QuizComponent.tsx` — study interactions.
- `client/src/components/ui/progress.tsx`, `client/src/components/ui/tabs.tsx` — shared accessible primitives.
- `client/src/components/lecturer/LecturerUi.tsx`, `client/src/components/lecturer/EngagementChart.tsx`, `client/src/pages/lecturer/LecturerAnalytics.tsx` — lecturer statistics and chart motion preferences.
- `vitest.config.ts` — automatic JSX transform matching the application runtime for component-rendering tests.

Backend business logic and the mobile application were not changed for this visual task. The workspace also contains changes from earlier work; those are outside this report.

## Verification

- `npm run check` — passed after the final source edits.
- `npm run build:web` — passed. Vite still reports chunks over 500 KB; the main application chunk is approximately 2.48 MB minified, so broader application bundle optimization remains separate work.
- `npm run test -- server/uiMotion.test.ts server/chat.agent.test.ts server/documentPreview.test.ts server/calendar.test.ts server/studentPresentation.test.ts` — 51 tests passed across five files. Coverage includes semantic cards, exact accessible values, gradient uniqueness, progress attributes, resource actions, tab roles, static orb state, actual loading states, flashcard controls, existing AI response contract, previews and timetable behavior.

Live browser visual inspection, pointer interaction, responsive device checks and measured frame rate could not be performed: the computer-use tool reported no connected browsers and rejected opening the in-app browser as unavailable. Rendering tests establish markup and contract behavior; they do not replace those browser checks.
