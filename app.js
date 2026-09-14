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
  deleteDoc,
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
const casesContainer = document.getElementById("cases-list");
const statusMsg = document.getElementById("status-msg");
const homeArticlesGrid = document.getElementById("home-articles-grid");
const articlesArchiveList = document.getElementById("articles-archive-list");
const doctorArticlesManageList = document.getElementById("doctor-articles-manage-list");
const newArticleForm = document.getElementById("new-article-form");
const editArticleModal = document.getElementById("edit-article-modal");
const editArticleForm = document.getElementById("edit-article-form");
const cmsToolbar = document.getElementById("cms-toolbar");
const saveCmsBtn = document.getElementById("save-cms-btn");
const stopCmsBtn = document.getElementById("stop-cms-btn");
const toggleCmsBtn = document.getElementById("toggle-cms-mode-btn");

const doctorSettingsForm = document.getElementById("doctor-settings-form");
const doctorSettingsStatus = document.getElementById("doctor-settings-status");
const piperStripeForm = document.getElementById("piper-stripe-form");
const piperPayBtn = document.getElementById("piper-pay-btn");
const piperSuccessScreen = document.getElementById("piper-success-screen");
const stripeErrorsEl = document.getElementById("stripe-card-errors");
const piperSimulatePayBtn = document.getElementById("piper-simulate-pay-btn");

let isCmsActive = false;
let currentArticles = [];
let currentViewingArticleId = null;

let currentActiveCase = null;
let stripeInstance = null;
let cardElement = null;

let doctorConfig = {
  notificationEmail: "ahmadarnaoute1896@gmail.com",
  price_analize: 150,
  price_externare: 200,
  price_consiliere: 120,
  stripePublishableKey: "",
  functionsUrl: ""
};

const DEFAULT_ARTICLES = [
  {
    id: "febra-ghid",
    category: "Ghid Febră",
    title: "Cum calculăm doza corectă de paracetamol?",
    excerpt: "Dozele siropurilor se calculează strict după numărul de kilograme, nu după vârsta trecută pe cutie.",
    content: "Febra este reacția sănătoasă a sistemului imunitar al copilului care luptă cu virusurile.\n\nLa un bebeluș sub 3 luni, orice temperatură intrarectală de peste 38.0 grade impune control de urgență la spital. La copiii mai mari de 3 luni, contează starea clinică: dacă bea lichide și este vioi între pusee, tratăm febra cu antitermice dozate strict la kilograme (de exemplu, paracetamolul 15 mg/kg corp per doză, la minimum 6 ore distanță)."
  },
  {
    id: "hemoleucograma",
    category: "Analize Sânge",
    title: "De ce sunt limfocitele mărite pe buletinul bebelușului?",
    excerpt: "Copiii mici au o formulă leucocitară inversată față de adulți. Află de ce nu este motiv de sperietură.",
    content: "Pe buletinele de analize, valorile de referință afișate de softul laboratorului sunt adesea cele ale adulților.\n\nÎn primii 4 ani de viață, este perfect fiziologic ca limfocitele să fie mai numeroase decât neutrofilele. De asemenea, o hemoglobină ușor scăzută poate trăda doar o anemie tranzitorie din puseul de creștere, rezolvabilă prin îmbogățirea dietei cu fier."
  },
  {
    id: "diversificare",
    category: "Nutriție & Burtică",
    title: "Scaune ciudate în diversificare: ce este normal?",
    excerpt: "Când introduci morcovul, spanacul sau sfecla, scutecul se transformă complet. Iată semnele reale de alarmă.",
    content: "Sistemul digestiv al sugarului are nevoie de timp pentru a învăța să digere fibrele vegetale.\n\nEste normal să găsești bucățele nedigerate de legume sau modificări spectaculoase de culoare în scutec. Semnalele reale de alarmă care impun consult sunt prezența firișoarelor de sânge, diareea apoasă cu mai mult de 5-6 scaune pe zi sau refuzul complet al hidratării."
  }
];

