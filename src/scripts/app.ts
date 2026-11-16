import {
  addEntry,
  DEFAULT_CALORIE_GOAL,
  deleteEntry,
  getStorageMode,
  loadTrackerData,
  saveGoal as persistGoal,
  updateEntry,
  type FoodEntry,
  type HistoryPage,
  type MealType,
  fetchHistoryPage
} from "../lib/store";

type DraftItem = {
  name: string;
  amount: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  nutrition_source?: string;
  nutrition_basis?: string;
  nutrition_source_url?: string;
};

type EstimateResponse = { items?: DraftItem[]; error?: string };

const byId = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing app element: #${id}`);
  return element as T;
};

const entriesList = byId<HTMLDivElement>("history-list");
const emptyState = byId<HTMLDivElement>("history-empty");
const toastElement = byId<HTMLDivElement>("toast");
const quickForm = byId<HTMLFormElement>("quick-add-form");
const quickDescription = byId<HTMLTextAreaElement>("food-description");
const quickMeal = byId<HTMLSelectElement>("quick-meal");
const quickTime = byId<HTMLInputElement>("quick-time");
const photoInput = byId<HTMLInputElement>("food-photo-input");
const entryDialog = byId<HTMLDialogElement>("entry-dialog");
const entryForm = byId<HTMLFormElement>("entry-form");
const reviewDialog = byId<HTMLDialogElement>("review-dialog");
const reviewForm = byId<HTMLFormElement>("review-form");
const goalDialog = byId<HTMLDialogElement>("goal-dialog");
const goalForm = byId<HTMLFormElement>("goal-form");
const foodActionDialog = byId<HTMLDialogElement>("food-action-dialog");
let selectedFoodActionId: string | null = null;

let entries: FoodEntry[] = [];
let calorieGoal = DEFAULT_CALORIE_GOAL;
let editingId: string | null = null;
let toastTimer: number | undefined;
let historyEntries: FoodEntry[] = [];
let historyPage = 1;
let historyRequest = 0;
let quickTimeManuallySet = false;
const HISTORY_PAGE_SIZE = 10;

const mealLabels: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack"
};

const mealIcons: Record<MealType, string> = {
  breakfast: "☀",
  lunch: "◉",
  dinner: "☾",
  snack: "✳"
};

function numberFormat(value: number): string {
  return Math.round(value).toLocaleString("en-IN");
}

function decimalFormat(value: number): string {
  return Number(value.toFixed(1)).toLocaleString("en-IN");
}

function dateTimeLocalValue(date = new Date()): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function mealForTime(value: string | Date): MealType {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "snack";
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "breakfast";
  if (hour >= 12 && hour < 17) return "lunch";
  if (hour >= 17 && hour < 22) return "dinner";
  return "snack";
}

function currentMeal(): MealType {
  return mealForTime(new Date());
}

function resolveMeal(selection: string, eatenAt: string): MealType {
  return selection === "auto" ? mealForTime(eatenAt) : selection as MealType;
}

function prepareReviewOptions(): void {
  byId<HTMLSelectElement>("review-meal").value = quickMeal.value;
  byId<HTMLInputElement>("review-time").value = quickTime.value || dateTimeLocalValue();
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character] ?? character);
}

function showToast(message: string, kind: "success" | "error" = "success"): void {
  toastElement.textContent = message;
  toastElement.className = `toast visible ${kind === "error" ? "toast-error" : ""}`;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastElement.className = "toast";
  }, 3600);
}

function openDialog(dialog: HTMLDialogElement): void {
  if (!dialog.open) dialog.showModal();
}

function closeDialog(dialogId: string): void {
  const dialog = document.getElementById(dialogId);
  if (dialog instanceof HTMLDialogElement && dialog.open) dialog.close();
}

function todayEntries(): FoodEntry[] {
  const today = localDateKey(new Date());
  const now = Date.now();
  return entries
    .filter((entry) => {
      const timestamp = new Date(entry.eaten_at).getTime();
      return Number.isFinite(timestamp) && timestamp <= now && localDateKey(entry.eaten_at) === today;
    })
    .sort((a, b) => new Date(b.eaten_at).getTime() - new Date(a.eaten_at).getTime());
}

