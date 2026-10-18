import { FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { Notice } from "../../../components/ui/Notice";
import { apiRequest } from "../../../shared/api/client";
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
      description="Completa el token y establece tu nueva clave."
    >
      <form className="grid gap-4" onSubmit={submit}>
        <Notice message={error} tone="error" />
        <label>
          Token
          <input
            name="token"
            defaultValue={(location.state as any)?.token || ""}
            required
          />
        </label>
        <label>
          Nueva contrasena
          <input name="newPassword" type="password" minLength={6} required />
        </label>
        <Button type="submit" disabled={busy}>
          Cambiar contrasena
        </Button>
      </form>
    </AuthShell>
  );
}
