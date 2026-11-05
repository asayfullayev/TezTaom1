
import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./admin/admin.css";

import App from "./App.jsx";
import AdminLogin from "./admin/AdminLogin.jsx";
import AdminDashboard from "./admin/AdminDashboard.jsx";
import CourierLogin from "./courier/CourierLogin.jsx";
import CourierDashboard from "./courier/CourierDashboard.jsx";

const API = "https://teztaom-backend.onrender.com";

function AdminRoot() {
  const [token, setToken] = useState(
    () => sessionStorage.getItem("teztaom_admin_token") || ""
  );
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [path, setPath] = useState(window.location.pathname);
  const isLoginPage = path === "/admin/login";
  const logout = useCallback(() => {
    sessionStorage.removeItem("teztaom_admin_token");
    setToken("");
    setUser(null);
    window.history.replaceState({}, "", "/admin/login");
    setPath("/admin/login");
  }, []);

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      if (!token) {
        setUser(null);
        setChecking(false);
        return;
      }

      setChecking(true);

      try {
        const response = await fetch(`${API}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();

        if (!response.ok || data.user?.role !== "admin") {
          throw new Error("Admin sessiyasi yaroqsiz.");
        }

        if (!cancelled) setUser(data.user);
      } catch {
        sessionStorage.removeItem("teztaom_admin_token");
        if (!cancelled) {
          setToken("");
          setUser(null);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    verify();
    return () => {
      cancelled = true;
    };
  }, [token]);

  function navigate(url) {
    window.history.pushState({}, "", url);
    setPath(url);
  }

  function handleLogin(data) {
    sessionStorage.setItem("teztaom_admin_token", data.access_token);
    setToken(data.access_token);
    setUser({ username: data.username, role: data.role });
    navigate("/admin");
  }

  if (
    path !== "/admin" &&
    path !== "/admin/" &&
    path !== "/admin/login"
  ) {
    return <App />;
  }
if (isLoginPage) {
  return <AdminLogin onLogin={handleLogin} />;
}

  if (checking) {
    return <div className="admin-login-page">Sessiya tekshirilmoqda...</div>;
  }

  if (!user || !token) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return <AdminDashboard token={token} onLogout={logout} />;
}

function CourierRoot() {
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(
        sessionStorage.getItem("teztaom_courier_session") || "null"
      );
    } catch {
      return null;
    }
  });

  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function verifyCourier() {
      if (!session?.token) {
        setChecking(false);
        return;
      }

      try {
        const response = await fetch(`${API}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${session.token}`,
          },
        });

        const data = await response.json();

        if (!response.ok || data.user?.role !== "courier") {
          throw new Error("Kuryer sessiyasi yaroqsiz.");
        }

        if (!cancelled) {
          setSession((previous) => ({
            ...previous,
            username: data.user.username || previous.username,
            role: data.user.role,
          }));
        }
      } catch {
        sessionStorage.removeItem("teztaom_courier_session");
        if (!cancelled) setSession(null);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    verifyCourier();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleLogin(data) {
    const nextSession = {
      token: data.token || data.access_token,
      username: data.username,
      role: data.role || "courier",
    };

    sessionStorage.setItem(
      "teztaom_courier_session",
      JSON.stringify(nextSession)
    );

    setSession(nextSession);
  }

  function logout() {
    sessionStorage.removeItem("teztaom_courier_session");
    setSession(null);
  }

  if (checking) {
    return <div className="admin-login-page">Kuryer sessiyasi tekshirilmoqda...</div>;
  }

  if (!session?.token) {
    return <CourierLogin onLogin={handleLogin} />;
  }

  return (
    <CourierDashboard
      token={session.token}
      username={session.username}
      onLogout={logout}
    />
  );
}

function Root() {
  const path = window.location.pathname;

  if (path.startsWith("/admin")) {
    return <AdminRoot />;
  }

  if (path.startsWith("/courier")) {
    return <CourierRoot />;
  }

  return <App />;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
