/* =========================================================
   Veda Jyothi Pathashala — daily panchangam

   Reads the pre-fetched window in data/panchangam.json and shows the entry
   for the current day. The day turns over at 4:00 AM IST, not midnight, so
   the board matches the panchangam convention regardless of when the data
   was fetched or where the visitor is in the world.
   ========================================================= */
(function () {
  "use strict";

  var DATA_URL = "data/panchangam.json";
  var ROLLOVER_HOUR = 4; // IST
  var IST_OFFSET_MS = 5.5 * 3600 * 1000;

  var HEAD = "🙏🕉️ శ్రీ గురుభ్యోనమః🕉️🙏🏻";
  var FOOT = ["సర్వేజనా సుఖినో భవంతు", "శుభమస్తు🙏", "గోమాతను పూజించండి", "గోమాతను సంరక్షించండి🙏🏻"];

  var STRINGS = {
    te: {
      copy: "కాపీ చేయండి",
      copied: "కాపీ అయ్యింది ✓",
      share: "వాట్సాప్‌లో పంపండి",
      unavailable: "ఈరోజు పంచాంగం ఇంకా అందుబాటులో లేదు.",
      note: "ప్రతిరోజు ఉదయం 4 గంటలకు మారును",
    },
    en: {
      copy: "Copy",
      copied: "Copied ✓",
      share: "Share on WhatsApp",
      unavailable: "Today's panchangam is not available yet.",
      note: "Rolls over at 4:00 AM IST",
    },
  };

  function lang() {
    return document.documentElement.lang === "en" ? "en" : "te";
  }

  function t(key) {
    return (STRINGS[lang()] || STRINGS.te)[key];
  }

  /** The panchangam day for "now": IST date, rolled back before 4:00 AM. */
  function currentPanchangamDate(now) {
    var ist = new Date(now.getTime() + IST_OFFSET_MS);
    if (ist.getUTCHours() < ROLLOVER_HOUR) {
      ist.setUTCDate(ist.getUTCDate() - 1);
    }
    return ist.toISOString().slice(0, 10);
  }

  /** The whole block as plain text, ready to forward. */
  function asText(day) {
    var lines = [HEAD, "🌻" + day.date_te + "🌻", day.samvatsara, day.ayana_ritu, day.masa_paksha];
    day.rows.forEach(function (row) {
      lines.push(row.label + ":" + row.value);
    });
    return lines.concat(FOOT).join("\n");
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function render(root, day) {
    root.textContent = "";

    var card = el("div", "panchangam-card");

    card.appendChild(el("p", "panchangam-invocation", HEAD));
    card.appendChild(el("p", "panchangam-date", "🌻" + day.date_te + "🌻"));

    var head = el("div", "panchangam-head");
    [day.samvatsara, day.ayana_ritu, day.masa_paksha].forEach(function (line) {
      if (line) head.appendChild(el("p", null, line));
    });
    card.appendChild(head);

    var list = el("dl", "panchangam-rows");
    day.rows.forEach(function (row) {
      list.appendChild(el("dt", null, row.label));
      list.appendChild(el("dd", null, row.value));
    });
    card.appendChild(list);

    var foot = el("div", "panchangam-foot");
    FOOT.forEach(function (line) {
      foot.appendChild(el("p", null, line));
    });
    card.appendChild(foot);

    var actions = el("div", "panchangam-actions");

    var copyBtn = el("button", "btn btn-ghost btn-sm", t("copy"));
    copyBtn.type = "button";
    copyBtn.addEventListener("click", function () {
      copyText(asText(day), function (ok) {
        if (!ok) return;
        copyBtn.textContent = t("copied");
        window.setTimeout(function () { copyBtn.textContent = t("copy"); }, 2200);
      });
    });
    actions.appendChild(copyBtn);

    var share = el("a", "btn btn-gold btn-sm", t("share"));
    share.href = "https://wa.me/?text=" + encodeURIComponent(asText(day));
    share.target = "_blank";
    share.rel = "noopener";
    actions.appendChild(share);

    card.appendChild(actions);
    card.appendChild(el("p", "panchangam-note", t("note")));

    root.appendChild(card);
  }

  function copyText(text, done) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(
        function () { done(true); },
        function () { done(fallbackCopy(text)); }
      );
      return;
    }
    done(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    var area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;top:-1000px;opacity:0";
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(area);
    return ok;
  }

  function showMessage(root, message) {
    root.textContent = "";
    var card = el("div", "panchangam-card panchangam-card--empty");
    card.appendChild(el("p", "panchangam-invocation", HEAD));
    card.appendChild(el("p", null, message));
    root.appendChild(card);
  }

  function boot() {
    var root = document.getElementById("panchangam");
    if (!root) return;

    fetch(DATA_URL, { cache: "no-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (file) {
        var key = currentPanchangamDate(new Date());
        var day = file.days && file.days[key];
        if (!day) {
          showMessage(root, t("unavailable"));
          return;
        }
        render(root, day);
        // Re-render on language switch so the buttons follow the site language.
        var observer = new MutationObserver(function () { render(root, day); });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
      })
      .catch(function (err) {
        console.warn("Panchangam unavailable:", err.message);
        showMessage(root, t("unavailable"));
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
