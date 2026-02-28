// PeerJS P2P Chat Logic with Media Support
const quotes = [
    "A BOUQUET IS BETTER SHARED WITH FRIENDS.",
    "GARDENS GROW TOGETHER, JUST LIKE MASTERS.",
    "BATTLE IS TEMPORARY, FRIENDSHIP IS PERPETUAL.",
    "EVERY FLOWER HAS A STORY. WHAT'S YOURS?",
    "REAL MASTERS MAKE FRIENDS, NOT JUST RIVALRY.",
    "PIXEL HEARTS BEAT STRONGER TOGETHER."
];

let quoteIdx = 0;
let charIdx = 0;
let isDeleting = false;
let typeSpeed = 100;

function runTypewriter() {
    const textEl = document.getElementById('typewriter-text');
    const currentQuote = quotes[quoteIdx];

    if (isDeleting) {
        textEl.innerText = currentQuote.substring(0, charIdx - 1);
        charIdx--;
        typeSpeed = 50;
    } else {
        textEl.innerText = currentQuote.substring(0, charIdx + 1);
        charIdx++;
        typeSpeed = 100;
    }

    if (!isDeleting && charIdx === currentQuote.length) {
        isDeleting = true;
        typeSpeed = 2000;
    } else if (isDeleting && charIdx === 0) {
        isDeleting = false;
        quoteIdx = (quoteIdx + 1) % quotes.length;
        typeSpeed = 500;
    }

    setTimeout(runTypewriter, typeSpeed);
}

// UI Themes
const themeBtn = document.getElementById('theme-toggle');
themeBtn.onclick = () => {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    themeBtn.innerText = isDark ? "☀️ LIGHT" : "🌙 DARK";
    themeBtn.classList.toggle('yellow', !isDark);
};

// PeerJS Logic
let peer = null;
let conn = null;
let replyingTo = null;
let localStream = null;
let currentCall = null;
let isMuted = false;
let isCamOff = false;
let currentCallType = null;

function initPeer() {
    const masterId = 'MASTER-' + Math.floor(Math.random() * 10000);
    peer = new Peer(masterId);

    peer.on('open', (id) => {
        document.getElementById('my-peer-id').innerText = id;
        addMessage("SYSTEM", "YOUR GARDEN MASTER ID IS READY.");
    });

    peer.on('connection', (connection) => {
        setupConnection(connection);
    });

    peer.on('call', (call) => {
        handleIncomingCall(call);
    });

    peer.on('error', (err) => {
        console.error("Peer Error:", err);
        addMessage("SYSTEM", "ERROR: " + err.type.toUpperCase());
    });
}

function setupConnection(connection) {
    if (conn) conn.close();
    conn = connection;

    conn.on('open', () => {
        updateStatus(true);
        addMessage("SYSTEM", "CONNECTED TO ANOTHER MASTER!");
        enableInput(true);
    });

    conn.on('data', (data) => {
        if (typeof data === 'string') {
            addMessage("FRIEND", data);
        } else if (data.type === 'message') {
            addMessage("FRIEND", data.text, data.replyTo, data.msgId);
        } else if (data.type === 'media') {
            addMediaMessage("FRIEND", data.fileType, data.blob, data.replyTo, data.msgId);
        } else if (data.type === 'sticker') {
            addStickerMessage("FRIEND", data.sticker, data.replyTo, data.msgId);
        } else if (data.type === 'delete') {
            removeMessageById(data.msgId);
        } else if (data.type === 'call-request') {
            currentCallType = data.callType;
            showCallOverlay('incoming', data.callType);
        } else if (data.type === 'call-decline') {
            addMessage("SYSTEM", "CALL DECLINED BY FRIEND.");
            hideCallOverlay();
        } else if (data.type === 'call-end') {
            stopCall();
        } else if (data.type === 'navigate-draw') {
            toggleScreen('draw');
        } else if (data.type === 'back-to-chat') {
            toggleScreen('chat');
        } else if (data.type === 'draw-data') {
            drawOnCanvas(ctxRemote, data.x, data.y, data.color, false);
        } else if (data.type === 'draw-clear') {
            ctxRemote.clearRect(0, 0, remoteCanvas.width, remoteCanvas.height);
        } else if (data.type === 'draw-start') {
            ctxRemote.beginPath();
            ctxRemote.moveTo(data.x, data.y);
        }
    });

    conn.on('close', () => {
        updateStatus(false);
        addMessage("SYSTEM", "MASTER DISCONNECTED.");
        enableInput(false);
    });
}

