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
  getDoc,
  setDoc,
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
const articlesGrid = document.getElementById("articles-grid");
const articleViewModal = document.getElementById("article-view-modal");
const articleNewModal = document.getElementById("article-new-modal");
const newArticleForm = document.getElementById("new-article-form");
const cmsToolbar = document.getElementById("cms-toolbar");
const saveCmsBtn = document.getElementById("save-cms-btn");
const toggleCmsBtn = document.getElementById("toggle-cms-mode-btn");

let isCmsActive = false;
let currentArticles = [];

// Accent colors cycled across list rows so repeated items don't look
// like one stamped-out template.
const ROW_ACCENTS = [
  { text: "text-[#0E5C50]", border: "border-[#0E5C50]/40" },
  { text: "text-[#F1613D]", border: "border-[#F1613D]/40" },
  { text: "text-[#B23A5D]", border: "border-[#B23A5D]/40" }
];

const DEFAULT_ARTICLES = [
  {
    id: "febra-regula",
    category: "Ghid febră",
    title: "Cum calculăm doza corectă de paracetamol?",
    excerpt: "Dozele siropurilor se calculează strict după numărul de kilograme, nu după vârsta trecută pe cutie.",
    content: "Febra este reacția sănătoasă a sistemului imunitar al copilului care luptă cu virusurile. La un bebeluș sub 3 luni, orice temperatură intrarectală de peste 38.0 grade impune control de urgență la spital. La copiii mai mari de 3 luni, contează starea clinică: dacă bea lichide și este vioi între pusee, tratăm febra cu antitermice dozate strict la kilograme (de exemplu, paracetamolul 15 mg/kg corp per doză, la minimum 6 ore distanță)."
  },
  {
    id: "hemoleucograma-secrete",
    category: "Analize sânge",
    title: "De ce sunt limfocitele mărite pe buletinul bebelușului?",
    excerpt: "Copiii mici au o formulă leucocitară inversată față de adulți. Află de ce nu este motiv de sperietură.",
    content: "Pe buletinele de analize, valorile de referință afișate de softul laboratorului sunt adesea cele ale adulților. În primii 4 ani de viață, este perfect fiziologic ca limfocitele să fie mai numeroase decât neutrofilele. De asemenea, o hemoglobină ușor scăzută poate trăda doar o anemie tranzitorie din puseul de creștere, rezolvabilă prin îmbogățirea dietei cu fier."
  },
  {
    id: "burtica-diversificare",
    category: "Nutriție & scaun",
    title: "Scaune ciudate în diversificare: ce este normal?",
    excerpt: "Când introduci morcovul, spanacul sau sfecla, scutecul se transformă complet. Iată semnele reale de alarmă.",
    content: "Sistemul digestiv al sugarului are nevoie de timp pentru a învăța să digere fibrele vegetale. Este normal să găsești bucățele nedigerate de legume sau modificări spectaculoase de culoare în scutec. Semnalele reale de alarmă care impun consult sunt prezența firișoarelor de sânge, diareea apoasă cu mai mult de 5-6 scaune pe zi sau refuzul complet al hidratării."
  }
];

window.switchTab = function (tab) {
  const homeTab = document.getElementById("tab-home");
  const consultTab = document.getElementById("tab-consult");
  const docTab = document.getElementById("tab-doctor");

  if (homeTab) homeTab.classList.add("hidden");
  if (consultTab) consultTab.classList.add("hidden");
  if (docTab) docTab.classList.add("hidden");

  const target = document.getElementById("tab-" + tab);
  if (target) target.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
};

