import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type EntrySource = "ai" | "manual";
export type StorageMode = "local" | "cloud";

export interface FoodEntry {
  id: string;
  name: string;
  amount: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meal_type: MealType;
  eaten_at: string;
  source: EntrySource;
}

export interface TrackerData {
  entries: FoodEntry[];
  goal: number;
  mode: StorageMode;
  message?: string;
}

interface FoodEntryRow extends FoodEntry {
  user_id: string;
}

const ENTRIES_KEY = "trackcake.entries.v1";
const GOAL_KEY = "trackcake.goal.v1";
const DEFAULT_GOAL = 2000;

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY?.trim();
const cloudConfigured = Boolean(supabaseUrl && supabaseAnonKey);

let supabase: SupabaseClient | null = null;
let userId: string | null = null;
let cloudReady = false;
let storageMode: StorageMode = "local";

function readLocalEntries(): FoodEntry[] {
  try {
    const raw = localStorage.getItem(ENTRIES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((entry): entry is FoodEntry => {
      if (entry === null || typeof entry !== "object") return false;
      const row = entry as Record<string, unknown>;
      return typeof row.id === "string" &&
        typeof row.name === "string" &&
        typeof row.eaten_at === "string" &&
        Number.isFinite(Number(row.calories));
    });
  } catch {
    return [];
  }
}

function readLocalGoal(): number {
  try {
    const value = Number(localStorage.getItem(GOAL_KEY));
    return Number.isInteger(value) && value >= 500 && value <= 10000
      ? value
      : DEFAULT_GOAL;
  } catch {
    return DEFAULT_GOAL;
  }
}

function writeLocal(entries: FoodEntry[], goal?: number): void {
  try {
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
    if (typeof goal === "number") localStorage.setItem(GOAL_KEY, String(goal));
  } catch {
    throw new Error("This browser could not save your diary. Check available storage space or browser privacy settings.");
  }
}

function normalizeRow(row: Record<string, unknown>): FoodEntry {
  return {
    id: String(row.id),
    name: String(row.name),
    amount: String(row.amount),
    calories: Number(row.calories) || 0,
    protein_g: Number(row.protein_g) || 0,
    carbs_g: Number(row.carbs_g) || 0,
    fat_g: Number(row.fat_g) || 0,
    meal_type: (row.meal_type as MealType) || "snack",
    eaten_at: String(row.eaten_at),
    source: row.source === "ai" ? "ai" : "manual"
  };
}

function toRow(entry: FoodEntry): FoodEntryRow {
  if (!userId) throw new Error("Your cloud session is not ready.");
  return { ...entry, user_id: userId };
}

async function ensureCloud(): Promise<SupabaseClient | null> {
  if (!cloudConfigured || !supabaseUrl || !supabaseAnonKey) return null;
  if (cloudReady && supabase) return supabase;

  supabase ??= createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  userId = sessionData.session?.user.id ?? null;

  if (!userId) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    userId = data.user?.id ?? null;
  }

  if (!userId) throw new Error("Supabase did not create a user session.");

  cloudReady = true;
  storageMode = "cloud";
  return supabase;
}

export async function loadTrackerData(): Promise<TrackerData> {
  const localEntries = readLocalEntries();
  const localGoal = readLocalGoal();

  if (!cloudConfigured) {
    storageMode = "local";
    return { entries: localEntries, goal: localGoal, mode: "local" };
  }

  try {
    const client = await ensureCloud();
    if (!client || !userId) {
      return { entries: localEntries, goal: localGoal, mode: "local" };
    }

    const [entriesResult, settingsResult] = await Promise.all([
      client
        .from("food_entries")
        .select("id,name,amount,calories,protein_g,carbs_g,fat_g,meal_type,eaten_at,source")
        .order("eaten_at", { ascending: false })
        .limit(500),
      client
        .from("tracker_settings")
        .select("calorie_goal")
        .eq("user_id", userId)
        .maybeSingle()
    ]);

    if (entriesResult.error) throw entriesResult.error;
    if (settingsResult.error) throw settingsResult.error;

    let remoteEntries = (entriesResult.data ?? []).map((row) =>
      normalizeRow(row as Record<string, unknown>)
    );

    // First-time cloud setup: import this browser's diary using fresh IDs.
    // Local IDs may belong to another account, so never upsert them into this user's rows.
    if (remoteEntries.length === 0 && localEntries.length > 0) {
      const importedEntries = localEntries.map((entry) => ({
        ...entry,
        id: crypto.randomUUID()
      }));
      const { error } = await client.from("food_entries").insert(
        importedEntries.map(toRow)
      );
      if (error) throw error;
      remoteEntries = importedEntries;
    }

    let goal = Number(settingsResult.data?.calorie_goal);
    if (!Number.isInteger(goal) || goal < 500 || goal > 10000) {
      goal = localGoal;
      const { error } = await client.from("tracker_settings").upsert({
        user_id: userId,
        calorie_goal: goal
      }, { onConflict: "user_id" });
      if (error) throw error;
    }

    writeLocal(remoteEntries, goal);
    storageMode = "cloud";
    return { entries: remoteEntries, goal, mode: "cloud" };
  } catch (error) {
    cloudReady = false;
    storageMode = "local";
    console.warn("Cloud storage unavailable; using local diary.", error);
    return {
      entries: localEntries,
      goal: localGoal,
      mode: "local",
      message: "Cloud storage is not ready. Your diary is saved on this device for now."
    };
  }
}

