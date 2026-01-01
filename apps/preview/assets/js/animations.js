/**
 * animations.js - Core GSAP Animations
 *
 * Handles page load animations. All animations enhance content
 * but never block rendering - content is visible by default.
 */

document.addEventListener("DOMContentLoaded", function () {
  // Safety check - ensure GSAP is loaded
  if (typeof gsap === "undefined") {
    console.warn("GSAP not loaded, animations disabled");
    return;
  }

  // Register ScrollTrigger if available
  if (typeof ScrollTrigger !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);
  }

  // Hero Section - Fade in and move up on page load
  initHeroAnimations();

  // Navigation animation
  initNavAnimation();

  // Initialize satisfying card hover animations
  initCardAnimations();
});

/**
 * Hero Section Animations
 * Fades in and moves up the hero content on page load
 */
function initHeroAnimations() {
  const heroContent = document.getElementById("hero-content");

  if (!heroContent) return;

  // Set initial state (visible but will animate)
  gsap.set(heroContent.children, {
    opacity: 0,
    y: 30,
  });

  // Animate hero elements with stagger
  gsap.to(heroContent.children, {
    opacity: 1,
    y: 0,
    duration: 0.8,
    stagger: 0.15,
    ease: "power3.out",
    delay: 0.2,
  });

  // Animate gradient orbs
  const orbs = document.querySelectorAll(".pulse-glow");
  if (orbs.length) {
    gsap.fromTo(
      orbs,
      { scale: 0.8, opacity: 0 },
      {
        scale: 1,
        opacity: 1,
        duration: 1.5,
        ease: "power2.out",
        stagger: 0.3,
      }
    );
  }
}

/**
 * Navigation Animation
 * Subtle fade-in for the navbar
 */
function initNavAnimation() {
  const nav = document.querySelector("nav");

  if (!nav) return;

  gsap.from(nav, {
    y: -20,
    opacity: 0,
    duration: 0.6,
    ease: "power2.out",
    delay: 0.1,
  });
}

/**
 * Card Hover Animations
 * Satisfying micro-interactions for cards
 */
function initCardAnimations() {
  const cards = document.querySelectorAll(".card, .testimonial-card");

  cards.forEach((card) => {
    const icon = card.querySelector(".icon-container");

    // Create magnetic effect on hover
    card.addEventListener("mouseenter", function (e) {
      // Scale up icon with bounce
      if (icon) {
        gsap.to(icon, {
          scale: 1.15,
          rotation: 5,
          duration: 0.4,
          ease: "back.out(1.7)",
        });
      }

      // Add glow pulse
      gsap.to(card, {
        boxShadow:
          "0 25px 50px -12px rgba(14, 165, 233, 0.3), 0 0 30px rgba(14, 165, 233, 0.1)",
        duration: 0.3,
        ease: "power2.out",
      });
    });

    card.addEventListener("mouseleave", function () {
      if (icon) {
        gsap.to(icon, {
          scale: 1,
          rotation: 0,
          duration: 0.4,
          ease: "power2.out",
        });
      }

      gsap.to(card, {
        boxShadow: "none",
        duration: 0.3,
        ease: "power2.out",
      });
    });

    // Subtle tilt effect following cursor
    card.addEventListener("mousemove", function (e) {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = (y - centerY) / 20;
      const rotateY = (centerX - x) / 20;

      gsap.to(card, {
        rotateX: rotateX,
        rotateY: rotateY,
        duration: 0.3,
        ease: "power2.out",
        transformPerspective: 1000,
      });
    });

    card.addEventListener("mouseleave", function () {
      gsap.to(card, {
        rotateX: 0,
        rotateY: 0,
        duration: 0.5,
        ease: "power2.out",
      });
    });
  });

  // Button hover animations
  const buttons = document.querySelectorAll(".btn-glow");
  buttons.forEach((btn) => {
    btn.addEventListener("mouseenter", function () {
      gsap.to(btn, {
        scale: 1.02,
        duration: 0.2,
        ease: "power2.out",
      });
    });

    btn.addEventListener("mouseleave", function () {
      gsap.to(btn, {
        scale: 1,
        duration: 0.2,
        ease: "power2.out",
      });
    });
  });
}

/**
 * Stat Counter Animation
 * Animates numbers counting up
 */
function animateStats() {
  const stats = document.querySelectorAll(".stat-item");

  stats.forEach((stat) => {
    const valueEl = stat.querySelector(".gradient-text-accent");
    if (!valueEl) return;

    const text = valueEl.textContent;
    const number = parseInt(text.replace(/[^0-9]/g, ""));
    const suffix = text.replace(/[0-9]/g, "");

    if (isNaN(number)) return;

    gsap.from(
      { val: 0 },
      {
        val: number,
        duration: 2,
        ease: "power2.out",
        onUpdate: function () {
          const current = Math.floor(this.targets()[0].val);
          if (current >= 1000) {
            valueEl.textContent =
              (current / 1000).toFixed(0) + "K" + suffix.replace("K", "");
          } else {
            valueEl.textContent = current + suffix;
          }
        },
      }
    );
  });
}
