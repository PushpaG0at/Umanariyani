/**
 * UMANARAYANI AYURVEDA — REVOLVING HERBS MANDALA ENGINE
 * Rotates the 8 sacred Ayurvedic herbs dynamically around the central Umanarayani brand icon.
 * Features 60fps physics, interactive cursor popping, drag-to-spin momentum, and herb modals.
 */

class RevolvingMandalaEngine {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.herbs = [
      {
        id: "amla",
        name: "AMLA",
        hindi: "अमला",
        botanical: "Phyllanthus emblica",
        image: "/images/badge-amla.png",
        tagline: "Rasayana & Vitamin C",
        micro: "Natural Vit-C & Shine",
        role: "Supreme rejuvenator rich in bioavailable Vitamin C that fortifies roots, deepens natural pigmentation, and imparts radiant luster.",
        products: ["Ayurvedic Hair Oil", "Herbal Shampoo"]
      },
      {
        id: "reetha",
        name: "REETHA",
        hindi: "रीठा",
        botanical: "Sapindus mukorossi",
        image: "/images/badge-reetha.png",
        tagline: "Natural Cleansing Saponin",
        micro: "Gentle Saponin Cleanser",
        role: "Hypoallergenic soapnut loaded with natural saponins that wash away impurities and excess sebum without stripping scalp lipids.",
        products: ["Herbal Shampoo"]
      },
      {
        id: "shikakai",
        name: "SHIKAKAI",
        hindi: "शिकाकाई",
        botanical: "Acacia concinna",
        image: "/images/badge-shikakai.png",
        tagline: "Fruit for the Hair",
        micro: "Fruit for Hair & Silkiness",
        role: "Classical detangler and mild pH herbal cleanser rich in vitamins A, C, D, and K, famous for soft silkiness and manageability.",
        products: ["Ayurvedic Hair Oil", "Herbal Shampoo"]
      },
      {
        id: "brahmi",
        name: "BRAHMI",
        hindi: "ब्राह्मी",
        botanical: "Bacopa monnieri",
        image: "/images/badge-brahmi.png",
        tagline: "Mind & Crown Nourisher",
        micro: "Crown Calmer & Growth",
        role: "Cools crown heat (Pitta dosha), curbs stress-induced shedding, and revitalizes follicular microcirculation during champi massage.",
        products: ["Ayurvedic Hair Oil", "Herbal Shampoo"]
      },
      {
        id: "kalonji",
        name: "KALONJI",
        hindi: "कलौंजी",
        botanical: "Nigella sativa",
        image: "/images/badge-kalonji.png",
        tagline: "Miracle Seed of Vitality",
        micro: "Vitality & Follicle Density",
        role: "Loaded with thymoquinone and omega fatty acids to nourish thinning roots, curb breakage, and lock in deep moisture.",
        products: ["Ayurvedic Hair Oil"]
      },
      {
        id: "jatamansi",
        name: "JATAMANSI",
        hindi: "जटामांसी",
        botanical: "Nardostachys jatamansi",
        image: "/images/badge-jatamansi.png",
        tagline: "Sacred Calming Root",
        micro: "Calming Root & Follicles",
        role: "Revered in Charaka Samhita for calming agitated scalp nerves, promoting anagen growth phase, and deep botanical conditioning.",
        products: ["Ayurvedic Hair Oil"]
      },
      {
        id: "nagarmotha",
        name: "NAGARMOTHA",
        hindi: "नागरमोथा",
        botanical: "Cyperus scariosus",
        image: "/images/badge-nagarmotha.png",
        tagline: "Scalp Microbiome Purifier",
        micro: "Dandruff Defense & Anchor",
        role: "Purifies scalp microflora, regulates excess oil, eliminates flakiness and itching, and firmly anchors hair root shafts.",
        products: ["Ayurvedic Hair Oil"]
      },
      {
        id: "amarbel",
        name: "AMARBEL",
        hindi: "अमरबेल",
        botanical: "Cuscuta reflexa",
        image: "/images/badge-amarbel.png",
        tagline: "Length Retention & Density",
        micro: "Length & Density Booster",
        role: "Classical golden vine botanical traditionally used to invigorate dormant hair roots and promote noticeably fuller, longer growth.",
        products: ["Ayurvedic Hair Oil"]
      }
    ];

    // Physics & Orbit state
    this.baseAngle = 0;
    this.speed = 0.004; // standard angular speed in radians/frame
    this.targetSpeed = 0.004;
    this.direction = 1; // 1 = clockwise, -1 = counter-clockwise
    this.isPaused = false;
    this.isDragging = false;
    this.dragStartAngle = 0;
    this.dragLastAngle = 0;
    this.orbitRadius = 265;
    this.nodeElements = [];

