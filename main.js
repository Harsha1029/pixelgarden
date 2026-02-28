// Main JS - Landing Page Logic
const AudioController = {
    clickSound: new Audio('/assets/sounds/buttons.mp3'),
    soundEnabled: true,
    playClick() { if (this.soundEnabled) { this.clickSound.currentTime = 0; this.clickSound.play(); } }
};

function initLandingPage() {
    // Basic Navigation Handlers
    const navPlayBtn = document.getElementById('nav-play-btn');
    const navChatBtn = document.getElementById('nav-chat-btn');
    const startBtn = document.getElementById('start-btn');
    const authScreen = document.getElementById('auth-screen');
    const authCloseBtn = document.getElementById('auth-close-btn');

    if (navPlayBtn) {
        navPlayBtn.onclick = () => {
            AudioController.playClick();
            window.location.href = 'game.html';
        };
    }

    if (navChatBtn) {
        navChatBtn.onclick = () => {
            AudioController.playClick();
            window.location.href = 'chat.html';
        };
    }

    if (startBtn) {
        startBtn.onclick = () => {
            AudioController.playClick();
            window.location.href = 'game.html';
        };
    }

    if (authCloseBtn) {
        authCloseBtn.onclick = () => {
            AudioController.playClick();
            authScreen.style.display = 'none';
        };
    }

    // Scroll Animations (Fade-Up Effect)
    const observerOptions = { threshold: 0.1 };
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);

    document.querySelectorAll('.feature-box, .char-card, .faq-item, .review-card').forEach(el => {
        el.classList.add('fade-up');
        observer.observe(el);
    });

    // Handle Auth Toggle (Signin/Signup)
    const toggleSignin = document.getElementById('toggle-signin');
    const toggleSignup = document.getElementById('toggle-signup');
    if (toggleSignin && toggleSignup) {
        toggleSignin.onclick = () => {
            AudioController.playClick();
            toggleSignin.classList.add('active');
            toggleSignup.classList.remove('active');
        };
        toggleSignup.onclick = () => {
            AudioController.playClick();
            toggleSignup.classList.add('active');
            toggleSignin.classList.remove('active');
        };
    }

    // Fake Auth
    const handleFakeAuth = () => {
        AudioController.playClick();
        alert("MASTER REGISTERED SUCCESSFULLY!");
        authScreen.style.display = 'none';
    };

    if (document.getElementById('fake-signin-btn')) {
        document.getElementById('fake-signin-btn').onclick = handleFakeAuth;
    }

    // FAQ Accordion Toggle
    document.querySelectorAll('.faq-item').forEach(item => {
        item.onclick = () => {
            AudioController.playClick();
            const isActive = item.classList.contains('active');

            // Optional: Close other items
            document.querySelectorAll('.faq-item').forEach(other => other.classList.remove('active'));

            if (!isActive) {
                item.classList.add('active');
            }
        };
    });
}

window.onload = initLandingPage;
