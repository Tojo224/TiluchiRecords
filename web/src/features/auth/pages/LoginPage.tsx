import { ArrowRight, Loader2, LockKeyhole, Mail } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../app/providers/AuthProvider";
import { Button } from "../../../components/ui/Button";
import { Notice } from "../../../components/ui/Notice";
import { AuthField } from "../components/AuthField";
import { AuthShell } from "../components/AuthShell";

export function LoginPage() {
  const { user, authenticate } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const routeMessage = (location.state as { message?: string } | null)?.message;

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
      navigate(
        (location.state as { from?: string } | null)?.from || "/dashboard",
        {
          replace: true,
        },
      );
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Iniciar sesion"
      description="Continua trabajando en tus proyectos y producciones."
    >
      <form className="grid gap-5" onSubmit={submit}>
        <Notice message={error} tone="error" />
        <Notice message={routeMessage || ""} />
        <AuthField
          label="Correo"
          icon={Mail}
          name="email"
          type="email"
          placeholder="nombre@correo.com"
          required
          autoComplete="email"
        />
        <div className="grid gap-2">
          <AuthField
            label="Contrasena"
            icon={LockKeyhole}
            name="password"
            minLength={6}
            required
            autoComplete="current-password"
            revealable
          />
          <Link
            className="justify-self-end text-sm font-medium text-emerald-700 transition hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
            to="/forgot-password"
          >
            Olvide mi contrasena
          </Link>
        </div>
        <Button className="h-12 w-full" type="submit" disabled={busy}>
          {busy ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <ArrowRight size={18} />
          )}
          {busy ? "Ingresando..." : "Ingresar"}
        </Button>
        <div className="flex items-center justify-center gap-2 border-t border-zinc-200 pt-5 text-sm dark:border-white/10">
          <span className="text-zinc-500 dark:text-zinc-400">
            No tienes una cuenta?
          </span>
          <Link
            className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
            to="/register"
          >
            Crear cuenta
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