function render(): void {
  const recent = todayEntries();
  const totalCalories = recent.reduce((sum, entry) => sum + entry.calories, 0);
  const protein = recent.reduce((sum, entry) => sum + entry.protein_g, 0);
  const carbs = recent.reduce((sum, entry) => sum + entry.carbs_g, 0);
  const fat = recent.reduce((sum, entry) => sum + entry.fat_g, 0);
  const progress = calorieGoal > 0 ? Math.min(1, totalCalories / calorieGoal) : 0;

  byId<HTMLElement>("current-date").textContent = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(new Date());

  byId<HTMLElement>("calories-total").textContent = numberFormat(totalCalories);
  byId<HTMLElement>("remaining-value").textContent = numberFormat(Math.max(0, calorieGoal - totalCalories));
  byId<HTMLElement>("goal-label").textContent = `${numberFormat(calorieGoal)} kcal goal`;
  const overGoal = totalCalories > calorieGoal;
  byId<HTMLElement>("remaining-value").textContent = numberFormat(overGoal ? totalCalories - calorieGoal : calorieGoal - totalCalories);
  byId<HTMLElement>("remaining-unit").textContent = overGoal ? "kcal over" : "kcal left";
  byId<HTMLElement>("progress-caption").textContent = overGoal
    ? `${numberFormat(totalCalories - calorieGoal)} kcal above your daily goal`
    : totalCalories === 0
      ? "Start logging to see your progress."
      : `${Math.round(progress * 100)}% of today's goal used`;
  const guidance = totalCalories === 0
    ? "Log your first meal to start tracking today."
    : overGoal
      ? "You're over today's target. That's okay — one day doesn't define your progress."
      : totalCalories >= calorieGoal * 0.9
        ? "You're close to your daily target. Keep listening to your hunger and energy."
        : `You're on track. ${numberFormat(calorieGoal - totalCalories)} kcal remain for today.`;
  byId<HTMLElement>("daily-guidance").textContent = guidance;

  byId<HTMLElement>("calorie-ring").style.setProperty("--progress", `${progress * 360}deg`);
  byId<HTMLElement>("progress-fill").style.width = `${progress * 100}%`;
  byId<HTMLElement>("side-goal").textContent = numberFormat(calorieGoal);
  byId<HTMLElement>("side-consumed").textContent = `${numberFormat(totalCalories)} kcal`;
  byId<HTMLElement>("side-target").textContent = `${numberFormat(calorieGoal)} kcal`;
  byId<HTMLElement>("protein-total").textContent = `${decimalFormat(protein)} g`;
  byId<HTMLElement>("carbs-total").textContent = `${decimalFormat(carbs)} g`;
  byId<HTMLElement>("fat-total").textContent = `${decimalFormat(fat)} g`;

  const mealTotals: Record<MealType, number> = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
  for (const entry of recent) mealTotals[entry.meal_type] += entry.calories;
  for (const meal of Object.keys(mealTotals) as MealType[]) {
    byId<HTMLElement>(`meal-${meal}`).textContent = `${numberFormat(mealTotals[meal])} kcal`;
  }

  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setHours(12, 0, 0, 0);
    day.setDate(day.getDate() - (6 - index));
    const key = localDateKey(day);
    const dayTotal = entries.reduce((sum, entry) =>
      localDateKey(entry.eaten_at) === key && new Date(entry.eaten_at).getTime() <= Date.now()
        ? sum + entry.calories : sum, 0);
    const onTrack = dayTotal > 0 && dayTotal >= calorieGoal * 0.9 && dayTotal <= calorieGoal * 1.1;
    return { day, dayTotal, onTrack };
  });
  const onTrackDays = weekDays.filter((day) => day.onTrack).length;
  byId<HTMLElement>("week-summary").textContent = `${onTrackDays} of 7 near goal`;
  byId<HTMLElement>("week-days").innerHTML = weekDays.map(({ day, dayTotal, onTrack }) => {
    const height = dayTotal > 0 ? Math.max(8, Math.min(100, dayTotal / Math.max(1, calorieGoal) * 100)) : 4;
    const label = new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(day);
    const title = `${label}: ${numberFormat(dayTotal)} kcal${onTrack ? " · near goal" : ""}`;
    return `<div class="week-day" title="${title}"><span class="week-bar${onTrack ? " is-on-track" : ""}" style="height:${height}%"></span><span>${label.slice(0, 1)}</span></div>`;
  }).join("");

  const dayTimeline = byId<HTMLDivElement>("day-timeline-list");
  const dayTotal = byId<HTMLElement>("day-timeline-total");
  dayTotal.textContent = `${numberFormat(totalCalories)} kcal · ${recent.length} ${recent.length === 1 ? "food" : "foods"}`;
  dayTimeline.innerHTML = recent.length
    ? recent.map((entry) => {
        const time = new Intl.DateTimeFormat("en-IN", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true
        }).format(new Date(entry.eaten_at));
        const meal = mealLabels[entry.meal_type] ?? "Snack";
        const icon = mealIcons[entry.meal_type] ?? "✳";
        return `
          <article class="day-timeline-item" data-entry-id="${escapeHtml(entry.id)}" tabindex="0" role="button" aria-label="Food options for ${escapeHtml(entry.name)}">
            <time class="day-timeline-time" datetime="${escapeHtml(entry.eaten_at)}">${time}</time>
            <span class="day-timeline-icon" aria-hidden="true">${icon}</span>
            <div class="day-timeline-food">
              <strong>${escapeHtml(entry.name)}</strong>
              <span>${escapeHtml(entry.amount)} · ${meal}</span>
            </div>
            <strong class="day-timeline-calories">${numberFormat(entry.calories)} <small>kcal</small></strong>
          </article>
        `;
      }).join("")
    : '<p class="day-timeline-empty">Nothing logged yet today. Add your first food and it will appear here.</p>';

  const macroCalories = [protein * 4, carbs * 4, fat * 9];
  const macroScale = Math.max(1, ...macroCalories);
  byId<HTMLElement>("protein-bar").style.width = `${(protein * 4 / macroScale) * 100}%`;
  byId<HTMLElement>("carbs-bar").style.width = `${(carbs * 4 / macroScale) * 100}%`;
  byId<HTMLElement>("fat-bar").style.width = `${(fat * 9 / macroScale) * 100}%`;

  byId<HTMLElement>("diary-count").textContent = `${recent.length} ${recent.length === 1 ? "entry" : "entries"}`;
  byId<HTMLElement>("range-total").textContent = `${numberFormat(totalCalories)} kcal logged`;

  void renderHistory();
  renderStorageStatus();
}

