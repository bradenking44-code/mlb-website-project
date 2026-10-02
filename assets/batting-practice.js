(() => {
  const scene = document.getElementById("practiceScene");
  const ball = document.getElementById("practiceBall");
  const bat = document.getElementById("practiceBat");
  const batTrail = document.getElementById("practiceBatTrail");
  const aim = document.getElementById("practiceAim");
  const trail = document.getElementById("practiceTrail");
  const outcomeBadge = document.getElementById("practiceOutcome");
  const outcomeText = document.getElementById("practiceOutcomeText");
  const outsReadout = document.getElementById("practiceOuts");
  const runsReadout = document.getElementById("practiceRuns");
  const strikesReadout = document.getElementById("practiceStrikes");
  const message = document.getElementById("practiceMessage");
  const roundStatus = document.getElementById("practiceRoundStatus");
  const firstBase = document.getElementById("practiceFirst");
  const secondBase = document.getElementById("practiceSecond");
  const thirdBase = document.getElementById("practiceThird");
  const fieldFirst = document.getElementById("practiceFieldFirst");
  const fieldSecond = document.getElementById("practiceFieldSecond");
  const fieldThird = document.getElementById("practiceFieldThird");
  const wheelLeft = document.getElementById("practiceWheelLeft");
  const wheelRight = document.getElementById("practiceWheelRight");
  const crowd = document.getElementById("practiceCrowd");
  const lightGreen = document.getElementById("practiceLightGreen");
  const lightRed = document.getElementById("practiceLightRed");
  const cueText = document.getElementById("practiceCueText");
  const swingButton = document.getElementById("practiceSwing");
  const replayButton = document.getElementById("practiceReplay");

  if (!scene || !ball || !bat || !batTrail || !aim || !trail || !outcomeBadge || !outcomeText || !outsReadout || !runsReadout || !strikesReadout || !message || !roundStatus || !firstBase || !secondBase || !thirdBase || !fieldFirst || !fieldSecond || !fieldThird || !wheelLeft || !wheelRight || !crowd || !lightGreen || !lightRed || !cueText || !swingButton || !replayButton) return;

  const windupDuration = 620;
  const pitchDuration = 1950;
  const pitchInterval = 2700;
  const flightDuration = pitchDuration - windupDuration;
  const contactRadius = 64;
  let gameStarted = false;
  let gameOver = false;
  let pitchNumber = 0;
  let pitchStart = 0;
  let pitchResolved = false;
  let pitchTarget = { x: 480, y: 405 };
  let outs = 0;
  let runs = 0;
  let strikes = 0;
  let bases = [false, false, false];
  let pointer = { x: 480, y: 390, active: false };
  let swingStart = 0;
  let flight = null;
  let lastNow = performance.now();
  let finalAnimationUntil = 0;
  let animationFrame = null;
  let swingTrailPoints = [];
  let crowdResetTimer = null;
  const crowdFans = [];
  let cueMode = "ready";

  function scheduleAnimation() {
    if (animationFrame !== null) return;
    animationFrame = requestAnimationFrame((now) => {
      animationFrame = null;
      animate(now);
    });
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function setMessage(text) {
    message.textContent = text;
  }

  function setPitchCue(mode) {
    if (cueMode === mode) return;
    cueMode = mode;
    const isComing = mode === "coming";
    lightGreen.classList.toggle("is-active", !isComing);
    lightRed.classList.toggle("is-active", isComing);
    cueText.textContent = isComing ? "RED · PITCH COMING" : "GREEN · READY";
  }

  function updateMachine(elapsed) {
    const coming = elapsed >= windupDuration - 240 && elapsed < pitchDuration;
    setPitchCue(coming ? "coming" : "ready");
    const wheelRotation = coming ? (elapsed - (windupDuration - 240)) * 1.6 : 0;
    wheelLeft.setAttribute("transform", `rotate(${wheelRotation.toFixed(1)} 467 239)`);
    wheelRight.setAttribute("transform", `rotate(${-wheelRotation.toFixed(1)} 493 239)`);
  }

  function crowdShape(parent, tag, attributes) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
    parent.appendChild(element);
    return element;
  }

  function buildCrowd() {
    const jerseys = ["#c94843", "#e4b14e", "#327c8a", "#f1eee2", "#495f9b", "#69a36c", "#b96b39"];
    const skinTones = ["#e4b99a", "#bf815f", "#88583f", "#f0ceb0", "#a86f53"];
    const rows = [
      { y: 70, offset: 4 },
      { y: 103, offset: 23 },
      { y: 136, offset: 4 },
    ];

    rows.forEach((row, rowIndex) => {
      for (let x = 22 + row.offset; x <= 938; x += 42) {
        const fanIndex = crowdFans.length;
        const fan = crowdShape(crowd, "g", { class: "practice-fan", transform: `translate(${x} ${row.y})` });
        const motion = crowdShape(fan, "g", { class: "practice-fan-motion" });
        const jersey = jerseys[(fanIndex * 5 + rowIndex) % jerseys.length];
        const skin = skinTones[(fanIndex * 3 + rowIndex) % skinTones.length];
        const cap = jerseys[(fanIndex * 2 + 2) % jerseys.length];
        const leftArm = crowdShape(motion, "path", {
          class: "fan-arm fan-arm-left", d: "M-4 7L-8 15", fill: "none", stroke: skin,
          "stroke-width": 2.6, "stroke-linecap": "round",
        });
        const rightArm = crowdShape(motion, "path", {
          class: "fan-arm fan-arm-right", d: "M4 7L8 15", fill: "none", stroke: skin,
          "stroke-width": 2.6, "stroke-linecap": "round",
        });
        crowdShape(motion, "path", {
          d: "M-3 18L-4 25M3 18L4 25", fill: "none", stroke: "#28384b",
          "stroke-width": 2.4, "stroke-linecap": "round",
        });
        crowdShape(motion, "path", {
          d: "M-5 5Q0 3 5 5L7 19L-7 19Z", fill: jersey, stroke: "rgba(16, 42, 67, .5)",
          "stroke-width": 1,
        });
        crowdShape(motion, "circle", { cx: 0, cy: 1, r: 4.2, fill: skin });
        crowdShape(motion, "path", { d: "M-5 0Q-4-6 0-6Q5-6 5 0Z", fill: cap });
        crowdShape(motion, "path", { d: "M-5 0Q0-2 6 0", fill: "none", stroke: cap, "stroke-width": 2 });
        crowdFans.push({ motion, leftArm, rightArm });
      }
    });
  }

  function setCrowdReaction(reaction) {
    crowd.classList.remove("is-cheering", "is-home-run", "is-disappointed");
    const moodClass = reaction === "homer" ? "is-home-run" : reaction === "cheer" ? "is-cheering" : reaction === "groan" ? "is-disappointed" : "";
    if (moodClass) crowd.classList.add(moodClass);
    const armsUp = reaction === "cheer" || reaction === "homer";
    crowdFans.forEach(({ leftArm, rightArm }) => {
      leftArm.setAttribute("d", armsUp ? (reaction === "homer" ? "M-4 7L-12-8" : "M-4 7L-11-3") : "M-4 7L-8 15");
      rightArm.setAttribute("d", armsUp ? (reaction === "homer" ? "M4 7L12-8" : "M4 7L11-3") : "M4 7L8 15");
    });
    if (crowdResetTimer !== null) window.clearTimeout(crowdResetTimer);
    crowdResetTimer = null;
    if (!moodClass) return;
    crowdResetTimer = window.setTimeout(() => {
      crowd.classList.remove("is-cheering", "is-home-run", "is-disappointed");
      crowdFans.forEach(({ leftArm, rightArm }) => {
        leftArm.setAttribute("d", "M-4 7L-8 15");
        rightArm.setAttribute("d", "M4 7L8 15");
      });
      crowdResetTimer = null;
    }, reaction === "homer" ? 1700 : 1050);
  }

  function updateScore() {
    outsReadout.textContent = `${outs} / 3`;
    runsReadout.textContent = String(runs);
    strikesReadout.textContent = `${strikes} / 2`;
    firstBase.classList.toggle("is-occupied", bases[0]);
    secondBase.classList.toggle("is-occupied", bases[1]);
    thirdBase.classList.toggle("is-occupied", bases[2]);
    fieldFirst.classList.toggle("is-occupied", bases[0]);
    fieldSecond.classList.toggle("is-occupied", bases[1]);
    fieldThird.classList.toggle("is-occupied", bases[2]);
    roundStatus.textContent = gameOver
      ? "THREE OUTS · INNING OVER"
      : gameStarted ? `LIVE · PITCH ${pitchNumber}` : "PRACTICE · READY";
  }

  function showOutcome(text) {
    outcomeText.textContent = text;
    outcomeBadge.setAttribute("visibility", "visible");
  }

  function hideOutcome() {
    outcomeBadge.setAttribute("visibility", "hidden");
  }

  function svgPoint(event) {
    const matrix = scene.getScreenCTM();
    if (!matrix) return null;
    const point = scene.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(matrix.inverse());
  }

  function moveAim(x, y) {
    pointer = {
      x: clamp(x, 0, 960),
      y: clamp(y, 0, 500),
      active: true,
    };
    aim.setAttribute("transform", `translate(${pointer.x} ${pointer.y})`);
    aim.setAttribute("visibility", "visible");
  }

  function moveAimFromEvent(event) {
    const point = svgPoint(event);
    if (point) moveAim(point.x, point.y);
  }

  function newPitchTarget() {
    return {
      x: 480 + (Math.random() - 0.5) * 76,
      y: 405 + (Math.random() - 0.5) * 38,
    };
  }

  function pitchPose(progress) {
    const eased = 1 - Math.pow(1 - progress, 2.2);
    return {
      x: 480 + (pitchTarget.x - 480) * eased,
      y: 266 + (pitchTarget.y - 266) * eased,
      scale: 0.34 + 1.18 * progress,
    };
  }

  function placeBall(x, y, scale) {
    ball.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(2)})`);
  }

  function finishRound() {
    gameStarted = false;
    gameOver = true;
    wheelLeft.setAttribute("transform", "rotate(0 467 239)");
    wheelRight.setAttribute("transform", "rotate(0 493 239)");
    setPitchCue("ready");
    finalAnimationUntil = performance.now() + 850;
    swingButton.disabled = true;
    swingButton.textContent = "Three outs";
    replayButton.hidden = false;
    updateScore();
    setMessage(`Three outs. Inning over: ${runs} ${runs === 1 ? "run" : "runs"}. Play again?`);
  }

  function recordOut(label, badge) {
    setCrowdReaction("groan");
    outs += 1;
    strikes = 0;
    showOutcome(`${badge} · ${outs} ${outs === 1 ? "OUT" : "OUTS"}`);
    updateScore();
    if (outs >= 3) {
      finishRound();
      return;
    }
    setMessage(`${label} · ${outs} ${outs === 1 ? "out" : "outs"}.`);
  }

  function recordStrike(kind) {
    if (pitchResolved || !gameStarted) return;
    pitchResolved = true;
    flight = null;
    setCrowdReaction("groan");
    if (strikes < 2) {
      strikes += 1;
      const name = strikes === 1 ? "Strike one" : "Strike two";
      showOutcome(kind === "swing" ? name.toUpperCase() : `CALLED · ${name.toUpperCase()}`);
      setMessage(kind === "swing" ? `${name}. Keep your eye on the next pitch.` : `${name}. The pitch crossed the plate.`);
      updateScore();
      return;
    }
    recordOut("Strike three", "STRIKEOUT");
  }

  function advanceRunners(hitBases) {
    const next = [false, false, false];
    let runsScored = 0;
    if (hitBases === 4) {
      runsScored = 1 + bases.filter(Boolean).length;
      bases = [false, false, false];
      runs += runsScored;
      return runsScored;
    }
    bases.forEach((occupied, index) => {
      if (!occupied) return;
      const destination = index + hitBases;
      if (destination >= 3) runsScored += 1;
      else next[destination] = true;
    });
    const batterDestination = hitBases - 1;
    if (batterDestination >= 3) runsScored += 1;
    else next[batterDestination] = true;
    bases = next;
    runs += runsScored;
    return runsScored;
  }

  function hitFlight(pose, hitType, side, now) {
    const destinations = {
      single: { x: 480 + side * 190, y: 214, arc: 56 },
      double: { x: 480 + side * 162, y: 164, arc: 82 },
      triple: { x: 480 + side * 224, y: 132, arc: 104 },
      homer: { x: 480 + side * 62, y: 30, arc: 144 },
      groundout: { x: 480 + side * 92, y: 286, arc: 30 },
      flyout: { x: 480 + side * 56, y: 188, arc: 82 },
    };
    flight = {
      start: now,
      fromX: pose.x,
      fromY: pose.y,
      ...destinations[hitType],
      duration: hitType === "groundout" ? 620 : 850,
    };
  }

  function resolveContact(now, pose, distance) {
    const quality = 1 - distance / contactRadius;
    const roll = Math.random();
    const outChance = 0.3 - quality * 0.17;
    const side = pointer.x < 480 ? -1 : 1;

    if (roll < outChance * 0.52) {
      hitFlight(pose, "groundout", side, now);
      recordOut("Ground ball to the infield", "GROUNDOUT");
      return;
    }
    if (roll < outChance) {
      hitFlight(pose, "flyout", side, now);
      recordOut("Fly ball caught in the outfield", "FLYOUT");
      return;
    }

    const hitRoll = (roll - outChance) / (1 - outChance);
    let hitType;
    let basesAwarded;
    let outcome;
    if (hitRoll < 0.48) {
      hitType = "single"; basesAwarded = 1; outcome = side < 0 ? "SINGLE · LEFT FIELD" : "SINGLE · RIGHT FIELD";
    } else if (hitRoll < 0.76) {
      hitType = "double"; basesAwarded = 2; outcome = "DOUBLE · INTO THE GAP";
    } else if (hitRoll < 0.93) {
      hitType = "triple"; basesAwarded = 3; outcome = "TRIPLE · DOWN THE LINE";
    } else {
      hitType = "homer"; basesAwarded = 4; outcome = "HOME RUN";
    }

    setCrowdReaction(hitType === "homer" ? "homer" : "cheer");
    hitFlight(pose, hitType, side, now);
    const runsScored = advanceRunners(basesAwarded);
    strikes = 0;
    updateScore();
    showOutcome(outcome);
    const runNote = runsScored ? ` ${runsScored} ${runsScored === 1 ? "run" : "runs"} score.` : "";
    setMessage(`${outcome.toLowerCase().replaceAll(" · ", " ")}.${runNote} Keep batting.`);
  }

  function swing(now = performance.now()) {
    if (!gameStarted || pitchResolved) return;
    swingStart = now;
    pitchResolved = true;

    const elapsed = now - pitchStart;
    const progress = clamp((elapsed - windupDuration) / flightDuration, 0, 1);
    const pose = pitchPose(progress);
    const distance = pointer.active ? Math.hypot(pointer.x - pose.x, pointer.y - pose.y) : Infinity;
    const inWindow = elapsed >= windupDuration + flightDuration * 0.72 && elapsed <= pitchDuration;

    if (inWindow && distance <= contactRadius) {
      resolveContact(now, pose, distance);
      return;
    }
    recordStrike("swing");
  }

  function startGame() {
    if (gameStarted) return;
    gameOver = false;
    gameStarted = true;
    pitchNumber = 1;
    pitchStart = performance.now();
    pitchResolved = false;
    pitchTarget = newPitchTarget();
    outs = 0;
    runs = 0;
    strikes = 0;
    bases = [false, false, false];
    flight = null;
    swingStart = 0;
    swingTrailPoints = [];
    setCrowdReaction("neutral");
    batTrail.setAttribute("visibility", "hidden");
    swingButton.disabled = false;
    swingButton.textContent = "Swing";
    replayButton.hidden = true;
    hideOutcome();
    setPitchCue("ready");
    wheelLeft.setAttribute("transform", "rotate(0 467 239)");
    wheelRight.setAttribute("transform", "rotate(0 493 239)");
    setMessage("Watch the lights. Track the ball from the machine to the strike zone.");
    updateScore();
    scheduleAnimation();
  }

  function replayGame() {
    gameStarted = false;
    startGame();
  }

  function animate(now) {
    lastNow = now;
    if (!gameStarted && !(gameOver && now < finalAnimationUntil)) return;

    const elapsed = now - pitchStart;
    const progress = clamp((elapsed - windupDuration) / flightDuration, 0, 1);
    if (gameStarted) updateMachine(elapsed);
    if (flight) {
      const flightProgress = clamp((now - flight.start) / flight.duration, 0, 1);
      const x = flight.fromX + (flight.x - flight.fromX) * flightProgress;
      const y = flight.fromY + (flight.y - flight.fromY) * flightProgress - flight.arc * Math.sin(Math.PI * flightProgress);
      placeBall(x, y, 1.5 - 1.18 * flightProgress);
      trail.setAttribute("x1", String(flight.fromX));
      trail.setAttribute("y1", String(flight.fromY));
      trail.setAttribute("x2", x.toFixed(1));
      trail.setAttribute("y2", y.toFixed(1));
      trail.setAttribute("opacity", String(0.88 * (1 - flightProgress)));
      trail.setAttribute("visibility", "visible");
      if (flightProgress >= 1) flight = null;
    } else {
      const pose = pitchPose(progress);
      if (elapsed < windupDuration) {
        placeBall(480, 266, 0.34);
      } else placeBall(pose.x, pose.y, pose.scale);
      trail.setAttribute("visibility", "hidden");
    }

    if (swingStart && now - swingStart < 560) {
      const swingProgress = clamp((now - swingStart) / 560, 0, 1);
      const eased = 1 - Math.pow(1 - swingProgress, 2);
      const angle = 36 - 74 * eased;
      bat.setAttribute("transform", `translate(770 424) rotate(${angle.toFixed(1)})`);
      const radians = angle * Math.PI / 180;
      const tipX = 770 - 263 * Math.cos(radians);
      const tipY = 424 - 263 * Math.sin(radians);
      swingTrailPoints.push([tipX, tipY]);
      if (swingTrailPoints.length > 14) swingTrailPoints.shift();
      batTrail.setAttribute("d", swingTrailPoints.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" "));
      batTrail.setAttribute("opacity", String(0.82 * (1 - swingProgress * 0.62)));
      batTrail.setAttribute("visibility", "visible");
    } else {
      bat.setAttribute("transform", "translate(770 424) rotate(36)");
      if (swingStart) {
        swingStart = 0;
        swingTrailPoints = [];
        batTrail.setAttribute("visibility", "hidden");
      }
    }

    if (gameStarted && elapsed >= pitchDuration && !pitchResolved) recordStrike("called");
    if (gameStarted && elapsed >= pitchInterval) {
      pitchNumber += 1;
      pitchStart += pitchInterval;
      pitchResolved = false;
      pitchTarget = newPitchTarget();
      flight = null;
      swingStart = 0;
      swingTrailPoints = [];
      batTrail.setAttribute("visibility", "hidden");
      hideOutcome();
      updateScore();
      setMessage("New pitch. Watch for the red light, then track the ball.");
    }
    if (gameStarted || (gameOver && now < finalAnimationUntil)) scheduleAnimation();
  }

  function handleSceneClick(event) {
    moveAimFromEvent(event);
    if (!gameStarted) {
      if (!gameOver) startGame();
      return;
    }
    swing();
  }

  scene.addEventListener("pointermove", moveAimFromEvent);
  scene.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    handleSceneClick(event);
  });
  scene.addEventListener("keydown", (event) => {
    const nudge = event.shiftKey ? 22 : 14;
    if (event.key === "ArrowLeft") moveAim(pointer.x - nudge, pointer.y);
    else if (event.key === "ArrowRight") moveAim(pointer.x + nudge, pointer.y);
    else if (event.key === "ArrowUp") moveAim(pointer.x, pointer.y - nudge);
    else if (event.key === "ArrowDown") moveAim(pointer.x, pointer.y + nudge);
    else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      if (!gameStarted) startGame();
      else swing(lastNow);
      return;
    } else return;
    event.preventDefault();
  });
  swingButton.addEventListener("click", () => {
    if (!gameStarted) startGame();
    else swing();
  });
  replayButton.addEventListener("click", replayGame);

  placeBall(480, 266, 0.34);
  buildCrowd();
  updateScore();
})();
