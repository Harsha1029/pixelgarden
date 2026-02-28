const config = {
    canvasWidth: 2000,
    canvasHeight: 2000,
    playerSpeed: 3,
    sprintSpeed: 6,
    playerCount: 10,
    roundTime: 60,
    votePhaseTime: 60,
    flowerCount: 50
};

const flowerTypes = [
    { type: 1, points: 1, probability: 0.6, class: 'flower-1' },
    { type: 2, points: 2, probability: 0.25, class: 'flower-2' },
    { type: 3, points: 3, probability: 0.1, class: 'flower-3' },
    { type: 5, points: 5, probability: 0.05, class: 'flower-5' }
];

const characterSprites = [
    { name: "BEAUTI", sprite: "beauti.png" },
    { name: "BLUEBURREY", sprite: "buleburrey.png" },
    { name: "CHUMY", sprite: "chumy.png" },
    { name: "DEMOGE", sprite: "demoge.png" },
    { name: "FIRE", sprite: "fire.png" },
    { name: "ICE", sprite: "ice.png" },
    { name: "KIME", sprite: "kime.png" },
    { name: "MARK", sprite: "mark.png" },
    { name: "POPPE", sprite: "poppe.png" },
    { name: "CHUMY GOLD", sprite: "chumy.png", filter: "sepia(1) saturate(10) brightness(1.2)" }
];

let players = [];
let flowers = [];
let localPlayer = null;
let gameTime = config.roundTime;
let gameActive = false;
let gameKeys = {};
let timerInterval = null;
let currentPhase = 'round';
let selectedCharIndex = parseInt(localStorage.getItem('selectedCharIndex')) || -1;
let votingResults = {};
let userHasVoted = false;
// Spectator variables
let spectatorOffset = { x: 0, y: 0 };
let isDragging = false;
let lastMousePos = { x: 0, y: 0 };
let currentZoom = 2.0;
let joystickState = { x: 0, y: 0, active: false };

// Audio Controller
const AudioController = {
    bgMusic: new Audio('/assets/bg music/gamebg.mp3'),
    clickSound: new Audio('/assets/sounds/buttons.mp3'),
    collectSound: new Audio('/assets/sounds/flowercollect.mp3'),
    elimSound: new Audio('/assets/sounds/eliminate.mp3'),
    winnerSound: new Audio('/assets/sounds/winner.mp3'),

    musicEnabled: true,
    soundEnabled: true,
    targetVolume: 0.5,

    init() {
        this.bgMusic.loop = true;
        this.bgMusic.volume = 0;

        // Settings listeners
        document.getElementById('music-toggle').onchange = (e) => {
            this.musicEnabled = e.target.checked;
            if (this.musicEnabled) this.bgMusic.play().catch(() => { });
            else this.bgMusic.pause();
            this.playClick();
        };

        document.getElementById('music-volume').oninput = (e) => {
            this.targetVolume = parseFloat(e.target.value);
        };

        document.getElementById('sound-toggle').onchange = (e) => {
            this.soundEnabled = e.target.checked;
            this.playClick();
        };

        // Smooth volume animation
        setInterval(() => {
            if (!this.musicEnabled) return;
            const diff = this.targetVolume - this.bgMusic.volume;
            if (Math.abs(diff) > 0.01) {
                this.bgMusic.volume += diff * 0.1;
            } else {
                this.bgMusic.volume = this.targetVolume;
            }
        }, 50);
    },

    playClick() { if (this.soundEnabled) { this.clickSound.currentTime = 0; this.clickSound.play(); } },
    playCollect() { if (this.soundEnabled) { this.collectSound.currentTime = 0; this.collectSound.play(); } },
    playElim() { if (this.soundEnabled) { this.elimSound.currentTime = 0; this.elimSound.play(); } },
    playWinner() { if (this.soundEnabled) { this.winnerSound.currentTime = 0; this.winnerSound.play(); } }
};

function initGame() {
    AudioController.init();
    setupCharPicker();
    setupControls();
    gameLoop();

    // Specific to game.html
    const exitToLanding = document.getElementById('exit-to-landing');
    if (exitToLanding) {
        exitToLanding.onclick = () => {
            AudioController.playClick();
            window.location.href = 'index.html';
        };
    }
}

