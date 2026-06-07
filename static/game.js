const socket = io();

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const bg = new Image();
bg.src = "/static/images/background.png";

const runningBg = new Image();
runningBg.src = "/static/images/running_background.png";

let myColor = null;


if (MY_USER_ID === PLAYER1_ID) {
    myColor = "blue";
}

if (MY_USER_ID === PLAYER2_ID) {
    myColor = "red";
}

socket.emit("join_game_room", {
    room: ROOM_CODE,
    username: MY_USERNAME
});

let leavingGame = false;

function leaveGame() {
    if (leavingGame) return;
    leavingGame = true;

    socket.emit("leave_game_room", {
        room: ROOM_CODE
    });

    setTimeout(function() {
        window.location.href = "/menu";
    }, 200);
}

let gameState = "pitching";

let x = 100;
let y = 520;

let speed = 2;
let angle = 5;

let ballMoving = false;
let lastFrameTime = performance.now();

let groundY = 620;
let resetCounter = 0;

let resultText = "";
let pitchAngleAtThrow = 5;

let swingChosen = false;
let swingResult = "";
let hitDifference = 99;

let hitterX = 1330;

let strikes = 0;
let balls = 0;
let outs = 0;

let blueScore = 0;
let redScore = 0;

let currentHitter = "red";

let runnerY = 650;
let runPresses = 0;
let pressesNeeded = 20;
let runTimer = 0;
let runCountdown = 180;
let runningStarted = false;

function isGameReady() {
    return typeof gameReady !== "undefined" && gameReady === true;
}

function isMyTurnToPitch() {
    return (currentHitter === "red" && myColor === "blue") ||
           (currentHitter === "blue" && myColor === "red");
}

function isMyTurnToHit() {
    return currentHitter === myColor;
}

function getBallSpeed() {
    if (speed === 1) return 720;
    if (speed === 2) return 1040;
    if (speed === 3) return 1360;
}

socket.on("room_updated", function(data) {
    if (data.game_ready !== gameReady) {
        location.reload();
    }
});

socket.on("player_left_game", function() {
    window.location.href = "/menu";
});

socket.on("receive_pitch", function(data) {
    if (!isGameReady()) return;

    resetBall();
    speed = data.speed;
    angle = data.angle;
    pitchAngleAtThrow = data.angle;
    resultText = "";
    ballMoving = true;
});

socket.on("receive_swing", function(data) {
    if (!isGameReady()) return;
    if (!ballMoving || swingChosen) return;

    let swingAngle = data.swingAngle;
    swingChosen = true;

    if (swingAngle === 0) {
        swingResult = "NO_SWING";
    } else {
        let convertedSwing = swingAngle * 2;
        let difference = Math.abs(pitchAngleAtThrow - convertedSwing);
        hitDifference = difference;

        let impossiblePitch =
            (angle === 10 && speed === 3) ||
            (angle === 10 && speed === 2) ||
            (angle === 9 && speed === 3) ||
            (angle === 0 && speed === 3) ||
            (angle === 0 && speed === 1) ||
            (angle === 0 && speed === 2) ||
            (angle === 1 && speed === 1);

        let ballTooEarly = x < canvas.width / 2;

        if (impossiblePitch) {
            swingResult = "MISS";
        } else if (ballTooEarly) {
            swingResult = "TOO_EARLY";
            resultText = "TOO EARLY!";
        } else if (difference <= 1.5) {
            swingResult = "HIT";
        } else {
            swingResult = "MISS";
        }
    }
});

socket.on("receive_run_press", function() {
    if (!isGameReady()) return;

    if (gameState === "running" && runningStarted) {
        runPresses++;
    }
});

socket.on("receive_role_change", function(data) {
    currentHitter = data.currentHitter;
    resultText = data.resultText;

    strikes = 0;
    balls = 0;
    outs = 0;

    resetBall();
    gameState = "pitching";
});

socket.on("waiting_for_player", function(data) {
    resultText = "WAITING FOR PLAYER 2";
});

