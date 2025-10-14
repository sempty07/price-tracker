// Główny blok — uruchamia się po załadowaniu popupu
document.addEventListener("DOMContentLoaded", async () => {
  console.log("✅ popup.js działa!");

  // Sprawdź, czy API scripting jest dostępne (ważne dla Manifest V3)
  if (!chrome.scripting) {
    alert("❌ Brak uprawnień do chrome.scripting! Sprawdź manifest.json");
    return;
  }

  // 🔧 ZMIEŃ NA SWOJE REPOZYTORIUM (login/repo)
  const REPO = "sempty07/price-tracker";

  // Pobierz przycisk z popup.html
  const addButton = document.getElementById("add-product");
  if (!addButton) {
    console.error("❌ Nie znaleziono przycisku #add-product w popup.html");
    return;
  }

  // Obsługa kliknięcia w „Dodaj produkt”
  addButton.addEventListener("click", async () => {
    try {
      // 🔹 Pobierz token z pamięci rozszerzenia
      const { githubToken } = await chrome.storage.sync.get(["githubToken"]);
      if (!githubToken) {
        alert("Brak tokena GitHub. Otwórz opcje rozszerzenia i zapisz token.");
        return;
      }

      // 🔹 Pobierz aktualną kartę (stronę produktu)
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // 🔹 Uruchom skrypt na stronie, by pobrać dane produktu
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Pobierz dane ze strony
          const url = window.location.href;
          const title =
            document.querySelector("h1")?.innerText ||
            document.title ||
            "Nieznany produkt";

          // Szukanie ceny — obsługa różnych stron
          const priceElement =
            document.querySelector("[itemprop='price']") ||
            document.querySelector(".price") ||
            document.querySelector(".product-price") ||
            document.querySelector(".a-price .a-offscreen") ||
            document.querySelector("meta[property='product:price:amount']") ||
            document.querySelector(".price-box .price") ||
            document.querySelector(".cena") ||
            document.querySelector(".product__price");

          let price = "0";
          if (priceElement) {
            price =
              priceElement.content ||
              priceElement.innerText?.replace(/[^\d,.,,]/g, "") ||
              "0";
          }

          return { url, title, price };
        },
      });

      console.log("📦 Produkt:", result);

      // 🔹 Pobierz istniejący plik z GitHuba
      const res = await fetch(
        `https://api.github.com/repos/${REPO}/contents/produkty.json`,
        {
          headers: { Authorization: `token ${githubToken}` },
        }
      );

      if (!res.ok) throw new Error("Nie udało się pobrać pliku JSON z repo: " + res.status);

      const data = await res.json();
      const sha = data.sha;
      const content = atob(data.content);
      const products = JSON.parse(content);

      // 🔹 Dodaj nowy produkt do listy
      const now = new Date().toISOString();
      products.push({
        id: Date.now(),
        url: result.url,
        name: result.title,
        price: result.price,
        last_updated: now,
      });

      // 🔹 Zaktualizuj plik na GitHubie
      const updatedContent = btoa(JSON.stringify(products, null, 2));

      const updateRes = await fetch(
        `https://api.github.com/repos/${REPO}/contents/produkty.json`,
        {
          method: "PUT",
          headers: {
            Authorization: `token ${githubToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: `Dodano produkt: ${result.title}`,
            content: updatedContent,
            sha,
          }),
        }
      );

      if (!updateRes.ok)
        throw new Error("Błąd zapisu do GitHub: " + updateRes.status);

      addButton.innerText = "✅ Zapisano!";
      addButton.disabled = true;
      console.log(`✅ Produkt ${result.title} dodany do GitHub.`);
    } catch (err) {
      console.error("❌ Błąd:", err);
      alert("Błąd: " + err.message);
    }
  });
});
