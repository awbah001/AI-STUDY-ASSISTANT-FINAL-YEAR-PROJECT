import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useReducedMotion } from "framer-motion";

type CourseEngagement = { courseId: number; courseTitle: string; studentCount: number; avgEngagement: number };

/** Activity points per student: quizzes ×30, flashcards ×20, AI chats ×5, study minutes ×0.5. */
export const ENGAGEMENT_HINT = "Average activity points per student from quizzes, flashcards, AI chats and study time";

const shortTitle = (title: string) => (title.length > 18 ? `${title.slice(0, 17)}…` : title);

export function EngagementChart({ data, color }: { data: CourseEngagement[]; color: string }) {
  const reducedMotion = useReducedMotion();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 6" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="courseTitle"
          tickFormatter={shortTitle}
          interval={0}
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickLine={false}
          axisLine={{ stroke: "#e2e8f0" }}
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
          contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
          formatter={(value, _name, item) => {
            const students = (item.payload as CourseEngagement).studentCount;
            return [`${value} points · ${students} student${students === 1 ? "" : "s"}`, "Avg engagement"];
          }}
        />
        <Bar dataKey="avgEngagement" fill={color} radius={[8, 8, 0, 0]} maxBarSize={56} name="Avg engagement" isAnimationActive={!reducedMotion} animationDuration={650} />
      </BarChart>
    </ResponsiveContainer>
  );
}
