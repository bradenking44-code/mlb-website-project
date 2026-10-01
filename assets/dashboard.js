const DATA_URL = "data/processed/postseason_dashboard_data.json?v=20261001-23";

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
const teamColors = {
  ANA: "#ba0021", ARI: "#a71930", ATH: "#003831", ATL: "#ce1141", BAL: "#df4601",
  BOS: "#bd3039", CAL: "#ba0021", CHA: "#27251f", CHN: "#0e3386", CIN: "#c6011f",
  CLE: "#00385d", COL: "#333366", DET: "#0c2340", FLO: "#00a3e0", HOU: "#002d62",
  KCA: "#004687", LAA: "#ba0021", LAN: "#005a9c", MIA: "#00a3e0", MIL: "#12284b",
  ML4: "#12284b", MIN: "#002b5c", MON: "#003da5", NYA: "#0c2340", NYN: "#002d72",
  OAK: "#003831", PHI: "#e81828", PIT: "#27251f", SDN: "#2f241d", SEA: "#0c2c56",
  SFN: "#fd5a1e", SLN: "#c41e3a", TBA: "#092c5c", TEX: "#003278", TOR: "#134a8e",
  WAS: "#ab0003",
};
const payrollTierColors = {
  "Top third": "#2f6f63",
  "Middle third": "#d39b2a",
  "Bottom third": "#be1e2d",
};

function teamColor(teamId) {
  return teamColors[teamId] || "#435466";
}

let teamSeasons = [];
let worldSeries = [];
let rosters = {};
let metadata = {};
let currentPayrollSnapshot = null;
let openingDayPayrolls = [];
let animationTimer = null;
let selectedRosterKey = "";

const money = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const number = new Intl.NumberFormat("en-US");

function fmtMoney(value) {
  return value || value === 0 ? `$${money.format(value)}M` : "No payroll";
}

const currencyPreferenceKey = "moneyball-show-2025-dollars";

function inflationToggleIsOn() {
  return Boolean(document.getElementById("inflationAdjusted")?.checked);
}

function payrollDisplayValue(value, year, adjusted = inflationToggleIsOn()) {
  const cpi = window.MLBPayrollCPI;
  return adjusted && cpi?.supports(year) ? cpi.toBase(value, year) : Number(value) || 0;
}

function readCurrencyPreference() {
  try {
    return localStorage.getItem(currencyPreferenceKey) === "true";
  } catch {
    return false;
  }
}