const connectBtn = document.getElementById('connect-btn');
const targetInput = document.getElementById('target-peer-id');

connectBtn.onclick = () => {
    const targetId = targetInput.value.trim();
    if (!targetId) return;

    addMessage("SYSTEM", "WAITING FOR MASTER...");
    const connection = peer.connect(targetId);
    setupConnection(connection);
};

// Messaging
const sendBtn = document.getElementById('send-btn');
const messageInput = document.getElementById('message-input');

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !conn || !conn.open) return;

    const msgId = 'MSG-' + Date.now();
    const payload = {
        type: 'message',
        text: text,
        replyTo: replyingTo,
        msgId: msgId
    };

    conn.send(payload);
    addMessage("YOU", text, replyingTo, msgId);
    messageInput.value = "";
    cancelReply();
}

sendBtn.onclick = sendMessage;
messageInput.onkeydown = (e) => { if (e.key === 'Enter') sendMessage(); };

// Media Handling
const attachBtn = document.getElementById('attach-btn');
const fileInput = document.getElementById('file-input');

attachBtn.onclick = () => fileInput.click();

fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file || !conn || !conn.open) return;

    // Read file as ArrayBuffer for P2P transfer
    const reader = new FileReader();
    reader.onload = () => {
        const msgId = 'MEDIA-' + Date.now();
        const payload = {
            type: 'media',
            fileType: file.type,
            blob: reader.result,
            replyTo: replyingTo,
            msgId: msgId
        };
        conn.send(payload);
        addMediaMessage("YOU", file.type, reader.result, replyingTo, msgId);
        cancelReply();
    };
    reader.readAsArrayBuffer(file);
    fileInput.value = ""; // Reset
};

// Sticker Handling
const stickerBtn = document.getElementById('sticker-btn');
const stickerPicker = document.getElementById('sticker-picker');

stickerBtn.onclick = (e) => {
    e.stopPropagation();
    stickerPicker.style.display = stickerPicker.style.display === 'none' ? 'block' : 'none';
};

document.querySelectorAll('.sticker-item').forEach(item => {
    item.onclick = () => {
        const stickerName = item.dataset.sticker;
        if (!conn || !conn.open) return;

        const msgId = 'STICKER-' + Date.now();
        conn.send({
            type: 'sticker',
            sticker: stickerName,
            replyTo: replyingTo,
            msgId: msgId
        });
        addStickerMessage("YOU", stickerName, replyingTo, msgId);
        cancelReply();
        stickerPicker.style.display = 'none';
    };
});

window.onclick = () => {
    stickerPicker.style.display = 'none';
};

// UI Rendering
function addMessage(sender, text, replyData = null, id = null) {
    const list = document.getElementById('messages-list');
    const div = document.createElement('div');
    const isSent = sender === 'YOU';
    div.className = isSent ? 'msg sent' : (sender === 'SYSTEM' ? 'system-msg' : 'msg received');

    // Assign ID for remote deletion
    if (id) div.setAttribute('data-msg-id', id);

    let replyHtml = '';
    if (replyData) {
        replyHtml = `<div class="quoted-msg">
            <div style="font-size:6px; opacity:0.8; margin-bottom:3px;">Replying to ${replyData.sender}</div>
            <div style="font-size:7px;">${replyData.text.substring(0, 30)}${replyData.text.length > 30 ? '...' : ''}</div>
        </div>`;
    }

    if (sender !== 'SYSTEM') {
        const actionsHtml = isSent ?
            `<div class="msg-actions">
                <button class="action-btn" onclick="toggleMsgMenu(event, this)">⋮</button>
                <div class="msg-menu">
                    <button class="menu-item" onclick="deleteMsg(this)">DELETE</button>
                </div>
            </div>` :
            `<div class="msg-actions">
                <button class="action-btn" onclick="initiateReply('${sender}', '${text.replace(/'/g, "\\'")}')">↪</button>
            </div>`;

        div.innerHTML = `
            ${actionsHtml}
            ${replyHtml}
            <div>${text}</div>
            <div style="font-size:6px; margin-top:5px; opacity:0.7;">${sender}</div>
        `;
    } else {
        div.innerText = text;
    }

    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
}

