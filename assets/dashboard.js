const DATA_URL = "data/processed/mlb_team_payroll_game_results.csv";

const numericFields = [
  "year",
  "games_played_to_date",
  "team_runs",
  "opponent_runs",
  "run_differential",
  "win",
  "loss",
  "tie",
  "winning_percentage_after_game",
  "season_payroll",
  "payroll_rank",
  "payroll_percentile",
  "payroll_millions",
  "cost_per_win_to_date",
  "attendance",
  "time_of_game_minutes",
  "hits",
  "home_runs",
  "walks",
  "strikeouts",
  "errors",
];

const labels = {
  win_rate: "Win rate",
  wins: "Wins",
  run_differential: "Run differential",
  payroll_millions: "Payroll millions",
  cost_per_win: "Cost per win",
  attendance: "Attendance",
  team_runs: "Runs scored",
  team_name: "Team",
  league: "League",
  home_away: "Home/Away",
  day_night: "Day/Night",
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
let charts = {};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const header = rows.shift();
  return rows.map((values) => {
    const object = {};
    header.forEach((key, index) => {
      object[key] = values[index] || "";
    });
    numericFields.forEach((field) => {
      object[field] = Number(object[field] || 0);
    });
    object.payroll_tier =
      object.payroll_percentile >= 0.667 ? "Top third" : object.payroll_percentile >= 0.334 ? "Middle third" : "Bottom third";
    return object;
  });
}

function formatNumber(value, field = "") {
  if (field === "win_rate") {
    return value.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  }
  if (field === "payroll_millions" || field === "cost_per_win") {
    return `$${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}M`;
  }
  return Math.round(value).toLocaleString("en-US");
}

function teamStyle(label) {
  const match = Object.keys(teamLooks).find((name) => label.includes(name));
  const fallback = ["#071d3a", "#c82432", label.split(" ").map((part) => part[0]).join("").slice(0, 3).toUpperCase()];
  const [primary, secondary, initials] = match ? teamLooks[match] : fallback;
  return { primary, secondary, initials };
}

function renderClubhouse(rows, measure) {
  const items = aggregate(rows, "team_name", measure, 6);
  document.getElementById("clubhouseStrip").innerHTML = items
    .map((item) => {
      const look = teamStyle(item.label);
      return `
        <article class="mascot-card" style="--team-primary:${look.primary};--team-secondary:${look.secondary}">
          <div class="mascot-mark">${look.initials}</div>
          <div class="mascot-name">${item.label}</div>
          <div class="mascot-meta">${labels[measure]}</div>
          <div class="mascot-stat">${formatNumber(item.value, measure)}</div>
        </article>
      `;
    })
    .join("");
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
    homeAway: document.getElementById("homeAwayFilter").value,
    dayNight: document.getElementById("dayNightFilter").value,
    payrollTier: document.getElementById("payrollTierFilter").value,
    minPayroll: Number(document.getElementById("minPayroll").value || 0),
    topN: Number(document.getElementById("topN").value || 12),
    measure: document.getElementById("measureSelect").value,
    breakdown: document.getElementById("breakdownSelect").value,
    chartType: document.getElementById("chartTypeSelect").value,
  };
}

function updateRangeReadouts() {
  document.getElementById("minPayrollValue").textContent = `$${document.getElementById("minPayroll").value}M`;
  document.getElementById("topNValue").textContent = `Top ${document.getElementById("topN").value}`;
}

function setActiveEraButton() {
  const start = document.getElementById("startYear").value;
  const end = document.getElementById("endYear").value;
  document.querySelectorAll(".chip-button[data-start]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.start === start && button.dataset.end === end);
  });
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
      (!filters.homeAway || row.home_away === filters.homeAway) &&
      (!filters.dayNight || row.day_night === filters.dayNight) &&
      (!filters.payrollTier || tierValue === filters.payrollTier)
    );
  });
}

