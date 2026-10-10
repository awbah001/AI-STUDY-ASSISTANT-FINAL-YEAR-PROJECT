export const QUIZ_LENGTHS = [3, 5, 8, 10, 15, 20];
const key = (userId: number) => `cognify.lecturer.${userId}.quizLength`;
export function getLecturerQuizLength(userId?: number) {
  if (!userId) return 5;
  try {
    const value = Number(localStorage.getItem(key(userId)));
    return QUIZ_LENGTHS.includes(value) ? value : 5;
  } catch { return 5; }
}
export function saveLecturerQuizLength(userId: number, value: number) {
  if (!QUIZ_LENGTHS.includes(value)) throw new Error("Invalid quiz length");
  localStorage.setItem(key(userId), String(value));
}
