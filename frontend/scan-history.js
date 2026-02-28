const APP_CONFIG = window.APP_CONFIG || {};
const API_BASE = APP_CONFIG.API_BASE || "";

if (APP_CONFIG.IS_API_PLACEHOLDER || !APP_CONFIG.API_BASE) {
    console.warn("Set your Render backend URL in frontend/config.js before production deploy.");
}

const token = localStorage.getItem("access_token");
const user = JSON.parse(localStorage.getItem("user") || "null");

if (!token || !user) {
    window.location.href = "login.html";
}

const header = document.getElementById("siteHeader");
const menuBtn = document.getElementById("menuBtn");
const navLinks = document.getElementById("navLinks");
const userInfo = document.getElementById("userInfo");

if (userInfo && user?.email) {
    userInfo.innerText = user.email;
}
const adminNavLink = document.getElementById("adminNavLink");
if (adminNavLink && user && (user.role === "admin" || user.role === "super_admin")) {
    adminNavLink.style.display = "inline-flex";
}

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

window.logout = function() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    window.location.href = "index.html";
};

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

async function loadHistory() {
    const historyList = document.getElementById("historyList");

    if (!API_BASE) {
        historyList.innerHTML = "<div class='history-item'>Backend URL not configured.</div>";
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/my-history`, {
            headers: { "Authorization": "Bearer " + token }
        });

        const data = await response.json();
        if (!response.ok) {
            historyList.innerHTML = "<div class='history-item'>Unable to load history.</div>";
            return;
        }

        const sorted = [...data].sort((a, b) => {
            const aTime = new Date(a.timestamp || 0).getTime();
            const bTime = new Date(b.timestamp || 0).getTime();
            return bTime - aTime;
        });

        if (!sorted.length) {
            historyList.innerHTML = "<div class='history-item'>No scans yet.</div>";
            return;
        }

        historyList.innerHTML = sorted.map((log) => {
            const time = log.timestamp ? new Date(log.timestamp).toLocaleString() : "N/A";
            const text = (log.scanned_text || "").slice(0, 800);

            return `
                <article class="history-item">
                    <div class="history-meta">
                        Result: ${escapeHtml(log.result || "N/A")} |
                        AI: ${log.ai_percent ?? 0}% |
                        Human: ${log.human_percent ?? 0}% |
                        Time: ${escapeHtml(time)}
                    </div>
                    <p class="history-text">${escapeHtml(text)}${(log.scanned_text || "").length > 800 ? "..." : ""}</p>
                </article>
            `;
        }).join("");
    } catch (error) {
        historyList.innerHTML = "<div class='history-item'>Unable to load history.</div>";
    }
}

loadHistory();
