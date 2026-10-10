import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const QUIZ_LENGTHS = [3, 5, 8, 10, 15, 20];
export const DEFAULT_QUIZ_LENGTH = 5;

const key = (userId: number) => `cognify.lecturer.${userId}.quizLength`;

export async function getLecturerQuizLength(userId?: number | null): Promise<number> {
  if (!userId) return DEFAULT_QUIZ_LENGTH;
  try {
    const value = Number(await AsyncStorage.getItem(key(userId)));
    return QUIZ_LENGTHS.includes(value) ? value : DEFAULT_QUIZ_LENGTH;
  } catch {
    return DEFAULT_QUIZ_LENGTH;
  }
}

export async function saveLecturerQuizLength(userId: number, value: number): Promise<void> {
  if (!QUIZ_LENGTHS.includes(value)) throw new Error("Invalid quiz length");
  await AsyncStorage.setItem(key(userId), String(value));
}

/** Loads the saved default quiz length for a lecturer; `loaded` is false until storage has been read. */
export function useLecturerQuizLength(userId?: number | null) {
  const [quizLength, setQuizLength] = useState(DEFAULT_QUIZ_LENGTH);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    setLoaded(false);
    void getLecturerQuizLength(userId).then((value) => {
      if (!active) return;
      setQuizLength(value);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const save = useCallback(
    async (value: number) => {
      if (!userId) throw new Error("Not signed in");
      await saveLecturerQuizLength(userId, value);
      setQuizLength(value);
    },
    [userId]
  );

  return { quizLength, loaded, save };
}
