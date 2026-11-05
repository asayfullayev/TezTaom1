
import { useState } from "react";

const API = "https://teztaom-backend.onrender.com";


export default function CourierLogin({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(data.detail || data.message || "Login yoki parol noto‘g‘ri.");
      }

      const token = data.access_token || data.token;

      if (!token) {
        throw new Error("Server javobida token topilmadi.");
      }

      if (data.role && data.role !== "courier") {
        throw new Error("Bu akkaunt kuryer uchun emas.");
      }

      onLogin({
        token,
        username: data.username || username,
        role: data.role || "courier",
      });
    } catch (err) {
      setError(err.message || "Serverga ulanishda xato.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <div style={styles.logo}>T</div>
        <h1 style={styles.title}>TezTaom</h1>
        <p style={styles.subtitle}>Kuryer kabinetiga kirish</p>

        <label style={styles.label}>Login</label>
        <input
          style={styles.input}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Kuryer logini"
          autoComplete="username"
          required
        />

        <label style={styles.label}>Parol</label>
        <input
          style={styles.input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Parol"
          autoComplete="current-password"
          required
        />

        {error && <p style={styles.error}>{error}</p>}

        <button style={styles.button} disabled={loading}>
          {loading ? "Tekshirilmoqda..." : "Kirish →"}
        </button>
      </form>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "#080b13",
    color: "#fff",
    padding: 20,
    fontFamily: "Arial, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 380,
    boxSizing: "border-box",
    padding: 30,
    border: "1px solid #263148",
    borderRadius: 20,
    background: "#111827",
  },
  logo: {
    width: 52,
    height: 52,
    display: "grid",
    placeItems: "center",
    borderRadius: 14,
    background: "#ff641f",
    fontSize: 28,
    fontWeight: 800,
  },
  title: { marginBottom: 5 },
  subtitle: { color: "#9ca3af", marginBottom: 28 },
  label: {
    display: "block",
    margin: "16px 0 8px",
    fontSize: 14,
    fontWeight: 600,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: 13,
    border: "1px solid #303b50",
    borderRadius: 10,
    background: "#0b111d",
    color: "#fff",
    outline: "none",
  },
  button: {
    width: "100%",
    marginTop: 24,
    padding: 14,
    border: 0,
    borderRadius: 10,
    background: "#ff641f",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
  error: { color: "#ff8d8d", fontSize: 14 },
};
