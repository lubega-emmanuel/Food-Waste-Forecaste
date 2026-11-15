// If any API call says "not logged in", go to the login page
const _fetch = window.fetch;
window.fetch = async (...args) => {
  const res = await _fetch(...args);
  if (res.status === 401) {
    window.location.href = "login.html";
  }
  return res;
};

const API = "api/";

const recordDate = document.getElementById("recordDate");
const recordsBody = document.getElementById("recordsBody");
const itemForm = document.getElementById("itemForm");

// Show a status message
function showMessage(text, type = "ok") {
  const box = document.getElementById("toasts");
  const toast = document.createElement("div");
  toast.className = "toast " + type;
  toast.textContent = text;
  box.appendChild(toast);
  setTimeout(() => toast.classList.add("hide"), 2600);
  setTimeout(() => toast.remove(), 3000);
}

// Escape text before putting it into HTML
function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Waste % = wasted / prepared
function wastePercent(prepared, wasted) {
  if (!prepared) return 0;
  return Math.round((wasted / prepared) * 100);
}

// Load records for the chosen date
async function loadRecords() {
  try {
    const res = await fetch(`${API}records.php?date=${recordDate.value}`);
    if (!res.ok) throw new Error("Server error");
    const items = await res.json();
    renderRecords(items);
  } catch (err) {
    showMessage("Could not load records: " + err.message, "error");
  }
}

// Draw the table rows
function renderRecords(items) {
  if (items.length === 0) {
    recordsBody.innerHTML = `<tr><td colspan="7">No menu items yet. Add one above.</td></tr>`;
    return;
  }

  recordsBody.innerHTML = items
    .map((item) => {
      const pct = wastePercent(item.prepared, item.wasted);
      const cls = pct > 15 ? "waste-high" : "waste-ok";
      return `
        <tr data-id="${item.item_id}">
          <td>${escapeHTML(item.name)}</td>
          <td>${escapeHTML(item.category)}</td>
          <td><input type="number" class="prepared" min="0" value="${item.prepared}"></td>
          <td><input type="number" class="sold" min="0" value="${item.sold}"></td>
          <td><input type="number" class="wasted" min="0" value="${item.wasted}"></td>
          <td class="${cls}">${pct}%</td>
          <td><button class="saveBtn">Save</button></td>
        </tr>`;
    })
    .join("");
}

// Save one row
async function saveRow(row) {
  const payload = {
    item_id: Number(row.dataset.id),
    record_date: recordDate.value,
    prepared: Number(row.querySelector(".prepared").value),
    sold: Number(row.querySelector(".sold").value),
    wasted: Number(row.querySelector(".wasted").value),
  };

  if (payload.sold + payload.wasted > payload.prepared) {
    showMessage("Sold plus wasted can't be more than prepared.", "error");
    return;
  }

  try {
    const res = await fetch(API + "records.php", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await readError(res, "Save failed"));
    showMessage("Saved.");
    loadRecords();
    loadForecast();
    loadStats();
  } catch (err) {
    showMessage(err.message, "error");
  }
}

// Click on any Save button
recordsBody.addEventListener("click", (e) => {
  if (e.target.classList.contains("saveBtn")) {
    saveRow(e.target.closest("tr"));
  }
});

// Add a new menu item
async function saveRow(row) {
  const payload = {
    item_id: Number(row.dataset.id),
    record_date: recordDate.value,
    prepared: Number(row.querySelector(".prepared").value),
    sold: Number(row.querySelector(".sold").value),
    wasted: Number(row.querySelector(".wasted").value),
  };

  if (payload.sold + payload.wasted > payload.prepared) {
    showMessage("Sold plus wasted can't be more than prepared.", "error");
    return;
  }

  try {
    const res = await fetch(API + "records.php", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await readError(res, "Save failed"));
    showMessage("Saved.");
    loadRecords();
    loadForecast();
    loadStats();
  } catch (err) {
    showMessage(err.message, "error");
  }
}

// Reload when the date changes
recordDate.addEventListener("change", loadRecords);

// Start: set today's date and load
// ---------- Forecast ----------
const forecastDate = document.getElementById("forecastDate");
const forecastBody = document.getElementById("forecastBody");
const forecastTitle = document.getElementById("forecastTitle");

async function loadForecast() {
  try {
    const res = await fetch(`${API}forecast.php?date=${forecastDate.value}`);
    if (!res.ok) throw new Error("Server error");
    const data = await res.json();
    renderForecast(data);
  } catch (err) {
    showMessage("Could not load forecast: " + err.message, "error");
  }
}

