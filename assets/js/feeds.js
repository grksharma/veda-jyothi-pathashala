/* =========================================================
   Veda Jyothi Pathashala — daily reading

   Four cards that change every day at 4:00 AM IST, in step with the
   panchangam:

     ఈరోజు విశిష్టత   derived from the day's panchangam (data/panchangam.json)
     వేద జీవన విధానం  ┐
     ఆరోగ్యకరమైన జీవనము ├ rotate through data/feeds.json, one entry a day
     ధర్మ సందేహాలు     ┘

   The rotation is by date, so every visitor sees the same entry on a given
   day, and the lists cycle indefinitely without anyone having to top them up.
   ========================================================= */
(function () {
  "use strict";

  var ROLLOVER_HOUR = 4; // IST
  var IST_OFFSET_MS = 5.5 * 3600 * 1000;
  var ORDER = ["living", "health", "dharma"];

  var STRINGS = {
    te: { significance: "ఈరోజు విశిష్టత", unavailable: "త్వరలో అందుబాటులోనికి వచ్చును." },
    en: { significance: "Significance of today", unavailable: "Coming soon." },
  };

  function lang() {
    return document.documentElement.lang === "en" ? "en" : "te";
  }

  function pick(obj, base) {
    var l = lang();
    return obj[base + "_" + l] || obj[base + "_te"] || obj[base + "_en"] || "";
  }

  /** Same rollover rule as the panchangam, so all the cards turn together. */
  function panchangamDate(now) {
    var ist = new Date(now.getTime() + IST_OFFSET_MS);
    if (ist.getUTCHours() < ROLLOVER_HOUR) ist.setUTCDate(ist.getUTCDate() - 1);
    return ist;
  }

  /** Whole days since the epoch — a stable, monotonic index for rotation. */
  function dayNumber(date) {
    return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86400000);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function card(icon, title, headline, bodyLines, disclaimer) {
    var article = el("article", "feed-card");

    var head = el("div", "feed-card-head");
    head.appendChild(el("span", "feed-icon", icon));
    head.appendChild(el("h3", null, title));
    article.appendChild(head);

    if (headline) article.appendChild(el("h4", "feed-headline", headline));

    bodyLines.forEach(function (line) {
      article.appendChild(el("p", null, line));
    });

    if (disclaimer) article.appendChild(el("p", "feed-disclaimer", disclaimer));

    return article;
  }

  function render(root, feeds, significance, date) {
    root.textContent = "";
    var n = dayNumber(date);
    var s = STRINGS[lang()] || STRINGS.te;

    if (significance && significance.length) {
      root.appendChild(card("🌅", s.significance, null, significance, null));
    }

    ORDER.forEach(function (key, i) {
      var feed = feeds && feeds[key];
      if (!feed || !feed.entries || !feed.entries.length) return;

      // Offset each list so the four cards do not all wrap around together.
      var entry = feed.entries[(((n + i * 5) % feed.entries.length) + feed.entries.length) % feed.entries.length];

      root.appendChild(
        card(
          feed.icon || "🕉️",
          pick(feed, "title"),
          pick(entry, "head"),
          [pick(entry, "body")],
          pick(feed, "disclaimer")
        )
      );
    });

    if (!root.childNodes.length) {
      root.appendChild(el("p", "center", s.unavailable));
    }
  }

  function boot() {
    var root = document.getElementById("daily-feeds");
    if (!root) return;

    var date = panchangamDate(new Date());
    var key = date.toISOString().slice(0, 10);

    Promise.all([
      fetch("data/feeds.json", { cache: "no-cache" }).then(function (r) {
        return r.ok ? r.json() : null;
      }),
      fetch("data/panchangam.json", { cache: "no-cache" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (file) { return file && file.days && file.days[key] ? file.days[key].significance : null; })
        .catch(function () { return null; }),
    ])
      .then(function (results) {
        var feeds = results[0];
        var significance = results[1];
        if (!feeds && !significance) throw new Error("no content");

        render(root, feeds, significance, date);
        var observer = new MutationObserver(function () {
          render(root, feeds, significance, date);
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
      })
      .catch(function (err) {
        console.warn("Daily reading unavailable:", err.message);
        root.textContent = "";
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
