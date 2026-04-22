// src/supabase.js
// Supabase client — reads credentials from environment variables

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn("⚠️ Supabase env vars not set. Real-time sync disabled.");
}

// Lightweight fetch wrapper around Supabase REST API
// (no npm package needed — pure fetch)

export const db = {
  // ── TRIPS ──
  async getTrips() {
    const r = await supaFetch("GET", "/trips?order=created_at.desc");
    return r || [];
  },
  async createTrip(trip) {
    return supaFetch("POST", "/trips", trip);
  },
  async deleteTrip(id) {
    return supaFetch("DELETE", `/trips?id=eq.${id}`);
  },

  // ── MEMBERS ──
  async getMembers(tripId) {
    const r = await supaFetch("GET", `/members?trip_id=eq.${tripId}&order=created_at.asc`);
    return r || [];
  },
  async addMember(member) {
    return supaFetch("POST", "/members", member);
  },
  async deleteMember(id) {
    return supaFetch("DELETE", `/members?id=eq.${id}`);
  },

  // ── EXPENSES ──
  async getExpenses(tripId) {
    const r = await supaFetch("GET", `/expenses?trip_id=eq.${tripId}&order=created_at.asc`);
    return r || [];
  },
  async addExpense(expense) {
    return supaFetch("POST", "/expenses", expense);
  },
  async deleteExpense(id) {
    return supaFetch("DELETE", `/expenses?id=eq.${id}`);
  },

  // ── PAYMENTS ──
  async getPayments(tripId) {
    const r = await supaFetch("GET", `/payments?trip_id=eq.${tripId}&order=created_at.asc`);
    return r || [];
  },
  async addPayment(payment) {
    return supaFetch("POST", "/payments", payment);
  },

  // ── REALTIME ──
  subscribe(table, tripId, callback) {
    if (!SUPABASE_URL || !SUPABASE_KEY) return () => {};
    const url = `${SUPABASE_URL}/realtime/v1/websocket?apikey=${SUPABASE_KEY}&vsn=1.0.0`
      .replace("https://", "wss://").replace("http://", "ws://");
    const ws = new WebSocket(url);
    const channel = `realtime:public:${table}:trip_id=eq.${tripId}`;

    ws.onopen = () => {
      ws.send(JSON.stringify({ topic: channel, event: "phx_join", payload: {}, ref: "1" }));
    };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.event === "INSERT" || msg.event === "UPDATE" || msg.event === "DELETE") {
          callback(msg.event, msg.payload?.record, msg.payload?.old_record);
        }
      } catch {}
    };
    ws.onerror = () => {};
    return () => { try { ws.close(); } catch {} };
  }
};

async function supaFetch(method, path, body) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
      method,
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": method === "POST" ? "return=representation" : "",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204 || res.status === 200 && method === "DELETE") return true;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch (e) {
    console.error("Supabase error:", e);
    return null;
  }
}
