import { createClient } from "@supabase/supabase-js";

type ProviderModel = { id: string; name: string };
type ProviderStatus = { provider: string; configured: boolean; ok: boolean; modelCount: number; models?: ProviderModel[] };
type ChatMessage = { id?: string; role: "user" | "assistant"; content: string; created_at?: string };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const launcher = $("calkie-launcher") as HTMLButtonElement;
const panel = $("calkie-panel");
const closeButton = $("calkie-close") as HTMLButtonElement;
const form = $("calkie-form") as HTMLFormElement;
const input = $("calkie-input") as HTMLTextAreaElement;
const sendButton = $("calkie-send") as HTMLButtonElement;
const messages = $("calkie-messages");
const providerSelect = $("calkie-provider") as HTMLSelectElement;
const modelSelect = $("calkie-model") as HTMLSelectElement;
const suggestions = $("calkie-suggestions");
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL?.trim();
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY?.trim();
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
}) : null;

let historyLoaded = false;
let sending = false;

function addBubble(role: "user" | "assistant" | "error", content: string): void {
  const bubble = document.createElement("div");
  bubble.className = "calkie-message " + role;
  bubble.textContent = content;
  messages.append(bubble);
  messages.scrollTop = messages.scrollHeight;
}

function clearWelcome(): void {
  messages.querySelector(".calkie-welcome")?.remove();
}

async function getAccessToken(): Promise<string> {
  if (!supabase) throw new Error("Calkie needs Supabase cloud sync. Configure your TrackCake account first.");
  let { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) {
    const created = await supabase.auth.signInAnonymously();
    if (created.error) throw created.error;
    data = { session: created.data.session };
  }
  if (!data.session?.access_token) throw new Error("Please sign in to use your private Calkie assistant.");
  return data.session.access_token;
}

async function loadHistory(): Promise<void> {
  if (historyLoaded) return;
  try {
    const token = await getAccessToken();
    const response = await fetch("/api/assistant", { headers: { Authorization: "Bearer " + token }, cache: "no-store" });
    const payload = await response.json() as { messages?: ChatMessage[]; error?: string };
    if (!response.ok) throw new Error(payload.error || "Could not load your chat history.");
    if (payload.messages?.length) {
      clearWelcome();
      for (const message of payload.messages) addBubble(message.role, message.content);
    }
    historyLoaded = true;
  } catch (error) {
    clearWelcome();
    addBubble("error", error instanceof Error ? error.message : "Could not load Calkie's history.");
  }
}

async function loadModels(): Promise<void> {
  const provider = providerSelect.value;
  modelSelect.replaceChildren();
  if (provider === "auto") {
    modelSelect.add(new Option("Automatic fallback", ""));
    modelSelect.disabled = true;
    return;
  }
  modelSelect.disabled = true;
  modelSelect.add(new Option("Loading models…", ""));
  try {
    const response = await fetch("/api/provider-status", { cache: "no-store" });
    const payload = await response.json() as { providers?: ProviderStatus[] };
    const selected = payload.providers?.find((item) => item.provider === provider);
    modelSelect.replaceChildren();
    if (!selected?.configured || !selected.ok || !selected.models?.length) {
      modelSelect.add(new Option("No models available", ""));
      return;
    }
    modelSelect.add(new Option("Use provider default", ""));
    for (const model of selected.models) modelSelect.add(new Option(model.name === model.id ? model.id : model.name + " · " + model.id, model.id));
    modelSelect.disabled = false;
  } catch {
    modelSelect.replaceChildren(new Option("Could not load models", ""));
  }
}

async function sendMessage(message: string): Promise<void> {
  if (sending || !message.trim()) return;
  sending = true;
  sendButton.disabled = true;
  input.disabled = true;
  suggestions.hidden = true;
  clearWelcome();
  addBubble("user", message);
  const typing = document.createElement("div");
  typing.className = "calkie-typing";
  typing.textContent = "Calkie is checking your diary…";
  messages.append(typing);
  messages.scrollTop = messages.scrollHeight;
  try {
    const token = await getAccessToken();
    const response = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({
        message,
        provider: providerSelect.value || "auto",
        model: modelSelect.value || undefined,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      })
    });
    const payload = await response.json() as { answer?: string; error?: string; provider?: string; model?: string };
    if (!response.ok) throw new Error(payload.error || "Calkie could not answer.");
    addBubble("assistant", payload.answer || "I couldn't find an answer in your diary.");
    const attribution = document.createElement("div");
    attribution.className = "calkie-typing";
    attribution.textContent = "Answered with " + payload.provider + " · " + payload.model;
    messages.append(attribution);
  } catch (error) {
    addBubble("error", error instanceof Error ? error.message : "Something went wrong. Please try again.");
  } finally {
    typing.remove();
    sending = false;
    sendButton.disabled = false;
    input.disabled = false;
    input.focus();
    messages.scrollTop = messages.scrollHeight;
  }
}

const setCalkieOpen = (open: boolean): void => {
  panel.hidden = !open;
  document.body.classList.toggle("calkie-open", open);
  launcher.setAttribute("aria-expanded", String(open));
  if (open) void loadHistory();
};

launcher.setAttribute("aria-expanded", "false");
launcher.addEventListener("click", () => {
  const opening = panel.hidden;
  setCalkieOpen(opening);
  // Do not summon the mobile keyboard merely by opening the assistant.
  if (opening && !window.matchMedia("(pointer: coarse)").matches) input.focus();
});
closeButton.addEventListener("click", () => setCalkieOpen(false));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !panel.hidden) setCalkieOpen(false);
});
providerSelect.addEventListener("change", () => void loadModels());
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message) return;
  input.value = "";
  void sendMessage(message);
});
suggestions.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const button = target.closest<HTMLButtonElement>("[data-prompt]");
  const prompt = button?.dataset.prompt;
  if (prompt) void sendMessage(prompt);
});
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});
void loadModels();
