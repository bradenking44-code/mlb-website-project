const numberFormat = new Intl.NumberFormat("en-US");
const decimalFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

function formatValue(value) {
  if (typeof value === "number" && value < 10 && value % 1 !== 0) {
    return decimalFormat.format(value);
  }
  return numberFormat.format(value);
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
}

initReport();
