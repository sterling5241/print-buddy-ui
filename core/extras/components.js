PB.components = (() => {
  const LABEL = { ui: "Interface", notify: "Notifications", timelapse: "Timelapse" };
  const rpc = (pid, method, params) => api(`/api/printers/${pid}/rpc`, { method: "POST", body: JSON.stringify({ method, params }) }).then(r => r.result);

  async function act(box, body, text) {
    if (!confirm(text)) return;
    const msg = box.querySelector(".pb-compmsg");
    for (const b of box.querySelectorAll("button, select")) b.disabled = true;
    msg.textContent = "Working… this can take a minute.";
    try {
      const r = await api("/api/components", { method: "POST", body: JSON.stringify(body) });
      if (!r.ok) throw new Error(r.output.split("\n").pop() || "failed");
      msg.textContent = "Done. Printer Buddy is restarting, this page reloads by itself.";
    } catch (e) {
      msg.textContent = `Failed: ${e.message}`;
      for (const b of box.querySelectorAll("button, select")) b.disabled = false;
    }
  }

  const row = (name, installed, latest, update, extra, btn) => `<div class="pb-li"><div class="pb-lmain"><div class="pb-lname">${esc(name)}</div>
      <div class="pb-lsub">${esc(installed || "not installed")}${update && latest ? ` → ${esc(latest)}` : ""}</div></div>
      <div class="pb-lbtn">${extra || ""}${update ? btn : `<span class="pb-chip done">Up to date</span>`}</div></div>`;
  const select = (attrs, value, options) => `<select ${attrs}>${options.map(o => `<option${o === value ? " selected" : ""}>${o}</option>`).join("")}</select>`;

  async function load(box) {
    box.innerHTML = `<p class="pb-muted">Checking…</p>`;
    let c;
    try { c = await api("/api/components"); } catch (e) { box.innerHTML = `<p class="pb-muted">${esc(e.message)}</p>`; return; }
    const any = c.core.update || c.parts.some(p => p.update) || c.ai.update;
    box.innerHTML = `<div class="pb-tool"><label class="field">Channel ${select('data-ch', c.channel, ["stable", "nightly"])}</label><span class="bd-sp"></span>
        <button type="button" data-a="check">Check now</button>${any ? `<button type="button" class="pb-pri" data-a="all">Update all</button>` : ""}</div>
      <p class="pb-compmsg pb-muted"></p>
      <div class="pb-sub-h">Printer Buddy</div>
      ${row("Printer Buddy", c.core.installed, c.core.latest, c.core.update, "", `<button type="button" data-up="core">Update</button>`)}
      ${c.parts.map(p => row(LABEL[p.name] || p.name, p.installed, p.latest, p.update,
          p.tiers.length ? select(`data-tier="${p.name}"`, p.tier, p.tiers) : "", `<button type="button" data-up="parts">Update</button>`)).join("")}
      ${row("AI model", c.ai.installed || (c.ai.kind === "off" ? "off" : ""), c.ai.latest, c.ai.update,
          select("data-ai", c.ai.kind, c.ai.kinds), `<button type="button" data-up="ai">Update</button>`)}
      <div class="pb-sub-h">Printers</div><div class="pb-compprinters"><p class="pb-muted">Checking printers…</p></div>`;
    box.querySelector("[data-a=check]").onclick = () => load(box);
    box.querySelector("[data-a=all]")?.addEventListener("click", () => act(box, { update: c.core.update ? "core" : c.parts.some(p => p.update) ? "parts" : "ai" }, "Update Printer Buddy now? It restarts when done."));
    for (const b of box.querySelectorAll("[data-up]")) b.onclick = () => act(box, { update: b.dataset.up }, "Update now? Printer Buddy restarts when done.");
    box.querySelector("[data-ch]").onchange = e => act(box, { channel: e.target.value }, `Switch to ${e.target.value} and download its parts? Printer Buddy restarts.`);
    for (const s of box.querySelectorAll("[data-tier]")) s.onchange = () => act(box, { part: s.dataset.tier, tier: s.value }, `Switch ${LABEL[s.dataset.tier]} to ${s.value}? Printer Buddy restarts.`);
    box.querySelector("[data-ai]").onchange = e => act(box, { ai: e.target.value }, `Set AI to ${e.target.value}? Printer Buddy restarts.`);
    printersList(box.querySelector(".pb-compprinters"));
  }

  async function printersList(el) {
    const online = [...printers.values()].filter(p => p.connection === "online");
    if (!online.length) { el.innerHTML = `<p class="pb-muted">No printers online.</p>`; return; }
    const parts = await Promise.all(online.map(async p => {
      try {
        const vi = (await rpc(p.id, "machine.update.status"))?.version_info || {};
        const rows = Object.entries(vi).filter(([n]) => n !== "system").map(([n, v]) => {
          const cur = v.version || "?", next = v.remote_version || "?";
          const out = v.is_valid !== false && ((v.commits_behind?.length || 0) > 0 || (next !== "?" && cur !== next));
          return row(n, cur, next, out, "", `<button type="button" data-pid="${p.id}" data-name="${esc(n)}">Update</button>`);
        });
        return `<div class="pb-lname">${esc(p.name)}</div>${rows.join("") || `<p class="pb-muted">No update manager on this printer.</p>`}`;
      } catch (e) { return `<div class="pb-lname">${esc(p.name)}</div><p class="pb-muted">${esc(e.message)}</p>`; }
    }));
    el.innerHTML = parts.join("");
    for (const b of el.querySelectorAll("[data-pid]")) b.onclick = async () => {
      const p = printers.get(+b.dataset.pid);
      if (p && (p.state === "printing" || p.state === "paused")) return toast(`${p.name} is printing`);
      if (!confirm(`Update ${b.dataset.name} on ${p?.name}? It may restart services.`)) return;
      b.disabled = true; b.textContent = "Updating…";
      try { await rpc(+b.dataset.pid, "machine.update.upgrade", { name: b.dataset.name }); toast(`Updated ${b.dataset.name} on ${p?.name}`); }
      catch (e) { toast(`Update failed: ${e.message}`); }
      printersList(el);
    };
  }

  return { load };
})();