    this.init();
  }

  init() {
    this.renderDOM();
    this.updateDimensions();
    window.addEventListener('resize', () => this.updateDimensions());

    this.setupInteractivity();
    this.startLoop();
  }

  updateDimensions() {
    const width = window.innerWidth;
    if (width < 768) {
      this.orbitRadius = 135;
    } else if (width <= 1024) {
      this.orbitRadius = 205;
    } else {
      this.orbitRadius = 265;
    }
  }

  renderDOM() {
    this.container.innerHTML = `
      <div class="hero-showcase-wrapper">
        <div class="orbit-mandala-stage" id="mandalaStage">
          <!-- Background Atmospheric Rings -->
          <div class="mandala-glow-halo"></div>
          <div class="mandala-outer-ring"></div>
          <div class="mandala-inner-ring"></div>

          <!-- CENTER BRAND ICON (The user's Umanarayani logo) -->
          <div class="center-brand-core" id="centerBrandCore" title="UMANARAYANI — Pure Nature, Pure Care">
            <div class="center-logo-disc">
              <img src="/images/logo-center.png" alt="UMANARAYANI Logo" class="center-logo-img">
            </div>
            <div class="center-brand-name-pill">
              <i class="fa-solid fa-seedling"></i>
              <span>UMANARAYANI</span>
            </div>
          </div>

          <!-- Orbiting Herbs Track -->
          <div class="orbiting-track" id="orbitingTrack"></div>
        </div>

        <!-- Interactive Control Deck -->
        <div class="mandala-control-deck">
          <span class="deck-instruction">
            <i class="fa-solid fa-arrows-spin" style="color:var(--green-sage);"></i>
            <span>Interactive Herb Mandala</span>
          </span>
          <button class="deck-btn" id="btnMandalaPlayPause">
            <i class="fa-solid fa-pause"></i> Pause
          </button>
          <button class="deck-btn" id="btnMandalaDirection">
            <i class="fa-solid fa-rotate"></i> Direction
          </button>
          <button class="deck-btn" id="btnMandalaSpeed">
            <i class="fa-solid fa-gauge-high"></i> Speed: 1x
          </button>
        </div>
      </div>
    `;

    const track = document.getElementById('orbitingTrack');
    this.stage = document.getElementById('mandalaStage');
    this.centerCore = document.getElementById('centerBrandCore');

    // Build the 8 Herb Nodes
    this.nodeElements = this.herbs.map((herb, idx) => {
      const node = document.createElement('div');
      node.className = 'revolving-herb-node';
      node.setAttribute('data-herb-index', idx);

      node.innerHTML = `
        <div class="herb-badge-ring">
          <img src="${herb.image}" alt="${herb.name}" class="herb-badge-img">
        </div>
        <div class="herb-label-box">
          <span class="herb-name-en">${herb.name}</span>
          <span class="herb-name-hi">(${herb.hindi})</span>
          <span class="herb-benefit-micro">${herb.micro}</span>
        </div>
        <div class="herb-popover-card">
          <div class="popover-header">
            <span class="popover-title">${herb.name}</span>
            <span class="popover-hindi">${herb.hindi}</span>
          </div>
          <div class="popover-botanical">${herb.botanical}</div>
          <div class="popover-role">${herb.role}</div>
          <div class="popover-products">🌿 In: ${herb.products.join(', ')}</div>
        </div>
      `;

      track.appendChild(node);
      return node;
    });
  }

  setupInteractivity() {
    // 1. Center Core Click -> Scroll to Products
    if (this.centerCore) {
      this.centerCore.addEventListener('click', () => {
        const prod = document.getElementById('productsSection');
        if (prod) prod.scrollIntoView({ behavior: 'smooth' });
      });
    }

    // 2. Cursor Hover -> Smooth slow down / pop
    this.nodeElements.forEach((node, idx) => {
      node.addEventListener('mouseenter', () => {
        this.targetSpeed = 0; // smoothly halts
      });

      node.addEventListener('mouseleave', () => {
        if (!this.isPaused) {
          this.targetSpeed = 0.004;
        }
      });

      // Click herb -> opens detailed modal
      node.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openModal(this.herbs[idx]);
      });
    });

    // 3. Drag / Swipe to rotate wheel
    if (this.stage) {
      const getAngle = (clientX, clientY) => {
        const rect = this.stage.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        return Math.atan2(clientY - cy, clientX - cx);
      };

      const startDrag = (clientX, clientY) => {
        this.isDragging = true;
        this.dragStartAngle = getAngle(clientX, clientY);
        this.dragLastAngle = this.dragStartAngle;
      };

      const moveDrag = (clientX, clientY) => {
        if (!this.isDragging) return;
        const currentAngle = getAngle(clientX, clientY);
        const delta = currentAngle - this.dragLastAngle;
        this.baseAngle += delta;
        this.dragLastAngle = currentAngle;
      };

      const endDrag = () => {
        this.isDragging = false;
      };

      // Mouse events
      this.stage.addEventListener('mousedown', (e) => {
        if (e.target.closest('.revolving-herb-node') || e.target.closest('.center-brand-core')) return;
        startDrag(e.clientX, e.clientY);
      });
      window.addEventListener('mousemove', (e) => moveDrag(e.clientX, e.clientY));
      window.addEventListener('mouseup', endDrag);

      // Touch events for mobile
      this.stage.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          const t = e.touches[0];
          startDrag(t.clientX, t.clientY);
        }
      }, { passive: true });
      window.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1) {
          const t = e.touches[0];
          moveDrag(t.clientX, t.clientY);
        }
      }, { passive: true });
      window.addEventListener('touchend', endDrag);
    }

    // 4. Control Deck Buttons
    const btnPlayPause = document.getElementById('btnMandalaPlayPause');
    const btnDirection = document.getElementById('btnMandalaDirection');
    const btnSpeed = document.getElementById('btnMandalaSpeed');

    if (btnPlayPause) {
      btnPlayPause.addEventListener('click', () => {
        this.isPaused = !this.isPaused;
        if (this.isPaused) {
          this.targetSpeed = 0;
          btnPlayPause.innerHTML = '<i class="fa-solid fa-play"></i> Resume';
        } else {
          this.targetSpeed = 0.004;
          btnPlayPause.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
        }
      });
    }

    if (btnDirection) {
      btnDirection.addEventListener('click', () => {
        this.direction *= -1;
      });
    }

    if (btnSpeed) {
      const speedOptions = [
        { label: '1x', val: 0.004 },
        { label: '2x', val: 0.008 },
        { label: '0.5x', val: 0.002 }
      ];
      let sIdx = 0;
      btnSpeed.addEventListener('click', () => {
        sIdx = (sIdx + 1) % speedOptions.length;
        const cur = speedOptions[sIdx];
        this.targetSpeed = cur.val;
        btnSpeed.innerHTML = `<i class="fa-solid fa-gauge-high"></i> Speed: ${cur.label}`;
      });
    }
  }

  startLoop() {
    const loop = () => {
      if (!this.isDragging) {
        // Smooth speed easing
        this.speed += (this.targetSpeed - this.speed) * 0.08;
        this.baseAngle += this.speed * this.direction;
      }

      const total = this.herbs.length;
      const r = this.orbitRadius;

      // Position each node
      this.nodeElements.forEach((node, i) => {
        const angle = this.baseAngle + (i * 2 * Math.PI / total);
        const x = Math.round(r * Math.cos(angle));
        const y = Math.round(r * Math.sin(angle));

        // Keep upright via translate
        node.style.transform = `translate(${x}px, ${y}px)`;
      });

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  openModal(herb) {
    let modal = document.getElementById('herbDetailModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'herbDetailModal';
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="herb-detail-card-modal">
          <button class="modal-close-icon" id="btnCloseHerbModal">&times;</button>
          <div class="herb-modal-header">
            <img src="" alt="" class="herb-modal-avatar" id="herbModalImg">
            <h3 class="herb-modal-title" id="herbModalTitle"></h3>
            <div class="herb-modal-hindi" id="herbModalHindi"></div>
            <div class="herb-modal-botanical" id="herbModalBotanical"></div>
          </div>
          <div class="herb-modal-body">
            <p class="herb-modal-role" id="herbModalRole"></p>
            <h4 style="font-size:0.9rem; color:var(--green-primary); margin-bottom:8px;">Classical Benefits:</h4>
            <ul class="herb-modal-benefits-list" id="herbModalBenefits"></ul>
          </div>
          <div class="herb-modal-footer">
            <span style="font-size:0.82rem; color:var(--text-muted);" id="herbModalFeaturedIn"></span>
            <button class="btn-card-details" id="herbModalShopBtn" style="padding:6px 14px;">
              View Formulations &rarr;
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.id === 'btnCloseHerbModal') {
          modal.classList.remove('active');
        }
      });
    }

    document.getElementById('herbModalImg').src = herb.image;
    document.getElementById('herbModalTitle').textContent = herb.name;
    document.getElementById('herbModalHindi').textContent = herb.hindi;
    document.getElementById('herbModalBotanical').textContent = herb.botanical;
    document.getElementById('herbModalRole').textContent = herb.role;

    const benefitsList = document.getElementById('herbModalBenefits');
    benefitsList.innerHTML = `
      <li><i class="fa-solid fa-leaf"></i> <span>${herb.tagline}</span></li>
      <li><i class="fa-solid fa-leaf"></i> <span>Handcrafted cold extraction preserving active phytochemicals</span></li>
      <li><i class="fa-solid fa-leaf"></i> <span>Classical Ayurvedic herbology proven over centuries</span></li>
    `;

    document.getElementById('herbModalFeaturedIn').innerHTML = `Featured in: <strong>${herb.products.join(', ')}</strong>`;

    const shopBtn = document.getElementById('herbModalShopBtn');
    shopBtn.onclick = () => {
      modal.classList.remove('active');
      const prod = document.getElementById('productsSection');
      if (prod) prod.scrollIntoView({ behavior: 'smooth' });
    };

    modal.classList.add('active');
  }
}

// Global initialization
window.initRevolvingMandala = function(containerId) {
  return new RevolvingMandalaEngine(containerId);
};
