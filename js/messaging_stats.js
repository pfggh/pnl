/**
 * Messaging Stats Dashboard Module
 * Visualizes BSB WhatsApp messages, Meta Ad conversations, customer wait times,
 * and continuous minute-by-minute employee productivity graphs in real time.
 */

window.MessagingStats = (() => {
  let uplotChart = null; // High-performance telemetry engine
  let minuteChart = null; // Deprecated Chart.js fallback if uPlot unavailable
  let hourlyChart = null;
  let donutChart = null;
  let currentDate = null;
  let isSyncing = false;
  let pollingTimer = null;
  let isInitialized = false;

  // Modern telemetry & agent filter state
  let rawMinuteData = [];
  let currentWindow = "60"; // '30', '60', '180', 'all'
  let allEmployeesList = [];
  let selectedAgents = new Set(); // Empty or size == all means show all; else only show checked
  let tooltipEl = null;

  const EMPLOYEE_COLORS = {
    "zouzou": { border: "#6366f1", bg: "rgba(99, 102, 241, 0.2)" },
    "bouery": { border: "#a855f7", bg: "rgba(168, 85, 247, 0.2)" },
    "Oliver Nassar": { border: "#10b981", bg: "rgba(16, 185, 129, 0.2)" },
    "ghrayeb": { border: "#f59e0b", bg: "rgba(245, 158, 11, 0.2)" },
    "Jr": { border: "#06b6d4", bg: "rgba(6, 182, 212, 0.2)" },
    "Whatsapp Business App": { border: "#ec4899", bg: "rgba(236, 72, 153, 0.2)" },
    "System": { border: "#94a3b8", bg: "rgba(148, 163, 184, 0.2)" }
  };

  const FALLBACK_PALETTE = [
    "#3b82f6", "#14b8a6", "#f43f5e", "#8b5cf6", "#eab308", "#64748b"
  ];

  function getColorForEmployee(name, index) {
    if (EMPLOYEE_COLORS[name]) return EMPLOYEE_COLORS[name];
    const c = FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
    return { border: c, bg: c + "33" };
  }

  function getBeirutTodayStr() {
    try {
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Beirut",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      });
      return formatter.format(new Date());
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function getBeirutYesterdayStr() {
    try {
      const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Beirut",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      });
      return formatter.format(d);
    } catch {
      const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return d.toISOString().slice(0, 10);
    }
  }

  function getBeirutNowMinute() {
    try {
      const formatter = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Beirut",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
      return formatter.format(new Date());
    } catch {
      const now = new Date();
      return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
  }

  async function getAuthToken() {
    if (window.authToken) return window.authToken;
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    window.authToken = session?.access_token;
    return window.authToken;
  }

  async function fetchStats(dateStr = "") {
    const token = await getAuthToken();
    const queryDate = dateStr || "";

    // 1. Try /functions/v1/dashboard?type=messaging
    try {
      const res = await fetch(`${window.SUPABASE_URL}/functions/v1/dashboard?type=messaging${queryDate ? `&date=${queryDate}` : ""}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "apikey": window.SUPABASE_ANON_KEY
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && !data.error) return data;
      }
    } catch (e) {
      console.warn("Dashboard messaging stats fetch failed, trying status endpoint:", e);
    }

    // 2. Fallback: Try /functions/v1/status?type=messaging
    try {
      const res = await fetch(`${window.SUPABASE_URL}/functions/v1/status?type=messaging${queryDate ? `&date=${queryDate}` : ""}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "apikey": window.SUPABASE_ANON_KEY
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && !data.error) return data;
      }
    } catch (e) {
      console.warn("Status function fetch failed, trying RPC:", e);
    }

    // 3. Direct RPC fallback
    const { data, error } = await window.supabaseClient.rpc("get_messaging_stats", {
      target_date: queryDate || null
    });
    if (error) throw error;
    return data;
  }

  function updateKPIs(data) {
    const totalEl = document.getElementById("msg-kpi-total");
    const incomingSubEl = document.getElementById("msg-kpi-incoming-sub");
    const adsEl = document.getElementById("msg-kpi-ads");
    const adsSubEl = document.getElementById("msg-kpi-ads-sub");
    const waitEl = document.getElementById("msg-kpi-wait");
    const waitSubEl = document.getElementById("msg-kpi-wait-sub");
    const agentsEl = document.getElementById("msg-kpi-agents");
    const agentsSubEl = document.getElementById("msg-kpi-agents-sub");
    const syncTimeEl = document.getElementById("msg-kpi-sync-time");

    if (totalEl) totalEl.textContent = Number(data.messages_today || 0).toLocaleString();
    if (incomingSubEl) {
      incomingSubEl.innerHTML = `
        <span style="color:#10b981"><i class="fa-solid fa-arrow-down"></i> ${Number(data.incoming_today || 0).toLocaleString()} in</span>
        &nbsp;•&nbsp;
        <span style="color:#818cf8"><i class="fa-solid fa-arrow-up"></i> ${Number(data.outgoing_today || 0).toLocaleString()} out</span>
      `;
    }

    if (adsEl) adsEl.textContent = Number(data.messages_ads || 0).toLocaleString();
    if (adsSubEl) adsSubEl.textContent = `${Number(data.messages_ads_total || 0).toLocaleString()} all-time ad chats`;

    if (waitEl) waitEl.textContent = data.average_wait || "0m";
    if (waitSubEl) waitSubEl.textContent = `Median: ${data.median_wait || "0m"} (${Number(data.response_count || 0).toLocaleString()} replies)`;

    const employees = data.employees || [];
    if (agentsEl) agentsEl.textContent = employees.length;
    if (agentsSubEl) {
      const topAgent = employees[0];
      agentsSubEl.textContent = topAgent ? `Top: ${topAgent.employee} (${topAgent.sent_count})` : "No activity recorded";
    }

    if (syncTimeEl && data.last_sync) {
      const syncDate = new Date(data.last_sync);
      // Format in Beirut timezone (+03:00) so it matches the data and live time 100%
      syncTimeEl.textContent = syncDate.toLocaleTimeString("en-GB", {
        timeZone: "Asia/Beirut",
        hour: "2-digit",
        minute: "2-digit"
      });
    }
  }

  function renderAgentPicker(employees, employeeMap) {
    const chipsWrapper = document.getElementById("agent-chips-wrapper");
    if (!chipsWrapper) return;

    // Preserve any existing selections or default to empty (which implies ALL active)
    chipsWrapper.innerHTML = "";

    employees.forEach((emp, idx) => {
      const color = getColorForEmployee(emp, idx);
      const isSelected = selectedAgents.size === 0 || selectedAgents.has(emp);

      // Compute total messages sent by this employee today
      let totalSent = 0;
      if (employeeMap && employeeMap[emp]) {
        totalSent = Object.values(employeeMap[emp]).reduce((a, b) => a + b, 0);
      }

      const chip = document.createElement("div");
      chip.className = `agent-chip ${isSelected ? "active" : ""}`;
      chip.style.setProperty("--chip-color", color.border);
      chip.setAttribute("data-agent", emp);

      chip.innerHTML = `
        <span class="chip-dot"></span>
        <span>${emp}</span>
        <span class="chip-count">${totalSent}</span>
      `;

      chip.addEventListener("click", () => {
        // If clicking on an agent
        if (selectedAgents.size === 0) {
          // Previously all were active -> select ONLY this clicked agent
          selectedAgents.clear();
          selectedAgents.add(emp);
        } else if (selectedAgents.has(emp)) {
          selectedAgents.delete(emp);
          // If none left selected, reset to all
          if (selectedAgents.size === 0) {
            // Keep empty (means all)
          }
        } else {
          selectedAgents.add(emp);
          if (selectedAgents.size === allEmployeesList.length) {
            selectedAgents.clear(); // all selected
          }
        }
        updateAgentChipStates();
        renderMinuteByEmployeeChart();
      });

      chipsWrapper.appendChild(chip);
    });
  }

  function updateAgentChipStates() {
    const chips = document.querySelectorAll(".agent-chip");
    chips.forEach(chip => {
      const agent = chip.getAttribute("data-agent");
      const isSelected = selectedAgents.size === 0 || selectedAgents.has(agent);
      if (isSelected) {
        chip.classList.add("active");
      } else {
        chip.classList.remove("active");
      }
    });
  }

  function renderMinuteByEmployeeChart(minuteData) {
    if (minuteData !== undefined) {
      rawMinuteData = minuteData || [];
    }

    const container = document.getElementById("uplot-chart-container");
    if (!container) return;

    if (!rawMinuteData || rawMinuteData.length === 0) {
      if (uplotChart) {
        uplotChart.destroy();
        uplotChart = null;
      }
      container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:0.9rem;">No minute activity recorded for this period.</div>';
      return;
    }

    // Extract unique employees and recorded minutes
    const employeeSet = new Set();
    const existingMinutes = [];
    rawMinuteData.forEach(item => {
      employeeSet.add(item.employee);
      existingMinutes.push(item.minute);
    });

    const employees = Array.from(employeeSet);
    allEmployeesList = employees;

    // Build data map: employee -> minute -> count
    const employeeMap = {};
    employees.forEach(emp => {
      employeeMap[emp] = {};
    });

    rawMinuteData.forEach(item => {
      if (employeeMap[item.employee]) {
        employeeMap[item.employee][item.minute] = item.count;
      }
    });

    // Update Agent Picker Chips
    renderAgentPicker(employees, employeeMap);

    // Generate unbroken sequence of minutes
    existingMinutes.sort();
    const firstActiveMin = existingMinutes[0] || "00:00";
    let startH = Math.max(0, parseInt(firstActiveMin.split(":")[0], 10));
    let startMinStr = `${String(startH).padStart(2, '0')}:00`;

    let lastActiveMin = existingMinutes[existingMinutes.length - 1] || "23:59";
    const todayBeirut = getBeirutTodayStr();
    const isToday = !currentDate || currentDate === todayBeirut;

    let endMinStr = lastActiveMin;
    if (isToday) {
      const nowMin = getBeirutNowMinute();
      if (nowMin > endMinStr) {
        endMinStr = nowMin;
      }
    }

    let allMinutes = [];
    let [currH, currM] = startMinStr.split(":").map(Number);
    const [targetEndH, targetEndM] = endMinStr.split(":").map(Number);

    while (currH < targetEndH || (currH === targetEndH && currM <= targetEndM)) {
      allMinutes.push(`${String(currH).padStart(2, '0')}:${String(currM).padStart(2, '0')}`);
      currM++;
      if (currM >= 60) {
        currM = 0;
        currH++;
      }
    }

    // Filter by Time Window Preset
    if (currentWindow !== "all") {
      const windowSize = parseInt(currentWindow, 10);
      if (windowSize && allMinutes.length > windowSize) {
        allMinutes = allMinutes.slice(-windowSize);
      }
    }

    // Convert minutes into epoch timestamps (seconds) for uPlot x-axis
    // Use target date or today's date base
    const baseDateStr = currentDate || todayBeirut;
    const timestamps = allMinutes.map(m => {
      const [h, min] = m.split(":").map(Number);
      return Math.floor(new Date(`${baseDateStr}T${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00+03:00`).getTime() / 1000);
    });

    // Determine active visible employees based on Agent Picker
    const visibleEmployees = employees.filter(emp => selectedAgents.size === 0 || selectedAgents.has(emp));

    // Construct columnar data array: [timestamps, employee1_data, employee2_data, ...]
    const uPlotData = [timestamps];
    const seriesConfig = [
      {
        label: "Time",
        value: (self, rawValue) => {
          if (!rawValue) return "";
          const d = new Date(rawValue * 1000);
          return d.toLocaleTimeString("en-GB", { timeZone: "Asia/Beirut", hour: "2-digit", minute: "2-digit" });
        }
      }
    ];

    visibleEmployees.forEach((emp) => {
      const originalIdx = employees.indexOf(emp);
      const color = getColorForEmployee(emp, originalIdx);
      const dataArr = allMinutes.map(m => employeeMap[emp][m] || 0);
      uPlotData.push(dataArr);

      seriesConfig.push({
        label: emp,
        stroke: color.border,
        width: 2,
        fill: color.bg, // uPlot canvas fill is hardware-native & 0-lag
        points: {
          show: false, // Hidden by default for max performance; cursor hover highlights
          size: 6
        },
        spanGaps: true
      });
    });

    // Clean placeholder container
    container.innerHTML = "";

    // Tooltip Element setup
    if (!tooltipEl) {
      tooltipEl = document.createElement("div");
      tooltipEl.className = "uplot-tooltip";
      tooltipEl.style.display = "none";
      document.body.appendChild(tooltipEl);
    }

    const opts = {
      width: container.clientWidth || 900,
      height: 380,
      cursor: {
        drag: { x: true, y: false },
        sync: { key: "msg-sync" },
        points: {
          size: 7,
          fill: (u, seriesIdx) => seriesConfig[seriesIdx].stroke
        }
      },
      select: {
        show: false
      },
      legend: {
        show: false // Our Agent Picker serves as the interactive legend
      },
      hooks: {
        setCursor: [
          (u) => {
            const { left, top, idx } = u.cursor;
            if (idx == null) {
              tooltipEl.style.display = "none";
              return;
            }

            const bbox = u.over.getBoundingClientRect();
            const timeVal = allMinutes[idx] || "";
            let html = `<div class="tt-time"><i class="fa-solid fa-clock"></i> ⏱ ${timeVal} (Beirut)</div>`;
            let total = 0;
            let activeAgentsCount = 0;

            visibleEmployees.forEach((emp, i) => {
              const val = uPlotData[i + 1][idx] || 0;
              if (val > 0) {
                activeAgentsCount++;
                total += val;
                const originalIdx = employees.indexOf(emp);
                const col = getColorForEmployee(emp, originalIdx);
                html += `
                  <div class="tt-row">
                    <span class="tt-dot" style="background:${col.border};box-shadow:0 0 6px ${col.border}"></span>
                    <span class="tt-name">${emp}:</span>
                    <span class="tt-val">${val} msgs</span>
                  </div>
                `;
              }
            });

            if (activeAgentsCount === 0) {
              html += `<div style="color:var(--text-muted);font-size:0.75rem;padding:2px 0;">No messages sent</div>`;
            } else {
              html += `<div style="margin-top:6px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.1);font-weight:700;color:#10b981;display:flex;justify-content:space-between;"><span>Total Sent:</span><span>${total} msgs</span></div>`;
            }

            tooltipEl.innerHTML = html;
            tooltipEl.style.display = "block";

            // Position tooltip relative to viewport
            const ttWidth = tooltipEl.offsetWidth;
            let posX = bbox.left + left + 15;
            if (posX + ttWidth > window.innerWidth - 20) {
              posX = bbox.left + left - ttWidth - 15;
            }
            let posY = bbox.top + top - 30;
            if (posY < 10) posY = bbox.top + top + 20;

            tooltipEl.style.left = `${posX}px`;
            tooltipEl.style.top = `${posY}px`;
          }
        ]
      },
      scales: {
        x: {
          time: true
        },
        y: {
          auto: true,
          range: (u, min, max) => [0, Math.max(5, Math.ceil(max * 1.15))]
        }
      },
      axes: [
        {
          stroke: "#94a3b8",
          grid: { stroke: "rgba(255, 255, 255, 0.04)", width: 1 },
          ticks: { stroke: "rgba(255, 255, 255, 0.08)", width: 1 },
          font: "11px Inter, sans-serif",
          values: (u, vals) => {
            return vals.map(v => {
              const d = new Date(v * 1000);
              return d.toLocaleTimeString("en-GB", { timeZone: "Asia/Beirut", hour: "2-digit", minute: "2-digit" });
            });
          }
        },
        {
          stroke: "#94a3b8",
          grid: { stroke: "rgba(255, 255, 255, 0.04)", width: 1 },
          ticks: { stroke: "rgba(255, 255, 255, 0.08)", width: 1 },
          font: "11px Inter, sans-serif",
          size: 40
        }
      ],
      series: seriesConfig
    };

    if (uplotChart) {
      uplotChart.destroy();
    }
    uplotChart = new uPlot(opts, uPlotData, container);
  }

  function renderHourlyChart(hourlyData) {
    const ctx = document.getElementById("hourly-traffic-chart");
    if (!ctx) return;

    if (!hourlyData || hourlyData.length === 0) {
      if (hourlyChart) {
        hourlyChart.destroy();
        hourlyChart = null;
      }
      return;
    }

    const labels = hourlyData.map(h => h.hour);
    const incomingData = hourlyData.map(h => h.incoming || 0);
    const outgoingData = hourlyData.map(h => h.outgoing || 0);

    const datasets = [
      {
        label: "Incoming (Customer)",
        data: incomingData,
        backgroundColor: "rgba(16, 185, 129, 0.7)",
        borderColor: "#10b981",
        borderWidth: 1,
        borderRadius: 4
      },
      {
        label: "Outgoing (Agents)",
        data: outgoingData,
        backgroundColor: "rgba(99, 102, 241, 0.7)",
        borderColor: "#6366f1",
        borderWidth: 1,
        borderRadius: 4
      }
    ];

    if (hourlyChart) {
      hourlyChart.data.labels = labels;
      hourlyChart.data.datasets = datasets;
      hourlyChart.update("none");
      return;
    }

    hourlyChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {
            position: "top",
            labels: { color: "#cbd5e1", font: { family: "Inter", size: 11 } }
          },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.95)",
            titleColor: "#f8fafc",
            bodyColor: "#cbd5e1",
            borderColor: "rgba(255, 255, 255, 0.1)",
            borderWidth: 1
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: "#94a3b8", font: { size: 10 } }
          },
          y: {
            beginAtZero: true,
            grid: { color: "rgba(255, 255, 255, 0.05)" },
            ticks: { color: "#94a3b8", precision: 0, font: { size: 10 } }
          }
        }
      }
    });
  }

  function renderDonutChart(employees) {
    const ctx = document.getElementById("employee-donut-chart");
    if (!ctx) return;

    if (!employees || employees.length === 0) {
      if (donutChart) {
        donutChart.destroy();
        donutChart = null;
      }
      return;
    }

    const labels = employees.map(e => e.employee);
    const data = employees.map(e => e.sent_count);
    const colors = employees.map((e, idx) => getColorForEmployee(e.employee, idx).border);

    const datasets = [{
      data: data,
      backgroundColor: colors,
      borderColor: "#0f172a",
      borderWidth: 2
    }];

    if (donutChart) {
      donutChart.data.labels = labels;
      donutChart.data.datasets = datasets;
      donutChart.update("none");
      return;
    }

    donutChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {
            position: "right",
            labels: {
              color: "#cbd5e1",
              font: { family: "Inter", size: 11 },
              boxWidth: 12,
              padding: 10
            }
          }
        },
        cutout: "68%"
      }
    });
  }

  function renderEmployeeTable(employees) {
    const tbody = document.getElementById("employee-breakdown-tbody");
    if (!tbody) return;

    if (!employees || employees.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--text-muted); padding: 20px;">No outgoing message activity for this date.</td></tr>`;
      return;
    }

    const totalSent = employees.reduce((sum, e) => sum + Number(e.sent_count), 0);

    let html = "";
    employees.forEach((emp, idx) => {
      const count = Number(emp.sent_count);
      const pct = totalSent > 0 ? ((count / totalSent) * 100).toFixed(1) : "0.0";
      const color = getColorForEmployee(emp.employee, idx);

      html += `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
          <td style="padding: 12px 14px; font-weight: 500; display: flex; align-items: center; gap: 8px;">
            <span style="width: 10px; height: 10px; border-radius: 50%; background: ${color.border}; display: inline-block;"></span>
            ${emp.employee}
          </td>
          <td style="padding: 12px 14px; font-weight: 600; color: #f8fafc;">${count.toLocaleString()}</td>
          <td style="padding: 12px 14px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="flex: 1; height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden; max-width: 120px;">
                <div style="width: ${pct}%; height: 100%; background: ${color.border}; border-radius: 3px;"></div>
              </div>
              <span style="color: var(--text-muted); font-size: 0.85rem;">${pct}%</span>
            </div>
          </td>
          <td style="padding: 12px 14px;">
            <span class="badge" style="background: rgba(16,185,129,0.15); color: #10b981; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem;">
              <i class="fa-solid fa-check"></i> Active
            </span>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  function renderTopAds(topAds) {
    const container = document.getElementById("top-ads-list");
    if (!container) return;

    if (!topAds || topAds.length === 0) {
      container.innerHTML = `<div style="color: var(--text-muted); text-align: center; padding: 15px;">No ad tracking messages detected for this date.</div>`;
      return;
    }

    let html = "";
    topAds.forEach((ad, idx) => {
      html += `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: rgba(255,255,255,0.02); border-radius: 10px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 10px; overflow: hidden;">
            <span style="color: #6366f1; font-weight: 700; font-size: 0.85rem;">#${idx + 1}</span>
            <span style="color: #f8fafc; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 280px;" title="${ad.title}">
              ${ad.title}
            </span>
          </div>
          <span style="background: rgba(99,102,241,0.15); color: #818cf8; padding: 3px 8px; border-radius: 6px; font-weight: 600; font-size: 0.8rem;">
            ${Number(ad.count).toLocaleString()} chats
          </span>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  async function syncBSBNow() {
    if (isSyncing) return;
    isSyncing = true;

    const btn = document.getElementById("msg-sync-now-btn");
    const originalHtml = btn ? btn.innerHTML : "";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Syncing BSB...`;
    }

    try {
      const token = await getAuthToken();
      const res = await fetch(`${window.SUPABASE_URL}/functions/v1/sync_bsb`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "apikey": window.SUPABASE_ANON_KEY
        },
        body: JSON.stringify({})
      });

      const json = await res.json();
      console.log("BSB sync response:", json);

      // Auto reload current stats
      await loadStats(currentDate);
    } catch (err) {
      console.error("BSB sync trigger error:", err);
      alert("Sync failed: " + (err.message || String(err)));
    } finally {
      isSyncing = false;
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
      }
    }
  }

  async function loadStats(dateStr = "", isSilent = false) {
    const loadingOverlay = document.getElementById("msg-stats-loading");
    if (loadingOverlay && !isSilent) loadingOverlay.style.display = "flex";

    try {
      currentDate = dateStr;
      const data = await fetchStats(dateStr);

      updateKPIs(data);
      renderMinuteByEmployeeChart(data.minute_by_employee || []);
      renderHourlyChart(data.hourly || []);
      renderDonutChart(data.employees || []);
      renderEmployeeTable(data.employees || []);
      renderTopAds(data.top_ads || []);

      const datePicker = document.getElementById("msg-date-picker");
      if (datePicker && data.date) {
        datePicker.value = data.date;
      }
    } catch (err) {
      console.error("Error loading messaging stats:", err);
    } finally {
      if (loadingOverlay && !isSilent) loadingOverlay.style.display = "none";
    }
  }

  function startLivePolling() {
    stopLivePolling();
    // Live poll stats every 20 seconds so graph is ALWAYS 100% in sync with real time
    pollingTimer = setInterval(() => {
      if (document.hidden) return;
      const statsPage = document.getElementById("messaging-stats-page");
      if (!statsPage || !statsPage.classList.contains("active")) return;

      const datePicker = document.getElementById("msg-date-picker");
      const todayStr = getBeirutTodayStr();
      const isToday = !datePicker || !datePicker.value || datePicker.value === todayStr;

      if (isToday) {
        loadStats(currentDate, true); // silent background reload
      }
    }, 20000);
  }

  function stopLivePolling() {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
  }

  function init() {
    startLivePolling();

    if (isInitialized) {
      // If already initialized, just reload stats for current view
      loadStats(currentDate);
      return;
    }
    isInitialized = true;

    const datePicker = document.getElementById("msg-date-picker");
    const refreshBtn = document.getElementById("msg-refresh-btn");
    const syncBtn = document.getElementById("msg-sync-now-btn");
    const todayQuickBtn = document.getElementById("msg-quick-today");
    const yesterdayQuickBtn = document.getElementById("msg-quick-yesterday");

    if (datePicker) {
      datePicker.addEventListener("change", (e) => {
        loadStats(e.target.value);
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        const d = datePicker ? datePicker.value : "";
        loadStats(d);
      });
    }

    if (syncBtn) {
      syncBtn.addEventListener("click", () => {
        syncBSBNow();
      });
    }

    if (todayQuickBtn) {
      todayQuickBtn.addEventListener("click", () => {
        const today = getBeirutTodayStr();
        if (datePicker) datePicker.value = today;
        loadStats(today);
      });
    }

    if (yesterdayQuickBtn) {
      yesterdayQuickBtn.addEventListener("click", () => {
        const yest = getBeirutYesterdayStr();
        if (datePicker) datePicker.value = yest;
        loadStats(yest);
      });
    }

    // Set initial date picker value to Beirut today
    if (datePicker && !datePicker.value) {
      datePicker.value = getBeirutTodayStr();
    }

    // Modern Minute Graph Controls & Scroll Listeners
    setupMinuteGraphControls();

    loadStats();
  }

  function setupMinuteGraphControls() {
    const zoomInBtn = document.getElementById("chart-zoom-in-btn");
    const zoomOutBtn = document.getElementById("chart-zoom-out-btn");
    const scrollNowBtn = document.getElementById("chart-scroll-now-btn");
    const windowPills = document.querySelectorAll(".chart-window-pill");
    const selectAllBtn = document.getElementById("agent-picker-all-btn");
    const clearBtn = document.getElementById("agent-picker-none-btn");

    // Agent Picker quick links
    if (selectAllBtn) {
      selectAllBtn.addEventListener("click", () => {
        selectedAgents.clear(); // Empty set represents all active
        updateAgentChipStates();
        renderMinuteByEmployeeChart();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        // When cleared, select the top agent only so the graph is never blank
        if (allEmployeesList.length > 0) {
          selectedAgents.clear();
          selectedAgents.add(allEmployeesList[0]);
        }
        updateAgentChipStates();
        renderMinuteByEmployeeChart();
      });
    }

    // Window preset buttons (30m, 1h, 3h, All Day)
    windowPills.forEach(pill => {
      pill.addEventListener("click", () => {
        windowPills.forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        currentWindow = pill.getAttribute("data-window") || "all";
        renderMinuteByEmployeeChart();
      });
    });

    // Zoom In: zoom in on active view
    if (zoomInBtn) {
      zoomInBtn.addEventListener("click", () => {
        if (!uplotChart) return;
        const [min, max] = [uplotChart.scales.x.min, uplotChart.scales.x.max];
        const range = max - min;
        if (range > 300) { // minimum 5 mins
          const newMin = min + range * 0.2;
          const newMax = max - range * 0.2;
          uplotChart.setScale("x", { min: newMin, max: newMax });
        }
      });
    }

    // Zoom Out: zoom out on active view
    if (zoomOutBtn) {
      zoomOutBtn.addEventListener("click", () => {
        if (!uplotChart) return;
        const [min, max] = [uplotChart.scales.x.min, uplotChart.scales.x.max];
        const range = max - min;
        const newMin = min - range * 0.25;
        const newMax = max + range * 0.25;
        uplotChart.setScale("x", { min: newMin, max: newMax });
      });
    }

    // Jump to latest activity button
    if (scrollNowBtn) {
      scrollNowBtn.addEventListener("click", () => {
        if (currentWindow !== "60") {
          currentWindow = "60";
          windowPills.forEach(p => {
            if (p.getAttribute("data-window") === "60") p.classList.add("active");
            else p.classList.remove("active");
          });
        }
        renderMinuteByEmployeeChart();
      });
    }

    // Auto-resize uPlot on window resize
    window.addEventListener("resize", () => {
      const container = document.getElementById("uplot-chart-container");
      if (container && uplotChart) {
        uplotChart.setSize({
          width: container.clientWidth || 900,
          height: 380
        });
      }
    });
  }

  return {
    init,
    loadStats,
    syncBSBNow,
    startLivePolling,
    stopLivePolling
  };
})();
