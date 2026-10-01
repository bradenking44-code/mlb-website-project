# MLB Payroll vs Postseason Success Website

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
- `data/raw/ExternalPayrolls.csv` - The Baseball Cube payroll rows for all 30 clubs in each season from 2017-2026.
- `data/raw/CotsPayroll2026.csv` - Cot's cash and CBT payroll snapshot for all 30 clubs, with each sheet's update date.
- `data/raw/ExternalPayrolls.example.csv` - template for adding verified 2017+ team payroll rows.

Sources come from the public Lahman/SABR CSV mirror at `https://github.com/cbwinslow/lahman-database-csv`. Team logo images are loaded from ESPN's public team logo CDN with text fallbacks.

### Payroll Coverage After 2016

The Lahman/SABR `Salaries` table provides listed player salaries through 2016. The Baseball Cube annual payroll pages provide one Opening Day team payroll row for every club from 2017 through 2026. These 300 rows are checked against each year's published league payroll total before the dashboard build. Opening Day payroll excludes later callups and midseason trades. Rows from 2017-2025 join completed team seasons; 2026 remains in a separate archive table because the completed outcomes dataset currently stops at 2025.

To rebuild dashboard data, run `scripts/build_postseason_payroll_dataset.py`, then `scripts/build_payroll_report_summary.py`.

The separate `data/raw/CotsPayroll2026.csv` snapshot is sourced from Cot's club contract sheets dated August 25 through September 27, 2026. It records cash and CBT payroll at $0.1 million precision. These values stay separate from historical analysis because Cot's cash/CBT definitions differ from both Lahman salary totals and The Baseball Cube Opening Day payrolls. See `README_DATA.md` for source links and field definitions.

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
