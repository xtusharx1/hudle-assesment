import { Dialog } from "../Dialog";

export function AdminModal({
  title,
  close,
  children,
  busy = false,
}: {
  title: string;
  close: () => void;
  busy?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Dialog title={title} close={close} busy={busy} wide>
      {children}
    </Dialog>
  );
}