function addMediaMessage(sender, fileType, buffer, replyData = null, id = null) {
    const list = document.getElementById('messages-list');
    const div = document.createElement('div');
    const isSent = sender === 'YOU';
    div.className = isSent ? 'msg sent' : 'msg received';

    if (id) div.setAttribute('data-msg-id', id);

    const blob = new Blob([buffer], { type: fileType });
    const url = URL.createObjectURL(blob);

    let mediaEl;
    if (fileType.startsWith('image/')) {
        mediaEl = `<img src="${url}" class="msg-media">`;
    } else if (fileType.startsWith('video/')) {
        mediaEl = `<video src="${url}" class="msg-media" controls></video>`;
    }

    let replyHtml = '';
    if (replyData) {
        replyHtml = `<div class="quoted-msg">
            <div style="font-size:6px; opacity:0.8; margin-bottom:3px;">Replying to ${replyData.sender}</div>
            <div style="font-size:7px;">${replyData.text.substring(0, 30)}${replyData.text.length > 30 ? '...' : ''}</div>
        </div>`;
    }

    const actionsHtml = isSent ?
        `<div class="msg-actions">
            <button class="action-btn" onclick="toggleMsgMenu(event, this)">⋮</button>
            <div class="msg-menu">
                <button class="menu-item" onclick="deleteMsg(this)">DELETE</button>
            </div>
        </div>` :
        `<div class="msg-actions">
            <button class="action-btn" onclick="initiateReply('${sender}', '${fileType.toUpperCase()}')">↪</button>
        </div>`;

    div.innerHTML = `
        ${actionsHtml}
        ${replyHtml}
        ${mediaEl}
        <div style="font-size:6px; margin-top:5px; opacity:0.7;">${sender} - ${fileType.toUpperCase()}</div>
    `;

    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
}

function addStickerMessage(sender, sticker, replyData = null, id = null) {
    const list = document.getElementById('messages-list');
    const div = document.createElement('div');
    const isSent = sender === 'YOU';
    div.className = isSent ? 'msg sent' : 'msg received';

    if (id) div.setAttribute('data-msg-id', id);

    let replyHtml = '';
    if (replyData) {
        replyHtml = `<div class="quoted-msg">
            <div style="font-size:6px; opacity:0.8; margin-bottom:3px;">Replying to ${replyData.sender}</div>
            <div style="font-size:7px;">${replyData.text.substring(0, 30)}${replyData.text.length > 30 ? '...' : ''}</div>
        </div>`;
    }

    const actionsHtml = isSent ?
        `<div class="msg-actions">
            <button class="action-btn" onclick="toggleMsgMenu(event, this)">⋮</button>
            <div class="msg-menu">
                <button class="menu-item" onclick="deleteMsg(this)">DELETE</button>
            </div>
        </div>` :
        `<div class="msg-actions">
            <button class="action-btn" onclick="initiateReply('${sender}', 'STICKER')">↪</button>
        </div>`;

    div.innerHTML = `
        ${actionsHtml}
        ${replyHtml}
        <img src="/assets/sprites/${sticker}" class="sticker-img">
        <div style="font-size:6px; margin-top:5px; opacity:0.7;">${sender} - STICKER</div>
    `;

    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
}

// Action Logic
function toggleMsgMenu(event, btn) {
    event.stopPropagation();
    const menu = btn.nextElementSibling;
    const allMenus = document.querySelectorAll('.msg-menu');
    allMenus.forEach(m => { if (m !== menu) m.classList.remove('active'); });
    menu.classList.toggle('active');
}

function deleteMsg(item) {
    const msgDiv = item.closest('.msg');
    const msgId = msgDiv.getAttribute('data-msg-id');

    // Local Animation
    msgDiv.style.opacity = '0';
    msgDiv.style.transform = 'scale(0.8)';
    setTimeout(() => msgDiv.remove(), 300);

    // Sync deletion to Master Peer
    if (conn && conn.open && msgId) {
        conn.send({ type: 'delete', msgId: msgId });
    }
}

function removeMessageById(msgId) {
    const msgDiv = document.querySelector(`[data-msg-id="${msgId}"]`);
    if (msgDiv) {
        msgDiv.style.opacity = '0';
        msgDiv.style.transform = 'scale(0.8)';
        setTimeout(() => msgDiv.remove(), 300);
    }
}

function initiateReply(sender, text) {
    replyingTo = { sender, text };
    const preview = document.getElementById('reply-preview');
    preview.style.display = 'block';
    preview.querySelector('.reply-content').innerText = `Replying to ${sender}: "${text.substring(0, 20)}..."`;
    messageInput.focus();
}

function cancelReply() {
    replyingTo = null;
    document.getElementById('reply-preview').style.display = 'none';
}

document.getElementById('cancel-reply').onclick = cancelReply;

