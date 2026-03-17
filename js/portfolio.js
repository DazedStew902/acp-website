/* =====================================================================
   portfolio.js — ACP Landscaping
   Purpose:
   - Reusable portfolio gallery slider
   - Supports previous / next buttons and dot navigation
   - Designed for commercial.html and residential.html
===================================================================== */

(function () {
  "use strict";

  /* =========================================================
     1) FIND ALL GALLERIES
  ========================================================= */
  const galleries = document.querySelectorAll("[data-gallery]");

  if (!galleries.length) return;

  galleries.forEach((gallery) => {
    const track = gallery.querySelector("[data-gallery-track]");
    const prevBtn = gallery.querySelector("[data-gallery-prev]");
    const nextBtn = gallery.querySelector("[data-gallery-next]");
    const dotsWrap = gallery.querySelector("[data-gallery-dots]");
    const slides = Array.from(track.children);
    const dots = dotsWrap ? Array.from(dotsWrap.children) : [];

    if (!track || !slides.length) return;

    let currentIndex = 0;

    /* =========================================================
       2) RENDER ACTIVE SLIDE
    ========================================================= */
    function renderGallery() {
      track.style.transform = `translateX(-${currentIndex * 100}%)`;

      slides.forEach((slide, index) => {
        slide.classList.toggle("is-active", index === currentIndex);
      });

      dots.forEach((dot, index) => {
        dot.classList.toggle("is-active", index === currentIndex);
      });
    }

    /* =========================================================
       3) PREVIOUS / NEXT CONTROLS
    ========================================================= */
    function goToPrevious() {
      currentIndex = currentIndex === 0 ? slides.length - 1 : currentIndex - 1;
      renderGallery();
    }

    function goToNext() {
      currentIndex = currentIndex === slides.length - 1 ? 0 : currentIndex + 1;
      renderGallery();
    }

    if (prevBtn) {
      prevBtn.addEventListener("click", goToPrevious);
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", goToNext);
    }

    /* =========================================================
       4) DOT NAVIGATION
    ========================================================= */
    dots.forEach((dot, index) => {
      dot.addEventListener("click", () => {
        currentIndex = index;
        renderGallery();
      });
    });

    /* =========================================================
       5) KEYBOARD SUPPORT
    ========================================================= */
    gallery.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") {
        goToPrevious();
      }

      if (event.key === "ArrowRight") {
        goToNext();
      }
    });

    gallery.setAttribute("tabindex", "0");

    /* =========================================================
       6) INITIALIZE
    ========================================================= */
    renderGallery();
  });
})();