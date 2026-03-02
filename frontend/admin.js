const APP_CONFIG = window.APP_CONFIG || {};
const API_BASE = APP_CONFIG.API_BASE || "";

if (APP_CONFIG.IS_API_PLACEHOLDER || !APP_CONFIG.API_BASE) {
  console.warn("Set your Render backend URL in frontend/config.js before production deploy.");
}

const token = localStorage.getItem("access_token");
const user = JSON.parse(localStorage.getItem("user") || "null");
const isSuperAdmin = !!(user && user.role === "super_admin");
const isAdminPanelRole = !!(user && (user.role === "admin" || user.role === "super_admin"));

if (!token || !isAdminPanelRole) {
  window.location.href = "login.html";
}

const header = document.getElementById("siteHeader");
const menuBtn = document.getElementById("menuBtn");
const navLinks = document.getElementById("navLinks");
const adminInfo = document.getElementById("adminInfo");
const createTitle = document.getElementById("createTitle");
const listTitle = document.getElementById("listTitle");
const createHint = document.getElementById("createHint");
const createUserBtn = document.getElementById("createUserBtn");
const accountRole = document.getElementById("accountRole");
const maxUsersInput = document.getElementById("maxUsers");
const emailInput = document.getElementById("email");
const allocationSummaryCard = document.getElementById("allocationSummaryCard");
const allocationSummary = document.getElementById("allocationSummary");
const adminRequestsCard = document.getElementById("adminRequestsCard");
const adminRequestsTable = document.getElementById("adminRequestsTable");
const profileModal = document.getElementById("profileModal");
const openProfileBtn = document.getElementById("openProfileBtn");
const closeProfileBtn = document.getElementById("closeProfileBtn");
const profileContent = document.getElementById("profileContent");
const editUserModal = document.getElementById("editUserModal");
const closeEditUserBtn = document.getElementById("closeEditUserBtn");
const editUserMeta = document.getElementById("editUserMeta");
const editUserEmail = document.getElementById("editUserEmail");
const editUserPassword = document.getElementById("editUserPassword");
const editUserOrg = document.getElementById("editUserOrg");
const editUserHint = document.getElementById("editUserHint");
const saveEditUserBtn = document.getElementById("saveEditUserBtn");
let activeEditUserId = null;

