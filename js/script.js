/* Phone menu + click-to-enlarge images. No libraries needed. */
(function () {
  "use strict";

  /* ---- Phone menu ---- */
  var toggle = document.querySelector(".menu-toggle");
  var nav = document.getElementById("site-nav");

  function closeMenu() {
    if (!nav || !toggle) return;
    nav.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  }

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) closeMenu();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("open")) {
        closeMenu();
        toggle.focus();
      }
    });
  }

  /* ---- Image viewer ---- */
  var dlg = document.createElement("dialog");
  dlg.className = "lightbox";
  dlg.setAttribute("aria-label", "Image viewer");
  dlg.innerHTML =
    '<button class="lb-close" type="button" aria-label="Close image">&times;</button>' +
    '<img alt="">' +
    '<p class="lb-cap"></p>';
  document.body.appendChild(dlg);

  var big = dlg.querySelector("img");
  var cap = dlg.querySelector(".lb-cap");

  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".work-btn");
    if (!btn) return;
    var img = btn.querySelector("img");
    var fc = btn.parentElement.querySelector("figcaption");
    big.src = img.currentSrc || img.src;
    big.alt = img.alt;
    cap.textContent = fc ? fc.textContent : img.alt;
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
  });

  dlg.addEventListener("click", function (e) {
    if (e.target === dlg || e.target.closest(".lb-close")) dlg.close();
  });
})();
