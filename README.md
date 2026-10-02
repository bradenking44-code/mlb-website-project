# MLB Payroll vs Postseason Success Website

This repository is for the FDA Data Website Project. It contains a two-page static website built with plain HTML, CSS, and JavaScript.

## Pages

- `index.html` - report page with a title, author, summary, headline numbers, charted findings, dataset notes, behind-home-plate batting practice, and randomized baseball trivia.
- `dashboard.html` - interactive dashboard with season filters, team filters, postseason filters, payroll filters, animated visuals, World Series winner cards, team logos, roster spotlight, SVG charts, and a team-season table.

## Data

- `data/processed/mlb_payroll_postseason_roster.csv` - full 54,851-row, 37-column roster/team-season panel for the assignment.
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
- 54,851 rows, 37 columns, 41 seasons, and 36 team IDs.
- Report page with headline numbers and 9 charted findings.
- Dashboard page with filters for year, team, league, division, postseason result, payroll tier, and minimum payroll.
- Dashboard summary numbers, measure and breakdown switches, 6 working SVG charts, World Series timeline, roster display, table, full reset button, and animation control.

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

The repository is intended to be public, with GitHub Pages publishing from the `main` branch root. Confirm the repository visibility and Pages source in GitHub before course submission.

The course's four-line submission file (name, student ID, repository URL, and live site URL) is a separate hand-in and should stay outside this public repository.

## Complete File Inventory

This inventory covers every tracked project file; `.git` internals are Git's local history and are not project files.

| File | Purpose |
| --- | --- |
| `.gitignore` | Excludes local, temporary, or generated files that should not be committed. |
| `README.md` | Project overview, setup, sources, build instructions, requirements, and this file inventory. |
| `README_DATA.md` | Dataset grain, sources, payroll definitions, and derived-field documentation. |
| `REQUIREMENTS_CHECK.md` | Checklist comparing the project with the FDA assignment requirements. |
| `index.html` | Scrollable report with project summary, headline numbers, findings, charts, and dataset notes. |
| `dashboard.html` | Interactive dashboard page with filters, charts, tables, roster spotlight, and archive views. |
| `assets/chart.umd.js` | Locally vendored Chart.js library retained for legacy chart tooling. |
| `assets/dashboard.js` | Loads dashboard data and renders filters, metrics, charts, tables, and roster views. |
| `assets/report.js` | Builds report charts, champion explorer, clubhouse cards, and scroll-progress widget. |
| `assets/batting-practice.js` | Runs the pitching machine, swing, reactive crowd, play outcomes, base runners, and three-out inning interaction on the report page. |
| `assets/trivia.js` | Builds randomized four-choice quiz rounds from postseason and payroll data and displays the final score. |
| `assets/styles.css` | Shared layout, typography, colors, responsive styling, and animation rules for both pages. |
| `assets/images/cartoon-baseball-field.svg` | Baseball-field illustration asset. |
| `assets/images/cartoon-baseball.svg` | Baseball illustration asset. |
| `assets/images/homeplate-bat-logo.svg` | Baseball-and-bat brand mark. |
| `assets/images/world-series-trophy.png` | Trophy artwork for the report and champion explorer. |
| `data/processed/mlb_payroll_postseason_roster.csv` | Full 54,851-row player-team-season panel used for analysis and assignment requirements. |
| `data/processed/mlb_team_payroll_game_results.csv` | Legacy game-level payroll and result dataset retained for reference. |
| `data/processed/payroll_dashboard_data.json` | Legacy game-level dashboard data used by the earlier dashboard build. |
| `data/processed/payroll_report_summary.json` | Generated report headlines and chart findings, rebuilt by `scripts/build_payroll_report_summary.py`. |
| `data/processed/postseason_dashboard_data.json` | Current compact team-season, champion, roster, Opening Day payroll, and Cot's snapshot data loaded by the site. |
| `data/raw/Appearances2025.csv` | Lahman/SABR player appearances by team and season. |
| `data/raw/CotsPayroll2026.csv` | Separate Cot's 2026 cash and competitive-balance-tax payroll snapshot. |
| `data/raw/ExternalPayrolls.csv` | The Baseball Cube Opening Day payrolls for 30 teams in each year from 2017-2026. |
| `data/raw/ExternalPayrolls.example.csv` | Template for adding or validating external payroll observations. |
| `data/raw/People2025.csv` | Lahman/SABR player identifiers and names. |
| `data/raw/Salaries.csv` | Original Lahman/SABR salary source retained for reference. |
| `data/raw/Salaries2025.csv` | Lahman/SABR listed player salaries used for 1985-2016 payroll totals. |
| `data/raw/SeriesPost2025.csv` | Lahman/SABR postseason series records used to identify appearances and champions. |
| `data/raw/Teams.csv` | Original Lahman/SABR team records retained for reference. |
| `data/raw/Teams2025.csv` | Lahman/SABR team-season records through 2025. |
| `scripts/build_dashboard_data.py` | Legacy script that builds the game-level dashboard JSON. |
| `scripts/build_payroll_dataset.py` | Legacy script that builds the earlier game-level payroll dataset. |
| `scripts/build_payroll_report_summary.py` | Rebuilds report headline and finding data from the current compact dashboard JSON. |
| `scripts/build_postseason_payroll_dataset.py` | Builds the current roster panel and compact postseason dashboard JSON from the raw sources. |
