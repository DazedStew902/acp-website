/* =====================================================================
   main.js
   ACP Landscaping Website Scripts

   Structure:
   1) Intro Overlay (blocks scrolling until dismissed)
   2) Mobile Menu (burger toggle + close behaviors)
   3) Header Scroll State (adds/removes .is-scrolled)

   Notes:
   - Wrapped in IIFEs to avoid polluting global scope.
   - Uses defensive DOM lookups (early returns if elements missing).
===================================================================== */

/* =========================================================
   1) INTRO OVERLAY (Session-based)
   - Shows once per tab session (sessionStorage).
   - Prevents underlying page scroll until dismissed.
   - Dismiss via wheel / touch swipe.
   - Auto-completes dismissal once user passes 50%.
========================================================= */
(() => {
  const KEY = "acp_intro_seen";
  const overlay = document.getElementById("introOverlay");
  if (!overlay) return;

  // Show once per tab session:
  // - If you've already seen it in this tab, remove immediately.
  if (sessionStorage.getItem(KEY) === "true") {
    overlay.remove();
    return;
  }
  sessionStorage.setItem(KEY, "true");

  // Start at the top so the overlay experience is consistent.
  window.scrollTo(0, 0);

  let dismissed = false;

  // "target" = where we want the overlay to go
  // "current" = where it visually is (smoothed toward target)
  let target = 0;
  let current = 0;

  // Utility: safest "viewport height" source for the overlay math.
    const getMax = () => {
    const h = window.innerHeight || 1;

    // Mobile: require less scroll distance to fully dismiss
    // (Feels much lighter while preserving the same visual design.)
    return isMobile ? Math.round(h * 0.72) : h;
  };

    /* -----------------------------
     Tuning knobs (UX feel)
     - Desktop: premium / weighty
     - Mobile: faster + less “work”
  ------------------------------ */
  const isMobile =
    window.matchMedia?.("(max-width: 520px)")?.matches ?? false;

  // On mobile we want the overlay to move farther per swipe/wheel,
  // and catch up faster so it doesn’t feel “stuck.”
  const RESISTANCE = isMobile ? 1.15 : 0.65;     // higher = lighter/faster
  const SMOOTHING = isMobile ? 0.22 : 0.12;      // higher = snappier
  const FADE_START = isMobile ? 0.18 : 0.30;     // start fading sooner on mobile
  const FADE_END = 1.00;

  // Mobile snaps away earlier (less scrolling required)
  const AUTO_DISMISS_AT = isMobile ? 0.32 : 0.5;

  // Faster snap detection on mobile
  const SNAP_DELAY_MS = isMobile ? 90 : 140;

  // Clamp utility (keeps values within an expected range).
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  // Applies transform + opacity based on scroll progress.
  const apply = (posPx) => {
    const max = getMax();
    const p = clamp(posPx / max, 0, 1);

    // Slide up as it progresses (CSS var consumed in .intro-overlay).
    overlay.style.setProperty("--introY", `${-posPx}px`);

    // Luxury fade curve: stay opaque early, then fade smoothly.
    let opacity = 1;
    if (p > FADE_START) {
      const t = (p - FADE_START) / (FADE_END - FADE_START); // 0..1
      // easeOutCubic for a premium fade
      const eased = 1 - Math.pow(1 - clamp(t, 0, 1), 3);
      opacity = 1 - eased;
    }
    overlay.style.setProperty("--introOpacity", `${opacity}`);
  };

    // Debounce timer used to detect "input end" for wheel/trackpad
  let snapTimerId = null;

  /**
   * Decide where the overlay should settle after the user stops interacting.
   * - < 50% progress => snap back closed (0)
   * - >= 50% progress => snap fully dismissed (max)
   */
  const snapToNearest = () => {
    if (dismissed) return;

    const max = getMax();
    const threshold = max * AUTO_DISMISS_AT;

    target = target >= threshold ? max : 0;
  };

  /**
   * Schedules snap logic after a short period of no input.
   * Wheel events come in bursts; this debounce approximates "wheel end".
   */
  const scheduleSnap = () => {
    if (snapTimerId) window.clearTimeout(snapTimerId);
    snapTimerId = window.setTimeout(() => {
      snapTimerId = null;
      snapToNearest();
    }, SNAP_DELAY_MS);
  };


  // Animation loop for smoothing/inertia.
  const tick = () => {
    if (dismissed) return;

    const max = getMax();

    // Smoothly interpolate current toward target (inertia).
    current += (target - current) * SMOOTHING;

    /* --------------------------------------------------------
       AUTO-COMPLETE DISMISSAL
       If the user scrolls past AUTO_DISMISS_AT, complete the
       rest automatically by snapping the target to max.
       The animation remains smooth because "current" still lerps.
    -------------------------------------------------------- */
    if (target >= max * AUTO_DISMISS_AT) {
      target = max;
    }

    // Snap when extremely close to avoid endless micro movement.
    if (Math.abs(target - current) < 0.25) {
      current = target;
    }

    apply(current);

    /* --------------------------------------------------------
       FINAL CLEANUP
       Remove once fully slid out so the page can scroll normally.
    -------------------------------------------------------- */
    if (target >= max - 1 && current >= max - 1) {
      dismissed = true;
      overlay.remove();
      return;
    }

    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  /* --------------------------------------------------------
     INPUT HANDLERS (blocks page scroll until dismissed)
  -------------------------------------------------------- */

  // Wheel (desktop / trackpad)
  const onWheel = (e) => {
    if (dismissed) return;
    if (e.deltaY <= 0) return;

    // Prevent underlying page from scrolling while overlay is active.
    e.preventDefault();

    const max = getMax();
    target = clamp(target + e.deltaY * RESISTANCE, 0, max);

    // After wheel input stops, snap to 0% or 100% depending on progress
    scheduleSnap();
  };

  // Touch (mobile)
  let touchStartY = null;

  const onTouchStart = (e) => {
    if (dismissed) return;
    touchStartY = e.touches?.[0]?.clientY ?? null;
  };

  const onTouchMove = (e) => {
    if (dismissed) return;
    if (touchStartY == null) return;

    const currentY = e.touches?.[0]?.clientY ?? touchStartY;
    const dy = touchStartY - currentY; // swipe up => positive

    if (dy <= 0) return;

    // Prevent underlying page from scrolling while overlay is active.
    e.preventDefault();

    const max = getMax();
        const touchBoost = isMobile ? 1.2 : 1.0;
    target = clamp(target + dy * RESISTANCE * touchBoost, 0, max);

    // Update start to support continuous swipe.
    touchStartY = currentY;
  };

  // NOTE: passive:false is REQUIRED so preventDefault() works.
  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: false });

    /* --------------------------------------------------------
     RESET ON FULL PAGE RELOAD
     We intentionally clear the session flag so the intro
     shows again whenever the page is refreshed/reloaded.
  -------------------------------------------------------- */
  window.addEventListener("beforeunload", () => {
    sessionStorage.removeItem(KEY);
  });

  /* --------------------------------------------------------
     RESPONSIVE SAFETY
     Clamp values if viewport changes (rotation / resize).
  -------------------------------------------------------- */
  window.addEventListener("resize", () => {
    if (dismissed) return;
    const max = getMax();
    target = clamp(target, 0, max);
    current = clamp(current, 0, max);
  });

  /* --------------------------------------------------------
     IMPORTANT BEHAVIOR NOTE:
     We intentionally DO NOT clear sessionStorage on unload.
     That would cause the intro to reappear on refresh, which
     contradicts "show once per tab session".
  -------------------------------------------------------- */
})();

