(function () {
  "use strict";

  // ── Configure this after deploying the Cloudflare Worker ──
  var WORKER_URL = "fun-masoko-worker.masoko.workers.dev"; // e.g. "https://masoko.workers.dev"

  var form    = document.getElementById("joke-form");
  var statusEl = document.getElementById("submit-status");
  var submitBtn = document.getElementById("f-submit");
  if (!form) return;

  function escapeHtml(s) {
    return (s || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function setStatus(msg, kind) {
    statusEl.className = "submit-status" + (kind ? " is-" + kind : "");
    statusEl.innerHTML = msg;
  }

  // Reset the Turnstile widget so a failed attempt can be retried.
  function resetCaptcha() {
    try { if (window.turnstile) window.turnstile.reset(); } catch (e) {}
  }

  function turnstileToken() {
    try { return window.turnstile ? window.turnstile.getResponse() : ""; }
    catch (e) { return ""; }
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    var body = (document.getElementById("f-body").value || "").trim();
    if (body.length < 5) {
      setStatus("Вицът е твърде кратък.", "error");
      return;
    }

    var token = turnstileToken();
    if (!token) {
      setStatus("Моля, потвърди че не си робот.", "error");
      return;
    }

    var payload = {
      category: document.getElementById("f-category").value,
      title:    (document.getElementById("f-title").value || "").trim(),
      body:     body,
      website:  document.getElementById("f-website").value, // honeypot
      turnstileToken: token
    };

    submitBtn.disabled = true;
    setStatus("Изпращане…", "pending");

    fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        if (res.ok && res.data && res.data.ok) {
          form.reset();
          resetCaptcha();
          var link = res.data.url
            ? ' <a href="' + escapeHtml(res.data.url) + '" target="_blank" rel="noopener">Виж предложението</a>'
            : "";
          setStatus("Благодарим! Вицът е изпратен за преглед." + link, "ok");
          submitBtn.disabled = false;
        } else {
          var err = (res.data && res.data.error) || "Нещо се обърка. Опитай пак.";
          setStatus(escapeHtml(err), "error");
          resetCaptcha();
          submitBtn.disabled = false;
        }
      })
      .catch(function () {
        setStatus("Връзката пропадна. Опитай отново по-късно.", "error");
        resetCaptcha();
        submitBtn.disabled = false;
      });
  });
})();
