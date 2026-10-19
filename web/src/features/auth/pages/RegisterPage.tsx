import {
  ArrowRight,
  Loader2,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../../app/providers/AuthProvider";
import { Button } from "../../../components/ui/Button";
import { Notice } from "../../../components/ui/Notice";
import { AuthField } from "../components/AuthField";
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
      description="Prepara tu espacio para comenzar a crear."
    >
      <form className="grid gap-5" onSubmit={submit}>
        <Notice message={error} tone="error" />
        <AuthField
          label="Nombre completo"
          icon={UserRound}
          name="name"
          placeholder="Tu nombre"
          maxLength={120}
          required
          autoComplete="name"
        />
        <AuthField
          label="Correo"
          icon={Mail}
          name="email"
          type="email"
          placeholder="nombre@correo.com"
          required
          autoComplete="email"
        />
        <AuthField
          label="Contrasena"
          icon={LockKeyhole}
          name="password"
          minLength={6}
          required
          autoComplete="new-password"
          revealable
        />
        <Button className="h-12 w-full" type="submit" disabled={busy}>
          {busy ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <ArrowRight size={18} />
          )}
          {busy ? "Creando..." : "Crear cuenta"}
        </Button>
        <div className="flex items-center justify-center gap-2 border-t border-zinc-200 pt-5 text-sm dark:border-white/10">
          <span className="text-zinc-500 dark:text-zinc-400">
            Ya tienes una cuenta?
          </span>
          <Link
            className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
            to="/login"
          >
            Iniciar sesion
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
