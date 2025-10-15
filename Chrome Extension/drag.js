const modal = document.getElementById("modal");
const header = document.getElementById("modal-header");

let offsetX = 0, offsetY = 0, isDown = false;

header.addEventListener("mousedown", function(e) {
  isDown = true;
  offsetX = e.clientX - modal.offsetLeft;
  offsetY = e.clientY - modal.offsetTop;
});

document.addEventListener("mouseup", () => { isDown = false; });

document.addEventListener("mousemove", function(e) {
  if (!isDown) return;
  modal.style.left = (e.clientX - offsetX) + "px";
  modal.style.top = (e.clientY - offsetY) + "px";
});

// Zamknięcie ręczne
document.getElementById("close-btn").addEventListener("click", () => {
  modal.style.display = "none";
});
