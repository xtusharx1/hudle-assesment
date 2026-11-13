import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveRole,
  accountActions,
  loginDestination,
  customerRouteRedirect,
} from "../src/auth-rules.ts";
const states = [
  {
    name: "checking sessions",
    loading: true,
    admin: false,
    customer: false,
    role: "loading",
  },
  {
    name: "restoring an existing login",
    loading: true,
    admin: true,
    customer: true,
    role: "loading",
  },
  {
    name: "signed out",
    loading: false,
    admin: false,
    customer: false,
    role: "guest",
  },
  {
    name: "customer login",
    loading: false,
    admin: false,
    customer: true,
    role: "customer",
  },
  {
    name: "admin login",
    loading: false,
    admin: true,
    customer: false,
    role: "admin",
  },
  {
    name: "legacy overlapping sessions",
    loading: false,
    admin: true,
    customer: true,
    role: "admin",
  },
] as const;
for (const s of states)
  test(s.name + " selects the correct role", () =>
    assert.equal(resolveRole(s.loading, s.admin, s.customer), s.role),
  );
test("admin menu never offers customer authentication or customer booking links", () =>
  assert.deepEqual(
    accountActions("admin").map((a) => a.label),
    ["Admin dashboard", "All bookings", "Log out"],
  ));
test("customer menu contains exactly the requested account actions", () =>
  assert.deepEqual(
    accountActions("customer").map((a) => a.label),
    ["Profile", "My bookings", "Log out"],
  ));
test("guest menu contains only sign-in and sign-up; loading renders neither", () => {
  assert.deepEqual(
    accountActions("guest").map((a) => a.label),
    ["Sign in", "Sign up"],
  );
  assert.deepEqual(accountActions("loading"), []);
});
test("admin access to a customer-only route returns to the admin dashboard", () => {
  for (const path of ["/profile", "/my-bookings", "/booking/HD-123"])
    assert.equal(customerRouteRedirect("admin", path), "/admin/venues");
});
test("guest customer-route redirect retains the requested destination", () =>
  assert.equal(
    customerRouteRedirect("guest", "/my-bookings"),
    "/login?next=%2Fmy-bookings",
  ));
test("authenticated customers may access their pages; loading waits", () => {
  assert.equal(customerRouteRedirect("customer", "/profile"), null);
  assert.equal(customerRouteRedirect("loading", "/profile"), null);
});
test("admin login restores only admin destinations", () => {
  assert.equal(loginDestination("admin", "/admin/bookings"), "/admin/bookings");
  for (const path of [
    "/my-bookings",
    "/profile",
    "/login",
    "/register",
    "/admin/login",
  ])
    assert.equal(loginDestination("admin", path), "/admin/venues");
});
test("customer login preserves a venue selection and rejects admin or login destinations", () => {
  assert.equal(
    loginDestination("customer", "/venues/17?date=2026-11-14&slot=123"),
    "/venues/17?date=2026-11-14&slot=123",
  );
  for (const path of ["/admin/venues", "/admin/login", "/login", "/register"])
    assert.equal(loginDestination("customer", path), "/my-bookings");
});
test("login return paths cannot redirect to another origin", () => {
  for (const role of ["customer", "admin"] as const)
    for (const path of [
      "https://example.com",
      "//example.com",
      "/\\example.com",
      "/\n/example.com",
    ])
      assert.equal(
        loginDestination(role, path),
        role === "admin" ? "/admin/venues" : "/my-bookings",
      );
});
