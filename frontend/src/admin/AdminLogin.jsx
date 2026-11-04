import "./admin-login.css";
import { useState } from "react";
import { Eye, EyeOff, ArrowRight, LoaderCircle } from "lucide-react";

const API = "http://127.0.0.1:8000";

export default function AdminLogin({ onLogin }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Kirish amalga oshmadi.");
      }

      if (data.role !== "admin") {
        throw new Error("Bu sahifaga faqat admin kira oladi.");
      }

      onLogin(data);
    } catch (err) {
      setError(err.message || "Server bilan bog‘lanib bo‘lmadi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-login-page">
      <div className="admin-login-glow admin-login-glow-one" />
      <div className="admin-login-glow admin-login-glow-two" />

      <section className="admin-login-card">
        <div className="admin-login-topline">
          <span className="admin-login-status-dot" />
          ADMINISTRATOR KIRISHI
        </div>

        <div className="admin-login-brand">
          <div className="admin-login-logo">
            <img src="/logo.png" alt="TezTaom logotipi" />
          </div>

          <span className="admin-login-brand-name">TezTaom</span>
          <span className="admin-login-brand-badge">ADMIN</span>
        </div>

        <div className="admin-login-heading">
          <p className="admin-eyebrow">TEZTAOM MANAGEMENT</p>
          <h1>Boshqaruv paneli</h1>
          <p className="admin-login-subtitle">
            Tizimga kirish uchun login va parolingizni kiriting.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="admin-login-field">
            <label htmlFor="admin-username">Login</label>
            <input
              id="admin-username"
              className="admin-login-input"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Admin loginingiz"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
          </div>

          <div className="admin-login-field">
            <label htmlFor="admin-password">Parol</label>

            <div className="admin-password-field">
              <input
                id="admin-password"
                className="admin-login-input"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Parolingizni kiriting"
                autoComplete="current-password"
                required
              />

              <button
                type="button"
                className="admin-password-toggle"
                onClick={() => setShowPassword((previous) => !previous)}
                aria-label={
                  showPassword ? "Parolni yashirish" : "Parolni ko‘rsatish"
                }
              >
                {showPassword ? (
                  <EyeOff size={19} />
                ) : (
                  <Eye size={19} />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="admin-login-error" role="alert">
              <span className="admin-login-error-mark">!</span>
              <span>{error}</span>
            </div>
          )}

          <button
            className="admin-login-submit"
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <LoaderCircle className="admin-login-spinner" size={19} />
                Tekshirilmoqda...
              </>
            ) : (
              <>
                Tizimga kirish
                <ArrowRight size={19} />
              </>
            )}
          </button>
        </form>

        <div className="admin-login-divider" />

        <footer className="admin-login-footer">
          <span className="admin-login-footer-logo">
            <img src="/logo.png" alt="" />
          </span>

          <div>
            <strong>TezTaom</strong>
            <span>Xavfsiz boshqaruv tizimi</span>
          </div>

          <span className="admin-login-version">ADMIN PANEL</span>
        </footer>
      </section>

      <p className="admin-login-copyright">
        © {new Date().getFullYear()} TezTaom. Barcha huquqlar himoyalangan.
      </p>
    </main>
  );
}
