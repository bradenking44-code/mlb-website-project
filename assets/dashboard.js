const DATA_URL = "data/processed/postseason_dashboard_data.json";

const labels = {
  world_series_wins: "World Series wins",
  playoff_rate: "Playoff rate",
  win_pct: "Win percentage",
  wins: "Wins",
  payroll_millions: "Payroll, $M",
  payroll_rank: "Payroll rank",
  roster_count: "Roster size",
  team_name: "Team",
  year: "Year",
  league: "League",
  division: "Division",
  payroll_tier: "Payroll tier",
  postseason_result: "Postseason result",
};

const colors = ["#be1e2d", "#113b64", "#2f6f63", "#d39b2a", "#642f6c", "#0c7c90", "#8f2f1f", "#435466"];
let teamSeasons = [];
let worldSeries = [];
let rosters = {};
let metadata = {};
let animationTimer = null;

const money = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const number = new Intl.NumberFormat("en-US");

function fmtMoney(value) {
  return value || value === 0 ? `$${money.format(value)}M` : "No payroll";
}

function fmtValue(value, field) {
  if (field === "playoff_rate" || field === "win_pct") return `${(value * 100).toFixed(1)}%`;
  if (field === "payroll_millions") return fmtMoney(value);
  if (field === "payroll_rank") return value ? `#${Math.round(value)}` : "No rank";
  return number.format(Math.round(value || 0));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function logo(row, size = "small") {
  const text = row.team_id || row.winner_id || "MLB";
  if (row.logo_url || row.winner_logo_url) {
    return `<img class="team-logo ${size}" src="${row.logo_url || row.winner_logo_url}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'team-mini-logo',textContent:'${escapeHtml(text).slice(0,3)}'}))">`;
  }
  return `<span class="team-mini-logo">${escapeHtml(text).slice(0, 3)}</span>`;
}

function teamCell(row) {
  return `<span class="team-name-with-logo">${logo(row)}<span>${escapeHtml(row.team_name || row.winner)}</span></span>`;
}

function unique(field) {
  return [...new Set(teamSeasons.map((row) => row[field]).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
}

function fillSelect(id, field, label) {
  const select = document.getElementById(id);
  select.innerHTML = [`<option value="">${label}</option>`]
    .concat(unique(field).map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`))
    .join("");
}

function filters() {
  const startYear = Number(document.getElementById("startYear").value || metadata.start_year);
  const endYear = Number(document.getElementById("endYear").value || metadata.latest_year);
  return {
    start: Math.min(startYear, endYear),
    end: Math.max(startYear, endYear),
    teamSearch: document.getElementById("teamSearch").value.trim().toLowerCase(),
    team: document.getElementById("teamFilter").value,
    league: document.getElementById("leagueFilter").value,
    division: document.getElementById("divisionFilter").value,
    postseason: document.getElementById("postseasonFilter").value,
    payrollTier: document.getElementById("payrollTierFilter").value,
    minPayroll: Number(document.getElementById("minPayroll").value || 0),
    measure: document.getElementById("measureSelect").value,
    breakdown: document.getElementById("breakdownSelect").value,
    topN: Number(document.getElementById("topN").value || 12),
  };
}

function filteredRows() {
  const f = filters();
  return teamSeasons.filter((row) => {
    const wsTeam = row.world_series_winner || row.league_champion;
    return row.year >= f.start &&
      row.year <= f.end &&
      (!f.teamSearch || row.team_name.toLowerCase().includes(f.teamSearch) || row.team_id.toLowerCase().includes(f.teamSearch)) &&
      (!f.team || row.team_name === f.team) &&
      (!f.league || row.league === f.league) &&
      (!f.division || row.division === f.division) &&
      (!f.payrollTier || row.payroll_tier === f.payrollTier) &&
      (!f.minPayroll || (row.payroll_millions || 0) >= f.minPayroll) &&
      (!f.postseason ||
        (f.postseason === "playoffs" && row.playoff_team) ||
        (f.postseason === "missed" && !row.playoff_team) ||
        (f.postseason === "world_series" && wsTeam) ||
        (f.postseason === "champions" && row.world_series_winner));
  });
}

function aggregate(rows, group, measure, limit) {
  const map = new Map();
  rows.forEach((row) => {
    const key = row[group] ?? "Unknown";
    if (!map.has(key)) {
      map.set(key, { label: String(key), seasons: 0, wins: 0, losses: 0, payroll: 0, payrollRows: 0, playoffs: 0, ws: 0, roster: 0, rank: 0, rankRows: 0 });
    }
    const item = map.get(key);
    item.seasons += 1;
    item.wins += row.wins || 0;
    item.losses += row.losses || 0;
    item.playoffs += row.playoff_team ? 1 : 0;
    item.ws += row.world_series_winner ? 1 : 0;
    item.roster += row.roster_count || 0;
    if (row.payroll_millions) {
      item.payroll += row.payroll_millions;
      item.payrollRows += 1;
    }
    if (row.payroll_rank) {
      item.rank += row.payroll_rank;
      item.rankRows += 1;
    }
  });
  return [...map.values()].map((item) => {
    if (measure === "world_series_wins") item.value = item.ws;
    if (measure === "playoff_rate") item.value = item.playoffs / Math.max(1, item.seasons);
    if (measure === "win_pct") item.value = item.wins / Math.max(1, item.wins + item.losses);
    if (measure === "wins") item.value = item.wins;
    if (measure === "payroll_millions") item.value = item.payroll / Math.max(1, item.payrollRows);
    if (measure === "payroll_rank") item.value = item.rank / Math.max(1, item.rankRows);
    if (measure === "roster_count") item.value = item.roster / Math.max(1, item.seasons);
    return item;
  }).sort((a, b) => {
    if (measure === "payroll_rank") return a.value - b.value;
    return b.value - a.value;
  }).slice(0, limit);
}

function setReadouts() {
  document.getElementById("minPayrollValue").textContent = `$${document.getElementById("minPayroll").value}M`;
  document.getElementById("topNValue").textContent = `Top ${document.getElementById("topN").value}`;
  const f = filters();
  document.querySelectorAll(".chip-button[data-start]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.start === String(f.start) && button.dataset.end === String(f.end));
  });
}

function metricCards(rows) {
  const payrollRows = rows.filter((row) => row.payroll_millions);
  const playoffTeams = rows.filter((row) => row.playoff_team).length;
  const wsWinners = rows.filter((row) => row.world_series_winner).length;
  const wins = rows.reduce((sum, row) => sum + row.wins, 0);
  const losses = rows.reduce((sum, row) => sum + row.losses, 0);
  const avgPayroll = payrollRows.reduce((sum, row) => sum + row.payroll_millions, 0) / Math.max(1, payrollRows.length);
  const cards = [
    [metadata.full_roster_rows, "Roster data rows"],
    [rows.length, "Team seasons"],
    [playoffTeams, "Playoff teams"],
    [wsWinners, "World Series winners"],
    [wins / Math.max(1, wins + losses), "Win rate", "win_pct"],
    [avgPayroll, "Avg payroll", "payroll_millions"],
  ];
  document.getElementById("dashboardMetrics").innerHTML = cards.map(([value, label, field]) => `
    <div class="metric-card"><strong>${field ? fmtValue(value, field) : number.format(Math.round(value || 0))}</strong><span>${label}</span></div>
  `).join("");
}

function svgWrap(title, body, subtitle = "") {
  return `<h3 class="chart-title">${escapeHtml(title)}</h3>${subtitle ? `<p class="chart-subtitle">${escapeHtml(subtitle)}</p>` : ""}<svg viewBox="0 0 720 330" role="img" aria-label="${escapeHtml(title)}">${body}</svg>`;
}

function barChart(id, title, data, field) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const width = 640;
  const startX = 60;
  const rowH = Math.min(34, 250 / Math.max(1, data.length));
  const bars = data.map((d, i) => {
    const y = 42 + i * rowH;
    const barW = (d.value / max) * width;
    return `
      <text x="52" y="${y + 15}" text-anchor="end" class="svg-label">${escapeHtml(d.label).slice(0, 18)}</text>
      <rect x="${startX}" y="${y}" width="${barW}" height="${rowH - 7}" rx="5" fill="${colors[i % colors.length]}"></rect>
      <text x="${Math.min(startX + barW + 8, 690)}" y="${y + 15}" class="svg-value">${fmtValue(d.value, field)}</text>`;
  }).join("");
  document.getElementById(id).innerHTML = svgWrap(title, bars, "Hover the filters to rebuild this chart from the current view.");
}

function lineChart(id, title, data, field) {
  const clean = data.filter((d) => Number.isFinite(d.value));
  const minYear = Math.min(...clean.map((d) => Number(d.label)), 1985);
  const maxYear = Math.max(...clean.map((d) => Number(d.label)), 2025);
  const max = Math.max(...clean.map((d) => d.value), 1);
  const min = Math.min(...clean.map((d) => d.value), 0);
  const x = (year) => 55 + ((year - minYear) / Math.max(1, maxYear - minYear)) * 620;
  const y = (value) => 285 - ((value - min) / Math.max(0.01, max - min)) * 220;
  const points = clean.map((d) => `${x(Number(d.label))},${y(d.value)}`).join(" ");
  const dots = clean.filter((_, i) => i % Math.max(1, Math.floor(clean.length / 12)) === 0).map((d) =>
    `<circle cx="${x(Number(d.label))}" cy="${y(d.value)}" r="4" fill="#be1e2d"><title>${d.label}: ${fmtValue(d.value, field)}</title></circle>`
  ).join("");
  const body = `
    <line x1="55" y1="285" x2="680" y2="285" class="axis"></line>
    <line x1="55" y1="45" x2="55" y2="285" class="axis"></line>
    <polyline points="${points}" fill="none" stroke="#be1e2d" stroke-width="4"></polyline>
    ${dots}
    <text x="55" y="315" class="svg-label">${minYear}</text>
    <text x="680" y="315" text-anchor="end" class="svg-label">${maxYear}</text>`;
  document.getElementById(id).innerHTML = svgWrap(title, body);
}

function scatterChart(id, title, rows) {
  const data = rows.filter((row) => row.payroll_millions && row.win_pct);
  const maxX = Math.max(...data.map((row) => row.payroll_millions), 1);
  const x = (value) => 55 + (value / maxX) * 620;
  const y = (value) => 285 - value * 390;
  const points = data.map((row) => {
    const fill = row.world_series_winner ? "#d39b2a" : row.playoff_team ? "#be1e2d" : "rgba(17,59,100,.45)";
    const r = row.world_series_winner ? 7 : row.playoff_team ? 5 : 3;
    return `<circle cx="${x(row.payroll_millions)}" cy="${y(row.win_pct)}" r="${r}" fill="${fill}"><title>${escapeHtml(row.team_name)} ${row.year}: ${fmtMoney(row.payroll_millions)}, ${row.wins}-${row.losses}, ${row.postseason_result}</title></circle>`;
  }).join("");
  const body = `
    <line x1="55" y1="285" x2="680" y2="285" class="axis"></line>
    <line x1="55" y1="60" x2="55" y2="285" class="axis"></line>
    ${points}
    <text x="55" y="315" class="svg-label">$0M payroll</text>
    <text x="680" y="315" text-anchor="end" class="svg-label">${fmtMoney(maxX)}</text>
    <text x="18" y="70" class="svg-label">.600+</text>
    <text x="18" y="285" class="svg-label">.000</text>`;
  document.getElementById(id).innerHTML = svgWrap(title, body, "Gold dots are World Series winners. Red dots are playoff teams.");
}

function tierChart(rows) {
  const tiers = ["Top third", "Middle third", "Bottom third"];
  const data = tiers.map((tier) => {
    const set = rows.filter((row) => row.payroll_tier === tier);
    return { label: tier, value: set.filter((row) => row.playoff_team).length / Math.max(1, set.length) };
  });
  barChart("tierChart", "Playoff rate by payroll tier", data, "playoff_rate");
}

function wsPayrollChart(rows) {
  const f = filters();
  const data = worldSeries.filter((row) => row.year >= f.start && row.year <= f.end && row.winner_payroll_millions)
    .map((row) => ({
      label: row.year,
      value: row.winner_payroll_millions - row.league_avg_payroll_millions,
    }));
  lineChart("wsPayrollChart", "World Series winner payroll vs league average", data, "payroll_millions");
}

function renderWorldSeries() {
  const f = filters();
  const items = worldSeries.filter((row) => row.year >= f.start && row.year <= f.end).sort((a, b) => b.year - a.year);
  document.getElementById("wsCaption").textContent = `${items.length} champions in view`;
  document.getElementById("worldSeriesTimeline").innerHTML = items.map((row) => `
    <article class="ws-card">
      <strong>${row.year}</strong>
      <span>${logo(row)} ${escapeHtml(row.winner)}</span>
      <small>${row.record} ${row.winner_payroll_rank ? `| payroll rank #${row.winner_payroll_rank}` : "| payroll unavailable"}</small>
    </article>
  `).join("");
}

function renderTicker() {
  const items = worldSeries.filter((row) => row.year >= 1985).slice(-20);
  document.getElementById("payrollTicker").innerHTML = items.concat(items).map((row) =>
    `<span>${row.year} ${escapeHtml(row.winner)} ${row.winner_payroll_rank ? `rank #${row.winner_payroll_rank}` : "payroll n/a"}</span>`
  ).join("");
}

function renderRoster(row) {
  if (!row) {
    document.getElementById("rosterSpotlight").innerHTML = "<p>No roster selected.</p>";
    return;
  }
  const key = `${row.year}-${row.team_id}`;
  const players = rosters[key] || [];
  document.getElementById("rosterCaption").textContent = `${row.year} ${row.team_name}, ${players.length} players`;
  document.getElementById("rosterSpotlight").innerHTML = `
    <div class="roster-header">${teamCell(row)}<span>${row.wins}-${row.losses}, ${row.postseason_result}, ${fmtMoney(row.payroll_millions)}</span></div>
    <div class="roster-list">
      ${players.slice(0, 36).map((player) => `<span title="${player.games} games">${escapeHtml(player.player_name)} <small>${player.games} G</small></span>`).join("")}
    </div>`;
}

function renderTable(rows) {
  const sorted = [...rows].sort((a, b) => b.year - a.year || b.wins - a.wins).slice(0, 80);
  document.getElementById("rowCount").textContent = `${rows.length} team seasons in current filters`;
  document.getElementById("dataTable").innerHTML = sorted.map((row, i) => `
    <tr>
      <td>${row.year}</td>
      <td>${teamCell(row)}</td>
      <td>${row.wins}-${row.losses}</td>
      <td>${fmtMoney(row.payroll_millions)}</td>
      <td>${row.payroll_rank ? `#${row.payroll_rank}` : "n/a"}</td>
      <td>${escapeHtml(row.postseason_result)}</td>
      <td><button class="mini-button" type="button" data-row="${i}">View</button></td>
    </tr>
  `).join("");
  document.querySelectorAll("[data-row]").forEach((button) => {
    button.addEventListener("click", () => renderRoster(sorted[Number(button.dataset.row)]));
  });
  renderRoster(sorted[0]);
}

function render() {
  setReadouts();
  const rows = filteredRows();
  const f = filters();
  metricCards(rows);
  renderWorldSeries();
  barChart("breakdownChart", `${labels[f.measure]} by ${labels[f.breakdown]}`, aggregate(rows, f.breakdown, f.measure, f.topN), f.measure);
  const yearly = aggregate(rows, "year", f.measure, 100).sort((a, b) => Number(a.label) - Number(b.label));
  lineChart("trendChart", `${labels[f.measure]} trend`, yearly, f.measure);
  tierChart(rows);
  wsPayrollChart(rows);
  scatterChart("scatterChart", "Payroll vs win percentage", rows);
  renderTable(rows);
}

function wireEvents() {
  document.querySelectorAll("input, select").forEach((input) => input.addEventListener("input", render));
  document.querySelectorAll(".chip-button[data-start]").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById("startYear").value = button.dataset.start;
      document.getElementById("endYear").value = button.dataset.end;
      render();
    });
  });
  document.getElementById("resetFilters").addEventListener("click", () => {
    document.getElementById("startYear").value = metadata.start_year;
    document.getElementById("endYear").value = metadata.latest_year;
    document.getElementById("teamSearch").value = "";
    ["teamFilter", "leagueFilter", "divisionFilter", "postseasonFilter", "payrollTierFilter"].forEach((id) => document.getElementById(id).value = "");
    document.getElementById("minPayroll").value = 0;
    document.getElementById("measureSelect").value = "world_series_wins";
    document.getElementById("breakdownSelect").value = "team_name";
    document.getElementById("topN").value = 12;
    render();
  });
  document.getElementById("playSeasons").addEventListener("click", () => {
    if (animationTimer) {
      clearInterval(animationTimer);
      animationTimer = null;
      document.getElementById("playSeasons").textContent = "Animate seasons";
      return;
    }
    let year = Number(document.getElementById("startYear").value);
    document.getElementById("playSeasons").textContent = "Stop animation";
    animationTimer = setInterval(() => {
      document.getElementById("endYear").value = year;
      render();
      year += 1;
      if (year > metadata.latest_year) year = metadata.start_year;
    }, 900);
  });
}

async function init() {
  const response = await fetch(DATA_URL);
  const data = await response.json();
  teamSeasons = data.teamSeasons;
  worldSeries = data.worldSeries;
  rosters = data.rosters;
  metadata = data.metadata;
  document.getElementById("startYear").min = metadata.start_year;
  document.getElementById("startYear").max = metadata.latest_year;
  document.getElementById("endYear").min = metadata.start_year;
  document.getElementById("endYear").max = metadata.latest_year;
  fillSelect("teamFilter", "team_name", "All teams");
  fillSelect("leagueFilter", "league", "All leagues");
  fillSelect("divisionFilter", "division", "All divisions");
  document.getElementById("loadingState").remove();
  renderTicker();
  wireEvents();
  render();
}

init().catch((error) => {
  document.getElementById("loadingState").textContent = `Dashboard data failed to load: ${error.message}`;
});
