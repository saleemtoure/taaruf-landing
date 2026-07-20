// Theme toggle: persists the visitor's choice in localStorage.
//
// Light is the default for a first visit, deliberately — the OS preference is
// no longer consulted. The page is a calm, paper-toned reading surface and
// light is the intended presentation; a dark-by-default first impression for
// anyone whose OS happens to be dark was showing the design as it wasn't meant
// to be seen. Anyone who prefers dark is one tap away, and that choice sticks.
const root = document.documentElement;
const stored = localStorage.getItem("theme");
const initialTheme = stored ?? "light";
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

// Year stamp in the footer.
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();