window.syncPricesAcrossDOM = function () {
  const analizeStr = `${doctorConfig.price_analize} RON`;
  const externareStr = `${doctorConfig.price_externare} RON`;
  const consiliereStr = `${doctorConfig.price_consiliere} RON`;

  document.querySelectorAll('[data-cms="price_analize"]').forEach((el) => {
    el.innerText = analizeStr;
  });
  document.querySelectorAll('[data-cms="price_externare"]').forEach((el) => {
    el.innerText = externareStr;
  });
  document.querySelectorAll('[data-cms="price_consiliere"]').forEach((el) => {
    el.innerText = consiliereStr;
  });

  const selectedInput = document.getElementById("selected-service-input");
  const selectedType = selectedInput ? selectedInput.value : "analize";
  const currentPrice = `${doctorConfig[`price_${selectedType}`] || 150} RON`;

  const formDisplayPrice = document.getElementById("form-display-price");
  const btnPriceTag = document.getElementById("btn-price-tag");
  const piperSummaryAmount = document.getElementById("piper-summary-amount");
  const piperBtnAmount = document.getElementById("piper-btn-amount");

  if (formDisplayPrice) formDisplayPrice.innerText = currentPrice;
  if (btnPriceTag) btnPriceTag.innerText = currentPrice;
  if (piperSummaryAmount) piperSummaryAmount.innerText = currentPrice;
  if (piperBtnAmount) piperBtnAmount.innerText = currentPrice;
};

async function loadDoctorSettings() {
  try {
    const docRef = doc(db, "settings", "doctor_profile");
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      doctorConfig = { ...doctorConfig, ...snap.data() };
    }
  } catch (err) {}

  syncDoctorSettingsToUI();
}

function syncDoctorSettingsToUI() {
  const emailInput = document.getElementById("doctor-notification-email");
  const analizeInput = document.getElementById("doctor-price-analize");
  const externareInput = document.getElementById("doctor-price-externare");
  const consiliereInput = document.getElementById("doctor-price-consiliere");
  const stripeKeyInput = document.getElementById("doctor-stripe-key");
  const functionsUrlInput = document.getElementById("doctor-functions-url");

  if (emailInput) emailInput.value = doctorConfig.notificationEmail || "ahmadarnaoute1896@gmail.com";
  if (analizeInput) analizeInput.value = doctorConfig.price_analize || 150;
  if (externareInput) externareInput.value = doctorConfig.price_externare || 200;
  if (consiliereInput) consiliereInput.value = doctorConfig.price_consiliere || 120;
  if (stripeKeyInput) stripeKeyInput.value = doctorConfig.stripePublishableKey || "";
  if (functionsUrlInput) functionsUrlInput.value = doctorConfig.functionsUrl || "";

  window.syncPricesAcrossDOM();
  initStripeElements();
}

if (doctorSettingsForm) {
  doctorSettingsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const notificationEmail = document.getElementById("doctor-notification-email").value.trim();
    const price_analize = parseInt(document.getElementById("doctor-price-analize").value, 10) || 150;
    const price_externare = parseInt(document.getElementById("doctor-price-externare").value, 10) || 200;
    const price_consiliere = parseInt(document.getElementById("doctor-price-consiliere").value, 10) || 120;
    const stripePublishableKey = document.getElementById("doctor-stripe-key").value.trim();
    const functionsUrl = document.getElementById("doctor-functions-url").value.trim();

    doctorConfig = {
      notificationEmail,
      price_analize,
      price_externare,
      price_consiliere,
      stripePublishableKey,
      functionsUrl
    };

    try {
      await setDoc(doc(db, "settings", "doctor_profile"), doctorConfig, { merge: true });
      await setDoc(doc(db, "settings", "site_content"), {
        price_analize: `${price_analize} RON`,
        price_externare: `${price_externare} RON`,
        price_consiliere: `${price_consiliere} RON`
      }, { merge: true });

      syncDoctorSettingsToUI();
      if (doctorSettingsStatus) {
        doctorSettingsStatus.classList.remove("hidden");
        setTimeout(() => doctorSettingsStatus.classList.add("hidden"), 3000);
      }
    } catch (err) {
      alert("Eroare la salvare: " + err.message);
    }
  });
}