function renderStorageStatus(): void {
  const status = byId<HTMLDivElement>("storage-status");
  const label = byId<HTMLSpanElement>("storage-label");
  const cloud = getStorageMode() === "cloud";
  document.documentElement.dataset.storage = cloud ? "cloud" : "local";

  status.classList.toggle("is-cloud", cloud);
  label.textContent = cloud ? "Cloud synced" : "On this device";
  status.title = cloud
    ? "Your diary is saved to your private Supabase account."
    : "Your diary is saved in this browser. Add Supabase credentials for cloud sync.";
}

function localDateKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

async function renderHistory(): Promise<void> {
  const dateInput = document.getElementById("history-date") as HTMLInputElement | null;
  const searchInput = document.getElementById("history-search") as HTMLInputElement | null;
  const selectedDate = dateInput?.value ?? "";
  const search = (searchInput?.value ?? "").trim();
  const loading = document.getElementById("history-loading") as HTMLElement | null;
  const errorState = document.getElementById("history-error") as HTMLElement | null;
  const pagination = document.getElementById("history-pagination") as HTMLElement | null;
  const pageLabel = document.getElementById("history-page-label") as HTMLElement | null;
  const previous = document.getElementById("history-previous") as HTMLButtonElement | null;
  const next = document.getElementById("history-next") as HTMLButtonElement | null;
  const request = ++historyRequest;

  if (loading) loading.hidden = false;
  if (errorState) errorState.hidden = true;
  if (pagination) pagination.hidden = false;

  try {
    const result: HistoryPage = await fetchHistoryPage({
      page: historyPage,
      pageSize: HISTORY_PAGE_SIZE,
      date: selectedDate,
      search
    });
    if (request !== historyRequest) return;

    if (result.entries.length === 0 && result.total > 0 && historyPage > 1) {
      historyPage = Math.max(1, historyPage - 1);
      return void renderHistory();
    }

    historyEntries = result.entries;
    const totalPages = Math.max(1, Math.ceil(result.total / HISTORY_PAGE_SIZE));
    emptyState.hidden = result.entries.length > 0;
    entriesList.hidden = result.entries.length === 0;
    byId<HTMLElement>("diary-count").textContent = `${result.total} ${result.total === 1 ? "entry" : "entries"}`;
    byId<HTMLElement>("range-total").textContent = `${numberFormat(result.entries.reduce((sum, entry) => sum + entry.calories, 0))} kcal on this page`;

    if (result.entries.length === 0) {
      entriesList.innerHTML = "";
      const title = emptyState.querySelector("h3");
      const copy = emptyState.querySelector("p");
      if (title) title.textContent = search || selectedDate ? "No matching food found." : "Your diary starts with a bite.";
      if (copy) copy.textContent = search || selectedDate ? "Try another date or a different search." : "Log your first meal above and it will show up here.";
    } else {
      entriesList.innerHTML = result.entries.map((entry) => {
        const meal = mealLabels[entry.meal_type] ?? "Snack";
        const icon = mealIcons[entry.meal_type] ?? "✳";
        const time = new Intl.DateTimeFormat("en-IN", {
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit"
        }).format(new Date(entry.eaten_at));

        return `
          <article class="food-row" data-entry-id="${escapeHtml(entry.id)}" tabindex="0" role="button" aria-label="Food options for ${escapeHtml(entry.name)}">
            <div class="food-icon food-${entry.meal_type}" aria-hidden="true">${icon}</div>
            <div class="food-details">
              <div class="food-title-line">
                <h3>${escapeHtml(entry.name)}</h3>
                <span class="meal-chip">${meal}</span>
                ${entry.source === "ai" ? '<span class="ai-chip">AI estimate</span>' : ""}
              </div>
              <p>${escapeHtml(entry.amount)} <span>·</span> ${time}</p>
            </div>
            <div class="food-nutrition">
              <strong>${numberFormat(entry.calories)} <small>kcal</small></strong>
              <span>P ${decimalFormat(entry.protein_g)} · C ${decimalFormat(entry.carbs_g)} · F ${decimalFormat(entry.fat_g)}</span>
            </div>
          </article>
        `;
      }).join("");
    }

    if (pageLabel) pageLabel.textContent = `Page ${historyPage} of ${totalPages} · ${result.total} total`;
    if (previous) previous.disabled = historyPage <= 1;
    if (next) next.disabled = historyPage >= totalPages;
    if (pagination) pagination.hidden = result.total === 0;
  } catch (error) {
    if (request !== historyRequest) return;
    entriesList.innerHTML = "";
    entriesList.hidden = true;
    emptyState.hidden = true;
    if (errorState) {
      errorState.textContent = error instanceof Error ? error.message : "Food history could not be loaded. Please try again.";
      errorState.hidden = false;
    }
    if (pagination) pagination.hidden = true;
  } finally {
    if (request === historyRequest && loading) loading.hidden = true;
  }
}

function setQuickDefaults(): void {
  quickMeal.value = "auto";
  quickTime.value = dateTimeLocalValue();
  quickTimeManuallySet = false;
}

