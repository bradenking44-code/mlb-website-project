const numberFormat = new Intl.NumberFormat("en-US");
const decimalFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

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
};

function formatValue(value) {
  if (typeof value === "number" && value < 10 && value % 1 !== 0) {
    return decimalFormat.format(value);
  }
  return numberFormat.format(value);
}

function teamStyle(label) {
  const match = Object.keys(teamLooks).find((name) => label.includes(name));
  const fallback = ["#071d3a", "#c82432", label.split(" ").map((part) => part[0]).join("").slice(0, 3).toUpperCase()];
  const [primary, secondary, initials] = match ? teamLooks[match] : fallback;
  return { primary, secondary, initials };
}

function mascotCard(item) {
  const look = teamStyle(item.label);
  return `
    <article class="mascot-card" style="--team-primary:${look.primary};--team-secondary:${look.secondary}">
      <div class="mascot-mark">${look.initials}</div>
      <div class="mascot-name">${item.label}</div>
      <div class="mascot-meta">Payroll pressure profile</div>
      <div class="mascot-stat">${formatValue(item.value)} ${item.value > 100 ? "M" : ""}</div>
    </article>
  `;
}

function makeChart(canvas, section) {
  const labels = section.chart.map((item) => item.label);
  const values = section.chart.map((item) => item.value);
  const isLongSeries = values.length > 30;

  return new Chart(canvas, {
    type: isLongSeries ? "line" : "bar",
    data: {
      labels,
      datasets: [
        {
          label: section.measure.replaceAll("_", " "),
          data: values,
          borderColor: "#b33b32",
          backgroundColor: isLongSeries ? "rgba(179, 59, 50, 0.14)" : "#2f6f63",
          borderWidth: 2,
          tension: 0.25,
          pointRadius: isLongSeries ? 0 : 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          ticks: {
            maxRotation: isLongSeries ? 0 : 45,
            autoSkip: true,
            maxTicksLimit: isLongSeries ? 12 : 10,
          },
        },
        y: {
          beginAtZero: true,
        },
      },
    },
  });
}

async function initReport() {
  const response = await fetch("data/processed/payroll_report_summary.json");
  const summary = await response.json();

  document.getElementById("headlineCards").innerHTML = summary.headlines
    .map(
      (item) => `
        <div class="headline-card">
          <strong>${formatValue(item.value)}</strong>
          <span>${item.label}</span>
        </div>
      `
    )
    .join("");

  const sections = document.getElementById("reportSections");
  sections.innerHTML = summary.sections
    .map(
      (section, index) => `
        <article class="finding" id="${section.id}">
          <div class="finding-copy">
            <p class="eyebrow">Finding ${index + 1}</p>
            <h3>${section.title}</h3>
            <p>${section.body}</p>
          </div>
          <div class="chart-frame">
            <canvas id="chart-${section.id}"></canvas>
          </div>
        </article>
      `
    )
    .join("");

  summary.sections.forEach((section) => {
    makeChart(document.getElementById(`chart-${section.id}`), section);
  });

  const payrollSection = summary.sections.find((section) => section.id === "high-payroll-teams");
  if (payrollSection) {
    document.getElementById("reportMascots").innerHTML = payrollSection.chart.slice(0, 8).map(mascotCard).join("");
  }
}

initReport();
