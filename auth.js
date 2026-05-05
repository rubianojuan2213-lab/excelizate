const AUTH_TOKEN_KEY = "excelizateAuthToken";
const authOverlay = document.getElementById("authOverlay");
const authStatus = document.getElementById("authStatus");
const userChip = document.getElementById("userChip");
const userAvatar = document.getElementById("userAvatar");
const userName = document.getElementById("userName");
const userEmail = document.getElementById("userEmail");
const logoutButton = document.getElementById("logoutButton");
const adminDashboardLink = document.getElementById("adminDashboardLink");
const googleReviewButton = document.getElementById("googleReviewButton");

window.currentUser = null;
window.googleClientId = null;
window.googleReviewUrl = "";

function getStoredToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function setStoredToken(token) {
  if (!token) {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    return;
  }

  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

window.getAuthHeaders = function getAuthHeaders() {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

function updateAuthUi(user) {
  window.currentUser = user || null;
  document.dispatchEvent(new CustomEvent("auth:changed", { detail: user || null }));

  if (user) {
    authOverlay?.classList.add("hidden");
    userChip?.classList.remove("hidden");
    adminDashboardLink?.classList.toggle("hidden", !user.isAdmin);

    if (userAvatar) userAvatar.src = user.picture || "logo-excelizatepro.png";
    if (userName) userName.textContent = user.name || "Usuario";
    if (userEmail) userEmail.textContent = user.email || "";
    return;
  }

  authOverlay?.classList.remove("hidden");
  userChip?.classList.add("hidden");
  adminDashboardLink?.classList.add("hidden");
}

async function fetchCurrentUser() {
  const token = getStoredToken();
  if (!token) {
    updateAuthUi(null);
    return null;
  }

  try {
    const response = await fetch("/api/auth/me", {
      headers: window.getAuthHeaders()
    });

    if (!response.ok) {
      setStoredToken("");
      updateAuthUi(null);
      return null;
    }

    const data = await response.json();
    updateAuthUi(data.user);
    return data.user;
  } catch (_error) {
    updateAuthUi(null);
    return null;
  }
}

async function initGoogleLogin() {
  try {
    const configResponse = await fetch("/api/config");
    const config = await configResponse.json();
    window.googleClientId = config.googleClientId;
    window.googleReviewUrl = config.googleReviewUrl || "";

    if (googleReviewButton && window.googleReviewUrl) {
      googleReviewButton.href = window.googleReviewUrl;
      googleReviewButton.classList.remove("hidden");
    }

    if (!window.google?.accounts?.id || !window.googleClientId) {
      authStatus.textContent = "No se pudo cargar Google Sign-In.";
      return;
    }

    window.google.accounts.id.initialize({
      client_id: window.googleClientId,
      callback: async (response) => {
        try {
          const loginResponse = await fetch("/api/auth/google-login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ credential: response.credential })
          });

          const loginData = await loginResponse.json();

          if (!loginResponse.ok) {
            authStatus.textContent = loginData.error || "No se pudo iniciar sesion.";
            return;
          }

          setStoredToken(loginData.token);
          updateAuthUi(loginData.user);
          authStatus.textContent = "Sesion iniciada correctamente.";
        } catch (_error) {
          authStatus.textContent = "No se pudo conectar con el servidor de acceso.";
        }
      }
    });

    window.google.accounts.id.renderButton(
      document.getElementById("googleSignInButton"),
      {
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "signin_with",
        width: 280
      }
    );
  } catch (_error) {
    if (authStatus) {
      authStatus.textContent = "No se pudo cargar la configuracion de acceso.";
    }
  }
}

logoutButton?.addEventListener("click", async () => {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: {
        ...window.getAuthHeaders()
      }
    });
  } catch (_error) {
    // no-op
  }

  setStoredToken("");
  updateAuthUi(null);
});

window.addEventListener("load", () => {
  initGoogleLogin();
  fetchCurrentUser();
});