function initStripeElements() {
  const cardContainer = document.getElementById("stripe-card-element");
  if (!cardContainer || !window.Stripe) return;

  const pubKey = doctorConfig.stripePublishableKey || "pk_test_TYooMQauvdEDq54NiTphI7jx";
  try {
    stripeInstance = window.Stripe(pubKey);
    const elements = stripeInstance.elements();
    cardElement = elements.create("card", {
      style: {
        base: {
          fontFamily: "'Karla', sans-serif",
          fontSize: "15px",
          color: "#1D2D27",
          "::placeholder": { color: "#8E9E98" }
        }
      }
    });
    cardContainer.innerHTML = "";
    cardElement.mount("#stripe-card-element");

    cardElement.on("change", (event) => {
      if (event.error) {
        stripeErrorsEl.textContent = event.error.message;
        stripeErrorsEl.classList.remove("hidden");
      } else {
        stripeErrorsEl.textContent = "";
        stripeErrorsEl.classList.add("hidden");
      }
    });
  } catch (err) {}
}

async function markCaseAsPaid(caseId, isSimulation = false) {
  const statusValue = isSimulation ? "simulare_test" : "platit";

  await updateDoc(doc(db, "consultations", caseId), {
    status: statusValue,
    isPaid: true,
    isSimulation: isSimulation,
    paidAt: serverTimestamp()
  });

  const targetEmail = doctorConfig.notificationEmail || "ahmadarnaoute1896@gmail.com";

  if (doctorConfig.functionsUrl && doctorConfig.functionsUrl.startsWith("http")) {
    try {
      await fetch(`${doctorConfig.functionsUrl}/sendDoctorEmailNotification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId,
          doctorEmail: targetEmail,
          caseDetails: { ...currentActiveCase, isSimulation }
        })
      });
    } catch (mailErr) {}
  }

  piperStripeForm.classList.add("hidden");
  piperSuccessScreen.classList.remove("hidden");
  loadCases();
}

if (piperSimulatePayBtn) {
  piperSimulatePayBtn.addEventListener("click", async () => {
    if (!currentActiveCase) {
      alert("Nu există o sesiune activă. Completează întâi formularul.");
      window.switchTab("consult");
      return;
    }

    piperSimulatePayBtn.disabled = true;
    piperSimulatePayBtn.innerText = "Se procesează simularea...";

    await new Promise((resolve) => setTimeout(resolve, 800));
    await markCaseAsPaid(currentActiveCase.id, true);

    piperSimulatePayBtn.disabled = false;
    piperSimulatePayBtn.innerText = "⚡ Simulează Plată Test (1-Click)";
  });
}

if (piperStripeForm) {
  piperStripeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentActiveCase) {
      alert("Sesiune expirată. Completează din nou formularul.");
      window.switchTab("consult");
      return;
    }

    piperPayBtn.disabled = true;
    piperPayBtn.innerText = "Se procesează plata securizată...";

    try {
      let paymentConfirmed = false;

      if (doctorConfig.functionsUrl && doctorConfig.functionsUrl.startsWith("http")) {
        const intentRes = await fetch(`${doctorConfig.functionsUrl}/createPaymentIntent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            caseId: currentActiveCase.id,
            amount: currentActiveCase.price,
            serviceType: currentActiveCase.serviceType,
            parentEmail: currentActiveCase.contact,
            childAge: currentActiveCase.childAge
          })
        });

        if (intentRes.ok) {
          const intentData = await intentRes.json();
          if (stripeInstance && cardElement && intentData.clientSecret) {
            const result = await stripeInstance.confirmCardPayment(intentData.clientSecret, {
              payment_method: {
                card: cardElement,
                billing_details: { email: currentActiveCase.contact }
              }
            });

            if (result.error) {
              throw new Error(result.error.message);
            } else if (result.paymentIntent.status === "succeeded") {
              paymentConfirmed = true;
            }
          }
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        paymentConfirmed = true;
      }

      if (paymentConfirmed) {
        await markCaseAsPaid(currentActiveCase.id, false);
      }
    } catch (err) {
      stripeErrorsEl.textContent = err.message;
      stripeErrorsEl.classList.remove("hidden");
    } finally {
      piperPayBtn.disabled = false;
      window.syncPricesAcrossDOM();
    }
  });
}

window.openArticle = function (id, fromTab = "home") {
  window.previousTab = fromTab;
  currentViewingArticleId = id;
  const article = currentArticles.find((a) => a.id === id);
  if (!article) return;

  const catEl = document.getElementById("reader-category");
  const titleEl = document.getElementById("reader-title");
  const contentEl = document.getElementById("reader-content");

  if (catEl) catEl.innerText = article.category;
  if (titleEl) titleEl.innerText = article.title;
  if (contentEl) {
    contentEl.innerHTML = "";
    const paragraphs = article.content.split("\n\n");
    paragraphs.forEach((pText) => {
      if (pText.trim()) {
        const p = document.createElement("p");
        p.innerText = pText.trim();
        contentEl.appendChild(p);
      }
    });
  }

  const doctorActions = document.getElementById("doctor-article-actions");
  if (doctorActions) {
    if (auth.currentUser) {
      doctorActions.classList.remove("hidden");
    } else {
      doctorActions.classList.add("hidden");
    }
  }

  window.switchTab("article-view");
};

