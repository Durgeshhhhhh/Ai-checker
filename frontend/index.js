const APP_CONFIG = window.APP_CONFIG || {};
const API_BASE = APP_CONFIG.API_BASE || "";

if (APP_CONFIG.IS_API_PLACEHOLDER || !APP_CONFIG.API_BASE) {
    console.warn("Set your Render backend URL in frontend/config.js before production deploy.");
}

const header = document.querySelector(".site-header");
const menuBtn = document.getElementById("menuBtn");
const navLinks = document.getElementById("navLinks");
const loginModal = document.getElementById("loginModal");

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

window.openLogin = () => {
    loginModal.classList.add("show");
};

window.closeLogin = () => {
    loginModal.classList.remove("show");
};

loginModal.addEventListener("click", (event) => {
    if (event.target === loginModal) {
        window.closeLogin();
    }
});

window.login = async () => {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!email || !password) {
        alert("Enter email and password");
        return;
    }
    if (!API_BASE) {
        alert("Backend URL is not configured. Set it in frontend/config.js");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        const data = await res.json();
        if (!res.ok) {
            alert(data.detail || "Login failed");
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
        alert("Server not reachable");
    }
};
