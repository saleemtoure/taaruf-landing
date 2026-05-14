// Theme toggle: persists choice in localStorage, falls back to OS preference.
const root = document.documentElement;
const stored = localStorage.getItem("theme");
const prefersDark =
  window.matchMedia &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;
const initialTheme = stored ?? (prefersDark ? "dark" : "light");
root.setAttribute("data-theme", initialTheme);

const themeBtn = document.getElementById("themeToggle");
if (themeBtn) {
  themeBtn.addEventListener("click", () => {
    const next =
      root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  });
}

// Waitlist form: POSTs the email to /api/waitlist (Resend audience). On
// success, clears the input and flips the card to its success state. Errors
// re-enable the submit button and surface a quiet inline message.
const form = document.getElementById("waitlistForm");
const formCard = document.getElementById("formcard");
if (form && formCard) {
  const input = form.querySelector('input[type="email"]');
  const honeypot = form.querySelector('input[name="website"]');
  const submit = form.querySelector('button[type="submit"]');

  const ERROR_COPY = {
    invalid_email: "That email doesn't look right.",
    rate_limited: "Too many tries. Give it a few minutes, then try again.",
    forbidden: "We couldn't accept that request.",
    payload_too_large: "That request was too large.",
    upstream_failed: "Our signup service is having a moment. Try again shortly.",
    server_misconfigured: "Signup isn't quite ready. Please try again later.",
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = input.value.trim();
    if (!email) return;

    submit.disabled = true;
    const originalLabel = submit.textContent;
    submit.textContent = "Sending…";
    clearError();

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          website: honeypot ? honeypot.value : "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        const msg = ERROR_COPY[data.error] || "Couldn't add you right now. Please try again.";
        throw new Error(msg);
      }
      input.value = "";
      if (honeypot) honeypot.value = "";
      formCard.classList.add("success");
    } catch (err) {
      showError(err.message || "Couldn't add you right now. Please try again.");
      submit.disabled = false;
      submit.textContent = originalLabel;
    }
  });

  function showError(msg) {
    let el = form.querySelector(".form-error");
    if (!el) {
      el = document.createElement("div");
      el.className = "form-error";
      el.setAttribute("role", "alert");
      form.appendChild(el);
    }
    el.textContent = msg;
  }
  function clearError() {
    const el = form.querySelector(".form-error");
    if (el) el.remove();
  }
}

// Year stamp in the footer.
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();
