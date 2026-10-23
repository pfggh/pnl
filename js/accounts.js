window.Accounts = (() => {
  // Element references
  const spinnerAccs = document.getElementById("spinner-accs");
  const messageBoxAccs = document.getElementById("message-box-accs");
  const addAccForm = document.getElementById("add-acc-form");
  const addAccBtn = document.getElementById("add-acc-btn");
  const accEmail = document.getElementById("acc-email");
  const accPass = document.getElementById("acc-pass");
  const accountsViewSelector = document.getElementById("accounts-view-selector");
  const accountsIssuesTitle = document.getElementById("accounts-issues-title");
  const accountsIssuesTable = document.getElementById("accounts-issues-table");
  const accountsIssuesTableHead = accountsIssuesTable.querySelector("thead");
  const accountsIssuesTableBody = accountsIssuesTable.querySelector("tbody");
  const accService = document.getElementById("acc-service");
  const link1El = document.getElementById("link1");
  const link2El = document.getElementById("link2");
  const link3El = document.getElementById("link3");
  const link4El = document.getElementById("link4");
  const link5El = document.getElementById("link5");
  const anghamiLinksDiv = document.getElementById("anghami-links");
  const linkInputs = anghamiLinksDiv.querySelectorAll("input");

  const accTableSearch = document.getElementById("acc-table-search");
  const openTokenModalBtn = document.getElementById("open-token-modal-btn");
  const cancelModal = document.getElementById("cancel-modal");
  const modalContent = document.getElementById("modal-content");

  // Timer interval for continuous clock sync
  let accountsTotpInterval = null;
  let activeTotpItems = []; // Array of { id, secret }

  const filterAccountsTable = () => {
    if (!accTableSearch) return;
    const query = accTableSearch.value.toLowerCase().trim();
    const rows = accountsIssuesTableBody.querySelectorAll("tr");
    rows.forEach(tr => {
      const cells = Array.from(tr.querySelectorAll("td"));
      if (cells.length === 1 && cells[0].getAttribute("colspan")) {
        return;
      }
      const text = cells.map(td => td.textContent.toLowerCase()).join(" ");
      const match = text.includes(query);
      tr.style.display = match ? "" : "none";
    });
  };

  if (accTableSearch) {
    accTableSearch.addEventListener("input", filterAccountsTable);
  }

  const showSpinnerAccs = (show = true) => {
    if (spinnerAccs) spinnerAccs.style.display = show ? "block" : "none";
  };
  const showMessageAccs = (text, type = "success") => {
    if (messageBoxAccs) {
      messageBoxAccs.textContent = text;
      messageBoxAccs.className = "message-box " + type;
      messageBoxAccs.style.display = "block";
    }
  };
  const clearMessageAccs = () => {
    if (messageBoxAccs) {
      messageBoxAccs.textContent = "";
      messageBoxAccs.className = "message-box";
      messageBoxAccs.style.display = "none";
    }
  };

  const escapeHtml = (str) => {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const getAuthToken = async () => {
    try {
      if (window.supabaseClient?.auth) {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (session?.access_token) {
          window.authToken = session.access_token;
          return session.access_token;
        }
      }
      return window.authToken;
    } catch {
      return window.authToken;
    }
  };

  // =========================================================================
  // HIGH-PERFORMANCE SYNCHRONOUS RFC 6238 TOTP ENGINE
  // Computes codes synchronously in sub-millisecond time with zero async latency
  // =========================================================================

  function sha1(bytes) {
    let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
    const len = bytes.length;
    const bitLen = len * 8;
    const padLen = (((len + 8) >> 6) + 1) << 6;
    const pad = new Uint8Array(padLen);
    pad.set(bytes);
    pad[len] = 0x80;
    const view = new DataView(pad.buffer);
    view.setUint32(padLen - 4, bitLen, false);

    const w = new Int32Array(80);
    for (let i = 0; i < padLen; i += 64) {
      for (let j = 0; j < 16; j++) w[j] = view.getInt32(i + (j << 2), false);
      for (let j = 16; j < 80; j++) {
        const t = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16];
        w[j] = (t << 1) | (t >>> 31);
      }
      let a = h0, b = h1, c = h2, d = h3, e = h4;
      for (let j = 0; j < 80; j++) {
        let f, k;
        if (j < 20) { f = (b & c) | ((~b) & d); k = 0x5a827999; }
        else if (j < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
        else if (j < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
        else { f = b ^ c ^ d; k = 0xca62c1d6; }
        const temp = (((a << 5) | (a >>> 27)) + f + e + k + w[j]) | 0;
        e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = temp;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0;
    }
    const out = new Uint8Array(20);
    const outView = new DataView(out.buffer);
    outView.setInt32(0, h0, false); outView.setInt32(4, h1, false);
    outView.setInt32(8, h2, false); outView.setInt32(12, h3, false); outView.setInt32(16, h4, false);
    return out;
  }

  function hmacSha1(key, message) {
    let k = key;
    if (k.length > 64) k = sha1(k);
    const kPad = new Uint8Array(64);
    kPad.set(k);
    const oPad = new Uint8Array(64);
    const iPad = new Uint8Array(64);
    for (let i = 0; i < 64; i++) {
      oPad[i] = kPad[i] ^ 0x5c;
      iPad[i] = kPad[i] ^ 0x36;
    }
    const inner = new Uint8Array(64 + message.length);
    inner.set(iPad); inner.set(message, 64);
    const innerHash = sha1(inner);
    const outer = new Uint8Array(64 + 20);
    outer.set(oPad); outer.set(innerHash, 64);
    return sha1(outer);
  }

  function base32ToBytes(b32) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    const clean = b32.toUpperCase().replace(/[\s=-]/g, "");
    let bits = 0, val = 0;
    const bytes = [];
    for (let i = 0; i < clean.length; i++) {
      const idx = alphabet.indexOf(clean[i]);
      if (idx === -1) continue;
      val = (val << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        bytes.push((val >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }
    return new Uint8Array(bytes);
  }

  function computeTOTP(secret, epoch) {
    if (!secret) return "—";
    try {
      const keyBytes = base32ToBytes(secret);
      if (keyBytes.length === 0) return "—";
      const counter = Math.floor((epoch || Math.floor(Date.now() / 1000)) / 30);
      const buf = new Uint8Array(8);
      const dv = new DataView(buf.buffer);
      dv.setUint32(4, counter, false);
      const hmac = hmacSha1(keyBytes, buf);
      const offset = hmac[19] & 0x0f;
      const binary =
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 8) << 8) | // fallback
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);
      return (binary % 1000000).toString().padStart(6, "0");
    } catch (e) {
      return "—";
    }
  }

  // Ring circumference for r=11: 2 * Math.PI * 11 ≈ 69.115
  const CIRCUMFERENCE = 69.115;

  let lastPeriod = -1;

  function updateTickerTick() {
    const epoch = Math.floor(Date.now() / 1000);
    const secsLeft = 30 - (epoch % 30);
    const period = Math.floor(epoch / 30);
    const periodChanged = period !== lastPeriod;
    lastPeriod = period;

    // Fraction elapsed from 30 down to 0
    // dashoffset = CIRCUMFERENCE * (1 - secsLeft / 30)
    const offset = CIRCUMFERENCE * (1 - (secsLeft / 30));

    // Global header countdown
    const globalCountSpans = document.querySelectorAll(".totp-countdown-global");
    globalCountSpans.forEach(span => {
      span.textContent = `${secsLeft}s`;
      span.style.color = secsLeft <= 5 ? "#ef4444" : "#10b981";
    });

    // Update all radial rings & seconds text
    const ringProgresses = document.querySelectorAll(".totp-ring-progress");
    ringProgresses.forEach(circle => {
      circle.style.strokeDashoffset = offset;
      if (secsLeft <= 5) {
        circle.className.baseVal = "totp-ring-progress danger";
      } else if (secsLeft <= 10) {
        circle.className.baseVal = "totp-ring-progress warning";
      } else {
        circle.className.baseVal = "totp-ring-progress";
      }
    });

    const ringTexts = document.querySelectorAll(".totp-ring-text");
    ringTexts.forEach(txt => {
      txt.textContent = `${secsLeft}`;
      if (secsLeft <= 5) {
        txt.className = "totp-ring-text danger";
      } else {
        txt.className = "totp-ring-text";
      }
    });

    // If period changed or initial run, compute and refresh codes
    if (periodChanged) {
      for (let i = 0; i < activeTotpItems.length; i++) {
        const item = activeTotpItems[i];
        const code = computeTOTP(item.secret, epoch);
        const codeEl = document.getElementById(item.id);
        if (codeEl) codeEl.textContent = code;
        const btn = document.getElementById(`btn-${item.id}`);
        if (btn) btn.dataset.code = code;
      }
    }
  }

  function startTotpTicker() {
    stopTotpTicker();
    lastPeriod = -1; // force code generation on first tick
    updateTickerTick();
    accountsTotpInterval = setInterval(updateTickerTick, 1000);
  }

  function stopTotpTicker() {
    if (accountsTotpInterval) {
      clearInterval(accountsTotpInterval);
      accountsTotpInterval = null;
    }
    activeTotpItems = [];
  }

  function toggleAnghamiLinks() {
    if (accService && anghamiLinksDiv) {
      if (accService.value === "Anghami") {
        anghamiLinksDiv.style.display = "block";
      } else {
        anghamiLinksDiv.style.display = "none";
        linkInputs.forEach(input => input.value = "");
      }
    }
  }

  if (accService) {
    accService.addEventListener("change", toggleAnghamiLinks);
  }

  // Mark issue as fixed
  const markAsFixed = async (id) => {
    clearMessageAccs();
    showSpinnerAccs(true);
    try {
      const token = await getAuthToken();
      const response = await fetch(window.SUPABASE_URL + "/functions/v1/markasfixed", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ id })
      });
      const json = await response.json();
      if (json.error) throw new Error(json.error);
      if (json.success) {
        showMessageAccs(`Issue #${id} marked as fixed!`, "success");
        const view = accountsViewSelector.value;
        const btn = accountsIssuesTableBody.querySelector(`button.mark-fixed-btn[data-id="${id}"]`);
        if (btn) {
          if (view === "fetchunfixed") {
            btn.closest("tr")?.remove();
          } else if (view === "fetchissues") {
            const tr = btn.closest("tr");
            if (tr && tr.cells && tr.cells.length >= 5) {
              tr.cells[2].textContent = "Yes";
              tr.cells[4].innerHTML = "";
            }
          }
        }
      }
    } catch (err) {
      console.error("Error marking issue as fixed:", err);
      showMessageAccs("Error marking issue as fixed.", "error");
    } finally {
      showSpinnerAccs(false);
    }
  };

  // Delete an account (when used=0)
  const deleteAcc = async (email) => {
    clearMessageAccs();
    showSpinnerAccs(true);
    try {
      const token = await getAuthToken();
      const response = await fetch(window.SUPABASE_URL + "/functions/v1/delete_acc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ email })
      });
      const json = await response.json();
      if (json.error) throw new Error(json.error);
      if (json.success) {
        showMessageAccs(`Account ${email} deleted!`, "success");
        const btn = accountsIssuesTableBody.querySelector(`button.delete-acc-btn[data-email="${email}"]`);
        if (btn) btn.closest("tr")?.remove();
      }
    } catch (err) {
      console.error("Error deleting account:", err);
      showMessageAccs("Error deleting account.", "error");
    } finally {
      showSpinnerAccs(false);
    }
  };

  // Intelligent parser for Token / Session inputs
  const parseTokenInput = (rawStr) => {
    if (!rawStr) return null;
    const trimmed = rawStr.trim();
    let parsedJson = null;
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        parsedJson = JSON.parse(trimmed);
      } catch (e) {}
    }

    let accessToken = "";
    let sessionToken = "";
    let targetEmail = "";
    let planType = "";
    let accountId = "";
    let expTimestamp = null;
    let cookies = {};

    if (parsedJson && typeof parsedJson === "object") {
      if (parsedJson.accessToken) accessToken = parsedJson.accessToken;
      if (parsedJson.sessionToken) sessionToken = parsedJson.sessionToken;
      if (parsedJson.user?.email) targetEmail = parsedJson.user.email;
      if (parsedJson.account?.planType) planType = parsedJson.account.planType;
      if (parsedJson.account?.id) accountId = parsedJson.account.id;
      if (parsedJson.expires) {
        const d = new Date(parsedJson.expires);
        if (!isNaN(d.getTime())) expTimestamp = Math.floor(d.getTime() / 1000);
      }
      if (parsedJson.cookies && typeof parsedJson.cookies === "object") {
        cookies = { ...parsedJson.cookies };
      }
    } else if (trimmed.startsWith("eyJ")) {
      accessToken = trimmed;
    }

    if (accessToken) {
      try {
        const parts = accessToken.split(".");
        if (parts.length >= 2) {
          let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
          const pad = b64.length % 4;
          if (pad) b64 += "=".repeat(4 - pad);
          const claims = JSON.parse(atob(b64));
          if (!targetEmail) {
            targetEmail = claims["https://api.openai.com/profile"]?.email || claims.email || "";
          }
          if (!planType) {
            planType = claims["https://api.openai.com/auth"]?.chatgpt_plan_type || "";
          }
          if (!accountId) {
            accountId = claims["https://api.openai.com/auth"]?.chatgpt_account_id || "";
          }
          if (claims.exp) {
            expTimestamp = Number(claims.exp);
          }
        }
      } catch (e) {
        console.warn("Could not decode accessToken JWT payload:", e);
      }
    }

    if (sessionToken && !cookies["__Secure-next-auth.session-token"]) {
      cookies["__Secure-next-auth.session-token"] = sessionToken;
    }

    return {
      raw: parsedJson || { raw: trimmed },
      rawText: trimmed,
      accessToken,
      sessionToken,
      targetEmail: (targetEmail || "").trim().toLowerCase(),
      planType,
      accountId,
      expTimestamp,
      cookies
    };
  };

  const openTokenModal = (defaultEmail = "") => {
    if (!cancelModal || !modalContent) return;
    const template = document.getElementById("add-token-modal-template");
    if (!template) return;

    modalContent.innerHTML = template.innerHTML;
    cancelModal.style.display = "flex";

    const emailInput = modalContent.querySelector("#token-modal-email");
    const rawInput = modalContent.querySelector("#token-modal-raw");
    const previewDiv = modalContent.querySelector("#token-modal-preview");
    const previewDetails = modalContent.querySelector("#token-preview-details");
    const saveBtn = modalContent.querySelector("#save-token-submit-btn");
    const cancelBtn = modalContent.querySelector("#close-token-modal-btn");
    const msgDiv = modalContent.querySelector("#token-modal-msg");

    if (defaultEmail && emailInput) {
      emailInput.value = defaultEmail;
    }

    const updatePreview = () => {
      const parsed = parseTokenInput(rawInput.value);
      if (!parsed || (!parsed.accessToken && !parsed.sessionToken && !parsed.targetEmail)) {
        previewDiv.style.display = "none";
        return;
      }
      previewDiv.style.display = "block";
      if (parsed.targetEmail && (!emailInput.value || emailInput.value === defaultEmail)) {
        emailInput.value = parsed.targetEmail;
      }

      let expStr = "Unknown";
      if (parsed.expTimestamp) {
        expStr = new Date(parsed.expTimestamp * 1000).toLocaleString();
      }

      const safeDetectedEmail = escapeHtml(parsed.targetEmail || emailInput.value || "");
      const safePlanType = escapeHtml(parsed.planType || "Standard/Team");
      const safeExpStr = escapeHtml(expStr);

      previewDetails.innerHTML = `
        <div><strong>Detected Email:</strong> ${safeDetectedEmail || '<span style="color:#f59e0b;">None (please specify)</span>'}</div>
        <div><strong>Access Token:</strong> ${parsed.accessToken ? '<span style="color:#10b981;"><i class="fa-solid fa-check"></i> Present (JWT)</span>' : '<span style="color:#ef4444;">Missing</span>'}</div>
        <div><strong>Session Token:</strong> ${parsed.sessionToken ? '<span style="color:#10b981;"><i class="fa-solid fa-check"></i> Present</span>' : '<span style="color:#94a3b8;">None</span>'}</div>
        <div><strong>Plan Type:</strong> ${safePlanType}</div>
        <div><strong>Expires At:</strong> ${safeExpStr}</div>
      `;
    };

    if (rawInput) {
      rawInput.addEventListener("input", updatePreview);
      rawInput.addEventListener("paste", () => setTimeout(updatePreview, 50));
    }

    if (cancelBtn) {
      cancelBtn.onclick = () => {
        cancelModal.style.display = "none";
      };
    }

    if (saveBtn) {
      saveBtn.onclick = async () => {
        msgDiv.innerHTML = "";
        const email = (emailInput?.value || "").trim().toLowerCase();
        const raw = rawInput?.value || "";

        if (!raw.trim()) {
          msgDiv.innerHTML = `<span style="color:#ef4444;">Please paste the token or session payload.</span>`;
          return;
        }

        const parsed = parseTokenInput(raw);
        const finalEmail = email || parsed?.targetEmail;
        if (!finalEmail) {
          msgDiv.innerHTML = `<span style="color:#ef4444;">Could not determine target email. Please enter the account email above.</span>`;
          return;
        }

        saveBtn.disabled = true;
        saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;

        try {
          const updateRecord = {
            email: finalEmail,
            cookies: parsed.cookies || {},
            raw: parsed.raw,
            updated_at: new Date().toISOString(),
            status: "active",
            error: null
          };
          if (parsed.accessToken) updateRecord.access_token = parsed.accessToken;
          if (parsed.expTimestamp) updateRecord.access_token_exp = parsed.expTimestamp;

          let success = false;

          if (window.supabaseClient) {
            const { error: sbErr } = await window.supabaseClient
              .from("gpt_account_tokens")
              .upsert(updateRecord, { onConflict: "email" });
            if (!sbErr) {
              success = true;
            } else {
              console.warn("Direct upsert returned error, trying Edge Function fallback:", sbErr);
            }
          }

          if (!success) {
            const token = await getAuthToken();
            const res = await fetch(`${window.SUPABASE_URL}/functions/v1/save_gpt_token`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
              },
              body: JSON.stringify({
                email: finalEmail,
                rawInput: parsed.rawText || raw
              })
            });
            const resData = await res.json().catch(() => ({}));
            if (!res.ok || resData.error) {
              throw new Error(resData.error || `Failed with HTTP ${res.status}`);
            }
            success = true;
          }

          msgDiv.innerHTML = `<span style="color:#10b981; font-weight:600;"><i class="fa-solid fa-circle-check"></i> Token saved successfully for ${finalEmail}!</span>`;

          setTimeout(() => {
            cancelModal.style.display = "none";
            if (accountsViewSelector.value === "custom_domain_accounts") {
              fetchAccountsOrIssues("custom_domain_accounts");
            }
          }, 1200);

        } catch (err) {
          console.error("Save token error:", err);
          msgDiv.innerHTML = `<span style="color:#ef4444;">Error saving token: ${err.message}</span>`;
        } finally {
          saveBtn.disabled = false;
          saveBtn.innerHTML = `<i class="fa-solid fa-floppy-disk" style="color:#fff;"></i> Save Token`;
        }
      };
    }
  };

  const fetchAccountsOrIssues = async (action) => {
    clearMessageAccs();
    showSpinnerAccs(true);
    stopTotpTicker();
    accountsIssuesTableHead.innerHTML = "";
    accountsIssuesTableBody.innerHTML = "";

    try {
      const token = await getAuthToken();

      if (action === "custom_domain_accounts") {
        accountsIssuesTitle.innerHTML = `
          <span>Custom Domain Accounts</span>
          <span style="font-size:0.82rem; font-weight:normal; color:var(--text-muted); margin-left:12px;">
            Live 2FA synced (<strong class="totp-countdown-global" style="color:#10b981;">30s</strong> cycle)
          </span>
        `;

        let accs = [];
        let tokenMap = new Map();

        let fetchedViaClient = false;
        if (window.supabaseClient) {
          try {
            const [accsRes, tokensRes] = await Promise.all([
              window.supabaseClient
                .from("accounts")
                .select("id, email, password, two_factor_key, last_link"),
              window.supabaseClient
                .from("gpt_account_tokens")
                .select("email, access_token_exp, status, updated_at")
            ]);

            if (accsRes.data && accsRes.data.length > 0) {
              accs = accsRes.data;
              fetchedViaClient = true;
              if (tokensRes.data) {
                tokensRes.data.forEach(t => tokenMap.set((t.email || "").toLowerCase().trim(), t));
              }
            }
          } catch (e) {
            console.warn("Client fetch failed, using edge function fallback:", e);
          }
        }

        if (!fetchedViaClient) {
          const response = await fetch(window.SUPABASE_URL + "/functions/v1/fetchpendingpayment", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ action: "custom_domain_accounts" })
          });
          const json = await response.json();
          if (json.error) throw new Error(json.error);
          accs = json.accounts || [];
        }

        const normalProviders = new Set([
          "gmail.com",
          "googlemail.com",
          "hotmail.com",
          "outlook.com",
          "live.com",
          "icloud.com",
          "yahoo.com",
          "aol.com",
          "msn.com"
        ]);

        const customDomainAccounts = (accs || []).filter(item => {
          const em = (item.email || "").trim().toLowerCase();
          if (!em.includes("@")) return false;
          const domain = em.split("@").pop().trim();
          return domain && !normalProviders.has(domain);
        });

        customDomainAccounts.sort((a, b) => {
          const dA = (a.email || "").split("@").pop();
          const dB = (b.email || "").split("@").pop();
          if (dA !== dB) return dA.localeCompare(dB);
          return (a.email || "").localeCompare(b.email || "");
        });

        accountsIssuesTable.classList.add("accounts-table");
        accountsIssuesTableHead.innerHTML = `
          <tr>
            <th style="width: 28%;">Account <button class="sort-btn" data-column="0">↕️</button></th>
            <th style="width: 22%;">Password <button class="sort-btn" data-column="1">↕️</button></th>
            <th style="width: 26%;">Current Code (2FA) <button class="sort-btn" data-column="2">↕️</button></th>
            <th style="width: 12%;">Token Status <button class="sort-btn" data-column="3">↕️</button></th>
            <th style="width: 12%; text-align: right;">Token</th>
          </tr>`;

        if (customDomainAccounts.length === 0) {
          const tr = document.createElement("tr");
          tr.innerHTML = `<td colspan="5" style="text-align:center; padding:40px; color:var(--text-muted); font-size:0.92rem;"><i class="fa-solid fa-inbox" style="font-size:1.8rem; display:block; margin-bottom:10px; opacity:0.5;"></i>No custom domain accounts found.</td>`;
          accountsIssuesTableBody.appendChild(tr);
        } else {
          customDomainAccounts.forEach((row, idx) => {
            const em = (row.email || "").trim();
            const domain = em.includes("@") ? em.split("@")[1].toLowerCase() : "";
            const pass = row.password || "";
            const key = (row.two_factor_key || "").trim();
            const rowId = `totp-code-${row.id || idx}`;

            let tokenStatusBadge = "";
            let t = row.has_token ? row : tokenMap.get(em.toLowerCase());
            if (t) {
              const exp = t.token_exp || t.access_token_exp;
              let expInfo = "";
              if (exp) {
                const nowSec = Math.floor(Date.now() / 1000);
                if (exp < nowSec) {
                  expInfo = `<span style="color:#f87171; font-size:0.72rem; margin-top:2px;">Expired</span>`;
                } else {
                  const days = Math.round((exp - nowSec) / 86400);
                  expInfo = `<span style="color:#34d399; font-size:0.72rem; margin-top:2px;">Valid ${days}d</span>`;
                }
              }
              tokenStatusBadge = `
                <div style="display:inline-flex; flex-direction:column;">
                  <span class="status-pill active">
                    <i class="fa-solid fa-circle-check"></i> Active
                  </span>
                  ${expInfo}
                </div>`;
            } else {
              tokenStatusBadge = `
                <span class="status-pill missing">
                  <i class="fa-solid fa-circle-xmark"></i> Missing
                </span>`;
            }

            let codeDisplay = "";
            if (key) {
              activeTotpItems.push({ id: rowId, secret: key });
              // Compute initial code immediately without waiting
              const initialCode = computeTOTP(key);

              codeDisplay = `
                <div class="totp-chip">
                  <!-- Radial Progress Timer -->
                  <div class="totp-ring-box" title="Validity countdown">
                    <svg class="totp-ring-svg" viewBox="0 0 28 28">
                      <circle class="totp-ring-bg" cx="14" cy="14" r="11"></circle>
                      <circle class="totp-ring-progress" cx="14" cy="14" r="11" stroke-dasharray="69.115" stroke-dashoffset="0"></circle>
                    </svg>
                    <span class="totp-ring-text">30</span>
                  </div>

                  <!-- 6-digit TOTP code with click-to-copy -->
                  <span id="${rowId}" class="totp-code-display" title="Click to copy code" data-copy="${initialCode}">
                    ${initialCode}
                  </span>

                  <!-- Dedicated Copy Button -->
                  <button id="btn-${rowId}" class="btn-copy-chip copy-totp-icon-btn" data-row-id="${rowId}" data-secret="${key}" data-code="${initialCode}" title="Copy Code">
                    <i class="fa-regular fa-copy"></i>
                  </button>
                </div>
              `;
            } else {
              codeDisplay = `<span style="color:#64748b; font-size:0.78rem; font-style:italic;">No 2FA secret</span>`;
            }

            const safeEm = escapeHtml(em);
            const safeDomain = escapeHtml(domain);
            const safePass = escapeHtml(pass);

            const tr = document.createElement("tr");
            tr.innerHTML = `
              <td data-label="Account">
                <div class="acc-identity">
                  <div class="acc-avatar">
                    <i class="fa-solid fa-server"></i>
                  </div>
                  <div class="acc-details">
                    <span class="acc-email-text" title="Click to copy email" data-copy="${safeEm}">
                      ${safeEm} <i class="fa-regular fa-copy" style="font-size:0.72rem; opacity:0.6;"></i>
                    </span>
                    <span class="acc-domain-tag">@${safeDomain}</span>
                  </div>
                </div>
              </td>
              <td data-label="Password">
                <div class="acc-pass-pill" title="Click to copy password" data-copy="${safePass}">
                  <span class="acc-pass-code">${safePass || "—"}</span>
                  <i class="fa-regular fa-copy acc-pass-icon"></i>
                </div>
              </td>
              <td data-label="Verification Code">
                ${codeDisplay}
              </td>
              <td data-label="Token Status">
                ${tokenStatusBadge}
              </td>
              <td data-label="Action" style="text-align: right;">
                <button class="btn-row-token add-token-row-btn" data-email="${safeEm}" title="Add/Update Token">
                  <i class="fa-solid fa-key" style="color:#10b981;"></i> Update
                </button>
              </td>
            `;
            accountsIssuesTableBody.appendChild(tr);
          });

          // Launch synchronous real-time timer
          startTotpTicker();
        }

      } else {
        const response = await fetch(window.SUPABASE_URL + "/functions/v1/fetchpendingpayment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ action })
        });
        const json = await response.json();
        if (json.error) throw new Error(json.error);

        if (action === "accs") {
          accountsIssuesTitle.textContent = "All Netflix Accounts";
          const accs = json.accs || [];
          accountsIssuesTableHead.innerHTML = `
              <tr>
                <th>Email <button class="sort-btn" data-column="0">↕️</button></th>
                <th>Password <button class="sort-btn" data-column="1">↕️</button></th>
                <th>Uses <button class="sort-btn" data-column="2">↕️</button></th>
              </tr>`;
          if (accs.length === 0) {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td colspan="3" style="text-align:center;">No accounts found.</td>`;
            accountsIssuesTableBody.appendChild(tr);
          } else {
            accs.forEach((row) => {
              const tr = document.createElement("tr");
              tr.innerHTML = `
                  <td data-label="Email"><span class="truncate-text" title="Click to copy" onclick="navigator.clipboard.writeText('${row.email || ''}'); showMessageAccs('Copied email!', 'success')">${row.email}</span></td>
                  <td data-label="Password"><span class="truncate-text" title="Click to copy" onclick="navigator.clipboard.writeText('${row.pass || ''}'); showMessageAccs('Copied password!', 'success')">${row.pass || ""}</span></td>
                  <td data-label="Uses">${row.uses ?? 0}</td>`;
              accountsIssuesTableBody.appendChild(tr);
            });
          }
        } else if (action === "fetchissues" || action === "fetchunfixed") {
          const isAll = action === "fetchissues";
          accountsIssuesTitle.textContent = isAll ? "All Issues" : "Unsolved Issues";
          const dataKey = isAll ? "issues" : "unfixed";
          const issues = json[dataKey] || [];
          accountsIssuesTableHead.innerHTML = `
              <tr>
                <th>ID <button class="sort-btn" data-column="0">↕️</button></th>
                <th>Acc Email <button class="sort-btn" data-column="1">↕️</button></th>
                <th>Solved? <button class="sort-btn" data-column="2">↕️</button></th>
                <th>Used <button class="sort-btn" data-column="3">↕️</button></th>
                <th>Action</th>
              </tr>`;
          if (issues.length === 0) {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td colspan="5" style="text-align:center;">No issues found.</td>`;
            accountsIssuesTableBody.appendChild(tr);
          } else {
            issues.forEach((row) => {
              const solvedText = row.solved ? "Yes" : "No";
              let actionBtnHtml = "";
              if (row.used === 1) {
                actionBtnHtml = `<button class="btn-table-action btn-success mark-fixed-btn" data-id="${row.id}"><i class="fa-solid fa-check"></i> Mark as Fixed</button>`;
              } else {
                actionBtnHtml = `<button class="btn-table-action btn-delete delete-acc-btn" data-email="${row.accemail}"><i class="fa-solid fa-trash"></i> Delete Account</button>`;
              }
              const tr = document.createElement("tr");
              tr.innerHTML = `
                  <td data-label="ID">${row.id}</td>
                  <td data-label="Acc Email"><span class="truncate-text" title="Click to copy" onclick="navigator.clipboard.writeText('${row.accemail || ''}'); showMessageAccs('Copied email!', 'success')">${row.accemail}</span></td>
                  <td data-label="Solved?">${solvedText}</td>
                  <td data-label="Used">${row.used}</td>
                  <td data-label="Action">${actionBtnHtml}</td>`;
              accountsIssuesTableBody.appendChild(tr);
            });
          }
        }
      }

      filterAccountsTable();
    } catch (err) {
      console.error("Error fetching data:", err);
      showMessageAccs("Error fetching data.", "error");
    } finally {
      showSpinnerAccs(false);
    }
  };

  const init = () => {
    if (addAccForm) {
      addAccForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        clearMessageAccs();
        showSpinnerAccs(true);
        addAccBtn.disabled = true;

        const emailValue = accEmail.value.trim();
        const passValue = accPass.value.trim();
        const serviceValue = accService.value;

        const links = [link1El, link2El, link3El, link4El, link5El].map(el => el ? el.value.trim() : "");

        if (serviceValue === "Anghami" && links.some(link => !link)) {
          showMessageAccs("All five Anghami links are required.", "error");
          showSpinnerAccs(false);
          addAccBtn.disabled = false;
          return;
        }

        let url, payload;
        if (serviceValue === "Anghami") {
          url = "/functions/v1/addanghamiacc";
          payload = { email: emailValue, pass: passValue, link1: links[0], link2: links[1], link3: links[2], link4: links[3], link5: links[4] };
        } else if (serviceValue === "chatGPT") {
          url = "/functions/v1/addgptacc";
          payload = { email: emailValue, pass: passValue };
        } else {
          url = "/functions/v1/addnfacc";
          payload = { email: emailValue, pass: passValue };
        }

        try {
          const token = await getAuthToken();
          const response = await fetch(window.SUPABASE_URL + url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
          });

          const data = await response.json();
          if (!response.ok || data.error) throw new Error(data.error || "Unknown error");

          showMessageAccs("Account added successfully!", "success");
          addAccForm.reset();
          fetchAccountsOrIssues(accountsViewSelector.value);
        } catch (err) {
          showMessageAccs(`Error: ${err.message}`, "error");
        } finally {
          showSpinnerAccs(false);
          addAccBtn.disabled = false;
        }
      });
    }

    if (accountsViewSelector) {
      accountsViewSelector.addEventListener("change", (e) => {
        fetchAccountsOrIssues(accountsViewSelector.value);
      });
    }

    if (openTokenModalBtn) {
      openTokenModalBtn.addEventListener("click", () => {
        openTokenModal("");
      });
    }

    if (accountsIssuesTableBody) {
      accountsIssuesTableBody.addEventListener("click", async (e) => {
        // 1. Delegated generic copy handler (email, pass, code text)
        const copyTarget = e.target.closest("[data-copy]");
        if (copyTarget && !copyTarget.closest("button")) {
          const val = copyTarget.dataset.copy;
          if (val) {
            await navigator.clipboard.writeText(val);
            showMessageAccs("Copied to clipboard!", "success");
            return;
          }
        }

        // 2. Button clicks
        const btn = e.target.closest("button");
        if (!btn) return;

        if (btn.classList.contains("copy-totp-icon-btn")) {
          const rowId = btn.dataset.rowId;
          const secret = btn.dataset.secret;
          let code = btn.dataset.code;

          if (!code || code === "—") {
            code = computeTOTP(secret);
          }

          if (code && code !== "—") {
            await navigator.clipboard.writeText(code);
            showMessageAccs(`Copied verification code ${code}!`, "success");

            // Instant visual feedback: turn icon into green checkmark
            btn.classList.add("just-copied");
            btn.innerHTML = `<i class="fa-solid fa-check"></i>`;

            setTimeout(() => {
              btn.classList.remove("just-copied");
              btn.innerHTML = `<i class="fa-regular fa-copy"></i>`;
            }, 1800);
          }
        } else if (btn.classList.contains("mark-fixed-btn")) {
          const id = btn.dataset.id;
          const oldText = btn.textContent;
          try {
            btn.disabled = true;
            btn.textContent = "Wait...";
            await markAsFixed(id);
          } finally {
            btn.disabled = false;
            btn.textContent = oldText;
          }
        } else if (btn.classList.contains("delete-acc-btn")) {
          const email = btn.dataset.email;
          if (!confirm(`Are you sure you want to delete account ${email}?`)) return;
          const oldText = btn.textContent;
          try {
            btn.disabled = true;
            btn.textContent = "Wait...";
            await deleteAcc(email);
          } finally {
            btn.disabled = false;
            btn.textContent = oldText;
          }
        } else if (btn.classList.contains("add-token-row-btn")) {
          const email = btn.dataset.email;
          openTokenModal(email);
        }
      });
    }

    if (accountsViewSelector) {
      fetchAccountsOrIssues(accountsViewSelector.value);
    }
  };

  return {
    showSpinnerAccs,
    showMessageAccs,
    clearMessageAccs,
    fetchAccountsOrIssues,
    openTokenModal,
    markAsFixed,
    deleteAcc,
    init
  };
})();

document.addEventListener("DOMContentLoaded", () => {
  window.Accounts.init();
});
