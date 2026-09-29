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

function makeBarChart(section, data) {
  const max = Math.max(...data.map((item) => item.value), 1);
  const rowH = Math.min(38, 260 / Math.max(1, data.length));
  const bars = data.map((item, index) => {
    const y = 38 + index * rowH;
    const width = (item.value / max) * 560;
    return `
      <text x="118" y="${y + 16}" text-anchor="end" class="svg-label">${escapeHtml(item.label).slice(0, 20)}</text>
      <rect x="130" y="${y}" width="${width}" height="${rowH - 8}" rx="5" fill="${colors[index % colors.length]}"></rect>
      <text x="${Math.min(700, 138 + width)}" y="${y + 16}" class="svg-value">${formatValue(item.value)}</text>`;
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
  return `
    <article class="mascot-card">
      <div class="mascot-heading">
        <div class="mascot-mark">${escapeHtml(item.label).split(" ").map((part) => part[0]).join("").slice(0, 3)}</div>
        <div>
          <div class="mascot-name">${escapeHtml(item.label)}</div>
          <div class="mascot-meta">October profile</div>
        </div>
      </div>
      <div class="mascot-stat">${formatValue(item.value)}</div>
    </article>`;
}

async function initReport() {
  const response = await fetch("data/processed/payroll_report_summary.json");
  const summary = await response.json();

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
}

initReport();