window.openEditModal = function (id) {
  const article = currentArticles.find((a) => a.id === id);
  if (!article) return;

  document.getElementById("edit-art-id").value = article.id;
  document.getElementById("edit-art-title").value = article.title;
  document.getElementById("edit-art-category").value = article.category;
  document.getElementById("edit-art-excerpt").value = article.excerpt;
  document.getElementById("edit-art-content").value = article.content;

  if (editArticleModal) editArticleModal.classList.remove("hidden");
};

window.deleteArticlePrompt = async function (id) {
  const article = currentArticles.find((a) => a.id === id);
  const title = article ? article.title : "acest articol";
  
  if (!confirm(`Sigur doriți să ștergeți articolul "${title}"?`)) return;

  try {
    await deleteDoc(doc(db, "articles", id));
    alert("Articolul a fost șters!");
    if (currentViewingArticleId === id) {
      window.switchTab("articles");
    }
    await loadArticles();
  } catch (err) {
    alert("Eroare la ștergere: " + err.message);
  }
};

const readerEditBtn = document.getElementById("reader-edit-btn");
const readerDeleteBtn = document.getElementById("reader-delete-btn");

if (readerEditBtn) {
  readerEditBtn.addEventListener("click", () => {
    if (currentViewingArticleId) window.openEditModal(currentViewingArticleId);
  });
}

if (readerDeleteBtn) {
  readerDeleteBtn.addEventListener("click", () => {
    if (currentViewingArticleId) window.deleteArticlePrompt(currentViewingArticleId);
  });
}

function renderArticles() {
  if (homeArticlesGrid) {
    homeArticlesGrid.innerHTML = "";
    const homeSubset = currentArticles.slice(0, 3);
    homeSubset.forEach((art) => {
      const card = document.createElement("article");
      card.className = "bg-white/80 border border-ink/10 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col justify-between hover:border-leafGreen/40 transition-colors cursor-pointer";
      card.onclick = () => window.openArticle(art.id, "home");
      card.innerHTML = `
        <div class="space-y-2 sm:space-y-3">
          <span class="inline-block text-[10px] sm:text-[11px] font-bold text-leafGreen bg-leafLight/70 px-2.5 py-0.5 sm:py-1 rounded-full">
            ${art.category}
          </span>
          <h4 class="text-sm sm:text-base font-display font-semibold leading-snug text-ink">${art.title}</h4>
          <p class="text-xs text-ink/70 leading-relaxed">${art.excerpt}</p>
        </div>
        <span class="text-xs font-bold text-leafGreen link-underline mt-3 sm:mt-4 inline-block self-start">
          Citește ghidul →
        </span>
      `;
      homeArticlesGrid.appendChild(card);
    });
  }

  if (articlesArchiveList) {
    articlesArchiveList.innerHTML = "";
    currentArticles.forEach((art) => {
      const row = document.createElement("article");
      row.className = "py-4 sm:py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 cursor-pointer hover:bg-white/40 px-2 sm:px-3 rounded-2xl transition-colors";
      row.onclick = () => window.openArticle(art.id, "articles");
      row.innerHTML = `
        <div class="space-y-1 max-w-xl">
          <span class="text-[10px] sm:text-xs font-bold text-leafGreen uppercase tracking-wider">${art.category}</span>
          <h4 class="text-base sm:text-lg font-display font-semibold text-ink leading-snug">${art.title}</h4>
          <p class="text-xs text-ink/65 leading-relaxed">${art.excerpt}</p>
        </div>
        <span class="text-xs font-bold text-leafGreen link-underline shrink-0 self-start sm:self-auto">
          Citește articolul →
        </span>
      `;
      articlesArchiveList.appendChild(row);
    });
  }

  if (doctorArticlesManageList) {
    doctorArticlesManageList.innerHTML = "";
    currentArticles.forEach((art) => {
      const item = document.createElement("div");
      item.className = "py-3 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3";
      item.innerHTML = `
        <div>
          <span class="text-[10px] font-bold text-leafGreen uppercase">${art.category}</span>
          <h5 class="text-sm font-display font-semibold text-ink">${art.title}</h5>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button onclick="window.openArticle('${art.id}', 'doctor')" class="text-xs font-bold text-ink/70 hover:text-ink px-2 py-1">
            Vezi
          </button>
          <button onclick="window.openEditModal('${art.id}')" class="text-xs font-bold bg-warmSun/30 border border-warmSun/60 text-ink px-3 py-1 rounded-full hover:bg-warmSun/50">
            Editează
          </button>
          <button onclick="window.deleteArticlePrompt('${art.id}')" class="text-xs font-bold bg-berryRose/10 border border-berryRose/30 text-berryRose px-3 py-1 rounded-full hover:bg-berryRose/20">
            Șterge
          </button>
        </div>
      `;
      doctorArticlesManageList.appendChild(item);
    });
  }
}

