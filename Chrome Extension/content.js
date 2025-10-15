// content.js — wstrzyknięty po kliknięciu ikonki
(function() {
  // konfiguracja: zastąp swojego user/repo
  const REPO = "sempty07/price-tracker"; // <-- ZMIEŃ to na swoje repo (np. "sempty07/price-tracker")

  // helper UTF8->Base64
  function utf8_to_b64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  // funkcja tworząca modal (jeśli już istnieje, nie tworzy kolejnego)
  function createModal() {
    if (document.getElementById("pt-modal")) return;

    const modal = document.createElement("div");
    modal.id = "pt-modal";
    Object.assign(modal.style, {
      position: "fixed",
      top: "60px",
      left: "60px",
      width: "360px",
      background: "#f7f7f7",
      border: "1px solid #ccc",
      borderRadius: "8px",
      boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
      zIndex: 2147483647, // bardzo wysoki
      padding: "0",
      fontFamily: "Arial, sans-serif"
    });

    modal.innerHTML = `
      <div id="pt-header" style="background:#007bff;color:white;padding:10px;font-weight:bold;display:flex;justify-content:space-between;align-items:center;user-select:none;cursor:move;border-top-left-radius:8px;border-top-right-radius:8px;">
        Price Tracker
        <span id="pt-close" style="cursor:pointer;font-weight:bold;padding-left:8px;">×</span>
      </div>
      <div style="padding:10px;">
        <label style="display:block;font-weight:600;margin-top:6px;">Nazwa produktu:</label>
        <input type="text" id="pt-name" style="width:100%;padding:6px;margin-top:4px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;">
        <label style="display:block;font-weight:600;margin-top:8px;">Cena:</label>
        <input type="text" id="pt-price" readonly style="width:100%;padding:6px;margin-top:4px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;">
        <label style="display:block;font-weight:600;margin-top:8px;">Selektor CSS ceny:</label>
        <input type="text" id="pt-selector" placeholder="Np. .price, [data-price]" style="width:100%;padding:6px;margin-top:4px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;">
        <button id="pt-refresh" style="width:100%;padding:10px;margin-top:10px;border:none;border-radius:5px;background:#007bff;color:white;cursor:pointer;">🔄 Odśwież cenę</button>
        <button id="pt-add" style="width:100%;padding:10px;margin-top:8px;border:none;border-radius:5px;background:#28a745;color:white;cursor:pointer;">💾 Dodaj produkt</button>
        <div id="pt-status" style="margin-top:10px;min-height:20px;"></div>
      </div>
    `;

    document.body.appendChild(modal);

    // drag
    const header = modal.querySelector('#pt-header');
    let dragging = false, dx = 0, dy = 0;
    header.addEventListener('mousedown', e => { dragging = true; dx = e.clientX - modal.offsetLeft; dy = e.clientY - modal.offsetTop; });
    document.addEventListener('mouseup', () => dragging = false);
    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      modal.style.left = (e.clientX - dx) + 'px';
      modal.style.top = (e.clientY - dy) + 'px';
    });

    // close
    modal.querySelector('#pt-close').addEventListener('click', () => modal.remove());

    // elementy
    const nameInput = modal.querySelector('#pt-name');
    const priceInput = modal.querySelector('#pt-price');
    const selectorInput = modal.querySelector('#pt-selector');
    const refreshBtn = modal.querySelector('#pt-refresh');
    const addBtn = modal.querySelector('#pt-add');
    const statusBox = modal.querySelector('#pt-status');

    // helper getPrice
    function getPriceFromPage(sel) {
      try {
        let el = sel ? document.querySelector(sel) : document.querySelector("[itemprop='price'], .price, .product-price, [data-price]");
        if (!el) return 0;
        let txt = el.textContent || el.innerText || "";
        txt = txt.replace(/\s/g, "").replace(",", ".").replace(/[^\d.]/g, "");
        return parseFloat(txt) || 0;
      } catch (e) {
        return 0;
      }
    }

    // wstępne wypełnienie
    nameInput.value = document.querySelector('h1')?.innerText?.trim() || document.title?.trim() || "Nieznany produkt";
    const initialPrice = getPriceFromPage();
    priceInput.value = initialPrice > 0 ? initialPrice : "Nie znaleziono";
    statusBox.textContent = initialPrice > 0 ? `💰 Cena: ${initialPrice} zł` : "⚠️ Nie znaleziono ceny";
    statusBox.style.color = initialPrice > 0 ? "green" : "darkred";

    // odśwież
    refreshBtn.addEventListener('click', () => {
      const sel = selectorInput.value.trim();
      const price = getPriceFromPage(sel);
      priceInput.value = price > 0 ? price : "Nie znaleziono";
      statusBox.textContent = price > 0 ? `✅ Cena: ${price} zł` : "❌ Nie udało się pobrać ceny";
      statusBox.style.color = price > 0 ? "green" : "darkred";
    });

    // save to GitHub
    addBtn.addEventListener('click', async () => {
      try {
        statusBox.textContent = "⏳ Zapisuję produkt...";
        statusBox.style.color = "black";

        const tokenObj = await new Promise(resolve => chrome.storage.sync.get(['githubToken'], resolve));
        const githubToken = tokenObj.githubToken;
        if (!githubToken) { alert("Brak tokena GitHub. Otwórz opcje rozszerzenia i wklej token."); statusBox.textContent="❌ Brak tokena"; statusBox.style.color="red"; return; }

        // pobierz plik z repo
        const url = `https://api.github.com/repos/${REPO}/contents/data/produkty.json`;
        const res = await fetch(url, { headers: { Authorization: `token ${githubToken}` } });
        if (!res.ok) throw new Error(`Błąd pobierania pliku: ${res.status}`);

        const payload = await res.json();
        const sha = payload.sha;
        const content = atob(payload.content);
        let products = [];
        try { products = JSON.parse(content); if (!Array.isArray(products)) products = []; } catch (e) { products = []; }

        const newId = products.length > 0 ? Math.max(...products.map(p => p.id || 0)) + 1 : 1;
        const now = new Date().toISOString();

        const newProduct = {
          id: newId,
          name: nameInput.value.trim(),
          url: window.location.href,
          price: parseFloat(priceInput.value) || 0,
          price_selector: selectorInput.value.trim() || null,
          last_updated: now
        };

        products.push(newProduct);

        const updatedContent = utf8_to_b64(JSON.stringify(products, null, 2));

        const updateRes = await fetch(url, {
          method: "PUT",
          headers: { Authorization: `token ${githubToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            message: `Dodano produkt: ${newProduct.name}`,
            content: updatedContent,
            sha
          })
        });

        if (!updateRes.ok) {
          const text = await updateRes.text();
          throw new Error(`Błąd zapisu: ${updateRes.status} ${text}`);
        }

        statusBox.textContent = `✅ Produkt zapisany: ${newProduct.name}`;
        statusBox.style.color = "green";
        addBtn.disabled = true;

        // auto close after 5s
        setTimeout(() => {
          try { modal.remove(); } catch(e){/*ignore*/ }
        }, 5000);

      } catch (err) {
        console.error(err);
        statusBox.textContent = "❌ " + (err.message || err);
        statusBox.style.color = "red";
      }
    });
  }

  // Nasłuch — gdy content.js jest wstrzyknięty i można stworzyć modal
  createModal();
})();
