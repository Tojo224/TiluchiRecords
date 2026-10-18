import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../../app/providers/AuthProvider";
import { Button } from "../../../components/ui/Button";
import { Notice } from "../../../components/ui/Notice";
import { AuthShell } from "../components/AuthShell";

export function RegisterPage() {
  const { user, authenticate } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (user) return <Navigate to="/dashboard" replace />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await authenticate("register", {
        name: String(form.get("name")),
        email: String(form.get("email")),
        password: String(form.get("password")),
      });
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthShell
      title="Crear cuenta"
      description="Comienza a organizar tus proyectos creativos."
    >
      <form className="grid gap-4" onSubmit={submit}>
        <Notice message={error} tone="error" />
        <label>
          Nombre
          <input name="name" maxLength={120} required />
        </label>
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
            autoComplete="new-password"
          />
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? "Creando..." : "Crear cuenta"}
        </Button>
        <Link
          className="text-center text-sm text-emerald-700 hover:underline dark:text-emerald-400"
          to="/login"
        >
          Ya tengo una cuenta
        </Link>
      </form>
    </AuthShell>
  );
}
