import { createClient } from "@supabase/supabase-js";

type ProviderModel = { id: string; name: string };
type ProviderStatus = {
  provider: string;
  configured: boolean;
  ok: boolean;
  modelCount: number;
  models?: ProviderModel[];
  message?: string;
};
type StatusResponse = { providers?: ProviderStatus[] };

const providerSelect = document.getElementById("quick-provider") as HTMLSelectElement | null;
const modelSelect = document.getElementById("quick-model") as HTMLSelectElement | null;
const modelStatus = document.getElementById("quick-model-status");
const estimateUrl = "/api/estimate";

async function loadModels(): Promise<void> {
  if (!providerSelect || !modelSelect) return;
  const selectedProvider = providerSelect.value;
  modelSelect.replaceChildren();
  if (selectedProvider === "auto") {
    modelSelect.add(new Option("Automatic fallback", ""));
    modelSelect.disabled = true;
    if (modelStatus) modelStatus.textContent = "Automatic fallback is enabled.";
    return;
  }

  modelSelect.disabled = true;
  modelSelect.add(new Option("Loading available models…", ""));
  if (modelStatus) modelStatus.textContent = "Checking models available to your API key…";

  try {
    const response = await fetch("/api/provider-status", { cache: "no-store" });
    const payload = await response.json() as StatusResponse;
    const provider = payload.providers?.find((item) => item.provider === selectedProvider);
    modelSelect.replaceChildren();

    if (!provider?.configured) {
      modelSelect.add(new Option("API key not configured", ""));
      if (modelStatus) modelStatus.textContent = "Add this provider's API key in Vercel.";
      return;
    }
    if (!provider.ok || !provider.models?.length) {
      modelSelect.add(new Option("Model list unavailable", ""));
      if (modelStatus) modelStatus.textContent = provider.message || "Could not retrieve this provider's models.";
      return;
    }

    modelSelect.add(new Option("Use configured default", ""));
    for (const model of provider.models) {
      const label = model.name && model.name !== model.id ? model.name + " · " + model.id : model.id;
      modelSelect.add(new Option(label, model.id));
    }
    modelSelect.disabled = false;
    if (modelStatus) modelStatus.textContent = provider.modelCount.toLocaleString() + " models returned by " + selectedProvider + ".";
  } catch {
    modelSelect.replaceChildren(new Option("Model list unavailable", ""));
    if (modelStatus) modelStatus.textContent = "Could not reach the model-list endpoint.";
  }
}

if (providerSelect && modelSelect) {
  providerSelect.addEventListener("change", () => void loadModels());
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.endsWith(estimateUrl) && typeof init?.body === "string") {
      try {
        const body = JSON.parse(init.body) as Record<string, unknown>;
        if (providerSelect.value !== "auto" && modelSelect.value) body.model = modelSelect.value;
        else delete body.model;
        init = { ...init, body: JSON.stringify(body) };
      } catch {
        // Leave malformed requests unchanged; the API route returns its normal validation error.
      }
    }
    const response = await nativeFetch(input, init);
    if (url.endsWith(estimateUrl)) {
      try {
        const result = await response.clone().json() as { provider?: string; model?: string };
        const attribution = document.getElementById("estimate-attribution");
        if (attribution) {
          attribution.textContent = response.ok && result.provider && result.model
            ? "Estimated with " + result.provider + " · " + result.model
            : "";
        }
      } catch {
        // Ignore non-JSON responses; the existing estimate flow handles the error.
      }
    }
    return response;
  }) as typeof window.fetch;
  void loadModels();
}

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY?.trim();
const accountTrigger = document.getElementById("account-trigger") as HTMLButtonElement | null;
const accountDialog = document.getElementById("account-dialog") as HTMLDialogElement | null;
const accountForm = document.getElementById("account-form") as HTMLFormElement | null;
const accountFields = document.getElementById("account-fields");
const accountStatus = document.getElementById("account-status");
const accountModeToggle = document.getElementById("account-mode-toggle") as HTMLButtonElement | null;
const accountSubmit = document.getElementById("account-submit") as HTMLButtonElement | null;
const accountSignout = document.getElementById("account-signout") as HTMLButtonElement | null;
const accountSessionActions = document.getElementById("account-session-actions");
const accountEmail = document.getElementById("account-email") as HTMLInputElement | null;
const accountPassword = document.getElementById("account-password") as HTMLInputElement | null;
const accountResend = document.getElementById("account-resend") as HTMLButtonElement | null;

