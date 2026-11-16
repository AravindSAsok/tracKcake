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
const PENDING_ENTRIES_KEY = "trackcake.pending-entries.v1";
const DEFAULT_GOAL = 2000;

function readPendingEntryIds(forUserId: string): string[] {
  try {
    const raw = localStorage.getItem(PENDING_ENTRIES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
    const rows = (parsed as Record<string, unknown>)[forUserId];
    return Array.isArray(rows) ? rows.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function readPendingEntries(forUserId: string): FoodEntry[] {
  const localById = new Map(readLocalEntries().map((entry) => [entry.id, entry]));
  return readPendingEntryIds(forUserId)
    .map((id) => localById.get(id))
    .filter((entry): entry is FoodEntry => Boolean(entry));
}

function writePendingEntryIds(forUserId: string, ids: string[]): void {
  const parsed: Record<string, unknown> = (() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(PENDING_ENTRIES_KEY) || "{}");
      return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  })();
  if (ids.length) parsed[forUserId] = ids;
  else delete parsed[forUserId];
  localStorage.setItem(PENDING_ENTRIES_KEY, JSON.stringify(parsed));
}

function rememberPendingEntry(forUserId: string, entry: FoodEntry): void {
  const pendingIds = readPendingEntryIds(forUserId);
  if (!pendingIds.includes(entry.id)) writePendingEntryIds(forUserId, [...pendingIds, entry.id]);
}

function forgetPendingEntry(forUserId: string, entryId: string): void {
  writePendingEntryIds(forUserId, readPendingEntryIds(forUserId).filter((id) => id !== entryId));
}

async function insertPendingEntry(client: SupabaseClient, forUserId: string, entry: FoodEntry): Promise<boolean> {
  const { error } = await client.from("food_entries").insert({ ...entry, user_id: forUserId });
  if (!error) return true;

  // A request may have reached Postgres even if the browser lost its response.
  // Treat a duplicate ID as synced only after confirming that exact row belongs to this user.
  if ((error as { code?: string }).code === "23505") {
    const { data, error: lookupError } = await client.from("food_entries")
      .select("id").eq("id", entry.id).eq("user_id", forUserId).maybeSingle();
    if (!lookupError && data) return true;
  }
  console.warn("Pending food entry is still waiting for cloud sync.", error);
  return false;
}

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

    // First-time cloud setup: import this browser's existing diary using fresh IDs.
    // Pending entries already belong to this account and must retain their original IDs.
    const pendingEntries = readPendingEntries(userId);
    const pendingIds = new Set(pendingEntries.map((entry) => entry.id));
    if (remoteEntries.length === 0 && localEntries.length > 0) {
      const importCandidates = localEntries.filter((entry) => !pendingIds.has(entry.id));
      if (importCandidates.length) {
        const importedEntries = importCandidates.map((entry) => ({
          ...entry,
          id: crypto.randomUUID()
        }));
        const { error } = await client.from("food_entries").insert(
          importedEntries.map(toRow)
        );
        if (error) throw error;
        remoteEntries = importedEntries;
      }
    }

    // Retry local-first saves that previously failed to reach Supabase.
    // Never replace a remote row: every new food is inserted with its own ID.
    const stillPending: FoodEntry[] = [];
    for (const pendingEntry of pendingEntries) {
      const synced = await insertPendingEntry(client, userId, pendingEntry);
      if (synced) forgetPendingEntry(userId, pendingEntry.id);
      else stillPending.push(pendingEntry);
    }
    // The initial remote read happened before these inserts, so keep every queued row
    // in this in-memory result even when its cloud retry just succeeded.
    const remoteIds = new Set(remoteEntries.map((entry) => entry.id));
    remoteEntries = [
      ...pendingEntries.filter((entry) => !remoteIds.has(entry.id)),
      ...remoteEntries
    ];

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
    storageMode = stillPending.length ? "local" : "cloud";
    return {
      entries: remoteEntries,
      goal,
      mode: stillPending.length ? "local" : "cloud",
      message: stillPending.length
        ? "Your food is safe on this device. TrackCake will retry cloud sync when your connection is available."
        : undefined
    };
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
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 10));
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

  // Some Supabase projects configure a low API max_rows value (for example 10).
  // Fetch the requested window in small, explicit ranges so one API response cap
  // cannot silently truncate a page or cause entries to be skipped between pages.
  const buildHistoryQuery = () => {
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
    return query;
  };

  const pendingEntries = userId ? readPendingEntries(userId) : [];
  const from = pendingEntries.length ? 0 : (page - 1) * pageSize;
  const to = pendingEntries.length ? page * pageSize + pendingEntries.length - 1 : from + pageSize - 1;
  const remoteRows: FoodEntry[] = [];
  let totalCount = 0;
  const chunkSize = 10;

  let chunkFrom = from;
  while (chunkFrom <= to) {
    const chunkTo = Math.min(to, chunkFrom + chunkSize - 1);
    const { data, count, error } = await buildHistoryQuery()
      .order("eaten_at", { ascending: false })
      .order("id", { ascending: false })
      .range(chunkFrom, chunkTo);

    if (error) throw error;
    if (chunkFrom === from) totalCount = count ?? 0;
    const chunkEntries = (data ?? []).map((row) => normalizeRow(row as Record<string, unknown>));
    if (chunkEntries.length === 0) break;
    remoteRows.push(...chunkEntries);
    // Advance by the number actually returned, not the requested range size.
    // This also handles projects whose max_rows setting is lower than 10.
    chunkFrom += chunkEntries.length;
  }

  const remoteEntries = remoteRows;
  if (!pendingEntries.length) {
    return { entries: remoteEntries, total: totalCount, page, pageSize };
  }

  const remoteIds = new Set(remoteEntries.map((entry) => entry.id));
  const pendingMatches = pendingEntries.filter((entry) => {
    if (remoteIds.has(entry.id)) return false;
    if (options.date) {
      const date = new Date(entry.eaten_at);
      const offset = date.getTimezoneOffset() * 60_000;
      if (new Date(date.getTime() - offset).toISOString().slice(0, 10) !== options.date) return false;
    }
    if (search) {
      const term = search.toLocaleLowerCase();
      if (![entry.name, entry.amount, entry.meal_type].some((value) => value.toLocaleLowerCase().includes(term))) return false;
    }
    return true;
  });
  const merged = [...pendingMatches, ...remoteEntries]
    .sort((a, b) => b.eaten_at.localeCompare(a.eaten_at) || b.id.localeCompare(a.id));
  const start = (page - 1) * pageSize;
  return {
    entries: merged.slice(start, start + pageSize),
    total: (totalCount) + pendingMatches.length,
    page,
    pageSize
  };
}

export async function addEntry(entry: FoodEntry): Promise<string | undefined> {
  const existingEntries = readLocalEntries();
  if (existingEntries.some((current) => current.id === entry.id)) {
    throw new Error("This food entry already exists. TrackCake did not overwrite it.");
  }
  // Save locally first. Each food has its own ID and is always appended, never upserted.
  writeLocal([entry, ...existingEntries]);

  if (!cloudConfigured) return;
  try {
    const client = await ensureCloud();
    if (!client || !userId) throw new Error("Your cloud session is not ready.");
    rememberPendingEntry(userId, entry);
    const synced = await insertPendingEntry(client, userId, entry);
    if (!synced) throw new Error("The cloud save could not be confirmed.");
    forgetPendingEntry(userId, entry.id);
  } catch (error) {
    if (userId) rememberPendingEntry(userId, entry);
    cloudReady = false;
    storageMode = "local";
    const detail = error instanceof Error ? error.message : "Unknown cloud error";
    console.warn("Food entry was saved locally but cloud sync failed; it is queued for retry.", error);
    return "Saved safely on this device. Cloud sync will retry when your connection is available. " + detail;
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
