const DATA_URL = "data/processed/mlb_batting_player_seasons.csv";

const numericFields = [
  "games",
  "at_bats",
  "plate_appearances",
  "runs",
  "hits",
  "home_runs",
  "rbi",
  "walks",
  "strikeouts",
  "total_bases",
  "ops",
];

const labels = {
  home_runs: "Home runs",
  hits: "Hits",
  rbi: "RBI",
  plate_appearances: "Plate appearances",
  walks: "Walks",
  strikeouts: "Strikeouts",
  total_bases: "Total bases",
  ops: "Average OPS",
  team_name: "Team",
  league: "League",
  bats: "Bats",
  throws: "Throws",
  birth_country: "Birth country",
  year: "Year",
};

const palette = ["#c82432", "#071d3a", "#27724f", "#d7a43b", "#6f4bb3", "#1e88a8", "#9e1d29", "#5c6f82"];

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
    object.year = Number(object.year);
    return object;
  });
}

function formatNumber(value, field = "") {
  if (field === "ops" || (value < 10 && value % 1 !== 0)) {
    return value.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  }
  return Math.round(value).toLocaleString("en-US");
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
    startYear: Number(document.getElementById("startYear").value || 1901),
    endYear: Number(document.getElementById("endYear").value || 2021),
    player: document.getElementById("playerSearch").value.trim().toLowerCase(),
    team: document.getElementById("teamFilter").value,
    league: document.getElementById("leagueFilter").value,
    bats: document.getElementById("batsFilter").value,
    throws: document.getElementById("throwsFilter").value,
    country: document.getElementById("countryFilter").value,
    minPa: Number(document.getElementById("minPa").value || 0),
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
  document.getElementById("minPaValue").textContent = `${document.getElementById("minPa").value} PA`;
  document.getElementById("topNValue").textContent = `Top ${document.getElementById("topN").value}`;
}

function filteredRows() {
  const filters = getFilters();
  const start = Math.min(filters.startYear, filters.endYear);
  const end = Math.max(filters.startYear, filters.endYear);

  return allRows.filter((row) => {
    return (
      row.year >= start &&
      row.year <= end &&
      row.plate_appearances >= filters.minPa &&
      (!filters.player || row.player_name.toLowerCase().includes(filters.player)) &&
      (!filters.team || row.team_name === filters.team) &&
      (!filters.league || row.league === filters.league) &&
      (!filters.bats || row.bats === filters.bats) &&
      (!filters.throws || row.throws === filters.throws) &&
      (!filters.country || row.birth_country === filters.country)
    );
  });
}

function summarize(rows, field, measure, limit = 12) {
  const groups = new Map();
  rows.forEach((row) => {
    const key = row[field] || "Unknown";
    if (!groups.has(key)) groups.set(key, { label: key, value: 0, count: 0 });
    const item = groups.get(key);
    item.value += row[measure] || 0;
    item.count += 1;
  });

  return [...groups.values()]
    .map((item) => ({
      label: item.label,
      value: measure === "ops" ? item.value / item.count : item.value,
      count: item.count,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function trend(rows, measure) {
  const groups = new Map();
  rows.forEach((row) => {
    const key = row.year;
    if (!groups.has(key)) groups.set(key, { label: key, value: 0, count: 0 });
    const item = groups.get(key);
    item.value += row[measure] || 0;
    item.count += 1;
  });

  return [...groups.values()]
    .map((item) => ({
      label: item.label,
      value: measure === "ops" ? item.value / item.count : item.value,
    }))
    .sort((a, b) => a.label - b.label);
}

function metricCards(rows) {
  const totals = rows.reduce(
    (acc, row) => {
      acc.pa += row.plate_appearances;
      acc.hr += row.home_runs;
      acc.hits += row.hits;
      acc.ops += row.ops;
      acc.count += 1;
      acc.players.add(row.player_id);
      acc.teams.add(row.team_name);
      return acc;
    },
    { pa: 0, hr: 0, hits: 0, ops: 0, count: 0, players: new Set(), teams: new Set() }
  );

  const cards = [
    ["Rows", rows.length, ""],
    ["Players", totals.players.size, ""],
    ["Teams", totals.teams.size, ""],
    ["Plate appearances", totals.pa, ""],
    ["Home runs", totals.hr, ""],
    ["Average OPS", totals.count ? totals.ops / totals.count : 0, "ops"],
  ];

  document.getElementById("dashboardMetrics").innerHTML = cards
    .map(
      ([label, value, field]) =>
        `<div class="metric-card"><strong>${formatNumber(value, field)}</strong><span>${label}</span></div>`
    )
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

function renderChart(id, type, items, title, color = "#27724f") {
  if (charts[id]) charts[id].destroy();
  const ctx = document.getElementById(id);
  const chartType = items.length > 18 && type === "doughnut" ? "bar" : type;

  charts[id] = new Chart(ctx, {
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
    options: chartOptions(title, chartType),
  });
}

function renderScatter(rows) {
  if (charts.scatterChart) charts.scatterChart.destroy();
  const sample = rows
    .filter((row) => row.plate_appearances >= 100)
    .sort((a, b) => b.plate_appearances - a.plate_appearances)
    .slice(0, 600)
    .map((row) => ({
      x: row.home_runs,
      y: row.ops,
      player: row.player_name,
      year: row.year,
      team: row.team_name,
    }));

  charts.scatterChart = new Chart(document.getElementById("scatterChart"), {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "Player seasons",
          data: sample,
          pointRadius: 4,
          pointHoverRadius: 6,
          backgroundColor: "rgba(200, 36, 50, 0.62)",
          borderColor: "#c82432",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: "Power vs. OPS for top playing-time seasons" },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const item = ctx.raw;
              return `${item.player}, ${item.year} ${item.team}: ${item.x} HR, ${item.y.toFixed(3)} OPS`;
            },
          },
        },
        legend: { display: false },
      },
      scales: {
        x: { title: { display: true, text: "Home runs" }, beginAtZero: true },
        y: { title: { display: true, text: "OPS" }, beginAtZero: true },
      },
    },
  });
}