if (accountTrigger && accountDialog && accountForm && accountFields && accountStatus && accountModeToggle && accountSubmit && accountSignout && accountSessionActions && accountEmail && accountPassword) {
  if (!supabaseUrl || !supabaseAnonKey) {
    accountTrigger.disabled = true;
    accountTrigger.textContent = "Cloud account unavailable";
    accountStatus.textContent = "Add the public Supabase URL and anon key to enable accounts.";
  } else {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    let mode: "signup" | "signin" = "signup";
    let activeUser: { id: string; email?: string; is_anonymous?: boolean } | null = null;

    const refreshAccount = async (): Promise<void> => {
      const { data } = await supabase.auth.getUser();
      activeUser = data.user as typeof activeUser;
      const signedIn = Boolean(activeUser && !activeUser.is_anonymous);
      accountTrigger.textContent = signedIn ? (activeUser?.email || "My account") : "Guest account";
      accountFields.hidden = signedIn;
      accountSessionActions.hidden = !signedIn;
      accountModeToggle.hidden = signedIn;
      accountStatus.textContent = signedIn
        ? "Signed in as " + activeUser?.email + ". Your diary is synced to this account."
        : "Create an account to keep your diary accessible across devices, or sign in to an existing account.";
      if (!signedIn) setMode("signup");
    };

    const setMode = (nextMode: "signup" | "signin"): void => {
      mode = nextMode;
      accountSubmit.textContent = mode === "signup" ? "Create account" : "Sign in";
      accountModeToggle.textContent = mode === "signup" ? "Already have an account? Sign in" : "New to Trackcake? Create account";
      if (accountPassword) accountPassword.autocomplete = mode === "signup" ? "new-password" : "current-password";
    };

    accountTrigger.addEventListener("click", () => {
      void refreshAccount().then(() => {
        if (!accountDialog.open) accountDialog.showModal();
      });
    });
    accountModeToggle.addEventListener("click", () => setMode(mode === "signup" ? "signin" : "signup"));

    accountForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = accountEmail.value.trim();
      const password = accountPassword.value;
      if (!email || password.length < 8) {
        accountStatus.textContent = "Enter a valid email and a password with at least 8 characters.";
        return;
      }
      accountSubmit.disabled = true;
      accountSubmit.textContent = mode === "signup" ? "Creating…" : "Signing in…";
      try {
        if (mode === "signup") {
          const { data: sessionData } = await supabase.auth.getSession();
          const isGuest = Boolean(sessionData.session?.user.is_anonymous);
          const redirectTo = window.location.origin + "/";

          if (isGuest) {
            // Upgrade the current guest instead of creating a second user.
            // This keeps the guest's cloud diary attached to the same auth user ID.
            const { data, error } = await supabase.auth.updateUser(
              { email, password },
              { emailRedirectTo: redirectTo }
            );
            if (error) throw error;
            if (data.user && !data.user.is_anonymous && sessionData.session) {
              window.location.reload();
              return;
            }
            if (accountResend) accountResend.hidden = false;
            accountStatus.textContent = "Almost there! Supabase sent a verification link to " + email + ". Open it to finish creating your account. Your existing guest diary will stay attached to it.";
          } else {
            const { data, error } = await supabase.auth.signUp({
              email,
              password,
              options: { emailRedirectTo: redirectTo }
            });
            if (error) throw error;
            if (data.session && data.user && !data.user.is_anonymous) {
              window.location.reload();
              return;
            }
            if (accountResend) accountResend.hidden = false;
            accountStatus.textContent = "We sent a verification link to " + email + ". Open that email, confirm your address, then return here to sign in.";
          }
        } else {
          localStorage.setItem("trackcake.guest-backup.entries.v1", localStorage.getItem("trackcake.entries.v1") || "[]");
          localStorage.setItem("trackcake.guest-backup.goal.v1", localStorage.getItem("trackcake.goal.v1") || "2000");
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) {
            if ((error as { code?: string }).code === "email_not_confirmed") {
              if (accountResend) accountResend.hidden = false;
              accountStatus.textContent = "This email hasn't been verified yet. Tap Resend verification email below, then open the link before signing in.";
              return;
            }
            throw error;
          }
          const guestEntries = JSON.parse(localStorage.getItem("trackcake.guest-backup.entries.v1") || "[]") as Array<Record<string, unknown>>;
          const guestGoal = Number(localStorage.getItem("trackcake.guest-backup.goal.v1") || "2000");
          if (data.user && guestEntries.length) {
            // Browser-cached IDs can belong to a different Supabase user.
            // Generate new IDs and INSERT so RLS can never be asked to update another user's row.
            const rows = guestEntries
              .filter((row) => row && typeof row.name === "string" && typeof row.eaten_at === "string")
              .map((row) => ({
                ...row,
                id: crypto.randomUUID(),
                user_id: data.user!.id
              }));
            if (rows.length) {
              const { error: importError } = await supabase.from("food_entries").insert(rows);
              if (importError) throw new Error("You are signed in, but your guest diary could not be copied to your account: " + importError.message);
            }
            const { error: goalError } = await supabase.from("tracker_settings").upsert({
              user_id: data.user.id,
              calorie_goal: Number.isInteger(guestGoal) && guestGoal >= 500 && guestGoal <= 10000 ? guestGoal : 2000
            }, { onConflict: "user_id", ignoreDuplicates: true });
            if (goalError) console.warn("Your existing cloud calorie goal was kept.", goalError);
            localStorage.removeItem("trackcake.guest-backup.entries.v1");
            localStorage.removeItem("trackcake.guest-backup.goal.v1");
          }
          window.location.reload();
          return;
        }
      } catch (error) {
        const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "";
        if (code === "email_not_confirmed") {
          if (accountResend) accountResend.hidden = false;
          accountStatus.textContent = "Please verify your email first. You can resend the confirmation link below.";
        } else {
          accountStatus.textContent = error instanceof Error ? error.message : "Account action failed. Please try again.";
        }
      } finally {
        accountSubmit.disabled = false;
        setMode(mode);
      }
    });

    accountResend?.addEventListener("click", async () => {
      const email = accountEmail.value.trim();
      if (!email) {
        accountStatus.textContent = "Enter your email address first.";
        accountEmail.focus();
        return;
      }
      accountResend.disabled = true;
      accountResend.textContent = "Sending…";
      try {
        const { error } = await supabase.auth.resend({
          type: "signup",
          email,
          options: { emailRedirectTo: window.location.origin + "/" }
        });
        if (error) throw error;
        accountStatus.textContent = "A fresh verification link has been sent to " + email + ". Check your inbox and spam folder.";
      } catch (error) {
        accountStatus.textContent = error instanceof Error ? error.message : "Could not resend the verification email.";
      } finally {
        accountResend.disabled = false;
        accountResend.textContent = "Resend verification email";
      }
    });

    accountSignout.addEventListener("click", async () => {
      accountSignout.disabled = true;
      try {
        localStorage.removeItem("trackcake.entries.v1");
        localStorage.removeItem("trackcake.goal.v1");
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        window.location.reload();
      } catch (error) {
        accountStatus.textContent = error instanceof Error ? error.message : "Could not sign out.";
        accountSignout.disabled = false;
      }
    });

    void refreshAccount();
  }
}