if (adminInfo && user && user.email) {
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

function summaryBox(label, value) {
  return `
    <div class="summary-item">
      <div class="label">${escapeHtml(label)}</div>
      <div class="value">${escapeHtml(String(value))}</div>
    </div>
  `;
}

function openProfileModal() {
  if (!profileModal) return;
  profileModal.classList.add("show");
  profileModal.setAttribute("aria-hidden", "false");
}

function closeProfileModal() {
  if (!profileModal) return;
  profileModal.classList.remove("show");
  profileModal.setAttribute("aria-hidden", "true");
}

function openEditUserModal() {
  if (!editUserModal) return;
  editUserModal.classList.add("show");
  editUserModal.setAttribute("aria-hidden", "false");
}

function closeEditUserModal() {
  if (!editUserModal) return;
  editUserModal.classList.remove("show");
  editUserModal.setAttribute("aria-hidden", "true");
  activeEditUserId = null;
}

function setupRoleUi() {
  if (!createTitle || !listTitle || !createHint || !createUserBtn || !accountRole) {
    return;
  }

  if (isSuperAdmin) {
    accountRole.innerHTML = '<option value="admin">Admin</option>';
    accountRole.style.display = "inline-block";
    if (maxUsersInput) {
      maxUsersInput.style.display = "inline-block";
      maxUsersInput.value = "5";
      maxUsersInput.placeholder = "Max Users Admin Can Create";
    }
    createTitle.innerHTML = "<span class='emoji'>&#128100;</span>Create Admin";
    listTitle.innerHTML = "<span class='emoji'>&#128202;</span>Admin List";
    createHint.innerText = "Super admin can create admins and set user limit per admin.";
    createUserBtn.innerText = "Create Admin";
    if (emailInput) {
      emailInput.placeholder = "Organization Email ID";
    }
    return;
  }

  accountRole.innerHTML = '<option value="user">User</option>';
  accountRole.style.display = "none";
  if (maxUsersInput) {
    maxUsersInput.style.display = "none";
    maxUsersInput.value = "";
  }
  createTitle.innerHTML = "<span class='emoji'>&#128100;</span>Create User";
  listTitle.innerHTML = "<span class='emoji'>&#128202;</span>User List";
  createHint.innerText = "Admin can create users up to the assigned limit.";
  createUserBtn.innerText = "Create User";
  if (emailInput) {
    emailInput.placeholder = "User Email";
  }
}

function renderTableHeader(table) {
  if (isSuperAdmin) {
    table.innerHTML = `
      <tr>
        <th>Email</th>
        <th>Tokens</th>
        <th>Max Users</th>
        <th>Recharge</th>
        <th>Set Limit</th>
        <th>Delete</th>
        <th>Logs</th>
      </tr>
    `;
    return;
  }

  table.innerHTML = `
    <tr>
      <th>Email</th>
      <th>Tokens</th>
      <th>Recharge</th>
      <th>Delete</th>
      <th>Logs</th>
    </tr>
  `;
}

async function loadAllocationSummary() {
  if (!allocationSummaryCard || !allocationSummary) {
    return;
  }
  allocationSummaryCard.style.display = "block";

  if (!API_BASE) {
    allocationSummary.innerHTML = "<p>Backend URL is not configured.</p>";
    return;
  }

  const res = await fetch(`${API_BASE}/admin/me-summary`, {
    headers: { "Authorization": "Bearer " + token }
  });
  const data = await res.json();

  if (!res.ok) {
    allocationSummary.innerHTML = `<p>${escapeHtml(data.detail || "Unable to load summary")}</p>`;
    return;
  }

  if (data.role !== "admin") {
    allocationSummary.innerHTML = "<p>Super admin dashboard. Create admins and manage token/user limits.</p>";
    if (profileContent) {
      profileContent.innerHTML = [
        summaryBox("Email", data.email || ""),
        summaryBox("Organization Name", data.organization_name || "-"),
        summaryBox("Role", data.role || ""),
        summaryBox("Current Tokens", data.tokens || 0)
      ].join("");
    }
    return;
  }

  allocationSummary.innerHTML = [
    summaryBox("Total Tokens Allocated", data.total_tokens_allocated || 0),
    summaryBox("Remaining Tokens", data.remaining_tokens || 0),
    summaryBox("Used Tokens", data.used_tokens || 0),
    summaryBox("User Limit", data.max_users_allowed || 0),
    summaryBox("Users Created", data.current_users_count || 0),
    summaryBox("Remaining User Slots", data.remaining_user_slots || 0)
  ].join("");

  if (profileContent) {
    profileContent.innerHTML = [
      summaryBox("Email", data.email || ""),
      summaryBox("Organization Name", data.organization_name || "-"),
      summaryBox("Role", data.role || ""),
      summaryBox("Total Tokens Allocated", data.total_tokens_allocated || 0),
      summaryBox("Remaining Tokens", data.remaining_tokens || 0),
      summaryBox("User Limit", data.max_users_allowed || 0),
      summaryBox("Users Created", data.current_users_count || 0)
    ].join("");
  }
}

async function createAccount() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const tokens = parseInt(document.getElementById("tokens").value, 10);
  const role = isSuperAdmin ? "admin" : "user";

  if (!email || !password || Number.isNaN(tokens)) {
    alert("Fill all fields");
    return;
  }

  let maxUsers = null;
  if (isSuperAdmin) {
    maxUsers = parseInt((maxUsersInput && maxUsersInput.value) || "", 10);
    if (Number.isNaN(maxUsers) || maxUsers < 0) {
      alert("Enter valid max users (0 or more)");
      return;
    }
  }

  if (!API_BASE) {
    alert("Backend URL is not configured. Set it in frontend/config.js");
    return;
  }

  const payload = { email, password, tokens, role };
  if (isSuperAdmin) {
    payload.max_users = maxUsers;
  }

  const res = await fetch(`${API_BASE}/admin/create-user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  if (!res.ok) {
    alert("Error: " + (data.detail || "Unable to create account"));
    return;
  }

  alert(isSuperAdmin ? "Admin Created" : "User Created");
  location.reload();
}

document.getElementById("createUserBtn").onclick = createAccount;

async function loadAdminRequests() {
  if (!isSuperAdmin || !adminRequestsCard || !adminRequestsTable) {
    return;
  }

  adminRequestsCard.style.display = "block";

  const res = await fetch(`${API_BASE}/admin/admin-requests`, {
    headers: { "Authorization": "Bearer " + token }
  });
  const requests = await res.json();

  if (!res.ok) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="6">${escapeHtml(requests.detail || "Unable to load requests")}</td>`;
    adminRequestsTable.appendChild(row);
    return;
  }

  if (!requests.length) {
    const row = document.createElement("tr");
    row.innerHTML = "<td colspan='6'>No pending requests.</td>";
    adminRequestsTable.appendChild(row);
    return;
  }

  requests.forEach((r) => {
    const row = document.createElement("tr");
    const time = r.requested_at ? new Date(r.requested_at).toLocaleString() : "N/A";
    row.innerHTML = `
      <td>${escapeHtml(r.organization_name || "-")}</td>
      <td>${escapeHtml(r.email || "")}</td>
      <td>${r.requested_tokens || 0}</td>
      <td>${r.requested_max_users || 0}</td>
      <td>${escapeHtml(time)}</td>
      <td>
        <button class="approve" data-request-id="${r.id}">Approve</button>
        <button class="reject" data-request-id="${r.id}">Reject</button>
      </td>
    `;
    adminRequestsTable.appendChild(row);
  });

  attachRequestActions();
}