function openManualEntry(entry?: FoodEntry): void {
  if (!entry && !quickTimeManuallySet) quickTime.value = dateTimeLocalValue();
  editingId = entry?.id ?? null;
  byId<HTMLElement>("entry-heading").textContent = entry ? "Edit food" : "Add a food";
  byId<HTMLInputElement>("entry-name").value = entry?.name ?? "";
  byId<HTMLInputElement>("entry-amount").value = entry?.amount ?? "";
  byId<HTMLInputElement>("entry-calories").value = entry ? String(entry.calories) : "";
  byId<HTMLInputElement>("entry-protein").value = entry ? String(entry.protein_g) : "0";
  byId<HTMLInputElement>("entry-carbs").value = entry ? String(entry.carbs_g) : "0";
  byId<HTMLInputElement>("entry-fat").value = entry ? String(entry.fat_g) : "0";
  byId<HTMLSelectElement>("entry-meal").value = entry?.meal_type ?? quickMeal.value;
  byId<HTMLInputElement>("entry-time").value = entry
    ? dateTimeLocalValue(new Date(entry.eaten_at))
    : quickTime.value || dateTimeLocalValue();
  byId<HTMLButtonElement>("entry-save").textContent = entry ? "Save changes" : "Save food";
  openDialog(entryDialog);
  window.setTimeout(() => byId<HTMLInputElement>("entry-name").focus(), 0);
}

function toISOStringFromInput(value: string): string {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    throw new Error("Choose when you ate this food.");
  }
  return date.toISOString();
}

function formNumber(id: string): number {
  return Math.max(0, Number(byId<HTMLInputElement>(id).value) || 0);
}

async function saveManualEntry(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const name = byId<HTMLInputElement>("entry-name").value.trim();
  const amount = byId<HTMLInputElement>("entry-amount").value.trim();
  const calories = formNumber("entry-calories");

  if (!name || !amount) {
    showToast("Add a food name and portion first.", "error");
    return;
  }
  if (calories <= 0) {
    showToast("Add a calorie value greater than zero.", "error");
    return;
  }

  const entryTimeValue = byId<HTMLInputElement>("entry-time").value;
  let eatenAt: string;
  try {
    eatenAt = toISOStringFromInput(entryTimeValue);
  } catch (error) {
    showToast(error instanceof Error ? error.message : "Choose a valid time.", "error");
    return;
  }

  const existing = editingId ? (historyEntries.find((entry) => entry.id === editingId) ?? entries.find((entry) => entry.id === editingId)) : undefined;
  const entry: FoodEntry = {
    id: existing?.id ?? crypto.randomUUID(),
    name,
    amount,
    calories,
    protein_g: formNumber("entry-protein"),
    carbs_g: formNumber("entry-carbs"),
    fat_g: formNumber("entry-fat"),
    meal_type: resolveMeal(byId<HTMLSelectElement>("entry-meal").value, entryTimeValue),
    eaten_at: eatenAt,
    source: existing?.source ?? "manual"
  };

  try {
    const warning = existing ? await updateEntry(entry) : await addEntry(entry);
    if (existing) entries = entries.map((current) => current.id === entry.id ? entry : current);
    else entries.unshift(entry);
    render();
    closeDialog("entry-dialog");
    if (!existing) {
      quickTime.value = dateTimeLocalValue();
      quickTimeManuallySet = false;
    }
    showToast(warning ?? (existing ? "Food entry updated." : "Food added to your diary."), warning ? "error" : "success");
  } catch (error) {
    showToast(error instanceof Error ? error.message : "Could not save this food.", "error");
  }
}

function renderReviewItems(items: DraftItem[]): void {
  const container = byId<HTMLDivElement>("review-items");
  container.innerHTML = items.map((item, index) => `
    <article class="review-item">
      <div class="review-item-heading">
        <span class="review-item-number">0${index + 1}</span>
        <strong>Food item</strong>
        ${item.nutrition_source ? `<span class="review-source">${escapeHtml(item.nutrition_source)} · ${escapeHtml(item.nutrition_basis || "")}${item.nutrition_source_url ? ` · <a href="${escapeHtml(item.nutrition_source_url)}" target="_blank" rel="noopener noreferrer">source</a>` : ""}</span>` : `<span class="review-source review-source-estimate">AI estimate · no verified nutrition match</span>`}
        <button class="remove-review-item" type="button" data-remove-review="${index}" aria-label="Remove food item">×</button>
      </div>
      <div class="review-grid">
        <label class="field review-name">Food name<input data-review-field="name" value="${escapeHtml(item.name)}" maxlength="90" required /></label>
        <label class="field review-amount">Amount<input data-review-field="amount" value="${escapeHtml(item.amount)}" maxlength="90" required /></label>
        <label class="field">Calories<input data-review-field="calories" type="number" min="1" max="10000" step="1" value="${item.calories}" required /></label>
        <label class="field">Protein g<input data-review-field="protein_g" type="number" min="0" max="1000" step="0.1" value="${item.protein_g}" /></label>
        <label class="field">Carbs g<input data-review-field="carbs_g" type="number" min="0" max="1000" step="0.1" value="${item.carbs_g}" /></label>
        <label class="field">Fat g<input data-review-field="fat_g" type="number" min="0" max="1000" step="0.1" value="${item.fat_g}" /></label>
      </div>
    </article>
  `).join("");
  updateReviewTotal();
}

