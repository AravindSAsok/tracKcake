export type TrackCakeImportEntry = { name: string; amount: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; meal_type: "breakfast" | "lunch" | "dinner" | "snack"; time: string };
export type TrackCakeFoodLog = { date: string; entries: TrackCakeImportEntry[] };
export function parseTrackCakeFoodLog(input: string): TrackCakeFoodLog | null;
