window.Teams = (() => {
  // Element references
  const spinner = document.getElementById("spinner-teams");
  const messageBox = document.getElementById("message-box-teams");
  const fixForm = document.getElementById("fix-shared-form");
  const fixInput = document.getElementById("fix-email");
  const fixSearchBtn = document.getElementById("fix-search-btn");
  const fixBtn = document.getElementById("fix-btn");
  const fixResultsDiv = document.getElementById("fix-results");
  const pBtn = document.getElementById("p-btn");
  const pResult = document.getElementById("private-results");
  // (private-invite-form removed from DOM in panel.html)

  // --- Fix Private Workspace Vars ---
  const fixPForm = document.getElementById("fix-private-form");
  const fixPEmail = document.getElementById("fix-p-email");
  const fixPSearchBtn = document.getElementById("fix-p-search-btn");
  const fixPReplaceBtn = document.getElementById("fix-p-replace-btn");
  const fixPResults = document.getElementById("fix-p-results");

  // --- Helpers ---
  const showSpinner = (show = true) => {
    if (spinner) spinner.style.display = show ? "block" : "none";
  };

  const showMessage = (text, type = "success") => {
    if (!messageBox) return;
    messageBox.textContent = text;
    messageBox.className = "message-box " + type;
    messageBox.style.display = "block";
  };

  const clearMessage = () => {
    if (messageBox) {
      messageBox.style.display = "none";
      messageBox.textContent = "";
    }
  };

  const KENDEV_TOKEN = "mcg__xCCjEvfwLnhYFNZ5ptTOxM6Gxwygw98pZCAFCEFM6xkH5_mGXxg-uQOk_Q6Z86U";

  const fetchKendevDetails = async (id) => {
    try {
      const targetUrl = `https://kendev.id.vn/api/v2/teams/${id}`;
      // Using corsproxy.io to bypass browser CORS restrictions
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
      
      const response = await fetch(proxyUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${KENDEV_TOKEN}`,
          "Content-Type": "application/json"
        }
      });
      const json = await response.json();
      // Since it's a proxy, we check the body status
      if (!response.ok || (json && json.ok === false)) throw new Error(json?.error || "Kendev error");
      return json.data;
    } catch (err) {
      console.error("Kendev Proxy Fetch error:", err);
      return null;
    }
  };

  // --- 1. Fix/Migrate Shared Teams (Supply pool) ---

  const renderSharedInfo = (data, kendevData, email) => {
    // If fresh Kendev fetch failed (CORS), fallback to data already in Supabase DB
    const source = kendevData || data.team;
    const isStaleFallback = !kendevData;

    // 2. Format Dates
    const createdAt = source.createdAt ? new Date(source.createdAt).toLocaleString() : 'N/A';
    const tokenStatus = (source.tokenStatus || 'N/A').toLowerCase();
    const syncStatus = (source.syncStatus || 'N/A').toLowerCase();
    const teamId = source.id || 'N/A';

    // Status Badge
    const statusBadge = tokenStatus === 'active'
      ? `<span style="background:#dcfce7; color:#166534; padding:2px 8px; border-radius:6px; font-size:0.75em; font-weight:bold; border:1px solid #bbf7d0;">ACTIVE</span>`
      : `<span style="background:#fee2e2; color:#991b1b; padding:2px 8px; border-radius:6px; font-size:0.75em; font-weight:bold; border:1px solid #fecaca;">${tokenStatus.toUpperCase()}</span>`;

    // 4. Inject HTML
    fixResultsDiv.innerHTML = `
      <div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:20px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); color: #1e293b; font-size: 0.95em;">
        ${isStaleFallback ? `<div style="background:#fff7ed; color:#9a3412; border:1px solid #ffedd5; padding:10px; border-radius:8px; font-size:0.8em; margin-bottom:15px; display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-triangle-exclamation"></i> Kendev API (CORS) Blocked. Showing database fallback.</div>` : ''}
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;">
            <div>
                <div style="margin-bottom:4px;">User: <b style="color:#4f46e5;">Shared</b></div>
                <div style="font-size:0.85em; color:#64748b;">Email: <b>${email}</b></div>
            </div>
            ${statusBadge}
        </div>

        <div style="border-top: 1px solid #f1f5f9; padding-top:15px; margin-top:5px;">
            <div style="font-size:0.75em; color:#94a3b8; font-weight:700; text-transform:uppercase; margin-bottom:8px;">Workspace Details:</div>
            <div style="display:flex; flex-direction:column; gap:8px;">
                <div style="display:flex; align-items:center;">
                    <span style="width:100px; font-size:0.8em; color:#64748b;">ID:</span>
                    <code style="font-size:0.85em; color: #475569;">${teamId}</code>
                </div>
                <div style="display:flex; align-items:center;">
                    <span style="width:100px; font-size:0.8em; color:#64748b;">Added At:</span>
                    <span style="font-size:0.85em;">${createdAt}</span>
                </div>
                <div style="display:flex; align-items:center;">
                    <span style="width:100px; font-size:0.8em; color:#64748b;">Token Status:</span>
                    <span style="font-size:0.85em; font-weight:700; color:${tokenStatus === 'active' ? '#16a34a' : '#ef4444'}">${tokenStatus.toUpperCase()}</span>
                </div>
                <div style="display:flex; align-items:center;">
                    <span style="width:100px; font-size:0.8em; color:#64748b;">Sync Status:</span>
                    <span style="font-size:0.85em; font-weight:700; color:${syncStatus === 'active' ? '#16a34a' : '#ef4444'}">${syncStatus.toUpperCase()}</span>
                </div>
            </div>
        </div>
      </div>
    `;
    fixResultsDiv.style.display = "block";

    if (fixBtn) {
      if (tokenStatus === 'active') {
        fixBtn.disabled = true;
        fixBtn.style.opacity = "0.6";
        fixBtn.style.cursor = "not-allowed";
        fixBtn.innerHTML = `<i class="fa-solid fa-circle-info"></i> cannot replace team is active`;
      } else {
        fixBtn.disabled = false;
        fixBtn.style.opacity = "1";
        fixBtn.style.cursor = "pointer";
        fixBtn.innerHTML = `<i class="fa-solid fa-rocket"></i> Migrate User`;
      }
      fixBtn.style.display = "inline-block";
    }
  };

  const handleFixSharedSearch = async (e) => {
    e.preventDefault();
    clearMessage();

    const email = fixInput.value.trim();
    if (!email) return showMessage("Enter an email", "error");

    showSpinner(true);
    fixSearchBtn.disabled = true;
    fixResultsDiv.innerHTML = "";
    fixBtn.style.display = "none";

    try {
      const response = await fetch(`${window.SUPABASE_URL}/functions/v1/fix_shared`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${window.authToken}`
        },
        body: JSON.stringify({ action: "search", email })
      });

      const json = await response.json();

      if (!response.ok || json.error) {
        throw new Error(json.error || "Unknown error");
      }

      if (json.found) {
        const kendevData = await fetchKendevDetails(json.data.team.id);
        // If fetchKendevDetails fails (e.g. CORS), we still render using data from DB
        renderSharedInfo(json.data, kendevData, email);
      } else {
        fixResultsDiv.innerHTML = `<p style="color:#666; padding:10px;">No shared subscription found for this email.</p>`;
        fixResultsDiv.style.display = "block";
      }

    } catch (err) {
      console.error(err);
      fixResultsDiv.innerHTML = `<p style="color:red">Error: ${err.message}</p>`;
      fixResultsDiv.style.display = "block";
    } finally {
      showSpinner(false);
      fixSearchBtn.disabled = false;
    }
  };

  const handleFixSharedMigrate = async () => {
    const email = fixInput.value.trim();
    if (!confirm(`Are you sure you want to migrate ${email} to a fresh shared team?`)) return;

    clearMessage();
    showSpinner(true);
    fixBtn.disabled = true;

    try {
      const response = await fetch(`${window.SUPABASE_URL}/functions/v1/fix_shared`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${window.authToken}`
        },
        body: JSON.stringify({ action: "migrate", email })
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || "Unknown error");
      }

      // Display Results
      if (result.fixed && result.fixed.length > 0) {
        let html = `<p style="color:green;font-weight:bold">Success! Migrated/Fixed:</p><ul>`;
        result.fixed.forEach(item => {
          html += `<li><strong>${item.email}</strong> &rarr; Team: ${item.team} (${item.status})</li>`;
        });
        html += `</ul>`;
        fixResultsDiv.innerHTML = html;
      } else {
        fixResultsDiv.innerHTML = `<p>No actions were taken (maybe user already on a good team?).</p>`;
      }

    } catch (err) {
      console.error(err);
      showMessage(err.message, "error");
    } finally {
      showSpinner(false);
      fixBtn.disabled = false;
    }
  };

  // --- 3. Fix Private Workspace ---

  // --- Render Stylish Search Result ---
  const renderPrivateInfo = (data, kendevData, email) => {
    // If fresh Kendev fetch failed (CORS), fallback to data already in Supabase DB
    const source = kendevData || data.team;
    const isStaleFallback = !kendevData;

    // 2. Format Dates
    const createdAt = source.createdAt ? new Date(source.createdAt).toLocaleString() : 'N/A';
    const tokenStatus = (source.tokenStatus || 'N/A').toLowerCase();
    const syncStatus = (source.syncStatus || 'N/A').toLowerCase();
    const teamId = source.id || 'N/A';

    // Status Badge
    const statusBadge = tokenStatus === 'active'
      ? `<span style="background:#dcfce7; color:#166534; padding:2px 8px; border-radius:6px; font-size:0.75em; font-weight:bold; border:1px solid #bbf7d0;">ACTIVE</span>`
      : `<span style="background:#fee2e2; color:#991b1b; padding:2px 8px; border-radius:6px; font-size:0.75em; font-weight:bold; border:1px solid #fecaca;">${tokenStatus.toUpperCase()}</span>`;

    // 4. Inject HTML
    fixPResults.innerHTML = `
      <div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:20px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); color: #1e293b; font-size: 0.95em;">
        ${isStaleFallback ? `<div style="background:#fff7ed; color:#9a3412; border:1px solid #ffedd5; padding:10px; border-radius:8px; font-size:0.8em; margin-bottom:15px; display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-triangle-exclamation"></i> Kendev API (CORS) Blocked. Showing database fallback.</div>` : ''}
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;">
            <div>
                <div style="margin-bottom:4px;">User: <b style="color:#ef4444;">Private</b></div>
                <div style="font-size:0.85em; color:#64748b;">Email: <b>${email}</b></div>
            </div>
            ${statusBadge}
        </div>

        <div style="border-top: 1px solid #f1f5f9; padding-top:15px; margin-top:5px;">
            <div style="font-size:0.75em; color:#94a3b8; font-weight:700; text-transform:uppercase; margin-bottom:8px;">Workspace Details:</div>
            <div style="display:flex; flex-direction:column; gap:8px;">
                <div style="display:flex; align-items:center;">
                    <span style="width:100px; font-size:0.8em; color:#64748b;">ID:</span>
                    <code style="font-size:0.85em; color: #475569;">${teamId}</code>
                </div>
                <div style="display:flex; align-items:center;">
                    <span style="width:100px; font-size:0.8em; color:#64748b;">Added At:</span>
                    <span style="font-size:0.85em;">${createdAt}</span>
                </div>
                <div style="display:flex; align-items:center;">
                    <span style="width:100px; font-size:0.8em; color:#64748b;">Token Status:</span>
                    <span style="font-size:0.85em; font-weight:700; color:${tokenStatus === 'active' ? '#16a34a' : '#ef4444'}">${tokenStatus.toUpperCase()}</span>
                </div>
                <div style="display:flex; align-items:center;">
                    <span style="width:100px; font-size:0.8em; color:#64748b;">Sync Status:</span>
                    <span style="font-size:0.85em; font-weight:700; color:${syncStatus === 'active' ? '#16a34a' : '#ef4444'}">${syncStatus.toUpperCase()}</span>
                </div>
            </div>
        </div>
      </div>
    `;
    fixPResults.style.display = "block";

    if (fixPReplaceBtn) {
      if (tokenStatus === 'active') {
        fixPReplaceBtn.disabled = true;
        fixPReplaceBtn.style.opacity = "0.6";
        fixPReplaceBtn.style.cursor = "not-allowed";
        fixPReplaceBtn.innerHTML = `<i class="fa-solid fa-circle-info"></i> cannot replace team is active`;
      } else {
        fixPReplaceBtn.disabled = false;
        fixPReplaceBtn.style.opacity = "1";
        fixPReplaceBtn.style.cursor = "pointer";
        fixPReplaceBtn.innerHTML = `<i class="fa-solid fa-fire"></i> Replace & Migrate Team`;
      }
      fixPReplaceBtn.style.display = "inline-block";
    }
  };

  // --- Search Handler ---
  const handleFixSearch = async (e) => {
    e.preventDefault();
    clearMessage();

    const email = fixPEmail.value.trim();
    if (!email) return;

    showSpinner(true);
    fixPSearchBtn.disabled = true;
    fixPResults.innerHTML = "";
    fixPReplaceBtn.style.display = "none";

    try {
      const res = await fetch(`${window.SUPABASE_URL}/functions/v1/fix_private`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${window.authToken}` },
        body: JSON.stringify({ action: "search", email })
      });
      const json = await res.json();

      if (json.found) {
        const kendevData = await fetchKendevDetails(json.data.team.id);
        // If fetchKendevDetails fails (e.g. CORS), we still render using data from DB
        renderPrivateInfo(json.data, kendevData, email);
      } else {
        fixPResults.innerHTML = `<p style="color:#666; padding:10px;">No private subscription found for this email.</p>`;
        fixPResults.style.display = "block";
      }
    } catch (err) {
      showMessage(err.message, "error");
    } finally {
      showSpinner(false);
      fixPSearchBtn.disabled = false;
    }
  };

  // --- Replace Handler ---
  const handleFixReplace = async () => {
    const email = fixPEmail.value.trim();
    if (!confirm(`Are you sure you want to KILL the current team and move ${email}?`)) return;

    clearMessage();
    showSpinner(true);
    fixPReplaceBtn.disabled = true;
    try {
      const res = await fetch(`${window.SUPABASE_URL}/functions/v1/fix_private`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${window.authToken}` },
        body: JSON.stringify({ action: "replace", email })
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        let errorMsg = json.error || "Migration Failed";
        
        // Suggest full extension if expired or near expiry
        if (errorMsg.toLowerCase().includes("expired") || errorMsg.toLowerCase().includes("near expiry")) {
          errorMsg = "⚠️ This user is expired or near expiry.\n'Fixing' their seat wastes a fresh team slot.\n\nACTION: Please use the 'Add Private' button on the main dashboard to perform a full extension.";
        }

        if (json.details) {
          errorMsg += "\nDetails:\n" + json.details.map(d => `- ${d.email}: ${d.message}`).join("\n");
        }
        throw new Error(errorMsg);
      }

      const failures = json.results.filter(r => !r.success);
      if (failures.length > 0) {
        const failMsg = failures.map(f => `${f.email}: ${f.message}`).join("\n");
        showMessage(`Migration Complete, but some invites failed:\n${failMsg}`, "warning");
      } else {
        showMessage("Team Replaced & All Invites Sent Successfully!", "success");
      }
    } catch (err) {
      console.error(err);
      alert(`❌ ERROR: \n${err.message}`);
    } finally {
      showSpinner(false);
      fixPReplaceBtn.disabled = false;
    }
  };

  const init = () => {
    // Shared Fix
    if (fixForm) fixForm.addEventListener("submit", handleFixSharedSearch);
    if (fixBtn) fixBtn.addEventListener("click", handleFixSharedMigrate);

    // Private Fix
    if (fixPForm) fixPForm.addEventListener("submit", handleFixSearch);
    if (fixPReplaceBtn) fixPReplaceBtn.addEventListener("click", handleFixReplace);
  };

  return { init };
})();