function readReviewDrafts(): DraftItem[] {
  return [...byId<HTMLDivElement>("review-items").querySelectorAll<HTMLElement>(".review-item")].map((row) => {
    const value = (field: string) =>
      row.querySelector<HTMLInputElement>(`[data-review-field="${field}"]`)?.value ?? "";
    return {
      name: value("name").trim(),
      amount: value("amount").trim(),
      calories: Math.max(0, Number(value("calories")) || 0),
      protein_g: Math.max(0, Number(value("protein_g")) || 0),
      carbs_g: Math.max(0, Number(value("carbs_g")) || 0),
      fat_g: Math.max(0, Number(value("fat_g")) || 0)
    };
  });
}

function updateReviewTotal(): void {
  const total = readReviewDrafts().reduce((sum, item) => sum + item.calories, 0);
  byId<HTMLElement>("review-total").textContent = `${numberFormat(total)} kcal`;
}

async function compressFoodPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare this photo.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob) throw new Error("Your browser could not compress this photo.");
    if (blob.size > 2.7 * 1024 * 1024) throw new Error("This photo is still too large after compression. Please choose a smaller image.");
    return blob;
  } finally {
    bitmap.close();
  }
}

type PhotoStreamEvent = {
  type?: "progress" | "result" | "error";
  stage?: string;
  provider?: string;
  model?: string;
  message?: string;
  attempt?: number;
  total?: number;
  items?: DraftItem[];
  error?: string;
  detail?: string;
};

function photoProgressDialog(): HTMLDialogElement {
  let dialog = document.getElementById("photo-progress-dialog") as HTMLDialogElement | null;
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "photo-progress-dialog";
  dialog.className = "app-dialog photo-progress-dialog";
  dialog.setAttribute("aria-labelledby", "photo-progress-title");
  dialog.innerHTML = `
    <div class="dialog-form photo-progress-content">
      <div class="photo-progress-orb" aria-hidden="true"><span>✳</span></div>
      <p class="card-kicker">TRACKCAKE PHOTO ANALYSIS</p>
      <h2 id="photo-progress-title">Reading your plate</h2>
      <p class="dialog-subtitle" id="photo-progress-message" aria-live="polite">Preparing your photo…</p>
      <div class="photo-progress-track"><span id="photo-progress-fill"></span></div>
      <div class="photo-progress-meta"><span id="photo-progress-step">Preparing image</span><span id="photo-progress-count">0%</span></div>
      <ol class="photo-progress-steps" id="photo-progress-steps">
        <li class="is-active" data-progress-step="prepare"><span></span><div><strong>Prepare photo</strong><small>Compressing securely on this device</small></div></li>
        <li data-progress-step="providers"><span></span><div><strong>Try AI providers</strong><small>Switch automatically if one cannot analyse it</small></div></li>
        <li data-progress-step="review"><span></span><div><strong>Build food estimates</strong><small>You'll review everything before saving</small></div></li>
      </ol>
      <button class="secondary-button photo-progress-cancel" id="photo-progress-cancel" type="button">Cancel</button>
    </div>`;
  document.body.append(dialog);
  const style = document.createElement("style");
  style.textContent = `
    .photo-progress-dialog{width:min(440px,calc(100vw - 28px));border:1px solid #e7ede3;border-radius:24px;padding:0;box-shadow:0 24px 90px rgba(24,48,32,.22)}
    .photo-progress-dialog::backdrop{background:rgba(20,37,27,.48);backdrop-filter:blur(5px)}
    .photo-progress-content{text-align:center;padding:30px 28px 24px}
    .photo-progress-orb{width:58px;height:58px;margin:0 auto 18px;border-radius:20px;background:#edf4e8;color:#527c4b;display:grid;place-items:center;font-size:28px;animation:photoPulse 1.8s ease-in-out infinite}
    @keyframes photoPulse{50%{transform:scale(1.07);box-shadow:0 0 0 9px rgba(133,174,112,.12)}}
    .photo-progress-content h2{margin:7px 0 5px;font:800 23px Manrope, sans-serif;color:#20382c}
    .photo-progress-content .dialog-subtitle{margin:0 auto 18px;min-height:22px}
    .photo-progress-track{height:7px;border-radius:20px;background:#edf1e9;overflow:hidden}
    .photo-progress-track span{display:block;width:8%;height:100%;border-radius:20px;background:linear-gradient(90deg,#8baa70,#c4d99c);transition:width .35s ease}
    .photo-progress-meta{display:flex;justify-content:space-between;margin:8px 0 18px;color:#819080;font-size:11px;font-weight:700}
    .photo-progress-steps{list-style:none;text-align:left;padding:0;margin:0 0 18px;display:grid;gap:12px}
    .photo-progress-steps li{display:flex;align-items:center;gap:11px;color:#a0a99e}
    .photo-progress-steps li>span{width:10px;height:10px;border:2px solid #d7dfd2;border-radius:50%;flex:none}
    .photo-progress-steps li.is-active{color:#34543c}
    .photo-progress-steps li.is-active>span{border-color:#83a76d;background:#83a76d;box-shadow:0 0 0 4px #edf4e8}
    .photo-progress-steps li.is-done>span{border-color:#6d9a65;background:#6d9a65}
    .photo-progress-steps strong,.photo-progress-steps small{display:block}
    .photo-progress-steps strong{font-size:12px}
    .photo-progress-steps small{margin-top:2px;font-size:10px;color:#929d91}
    .photo-progress-cancel{width:100%;justify-content:center}
    @media(prefers-reduced-motion:reduce){.photo-progress-orb{animation:none}.photo-progress-track span{transition:none}}
  `;
  document.head.append(style);
  return dialog;
}

