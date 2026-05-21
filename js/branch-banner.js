/**
 * Branch Banner — shows a thin bar at the top of every page when the site
 * is deployed on a non-production env (dev or staging) on a non-main branch.
 *
 * Self-contained: all styles are inline, no external CSS dependencies.
 * Fetches branch-info.php which returns branch, version, commit, and envName.
 * Fails silently if the endpoint is missing or we're on production.
 *
 * Banner actions navigate to deploy.html (the carkedit-deploy host page),
 * which handles auth + the actual branch switch / pull.
 */
(function () {
  fetch('branch-info.php')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (info) {
      if (!info || info.envName === 'production') return;
      if (!info.client || info.client === 'main') return;

      var bar = document.createElement('div');
      bar.id = 'branch-banner';
      bar.style.cssText =
        'position:fixed;top:0;left:0;right:0;height:28px;' +
        'background:#42a5f5;color:#fff;font:600 12px/28px system-ui,sans-serif;' +
        'text-align:center;z-index:99999;box-shadow:0 1px 3px rgba(0,0,0,.25);' +
        'display:flex;align-items:center;justify-content:center;gap:8px;padding:0 140px;';

      // Branch name (links to deploy page)
      var branchLink = document.createElement('a');
      branchLink.textContent = info.client;
      branchLink.href = 'deploy.html';
      branchLink.style.cssText = 'color:#fff;text-decoration:none;font-weight:700;';

      // Version
      var parts = [];
      if (info.version) parts.push('client v' + info.version);
      if (info.apiVersion) parts.push('api v' + info.apiVersion);
      if (info.commitSha) parts.push(info.commitSha);
      if (info.commitDate) parts.push(info.commitDate);

      var meta = document.createElement('span');
      meta.style.cssText = 'opacity:0.85;font-weight:400;';
      meta.textContent = parts.join(' · ');

      // Commit message
      var msg = document.createElement('span');
      msg.style.cssText = 'opacity:0.7;font-weight:400;font-style:italic;' +
        'max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      if (info.commitMsg) msg.textContent = '— ' + info.commitMsg;

      // Switch to main button (absolute right so text stays centered)
      var btn = document.createElement('a');
      btn.textContent = 'Switch to main';
      btn.href = 'deploy.html';
      btn.style.cssText =
        'color:#fff;background:rgba(255,255,255,.25);padding:2px 10px;' +
        'border-radius:3px;text-decoration:none;font-size:11px;font-weight:600;' +
        'position:absolute;right:12px;top:50%;transform:translateY(-50%);';

      bar.appendChild(branchLink);
      bar.appendChild(meta);
      if (info.commitMsg) bar.appendChild(msg);
      bar.appendChild(btn);
      document.body.insertBefore(bar, document.body.firstChild);
      document.body.style.paddingTop = '28px';
    })
    .catch(function () { /* silent — no banner if fetch fails */ });
})();
