/** Display and persist chat oldest → newest. Auto-increment id is the insertion order. */
export function oldestFirstById<T extends { id: number }>(items: T[] | null | undefined): T[] {
  return [...(items ?? [])].sort((a, b) => a.id - b.id);
}