function drawPlayers() {
    let pitcherColor;
    let hitterColor;

    if (currentHitter === "red") {
        pitcherColor = "blue";
        hitterColor = "red";
    } else {
        pitcherColor = "red";
        hitterColor = "blue";
    }

    ctx.fillStyle = pitcherColor;
    ctx.fillRect(180, 460, 40, 100);
    ctx.beginPath();
    ctx.arc(200, 440, 25, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = hitterColor;
    ctx.fillRect(1350, 450, 40, 110);
    ctx.beginPath();
    ctx.arc(1370, 430, 25, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "brown";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(1360, 470);
    ctx.lineTo(1410, 410);
    ctx.stroke();
    ctx.lineWidth = 1;
}

function drawRoomAndNames() {
    let pitcherName;
    let hitterName;

    if (currentHitter === "red") {
        pitcherName = PLAYER1_NAME;
        hitterName = PLAYER2_NAME;
    } else {
        pitcherName = PLAYER2_NAME;
        hitterName = PLAYER1_NAME;
    }

    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(650, 20, 320, 55);

    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.strokeRect(650, 20, 320, 55);

    ctx.fillStyle = "yellow";
    ctx.font = "30px Arial";
    ctx.fillText("Room: " + ROOM_CODE, 700, 57);

    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(120, 640, 260, 45);

    ctx.strokeStyle = "white";
    ctx.strokeRect(120, 640, 260, 45);

    ctx.fillStyle = "white";
    ctx.font = "26px Arial";
    ctx.fillText(pitcherName, 140, 672);

    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(1280, 640, 260, 45);

    ctx.strokeStyle = "white";
    ctx.strokeRect(1280, 640, 260, 45);

    ctx.fillStyle = "white";
    ctx.font = "26px Arial";

    if (hitterName && hitterName !== "None") {
        ctx.fillText(hitterName, 1300, 672);
    } else {
        ctx.fillText("Waiting...", 1300, 672);
    }
}

function drawWaitingScreen() {
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "white";
    ctx.font = "55px Arial";
    ctx.fillText("Waiting for second player...", 470, 330);

    ctx.fillStyle = "yellow";
    ctx.font = "45px Arial";
    ctx.fillText("Room ID: " + ROOM_CODE, 610, 410);

    ctx.fillStyle = "white";
    ctx.font = "28px Arial";
    ctx.fillText("Share this room code with Player 2", 560, 470);
}

function drawUI() {
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(40, 45, 300, 175);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 45, 300, 175);

    if (isMyTurnToPitch()) {
        ctx.fillStyle = "white";
        ctx.font = "30px Arial";
        ctx.fillText("Angle:", 65, 95);
        ctx.fillText("Speed:", 65, 145);

        ctx.fillStyle = "yellow";
        ctx.font = "36px Arial";
        ctx.fillText(angle, 210, 95);
        ctx.fillText(speed, 210, 145);

        ctx.fillStyle = "lime";
        ctx.font = "24px Arial";
        ctx.fillText("Your turn: Pitch", 65, 195);
    } else if (isMyTurnToHit()) {
        ctx.fillStyle = "lime";
        ctx.font = "30px Arial";
        ctx.fillText("Your turn: Hit", 65, 95);

        ctx.fillStyle = "yellow";
        ctx.font = "24px Arial";
        ctx.fillText("0 = No Swing", 65, 145);
        ctx.fillText("1-5 = Swing", 65, 185);
    } else {
        ctx.fillStyle = "orange";
        ctx.font = "28px Arial";
        ctx.fillText("Waiting...", 65, 120);
    }

    if (resultText !== "") {
        ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
        ctx.fillRect(570, 55, 560, 90);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.lineWidth = 2;
        ctx.strokeRect(570, 55, 560, 90);

        ctx.fillStyle = "yellow";
        ctx.font = "52px Arial";
        ctx.fillText(resultText, 610, 115);
    }

    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(1190, 45, 330, 285);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1190, 45, 330, 285);

    ctx.fillStyle = "white";
    ctx.font = "30px Arial";
    ctx.fillText("Strikes:", 1215, 90);
    ctx.fillText("Balls:", 1215, 135);
    ctx.fillText("Outs:", 1215, 180);
    ctx.fillText("Blue Score:", 1215, 240);
    ctx.fillText("Red Score:", 1215, 290);

    ctx.fillStyle = "yellow";
    ctx.font = "34px Arial";
    ctx.fillText(strikes, 1435, 90);
    ctx.fillText(balls, 1435, 135);
    ctx.fillText(outs, 1435, 180);
    ctx.fillText(blueScore, 1435, 240);
    ctx.fillText(redScore, 1435, 290);

    ctx.strokeStyle = "yellow";
    ctx.lineWidth = 3;
    ctx.strokeRect(1300, 420, 80, 140);
    ctx.lineWidth = 1;
}

