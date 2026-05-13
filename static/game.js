const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const bg = new Image();
bg.src = "/static/images/background.png";

let x = 100;
let y = 520;

let speed = 8;
let angle = 5;

let ballMoving = false;
let hitBallMoving = false;

let groundY = 620;
let resetCounter = 0;

let resultText = "";
let pitchAngleAtThrow = 5;

let swingChosen = false;
let swingResult = "";
let hitterX = 1330;

let strikes = 0;
let balls = 0;
let outs = 0;

function drawPlayers() {
    ctx.fillStyle = "blue";
    ctx.fillRect(180, 460, 40, 100);
    ctx.beginPath();
    ctx.arc(200, 440, 25, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "red";
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

function drawUI() {
    ctx.fillStyle = "white";
    ctx.font = "30px Arial";

    ctx.fillText("Pitcher Controls", 50, 60);
    ctx.fillText("Q / E = Angle", 50, 100);
    ctx.fillText("A / D = Speed", 50, 140);
    ctx.fillText("SPACE = Throw", 50, 180);

    ctx.fillText("Angle: " + angle, 50, 240);
    ctx.fillText("Speed: " + speed, 50, 280);

    ctx.fillStyle = "yellow";
    ctx.fillText("0 = No Swing", 50, 340);
    ctx.fillText("1-5 = Swing", 50, 380);

    ctx.fillStyle = "white";
    ctx.font = "35px Arial";
    ctx.fillText("Strikes: " + strikes, 1200, 60);
    ctx.fillText("Balls: " + balls, 1200, 110);
    ctx.fillText("Outs: " + outs, 1200, 160);

    ctx.strokeStyle = "yellow";
    ctx.lineWidth = 3;
    ctx.strokeRect(1300, 420, 80, 140);
    ctx.lineWidth = 1;

    ctx.fillStyle = "yellow";
    ctx.font = "45px Arial";
    ctx.fillText(resultText, 700, 100);
}

function resetBall() {
    x = 100;
    y = 520;
    ballMoving = false;
    hitBallMoving = false;
    resetCounter = 0;
    swingChosen = false;
    swingResult = "";
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
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);

    drawPlayers();
    drawUI();

    if (ballMoving) {
        x += speed;

        let progress = (x - 100) / (hitterX - 100);

        let startY = 520;

        // angle controls pitch height
        let targetY = 620 - angle * 35;

        // weak pitch drops more
        let drop = (10 - speed) * 12 * progress * progress;

        // arc effect
        let arc = Math.sin(progress * Math.PI) * angle * 25;

        y = startY + (targetY - startY) * progress - arc + drop;

        // weak pitch hits ground
        if (y >= groundY) {
            y = groundY;
            ballMoving = false;
            resultText = "BALL!";
            balls++;
            checkCountRules();
            resetCounter = 60;
        }

        // too high pitch flies away
        if (y < -100) {
            ballMoving = false;
            resultText = "BALL!";
            balls++;
            checkCountRules();
            resetCounter = 60;
        }

        // ball reached hitter
        if (x >= hitterX && ballMoving) {
            ballMoving = false;

            let inStrikeZone = y >= 420 && y <= 560;

            if (swingChosen && swingResult === "HIT") {
                resultText = "HIT!";
                hitBallMoving = true;
                strikes = 0;
                balls = 0;
            }

            else if (swingChosen && swingResult === "MISS") {
                strikes++;
                resultText = "STRIKE!";
                checkCountRules();
                resetCounter = 60;
            }

            else {
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

    if (hitBallMoving) {
        x -= 14;
        y -= 8;

        if (x < 100 || y < -100) {
            resetBall();
        }
    }

    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.fill();
    ctx.strokeStyle = "black";
    ctx.stroke();

    if (!ballMoving && !hitBallMoving && resetCounter > 0) {
        resetCounter--;

        if (resetCounter <= 0) {
            resetBall();
        }
    }

    requestAnimationFrame(animate);
}

document.addEventListener("keydown", function(event) {
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
        if (speed < 15) speed++;
    }

    if (event.code === "Space") {
        resetBall();
        ballMoving = true;
        pitchAngleAtThrow = angle;
        resultText = "";
    }

    if (event.key >= "0" && event.key <= "5") {
        if (ballMoving && !swingChosen) {
            let swingAngle = Number(event.key);
            swingChosen = true;

            if (swingAngle === 0) {
                swingResult = "NO_SWING";
            } else {
                let convertedSwing = swingAngle * 2;
                let difference = Math.abs(pitchAngleAtThrow - convertedSwing);

                if (difference <= 1.5) {
                    swingResult = "HIT";
                } else {
                    swingResult = "MISS";
                }
            }
        }
    }
});

bg.onload = function() {
    animate();
};