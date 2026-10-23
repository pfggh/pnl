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

  // Interval for 2FA timer updates in accounts view
  let accountsTotpInterval = null;
  let activeTotpGenerators = [];

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

  // Helper functions for UI feedback
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

  // Base32 decoding and TOTP code generation (RFC 6238 / RFC 4226)
  function base32ToBytes(base32) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = 0;
    let value = 0;
    const bytes = [];
    for (let i = 0; i < base32.length; i++) {
      const idx = alphabet.indexOf(base32[i].toUpperCase());
      if (idx === -1) continue;
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }
    return new Uint8Array(bytes);
  }

  async function generateTOTP(secret, offsetSeconds = 0) {
    try {
      if (!secret) return "—";
      const base32 = secret.replace(/\s/g, "");
      const keyBytes = base32ToBytes(base32);
      if (keyBytes.length === 0) return "—";

      const epoch = Math.floor(Date.now() / 1000) + offsetSeconds;
      const time = Math.floor(epoch / 30);

      const timeBuffer = new ArrayBuffer(8);
      const view = new DataView(timeBuffer);
      view.setUint32(4, time);

      const cryptoKey = await window.crypto.subtle.importKey(
        "raw",
        keyBytes,
        { name: "HMAC", hash: { name: "SHA-1" } },
        false,
        ["sign"]
      );

      const signature = await window.crypto.subtle.sign("HMAC", cryptoKey, timeBuffer);
      const hmac = new Uint8Array(signature);
      const offset = hmac[hmac.length - 1] & 0xf;
      const binary =
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 8) << 8) | // safe bitwise ops
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);

      return (binary % 1000000).toString().padStart(6, "0");
    } catch (err) {
      console.error("Error generating TOTP:", err);
      return "Error";
    }
  }

  // Exact standard RFC 6238 TOTP implementation
  async function computeCode(secret) {
    if (!secret) return "—";
    try {
      const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
      const clean = secret.toUpperCase().replace(/[\s=-]/g, "");
      let bits = 0;
      let val = 0;
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
      if (bytes.length === 0) return "—";

      const epoch = Math.floor(Date.now() / 1000);
      const counter = Math.floor(epoch / 30);
      const buf = new ArrayBuffer(8);
      const dv = new DataView(buf);
      dv.setUint32(4, counter);

      const key = await window.crypto.subtle.importKey(
        "raw",
        new Uint8Array(bytes),
        { name: "HMAC", hash: "SHA-1" },
        false,
        ["sign"]
      );
      const sig = await window.crypto.subtle.sign("HMAC", key, buf);
      const h = new Uint8Array(sig);
      const offset = h[h.length - 1] & 0x0f;
      const binary =
        ((h[offset] & 0x7f) << 24) |
        ((h[offset + 1] & 0xff) << 16) |
        ((h[offset + 2] & 0xff) << 8) |
        (h[offset + 3] & 0xff);
      return (binary % 1000000).toString().padStart(6, "0");
    } catch (e) {
      console.error("TOTP compute error:", e);
      return "—";
    }
  }

  function startTotpTicker() {
    stopTotpTicker();
    const updateAllCodes = async () => {
      const epoch = Math.floor(Date.now() / 1000);
      const secsLeft = 30 - (epoch % 30);
      const timerSpans = document.querySelectorAll(".totp-countdown-global");
      timerSpans.forEach(span => {
        span.textContent = `${secsLeft}s`;
        if (secsLeft <= 5) {
          span.style.color = "#ef4444";
        } else {
          span.style.color = "#10b981";
        }
      });

      for (const item of activeTotpGenerators) {
        const el = document.getElementById(item.id);
        if (el) {
          const code = await computeCode(item.secret);
          el.textContent = code;
          const copyBtn = document.getElementById(`copy-${item.id}`);
          if (copyBtn) copyBtn.dataset.code = code;
        }
      }
    };

    updateAllCodes();
    accountsTotpInterval = setInterval(updateAllCodes, 1000);
  }

  function stopTotpTicker() {
    if (accountsTotpInterval) {
      clearInterval(accountsTotpInterval);
      accountsTotpInterval = null;
    }
    activeTotpGenerators = [];
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

  // Mark an issue as fixed
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

  // Delete an account (when `used=0`)
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
        if (btn) {
          btn.closest("tr")?.remove();
        }
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
      } catch (e) {
        // Not valid JSON
      }
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

    // Try decoding JWT for accessToken to extract claims & email
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

  // Open the Add Token Modal
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

      previewDetails.innerHTML = `
        <div><strong>Detected Email:</strong> ${parsed.targetEmail || emailInput.value || '<span style="color:#f59e0b;">None (please specify)</span>'}</div>
        <div><strong>Access Token:</strong> ${parsed.accessToken ? '<span style="color:#10b981;"><i class="fa-solid fa-check"></i> Present (JWT)</span>' : '<span style="color:#ef4444;">Missing</span>'}</div>
        <div><strong>Session Token:</strong> ${parsed.sessionToken ? '<span style="color:#10b981;"><i class="fa-solid fa-check"></i> Present</span>' : '<span style="color:#94a3b8;">None</span>'}</div>
        <div><strong>Plan Type:</strong> ${parsed.planType || 'Standard/Team'}</div>
        <div><strong>Expires At:</strong> ${expStr}</div>
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
          // Prepare DB record
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

          // Attempt 1: Direct Supabase client upsert (authenticated)
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

          // Attempt 2: Edge function save_gpt_token fallback if direct client failed
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

  // Fetch and render accounts or issues based on selected action
  const fetchAccountsOrIssues = async (action) => {
    clearMessageAccs();
    showSpinnerAccs(true);
    stopTotpTicker();
    accountsIssuesTableHead.innerHTML = "";
    accountsIssuesTableBody.innerHTML = "";

    try {
      const token = await getAuthToken();

      if (action === "custom_domain_accounts") {
        // Custom Domain Accounts view (All emails, passwords & current verification codes from 'accounts' excluding normal providers)
        accountsIssuesTitle.innerHTML = `
          <span>Custom Domain Accounts (ChatGPT & Team Accounts)</span>
          <span style="font-size:0.82rem; font-weight:normal; color:var(--text-muted); margin-left:12px;">
            TOTP refreshes in <strong class="totp-countdown-global" style="color:#10b981;">30s</strong>
          </span>
        `;

        let accs = [];
        let tokenMap = new Map();

        // Query accounts and tokens (client or edge function)
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

        // Filter out normal email providers (gmail, hotmail, outlook, yahoo, icloud, etc.)
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

        // Sort by domain then email
        customDomainAccounts.sort((a, b) => {
          const dA = (a.email || "").split("@").pop();
          const dB = (b.email || "").split("@").pop();
          if (dA !== dB) return dA.localeCompare(dB);
          return (a.email || "").localeCompare(b.email || "");
        });

        accountsIssuesTableHead.innerHTML = `
          <tr>
            <th>Email <button class="sort-btn" data-column="0">↕️</button></th>
            <th>Password <button class="sort-btn" data-column="1">↕️</button></th>
            <th>Verification Code (2FA) <button class="sort-btn" data-column="2">↕️</button></th>
            <th>Token Status <button class="sort-btn" data-column="3">↕️</button></th>
            <th>Action</th>
          </tr>`;

        if (customDomainAccounts.length === 0) {
          const tr = document.createElement("tr");
          tr.innerHTML = `<td colspan="5" style="text-align:center; padding:30px; color:var(--text-muted);">No custom domain accounts found in 'accounts'.</td>`;
          accountsIssuesTableBody.appendChild(tr);
        } else {
          customDomainAccounts.forEach((row, idx) => {
            const em = (row.email || "").trim();
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
                  expInfo = `<span style="color:#ef4444; font-size:0.75rem; display:block;">Expired</span>`;
                } else {
                  const days = Math.round((exp - nowSec) / 86400);
                  expInfo = `<span style="color:#10b981; font-size:0.75rem; display:block;">Exp in ${days}d</span>`;
                }
              }
              tokenStatusBadge = `
                <div style="display:inline-flex; flex-direction:column;">
                  <span class="badge" style="background:rgba(16, 185, 129, 0.15); color:#10b981; border:1px solid rgba(16, 185, 129, 0.3); padding:3px 8px; border-radius:6px; font-size:0.78rem; font-weight:600;">
                    <i class="fa-solid fa-circle-check"></i> Active
                  </span>
                  ${expInfo}
                </div>`;
            } else {
              tokenStatusBadge = `
                <span class="badge" style="background:rgba(239, 68, 68, 0.15); color:#ef4444; border:1px solid rgba(239, 68, 68, 0.3); padding:3px 8px; border-radius:6px; font-size:0.78rem;">
                  <i class="fa-solid fa-circle-xmark"></i> Missing
                </span>`;
            }

            let codeDisplay = "";
            if (key) {
              activeTotpGenerators.push({ id: rowId, secret: key });
              codeDisplay = `
                <div style="display:flex; align-items:center; gap:8px;">
                  <span id="${rowId}" style="font-family:monospace; font-size:1.05rem; font-weight:700; color:#38bdf8; letter-spacing:1px;">...</span>
                  <button id="copy-${rowId}" class="copy-totp-btn pill-btn" data-code="" style="padding:4px 8px; font-size:0.75rem; background:rgba(56, 189, 248, 0.15); border-color:rgba(56, 189, 248, 0.4); color:#38bdf8;">
                    <i class="fa-solid fa-copy"></i>
                  </button>
                </div>
              `;
            } else {
              codeDisplay = `<span style="color:var(--text-muted); font-size:0.8rem;">No 2FA key</span>`;
            }

            const tr = document.createElement("tr");
            tr.innerHTML = `
              <td data-label="Email">
                <span class="truncate-text" title="Click to copy email" style="cursor:pointer; font-weight:500;" onclick="navigator.clipboard.writeText('${em}'); window.Accounts.showMessageAccs('Copied email!', 'success')">
                  ${em}
                </span>
              </td>
              <td data-label="Password">
                <span class="truncate-text" title="Click to copy password" style="cursor:pointer; font-family:monospace;" onclick="navigator.clipboard.writeText('${pass.replace(/'/g, "\\'")}'); window.Accounts.showMessageAccs('Copied password!', 'success')">
                  ${pass || "—"}
                </span>
              </td>
              <td data-label="Verification Code">
                ${codeDisplay}
              </td>
              <td data-label="Token Status">
                ${tokenStatusBadge}
              </td>
              <td data-label="Action">
                <button class="pill-btn add-token-row-btn" data-email="${em}" style="padding:6px 12px; font-size:0.78rem; background:rgba(16, 185, 129, 0.15); border-color:#10b981; color:#34d399;">
                  <i class="fa-solid fa-key" style="color:#34d399;"></i> Add / Update Token
                </button>
              </td>
            `;
            accountsIssuesTableBody.appendChild(tr);
          });

          // Start real-time generator
          startTotpTicker();
        }

      } else {
        // Standard Netflix accs or issues views
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

  // Initialize event listeners for Accounts page
  const init = () => {
    // New account form submission
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

    // View selector listener
    if (accountsViewSelector) {
      accountsViewSelector.addEventListener("change", (e) => {
        fetchAccountsOrIssues(accountsViewSelector.value);
      });
    }

    // Top Add Token button listener
    if (openTokenModalBtn) {
      openTokenModalBtn.addEventListener("click", () => {
        openTokenModal("");
      });
    }

    // Table click listener for actions
    if (accountsIssuesTableBody) {
      accountsIssuesTableBody.addEventListener("click", async (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;

        if (btn.classList.contains("mark-fixed-btn")) {
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
        } else if (btn.classList.contains("copy-totp-btn")) {
          const code = btn.dataset.code;
          if (code && code !== "—") {
            navigator.clipboard.writeText(code);
            showMessageAccs(`Copied code ${code}!`, "success");
          }
        } else if (btn.classList.contains("add-token-row-btn")) {
          const email = btn.dataset.email;
          openTokenModal(email);
        }
      });
    }

    // Fetch default view
    if (accountsViewSelector) {
      fetchAccountsOrIssues(accountsViewSelector.value);
    }
  };

  // Expose module methods
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