/* =========================================================
   2) MOBILE MENU
   - Burger toggles dropdown visibility.
   - Smooth open/close animation.
   - Closes on link click and on ESC.
========================================================= */
(() => {
  const burger = document.getElementById("burgerBtn");
  const menu = document.getElementById("mobileMenu");
  if (!burger || !menu) return;

  // Open the menu:
  // - Unhide immediately
  // - Next frame: apply animation classes for smooth transition
  const openMenu = () => {
    menu.hidden = false;

    requestAnimationFrame(() => {
      burger.classList.add("is-open");
      menu.classList.remove("is-closing");
      menu.classList.add("is-open");
      burger.setAttribute("aria-expanded", "true");
    });
  };

  // Close the menu:
  // - Apply closing animation class
  // - After animation duration, hide the element
  const closeMenu = () => {
    menu.classList.remove("is-open");
    menu.classList.add("is-closing");
    burger.classList.remove("is-open");
    burger.setAttribute("aria-expanded", "false");

    // Match the CSS transition time for .mobile-menu
    setTimeout(() => {
      menu.hidden = true;
      menu.classList.remove("is-closing");
    }, 220);
  };

  // Toggle open/close on burger click.
  burger.addEventListener("click", () => {
    const isOpen = burger.classList.contains("is-open");
    isOpen ? closeMenu() : openMenu();
  });

  // When a link is clicked:
  // - Add a brief pressed state (visual feedback)
  // - Close the menu
  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      link.classList.add("is-pressed");
      setTimeout(() => link.classList.remove("is-pressed"), 250);

      closeMenu();
    });
  });

  // ESC closes menu (accessibility + common UX convention).
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !menu.hidden) {
      closeMenu();
    }
  });
})();