window.addEventListener('click', () => {
    document.querySelectorAll('.msg-menu').forEach(m => m.classList.remove('active'));
});

function updateStatus(online) {
    const badge = document.getElementById('status-badge');
    badge.innerText = online ? "ONLINE" : "OFFLINE";
    badge.className = online ? "status-online" : "status-offline";
}

function enableInput(enabled) {
    messageInput.disabled = !enabled;
    sendBtn.disabled = !enabled;
    attachBtn.disabled = !enabled;
    stickerBtn.disabled = !enabled;
    document.getElementById('voice-call-btn').disabled = !enabled;
    document.getElementById('video-call-btn').disabled = !enabled;
}

function toggleScreen(screen) {
    const chatScr = document.getElementById('main-chat-screen');
    const drawScr = document.getElementById('draw-screen');

    if (screen === 'draw') {
        chatScr.style.display = 'none';
        drawScr.style.display = 'flex';
        resizeCanvases();
    } else {
        chatScr.style.display = 'block';
        drawScr.style.display = 'none';
    }
}

document.getElementById('pencil-btn').onclick = () => {
    if (conn && conn.open) {
        conn.send({ type: 'navigate-draw' });
        toggleScreen('draw');
    } else {
        addMessage("SYSTEM", "⚠️ COLLABORATIVE DRAWING REQUIRES A CONNECTED FRIEND! PLEASE ENTER A MASTER ID AND CONNECT FIRST.");
    }
};

document.getElementById('draw-back-btn').onclick = () => {
    if (conn && conn.open) {
        conn.send({ type: 'back-to-chat' });
    }
    toggleScreen('chat');
};

// --- CALLING LOGIC ---
const callOverlay = document.getElementById('call-overlay');
const callStatus = document.getElementById('call-status');
const incomingActions = document.getElementById('incoming-actions');
const activeActions = document.getElementById('active-actions');
const videoContainer = document.getElementById('video-container');
const remoteVideo = document.getElementById('remote-video');
const localVideo = document.getElementById('local-video');

async function startCall(type) {
    try {
        currentCallType = type;
        const constraints = { audio: true, video: type === 'video' };
        localStream = await navigator.mediaDevices.getUserMedia(constraints);

        if (type === 'video') {
            videoContainer.style.display = 'block';
            localVideo.srcObject = localStream;
            localVideo.style.opacity = '1';
        }

        showCallOverlay('outgoing', type);
        conn.send({ type: 'call-request', callType: type });

        console.log(`[CALL] Calling peer ${conn.peer} with ${type} stream...`);
        const call = peer.call(conn.peer, localStream);
        setupCallListeners(call, type);
    } catch (err) {
        console.error("Media Error:", err);
        addMessage("SYSTEM", `CAMERA/MIC ERROR: ${err.message}`);
    }
}

function handleIncomingCall(call) {
    currentCall = call;
    // Ensure we have a call type, default to what caller requested if signal arrived
    const type = currentCallType || 'voice';

    document.getElementById('accept-call-btn').onclick = async () => {
        try {
            console.log(`[CALL] Answering ${type} call...`);
            const constraints = { audio: true, video: type === 'video' };
            localStream = await navigator.mediaDevices.getUserMedia(constraints);

            if (type === 'video') {
                videoContainer.style.display = 'block';
                localVideo.srcObject = localStream;
                localVideo.style.opacity = '1';
                localVideo.play().catch(e => console.error("Local play error:", e));
            }

            call.answer(localStream);
            showCallOverlay('active', type);
            setupCallListeners(call, type);
        } catch (err) {
            console.error("Answer Error:", err);
            addMessage("SYSTEM", "MEDIA ACCESS DENIED BY BROWSER.");
            stopCall();
        }
    };
}

function setupCallListeners(call, type) {
    currentCall = call;
    call.on('stream', (remoteStream) => {
        console.log("[CALL] Receiving remote stream...");
        remoteVideo.srcObject = remoteStream;

        if (remoteStream.getVideoTracks().length > 0) {
            videoContainer.style.display = 'block';
            remoteVideo.play().catch(e => console.error("Remote play error:", e));
        }
        showCallOverlay('active', type);
    });

    call.on('close', stopCall);
    call.on('error', (err) => {
        console.error("Call Error:", err);
        stopCall();
    });
}

