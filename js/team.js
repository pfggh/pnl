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

  // --- 1. Fix/Migrate Shared Teams (Supply pool) ---

  const renderSharedInfo = (data) => {
    // 1. Determine Status Badge
    const isDead = data.team.status === 'dead';
    const statusBadge = isDead
      ? `<span style="background:#fee2e2; color:#991b1b; padding:2px 8px; border-radius:6px; font-size:0.7em; font-weight:bold; border:1px solid #fecaca;">DEAD</span>`
      : `<span style="background:#dcfce7; color:#166534; padding:2px 8px; border-radius:6px; font-size:0.7em; font-weight:bold; border:1px solid #bbf7d0;">ACTIVE</span>`;

    // 2. Format Dates
    const joinedDate = new Date(data.joined).toLocaleString();

    // 4. Inject HTML
    fixResultsDiv.innerHTML = `
      <div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:20px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); color: #1e293b; font-size: 0.95em;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;">
            <div>
                <div style="margin-bottom:4px;">User: <b style="color:#4f46e5;">Shared</b></div>
                <div style="font-size:0.85em; color:#64748b;">Last invited: <b>${joinedDate}</b></div>
            </div>
            ${statusBadge}
        </div>

        <div style="border-top: 1px solid #f1f5f9; padding-top:15px; margin-top:5px;">
            <div style="font-size:0.75em; color:#94a3b8; font-weight:700; text-transform:uppercase; margin-bottom:8px;">Parent Account:</div>
            
            <div style="display:flex; flex-direction:column; gap:8px;">
                <div style="display:flex; align-items:center;">
                    <span style="width:70px; font-size:0.8em; color:#64748b;">Email:</span>
                    <code style="background:#f8fafc; padding:2px 6px; border-radius:4px; font-weight:600; font-size:0.9em; flex:1; border:1px solid #e2e8f0;">${data.team.owner_email}</code>
                </div>
                <div style="display:flex; align-items:center;">
                    <span style="width:70px; font-size:0.8em; color:#64748b;">Pass:</span>
                    <code style="background:#f8fafc; padding:2px 6px; border-radius:4px; font-weight:600; font-size:0.9em; flex:1; border:1px solid #e2e8f0;">${data.team.owner_pass}</code>
                </div>
                <div style="display:flex; align-items:center;">
                    <span style="width:70px; font-size:0.8em; color:#64748b;">Pass email:</span>
                    <code style="background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:4px; font-weight:700; font-size:0.9em; flex:1; border:1px solid #bae6fd;">${data.team.owner_email_pass || "N/A"}</code>
                </div>
            </div>
        </div>
      </div>
    `;
    fixResultsDiv.style.display = "block";
    if (fixBtn) fixBtn.style.display = "inline-block";
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
        renderSharedInfo(json.data);
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
  const renderPrivateInfo = (data) => {
    // 1. Determine Status Badge
    const isDead = data.team.status === 'dead';
    const statusBadge = isDead
      ? `<span style="background:#fee2e2; color:#991b1b; padding:2px 8px; border-radius:6px; font-size:0.7em; font-weight:bold; border:1px solid #fecaca;">DEAD</span>`
      : `<span style="background:#dcfce7; color:#166534; padding:2px 8px; border-radius:6px; font-size:0.7em; font-weight:bold; border:1px solid #bbf7d0;">ACTIVE</span>`;

    // 2. Format Dates
    const joinedDate = new Date(data.joined).toLocaleString();

    // 4. Inject HTML
    fixPResults.innerHTML = `
      <div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:20px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); color: #1e293b; font-size: 0.95em;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;">
            <div>
                <div style="margin-bottom:4px;">User: <b style="color:#ef4444;">Private</b></div>
                <div style="font-size:0.85em; color:#64748b;">Last invited: <b>${joinedDate}</b></div>
            </div>
            ${statusBadge}
        </div>

        <div style="border-top: 1px solid #f1f5f9; padding-top:15px; margin-top:5px;">
            <div style="font-size:0.75em; color:#94a3b8; font-weight:700; text-transform:uppercase; margin-bottom:8px;">Parent Account (Owner):</div>
            
            <div style="display:flex; flex-direction:column; gap:8px;">
                <div style="display:flex; align-items:center;">
                    <span style="width:70px; font-size:0.8em; color:#64748b;">Email:</span>
                    <code style="background:#f8fafc; padding:2px 6px; border-radius:4px; font-weight:600; font-size:0.9em; flex:1; border:1px solid #e2e8f0;">${data.team.owner_email}</code>
                </div>
                <div style="display:flex; align-items:center;">
                    <span style="width:70px; font-size:0.8em; color:#64748b;">Pass:</span>
                    <code style="background:#f8fafc; padding:2px 6px; border-radius:4px; font-weight:600; font-size:0.9em; flex:1; border:1px solid #e2e8f0;">${data.team.owner_pass}</code>
                </div>
                <div style="display:flex; align-items:center;">
                    <span style="width:70px; font-size:0.8em; color:#64748b;">Pass email:</span>
                    <code style="background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:4px; font-weight:700; font-size:0.9em; flex:1; border:1px solid #bae6fd;">${data.team.owner_email_pass || "N/A"}</code>
                </div>
            </div>
        </div>
      </div>
    `;
    fixPResults.style.display = "block";

    // Ensure the Replace button is visible if a result is found
    if (fixPReplaceBtn) fixPReplaceBtn.style.display = "inline-block";
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
        renderPrivateInfo(json.data);
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