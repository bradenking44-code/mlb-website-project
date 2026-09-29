const DATA_URL = "data/processed/payroll_dashboard_data.json";

const labels = {
  win_rate: "Win rate",
  wins: "Wins",
  run_differential: "Run differential",
  payroll_millions: "Payroll millions",
  cost_per_win: "Cost per win",
  attendance: "Attendance",
  runs: "Runs scored",
  team_name: "Team",
  league: "League",
  payroll_tier: "Payroll tier",
  year: "Year",
};

const palette = ["#c82432", "#071d3a", "#27724f", "#d7a43b", "#6f4bb3", "#1e88a8", "#9e1d29", "#5c6f82"];
const teamLooks = {
  Yankees: ["#0c2340", "#c4ced4", "NYY"],
  Dodgers: ["#005a9c", "#ef3e42", "LAD"],
  "Red Sox": ["#bd3039", "#0c2340", "BOS"],
  Mets: ["#002d72", "#ff5910", "NYM"],
  Cubs: ["#0e3386", "#cc3433", "CHC"],
  Cardinals: ["#c41e3a", "#fedb00", "STL"],
  Giants: ["#fd5a1e", "#27251f", "SF"],
  Athletics: ["#003831", "#efb21e", "OAK"],
  Braves: ["#13274f", "#ce1141", "ATL"],
  Phillies: ["#e81828", "#002d72", "PHI"],
  Tigers: ["#0c2340", "#fa4616", "DET"],
  Mariners: ["#0c2c56", "#005c5c", "SEA"],
  Orioles: ["#df4601", "#000000", "BAL"],
  Royals: ["#004687", "#bd9b60", "KC"],
  Marlins: ["#00a3e0", "#ef3340", "MIA"],
  "Blue Jays": ["#134a8e", "#e8291c", "TOR"],
};

let allRows = [];
let metadata = {};
let charts = {};
let animationTimer = null;

function formatNumber(value, field = "") {
  if (field === "win_rate") return value.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  if (field === "payroll_millions" || field === "cost_per_win") return `$${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}M`;
  return Math.round(value).toLocaleString("en-US");
}

function teamStyle(label) {
  const match = Object.keys(teamLooks).find((name) => label.includes(name));
  const fallback = ["#071d3a", "#c82432", label.split(" ").map((part) => part[0]).join("").slice(0, 3).toUpperCase()];
  const [primary, secondary, initials] = match ? teamLooks[match] : fallback;
  return { primary, secondary, initials };
}

function teamLogo(teamName) {
  const look = teamStyle(teamName);
  return `<span class="team-mini-logo" style="--team-primary:${look.primary};--team-secondary:${look.secondary}">${look.initials}</span>`;
}

function teamNameCell(teamName) {
  return `<span class="team-name-with-logo">${teamLogo(teamName)}<span>${teamName}</span></span>`;
}

function uniqueOptions(field) {
  return [...new Set(allRows.map((row) => row[field]).filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b), undefined, { numeric: true })
  );
}

function fillSelect(id, field, allLabel) {
  const select = document.getElementById(id);
  select.innerHTML = [`<option value="">${allLabel}</option>`]
    .concat(uniqueOptions(field).map((value) => `<option value="${value}">${value}</option>`))
    .join("");
}

function getFilters() {
  return {
    startYear: Number(document.getElementById("startYear").value || 1985),
    endYear: Number(document.getElementById("endYear").value || 2016),
    teamSearch: document.getElementById("teamSearch").value.trim().toLowerCase(),
    team: document.getElementById("teamFilter").value,
    league: document.getElementById("leagueFilter").value,
    payrollTier: document.getElementById("payrollTierFilter").value,
    minPayroll: Number(document.getElementById("minPayroll").value || 0),
    topN: Number(document.getElementById("topN").value || 12),
    measure: document.getElementById("measureSelect").value,
    breakdown: document.getElementById("breakdownSelect").value,
    chartType: document.getElementById("chartTypeSelect").value,
  };
}

function setActiveEraButton() {
  const start = document.getElementById("startYear").value;
  const end = document.getElementById("endYear").value;
  document.querySelectorAll(".chip-button[data-start]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.start === start && button.dataset.end === end);
  });
}