/* =========================================================
   3) HEADER SCROLL STATE
   - Adds/removes .is-scrolled once user scrolls down a bit.
   - CSS uses this to darken/compact header.
========================================================= */
(() => {
  const header = document.getElementById("siteHeader");
  if (!header) return;

  const onScroll = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 10);
  };

  // Passive scroll listener = better performance.
  window.addEventListener("scroll", onScroll, { passive: true });

  // Initialize state on page load.
  onScroll();
})();

/* =========================================================
   CHECKLIST TYPING ANIMATION
   - Triggers once when the checklist section scrolls into view
   - Types each line sequentially (no overlap)
   - Includes fallbacks + more reliable IntersectionObserver settings
   - Respects prefers-reduced-motion (shows instantly)
========================================================= */
(() => {
  const section = document.getElementById("checklist");
  if (!section) return;

  const logo = section.querySelector(".checklist__logo");
  const items = Array.from(section.querySelectorAll(".checklist__item"));
  if (!logo || items.length === 0) return;

  // Accessibility: respect reduced motion preference
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

    // Typing configuration (humanized)
  const BASE_CHAR_DELAY_MS = 32;   // average per-character delay
  const CHAR_JITTER_MS = 26;       // random +/- jitter (human variability)
  const WORD_PAUSE_MS = 90;        // small pause occasionally at word boundaries
  const PUNCT_PAUSE_MS = 140;      // pause after punctuation for realism
  const LINE_PAUSE_MS = 260;       // pause between lines (lets user “read”)


  // Guard so the animation runs only once
  let hasRun = false;

    // Timing helper (promise-based sleep)
  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

    /**
   * Types text into an element with human-like pacing.
   * - Adds variability per character
   * - Adds subtle pauses for spaces and punctuation
   * - Arms the checkmark just before typing begins
   */
  const typeLine = async (el, text) => {
    // “Arm” the check badge right before typing begins
    el.classList.add("is-armed");
    await sleep(110);

    // Cursor on while typing
    el.classList.add("is-typing");
    el.textContent = "";

    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      el.textContent += ch;

      // Base delay with jitter (human variability)
      const jitter = (Math.random() * CHAR_JITTER_MS * 2) - CHAR_JITTER_MS; // -jitter..+jitter
      let delay = Math.max(10, BASE_CHAR_DELAY_MS + jitter);

      // Add natural pauses for punctuation and some word breaks
      if (/[,.!?:;]/.test(ch)) delay += PUNCT_PAUSE_MS;
      if (ch === " " && Math.random() < 0.22) delay += WORD_PAUSE_MS;

      // Occasional micro-hesitation (rare, keeps it organic)
      if (Math.random() < 0.03) delay += 120;

      await sleep(delay);
    }

    el.classList.remove("is-typing");
  };

  /**
   * Runs the full checklist animation:
   * 1) Fade in the logo
   * 2) Sequentially type each list item
   */
  const runChecklist = async () => {
    if (hasRun) return;
    hasRun = true;

    // Logo fade-in (CSS transition is tied to this class)
    logo.classList.add("is-visible");

    // Reduced motion: render instantly, no typing/cursor animation
        if (prefersReducedMotion) {
      logo.classList.add("is-visible");
      items.forEach((el) => {
        el.classList.add("is-armed");
        el.textContent = el.dataset.text || "";
      });
      return;
    }

    // Sequential typing: each line waits for the previous to finish
    for (const el of items) {
      await typeLine(el, el.dataset.text || "");
      await sleep(LINE_PAUSE_MS);
    }
  };

  /**
   * Small helper to detect if the section is already in view
   * (e.g., on refresh, anchor navigation, or fast scroll).
   */
const isInViewNow = () => {
  const rect = section.getBoundingClientRect();
  const vh = window.visualViewport?.height || window.innerHeight || 1;
  return rect.top < vh * 0.85 && rect.bottom > vh * 0.15;
};

  // If already in view on load, run immediately
  if (isInViewNow()) {
    runChecklist();
    return;
  }

  /* --------------------------------------------------------
     Trigger using IntersectionObserver (preferred)
     - threshold lowered for reliability
     - rootMargin triggers slightly earlier for a “premium” feel
  -------------------------------------------------------- */
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          runChecklist();
          observer.disconnect();
        }
      },
      {
        // Trigger a bit before the section is fully visible
        rootMargin: "0px 0px -15% 0px",
        threshold: 0.12,
      }
    );

    observer.observe(section);
    return;
  }

  /* --------------------------------------------------------
     Fallback (older browsers): run on scroll once section enters view
  -------------------------------------------------------- */
  const onScrollFallback = () => {
    if (hasRun) return;
    if (isInViewNow()) {
      runChecklist();
      window.removeEventListener("scroll", onScrollFallback);
    }
  };

  window.addEventListener("scroll", onScrollFallback, { passive: true });
  onScrollFallback();
})();