function setupCharPicker() {
    const grid = document.getElementById('char-picker-grid');
    const nextBtn = document.getElementById('char-next-btn');

    characterSprites.forEach((char, idx) => {
        const card = document.createElement('div');
        card.className = 'char-picker-card';
        card.innerHTML = `
            <img src="/assets/sprites/${char.sprite}" style="filter: ${char.filter || 'none'}">
            <h4>${char.name}</h4>
        `;
        card.onclick = () => {
            document.querySelectorAll('.char-picker-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedCharIndex = idx;
            nextBtn.disabled = false;
        };
        grid.appendChild(card);
    });

    nextBtn.onclick = () => {
        document.getElementById('char-selection').style.display = 'none';
        startGame();
    };

    // Voting Buttons
    document.getElementById('skip-vote-btn').onclick = () => confirmVote(-1);
    document.getElementById('confirm-no').onclick = () => document.getElementById('vote-confirm-modal').style.display = 'none';

    // Exit Game Buttons
    document.getElementById('exit-game-btn').onclick = () => {
        AudioController.playClick();
        document.getElementById('exit-modal').style.display = 'flex';
    };
    document.getElementById('exit-no').onclick = () => {
        AudioController.playClick();
        document.getElementById('exit-modal').style.display = 'none';
    };
    document.getElementById('exit-yes').onclick = () => {
        AudioController.playClick();
        window.location.href = 'index.html';
    };

    // Settings Buttons
    document.getElementById('settings-btn').onclick = () => {
        AudioController.playClick();
        document.getElementById('settings-modal').style.display = 'flex';
    };
    document.getElementById('close-settings').onclick = () => {
        AudioController.playClick();
        document.getElementById('settings-modal').style.display = 'none';
    };

    // Add click sounds to all pixel-buttons
    document.querySelectorAll('.pixel-btn, .close-x, .nav-btn').forEach(btn => {
        btn.addEventListener('click', () => AudioController.playClick());
    });

    // Spectator Zoom
    window.addEventListener('wheel', (e) => {
        if (!gameActive || !localPlayer.eliminated) return;
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        currentZoom = Math.max(1.0, Math.min(4.0, currentZoom + delta));
    }, { passive: true });
}

function startGame() {
    AudioController.bgMusic.play().catch(() => { });
    document.getElementById('ui-layer').style.display = 'block';
    setupPlayers();
    setupFlowers();
    startTimer();
    gameActive = true;
}

function setupPlayers() {
    const world = document.getElementById('game-world');
    // Single Player / AI Mode
    for (let i = 0; i < config.playerCount; i++) {
        const charIdx = (i === 0) ? selectedCharIndex : Math.floor(Math.random() * characterSprites.length);
        const p = {
            id: i,
            name: (i === 0) ? "YOU" : characterSprites[charIdx].name,
            sprite: characterSprites[charIdx].sprite,
            filter: characterSprites[charIdx].filter || 'none',
            x: Math.random() * (config.canvasWidth - 100) + 50,
            y: Math.random() * (config.canvasHeight - 100) + 50,
            score: 0,
            eliminated: false,
            isAI: i !== 0,
            isMoving: false,
            facing: 1,
            element: null,
            spriteElement: null
        };

        const el = document.createElement('div');
        el.className = 'player';
        const sprite = document.createElement('div');
        sprite.className = 'player-sprite';
        sprite.style.backgroundImage = `url('/assets/sprites/${p.sprite}')`;
        sprite.style.filter = p.filter;
        el.appendChild(sprite);
        el.innerHTML += `<div class="player-name-tag">${p.name}</div>`;
        world.appendChild(el);
        p.element = el;
        p.spriteElement = sprite;
        players.push(p);
    }
    localPlayer = players[0];
}

function setupFlowers() {
    const world = document.getElementById('game-world');
    for (let i = 0; i < config.flowerCount; i++) {
        spawnFlower();
    }
}

let nextFlowerId = 0; // To assign unique IDs to flowers

function spawnFlower() {
    const world = document.getElementById('game-world');
    const r = Math.random();
    let cumulative = 0;
    let selectedType = flowerTypes[0];
    for (const type of flowerTypes) {
        cumulative += type.probability;
        if (r <= cumulative) {
            selectedType = type;
            break;
        }
    }

    const f = {
        id: nextFlowerId++, // Assign a unique ID
        x: Math.random() * (config.canvasWidth - 100) + 50,
        y: Math.random() * (config.canvasHeight - 100) + 50,
        points: selectedType.points,
        element: document.createElement('div')
    };
    f.element.className = `flower ${selectedType.class}`;
    f.element.style.left = f.x + 'px';
    f.element.style.top = f.y + 'px';
    world.appendChild(f.element);
    flowers.push(f);
}

function setupControls() {
    window.addEventListener('keydown', e => gameKeys[e.key.toLowerCase()] = true);
    window.addEventListener('keyup', e => gameKeys[e.key.toLowerCase()] = false);

    // Mouse Dragging for Spectator Mode
    const container = document.getElementById('game-container');
    container.addEventListener('mousedown', e => {
        if (localPlayer && localPlayer.eliminated) {
            isDragging = true;
            lastMousePos = { x: e.clientX, y: e.clientY };
        }
    });

    window.addEventListener('mousemove', e => {
        if (isDragging && localPlayer && localPlayer.eliminated) {
            const dx = e.clientX - lastMousePos.x;
            const dy = e.clientY - lastMousePos.y;
            spectatorOffset.x += dx;
            spectatorOffset.y += dy;
            lastMousePos = { x: e.clientX, y: e.clientY };
        }
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // Joystick Touch Logic
    const joystickContainer = document.getElementById('joystick-container');
    const stick = document.getElementById('joystick-stick');
    if (joystickContainer) {
        joystickContainer.style.display = ('ontouchstart' in window) ? 'block' : 'none';

        const handleMove = (e) => {
            if (!joystickState.active) return;
            const touch = e.touches[0];
            const rect = joystickContainer.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            let dx = touch.clientX - centerX;
            let dy = touch.clientY - centerY;
            const maxRadius = rect.width / 2;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > maxRadius) {
                dx *= maxRadius / distance;
                dy *= maxRadius / distance;
            }

            joystickState.x = dx / maxRadius;
            joystickState.y = dy / maxRadius;
            stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        };

        joystickContainer.addEventListener('touchstart', (e) => {
            joystickState.active = true;
            handleMove(e);
        });

        joystickContainer.addEventListener('touchmove', (e) => {
            e.preventDefault();
            handleMove(e);
        });

        joystickContainer.addEventListener('touchend', () => {
            joystickState.active = false;
            joystickState.x = 0;
            joystickState.y = 0;
            stick.style.transform = `translate(-50%, -50%)`;
        });
    }
}

function gameLoop() {
    if (gameActive && currentPhase === 'round') {
        updateMovement();
        updateAI();
        checkFlowerCollisions();
        updateCamera();
        updateMiniLeaderboard();
        render();
    }
    requestAnimationFrame(gameLoop);
}

function updateMovement() {
    if (localPlayer.eliminated) return;
    let speed = gameKeys['shift'] ? config.sprintSpeed : config.playerSpeed;
    let dx = 0, dy = 0;

    // Keyboard controls
    if (gameKeys['w'] || gameKeys['arrowup']) dy -= speed;
    if (gameKeys['s'] || gameKeys['arrowdown']) dy += speed;
    if (gameKeys['a'] || gameKeys['arrowleft']) { dx -= speed; localPlayer.facing = -1; }
    if (gameKeys['d'] || gameKeys['arrowright']) { dx += speed; localPlayer.facing = 1; }

    // Joystick controls (combines with keys)
    if (joystickState.active) {
        dx += joystickState.x * speed;
        dy += joystickState.y * speed;
        if (joystickState.x < -0.2) localPlayer.facing = -1;
        if (joystickState.x > 0.2) localPlayer.facing = 1;
    }

    localPlayer.x += dx; localPlayer.y += dy;
    localPlayer.isMoving = (dx !== 0 || dy !== 0 || Math.abs(joystickState.x) > 0.1 || Math.abs(joystickState.y) > 0.1);
    localPlayer.x = Math.max(0, Math.min(config.canvasWidth - 64, localPlayer.x));
    localPlayer.y = Math.max(0, Math.min(config.canvasHeight - 64, localPlayer.y));
}

function updateAI() {
    players.forEach(p => {
        if (!p.isAI || p.eliminated) return;
        const targetFlower = flowers[0];
        let moved = false;
        if (targetFlower && Math.random() < 0.05) {
            const dirX = targetFlower.x - p.x;
            if (Math.abs(dirX) > 5) {
                p.x += (dirX > 0 ? 1 : -1) * config.playerSpeed;
                p.facing = dirX > 0 ? 1 : -1;
                moved = true;
            }
            if (Math.abs(p.y - targetFlower.y) > 5) { p.y += (p.y < targetFlower.y ? 1 : -1) * config.playerSpeed; moved = true; }
        } else {
            if (!p.vx || Math.random() < 0.02) {
                const angle = Math.random() * Math.PI * 2;
                p.vx = Math.cos(angle) * config.playerSpeed;
                p.vy = Math.sin(angle) * config.playerSpeed;
                p.facing = p.vx > 0 ? 1 : -1;
            }
            p.x += p.vx; p.y += p.vy; moved = true;
        }
        p.isMoving = moved;
        p.x = Math.max(0, Math.min(config.canvasWidth - 64, p.x));
        p.y = Math.max(0, Math.min(config.canvasHeight - 64, p.y));
    });
}

function checkFlowerCollisions() {
    if (localPlayer.eliminated) return;

    for (let i = flowers.length - 1; i >= 0; i--) {
        const f = flowers[i];
        const dx = (localPlayer.x + 32) - (f.x + 24);
        const dy = (localPlayer.y + 32) - (f.y + 24);
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 45) {
            localPlayer.score += f.points;
            f.element.remove();
            flowers.splice(i, 1);
            spawnFlower();
            AudioController.playCollect();
            updateMiniLeaderboard();
            break;
        }
    }

    // AI Collisions
    players.forEach(p => {
        if (!p.isAI || p.eliminated) return;
        for (let i = flowers.length - 1; i >= 0; i--) {
            const f = flowers[i];
            const dx = (p.x + 32) - (f.x + 24);
            const dy = (p.y + 32) - (f.y + 24);
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < 45) {
                p.score += f.points;
                f.element.remove();
                flowers.splice(i, 1);
                spawnFlower();
                updateMiniLeaderboard();
                break;
            }
        }
    });
}

