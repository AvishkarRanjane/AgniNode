/**
 * AgniNode Interactive Site Features & State Engine
 * Continuous gradient-adaptive navbar, scroll-triggered text animations,
 * interactive working hardware simulator, and universal button handlers.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Global Toast Notification Helper
  const showToast = (htmlContent, isFire = true, duration = 5000) => {
    const existing = document.querySelector('.action-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `action-toast ${isFire ? 'toast-fire' : ''}`;
    toast.innerHTML = htmlContent;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('toast-visible');
    });

    setTimeout(() => {
      toast.classList.remove('toast-visible');
      setTimeout(() => toast.remove(), 400);
    }, duration);
  };

  // 1. Mobile Menu Toggle (Full Drawer with Keyboard & Outside-Click Dismissal)
  const mobileToggle = document.querySelector('.mobile-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = navLinks.classList.toggle('open');
      mobileToggle.textContent = isOpen ? '✕' : '☰';
      mobileToggle.setAttribute('aria-expanded', isOpen);
    });

    // Close when clicking any nav item
    navLinks.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        mobileToggle.textContent = '☰';
      });
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!navLinks.contains(e.target) && !mobileToggle.contains(e.target)) {
        navLinks.classList.remove('open');
        mobileToggle.textContent = '☰';
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        navLinks.classList.remove('open');
        mobileToggle.textContent = '☰';
      }
    });
  }

  // 2. Continuous Gradient-Adaptive Nav Bar Color Engine
  // Seamlessly interpolates navbar background, text, and button styles
  // in lockstep with the website's background vertical gradient.
  const siteHeader = document.querySelector('.site-header');

  const hdrColorStops = [
    {
      p: 0.00, // Top of page (Black & dark embers)
      bg: [8, 2, 4, 0.84],
      logo: [255, 255, 255],
      link: [203, 213, 225],
      linkActive: [255, 255, 255],
      hoverBg: [255, 255, 255, 0.10],
      secBg: [255, 255, 255, 0.08],
      secCol: [255, 255, 255],
      secHoverBg: [255, 255, 255, 0.18],
      shadow: [0, 0, 0, 0.45],
      mobileBg: [14, 3, 7, 0.97]
    },
    {
      p: 0.22, // Deep burgundy / crimson wine
      bg: [28, 4, 10, 0.88],
      logo: [255, 255, 255],
      link: [226, 215, 220],
      linkActive: [255, 255, 255],
      hoverBg: [255, 255, 255, 0.12],
      secBg: [255, 255, 255, 0.12],
      secCol: [255, 255, 255],
      secHoverBg: [255, 255, 255, 0.22],
      shadow: [20, 2, 6, 0.35],
      mobileBg: [32, 6, 12, 0.97]
    },
    {
      p: 0.48, // Rich ruby & fiery flame
      bg: [85, 9, 28, 0.90],
      logo: [255, 255, 255],
      link: [248, 235, 240],
      linkActive: [255, 255, 255],
      hoverBg: [255, 255, 255, 0.16],
      secBg: [255, 255, 255, 0.18],
      secCol: [255, 255, 255],
      secHoverBg: [255, 255, 255, 0.28],
      shadow: [60, 6, 18, 0.25],
      mobileBg: [92, 12, 30, 0.98]
    },
    {
      p: 0.70, // Vivid rose & coral-red
      bg: [203, 39, 61, 0.92],
      logo: [255, 255, 255],
      link: [255, 245, 248],
      linkActive: [255, 255, 255],
      hoverBg: [255, 255, 255, 0.22],
      secBg: [255, 255, 255, 0.25],
      secCol: [255, 255, 255],
      secHoverBg: [255, 255, 255, 0.35],
      shadow: [110, 18, 35, 0.18],
      mobileBg: [203, 39, 61, 0.98]
    },
    {
      p: 0.84, // Transitional rose blush -> soft porcelain
      bg: [248, 220, 226, 0.94],
      logo: [20, 10, 16],
      link: [70, 35, 48],
      linkActive: [229, 9, 20],
      hoverBg: [255, 255, 255, 0.50],
      secBg: [255, 255, 255, 0.85],
      secCol: [20, 10, 16],
      secHoverBg: [255, 255, 255, 1],
      shadow: [160, 40, 60, 0.10],
      mobileBg: [252, 230, 235, 0.98]
    },
    {
      p: 1.00, // Pure white ending
      bg: [255, 255, 255, 0.96],
      logo: [15, 23, 42],
      link: [51, 65, 85],
      linkActive: [229, 9, 20],
      hoverBg: [241, 245, 249, 0.8],
      secBg: [241, 245, 249, 1],
      secCol: [15, 23, 42],
      secHoverBg: [226, 232, 240, 1],
      shadow: [0, 0, 0, 0.08],
      mobileBg: [255, 255, 255, 0.99]
    }
  ];

  const lerp = (a, b, t) => a + (b - a) * t;
  const lerpArr = (a, b, t) => a.map((val, idx) => lerp(val, b[idx], t));
  const toRgba = (arr) => arr.length === 4 
    ? `rgba(${Math.round(arr[0])}, ${Math.round(arr[1])}, ${Math.round(arr[2])}, ${arr[3].toFixed(3)})` 
    : `rgb(${Math.round(arr[0])}, ${Math.round(arr[1])}, ${Math.round(arr[2])})`;

  const updateScrollHeader = (currentScrollY) => {
    if (!siteHeader) return;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const p = docHeight > 0 ? Math.max(0, Math.min(1, currentScrollY / docHeight)) : 0;

    let s0 = hdrColorStops[0];
    let s1 = hdrColorStops[hdrColorStops.length - 1];
    for (let i = 0; i < hdrColorStops.length - 1; i++) {
      if (p >= hdrColorStops[i].p && p <= hdrColorStops[i + 1].p) {
        s0 = hdrColorStops[i];
        s1 = hdrColorStops[i + 1];
        break;
      }
    }

    const t = (p - s0.p) / (s1.p - s0.p || 1);
    const bg = lerpArr(s0.bg, s1.bg, t);
    const logo = lerpArr(s0.logo, s1.logo, t);
    const link = lerpArr(s0.link, s1.link, t);
    const linkActive = lerpArr(s0.linkActive, s1.linkActive, t);
    const hoverBg = lerpArr(s0.hoverBg, s1.hoverBg, t);
    const secBg = lerpArr(s0.secBg, s1.secBg, t);
    const secCol = lerpArr(s0.secCol, s1.secCol, t);
    const secHoverBg = lerpArr(s0.secHoverBg, s1.secHoverBg, t);
    const shadowArr = lerpArr(s0.shadow, s1.shadow, t);
    const mobileBg = lerpArr(s0.mobileBg, s1.mobileBg, t);

    siteHeader.style.setProperty('--hdr-bg', toRgba(bg));
    siteHeader.style.setProperty('--hdr-logo-text', toRgba(logo));
    siteHeader.style.setProperty('--hdr-nav-link', toRgba(link));
    siteHeader.style.setProperty('--hdr-nav-link-active', toRgba(linkActive));
    siteHeader.style.setProperty('--hdr-nav-link-hover-bg', toRgba(hoverBg));
    siteHeader.style.setProperty('--hdr-sec-bg', toRgba(secBg));
    siteHeader.style.setProperty('--hdr-sec-col', toRgba(secCol));
    siteHeader.style.setProperty('--hdr-sec-hover-bg', toRgba(secHoverBg));
    siteHeader.style.setProperty('--hdr-shadow', `0 10px 30px rgba(${Math.round(shadowArr[0])}, ${Math.round(shadowArr[1])}, ${Math.round(shadowArr[2])}, ${shadowArr[3].toFixed(3)})`);
    siteHeader.style.setProperty('--hdr-mobile-bg', toRgba(mobileBg));
  };

  // 3. Comprehensive Title & Heading Text Scroll Animations
  const allTitles = document.querySelectorAll('.section-title, .section-head h2, .section-head h1');
  const allDescs = document.querySelectorAll('.section-desc');

  const titleObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('title-revealed');
        const parent = entry.target.closest('.section-head') || entry.target.parentElement;
        if (parent) {
          const desc = parent.querySelector('.section-desc');
          if (desc) desc.classList.add('desc-revealed');
        }
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  allTitles.forEach(t => titleObserver.observe(t));
  allDescs.forEach(d => titleObserver.observe(d));

  // 4. Universal Button Functionality & Interactive Routing
  // (A) Live Dashboard Direct Access (ensures dashboard loads instantly)
  document.querySelectorAll('a[href="dashboard.html"]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!sessionStorage.getItem('demoRole')) {
        sessionStorage.setItem('demoRole', 'viewer');
      }
    });
  });

  // (B) Watch Working Demo Smooth Scroll & Card Highlight
  document.querySelectorAll('a[href="#working-demo"]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const demoEl = document.getElementById('working-demo');
      if (demoEl) {
        demoEl.scrollIntoView({ behavior: 'smooth' });
        demoEl.classList.add('revealed');
        const card = document.getElementById('video-working-card');
        if (card) {
          card.style.boxShadow = '0 0 35px rgba(229, 9, 20, 0.7)';
          setTimeout(() => {
            card.style.boxShadow = '';
          }, 2500);
        }
      }
    });
  });

  // (C) Smooth Scroll for all internal hash anchors
  document.querySelectorAll('a[href^="#"]:not([href="#"])').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        targetEl.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // (D) Lightbox Modal for Schematics & Renders
  const lightbox = document.getElementById('image-lightbox');
  const lightboxImg = document.getElementById('lightbox-target-img');
  const lightboxClose = document.getElementById('lightbox-close-btn');

  document.querySelectorAll('.open-lightbox').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const targetSrc = el.getAttribute('data-img') || el.getAttribute('href') || el.src;
      if (lightbox && lightboxImg && targetSrc) {
        lightboxImg.src = targetSrc;
        lightbox.classList.add('open');
      }
    });
  });

  if (lightbox && lightboxClose) {
    lightboxClose.addEventListener('click', () => lightbox.classList.remove('open'));
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) lightbox.classList.remove('open');
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && lightbox.classList.contains('open')) {
        lightbox.classList.remove('open');
      }
    });
  }

  // 5. Interactive ROI & Risk Assessment Calculator
  const calcForm = document.getElementById('roi-calculator');
  if (calcForm) {
    const panelsInput = document.getElementById('calc-panels');
    const assetValInput = document.getElementById('calc-asset-val');
    const outCost = document.getElementById('calc-out-cost');
    const outRisk = document.getElementById('calc-out-risk');
    const outROI = document.getElementById('calc-out-roi');

    const compute = () => {
      const panels = Math.max(1, parseInt(panelsInput.value) || 1);
      const assetVal = Math.max(100000, parseFloat(assetValInput.value) || 500000);
      
      const hardwareCost = panels * 6500;
      const fireLossRisk = assetVal * 0.15;
      const netSavings = Math.round(fireLossRisk - hardwareCost);

      if (outCost) outCost.textContent = `₹${hardwareCost.toLocaleString('en-IN')}`;
      if (outRisk) outRisk.textContent = `₹${Math.round(fireLossRisk).toLocaleString('en-IN')}`;
      if (outROI) outROI.textContent = `${Math.max(120, Math.round((netSavings / hardwareCost) * 100))}% Protection Ratio`;
    };

    if (panelsInput) panelsInput.addEventListener('input', compute);
    if (assetValInput) assetValInput.addEventListener('input', compute);
    compute();
  }

  // 6. Interactive Contact / Pilot Form Submission
  const contactForm = document.getElementById('pilot-inquiry-form');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const origText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Submitting Request...';

      setTimeout(() => {
        submitBtn.innerHTML = '✓ Pilot Request Received!';
        submitBtn.style.background = 'var(--fire-red)';
        
        showToast('<strong>Request Received!</strong> Your inquiry has been registered. Our engineering team in Panvel will get in touch with you.');
        contactForm.reset();

        setTimeout(() => {
          submitBtn.disabled = false;
          submitBtn.innerHTML = origText;
          submitBtn.style.background = '';
        }, 4000);
      }, 800);
    });
  }

  // 7. Full-Screen Bidirectional Smoke & Cloud Transition between Problem and Demo Sections
  const initSmokeAndScrollExperience = () => {
    const demoSection = document.getElementById('working-demo');
    const screenSmokeCurtain = document.getElementById('screen-smoke-curtain');
    const smokeCloudBody = document.getElementById('smoke-cloud-body');
    const smokeCanvas = document.getElementById('ambient-smoke-canvas');

    let lastScrollY = window.scrollY || window.pageYOffset;
    let scrollDirection = 'down';

    // (B) Bidirectional Full-Screen Smoke/Cloud Transition
    const updateSmokeTransition = (currentScrollY) => {
      if (!demoSection || !screenSmokeCurtain || !smokeCloudBody) return;

      const rect = demoSection.getBoundingClientRect();
      const H = window.innerHeight;
      const top = rect.top;

      const zoneStart = H * 1.05;
      const zoneEnd = H * 0.05;
      const peakCoverage = H * 0.52;

      // Outside transition zone: deactivate overlay
      if (top > zoneStart || top < -H * 0.15) {
        screenSmokeCurtain.style.opacity = '0';
        screenSmokeCurtain.style.visibility = 'hidden';
        if (top <= -H * 0.15) {
          demoSection.classList.add('revealed');
        } else {
          demoSection.classList.remove('revealed');
        }
        return;
      }

      screenSmokeCurtain.style.visibility = 'visible';

      if (scrollDirection === 'down') {
        // SCROLLING DOWN:
        // 1. Enter from the LEFT (-145vw -> 0vw), fully covering screen & nav bar
        // 2. As user continues scrolling, dissipate (fade out & disperse) to reveal next section
        if (top >= peakCoverage) {
          const enterProgress = (zoneStart - top) / (zoneStart - peakCoverage);
          const clamped = Math.max(0, Math.min(1, enterProgress));
          const tx = -145 * (1 - clamped);
          const op = Math.min(1, clamped * 1.45);

          smokeCloudBody.style.transform = `translate3d(${tx}vw, 0, 0) scale(1)`;
          screenSmokeCurtain.style.opacity = op;
          smokeCloudBody.style.filter = 'blur(0px)';
          demoSection.classList.remove('revealed');
        } else {
          const dissipateProgress = (peakCoverage - top) / (peakCoverage - zoneEnd);
          const clamped = Math.max(0, Math.min(1, dissipateProgress));
          const op = Math.max(0, 1 - clamped);
          const scale = 1 + clamped * 0.26;
          const blur = clamped * 20;

          smokeCloudBody.style.transform = `translate3d(0, 0, 0) scale(${scale})`;
          screenSmokeCurtain.style.opacity = op;
          smokeCloudBody.style.filter = `blur(${blur}px)`;

          if (clamped >= 0.22) {
            demoSection.classList.add('revealed');
          }
        }
      } else {
        // SCROLLING UP (REVERSE):
        // 1. Enter from the RIGHT (+145vw -> 0vw), fully covering screen & nav bar
        // 2. As user continues scrolling up, exit to the LEFT (0vw -> -145vw), revealing previous section
        if (top <= peakCoverage) {
          const enterUpProgress = (top - zoneEnd) / (peakCoverage - zoneEnd);
          const clamped = Math.max(0, Math.min(1, enterUpProgress));
          const tx = 145 * (1 - clamped);
          const op = Math.min(1, clamped * 1.45);

          smokeCloudBody.style.transform = `translate3d(${tx}vw, 0, 0) scale(1)`;
          screenSmokeCurtain.style.opacity = op;
          smokeCloudBody.style.filter = 'blur(0px)';

          if (clamped < 0.35) {
            demoSection.classList.add('revealed');
          }
        } else {
          const exitProgress = (top - peakCoverage) / (zoneStart - peakCoverage);
          const clamped = Math.max(0, Math.min(1, exitProgress));
          const tx = -145 * clamped;
          const op = Math.max(0, 1 - clamped * 0.9);

          smokeCloudBody.style.transform = `translate3d(${tx}vw, 0, 0) scale(1)`;
          screenSmokeCurtain.style.opacity = op;
          smokeCloudBody.style.filter = 'blur(0px)';
          demoSection.classList.remove('revealed');
        }
      }
    };

    // High performance RAF loop
    let ticking = false;
    const onScroll = () => {
      const currentScrollY = window.scrollY || window.pageYOffset;
      if (currentScrollY > lastScrollY + 1) {
        scrollDirection = 'down';
      } else if (currentScrollY < lastScrollY - 1) {
        scrollDirection = 'up';
      }
      lastScrollY = currentScrollY;

      if (!ticking) {
        requestAnimationFrame(() => {
          updateScrollHeader(currentScrollY);
          updateSmokeTransition(currentScrollY);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // (C) Ambient Drifting Smoke & Interactive Arc Simulation Simulator
    if (smokeCanvas) {
      const ctx = smokeCanvas.getContext('2d');
      if (ctx) {
        let width = smokeCanvas.width = smokeCanvas.parentElement.offsetWidth || 640;
        let height = smokeCanvas.height = smokeCanvas.parentElement.offsetHeight || 360;

        window.addEventListener('resize', () => {
          if (smokeCanvas.parentElement) {
            width = smokeCanvas.width = smokeCanvas.parentElement.offsetWidth || 640;
            height = smokeCanvas.height = smokeCanvas.parentElement.offsetHeight || 360;
          }
        });

        const particles = [];
        const maxParticles = 24;
        const sparkParticles = [];

        class SmokeParticle {
          constructor() {
            this.reset(true);
          }
          reset(initial = false) {
            this.x = width * 0.2 + Math.random() * (width * 0.6);
            this.y = initial ? Math.random() * height : height + 20;
            this.vx = (Math.random() - 0.5) * 0.8;
            this.vy = -0.5 - Math.random() * 0.9;
            this.radius = 25 + Math.random() * 35;
            this.maxRadius = this.radius * (1.8 + Math.random() * 0.6);
            this.alpha = 0.01;
            this.maxAlpha = 0.12 + Math.random() * 0.16;
            this.growing = true;
          }
          update() {
            this.x += this.vx;
            this.y += this.vy;
            if (this.radius < this.maxRadius) this.radius += 0.25;

            if (this.growing) {
              this.alpha += 0.006;
              if (this.alpha >= this.maxAlpha) this.growing = false;
            } else {
              this.alpha -= 0.003;
            }

            if (this.y < -this.radius || this.alpha <= 0) {
              this.reset();
            }
          }
          draw() {
            ctx.save();
            const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
            grad.addColorStop(0, `rgba(255, 255, 255, ${this.alpha})`);
            grad.addColorStop(0.5, `rgba(240, 245, 255, ${this.alpha * 0.5})`);
            grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }

        class SparkParticle {
          constructor(x, y) {
            this.x = x || width * 0.5;
            this.y = y || height * 0.5;
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 7;
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed;
            this.life = 1.0;
            this.decay = 0.03 + Math.random() * 0.04;
            this.color = Math.random() > 0.4 ? '#38bdf8' : '#facc15';
            this.size = 2 + Math.random() * 3;
          }
          update() {
            this.x += this.vx;
            this.y += this.vy;
            this.vy += 0.15; // Gravity
            this.life -= this.decay;
          }
          draw() {
            if (this.life <= 0) return;
            ctx.save();
            ctx.globalAlpha = this.life;
            ctx.fillStyle = this.color;
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }

        for (let i = 0; i < maxParticles; i++) {
          particles.push(new SmokeParticle());
        }

        let flashCount = 0;
        let isArcSimulating = false;

        let animFrame;
        const animateSmoke = () => {
          ctx.clearRect(0, 0, width, height);

          // Simulated arc flash overlay
          if (flashCount > 0) {
            ctx.save();
            ctx.fillStyle = flashCount % 2 === 0 ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.35)';
            ctx.fillRect(0, 0, width, height);
            ctx.restore();
            flashCount--;
          }

          particles.forEach(p => {
            p.update();
            p.draw();
          });

          // Draw active electrical sparks
          for (let i = sparkParticles.length - 1; i >= 0; i--) {
            const sp = sparkParticles[i];
            sp.update();
            sp.draw();
            if (sp.life <= 0) {
              sparkParticles.splice(i, 1);
            }
          }

          animFrame = requestAnimationFrame(animateSmoke);
        };

        const animObserver = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              if (!animFrame) animFrame = requestAnimationFrame(animateSmoke);
            } else {
              if (animFrame) {
                cancelAnimationFrame(animFrame);
                animFrame = null;
              }
            }
          });
        }, { threshold: 0.1 });

        animObserver.observe(smokeCanvas);

        // 8. Interactive Working Demo Simulator Buttons
        const simArcBtn = document.getElementById('sim-arc-btn');
        const simAerosolBtn = document.getElementById('sim-aerosol-btn');
        const simResetBtn = document.getElementById('sim-reset-btn');
        const demoStatusBadge = document.getElementById('demo-status-badge');

        if (simArcBtn) {
          simArcBtn.addEventListener('click', () => {
            flashCount = 12;
            isArcSimulating = true;
            for (let i = 0; i < 40; i++) {
              sparkParticles.push(new SparkParticle(width * 0.45 + (Math.random() - 0.5) * 60, height * 0.5));
            }
            if (demoStatusBadge) {
              demoStatusBadge.textContent = '⚡ 68.4 kHz ARC DETECTED • SHUNT TRIP FIRED (3.4ms) • BREAKER OPEN';
              demoStatusBadge.classList.add('alert-active');
            }
            showToast('<strong>⚡ Micro-Arc Fault Detected!</strong> Autonomous Safety Loop tripped breaker in 3.4ms via solid-state relay. Panel protected.');
          });
        }

        if (simAerosolBtn) {
          simAerosolBtn.addEventListener('click', () => {
            flashCount = 4;
            // Spawn burst of cloud particles
            for (let i = 0; i < 20; i++) {
              const sp = new SmokeParticle();
              sp.x = width * 0.5 + (Math.random() - 0.5) * 80;
              sp.y = height * 0.6;
              sp.radius = 45 + Math.random() * 40;
              sp.maxAlpha = 0.45;
              sp.alpha = 0.35;
              particles.push(sp);
            }
            if (demoStatusBadge) {
              demoStatusBadge.textContent = '🧯 AEROSOL CANISTER DISCHARGED • FLAME EXTINGUISHED IN 1.8s';
              demoStatusBadge.classList.add('alert-active');
            }
            showToast('<strong>🧯 Condensed Aerosol Discharged!</strong> In-panel flame envelope knocked down in under 2 seconds.');
          });
        }

        if (simResetBtn) {
          simResetBtn.addEventListener('click', () => {
            sparkParticles.length = 0;
            flashCount = 0;
            isArcSimulating = false;
            if (demoStatusBadge) {
              demoStatusBadge.textContent = 'STATUS: NORMAL (ARMED) • ZERO ARC ACTIVITY';
              demoStatusBadge.classList.remove('alert-active');
            }
            showToast('<strong>↺ System Reset & Armed.</strong> Monitoring 200ksps line waveform telemetry.');
          });
        }
      }
    }
  };

  initSmokeAndScrollExperience();
});

// ==========================================
// UNIVERSAL BACKGROUND ASSET PRELOADER
// Automatically warms up all hardware renders, CAD schematics, and UI mockups in background idle
// ==========================================
(function initUniversalPreloader() {
  const PRELOAD_ASSETS = [
    'favicon.svg',
    'assets/images/agninode-logo-mark-white.png',
    'assets/images/agninode-logo-horizontal-white.png',
    'assets/hardware/agninode-glass-render.jpg',
    'assets/hardware/agninode-product-render.png',
    'assets/hardware/Final Product.png',
    'assets/hardware/Exploded view.png',
    'assets/hardware/Connection.png',
    'assets/hardware/Layer 1.png',
    'assets/hardware/Layer 2.png',
    'assets/hardware/Layer 3.png',
    'assets/hardware/Layer 4.png',
    'assets/hardware/Layer 5.png',
    'assets/hardware/Layer 6.png',
    'assets/hardware/Layer 7.png',
    'assets/images/agninode-smoke-action.png',
    'assets/images/agninode_app_mockup.jpg',
    'assets/images/agninode_panel_mount.jpg',
    'assets/images/Bread Board Connection.png',
    'assets/images/Hardware Components.png',
    'assets/images/Optimized Circut.png',
    'assets/images/Prototype Hardware.png'
  ];

  function executePreload() {
    PRELOAD_ASSETS.forEach(url => {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
    });
  }

  if (document.readyState === 'complete') {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(executePreload);
    } else {
      setTimeout(executePreload, 200);
    }
  } else {
    window.addEventListener('load', () => {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(executePreload);
      } else {
        setTimeout(executePreload, 200);
      }
    });
  }
})();