// Scrolls to a section within the home tab, switching to it first if needed.
window.scrollToSection = function (id) {
  const isHomeVisible = !document.getElementById("tab-home").classList.contains("hidden");
  if (!isHomeVisible) {
    window.switchTab("home");
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  } else {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
};

window.toggleLoginModal = function (show) {
  if (!loginModal) return;
  loginModal.classList.toggle("hidden", !show);
};

window.openArticleModal = function (id) {
  const article = currentArticles.find((a) => a.id === id);
  if (!article) return;

  document.getElementById("modal-art-category").innerText = article.category;
  document.getElementById("modal-art-title").innerText = article.title;
  document.getElementById("modal-art-content").innerText = article.content;
  articleViewModal.classList.remove("hidden");
};

window.closeArticleModal = function () {
  if (articleViewModal) articleViewModal.classList.add("hidden");
};

window.openNewArticleModal = function () {
  if (articleNewModal) articleNewModal.classList.remove("hidden");
};

window.closeNewArticleModal = function () {
  if (articleNewModal) articleNewModal.classList.add("hidden");
};

async function loadCmsContent() {
  try {
    const docRef = doc(db, "settings", "site_content");
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      document.querySelectorAll("[data-cms]").forEach((el) => {
        const key = el.getAttribute("data-cms");
        if (data[key]) {
          el.innerText = data[key];
        }
      });
    }
  } catch (err) {
    /* first load, no saved content yet — keep defaults */
  }
}

function toggleCmsEditing() {
  isCmsActive = !isCmsActive;
  const elements = document.querySelectorAll("[data-cms]");

  elements.forEach((el) => {
    el.contentEditable = isCmsActive ? "true" : "false";
    el.classList.toggle("cms-editable-active", isCmsActive);
  });

  if (isCmsActive) {
    cmsToolbar.classList.remove("hidden");
    if (toggleCmsBtn) toggleCmsBtn.innerText = "Oprește editarea";
    window.switchTab("home");
  } else {
    cmsToolbar.classList.add("hidden");
    if (toggleCmsBtn) toggleCmsBtn.innerText = "Editează textele site-ului";
  }
}

if (toggleCmsBtn) {
  toggleCmsBtn.addEventListener("click", toggleCmsEditing);
}

if (saveCmsBtn) {
  saveCmsBtn.addEventListener("click", async () => {
    saveCmsBtn.innerText = "Se salvează...";
    const data = {};
    document.querySelectorAll("[data-cms]").forEach((el) => {
      const key = el.getAttribute("data-cms");
      data[key] = el.innerText.trim();
    });

    try {
      await setDoc(doc(db, "settings", "site_content"), data, { merge: true });
      saveCmsBtn.innerText = "Salvat ✓";
      setTimeout(() => {
        saveCmsBtn.innerText = "Salvează textele";
      }, 2000);
    } catch (err) {
      alert("Eroare la salvare: " + err.message);
      saveCmsBtn.innerText = "Salvează textele";
    }
  });
}

async function loadArticles() {
  if (!articlesGrid) return;
  try {
    const q = query(collection(db, "articles"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      currentArticles = DEFAULT_ARTICLES;
    } else {
      currentArticles = [];
      snapshot.forEach((d) => {
        currentArticles.push({ id: d.id, ...d.data() });
      });
    }

    renderArticles();
  } catch (err) {
    currentArticles = DEFAULT_ARTICLES;
    renderArticles();
  }
}

function renderArticles() {
  articlesGrid.innerHTML = "";

  currentArticles.forEach((art, index) => {
    const accent = ROW_ACCENTS[index % ROW_ACCENTS.length];
    const row = document.createElement("article");
    row.className = "py-7 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-8";
    row.innerHTML = `
      <span class="inline-block text-xs font-semibold ${accent.text} border-b-2 ${accent.border} pb-0.5 w-40 shrink-0">
        ${art.category}
      </span>
      <div class="flex-1">
        <h4 class="text-lg font-display font-semibold leading-snug">${art.title}</h4>
        <p class="text-xs text-[#20302B]/65 mt-1 leading-relaxed max-w-xl">${art.excerpt}</p>
      </div>
      <button onclick="openArticleModal('${art.id}')" class="text-xs font-semibold ${accent.text} link-underline shrink-0">
        Citește tot
      </button>
    `;
    articlesGrid.appendChild(row);
  });
}

if (newArticleForm) {
  newArticleForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("new-art-title").value;
    const category = document.getElementById("new-art-category").value;
    const excerpt = document.getElementById("new-art-excerpt").value;
    const content = document.getElementById("new-art-content").value;

    try {
      await addDoc(collection(db, "articles"), {
        title,
        category,
        excerpt,
        content,
        createdAt: serverTimestamp()
      });
      newArticleForm.reset();
      window.closeNewArticleModal();
      loadArticles();
    } catch (err) {
      alert("Eroare la adăugarea articolului: " + err.message);
    }
  });
}