function updateRangeReadouts() {
  document.getElementById("minPayrollValue").textContent = `$${document.getElementById("minPayroll").value}M`;
  document.getElementById("topNValue").textContent = `Top ${document.getElementById("topN").value}`;
}

function filteredRows() {
  const filters = getFilters();
  const start = Math.min(filters.startYear, filters.endYear);
  const end = Math.max(filters.startYear, filters.endYear);
  return allRows.filter((row) => {
    const tierValue = row.payroll_tier.toLowerCase().split(" ")[0];
    return (
      row.year >= start &&
      row.year <= end &&
      row.payroll_millions >= filters.minPayroll &&
      (!filters.teamSearch || row.team_name.toLowerCase().includes(filters.teamSearch) || row.team_id.toLowerCase().includes(filters.teamSearch)) &&
      (!filters.team || row.team_name === filters.team) &&
      (!filters.league || row.league === filters.league) &&
      (!filters.payrollTier || tierValue === filters.payrollTier)
    );
  });
}

function measureValue(row, measure) {
  if (measure === "runs") return row.runs;
  return row[measure] || 0;
}

function aggregate(rows, field, measure, limit = 12) {
  const groups = new Map();
  rows.forEach((row) => {
    const key = row[field] || "Unknown";
    if (!groups.has(key)) {
      groups.set(key, { label: key, wins: 0, losses: 0, payrollTotal: 0, costTotal: 0, rows: 0, value: 0 });
    }
    const item = groups.get(key);
    item.wins += row.wins;
    item.losses += row.losses;
    item.payrollTotal += row.payroll_millions;
    item.costTotal += row.cost_per_win;
    item.rows += 1;
    if (!["win_rate", "payroll_millions", "cost_per_win"].includes(measure)) item.value += measureValue(row, measure);
  });
  return [...groups.values()]
    .map((item) => {
      if (measure === "win_rate") item.value = item.wins / Math.max(1, item.wins + item.losses);
      if (measure === "payroll_millions") item.value = item.payrollTotal / Math.max(1, item.rows);
      if (measure === "cost_per_win") item.value = item.costTotal / Math.max(1, item.rows);
      return item;
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function trend(rows, measure) {
  return aggregate(rows, "year", measure, 100).sort((a, b) => Number(a.label) - Number(b.label));
}

function metricCards(rows) {
  const wins = rows.reduce((sum, row) => sum + row.wins, 0);
  const losses = rows.reduce((sum, row) => sum + row.losses, 0);
  const avgPayroll = rows.reduce((sum, row) => sum + row.payroll_millions, 0) / Math.max(1, rows.length);
  const runDiff = rows.reduce((sum, row) => sum + row.run_differential, 0);
  const cards = [
    ["Source game rows", metadata.source_game_rows || 148592, ""],
    ["Team seasons", rows.length, ""],
    ["Wins", wins, ""],
    ["Win rate", wins / Math.max(1, wins + losses), "win_rate"],
    ["Avg payroll", avgPayroll, "payroll_millions"],
    ["Run differential", runDiff, ""],
  ];
  document.getElementById("dashboardMetrics").innerHTML = cards
    .map(([label, value, field]) => `<div class="metric-card"><strong>${formatNumber(value, field)}</strong><span>${label}</span></div>`)
    .join("");
}

function chartOptions(title, type) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 850, easing: "easeOutQuart" },
    plugins: {
      title: { display: true, text: title, color: "#101927", font: { weight: "bold" } },
      legend: { display: type === "doughnut", position: "bottom" },
    },
    scales:
      type === "doughnut"
        ? {}
        : {
            x: { ticks: { autoSkip: true, maxTicksLimit: 12 }, grid: { display: false } },
            y: { beginAtZero: true, grid: { color: "rgba(96, 112, 133, 0.16)" } },
          },
  };
}

