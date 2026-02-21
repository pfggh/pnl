document.addEventListener("DOMContentLoaded", async () => {
  // Ensure a valid session (if not, redirect to login)
  const { data: { session } } = await window.supabaseClient.auth.getSession();
  window.authToken = session?.access_token;
  if (!window.authToken) {
    window.location.href = "index.html";
    return;
  }

  // Navigation elements
  const subscriptionsLink = document.getElementById("subscriptions-link");
  const accountsLink = document.getElementById("accounts-link");
  const logoutButton = document.getElementById("logout");
  const teamsLink = document.getElementById("teams-link"); // New

  // Helper to switch visible page
  const showPage = (pageId) => {
    // Pages
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    document.getElementById(pageId).classList.add("active");

    // Sidebar Links
    document.querySelectorAll(".sidebar nav ul li a").forEach(a => a.classList.remove("active"));
    if (pageId === "subscriptions-page") subscriptionsLink?.classList.add("active");
    if (pageId === "accounts-page") accountsLink?.classList.add("active");
    if (pageId === "teams-page") teamsLink?.classList.add("active");

    window.scrollTo(0, 0);
  };

  // Sidebar link events
  subscriptionsLink.addEventListener("click", (e) => {
    e.preventDefault();
    showPage("subscriptions-page");
  });

  accountsLink.addEventListener("click", (e) => {
    e.preventDefault();
    showPage("accounts-page");
    const currentAction = document.getElementById("accounts-view-selector").value;
    window.Accounts.fetchAccountsOrIssues(currentAction);
  });

  // Logout button event
  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      window.Subscriptions.clearMessage();
      await window.supabaseClient.auth.signOut();
      window.location.href = "/";
    });
  }

  if (teamsLink) {
    teamsLink.addEventListener("click", (e) => {
      e.preventDefault();
      showPage("teams-page");
      // Initialize/Refresh teams data when tab is clicked
      if (window.Teams) window.Teams.init();
    });
  }

  // Initial state
  if (subscriptionsLink) subscriptionsLink.classList.add("active");

  // Initialize page modules
  // window.Subscriptions.init(); // Handled by subscriptions.js listener
  // window.Accounts.init(); // Handled by accounts.js listener

  // Initial data load - REMOVED to prevent auto-loading "pendingpayments"
  // await window.Subscriptions.fetchSubscriptionsData("pendingpayments");

  // Sorting logic (Event delegation fix)
  document.querySelector('.table-container').addEventListener('click', (e) => {
    const btn = e.target.closest('.sort-btn');
    if (!btn) return;

    const table = btn.closest('table');
    const tbody = table.querySelector('tbody');
    const column = parseInt(btn.getAttribute('data-column'), 10);
    const asc = btn.asc = !btn.asc;

    const getCellValue = (tr, idx) => tr.children[idx].innerText || tr.children[idx].textContent;

    const comparer = (idx, asc) => (a, b) => ((v1, v2) =>
      v1 !== '' && v2 !== '' && !isNaN(v1) && !isNaN(v2)
        ? v1 - v2
        : v1.toString().localeCompare(v2)
    )(getCellValue(asc ? a : b, idx), getCellValue(asc ? b : a, idx));

    Array.from(tbody.querySelectorAll('tr'))
      .sort(comparer(column, asc))
      .forEach(tr => tbody.appendChild(tr));

    document.querySelectorAll('.sort-btn').forEach(b => b.textContent = '↕️');
    btn.textContent = asc ? '🔼' : '🔽';
  });
  // ... (inside the document.DOMContentLoaded script context of panel.html)

  // Reuse the global modal elements and currentPayId as defined for cancellation:
  let currentPayId = null;
  const cancelModal = document.getElementById("cancel-modal");
  const modalContent = document.getElementById("modal-content");

  // Function to open the extend modal for a given pay ID
  window.openExtendModal = function (payId) {
    currentPayId = payId;
    showExtendPrompt();
    cancelModal.style.display = "flex";  // display the modal overlay
  };

  function showExtendPrompt() {
    // Set modal inner HTML to prompt for extension duration
    modalContent.innerHTML = `
      <p style="font-weight:bold;text-align:center">Select extension duration</p>
      <select id="extend-months" style="display:block;margin:20px auto;">
        <option value="1">1 month</option>
        <option value="3">3 months</option>
        <option value="6">6 months</option>
        <option value="12">12 months</option>
      </select>
      <div style="display:flex;justify-content:center;gap:12px;margin-top:20px">
        <button id="extend-cancel-btn">Cancel</button>
        <button id="extend-confirm-btn" class="pill-btn" style="background:var(--primary)"><i class="fa-solid fa-calendar-plus" style="color:#fff"></i> Extend</button>
      </div>
    `;
    // Attach button handlers
    document.getElementById("extend-cancel-btn").onclick = () => {
      cancelModal.style.display = "none";
    };
    document.getElementById("extend-confirm-btn").onclick = confirmExtend;
  }

  async function confirmExtend() {
    const monthsSelect = document.getElementById("extend-months");
    const monthsValue = monthsSelect ? parseInt(monthsSelect.value, 10) : NaN;
    if (!monthsValue || ![1, 3, 6, 12].includes(monthsValue)) {
      alert("Please select a valid duration.");
      return;
    }
    // Confirm action (optional prompt)
    if (!confirm(`Confirm extend by ${monthsValue} month(s)?`)) return;

    // Call the extendnf Edge Function
    try {
      const supabaseUrl = window.SUPABASE_URL;
      const jwt = (await supabaseClient.auth.getSession()).data.session.access_token;
      const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${jwt}` };
      const response = await fetch(`${supabaseUrl}/functions/v1/extendnf`, {
        method: "POST",
        headers,
        body: JSON.stringify({ id: currentPayId, months: monthsValue })
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error || "Extension failed.");
      }
      // Success – update modal content with confirmation message
      modalContent.innerHTML = `
        <p style="color:#16a34a;font-weight:bold;text-align:center;">
          Subscription extended by ${monthsValue} month(s) successfully!
        </p>
        <div style="display:flex;justify-content:center;margin-top:16px">
          <button id="extend-close" class="pill-btn" style="background:var(--primary)"><i class="fa-solid fa-check" style="color:#fff"></i> Done</button>
        </div>
      `;
      document.getElementById("extend-close").onclick = () => {
        cancelModal.style.display = "none";
      };
      // Refresh the data to reflect changes in the table
      const viewSelector = document.getElementById("view-selector");
      if (viewSelector && viewSelector.value) {
        window.Subscriptions.fetchSubscriptionsData(viewSelector.value);
      }
    } catch (err) {
      console.error("Error extending subscription:", err);
      cancelModal.style.display = "none";
    }
  }

});