async function loadUsers() {
  const table = document.getElementById("userTable");
  renderTableHeader(table);

  if (!API_BASE) {
    alert("Backend URL is not configured. Set it in frontend/config.js");
    return;
  }

  const res = await fetch(`${API_BASE}/admin/users`, {
    headers: { "Authorization": "Bearer " + token }
  });
  const users = await res.json();

  if (!res.ok) {
    if (res.status === 401) {
      window.logout();
      return;
    }
    alert((users && users.detail) || "Unable to load users");
    return;
  }

  if (!users.length) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="${isSuperAdmin ? 7 : 5}">No accounts found.</td>`;
    table.appendChild(row);
    return;
  }

  users.forEach((u) => {
    const row = document.createElement("tr");

    if (isSuperAdmin) {
      row.innerHTML = `
        <td><button class="email-link" data-id="${u.id}" title="Edit account">${escapeHtml(u.email || "")}</button></td>
        <td>${u.tokens || 0}</td>
        <td>${u.max_users_allowed || 0}</td>
        <td><button class="recharge" data-id="${u.id}" data-tokens="${u.tokens || 0}">Recharge</button></td>
        <td><button class="limit" data-id="${u.id}">Set Limit</button></td>
        <td><button class="delete" data-id="${u.id}">Delete</button></td>
        <td><button class="view" data-uid="${u.id}">View Logs</button></td>
      `;
    } else {
      row.innerHTML = `
        <td><button class="email-link" data-id="${u.id}" title="Edit account">${escapeHtml(u.email || "")}</button></td>
        <td>${u.tokens || 0}</td>
        <td><button class="recharge" data-id="${u.id}" data-tokens="${u.tokens || 0}">Recharge</button></td>
        <td><button class="delete" data-id="${u.id}">Delete</button></td>
        <td><button class="view" data-uid="${u.id}">View Logs</button></td>
      `;
    }

    table.appendChild(row);
  });

  attachActions();
}

function attachActions() {
  document.querySelectorAll(".email-link").forEach((btn) => {
    btn.onclick = async () => {
      const uid = btn.dataset.id;
      if (!uid) return;
      await loadUserDetailsForEdit(uid);
    };
  });

  document.querySelectorAll(".recharge").forEach((btn) => {
    btn.onclick = async () => {
      const uid = btn.dataset.id;
      const currentTokens = parseInt(btn.dataset.tokens || "0", 10);
      const amount = prompt(`Enter tokens to add (current: ${currentTokens}):`);
      if (amount === null) return;
      const tokenCount = parseInt(amount, 10);
      if (Number.isNaN(tokenCount) || tokenCount < 0) {
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

  document.querySelectorAll(".limit").forEach((btn) => {
    btn.onclick = async () => {
      const uid = btn.dataset.id;
      const amount = prompt("Enter user-limit count to add for this admin:");
      if (amount === null) return;
      const maxUsers = parseInt(amount, 10);
      if (Number.isNaN(maxUsers) || maxUsers < 0) {
        alert("Invalid limit value");
        return;
      }

      const res = await fetch(`${API_BASE}/admin/users/${uid}/max-users`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify({ max_users: maxUsers })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.detail || "Failed to update max users");
        return;
      }

      alert("Max Users Updated");
      location.reload();
    };
  });

  document.querySelectorAll(".delete").forEach((btn) => {
    btn.onclick = async () => {
      const uid = btn.dataset.id;
      if (!confirm("Delete account?")) return;

      const res = await fetch(`${API_BASE}/admin/users/${uid}`, {
        method: "DELETE",
        headers: { "Authorization": "Bearer " + token }
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.detail || "Failed to delete user");
        return;
      }

      alert("Account Deleted");
      location.reload();
    };
  });

  document.querySelectorAll(".view").forEach((btn) => {
    btn.onclick = async () => {
      const uid = btn.dataset.uid;
      const logsBox = document.getElementById("logs");

      logsBox.style.display = "block";
      logsBox.innerHTML = "<h2><span class='emoji'>&#128203;</span>Activity Logs</h2>";

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
            <b>AI:</b> ${log.ai_percent || 0}% |
            <b>Human:</b> ${log.human_percent || 0}%<br>
            <b>Time:</b> ${escapeHtml(time)}<br>
            <b>Scanned Text:</b>
            <div class="log-text">${escapeHtml(scanText)}${(log.scanned_text || "").length > 1000 ? "..." : ""}</div>
          </div>
        `;
      });
    };
  });
}

