export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
export async function readResponse<T>(r: Response): Promise<T> {
  let data: any;
  try {
    data = await r.json();
  } catch {
    throw new ApiError(
      "The server is temporarily unavailable. Please try again.",
      r.status,
    );
  }
  if (!r.ok)
    throw new ApiError(
      Array.isArray(data?.error?.message)
        ? data.error.message.join(". ")
        : data?.error?.message || "Something went wrong",
      r.status,
    );
  return data;
}
