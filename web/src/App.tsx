import { useState, useEffect } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import { ArrowUpRight, MapPin, Menu } from "lucide-react";

import { AuthPage, RequireUser, useAuth } from "./Auth";
import { ProfileMenu, ProfilePage } from "./Account";
import Admin from "./Admin";
import { Discover } from "./pages/Discover";
import { VenueDetails } from "./pages/VenueDetails";
import { Confirmation } from "./pages/Confirmation";
import { MyBookings } from "./pages/MyBookings";

function RouteScroll() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  const location = useLocation();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const isAccountPage = ["/login", "/register"].includes(location.pathname);
  const [menu, setMenu] = useState(false);
  useEffect(() => setMenu(false), [location.pathname]);
  useEffect(() => {
    if (!menu) return;
    document.querySelector<HTMLElement>("#main-navigation a")?.focus();
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
        document.querySelector<HTMLButtonElement>(".mobile-menu")?.focus();
      }
    };
    const outside = (e: PointerEvent) => {
      if (!(e.target as Element).closest("#main-navigation,.mobile-menu"))
        setMenu(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", outside);
    };
  }, [menu]);
  return (
    <>
      <RouteScroll />
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="header">
        <Link
          to={isAdmin ? "/admin/venues" : "/"}
          className="logo"
          aria-label="Hudle home"
        >
          HUDLE<span>↗</span>
        </Link>
        <nav id="main-navigation" className={menu ? "nav open" : "nav"}>
          {role === "loading" ? null : isAdmin ? (
            <>
              <NavLink to="/admin/venues" onClick={() => setMenu(false)}>
                Venues & slots
              </NavLink>
              <NavLink to="/admin/bookings" onClick={() => setMenu(false)}>
                All bookings
              </NavLink>
            </>
          ) : (
            <>
              <NavLink to="/" end onClick={() => setMenu(false)}>
                Discover venues
              </NavLink>
              <NavLink to="/my-bookings" onClick={() => setMenu(false)}>
                My bookings
              </NavLink>
              {role === "guest" && (
                <Link
                  className="mobile-partner-link"
                  to="/admin"
                  onClick={() => setMenu(false)}
                >
                  Venue partners
                </Link>
              )}
            </>
          )}
        </nav>
        <div className="header-right">
          <ProfileMenu />
          {!isAdmin && (
            <span className="city">
              <MapPin size={15} /> Delhi NCR
            </span>
          )}
          {role === "guest" && (
            <Link className="admin-link" to="/admin">
              For venue partners <ArrowUpRight size={15} />
            </Link>
          )}
          <button
            className="mobile-menu icon-btn"
            aria-expanded={menu}
            aria-controls="main-navigation"
            aria-label="Toggle navigation"
            onClick={() => setMenu(!menu)}
          >
            <Menu />
          </button>
        </div>
      </header>
      <div
        id="main-content"
        tabIndex={-1}
        className={"route-transition" + (isAccountPage ? " auth-route" : "")}
        key={location.pathname}
      >
        <Routes>
          <Route
            path="/"
            element={
              isAdmin ? <Navigate to="/admin/venues" replace /> : <Discover />
            }
          />
          <Route
            path="/venues/:id"
            element={
              isAdmin ? (
                <Navigate to="/admin/venues" replace />
              ) : (
                <VenueDetails key={location.pathname + location.search} />
              )
            }
          />
          <Route
            path="/booking/:reference"
            element={
              <RequireUser>
                <Confirmation />
              </RequireUser>
            }
          />
          <Route
            path="/my-bookings"
            element={
              <RequireUser>
                <MyBookings />
              </RequireUser>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireUser>
                <ProfilePage />
              </RequireUser>
            }
          />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/register" element={<AuthPage register />} />
          <Route path="/admin/*" element={<Admin />} />
          <Route
            path="*"
            element={
              <main className="page empty">
                <h1>Out of bounds.</h1>
                <Link className="btn" to="/">
                  Back to discovery
                </Link>
              </main>
            }
          />
        </Routes>
      </div>
      {!isAccountPage && !isAdmin && (
        <footer>
          <Link to="/" className="logo">
            HUDLE<span>↗</span>
          </Link>
          <span>A little less scrolling. A lot more playing.</span>
          <small>
            Made for the love of the game. © {new Date().getFullYear()}
          </small>
        </footer>
      )}
    </>
  );
}