function resetBall() {
    x = 100;
    y = 520;
    ballMoving = false;
    resetCounter = 0;
    swingChosen = false;
    swingResult = "";
    hitDifference = 99;
}

function addPoint(points) {
    if (currentHitter === "blue") {
        blueScore += points;
    } else {
        redScore += points;
    }
}

function switchRoles() {
    if (currentHitter === "red") {
        currentHitter = "blue";
        resultText = "SWITCH! BLUE HITS";
    } else {
        currentHitter = "red";
        resultText = "SWITCH! RED HITS";
    }

    strikes = 0;
    balls = 0;
    outs = 0;

    socket.emit("role_change", {
        room: ROOM_CODE,
        currentHitter: currentHitter,
        resultText: resultText
    });
}

function checkCountRules() {
    if (strikes >= 3) {
        outs++;
        resultText = "STRIKE OUT!";
        strikes = 0;
        balls = 0;
    }

    if (balls >= 4) {
        resultText = "WALK!";
        strikes = 0;
        balls = 0;
    }

    if (outs >= 3) {
        switchRoles();
    }
}

function startRunningChallenge() {
    gameState = "running";
    runnerY = 650;
    runPresses = 0;

    runCountdown = 180;
    runningStarted = false;

    if (hitDifference <= 0.5) {
        pressesNeeded = 12;
        runTimer = 360;
    } else if (hitDifference <= 1) {
        pressesNeeded = 18;
        runTimer = 420;
    } else {
        pressesNeeded = 24;
        runTimer = 480;
    }
}

function drawRunningScreen() {
    ctx.drawImage(runningBg, 0, 0, canvas.width, canvas.height);

    ctx.fillStyle = currentHitter === "blue" ? "blue" : "red";
    ctx.fillRect(760, runnerY, 45, 90);
    ctx.beginPath();
    ctx.arc(782, runnerY - 20, 24, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(0, 0, 0, 0.70)";
    ctx.fillRect(40, 40, 540, 270);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 40, 540, 270);

    ctx.fillStyle = "white";
    ctx.font = "34px Arial";
    ctx.fillText("RUN CHALLENGE", 70, 90);
    ctx.fillText("Press R " + pressesNeeded + " times", 70, 145);

    if (!runningStarted) {
        let count = Math.ceil(runCountdown / 60);

        ctx.fillStyle = "yellow";
        ctx.font = "50px Arial";
        ctx.fillText("Start in: " + count, 70, 225);

        runCountdown--;

        if (runCountdown <= 0) {
            runningStarted = true;
            resultText = "GO!";
        }

        return;
    }

    ctx.fillText("Presses: " + runPresses, 70, 205);
    ctx.fillText("Time: " + Math.ceil(runTimer / 60), 70, 260);

    runnerY = 650 - (runPresses / pressesNeeded) * 420;
    runTimer--;

    if (runPresses >= pressesNeeded) {
        addPoint(1);
        resultText = "SAFE! +1";
        gameState = "pitching";
        resetBall();
    }

    if (runTimer <= 0) {
        outs++;
        resultText = "OUT!";
        checkCountRules();
        gameState = "pitching";
        resetBall();
    }
}

