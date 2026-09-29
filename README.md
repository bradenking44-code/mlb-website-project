# MLB Batting Trends Website

This repository is for the FDA Data Website Project. It contains a two-page static website built with plain HTML, CSS, and JavaScript.

## Pages

- `index.html` - report page with a title, author, summary, headline numbers, eight findings, charts, and dataset notes.
- `dashboard.html` - dashboard page with filters, summary numbers, chart switches, four charts, a data table, and a reset button.

## Data

- `data/processed/mlb_batting_player_seasons.csv` - cleaned MLB batting player-team-season panel.
- `data/processed/report_summary.json` - reproducible summary data for the report charts.
- `data/raw/Batting.csv` - source batting table.
- `data/raw/People.csv` - source player metadata table.
- `data/raw/Teams.csv` - source team metadata table.

Raw data comes from the public Baseball Databank mirror at `https://github.com/cbwinslow/baseballdatabank`.

## Scripts

- `scripts/build_mlb_dataset.py` - rebuilds the cleaned CSV from the raw Baseball Databank tables.
- `scripts/build_report_summary.py` - rebuilds the report summary JSON from the cleaned CSV.

## Project Requirements Covered

- Panel data with one row per player-team-season stint.
- Time column: `year`.
- Group columns: `player_id`, `team_id`, and `team_name`.
- 101,914 rows, 37 columns, 121 seasons, 47 team IDs, and 18,140 players.
- Report page with headline numbers and eight charted findings.
- Dashboard page with filters for year, team, league, batting side, and birth country.
- Dashboard summary numbers, chart switches, four charts, table, and reset button.

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
