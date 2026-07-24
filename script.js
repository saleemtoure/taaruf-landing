// Theme toggle: persists the visitor's choice in localStorage.
//
// Dark ("midnight") is the default for a first visit, deliberately. This
// reverses the previous light-first default, and the reasoning behind that
// default no longer holds: it existed because the page was a calm, paper-toned
// reading surface that a dark first paint misrepresented. The page is now
// designed midnight-first — the glow, the card shadows and the accent are all
// tuned for the dark direction — so light is the alternate, not the intent.
//
// The OS preference is still not consulted, for the same reason as before: the
// page has an intended presentation and should open in it. Anyone who prefers
// light is one tap away, and that choice sticks.
//
// The attribute itself is set by a small blocking script in each page's <head>,
// because this file runs at the end of the body and would otherwise let a
// light-preferring visitor watch the page paint midnight and then flip. This
// only reads it back. styles.css declares the dark tokens on bare :root too, so
// all three agree on the default — change one, change all three.
const root = document.documentElement;
if (!root.getAttribute("data-theme")) root.setAttribute("data-theme", "dark");

const themeBtn = document.getElementById("themeToggle");
if (themeBtn) {
  themeBtn.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  });
}

// The sticky nav is borderless over the hero and grows a hairline rule once the
// page has scrolled past it, so it reads as a layer rather than a band.
const topnav = document.getElementById("topnav");
if (topnav) {
  const onScroll = () => topnav.classList.toggle("scrolled", window.scrollY > 8);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

// Year stamp in the footer.
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();
