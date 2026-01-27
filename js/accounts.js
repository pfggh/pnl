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

    // Helper functions for UI feedback
    const showSpinnerAccs = (show = true) => {
      spinnerAccs.style.display = show ? "block" : "none";
    };
    const showMessageAccs = (text, type = "success") => {
      messageBoxAccs.textContent = text;
      messageBoxAccs.className = "message-box " + type;
      messageBoxAccs.style.display = "block";
    };
    const clearMessageAccs = () => {
      messageBoxAccs.textContent = "";
      messageBoxAccs.className = "message-box";
      messageBoxAccs.style.display = "none";
    };

    function toggleAnghamiLinks() {
      if (accService.value === "Anghami") {
        anghamiLinksDiv.style.display = "block";
      } else {
        anghamiLinksDiv.style.display = "none";
        linkInputs.forEach(input => input.value = "");
      }
    }

    // Ensure it triggers on selection changes
    accService.addEventListener("change", toggleAnghamiLinks);

    // Initialize correctly on page load
    document.addEventListener("DOMContentLoaded", () => {
      toggleAnghamiLinks();
    });

    // Mark an issue as fixed
    const markAsFixed = async (id) => {
      clearMessageAccs();
      showSpinnerAccs(true);
      try {
        const response = await fetch(window.SUPABASE_URL + "/functions/v1/markasfixed", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${window.authToken}`
          },
          body: JSON.stringify({ id })
        });
        const json = await response.json();
        if (json.error) throw new Error(json.error);
        if (json.success) {
          showMessageAccs(`Issue #${id} marked as fixed!`, "success");
          fetchAccountsOrIssues(accountsViewSelector.value);
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
        const response = await fetch(window.SUPABASE_URL + "/functions/v1/delete_acc", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${window.authToken}`
          },
          body: JSON.stringify({ email })
        });
        const json = await response.json();
        if (json.error) throw new Error(json.error);
        if (json.success) {
          showMessageAccs(`Account ${email} deleted!`, "success");
          fetchAccountsOrIssues(accountsViewSelector.value);
        }
      } catch (err) {
        console.error("Error deleting account:", err);
        showMessageAccs("Error deleting account.", "error");
      } finally {
        showSpinnerAccs(false);
      }
    };

    // Fetch and render accounts or issues based on selected action
    const fetchAccountsOrIssues = async (action) => {
      clearMessageAccs();
      showSpinnerAccs(true);
      accountsIssuesTableHead.innerHTML = "";
      accountsIssuesTableBody.innerHTML = "";
      try {
        const response = await fetch(window.SUPABASE_URL + "/functions/v1/fetchpendingpayment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${window.authToken}`
          },
          body: JSON.stringify({ action })
        });
        const json = await response.json();
        if (json.error) throw new Error(json.error);

        if (action === "accs") {
          // All Accounts list
          accountsIssuesTitle.textContent = "All Accounts";
          const accs = json.accs || [];
          accountsIssuesTableHead.innerHTML = `
            <tr>
              <th>Email</th>
              <th>Password</th>
              <th>Uses</th>
            </tr>`;
          if (accs.length === 0) {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td colspan="3" style="text-align:center;">No accounts found.</td>`;
            accountsIssuesTableBody.appendChild(tr);
          } else {
            accs.forEach((row) => {
              const tr = document.createElement("tr");
              tr.innerHTML = `
                <td>${row.email}</td>
                <td>${row.pass || ""}</td>
                <td>${row.uses ?? 0}</td>`;
              accountsIssuesTableBody.appendChild(tr);
            });
          }
        } else if (action === "fetchissues" || action === "fetchunfixed") {
          // Issues list (all or unsolved)
          const isAll = action === "fetchissues";
          accountsIssuesTitle.textContent = isAll ? "All Issues" : "Unsolved Issues";
          const dataKey = isAll ? "issues" : "unfixed";
          const issues = json[dataKey] || [];
          accountsIssuesTableHead.innerHTML = `
            <tr>
              <th>ID</th>
              <th>Acc Email</th>
              <th>Solved?</th>
              <th>Used</th>
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
                // If account was used (issue fixed), allow marking as fixed
                actionBtnHtml = `<button class="mark-fixed-btn" data-id="${row.id}">Mark as Fixed</button>`;
              } else {
                // If account not used, allow deletion
                actionBtnHtml = `<button class="delete-acc-btn" data-email="${row.accemail}">Delete Account</button>`;
              }
              const tr = document.createElement("tr");
              tr.innerHTML = `
                <td>${row.id}</td>
                <td>${row.accemail}</td>
                <td>${solvedText}</td>
                <td>${row.used}</td>
                <td>${actionBtnHtml}</td>`;
              accountsIssuesTableBody.appendChild(tr);
            });
          }
        }
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
      addAccForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        clearMessageAccs();
        showSpinnerAccs(true);
        addAccBtn.disabled = true;

        const emailValue = accEmail.value.trim();
        const passValue = accPass.value.trim();
        const serviceValue = accService.value;

        const links = [link1El, link2El, link3El, link4El, link5El].map(el => el.value.trim());

        if (serviceValue === "Anghami" && links.some(link => !link)) {
          showMessageAccs("All five Anghami links are required.", "error");
          showSpinnerAccs(false);
          addAccBtn.disabled = false;
          return;
        }

        // Determine endpoint and payload based on serviceValue
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
          const response = await fetch(window.SUPABASE_URL + url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${window.authToken}`
            },
            body: JSON.stringify(payload)
          });

          const data = await response.json();
          if (!response.ok || data.error) throw new Error(data.error || "Unknown error");

          showMessageAccs("Account added successfully!", "success");
          addAccForm.reset();
          fetchAccountsOrIssues("accs");
        } catch (err) {
          showMessageAccs(`Error: ${err.message}`, "error");
        } finally {
          showSpinnerAccs(false);
          addAccBtn.disabled = false;
        }
      });

      // Fix: Ensure fetchAccountsOrIssues runs on selector change
      accountsViewSelector.addEventListener("change", (e) => {
        fetchAccountsOrIssues(accountsViewSelector.value);
      });

      // Also, fetch the default view on init
      fetchAccountsOrIssues(accountsViewSelector.value);
    };

    // Expose module methods
    return {
      showSpinnerAccs,
      showMessageAccs,
      clearMessageAccs,
      fetchAccountsOrIssues,
      markAsFixed,
      deleteAcc,
      init
    };
  })();