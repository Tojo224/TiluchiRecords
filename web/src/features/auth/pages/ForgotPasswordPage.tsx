import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { Notice } from "../../../components/ui/Notice";
import { apiRequest } from "../../../shared/api/client";
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
      if (result.devResetToken)
        navigate("/reset-password", { state: { token: result.devResetToken } });
      else setMessage(result.message);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthShell
      title="Recuperar contrasena"
      description="Solicita un token para definir una nueva contrasena."
    >
      <form className="grid gap-4" onSubmit={submit}>
        <Notice message={message} />
        <label>
          Correo
          <input name="email" type="email" required />
        </label>
        <Button type="submit" disabled={busy}>
          Generar token
        </Button>
        <Link
          className="text-center text-sm text-emerald-700 dark:text-emerald-400"
          to="/login"
        >
          Volver al ingreso
        </Link>
      </form>
    </AuthShell>
  );
}
