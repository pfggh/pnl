document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  const errorMessage = document.getElementById("error-message");

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    try {
      const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
      if (error) {
        // Display Supabase auth error message
        errorMessage.textContent = error.message;
      } else {
        // On successful login, store login timestamp and redirect
        localStorage.setItem("lastLogin", Date.now().toString());
        window.location.href = "panel.html";
      }
    } catch (err) {
      console.error(err);
      errorMessage.textContent = "An unexpected error occurred.";
    }
  });
});