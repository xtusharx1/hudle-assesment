import { ApiError } from "./api";
export function Status({
  error,
  loading,
  retry,
}: {
  error?: Error | null;
  loading?: boolean;
  retry?: () => void;
}) {
  return loading ? (
    <div
      className="skeletons"
      role="status"
      aria-label="Loading"
      aria-busy="true"
    >
      <div />
      <div />
      <div />
    </div>
  ) : error ? (
    <div className="notice error" role="alert">
      {error.message}
      <br />
      <small>
        {error instanceof ApiError && error.status >= 400 && error.status < 500
          ? "Please review your details or choose another option."
          : "Please check your connection and try again."}
      </small>
      {retry && (
        <button className="text-btn" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  ) : null;
}
