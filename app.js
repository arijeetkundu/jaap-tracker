// Initialize DB with latest schema
const db = new Dexie("JaapLedgerDB");
db.version(1).stores({
  ledger: "date, jaapCount, notes, year",
  milestones: "milestone, date",
  settings: "key"
});

// Helper: Update entry in DB and refresh UI
async function updateEntry(date, count, notes, year) {
  try {
    await db.ledger.put({ date, jaapCount: count, notes, year });
    await updateReflection();
    await updateLedger();

    const today = new Date().toISOString().split("T")[0];
    if (date === today) {
      document.getElementById("jaap-count").value = count;
      document.getElementById("notes").value = notes;
    }
  } catch (err) {
    console.error("Error updating entry:", err);
    alert("Failed to update entry. Please try again.");
  }
}

async function seedBaseline(count) {
  try {
    await db.settings.put({ key: "baseline", value: count });
    await updateReflection();
  } catch (err) {
    console.error("Error seeding baseline:", err);
    alert("Failed to set baseline. Please try again.");
  }
}
// Splash Screen
window.onload = () => {
  setTimeout(() => {
    document.getElementById("splash").style.display = "none";
    document.getElementById("main").style.display = "block";
    loadToday();
    updateReflection();
    updateLedger();
  }, 2000);
};

// Load Today’s Date
function loadToday() {
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("today-date").innerText = today;
}

// Save/Update Today Card
document.getElementById("save-btn").addEventListener("click", async () => {
  const date = new Date().toISOString().split("T")[0];
  const count = parseInt(document.getElementById("jaap-count").value) || 0;
  const notes = document.getElementById("notes").value;
  const year = new Date().getFullYear();

  await updateEntry(date, count, notes, year);
});