/* =========================================================
   CHECKLIST TITLE RULE SCROLL ANIMATION (Pulse Through Section)
   - Expands as you scroll into the section
   - Peaks around the middle
   - Contracts as you scroll past
   - Runs only when the section is near the viewport (performance)
   - Self-contained: includes its own helpers (no external deps)
========================================================= */
(() => {
  const section = document.getElementById("checklist");
  if (!section) return;

  const prefersReducedMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

  // Reduced motion: keep the rule fully expanded and skip scroll animation
  if (prefersReducedMotion) {
    section.style.setProperty("--ruleScale", "1");
    return;
  }

  // Local helpers (self-contained)
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  let isActive = false;
  let rafId = null;

  /**
   * Updates --ruleScale based on where the section is in the viewport.
   * Uses a "pulse" curve so it expands then contracts as you scroll through.
   */
  const updateRuleScale = () => {
    rafId = null;
    if (!isActive) return;

    const rect = section.getBoundingClientRect();
    const vh = window.visualViewport?.height || window.innerHeight || 1;

    // Use a stable height reference for progress math
    const sectionHeight = section.offsetHeight || rect.height || 1;

    /* --------------------------------------------------------
       SECTION PROGRESS (0..1)
       p=0 when the section just starts entering the viewport
       p=1 when the section is fully past the viewport (exiting)
    -------------------------------------------------------- */
    const start = vh;                 // section top aligned with bottom of viewport
    const end = -sectionHeight;       // section bottom aligned with top of viewport

    const rawProgress = (start - rect.top) / (start - end);
    const p = clamp(rawProgress, 0, 1);

    /* --------------------------------------------------------
       PULSE: 0 → 1 → 0 across the scroll
       sin(pi * p) peaks at p=0.5 (middle of section).
    -------------------------------------------------------- */
    const pulse = Math.sin(Math.PI * p);

    // Gentle easing so it feels less mechanical
    const eased = 1 - Math.pow(1 - pulse, 2.2);

    section.style.setProperty("--ruleScale", eased.toFixed(3));
  };

  /**
   * Throttle scroll/resize using requestAnimationFrame for smoothness.
   */
  const requestUpdate = () => {
    if (rafId != null) return;
    rafId = window.requestAnimationFrame(updateRuleScale);
  };

  // Only animate while the section is near the viewport
  const onIntersect = (entries) => {
    const entry = entries[0];
    isActive = !!entry?.isIntersecting;
    if (isActive) requestUpdate();
  };

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(onIntersect, {
      // Activate slightly before it appears and keep active slightly after
      rootMargin: "30% 0px 30% 0px",
      threshold: 0.01,
    });

    observer.observe(section);
  } else {
    // Fallback: always active (older browsers)
    isActive = true;
  }

  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);

  // Initialize
  requestUpdate();
})();

