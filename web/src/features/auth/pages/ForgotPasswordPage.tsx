import { ArrowLeft, ArrowRight, Loader2, Mail } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { Notice } from "../../../components/ui/Notice";
import { apiRequest } from "../../../shared/api/client";
import { AuthField } from "../components/AuthField";
import { AuthShell } from "../components/AuthShell";

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await apiRequest<{
        message: string;
        devResetToken?: string;
      }>("/auth/password-reset/request", {
        method: "POST",
        body: JSON.stringify({ email: String(form.get("email")) }),
      });
      if (result.devResetToken) {
        navigate("/reset-password", {
          state: { token: result.devResetToken },
        });
      } else {
        setMessage(result.message);
      }
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Recuperar contrasena"
      description="Ingresa tu correo para restablecer el acceso a tu cuenta."
    >
      <form className="grid gap-5" onSubmit={submit}>
        <Notice message={message} />
        <AuthField
          label="Correo"
          icon={Mail}
          name="email"
          type="email"
          placeholder="nombre@correo.com"
          required
          autoComplete="email"
        />
        <Button className="h-12 w-full" type="submit" disabled={busy}>
          {busy ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <ArrowRight size={18} />
          )}
          {busy ? "Enviando..." : "Continuar"}
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
