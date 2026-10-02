(() => {
  const scene = document.getElementById("practiceScene");
  const ball = document.getElementById("practiceBall");
  const bat = document.getElementById("practiceBat");
  const aim = document.getElementById("practiceAim");
  const trail = document.getElementById("practiceTrail");
  const hitReadout = document.getElementById("practiceHits");
  const pitchReadout = document.getElementById("practicePitch");
  const message = document.getElementById("practiceMessage");
  const roundStatus = document.getElementById("practiceRoundStatus");
  const swingButton = document.getElementById("practiceSwing");
  const replayButton = document.getElementById("practiceReplay");

  if (!scene || !ball || !bat || !aim || !trail || !hitReadout || !pitchReadout || !message || !roundStatus || !swingButton || !replayButton) return;

  const totalPitches = 5;
  const pitchDuration = 2100;
  const betweenPitches = 750;
  const pitchTargets = [
    { x: 750, y: 246 },
    { x: 760, y: 237 },
    { x: 742, y: 252 },
    { x: 756, y: 241 },
    { x: 746, y: 254 },
  ];

  let pitchIndex = 0;
  let hitCount = 0;
  let pitchStart = performance.now();
  let swungThisPitch = false;
  let roundComplete = false;
  let pointer = { x: 746, y: 246, active: false };
  let swingStart = 0;
  let flight = null;
  let lastNow = pitchStart;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function setMessage(text) {
    message.textContent = text;
  }

  function updateScore() {
    hitReadout.textContent = String(hitCount);
    pitchReadout.textContent = `${Math.min(pitchIndex + 1, totalPitches)} / ${totalPitches}`;
    roundStatus.textContent = roundComplete ? "ROUND COMPLETE" : `LIVE · PITCH ${pitchIndex + 1}`;
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
      x: clamp(x, 0, 880),
      y: clamp(y, 0, 360),
      active: true,
    };
    aim.setAttribute("transform", `translate(${pointer.x} ${pointer.y})`);
    aim.setAttribute("visibility", "visible");
  }

  function moveAimFromEvent(event) {
    const point = svgPoint(event);
    if (point) moveAim(point.x, point.y);
  }

  function pitchPose(progress) {
    const target = pitchTargets[pitchIndex];
    const eased = progress * progress * (3 - 2 * progress);
    return {
      x: 568 + (target.x - 568) * eased,
      y: 198 + (target.y - 198) * eased - 12 * Math.sin(Math.PI * progress),
      scale: 0.58 + 0.5 * progress,
    };
  }

  function placeBall(x, y, scale) {
    ball.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(2)})`);
  }

  function swing(now = performance.now()) {
    if (roundComplete || swungThisPitch) return;
    swungThisPitch = true;
    swingStart = now;

    const progress = clamp((now - pitchStart) / pitchDuration, 0, 1);
    const pose = pitchPose(progress);
    const aimedWell = pointer.active && Math.hypot(pointer.x - pose.x, pointer.y - pose.y) <= 48;
    const inWindow = progress >= 0.68 && progress <= 1;

    if (inWindow && aimedWell) {
      hitCount += 1;
      flight = { start: now, fromX: pose.x, fromY: pose.y, toX: 438, toY: 159 };
      setMessage("Solid contact! Track the next pitch.");
    } else if (progress < 0.68) {
      setMessage("A little early. Watch the ball into the zone.");
    } else if (!aimedWell) {
      setMessage("Just missed. Move the reticle onto the ball next time.");
    } else {
      setMessage("A little late. Get ready for the next pitch.");
    }
    updateScore();
  }

  function resetRound() {
    const now = performance.now();
    pitchIndex = 0;
    hitCount = 0;
    pitchStart = now;
    swungThisPitch = false;
    roundComplete = false;
    flight = null;
    swingStart = 0;
    swingButton.disabled = false;
    replayButton.hidden = true;
    setMessage("Move your cursor over the ball, then swing near the plate.");
    updateScore();
    requestAnimationFrame(animate);
  }

  function animate(now) {
    lastNow = now;
    if (!roundComplete) {
      const elapsed = now - pitchStart;
      const progress = clamp(elapsed / pitchDuration, 0, 1);

      if (flight) {
        const flightProgress = clamp((now - flight.start) / 900, 0, 1);
        const x = flight.fromX + (flight.toX - flight.fromX) * flightProgress;
        const y = flight.fromY + (flight.toY - flight.fromY) * flightProgress - 92 * Math.sin(Math.PI * flightProgress);
        placeBall(x, y, 1.08 - 0.42 * flightProgress);
        trail.setAttribute("x1", String(flight.fromX));
        trail.setAttribute("y1", String(flight.fromY));
        trail.setAttribute("x2", x.toFixed(1));
        trail.setAttribute("y2", y.toFixed(1));
        trail.setAttribute("opacity", String(0.9 * (1 - flightProgress)));
        trail.setAttribute("visibility", "visible");
        if (flightProgress >= 1) flight = null;
      } else {
        const pose = pitchPose(progress);
        placeBall(pose.x, pose.y, pose.scale);
        trail.setAttribute("visibility", "hidden");
      }

      if (swingStart && now - swingStart < 340) {
        const swingProgress = clamp((now - swingStart) / 340, 0, 1);
        const angle = -42 + 112 * Math.sin(Math.PI * swingProgress);
        bat.setAttribute("transform", `rotate(${angle.toFixed(1)} 784 244)`);
      } else {
        bat.setAttribute("transform", "rotate(-42 784 244)");
      }

      if (elapsed >= pitchDuration && !swungThisPitch) {
        swungThisPitch = true;
        setMessage("Taken pitch. Get ready for the next one.");
      }

      if (elapsed >= pitchDuration + betweenPitches) {
        if (pitchIndex + 1 >= totalPitches) {
          roundComplete = true;
          swingButton.disabled = true;
          replayButton.hidden = false;
          setMessage(`Round over: ${hitCount} ${hitCount === 1 ? "hit" : "hits"} in ${totalPitches} pitches. Play again?`);
          updateScore();
        } else {
          pitchIndex += 1;
          pitchStart += pitchDuration + betweenPitches;
          swungThisPitch = false;
          flight = null;
          setMessage("Next pitch. Track it and swing near the plate.");
          updateScore();
        }
      }
    }

    if (!roundComplete) requestAnimationFrame(animate);
  }

  scene.addEventListener("pointermove", moveAimFromEvent);
  scene.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    moveAimFromEvent(event);
    swing();
  });
  scene.addEventListener("keydown", (event) => {
    const nudge = event.shiftKey ? 20 : 12;
    if (event.key === "ArrowLeft") moveAim(pointer.x - nudge, pointer.y);
    else if (event.key === "ArrowRight") moveAim(pointer.x + nudge, pointer.y);
    else if (event.key === "ArrowUp") moveAim(pointer.x, pointer.y - nudge);
    else if (event.key === "ArrowDown") moveAim(pointer.x, pointer.y + nudge);
    else if (event.key === " " || event.key === "Enter") swing(lastNow);
    else return;
    event.preventDefault();
  });
  swingButton.addEventListener("click", () => swing());
  replayButton.addEventListener("click", resetRound);

  updateScore();
  requestAnimationFrame(animate);
})();
