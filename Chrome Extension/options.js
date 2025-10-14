document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("githubToken");
  const saveBtn = document.getElementById("save");
  const status = document.getElementById("status");

  // 🔹 Wczytaj zapisany token (jeśli istnieje)
  chrome.storage.sync.get("githubToken", (data) => {
    if (data.githubToken) {
      input.value = data.githubToken;
      console.log("🔹 Załadowano token z pamięci.");
    } else {
      console.log("⚠️ Brak zapisanego tokena.");
    }
  });

  // 🔹 Zapisz nowy token po kliknięciu
  saveBtn.addEventListener("click", () => {
    const token = input.value.trim();

    if (!token) {
      status.textContent = "⚠️ Wprowadź token przed zapisaniem.";
      return;
    }

    chrome.storage.sync.set({ githubToken: token }, () => {
      console.log("✅ Token zapisany:", token);
      status.textContent = "✅ Token zapisany!";
      setTimeout(() => (status.textContent = ""), 2000);
    });
  });
});
