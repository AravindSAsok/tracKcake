import {
  addEntry,
  DEFAULT_CALORIE_GOAL,
  deleteEntry,
  getStorageMode,
  loadTrackerData,
  saveGoal as persistGoal,
  updateEntry,
  type FoodEntry,
  type MealType
} from "../lib/store";

type DraftItem = {
  name: string;
  amount: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
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

let entries: FoodEntry[] = [];
let calorieGoal = DEFAULT_CALORIE_GOAL;
let editingId: string | null = null;
let toastTimer: number | undefined;

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

function currentMeal(): MealType {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 16) return "lunch";
  if (hour >= 17 && hour < 22) return "dinner";
  return "snack";
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

function last24Hours(): FoodEntry[] {
  const now = Date.now();
  const cutoff = now - 24 * 60 * 60 * 1000;
  return entries
    .filter((entry) => {
      const timestamp = new Date(entry.eaten_at).getTime();
      return Number.isFinite(timestamp) && timestamp >= cutoff && timestamp <= now;
    })
    .sort((a, b) => new Date(b.eaten_at).getTime() - new Date(a.eaten_at).getTime());
}

function render(): void {
  const recent = last24Hours();
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
  byId<HTMLElement>("progress-caption").textContent = totalCalories > calorieGoal
    ? `${numberFormat(totalCalories - calorieGoal)} kcal above your goal`
    : totalCalories === 0
      ? "Start logging to see your progress."
      : `${Math.round(progress * 100)}% of your 24-hour goal used`;

  byId<HTMLElement>("calorie-ring").style.setProperty("--progress", `${progress * 360}deg`);
  byId<HTMLElement>("progress-fill").style.width = `${progress * 100}%`;
  byId<HTMLElement>("side-goal").textContent = numberFormat(calorieGoal);
  byId<HTMLElement>("side-consumed").textContent = `${numberFormat(totalCalories)} kcal`;
  byId<HTMLElement>("side-target").textContent = `${numberFormat(calorieGoal)} kcal`;
  byId<HTMLElement>("protein-total").textContent = `${decimalFormat(protein)} g`;
  byId<HTMLElement>("carbs-total").textContent = `${decimalFormat(carbs)} g`;
  byId<HTMLElement>("fat-total").textContent = `${decimalFormat(fat)} g`;

  const macroCalories = [protein * 4, carbs * 4, fat * 9];
  const macroScale = Math.max(1, ...macroCalories);
  byId<HTMLElement>("protein-bar").style.width = `${(protein * 4 / macroScale) * 100}%`;
  byId<HTMLElement>("carbs-bar").style.width = `${(carbs * 4 / macroScale) * 100}%`;
  byId<HTMLElement>("fat-bar").style.width = `${(fat * 9 / macroScale) * 100}%`;

  byId<HTMLElement>("diary-count").textContent = `${recent.length} ${recent.length === 1 ? "entry" : "entries"}`;
  byId<HTMLElement>("range-total").textContent = `${numberFormat(totalCalories)} kcal logged`;

  renderHistory(recent);
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

function renderHistory(_recent: FoodEntry[]): void {
  const dateInput = document.getElementById("history-date") as HTMLInputElement | null;
  const searchInput = document.getElementById("history-search") as HTMLInputElement | null;
  const selectedDate = dateInput?.value ?? "";
  const search = (searchInput?.value ?? "").trim().toLocaleLowerCase();
  const filtered = entries
    .filter((entry) => !selectedDate || localDateKey(entry.eaten_at) === selectedDate)
    .filter((entry) => !search || [entry.name, entry.amount, entry.meal_type].some((value) => value.toLocaleLowerCase().includes(search)))
    .sort((a, b) => new Date(b.eaten_at).getTime() - new Date(a.eaten_at).getTime());

  emptyState.hidden = filtered.length > 0;
  entriesList.hidden = filtered.length === 0;
  byId<HTMLElement>("diary-count").textContent = `${filtered.length} ${filtered.length === 1 ? "entry" : "entries"}`;
  byId<HTMLElement>("range-total").textContent = `${numberFormat(filtered.reduce((sum, entry) => sum + entry.calories, 0))} kcal logged`;

  if (filtered.length === 0) {
    entriesList.innerHTML = "";
    const title = emptyState.querySelector("h3");
    const copy = emptyState.querySelector("p");
    if (title) title.textContent = search || selectedDate ? "No matching food found." : "Your diary starts with a bite.";
    if (copy) copy.textContent = search || selectedDate ? "Try another date or a different search." : "Log your first meal above and it will show up here.";
    return;
  }

  entriesList.innerHTML = filtered.map((entry) => {
    const meal = mealLabels[entry.meal_type] ?? "Snack";
    const icon = mealIcons[entry.meal_type] ?? "✳";
    const time = new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(entry.eaten_at));

    return `
      <article class="food-row">
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
        <div class="food-actions">
          <button class="row-action" type="button" data-action="edit" data-id="${escapeHtml(entry.id)}" aria-label="Edit ${escapeHtml(entry.name)}" title="Edit food">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l4.4-.9L20 7.5 16.5 4 4.9 15.6 4 20Z"/></svg>
          </button>
          <button class="row-action delete-action" type="button" data-action="delete" data-id="${escapeHtml(entry.id)}" aria-label="Delete ${escapeHtml(entry.name)}" title="Delete food">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-.8 13H6.8L6 7m4 4v5m4-5v5"/></svg>
          </button>
        </div>
      </article>
    `;
  }).join("");
}

function setQuickDefaults(): void {
  quickMeal.value = currentMeal();
  quickTime.value = dateTimeLocalValue();
}

function openManualEntry(entry?: FoodEntry): void {
  editingId = entry?.id ?? null;
  byId<HTMLElement>("entry-heading").textContent = entry ? "Edit food" : "Add a food";
  byId<HTMLInputElement>("entry-name").value = entry?.name ?? "";
  byId<HTMLInputElement>("entry-amount").value = entry?.amount ?? "";
  byId<HTMLInputElement>("entry-calories").value = entry ? String(entry.calories) : "";
  byId<HTMLInputElement>("entry-protein").value = entry ? String(entry.protein_g) : "0";
  byId<HTMLInputElement>("entry-carbs").value = entry ? String(entry.carbs_g) : "0";
  byId<HTMLInputElement>("entry-fat").value = entry ? String(entry.fat_g) : "0";
  byId<HTMLSelectElement>("entry-meal").value = entry?.meal_type ?? quickMeal.value as MealType;
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

  let eatenAt: string;
  try {
    eatenAt = toISOStringFromInput(byId<HTMLInputElement>("entry-time").value);
  } catch (error) {
    showToast(error instanceof Error ? error.message : "Choose a valid time.", "error");
    return;
  }

  const existing = editingId ? entries.find((entry) => entry.id === editingId) : undefined;
  const entry: FoodEntry = {
    id: existing?.id ?? crypto.randomUUID(),
    name,
    amount,
    calories,
    protein_g: formNumber("entry-protein"),
    carbs_g: formNumber("entry-carbs"),
    fat_g: formNumber("entry-fat"),
    meal_type: byId<HTMLSelectElement>("entry-meal").value as MealType,
    eaten_at: eatenAt,
    source: existing?.source ?? "manual"
  };

  try {
    const warning = existing ? await updateEntry(entry) : await addEntry(entry);
    if (existing) entries = entries.map((current) => current.id === entry.id ? entry : current);
    else entries.unshift(entry);
    render();
    closeDialog("entry-dialog");
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

async function estimatePhoto(): Promise<void> {
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
  button.disabled = true;
  button.textContent = "Analysing photo…";
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
    const response = await fetch("/api/food-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: imageData,
        provider: byId<HTMLSelectElement>("quick-provider").value || "auto"
      }),
      signal: AbortSignal.timeout(55_000)
    });
    const payload = await response.json() as {
      items?: DraftItem[];
      error?: string;
      provider?: string;
      model?: string;
    };
    if (!response.ok) {
      const detail = (payload as { detail?: string }).detail;
      throw new Error(detail ? (payload.error || "Photo analysis failed.") + " " + detail : payload.error || "The photo could not be analysed.");
    }
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      throw new Error("No food was identified. Try a clearer photo with the food visible.");
    }
    const drafts = payload.items.map((item) => ({
      name: String(item.name ?? "").slice(0, 90),
      amount: String(item.amount ?? "").slice(0, 90),
      calories: Math.max(0, Number(item.calories) || 0),
      protein_g: Math.max(0, Number(item.protein_g) || 0),
      carbs_g: Math.max(0, Number(item.carbs_g) || 0),
      fat_g: Math.max(0, Number(item.fat_g) || 0)
    }));
    renderReviewItems(drafts);
    const attribution = document.getElementById("estimate-attribution");
    if (attribution) attribution.textContent = "Photo estimate · " + (payload.provider || "AI") + " · " + (payload.model || "vision model");
    openDialog(reviewDialog);
  } catch (error) {
    showToast(error instanceof Error ? error.message : "Could not analyse this photo.", "error");
  } finally {
    button.disabled = false;
    button.innerHTML = '<span aria-hidden="true">▧</span> Photo entry';
    photoInput.value = "";
  }
}

