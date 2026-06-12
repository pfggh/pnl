window.Subscriptions = (() => {
  // Element references
  const spinner = document.getElementById("spinner");
  const serviceSelector = document.getElementById("service");
  const usernameInput = document.getElementById("username");
  // Canva: required customer email field
  const subEmailInput = document.getElementById("sub-email");

  const messageBox = document.getElementById("message-box");
  const adminForm = document.getElementById("admin-form");
  const submitBtn = document.getElementById("submit-btn");
  const viewSelector = document.getElementById("view-selector");
  const subscriptionTable = document
    .getElementById("subscription-table")
    .querySelector("tbody");

  const subscriptionTableHead = document
    .getElementById("subscription-table")
    .querySelector("thead");
  const subscriptionTableTitle = document.getElementById(
    "subscription-table-title"
  );
  const triggerRenewalsBtn = document.getElementById("trigger-renewals-btn");
  const triggerMsgBtn = document.getElementById("trigger-msg");
  const cancelModal = document.getElementById("cancel-modal");
  const modalContent = document.getElementById("modal-content");
  // --- Additions for replacement flow ---
  const replaceEmailInput = document.getElementById("replace-email");
  const replaceBtn = document.getElementById("replace-btn");
  // ---------------------------------------

  const subTableSearch = document.getElementById("sub-table-search");

  const formatCompactDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hr = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${hr}:${min}`;
  };

  const filterSubscriptionsTable = () => {
    if (!subTableSearch) return;
    const query = subTableSearch.value.toLowerCase().trim();
    const rows = subscriptionTable.querySelectorAll("tr");
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

  if (subTableSearch) {
    subTableSearch.addEventListener("input", filterSubscriptionsTable);
  }

  const subEmailLabel = subEmailInput?.closest("label") || subEmailInput;

  function toggleSubEmailVisibility() {
    const svc = serviceSelector.value.toLowerCase();
    if (svc === "canva") {
      // show the email field
      subEmailLabel.style.display = "";
      subEmailInput.required = true;
    } else if (svc === "gpt private") {
      // Show email field for GPT Private as well
      subEmailLabel.style.display = "";
      subEmailInput.required = true;
      subEmailInput.placeholder = "Customer Email";
    } else {
      // hide the email field and clear its value
      subEmailLabel.style.display = "none";
      subEmailInput.required = false;
      if (svc !== "canva") subEmailInput.placeholder = "email(canva)"; // Reset placeholder when hidden/not used
      subEmailInput.value = "";
    }
  }

  // run once on page load (to hide unless already Canva)
  toggleSubEmailVisibility();

  // run every time the service dropdown changes
  serviceSelector.addEventListener("change", toggleSubEmailVisibility);

  // --- Modal helpers: Inserted as per instruction ---
  function openModalNode(html) {
    modalContent.innerHTML = "";
    modalContent.innerHTML = html;
    if (typeof injectCloseButton === "function") injectCloseButton();
    cancelModal.style.display = "flex";
    cancelModal.onclick = (e) => {
      if (e.target === cancelModal) cancelModal.style.display = "none";
    };
  }

  function openConfirmHoldModal({ title, body, seconds = 3, onConfirm }) {
    openModalNode(`
      <h3 style="margin:0 0 8px">${title}</h3>
      <p style="margin:0 0 12px">${body || ""}</p>
      <div class="hold-wrap">
        <div class="hold-track"><div class="hold-fill" id="hold-fill"></div></div>
        <div class="hold-actions">
          <button class="hold-cta" id="hold-btn" type="button">Hold to Confirm</button>
          <button type="button" id="hold-cancel">Cancel</button>
        </div>
        <div class="hold-hint" id="hold-hint">Hold ${seconds}s to confirm</div>
      </div>
    `);

    const btn = document.getElementById("hold-btn");
    const fill = document.getElementById("hold-fill");
    const hint = document.getElementById("hold-hint");
    const cancel = document.getElementById("hold-cancel");

    const stepMs = 80;
    const total = seconds * 1000;
    let t = null,
      elapsed = 0;

    const start = () => {
      if (t) return;
      t = setInterval(() => {
        elapsed += stepMs;
        const pct = Math.min(100, Math.round((elapsed / total) * 100));
        fill.style.width = pct + "%";
        hint.textContent = `Holding… ${pct}%`;
        if (elapsed >= total) {
          clearInterval(t);
          t = null;
          cancelModal.style.display = "none";
          onConfirm && onConfirm();
        }
      }, stepMs);
    };
    const stop = () => {
      if (t) {
        clearInterval(t);
        t = null;
      }
      elapsed = 0;
      fill.style.width = "0%";
      hint.textContent = `Hold ${seconds}s to confirm`;
    };

    btn.addEventListener("mousedown", start);
    btn.addEventListener("mouseup", stop);
    btn.addEventListener("mouseleave", stop);
    btn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      start();
    }, { passive: false });
    btn.addEventListener("touchend", stop);
    btn.addEventListener("keydown", (e) => {
      if (e.code === "Space" || e.code === "Enter") start();
    });
    btn.addEventListener("keyup", (e) => {
      if (e.code === "Space" || e.code === "Enter") stop();
    });

    cancel.onclick = () => {
      cancelModal.style.display = "none";
    };
  }

  // GPT cancel endpoint
  const FN_CANCEL_GPT = `${window.SUPABASE_URL}/functions/v1/cancelgpt`;

  // GPT cancel modal state
  let currentGptPayId = null;

  // --- End modal helpers ---

  // ——— GPT Cancel Modal Helpers ———
  function openGptCancelModal(payId) {
    currentGptPayId = payId;
    modalContent.innerHTML = "";
    loadGptCancelDetails();
    cancelModal.style.display = "flex";
  }

  async function loadGptCancelDetails() {
    try {
      showSpinner(true);
      modalContent.innerHTML = `<p>Loading...</p>`;

      const { data: { session } } = await window.supabaseClient.auth.getSession();
      const jwt = session?.access_token;

      const res = await fetch(FN_CANCEL_GPT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${jwt}` },
        body: JSON.stringify({ action: "getdetails", pay_id: currentGptPayId })
      });
      const detail = await res.json();
      if (!res.ok || detail.error) throw new Error(detail.error || "Failed to load details.");

      // Build modal UI
      modalContent.innerHTML = `
        <div style="padding-top:40px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;">
            <span style="font-size:0.9rem"><strong>Email:</strong> ${detail.email}</span>
            <button class="copy-btn" data-value="${detail.email}"><i class="fa-regular fa-copy"></i> Copy</button>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px;">
            <span style="font-size:0.9rem"><strong>Password:</strong> ${detail.password}</span>
            <button class="copy-btn" data-value="${detail.password}"><i class="fa-regular fa-copy"></i> Copy</button>
          </div>

          <div style="display:flex;gap:12px;justify-content:center;margin-top:24px">
            <button id="gpt-cancel-confirm" class="pill-btn" style="background:var(--primary)"><i class="fa-solid fa-trash-can" style="color:#fff"></i> Cancel Subscription</button>
            <button id="close-modal-btn" class="pill-btn">Close</button>
          </div>
        </div>
      `;
      injectCloseButton();

      // Bind modal actions with a single handler (avoid multiplying listeners)
      modalContent.onclick = async (e) => {
        const t = e.target;
        if (t.id === "close-modal-btn") {
          cancelModal.style.display = "none";
        } else if (t.classList.contains("copy-btn")) {
          const v = t.dataset.value || "";
          try {
            await navigator.clipboard.writeText(v);
            showMessage("Copied to clipboard.", "success");
          } catch {
            showMessage("Copy failed.", "error");
          }
        } else if (t.id === "gpt-cancel-confirm") {
          await confirmGptCancel(currentGptPayId);
        }
      };
    } catch (err) {
      console.error(err);
      modalContent.innerHTML = `
        <p style="color:#b91c1c;text-align:center;">${err.message || "Failed to load."}</p>
        <div style="display:flex;justify-content:center;margin-top:16px">
          <button id="close-modal-btn" class="btn-primary">Close</button>
        </div>
      `;
      modalContent.onclick = (e) => e.target.id === "close-modal-btn" && (cancelModal.style.display = "none");
    } finally {
      showSpinner(false);
    }
  }

  async function confirmGptCancel(pay_id) {
    try {
      showSpinner(true);
      const { data: { session } } = await window.supabaseClient.auth.getSession();
      const jwt = session?.access_token;

      const res = await fetch(FN_CANCEL_GPT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${jwt}` },
        body: JSON.stringify({ action: "cancel", pay_id })
      });
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error || "Failed to cancel.");

      modalContent.innerHTML = `
        <p style="color:#16a34a;font-weight:bold;text-align:center;">
          Done! Deleted ${j.deletedSubs} subscription(s) for <strong>${j.accemail}</strong>.<br/>
          WhatsApp: sent ${j.messages.sent}, skipped ${j.messages.skipped}${j.messages.failed ? `, failed ${j.messages.failed}` : ""}.
        </p>
        <div style="display:flex;justify-content:center;margin-top:16px">
          <button id="close-modal-btn" class="btn-primary">Close</button>
        </div>
      `;

      // Remove the row from the table instantly
      const rowToRemove = subscriptionTable.querySelector(`[data-id="${pay_id}"]`);
      if (rowToRemove) rowToRemove.closest("tr")?.remove();

      // Refresh KPIs in background
      fetchDashboardKpis();

      // Allow closing
      modalContent.onclick = (e) => e.target.id === "close-modal-btn" && (cancelModal.style.display = "none");
    } catch (err) {
      console.error(err);
      showMessage(`Error: ${err.message}`, "error");
    } finally {
      showSpinner(false);
    }
  }

  // --- Anghami Cancel Modal Helpers ---
  const FN_CANCEL_ANGHAMI = `${window.SUPABASE_URL}/functions/v1/cancelanghami`;
  let currentAnghamiPayId = null;
  function openAnghamiCancelModal(payId) {
    currentAnghamiPayId = payId;
    loadAnghamiCancelDetails();
    cancelModal.style.display = "flex";
  }
  async function loadAnghamiCancelDetails() {
    try {
      showSpinner(true);
      modalContent.innerHTML = `<p>Loading...</p>`;
      const { data: { session } } = await window.supabaseClient.auth.getSession();
      const jwt = session?.access_token;
      const res = await fetch(FN_CANCEL_ANGHAMI, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${jwt}` },
        body: JSON.stringify({ action: "getdetails", pay_id: currentAnghamiPayId })
      });
      const detail = await res.json();
      if (!res.ok || detail.error) throw new Error(detail.error || "Failed to load details.");
      modalContent.innerHTML = `
        <div style="padding-top:40px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;">
            <span style="font-size:0.9rem"><strong>Email:</strong> ${detail.email}</span>
            <button class="copy-btn" data-value="${detail.email}"><i class="fa-regular fa-copy"></i> Copy</button>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;">
            <span style="font-size:0.9rem"><strong>Password:</strong> ${detail.password}</span>
            <button class="copy-btn" data-value="${detail.password}"><i class="fa-regular fa-copy"></i> Copy</button>
          </div>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
            <span style="font-size:0.9rem"><strong>Username:</strong></span>
            <span style="background:rgba(255,255,255,0.05);padding:8px 12px;border-radius:10px;font-family:monospace;word-break:break-all;font-size:1.2rem;color:var(--primary);border:1px solid var(--border);">${detail.username}</span>
          </div>
          <p class="warning-text" style="font-size:0.85rem;margin-bottom:15px;color:var(--text-muted)">Remove user, and add the new blank invite below.</p>
          <input id="anghami-new-invite" placeholder="Paste new invite link here..." style="width:100%;margin-bottom:20px;" />
          <div style="display:flex;justify-content:center;gap:12px;">
            <button id="anghami-confirm" class="pill-btn" style="background:var(--primary)"><i class="fa-solid fa-check" style="color:#fff"></i> Update & Delete</button>
          </div>
        </div>
      `;
      injectCloseButton();
      document.getElementById("anghami-confirm").onclick = async () => {
        const newInvite = document.getElementById("anghami-new-invite").value.trim();
        if (!newInvite) return alert("Please enter the new invite link.");
        if (!confirm("Confirm update invite & delete subscription?")) return;
        await confirmAnghamiUpdateDelete(currentAnghamiPayId, newInvite);
      };
    } catch (e) {
      console.error(e);
      showMessage(`Error: ${e.message}`, "error");
      cancelModal.style.display = "none";
    } finally {
      showSpinner(false);
    }
  }
  async function confirmAnghamiUpdateDelete(pay_id, new_invite) {
    try {
      showSpinner(true);
      const { data: { session } } = await window.supabaseClient.auth.getSession();
      const jwt = session?.access_token;
      const res = await fetch(FN_CANCEL_ANGHAMI, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${jwt}` },
        body: JSON.stringify({ action: "update_invite_and_delete", pay_id, new_invite })
      });
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error || "Failed to update/delete.");
      modalContent.innerHTML = `
        <p style="color:#16a34a;font-weight:bold;text-align:center;">
          Invite updated & subscription deleted.
        </p>
        <div style="display:flex;justify-content:center;margin-top:12px">
          <button id="anghami-close" class="btn-primary">Close</button>
        </div>`;
      injectCloseButton();
      document.getElementById("anghami-close").onclick = () => {
        cancelModal.style.display = "none";
        // Remove the row from the table instantly
        const rowToRemove = subscriptionTable.querySelector(`[data-id="${pay_id}"]`);
        if (rowToRemove) rowToRemove.closest("tr")?.remove();
        fetchDashboardKpis();
      };
    } catch (e) {
      console.error(e);
      showMessage(`Error: ${e.message}`, "error");
      cancelModal.style.display = "none";
    } finally {
      showSpinner(false);
    }
  }
  // --- End Anghami Cancel Modal Helpers ---

  // --- Expired Private Subs Helpers ---
  const formatDateForInput = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const pad = (num) => String(num).padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const openUpdatePrivateModal = (row) => {
    const formattedDate = formatDateForInput(row.ts);
    modalContent.innerHTML = `
      <div style="padding-top: 20px;">
        <h3 style="margin-bottom: 20px; color: #fff; font-weight: 800; display: flex; align-items: center; gap: 10px;">
          <i class="fa-solid fa-pen-to-square" style="color: var(--primary)"></i> Update Private Subscription
        </h3>
        <form id="update-private-form" style="display: flex; flex-direction: column; gap: 16px;">
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <label style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-weight: 700;">Customer Email</label>
            <input type="text" id="update-p-email" value="${row.customer_email ?? ''}" disabled style="background: rgba(15, 23, 42, 0.4); opacity: 0.7; cursor: not-allowed;" />
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <label style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-weight: 700;">Phone</label>
            <input type="text" value="${row.phone ?? ''}" disabled style="background: rgba(15, 23, 42, 0.4); opacity: 0.7; cursor: not-allowed;" />
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <label style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-weight: 700;">Team ID</label>
            <input type="text" value="${row.team_id ?? ''}" disabled style="background: rgba(15, 23, 42, 0.4); opacity: 0.7; cursor: not-allowed;" />
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <label style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-weight: 700;">Start Date</label>
            <input type="datetime-local" id="update-p-date" value="${formattedDate}" required style="border-color: rgba(99, 102, 241, 0.4);" />
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <label style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-weight: 700;">Duration (Months)</label>
            <select id="update-p-duration" required style="border-color: rgba(99, 102, 241, 0.4);">
              <option value="1" ${row.duration === 1 ? 'selected' : ''}>1 Month</option>
              <option value="3" ${row.duration === 3 ? 'selected' : ''}>3 Months</option>
              <option value="6" ${row.duration === 6 ? 'selected' : ''}>6 Months</option>
              <option value="12" ${row.duration === 12 ? 'selected' : ''}>12 Months</option>
            </select>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 15px;">
            <button type="button" id="update-p-cancel" class="pill-btn" style="padding: 10px 20px;">Cancel</button>
            <button type="submit" id="update-p-submit" class="pill-btn" style="background: var(--primary); padding: 10px 20px; border-color: var(--primary); color: #fff;">
              <i class="fa-solid fa-save" style="color:#fff"></i> Save Changes
            </button>
          </div>
        </form>
      </div>
    `;
    injectCloseButton();
    cancelModal.style.display = "flex";

    document.getElementById("update-p-cancel").onclick = () => {
      cancelModal.style.display = "none";
    };

    document.getElementById("update-private-form").onsubmit = async (e) => {
      e.preventDefault();
      const email = document.getElementById("update-p-email").value;
      const duration = parseInt(document.getElementById("update-p-duration").value, 10);
      const dateVal = document.getElementById("update-p-date").value;
      if (!dateVal) return alert("Please select a valid start date.");
      const date = new Date(dateVal).toISOString();

      try {
        showSpinner(true);
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error("Not authenticated.");

        const res = await fetch(`${window.SUPABASE_URL}/functions/v1/cancel_private`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            action: "update",
            customer_email: email,
            duration,
            date
          })
        });

        const result = await res.json();
        if (!res.ok || !result.success) throw new Error(result.error || result.message || "Failed to update subscription.");

        showMessage("Subscription updated successfully.", "success");
        cancelModal.style.display = "none";
        
        // Update the row locally in the table
        const deleteBtn = subscriptionTable.querySelector(`button.delete-private-btn[data-email="${email}"]`);
        if (deleteBtn) {
          const tr = deleteBtn.closest("tr");
          if (tr) {
            const startDate = new Date(date);
            const expiryDate = new Date(startDate);
            expiryDate.setMonth(startDate.getMonth() + duration);
            
            const cells = tr.cells;
            if (cells && cells.length >= 7) {
              cells[4].textContent = formatCompactDate(startDate);
              cells[5].textContent = formatCompactDate(expiryDate);
              cells[6].textContent = "yes";
              cells[6].setAttribute("style", "color:#10b981; font-weight:bold;");
            }

            const updateBtnInRow = tr.querySelector(".update-private-btn");
            if (updateBtnInRow) {
              const index = Number(updateBtnInRow.dataset.index);
              if (window.expiredPrivateSubsData && window.expiredPrivateSubsData[index]) {
                window.expiredPrivateSubsData[index].ts = date;
                window.expiredPrivateSubsData[index].expiry = expiryDate.toISOString();
                window.expiredPrivateSubsData[index].duration = duration;
                window.expiredPrivateSubsData[index].confirmed_date = "yes";
              }
            }
          }
        }
        
        fetchDashboardKpis();
      } catch (err) {
        console.error(err);
        alert("Error updating subscription: " + err.message);
      } finally {
        showSpinner(false);
      }
    };
  };

  const deletePrivateSub = (email, id) => {
    if (!email) {
      alert("Missing customer email for this subscription.");
      return;
    }
    buildConfirmModal(
      "Confirm Deletion",
      `Are you sure you want to delete the private subscription for <strong>${email}</strong>? This will notify them via WhatsApp and delete all their records from the database.`,
      async () => {
        try {
          showSpinner(true);
          const { data: { session } } = await window.supabaseClient.auth.getSession();
          const token = session?.access_token;
          if (!token) throw new Error("Not authenticated.");

          const res = await fetch(`${window.SUPABASE_URL}/functions/v1/cancel_private`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              action: "remove",
              customer_email: email
            })
          });

          const result = await res.json();
          if (!res.ok || !result.success) throw new Error(result.error || result.message || "Failed to remove subscription.");

          const sentStatus = result.notification?.sent ? "Notified via WhatsApp" : "WhatsApp failed";
          showMessage(`Subscription deleted successfully. ${sentStatus} (${result.notification?.phone ?? ''}).`, "success");
          
          // Remove row locally
          const rowToRemove = subscriptionTable.querySelector(`button.delete-private-btn[data-id="${id}"]`);
          if (rowToRemove) {
            rowToRemove.closest("tr")?.remove();
          } else {
            const altRow = subscriptionTable.querySelector(`button.delete-private-btn[data-email="${email}"]`);
            altRow?.closest("tr")?.remove();
          }
          fetchDashboardKpis();
        } catch (err) {
          console.error(err);
          showMessage("Error removing subscription: " + err.message, "error");
        } finally {
          showSpinner(false);
        }
      }
    );
  };
  // --- End Anghami Cancel Modal Helpers ---

  function openModalWith(nodeHtmlOrNode) {
    modalContent.innerHTML = "";
    if (typeof nodeHtmlOrNode === "string") {
      modalContent.innerHTML = nodeHtmlOrNode;
    } else {
      modalContent.appendChild(nodeHtmlOrNode);
    }
    cancelModal.style.display = "flex";
    cancelModal.onclick = (e) => {
      if (e.target === cancelModal) cancelModal.style.display = "none";
    };
  }

  function buildConfirmModal(title, body, onConfirm) {
    const html = `
      <h3 style="margin:0 0 8px 0">${title}</h3>
      <p style="margin:0 0 12px 0">${body}</p>
      <div style="display:flex;justify-content:flex-end;gap:10px">
        <button id="cfm-cancel">Cancel</button>
        <button id="cfm-ok" class="btn-primary">Confirm</button>
      </div>`;
    openModalWith(html);
    const cancelBtn = document.getElementById("cfm-cancel");
    const okBtn = document.getElementById("cfm-ok");
    cancelBtn.onclick = () => { cancelModal.style.display = "none"; };
    okBtn.onclick = async () => { cancelModal.style.display = "none"; await onConfirm(); };
  }

  const kpiEls = {
    anghami: document.getElementById("kpi-anghami"),
    chatgpt: document.getElementById("kpi-chatgpt"),
    private_seats: document.getElementById("kpi-private-seats"),
    unpaid: document.getElementById("kpi-unpaid"),
    orders: document.getElementById("kpi-orders"),
  };
  async function fetchDashboardKpis() {
    try {
      const { data: { session } } = await window.supabaseClient.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const res = await fetch(`${window.SUPABASE_URL}/functions/v1/dashboard`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error || "dashboard error");

      kpiEls.anghami.textContent = j.anghami_spots ?? 0;
      kpiEls.chatgpt.textContent = j.chatgpt_spots ?? 0;
      kpiEls.private_seats.textContent = j.private_seats ?? 0;
      kpiEls.unpaid.textContent = j.unpaid ?? 0;
      kpiEls.orders.textContent = j.orders_24h ?? 0;
    } catch (e) {
      console.error("KPI error:", e);
    }
  }

  let currentPayId = null;

  document.addEventListener("DOMContentLoaded", async () => {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) {
      window.location.href = "/index.html";
    }
    window.authToken = session.access_token;
    fetchDashboardKpis();
  });

  document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("reactivate-phone");
    const searchBtn = document.getElementById("reactivate-search-btn");
    const subSelect = document.getElementById("reactivate-sub-select");
    const reactBtn = document.getElementById("reactivate-btn");
    const reactMsg = document.getElementById("reactivate-msg");

    let lastSubList = [];
    if (searchBtn && searchInput && subSelect && reactBtn && reactMsg) {
      searchBtn.onclick = async () => {
        subSelect.style.display = "none";
        reactBtn.style.display = "none";
        reactMsg.innerHTML = "";
        const phone = searchInput.value.trim().replace(/\s+/g, "");
        if (!phone) {
          reactMsg.innerHTML = `<span style="color:#ef4444;">Enter a phone number</span>`;
          return;
        }

        searchBtn.disabled = true;
        const oldText = searchBtn.innerHTML;
        searchBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color:#fff"></i>`;

        try {
          const res = await fetch(`${window.SUPABASE_URL}/functions/v1/replace_gpt`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${window.authToken}`
            },
            body: JSON.stringify({ phone })
          });

          if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
          const data = await res.json();
          lastSubList = Array.isArray(data.matches) ? data.matches : [];

          if (!lastSubList.length) {
            reactMsg.innerHTML = `<span style="color:#f59e0b;">No active subscriptions found</span>`;
            return;
          }

          subSelect.innerHTML = lastSubList.map((s, idx) => {
            const exp = s.expiry ? formatCompactDate(s.expiry) : "No expiry";
            return `<option value="${idx}">${s.accemail} (Exp: ${exp})</option>`;
          }).join("");

          subSelect.style.display = "inline-block";
          reactBtn.style.display = "inline-block";
        } catch (err) {
          console.error(err);
          reactMsg.innerHTML = `<span style="color:#ef4444;">Error: ${err.message}</span>`;
        } finally {
          searchBtn.disabled = false;
          searchBtn.innerHTML = oldText;
        }
      };

      reactBtn.onclick = async () => {
        const selectedIdx = subSelect.value;
        if (selectedIdx === "" || !lastSubList[selectedIdx]) return;
        const sub_id = lastSubList[selectedIdx].sub_id || lastSubList[selectedIdx].id;
        if (!sub_id) {
          reactMsg.innerHTML = `<span style="color:#ef4444;">Error: Could not determine subscription ID.</span>`;
          return;
        }

        reactBtn.disabled = true;
        const oldBtnText = reactBtn.innerHTML;
        reactBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color:#fff"></i> Replacing...`;
        reactMsg.innerHTML = "";

        try {
          const res = await fetch(`${window.SUPABASE_URL}/functions/v1/replace_gpt`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${window.authToken}`
            },
            body: JSON.stringify({ sub_id })
          });

          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(errorText || `HTTP Error ${res.status}`);
          }

          const result = await res.json();
          if (result.error) throw new Error(result.error);

          let formattedExpiry = "N/A";
          if (result.expiry) {
            const expiryDate = new Date(result.expiry);
            if (!isNaN(expiryDate.getTime())) {
              formattedExpiry = expiryDate.toLocaleDateString('en-GB', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
              });
            } else {
              formattedExpiry = result.expiry;
            }
          }

          subSelect.style.display = "none";
          reactBtn.style.display = "none";

          const searchContainer = document.getElementById("gpt-search-container");
          if (searchContainer) searchContainer.style.display = "none";
          const subTitle = document.getElementById("gpt-replace-sub-title");
          if (subTitle) subTitle.style.display = "none";

          reactMsg.innerHTML = `
            <div style="margin-top: 10px; padding: 18px; background: rgba(99, 102, 241, 0.08); border-left: 4px solid var(--primary); border-radius: var(--radius-md); text-align: left;">
              <p style="color: #10b981; font-weight: 800; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-circle-check"></i> Reassigned Successfully!
              </p>
              <div style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.6; margin-bottom: 15px;">
                <strong>Old Email:</strong> ${result.old_accemail || "N/A"}<br/>
                <strong>New Email:</strong> ${result.new_accemail || "N/A"}<br/>
                <strong>Expiry:</strong> ${formattedExpiry}
              </div>
              <button id="copy-replace-link-btn" class="copy-btn" style="width: 100%; justify-content: center; font-weight: 700; gap: 8px; padding: 12px 18px; border-radius: 12px;">
                <i class="fa-regular fa-copy"></i> Copy Invite Link
              </button>
            </div>
          `;

          const copyBtn = document.getElementById("copy-replace-link-btn");
          if (copyBtn) {
            copyBtn.onclick = async () => {
              await navigator.clipboard.writeText(result.link || "");
              showMessage("Copied invite link to clipboard!", "success");
            };
          }

        } catch (err) {
          console.error(err);
          reactMsg.innerHTML = `<span style="color:#ef4444;">Error: ${err.message}</span>`;
        } finally {
          reactBtn.disabled = false;
          reactBtn.innerHTML = oldBtnText;
        }
      };
    }
  });

  const showSpinner = (show = true) => {
    if (show) {
      spinner.classList.add("active");
    } else {
      spinner.classList.remove("active");
    }
  };
  const showMessage = (text, type = "success") => {
    messageBox.textContent = text;
    messageBox.className = "message-box " + type;
    messageBox.style.display = "block";
  };
  const clearMessage = () => {
    const box = document.getElementById("count-badge-area");
    if (box) box.innerHTML = "";
    messageBox.textContent = "";
    messageBox.className = "message-box";
    messageBox.style.display = "none";
  };
  const showCountBadge = (text, icon = "fa-solid fa-circle-check") => {
    const area = document.getElementById("count-badge-area");
    if (area) {
      area.innerHTML = `<div class="count-badge"><i class="${icon}"></i> ${text}</div>`;
    }
  };
  const injectCloseButton = () => {
    if (!modalContent.querySelector("#modal-close-btn")) {
      const closeBtn = document.createElement("button");
      closeBtn.id = "modal-close-btn";
      closeBtn.className = "modal-x-btn";
      closeBtn.innerHTML = "&times;";
      closeBtn.setAttribute("aria-label", "Close");
      closeBtn.onclick = (e) => {
        e.preventDefault();
        cancelModal.style.display = "none";
      };
      modalContent.appendChild(closeBtn);
    }
  };

  async function confirmSubmitModal() {
    return new Promise((resolve) => {
      const x = document.getElementById("modal-close-btn");
      if (x) x.style.display = "none";
      modalContent.innerHTML = `
        <div style="text-align:center; padding:12px 8px;">
          <h3 style="margin:0 0 12px 0">7OTELO LABEL</h3>
          <div style="display:flex; gap:12px; justify-content:center; margin-top:8px;">
            <button id="submit-cancel-btn">cancel</button>
            <button id="submit-continue-btn" class="btn-primary">continue</button>
          </div>
        </div>
      `;
      cancelModal.style.display = "flex";

      const cleanup = () => {
        cancelModal.style.display = "none";
        if (x) x.style.display = "";
      };

      document.getElementById("submit-cancel-btn").onclick = () => {
        cleanup();
        resolve(false);
      };
      document.getElementById("submit-continue-btn").onclick = () => {
        cleanup();
        resolve(true);
      };
    });
  }
  function buildReplaceModalList(items) {
    const rows = items.map((it, idx) => {
      const msg = `Hello! your new login details are:
email: ${it.email}
password: ${it.password}
user: ${it.user}`;
      const dataMsg = msg.replace(/"/g, '&quot;').replace(/\n/g, '&#10;');
      return `
        <div class="replace-row">
          <div class="replace-col">
            <strong>${it.phone}</strong>
          </div>
          <div class="replace-actions">
            <button class="copy-phone" data-phone="${it.phone}">Copy phone</button>
            <button class="copy-msg" data-msg="${dataMsg}">Copy message</button>
          </div>
        </div>
      `;
    }).join("");
    return `
      <h3 style="margin-top:0;text-align:center">Replacement Results</h3>
      <p style="text-align:center;margin:0 0 12px 0">Click to copy the phone or the message for each customer.</p>
      <div class="replace-list">${rows || '<em>No rows returned.</em>'}</div>
      <div style="display:flex;justify-content:center;margin-top:16px">
        <button id="close-modal-btn" class="btn-primary">Close</button>
      </div>
    `;
  }

  const fetchSubscriptionsData = async (view = "pendingpayments") => {
    if (!view) {
      showSpinner(false);
      return;
    }
    showSpinner(true);
    clearMessage();
    try {
      let data;
      if (view === "expiredprivatesubs") {
        const resp = await fetch(
          window.SUPABASE_URL + "/functions/v1/cancel_private",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${window.authToken}`,
            },
            body: JSON.stringify({ action: "show" }),
          }
        );
        data = await resp.json();
        if (!resp.ok || !data.success) throw new Error(data.error || "Failed to fetch expired private subscriptions.");
      } else {
        const resp = await fetch(
          window.SUPABASE_URL + "/functions/v1/fetchpendingpayment",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${window.authToken}`,
            },
            body: JSON.stringify({ action: view }),
          }
        );
        data = await resp.json();
        if (data.error) throw new Error(data.error);
      }

      // Show the table and title
      subscriptionTableTitle.style.display = "block";
      document.getElementById("subscription-table-container").style.display = "block";

      subscriptionTable.innerHTML = "";
      subscriptionTableHead.innerHTML = "";

      if (view === "pendingpayments") {
        subscriptionTableTitle.textContent = "Pending Payments";
        subscriptionTableHead.innerHTML = `
          <tr>
            <th>Phone <button class="sort-btn" data-column="0">↕️</button></th>
            <th>Email <button class="sort-btn" data-column="1">↕️</button></th>
            <th>Amount <button class="sort-btn" data-column="2">↕️</button></th>
            <th>Subscription <button class="sort-btn" data-column="3">↕️</button></th>
            <th>Timestamp <button class="sort-btn" data-column="4">↕️</button></th>
            <th>Action</th>
          </tr>`;
        const pending = data.pendingPayments || [];
        showCountBadge(`Pending: ${pending.length} rows`, "fa-solid fa-clock");
        if (!pending.length) {
          subscriptionTable.innerHTML = `<tr><td colspan="6" style="text-align:center;">No pending payments found.</td></tr>`;
        } else {
          pending.forEach((row) => {
            const tr = document.createElement("tr");
            const ts = row.timestamp ? formatCompactDate(row.timestamp) : "";
            tr.innerHTML = `
              <td data-label="Phone"><span class="truncate-text" title="Click to copy" onclick="navigator.clipboard.writeText('${row.phone}'); showMessage('Copied phone number!', 'success')">${row.phone}</span></td>
              <td data-label="Email"><span class="truncate-text" title="Click to copy" onclick="navigator.clipboard.writeText('${row.accemail}'); showMessage('Copied email!', 'success')">${row.accemail}</span></td>
              <td data-label="Amount">${row.amount}</td>
              <td data-label="Subscription">${row.sub}</td>
              <td data-label="Timestamp">${ts}</td>
              <td data-label="Action"><button class="btn-table-action btn-success mark-paid-btn" data-id="${row.id}"><i class="fa-solid fa-check"></i> Mark as Paid</button></td>`;
            subscriptionTable.appendChild(tr);
          });
        }
      } else if (view === "pendingrenewals") {
        subscriptionTableTitle.textContent = "Unpaid Renewals";
        subscriptionTableHead.innerHTML = `
          <tr>
            <th>ID <button class="sort-btn" data-column="0">↕️</button></th>
            <th>Timestamp <button class="sort-btn" data-column="1">↕️</button></th>
            <th>Phone <button class="sort-btn" data-column="2">↕️</button></th>
            <th>Duration<button class="sort-btn" data-column="3">↕️</button></th>
            <th>Email <button class="sort-btn" data-column="4">↕️</button></th>
            <th>Paid</th>
            <th>Actions</th>
          </tr>`;
        const pendingRenewals = data.pendingRenewals || [];
        showCountBadge(`Unpaid NF: ${pendingRenewals.length} rows`, "fa-solid fa-layer-group");
        if (!pendingRenewals.length) {
          subscriptionTable.innerHTML = `<tr><td colspan="7" style="text-align:center;">No unpaid renewals found.</td></tr>`;
        } else {
          pendingRenewals.forEach((row) => {
            const tr = document.createElement("tr");
            const ts = row.timestamp ? formatCompactDate(row.timestamp) : "";
            tr.innerHTML = `
              <td data-label="ID">${row.id ?? ""}</td>
              <td data-label="Timestamp">${ts}</td>
              <td data-label="Phone"><span class="truncate-text" title="Click to copy" onclick="navigator.clipboard.writeText('${row.phone || ''}'); showMessage('Copied phone number!', 'success')">${row.phone ?? ""}</span></td>
              <td data-label="Duration">${row.duration ?? ""}</td>
              <td data-label="Email"><span class="truncate-text" title="Click to copy" onclick="navigator.clipboard.writeText('${row.accemail || ''}'); showMessage('Copied email!', 'success')">${row.accemail ?? ""}</span></td>
              <td data-label="Paid">${row.paid}</td>
              <td data-label="Actions">
                <div class="button-group" style="display:flex; gap:8px;">
                  <button class="btn-table-action btn-delete cancel-sub-btn" data-id="${row.id}"><i class="fa-solid fa-xmark"></i> Cancel</button>
                  <button class="btn-table-action btn-update placeholder2-btn" data-id="${row.id}"><i class="fa-solid fa-calendar-plus"></i> Renew</button>
                </div>
              </td>`;
            subscriptionTable.appendChild(tr);
          });
        }
      } else if (view === "unpaidanghami") {
        subscriptionTableTitle.textContent = "Unpaid Anghami Renewals";
        subscriptionTableHead.innerHTML = `
          <tr>
            <th>ID <button class="sort-btn" data-column="0">↕️</button></th>
            <th>Timestamp <button class="sort-btn" data-column="1">↕️</button></th>
            <th>Phone <button class="sort-btn" data-column="2">↕️</button></th>
            <th>Duration <button class="sort-btn" data-column="3">↕️</button></th>
            <th>Email <button class="sort-btn" data-column="4">↕️</button></th>
            <th>Paid</th>
            <th>Actions</th>
          </tr>`;
        const rows = data.unpaidAnghamis || [];
        showCountBadge(`Unpaid Ang: ${rows.length} rows`, "fa-solid fa-music");
        subscriptionTable.innerHTML = "";
        if (!rows.length) {
          subscriptionTable.innerHTML = `<tr><td colspan="7" style="text-align:center;">No unpaid Anghami renewals.</td></tr>`;
        } else {
          rows.forEach(row => {
            const ts = row.timestamp ? formatCompactDate(row.timestamp) : "";
            subscriptionTable.insertAdjacentHTML("beforeend", `
              <tr>
                <td data-label="ID">${row.id ?? ""}</td>
                <td data-label="Timestamp">${ts}</td>
                <td data-label="Phone"><span class="truncate-text" title="Click to copy" onclick="navigator.clipboard.writeText('${row.phone || ''}'); showMessage('Copied phone number!', 'success')">${row.phone ?? ""}</span></td>
                <td data-label="Duration">${row.duration ?? ""}</td>
                <td data-label="Email"><span class="truncate-text" title="Click to copy" onclick="navigator.clipboard.writeText('${row.accemail || ''}'); showMessage('Copied email!', 'success')">${row.accemail ?? ""}</span></td>
                <td data-label="Paid">${row.paid ?? ""}</td>
                <td data-label="Actions"><button class="btn-table-action btn-delete cancel-anghami-btn" data-id="${row.id}"><i class="fa-solid fa-xmark"></i> Cancel</button></td>
              </tr>
            `);
          });
        }
      } else if (view === "unpaidgpt") {
        subscriptionTableTitle.textContent = "Unpaid GPT Renewals";
        subscriptionTableHead.innerHTML = `
          <tr>
            <th>ID <button class="sort-btn" data-column="0">↕️</button></th>
            <th>Timestamp <button class="sort-btn" data-column="1">↕️</button></th>
            <th>Phone <button class="sort-btn" data-column="2">↕️</button></th>
            <th>Duration <button class="sort-btn" data-column="3">↕️</button></th>
            <th>Email <button class="sort-btn" data-column="4">↕️</button></th>
            <th>Paid</th>
            <th>Actions</th>
          </tr>`;
        const rows = data.unpaidGpts || [];
        showCountBadge(`Unpaid GPT: ${rows.length} rows`, "fa-solid fa-robot");
        subscriptionTable.innerHTML = "";
        if (!rows.length) {
          subscriptionTable.innerHTML = `<tr><td colspan="7" style="text-align:center;">No unpaid GPT renewals.</td></tr>`;
        } else {
          rows.forEach(row => {
            const ts = row.timestamp ? formatCompactDate(row.timestamp) : "";
            subscriptionTable.insertAdjacentHTML("beforeend", `
              <tr>
                <td data-label="ID">${row.id ?? ""}</td>
                <td data-label="Timestamp">${ts}</td>
                <td data-label="Phone"><span class="truncate-text" title="Click to copy" onclick="navigator.clipboard.writeText('${row.phone || ''}'); showMessage('Copied phone number!', 'success')">${row.phone ?? ""}</span></td>
                <td data-label="Duration">${row.duration ?? ""}</td>
                <td data-label="Email"><span class="truncate-text" title="Click to copy" onclick="navigator.clipboard.writeText('${row.accemail || ''}'); showMessage('Copied email!', 'success')">${row.accemail ?? ""}</span></td>
                <td data-label="Paid">${row.paid ?? ""}</td>
                <td data-label="Actions"><button class="btn-table-action btn-delete gpt-cancel-btn" data-id="${row.id}"><i class="fa-solid fa-xmark"></i> Cancel</button></td>
              </tr>
            `);
          });
        }
      } else if (view === "expiredprivatesubs") {
        subscriptionTableTitle.textContent = "Expired Private Subscriptions";
        subscriptionTableHead.innerHTML = `
          <tr>
            <th>ID <button class="sort-btn" data-column="0">↕️</button></th>
            <th>Email <button class="sort-btn" data-column="1">↕️</button></th>
            <th>Phone <button class="sort-btn" data-column="2">↕️</button></th>
            <th>Team ID <button class="sort-btn" data-column="3">↕️</button></th>
            <th>Start Date <button class="sort-btn" data-column="4">↕️</button></th>
            <th>Expiry <button class="sort-btn" data-column="5">↕️</button></th>
            <th>Confirmed <button class="sort-btn" data-column="6">↕️</button></th>
            <th>Actions</th>
          </tr>`;
        const rows = data.data || [];
        showCountBadge(`Expired Private: ${rows.length} rows`, "fa-solid fa-user-xmark");
        subscriptionTable.innerHTML = "";
        if (!rows.length) {
          subscriptionTable.innerHTML = `<tr><td colspan="8" style="text-align:center;">No expired private subscriptions found.</td></tr>`;
        } else {
          window.expiredPrivateSubsData = rows;
          rows.forEach((row, idx) => {
            const startDate = row.ts ? formatCompactDate(row.ts) : "";
            const expiryDate = row.expiry ? formatCompactDate(row.expiry) : "";
            let confirmedClass = "";
            if (row.confirmed_date === "yes") confirmedClass = "style='color:#10b981; font-weight:bold;'";
            else if (row.confirmed_date === "no") confirmedClass = "style='color:#f59e0b; font-weight:bold;'";
            else if (row.confirmed_date === "wrong") confirmedClass = "style='color:#ef4444; font-weight:bold;'";
            subscriptionTable.insertAdjacentHTML("beforeend", `
              <tr>
                <td data-label="ID">${row.id ?? ""}</td>
                <td data-label="Email"><span class="truncate-text" title="Click to copy" onclick="navigator.clipboard.writeText('${row.customer_email || ''}'); showMessage('Copied email!', 'success')">${row.customer_email ?? ""}</span></td>
                <td data-label="Phone"><span class="truncate-text" title="Click to copy" onclick="navigator.clipboard.writeText('${row.phone || ''}'); showMessage('Copied phone number!', 'success')">${row.phone ?? ""}</span></td>
                <td data-label="Team ID"><code class="code-pill" title="Click to copy" onclick="navigator.clipboard.writeText('${row.team_id || ''}'); showMessage('Copied Team ID!', 'success')">${row.team_id ?? ""}</code></td>
                <td data-label="Start Date">${startDate}</td>
                <td data-label="Expiry">${expiryDate}</td>
                <td data-label="Confirmed" ${confirmedClass}>${row.confirmed_date ?? ""}</td>
                <td data-label="Actions">
                  <div class="button-group" style="display:flex; gap:8px;">
                    <button class="btn-table-action btn-update update-private-btn" data-index="${idx}"><i class="fa-solid fa-pen-to-square"></i> Update</button>
                    <button class="btn-table-action btn-delete delete-private-btn" data-email="${row.customer_email}" data-id="${row.id}"><i class="fa-solid fa-trash"></i> Delete</button>
                  </div>
                </td>
              </tr>
            `);
          });
        }
      } else {
        subscriptionTableTitle.textContent = "All Subscriptions";
        subscriptionTableHead.innerHTML = `
          <tr>
            <th>Phone</th>
            <th>Acc Email</th>
            <th>Duration</th>
            <th>Expiry</th>
          </tr>`;
        const subs = data.subscriptions || [];
        showCountBadge(`Total: ${subs.length} rows`, "fa-solid fa-database");
        if (!subs.length) {
          subscriptionTable.innerHTML = `<tr><td colspan="4" style="text-align:center;">No subscriptions found.</td></tr>`;
        } else {
          subs.forEach((row) => {
            const expiry = row.expiry ? formatCompactDate(row.expiry) : "";
            const tr = document.createElement("tr");
            tr.innerHTML = `
              <td data-label="Phone"><span class="truncate-text" title="Click to copy" onclick="navigator.clipboard.writeText('${row.phone || ''}'); showMessage('Copied phone number!', 'success')">${row.phone ?? ""}</span></td>
              <td data-label="Acc Email"><span class="truncate-text" title="Click to copy" onclick="navigator.clipboard.writeText('${row.accemail || ''}'); showMessage('Copied email!', 'success')">${row.accemail ?? ""}</span></td>
              <td data-label="Duration">${row.duration}</td>
              <td data-label="Expiry">${expiry}</td>`;
            subscriptionTable.appendChild(tr);
          });
        }
      }
      filterSubscriptionsTable();
    } catch (err) {
      console.error("Error fetching data:", err);
      showMessage("Error fetching data.", "error");
    } finally {
      showSpinner(false);
    }
  };
  // Initial Load: Do NOT fetch "pendingpayment" automatically.
  // The user must select it from the dropdown (which now defaults to empty).
  // viewSelector.value = "pendingpayments";
  // fetchSubscriptionsData("pendingpayments");

  // Just fetch KPIs
  fetchDashboardKpis();

  // Force reset selector to empty on load so it matches the "nothing loaded" state
  if (viewSelector) viewSelector.value = "";

  viewSelector.addEventListener("change", e =>
    fetchSubscriptionsData(e.target.value)
  );

  const markAsPaid = async (id) => {
    showSpinner(true);
    clearMessage();
    try {
      const resp = await fetch(
        window.SUPABASE_URL + "/functions/v1/markaspaid",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${window.authToken}`,
          },
          body: JSON.stringify({ id }),
        }
      );
      const { success, error } = await resp.json();
      if (error) throw new Error(error);
      showMessage(`Payment ${id} marked paid.`, "success");
      
      // Remove row locally
      const rowToRemove = subscriptionTable.querySelector(`button.mark-paid-btn[data-id="${id}"]`);
      if (rowToRemove) {
        rowToRemove.closest("tr")?.remove();
      } else {
        const altRow = subscriptionTable.querySelector(`[data-id="${id}"]`);
        altRow?.closest("tr")?.remove();
      }
      
      fetchDashboardKpis();
    } catch (err) {
      console.error(err);
      showMessage("Error marking as paid.", "error");
    } finally {
      showSpinner(false);
    }
  };


  const placeholderAction1 = (id) => alert(`Placeholder 1 for ${id}`);
  window.placeholderAction2 = (id) => openExtendModal(id);

  const openCancelModal = (payId) => {
    modalContent.innerHTML = "";
    currentPayId = payId;
    loadCancelDetails();
    cancelModal.style.display = "flex";
  };

  // ---- REWRITE: updateDurationOptions() and related serviceSelector change event for Canva ----
  function updateDurationOptions() {
    const durationSelect = document.getElementById("duration");
    if (!durationSelect) return;
    durationSelect.innerHTML = "";
    const svc = serviceSelector.value.toLowerCase();
    if (svc === "anghami") {
      [1, 3, 6, 12].forEach(m =>
        durationSelect.appendChild(new Option(`${m} months`, `${m} `))
      );
    } else if (svc === "canva") {
      [1, 3, 6, 0].forEach(m => {
        if (m === 0) {
          durationSelect.appendChild(new Option(`Lifetime`, "0"));
        } else {
          durationSelect.appendChild(new Option(`${m} month${m > 1 ? "s" : ""} `, `${m} `));
        }
      });
    } else if (svc === "chatgpt") {
      [1, 3, 6, 12].forEach(m =>
        durationSelect.appendChild(new Option(`${m} months`, `${m} `))
      );
    } else if (svc === "gpt private") {
      [1, 3, 6, 12].forEach(m =>
        durationSelect.appendChild(new Option(`${m} months`, `${m} `))
      );
    } else {
      [1, 3, 6, 12].forEach(m =>
        durationSelect.appendChild(new Option(`${m} month${m > 1 ? "s" : ""} `, `${m} `))
      );
    }
  }

  serviceSelector.addEventListener("change", () => {
    const svc = serviceSelector.value.toLowerCase();
    if (svc === "anghami") {
      usernameInput.style.display = "block";
    } else {
      usernameInput.style.display = "none";
      usernameInput.value = "";
    }
    updateDurationOptions();
  });

  document.addEventListener("DOMContentLoaded", () => {
    serviceSelector.dispatchEvent(new Event("change"));
  });
  // ---- END REWRITE ----

  const loadCancelDetails = async () => {
    let detail = null;
    try {
      const jwt = (await window.supabaseClient.auth.getSession()).data
        .session?.access_token;
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      };
      const detailRes = await fetch(
        `${window.SUPABASE_URL}/functions/v1/canceluser`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "getdetails", pay_id: currentPayId }),
        }
      );
      detail = await detailRes.json();
      if (!detail || typeof detail !== "object") detail = {};
      detail.accemail = detail.accemail || "";
      detail.password = detail.password || "";
      detail.user = detail.user || "";
      modalContent.innerHTML = `
        <p><strong>Email:</strong> ${detail.accemail}
          <button class="copy-btn" data-value="${detail.accemail}"><i class="fa-regular fa-copy"></i> Copy</button></p>
        <p><strong>Password:</strong> ${detail.password}
           <button class="copy-btn" data-value="${detail.password}"><i class="fa-regular fa-copy"></i> Copy</button></p>
        <p><strong>User:</strong> ${detail.user}</p>
        <p class="warning-text">
          Delete the profile, recreate it, and kick out the user's devices.
        </p>
        <input id="new-pass" placeholder="New password" />
        <button id="change-pass" class="btn-primary">Change Password</button>`;
      injectCloseButton();

      document.getElementById("change-pass").onclick = async () => {
        const newPass = document.getElementById("new-pass").value.trim();
        if (!newPass || !confirm("Confirm password change & deletion?")) return;
        const deleteRes = await fetch(
          `${window.SUPABASE_URL}/functions/v1/canceluser`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              action: "delete_user_and_update_password",
              pay_id: currentPayId,
              new_pass: newPass,
            }),
          }
        );
        const { success, otherNumbers, error } = await deleteRes.json();
        if (!success) throw new Error(error || "Failed to delete & update");
        let numbersHTML = "";
        if (Array.isArray(otherNumbers) && otherNumbers.length) {
          numbersHTML = `
            <p style="margin-top:12px;font-weight:bold">Other numbers:</p>
            <ul>
        ${otherNumbers
              .map(({ phone, expiry }) => {
                const expired = new Date(expiry) <= new Date();
                return `
                    <li>
                      ${phone || ""}${expired ? ' <span style="color:red">(expired)</span>' : ""}
                      <button class="copy-btn" data-value="${phone || ""}"><i class="fa-regular fa-copy"></i> Copy</button>
                    </li>`;
              })
              .join("")}
      </ul>`;
        }
        modalContent.innerHTML = `
          <p style="color:#16a34a;font-weight:bold;text-align:center">
            Password changed successfully!
          </p>
          <textarea id="copy-msg" style="opacity:0">
Hello! Your new login details are:
email: ${detail.accemail}
password: ${newPass}
          </textarea>
          <button id="copy-message-btn">Copy message</button>
          ${numbersHTML}
  <div style="display:flex;justify-content:center;margin-top:16px">
    <button id="close-modal-btn" class="btn-primary">Close</button>
  </div>`;
        injectCloseButton();
      };
    } catch (err) {
      console.error("Error in cancel flow:", err);
      showMessage(`Error: ${err.message}`, "error");
    }
  };

  const openExtendModal = (payId) => {
    currentPayId = payId;
    let service = "Netflix";
    const row = Array.from(subscriptionTable.querySelectorAll("tr")).find(tr => {
      return tr.querySelector(`[data-id="${payId}"]`);
    });
    if (row) {
      const subCell = row.cells && row.cells[3];
      if (subCell) {
        if (/anghami/i.test(subCell.textContent)) {
          service = "Anghami";
        } else if (/canva/i.test(subCell.textContent)) {
          service = "Canva";
        }
      }
    }
    let optionsHtml = "";
    if (service.toLowerCase() === "canva") {
      optionsHtml = `
        <option value="1">1 month</option>
        <option value="3">3 months</option>
        <option value="6">6 months</option>
        <option value="0">Lifetime</option>
      `;
    } else {
      optionsHtml = `
        <option value="1">1 month</option>
        <option value="3">3 months</option>
        <option value="6">6 months</option>
        <option value="12">12 months</option>
      `;
    }
    modalContent.innerHTML = `
      <p style="font-weight:bold;text-align:center">Select extension duration</p>
      <select id="extend-months" style="display:block;margin:20px auto">
        ${optionsHtml}
      </select>
      <div style="display:flex;justify-content:center;gap:12px;margin-top:20px">
        <button id="extend-cancel-btn">Cancel</button>
        <button id="extend-confirm-btn" class="btn-primary">Extend</button>
      </div>`;
    injectCloseButton();
    document.getElementById("extend-cancel-btn").onclick = () => {
      if (confirm("Close this modal?")) cancelModal.style.display = "none";
    };
    document.getElementById("extend-confirm-btn").onclick = confirmExtend;
    cancelModal.style.display = "flex";
  };

  const confirmExtend = async () => {
    const value = document.getElementById("extend-months").value;
    // Lifetime = 0 (special)
    const months = parseInt(value, 10);
    const allowed = Array.from(document.getElementById("extend-months").options).map(opt => parseInt(opt.value, 10));
    if (!allowed.includes(months)) return alert("Select a valid duration.");
    // tailor confirmation for "Lifetime"
    let confirmMsg = months === 0 ? "Confirm extend to lifetime?" : `Confirm extend by ${months} month(s)?`;
    if (!confirm(confirmMsg)) return;
    try {
      const jwt = (await window.supabaseClient.auth.getSession()).data.session
        .access_token;
      const res = await fetch(
        `${window.SUPABASE_URL}/functions/v1/extendnf`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({ id: currentPayId, months }),
        }
      );
      const result = await res.json();
      if (!res.ok || result.error) throw new Error(result.error || "Failed");
      modalContent.innerHTML = `
        <p style="color:#16a34a;font-weight:bold;text-align:center">
          Subscription extended${months === 0 ? " to Lifetime!" : ` by ${months} month(s)!`}
        </p>
    <div style="display:flex;justify-content:center;margin-top:16px">
      <button onclick="cancelModal.style.display='none'" class="btn-primary">
        Close
      </button>
    </div>`;
      injectCloseButton();
      // Update/remove row locally
      const view = viewSelector.value;
      const rowToRemove = subscriptionTable.querySelector(`[data-id="${currentPayId}"]`);
      if (rowToRemove) {
        if (view === "pendingrenewals" || view === "pendingpayments") {
          rowToRemove.closest("tr")?.remove();
        } else if (view === "subscriptions") {
          const tr = rowToRemove.closest("tr");
          if (tr && tr.cells && tr.cells.length >= 4) {
            const oldDuration = parseInt(tr.cells[2].textContent, 10) || 0;
            tr.cells[2].textContent = months === 0 ? "Lifetime" : (oldDuration + months);
            
            const oldExpiryText = tr.cells[3].textContent;
            let baseDate = new Date();
            if (oldExpiryText) {
              const parsedDate = new Date(oldExpiryText);
              if (!isNaN(parsedDate.getTime())) {
                baseDate = parsedDate;
              }
            }
            if (months === 0) {
              tr.cells[3].textContent = "Lifetime";
            } else {
              baseDate.setMonth(baseDate.getMonth() + months);
              tr.cells[3].textContent = formatCompactDate(baseDate);
            }
          }
        }
      }
      fetchDashboardKpis();
    } catch (err) {
      console.error("Error extending subscription:", err);
      showMessage(`Error: ${err.message}`, "error");
      cancelModal.style.display = "none";
    }
  };

  function sanitizeInput(str) {
    if (typeof str !== "string") return "";
    return str.replace(/[<>"'`\\]/g, "").trim();
  }
  function sanitizePhone(str) {
    if (typeof str !== "string") return "";
    return str.replace(/\s+/g, "");
  }

  const init = () => {
    viewSelector.addEventListener("change", (e) =>
      fetchSubscriptionsData(e.target.value)
    );
    adminForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const confirmed = await confirmSubmitModal();
      if (!confirmed) return;
      clearMessage();
      showSpinner(true);
      submitBtn.disabled = true;

      let phone = sanitizeInput(document.getElementById("phone").value);
      phone = sanitizePhone(phone);
      const duration = parseInt(sanitizeInput(document.getElementById("duration").value), 10);
      const paid = document.getElementById("paid").value === "true";
      const service = serviceSelector.value;
      const username = sanitizeInput(usernameInput.value);

      const svc = serviceSelector.value.toLowerCase();

      if (svc === "anghami" && !username) {
        showMessage("Username is required for Anghami.", "error");
        showSpinner(false);
        submitBtn.disabled = false;
        return;
      }
      const subEmail = sanitizeInput(document.getElementById("sub-email")?.value || "");
      // Canva OR GPT Private: require customer email
      if ((svc === "canva" || svc === "gpt private") && !subEmail) {
        showMessage("Customer email is required.", "error");
        showSpinner(false);
        submitBtn.disabled = false;
        return;
      }

      let endpoint, body = { phone, duration, paid };
      if (svc === "anghami") {
        endpoint = "/functions/v1/addanghami";
        body.username = usernameInput.value.trim();
      } else if (svc === "chatgpt") {
        endpoint = "/functions/v1/addgpt";
      } else if (svc === "canva") {
        endpoint = "/functions/v1/addcanva";
        body.sub_email = subEmail; // required for Canva
      } else if (svc === "gpt private") {
        endpoint = "/functions/v1/addprivate";
        body.email = subEmail;
      } else {
        endpoint = "/functions/v1/addnf";
      }

      try {
        let resp = await fetch(window.SUPABASE_URL + endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${window.authToken}`
          },
          body: JSON.stringify(body),
        });
        let data = await resp.json();

        // Handle specific "can_extend" case for addprivate (GPT Private)
        if (svc === "gpt private" && resp.status === 400 && data.can_extend === true) {
          if (confirm(data.error + "\n\nWould you like to migrate them to a new team to renew?")) {
            // Retry with extend: true
            resp = await fetch(window.SUPABASE_URL + endpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${window.authToken}`
              },
              body: JSON.stringify({ ...body, extend: true }),
            });
            data = await resp.json();
          } else {
            // User cancelled retry
            showSpinner(false);
            submitBtn.disabled = false;
            return;
          }
        }

        if (!resp.ok || data.error) throw new Error(data.error || "Unknown error occurred");

        if (svc === "anghami") {
          const expiryDate = new Date();
          expiryDate.setMonth(expiryDate.getMonth() + duration);
          const formattedExpiry = expiryDate.toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
          });

          showMessage("", "success");
          fetchDashboardKpis();
          const btn = document.createElement("button");
          btn.textContent = "Copy Anghami Info";
          btn.onclick = async () => {
            await navigator.clipboard.writeText(
              `*link*: ${data.link}\n*expiry*: ${formattedExpiry}`
            );
            showMessage("Copied!", "success");
          };
          messageBox.appendChild(btn);
        } else if (svc === "chatgpt") {
          showMessage("", "success");
          fetchDashboardKpis();
          let expiryString;
          if (data.expiry) {
            const expiryDate = new Date(data.expiry);
            if (!isNaN(expiryDate.getTime())) {
              expiryString = expiryDate.toLocaleDateString('en-GB', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
              });
            } else {
              expiryString = data.expiry;
            }
          } else {
            const expiryDate = new Date();
            expiryDate.setMonth(expiryDate.getMonth() + duration);
            expiryString = expiryDate.toLocaleDateString('en-GB', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
            });
          }
          const btn = document.createElement("button");
          btn.className = "copy-btn";
          btn.style.marginTop = "10px";
          btn.style.display = "inline-flex";
          btn.innerHTML = `<i class="fa-regular fa-copy"></i> Copy ChatGPT Info`;
          btn.onclick = async () => {
            await navigator.clipboard.writeText(
              `*link*: ${data.link || ""}\n*expiry*: ${expiryString}`
            );
            showMessage("Copied ChatGPT info!", "success");
          };
          messageBox.appendChild(btn);
        } else if (svc === "canva") {
          showMessage("", "success");
          fetchDashboardKpis();

          let expiryString = "";
          if (data.expiry) {
            if (
              typeof data.expiry === "string" &&
              data.expiry.trim().toLowerCase() === "lifetime"
            ) {
              expiryString = "Lifetime";
            } else {
              const expiryDate = new Date(data.expiry);
              if (!isNaN(expiryDate.getTime())) {
                expiryString = expiryDate.toLocaleDateString('en-GB', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                });
              } else {
                expiryString = data.expiry;
              }
            }
          } else {
            const expiryDate = new Date();
            expiryDate.setMonth(expiryDate.getMonth() + duration);
            expiryString = expiryDate.toLocaleDateString('en-GB', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
            });
          }

          const btn = document.createElement("button");
          btn.textContent = "Copy Canva Info";
          btn.onclick = async () => {
            await navigator.clipboard.writeText(
              `*link*: ${data.link || ""}\n*expiry*: ${expiryString}`
            );
            showMessage("Copied!", "success");
          };
          messageBox.appendChild(btn);

          const subEmailInput = document.getElementById("sub-email");
          if (subEmailInput) subEmailInput.value = "";

        } else if (svc === "gpt private") {
          showMessage("Private Invite Sent!", "success");
          fetchDashboardKpis();
          messageBox.innerHTML += `
             <div style="margin-top:10px; padding:10px; background:white; border-left:4px solid green; color:#333;">
               <strong>Success!</strong><br/>
               User: ${body.email}<br/>
               Assigned Team: ${data.team_id}<br/>
               Expiry: ${new Date(data.expiry).toLocaleDateString()}
             </div>
          `;
          adminForm.reset();
        } else {
          showMessage("", "success");
          fetchDashboardKpis();
          const expiryDate = new Date();
          expiryDate.setMonth(expiryDate.getMonth() + duration);
          const formattedExpiry = expiryDate.toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
          });
          const btn = document.createElement("button");
          btn.textContent = "Copy Netflix Info";
          btn.onclick = async () => {
            await navigator.clipboard.writeText(
              `*e-mail*: ${data.email}\n*password*: ${data.password}\n*user*: ${data.uses}\n*expiry*: ${formattedExpiry}`
            );
            showMessage("Copied!", "success");
          };
          messageBox.appendChild(btn);
        }
        adminForm.reset();
      } catch (err) {
        showMessage(`Error: ${err.message}`, "error");
      } finally {
        showSpinner(false);
        submitBtn.disabled = false;
      }
    });

    const openReactivateBtn = document.getElementById("open-reactivate-modal");
    const reactivateTpl = document.getElementById("reactivate-modal-template");
    if (openReactivateBtn && reactivateTpl) {
      openReactivateBtn.addEventListener("click", () => {
        // Reset the template state before displaying it
        const phoneInput = document.getElementById("reactivate-phone");
        if (phoneInput) phoneInput.value = "";
        const subSelect = document.getElementById("reactivate-sub-select");
        if (subSelect) {
          subSelect.style.display = "none";
          subSelect.innerHTML = "";
        }
        const reactBtn = document.getElementById("reactivate-btn");
        if (reactBtn) reactBtn.style.display = "none";
        const reactMsg = document.getElementById("reactivate-msg");
        if (reactMsg) reactMsg.innerHTML = "";
        const searchContainer = document.getElementById("gpt-search-container");
        if (searchContainer) searchContainer.style.display = "flex";
        const subTitle = document.getElementById("gpt-replace-sub-title");
        if (subTitle) subTitle.style.display = "block";

        reactivateTpl.style.display = "block";
        openModalWith(reactivateTpl);
      });
    }

    const openReplaceBtn = document.getElementById("open-replace-modal");
    const replaceTpl = document.getElementById("replace-modal-template");
    if (openReplaceBtn && replaceTpl) {
      openReplaceBtn.addEventListener("click", () => {
        replaceTpl.style.display = "block";
        openModalWith(replaceTpl);
      });
    }

    // --- Trigger functions with robust handling ---
    async function doGenericTrigger(btnId, limitId, endpoint, title, successPrefix) {
      const btn = document.getElementById(btnId);
      if (!btn) return;
      const oldText = btn.textContent;

      clearMessage();
      showSpinner(true);
      btn.disabled = true;
      btn.textContent = "Processing...";

      try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        const token = session?.access_token;

        let body = {};
        if (limitId) {
          const limitEl = document.getElementById(limitId);
          body.limit = limitEl ? (Number(limitEl.value) || 500) : 500;
          body.dry_run = false;
        }

        const resp = await fetch(`${window.SUPABASE_URL}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body)
        });
        const data = await resp.json();
        if (!resp.ok || data.error) throw new Error(data.error || "Error");

        if (successPrefix) {
          const inserted = data.inserted ?? 0;
          const skipped = data.skipped_existing ?? 0;
          showCountBadge(`${successPrefix}: ${inserted} processed`, "fa-solid fa-bolt-lightning");
          showMessage(`${successPrefix} — inserted: ${inserted}, skipped: ${skipped}`, "success");
        } else {
          showMessage(`Success: ${data.message || "Action completed"}`, "success");
        }

        fetchSubscriptionsData(viewSelector.value);
        fetchDashboardKpis();
      } catch (e) {
        console.error(e);
        showMessage(`Error: ${e.message}`, "error");
      } finally {
        showSpinner(false);
        btn.disabled = false;
        btn.textContent = oldText;
      }
    }

    // Bind Anghami Renew button
    const angBtn = document.getElementById("trigger-anghami-renewals-btn");
    if (angBtn) {
      angBtn.onclick = () => openConfirmHoldModal({
        title: "Create Anghami Pending Renewals",
        body: "This will create unpaid renewal entries for expired Anghami subscriptions.",
        seconds: 3,
        onConfirm: () => doGenericTrigger("trigger-anghami-renewals-btn", "anghami-limit", "/functions/v1/addrenew_anghami", null, "Anghami renewals")
      });
    }

    // Bind Netflix Renew button
    const renewBtn = document.getElementById("trigger-renewals-btn");
    if (renewBtn) {
      renewBtn.onclick = () => openConfirmHoldModal({
        title: "Trigger Renewal Payments",
        body: "This will trigger renewal payments for eligible customers.",
        seconds: 3,
        onConfirm: () => doGenericTrigger("trigger-renewals-btn", null, "/functions/v1/addrenew")
      });
    }

    // Bind GPT Renewals button
    const gptRenewBtn = document.getElementById("trigger-gpt-renewals-btn");
    if (gptRenewBtn) {
      gptRenewBtn.onclick = () => openConfirmHoldModal({
        title: "Add GPT Renewals",
        body: "This will add unpaid renewal payments for eligible GPT subscriptions.",
        seconds: 3,
        onConfirm: () => doGenericTrigger("trigger-gpt-renewals-btn", "gpt-limit", "/functions/v1/addrenew_gpt", null, "GPT renewals")
      });
    }

    // Bind Message trigger button
    const msgBtn = document.getElementById("trigger-msg");
    if (msgBtn) {
      msgBtn.onclick = () => openConfirmHoldModal({
        title: "Trigger Message",
        body: "This will send messages to customers.",
        seconds: 3,
        onConfirm: () => doGenericTrigger("trigger-msg", null, "/functions/v1/auto_msg")
      });
    }

    // Bind Cancel Private button
    const cancelPrivateBtn = document.getElementById("cancel-private-btn");
    if (cancelPrivateBtn) {
      cancelPrivateBtn.onclick = () => openConfirmHoldModal({
        title: "Cancel Private Subscription",
        body: "This will call the cancelprivate function.",
        seconds: 3,
        onConfirm: () => doGenericTrigger("cancel-private-btn", null, "/functions/v1/cancelprivate")
      });
    }

    subscriptionTable.addEventListener("click", (e) => {
      const targetBtn = e.target.closest("button");
      if (!targetBtn) return;

      if (targetBtn.classList.contains("mark-paid-btn")) {
        markAsPaid(targetBtn.dataset.id);
      } else if (targetBtn.classList.contains("cancel-sub-btn")) {
        openCancelModal(targetBtn.dataset.id);
      } else if (targetBtn.classList.contains("placeholder2-btn")) {
        placeholderAction2(targetBtn.dataset.id);
      } else if (targetBtn.classList.contains("cancel-anghami-btn")) {
        const payId = Number(targetBtn.dataset.id);
        if (!payId) return showMessage("Missing pay id", "error");
        openAnghamiCancelModal(payId);
      } else if (targetBtn.classList.contains("gpt-cancel-btn")) {
        const payId = Number(targetBtn.dataset.id);
        if (!payId) return showMessage("Missing pay id", "error");
        openGptCancelModal(payId);
      } else if (targetBtn.classList.contains("update-private-btn")) {
        const index = Number(targetBtn.dataset.index);
        const row = window.expiredPrivateSubsData && window.expiredPrivateSubsData[index];
        if (row) openUpdatePrivateModal(row);
      } else if (targetBtn.classList.contains("delete-private-btn")) {
        const email = targetBtn.dataset.email;
        const id = targetBtn.dataset.id;
        deletePrivateSub(email, id);
      }
    });

    if (replaceBtn && replaceEmailInput) {
      replaceBtn.onclick = async () => {
        const oldText = replaceBtn.textContent;
        try {
          const accemail = replaceEmailInput.value.trim();
          if (!accemail) return showMessage("Enter an account email to replace.", "error");

          clearMessage();
          showSpinner(true);
          replaceBtn.disabled = true;
          replaceBtn.textContent = "Processing...";

          const { data: { session } } = await window.supabaseClient.auth.getSession();
          const token = session?.access_token;
          if (!token) throw new Error("Not authenticated.");

          const res = await fetch(`${window.SUPABASE_URL}/functions/v1/replacenf`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ accemail })
          });

          const data = await res.json();
          if (!res.ok || data.error) throw new Error(data.error || "Replacement failed.");

          const rows = Array.isArray(data) ? data : (data.replacements || []);
          modalContent.innerHTML = buildReplaceModalList(rows);
          injectCloseButton();
          cancelModal.style.display = "flex";
        } catch (err) {
          console.error(err);
          showMessage(`Error: ${err.message}`, "error");
        } finally {
          showSpinner(false);
          replaceBtn.disabled = false;
          replaceBtn.textContent = oldText;
        }
      };
    }

    modalContent.addEventListener("click", async (e) => {
      if (e.target.classList.contains("copy-btn")) {
        navigator.clipboard.writeText(e.target.dataset.value);
        showMessage("Copied!", "success");
      }
      if (e.target.id === "copy-message-btn") {
        const msgText = document.getElementById("copy-msg")?.value;
        if (msgText) {
          navigator.clipboard.writeText(msgText);
          showMessage("Message copied!", "success");
        }
      }
      if (e.target.id === "close-modal-btn") {
        cancelModal.style.display = "none";
      }
      if (e.target.classList.contains("copy-phone")) {
        const v = e.target.getAttribute("data-phone");
        if (v) {
          await navigator.clipboard.writeText(v);
          showMessage("Phone copied.", "success");
        }
      }
      if (e.target.classList.contains("copy-msg")) {
        const v = e.target.getAttribute("data-msg");
        if (v) {
          const msg = v.replace(/&#10;/g, '\n').replace(/&quot;/g, '"');
          await navigator.clipboard.writeText(msg);
          showMessage("Message copied.", "success");
        }
      }
    });
  };

  return {
    init,
    fetchSubscriptionsData,
  };
})();

document.addEventListener("DOMContentLoaded", () => {
  window.Subscriptions.init();
});