async function loadArticles() {
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
  } catch (err) {
    currentArticles = DEFAULT_ARTICLES;
  }
  renderArticles();
}

async function loadCmsContent() {
  try {
    const docRef = doc(db, "settings", "site_content");
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      document.querySelectorAll("[data-cms]").forEach((el) => {
        const key = el.getAttribute("data-cms");
        if (data[key]) el.innerText = data[key];
      });
    }
  } catch (err) {}
}

function toggleCmsEditing() {
  isCmsActive = !isCmsActive;
  const elements = document.querySelectorAll("[data-cms]");

  elements.forEach((el) => {
    el.contentEditable = isCmsActive ? "true" : "false";
    el.classList.toggle("cms-editable-active", isCmsActive);
  });

  if (isCmsActive) {
    if (cmsToolbar) cmsToolbar.classList.remove("hidden");
    if (toggleCmsBtn) toggleCmsBtn.innerText = "Oprește editarea";
    window.switchTab("home");
  } else {
    if (cmsToolbar) cmsToolbar.classList.add("hidden");
    if (toggleCmsBtn) toggleCmsBtn.innerText = "Editează textele site-ului";
  }
}

if (toggleCmsBtn) toggleCmsBtn.addEventListener("click", toggleCmsEditing);
if (stopCmsBtn) stopCmsBtn.addEventListener("click", toggleCmsEditing);

document.addEventListener("click", (e) => {
  if (!isCmsActive) return;

  if (e.target.closest("#cms-toolbar") || e.target.closest("#toggle-cms-mode-btn")) {
    return;
  }

  const cmsTarget = e.target.closest("[data-cms]");
  if (cmsTarget) {
    e.preventDefault();
    e.stopPropagation();
    cmsTarget.focus();
  }
}, true);

document.addEventListener("keydown", (e) => {
  if (!isCmsActive) return;
  if (e.target.hasAttribute("data-cms") && e.key === "Enter") {
    e.preventDefault();
    e.target.blur();
  }
});

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
      alert("Eroare: " + err.message);
      saveCmsBtn.innerText = "Salvează textele";
    }
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
      alert("Articolul a fost publicat cu succes!");
      await loadArticles();
    } catch (err) {
      alert("Eroare la adăugarea articolului: " + err.message);
    }
  });
}

if (editArticleForm) {
  editArticleForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("edit-art-id").value;
    const title = document.getElementById("edit-art-title").value;
    const category = document.getElementById("edit-art-category").value;
    const excerpt = document.getElementById("edit-art-excerpt").value;
    const content = document.getElementById("edit-art-content").value;

    try {
      await updateDoc(doc(db, "articles", id), {
        title,
        category,
        excerpt,
        content,
        updatedAt: serverTimestamp()
      });

      if (editArticleModal) editArticleModal.classList.add("hidden");
      alert("Modificările au fost salvate!");

      await loadArticles();
      if (currentViewingArticleId === id) {
        window.openArticle(id, window.previousTab || "home");
      }
    } catch (err) {
      alert("Eroare la actualizare: " + err.message);
    }
  });
}

