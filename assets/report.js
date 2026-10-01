const numberFormat = new Intl.NumberFormat("en-US");
const decimalFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const colors = ["#be1e2d", "#113b64", "#2f6f63", "#d39b2a", "#642f6c", "#0c7c90", "#8f2f1f"];

function formatValue(value) {
  if (typeof value === "number" && value > 0 && value < 1) return `${(value * 100).toFixed(1)}%`;
  if (typeof value === "number" && value % 1 !== 0) return decimalFormat.format(value);
  return numberFormat.format(value || 0);
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

function makeSvgChart(section) {
  const data = section.chart || [];
  const longSeries = data.length > 18;
  if (longSeries) return makeLineChart(section, data);
  return makeBarChart(section, data);
}

function abbreviateLabel(label) {
  return String(label ?? "")
    .replace("Arizona Diamondbacks", "Arizona")
    .replace("Atlanta Braves", "Atlanta")
    .replace("Baltimore Orioles", "Baltimore")
    .replace("Boston Red Sox", "Boston")
    .replace("Chicago Cubs", "Cubs")
    .replace("Chicago White Sox", "White Sox")
    .replace("Cincinnati Reds", "Cincinnati")
    .replace("Cleveland Indians", "Cleveland")
    .replace("Cleveland Guardians", "Cleveland")
    .replace("Colorado Rockies", "Colorado")
    .replace("Detroit Tigers", "Detroit")
    .replace("Houston Astros", "Houston")
    .replace("Kansas City Royals", "Kansas City")
    .replace("Los Angeles Angels", "Angels")
    .replace("Los Angeles Dodgers", "Dodgers")
    .replace("Florida Marlins", "Marlins")
    .replace("Miami Marlins", "Marlins")
    .replace("Milwaukee Brewers", "Milwaukee")
    .replace("Minnesota Twins", "Minnesota")
    .replace("Montreal Expos", "Montreal")
    .replace("New York Mets", "Mets")
    .replace("New York Yankees", "Yankees")
    .replace("Oakland Athletics", "Oakland")
    .replace("Athletics", "A's")
    .replace("Philadelphia Phillies", "Phillies")
    .replace("Pittsburgh Pirates", "Pittsburgh")
    .replace("San Diego Padres", "San Diego")
    .replace("San Francisco Giants", "Giants")
    .replace("Seattle Mariners", "Seattle")
    .replace("St. Louis Cardinals", "St. Louis")
    .replace("Tampa Bay Devil Rays", "Tampa Bay")
    .replace("Tampa Bay Rays", "Tampa Bay")
    .replace("Texas Rangers", "Texas")
    .replace("Toronto Blue Jays", "Toronto")
    .replace("Washington Nationals", "Washington");
}

function splitChartLabel(label, maxChars = 17) {
  const text = abbreviateLabel(label);
  const seasonMatch = text.match(/^(\d{4})\s+(.+)$/);
  if (seasonMatch) return [seasonMatch[1], seasonMatch[2]];
  if (text.length <= maxChars) return [text];

  const words = text.split(/\s+/);
  const lines = [""];
  words.forEach((word) => {
    const current = lines[lines.length - 1];
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars || lines.length === 2) {
      lines[lines.length - 1] = candidate;
    } else {
      lines.push(word);
    }
  });

  return lines.slice(0, 2).map((line) => (line.length > maxChars ? `${line.slice(0, maxChars - 1)}...` : line));
}

function makeMultilineLabel(lines, x, y, anchor = "start") {
  const safeLines = lines.map((line) => escapeHtml(line));
  const startDy = safeLines.length > 1 ? 0 : 5;
  return `
    <text x="${x}" y="${y}" text-anchor="${anchor}" class="svg-label">
      ${safeLines.map((line, index) => (
        `<tspan x="${x}" dy="${index === 0 ? startDy : 13}">${line}</tspan>`
      )).join("")}
    </text>`;
}

