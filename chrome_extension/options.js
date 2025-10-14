// Zapis tokena do chrome.storage
document.getElementById("save").addEventListener("click", () => {
  const token = document.getElementById("token").value;
  chrome.storage.local.set({githubToken: token}, () => {
    alert("Token zapisany!");
  });
});

// Automatyczne wczytanie tokena przy otwarciu opcji
chrome.storage.local.get(["githubToken"], (result) => {
  if (result.githubToken) {
    document.getElementById("token").value = result.githubToken;
  }
});
