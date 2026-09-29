# MLB Payroll Efficiency Website

This repository is for the FDA Data Website Project. It contains a two-page static website built with plain HTML, CSS, and JavaScript.

## Pages

- `index.html` - report page with a title, author, summary, headline numbers, eight payroll/winning findings, charts, and dataset notes.
- `dashboard.html` - dashboard page with season buttons, team search, payroll filters, summary numbers, chart switches, five charts, leaderboards, a data table, and a reset button.

## Data

- `data/processed/mlb_team_payroll_game_results.csv` - cleaned MLB team-game payroll and result panel.
- `data/processed/payroll_report_summary.json` - reproducible summary data for the report charts.
- `data/raw/Salaries.csv` - source player salary table.
- `data/raw/Teams.csv` - source team metadata table.
- `data/raw/retrosheet/` - source Retrosheet season CSV downloads.

Payroll data comes from the public Baseball Databank mirror at `https://github.com/cbwinslow/baseballdatabank`. Game-level results come from Retrosheet CSV downloads at `https://www.retrosheet.org/downloads/csvdownloads.html`.

## Scripts

- `scripts/build_payroll_dataset.py` - rebuilds the cleaned payroll/team-game CSV.
- `scripts/build_payroll_report_summary.py` - rebuilds the payroll report summary JSON from the cleaned CSV.

## Project Requirements Covered

- Panel/event data with one row per team-game.
- Time columns: `date` and `year`.
- Group columns: `team_id` and `team_name`.
- 148,592 rows, 29 columns, 32 seasons, and 33 team IDs.
- Report page with headline numbers and eight charted findings.
- Dashboard page with filters for year, team, league, home/away, day/night, payroll tier, and minimum payroll.
- Dashboard summary numbers, chart switches, five charts, leaderboards, table, and reset button.

## Local Preview

From this folder, run:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## GitHub Pages

After pushing this repository to GitHub, enable GitHub Pages from the `main` branch and the repository root. The live URL should look like:

```text
https://YOUR-GITHUB-USERNAME.github.io/mlb-website-project/
```
