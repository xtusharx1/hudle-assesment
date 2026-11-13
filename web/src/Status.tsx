export function Status({
  error,
  loading,
}: {
  error?: Error | null;
  loading?: boolean;
}) {
  return loading ? (
    <div className="skeletons">
      <div />
      <div />
      <div />
    </div>
  ) : error ? (
    <div className="notice error" role="alert">
      {error.message}
      <br />
      <small>Please check your connection and try again.</small>
    </div>
  ) : null;
}
