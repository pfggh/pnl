window.Misc = (() => {
  // Element references
  const spinner = document.getElementById("spinner-misc");
  const messageBox = document.getElementById("message-box-misc");
  const form = document.getElementById("fix-anghami-form");
  const emailInput = document.getElementById("fix-ang-email");
  const submitBtn = document.getElementById("fix-ang-submit-btn");
  const resultsDiv = document.getElementById("fix-ang-results");

  // Batch auto-fix elements
  const autoBtn = document.getElementById("fix-ang-auto-btn");
  const checkBtn = document.getElementById("fix-ang-check-btn");
  const countBadge = document.getElementById("fix-ang-old-count-badge");
  const batchContainer = document.getElementById("fix-ang-batch-container");
  const batchStatus = document.getElementById("fix-ang-batch-status");
  const batchPercent = document.getElementById("fix-ang-batch-percent");
  const batchBar = document.getElementById("fix-ang-batch-bar");
  const batchLog = document.getElementById("fix-ang-batch-log");

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

  // Single Account Fix Handler (case-insensitive)
  const handleFixAnghami = async (e) => {
    e.preventDefault();
    clearMessage();
    resultsDiv.innerHTML = "";
    resultsDiv.style.display = "none";

    const email = emailInput.value.trim();
    if (!email) return showMessage("Please enter an email address", "error");

    if (!confirm(`Are you sure you want to run Fix Anghami for ${email}? This will delete subscriptions under this account (notifying only expired ones) and delete this account from the database.`)) {
      return;
    }

    showSpinner(true);
    submitBtn.disabled = true;

    try {
      const response = await fetch(`${window.SUPABASE_URL}/functions/v1/fixanghami`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${window.authToken}`
        },
        body: JSON.stringify({ email })
      });

      const json = await response.json();

      if (!response.ok || json.error) {
        throw new Error(json.error || "Failed to process request.");
      }

      showMessage(json.message || "Anghami account fixed successfully!", "success");

      if (json.processed_count > 0 && json.details) {
        let html = `
          <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border); border-radius: 12px; padding: 15px; margin-top: 15px;">
            <h3 style="margin-top:0; color:#10b981; font-size:1rem; display:flex; align-items:center; gap:8px;">
              <i class="fa-solid fa-list-check"></i> Processed Subscriptions (${json.processed_count})
            </h3>
            <ul style="margin: 0; padding-left: 20px; color: var(--text); font-size: 0.9rem; line-height: 1.6;">
        `;

        json.details.forEach(item => {
          const actionBadge = item.action === "migrated" 
            ? `<span style="color:#34d399; font-weight:bold;">Migrated</span>` 
            : `<span style="color:#f87171; font-weight:bold;">Deleted</span>`;
          
          const detailsText = item.detailsText || (item.action === "migrated"
            ? `to new account <b>${item.new_email || 'N/A'}</b>`
            : `(Expiry was within 10 days)`);

          const smsText = item.smsResult?.ok 
            ? `<span style="color:#60a5fa; font-size:0.8rem; margin-left:8px;"><i class="fa-solid fa-paper-plane"></i> Sent Notification</span>`
            : item.smsResult?.skipped
              ? `<span style="color:var(--text-muted); font-size:0.8rem; margin-left:8px;"><i class="fa-solid fa-eye-slash"></i> ${item.smsResult.skipped}</span>`
              : `<span style="color:#f87171; font-size:0.8rem; margin-left:8px;"><i class="fa-solid fa-triangle-exclamation"></i> SMS Fail</span>`;

          html += `
            <li style="margin-bottom: 8px;">
              User: <b>${item.username || 'N/A'}</b> (ID: ${item.sub_id}) &rarr; ${actionBadge} ${detailsText} ${smsText}
            </li>
          `;
        });

        html += `
            </ul>
          </div>
        `;
        resultsDiv.innerHTML = html;
        resultsDiv.style.display = "block";
      } else {
        resultsDiv.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem; margin-top:15px;"><i class="fa-solid fa-circle-info"></i> No subscriptions were linked to this account.</p>`;
        resultsDiv.style.display = "block";
      }

    } catch (err) {
      console.error(err);
      showMessage(err.message, "error");
    } finally {
      showSpinner(false);
      submitBtn.disabled = false;
    }
  };

  // Check Expired Accounts Handler
  const handleCheckExpired = async () => {
    if (!checkBtn) return;
    clearMessage();
    const oldBtnHtml = checkBtn.innerHTML;
    checkBtn.disabled = true;
    checkBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking...';

    try {
      const response = await fetch(`${window.SUPABASE_URL}/functions/v1/fixanghami`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${window.authToken}`
        },
        body: JSON.stringify({ action: "get_expired_accounts" })
      });

      const json = await response.json();
      if (!response.ok || json.error) {
        throw new Error(json.error || "Failed to check expired accounts.");
      }

      const count = json.count || (json.accounts ? json.accounts.length : 0);
      if (countBadge) {
        countBadge.textContent = `${count} expired`;
        countBadge.style.display = "inline-block";
      }

      if (count === 0) {
        showMessage("No Anghami accounts found older than 1 year.", "info");
      } else {
        showMessage(`Found ${count} Anghami accounts added more than 1 year ago (datetime_added < NOW() - INTERVAL '1 year').`, "success");
      }
      return json.accounts || [];
    } catch (err) {
      console.error(err);
      showMessage(err.message, "error");
      return null;
    } finally {
      checkBtn.disabled = false;
      checkBtn.innerHTML = oldBtnHtml;
    }
  };

  // Auto-Run Fix Anghami for All Accounts Older Than 1 Year
  const handleAutoRun = async () => {
    clearMessage();
    resultsDiv.innerHTML = "";
    resultsDiv.style.display = "none";

    showSpinner(true);
    if (autoBtn) autoBtn.disabled = true;
    if (checkBtn) checkBtn.disabled = true;
    if (submitBtn) submitBtn.disabled = true;

    try {
      // 1) Fetch the list of accounts older than 1 year
      const response = await fetch(`${window.SUPABASE_URL}/functions/v1/fixanghami`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${window.authToken}`
        },
        body: JSON.stringify({ action: "get_expired_accounts" })
      });

      const json = await response.json();
      if (!response.ok || json.error) {
        throw new Error(json.error || "Failed to fetch expired accounts.");
      }

      const accounts = json.accounts || [];
      if (accounts.length === 0) {
        if (countBadge) {
          countBadge.textContent = "0 expired";
          countBadge.style.display = "inline-block";
        }
        showMessage("No Anghami accounts found added more than 1 year ago.", "info");
        return;
      }

      if (countBadge) {
        countBadge.textContent = `${accounts.length} expired`;
        countBadge.style.display = "inline-block";
      }

      showSpinner(false);

      // 2) Prompt confirmation from admin
      const confirmed = confirm(
        `Found ${accounts.length} Anghami account(s) added more than 1 year ago (datetime_added < NOW() - INTERVAL '1 year').\n\n` +
        `Are you sure you want to automatically run Fix Anghami for all ${accounts.length} accounts?\n\n` +
        `This will process each account, delete subscriptions (sending renewal notifications to expired ones), and delete the accounts from the database.`
      );

      if (!confirmed) {
        return;
      }

      // 3) Setup UI for batch progress
      if (batchContainer) batchContainer.style.display = "block";
      if (batchBar) batchBar.style.width = "0%";
      if (batchPercent) batchPercent.textContent = "0%";
      if (batchLog) batchLog.innerHTML = `<div style="color: #60a5fa; margin-bottom: 6px;"><i class="fa-solid fa-play"></i> Starting batch Fix Anghami for ${accounts.length} accounts...</div>`;
      if (batchStatus) batchStatus.textContent = `Starting (0 / ${accounts.length})...`;

      let successCount = 0;
      let errorCount = 0;
      let totalSubsCount = 0;

      // 4) Sequentially process each account
      for (let i = 0; i < accounts.length; i++) {
        const acc = accounts[i];
        const currentNum = i + 1;
        const pct = Math.round((currentNum / accounts.length) * 100);

        if (batchStatus) {
          batchStatus.textContent = `Processing ${currentNum} of ${accounts.length}: ${acc.email}`;
        }
        if (batchBar) batchBar.style.width = `${pct}%`;
        if (batchPercent) batchPercent.textContent = `${pct}%`;

        try {
          const fixRes = await fetch(`${window.SUPABASE_URL}/functions/v1/fixanghami`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${window.authToken}`
            },
            body: JSON.stringify({ email: acc.email })
          });

          const fixJson = await fixRes.json();
          if (!fixRes.ok || fixJson.error) {
            throw new Error(fixJson.error || "Server returned an error");
          }

          successCount++;
          const subsProcessed = fixJson.processed_count || 0;
          totalSubsCount += subsProcessed;

          if (batchLog) {
            const entry = document.createElement("div");
            entry.style.color = "#34d399";
            entry.innerHTML = `[${currentNum}/${accounts.length}] <i class="fa-solid fa-check"></i> <b>${acc.email}</b> — Done (${subsProcessed} subs)`;
            batchLog.appendChild(entry);
            batchLog.scrollTop = batchLog.scrollHeight;
          }
        } catch (itemErr) {
          errorCount++;
          console.error(`Error fixing ${acc.email}:`, itemErr);
          if (batchLog) {
            const entry = document.createElement("div");
            entry.style.color = "#f87171";
            entry.innerHTML = `[${currentNum}/${accounts.length}] <i class="fa-solid fa-xmark"></i> <b>${acc.email}</b> — Error: ${itemErr.message}`;
            batchLog.appendChild(entry);
            batchLog.scrollTop = batchLog.scrollHeight;
          }
        }
      }

      // 5) Finalize
      if (batchStatus) {
        batchStatus.textContent = `Finished: ${successCount} successful, ${errorCount} failed.`;
      }
      if (batchBar) batchBar.style.width = "100%";
      if (batchPercent) batchPercent.textContent = "100%";

      if (batchLog) {
        const summary = document.createElement("div");
        summary.style.marginTop = "8px";
        summary.style.paddingTop = "6px";
        summary.style.borderTop = "1px solid rgba(255,255,255,0.1)";
        summary.style.fontWeight = "bold";
        summary.style.color = errorCount === 0 ? "#10b981" : "#f59e0b";
        summary.innerHTML = `<i class="fa-solid fa-flag-checkered"></i> Batch Complete! ${successCount}/${accounts.length} accounts fixed (${totalSubsCount} subscriptions processed). ${errorCount > 0 ? `(${errorCount} errors)` : ""}`;
        batchLog.appendChild(summary);
        batchLog.scrollTop = batchLog.scrollHeight;
      }

      showMessage(
        `Batch Fix Anghami completed: ${successCount} accounts cleaned up successfully (${totalSubsCount} subscriptions processed)!`,
        errorCount === 0 ? "success" : "info"
      );

      if (countBadge) {
        countBadge.textContent = `${errorCount} remaining`;
        if (errorCount === 0) countBadge.style.display = "none";
      }

    } catch (err) {
      console.error(err);
      showMessage(err.message, "error");
    } finally {
      showSpinner(false);
      if (autoBtn) autoBtn.disabled = false;
      if (checkBtn) checkBtn.disabled = false;
      if (submitBtn) submitBtn.disabled = false;
    }
  };

  const init = () => {
    if (form) {
      form.removeEventListener("submit", handleFixAnghami);
      form.addEventListener("submit", handleFixAnghami);
    }
    if (autoBtn) {
      autoBtn.removeEventListener("click", handleAutoRun);
      autoBtn.addEventListener("click", handleAutoRun);
    }
    if (checkBtn) {
      checkBtn.removeEventListener("click", handleCheckExpired);
      checkBtn.addEventListener("click", handleCheckExpired);
    }
  };

  return { init, handleCheckExpired, handleAutoRun, handleFixAnghami };
})();
