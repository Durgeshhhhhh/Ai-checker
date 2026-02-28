const APP_CONFIG = window.APP_CONFIG || {};
const API_BASE = APP_CONFIG.API_BASE || "";

if (APP_CONFIG.IS_API_PLACEHOLDER || !APP_CONFIG.API_BASE) {
  console.warn("Set your Render backend URL in frontend/config.js before production deploy.");
}

const header = document.getElementById("siteHeader");
const menuBtn = document.getElementById("menuBtn");
const navLinks = document.getElementById("navLinks");

function closeMenu() {
  navLinks.classList.remove("open");
  menuBtn.setAttribute("aria-expanded", "false");
}
window.closeMenu = closeMenu;

menuBtn.addEventListener("click", () => {
  const willOpen = !navLinks.classList.contains("open");
  navLinks.classList.toggle("open", willOpen);
  menuBtn.setAttribute("aria-expanded", willOpen ? "true" : "false");
});

document.querySelectorAll(".nav-links-wrap a").forEach((link) => {
  link.addEventListener("click", closeMenu);
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 900) {
    closeMenu();
  }
});

window.addEventListener("scroll", () => {
  header.classList.toggle("scrolled", window.scrollY > 18);
});

async function performLogin() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const error = document.getElementById("error");

  error.innerText = "";

  if (!email || !password) {
    error.innerText = "Enter email and password.";
    return;
  }

  if (!API_BASE) {
    error.innerText = "Backend URL is not configured. Set it in frontend/config.js";
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) {
      error.innerText = data.detail || "Login failed";
      return;
    }

    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("user", JSON.stringify(data.user));

    if (data.user.role === "admin" || data.user.role === "super_admin") {
      window.location.href = "admin.html";
    } else {
      window.location.href = "prediction.html";
    }
  } catch (err) {
    error.innerText = "Server not reachable";
  }
}

document.getElementById("loginBtn").addEventListener("click", performLogin);
document.getElementById("password").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    performLogin();
  }
});
