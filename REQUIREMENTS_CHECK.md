# FDA Website Project Requirements Check

## Dataset

- Panel/event data: one row is one team in one regular-season game.
- Time columns: `date`, `year`.
- Group columns: `team_id`, `team_name`.
- Periods: 32 seasons, 1985-2016.
- Groups: 33 team IDs.
- Size: 148,592 rows and 29 columns.
- Categorical filters: `year`, `team_name`, `league`, `home_away`, `day_night`, `payroll_tier`.
- Numeric measures: `season_payroll`, `payroll_millions`, `payroll_rank`, `winning_percentage_after_game`, `win`, `loss`, `team_runs`, `opponent_runs`, `run_differential`, `attendance`, `cost_per_win_to_date`.

## Report Page

- File: `index.html`.
- Includes title, author name, and summary paragraph.
- Includes headline numbers.
- Includes eight findings, each with explanatory text and a chart.
- Includes data notes with source, row definition, exclusions, and computed-field definitions.

## Dashboard Page

- File: `dashboard.html`, linked from the report page.
- Loads CSV data in the browser.
- Includes filters for time, team, league, home/away, day/night, payroll tier, and minimum payroll.
- Includes summary numbers that update with filters.
- Includes chart measure and breakdown switches.
- Includes at least four charts plus an interactive scatter plot.
- Includes a table of the current view.
- Includes a reset button.

## Repository

- Public GitHub repository.
- GitHub Pages enabled from the `main` branch root.
- README lists files, data source, scripts, and project requirements.
- Reproducible scripts are included for the dataset and report summary.
