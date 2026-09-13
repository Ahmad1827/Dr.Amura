import {
  auth,
  db,
  storage,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  ref,
  uploadBytes,
  getDownloadURL
} from "./firebase-config.js";

const loginForm = document.getElementById("login-form");
const consultForm = document.getElementById("consult-form");
const logoutBtn = document.getElementById("logout-btn");
const loginModal = document.getElementById("login-modal");
const casesContainer = document.getElementById("cases-list");
const statusMsg = document.getElementById("status-msg");

window.switchTab = function(tab) {
  document.getElementById("tab-home").classList.add("hidden");
  document.getElementById("tab-consult").classList.add("hidden");
  const docTab = document.getElementById("tab-doctor");
  if (docTab) docTab.classList.add("hidden");

  const target = document.getElementById("tab-" + tab);
  if (target) target.classList.remove("hidden");
};

window.toggleLoginModal = function(show) {
  if (show) {
    loginModal.classList.remove("hidden");
  } else {
    loginModal.classList.add("hidden");
  }
};

onAuthStateChanged(auth, (user) => {
  const doctorNavBtn = document.getElementById("doctor-nav-btn");

  if (user) {
    doctorNavBtn.innerText = "Doctor Dashboard";
    doctorNavBtn.onclick = () => window.switchTab("doctor");
    if (logoutBtn) logoutBtn.classList.remove("hidden");
    loadCases();
  } else {
    doctorNavBtn.innerText = "Doctor Login";
    doctorNavBtn.onclick = () => window.toggleLoginModal(true);
    if (logoutBtn) logoutBtn.classList.add("hidden");
    const docTab = document.getElementById("tab-doctor");
    if (docTab && !docTab.classList.contains("hidden")) {
      window.switchTab("home");
    }
  }
});

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("doctor-email").value;
    const password = document.getElementById("doctor-password").value;
    const errorEl = document.getElementById("login-error");

    try {
      await signInWithEmailAndPassword(auth, email, password);
      errorEl.classList.add("hidden");
      loginForm.reset();
      window.toggleLoginModal(false);
      window.switchTab("doctor");
    } catch (err) {
      errorEl.innerText = err.message;
      errorEl.classList.remove("hidden");
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
    window.switchTab("home");
  });
}

if (consultForm) {
  consultForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById("submit-btn");
    submitBtn.disabled = true;
    submitBtn.innerText = "Uploading...";
    statusMsg.classList.remove("hidden");
    statusMsg.innerText = "Submitting case documentation...";

    try {
      const contact = document.getElementById("contact").value;
      const age = document.getElementById("age").value;
      const weight = document.getElementById("weight").value;
      const symptoms = document.getElementById("symptoms").value;
      const file = document.getElementById("file").files[0];

      const storageReference = ref(storage, `cases/${Date.now()}_${file.name}`);
      const uploadSnapshot = await uploadBytes(storageReference, file);
      const fileUrl = await getDownloadURL(uploadSnapshot.ref);

      await addDoc(collection(db, "consultations"), {
        contact,
        childAge: age,
        childWeight: weight,
        symptoms,
        fileUrl,
        fileName: file.name,
        status: "pending",
        createdAt: serverTimestamp()
      });

      statusMsg.innerText = "Case sent to Dr. Bubbles!";
      statusMsg.className = "text-center font-black mt-2 text-green-700";
      consultForm.reset();
    } catch (err) {
      statusMsg.innerText = err.message;
      statusMsg.className = "text-center font-black mt-2 text-red-600";
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = "Send Case to Dr. Bubbles";
    }
  });
}

async function loadCases() {
  if (!casesContainer) return;
  casesContainer.innerHTML = "<p class='font-bold'>Loading records...</p>";

  try {
    const casesQuery = query(collection(db, "consultations"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(casesQuery);

    if (snapshot.empty) {
      casesContainer.innerHTML = "<p class='font-bold text-gray-600'>No incoming cases yet.</p>";
      return;
    }

    casesContainer.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const card = document.createElement("div");
      card.className = "bg-white border-4 border-black rounded-2xl p-5 shadow-pop flex flex-col gap-3";
      card.innerHTML = `
        <div class="flex justify-between items-start">
          <div>
            <span class="inline-block px-3 py-1 border-2 border-black rounded-full text-xs font-black uppercase ${data.status === "reviewed" ? "bg-bubbleGreen" : "bg-bubbleYellow"}">
              ${data.status}
            </span>
            <h4 class="font-black text-xl mt-2">${data.contact}</h4>
          </div>
          <a href="${data.fileUrl}" target="_blank" class="btn-pop bg-bubbleCyan border-2 border-black px-3 py-1 rounded-xl text-xs font-black shadow-pop">
            View File (${data.fileName})
          </a>
        </div>
        <p class="font-bold text-sm text-gray-800"><b>Age:</b> ${data.childAge} | <b>Weight:</b> ${data.childWeight || "N/A"}</p>
        <p class="font-bold text-sm bg-gray-50 border-2 border-black rounded-xl p-3">${data.symptoms}</p>
        <div class="flex gap-2 mt-2">
          <button data-id="${docSnap.id}" data-status="reviewed" class="status-btn btn-pop bg-bubbleGreen border-2 border-black px-4 py-1 rounded-xl text-xs font-black">
            Mark Reviewed
          </button>
        </div>
      `;
      casesContainer.appendChild(card);
    });

    document.querySelectorAll(".status-btn").forEach((button) => {
      button.addEventListener("click", async (e) => {
        const id = e.target.getAttribute("data-id");
        const newStatus = e.target.getAttribute("data-status");
        await updateDoc(doc(db, "consultations", id), { status: newStatus });
        loadCases();
      });
    });
  } catch (err) {
    casesContainer.innerHTML = `<p class='font-bold text-red-600'>${err.message}</p>`;
  }
}