function makeBarChart(section, data) {
  const max = Math.max(...data.map((item) => item.value), 1);
  const rowH = Math.min(38, 260 / Math.max(1, data.length));
  const bars = data.map((item, index) => {
    const y = 38 + index * rowH;
    const hasLogo = Boolean(item.logo_url);
    const labelLines = splitChartLabel(item.label, hasLogo ? 16 : 18);
    const label = item.logo_url
      ? `<image href="${escapeHtml(item.logo_url)}" x="18" y="${y - 3}" width="26" height="26" preserveAspectRatio="xMidYMid meet"></image>
         ${makeMultilineLabel(labelLines, 52, y + 8)}`
      : makeMultilineLabel(labelLines, 152, y + 8, "end");
    const barX = item.logo_url ? 198 : 168;
    const maxBar = item.logo_url ? 490 : 520;
    const barW = (item.value / max) * maxBar;
    return `
      ${label}
      <rect x="${barX}" y="${y}" width="${barW}" height="${rowH - 8}" rx="5" fill="${colors[index % colors.length]}">
        <title>${escapeHtml(item.label)}: ${formatValue(item.value)}</title>
      </rect>
      <text x="${Math.min(710, barX + 8 + barW)}" y="${y + 16}" class="svg-value">${formatValue(item.value)}</text>`;
  }).join("");
  return `<svg viewBox="0 0 760 340" role="img" aria-label="${escapeHtml(section.title)}">${bars}</svg>`;
}