function showCallOverlay(state, type) {
    callOverlay.style.display = 'flex';
    incomingActions.style.display = 'none';
    activeActions.style.display = 'none';

    if (state === 'incoming') {
        callStatus.innerText = `INCOMING ${type.toUpperCase()} CALL...`;
        incomingActions.style.display = 'flex';
    } else {
        if (state === 'outgoing') {
            callStatus.innerText = `DIALING ${type.toUpperCase()}...`;
        } else if (state === 'active') {
            callStatus.innerText = `${type.toUpperCase()} CALL ACTIVE`;
        }
        activeActions.style.display = 'flex';
        // Only show camera button for video calls
        document.getElementById('toggle-cam-btn').style.display = (type === 'video') ? 'inline-block' : 'none';
    }
}

function hideCallOverlay() {
    callOverlay.style.display = 'none';
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
}

function stopCall() {
    if (currentCall) currentCall.close();
    if (conn) conn.send({ type: 'call-end' });
    hideCallOverlay();
    videoContainer.style.display = 'none';
    remoteVideo.srcObject = null;
    localVideo.srcObject = null;
}

function toggleMute() {
    isMuted = !isMuted;
    localStream.getAudioTracks()[0].enabled = !isMuted;
    document.getElementById('mute-btn').innerHTML = isMuted ?
        '<i class="fa-solid fa-microphone-slash"></i>' :
        '<i class="fa-solid fa-microphone"></i>';
    document.getElementById('mute-btn').classList.toggle('red', isMuted);
}

function toggleCamera() {
    isCamOff = !isCamOff;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.enabled = !isCamOff;
        document.getElementById('toggle-cam-btn').innerHTML = isCamOff ?
            '<i class="fa-solid fa-video-slash"></i>' :
            '<i class="fa-solid fa-video"></i>';
        document.getElementById('toggle-cam-btn').classList.toggle('red', isCamOff);
        localVideo.style.opacity = isCamOff ? '0.3' : '1';
    }
}

// Event Listeners for Calls
document.getElementById('voice-call-btn').onclick = () => startCall('voice');
document.getElementById('video-call-btn').onclick = () => startCall('video');
document.getElementById('decline-call-btn').onclick = () => {
    conn.send({ type: 'call-decline' });
    hideCallOverlay();
};
document.getElementById('end-call-btn').onclick = stopCall;
document.getElementById('mute-btn').onclick = toggleMute;
document.getElementById('toggle-cam-btn').onclick = toggleCamera;

// --- DRAWING LOGIC ---
const localCanvas = document.getElementById('local-canvas');
const remoteCanvas = document.getElementById('remote-canvas');
const ctxLocal = localCanvas.getContext('2d');
const ctxRemote = remoteCanvas.getContext('2d');
const localColor = document.getElementById('local-color');
const clearLocalBtn = document.getElementById('clear-local');

let isDrawingBoardActive = false;
let isDrawing = false;

function resizeCanvases() {
    localCanvas.width = localCanvas.offsetWidth;
    localCanvas.height = localCanvas.offsetHeight;
    remoteCanvas.width = remoteCanvas.offsetWidth;
    remoteCanvas.height = remoteCanvas.offsetHeight;
}

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
    if (conn && conn.open) conn.send({ type: 'draw-start', x: pos.x, y: pos.y });
}

function draw(e) {
    if (!isDrawing) return;
    const pos = getMousePos(localCanvas, e);
    const color = localColor.value;
    drawOnCanvas(ctxLocal, pos.x, pos.y, color, true);
}

function stopDrawing() { isDrawing = false; }

function drawOnCanvas(ctx, x, y, color, isLocal) {
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    ctx.lineTo(x, y);
    ctx.stroke();
    if (isLocal && conn && conn.open) conn.send({ type: 'draw-data', x, y, color });
}

localCanvas.addEventListener('mousedown', startDrawing);
localCanvas.addEventListener('mousemove', draw);
window.addEventListener('mouseup', stopDrawing);

clearLocalBtn.onclick = () => {
    ctxLocal.clearRect(0, 0, localCanvas.width, localCanvas.height);
    if (conn && conn.open) conn.send({ type: 'draw-clear' });
};

document.getElementById('copy-id-btn').onclick = () => {
    const id = document.getElementById('my-peer-id').innerText;
    navigator.clipboard.writeText(id).then(() => {
        const originalText = document.getElementById('copy-id-btn').innerText;
        document.getElementById('copy-id-btn').innerText = "COPIED!";
        setTimeout(() => {
            document.getElementById('copy-id-btn').innerText = originalText;
        }, 2000);
    });
};

window.onload = () => {
    runTypewriter();
    initPeer();
};