/* =========================================================
   SERVICE PANELS: In-view Reveal Only (No Parallax)
   - Adds .is-visible for the content fade-in
   - Zero transform work on scroll (mobile-safe)
========================================================= */
(() => {
  const panels = Array.from(document.querySelectorAll(".service-panel"));
  if (panels.length === 0) return;

  const prefersReducedMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

  if (prefersReducedMotion) {
    panels.forEach((p) => p.classList.add("is-visible"));
    return;
  }

  if (!("IntersectionObserver" in window)) {
    panels.forEach((p) => p.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("is-visible");
      });
    },
    { rootMargin: "18% 0px 18% 0px", threshold: 0.01 }
  );

  panels.forEach((p) => observer.observe(p));
})();

/* =========================================================
   SCROLL REVEAL (Reusable)
   - Animates elements with [data-reveal] into view
   - Reverses when scrolling back up
   - Does not move the page (transform/opacity only)
========================================================= */
(() => {
  const init = () => {
    const revealEls = Array.from(document.querySelectorAll("[data-reveal]"));
    if (revealEls.length === 0) return;

    const prefersReducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

    // Reduced motion: reveal instantly
    if (prefersReducedMotion) {
      revealEls.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle("is-visible", entry.isIntersecting);
        });
      },
      {
        // Trigger slightly before it's fully visible
        rootMargin: "0px 0px -12% 0px",
        threshold: 0.15,
      }
    );

    revealEls.forEach((el) => observer.observe(el));
  };

  // Safe init even if script moves to <head> later
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/* =========================================================
   iOS VIEWPORT HEIGHT (SCROLL-STABLE)
   - visualViewport.resize fires during scroll on iOS
   - Freeze vh during scrolling to prevent layout thrash
========================================================= */
(() => {
  let rafId = null;
  let frozen = false;

  const setVH = () => {
    rafId = null;
    if (frozen) return;

    const h =
      window.visualViewport?.height ||
      window.innerHeight ||
      document.documentElement.clientHeight;

    document.documentElement.style.setProperty("--vh", `${h * 0.01}px`);
  };

  const requestVH = () => {
    if (rafId != null) return;
    rafId = requestAnimationFrame(setVH);
  };

  // Freeze during active scroll
  const onScrollStart = () => { frozen = true; };
  const onScrollEnd = () => {
    frozen = false;
    requestVH();
  };

  let scrollTimeout;
  window.addEventListener("scroll", () => {
    onScrollStart();
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(onScrollEnd, 120);
  }, { passive: true });

  // Only update on real resizes / rotation
  window.addEventListener("orientationchange", requestVH);
  window.addEventListener("resize", requestVH);

  requestVH();
})();

