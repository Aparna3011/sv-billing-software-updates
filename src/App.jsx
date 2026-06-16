import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "./store/useAuthStore";
import AppLayout from "./layouts/AppLayout";
import Login from "./pages/Auth/Login";
import routes from "./router/routes";
import Analytics from "./pages/Analytics/Analytics";

export default function App() {
  const user = useAuthStore((state) => state.user);
  useEffect(() => {
    const disableNumberScroll = (event) => {
      if (document.activeElement?.type === "number") {
        document.activeElement.blur();
      }
    };

    window.addEventListener("wheel", disableNumberScroll, {
      passive: true,
    });

    return () => {
      window.removeEventListener("wheel", disableNumberScroll);
    };
  }, []);
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <Login />}
        />
        <Route
          path="/"
          element={user ? <AppLayout /> : <Navigate to="/login" replace />}
        >
          <Route path="analytics" element={<Analytics />} />
          {routes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={<route.element />}
            />
          ))}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