function updatePhotoProgress(event: PhotoStreamEvent): void {
  const dialog = photoProgressDialog();
  const message = dialog.querySelector<HTMLElement>("#photo-progress-message");
  const step = dialog.querySelector<HTMLElement>("#photo-progress-step");
  const count = dialog.querySelector<HTMLElement>("#photo-progress-count");
  const fill = dialog.querySelector<HTMLElement>("#photo-progress-fill");
  const steps = dialog.querySelectorAll<HTMLElement>("[data-progress-step]");
  if (message) message.textContent = event.message || "Analysing your food photo…";
  const percent = event.stage === "prepared" ? 16
    : event.stage === "trying" ? Math.min(82, 20 + Math.round(((event.attempt || 1) / Math.max(1, event.total || 1)) * 58))
      : event.stage === "fallback" ? Math.min(86, 24 + Math.round(((event.attempt || 1) / Math.max(1, event.total || 1)) * 58))
        : event.stage === "researching" ? 88
          : event.stage === "success" ? 94 : 10;
  if (fill) fill.style.width = percent + "%";
  if (count) count.textContent = percent + "%";
  if (step) step.textContent = event.stage === "prepared" ? "Photo prepared"
    : event.stage === "trying" ? `Trying ${event.provider || "AI"}`
      : event.stage === "fallback" ? "Switching provider"
        : event.stage === "researching" ? "Checking nutrition sources"
      : event.stage === "success" ? "Analysis complete" : "Working";
  steps.forEach((item) => {
    const name = item.dataset.progressStep;
    item.classList.toggle("is-active", name === (event.stage === "prepared" ? "providers" : event.stage === "researching" || event.stage === "success" ? "review" : "providers"));
    item.classList.toggle("is-done", name === "prepare" || (name === "providers" && (event.stage === "researching" || event.stage === "success")));
  });
}

async function estimatePhoto(): Promise<void> {
  if (!quickTimeManuallySet) quickTime.value = dateTimeLocalValue();
  const file = photoInput.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("Choose a photo from your camera or gallery.", "error");
    photoInput.value = "";
    return;
  }
  if (file.size > 12 * 1024 * 1024) {
    showToast("Please choose a photo smaller than 12 MB.", "error");
    photoInput.value = "";
    return;
  }

  const button = byId<HTMLButtonElement>("photo-add");
  const progressDialog = photoProgressDialog();
  const cancelButton = progressDialog.querySelector<HTMLButtonElement>("#photo-progress-cancel")!;
  const controller = new AbortController();
  button.disabled = true;
  button.textContent = "Analysing photo…";
  cancelButton.onclick = () => controller.abort();
  updatePhotoProgress({ stage: "prepared", message: "Preparing your photo on this device…" });
  if (!progressDialog.open) progressDialog.showModal();

  try {
    const compressed = await compressFoodPhoto(file);
    const imageData = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        const comma = result.indexOf(",");
        if (comma < 0) reject(new Error("Your browser could not read this photo."));
        else resolve(result.slice(comma + 1));
      };
      reader.onerror = () => reject(new Error("Your browser could not read this photo."));
      reader.readAsDataURL(compressed);
    });
    updatePhotoProgress({ stage: "prepared", message: "Photo compressed. Checking your available AI providers…" });
    const response = await fetch("/api/food-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: imageData,
        description: quickDescription.value.trim(),
        provider: byId<HTMLSelectElement>("quick-provider").value || "auto",
        model: byId<HTMLSelectElement>("quick-model").value || undefined
      }),
      signal: controller.signal
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string; detail?: string };
      throw new Error(body.detail ? (body.error || "Photo analysis failed.") + " " + body.detail : body.error || `Photo service failed (HTTP ${response.status}).`);
    }
    if (!response.body) throw new Error("Your browser could not receive the analysis progress.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let result: PhotoStreamEvent | undefined;
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line) as PhotoStreamEvent;
        if (event.type === "progress") updatePhotoProgress(event);
        else if (event.type === "result" || event.type === "error") result = event;
      }
      if (done) break;
    }
    if (buffer.trim()) {
      const event = JSON.parse(buffer) as PhotoStreamEvent;
      if (event.type === "progress") updatePhotoProgress(event);
      else if (event.type === "result" || event.type === "error") result = event;
    }
    if (!result) throw new Error("The photo analysis ended without a result. Please retry.");
    if (result.type === "error") {
      throw new Error(result.detail ? (result.error || "Photo analysis failed.") + " " + result.detail : result.error || "No provider could analyse this photo.");
    }
    if (!Array.isArray(result.items) || result.items.length === 0) {
      throw new Error("No food was identified. Try a clearer photo with the food visible.");
    }
    updatePhotoProgress({ stage: "success", message: `Success! ${result.provider || "AI"} analysed your meal. Preparing your review…` });
    const drafts = result.items.map((item) => ({
      name: String(item.name ?? "").slice(0, 90),
      amount: String(item.amount ?? "").slice(0, 90),
      calories: Math.max(0, Number(item.calories) || 0),
      protein_g: Math.max(0, Number(item.protein_g) || 0),
      carbs_g: Math.max(0, Number(item.carbs_g) || 0),
      fat_g: Math.max(0, Number(item.fat_g) || 0),
      nutrition_source: item.nutrition_source,
      nutrition_basis: item.nutrition_basis,
      nutrition_source_url: item.nutrition_source_url
    }));
    renderReviewItems(drafts);
    prepareReviewOptions();
    const attribution = document.getElementById("estimate-attribution");
    if (attribution) attribution.textContent = "Photo estimate · " + (result.provider || "AI") + " · " + (result.model || "vision model");
    progressDialog.close();
    openDialog(reviewDialog);
  } catch (error) {
    if (progressDialog.open) progressDialog.close();
    showToast(error instanceof Error ? error.message : "Could not analyse this photo.", "error");
  } finally {
    button.disabled = false;
    button.innerHTML = '<span aria-hidden="true">▧</span> Photo entry';
    photoInput.value = "";
  }
}

