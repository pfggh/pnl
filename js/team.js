window.Teams = (() => {
  // Element references
  const spinner = document.getElementById("spinner-teams");
  const messageBox = document.getElementById("message-box-teams");
  const fixForm = document.getElementById("fix-shared-form");
  const fixInput = document.getElementById("fix-email");
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

  let lastRequestTime = 0;

  // --- Helpers ---
  const showSpinner = (show = true) => {
    if (spinner) spinner.style.display = show ? "block" : "none";
  };

  const showMessage = (text, type = "success") => {
    if (!messageBox) return;
    messageBox.textContent = text;
    messageBox.className = "message-box " + type;
    messageBox.style.display = "block";
    setTimeout(() => {
      messageBox.style.display = "none";
    }, 5000);
  };

  // --- 1. Fix/Migrate Shared Teams (Supply pool) ---
  const handleFix = async (e) => {
    e.preventDefault();

    const now = Date.now();
    if (now - lastRequestTime < 10000) {
      return showMessage("Please wait 10 seconds between requests.", "error");
    }
    lastRequestTime = now;

    const email = fixInput.value.trim();
    if (!email) return showMessage("Enter an email", "error");

    showSpinner(true);
    fixBtn.disabled = true;
    fixResultsDiv.innerHTML = "";

    try {
      const response = await fetch(`${window.SUPABASE_URL}/functions/v1/fix_shared`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${window.authToken}`
        },
        body: JSON.stringify({ email })
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
        fixResultsDiv.innerHTML = `<p>No actions were taken (maybe user not found?).</p>`;
      }

    } catch (err) {
      console.error(err);
      fixResultsDiv.innerHTML = `<p style="color:red">Error: ${err.message}</p>`;
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
      ? `<span style="background:#fee2e2; color:#991b1b; padding:2px 8px; border-radius:12px; font-size:0.75em; font-weight:bold;">DEAD</span>`
      : `<span style="background:#dcfce7; color:#166534; padding:2px 8px; border-radius:12px; font-size:0.75em; font-weight:bold;">ACTIVE</span>`;

    // 2. Format Dates & Duration
    const joinedDate = new Date(data.joined).toLocaleString(); // Time invite was sent (TS)
    const expiryDate = new Date(data.expiry).toLocaleDateString();

    // 3. Calculate Days Left for visual urgency
    const daysLeft = Math.ceil((new Date(data.expiry) - new Date()) / (1000 * 60 * 60 * 24));
    const daysColor = daysLeft < 5 ? 'red' : 'green';

    // 4. Inject HTML
    fixPResults.innerHTML = `
      <div style="background:white; border-radius:8px; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); overflow:hidden;">
        
        <div style="background:#f8fafc; padding:12px 15px; border-bottom:1px solid #e5e7eb; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <span style="font-size:0.8em; color:#64748b; font-weight:bold; letter-spacing:0.5px;">CUSTOMER</span>
                <div style="font-weight:bold; color:#0f172a; font-size:1.1em;">${data.customer}</div>
            </div>
            <div style="text-align:right;">
                 <span style="font-size:0.9em; font-weight:bold; color:${daysColor}">${daysLeft} days left</span>
            </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0;">
            
            <div style="padding:15px; border-right:1px solid #f1f5f9;">
                <div style="margin-bottom:10px;">
                    <div style="font-size:0.75em; color:#94a3b8; text-transform:uppercase;">Phone Number</div>
                    <div style="color:#334155; font-family:monospace; font-size:1.1em;">${data.phone}</div>
                </div>
                <div style="margin-bottom:10px;">
                    <div style="font-size:0.75em; color:#94a3b8; text-transform:uppercase;">Invite Sent (TS)</div>
                    <div style="color:#334155; font-size:0.9em;">${joinedDate}</div>
                </div>
                 <div style="margin-bottom:10px;">
                    <div style="font-size:0.75em; color:#94a3b8; text-transform:uppercase;">Duration</div>
                    <div style="color:#334155; font-size:0.9em;">${data.duration} Month(s) (Expires: ${expiryDate})</div>
                </div>
            </div>

            <div style="padding:15px; background:#fdfdfe;">
                <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    <span style="font-size:0.75em; color:#94a3b8; text-transform:uppercase; font-weight:bold;">Workspace Owner</span>
                    ${statusBadge}
                </div>
                
                <div style="margin-bottom:8px;">
                    <div style="font-size:0.7em; color:#64748b;">Email</div>
                    <code style="background:#f1f5f9; padding:2px 4px; border-radius:4px; color:#0f172a; font-size:0.9em;">${data.team.owner_email}</code>
                </div>

                <div style="margin-bottom:8px;">
                    <div style="font-size:0.7em; color:#64748b;">ChatGPT Pass</div>
                    <code style="background:#f1f5f9; padding:2px 4px; border-radius:4px; color:#0f172a; font-size:0.9em;">${data.team.owner_pass}</code>
                </div>

                <div style="margin-bottom:12px;">
                    <div style="font-size:0.7em; color:#64748b;">Email Pass / 2FA</div>
                    <code style="background:#e0f2fe; color:#0369a1; padding:3px 6px; border-radius:4px; font-weight:bold; font-size:0.95em; border:1px solid #bae6fd;">
                        ${data.team.owner_email_pass || "N/A"}
                    </code>
                </div>
                
                <div style="font-size:0.75em; color:#9ca3af; text-align:right;">
                    Seats: <b>${data.team.seats_used}</b>/5 &bull; ID: ...${data.team.id.slice(-6)}
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

    const now = Date.now();
    if (now - lastRequestTime < 10000) {
      return showMessage("Please wait 10 seconds between requests.", "error");
    }
    lastRequestTime = now;

    const email = fixPEmail.value.trim();
    if (!email) return;

    showSpinner(true);
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
    }
  };

  // --- Replace Handler ---
  // --- Robust Replace Handler ---
  const handleFixReplace = async () => {
    const email = fixPEmail.value.trim();
    if (!confirm(`Are you sure you want to KILL the current team and move ${email}?`)) return;

    const now = Date.now();
    if (now - lastRequestTime < 10000) {
      return showMessage("Please wait 10 seconds between requests.", "error");
    }
    lastRequestTime = now;

    showSpinner(true);
    try {
      const res = await fetch(`${window.SUPABASE_URL}/functions/v1/fix_private`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${window.authToken}` },
        body: JSON.stringify({ action: "replace", email })
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        // Handle Transaction Failure (Rollback happened)
        let errorMsg = json.error || "Migration Failed";
        if (json.details) {
          errorMsg += "\nDetails:\n" + json.details.map(d => `- ${d.email}: ${d.message}`).join("\n");
        }
        throw new Error(errorMsg);
      }

      // Success Logic
      const failures = json.results.filter(r => !r.success);
      if (failures.length > 0) {
        // Partial Success (Some moved, some failed invite)
        const failMsg = failures.map(f => `${f.email}: ${f.message}`).join("\n");
        showMessage(`Migration Complete, but some invites failed:\n${failMsg}`, "warning"); // Warning, not Error
      } else {
        // Perfect Success
        showMessage("Team Replaced & All Invites Sent Successfully!", "success");
      }

      // No auto-refresh requested: simply finish
    } catch (err) {
      console.error(err);
      alert(`❌ ERROR: \n${err.message}`);
    } finally {
      showSpinner(false);
    }
  };

  const init = () => {
    // Shared Fix
    if (fixForm) fixForm.addEventListener("submit", handleFix);

    // Private Fix
    if (fixPForm) fixPForm.addEventListener("submit", handleFixSearch);
    if (fixPReplaceBtn) fixPReplaceBtn.addEventListener("click", handleFixReplace);
  };

  return { init };
})();