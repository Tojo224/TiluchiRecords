import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../app/providers/AuthProvider";
import { Button } from "../../../components/ui/Button";
import { Notice } from "../../../components/ui/Notice";
import { AuthShell } from "../components/AuthShell";

export function LoginPage() {
  const { user, authenticate } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (user) return <Navigate to="/dashboard" replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await authenticate("login", {
        email: String(form.get("email")),
        password: String(form.get("password")),
      });
      navigate((location.state as any)?.from || "/dashboard", {
        replace: true,
      });
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Iniciar sesion"
      description="Accede a tus proyectos y producciones."
    >
      <form className="grid gap-4" onSubmit={submit}>
        <Notice message={error} tone="error" />
        <label>
          Correo
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Contrasena
          <input
            name="password"
            type="password"
            minLength={6}
            required
            autoComplete="current-password"
          />
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? "Ingresando..." : "Ingresar"}
        </Button>
        <div className="flex justify-between text-sm">
          <Link
            className="text-emerald-700 hover:underline dark:text-emerald-400"
            to="/forgot-password"
          >
            Recuperar contrasena
          </Link>
          <Link
            className="text-emerald-700 hover:underline dark:text-emerald-400"
            to="/register"
          >
            Crear cuenta
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