function updateMiniLeaderboard() {
    const list = document.getElementById('mini-ranking');
    const sorted = [...players].sort((a, b) => b.score - a.score);
    list.innerHTML = sorted.map(p => `
        <div class="mini-rank-item ${p.id === 0 ? 'local-player' : ''}" style="${p.eliminated ? 'opacity: 0.3' : ''}">
            <div class="player-dot" style="background-image: url('/assets/sprites/${p.sprite}'); filter: ${p.filter}"></div>
            <div class="info">
                <div class="name">${p.name}</div>
                <div class="count">${p.score} FLOWERS</div>
            </div>
        </div>
    `).join('');
}

function updateCamera() {
    const world = document.getElementById('game-world');
    if (localPlayer.eliminated) {
        const zoom = currentZoom;
        const camX = (window.innerWidth / 2) - (localPlayer.x + 32) * zoom + spectatorOffset.x;
        const camY = (window.innerHeight / 2) - (localPlayer.y + 32) * zoom + spectatorOffset.y;
        world.style.transform = `translate(${camX}px, ${camY}px) scale(${zoom})`;
    } else {
        const zoom = 1.5;
        const camX = (window.innerWidth / 2) - (localPlayer.x + 32) * zoom;
        const camY = (window.innerHeight / 2) - (localPlayer.y + 32) * zoom;
        world.style.transform = `translate(${camX}px, ${camY}px) scale(${zoom})`;
    }
}