async function estimateFood(event: SubmitEvent): Promise<void> {
  event.preventDefault();
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
      fat_g: Math.max(0, Number(item.fat_g) || 0)
    }));
    renderReviewItems(drafts);
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

  let eatenAt: string;
  try {
    eatenAt = toISOStringFromInput(quickTime.value);
  } catch {
    eatenAt = new Date().toISOString();
  }

  const meal = quickMeal.value as MealType;
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
  const entry = entries.find((item) => item.id === id);
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
  historyDate?.addEventListener("change", () => render());
  historySearch?.addEventListener("input", () => render());
  historyClear?.addEventListener("click", () => { if (historyDate) historyDate.value = ""; render(); });
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

  byId<HTMLDivElement>("review-items").addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const removeButton = target.closest<HTMLElement>("[data-remove-review]");
    if (!removeButton) return;
    const index = Number(removeButton.dataset.removeReview);
    renderReviewItems(readReviewDrafts().filter((_, itemIndex) => itemIndex !== index));
  });

  byId<HTMLDivElement>("review-items").addEventListener("input", updateReviewTotal);

  entriesList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const actionButton = target.closest<HTMLButtonElement>("[data-action]");
    if (!actionButton) return;
    const id = actionButton.dataset.id;
    const action = actionButton.dataset.action;
    if (!id) return;

    if (action === "edit") {
      const entry = entries.find((item) => item.id === id);
      if (entry) openManualEntry(entry);
    } else if (action === "delete") {
      void removeFood(id);
    }
  });

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
  const historyDate = document.getElementById("history-date") as HTMLInputElement | null;
  if (historyDate) historyDate.value = localDateKey(new Date());
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
