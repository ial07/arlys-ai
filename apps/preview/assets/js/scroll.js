/**
 * scroll.js - ScrollTrigger Animations
 *
 * Handles scroll-based reveal animations using GSAP ScrollTrigger.
 * All sections are visible by default - animations only enhance the experience.
 */

document.addEventListener("DOMContentLoaded", function () {
  // Safety check - ensure GSAP and ScrollTrigger are loaded
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") {
    console.warn(
      "GSAP or ScrollTrigger not loaded, scroll animations disabled"
    );
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  // Initialize all scroll animations
  initSectionReveals();
  initFeatureCardStagger();
  initTestimonialReveals();
  initAboutSection();
  initContactSection();
  initParallaxEffects();
  initStatCounters();
});

/**
 * Section Reveal Animations
 * Each section fades and slides in when entering viewport
 */
function initSectionReveals() {
  const sections = document.querySelectorAll("section");

  sections.forEach((section, index) => {
    // Skip hero section
    if (section.id === "hero") return;

    const header = section.querySelector('[id$="-header"]');

    if (header) {
      gsap.from(header.children, {
        scrollTrigger: {
          trigger: header,
          start: "top 85%",
          toggleActions: "play none none reverse",
        },
        y: 40,
        opacity: 0,
        duration: 0.8,
        stagger: 0.1,
        ease: "power3.out",
      });
    }
  });
}

/**
 * Feature Cards Stagger Animation
 * Cards animate in sequentially with a satisfying stagger
 */
function initFeatureCardStagger() {
  const featuresGrid = document.getElementById("features-grid");

  if (!featuresGrid) return;

  const cards = featuresGrid.querySelectorAll(".feature-card");

  if (!cards.length) return;

  gsap.from(cards, {
    scrollTrigger: {
      trigger: featuresGrid,
      start: "top 75%",
      toggleActions: "play none none reverse",
    },
    y: 60,
    opacity: 0,
    scale: 0.95,
    duration: 0.7,
    stagger: {
      amount: 0.6,
      from: "start",
    },
    ease: "power3.out",
  });

  // Animate icons within cards
  cards.forEach((card) => {
    const icon = card.querySelector(".icon-container");
    if (icon) {
      gsap.from(icon, {
        scrollTrigger: {
          trigger: card,
          start: "top 80%",
          toggleActions: "play none none reverse",
        },
        scale: 0,
        rotation: -180,
        duration: 0.6,
        delay: 0.2,
        ease: "back.out(1.7)",
      });
    }
  });
}

/**
 * Testimonial Cards Animation
 */
function initTestimonialReveals() {
  const testimonialsGrid = document.getElementById("testimonials-grid");

  if (!testimonialsGrid) return;

  const cards = testimonialsGrid.querySelectorAll(".testimonial-card");

  if (!cards.length) return;

  gsap.from(cards, {
    scrollTrigger: {
      trigger: testimonialsGrid,
      start: "top 75%",
      toggleActions: "play none none reverse",
    },
    y: 50,
    opacity: 0,
    duration: 0.8,
    stagger: 0.15,
    ease: "power3.out",
  });

  // Animate star ratings
  cards.forEach((card) => {
    const stars = card.querySelectorAll("svg");
    gsap.from(stars, {
      scrollTrigger: {
        trigger: card,
        start: "top 80%",
        toggleActions: "play none none reverse",
      },
      scale: 0,
      duration: 0.3,
      stagger: 0.05,
      delay: 0.3,
      ease: "back.out(2)",
    });
  });
}

/**
 * About Section Animation
 */
function initAboutSection() {
  const aboutContent = document.getElementById("about-content");
  const aboutImage = document.getElementById("about-image");

  if (aboutContent) {
    gsap.from(aboutContent.children, {
      scrollTrigger: {
        trigger: aboutContent,
        start: "top 75%",
        toggleActions: "play none none reverse",
      },
      x: -50,
      opacity: 0,
      duration: 0.8,
      stagger: 0.1,
      ease: "power3.out",
    });
  }

  if (aboutImage) {
    gsap.from(aboutImage, {
      scrollTrigger: {
        trigger: aboutImage,
        start: "top 75%",
        toggleActions: "play none none reverse",
      },
      x: 50,
      opacity: 0,
      scale: 0.95,
      duration: 1,
      ease: "power3.out",
    });
  }
}

/**
 * Contact Section Animation
 */
function initContactSection() {
  const contactForm = document.getElementById("contact-form-container");

  if (!contactForm) return;

  gsap.from(contactForm, {
    scrollTrigger: {
      trigger: contactForm,
      start: "top 80%",
      toggleActions: "play none none reverse",
    },
    y: 40,
    opacity: 0,
    scale: 0.98,
    duration: 0.8,
    ease: "power3.out",
  });

  // Animate form inputs
  const inputs = contactForm.querySelectorAll("input, textarea, button");
  gsap.from(inputs, {
    scrollTrigger: {
      trigger: contactForm,
      start: "top 75%",
      toggleActions: "play none none reverse",
    },
    y: 20,
    opacity: 0,
    duration: 0.5,
    stagger: 0.08,
    delay: 0.3,
    ease: "power2.out",
  });
}

/**
 * Parallax Effects
 * Subtle parallax movement on scroll
 */
function initParallaxEffects() {
  // Parallax for gradient orbs
  const orbs = document.querySelectorAll(".pulse-glow");

  orbs.forEach((orb, index) => {
    gsap.to(orb, {
      scrollTrigger: {
        trigger: "#hero",
        start: "top top",
        end: "bottom top",
        scrub: 1,
      },
      y: 100 * (index + 1),
      ease: "none",
    });
  });

  // Parallax for hero background
  const hero = document.getElementById("hero");
  if (hero) {
    gsap.to(hero, {
      scrollTrigger: {
        trigger: hero,
        start: "top top",
        end: "bottom top",
        scrub: 1,
      },
      backgroundPosition: "50% 100%",
      ease: "none",
    });
  }
}

/**
 * Stat Counter Animation
 * Animates numbers counting up when in view
 */
function initStatCounters() {
  const stats = document.querySelectorAll(".stat-item");

  stats.forEach((stat) => {
    const valueEl = stat.querySelector(".gradient-text-accent");
    if (!valueEl) return;

    const originalText = valueEl.textContent;
    const hasK = originalText.includes("K");
    const hasPercent = originalText.includes("%");
    const hasPlus = originalText.includes("+");

    let number = parseFloat(originalText.replace(/[^0-9.]/g, ""));
    if (hasK) number = number * 1000;

    if (isNaN(number)) return;

    gsap.from(
      { val: 0 },
      {
        val: number,
        duration: 2,
        ease: "power2.out",
        scrollTrigger: {
          trigger: stat,
          start: "top 85%",
          toggleActions: "play none none reverse",
        },
        onUpdate: function () {
          const current = this.targets()[0].val;
          let display;

          if (hasK && current >= 1000) {
            display = Math.floor(current / 1000) + "K";
          } else if (hasPercent) {
            display = current.toFixed(1).replace(".0", "");
          } else {
            display = Math.floor(current);
          }

          if (hasPlus) display += "+";
          if (hasPercent) display += "%";

          valueEl.textContent = display;
        },
      }
    );
  });
}

/**
 * Smooth scroll for anchor links
 */
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute("href"));
    if (target) {
      gsap.to(window, {
        duration: 1,
        scrollTo: {
          y: target,
          offsetY: 80,
        },
        ease: "power3.inOut",
      });
    }
  });
});
