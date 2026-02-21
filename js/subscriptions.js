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
        reactMsg.textContent = "";
        const phone = searchInput.value.trim().replace(/\s+/g, "");
        if (!phone) return reactMsg.textContent = "Enter a phone number";
        const res = await fetch(`${window.SUPABASE_URL}/functions/v1/gpt_search_by_phone`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${window.authToken}` },
          body: JSON.stringify({ phone })
        });
        const list = await res.json();
        lastSubList = Array.isArray(list) ? list : [];
        if (!lastSubList.length) return reactMsg.textContent = "No subscriptions found";
        subSelect.innerHTML = lastSubList.map((s, idx) =>
          `<option value="${idx}">${s.accemail} (signed ${new Date(s.ts).toLocaleString()})</option>`
        ).join("");
        subSelect.style.display = "inline-block";
        reactBtn.style.display = "inline-block";
      };

      reactBtn.onclick = async () => {
        const selectedIdx = subSelect.value;
        if (selectedIdx === "" || !lastSubList[selectedIdx]) return;
        const sub_id = lastSubList[selectedIdx].sub_id || lastSubList[selectedIdx].id;
        if (!sub_id) {
          reactMsg.textContent = "Error: Could not determine subscription ID.";
          return;
        }
        const res = await fetch(`${window.SUPABASE_URL}/functions/v1/override_gpt_code`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${window.authToken}` },
          body: JSON.stringify({ id: sub_id })
        });
        if (res.ok) {
          reactMsg.textContent = "✅ Reactivated—next code will forward.";
        } else {
          const err = await res.text();
          reactMsg.textContent = "Error: " + err;
        }
      };
    }
  });

  const showSpinner = (show = true) => {
    spinner.style.display = show ? "block" : "none";
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
      const data = await resp.json();
      if (data.error) throw new Error(data.error);

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
            tr.innerHTML = `
              <td>${row.phone}</td>
              <td>${row.accemail}</td>
              <td>${row.amount}</td>
              <td>${row.sub}</td>
              <td>${row.timestamp ? new Date(row.timestamp).toLocaleString() : ""}</td>
              <td><button class="pill-btn mark-paid-btn" data-id="${row.id}" style="padding:8px 12px; font-size:0.75rem;"><i class="fa-solid fa-check"></i> Mark as Paid</button></td>`;
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
            tr.innerHTML = `
              <td>${row.id ?? ""}</td>
              <td>${row.timestamp ? new Date(row.timestamp).toLocaleString() : ""}</td>
              <td>${row.phone ?? ""}</td>
              <td>${row.duration ?? ""}</td>
              <td>${row.accemail ?? ""}</td>
              <td>${row.paid}</td>
              <td>
                <div class="button-group" style="display:flex; gap:8px;">
                  <button class="pill-btn cancel-sub-btn" data-id="${row.id}" style="padding:8px 12px; font-size:0.75rem;"><i class="fa-solid fa-xmark"></i> Cancel</button>
                  <button class="pill-btn placeholder2-btn" data-id="${row.id}" style="padding:8px 12px; font-size:0.75rem;"><i class="fa-solid fa-calendar-plus"></i> Renew</button>
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
            const ts = row.timestamp ? new Date(row.timestamp).toLocaleString() : "";
            subscriptionTable.insertAdjacentHTML("beforeend", `
              <tr>
                <td>${row.id ?? ""}</td>
                <td>${ts}</td>
                <td>${row.phone ?? ""}</td>
                <td>${row.duration ?? ""}</td>
                <td>${row.accemail ?? ""}</td>
                <td>${row.paid ?? ""}</td>
                <td><button class="pill-btn cancel-anghami-btn" data-id="${row.id}" style="padding:8px 12px; font-size:0.75rem;"><i class="fa-solid fa-xmark"></i> Cancel</button></td>
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
            const ts = row.timestamp ? new Date(row.timestamp).toLocaleString() : "";
            subscriptionTable.insertAdjacentHTML("beforeend", `
              <tr>
                <td>${row.id ?? ""}</td>
                <td>${ts}</td>
                <td>${row.phone ?? ""}</td>
                <td>${row.duration ?? ""}</td>
                <td>${row.accemail ?? ""}</td>
                <td>${row.paid ?? ""}</td>
                <td><button class="pill-btn gpt-cancel-btn" data-id="${row.id}" style="padding:8px 12px; font-size:0.75rem;"><i class="fa-solid fa-xmark"></i> Cancel</button></td>
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
            const expiry = row.expiry ? new Date(row.expiry).toLocaleString() : "";
            const tr = document.createElement("tr");
            tr.innerHTML = `
              <td>${row.phone}</td>
              <td>${row.accemail}</td>
              <td>${row.duration}</td>
              <td>${expiry}</td>`;
            subscriptionTable.appendChild(tr);
          });
        }
      }
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
      fetchSubscriptionsData("pendingpayments");
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
      fetchSubscriptionsData(viewSelector.value);
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
        const resp = await fetch(window.SUPABASE_URL + endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${window.authToken}`
          },
          body: JSON.stringify(body),
        });
        const data = await resp.json();

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
            expiryString = expiryDate.toLocaleDateString('en-GB', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
            });
          } else {
            const expiryDate = new Date();
            expiryDate.setMonth(expiryDate.getMonth() + duration);
            expiryString = expiryDate.toLocaleDateString('en-GB', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
            });
          }
          const btn = document.createElement("button");
          btn.textContent = "Copy ChatGPT Info";
          btn.onclick = async () => {
            await navigator.clipboard.writeText(
              `*email*: ${data.email}\n*password*: ${data.pass}\n*expiry*: ${expiryString}\n\n- when prompted for a code, click "try another method" then select email\n\nplease send code within 15 mins to receive it automatically`
            );
            showMessage("Copied!", "success");
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

    subscriptionTable.addEventListener("click", (e) => {
      if (e.target.classList.contains("mark-paid-btn")) {
        markAsPaid(e.target.dataset.id);
      } else if (e.target.classList.contains("cancel-sub-btn")) {
        openCancelModal(e.target.dataset.id);
      } else if (e.target.classList.contains("placeholder2-btn")) {
        placeholderAction2(e.target.dataset.id);
      } else if (e.target.classList.contains("cancel-anghami-btn")) {
        const payId = Number(e.target.dataset.id);
        if (!payId) return showMessage("Missing pay id", "error");
        openAnghamiCancelModal(payId);
      } else if (e.target.classList.contains("gpt-cancel-btn")) {
        const payId = Number(e.target.dataset.id);
        if (!payId) return showMessage("Missing pay id", "error");
        openGptCancelModal(payId);
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