function render() {
    players.forEach(p => {
        if (p.eliminated) p.element.style.display = 'none';
        else {
            p.element.style.left = p.x + 'px';
            p.element.style.top = p.y + 'px';
            p.spriteElement.style.transform = `scaleX(${p.facing})`;
            p.element.classList.toggle('walking', p.isMoving);
        }
    });
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (!gameActive) return;
        gameTime = Math.max(0, gameTime - 1);
        const timerValEl = document.getElementById('time-val');
        if (timerValEl) timerValEl.innerText = gameTime;

        if (currentPhase === 'vote') {
            const vt = document.getElementById('voting-timer');
            if (vt) vt.innerText = `TIME REMAINING: ${gameTime}s`;
        }

        if (gameTime <= 0) {
            if (currentPhase === 'round') {
                currentPhase = 'vote';
                gameTime = config.votePhaseTime;
                startVoting();
            } else if (currentPhase === 'vote') {
                if (!userHasVoted) {
                    userHasVoted = true;
                    processVotingResults(-1);
                }
            }
        }
    }, 1000);
}

function startVoting() {
    userHasVoted = false;
    votingResults = {};
    const screen = document.getElementById('voting-screen');
    const grid = document.getElementById('voting-grid');
    grid.innerHTML = '';
    screen.style.display = 'flex';

    players.forEach(p => {
        const card = document.createElement('div');
        card.className = 'vote-card';
        if (p.eliminated) card.classList.add('eliminated-player');
        if (p.id === 0) card.classList.add('self');
        card.setAttribute('data-id', p.id);

        card.innerHTML = `
            <div class="vote-count" id="vcount-${p.id}">0</div>
            <div style="width: 60px; height: 60px; background-image: url('/assets/sprites/${p.sprite}'); filter: ${p.filter}; background-size: contain; background-repeat: no-repeat; margin: 0 auto; display: block;"></div>
            <div style="margin-top: 15px; font-size: 10px; font-weight: bold; text-transform: uppercase;">${p.name}</div>
            <div class="score-info">COLLECTED: ${p.score}</div>
            ${p.eliminated ? '<div class="eliminated-stamp">ELIMINATED</div>' : ''}
        `;

        if (localPlayer.eliminated) {
            card.onclick = () => showSpectatorToast();
        } else if (!p.eliminated && p.id !== 0) {
            card.onclick = () => confirmVote(p.id);
        }
        grid.appendChild(card);
    });

    const skipBtn = document.getElementById('skip-vote-btn');
    if (localPlayer.eliminated) skipBtn.style.display = 'none';
    else skipBtn.style.display = 'inline-block';
}