try {
  onAuthStateChanged(auth, (user) => {
    const doctorNavBtn = document.getElementById("doctor-nav-btn");
    const doctorActions = document.getElementById("doctor-article-actions");

    if (user) {
      if (doctorNavBtn) {
        doctorNavBtn.innerText = "Panou medic";
        doctorNavBtn.onclick = () => window.switchTab("doctor");
      }
      if (doctorActions) doctorActions.classList.remove("hidden");
      if (logoutBtn) logoutBtn.classList.remove("hidden");
      loadCases();
      renderArticles();
    } else {
      if (doctorNavBtn) {
        doctorNavBtn.innerText = "Acces medic";
        doctorNavBtn.onclick = () => window.toggleLoginModal(true);
      }
      if (doctorActions) doctorActions.classList.add("hidden");
      if (logoutBtn) logoutBtn.classList.add("hidden");
      if (isCmsActive) toggleCmsEditing();
      renderArticles();
    }
  });
} catch (err) {}

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("doctor-email").value;
    const password = document.getElementById("doctor-password").value;
    const errorEl = document.getElementById("login-error");

    try {
      await signInWithEmailAndPassword(auth, email, password);
      if (errorEl) errorEl.classList.add("hidden");
      loginForm.reset();
      window.toggleLoginModal(false);
      window.switchTab("doctor");
    } catch (err) {
      if (errorEl) {
        errorEl.innerText = "Date incorecte de conectare.";
        errorEl.classList.remove("hidden");
      }
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (err) {}
    window.switchTab("home");
  });
}

if (consultForm) {
  consultForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById("submit-btn");
    submitBtn.disabled = true;
    submitBtn.innerText = "Se pregătește sesiunea de plată...";
    statusMsg.classList.remove("hidden");
    statusMsg.innerText = "Se înregistrează datele cazului...";

    try {
      const serviceType = document.getElementById("selected-service-input").value || "analize";
      const contact = document.getElementById("contact").value;
      const age = document.getElementById("age").value;
      const weight = document.getElementById("weight").value;
      const symptoms = document.getElementById("symptoms").value;
      const fileInput = document.getElementById("file");
      const file = fileInput.files ? fileInput.files[0] : null;

      const priceAmount = doctorConfig[`price_${serviceType}`] || 150;

      let fileUrl = null;
      let fileName = null;

      if (file) {
        const storageReference = ref(storage, `cases/${Date.now()}_${file.name}`);
        const uploadSnapshot = await uploadBytes(storageReference, file);
        fileUrl = await getDownloadURL(uploadSnapshot.ref);
        fileName = file.name;
      }

      const caseRef = await addDoc(collection(db, "consultations"), {
        serviceType,
        contact,
        childAge: age,
        childWeight: weight,
        symptoms,
        fileUrl,
        fileName,
        price: priceAmount,
        currency: "RON",
        status: "in_asteptare_plata",
        isPaid: false,
        isSimulation: false,
        createdAt: serverTimestamp()
      });

      currentActiveCase = {
        id: caseRef.id,
        serviceType,
        contact,
        childAge: age,
        childWeight: weight,
        symptoms,
        fileUrl,
        fileName,
        price: priceAmount
      };

      document.getElementById("piper-summary-service").innerText =
        serviceType === "externare"
          ? "Bilet Externare"
          : serviceType === "consiliere"
            ? "Consiliere Bebeluşi"
            : "Interpretare Analize";

      document.getElementById("piper-summary-email").innerText = contact;
      document.getElementById("piper-summary-amount").innerText = `${priceAmount} RON`;
      document.getElementById("piper-btn-amount").innerText = `${priceAmount} RON`;

      piperStripeForm.classList.remove("hidden");
      piperSuccessScreen.classList.add("hidden");

      window.switchTab("piper-checkout");
      statusMsg.classList.add("hidden");
      consultForm.reset();
    } catch (err) {
      statusMsg.innerText = "Eroare la trimitere: " + err.message;
      statusMsg.className = "text-center text-xs font-semibold mt-3 text-berryRose";
    } finally {
      submitBtn.disabled = false;
      window.syncPricesAcrossDOM();
    }
  });
}