async function loadUserDetailsForEdit(userId) {
  if (!API_BASE) {
    alert("Backend URL is not configured. Set it in frontend/config.js");
    return;
  }

  const res = await fetch(`${API_BASE}/admin/users/${userId}/details`, {
    headers: { "Authorization": "Bearer " + token }
  });
  const data = await res.json();
  if (!res.ok) {
    alert(data.detail || "Unable to load account details");
    return;
  }

  activeEditUserId = userId;
  editUserEmail.value = data.email || "";
  editUserPassword.value = data.password_plain || "";
  if (editUserOrg) {
    editUserOrg.value = data.organization_name || "";
    editUserOrg.style.display = data.role === "admin" ? "inline-block" : "none";
  }

  if (editUserMeta) {
    const metaItems = [
      summaryBox("Role", data.role || ""),
      summaryBox("Current Tokens", data.tokens || 0),
    ];
    if (data.role === "admin") {
      metaItems.push(summaryBox("Current Max Users", data.max_users_allowed || 0));
    }
    editUserMeta.innerHTML = metaItems.join("");
  }
  if (editUserHint) {
    editUserHint.innerText = "Edit email/password here. Use Recharge and Set Limit buttons for allocation changes.";
  }

  openEditUserModal();
}

async function saveUserDetails() {
  if (!activeEditUserId) return;

  const payload = {
    email: (editUserEmail.value || "").trim(),
    password: (editUserPassword.value || "").trim(),
    organization_name: editUserOrg && editUserOrg.style.display !== "none"
      ? (editUserOrg.value || "").trim()
      : undefined,
  };

  const res = await fetch(`${API_BASE}/admin/users/${activeEditUserId}/details`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    alert(data.detail || "Unable to update account");
    return;
  }

  alert("Account details updated");
  location.reload();
}

function attachRequestActions() {
  document.querySelectorAll(".approve").forEach((btn) => {
    btn.onclick = async () => {
      const reqId = btn.dataset.requestId;
      const res = await fetch(`${API_BASE}/admin/admin-requests/${reqId}/approve`, {
        method: "POST",
        headers: { "Authorization": "Bearer " + token }
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.detail || "Failed to approve request");
        return;
      }
      if (data.email_sent) {
        alert("Request approved and email sent.");
      } else {
        alert("Request approved, but email was not sent. Check SMTP settings.");
      }
      location.reload();
    };
  });

  document.querySelectorAll(".reject").forEach((btn) => {
    btn.onclick = async () => {
      const reqId = btn.dataset.requestId;
      if (!confirm("Reject this request?")) return;
      const reason = prompt("Reason (optional):") || "";
      const res = await fetch(`${API_BASE}/admin/admin-requests/${reqId}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.detail || "Failed to reject request");
        return;
      }
      alert("Request rejected");
      location.reload();
    };
  });
}

if (openProfileBtn) {
  openProfileBtn.addEventListener("click", openProfileModal);
}
if (closeProfileBtn) {
  closeProfileBtn.addEventListener("click", closeProfileModal);
}
if (profileModal) {
  profileModal.addEventListener("click", (event) => {
    if (event.target === profileModal) {
      closeProfileModal();
    }
  });
}
if (closeEditUserBtn) {
  closeEditUserBtn.addEventListener("click", closeEditUserModal);
}
if (editUserModal) {
  editUserModal.addEventListener("click", (event) => {
    if (event.target === editUserModal) {
      closeEditUserModal();
    }
  });
}
if (saveEditUserBtn) {
  saveEditUserBtn.addEventListener("click", saveUserDetails);
}

setupRoleUi();
loadAllocationSummary();
loadAdminRequests();
loadUsers();
