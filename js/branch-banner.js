/**
 * Branch Banner — shows a thin bar at the top of every page when the site
 * is deployed on a non-main branch (brennan.games staging only).
 *
 * Self-contained: all styles are inline, no external CSS dependencies.
 * Fetches branch-info.php which returns branch, version, and commit info.
 * Fails silently if the endpoint is missing or we're not on the staging host.
 */
(function () {
  if (window.location.hostname !== 'brennan.games') return;

  fetch('branch-info.php')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (info) {
      if (!info || !info.client || info.client === 'main') return;

      var bar = document.createElement('div');
      bar.id = 'branch-banner';
      bar.style.cssText =
        'position:fixed;top:0;left:0;right:0;height:28px;' +
        'background:#42a5f5;color:#fff;font:600 12px/28px system-ui,sans-serif;' +
        'text-align:center;z-index:99999;box-shadow:0 1px 3px rgba(0,0,0,.25);' +
        'display:flex;align-items:center;justify-content:center;gap:8px;padding:0 100px;';

      // Branch name (links to branch manager)
      var branchLink = document.createElement('a');
      branchLink.textContent = info.client;
      branchLink.href = 'branch-manager.php';
      branchLink.style.cssText = 'color:#fff;text-decoration:none;font-weight:700;';

      // Version
      var parts = [];
      if (info.version) parts.push('v' + info.version);
      if (info.commitSha) parts.push(info.commitSha);
      if (info.commitDate) parts.push(info.commitDate);

      var meta = document.createElement('span');
      meta.style.cssText = 'opacity:0.85;font-weight:400;';
      meta.textContent = parts.join(' \u00b7 ');

      // Commit message
      var msg = document.createElement('span');
      msg.style.cssText = 'opacity:0.7;font-weight:400;font-style:italic;' +
        'max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      if (info.commitMsg) msg.textContent = '\u2014 ' + info.commitMsg;

      // Separator
      var sep = document.createElement('span');
      sep.style.cssText = 'opacity:0.4;margin:0 2px;';
      sep.textContent = '|';

      // Pull latest button
      var pullBtn = document.createElement('button');
      pullBtn.textContent = 'Pull latest';
      pullBtn.style.cssText =
        'color:#fff;background:rgba(255,255,255,.25);padding:2px 10px;' +
        'border:none;cursor:pointer;border-radius:3px;font-size:11px;font-weight:600;' +
        'position:absolute;right:130px;top:50%;transform:translateY(-50%);';
      pullBtn.onclick = function () {
        pullBtn.textContent = 'Pulling\u2026';
        pullBtn.disabled = true;
        pullBtn.style.opacity = '0.6';
        pullBtn.style.cursor = 'default';
        fetch('branch-manager.php?action=switch&client=' + encodeURIComponent(info.client))
          .then(function (r) { return r.json(); })
          .then(function (res) {
            if (res.status === 'ok') {
              pullBtn.textContent = 'Done!';
              setTimeout(function () { window.location.reload(); }, 600);
            } else {
              pullBtn.textContent = 'Error';
              pullBtn.style.background = 'rgba(255,0,0,.4)';
              setTimeout(function () {
                pullBtn.textContent = 'Pull latest';
                pullBtn.disabled = false;
                pullBtn.style.opacity = '1';
                pullBtn.style.cursor = 'pointer';
                pullBtn.style.background = 'rgba(255,255,255,.25)';
              }, 3000);
            }
          })
          .catch(function () {
            pullBtn.textContent = 'Error';
            pullBtn.style.background = 'rgba(255,0,0,.4)';
            setTimeout(function () {
              pullBtn.textContent = 'Pull latest';
              pullBtn.disabled = false;
              pullBtn.style.opacity = '1';
              pullBtn.style.cursor = 'pointer';
              pullBtn.style.background = 'rgba(255,255,255,.25)';
            }, 3000);
          });
      };

      // Switch to main button (absolute right so text stays centered)
      var btn = document.createElement('a');
      btn.textContent = 'Switch to main';
      btn.href = 'branch-manager.php';
      btn.style.cssText =
        'color:#fff;background:rgba(255,255,255,.25);padding:2px 10px;' +
        'border-radius:3px;text-decoration:none;font-size:11px;font-weight:600;' +
        'position:absolute;right:12px;top:50%;transform:translateY(-50%);';

      bar.appendChild(branchLink);
      bar.appendChild(meta);
      if (info.commitMsg) bar.appendChild(msg);
      bar.appendChild(pullBtn);
      bar.appendChild(btn);
      document.body.insertBefore(bar, document.body.firstChild);
      document.body.style.paddingTop = '28px';
    })
    .catch(function () { /* silent — no banner if fetch fails */ });
})();