// Reflection Card
async function updateReflection() {
  try {
    const allEntries = await db.ledger.toArray();
    const baselineEntry = await db.settings.get("baseline");
    const baseline = baselineEntry ? baselineEntry.value : 0;

    const lifetime = baseline + allEntries.reduce((sum, e) => sum + e.jaapCount, 0);

    const currentYear = new Date().getFullYear();
    const yearEntries = allEntries.filter(e => e.year === currentYear);
    const yearTotal = yearEntries.reduce((sum, e) => sum + e.jaapCount, 0);

    const crore = 10000000;
    const milestonesAchieved = Math.floor(lifetime / crore);
    const nextMilestone = (milestonesAchieved + 1) * crore;
    const percent = ((lifetime - milestonesAchieved * crore) / crore) * 100;

    document.getElementById("yearTotal").innerText = yearTotal;
    document.getElementById("lifetimeTotal").innerText = lifetime;
    document.getElementById("nextMilestone").innerText = `${nextMilestone} (${percent.toFixed(2)}%)`;

    // Milestone tracking
    const milestoneStore = db.milestones;
    const existingMilestones = await milestoneStore.toArray();
    const existingValues = existingMilestones.map(m => m.milestone);

    for (let i = 1; i <= milestonesAchieved; i++) {
      const milestoneValue = i * crore;
      if (!existingValues.includes(milestoneValue)) {
        let cumulative = baseline;
        for (const entry of allEntries.sort((a, b) => new Date(a.date) - new Date(b.date))) {
          cumulative += entry.jaapCount;
          if (cumulative >= milestoneValue) {
            await milestoneStore.put({ milestone: milestoneValue, date: entry.date });
            break;
          }
        }
      }
    }

    // Show milestones list
    const milestoneDiv = document.getElementById("milestones");
    milestoneDiv.innerHTML = "";
    const milestones = await milestoneStore.orderBy("milestone").toArray();
    milestones.forEach(m => {
      const d = new Date(m.date);
      const formatted = `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;
      const p = document.createElement("p");
      p.innerText = `${m.milestone/crore} crore - ${formatted}`;
      milestoneDiv.appendChild(p);
    });

    // Progress bar
    document.getElementById("progress-bar").style.width = `${percent}%`;
    document.getElementById("progress-text").innerText = `Progress: ${percent.toFixed(2)}% towards ${nextMilestone}`;
  } catch (err) {
    console.error("Error updating reflection:", err);
    alert("Failed to update reflection. Please try again.");
  }
}

// Ledger
async function updateLedger() {
  try {
    const entries = await db.ledger.orderBy("date").reverse().toArray();
    const ledgerDiv = document.getElementById("ledger-content");
    ledgerDiv.innerHTML = "";

    const grouped = {};
    entries.forEach(e => {
      if (!grouped[e.year]) grouped[e.year] = [];
      grouped[e.year].push(e);
    });

    Object.keys(grouped).sort((a, b) => b - a).forEach(year => {
      const yearSection = document.createElement("details");
      yearSection.open = (parseInt(year) === new Date().getFullYear());
      const summary = document.createElement("summary");
      summary.innerText = year;
      yearSection.appendChild(summary);

      grouped[year].forEach(entry => {
        const dateDetails = document.createElement("details");
        dateDetails.open = false;
        const dateSummary = document.createElement("summary");
        dateSummary.innerText = `${entry.date} - ${entry.jaapCount}`;
        dateDetails.appendChild(dateSummary);

        const content = document.createElement("div");
		content.classList.add("ledger-row-content");
        const today = new Date();
        const entryDate = new Date(entry.date);
        const todayMidnight = new Date(today.toDateString());
        const entryMidnight = new Date(entryDate.toDateString());
        const diffDays = Math.floor((todayMidnight - entryMidnight) / (1000 * 60 * 60 * 24));
     
        if (diffDays <= 7) {
          const input = document.createElement("input");
          input.type = "number";
          input.value = entry.jaapCount;
          const notes = document.createElement("textarea");
          notes.value = entry.notes || "";
          const btn = document.createElement("button");
          btn.innerText = "Update";
          btn.onclick = async () => {
            try {
              await updateEntry(entry.date, parseInt(input.value), notes.value, entry.year);
            } catch (err) {
              console.error("Error updating ledger entry:", err);
              alert("Failed to update ledger entry.");
            }
          };
          content.appendChild(input);
          content.appendChild(notes);
          content.appendChild(btn);
        } else {
          content.innerHTML = `<p>Jaap Count: ${entry.jaapCount}</p><p>Notes: ${entry.notes || ""}</p>`;
        }

        dateDetails.appendChild(content);
        yearSection.appendChild(dateDetails);
      });

      ledgerDiv.appendChild(yearSection);
    });
  } catch (err) {
    console.error("Error updating ledger:", err);
    alert("Failed to update ledger. Please try again.");
  }
}

// Open dialog
document.getElementById("open-seed-dialog").addEventListener("click", () => {
  document.getElementById("seed-dialog").style.display = "block";
});

// Close dialog
document.getElementById("close-seed-dialog").addEventListener("click", () => {
  document.getElementById("seed-dialog").style.display = "none";
});

// Add another milestone input row
document.getElementById("add-milestone").addEventListener("click", () => {
  const container = document.getElementById("milestone-inputs");
  const div = document.createElement("div");
  div.innerHTML = `
    <input type="number" class="milestone-crore" placeholder="Crore number (e.g. 2)">
    <input type="text" class="milestone-date" placeholder="DD-MM-YYYY">
  `;
  container.appendChild(div);
});

// Save baseline + milestones
document.getElementById("save-seed").addEventListener("click", async () => {
  try {
    const baseline = parseInt(document.getElementById("seed-baseline").value) || 0;
    if (baseline > 0) {
      await db.settings.put({ key: "baseline", value: baseline });
    }

    const crore = 10000000;
    const milestoneInputs = document.querySelectorAll("#milestone-inputs div");
    for (const div of milestoneInputs) {
      const croreNum = parseInt(div.querySelector(".milestone-crore").value);
      const dateStr = div.querySelector(".milestone-date").value.trim();
      if (croreNum && dateStr) {
        // Convert DD-MM-YYYY → YYYY-MM-DD
        const [day, month, year] = dateStr.split("-");
        const isoDate = `${year}-${month}-${day}`;
        const milestoneValue = croreNum * crore;
        await db.milestones.put({ milestone: milestoneValue, date: isoDate });
      }
    }

    await updateReflection();
    document.getElementById("seed-dialog").style.display = "none";
  } catch (err) {
    console.error("Error saving baseline/milestones:", err);
    alert("Failed to save baseline/milestones. See console for details.");
  }
});