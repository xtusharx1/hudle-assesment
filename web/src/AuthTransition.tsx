import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ShieldCheck } from "lucide-react";
export type AuthAction = "login" | "register" | "logout";
export function AuthTransition({ action }: { action: AuthAction }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);
  const title =
    action === "logout"
      ? "See you at the next game."
      : action === "register"
        ? "You’re joining the game."
        : "Welcome back to the game.";
  return createPortal(
    <dialog
      className="auth-transition"
      ref={dialog}
      aria-labelledby="auth-transition-title"
      aria-describedby="auth-transition-message"
      onCancel={(e) => e.preventDefault()}
    >
      <div className="auth-orbit" aria-hidden="true">
        <span />
        <span />
        <div>
          H<span>↗</span>
        </div>
      </div>
      <span className="eyebrow green">
        {action === "logout" ? "UNTIL NEXT TIME" : "YOUR HUDLE IS READY"}
      </span>
      <h2 id="auth-transition-title">{title}</h2>
      <p role="status" id="auth-transition-message">
        {action === "logout"
          ? "Signing you out securely…"
          : action === "register"
            ? "Creating your player account…"
            : "Getting your account ready…"}
      </p>
      <div className="auth-progress" aria-hidden="true">
        <span />
      </div>
      <small>
        <ShieldCheck size={14} /> Secure account access
      </small>
    </dialog>,
    document.body,
  );
}
