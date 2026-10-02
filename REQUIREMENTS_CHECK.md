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
- The introduction states the main result as well as the data coverage.
- Includes data notes with source, row definition, exclusions, and computed-field definitions, including the reported averages and rates.
- Adds an interactive batting-practice visual viewed from behind home plate, with a pitching machine, red/green timing lights, a swinging bat, reacting fans, play outcomes, runner and run tracking, and a three-out inning.
- Adds a randomized ten-question, four-choice baseball trivia round based on the project's champions, records, and payroll data, with a score summary and 70% pass threshold.
- Uses native SVG charts so visuals work without a remote chart dependency.

## Dashboard Page

- File: `dashboard.html`, linked from the report page.
- Loads browser data from `postseason_dashboard_data.json`, a compact team-season and roster file derived from the full 54,851-row CSV.
- Includes filters for time, team, league, division, postseason outcome, payroll tier, and minimum payroll.
- Includes at least 4 summary numbers that update with filters.
- Includes a measure switch and a breakdown switch.
- Includes 6 charts/visuals that update with the dashboard filters: breakdown chart, World Series payroll comparison, playoff rate by payroll tier, trend chart, payroll/win percentage scatter plot, and payroll-tier outcome ladder.
- Includes World Series winner cards by year.
- Includes team logos next to team names.
- Includes roster spotlight and team-season table.
- Includes a reset button that restores the season, team, league, division, postseason, payroll, roster, archive, table, measure, and breakdown selections, plus animated season playback.

## Repository

- Git remote is configured as `https://github.com/bradenking44-code/mlb-website-project.git`.
- External check before submission: confirm the repository is public and GitHub Pages publishes from the `main` branch root. Those settings cannot be verified from the local source files.
- README contains a complete inventory of all tracked project files, data sources, scripts, and project requirements.
- Reproducible scripts are included for the dataset and report summary.

## Separate Course Hand-In

- The course also requires a separate `.txt` or `.md` file with four lines: student name, student ID, public repository URL, and live website URL.
- Keep this submission file outside the public repository so the student ID is not published with the project source.
