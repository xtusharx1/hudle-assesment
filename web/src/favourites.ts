export function favouriteIds(value: string | null): number[] {
  try {
    const parsed: unknown = JSON.parse(value || "[]");
    if (!Array.isArray(parsed)) return [];
    return [
      ...new Set(
        parsed.filter((id): id is number => Number.isSafeInteger(id) && id > 0),
      ),
    ];
  } catch {
    return [];
  }
}
