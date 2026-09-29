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
  ops: "Average OPS",
  team_name: "Team",
  league: "League",
  bats: "Bats",
  birth_country: "Birth country",
  year: "Year",
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
    object.year = Number(object.year);
    return object;
  });
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
    team: document.getElementById("teamFilter").value,
    league: document.getElementById("leagueFilter").value,
    bats: document.getElementById("batsFilter").value,
    country: document.getElementById("countryFilter").value,
    measure: document.getElementById("measureSelect").value,
    breakdown: document.getElementById("breakdownSelect").value,
  };
}

function filteredRows() {
  const filters = getFilters();
  return allRows.filter((row) => {
    return (
      row.year >= filters.startYear &&
      row.year <= filters.endYear &&
      (!filters.team || row.team_name === filters.team) &&
      (!filters.league || row.league === filters.league) &&
      (!filters.bats || row.bats === filters.bats) &&
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

  const values = [...groups.values()].map((item) => ({
    label: item.label,
    value: measure === "ops" ? item.value / item.count : item.value,
  }));

  return values.sort((a, b) => b.value - a.value).slice(0, limit);
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
      return acc;
    },
    { pa: 0, hr: 0, hits: 0, ops: 0, count: 0, players: new Set() }
  );

  const cards = [
    ["Rows", rows.length],
    ["Players", totals.players.size],
    ["Plate appearances", totals.pa],
    ["Home runs", totals.hr],
    ["Hits", totals.hits],
    ["Average OPS", totals.count ? totals.ops / totals.count : 0],
  ];

  document.getElementById("dashboardMetrics").innerHTML = cards
    .map(([label, value]) => {
      const display =
        label === "Average OPS"
          ? value.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })
          : Math.round(value).toLocaleString("en-US");
      return `<div class="metric-card"><strong>${display}</strong><span>${label}</span></div>`;
    })
    .join("");
}

function renderChart(id, type, items, title, color = "#2f6f63") {
  if (charts[id]) charts[id].destroy();
  const ctx = document.getElementById(id);
  charts[id] = new Chart(ctx, {
    type,
    data: {
      labels: items.map((item) => item.label),
      datasets: [
        {
          label: title,
          data: items.map((item) => item.value),
          backgroundColor: type === "line" ? "rgba(179, 59, 50, 0.12)" : color,
          borderColor: color,
          borderWidth: 2,
          tension: 0.25,
          pointRadius: type === "line" ? 1 : 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: title },
        legend: { display: false },
      },
      scales: {
        x: { ticks: { autoSkip: true, maxTicksLimit: 12 } },
        y: { beginAtZero: true },
      },
    },
  });
}

function renderTable(rows) {
  document.getElementById("rowCount").textContent = `${rows.length.toLocaleString("en-US")} rows`;
  document.getElementById("dataTable").innerHTML = rows
    .slice()
    .sort((a, b) => b.plate_appearances - a.plate_appearances)
    .slice(0, 100)
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
  const rows = filteredRows();
  const filters = getFilters();
  const measureLabel = labels[filters.measure];

  metricCards(rows);
  renderChart(
    "breakdownChart",
    filters.breakdown === "year" ? "line" : "bar",
    filters.breakdown === "year" ? trend(rows, filters.measure) : summarize(rows, filters.breakdown, filters.measure),
    `${measureLabel} by ${labels[filters.breakdown]}`,
    "#2f6f63"
  );
  renderChart("trendChart", "line", trend(rows, filters.measure), `${measureLabel} by year`, "#b33b32");
  renderChart("teamChart", "bar", summarize(rows, "team_name", filters.measure, 10), `Top teams by ${measureLabel}`, "#19324a");
  renderChart("playerChart", "bar", summarize(rows, "player_name", filters.measure, 10), `Top players by ${measureLabel}`, "#d59f37");
  renderTable(rows);
}

function resetFilters() {
  document.getElementById("startYear").value = 1901;
  document.getElementById("endYear").value = 2021;
  ["teamFilter", "leagueFilter", "batsFilter", "countryFilter"].forEach((id) => {
    document.getElementById(id).value = "";
  });
  document.getElementById("measureSelect").value = "home_runs";
  document.getElementById("breakdownSelect").value = "team_name";
  updateDashboard();
}

async function initDashboard() {
  const response = await fetch(DATA_URL);
  const text = await response.text();
  allRows = parseCsv(text);

  fillSelect("teamFilter", "team_name", "All teams");
  fillSelect("leagueFilter", "league", "All leagues");
  fillSelect("batsFilter", "bats", "All batting sides");
  fillSelect("countryFilter", "birth_country", "All countries");

  [
    "startYear",
    "endYear",
    "teamFilter",
    "leagueFilter",
    "batsFilter",
    "countryFilter",
    "measureSelect",
    "breakdownSelect",
  ].forEach((id) => document.getElementById(id).addEventListener("change", updateDashboard));

  document.getElementById("resetFilters").addEventListener("click", resetFilters);
  document.getElementById("loadingState").remove();
  updateDashboard();
}

initDashboard();
