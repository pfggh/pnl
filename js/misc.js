window.Misc = (() => {
  // Element references
  const spinner = document.getElementById("spinner-misc");
  const messageBox = document.getElementById("message-box-misc");
  const form = document.getElementById("fix-anghami-form");
  const emailInput = document.getElementById("fix-ang-email");
  const submitBtn = document.getElementById("fix-ang-submit-btn");
  const resultsDiv = document.getElementById("fix-ang-results");

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

  const handleFixAnghami = async (e) => {
    e.preventDefault();
    clearMessage();
    resultsDiv.innerHTML = "";
    resultsDiv.style.display = "none";

    const email = emailInput.value.trim();
    if (!email) return showMessage("Please enter an email address", "error");

    if (!confirm(`Are you sure you want to run Fix Anghami for ${email}? This will delete short-term subscriptions, migrate long-term subscriptions, and delete this account from the database.`)) {
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
          
          const detailsText = item.action === "migrated"
            ? `to new account <b>${item.new_email || 'N/A'}</b>`
            : `(Expiry was within 10 days)`;

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

  const init = () => {
    if (form) {
      // Remove any existing listeners first to prevent duplicates
      form.removeEventListener("submit", handleFixAnghami);
      form.addEventListener("submit", handleFixAnghami);
    }
  };

  return { init };
})();