function confirmVote(targetId) {
    if (userHasVoted) return;
    const modal = document.getElementById('vote-confirm-modal');
    const confirmText = document.getElementById('confirm-text');
    if (targetId === -1) confirmText.innerText = "SKIP VOTING?";
    else {
        const target = players.find(p => p.id === targetId);
        confirmText.innerText = `VOTE FOR ${target.name}?`;
    }
    modal.style.display = 'flex';
    document.getElementById('confirm-yes').onclick = () => {
        AudioController.playClick();
        modal.style.display = 'none';
        userHasVoted = true;
        processVotingResults(targetId);
    };
}

function processVotingResults(userTarget) {
    userHasVoted = true;
    gameTime = 0;
    let votes = { '-1': 0 };
    players.forEach(p => { if (!p.eliminated) votes[p.id] = 0; });

    players.forEach(p => {
        if (p.eliminated) return;
        let target;
        if (p.id === 0) target = userTarget;
        else {
            if (Math.random() < 0.2) target = -1;
            else {
                const choices = players.filter(x => !x.eliminated && x.id !== p.id);
                target = choices[Math.floor(Math.random() * choices.length)].id;
            }
        }
        if (target !== undefined) votes[target] = (votes[target] || 0) + 1;
    });

    for (let id in votes) {
        const countEl = document.getElementById(`vcount-${id}`);
        if (countEl) { countEl.innerText = votes[id]; countEl.style.display = 'block'; }
    }

    setTimeout(() => { finishElimination(votes); }, 3000);
}

