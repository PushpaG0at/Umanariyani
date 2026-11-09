/**
 * UMANARAYANI AYURVEDA — REVOLVING HERBS SHOWCASE
 * Features 8 classical Ayurvedic herbs revolving in an interactive dynamic orbit
 * Supports smooth cursor popping, live inspect tooltips, and detailed modal popup.
 */

const HERBS_LIST = [
  {
    id: "amla",
    name: "Amla",
    hindi: "अमला",
    botanical: "Phyllanthus emblica",
    image: "/images/herb-amla.png",
    tagline: "The Supreme Rejuvenator (Rasayana)",
    role: "Rich in natural Vitamin C; fortifies hair roots, prevents premature graying, and enhances lustrous shine.",
    benefits: [
      "Rich source of Vitamin C and bioflavonoids",
      "Strengthens hair follicles from the roots",
      "Imparts natural dark luster and shine",
      "Combats oxidative scalp stress"
    ],
    products: ["Ayurvedic Hair Oil", "Herbal Shampoo"]
  },
  {
    id: "reetha",
    name: "Reetha",
    hindi: "रीठा",
    botanical: "Sapindus mukorossi (Soapnut)",
    image: "/images/herb-reetha.png",
    tagline: "Nature's Pure Cleansing Saponin",
    role: "Produces mild natural lather that clears dirt and excess sebum without stripping delicate scalp lipids.",
    benefits: [
      "100% natural, hypoallergenic cleanser",
      "Gently cleanses excess oil and scalp impurities",
      "Maintains scalp pH balance and softness",
      "Leaves hair naturally bouncy"
    ],
    products: ["Herbal Shampoo"]
  },
  {
    id: "shikakai",
    name: "Shikakai",
    hindi: "शिकाकाई",
    botanical: "Acacia concinna",
    image: "/images/herb-shikakai.png",
    tagline: "Fruit for the Hair (Keshya)",
    role: "Ancient herbal cleanser & detangler rich in vitamins A, C, D, and K, famous for soft manageability.",
    benefits: [
      "Gentle natural cleansing with mild pH",
      "Soothes dry, itchy scalp and irritation",
      "Conditions strands and reduces split ends",
      "Detangles knots smoothly"
    ],
    products: ["Ayurvedic Hair Oil", "Herbal Shampoo"]
  },
  {
    id: "brahmi",
    name: "Brahmi",
    hindi: "ब्राह्मी",
    botanical: "Bacopa monnieri",
    image: "/images/herb-brahmi.png",
    tagline: "Mind & Crown Nourisher",
    role: "Cools the mind, reduces stress-induced shedding, and revitalizes microcirculation at hair roots.",
    benefits: [
      "Cools scalp heat (Pitta pacification)",
      "Reduces hair fall triggered by stress",
      "Strengthens hair fibers from root to tip",
      "Enhances relaxing champi massage"
    ],
    products: ["Ayurvedic Hair Oil", "Herbal Shampoo"]
  },
  {
    id: "kalonji",
    name: "Kalonji",
    hindi: "कलौंजी",
    botanical: "Nigella sativa (Black Seed)",
    image: "/images/herb-kalonji.png",
    tagline: "The Miracle Seed of Vitality",
    role: "Loaded with thymoquinone and essential fatty acids, it nourishes thinning hair and locks in deep moisture.",
    benefits: [
      "Contains potent thymoquinone antioxidant",
      "Improves hair density and scalp vitality",
      "Locks in deep moisture to curb breakage",
      "Nourishes dry, damaged shafts"
    ],
    products: ["Ayurvedic Hair Oil"]
  },
  {
    id: "jatamansi",
    name: "Jatamansi",
    hindi: "जटामांसी",
    botanical: "Nardostachys jatamansi",
    image: "/images/herb-jatamansi.png",
    tagline: "Sacred Calming Root for Follicle Growth",
    role: "Revered in Charaka Samhita for calming the nervous system and encouraging deep follicular revitalization.",
    benefits: [
      "Deeply calms agitated scalp tissues and nerves",
      "Supports follicular growth phase (anagen)",
      "Promotes deep hair conditioning",
      "Lends a calming botanical aroma"
    ],
    products: ["Ayurvedic Hair Oil"]
  },
  {
    id: "nagarmotha",
    name: "Nagarmotha",
    hindi: "नागरमोथा",
    botanical: "Cyperus scariosus / rotundus",
    image: "/images/herb-nagarmotha.png",
    tagline: "Microbiome Purifier & Root Anchor",
    role: "Controls excess sebum, alleviates persistent dandruff flakiness, and firmly anchors hair roots.",
    benefits: [
      "Controls excess scalp sebum and flakes",
      "Improves hair root anchoring strength",
      "Deeply purifies pores without harsh drying",
      "Supports lustrous, bouncy hair"
    ],
    products: ["Ayurvedic Hair Oil"]
  },
  {
    id: "amarbel",
    name: "Amarbel",
    hindi: "अमरबेल",
    botanical: "Cuscuta reflexa (Golden Dodder)",
    image: "/images/herb-amarbel.png",
    tagline: "Traditional Length & Density Booster",
    role: "A classical Indian botanical traditionally used to invigorate weak hair roots and promote longer, fuller growth.",
    benefits: [
      "Traditional Indian botanical for hair length retention",
      "Revitalizes dormant and thinning hair patches",
      "Improves hair strand elasticity and resistance",
      "Blends harmoniously in herbal hair oils"
    ],
    products: ["Ayurvedic Hair Oil"]
  }
];

