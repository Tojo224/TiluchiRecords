import { FormEvent, useEffect, useState } from "react";
import { LockKeyhole, Save, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "../../../app/providers/AuthProvider";
import { Button } from "../../../components/ui/Button";
import { Notice } from "../../../components/ui/Notice";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Panel } from "../../../components/ui/Panel";
import type { User } from "../../../shared/types/domain";

type ProfileForm = {
  name: string;
  email: string;
  phone: string;
};

const inputClass =
  "mt-2 w-full border-zinc-300 bg-white text-zinc-950 dark:border-white/15 dark:bg-[#070b0d] dark:text-white";

export function ProfilePage() {
  const { user, api, updateUser } = useAuth();
  const [profile, setProfile] = useState<ProfileForm>({
    name: "",
    email: "",
    phone: "",
  });
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!user) return;
    setProfile({
      name: user.name || "",
      email: user.email,
      phone: user.phone || "",
    });
  }, [user]);

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError("");
    setProfileMessage("");
    setSavingProfile(true);

    try {
      const updated = await api<User>("/users/me", {
        method: "PATCH",
        body: JSON.stringify(profile),
      });
      updateUser(updated);
      setProfileMessage("Datos personales actualizados.");
    } catch (error) {
      setProfileError((error as Error).message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError("");
    setPasswordMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const currentPassword = String(data.get("currentPassword") || "");
    const newPassword = String(data.get("newPassword") || "");
    const confirmPassword = String(data.get("confirmPassword") || "");

    if (newPassword !== confirmPassword) {
      setPasswordError("La nueva contrasena y su confirmacion no coinciden.");
      return;
    }

    setSavingPassword(true);
    try {
      await api<{ message: string }>("/users/me/password", {
        method: "PATCH",
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      form.reset();
      setPasswordMessage("Contrasena actualizada correctamente.");
    } catch (error) {
      setPasswordError((error as Error).message);
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Mi perfil"
        description="Administra tus datos personales y la seguridad de tu cuenta."
      />

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Panel className="overflow-hidden p-0">
          <div className="flex items-center gap-3 border-b border-zinc-200 p-5 dark:border-white/10">
            <span className="grid size-11 shrink-0 place-items-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              <UserRound size={22} />
            </span>
            <div>
              <h2 className="font-semibold text-zinc-950 dark:text-white">
                Datos personales
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Informacion asociada a tu cuenta.
              </p>
            </div>
          </div>

          <form className="grid gap-5 p-5" onSubmit={submitProfile}>
            <Notice message={profileMessage} tone="success" />
            <Notice message={profileError} tone="error" />
            <label className="text-sm font-medium">
              Nombre completo
              <input
                className={inputClass}
                name="name"
                autoComplete="name"
                value={profile.name}
                maxLength={120}
                required
                onChange={(event) =>
                  setProfile((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </label>
            <label className="text-sm font-medium">
              Correo electronico
              <input
                className={inputClass}
                name="email"
                type="email"
                autoComplete="email"
                value={profile.email}
                maxLength={254}
                required
                onChange={(event) =>
                  setProfile((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
              />
            </label>
            <label className="text-sm font-medium">
              Telefono
              <input
                className={inputClass}
                name="phone"
                type="tel"
                autoComplete="tel"
                value={profile.phone}
                maxLength={30}
                placeholder="Ej. +591 70000000"
                onChange={(event) =>
                  setProfile((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
              />
            </label>
            <div className="flex justify-end border-t border-zinc-200 pt-5 dark:border-white/10">
              <Button type="submit" disabled={savingProfile}>
                <Save size={18} />
                {savingProfile ? "Guardando..." : "Guardar datos"}
              </Button>
            </div>
          </form>
        </Panel>

        <Panel className="overflow-hidden p-0">
          <div className="flex items-center gap-3 border-b border-zinc-200 p-5 dark:border-white/10">
            <span className="grid size-11 shrink-0 place-items-center rounded-md bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300">
              <ShieldCheck size={22} />
            </span>
            <div>
              <h2 className="font-semibold text-zinc-950 dark:text-white">
                Seguridad de la cuenta
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Cambia tu contrasena verificando la actual.
              </p>
            </div>
          </div>

          <form className="grid gap-5 p-5" onSubmit={submitPassword}>
            <Notice message={passwordMessage} tone="success" />
            <Notice message={passwordError} tone="error" />
            <label className="text-sm font-medium">
              Contrasena actual
              <input
                className={inputClass}
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                minLength={6}
                required
              />
            </label>
            <label className="text-sm font-medium">
              Nueva contrasena
              <input
                className={inputClass}
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </label>
            <label className="text-sm font-medium">
              Confirmar nueva contrasena
              <input
                className={inputClass}
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </label>
            <div className="flex justify-end border-t border-zinc-200 pt-5 dark:border-white/10">
              <Button type="submit" disabled={savingPassword}>
                <LockKeyhole size={18} />
                {savingPassword ? "Actualizando..." : "Cambiar contrasena"}
              </Button>
            </div>
          </form>
        </Panel>
      </div>
    </>
  );
}
