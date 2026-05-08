// SaySame — page-world video.volume hijack.
//
// This file runs in the page's MAIN world (declared with
// `"world": "MAIN"` in manifest.json) so that
// `Object.defineProperty(video, "volume", {...})` actually
// intercepts writes from page-world JS like YouTube's player
// chrome. Content-script (ISOLATED-world) defineProperty does NOT
// intercept page-world writes — that was the v0.3.0/v0.3.1 bug.
//
// Communication contract with the content script:
//   isolated -> page (custom events on `document`):
//     'saysame:hijack-activate'      detail: { initial?: number 0..1 }
//     'saysame:hijack-deactivate'
//     'saysame:hijack-set-displayed' detail: { value: number 0..1 }
//   page -> isolated:
//     'saysame:volume-redirect'      detail: { value: number 0..1 }
//
// Page-side status mirrored to:
//   document.documentElement.dataset.saysameHijackPage (JSON)
//   document.documentElement.dataset.saysameHijackPageBoot ("1")
(() => {
  if (window.__saysamePageHijackBooted) return;
  window.__saysamePageHijackBooted = true;

  const stamp = (obj) => {
    try { document.documentElement.dataset.saysameHijackPage = JSON.stringify(obj); } catch {}
  };
  try { document.documentElement.dataset.saysameHijackPageBoot = "1"; } catch {}

  let hijackedVideo = null;
  let displayedVolume = 1.0;
  let protoDesc = null;

  function findProtoDesc(v) {
    let p = Object.getPrototypeOf(v);
    let d = 0;
    while (p && d < 10) {
      const desc = Object.getOwnPropertyDescriptor(p, "volume");
      if (desc && typeof desc.set === "function") return desc;
      p = Object.getPrototypeOf(p);
      d++;
    }
    return null;
  }

  function activate(detail) {
    const v = document.querySelector("video");
    if (!v) { stamp({ when: "activate", ok: false, why: "no-video" }); return; }
    if (hijackedVideo === v) { stamp({ when: "activate", ok: true, why: "already" }); return; }
    if (hijackedVideo) deactivate();
    protoDesc = findProtoDesc(v);
    if (!protoDesc) { stamp({ when: "activate", ok: false, why: "no-proto-desc" }); return; }
    const init = (detail && typeof detail.initial === "number")
      ? detail.initial
      : (() => { try { return Number(protoDesc.get.call(v)); } catch { return 1.0; } })();
    displayedVolume = Math.max(0, Math.min(1, Number.isFinite(init) ? init : 1.0));
    try {
      Object.defineProperty(v, "volume", {
        configurable: true,
        enumerable: true,
        get() { return displayedVolume; },
        set(value) {
          const c = Math.max(0, Math.min(1, Number(value) || 0));
          displayedVolume = c;
          try {
            document.dispatchEvent(new CustomEvent("saysame:volume-redirect", { detail: { value: c } }));
          } catch {}
          try { protoDesc.set.call(v, 1.0); } catch {}
          try { v.dispatchEvent(new Event("volumechange")); } catch {}
        }
      });
    } catch (e) {
      stamp({ when: "activate", ok: false, why: "defineProperty:" + (e && e.message || "?") });
      return;
    }
    try { protoDesc.set.call(v, 1.0); } catch {}
    hijackedVideo = v;
    stamp({ when: "activate", ok: true, init: displayedVolume });
  }

  function deactivate() {
    if (hijackedVideo) {
      try { delete hijackedVideo.volume; } catch {}
    }
    hijackedVideo = null;
    protoDesc = null;
    stamp({ when: "deactivate", ok: true });
  }

  function setDisplayed(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return;
    displayedVolume = Math.max(0, Math.min(1, value));
    if (hijackedVideo) {
      try { hijackedVideo.dispatchEvent(new Event("volumechange")); } catch {}
    }
  }

  document.addEventListener("saysame:hijack-activate", (e) => activate(e && e.detail || {}));
  document.addEventListener("saysame:hijack-deactivate", () => deactivate());
  document.addEventListener("saysame:hijack-set-displayed", (e) => setDisplayed(e && e.detail && e.detail.value));

  stamp({ when: "boot", ok: true });
})();
