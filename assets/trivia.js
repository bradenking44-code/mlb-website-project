(() => {
  const card = document.getElementById("baseballTrivia");
  const progress = document.getElementById("triviaProgress");
  const prompt = document.getElementById("triviaPrompt");
  const answers = document.getElementById("triviaAnswers");
  const feedback = document.getElementById("triviaFeedback");
  const result = document.getElementById("triviaResult");
  const action = document.getElementById("triviaAction");
  const celebration = document.getElementById("triviaCelebration");

  if (!card || !progress || !prompt || !answers || !feedback || !result || !action || !celebration) return;

  const questionCount = 10;
  let questionBank = [];
  let questions = [];
  let questionIndex = -1;
  let correctCount = 0;
  let state = "ready";

  function shuffle(items) {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
  }

  function choicesFor(correctAnswer, pool) {
    const correct = String(correctAnswer);
    const alternatives = [...new Set(pool.map(String))].filter((choice) => choice !== correct);
    return shuffle([correct, ...shuffle(alternatives).slice(0, 3)]);
  }

  function makeQuestion(promptText, correctAnswer, choicePool, year) {
    const options = choicesFor(correctAnswer, choicePool);
    if (options.length !== 4) return null;
    return { prompt: promptText, answer: String(correctAnswer), options, year };
  }

  function buildQuestionBank(data) {
    const champions = (data.worldSeries || []).filter((row) => row.winner && Number.isFinite(Number(row.year)));
    const teamSeasons = data.teamSeasons || [];
    const championTeams = [...new Set(champions.map((row) => row.winner))];
    const payrollRanks = [...new Set(champions.map((row) => Number(row.winner_payroll_rank)).filter(Number.isFinite))];
    const championWins = [...new Set(champions.map((champion) => {
      const season = teamSeasons.find((team) => Number(team.year) === Number(champion.year) && team.team_id === champion.winner_id);
      return season ? Number(season.wins) : NaN;
    }).filter(Number.isFinite))];
    const tiers = ["Top third", "Middle third", "Bottom third", "No payroll data"];
    const bank = [];

    champions.forEach((champion) => {
      const year = Number(champion.year);
      const season = teamSeasons.find((team) => Number(team.year) === year && team.team_id === champion.winner_id)
        || teamSeasons.find((team) => Number(team.year) === year && team.world_series_winner);
      const winner = champion.winner;

      const titleQuestion = makeQuestion(
        `Which club won the ${year} World Series?`,
        winner,
        championTeams,
        year,
      );
      if (titleQuestion) bank.push(titleQuestion);

      const payrollRank = Number(champion.winner_payroll_rank);
      if (Number.isFinite(payrollRank)) {
        const rankQuestion = makeQuestion(
          `What was the ${year} champion's payroll rank?`,
          `No. ${payrollRank}`,
          payrollRanks.map((rank) => `No. ${rank}`),
          year,
        );
        if (rankQuestion) bank.push(rankQuestion);
      }

      const wins = Number(season && season.wins);
      if (Number.isFinite(wins)) {
        const winsQuestion = makeQuestion(
          `How many regular-season games did the ${year} champion win?`,
          `${wins} wins`,
          championWins.map((total) => `${total} wins`),
          year,
        );
        if (winsQuestion) bank.push(winsQuestion);
      }

      if (season && tiers.includes(season.payroll_tier)) {
        const tierQuestion = makeQuestion(
          `Which payroll tier did the ${year} champion finish in?`,
          season.payroll_tier,
          tiers,
          year,
        );
        if (tierQuestion) bank.push(tierQuestion);
      }
    });
    return bank;
  }

  function makeRound() {
    const yearOrder = shuffle(questionBank);
    const selectedYears = new Set();
    questions = [];
    yearOrder.forEach((question) => {
      if (selectedYears.has(question.year) || questions.length >= questionCount) return;
      selectedYears.add(question.year);
      questions.push({ ...question, options: shuffle(question.options) });
    });
    return questions.length === questionCount;
  }

  function renderQuestion() {
    const question = questions[questionIndex];
    state = "asking";
    progress.textContent = `QUESTION ${questionIndex + 1} OF ${questionCount}`;
    prompt.textContent = question.prompt;
    feedback.textContent = "";
    answers.replaceChildren();
    result.textContent = "";
    question.options.forEach((option, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "trivia-option";
      button.textContent = option;
      button.setAttribute("aria-label", `Answer ${String.fromCharCode(65 + index)}: ${option}`);
      button.addEventListener("click", () => selectAnswer(option, button));
      answers.append(button);
    });
    action.textContent = "Choose an answer";
    action.disabled = true;
  }

  function selectAnswer(selected, selectedButton) {
    if (state !== "asking") return;
    const question = questions[questionIndex];
    const isCorrect = selected === question.answer;
    if (isCorrect) correctCount += 1;
    state = "answered";
    [...answers.children].forEach((button) => {
      button.disabled = true;
      if (button.textContent === question.answer) button.classList.add("is-correct");
    });
    selectedButton.classList.add(isCorrect ? "is-selected-correct" : "is-selected-wrong");
    feedback.textContent = isCorrect ? "Correct!" : `Not quite. The answer was ${question.answer}.`;
    action.disabled = false;
    action.textContent = questionIndex === questionCount - 1 ? "See my score" : "Next question";
  }

  function showResults() {
    const accuracy = Math.round(correctCount / questionCount * 100);
    const passed = accuracy >= 70;
    state = "results";
    progress.textContent = "ROUND COMPLETE";
    prompt.textContent = passed ? "You passed the clubhouse challenge!" : "Keep studying the clubhouse numbers and try again.";
    answers.replaceChildren();
    feedback.textContent = "";
    result.textContent = `${correctCount} / ${questionCount} correct · ${accuracy}%`;
    card.classList.toggle("is-passed", passed);
    card.classList.toggle("is-failed", !passed);
    celebration.hidden = !passed;
    action.disabled = false;
    action.textContent = "Play again";
  }

  function startRound() {
    if (!makeRound()) {
      prompt.textContent = "The trivia questions could not be prepared from the project data.";
      return;
    }
    correctCount = 0;
    questionIndex = 0;
    card.classList.remove("is-passed", "is-failed");
    celebration.hidden = true;
    renderQuestion();
  }

  action.addEventListener("click", () => {
    if (state === "ready" || state === "results") {
      startRound();
      return;
    }
    if (state !== "answered") return;
    if (questionIndex === questionCount - 1) showResults();
    else {
      questionIndex += 1;
      renderQuestion();
    }
  });

  fetch("data/processed/postseason_dashboard_data.json")
    .then((response) => {
      if (!response.ok) throw new Error("Unable to load the baseball data.");
      return response.json();
    })
    .then((data) => {
      questionBank = buildQuestionBank(data);
      if (questionBank.length < questionCount) throw new Error("Not enough data-backed trivia questions are available.");
      action.disabled = false;
    })
    .catch(() => {
      state = "unavailable";
      progress.textContent = "DATA UNAVAILABLE";
      prompt.textContent = "Trivia needs the project data file. Refresh the page to try again.";
      action.disabled = true;
    });
})();
