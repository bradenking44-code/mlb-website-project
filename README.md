# MLB Payroll vs October Success Website

This repository is for the FDA Data Website Project. It contains a two-page static website built with plain HTML, CSS, and JavaScript.

## Pages

- `index.html` - report page with a title, author, summary, headline numbers, charted findings, and dataset notes.
- `dashboard.html` - interactive dashboard with season filters, team filters, postseason filters, payroll filters, animated visuals, World Series winner cards, team logos, roster spotlight, SVG charts, and a team-season table.

## Data

- `data/processed/mlb_payroll_postseason_roster.csv` - full 54,851-row roster/team-season panel for the assignment.
- `data/processed/postseason_dashboard_data.json` - compact dashboard data derived from the full roster panel.
- `data/processed/payroll_report_summary.json` - reproducible summary data for the report charts.
- `data/raw/Teams2025.csv` - Lahman/SABR team-season table through 2025.
- `data/raw/SeriesPost2025.csv` - Lahman/SABR postseason series table through 2025.
- `data/raw/Appearances2025.csv` - Lahman/SABR player-team appearance table through 2025.
- `data/raw/People2025.csv` - Lahman/SABR player name table.
- `data/raw/Salaries2025.csv` - Lahman salary table. Salary coverage remains 1985-2016.
- `data/raw/ExternalPayrolls.example.csv` - template for adding verified 2017+ team payroll rows.

Sources come from the public Lahman/SABR CSV mirror at `https://github.com/cbwinslow/lahman-database-csv`. Team logo images are loaded from ESPN's public team logo CDN with text fallbacks.

### Payroll Coverage After 2016

The Lahman/SABR `Salaries` table is the reproducible source used in the current build, but its MLB salary coverage ends after the 2016 season. For 2017 and later dashboard payrolls, the recommended extension source is The Baseball Cube's MLB payroll history and year pages because they provide team-level payroll by season alongside team records. Spotrac's MLB payroll tracker is a useful cross-check, but its payroll categories can differ from Opening Day/team payroll totals, so the dashboard should use one definition consistently before merging newer values.

To extend the dashboard, create `data/raw/ExternalPayrolls.csv` with `year`, `team_id` or `team`, and `payroll` columns, then rerun `scripts/build_postseason_payroll_dataset.py` and `scripts/build_payroll_report_summary.py`.

## Scripts

- `scripts/build_postseason_payroll_dataset.py` - rebuilds the full roster-season CSV and compact dashboard JSON.
- `scripts/build_payroll_report_summary.py` - rebuilds the report summary JSON from the dashboard data.
- Earlier game-level build scripts are kept for reference, but the current website uses the postseason payroll roster dataset above.

## Project Requirements Covered

- Panel/event data with one row per player-team-season roster appearance.
- Time column: `year`.
- Group columns: `team_id`, `team_name`, `player_id`, and `player_name`.
- 54,851 rows, 34 columns, 41 seasons, and 36 team IDs.
- Report page with headline numbers and 9 charted findings.
- Dashboard page with filters for year, team, league, division, postseason result, payroll tier, and minimum payroll.
- Dashboard summary numbers, measure and breakdown switches, 5 working SVG charts, World Series timeline, roster display, table, reset button, and animation control.

## Local Preview

From this folder, run:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## GitHub Pages

Live site:

```text
https://bradenking44-code.github.io/mlb-website-project/
```
