/**
 * Branch Banner — shows a thin bar at the top of every page when the site
 * is deployed on a non-main branch (brennan.games staging only).
 *
 * Self-contained: all styles are inline, no external CSS dependencies.
 * Fetches branch-info.php which returns the current git branch as JSON.
 * Fails silently if the endpoint is missing or we're not on the staging host.
 */
(function () {
  if (window.location.hostname !== 'brennan.games') return;

  fetch('branch-info.php')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (state) {
      if (!state || !state.client || state.client === 'main') return;

      var bar = document.createElement('div');
      bar.id = 'branch-banner';
      bar.style.cssText =
        'position:fixed;top:0;left:0;right:0;height:28px;' +
        'background:#42a5f5;color:#fff;font:600 13px/28px system-ui,sans-serif;' +
        'text-align:center;z-index:99999;box-shadow:0 1px 3px rgba(0,0,0,.25);';

      var label = document.createElement('span');
      label.textContent = 'Branch: ' + state.client;

      var btn = document.createElement('a');
      btn.textContent = 'Switch to main';
      btn.href = 'branch-manager.php';
      btn.style.cssText =
        'color:#fff;background:rgba(255,255,255,.25);padding:2px 10px;' +
        'border-radius:3px;margin-left:12px;text-decoration:none;font-size:12px;';

      bar.appendChild(label);
      bar.appendChild(btn);
      document.body.insertBefore(bar, document.body.firstChild);
      document.body.style.paddingTop = '28px';
    })
    .catch(function () { /* silent — no banner if fetch fails */ });
})();
