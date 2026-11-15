const form = document.getElementById("loginForm");
const msg = document.getElementById("loginMessage");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  try {
    const res = await fetch("api/login.php", {
      method: "POST",
      body: JSON.stringify({
        username: document.getElementById("username").value,
        password: document.getElementById("password").value,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      msg.textContent = data.error || "Login failed";
      msg.className = "message error";
      return;
    }

    window.location.href = "index.html";
  } catch (err) {
    msg.textContent = "Could not reach the server";
    msg.className = "message error";
  }
});