async function estimateFood(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  if (!quickTimeManuallySet) quickTime.value = dateTimeLocalValue();
  const description = quickDescription.value.trim();
  if (!description) {
    showToast("Describe what you ate first.", "error");
    quickDescription.focus();
    return;
  }

  const button = byId<HTMLButtonElement>("estimate-button");
  const buttonLabel = button.querySelector("span");
  button.disabled = true;
  if (buttonLabel) buttonLabel.textContent = "Estimating…";

  try {
    const response = await fetch("/api/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, provider: byId<HTMLSelectElement>("quick-provider").value || "auto" })
    });
    const payload = await response.json() as EstimateResponse;
    if (!response.ok) throw new Error(payload.error || "The food estimate could not be completed.");
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      throw new Error("No food items were returned. Try describing your portions more clearly.");
    }

    const drafts = payload.items.map((item) => ({
      name: String(item.name ?? "").slice(0, 90),
      amount: String(item.amount ?? "").slice(0, 90),
      calories: Math.max(0, Number(item.calories) || 0),
      protein_g: Math.max(0, Number(item.protein_g) || 0),
      carbs_g: Math.max(0, Number(item.carbs_g) || 0),
      fat_g: Math.max(0, Number(item.fat_g) || 0),
      nutrition_source: item.nutrition_source,
      nutrition_basis: item.nutrition_basis,
      nutrition_source_url: item.nutrition_source_url
    }));
    renderReviewItems(drafts);
    prepareReviewOptions();
    openDialog(reviewDialog);
  } catch (error) {
    showToast(error instanceof Error ? error.message : "Could not estimate this meal.", "error");
  } finally {
    button.disabled = false;
    if (buttonLabel) buttonLabel.textContent = "Estimate with AI";
  }
}

async function saveReview(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const items = readReviewDrafts();

  if (items.length === 0 || items.some((item) => !item.name || !item.amount || item.calories <= 0)) {
    showToast("Check each food name, portion and calorie value.", "error");
    return;
  }

  const reviewTimeValue = byId<HTMLInputElement>("review-time").value;
  let eatenAt: string;
  try {
    eatenAt = toISOStringFromInput(reviewTimeValue);
  } catch {
    eatenAt = new Date().toISOString();
  }

  const meal = resolveMeal(byId<HTMLSelectElement>("review-meal").value, reviewTimeValue);
  const saveButton = reviewForm.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = "Saving…";
  }

  try {
    const created: FoodEntry[] = items.map((item) => ({
      id: crypto.randomUUID(),
      ...item,
      meal_type: meal,
      eaten_at: eatenAt,
      source: "ai"
    }));

    const warnings: string[] = [];
    for (const entry of created) {
      const warning = await addEntry(entry);
      if (warning) warnings.push(warning);
    }

    entries = [...created, ...entries];
    render();
    closeDialog("review-dialog");
    quickDescription.value = "";
    quickTime.value = dateTimeLocalValue();
    quickTimeManuallySet = false;
    quickMeal.value = byId<HTMLSelectElement>("review-meal").value;
    showToast(warnings[0] ?? `${created.length} ${created.length === 1 ? "food" : "foods"} added to your diary.`, warnings.length ? "error" : "success");
  } catch (error) {
    showToast(error instanceof Error ? error.message : "Could not save the estimate.", "error");
  } finally {
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = "Save to diary";
    }
  }
}

async function removeFood(id: string): Promise<void> {
  const entry = historyEntries.find((item) => item.id === id) ?? entries.find((item) => item.id === id);
  if (!entry) return;
  if (!window.confirm(`Delete "${entry.name}" from your diary?`)) return;

  try {
    const warning = await deleteEntry(id);
    entries = entries.filter((item) => item.id !== id);
    render();
    showToast(warning ?? "Food entry deleted.", warning ? "error" : "success");
  } catch (error) {
    showToast(error instanceof Error ? error.message : "Could not delete this food.", "error");
  }
}

function openGoalDialog(): void {
  byId<HTMLInputElement>("goal-input").value = String(calorieGoal);
  openDialog(goalDialog);
  window.setTimeout(() => byId<HTMLInputElement>("goal-input").focus(), 0);
}

async function saveGoal(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const goal = Number(byId<HTMLInputElement>("goal-input").value);
  if (!Number.isInteger(goal) || goal < 500 || goal > 10000) {
    showToast("Choose a goal between 500 and 10,000 kcal.", "error");
    return;
  }

  try {
    const warning = await persistGoal(goal);
    calorieGoal = goal;
    render();
    closeDialog("goal-dialog");
    showToast(warning ?? "Daily calorie goal updated.", warning ? "error" : "success");
  } catch (error) {
    showToast(error instanceof Error ? error.message : "Could not save your goal.", "error");
  }
}