function renderForecast(data) {
  forecastTitle.textContent = `Forecast for ${data.weekday}, ${data.date}`;
  if (data.items.lenght === 0) {
    forecastBody.innerHTML = '<tr><td colspan="7">Add menu items to see a forecast.</td></tr>';
    return;
  }

  forecastBody.innerHTML = data.items
    .map((f) => {
      if (f.forecast === null) {
        return `<tr>
          <td>${escapeHTML(f.name)}</td>
          <td colspan="6" style="font-size:0.8rem;color:#777">${escapeHTML(f.basis)}</td>
        </tr>`;
      }
      return `<tr>
        <td>${escapeHTML(f.name)}</td>
        <td>${f.forecast}</td>
        <td><span class="prep-badge">${f.suggested_prep}</span></td>
        <td>${f.avg_prepared}</td>
        <td>${f.avg_wasted}</td>
        <td>${Number(f.potential_saving).toLocaleString()}</td>
        <td style="font-size:0.8rem;color:#777">${escapeHTML(f.basis)}</td>
      </tr>`;
    })
    .join("");
}

forecastDate.addEventListener("change", loadForecast);

// Default to tomorrow
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
forecastDate.value = tomorrow.toISOString().slice(0, 10);
loadForecast();

recordDate.value = new Date().toISOString().slice(0, 10);
loadRecords();

// ---------- Dashboard ----------
let dailyChart = null;
let itemChart = null;

async function loadStats() {
  try {
    const days = document.getElementById("rangeSelect").value;
    const res = await fetch(`${API}stats.php?days=${days}`);
    if (!res.ok) throw new Error("Server error");
    const data = await res.json();
    renderStats(data);
    Chart.defaults.color = getComputedStyle(document.body).color;
    Chart.defaults.borderColor = getComputedStyle(document.documentElement).getPropertyValue("--border");

    document.getElementById("dashEmpty").hidden = data.daily.length>0;
    document.getElementById("dashTitle").textContent = "Last" + data.days + " days";
    renderAlerts(data);
  } catch (err) {
    showMessage("Could not load dashboard: " + err.message, "error");
  }
}

function renderStats(data) {
  // Summary cards
  document.getElementById("statWeek").textContent =
    Number(data.summary.week_cost).toLocaleString();
  document.getElementById("statPct").textContent =
    data.summary.avg_waste_pct + "%";
  document.getElementById("statWorst").textContent =
    data.summary.worst_item || "";

  // Remove old charts before drawing new ones
  if (dailyChart) dailyChart.destroy();
  if (itemChart) itemChart.destroy();

  // Line chart: waste cost per day
  dailyChart = new Chart(document.getElementById("dailyChart"), {
    type: "line",
    data: {
      labels: data.daily.map((d) => d.record_date.slice(5)),
      datasets: [
        {
          label: "Waste cost",
          data: data.daily.map((d) => Number(d.cost)),
          borderColor: "#c0392b",
          backgroundColor: "rgba(192,57,43,0.12)",
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    },
  });

  // Bar chart: waste cost per item
  itemChart = new Chart(document.getElementById("itemChart"), {
    type: "bar",
    data: {
      labels: data.per_item.map((i) => i.name),
      datasets: [
        {
          label: "Waste cost",
          data: data.per_item.map((i) => Number(i.cost)),
          backgroundColor: "#1f6f4a",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    },
  });
}

loadStats();

// ---------- User and logout ----------
async function loadUser() {
  const res = await fetch(API + "me.php");
  if (res.ok) {
    const data = await res.json();
    const name = data.username || "?";
    const initial = name.charAt(0).toUpperCase();
    document.getElementById("userName").textContent = name;
    document.getElementById("avatarInitial").textContent = initial;
    document.getElementById("avatarLarge").textContent = initial;
  }
}

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await fetch(API + "logout.php");
  window.location.href = "login.html";
});

loadUser();

// ---------- Tabs ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) =>
      b.classList.toggle("active", b === btn)
    );
    document.querySelectorAll(".tab-panel").forEach((p) =>
      p.classList.toggle("active", p.id === "tab-" + btn.dataset.tab)
    );
    // Redraw charts so they size correctly after being hidden
    if (btn.dataset.tab === "dashboard") loadStats();
    if (btn.dataset.tab === "reports"){ 
      loadWeekly();
      loadPrep();
    }
  });
});

// ---------- Dark mode ----------


// ---------- Menu management ----------
const itemsBody = document.getElementById("itemsBody");
const editDialog = document.getElementById("editDialog");
const editForm = document.getElementById("editForm");
let menuItems = [];

async function readError(res, fallback) {
  try {
    const d = await res.json();
    return d.error || fallback;
  } catch (e) {
    return fallback;
  }
}

function refreshAll() {
  loadItems();
  loadRecords();
  loadForecast();
  loadStats();
}

async function loadItems() {
  try {
    const res = await fetch(API + "items.php");
    if (!res.ok) throw new Error(await readError(res, "Server error"));
    menuItems = await res.json();
    renderItems();
  } catch (err) {
    showMessage("Could not load menu: " + err.message, "error");
  }
}

