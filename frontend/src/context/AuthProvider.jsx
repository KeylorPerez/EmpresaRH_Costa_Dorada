/**
 * Proveedor de autenticación. Persiste el token en `localStorage`, expone los
 * datos del usuario y ofrece helpers para login/logout. El decode del JWT se
 * encapsula aquí para que el resto de la app consuma siempre un `user` ya
 * procesado.
 */
import React, { useState, useEffect, useRef } from "react";
import AuthContext from "./AuthContext";
import api from "../api/axiosConfig";
import { decodeJwtPayload, decodeJwtPayloadAllowExpired } from "../utils/jwt";

const IDLE_TIMEOUT_MINUTES = Number(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES ?? 15);
const REFRESH_THRESHOLD_MINUTES = Number(import.meta.env.VITE_REFRESH_THRESHOLD_MINUTES ?? 5);
const HEALTH_CHECK_INTERVAL_MS = 15_000;

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const lastActivityRef = useRef(Date.now());
  const refreshInFlight = useRef(false);

  // Al montar el proveedor, intenta rehidratar la sesión guardada en el
  // almacenamiento local para mantener al usuario autenticado tras recargas.
  useEffect(() => {
    const rehydrateSession = async () => {
      const storedToken = localStorage.getItem("token");

      if (storedToken) {
        try {
          decodeJwtPayload(storedToken);
          const { data } = await api.get("/auth/me");

          setUser(data);
          setToken(storedToken);
          lastActivityRef.current = Date.now();
        } catch (error) {
          console.error("Error rehidratando la sesión", error);
          localStorage.removeItem("token");
          setUser(null);
          setToken(null);
        }
      }

      setLoading(false);
    };

    rehydrateSession();
  }, []);

  const loginUser = (userData, jwtToken) => {
    setUser(userData);
    setToken(jwtToken);
    lastActivityRef.current = Date.now();
    localStorage.setItem("token", jwtToken);
  };

  const logoutUser = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("token");
  };

  const refreshSession = async () => {
    if (refreshInFlight.current) return;

    refreshInFlight.current = true;
    try {
      const { data } = await api.post("/auth/refresh");

      if (data?.token && data?.user) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem("token", data.token);
        lastActivityRef.current = Date.now();
      }
    } catch (error) {
      console.error("No se pudo refrescar la sesión", error);
      logoutUser();
      window.location.href = "/login";
    } finally {
      refreshInFlight.current = false;
    }
  };

  useEffect(() => {
    if (!token) return undefined;

    const idleTimeoutMs = IDLE_TIMEOUT_MINUTES * 60 * 1000;
    const refreshThresholdSeconds = REFRESH_THRESHOLD_MINUTES * 60;

    const activityEvents = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    const registerActivity = () => {
      lastActivityRef.current = Date.now();
    };

    activityEvents.forEach((event) => window.addEventListener(event, registerActivity));

    const healthCheck = setInterval(() => {
      const now = Date.now();
      const idleTime = now - lastActivityRef.current;

      if (idleTime >= idleTimeoutMs) {
        logoutUser();
        window.location.href = "/login";
        return;
      }

      try {
        const payload = decodeJwtPayloadAllowExpired(token);
        const secondsRemaining = payload.exp - Math.floor(now / 1000);

        if (secondsRemaining <= refreshThresholdSeconds) {
          refreshSession();
        }
      } catch (error) {
        console.error("No se pudo leer el token", error);
        logoutUser();
        window.location.href = "/login";
      }
    }, HEALTH_CHECK_INTERVAL_MS);

    return () => {
      clearInterval(healthCheck);
      activityEvents.forEach((event) => window.removeEventListener(event, registerActivity));
    };
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, loading, loginUser, logoutUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