function saveCurrencyPreference(value) {
  try {
    localStorage.setItem(currencyPreferenceKey, String(Boolean(value)));
  } catch {
    // The dashboard still works when browser storage is unavailable.
  }
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

function tooltipText(title, lines = []) {
  return escapeHtml([title, ...lines].filter(Boolean).join("\n"));
}

function ensureTooltip() {
  let tooltip = document.getElementById("chartTooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "chartTooltip";
    tooltip.className = "chart-tooltip";
    document.body.appendChild(tooltip);
  }
  return tooltip;
}

function moveTooltip(event) {
  const tooltip = ensureTooltip();
  const offset = 16;
  let x = event.clientX;
  let y = event.clientY;
  if (!x || !y) {
    const box = event.currentTarget.getBoundingClientRect();
    x = box.left + box.width / 2;
    y = box.top + box.height / 2;
  }
  tooltip.style.left = `${Math.min(x + offset, window.innerWidth - tooltip.offsetWidth - 12)}px`;
  tooltip.style.top = `${Math.min(y + offset, window.innerHeight - tooltip.offsetHeight - 12)}px`;
}

function showTooltip(event) {
  const tooltip = ensureTooltip();
  tooltip.innerHTML = String(event.currentTarget.dataset.tip || "").replace(/\n/g, "<br>");
  tooltip.classList.add("is-visible");
  moveTooltip(event);
}

function hideTooltip() {
  ensureTooltip().classList.remove("is-visible");
}

function bindChartTooltips() {
  document.querySelectorAll("[data-tip]").forEach((mark) => {
    mark.addEventListener("mouseenter", showTooltip);
    mark.addEventListener("mousemove", moveTooltip);
    mark.addEventListener("mouseleave", hideTooltip);
    mark.addEventListener("focus", showTooltip);
    mark.addEventListener("blur", hideTooltip);
  });
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

function fillRosterTeamSelect() {
  const select = document.getElementById("rosterTeamSelect");
  select.innerHTML = unique("team_name").map((team) => `<option value="${escapeHtml(team)}">${escapeHtml(team)}</option>`).join("");
}

function fillRosterYearSelect(teamName, preferredYear = "") {
  const years = teamSeasons
    .filter((row) => row.team_name === teamName)
    .map((row) => row.year)
    .sort((a, b) => b - a);
  const select = document.getElementById("rosterYearSelect");
  select.innerHTML = years.map((year) => `<option value="${year}">${year}</option>`).join("");
  if (preferredYear && years.includes(Number(preferredYear))) select.value = preferredYear;
}

function syncTableYearSelect(rows) {
  const select = document.getElementById("tableYearSelect");
  const current = select.value;
  const years = [...new Set(rows.map((row) => row.year))].sort((a, b) => b - a);
  select.innerHTML = years.map((year) => `<option value="${year}">${year}</option>`).join("");
  if (current && years.includes(Number(current))) {
    select.value = current;
  } else if (years.length) {
    select.value = String(years[0]);
  }
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
    inflationAdjusted: inflationToggleIsOn(),
    measure: document.getElementById("measureSelect").value,
    breakdown: document.getElementById("breakdownSelect").value,
    topN: Number(document.getElementById("topN").value || 12),
  };
}

function filteredRows() {
  const f = filters();
  return teamSeasons.filter((row) => {
    const wsTeam = row.world_series_winner || row.league_champion;
    const payroll = payrollDisplayValue(row.payroll_millions, row.year, f.inflationAdjusted);
    return row.year >= f.start &&
      row.year <= f.end &&
      (!f.teamSearch || row.team_name.toLowerCase().includes(f.teamSearch) || row.team_id.toLowerCase().includes(f.teamSearch)) &&
      (!f.team || row.team_name === f.team) &&
      (!f.league || row.league === f.league) &&
      (!f.division || row.division === f.division) &&
      (!f.payrollTier || row.payroll_tier === f.payrollTier) &&
      (!f.minPayroll || payroll >= f.minPayroll) &&
      (!f.postseason ||
        (f.postseason === "playoffs" && row.playoff_team) ||
        (f.postseason === "missed" && !row.playoff_team) ||
        (f.postseason === "world_series" && wsTeam) ||
        (f.postseason === "champions" && row.world_series_winner));
  }).map((row) => {
    const displayPayroll = payrollDisplayValue(row.payroll_millions, row.year, f.inflationAdjusted);
    return displayPayroll === row.payroll_millions ? row : { ...row, payroll_millions: displayPayroll };
  });
}

function aggregate(rows, group, measure, limit) {
  const map = new Map();
  rows.forEach((row) => {
    const key = row[group] ?? "Unknown";
    if (!map.has(key)) {
      map.set(key, {
        label: String(key),
        team_id: group === "team_name" ? row.team_id : "",
        color: group === "payroll_tier" ? payrollTierColors[key] : "",
        seasons: 0,
        wins: 0,
        losses: 0,
        payroll: 0,
        payrollRows: 0,
        playoffs: 0,
        ws: 0,
        roster: 0,
        rank: 0,
        rankRows: 0,
      });
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
  const payrollInput = document.getElementById("minPayroll");
  const payrollMax = filters().inflationAdjusted ? 400 : 350;
  payrollInput.max = payrollMax;
  if (Number(payrollInput.value) > payrollMax) payrollInput.value = payrollMax;
  document.getElementById("minPayrollMax").textContent = `$${payrollMax}M`;
  document.getElementById("minPayrollValue").textContent = `$${payrollInput.value}M`;
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
    [avgPayroll, filters().inflationAdjusted ? "Avg payroll (2025 $)" : "Avg payroll", "payroll_millions"],
  ];
  document.getElementById("dashboardMetrics").innerHTML = cards.map(([value, label, field]) => `
    <div class="metric-card"><strong>${field ? fmtValue(value, field) : number.format(Math.round(value || 0))}</strong><span>${label}</span></div>
  `).join("");
}

function renderExecutiveFinding(rows) {
  const target = document.getElementById("executiveFinding");
  if (!target) return;
  const tiers = ["Top third", "Middle third", "Bottom third"].map((tier) => {
    const set = rows.filter((row) => row.payroll_tier === tier);
    return {
      name: tier.toLowerCase(),
      seasons: set.length,
      titles: set.filter((row) => row.world_series_winner).length,
    };
  });
  const top = tiers[0];
  const bottom = tiers[2];
  if (!top.seasons || !bottom.seasons) {
    target.innerHTML = `<strong>Reading the current view</strong><span>Choose a wider set of payroll tiers to compare postseason outcomes.</span>`;
    return;
  }
  const topRate = (100 * top.titles / top.seasons).toFixed(1);
  const bottomRate = (100 * bottom.titles / bottom.seasons).toFixed(1);
  target.innerHTML = `<strong>Payroll is associated with playoff chances, but it did not guarantee a title.</strong><span>In this filtered view, the ${top.name} had a ${topRate}% title rate (${top.titles} titles in ${top.seasons} team-seasons); the ${bottom.name} had a ${bottomRate}% rate (${bottom.titles} in ${bottom.seasons}). The ladder below also shows playoff and World Series appearance rates.</span>`;
}

function outcomeLadderChart(rows) {
  const outcomes = [
    ["Playoffs", "playoff_team"],
    ["World Series appearance", "league_champion"],
    ["Title", "world_series_winner"],
  ];
  const tiers = ["Top third", "Middle third", "Bottom third"];
  const columns = tiers.map((tier) => {
    const set = rows.filter((row) => row.payroll_tier === tier);
    const color = payrollTierColors[tier];
    const stages = outcomes.map(([label, field]) => {
      const successes = set.filter((row) => row[field]).length;
      const rate = set.length ? successes / set.length : 0;
      return `<div class="outcome-stage">
        <div class="outcome-stage-heading"><span>${label}</span><strong>${(rate * 100).toFixed(1)}%</strong></div>
        <div class="outcome-track" aria-hidden="true"><span style="width:${Math.min(100, rate * 100)}%;background:${color}"></span></div>
        <small>${number.format(successes)} of ${number.format(set.length)} team-seasons</small>
      </div>`;
    }).join("");
    return `<article class="outcome-tier">
      <h4><span class="tier-swatch" style="background:${color}"></span>${escapeHtml(tier)}</h4>
      ${stages}
    </article>`;
  }).join("");
  const target = document.getElementById("outcomeLadder");
  target.innerHTML = `<h3 class="chart-title">Payroll tier outcome ladder</h3>
    <p class="chart-subtitle">Share of matching club-seasons that reached each stage. Counts keep the title rates in context.</p>
    <div class="outcome-ladder-grid">${columns}</div>
    <p class="chart-source-note">Completed outcomes: 1985-2025. Payroll tiers rank clubs within each season; payroll sources change after 2016.</p>`;
}

function setChartSourceNote(id, text) {
  const target = document.getElementById(id);
  if (!target) return;
  target.querySelector(".chart-source-note")?.remove();
  target.insertAdjacentHTML("beforeend", `<p class="chart-source-note">${escapeHtml(text)}</p>`);
}

function updateChartSourceNotes(rows) {
  const payrollCount = rows.filter((row) => row.payroll_millions).length;
  const winnerCount = rows.filter((row) => row.world_series_winner && row.payroll_millions).length;
  const source = "Payroll through 2016: Lahman/SABR salary totals; 2017-2025: The Baseball Cube Opening Day payrolls. ";
  const dollars = filters().inflationAdjusted
    ? "Historical amounts use annual-average CPI-U in 2025 dollars; 2026 archive amounts stay nominal."
    : "Payroll amounts are shown in source-year dollars.";
  const base = source + dollars;
  setChartSourceNote("breakdownChart", `Current sample: ${number.format(rows.length)} team-seasons. ${base}`);
  setChartSourceNote("trendChart", `Current sample: ${number.format(rows.length)} team-seasons across ${filters().start}-${filters().end}. ${base}`);
  setChartSourceNote("tierChart", `Payroll tiers include ${number.format(rows.filter((row) => row.payroll_tier && row.payroll_tier !== "Payroll unavailable").length)} team-seasons with a within-season payroll rank.`);
  setChartSourceNote("wsPayrollChart", `Current sample: ${number.format(winnerCount)} World Series winners represented by the active filters. Values compare each winner with that season's league average. ${base}`);
  setChartSourceNote("scatterChart", `Current sample: ${number.format(payrollCount)} team-seasons with payroll and records. Team colors identify clubs. ${base}`);
}

function svgWrap(title, body, subtitle = "", height = 330) {
  return `<h3 class="chart-title">${escapeHtml(title)}</h3>${subtitle ? `<p class="chart-subtitle">${escapeHtml(subtitle)}</p>` : ""}<svg viewBox="0 0 720 ${height}" style="height:${height}px" role="img" aria-label="${escapeHtml(title)}">${body}</svg>`;
}

function barChart(id, title, data, field) {
  if (!data.length) {
    document.getElementById(id).innerHTML = `<h3 class="chart-title">${escapeHtml(title)}</h3><div class="empty-chart">No matching data for the current filters.</div>`;
    return;
  }
  const max = Math.max(...data.map((d) => d.value), 1);
  const hasTeamLabels = data.some((d) => d.team_id);
  const labelX = hasTeamLabels ? 218 : 154;
  const startX = hasTeamLabels ? 230 : 166;
  const plotRight = 680;
  const width = plotRight - startX - 74;
  const rowH = Math.max(20, Math.min(34, 250 / Math.min(data.length, 12)));
  const chartHeight = Math.max(330, 72 + data.length * rowH);
  const bars = data.map((d, i) => {
    const y = 42 + i * rowH;
    const barW = (d.value / max) * width;
    const tip = tooltipText(d.label, [`${labels[field] || field}: ${fmtValue(d.value, field)}`, `Seasons in group: ${d.seasons || 0}`]);
    const fill = d.team_id ? teamColor(d.team_id) : d.color || colors[i % colors.length];
    return `
      <text x="${labelX}" y="${y + 15}" text-anchor="end" class="svg-label bar-category-label">${escapeHtml(d.label)}</text>
      <rect class="tooltip-mark" tabindex="0" data-tip="${tip}" x="${startX}" y="${y}" width="${barW}" height="${rowH - 7}" rx="5" fill="${fill}"></rect>
      <text x="${Math.min(startX + barW + 8, 690)}" y="${y + 15}" class="svg-value">${fmtValue(d.value, field)}</text>`;
  }).join("");
  const subtitle = hasTeamLabels
    ? "Club colors identify each team; hover a bar for the full value."
    : "Hover a bar for its value; filters rebuild this chart from the current view.";
  document.getElementById(id).innerHTML = svgWrap(title, bars, subtitle, chartHeight);
}

function verticalBarChart(id, title, data, field) {
  if (!data.length) {
    document.getElementById(id).innerHTML = `<h3 class="chart-title">${escapeHtml(title)}</h3><div class="empty-chart">No matching data for the current filters.</div>`;
    return;
  }

  const plotLeft = 76;
  const plotRight = 690;
  const plotTop = 42;
  const plotBottom = 274;
  const plotHeight = plotBottom - plotTop;
  const slot = (plotRight - plotLeft) / data.length;
  const barWidth = Math.min(112, slot * 0.52);
  const grid = [0, 0.25, 0.5, 0.75, 1].map((tick) => {
    const y = plotBottom - tick * plotHeight;
    return `
      <line x1="${plotLeft}" y1="${y}" x2="${plotRight}" y2="${y}" class="chart-gridline"></line>
      <text x="${plotLeft - 10}" y="${y + 4}" text-anchor="end" class="svg-label">${Math.round(tick * 100)}%</text>`;
  }).join("");
  const bars = data.map((item, index) => {
    const x = plotLeft + index * slot + (slot - barWidth) / 2;
    const height = Math.max(0, Math.min(1, item.value)) * plotHeight;
    const y = plotBottom - height;
    const color = item.color || colors[index % colors.length];
    const tip = tooltipText(item.label, [
      `Playoff rate: ${fmtValue(item.value, field)}`,
      `Playoff teams: ${item.playoffTeams || 0}`,
      `Team seasons: ${item.seasons || 0}`,
    ]);
    return `
      <rect class="tooltip-mark" tabindex="0" data-tip="${tip}" x="${x}" y="${y}" width="${barWidth}" height="${height}" rx="6" fill="${color}"></rect>
      <text x="${x + barWidth / 2}" y="${Math.max(plotTop + 14, y - 9)}" text-anchor="middle" class="svg-value">${fmtValue(item.value, field)}</text>
      <text x="${x + barWidth / 2}" y="${plotBottom + 25}" text-anchor="middle" class="svg-label">${escapeHtml(item.label)}</text>`;
  }).join("");
  const body = `
    ${grid}
    <line x1="${plotLeft}" y1="${plotBottom}" x2="${plotRight}" y2="${plotBottom}" class="axis"></line>
    ${bars}`;
  document.getElementById(id).innerHTML = svgWrap(title, body, "Share of team seasons reaching the playoffs; hover a bar for counts.", 330);
}

function lineChart(id, title, data, field) {
  const clean = data.filter((d) => Number.isFinite(d.value));
  if (!clean.length) {
    document.getElementById(id).innerHTML = `<h3 class="chart-title">${escapeHtml(title)}</h3><div class="empty-chart">No payroll-backed data for this view. Try the Payroll Era filter.</div>`;
    return;
  }
  const minYear = Math.min(...clean.map((d) => Number(d.label)), 1985);
  const maxYear = Math.max(...clean.map((d) => Number(d.label)), 2025);
  const max = Math.max(...clean.map((d) => d.value), 1);
  const min = Math.min(...clean.map((d) => d.value), 0);
  const x = (year) => 55 + ((year - minYear) / Math.max(1, maxYear - minYear)) * 620;
  const y = (value) => 285 - ((value - min) / Math.max(0.01, max - min)) * 220;
  const points = clean.map((d) => `${x(Number(d.label))},${y(d.value)}`).join(" ");
  const dots = clean.map((d, i) => {
    const cx = x(Number(d.label));
    const cy = y(d.value);
    const visible = d.team_id || i % Math.max(1, Math.floor(clean.length / 12)) === 0;
    const dotColor = d.team_id ? teamColor(d.team_id) : "#be1e2d";
    const tip = tooltipText(d.team_name ? `${d.label} ${d.team_name}` : d.label, [
      `${labels[field] || field}: ${fmtValue(d.value, field)}`,
      ...(d.tooltipLines || []),
    ]);
    return `
      ${visible ? `<circle cx="${cx}" cy="${cy}" r="4" fill="${dotColor}"></circle>` : ""}
      <circle class="tooltip-mark" tabindex="0" data-tip="${tip}" cx="${cx}" cy="${cy}" r="10" fill="transparent"></circle>`;
  }).join("");
  const body = `
    <line x1="55" y1="285" x2="680" y2="285" class="axis"></line>
    <line x1="55" y1="45" x2="55" y2="285" class="axis"></line>
    <polyline points="${points}" fill="none" stroke="#be1e2d" stroke-width="4"></polyline>
    ${dots}
    <text x="55" y="315" class="svg-label">${minYear}</text>
    <text x="680" y="315" text-anchor="end" class="svg-label">${maxYear}</text>`;
  document.getElementById(id).innerHTML = svgWrap(title, body);
}

function championPayrollRankChart(id, rows) {
  const data = rows
    .filter((row) => row.world_series_winner && row.payroll_rank)
    .sort((a, b) => a.year - b.year);
  if (!data.length) {
    document.getElementById(id).innerHTML = `<h3 class="chart-title">World Series champion payroll rank by year</h3><div class="empty-chart">No champions with payroll ranks match the current filters.</div>`;
    return;
  }

  const plotLeft = 72;
  const plotRight = 680;
  const plotTop = 48;
  const plotBottom = 278;
  const minYear = Math.min(...data.map((row) => row.year));
  const maxYear = Math.max(...data.map((row) => row.year));
  const x = (year) => plotLeft + ((year - minYear) / Math.max(1, maxYear - minYear)) * (plotRight - plotLeft);
  const y = (rank) => plotTop + ((rank - 1) / 29) * (plotBottom - plotTop);
  const topThirdCutoff = y(10);
  const line = data.map((row) => `${x(row.year)},${y(row.payroll_rank)}`).join(" ");
  const dots = data.map((row) => {
    const tip = tooltipText(`${row.year} ${row.team_name}`, [
      `Payroll rank: #${row.payroll_rank} of 30`,
      `Payroll: ${fmtMoney(row.payroll_millions)}`,
      `Payroll tier: ${row.payroll_tier}`,
      `Payroll source: ${row.payroll_source || "Unknown"}`,
    ]);
    return `<circle class="tooltip-mark" tabindex="0" data-tip="${tip}" cx="${x(row.year)}" cy="${y(row.payroll_rank)}" r="5" fill="${teamColor(row.team_id)}" stroke="#ffffff" stroke-width="1.5"></circle>`;
  }).join("");
  const yearLabels = minYear === maxYear
    ? `<text x="${(plotLeft + plotRight) / 2}" y="310" text-anchor="middle" class="svg-label">${minYear}</text>`
    : `<text x="${plotLeft}" y="310" class="svg-label">${minYear}</text><text x="${plotRight}" y="310" text-anchor="end" class="svg-label">${maxYear}</text>`;
  const body = `
    <rect x="${plotLeft}" y="${plotTop}" width="${plotRight - plotLeft}" height="${topThirdCutoff - plotTop}" fill="rgba(47,111,99,.12)"></rect>
    <line x1="${plotLeft}" y1="${y(10)}" x2="${plotRight}" y2="${y(10)}" stroke="#2f6f63" stroke-dasharray="5 4"></line>
    <line x1="${plotLeft}" y1="${y(20)}" x2="${plotRight}" y2="${y(20)}" class="axis" stroke-dasharray="3 5"></line>
    <line x1="${plotLeft}" y1="${plotTop}" x2="${plotLeft}" y2="${plotBottom}" class="axis"></line>
    <line x1="${plotLeft}" y1="${plotBottom}" x2="${plotRight}" y2="${plotBottom}" class="axis"></line>
    <polyline points="${line}" fill="none" stroke="#be1e2d" stroke-width="2.5" opacity=".75"></polyline>
    ${dots}
    <text x="64" y="${plotTop + 4}" text-anchor="end" class="svg-label">#1</text>
    <text x="64" y="${y(10) + 4}" text-anchor="end" class="svg-label">#10</text>
    <text x="64" y="${y(20) + 4}" text-anchor="end" class="svg-label">#20</text>
    <text x="64" y="${plotBottom + 4}" text-anchor="end" class="svg-label">#30</text>
    <text x="${plotRight - 6}" y="${plotTop + 16}" text-anchor="end" class="svg-label">Top third</text>
    ${yearLabels}`;
  document.getElementById(id).innerHTML = svgWrap(
    "World Series champion payroll rank by year",
    body,
    "One dot per champion; #1 is the highest payroll. Shaded band marks the top third.",
  );
}

function scatterChart(id, title, rows) {
  const data = rows.filter((row) => row.payroll_millions && row.win_pct);
  if (!data.length) {
    document.getElementById(id).innerHTML = `<h3 class="chart-title">${escapeHtml(title)}</h3><div class="empty-chart">Payroll scatter needs team seasons with both payroll and records. Choose a range from 1985-2025.</div>`;
    return;
  }
  const maxX = Math.max(...data.map((row) => row.payroll_millions), 1);
  const x = (value) => 55 + (value / maxX) * 620;
  const y = (value) => 285 - value * 390;
  const points = data.map((row) => {
    const fill = teamColor(row.team_id);
    const stroke = row.world_series_winner ? "#d39b2a" : row.playoff_team ? "#be1e2d" : "#ffffff";
    const strokeWidth = row.world_series_winner ? 3 : row.playoff_team ? 2 : 1;
    const r = row.world_series_winner ? 7 : row.playoff_team ? 5 : 3;
    const tip = tooltipText(`${row.year} ${row.team_name}`, [
      `Payroll: ${fmtMoney(row.payroll_millions)}`,
      `Record: ${row.wins}-${row.losses} (${fmtValue(row.win_pct, "win_pct")})`,
      `Payroll rank: ${row.payroll_rank ? `#${row.payroll_rank}` : "n/a"}`,
      `Payroll source: ${row.payroll_source || "Unknown"}`,
      row.postseason_result,
    ]);
    return `<circle class="tooltip-mark" tabindex="0" data-tip="${tip}" cx="${x(row.payroll_millions)}" cy="${y(row.win_pct)}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"></circle>`;
  }).join("");
  const body = `
    <line x1="55" y1="285" x2="680" y2="285" class="axis"></line>
    <line x1="55" y1="60" x2="55" y2="285" class="axis"></line>
    ${points}
    <text x="55" y="315" class="svg-label">$0M payroll</text>
    <text x="680" y="315" text-anchor="end" class="svg-label">${fmtMoney(maxX)}</text>
    <text x="18" y="70" class="svg-label">.600+</text>
    <text x="18" y="285" class="svg-label">.000</text>`;
  document.getElementById(id).innerHTML = svgWrap(title, body, "Team colors identify clubs; gold rings mark champions and red rings mark playoff teams.");
}

function tierChart(rows) {
  const tiers = ["Top third", "Middle third", "Bottom third"];
  const data = tiers.map((tier) => {
    const set = rows.filter((row) => row.payroll_tier === tier);
    return {
      label: tier,
      value: set.filter((row) => row.playoff_team).length / Math.max(1, set.length),
      seasons: set.length,
      playoffTeams: set.filter((row) => row.playoff_team).length,
      color: payrollTierColors[tier],
    };
  });
  verticalBarChart("tierChart", "Playoff rate by payroll tier", data, "playoff_rate");
}

function wsPayrollChart(rows) {
  const winners = new Map(rows
    .filter((row) => row.world_series_winner)
    .map((row) => [`${row.year}-${row.team_id}`, row]));
  const data = worldSeries.flatMap((row) => {
    const winner = winners.get(`${row.year}-${row.winner_id}`);
    if (!winner || !row.winner_payroll_millions) return [];
    const winnerPayroll = winner.payroll_millions || payrollDisplayValue(row.winner_payroll_millions, row.year);
    const leagueAverage = payrollDisplayValue(row.league_avg_payroll_millions, row.year);
    return [{
      label: row.year,
      value: winnerPayroll - leagueAverage,
      team_id: row.winner_id,
      team_name: row.winner,
      tooltipLines: [
        `Winner payroll: ${fmtMoney(winnerPayroll)}`,
        `League average: ${fmtMoney(leagueAverage)}`,
      ],
    }];
  });
  const title = `World Series winner payroll vs league average${filters().inflationAdjusted ? " (2025 $)" : ""}`;
  lineChart("wsPayrollChart", title, data, "payroll_millions");
}

function renderWorldSeries(rows) {
  const winnerKeys = new Set(rows
    .filter((row) => row.world_series_winner)
    .map((row) => `${row.year}-${row.team_id}`));
  const items = worldSeries.filter((row) => winnerKeys.has(`${row.year}-${row.winner_id}`)).sort((a, b) => b.year - a.year);
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
  const items = worldSeries.slice(-8).reverse();
  document.getElementById("payrollTicker").innerHTML = items.map((row) =>
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
    <div class="roster-header">${teamCell(row)}<span>${row.wins}-${row.losses}, ${row.postseason_result}, ${fmtMoney(payrollDisplayValue(row.payroll_millions, row.year))}${inflationToggleIsOn() && window.MLBPayrollCPI?.supports(row.year) ? " (2025 $)" : ""}</span></div>
    <div class="roster-list">
      ${players.slice(0, 36).map((player) => `<span title="${player.games} games">${escapeHtml(player.player_name)} <small>${player.games} G</small></span>`).join("")}
    </div>`;
}

function renderRosterFromControls() {
  const teamName = document.getElementById("rosterTeamSelect").value;
  const year = Number(document.getElementById("rosterYearSelect").value);
  const row = teamSeasons.find((item) => item.team_name === teamName && item.year === year);
  if (row) {
    selectedRosterKey = `${row.year}-${row.team_id}`;
    renderRoster(row);
  }
}

function setRosterControls(row) {
  if (!row) return;
  const teamSelect = document.getElementById("rosterTeamSelect");
  const yearSelect = document.getElementById("rosterYearSelect");
  teamSelect.value = row.team_name;
  fillRosterYearSelect(row.team_name, String(row.year));
  yearSelect.value = String(row.year);
  selectedRosterKey = `${row.year}-${row.team_id}`;
}

function renderTable(rows) {
  syncTableYearSelect(rows);
  const tableYear = Number(document.getElementById("tableYearSelect").value);
  const tableRows = tableYear ? rows.filter((row) => row.year === tableYear) : rows;
  document.getElementById("seasonPayrollHeading").textContent = filters().inflationAdjusted ? "Payroll (2025 $)" : "Payroll";
  const sorted = [...tableRows].sort((a, b) => b.wins - a.wins || a.team_name.localeCompare(b.team_name));
  document.getElementById("rowCount").textContent = `${sorted.length} teams shown from ${tableYear || "all years"} (${rows.length} match filters)`;
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
    button.addEventListener("click", () => {
      const row = sorted[Number(button.dataset.row)];
      setRosterControls(row);
      renderRoster(row);
    });
  });
  const selectedRow = teamSeasons.find((row) => `${row.year}-${row.team_id}` === selectedRosterKey);
  if (selectedRow) renderRoster(selectedRow);
  else {
    setRosterControls(sorted[0]);
    renderRoster(sorted[0]);
  }
}

function renderCurrentPayrollSnapshot(snapshot) {
  if (!snapshot?.teams?.length) return;
  const formatDate = (value) => {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
    });
  };
  document.getElementById("cotsPayrollCaption").textContent =
    `${snapshot.teams.length} teams · sheets ${formatDate(snapshot.earliest_sheet_as_of)}–${formatDate(snapshot.latest_sheet_as_of)}`;
  document.getElementById("cotsPayrollTable").innerHTML = snapshot.teams.map((row, index) => `
    <tr>
      <td>#${index + 1}</td>
      <td>${teamCell(row)}</td>
      <td>${fmtMoney(row.payroll_millions)}</td>
      <td>${fmtMoney(row.cbt_payroll_millions)}</td>
      <td>${formatDate(row.cots_sheet_as_of)}</td>
    </tr>
  `).join("");
}

function renderOpeningDayPayrollArchive() {
  const select = document.getElementById("openingPayrollYearSelect");
  if (!select || !openingDayPayrolls.length) return;
  const years = [...new Set(openingDayPayrolls.map((row) => row.year))].sort((a, b) => b - a);
  const selectedYear = Number(select.value) || years[0];
  select.innerHTML = years.map((year) => `<option value="${year}">${year}</option>`).join("");
  select.value = String(years.includes(selectedYear) ? selectedYear : years[0]);

  const year = Number(select.value);
  const rows = openingDayPayrolls.filter((row) => row.year === year);
  const teamYearIndex = new Map(teamSeasons.filter((row) => row.year === year).map((row) => [row.team_id, row]));
  const divisionName = { E: "East", C: "Central", W: "West" };
  document.getElementById("openingPayrollCount").textContent = `${rows.length} teams`;
  document.getElementById("openingPayrollSource").href = `https://www.thebaseballcube.com/content/payroll_year/${year}/`;
  document.getElementById("openingPayrollTable").innerHTML = rows.map((row) => {
    const season = teamYearIndex.get(row.team_id);
    const record = season
      ? `${season.wins}-${season.losses}`
      : year === 2026 ? "Season has not concluded yet" : "No completed-season record";
    return `<tr>
      <td>#${row.payroll_rank}</td>
      <td>${teamCell(row)}</td>
      <td>${fmtMoney(row.payroll_millions)}</td>
      <td>${escapeHtml(row.league || "—")}</td>
      <td>${escapeHtml(divisionName[row.division] || row.division || "—")}</td>
      <td>${escapeHtml(record)}</td>
    </tr>`;
  }).join("");
}

function render() {
  setReadouts();
  const rows = filteredRows();
  const f = filters();
  labels.payroll_millions = f.inflationAdjusted ? "Payroll, 2025 $M" : "Payroll, $M";
  metricCards(rows);
  renderExecutiveFinding(rows);
  renderWorldSeries(rows);
  barChart("breakdownChart", `${labels[f.measure]} by ${labels[f.breakdown]}`, aggregate(rows, f.breakdown, f.measure, f.topN), f.measure);
  if (f.measure === "world_series_wins") {
    championPayrollRankChart("trendChart", rows);
  } else {
    const yearly = aggregate(rows, "year", f.measure, 100).sort((a, b) => Number(a.label) - Number(b.label));
    lineChart("trendChart", `${labels[f.measure]} trend`, yearly, f.measure);
  }
  tierChart(rows);
  outcomeLadderChart(rows);
  wsPayrollChart(rows);
  scatterChart("scatterChart", `Payroll vs win percentage${f.inflationAdjusted ? " (2025 $)" : ""}`, rows);
  renderTable(rows);
  updateChartSourceNotes(rows);
  renderOpeningDayPayrollArchive();
  bindChartTooltips();
}

function wireEvents() {
  document.querySelectorAll("input, select").forEach((input) => input.addEventListener("input", render));
  const inflationToggle = document.getElementById("inflationAdjusted");
  inflationToggle.addEventListener("change", () => saveCurrencyPreference(inflationToggle.checked));
  window.addEventListener("storage", (event) => {
    if (event.key !== currencyPreferenceKey) return;
    inflationToggle.checked = event.newValue === "true";
    render();
  });
  document.querySelectorAll(".chip-button[data-start]").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById("startYear").value = button.dataset.start;
      document.getElementById("endYear").value = button.dataset.end;
      render();
    });
  });
  document.getElementById("resetFilters").addEventListener("click", () => {
    document.getElementById("startYear").value = metadata.start_year;
    document.getElementById("endYear").value = metadata.payroll_end_year || metadata.latest_year;
    document.getElementById("teamSearch").value = "";
    ["teamFilter", "leagueFilter", "divisionFilter", "postseasonFilter", "payrollTierFilter"].forEach((id) => document.getElementById(id).value = "");
    document.getElementById("minPayroll").value = 0;
    document.getElementById("inflationAdjusted").checked = false;
    saveCurrencyPreference(false);
    document.getElementById("measureSelect").value = "world_series_wins";
    document.getElementById("breakdownSelect").value = "team_name";
    document.getElementById("topN").value = 12;
    document.getElementById("tableYearSelect").value = metadata.payroll_end_year || metadata.latest_year;
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
  document.getElementById("rosterTeamSelect").addEventListener("change", () => {
    fillRosterYearSelect(document.getElementById("rosterTeamSelect").value);
    renderRosterFromControls();
  });
  document.getElementById("rosterYearSelect").addEventListener("change", renderRosterFromControls);
  document.getElementById("openingPayrollYearSelect").addEventListener("change", renderOpeningDayPayrollArchive);
}

async function init() {
  const response = await fetch(DATA_URL);
  const data = await response.json();
  teamSeasons = data.teamSeasons;
  worldSeries = data.worldSeries;
  rosters = data.rosters;
  metadata = data.metadata;
  currentPayrollSnapshot = data.currentPayrollSnapshot;
  openingDayPayrolls = data.openingDayPayrolls || [];
  document.getElementById("inflationAdjusted").checked = readCurrencyPreference();
  document.getElementById("startYear").min = metadata.start_year;
  document.getElementById("startYear").max = metadata.latest_year;
  document.getElementById("endYear").min = metadata.start_year;
  document.getElementById("endYear").max = metadata.latest_year;
  fillSelect("teamFilter", "team_name", "All teams");
  fillSelect("leagueFilter", "league", "All leagues");
  fillSelect("divisionFilter", "division", "All divisions");
  fillRosterTeamSelect();
  const firstPayrollWinner = teamSeasons.find((row) => row.world_series_winner && row.payroll_millions) || teamSeasons[0];
  setRosterControls(firstPayrollWinner);
  document.getElementById("loadingState").remove();
  renderTicker();
  renderOpeningDayPayrollArchive();
  renderCurrentPayrollSnapshot(currentPayrollSnapshot);
  wireEvents();
  render();
}

init().catch((error) => {
  document.getElementById("loadingState").textContent = `Dashboard data failed to load: ${error.message}`;
});