function makeLineChart(section, data) {
  const values = data.map((item) => item.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const x = (index) => 55 + (index / Math.max(1, data.length - 1)) * 650;
  const y = (value) => 285 - ((value - min) / Math.max(0.01, max - min)) * 225;
  const points = data.map((item, index) => `${x(index)},${y(item.value)}`).join(" ");
  const dots = data.filter((_, index) => index % Math.max(1, Math.floor(data.length / 12)) === 0).map((item) => {
    const index = data.indexOf(item);
    return `<circle cx="${x(index)}" cy="${y(item.value)}" r="4" fill="#be1e2d"><title>${escapeHtml(item.label)}: ${formatValue(item.value)}</title></circle>`;
  }).join("");
  return `
    <svg viewBox="0 0 760 340" role="img" aria-label="${escapeHtml(section.title)}">
      <line x1="55" y1="285" x2="710" y2="285" class="axis"></line>
      <line x1="55" y1="50" x2="55" y2="285" class="axis"></line>
      <polyline points="${points}" fill="none" stroke="#be1e2d" stroke-width="4"></polyline>
      ${dots}
      <text x="55" y="315" class="svg-label">${escapeHtml(data[0]?.label || "")}</text>
      <text x="710" y="315" text-anchor="end" class="svg-label">${escapeHtml(data[data.length - 1]?.label || "")}</text>
    </svg>`;
}

function mascotCard(item) {
  const initials = escapeHtml(item.label).split(" ").map((part) => part[0]).join("").slice(0, 3);
  const mark = item.logo_url
    ? `<img class="team-logo" src="${escapeHtml(item.logo_url)}" alt="" loading="lazy">`
    : `<div class="mascot-mark">${initials}</div>`;
  const years = item.years?.length ? item.years.join(", ") : "No titles in 1985-2016";
  return `
    <article class="mascot-card">
      <div class="mascot-heading">
        ${mark}
        <div>
          <div class="mascot-name">${escapeHtml(item.label)}</div>
          <div class="mascot-meta">1985-2016 title leader</div>
        </div>
      </div>
      <div class="mascot-stat">${formatValue(item.value)}</div>
      <div class="mascot-years">${escapeHtml(years)}</div>
    </article>`;
}

function parseRecord(record) {
  const [wins, losses] = String(record || "").split("-").map((part) => Number(part));
  if (!Number.isFinite(wins) || !Number.isFinite(losses) || wins + losses === 0) return null;
  return { wins, losses, winPct: wins / (wins + losses) };
}

function formatMoney(value) {
  return value || value === 0 ? `$${decimalFormat.format(value)}M` : "Unavailable";
}

function initChampionExplorer(worldSeries) {
  const card = document.querySelector(".championship-card");
  const prev = document.getElementById("heroPrevChampion");
  const next = document.getElementById("heroNextChampion");
  const year = document.getElementById("heroChampionYear");
  const name = document.getElementById("heroChampionName");
  const logo = document.getElementById("heroChampionLogo");
  const stats = document.getElementById("heroChampionStats");
  if (!card || !prev || !next || !year || !name || !logo || !stats || !worldSeries?.length) return;

  const champions = [...worldSeries].sort((a, b) => a.year - b.year);
  let index = champions.length - 1;

  function renderChampion() {
    const champion = champions[index];
    const record = parseRecord(champion.record);
    const payrollRank = champion.winner_payroll_rank ? `#${champion.winner_payroll_rank}` : "n/a";
    year.textContent = champion.year;
    name.textContent = champion.winner;
    logo.src = champion.winner_logo_url || "";
    logo.alt = `${champion.winner} logo`;
    logo.hidden = !champion.winner_logo_url;
    card.style.setProperty("--winner-logo", champion.winner_logo_url ? `url("${champion.winner_logo_url}")` : "none");
    stats.innerHTML = `
      <div><span>Payroll Rank</span><strong>${payrollRank}</strong></div>
      <div><span>Win Pct</span><strong>${record ? record.winPct.toFixed(3).replace(/^0/, "") : "n/a"}</strong></div>
      <div><span>Payroll</span><strong>${formatMoney(champion.winner_payroll_millions)}</strong></div>
      <div><span>Record</span><strong>${escapeHtml(champion.record || "n/a")}</strong></div>`;
  }

  prev.addEventListener("click", () => {
    index = index <= 0 ? champions.length - 1 : index - 1;
    renderChampion();
  });
  next.addEventListener("click", () => {
    index = index >= champions.length - 1 ? 0 : index + 1;
    renderChampion();
  });

  renderChampion();
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function initScrollRunner() {
  const widget = document.getElementById("scrollBasepath");
  const runner = widget?.querySelector(".scroll-runner");
  const status = document.getElementById("runnerStatus");
  if (!widget || !runner || !status) return;

  const points = {
    home: { x: 51, y: 82 },
    first: { x: 95, y: 48 },
    second: { x: 51, y: 14 },
    third: { x: 8, y: 48 },
  };

  function segment(progress, from, to, start, end) {
    const amount = Math.min(1, Math.max(0, (progress - start) / (end - start)));
    return {
      x: lerp(from.x, to.x, amount),
      y: lerp(from.y, to.y, amount),
    };
  }

  function update() {
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progress = Math.min(1, Math.max(0, window.scrollY / maxScroll));
    let point = points.home;
    let label = "At bat";
    widget.classList.toggle("is-hit", progress > 0.06 && progress < 0.18);

    if (progress < 0.12) {
      point = points.home;
      label = progress > 0.06 ? "Ball in play" : "At bat";
    } else if (progress < 0.34) {
      point = segment(progress, points.home, points.first, 0.12, 0.34);
      label = "Running to first";
    } else if (progress < 0.56) {
      point = segment(progress, points.first, points.second, 0.34, 0.56);
      label = "Rounding second";
    } else if (progress < 0.78) {
      point = segment(progress, points.second, points.third, 0.56, 0.78);
      label = "Heading to third";
    } else {
      point = segment(progress, points.third, points.home, 0.78, 1);
      label = progress > 0.96 ? "Scored" : "Coming home";
    }

    runner.style.setProperty("--runner-x", `${point.x}px`);
    runner.style.setProperty("--runner-y", `${point.y}px`);
    status.textContent = label;
  }

  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
}

async function initReport() {
  const [summaryResponse, dashboardResponse] = await Promise.all([
    fetch("data/processed/payroll_report_summary.json"),
    fetch("data/processed/postseason_dashboard_data.json"),
  ]);
  const summary = await summaryResponse.json();
  const dashboard = await dashboardResponse.json();

  document.getElementById("headlineCards").innerHTML = summary.headlines.map((item) => `
    <div class="headline-card">
      <strong>${formatValue(item.value)}</strong>
      <span>${escapeHtml(item.label)}</span>
    </div>`).join("");

  document.getElementById("reportSections").innerHTML = summary.sections.map((section, index) => `
    <article class="finding" id="${escapeHtml(section.id)}">
      <div class="finding-copy">
        <p class="eyebrow">Finding ${index + 1}</p>
        <h3>${escapeHtml(section.title)}</h3>
        <p>${escapeHtml(section.body)}</p>
      </div>
      <div class="chart-frame svg-report-chart">
        <h4>${escapeHtml(section.measure)}</h4>
        ${makeSvgChart(section)}
      </div>
    </article>`).join("");

  const titleSection = summary.sections.find((section) => section.id === "world-series-teams");
  if (titleSection) {
    document.getElementById("reportMascots").innerHTML = titleSection.chart.slice(0, 8).map(mascotCard).join("");
  }

  initScrollRunner();
  initChampionExplorer(dashboard.worldSeries);
}

initReport();
