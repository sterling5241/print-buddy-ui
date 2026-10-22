(() => {
  const { el } = PB, { onPage, cur, send, live, dialog, pageHook } = PB.x;
  const page = $("#page");
  const ban = el("div", "pb-kban"); ban.hidden = true;
  (page.querySelector(".bd-top") || page.firstChild).after(ban);
  let banKey = "", hiddenKey = "";
  pageHook(p => {
    const online = p.connection === "online";
    const bad = online && p.klippy_state && p.klippy_state !== "ready";
    const notes = online ? [
      ...(p.klipper_warnings || []).map(w => ["Klipper", w]),
      ...(p.failed_components || []).map(c => ["Moonraker", `${c} failed to start. Check moonraker.log.`]),
      ...(p.moonraker_warnings || []).map(w => ["Moonraker", w]),
    ] : [];
    const key = JSON.stringify([p.id, bad && p.klippy_state, bad && p.klippy_message, notes]);
    ban.hidden = !bad && (!notes.length || key === hiddenKey);
    if (ban.hidden) { banKey = ""; return; }
    if (key === banKey) return; banKey = key;
    const starting = p.klippy_state === "startup";
    const msg = !bad ? "" : p.klippy_message
      || (p.klippy_state === "disconnected" ? "Klipper isn't connected to Moonraker. Restart the Klipper service; if it stays down, check klippy.log."
        : starting ? "" : "Klipper didn't say why. Check klippy.log.");
    const list = notes.length ? `<ul class="pb-knotes">${notes.map(([who, t]) => `<li><b>${who}:</b> ${esc(t)}</li>`).join("")}</ul>` : "";
    ban.className = `pb-kban ${bad && !starting ? "err" : "warn"}`;
    ban.innerHTML = bad
      ? `<div class="pb-kbhead"><b>${starting ? "Klipper is starting…" : `Klipper: ${esc(p.klippy_state)}`}</b><span class="bd-sp"></span>
          <a href="${PB.fileUrl("logs", "klippy.log", 1)}" class="pb-kblog">klippy.log ↓</a>
          <button type="button" data-k="restart">Restart</button><button type="button" data-k="fw">Firmware restart</button>
          <button type="button" data-k="svc" title="Restart the Klipper service on the printer">Restart service</button></div>
        ${msg ? `<pre>${esc(msg)}</pre>` : ""}${list}`
      : `<div class="pb-kbhead"><b>${notes.length} warning${notes.length > 1 ? "s" : ""}</b><span class="bd-sp"></span>
          <a href="${PB.fileUrl("logs", "moonraker.log", 1)}" class="pb-kblog">moonraker.log ↓</a>
          <button type="button" data-k="hide" title="Hide until the warnings change">Hide</button></div>${list}`;
    const run = async (method, params, what) => { try { await PB.rpc(method, params); toast(what); } catch (e) { toast(e.message); } };
    if (!bad) { ban.querySelector("[data-k=hide]").onclick = () => { hiddenKey = key; ban.hidden = true; banKey = ""; }; return; }
    ban.querySelector("[data-k=restart]").onclick = () => run("printer.restart", undefined, "Restarting Klipper…");
    ban.querySelector("[data-k=fw]").onclick = () => run("printer.firmware_restart", undefined, "Firmware restart…");
    ban.querySelector("[data-k=svc]").onclick = () => run("machine.services.restart", { service: "klipper" }, "Restarting the Klipper service…");
  });
})();
