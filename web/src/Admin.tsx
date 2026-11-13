import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Building2, Ticket } from "lucide-react";
import { useAuth } from "./Auth";
import { AdminLogin } from "./pages/AdminLogin";
import { AdminVenues } from "./pages/AdminVenues";
import { AdminSlots } from "./pages/AdminSlots";
import { AdminBookings } from "./pages/AdminBookings";

export default function Admin() {
  const { admin, loading } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <main className="page empty" role="status">
        Loading your account…
      </main>
    );
  if (!admin)
    return location.pathname === "/admin/login" ? (
      <AdminLogin />
    ) : (
      <Navigate
        to={
          "/admin/login?next=" +
          encodeURIComponent(location.pathname + location.search)
        }
        replace
      />
    );
  return (
    <main className="page admin-page content-transition">
      <div className="admin-top">
        <div>
          <span className="eyebrow green">THE OTHER SIDE OF THE GAME</span>
          <h1>Partner dashboard.</h1>
          <p>Great games start with well-run spaces.</p>
        </div>
      </div>
      <nav className="admin-nav">
        <Link to="/admin/venues">
          <Building2 size={16} />
          Venues & slots
        </Link>
        <Link to="/admin/bookings">
          <Ticket size={16} />
          All bookings
        </Link>
      </nav>
      <Routes>
        <Route index element={<Navigate to="venues" replace />} />
        <Route path="login" element={<Navigate to="/admin/venues" replace />} />
        <Route path="venues" element={<AdminVenues />} />
        <Route path="venues/:id/slots" element={<AdminSlots />} />
        <Route path="bookings" element={<AdminBookings />} />
        <Route path="*" element={<Navigate to="/admin/venues" replace />} />
      </Routes>
    </main>
  );
}
