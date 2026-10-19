import {
  ArrowLeft,
  ArrowRight,
  KeyRound,
  Loader2,
  LockKeyhole,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { Notice } from "../../../components/ui/Notice";
import { apiRequest } from "../../../shared/api/client";
import { AuthField } from "../components/AuthField";
import { AuthShell } from "../components/AuthShell";

export function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await apiRequest("/auth/password-reset/confirm", {
        method: "POST",
        body: JSON.stringify({
          token: String(form.get("token")),
          newPassword: String(form.get("newPassword")),
        }),
      });
      navigate("/login", {
        replace: true,
        state: { message: "Contrasena actualizada." },
      });
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Nueva contrasena"
      description="Completa la verificacion y define una nueva clave de acceso."
    >
      <form className="grid gap-5" onSubmit={submit}>
        <Notice message={error} tone="error" />
        <AuthField
          label="Token de recuperacion"
          icon={KeyRound}
          name="token"
          defaultValue={
            (location.state as { token?: string } | null)?.token || ""
          }
          required
          autoComplete="one-time-code"
        />
        <AuthField
          label="Nueva contrasena"
          icon={LockKeyhole}
          name="newPassword"
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
          {busy ? "Actualizando..." : "Cambiar contrasena"}
        </Button>
        <Link
          className="inline-flex items-center justify-center gap-2 border-t border-zinc-200 pt-5 text-sm font-semibold text-emerald-700 hover:underline dark:border-white/10 dark:text-emerald-400"
          to="/login"
        >
          <ArrowLeft size={16} />
          Volver al ingreso
        </Link>
      </form>
    </AuthShell>
  );
}