function renderChart(id, type, items, title, color = "#27724f") {
  if (charts[id]) charts[id].destroy();
  const chartType = items.length > 18 && type === "doughnut" ? "bar" : type;
  charts[id] = new Chart(document.getElementById(id), {
    type: chartType,
    data: {
      labels: items.map((item) => item.label),
      datasets: [{
        label: title,
        data: items.map((item) => item.value),
        backgroundColor: chartType === "doughnut" ? items.map((_, i) => palette[i % palette.length]) : color,
        borderColor: chartType === "line" ? color : "#ffffff",
        borderWidth: chartType === "line" ? 3 : 1,
        tension: 0.25,
        pointRadius: chartType === "line" ? 2 : 3,
      }],
    },
    options: chartOptions(title, chartType),
  });
}

function renderScatter(rows) {
  if (charts.scatterChart) charts.scatterChart.destroy();
  const points = rows.map((row) => ({ x: row.payroll_millions, y: row.win_rate, team: row.team_name, year: row.year }));
  charts.scatterChart = new Chart(document.getElementById("scatterChart"), {
    type: "scatter",
    data: {
      datasets: [{
        label: "Team seasons",
        data: points,
        pointRadius: 4,
        pointHoverRadius: 7,
        backgroundColor: "rgba(200, 36, 50, 0.62)",
        borderColor: "#c82432",
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 900 },
      plugins: {
        title: { display: true, text: "Payroll vs. winning percentage by team-season" },
        tooltip: { callbacks: { label: (ctx) => `${ctx.raw.team} ${ctx.raw.year}: $${ctx.raw.x.toFixed(1)}M, ${ctx.raw.y.toFixed(3)} win rate` } },
        legend: { display: false },
      },
      scales: {
        x: { title: { display: true, text: "Payroll, $M" }, beginAtZero: true },
        y: { title: { display: true, text: "Win rate" }, beginAtZero: true },
      },
    },
  });
}

function renderClubhouse(rows, measure) {
  const items = aggregate(rows, "team_name", measure, 6);
  document.getElementById("clubhouseStrip").innerHTML = items
    .map((item) => {
      const look = teamStyle(item.label);
      return `
        <article class="mascot-card" style="--team-primary:${look.primary};--team-secondary:${look.secondary}">
          <div class="mascot-heading">
            <div class="mascot-mark">${look.initials}</div>
            <div>
              <div class="mascot-name">${item.label}</div>
              <div class="mascot-meta">${labels[measure]}</div>
            </div>
          </div>
          <div class="mascot-stat">${formatNumber(item.value, measure)}</div>
        </article>
      `;
    })
    .join("");
}

function renderLeaderboards(rows, measure) {
  const top = rows.slice().sort((a, b) => measureValue(b, measure) - measureValue(a, measure)).slice(0, 8);
  const efficient = rows.slice().filter((row) => row.wins >= 80).sort((a, b) => a.cost_per_win - b.cost_per_win).slice(0, 8);
  const render = (items, field) =>
    items.map((row, index) => `
      <div class="leader-row">
        <span>${index + 1}</span>
        <span class="team-name-with-logo" title="${row.team_name} ${row.year}">
          ${teamLogo(row.team_name)}
          <strong>${row.team_name} ${row.year}</strong>
        </span>
        <span>${formatNumber(field === "cost_per_win" ? row.cost_per_win : measureValue(row, field), field)}</span>
      </div>
    `).join("");
  document.getElementById("seasonLeaders").innerHTML = render(top, measure);
  document.getElementById("careerLeaders").innerHTML = render(efficient, "cost_per_win");
  document.getElementById("leaderboardCaption").textContent = labels[measure];
}

function renderTable(rows) {
  const measure = getFilters().measure;
  document.getElementById("rowCount").textContent = `${rows.length.toLocaleString("en-US")} team seasons`;
  document.getElementById("dataTable").innerHTML = rows
    .slice()
    .sort((a, b) => measureValue(b, measure) - measureValue(a, measure))
    .slice(0, 120)
    .map((row) => `
      <tr>
        <td>${row.year}</td>
        <td>${teamNameCell(row.team_name)}</td>
        <td>${row.league}</td>
        <td>${row.payroll_tier}</td>
        <td>$${row.payroll_millions.toFixed(1)}M</td>
        <td>${row.wins}-${row.losses}</td>
        <td>${row.win_rate.toFixed(3)}</td>
      </tr>
    `).join("");
}

function renderTicker(rows) {
  const items = aggregate(rows, "team_name", "payroll_millions", 10);
  const ticker = document.getElementById("payrollTicker");
  if (!ticker) return;
  const content = items.map((item) => `<span>${teamLogo(item.label)} ${item.label}: ${formatNumber(item.value, "payroll_millions")}</span>`).join("");
  ticker.innerHTML = `${content}${content}`;
}

function updateDashboard() {
  updateRangeReadouts();
  setActiveEraButton();
  const rows = filteredRows();
  const filters = getFilters();
  const measureLabel = labels[filters.measure];
  const breakdownItems = filters.breakdown === "year" ? trend(rows, filters.measure) : aggregate(rows, filters.breakdown, filters.measure, filters.topN);
  metricCards(rows);
  renderClubhouse(rows, filters.measure);
  renderTicker(rows);
  renderChart("breakdownChart", filters.breakdown === "year" ? "line" : filters.chartType, breakdownItems, `${measureLabel} by ${labels[filters.breakdown]}`, "#27724f");
  renderChart("trendChart", "line", trend(rows, filters.measure), `${measureLabel} by year`, "#c82432");
  renderChart("teamChart", "bar", aggregate(rows, "team_name", filters.measure, filters.topN), `Top teams by ${measureLabel}`, "#071d3a");
  renderChart("tierChart", "bar", aggregate(rows, "payroll_tier", filters.measure, 3), `${measureLabel} by payroll tier`, "#d7a43b");
  renderScatter(rows);
  renderLeaderboards(rows, filters.measure);
  renderTable(rows);
}

function resetFilters() {
  document.getElementById("startYear").value = 1985;
  document.getElementById("endYear").value = 2016;
  document.getElementById("teamSearch").value = "";
  document.getElementById("minPayroll").value = 0;
  document.getElementById("topN").value = 12;
  ["teamFilter", "leagueFilter", "payrollTierFilter"].forEach((id) => {
    document.getElementById(id).value = "";
  });
  document.getElementById("measureSelect").value = "win_rate";
  document.getElementById("breakdownSelect").value = "team_name";
  document.getElementById("chartTypeSelect").value = "bar";
  updateDashboard();
}

function startSeasonAnimation() {
  const play = document.getElementById("playSeasons");
  if (!play) return;
  play.addEventListener("click", () => {
    if (animationTimer) {
      clearInterval(animationTimer);
      animationTimer = null;
      play.textContent = "Play seasons";
      return;
    }
    play.textContent = "Pause";
    let year = Number(document.getElementById("startYear").value || 1985);
    animationTimer = setInterval(() => {
      document.getElementById("startYear").value = 1985;
      document.getElementById("endYear").value = year;
      updateDashboard();
      year += 1;
      if (year > 2016) year = 1985;
    }, 900);
  });
}

async function initDashboard() {
  try {
    const response = await fetch(DATA_URL);
    const payload = await response.json();
    metadata = payload.metadata || {};
    allRows = payload.teamSeasons || [];
    fillSelect("teamFilter", "team_name", "All teams");
    fillSelect("leagueFilter", "league", "All leagues");

    [
      "startYear", "endYear", "teamSearch", "teamFilter", "leagueFilter", "payrollTierFilter",
      "minPayroll", "topN", "measureSelect", "breakdownSelect", "chartTypeSelect",
    ].forEach((id) => document.getElementById(id).addEventListener("input", updateDashboard));

    document.querySelectorAll(".chip-button[data-start]").forEach((button) => {
      button.addEventListener("click", () => {
        document.getElementById("startYear").value = button.dataset.start;
        document.getElementById("endYear").value = button.dataset.end;
        updateDashboard();
      });
    });
    document.getElementById("resetFilters").addEventListener("click", resetFilters);
    startSeasonAnimation();
    document.getElementById("loadingState").remove();
    updateDashboard();
  } catch (error) {
    document.getElementById("loadingState").textContent = `Dashboard failed to load: ${error.message}`;
    console.error(error);
  }
}

initDashboard();
