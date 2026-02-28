// Collaborative Drawing Logic
const urlParams = new URLSearchParams(window.location.search);
const targetPeerId = urlParams.get('peer');
const myId = urlParams.get('myid');

let peer = null;
let conn = null;

const localCanvas = document.getElementById('local-canvas');
const remoteCanvas = document.getElementById('remote-canvas');
const ctxLocal = localCanvas.getContext('2d');
const ctxRemote = remoteCanvas.getContext('2d');
const localColor = document.getElementById('local-color');
const clearLocalBtn = document.getElementById('clear-local');
const statusBadge = document.getElementById('connection-status');

let isDrawing = false;

// Set canvas sizes
function resizeCanvases() {
    [localCanvas, remoteCanvas].forEach(canvas => {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    });
}

window.addEventListener('load', resizeCanvases);
window.addEventListener('resize', resizeCanvases);

// --- PEER JS SETUP ---
function initCollab() {
    if (!myId || !targetPeerId) {
        alert("Board Error: IDs missing. Please start from chat.");
        location.href = 'chat.html';
        return;
    }

    // Try to reuse the same ID from chat screen
    peer = new Peer(myId + '-board'); // Suffix to avoid conflict with chat peer

    peer.on('open', (id) => {
        console.log("Draw Peer Open:", id);
        // Connect to target
        const connection = peer.connect(targetPeerId + '-board');
        setupConnect(connection);
    });

    peer.on('connection', (connection) => {
        setupConnect(connection);
    });
}

function setupConnect(connection) {
    conn = connection;
    conn.on('open', () => {
        statusBadge.innerText = "ONLINE";
        statusBadge.classList.add('online');
        console.log("Draw Connected!");
    });

    conn.on('data', (data) => {
        if (data.type === 'draw') {
            drawOnCanvas(ctxRemote, data.x, data.y, data.color, false);
        } else if (data.type === 'clear') {
            ctxRemote.clearRect(0, 0, remoteCanvas.width, remoteCanvas.height);
        } else if (data.type === 'start') {
            ctxRemote.beginPath();
            ctxRemote.moveTo(data.x, data.y);
        } else if (data.type === 'back-to-chat') {
            window.location.href = 'chat.html';
        }
    });

    conn.on('close', () => {
        statusBadge.innerText = "OFFLINE";
        statusBadge.classList.remove('online');
    });
}

// --- DRAWING LOGIC ---
function getMousePos(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

function startDrawing(e) {
    isDrawing = true;
    const pos = getMousePos(localCanvas, e);
    ctxLocal.beginPath();
    ctxLocal.moveTo(pos.x, pos.y);

    if (conn && conn.open) {
        conn.send({ type: 'start', x: pos.x, y: pos.y });
    }
}

function draw(e) {
    if (!isDrawing) return;
    const pos = getMousePos(localCanvas, e);
    const color = localColor.value;

    drawOnCanvas(ctxLocal, pos.x, pos.y, color, true);
}

function stopDrawing() {
    isDrawing = false;
}

function drawOnCanvas(ctx, x, y, color, isLocal) {
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;

    ctx.lineTo(x, y);
    ctx.stroke();

    if (isLocal && conn && conn.open) {
        conn.send({ type: 'draw', x, y, color });
    }
}

localCanvas.addEventListener('mousedown', startDrawing);
localCanvas.addEventListener('mousemove', draw);
window.addEventListener('mouseup', stopDrawing);

clearLocalBtn.onclick = () => {
    ctxLocal.clearRect(0, 0, localCanvas.width, localCanvas.height);
    if (conn && conn.open) {
        conn.send({ type: 'clear' });
    }
};

document.getElementById('back-btn').onclick = () => {
    if (conn && conn.open) {
        conn.send({ type: 'back-to-chat' });
    }
    window.location.href = 'chat.html';
};

initCollab();
