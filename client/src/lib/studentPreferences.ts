export type StudentPreferences = { quizLength: number; flashcardCount: number };
export const STUDENT_COUNTS = [5, 10, 15, 20];
export function getStudentPreferences(userId?: number): StudentPreferences {
  try {
    const value = JSON.parse(
      localStorage.getItem(`cognify.student.${userId}.learning`) || "{}"
    );
    return {
      quizLength: STUDENT_COUNTS.includes(value.quizLength)
        ? value.quizLength
        : 5,
      flashcardCount: STUDENT_COUNTS.includes(value.flashcardCount)
        ? value.flashcardCount
        : 5,
    };
  } catch {
    return { quizLength: 5, flashcardCount: 5 };
  }
}
export function saveStudentPreferences(
  userId: number,
  value: StudentPreferences
) {
  localStorage.setItem(
    `cognify.student.${userId}.learning`,
    JSON.stringify(value)
  );
}
