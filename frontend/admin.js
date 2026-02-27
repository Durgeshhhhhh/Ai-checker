const APP_CONFIG = window.APP_CONFIG || {};
const API_BASE = APP_CONFIG.API_BASE || "";

if (APP_CONFIG.IS_API_PLACEHOLDER || !APP_CONFIG.API_BASE) {
  console.warn("Set your Render backend URL in frontend/config.js before production deploy.");
}

const token = localStorage.getItem("access_token");
const user = JSON.parse(localStorage.getItem("user") || "null");

if (!token || !user || user.role !== "admin") {
  window.location.href = "login.html";
}

const header = document.getElementById("siteHeader");
const menuBtn = document.getElementById("menuBtn");
const navLinks = document.getElementById("navLinks");
const adminInfo = document.getElementById("adminInfo");

if (adminInfo && user?.email) {
  adminInfo.innerText = user.email;
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

document.getElementById("createUserBtn").onclick = async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const tokens = parseInt(document.getElementById("tokens").value, 10);

  if (!email || !password || Number.isNaN(tokens)) {
    alert("Fill all fields");
    return;
  }

  if (!API_BASE) {
    alert("Backend URL is not configured. Set it in frontend/config.js");
    return;
  }

  const res = await fetch(`${API_BASE}/admin/create-user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    },
    body: JSON.stringify({ email, password, tokens })
  });

  const data = await res.json();

  if (!res.ok) {
    alert("Error: " + (data.detail || "Unable to create user"));
    return;
  }

  alert("User Created");
  location.reload();
};

async function loadUsers() {
  const table = document.getElementById("userTable");

  if (!API_BASE) {
    alert("Backend URL is not configured. Set it in frontend/config.js");
    return;
  }

  const res = await fetch(`${API_BASE}/admin/users`, {
    headers: { "Authorization": "Bearer " + token }
  });
  const users = await res.json();

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      logout();
      return;
    }
    alert("Unable to load users");
    return;
  }

  users.forEach((u) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${u.email}</td>
      <td>${u.tokens}</td>
      <td><button class="recharge" data-id="${u.id}">Recharge</button></td>
      <td><button class="delete" data-id="${u.id}">Delete</button></td>
      <td><button class="view" data-uid="${u.id}">View Logs</button></td>
    `;

    table.appendChild(row);
  });

  attachActions();
}

function attachActions() {
  document.querySelectorAll(".recharge").forEach((btn) => {
    btn.onclick = async () => {
      const uid = btn.dataset.id;
      const amount = prompt("Enter new token amount:");
      if (amount === null) return;
      const tokenCount = parseInt(amount, 10);
      if (Number.isNaN(tokenCount)) {
        alert("Invalid token amount");
        return;
      }

      const res = await fetch(`${API_BASE}/admin/users/${uid}/tokens`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify({ tokens: tokenCount })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.detail || "Failed to update tokens");
        return;
      }

      alert("Tokens Updated");
      location.reload();
    };
  });

  document.querySelectorAll(".delete").forEach((btn) => {
    btn.onclick = async () => {
      const uid = btn.dataset.id;
      if (!confirm("Delete user?")) return;

      const res = await fetch(`${API_BASE}/admin/users/${uid}`, {
        method: "DELETE",
        headers: { "Authorization": "Bearer " + token }
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.detail || "Failed to delete user");
        return;
      }

      alert("User Deleted");
      location.reload();
    };
  });

  document.querySelectorAll(".view").forEach((btn) => {
    btn.onclick = async () => {
      const uid = btn.dataset.uid;
      const logsBox = document.getElementById("logs");

      logsBox.style.display = "block";
      logsBox.innerHTML = "<h2><span class='emoji'>📋</span>User Activity Logs</h2>";

      const res = await fetch(`${API_BASE}/admin/users/${uid}/logs`, {
        headers: { "Authorization": "Bearer " + token }
      });
      const logs = await res.json();

      if (!res.ok) {
        logsBox.innerHTML += "<p>Unable to load logs.</p>";
        return;
      }

      if (!logs.length) {
        logsBox.innerHTML += "<p>No scans found.</p>";
        return;
      }

      logs.forEach((log) => {
        const time = log.timestamp ? new Date(log.timestamp).toLocaleString() : "N/A";
        const scanText = (log.scanned_text || "").slice(0, 1000);

        logsBox.innerHTML += `
          <div class="log-card">
            <b>Result:</b> ${escapeHtml(log.result || "N/A")}<br>
            <b>AI:</b> ${log.ai_percent ?? 0}% |
            <b>Human:</b> ${log.human_percent ?? 0}%<br>
            <b>Time:</b> ${escapeHtml(time)}<br>
            <b>Scanned Text:</b>
            <div class="log-text">${escapeHtml(scanText)}${(log.scanned_text || "").length > 1000 ? "..." : ""}</div>
          </div>
        `;
      });
    };
  });
}

loadUsers();