function finishElimination(votes) {
    const activePlayers = players.filter(p => !p.eliminated);
    const voteValues = activePlayers.map(p => votes[p.id] || 0);
    const allSameVotes = voteValues.every(v => v === voteValues[0]);

    if (allSameVotes) {
        if (voteValues[0] === 0) {
            // ALL ZERO: Compare all flowers and eliminate the lowest
            const victim = activePlayers.reduce((prev, curr) => (curr.score < prev.score ? curr : prev));
            const victimCard = document.querySelector(`.vote-card[data-id="${victim.id}"]`);
            if (victimCard) victimCard.classList.add('victim-highlight');
            setTimeout(() => { showEliminationAnimation(victim); }, 2000);
        } else {
            // ALL SAME (NON-ZERO): No one eliminated (Tie)
            showTieScreen();
        }
    } else {
        // HIGH VOTES ARE SAFE: Target those with the LOWEST votes
        const minVotes = Math.min(...voteValues);
        const lowCandidates = activePlayers.filter(p => (votes[p.id] || 0) === minVotes);

        let victim = lowCandidates[0];
        if (lowCandidates.length > 1) {
            // Tie-breaker among those with lowest votes: Lowest flower collection
            victim = lowCandidates.reduce((prev, curr) => (curr.score < prev.score ? curr : prev));
        }

        const victimCard = document.querySelector(`.vote-card[data-id="${victim.id}"]`);
        if (victimCard) victimCard.classList.add('victim-highlight');

        setTimeout(() => {
            showEliminationAnimation(victim);
        }, 2000);
    }
}

function showTieScreen() {
    const tieCard = document.getElementById('tie-card');
    tieCard.style.display = 'flex';
    setTimeout(() => { tieCard.style.display = 'none'; closeVoting(); }, 3000);
}

function showEliminationAnimation(victim) {
    const card = document.getElementById('elimination-card');
    const nameEl = document.getElementById('elim-name');
    const spriteEl = document.getElementById('elim-sprite');
    nameEl.innerText = victim.name;
    spriteEl.style.backgroundImage = `url('/assets/sprites/${victim.sprite}')`;
    spriteEl.style.filter = victim.filter;
    AudioController.playElim();
    card.style.display = 'flex';
    setTimeout(() => { victim.eliminated = true; card.style.display = 'none'; closeVoting(); }, 4000);
}

function closeVoting() {
    document.getElementById('voting-screen').style.display = 'none';
    currentPhase = 'round';
    gameTime = config.roundTime;
    const active = players.filter(p => !p.eliminated);
    if (active.length <= 1) showWinnerSequence(active[0]);
}

function showWinnerSequence(winner) {
    gameActive = false;
    clearInterval(timerInterval);
    document.getElementById('ui-layer').style.display = 'none';
    const screen = document.getElementById('winner-screen');
    const sprite = document.getElementById('winner-sprite');
    const name = document.getElementById('winner-name');
    name.innerText = winner.name;
    sprite.style.backgroundImage = `url('/assets/sprites/${winner.sprite}')`;
    sprite.style.filter = winner.filter;
    screen.style.display = 'flex';
    AudioController.playWinner();
    createConfetti();
    setTimeout(() => { screen.style.display = 'none'; showLeaderboard(); }, 3500);
}

function createConfetti() {
    const container = document.querySelector('.confetti-container');
    for (let i = 0; i < 100; i++) {
        const c = document.createElement('div');
        c.style.position = 'absolute'; c.style.width = '10px'; c.style.height = '10px';
        c.style.background = `hsl(${Math.random() * 360}, 100%, 50%)`;
        c.style.left = Math.random() * 100 + '%'; c.style.top = '-10%';
        c.style.opacity = Math.random(); c.style.animation = `confettiFall ${2 + Math.random() * 3}s linear infinite`;
        c.style.animationDelay = Math.random() * 2 + 's';
        container.appendChild(c);
    }
}

function showLeaderboard() {
    const screen = document.getElementById('leaderboard');
    const list = document.getElementById('ranking-list');
    const sorted = [...players].sort((a, b) => b.score - a.score);
    list.innerHTML = sorted.map((p, idx) => `
        <div class="rank-item">
            <div class="rank-num">#${idx + 1}</div>
            <div class="player-dot" style="width: 50px; height: 50px; background-image: url('/assets/sprites/${p.sprite}'); filter: ${p.filter}; background-size: contain; background-repeat: no-repeat; margin: 0 20px;"></div>
            <div class="rank-info"><h4>${p.name}</h4><p>${p.score} FLOWERS COLLECTED</p></div>
        </div>
    `).join('');
    screen.style.display = 'flex';
}

function showSpectatorToast() {
    const toast = document.getElementById('spectator-toast');
    if (toast) { toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2000); }
}

initGame();