function renderLeaderboards(rows, measure) {
  const seasonLeaders = rows
    .slice()
    .sort((a, b) => b[measure] - a[measure])
    .slice(0, 8)
    .map((row, index) => ({
      rank: index + 1,
      label: `${row.player_name}, ${row.year}`,
      value: row[measure],
    }));

  const careerLeaders = summarize(rows, "player_name", measure, 8).map((item, index) => ({
    rank: index + 1,
    label: item.label,
    value: item.value,
  }));

  const render = (items) =>
    items
      .map(
        (item) => `
          <div class="leader-row">
            <span>${item.rank}</span>
            <strong title="${item.label}">${item.label}</strong>
            <span>${formatNumber(item.value, measure)}</span>
          </div>
        `
      )
      .join("");

  document.getElementById("seasonLeaders").innerHTML = render(seasonLeaders);
  document.getElementById("careerLeaders").innerHTML = render(careerLeaders);
  document.getElementById("leaderboardCaption").textContent = labels[measure];
}

function renderTable(rows) {
  const measure = getFilters().measure;
  document.getElementById("rowCount").textContent = `${rows.length.toLocaleString("en-US")} rows`;
  document.getElementById("dataTable").innerHTML = rows
    .slice()
    .sort((a, b) => b[measure] - a[measure])
    .slice(0, 120)
    .map(
      (row) => `
        <tr>
          <td>${row.player_name}</td>
          <td>${row.year}</td>
          <td>${row.team_name}</td>
          <td>${row.league}</td>
          <td>${row.plate_appearances.toLocaleString("en-US")}</td>
          <td>${row.home_runs.toLocaleString("en-US")}</td>
          <td>${row.ops.toFixed(3)}</td>
        </tr>
      `
    )
    .join("");
}

function updateDashboard() {
  updateRangeReadouts();
  setActiveEraButton();

  const rows = filteredRows();
  const filters = getFilters();
  const measureLabel = labels[filters.measure];
  const topN = filters.topN;
  const breakdownItems =
    filters.breakdown === "year" ? trend(rows, filters.measure) : summarize(rows, filters.breakdown, filters.measure, topN);

  metricCards(rows);
  renderChart(
    "breakdownChart",
    filters.breakdown === "year" ? "line" : filters.chartType,
    breakdownItems,
    `${measureLabel} by ${labels[filters.breakdown]}`,
    "#27724f"
  );
  renderChart("trendChart", "line", trend(rows, filters.measure), `${measureLabel} by year`, "#c82432");
  renderChart("teamChart", "bar", summarize(rows, "team_name", filters.measure, topN), `Top teams by ${measureLabel}`, "#071d3a");
  renderChart("playerChart", "bar", summarize(rows, "player_name", filters.measure, topN), `Top players by ${measureLabel}`, "#d7a43b");
  renderScatter(rows);
  renderLeaderboards(rows, filters.measure);
  renderTable(rows);
}

function resetFilters() {
  document.getElementById("startYear").value = 1901;
  document.getElementById("endYear").value = 2021;
  document.getElementById("playerSearch").value = "";
  document.getElementById("minPa").value = 0;
  document.getElementById("topN").value = 12;
  ["teamFilter", "leagueFilter", "batsFilter", "throwsFilter", "countryFilter"].forEach((id) => {
    document.getElementById(id).value = "";
  });
  document.getElementById("measureSelect").value = "home_runs";
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
  fillSelect("batsFilter", "bats", "All batting sides");
  fillSelect("throwsFilter", "throws", "All throwing arms");
  fillSelect("countryFilter", "birth_country", "All countries");

  [
    "startYear",
    "endYear",
    "playerSearch",
    "teamFilter",
    "leagueFilter",
    "batsFilter",
    "throwsFilter",
    "countryFilter",
    "minPa",
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