function bindEvents(): void {
  quickTime.addEventListener("input", () => { quickTimeManuallySet = true; });
  quickForm.addEventListener("submit", (event) => void estimateFood(event));
  entryForm.addEventListener("submit", (event) => void saveManualEntry(event));
  reviewForm.addEventListener("submit", (event) => void saveReview(event));
  goalForm.addEventListener("submit", (event) => void saveGoal(event));

  byId<HTMLButtonElement>("manual-add").addEventListener("click", () => openManualEntry());
  byId<HTMLButtonElement>("photo-add").addEventListener("click", () => photoInput.click());
  photoInput.addEventListener("change", () => void estimatePhoto());
  const historyDate = document.getElementById("history-date") as HTMLInputElement | null;
  const historySearch = document.getElementById("history-search") as HTMLInputElement | null;
  const historyClear = document.getElementById("history-clear") as HTMLButtonElement | null;
  historyDate?.addEventListener("change", () => { historyPage = 1; void renderHistory(); });
  let historySearchTimer: number | undefined;
  historySearch?.addEventListener("input", () => {
    window.clearTimeout(historySearchTimer);
    historySearchTimer = window.setTimeout(() => { historyPage = 1; void renderHistory(); }, 250);
  });
  historyClear?.addEventListener("click", () => {
    if (historyDate) historyDate.value = "";
    if (historySearch) historySearch.value = "";
    historyPage = 1;
    void renderHistory();
  });
  byId<HTMLButtonElement>("history-previous").addEventListener("click", () => {
    if (historyPage > 1) { historyPage -= 1; void renderHistory(); }
  });
  byId<HTMLButtonElement>("history-next").addEventListener("click", () => {
    historyPage += 1;
    void renderHistory();
  });
  byId<HTMLButtonElement>("empty-add").addEventListener("click", () => openManualEntry());
  byId<HTMLButtonElement>("goal-shortcut").addEventListener("click", openGoalDialog);
  byId<HTMLButtonElement>("edit-goal").addEventListener("click", openGoalDialog);
  byId<HTMLButtonElement>("goal-edit-small").addEventListener("click", openGoalDialog);

  byId<HTMLButtonElement>("review-add-item").addEventListener("click", () => {
    const next = [...readReviewDrafts(), {
      name: "",
      amount: "",
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0
    }];
    renderReviewItems(next);
    byId<HTMLDivElement>("review-items").querySelector<HTMLInputElement>(".review-item:last-child [data-review-field='name']")?.focus();
  });

  const openFoodActionMenu = (id: string) => {
    const entry = historyEntries.find((item) => item.id === id) ?? entries.find((item) => item.id === id);
    if (!entry) return;
    selectedFoodActionId = id;
    byId<HTMLElement>("food-action-name").textContent = entry.name;
    openDialog(foodActionDialog);
  };

  const bindFoodRowActions = (container: HTMLElement) => {
    container.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const row = target.closest<HTMLElement>("[data-entry-id]");
      if (row?.dataset.entryId) openFoodActionMenu(row.dataset.entryId);
    });
    container.addEventListener("keydown", (event) => {
      if (!(event instanceof KeyboardEvent) || (event.key !== "Enter" && event.key !== " ")) return;
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const row = target.closest<HTMLElement>("[data-entry-id]");
      if (!row?.dataset.entryId) return;
      event.preventDefault();
      openFoodActionMenu(row.dataset.entryId);
    });
  };

  bindFoodRowActions(byId<HTMLDivElement>("day-timeline-list"));
  bindFoodRowActions(entriesList);

  foodActionDialog.querySelectorAll<HTMLButtonElement>("[data-food-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = selectedFoodActionId;
      const action = button.dataset.foodAction;
      if (!id) return;
      closeDialog("food-action-dialog");
      if (action === "edit") {
        const entry = historyEntries.find((item) => item.id === id) ?? entries.find((item) => item.id === id);
        if (entry) openManualEntry(entry);
      } else if (action === "delete") {
        void removeFood(id);
      }
      selectedFoodActionId = null;
    });
  });

  byId<HTMLDivElement>("review-items").addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const removeButton = target.closest<HTMLElement>("[data-remove-review]");
    if (!removeButton) return;
    const index = Number(removeButton.dataset.removeReview);
    renderReviewItems(readReviewDrafts().filter((_, itemIndex) => itemIndex !== index));
  });

  byId<HTMLDivElement>("review-items").addEventListener("input", updateReviewTotal);


  document.querySelectorAll<HTMLButtonElement>("[data-close]").forEach((button) => {
    button.addEventListener("click", () => {
      const dialogId = button.dataset.close;
      if (dialogId) closeDialog(dialogId);
    });
  });

  [entryDialog, reviewDialog, goalDialog].forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  });
}

async function initialize(): Promise<void> {
  setQuickDefaults();
  bindEvents();

  try {
    const data = await loadTrackerData();
    entries = data.entries;
    calorieGoal = data.goal;
    render();
    if (data.message) showToast(data.message, "error");
  } catch (error) {
    render();
    showToast(error instanceof Error ? error.message : "Your diary could not be loaded.", "error");
  }
}

void initialize();