function renderItems() {
  if (menuItems.length === 0) {
    itemsBody.innerHTML = `<tr><td colspan="4">No menu items yet. Add your first dish above.</td></tr>`;
    return;
  }

  itemsBody.innerHTML = menuItems
    .map(
      (i) => `
      <tr data-id="${i.id}">
        <td>${escapeHTML(i.name)}</td>
        <td>${escapeHTML(i.category)}</td>
        <td>${Number(i.unit_cost).toLocaleString()}</td>
        <td class="actions">
          <button class="editBtn secondary">Edit</button>
          <button class="deleteBtn danger">Delete</button>
        </td>
      </tr>`
    )
    .join("");
}

itemsBody.addEventListener("click", async (e) => {
  const row = e.target.closest("tr");
  if (!row || !row.dataset.id) return;
  const item = menuItems.find((i) => i.id == row.dataset.id);
  if (!item) return;

  if (e.target.classList.contains("editBtn")) {
    document.getElementById("editId").value = item.id;
    document.getElementById("editName").value = item.name;
    document.getElementById("editCategory").value = item.category;
    document.getElementById("editCost").value = item.unit_cost;
    editDialog.showModal();
  }

  if (e.target.classList.contains("deleteBtn")) {
    const ok = confirm(
      `Delete "${item.name}"?\n\nAll of its logged history will be deleted too. This cannot be undone.`
    );
    if (!ok) return;

    try {
      const res = await fetch(`${API}items.php?id=${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readError(res, "Could not delete"));
      showMessage("Item deleted.");
      refreshAll();
    } catch (err) {
      showMessage(err.message, "error");
    }
  }
});

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    id: Number(document.getElementById("editId").value),
    name: document.getElementById("editName").value,
    category: document.getElementById("editCategory").value,
    unit_cost: Number(document.getElementById("editCost").value),
  };

  try {
    const res = await fetch(API + "items.php", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await readError(res, "Could not update"));
    editDialog.close();
    showMessage("Item updated.");
    refreshAll();
  } catch (err) {
    showMessage(err.message, "error");
  }
});

document.getElementById("editCancel").addEventListener("click", () => editDialog.close());

loadItems();

// ---------- Alerts and date range ----------
const WASTE_TARGET = 15; // percent; change this to your own target
const fmt = (n) => Number(n).toLocaleString();

function renderAlerts(data) {
  const box = document.getElementById("alerts");
  const alerts = [];

  if (data.days_since_last !== null && data.days_since_last >= 2) {
    alerts.push({
      type: "warn",
      text: `Nothing has been logged for ${data.days_since_last} days. Forecasts get less accurate when days are missing.`,
    });
  }

  data.week_items.forEach((i) => {
    const pct = wastePercent(Number(i.prepared), Number(i.wasted));
    if (pct > WASTE_TARGET) {
      alerts.push({
        type: "danger",
        text: `${i.name}: ${pct}% wasted in the last 7 days (target ${WASTE_TARGET}%). Consider preparing less.`,
      });
    }
  });

  if (alerts.length === 0 && data.days_since_last !== null) {
    alerts.push({
      type: "ok",
      text: `No alerts. Every dish is within the ${WASTE_TARGET}% waste target this week.`,
    });
  }

  box.innerHTML = alerts
    .map((a) => `<div class="alert ${a.type}">${escapeHTML(a.text)}</div>`)
    .join("");
}

document.getElementById("rangeSelect").addEventListener("change", loadStats);

// ---------- Weekly summary ----------
function changeText(now, prev) {
  if (prev === 0 && now === 0) return "No change";
  if (prev === 0) return "New waste";
  const diff = Math.round(((now - prev) / prev) * 100);
  if (diff === 0) return "No change";
  return (diff > 0 ? "Up " : "Down ") + Math.abs(diff) + "%";
}

async function loadWeekly() {
  try {
    const res = await fetch(API + "weekly.php");
    if (!res.ok) throw new Error(await readError(res, "Server error"));
    renderWeekly(await res.json());
  } catch (err) {
    showMessage("Could not load weekly summary: " + err.message, "error");
  }
}

function renderWeekly(data) {
  const t = data.totals;
  const head = document.getElementById("weeklyHeadline");
  const body = document.getElementById("weeklyBody");

  if (t.prepared === 0 && t.prev_prepared === 0) {
    head.textContent = "No records in the last 14 days yet.";
    body.innerHTML = "";
    return;
  }

  head.textContent =
    `${data.from} to ${data.to}. ` +
    `Waste cost: ${fmt(t.cost)} (${changeText(t.cost, t.prev_cost)} vs ${fmt(t.prev_cost)} the 7 days before). ` +
    `Average waste: ${t.waste_pct}% (before: ${t.prev_waste_pct}%).`;

  const rows = data.items
    .map((i) => {
      const change = changeText(i.cost, i.prev_cost);
      const cls = change.startsWith("Up") || change === "New waste" ? "waste-high" : "waste-ok";
      return `<tr>
        <td>${escapeHTML(i.name)}</td>
        <td>${i.prepared}</td>
        <td>${i.sold}</td>
        <td>${i.wasted}</td>
        <td>${i.waste_pct}%</td>
        <td>${fmt(i.cost)}</td>
        <td>${fmt(i.prev_cost)}</td>
        <td class="${cls}">${change}</td>
      </tr>`;
    })
    .join("");

  const total = `<tr class="total-row">
    <td>Total</td>
    <td>${t.prepared}</td>
    <td>${t.sold}</td>
    <td>${t.wasted}</td>
    <td>${t.waste_pct}%</td>
    <td>${fmt(t.cost)}</td>
    <td>${fmt(t.prev_cost)}</td>
    <td>${changeText(t.cost, t.prev_cost)}</td>
  </tr>`;

  body.innerHTML = rows + total;
}

// ---------- Prep list ----------
const prepDate = document.getElementById("prepDate");
prepDate.value = forecastDate.value; // starts as tomorrow

async function loadPrep() {
  try {
    const res = await fetch(`${API}forecast.php?date=${prepDate.value}`);
    if (!res.ok) throw new Error(await readError(res, "Server error"));
    const data = await res.json();

    document.getElementById("prepTitle").textContent =
      `Prep list for ${data.weekday}, ${data.date}`;

    document.getElementById("prepBody").innerHTML =
      data.items.length === 0
        ? `<tr><td colspan="3">Add menu items first.</td></tr>`
        : data.items
            .map(
              (f) => `<tr>
                <td>${escapeHTML(f.name)}</td>
                <td>${f.suggested_prep === null ? "No history yet" : f.suggested_prep}</td>
                <td><span class="checkbox"></span></td>
              </tr>`
            )
            .join("");
  } catch (err) {
    showMessage("Could not load prep list: " + err.message, "error");
  }
}

prepDate.addEventListener("change", loadPrep);

// ---------- Print / save as PDF ----------
function printSection(which) {
  document.body.dataset.print = which;
  window.print();
}
window.addEventListener("afterprint", () => delete document.body.dataset.print);

document.getElementById("printWeekly").addEventListener("click", () => printSection("weekly"));
document.getElementById("printPrep").addEventListener("click", () => printSection("prep"));

// ---------- CSV export ----------
(function setExportDefaults() {
  const d = new Date();
  document.getElementById("exportTo").value = d.toISOString().slice(0, 10);
  d.setDate(d.getDate() - 30);
  document.getElementById("exportFrom").value = d.toISOString().slice(0, 10);
})();

document.getElementById("exportBtn").addEventListener("click", () => {
  const from = document.getElementById("exportFrom").value;
  const to = document.getElementById("exportTo").value;
  if (!from || !to || from > to) {
    showMessage("Choose a valid date range.", "error");
    return;
  }
  window.location.href = `${API}export.php?from=${from}&to=${to}`;
});

// ---------- Theme settings ----------
function savedTheme() {
  try {
    return localStorage.getItem("theme") || "light";
  } catch (e) {
    return "light";
  }
}

function applyTheme(choice, redraw = true) {
  const resolved =
    choice === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      : choice;

  document.documentElement.setAttribute("data-theme", resolved);
  try { localStorage.setItem("theme", choice); } catch (e) {}

  document.querySelectorAll("[data-theme-choice]").forEach((b) =>
    b.classList.toggle("active", b.dataset.themeChoice === choice)
  );

  if (redraw) loadStats(); // redraw charts with the new colors
}

document.querySelectorAll("[data-theme-choice]").forEach((b) =>
  b.addEventListener("click", () => applyTheme(b.dataset.themeChoice))
);

// If "System" is chosen, follow the computer when it switches
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (savedTheme() === "system") applyTheme("system");
});

applyTheme(savedTheme(), false);

// ---------- Header dropdowns ----------
const headerMenus = [
  ["settingsBtn", "settingsMenu"],
  ["profileBtn", "profileMenu"],
];

function closeMenus() {
  headerMenus.forEach(([btnId, menuId]) => {
    document.getElementById(menuId).hidden = true;
    document.getElementById(btnId).setAttribute("aria-expanded", "false");
  });
}

headerMenus.forEach(([btnId, menuId]) => {
  const btn = document.getElementById(btnId);
  const menu = document.getElementById(menuId);

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = menu.hidden;
    closeMenus();
    menu.hidden = !willOpen;
    btn.setAttribute("aria-expanded", String(willOpen));
  });

  menu.addEventListener("click", (e) => e.stopPropagation());
});

document.addEventListener("click", closeMenus);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMenus();
});