onAuthStateChanged(auth, (user) => {
  const doctorNavBtn = document.getElementById("doctor-nav-btn");
  const doctorArticleBtnWrap = document.getElementById("doctor-article-btn-wrap");

  if (user) {
    if (doctorNavBtn) {
      doctorNavBtn.innerText = "Panou medic";
      doctorNavBtn.onclick = () => window.switchTab("doctor");
    }
    if (doctorArticleBtnWrap) doctorArticleBtnWrap.classList.remove("hidden");
    if (logoutBtn) logoutBtn.classList.remove("hidden");
    loadCases();
  } else {
    if (doctorNavBtn) {
      doctorNavBtn.innerText = "Acces medic";
      doctorNavBtn.onclick = () => window.toggleLoginModal(true);
    }
    if (doctorArticleBtnWrap) doctorArticleBtnWrap.classList.add("hidden");
    if (logoutBtn) logoutBtn.classList.add("hidden");
    if (isCmsActive) toggleCmsEditing();
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
      errorEl.innerText = "Date incorecte de conectare.";
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
    submitBtn.innerText = "Se încarcă dosarul...";
    statusMsg.classList.remove("hidden");
    statusMsg.innerText = "Se transmit fișierele către Dr. Bubbles...";

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
        status: "in_asteptare",
        createdAt: serverTimestamp()
      });

      statusMsg.innerText = "Dosarul a ajuns cu succes la Dr. Bubbles! Verifică e-mailul în curând.";
      statusMsg.className = "text-center text-xs font-semibold mt-3 text-[#0E5C50]";
      consultForm.reset();
    } catch (err) {
      statusMsg.innerText = "Eroare la trimitere: " + err.message;
      statusMsg.className = "text-center text-xs font-semibold mt-3 text-[#B23A5D]";
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = "Trimite dosarul către medicul pediatru";
    }
  });
}

async function loadCases() {
  if (!casesContainer) return;
  casesContainer.innerHTML = "<p class='text-sm font-medium text-[#20302B]/60'>Se citesc dosarele...</p>";

  try {
    const casesQuery = query(collection(db, "consultations"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(casesQuery);

    if (snapshot.empty) {
      casesContainer.innerHTML = "<p class='text-sm font-medium text-[#20302B]/60'>Nu există dosare noi în așteptare.</p>";
      return;
    }

    casesContainer.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const isDone = data.status === "finalizat";
      const card = document.createElement("div");
      card.className = "bg-white/70 border border-[#20302B]/10 rounded-2xl p-6 flex flex-col gap-3";
      card.innerHTML = `
        <div class="flex justify-between items-start gap-4">
          <div>
            <span class="inline-block px-3 py-1 rounded-full text-xs font-semibold ${isDone ? "bg-[#DCEEDD] text-[#0E5C50]" : "bg-[#F2A93B]/25 text-[#7A5A16]"}">
              ${isDone ? "Rezolvat" : "În așteptare"}
            </span>
            <h4 class="text-lg font-display font-semibold mt-2">${data.contact}</h4>
          </div>
          <a href="${data.fileUrl}" target="_blank" class="text-xs font-semibold text-[#0E5C50] link-underline shrink-0">
            Deschide fișierul
          </a>
        </div>
        <p class="text-xs font-medium text-[#20302B]/70">
          <b>Vârstă:</b> ${data.childAge} &nbsp;·&nbsp; <b>Greutate:</b> ${data.childWeight || "nespecificată"}
        </p>
        <p class="text-xs font-medium bg-[#F2A93B]/10 border border-[#F2A93B]/30 rounded-xl p-3 leading-relaxed">
          ${data.symptoms}
        </p>
        <div class="pt-2 border-t border-[#20302B]/10 flex gap-2">
          <button data-id="${docSnap.id}" data-status="finalizat" class="status-btn bg-[#0E5C50] hover:bg-[#0A453C] text-white px-4 py-2 rounded-full text-xs font-semibold transition-colors">
            Marchează ca rezolvat
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
    casesContainer.innerHTML = `<p class='text-xs font-semibold text-[#B23A5D]'>${err.message}</p>`;
  }
}

loadCmsContent();
loadArticles();