class RevolvingHerbsOrbit {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.isPaused = false;
    this.speed = 1; // 1 = normal, 0.5 = slow, 2 = fast
    this.orbitRadius = 215; // default px radius
    this.init();
  }

  init() {
    this.updateRadius();
    window.addEventListener('resize', () => this.updateRadius());

    this.renderOrbit();
    this.bindControls();
    this.setupModal();
  }

  updateRadius() {
    if (window.innerWidth < 768) {
      this.orbitRadius = 160;
    } else {
      this.orbitRadius = 215;
    }
    this.positionNodes();
  }

  renderOrbit() {
    this.container.innerHTML = `
      <div class="orbit-glow-disc"></div>
      <div class="orbit-ring-track"></div>
      <div class="orbit-ring-inner"></div>

      <!-- Center Logo Core -->
      <div class="orbit-center-core" id="orbitCenterCore" title="Umanarayani Ayurveda">
        <img src="/images/logo.jpg" alt="Umanarayani Logo" class="core-logo">
        <span class="core-label">UMANARAYANI</span>
      </div>

      <!-- Revolving Orbit Rotator -->
      <div class="orbit-rotator" id="orbitRotator"></div>

      <!-- Controls Bar -->
      <div class="orbit-controls-bar">
        <span>🌿 Revolving Herbal Core</span>
        <button class="orbit-control-btn" id="btnToggleOrbit">
          <i class="fa-solid fa-pause"></i> Pause
        </button>
        <button class="orbit-control-btn" id="btnSpeedOrbit">
          <i class="fa-solid fa-gauge-high"></i> Speed: 1x
        </button>
      </div>
    `;

    this.rotator = document.getElementById('orbitRotator');
    this.centerCore = document.getElementById('orbitCenterCore');

    // Create Herb Nodes
    HERBS_LIST.forEach((herb, index) => {
      const node = document.createElement('div');
      node.className = 'herb-orbit-node';
      node.setAttribute('data-herb-id', herb.id);

      node.innerHTML = `
        <div class="herb-capsule">
          <img src="${herb.image}" alt="${herb.name}" class="herb-node-img">
        </div>
        <div class="herb-tooltip">
          <strong>${herb.name} (${herb.hindi})</strong>
          <span>${herb.tagline}</span>
        </div>
      `;

      // Cursor hover smooth popping & orbit pause
      node.addEventListener('mouseenter', () => {
        this.rotator.classList.add('paused');
      });

      node.addEventListener('mouseleave', () => {
        if (!this.isPaused) {
          this.rotator.classList.remove('paused');
        }
      });

      // Click to open detailed Herb Modal
      node.addEventListener('click', () => {
        this.openHerbModal(herb);
      });

      this.rotator.appendChild(node);
    });

    this.positionNodes();
  }

  positionNodes() {
    const nodes = this.rotator.querySelectorAll('.herb-orbit-node');
    const total = nodes.length;
    const r = this.orbitRadius;

    nodes.forEach((node, idx) => {
      const angle = (idx / total) * 2 * Math.PI;
      const x = Math.round(r * Math.cos(angle));
      const y = Math.round(r * Math.sin(angle));

      // Translate from the center
      node.style.transform = `translate(${x}px, ${y}px)`;
    });
  }

  bindControls() {
    const toggleBtn = document.getElementById('btnToggleOrbit');
    const speedBtn = document.getElementById('btnSpeedOrbit');

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.isPaused = !this.isPaused;
        if (this.isPaused) {
          this.rotator.classList.add('paused');
          toggleBtn.innerHTML = '<i class="fa-solid fa-play"></i> Resume';
        } else {
          this.rotator.classList.remove('paused');
          toggleBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
        }
      });
    }

    if (speedBtn) {
      const speeds = [
        { label: '1x', val: 36 },
        { label: '2x', val: 18 },
        { label: '0.5x', val: 54 }
      ];
      let speedIdx = 0;

      speedBtn.addEventListener('click', () => {
        speedIdx = (speedIdx + 1) % speeds.length;
        const current = speeds[speedIdx];
        this.rotator.style.animationDuration = `${current.val}s`;

        // Update counter-spin on capsules
        const capsules = this.rotator.querySelectorAll('.herb-capsule');
        capsules.forEach(cap => {
          cap.style.animationDuration = `${current.val}s`;
        });

        speedBtn.innerHTML = `<i class="fa-solid fa-gauge-high"></i> Speed: ${current.label}`;
      });
    }

    if (this.centerCore) {
      this.centerCore.addEventListener('click', () => {
        const prodSection = document.getElementById('productsSection');
        if (prodSection) {
          prodSection.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }
  }

  setupModal() {
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
            <h4 style="font-size:0.9rem; color:var(--green-primary); margin-bottom:8px;">Key Ayurvedic Benefits:</h4>
            <ul class="herb-modal-benefits-list" id="herbModalBenefits"></ul>
          </div>
          <div class="herb-modal-footer">
            <span style="font-size:0.82rem; color:var(--text-muted);" id="herbModalFeaturedIn"></span>
            <button class="btn-card-details" id="herbModalShopBtn" style="padding:6px 14px;">
              View Products &rarr;
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
    this.modal = modal;
  }

  openHerbModal(herb) {
    if (!this.modal) return;

    document.getElementById('herbModalImg').src = herb.image;
    document.getElementById('herbModalTitle').textContent = herb.name;
    document.getElementById('herbModalHindi').textContent = herb.hindi;
    document.getElementById('herbModalBotanical').textContent = herb.botanical;
    document.getElementById('herbModalRole').textContent = herb.role;

    const benefitsList = document.getElementById('herbModalBenefits');
    benefitsList.innerHTML = herb.benefits.map(b => `
      <li><i class="fa-solid fa-leaf"></i> <span>${b}</span></li>
    `).join('');

    document.getElementById('herbModalFeaturedIn').innerHTML = `Featured in: <strong>${herb.products.join(', ')}</strong>`;

    const shopBtn = document.getElementById('herbModalShopBtn');
    shopBtn.onclick = () => {
      this.modal.classList.remove('active');
      const prodSection = document.getElementById('productsSection');
      if (prodSection) prodSection.scrollIntoView({ behavior: 'smooth' });
    };

    this.modal.classList.add('active');
  }
}

// Global initialization helper
window.initRevolvingHerbs = function(containerId) {
  return new RevolvingHerbsOrbit(containerId);
};
