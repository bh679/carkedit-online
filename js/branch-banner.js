/**
 * Branch Banner — shows a thin bar at the top of every page when the site
 * is deployed on a non-production env (dev or staging) on a non-main branch.
 *
 * Reads from the carkedit-deploy service:
 *   GET /api/admin/deploy/versions
 *   => { envTier, versions: { client: { deployed: { version, ref: {kind,value,sha} } }, api: { deployed: {...} } } }
 *
 * Banner is hidden when:
 *   - envTier === 'prod' (production never gets a branch banner)
 *   - client.deployed.ref.kind !== 'branch' (tag pins on staging/prod)
 *   - client.deployed.ref.value === 'main'
 *
 * Self-contained: all styles are inline, no external CSS dependencies.
 * Fails silently if the endpoint is missing or unreachable.
 *
 * Banner actions navigate to deploy.html (the carkedit-deploy host page),
 * which handles auth + the actual branch switch / pull.
 */
(function () {
  fetch('/api/admin/deploy/versions')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (!data || data.envTier === 'prod') return;
      var client = data.versions && data.versions.client && data.versions.client.deployed;
      if (!client || !client.ref || client.ref.kind !== 'branch') return;
      if (!client.ref.value || client.ref.value === 'main') return;

      var api = data.versions && data.versions.api && data.versions.api.deployed;

      var bar = document.createElement('div');
      bar.id = 'branch-banner';
      bar.style.cssText =
        'position:fixed;top:0;left:0;right:0;height:28px;' +
        'background:#42a5f5;color:#fff;font:600 12px/28px system-ui,sans-serif;' +
        'text-align:center;z-index:99999;box-shadow:0 1px 3px rgba(0,0,0,.25);' +
        'display:flex;align-items:center;justify-content:center;gap:8px;padding:0 140px;';

      // Branch name (links to deploy page)
      var branchLink = document.createElement('a');
      branchLink.textContent = client.ref.value;
      branchLink.href = 'deploy.html';
      branchLink.style.cssText = 'color:#fff;text-decoration:none;font-weight:700;';

      // Version meta
      var parts = [];
      if (client.version) parts.push('client v' + client.version);
      if (api && api.version) parts.push('api v' + api.version);
      if (client.ref.sha) parts.push(String(client.ref.sha).slice(0, 7));

      var meta = document.createElement('span');
      meta.style.cssText = 'opacity:0.85;font-weight:400;';
      meta.textContent = parts.join(' · ');

      // Switch to main button (absolute right so text stays centered).
      // ?reset=main&auto=1 seeds the carkedit-deploy fragment's reset chain
      // (sessionStorage `cd-reset-chain`) so api → client → deploy each get
      // reset back to main / latest tag with no extra clicks after sign-in.
      var btn = document.createElement('a');
      btn.textContent = 'Switch to main';
      btn.href = 'deploy.html?reset=main&auto=1';
      btn.style.cssText =
        'color:#fff;background:rgba(255,255,255,.25);padding:2px 10px;' +
        'border-radius:3px;text-decoration:none;font-size:11px;font-weight:600;' +
        'position:absolute;right:12px;top:50%;transform:translateY(-50%);';

      bar.appendChild(branchLink);
      bar.appendChild(meta);
      bar.appendChild(btn);
      document.body.insertBefore(bar, document.body.firstChild);
      document.body.style.paddingTop = '28px';
    })
    .catch(function () { /* silent — no banner if fetch fails */ });
})();
