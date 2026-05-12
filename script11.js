
/* ==========================================
   EFECTOS 3D PREMIUM — NEXA CMMS v3
   tsParticles (partículas profesionales) +
   VanillaTilt (tilt 3D con glare) +
   Ripple effect en botones
   ========================================== */
(function() {
    'use strict';

    // Respetar preferencia de movimiento reducido
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // === 1. tsParticles - PARTÍCULAS INTERACTIVAS PROFESIONALES ===
    function initTsParticles() {
        if (reduceMotion) return;
        if (typeof tsParticles === 'undefined') {
            console.warn('tsParticles no cargó - usando fallback CSS');
            return;
        }

        tsParticles.load("tsparticles-splash", {
            fpsLimit: 60,
            background: { color: { value: "transparent" } },
            particles: {
                number: {
                    value: 60,
                    density: { enable: true, area: 900 }
                },
                color: {
                    value: ["#63aaff", "#a78bfa", "#38bdf8", "#c4b5fd", "#93c5fd"]
                },
                shape: { type: "circle" },
                opacity: {
                    value: { min: 0.2, max: 0.7 },
                    animation: {
                        enable: true,
                        speed: 1,
                        sync: false
                    }
                },
                size: {
                    value: { min: 1, max: 3.5 },
                    animation: {
                        enable: true,
                        speed: 2,
                        sync: false
                    }
                },
                links: {
                    enable: true,
                    distance: 130,
                    color: "#7aa6e8",
                    opacity: 0.25,
                    width: 1
                },
                move: {
                    enable: true,
                    speed: 0.8,
                    direction: "none",
                    random: true,
                    straight: false,
                    outModes: { default: "out" },
                    attract: { enable: false }
                }
            },
            interactivity: {
                events: {
                    onHover: { enable: true, mode: "grab" },
                    onClick: { enable: true, mode: "push" },
                    resize: true
                },
                modes: {
                    grab: { distance: 160, links: { opacity: 0.6 } },
                    push: { quantity: 3 }
                }
            },
            detectRetina: true
        });
    }

    // === 2. VanillaTilt - TILT 3D PROFESIONAL CON GLARE ===
    function initVanillaTilt() {
        if (reduceMotion) return;
        if (typeof VanillaTilt === 'undefined') {
            console.warn('VanillaTilt no cargó');
            return;
        }

        // Inicializar todos los elementos con data-tilt
        VanillaTilt.init(document.querySelectorAll("[data-tilt]"));

        // Aplicar tilt sutil a stat-cards dinámicamente (cuando aparezcan)
        function applyTiltToStatCards() {
            document.querySelectorAll('.stat-card:not([data-tilt-init])').forEach(card => {
                card.setAttribute('data-tilt-init', 'true');
                VanillaTilt.init(card, {
                    max: 6,
                    speed: 600,
                    perspective: 1200,
                    scale: 1.02,
                    glare: true,
                    "max-glare": 0.15
                });
            });
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', applyTiltToStatCards);
        } else {
            applyTiltToStatCards();
        }

        // Observer para cards creadas dinámicamente
        const moCards = new MutationObserver(() => applyTiltToStatCards());
        moCards.observe(document.body, { childList: true, subtree: true });
    }

    // Inicializar tsParticles y VanillaTilt cuando todo esté cargado
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initTsParticles();
            initVanillaTilt();
        });
    } else {
        initTsParticles();
        initVanillaTilt();
    }

    // === 3. RIPPLE EFFECT EN BOTONES (se mantiene de v2) ===
    function createRipple(e) {
        const btn = e.currentTarget;
        if (btn.disabled) return;

        const rect = btn.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = (e.clientX || (e.touches && e.touches[0].clientX) || rect.left + rect.width/2) - rect.left - size / 2;
        const y = (e.clientY || (e.touches && e.touches[0].clientY) || rect.top + rect.height/2) - rect.top - size / 2;

        const ripple = document.createElement('span');
        ripple.className = 'btn-ripple';
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';

        const computedPos = getComputedStyle(btn).position;
        if (computedPos === 'static') btn.style.position = 'relative';
        btn.style.overflow = 'hidden';

        btn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 700);
    }

    function attachRipples() {
        document.querySelectorAll('.btn, .nav-tab').forEach(btn => {
            if (!btn.dataset.rippleAttached) {
                btn.addEventListener('click', createRipple);
                btn.dataset.rippleAttached = 'true';
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachRipples);
    } else {
        attachRipples();
    }

    const mo = new MutationObserver(() => attachRipples());
    mo.observe(document.body, { childList: true, subtree: true });
})();
