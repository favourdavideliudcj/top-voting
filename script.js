// ==========================================
// 1. INITIAL DATA & STATE MANAGEMENT
// ==========================================
const DEFAULT_VOTERS = {
    "12345678": { name: "Wanjiku Kamau", age: 28, county: "Nairobi", voted: false },
    "23456789": { name: "Otieno Ochieng", age: 34, county: "Homa Bay", voted: false },
    "34567890": { name: "Amina Hassan", age: 22, county: "Mombasa", voted: false },
    "45678901": { name: "Kiprop Bett", age: 45, county: "Uasin Gishu", voted: false },
    "56789012": { name: "Mutua Musyoka", age: 17, county: "Machakos", voted: false }
  };
  
  const BALLOT_STRUCTURE = [
    {
      seat: "President",
      candidates: [
        { id: "pres_1", name: "Hon. Juma Mwangi", party: "Umoja Alliance", symbol: "🦁" },
        { id: "pres_2", name: "Dr. Achieng Odhiambo", party: "Mwananchi Party", symbol: "🌾" },
        { id: "pres_3", name: "Prof. Kipkorir Ruto", party: "Maendeleo Front", symbol: "🏔️" }
      ]
    },
    {
      seat: "Governor",
      candidates: [
        { id: "gov_1", name: "Sarah Njoroge", party: "Umoja Alliance", symbol: "🦁" },
        { id: "gov_2", name: "David Onyango", party: "Mwananchi Party", symbol: "🌾" }
      ]
    },
    {
      seat: "Senator",
      candidates: [
        { id: "sen_1", name: "fatuma Mohamed", party: "Umoja Alliance", symbol: "🦁" },
        { id: "sen_2", name: "Peter Karanja", party: "Mwananchi Party", symbol: "🌾" }
      ]
    },
    {
      seat: "Woman Representative",
      candidates: [
        { id: "wrep_1", name: "Grace Wambui", party: "Umoja Alliance", symbol: "🦁" },
        { id: "wrep_2", name: "Mercy Akinyi", party: "Mwananchi Party", symbol: "🌾" }
      ]
    },
    {
      seat: "Member of Parliament (MP)",
      candidates: [
        { id: "mp_1", name: "Samuel Mutisya", party: "Umoja Alliance", symbol: "🦁" },
        { id: "mp_2", name: "Esther Chebet", party: "Mwananchi Party", symbol: "🌾" }
      ]
    },
    {
      seat: "Member of County Assembly (MCA)",
      candidates: [
        { id: "mca_1", name: "Brian Omondi", party: "Umoja Alliance", symbol: "🦁" },
        { id: "mca_2", name: "Zainab Ali", party: "Mwananchi Party", symbol: "🌾" }
      ]
    }
  ];
  
  // Load from localStorage or initialize defaults
  let voters = JSON.parse(localStorage.getItem("ke_voters")) || structuredClone(DEFAULT_VOTERS);
  let tally = JSON.parse(localStorage.getItem("ke_tally")) || initializeEmptyTally();
  
  // Active voting session state
  let currentVoterId = null;
  let currentStepIndex = 0;
  let currentSelections = {}; // { "President": { id, name, party } }
  
  function initializeEmptyTally() {
    const empty = {};
    BALLOT_STRUCTURE.forEach(item => {
      empty[item.seat] = { spoilt: 0 };
      item.candidates.forEach(c => {
        empty[item.seat][c.name] = 0;
      });
    });
    return empty;
  }
  
  function saveState() {
    localStorage.setItem("ke_voters", JSON.stringify(voters));
    localStorage.setItem("ke_tally", JSON.stringify(tally));
  }
  
  // ==========================================
  // 2. DOM ELEMENTS & NAVIGATION
  // ==========================================
  const toastEl = document.getElementById("toast");
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");
  
  function showToast(message, type = "success") {
    toastEl.textContent = message;
    toastEl.className = `toast ${type}`;
    setTimeout(() => {
      toastEl.classList.add("hidden");
    }, 4500);
  }
  
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      tabButtons.forEach(b => b.classList.remove("active"));
      tabContents.forEach(c => c.classList.add("hidden"));
  
      btn.classList.add("active");
      const targetId = btn.getAttribute("data-tab");
      document.getElementById(targetId).classList.remove("hidden");
  
      if (targetId === "results-section") {
        renderResults();
      }
    });
  });
  
  // ==========================================
  // 3. KIEMS VERIFICATION LOGIC
  // ==========================================
  const voterIdInput = document.getElementById("voter-id-input");
  const verifyBtn = document.getElementById("verify-btn");
  const kiemsCard = document.getElementById("kiems-card");
  const ballotWizard = document.getElementById("ballot-wizard");
  const reviewCard = document.getElementById("review-card");
  
  // Quick test chips
  document.querySelectorAll(".id-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      voterIdInput.value = chip.getAttribute("data-id");
    });
  });
  
  verifyBtn.addEventListener("click", () => {
    const id = voterIdInput.value.trim();
  
    if (!/^\d{8}$/.test(id)) {
      showToast("Invalid Format: Please enter an 8-digit Kenyan National ID.", "error");
      return;
    }
  
    const voter = voters[id];
    if (!voter) {
      showToast("KIEMS Alert: National ID not found in the IEBC Voter Register.", "error");
      return;
    }
  
    if (voter.age < 18) {
      showToast(`Ineligible Voter: ${voter.name} is ${voter.age} years old (Must be 18+).`, "error");
      return;
    }
  
    if (voter.voted) {
      showToast(`FRAUD ALERT: ${voter.name} (ID: ${id}) has ALREADY VOTED!`, "error");
      return;
    }
  
    // Verification succeeded -> Start Voting Booth
    currentVoterId = id;
    currentStepIndex = 0;
    currentSelections = {};
  
    document.getElementById("active-voter-name").textContent = voter.name;
    document.getElementById("active-voter-meta").textContent = `County: ${voter.county} | ID: ${id}`;
  
    kiemsCard.classList.add("hidden");
    ballotWizard.classList.remove("hidden");
    showToast(`Verified: Welcome ${voter.name}. Please complete all 6 ballots.`, "success");
    renderBallotStep();
  });
  
  // ==========================================
  // 4. INTERACTIVE 6-TIER BALLOT WIZARD
  // ==========================================
  const candidatesGrid = document.getElementById("candidates-grid");
  const prevBallotBtn = document.getElementById("prev-ballot-btn");
  const nextBallotBtn = document.getElementById("next-ballot-btn");
  
  function renderBallotStep() {
    const currentBallot = BALLOT_STRUCTURE[currentStepIndex];
    const seatName = currentBallot.seat;
  
    // Update Progress Bar
    const percent = Math.round(((currentStepIndex) / BALLOT_STRUCTURE.length) * 100);
    document.getElementById("step-label").textContent = `Ballot ${currentStepIndex + 1} of 6: ${seatName}`;
    document.getElementById("progress-percent").textContent = `${percent}% Complete`;
    document.getElementById("progress-fill").style.width = `${percent}%`;
    document.getElementById("ballot-title").textContent = `Select Candidate for ${seatName}`;
  
    // Clear and populate candidate cards
    candidatesGrid.innerHTML = "";
    const existingChoice = currentSelections[seatName];
  
    currentBallot.candidates.forEach(candidate => {
      const card = document.createElement("div");
      card.className = "candidate-card";
      if (existingChoice && existingChoice.name === candidate.name) {
        card.classList.add("selected");
      }
  
      card.innerHTML = `
        <span class="party-badge">${candidate.symbol} ${candidate.party}</span>
        <div class="candidate-name">${candidate.name}</div>
        <small style="color: var(--text-muted)">Click to mark ballot box</small>
      `;
  
      card.addEventListener("click", () => {
        currentSelections[seatName] = { name: candidate.name, party: candidate.party, isSpoilt: false };
        renderBallotStep();
      });
  
      candidatesGrid.appendChild(card);
    });
  
    // Add Spoilt / Abstain option
    const spoiltCard = document.createElement("div");
    spoiltCard.className = "candidate-card spoilt";
    if (existingChoice && existingChoice.isSpoilt) {
      spoiltCard.classList.add("selected");
    }
    spoiltCard.innerHTML = `
      <span class="party-badge">❌ ABSTAIN / SPOILT</span>
      <div class="candidate-name">Cast Blank / Spoilt Vote</div>
      <small style="color: var(--text-muted)">Do not select any candidate for ${seatName}</small>
    `;
    spoiltCard.addEventListener("click", () => {
      currentSelections[seatName] = { name: "Spoilt / Blank Vote", party: "None", isSpoilt: true };
      renderBallotStep();
    });
    candidatesGrid.appendChild(spoiltCard);
  
    // Update navigation buttons
    prevBallotBtn.disabled = currentStepIndex === 0;
    nextBallotBtn.disabled = !currentSelections[seatName];
    nextBallotBtn.textContent = currentStepIndex === BALLOT_STRUCTURE.length - 1
      ? "Review All 6 Ballots →"
      : "Next Ballot →";
  }
  
  prevBallotBtn.addEventListener("click", () => {
    if (currentStepIndex > 0) {
      currentStepIndex--;
      renderBallotStep();
    }
  });
  
  nextBallotBtn.addEventListener("click", () => {
    if (currentStepIndex < BALLOT_STRUCTURE.length - 1) {
      currentStepIndex++;
      renderBallotStep();
    } else {
      showReviewScreen();
    }
  });
  
  document.getElementById("cancel-vote-btn").addEventListener("click", resetVotingBooth);
  
  function resetVotingBooth() {
    currentVoterId = null;
    currentStepIndex = 0;
    currentSelections = {};
    voterIdInput.value = "";
    ballotWizard.classList.add("hidden");
    reviewCard.classList.add("hidden");
    kiemsCard.classList.remove("hidden");
  }
  
  // ==========================================
  // 5. REVIEW & FINAL BALLOT SUBMISSION
  // ==========================================
  function showReviewScreen() {
    ballotWizard.classList.add("hidden");
    reviewCard.classList.remove("hidden");
  
    const reviewList = document.getElementById("review-list");
    reviewList.innerHTML = "";
  
    BALLOT_STRUCTURE.forEach(item => {
      const choice = currentSelections[item.seat];
      const row = document.createElement("div");
      row.className = "review-item";
      row.innerHTML = `
        <strong>${item.seat}</strong>
        <span>${choice.name} (${choice.party})</span>
      `;
      reviewList.appendChild(row);
    });
  }
  
  document.getElementById("back-to-edit-btn").addEventListener("click", () => {
    reviewCard.classList.add("hidden");
    ballotWizard.classList.remove("hidden");
    renderBallotStep();
  });
  
  document.getElementById("submit-ballots-btn").addEventListener("click", () => {
    if (!currentVoterId) return;
  
    // Record votes into official tally
  