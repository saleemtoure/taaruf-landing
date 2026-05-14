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

// Waitlist form: graceful success state. Replace the fetch URL with the real
// endpoint when the waitlist backend is live — until then, the success state
// is shown locally so the page is testable end-to-end.
const form = document.getElementById("waitlistForm");
const formCard = document.getElementById("formcard");
if (form && formCard) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = form.querySelector('input[type="email"]').value.trim();
    if (!email) return;
    // TODO: POST { email } to the waitlist API once it exists.
    formCard.classList.add("success");
  });
}

// Year stamp in the footer.
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();
