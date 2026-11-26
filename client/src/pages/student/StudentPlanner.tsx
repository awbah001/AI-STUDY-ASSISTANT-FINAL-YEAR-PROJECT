import { useState } from "react";

import { toast } from "sonner";

import { trpc } from "@/lib/trpc";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { validateFutureDate, validateNumber, validateText } from "@shared/validation";
import { FieldError } from "@/components/FieldError";
import { useFieldErrors } from "@/lib/formValidation";

import { StudentRing } from "@/components/StudentUi";

import { Layers } from "lucide-react";

import { Box, State, Go, Empty, grid, fail } from "./workspaceShared";
export default function Planner() {
  const query = trpc.planner.today.useQuery();
  const utils = trpc.useUtils();
  const { errors, check, clear } = useFieldErrors<
    "minutes" | "cards" | "quizzes" | "eventTitle" | "eventDate" | "eventNotes" | "planMessage"
  >();
  const [month, setMonth] = useState(() =>
    new Date().toISOString().slice(0, 7)
  );
  const [year, m] = month.split("-").map(Number);
  const calendar = trpc.planner.calendar.useQuery({
    from: new Date(year, m - 1, 1).getTime(),
    to: new Date(year, m, 0, 23, 59, 59).getTime(),
  });
  const refresh = () => utils.planner.invalidate();
  const goal = trpc.planner.updateGoal.useMutation({
    onSuccess: () => {
      void refresh();
      toast.success("Goals saved");
    },
    onError: fail,
  });
  const create = trpc.planner.createEvent.useMutation({
    onSuccess: refresh,
    onError: fail,
  });
  const remove = trpc.planner.deleteEvent.useMutation({
    onSuccess: refresh,
    onError: fail,
  });
  const generate = trpc.planner.generatePlan.useMutation({
    onSuccess: result => {
      void refresh();
      toast.success(`${result.created} study events added`);
    },
    onError: fail,
  });
  return (
    <div className="student-planner-grid">
      <State query={query} />
      {query.data && (
        <Box title="Daily study goals">
          <p>
            {query.data.completedMinutes} minutes studied today ·{" "}
            {query.data.completedQuizzes} quizzes completed ·{" "}
            {query.data.dueFlashcards} flashcards due
          </p>
          <form
            key={JSON.stringify(query.data.goal)}
            className="flex flex-wrap items-end gap-4"
            onSubmit={e => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const ok = check({
                minutes: validateNumber(String(f.get("minutes") ?? ""), { label: "Study minutes", min: 5, max: 480, integer: true }),
                cards: validateNumber(String(f.get("cards") ?? ""), { label: "Flashcards", min: 1, max: 100, integer: true }),
                quizzes: validateNumber(String(f.get("quizzes") ?? ""), { label: "Quizzes", min: 1, max: 20, integer: true }),
              });
              if (!ok) return;
              goal.mutate({
                dailyStudyMinutes: Number(f.get("minutes")),
                dailyFlashcards: Number(f.get("cards")),
                dailyQuizzes: Number(f.get("quizzes")),
              });
            }}
            noValidate
          >
            {[
              [
                "minutes",
                "Study minutes",
                5,
                480,
                query.data.goal.dailyStudyMinutes,
              ],
              ["cards", "Flashcards", 1, 100, query.data.goal.dailyFlashcards],
              ["quizzes", "Quizzes", 1, 20, query.data.goal.dailyQuizzes],
            ].map(([name, label, min, max, value]) => {
              const key = name as "minutes" | "cards" | "quizzes";
              return (
                <label key={key} className="space-y-1.5">
                  {label}
                  <Input
                    name={key}
                    className="mt-2 w-32"
                    type="number"
                    inputMode="numeric"
                    min={Number(min)}
                    max={Number(max)}
                    defaultValue={value}
                    aria-invalid={Boolean(errors[key])}
                    onChange={() => clear(key)}
                  />
                  <FieldError message={errors[key]} className="max-w-40" />
                </label>
              );
            })}
            <Button variant="accent" disabled={goal.isPending}>Save goals</Button>
          </form>
        </Box>
      )}
      {query.data && (
        <Box title="Today's progress">
          <div className="student-today-rings">
            <div>
              <StudentRing
                value={
                  (query.data.completedMinutes /
                    query.data.goal.dailyStudyMinutes) *
                  100
                }
              />
              <h3>Study minutes</h3>
              <p>
                {query.data.completedMinutes} /{" "}
                {query.data.goal.dailyStudyMinutes} min
              </p>
            </div>
            <div>
              <StudentRing
                value={
                  (query.data.completedQuizzes / query.data.goal.dailyQuizzes) *
                  100
                }
              />
              <h3>Quizzes</h3>
              <p>
                {query.data.completedQuizzes} / {query.data.goal.dailyQuizzes}{" "}
                quizzes
              </p>
            </div>
            <div>
              <span className="student-icon">
                <Layers />
              </span>
              <h3>Flashcards due</h3>
              <p>{query.data.dueFlashcards} cards</p>
            </div>
          </div>
        </Box>
      )}
      <Box title="Today's tasks">
        {query.data?.tasks.map(t => (
          <div key={t.id} className="flex flex-wrap justify-between gap-3">
            <div>
              <p className="font-medium">{t.title}</p>
              <p className="text-sm text-muted-foreground">{t.detail}</p>
            </div>
            <Go href={t.href}>Start</Go>
          </div>
        ))}
        {query.data?.tasks.length === 0 && (
          <Empty>No pending tasks. Add a study session below.</Empty>
        )}
      </Box>
      <div className="student-planner-forms">
        <Box title="Add to your calendar">
          <form
            className="form-surface space-y-3"
            onSubmit={async e => {
              e.preventDefault();
              const form = e.currentTarget;
              const f = new FormData(form);
              const title = String(f.get("title") ?? "");
              const date = String(f.get("date") ?? "");
              const notes = String(f.get("notes") ?? "");
              const ok = check({
                eventTitle: validateText(title, { label: "Event title", min: 2, max: 160 }),
                eventDate: validateFutureDate(date, { label: "Date and time", required: true }),
                eventNotes: validateText(notes, { label: "Notes", required: false, max: 500 }),
              });
              if (!ok) return;
              try {
                await create.mutateAsync({
                  title: title.trim(),
                  type: String(f.get("type")) as "study",
                  startsAt: new Date(date).getTime(),
                  notes: notes.trim(),
                  reminderMinutes: 30,
                });
                form.reset();
                toast.success("Event added");
              } catch {}
            }}
          >
            <Input
              aria-label="Event title"
              name="title"
              placeholder="Event title"
              maxLength={160}
              aria-invalid={Boolean(errors.eventTitle)}
              onChange={() => clear("eventTitle")}
            />
            <FieldError message={errors.eventTitle} />
            <select
              aria-label="Event type"
              name="type"
              className="w-full rounded-lg border bg-background p-2"
            >
              {["study", "exam", "test", "quiz", "other"].map(t => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <Input
              aria-label="Event date and time"
              name="date"
              type="datetime-local"
              aria-invalid={Boolean(errors.eventDate)}
              onChange={() => clear("eventDate")}
            />
            <FieldError message={errors.eventDate} />
            <Textarea
              aria-label="Event notes"
              name="notes"
              placeholder="Notes (optional)"
              maxLength={500}
              aria-invalid={Boolean(errors.eventNotes)}
              onChange={() => clear("eventNotes")}
            />
            <FieldError message={errors.eventNotes} />
            <Button variant="accent" disabled={create.isPending}>Add event</Button>
          </form>
        </Box>
        <Box title="Plan with AI">
          <p className="student-muted">
            Get a personalized study plan based on your goals, upcoming
            deadlines, and learning style.
          </p>
          <form
            className="form-surface space-y-3"
            onSubmit={e => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const message = String(f.get("message") ?? "");
              const ok = check({
                planMessage: validateText(message, { label: "Your request", min: 8, max: 500 }),
              });
              if (ok) generate.mutate({ message: message.trim() });
            }}
          >
            <Textarea
              aria-label="Study plan request"
              name="message"
              placeholder="Plan three revision sessions for my biology exam next Friday..."
              maxLength={500}
              aria-invalid={Boolean(errors.planMessage)}
              onChange={() => clear("planMessage")}
            />
            <FieldError message={errors.planMessage} />
            <Button disabled={generate.isPending}>
              {generate.isPending ? "Planning..." : "Generate study plan"}
            </Button>
          </form>
        </Box>
      </div>
      <Box title="Calendar">
        <Input
          aria-label="Calendar month"
          className="max-w-xs"
          type="month"
          required
          value={month}
          onChange={e => {
            if (e.target.value) setMonth(e.target.value);
          }}
        />
        <State query={calendar} />
        {calendar.data?.events.map(event => (
          <div
            key={event.id}
            className="flex flex-wrap items-center justify-between gap-3 border-b pb-3"
          >
            <div>
              <p className="font-semibold">{event.title}</p>
              <p className="text-sm text-muted-foreground">
                {new Date(event.startsAt).toLocaleString()} · {event.type}
              </p>
              <p>{event.notes}</p>
            </div>
            <Button
              variant="outline"
              disabled={remove.isPending}
              onClick={() => {
                if (window.confirm(`Delete ${event.title}?`))
                  remove.mutate({ id: event.id });
              }}
            >
              Delete
            </Button>
          </div>
        ))}
        {calendar.data?.events.length === 0 && (
          <Empty>No events this month.</Empty>
        )}
      </Box>
    </div>
  );
}