export interface HistoryPage {
  entries: FoodEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export async function fetchHistoryPage(options: {
  page: number;
  pageSize?: number;
  date?: string;
  search?: string;
}): Promise<HistoryPage> {
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
  const page = Math.max(1, Math.floor(options.page));
  const search = (options.search ?? "").trim().replace(/[%,()]/g, " ").replace(/\\s+/g, " ").trim();

  const client = await ensureCloud();
  if (!client || !userId) {
    let local = readLocalEntries();
    if (options.date) local = local.filter((entry) => {
      const date = new Date(entry.eaten_at);
      const offset = date.getTimezoneOffset() * 60_000;
      return new Date(date.getTime() - offset).toISOString().slice(0, 10) === options.date;
    });
    if (search) {
      const term = search.toLocaleLowerCase();
      local = local.filter((entry) => [entry.name, entry.amount, entry.meal_type].some((value) => value.toLocaleLowerCase().includes(term)));
    }
    local.sort((a, b) => b.eaten_at.localeCompare(a.eaten_at) || b.id.localeCompare(a.id));
    const start = (page - 1) * pageSize;
    return { entries: local.slice(start, start + pageSize), total: local.length, page, pageSize };
  }

  let query = client
    .from("food_entries")
    .select("id,name,amount,calories,protein_g,carbs_g,fat_g,meal_type,eaten_at,source", { count: "exact" });

  if (options.date) {
    const start = new Date(options.date + "T00:00:00");
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    query = query.gte("eaten_at", start.toISOString()).lt("eaten_at", end.toISOString());
  }
  if (search) {
    const pattern = "%" + search + "%";
    query = query.or("name.ilike." + pattern + ",amount.ilike." + pattern + ",meal_type.ilike." + pattern);
  }

  const from = (page - 1) * pageSize;
  const { data, count, error } = await query
    .order("eaten_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) throw error;
  return {
    entries: (data ?? []).map((row) => normalizeRow(row as Record<string, unknown>)),
    total: count ?? 0,
    page,
    pageSize
  };
}

export async function addEntry(entry: FoodEntry): Promise<string | undefined> {
  const entries = [entry, ...readLocalEntries()];
  writeLocal(entries);

  if (!cloudConfigured) return;
  try {
    const client = await ensureCloud();
    if (!client || !userId) throw new Error("Your cloud session is not ready.");
    const { error } = await client.from("food_entries").insert(toRow(entry));
    if (error) throw error;
  } catch (error) {
    cloudReady = false;
    storageMode = "local";
    const detail = error instanceof Error ? error.message : "Unknown cloud error";
    console.warn("Food entry was saved locally but cloud sync failed.", error);
    return "Saved on this device only. Cloud sync failed: " + detail;
  }
}

export async function updateEntry(entry: FoodEntry): Promise<string | undefined> {
  const entries = readLocalEntries().map((current) => current.id === entry.id ? entry : current);
  writeLocal(entries);

  if (!cloudConfigured) return;
  try {
    const client = await ensureCloud();
    if (!client || !userId) throw new Error("Your cloud session is not ready.");
    const { error } = await client.from("food_entries").update(toRow(entry)).eq("id", entry.id).eq("user_id", userId);
    if (error) throw error;
  } catch (error) {
    cloudReady = false;
    storageMode = "local";
    const detail = error instanceof Error ? error.message : "Unknown cloud error";
    console.warn("Food edit was saved locally but cloud sync failed.", error);
    return "Saved on this device only. Cloud sync failed: " + detail;
  }
}

export async function deleteEntry(id: string): Promise<string | undefined> {
  const entries = readLocalEntries().filter((entry) => entry.id !== id);
  writeLocal(entries);

  if (!cloudConfigured) return;
  try {
    const client = await ensureCloud();
    if (!client || !userId) throw new Error("Your cloud session is not ready.");
    const { error } = await client.from("food_entries").delete().eq("id", id).eq("user_id", userId);
    if (error) throw error;
  } catch (error) {
    cloudReady = false;
    storageMode = "local";
    const detail = error instanceof Error ? error.message : "Unknown cloud error";
    console.warn("Food deletion was saved locally but cloud sync failed.", error);
    return "Deleted on this device only. Cloud sync failed: " + detail;
  }
}

export async function saveGoal(goal: number): Promise<string | undefined> {
  if (!Number.isInteger(goal) || goal < 500 || goal > 10000) {
    throw new Error("Choose a daily goal between 500 and 10,000 kcal.");
  }

  writeLocal(readLocalEntries(), goal);

  if (!cloudConfigured) return;
  try {
    const client = await ensureCloud();
    if (!client || !userId) throw new Error("Your cloud session is not ready.");
    const { error } = await client.from("tracker_settings").upsert({
      user_id: userId,
      calorie_goal: goal,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });
    if (error) throw error;
  } catch (error) {
    cloudReady = false;
    storageMode = "local";
    const detail = error instanceof Error ? error.message : "Unknown cloud error";
    console.warn("Calorie goal was saved locally but cloud sync failed.", error);
    return "Saved on this device only. Cloud sync failed: " + detail;
  }
}

export function getStorageMode(): StorageMode {
  return storageMode;
}

export const DEFAULT_CALORIE_GOAL = DEFAULT_GOAL;