function animate(currentTime) {
    let deltaTime = (currentTime - lastFrameTime) / 1000;
    lastFrameTime = currentTime;

    if (deltaTime > 0.05) {
        deltaTime = 0.05;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (gameState === "running") {
        drawRunningScreen();
        requestAnimationFrame(animate);
        return;
    }

    ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);

    drawPlayers();
    drawUI();
    drawRoomAndNames();

    if (!isGameReady()) {
        drawWaitingScreen();
        requestAnimationFrame(animate);
        return;
    }

    if (ballMoving) {
        x += getBallSpeed() * deltaTime;

        let progress = (x - 100) / (hitterX - 100);
        let startY = 520;
        let targetY = 620 - angle * 35;
        let drop = (4 - speed) * 20 * progress * progress;
        let arc = Math.sin(progress * Math.PI) * angle * 25;

        y = startY + (targetY - startY) * progress - arc + drop;

        if (y >= groundY) {
            y = groundY;
            ballMoving = false;

            if (swingChosen) {
                strikes++;
                resultText = "STRIKE!";
            } else {
                balls++;
                resultText = "BALL!";
            }

            checkCountRules();
            resetCounter = 60;
        }

        if (y < -100) {
            ballMoving = false;

            if (swingChosen) {
                strikes++;
                resultText = "STRIKE!";
            } else {
                balls++;
                resultText = "BALL!";
            }

            checkCountRules();
            resetCounter = 60;
        }

        if (x >= hitterX && ballMoving) {
            ballMoving = false;

            let inStrikeZone = y >= 420 && y <= 560;

            if (swingChosen && swingResult === "HIT") {
                strikes = 0;
                balls = 0;

                if (hitDifference <= 0.2) {
                    addPoint(2);
                    resultText = "HOME RUN! +2";
                    resetCounter = 120;
                } else {
                    resultText = "HIT! RUN!";
                    startRunningChallenge();
                }
            } else if (swingChosen && swingResult === "TOO_EARLY") {
                strikes++;
                resultText = "TOO EARLY!";
                checkCountRules();
                resetCounter = 60;
            } else if (swingChosen && swingResult === "MISS") {
                strikes++;
                resultText = "STRIKE!";
                checkCountRules();
                resetCounter = 60;
            } else {
                if (inStrikeZone) {
                    strikes++;
                    resultText = "STRIKE!";
                } else {
                    balls++;
                    resultText = "BALL!";
                }

                checkCountRules();
                resetCounter = 60;
            }
        }
    }

    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.fill();
    ctx.strokeStyle = "black";
    ctx.stroke();

    if (!ballMoving && resetCounter > 0) {
        resetCounter--;

        if (resetCounter <= 0) {
            resetBall();
        }
    }

    requestAnimationFrame(animate);
}





document.addEventListener("keydown", function(event) {
    if (event.key === "Escape") {
        socket.emit("leave_game_room", {
            room: ROOM_CODE
        });

        return;
    }

    if (!isGameReady()) {
        return;
    }

    if (gameState === "running") {
        if (isMyTurnToHit() && runningStarted && (event.key === "r" || event.key === "R")) {
            socket.emit("run_press", {
                room: ROOM_CODE
            });
        }
        return;
    }

    if (isMyTurnToPitch()) {
        if (event.key === "q" || event.key === "Q") {
            if (angle > 0) angle--;
        }

        if (event.key === "e" || event.key === "E") {
            if (angle < 10) angle++;
        }

        if (event.key === "a" || event.key === "A") {
            if (speed > 1) speed--;
        }

        if (event.key === "d" || event.key === "D") {
            if (speed < 3) speed++;
        }

        if (event.code === "Space") {
            socket.emit("pitch", {
                room: ROOM_CODE,
                speed: speed,
                angle: angle
            });
        }
    }

    if (isMyTurnToHit()) {
        if (event.key >= "0" && event.key <= "5") {
            if (ballMoving && !swingChosen) {
                socket.emit("swing", {
                    room: ROOM_CODE,
                    swingAngle: Number(event.key)
                });
            }
        }
    }
});
bg.onload = function() {
    lastFrameTime = performance.now();
    requestAnimationFrame(animate);
};