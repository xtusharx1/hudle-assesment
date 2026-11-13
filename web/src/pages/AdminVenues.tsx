import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpRight, Plus, CalendarDays, Pencil, Ban } from "lucide-react";
import { adminApi, Venue, money } from "../api";
import { VenueImage } from "../VenueImage";
import { Status } from "../Status";
import { AdminModal } from "../components/AdminModal";

export function AdminVenues() {
  const [params, setParams] = useSearchParams();
  const pageSize = 5;
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["admin-venues"],
    queryFn: () => adminApi<Venue[]>("/venues"),
  });
  const total = query.data?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const requestedPage = Number(params.get("page") || 1);
  const page = Math.min(
    pageCount,
    Number.isSafeInteger(requestedPage) ? Math.max(1, requestedPage) : 1,
  );
  const start = (page - 1) * pageSize;
  const venues = query.data?.slice(start, start + pageSize);
  function changePage(next: number) {
    const updated = new URLSearchParams(params);
    if (next === 1) updated.delete("page");
    else updated.set("page", String(next));
    setParams(updated);
  }
  const [editing, setEditing] = useState<Venue | null | undefined>(undefined);
  const [deactivate, setDeactivate] = useState<Venue | null>(null);
  const mutation = useMutation({
    mutationFn: (v: Venue) =>
      adminApi(
        "/venues/" + v.id,
        v.is_active
          ? { method: "DELETE" }
          : { method: "PUT", body: JSON.stringify({ is_active: true }) },
      ),
    onSuccess: () => {
      setDeactivate(null);
      client.invalidateQueries({ queryKey: ["admin-venues"] });
      client.invalidateQueries({ queryKey: ["venues"] });
      client.invalidateQueries({ queryKey: ["venue-filters"] });
      client.invalidateQueries({ queryKey: ["venue"] });
      client.invalidateQueries({ queryKey: ["slots"] });
    },
  });
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Your venues</h2>
          <p>Keep the lights on and the courts full.</p>
        </div>
        <button className="btn" onClick={() => setEditing(null)}>
          <Plus size={17} />
          Add venue
        </button>
      </div>
      <Status
        loading={query.isPending}
        error={query.error}
        retry={() => query.refetch()}
      />
      {mutation.error && !deactivate && (
        <div className="notice error" role="alert">
          {mutation.error.message}
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Venue</th>
              <th>Sport</th>
              <th>Price / hour</th>
              <th>Status</th>
              <th>Manage</th>
            </tr>
          </thead>
          <tbody>
            {venues?.map((v) => (
              <tr key={v.id}>
                <td>
                  <div className="table-venue">
                    <VenueImage src={v.image_url} alt="" />
                    <div>
                      <strong>{v.name}</strong>
                      <small>{v.location}</small>
                    </div>
                  </div>
                </td>
                <td>{v.sport}</td>
                <td>{money(v.price_per_hour)}</td>
                <td>
                  <span
                    className={
                      "status-badge " + (!v.is_active ? "cancelled" : "")
                    }
                  >
                    {v.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>
                  <div className="table-actions">
                    <Link
                      className="text-btn"
                      to={`/admin/venues/${v.id}/slots`}
                    >
                      <CalendarDays size={15} />
                      Slots
                    </Link>
                    <button
                      className="icon-btn"
                      title="Edit venue"
                      onClick={() => setEditing(v)}
                    >
                      <Pencil size={15} />
                    </button>
                    {!v.is_active && (
                      <button
                        className="text-btn"
                        disabled={mutation.isPending}
                        onClick={() => {
                          mutation.reset();
                          mutation.mutate(v);
                        }}
                      >
                        Activate
                      </button>
                    )}
                    {!!v.is_active && (
                      <button
                        className="icon-btn danger"
                        title="Deactivate venue"
                        onClick={() => {
                          mutation.reset();
                          setDeactivate(v);
                        }}
                      >
                        <Ban size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {query.data && (
        <nav className="venue-pagination" aria-label="Venue pagination">
          <span role="status">
            {total
              ? `${start + 1}–${Math.min(start + pageSize, total)} of ${total} venues`
              : "No venues yet"}
          </span>
          <div className="pagination-controls">
            <button
              className="text-btn"
              disabled={page === 1}
              onClick={() => changePage(page - 1)}
            >
              Previous
            </button>
            {Array.from({ length: pageCount }, (_, i) => i + 1).map(
              (number) => (
                <button
                  key={number}
                  className="pagination-page"
                  aria-label={`Page ${number}`}
                  aria-current={page === number ? "page" : undefined}
                  onClick={() => changePage(number)}
                >
                  {number}
                </button>
              ),
            )}
            <button
              className="text-btn"
              disabled={page === pageCount}
              onClick={() => changePage(page + 1)}
            >
              Next
            </button>
          </div>
        </nav>
      )}
      {editing !== undefined && (
        <VenueForm venue={editing} close={() => setEditing(undefined)} />
      )}
      {deactivate && (
        <AdminModal
          busy={mutation.isPending}
          title="Take this venue off sale?"
          close={() => setDeactivate(null)}
        >
          <p>
            {deactivate.name} will be hidden from discovery. Existing bookings
            will remain accessible.
          </p>
          {mutation.error && (
            <div className="notice error">{mutation.error.message}</div>
          )}
          <button
            className="btn full"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(deactivate)}
          >
            {mutation.isPending ? "Updating…" : "Deactivate venue"}
          </button>
        </AdminModal>
      )}
    </>
  );
}

function VenueForm({
  venue: v,
  close,
}: {
  venue: Venue | null;
  close: () => void;
}) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (body: any) =>
      adminApi("/venues" + (v ? "/" + v.id : ""), {
        method: v ? "PUT" : "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["admin-venues"] });
      client.invalidateQueries({ queryKey: ["venues"] });
      client.invalidateQueries({ queryKey: ["venue-filters"] });
      client.invalidateQueries({ queryKey: ["venue"] });
      close();
    },
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    mutation.mutate({
      ...Object.fromEntries(f),
      price_per_hour: Math.round(Number(f.get("price_per_hour")) * 100),
    });
  }
  return (
    <AdminModal
      title={v ? "Edit venue" : "A new place to play."}
      close={close}
      busy={mutation.isPending}
    >
      <form onSubmit={submit} className="form-grid">
        <label>
          Venue name
          <input
            name="name"
            defaultValue={v?.name}
            required
            minLength={2}
            maxLength={150}
          />
        </label>
        <label>
          Sport
          <select name="sport" defaultValue={v?.sport}>
            {[
              "Badminton",
              "Football",
              "Tennis",
              "Basketball",
              "Cricket",
              "Swimming",
              "Table Tennis",
              "Pickleball",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Neighbourhood
          <input
            name="location"
            defaultValue={v?.location}
            required
            minLength={2}
            maxLength={100}
          />
        </label>
        <label>
          Price per hour (₹)
          <input
            name="price_per_hour"
            type="number"
            min="0"
            max="100000"
            step="0.01"
            defaultValue={v ? v.price_per_hour / 100 : 650}
            required
          />
        </label>
        <label className="span-2">
          Address
          <input
            name="address"
            defaultValue={v?.address}
            required
            minLength={5}
            maxLength={300}
          />
        </label>
        <label className="span-2">
          Description
          <textarea
            name="description"
            defaultValue={v?.description}
            maxLength={3000}
          />
        </label>
        <label className="span-2">
          Photo URL (HTTPS or bundled image)
          <input
            name="image_url"
            type="text"
            defaultValue={
              v?.image_url ||
              "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1200&q=85"
            }
            required
            pattern="(https://.*|/images/[a-z]+[.]jpg)"
          />
        </label>
        {mutation.error && (
          <div className="notice error span-2">{mutation.error.message}</div>
        )}
        <button className="btn span-2" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save venue"}
          <ArrowUpRight size={17} />
        </button>
      </form>
    </AdminModal>
  );
}