function aggregate(rows, field, measure, limit = 12) {
  const groups = new Map();
  rows.forEach((row) => {
    const key = row[field] || "Unknown";
    if (!groups.has(key)) {
      groups.set(key, { label: key, wins: 0, losses: 0, value: 0, payrollTotal: 0, payrollCount: 0, costTotal: 0, costCount: 0 });
    }
    const item = groups.get(key);
    item.wins += row.win;
    item.losses += row.loss;
    item.payrollTotal += row.payroll_millions;
    item.payrollCount += 1;
    if (row.cost_per_win_to_date) {
      item.costTotal += row.cost_per_win_to_date / 1_000_000;
      item.costCount += 1;
    }
    if (measure === "wins") item.value += row.win;
    else if (measure === "win_rate") item.value = 0;
    else if (measure === "payroll_millions") item.value = 0;
    else if (measure === "cost_per_win") item.value = 0;
    else item.value += row[measure] || 0;
  });

  return [...groups.values()]
    .map((item) => {
      if (measure === "win_rate") item.value = item.wins / Math.max(1, item.wins + item.losses);
      if (measure === "payroll_millions") item.value = item.payrollTotal / Math.max(1, item.payrollCount);
      if (measure === "cost_per_win") item.value = item.costTotal / Math.max(1, item.costCount);
      return item;
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function trend(rows, measure) {
  return aggregate(rows, "year", measure, 100).sort((a, b) => Number(a.label) - Number(b.label));
}

function metricCards(rows) {
  const teams = new Set(rows.map((row) => `${row.year}-${row.team_id}`));
  const wins = rows.reduce((sum, row) => sum + row.win, 0);
  const losses = rows.reduce((sum, row) => sum + row.loss, 0);
  const avgPayroll = rows.reduce((sum, row) => sum + row.payroll_millions, 0) / Math.max(1, rows.length);
  const runDiff = rows.reduce((sum, row) => sum + row.run_differential, 0);

  const cards = [
    ["Rows", rows.length, ""],
    ["Team seasons", teams.size, ""],
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

function renderChart(id, type, items, title, color = "#27724f", measure = "") {
  if (charts[id]) charts[id].destroy();
  const chartType = items.length > 18 && type === "doughnut" ? "bar" : type;
  charts[id] = new Chart(document.getElementById(id), {
    type: chartType,
    data: {
      labels: items.map((item) => item.label),
      datasets: [
        {
          label: title,
          data: items.map((item) => item.value),
          backgroundColor: chartType === "doughnut" ? items.map((_, i) => palette[i % palette.length]) : color,
          borderColor: chartType === "line" ? color : "#ffffff",
          borderWidth: chartType === "line" ? 3 : 1,
          tension: 0.25,
          pointRadius: chartType === "line" ? 2 : 3,
        },
      ],
    },
    options: chartOptions(title, chartType, measure),
  });
}

function renderScatter(rows) {
  if (charts.scatterChart) charts.scatterChart.destroy();
  const seasons = aggregate(rows, "team_name", "win_rate", 500)
    .map((item) => ({ x: item.payrollTotal / Math.max(1, item.payrollCount), y: item.value, team: item.label }))
    .filter((item) => item.x > 0);

  charts.scatterChart = new Chart(document.getElementById("scatterChart"), {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "Teams",
          data: seasons,
          pointRadius: 5,
          pointHoverRadius: 7,
          backgroundColor: "rgba(200, 36, 50, 0.62)",
          borderColor: "#c82432",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: "Average payroll vs. win rate in current view" },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.raw.team}: $${ctx.raw.x.toFixed(1)}M payroll, ${ctx.raw.y.toFixed(3)} win rate`,
          },
        },
        legend: { display: false },
      },
      scales: {
        x: { title: { display: true, text: "Average payroll, $M" }, beginAtZero: true },
        y: { title: { display: true, text: "Win rate" }, beginAtZero: true },
      },
    },
  });
}

function renderLeaderboards(rows, measure) {
  const topSeasons = aggregate(rows, "team_name", measure, 8);
  const efficient = aggregate(rows, "team_name", "cost_per_win", 100)
    .filter((item) => item.wins >= 20 && item.value > 0)
    .sort((a, b) => a.value - b.value)
    .slice(0, 8);

  const render = (items, field = measure) =>
    items
      .map(
        (item, index) => `
          <div class="leader-row">
            <span>${index + 1}</span>
            <strong title="${item.label}">${item.label}</strong>
            <span>${formatNumber(item.value, field)}</span>
          </div>
        `
      )
      .join("");

  document.getElementById("seasonLeaders").innerHTML = render(topSeasons);
  document.getElementById("careerLeaders").innerHTML = render(efficient, "cost_per_win");
  document.getElementById("leaderboardCaption").textContent = labels[measure];
}

function renderTable(rows) {
  const measure = getFilters().measure;
  document.getElementById("rowCount").textContent = `${rows.length.toLocaleString("en-US")} rows`;
  document.getElementById("dataTable").innerHTML = rows
    .slice()
    .sort((a, b) => {
      if (measure === "wins" || measure === "win_rate") return b.win - a.win;
      if (measure === "cost_per_win") return (b.cost_per_win_to_date || 0) - (a.cost_per_win_to_date || 0);
      return (b[measure] || 0) - (a[measure] || 0);
    })
    .slice(0, 120)
    .map((row) => {
      const result = row.win ? "W" : row.loss ? "L" : "T";
      return `
        <tr>
          <td>${row.date}</td>
          <td>${row.team_name}</td>
          <td>${row.opponent_id}</td>
          <td>${row.home_away}</td>
          <td>$${row.payroll_millions.toFixed(1)}M</td>
          <td>${result} ${row.team_runs}-${row.opponent_runs}</td>
          <td>${row.winning_percentage_after_game.toFixed(3)}</td>
        </tr>
      `;
    })
    .join("");
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
  renderChart("breakdownChart", filters.breakdown === "year" ? "line" : filters.chartType, breakdownItems, `${measureLabel} by ${labels[filters.breakdown]}`, "#27724f", filters.measure);
  renderChart("trendChart", "line", trend(rows, filters.measure), `${measureLabel} by year`, "#c82432", filters.measure);
  renderChart("teamChart", "bar", aggregate(rows, "team_name", filters.measure, filters.topN), `Top teams by ${measureLabel}`, "#071d3a", filters.measure);
  renderChart("playerChart", "bar", aggregate(rows, "payroll_tier", filters.measure, 3), `${measureLabel} by payroll tier`, "#d7a43b", filters.measure);
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
  ["teamFilter", "leagueFilter", "homeAwayFilter", "dayNightFilter", "payrollTierFilter"].forEach((id) => {
    document.getElementById(id).value = "";
  });
  document.getElementById("measureSelect").value = "win_rate";
  document.getElementById("breakdownSelect").value = "team_name";
  document.getElementById("chartTypeSelect").value = "bar";
  updateDashboard();
}

async function initDashboard() {
  const response = await fetch(DATA_URL);
  const text = await response.text();
  allRows = parseCsv(text);

  fillSelect("teamFilter", "team_name", "All teams");
  fillSelect("leagueFilter", "league", "All leagues");
  fillSelect("homeAwayFilter", "home_away", "Home and away");
  fillSelect("dayNightFilter", "day_night", "Day and night");

  [
    "startYear",
    "endYear",
    "teamSearch",
    "teamFilter",
    "leagueFilter",
    "homeAwayFilter",
    "dayNightFilter",
    "payrollTierFilter",
    "minPayroll",
    "topN",
    "measureSelect",
    "breakdownSelect",
    "chartTypeSelect",
  ].forEach((id) => document.getElementById(id).addEventListener("input", updateDashboard));

  document.querySelectorAll(".chip-button[data-start]").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById("startYear").value = button.dataset.start;
      document.getElementById("endYear").value = button.dataset.end;
      updateDashboard();
    });
  });

  document.getElementById("resetFilters").addEventListener("click", resetFilters);
  document.getElementById("loadingState").remove();
  updateDashboard();
}

initDashboard();
