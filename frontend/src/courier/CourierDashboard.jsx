import "./courier.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { 
  Bike,
  CheckCircle2,
  Clock3,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Search,
  Truck,
  LogOut,
  CircleAlert,
  Navigation,
} from "lucide-react";

const API = "http://127.0.0.1:8000";

const STATUSES = [
  { value: "Qabul qilindi", label: "Qabul qilish" },
  { value: "Yo'lda", label: "Yo‘lga chiqdim" },
  { value: "Yetkazildi", label: "Yetkazildi" },
];

const money = (value) =>
  `${Number(value || 0).toLocaleString("uz-UZ")} so‘m`;

function getStatusClass(status) {
  const value = String(status || "").toLocaleLowerCase("uz-UZ");

  if (value.includes("yetkaz")) return "delivered";
  if (value.includes("yo'lda") || value.includes("yo‘lda")) return "on-road";
  if (value.includes("qabul")) return "accepted";
  return "new";
}

export default function CourierDashboard({ token, username, onLogout }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Barchasi");
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const authHeaders = useMemo(
    () => ({ Authorization: `Bearer ${token}` }),
    [token]
  );

  const loadOrders = useCallback(async (silent = false) => {
    if (!token) return;

    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await fetch(`${API}/api/courier/orders`, {
        headers: authHeaders,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail || "Buyurtmalarni yuklab bo‘lmadi."
        );
      }

      const list = Array.isArray(data)
        ? data
        : data.orders || data.items || [];

      setOrders(list);
      setError("");
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || "Server bilan aloqa uzildi.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, authHeaders]);

  useEffect(() => {
    loadOrders();

    const timer = window.setInterval(() => {
      loadOrders(true);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [loadOrders]);

  async function updateStatus(orderId, status) {
    setUpdatingId(orderId);
    setError("");

    try {
      const response = await fetch(
        `${API}/api/courier/orders/${orderId}/status`,
        {
          method: "PATCH",
          headers: {
            ...authHeaders,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.detail || "Buyurtma holatini yangilab bo‘lmadi.");
      }

      await loadOrders(true);
    } catch (err) {
      setError(err.message || "Holatni yangilashda xatolik.");
    } finally {
      setUpdatingId(null);
    }
  }

  const visibleOrders = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("uz-UZ");

    return orders.filter((order) => {
      const status = String(order.status || order.order_status || "Yangi");
      const matchesFilter =
        filter === "Barchasi" ||
        (filter === "Faol" && !status.toLocaleLowerCase("uz-UZ").includes("yetkaz")) ||
        (filter === "Yetkazildi" && status.toLocaleLowerCase("uz-UZ").includes("yetkaz"));

      const matchesSearch =
        !query ||
        [
          order.id,
          order.order_id,
          order.customer_name,
          order.phone,
          order.address,
        ]
          .join(" ")
          .toLocaleLowerCase("uz-UZ")
          .includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [orders, filter, search]);

  const activeCount = orders.filter(
    (order) => getStatusClass(order.status || order.order_status) !== "delivered"
  ).length;

  const deliveredCount = orders.filter(
    (order) => getStatusClass(order.status || order.order_status) === "delivered"
  ).length;

  const totalValue = orders.reduce(
    (sum, order) =>
      sum + Number(order.total_price || order.total || 0),
    0
  );

  function nextAction(order) {
    const status = getStatusClass(order.status || order.order_status);

    if (status === "delivered") return null;
    if (status === "on-road") {
      return STATUSES[2];
    }
    if (status === "accepted") {
      return STATUSES[1];
    }
    return STATUSES[0];
  }

  return (
    <div className="courier-app">
      <aside className="courier-sidebar">
        <div className="courier-brand">
          <div className="courier-logo"><Bike size={26} /></div>
          <div>
            <strong>TezTaom</strong>
            <span>KURYER PANELI</span>
          </div>
        </div>

        <div className="courier-profile">
          <div className="courier-avatar">
            {(username || "K").charAt(0).toUpperCase()}
          </div>
          <div className="courier-profile-copy">
            <strong>{username || "Kuryer"}</strong>
            <span><i /> Tizimda faol</span>
          </div>
        </div>

        <div className="courier-side-label">ISH JARAYONI</div>
        <div className="courier-side-item active">
          <Package size={18} />
          <span>Buyurtmalarim</span>
          <b>{activeCount}</b>
        </div>

        <div className="courier-sidebar-bottom">
          <div className="courier-help">
            <CircleAlert size={18} />
            <span>Buyurtmalar har 5 soniyada yangilanadi.</span>
          </div>
          <button className="courier-logout" onClick={onLogout}>
            <LogOut size={18} /> Chiqish
          </button>
        </div>
      </aside>

      <main className="courier-main">
        <header className="courier-topbar">
          <div>
            <div className="courier-breadcrumb">TEZTAOM / KURYER MARKAZI</div>
            <h1>Mening buyurtmalarim</h1>
            <p>Buyurtmalarni boshqaring va mijozlarga tez yetkazib bering.</p>
          </div>

          <button
            className="courier-refresh"
            onClick={() => loadOrders(true)}
            disabled={refreshing}
          >
            <RefreshCw size={17} className={refreshing ? "courier-spinning" : ""} />
            Yangilash
          </button>
        </header>

        <section className="courier-stats">
          <article className="courier-stat">
            <div className="courier-stat-icon orange"><Package size={21} /></div>
            <span>Jami buyurtmalar</span>
            <strong>{orders.length}</strong>
            <small>Barcha biriktirilgan buyurtmalar</small>
          </article>

          <article className="courier-stat">
            <div className="courier-stat-icon blue"><Clock3 size={21} /></div>
            <span>Faol buyurtmalar</span>
            <strong>{activeCount}</strong>
            <small>Bajarilishi kutilayotgan</small>
          </article>

          <article className="courier-stat">
            <div className="courier-stat-icon green"><CheckCircle2 size={21} /></div>
            <span>Yetkazilgan</span>
            <strong>{deliveredCount}</strong>
            <small>Muvaffaqiyatli topshirilgan</small>
          </article>

          <article className="courier-stat">
            <div className="courier-stat-icon purple"><Truck size={21} /></div>
            <span>Buyurtmalar qiymati</span>
            <strong className="courier-stat-money">{money(totalValue)}</strong>
            <small>Ro‘yxatdagi buyurtmalar jami</small>
          </article>
        </section>

        {error && (
          <div className="courier-error" role="alert">
            <CircleAlert size={18} />
            <span>{error}</span>
            <button onClick={() => loadOrders(true)}>Qayta urinish</button>
          </div>
        )}

        <section className="courier-orders-panel">
          <div className="courier-orders-heading">
            <div>
              <h2>Buyurtmalar ro‘yxati</h2>
              <p>
                {lastUpdated
                  ? `Oxirgi yangilanish: ${lastUpdated.toLocaleTimeString("uz-UZ")}`
                  : "Buyurtmalar yuklanmoqda..."}
              </p>
            </div>
            <div className="courier-live"><i /> Jonli kuzatuv</div>
          </div>

          <div className="courier-toolbar">
            <div className="courier-search">
              <Search size={18} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buyurtma, mijoz yoki telefon..."
              />
            </div>

            <div className="courier-filters">
              {["Barchasi", "Faol", "Yetkazildi"].map((item) => (
                <button
                  key={item}
                  className={filter === item ? "selected" : ""}
                  onClick={() => setFilter(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="courier-empty">
              <RefreshCw size={26} className="courier-spinning" />
              <strong>Buyurtmalar yuklanmoqda...</strong>
            </div>
          ) : visibleOrders.length === 0 ? (
            <div className="courier-empty">
              <Package size={34} />
              <strong>Buyurtmalar topilmadi</strong>
              <p>Filtrni o‘zgartiring yoki keyinroq qayta tekshiring.</p>
            </div>
          ) : (
            <div className="courier-order-list">
              {visibleOrders.map((order) => {
                const orderId = order.id ?? order.order_id;
                const status = order.status || order.order_status || "Yangi";
                const action = nextAction(order);
                const items = Array.isArray(order.items) ? order.items : [];

                return (
                  <article className="courier-order-card" key={orderId}>
                    <div className="courier-order-top">
                      <div>
                        <span className="courier-order-number">BUYURTMA</span>
                        <h3>#{orderId}</h3>
                      </div>
                      <span className={`courier-status ${getStatusClass(status)}`}>
                        <i /> {status}
                      </span>
                    </div>

                    <div className="courier-order-details">
                      <div className="courier-detail">
                        <span>Mijoz</span>
                        <strong>{order.customer_name || order.customer || "Mijoz"}</strong>
                      </div>
                      <div className="courier-detail">
                        <span>Buyurtma turi</span>
                        <strong>{order.order_type === "delivery" ? "Yetkazib berish" : "Olib ketish"}</strong>
                      </div>
                      <div className="courier-detail">
                        <span>Buyurtma summasi</span>
                        <strong className="courier-order-price">
                          {money(order.total_price || order.total)}
                        </strong>
                      </div>
                    </div>

                    {order.phone && (
                      <div className="courier-contact">
                        <Phone size={16} />
                        <a href={`tel:${String(order.phone).replace(/[^\d+]/g, "")}`}>
                          {order.phone}
                        </a>
                      </div>
                    )}

                    {order.address && (
                      <div className="courier-address">
                        <MapPin size={17} />
                        <span>{order.address}</span>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Manzilni xaritada ko‘rish"
                        >
                          <Navigation size={15} /> Xarita
                        </a>
                      </div>
                    )}

                    {items.length > 0 && (
                      <div className="courier-items">
                        <strong>Buyurtma tarkibi</strong>
                        {items.map((item, index) => (
                          <div key={`${item.product_id || item.name || "item"}-${index}`}>
                            <span>{item.name || item.product_name || "Taom"}</span>
                            <span>× {item.quantity || 1}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="courier-order-footer">
                      <span>
                        {order.created_at || order.createdAt || order.created_at_formatted || ""}
                      </span>

                      {action ? (
                        <button
                          className="courier-action"
                          disabled={updatingId === orderId}
                          onClick={() => updateStatus(orderId, action.value)}
                        >
                          {updatingId === orderId ? (
                            "Saqlanmoqda..."
                          ) : action.value === "Qabul qilindi" ? (
                            <> <CheckCircle2 size={17} /> Qabul qilish </>
                          ) : action.value === "Yo'lda" ? (
                            <> <Bike size={17} /> Yo‘lga chiqish </>
                          ) : (
                            <> <CheckCircle2 size={17} /> Yetkazildi </>
                          )}
                        </button>
                      ) : (
                        <span className="courier-complete">
                          <CheckCircle2 size={16} /> Bajarildi
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <footer className="courier-footer">
          <span>© TezTaom Courier</span>
          <span>Buyurtmalar xavfsiz va tez yetkazilishi uchun.</span>
        </footer>
      </main>
    </div>
  );
}
