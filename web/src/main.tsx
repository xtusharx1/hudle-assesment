import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./Auth";
import App from "./App";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/hero.css";
import "./styles/venue-cards.css";
import "./styles/discovery.css";
import "./styles/venue-details.css";
import "./styles/booking.css";
import "./styles/bookings.css";
import "./styles/admin.css";
import "./styles/auth.css";
const client = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 15000 },
  },
});
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
