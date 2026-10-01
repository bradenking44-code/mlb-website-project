# FDA Website Project Requirements Check

## Dataset

- Panel/event data: one row is one player on one MLB team roster in one season.
- Time column: `year`.
- Group columns: `team_id`, `team_name`, `player_id`, `player_name`.
- Periods: 41 seasons, 1985-2025.
- Groups: 36 team IDs and thousands of player IDs.
- Size: 54,851 rows and 37 columns in `data/processed/mlb_payroll_postseason_roster.csv`.
- Categorical filters: `year`, `team_name`, `league`, `division`, `payroll_tier`, `postseason_result`.
- Numeric measures: `wins`, `losses`, `win_pct`, `payroll`, `payroll_millions`, `payroll_rank`, `payroll_percentile`, `cost_per_win_millions`, `roster_count`, `games`, `starts`.
- Coverage note: records, postseason results, and rosters run through 2025. Payroll-backed team seasons run 1985-2025; The Baseball Cube Opening Day payroll archive covers all 30 teams in 2017-2026, with 2026 shown separately from completed-season results.

## Report Page

- File: `index.html`.
- Includes title, author name, and summary paragraph.
- Includes 6 headline numbers.
- Includes 9 findings, each with explanatory text and a chart.
- Includes data notes with source, row definition, exclusions, and computed-field definitions.
- Uses native SVG charts so visuals work without a remote chart dependency.

## Dashboard Page

- File: `dashboard.html`, linked from the report page.
- Loads browser data from `postseason_dashboard_data.json`, a compact team-season and roster file derived from the full 54,851-row CSV.
- Includes filters for time, team, league, division, postseason outcome, payroll tier, and minimum payroll.
- Includes summary numbers that update with filters.
- Includes a measure switch and a breakdown switch.
- Includes at least 5 charts/visuals: breakdown chart, World Series payroll comparison, playoff rate by payroll tier, trend chart, and payroll/win percentage scatter plot.
- Includes World Series winner cards by year.
- Includes team logos next to team names.
- Includes roster spotlight and team-season table.
- Includes a reset button and animated season playback.

## Repository

- Public GitHub repository.
- GitHub Pages enabled from the `main` branch root.
- README lists files, data source, scripts, and project requirements.
- Reproducible scripts are included for the dataset and report summary.
