document.addEventListener("DOMContentLoaded", async () => {
  console.log("✅ popup.js działa!");

  const REPO = "sempty07/price-tracker"; // Twój login/repo
  const modal = document.getElementById("modal");
  const nameInput = document.getElementById("product-name");
  const priceInput = document.getElementById("product-price");
  const selectorInput = document.getElementById("price-selector");
  const refreshButton = document.getElementById("refresh-price");
  const addButton = document.getElementById("add-product");
  const statusBox = document.getElementById("status");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  async function fetchProductData(selector = null) {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (customSelector) => {
        const url = window.location.href;
        const title = document.querySelector("h1")?.innerText || document.title || "Nieznany produkt";

        let el, priceText = "";
        if (customSelector) el = document.querySelector(customSelector);
        else el = document.querySelector("[itemprop='price'], .price, .product-price");

        if (!el) return { url, title, price: 0 };
        priceText = el.textContent || el.innerText || "";
        priceText = priceText.replace(/\s/g, "").replace(",", ".").replace(/[^\d.]/g, "");
        const price = parseFloat(priceText) || 0;

        return { url, title, price };
      },
      args: [selector],
    });
    return result;
  }

  // Wypełnienie pola produktu i wstępnej ceny
  const product = await fetchProductData();
  nameInput.value = product.title;
  priceInput.value = product.price > 0 ? product.price : "Nie znaleziono";
  statusBox.textContent = product.price > 0 ? `💰 Znaleziono cenę: ${product.price} zł` : "⚠️ Nie znaleziono ceny";
  statusBox.className = product.price > 0 ? "ok" : "error";

  // Odświeżanie ceny
  refreshButton.addEventListener("click", async () => {
    const selector = selectorInput.value.trim();
    if (!selector) { alert("Podaj selektor CSS"); return; }
    const updatedProduct = await fetchProductData(selector);
    priceInput.value = updatedProduct.price > 0 ? updatedProduct.price : "Nie znaleziono";
    statusBox.textContent = updatedProduct.price > 0 ? `✅ Znaleziono nową cenę: ${updatedProduct.price} zł` : "❌ Nie udało się pobrać ceny";
    statusBox.className = updatedProduct.price > 0 ? "ok" : "error";
  });

  function utf8_to_b64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  // Dodawanie produktu do GitHub
  addButton.addEventListener("click", async () => {
    try {
      const { githubToken } = await chrome.storage.sync.get(["githubToken"]);
      if (!githubToken) { alert("Brak tokena GitHub"); return; }

      const res = await fetch(`https://api.github.com/repos/${REPO}/contents/data/produkty.json`, {
        headers: { Authorization: `token ${githubToken}` },
      });
      if (!res.ok) throw new Error("Nie udało się pobrać pliku JSON: " + res.status);
      const data = await res.json();
      const sha = data.sha;
      const content = atob(data.content);
      const products = JSON.parse(content);

      const newId = products.length > 0 ? Math.max(...products.map(p => p.id || 0)) + 1 : 1;
      const now = new Date().toISOString();

      const newProduct = {
        id: newId,
        name: nameInput.value.trim(),
        url: product.url,
        price: parseFloat(priceInput.value) || 0,
        price_selector: selectorInput.value.trim() || null,
        last_updated: now,
      };

      products.push(newProduct);
      const updatedContent = utf8_to_b64(JSON.stringify(products, null, 2));

      const updateRes = await fetch(`https://api.github.com/repos/${REPO}/contents/data/produkty.json`, {
        method: "PUT",
        headers: {
          Authorization: `token ${githubToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: `Dodano produkt: ${newProduct.name}`, content: updatedContent, sha }),
      });
      if (!updateRes.ok) throw new Error("Błąd zapisu: " + updateRes.status);

      addButton.innerText = "✅ Zapisano!";
      addButton.disabled = true;
      statusBox.textContent = `✅ Produkt ${newProduct.name} został zapisany.`;
      statusBox.className = "ok";

      // Auto-zamknięcie po 5 sekundach
      setTimeout(() => { modal.style.display = "none"; }, 5000);

    } catch (err) {
      console.error("❌ Błąd:", err);
      statusBox.textContent = "❌ " + err.message;
      statusBox.className = "error";
    }
  });
});