/* =========================================================
   TAKEOVER STACK DRIVER (Smoothed for Mobile)
   - Scroll sets a target progress value
   - requestAnimationFrame eases current progress toward the target
   - Eliminates “bursty” scroll-event updates on iOS Safari
   - Transforms only (GPU-friendly)
========================================================= */
(() => {
  const scene = document.getElementById("takeoverScene");
  const viewport = scene?.querySelector(".takeover-viewport");
  if (!scene || !viewport) return;

  const prefersReducedMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  if (prefersReducedMotion) return;

  // Panels in DOM order: Maintenance, Design, Development, ...
  const panels = Array.from(viewport.querySelectorAll("[data-stack-panel]"));
  if (panels.length === 0) return;

  const isMobile =
  window.matchMedia?.("(max-width: 980px)")?.matches ?? false;

  // Let CSS scale scene height automatically
  scene.style.setProperty("--stackCount", String(panels.length));

  // Layer order: checklist is z=1, panels start at z=2+
  panels.forEach((panel, i) => {
    panel.style.zIndex = String(2 + i);
  });

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  // Smoothing: higher = snappier, lower = more “weight”
  // Good mobile range: 0.12–0.18
  const SMOOTHING = 0.14;

  let vh =
  (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--vh")) || 0) *
    100 ||
  (window.innerHeight || 1);

  // Scroll-driven target vs eased current
  let targetProgress = 0;  // 0..panels.length
  let currentProgress = 0; // 0..panels.length
    // Direction-change stabilizer:
  // iOS scroll input is bursty; reversing direction can cause the smoothed
  // progress to “fight” the new target, producing a visible jump.
  let lastTarget = 0;
  let lastDir = 0;          // -1, 0, +1
  let boostFrames = 0;      // temporarily increases smoothing to catch up

  let rafId = null;

  /**
   * Uses currentProgress (smoothed) to position all panels.
   * translate3d is used to encourage GPU compositing on mobile.
   */
  const applyTransforms = (progress) => {
    const activeIndex = Math.floor(progress);
    const t = progress - activeIndex; // 0..1 within active segment

    // Toggle takeover state for your parallax system
    const inTakeover = progress > 0 && progress < panels.length;
    document.documentElement.classList.toggle("is-takeover-active", inTakeover);

    panels.forEach((panel, i) => {
      let yPct = 100;

      if (i < activeIndex) {
        yPct = 0;
      } else if (i === activeIndex) {
        yPct = (1 - t) * 100;
      } else {
        yPct = 100;
      }

      panel.style.transform = `translate3d(0, ${yPct}%, 0)`;
    });
  };

  const sceneTop = scene.offsetTop;
const sceneHeight = scene.offsetHeight;

const updateTargetFromScroll = () => {
  const scrollY = window.scrollY || window.pageYOffset;
  const progressPx = scrollY - sceneTop;

  const nextTarget = clamp(
    progressPx / vh,
    0,
    panels.length
  );

  targetProgress = nextTarget;

  if (rafId == null) {
    rafId = requestAnimationFrame(tick);
  }
};

  /**
   * RAF ticker: ease currentProgress toward targetProgress for smooth motion.
   */
  const tick = () => {
    rafId = null;

    // Ease toward target
        // Temporarily increase smoothing when direction flips to prevent “jump”
    const smoothingNow = boostFrames > 0 ? 0.34 : SMOOTHING;
    if (boostFrames > 0) boostFrames -= 1;

    currentProgress += (targetProgress - currentProgress) * smoothingNow;

    // Snap when extremely close (prevents endless micro-updates)
    if (Math.abs(targetProgress - currentProgress) < 0.0008) {
      currentProgress = targetProgress;
    }
    if (!isMobile && lastDir !== 0 && dir !== 0 && dir !== lastDir) {
  boostFrames = 10;
}

    applyTransforms(currentProgress);

    // Continue ticking while takeover is active OR while we're catching up
    const needsMoreFrames =
      (currentProgress > 0 && currentProgress < panels.length) ||
      Math.abs(targetProgress - currentProgress) >= 0.0008;

    if (needsMoreFrames) {
      rafId = window.requestAnimationFrame(tick);
    }
  };

  /**
   * Resize: keep vh current (important on iOS address bar changes).
   */
  const onResize = () => {
  vh =
    (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--vh")) || 0) *
      100 ||
    (window.innerHeight || 1);

  updateTargetFromScroll();
};

window.addEventListener("scroll", updateTargetFromScroll, { passive: true });
window.addEventListener("resize", onResize, { passive: true });
window.addEventListener("orientationchange", onResize, { passive: true });

  // Initial paint
  updateTargetFromScroll();
})();

/* =========================================================
   FOOTER YEAR (Auto)
   - Keeps copyright current
========================================================= */
(() => {
  const yearEl = document.getElementById("year");
  if (!yearEl) return;
  yearEl.textContent = String(new Date().getFullYear());
})();