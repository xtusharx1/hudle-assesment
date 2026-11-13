import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ShieldCheck } from "lucide-react";

export function BookingPending({
  venue,
  when,
}: {
  venue: string;
  when: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return createPortal(
    <div className="booking-pending-backdrop">
      <div
        className="booking-pending-panel"
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-pending-title"
        aria-describedby="booking-pending-description"
        onKeyDown={(e) => {
          if (e.key === "Tab") e.preventDefault();
        }}
      >
        <div className="rally-court" aria-hidden="true">
          <div className="rally-court-lines" />
          <div className="rally-net" />
          <div className="rally-ball" />
          <span className="rally-mark">H</span>
        </div>
        <span className="eyebrow green">YOUR NEXT GAME IS ON ITS WAY</span>
        <h2 id="booking-pending-title">Getting your game ready.</h2>
        <p id="booking-pending-description" role="status" aria-live="polite">
          Reserving your playtime. Hang tight.
        </p>
        <div className="booking-pending-summary">
          <strong>{venue}</strong>
          <span>{when}</span>
        </div>
        <div className="booking-pending-track" aria-hidden="true">
          <span />
        </div>
        <small>
          <ShieldCheck size={14} />
          Please keep this page open while we confirm.
        </small>
      </div>
    </div>,
    document.body,
  );
}
