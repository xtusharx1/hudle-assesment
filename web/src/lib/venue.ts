export function venueAmenities(value: unknown): string[] {
  try {
    const items: unknown =
      typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(items)
      ? items.filter(
          (item): item is string =>
            typeof item === "string" && item.trim().length > 0,
        )
      : [];
  } catch {
    return [];
  }
}
