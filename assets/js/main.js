/* =========================================================
   Veda Jyothi Pathashala — site behaviour
   ========================================================= */
(function () {
  "use strict";

  var STORAGE_KEY = "vjp-lang";
  var DEFAULT_LANG = "te";
  var SUPPORTED = ["te", "en"];
  var dict = window.VJP_I18N || {};

  /* ---------------- language ---------------- */

  function storedLang() {
    try {
      var v = window.localStorage.getItem(STORAGE_KEY);
      return SUPPORTED.indexOf(v) > -1 ? v : DEFAULT_LANG;
    } catch (e) {
      return DEFAULT_LANG;
    }
  }

  function persistLang(lang) {
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      /* private mode — language simply won't persist */
    }
  }

  function translate(key, lang) {
    var table = dict[lang];
    return table && Object.prototype.hasOwnProperty.call(table, key) ? table[key] : null;
  }

  function applyLang(lang) {
    var table = dict[lang];
    if (!table) return;

    document.documentElement.setAttribute("lang", lang);

    // Text / HTML nodes
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var value = translate(el.getAttribute("data-i18n"), lang);
      if (value === null) return;
      el.innerHTML = value;
    });

    // Attributes: data-i18n-placeholder / -aria / -title / -alt
    var attrMap = {
      "data-i18n-placeholder": "placeholder",
      "data-i18n-aria": "aria-label",
      "data-i18n-title": "title",
      "data-i18n-alt": "alt"
    };
    Object.keys(attrMap).forEach(function (dataAttr) {
      document.querySelectorAll("[" + dataAttr + "]").forEach(function (el) {
        var value = translate(el.getAttribute(dataAttr), lang);
        if (value !== null) el.setAttribute(attrMap[dataAttr], value);
      });
    });

    // Document title + meta description
    var body = document.body;
    if (body) {
      var titleKey = body.getAttribute("data-title-key");
      var titleValue = titleKey && translate(titleKey, lang);
      if (titleValue) document.title = titleValue;

      var descKey = body.getAttribute("data-desc-key");
      var descValue = descKey && translate(descKey, lang);
      var descTag = document.querySelector('meta[name="description"]');
      if (descValue && descTag) descTag.setAttribute("content", descValue);
    }

    // Toggle button state
    document.querySelectorAll(".lang-btn").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.getAttribute("data-lang") === lang));
    });
  }

  function initLang() {
    var lang = storedLang();
    applyLang(lang);

    document.querySelectorAll(".lang-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var next = btn.getAttribute("data-lang");
        if (SUPPORTED.indexOf(next) === -1 || next === document.documentElement.lang) return;
        persistLang(next);
        applyLang(next);
      });
    });
  }

  /* ---------------- navigation ---------------- */

  function initNav() {
    var toggle = document.getElementById("navToggle");
    var nav = document.getElementById("siteNav");
    if (!toggle || !nav) return;

    function close() {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }

    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", close);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });

    document.addEventListener("click", function (e) {
      if (!nav.contains(e.target) && !toggle.contains(e.target)) close();
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 900) close();
    });
  }

  function markActiveLink() {
    var here = window.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".site-nav a").forEach(function (link) {
      var target = link.getAttribute("href");
      if (!target || target.charAt(0) === "#") return;
      if (target === here) link.classList.add("is-active");
    });
  }

  function initHeaderShadow() {
    var header = document.getElementById("siteHeader");
    if (!header) return;
    function update() {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
  }

  /* ---------------- reveal on scroll ---------------- */

  function initReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!items.length) return;

    function showAll() {
      items.forEach(function (el) { el.classList.add("is-visible"); });
    }

    // Arm the animation only now that JS is running.
    document.documentElement.classList.add("js");

    if (!("IntersectionObserver" in window)) {
      showAll();
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

    items.forEach(function (el, i) {
      el.style.transitionDelay = Math.min(i % 4, 3) * 80 + "ms";
      observer.observe(el);
    });

    // Failsafe: nothing stays hidden, whatever happens with the observer.
    window.setTimeout(showAll, 4000);
  }

  /* ---------------- contact form → WhatsApp ---------------- */

  function initContactForm() {
    var form = document.getElementById("enquiryForm");
    if (!form) return;
    var status = document.getElementById("formStatus");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;

      var data = new FormData(form);
      var lang = document.documentElement.lang === "en" ? "en" : "te";
      var labels = lang === "en"
        ? { head: "Enquiry — Veda Jyothi Pathashala", name: "Name", phone: "Phone", place: "Place", subject: "Subject", msg: "Message" }
        : { head: "వేద జ్యోతి పాఠశాల — విచారణ", name: "పేరు", phone: "ఫోన్", place: "ఊరు", subject: "పాఠ్యాంశము", msg: "సందేశము" };

      var lines = [labels.head, ""];
      [["name", labels.name], ["phone", labels.phone], ["place", labels.place], ["subject", labels.subject], ["message", labels.msg]]
        .forEach(function (pair) {
          var value = (data.get(pair[0]) || "").toString().trim();
          if (value) lines.push(pair[1] + ": " + value);
        });

      var url = "https://wa.me/" + form.getAttribute("data-wa") + "?text=" + encodeURIComponent(lines.join("\n"));
      window.open(url, "_blank", "noopener");

      if (status) {
        status.textContent = translate("con.form.ok", lang) || "";
        status.classList.add("is-visible");
      }
    });
  }

  /* ---------------- footer year ---------------- */

  function initYear() {
    var el = document.getElementById("year");
    if (el) el.textContent = String(new Date().getFullYear());
  }

  /* ---------------- boot ---------------- */

  function boot() {
    initLang();
    initNav();
    markActiveLink();
    initHeaderShadow();
    initReveal();
    initContactForm();
    initYear();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