async function loadCases() {
  if (!casesContainer) return;
  casesContainer.innerHTML = "<p class='text-sm font-medium text-ink/60'>Se citesc dosarele...</p>";

  try {
    const casesQuery = query(collection(db, "consultations"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(casesQuery);

    if (snapshot.empty) {
      casesContainer.innerHTML = "<p class='text-sm font-medium text-ink/60'>Nu există dosare noi în așteptare.</p>";
      return;
    }

    casesContainer.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const isReviewed = data.status === "finalizat";
      const isSimulation = data.isSimulation === true || data.status === "simulare_test";
      const isPaid = data.isPaid === true || data.status === "platit";

      const serviceName = data.serviceType === "externare" 
        ? "Bilet Externare" 
        : data.serviceType === "consiliere" 
          ? "Consiliere" 
          : "Analize Laborator";

      let paymentBadgeHtml = "";
      if (isReviewed) {
        paymentBadgeHtml = `<span class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-800">Finalizat ✓</span>`;
      } else if (isSimulation) {
        paymentBadgeHtml = `<span class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">Simulare Test ⚡</span>`;
      } else if (isPaid) {
        paymentBadgeHtml = `<span class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-leafLight text-leafGreenDark border border-leafGreen/30">Plătit prin Piper ✓</span>`;
      } else {
        paymentBadgeHtml = `<span class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-berryRose border border-rose-200">Așteaptă Plată</span>`;
      }

      const card = document.createElement("div");
      card.className = "bg-white/80 border border-ink/10 rounded-2xl p-4 sm:p-6 flex flex-col justify-between gap-3 sm:gap-4 shadow-sm";
      card.innerHTML = `
        <div class="space-y-2.5 sm:space-y-3">
          <div class="flex justify-between items-start gap-3 sm:gap-4">
            <div>
              <div class="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                ${paymentBadgeHtml}
                <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-ink/70">
                  ${serviceName}
                </span>
                <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-leafGreen/10 text-leafGreen">
                  ${data.price ? data.price + " RON" : "150 RON"}
                </span>
              </div>
              <h4 class="text-base sm:text-lg font-display font-semibold mt-1.5 sm:mt-2 text-ink">${data.contact}</h4>
            </div>
            ${data.fileUrl ? `
              <a href="${data.fileUrl}" target="_blank" class="text-xs font-bold text-leafGreen link-underline shrink-0">
                Fișier
              </a>
            ` : `<span class="text-[11px] font-medium text-ink/40">Fără fișier</span>`}
          </div>
          <p class="text-xs font-medium text-ink/70">
            <b>Vârstă:</b> ${data.childAge} &nbsp;·&nbsp; <b>Greutate:</b> ${data.childWeight || "nespecificată"}
          </p>
          <p class="text-xs font-medium bg-warmSun/10 border border-warmSun/30 rounded-xl p-2.5 sm:p-3 leading-relaxed text-ink">
            ${data.symptoms}
          </p>
        </div>

        <div class="pt-2.5 sm:pt-3 border-t border-ink/10 flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            ${!isReviewed ? `
              <button data-id="${docSnap.id}" data-action="finalize" class="finalize-case-btn bg-leafGreen hover:bg-leafGreenDark text-white px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-bold transition-colors">
                Finalizează
              </button>
            ` : `
              <button data-id="${docSnap.id}" data-action="delete" class="delete-case-btn bg-berryRose/10 hover:bg-berryRose/20 text-berryRose border border-berryRose/30 px-3 py-1.5 rounded-full text-xs font-bold transition-colors">
                Șterge dosarul 🗑️
              </button>
            `}
          </div>
          <span class="text-[10px] font-bold text-ink/40">Notificare: ${doctorConfig.notificationEmail || "ahmadarnaoute1896@gmail.com"}</span>
        </div>
      `;
      casesContainer.appendChild(card);
    });

    document.querySelectorAll(".finalize-case-btn").forEach((button) => {
      button.addEventListener("click", async (e) => {
        const id = e.target.getAttribute("data-id");
        await updateDoc(doc(db, "consultations", id), { 
          status: "finalizat",
          finalizedAt: serverTimestamp()
        });
        loadCases();
      });
    });

    document.querySelectorAll(".delete-case-btn").forEach((button) => {
      button.addEventListener("click", async (e) => {
        const id = e.target.getAttribute("data-id");
        if (confirm("Sigur doriți să ștergeți definitiv acest dosar din baza de date?")) {
          await deleteDoc(doc(db, "consultations", id));
          loadCases();
        }
      });
    });
  } catch (err) {
    casesContainer.innerHTML = `<p class='text-xs font-semibold text-berryRose'>${err.message}</p>`;
  }
}

loadCmsContent();
loadDoctorSettings();
loadArticles();