import { useEffect, useMemo, useState } from "react";
import CourierLiveMap from "./CourierLiveMap";
import LocationPicker from "./LocationPicker";
import {

  ShoppingBag,
  Copy,
  ExternalLink,

  ShieldCheck,

  Search,

  Home,

  Grid2X2,

  ClipboardList,

  UserRound,

  Plus,

  Minus,

  ArrowRight,

  Flame,

  X,

} from "lucide-react";

const API = "https://teztaom-backend.onrender.com";

const money = (value) =>

  `${Number(value || 0).toLocaleString("uz-UZ")} so‘m`;

const TRACKING_STEPS = [

  { title: "Buyurtma qabul qilindi", description: "Buyurtmangiz tizimga qabul qilindi." },

  { title: "Pishirilyapti", description: "Oshxonamiz taomingizni tayyorlamoqda." },

  { title: "Yo‘lda", description: "Kuryer buyurtmangizni olib yo‘lga chiqdi." },

  { title: "Yetkazildi", description: "Buyurtmangiz yetkazib berildi." },

];

function getTrackingStage(status) {

  const value = String(status || "Yangi")

    .toLocaleLowerCase("uz-UZ")

    .replaceAll("’", "'")

    .replaceAll("‘", "'");

  if (

    value.includes("yetkaz") ||

    value.includes("delivered") ||

    value.includes("completed")

  ) {

    return 3;

  }

  if (

    value.includes("yo'lda") ||

    value.includes("yolda") ||

    value.includes("on the way")

  ) {

    return 2;

  }

  if (

    value.includes("pishir") ||

    value.includes("tayyor") ||

    value.includes("preparing")

  ) {

    return 1;

  }

  // Yangi yoki qabul qilingan buyurtma — birinchi bosqich.

  return 0;

}

function getImageUrl(image) {

  if (!image || typeof image !== "string") return "";

  if (image.startsWith("/uploads/")) return `${API}${image}`;

  if (image.startsWith("http://") || image.startsWith("https://")) return image;

  return "";

}

function ProductImage({ product }) {

  const [failed, setFailed] = useState(false);

  const imageUrl = getImageUrl(product.image);

  if (imageUrl && !failed) {

    return (

      <img

        src={imageUrl}

        alt={product.name}

        className="store-product-image"

        loading="lazy"

        onError={() => setFailed(true)}

      />

    );

  }

  // Emoji is used only when the product does not have a valid image URL.

  return <span className="store-product-fallback">{product.image || "🍽️"}</span>;

}

export default function App() {

  const [products, setProducts] = useState([]);

  const [cart, setCart] = useState({});

  const [notice, setNotice] = useState("");

  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [activeCategory, setActiveCategory] = useState("Barchasi");

  const [activeTab, setActiveTab] = useState("menu");

  const [orderSubmitting, setOrderSubmitting] = useState(false);

  const [orderType, setOrderType] = useState("pickup");

  const [orderSuccess, setOrderSuccess] = useState(null);

  const [savedOrders, setSavedOrders] = useState(() => {
    try { return JSON.parse(localStorage.getItem("teztaom_orders") || "[]"); }
    catch { return []; }
  });
  const [courierLocation, setCourierLocation] = useState(null);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState(null);

  useEffect(() => {

    try { localStorage.setItem("teztaom_orders", JSON.stringify(savedOrders)); }

    catch (error) { console.warn("Buyurtmalarni saqlab bo‘lmadi:", error); }

  }, [savedOrders]);

  const [trackingOrder, setTrackingOrder] = useState(null);

  const [trackingError, setTrackingError] = useState("");

  useEffect(() => {

    let cancelled = false;

    fetch(`${API}/api/products`)

      .then((response) => {

        if (!response.ok) throw new Error("Mahsulotlarni yuklab bo‘lmadi.");

        return response.json();

      })

      .then((data) => {

        if (!cancelled) setProducts(Array.isArray(data.products) ? data.products : []);

      })

      .catch((error) => {

        if (!cancelled) setNotice(error.message || "Server bilan bog‘lanib bo‘lmadi.");

      })

      .finally(() => {

        if (!cancelled) setLoading(false);

      });

    return () => {

      cancelled = true;

    };

  }, []);

  // Buyurtma holatini har 5 soniyada yangilab turadi.

  // Yangi backend token bilan ishlaydi; eski backend bo‘lsa order ID orqali urinadi.

  useEffect(() => {

    const orderId = orderSuccess?.orderId;

    const token = orderSuccess?.trackingToken;

    if (!orderId && !token) {

      setTrackingOrder(null);

      setTrackingError("");

      return undefined;

    }

    let cancelled = false;

    const loadTracking = async () => {

      try {

        const trackingUrl = token

          ? `${API}/api/orders/track/${encodeURIComponent(token)}`

          : `${API}/api/orders/${encodeURIComponent(orderId)}`;

        const response = await fetch(trackingUrl);

        const data = await response.json();

        if (!response.ok) {

          throw new Error(

            data.detail || "Buyurtma holatini yuklab bo‘lmadi."

          );

        }

        // Backend javobi {order: {...}} yoki to‘g‘ridan-to‘g‘ri order bo‘lishi mumkin.

        const order = data.order || data;

        if (!cancelled) {

          setTrackingOrder(order);

          setTrackingError("");

        }

      } catch (error) {

        if (!cancelled) {

          setTrackingError(

            error.message || "Kuzatish serveriga ulanib bo‘lmadi."

          );

        }

      }

    };

    loadTracking();

    const intervalId = window.setInterval(loadTracking, 5000);

    return () => {

      cancelled = true;

      window.clearInterval(intervalId);

    };

  }, [orderSuccess?.trackingToken, orderSuccess?.orderId]);

  // Курьер GPS жойлашувини ҳар 5 секундда олиш.
  useEffect(() => {
    const token = orderSuccess?.trackingToken;
    const status = trackingOrder?.status || trackingOrder?.order_status || "";
    if (!token || orderSuccess?.orderType !== "delivery" || getTrackingStage(status) !== 2) {
      setCourierLocation(null);
      return undefined;
    }

    let cancelled = false;
    const loadCourierLocation = async () => {
      try {
        const response = await fetch(`${API}/api/orders/track/${encodeURIComponent(token)}/location`);
        if (!response.ok) throw new Error("GPS жойлашуви ҳозирча мавжуд эмас.");
        const data = await response.json();
        if (cancelled) return;
        if (data.available && Number.isFinite(Number(data.latitude)) && Number.isFinite(Number(data.longitude))) {
          setCourierLocation({ latitude: Number(data.latitude), longitude: Number(data.longitude) });
        } else {
          setCourierLocation(null);
        }
      } catch {
        if (!cancelled) setCourierLocation(null);
      }
    };

    loadCourierLocation();
    const intervalId = window.setInterval(loadCourierLocation, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [orderSuccess?.trackingToken, orderSuccess?.orderType, trackingOrder?.status, trackingOrder?.order_status]);

  const categories = useMemo(() => {

    const values = products

      .map((product) => String(product.category || "").trim())

      .filter(Boolean);

    return ["Barchasi", ...new Set(values)];

  }, [products]);

  const visibleProducts = useMemo(() => {

    const query = search.trim().toLocaleLowerCase("uz-UZ");

    return products.filter((product) => {

      const matchesCategory =

        activeCategory === "Barchasi" ||

        String(product.category || "").trim() === activeCategory;

      const matchesSearch =

        !query ||

        `${product.name || ""} ${product.description || ""} ${product.category || ""}`

          .toLocaleLowerCase("uz-UZ")

          .includes(query);

      return matchesCategory && matchesSearch;

    });

  }, [products, activeCategory, search]);

  const cartItems = products

    .filter((product) => cart[product.id] > 0)

    .map((product) => ({ ...product, quantity: cart[product.id] }));

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const total = cartItems.reduce(

    (sum, item) => sum + Number(item.price || 0) * item.quantity,

    0

  );

  function changeQuantity(id, amount) {

    setCart((previous) => {

      const next = { ...previous };

      const quantity = (next[id] || 0) + amount;

      if (quantity <= 0) delete next[id];

      else next[id] = quantity;

      return next;

    });

    setNotice("");

  }

  async function submitOrder(event) {

    event.preventDefault();

    if (cartItems.length === 0) {

      setNotice("Savatchangiz bo‘sh. Avval menyudan taom tanlang.");

      return;

    }

    const form = new FormData(event.currentTarget);

    const customerName = String(form.get("customer_name") || "").trim();

    const phone = String(form.get("phone") || "").trim();

    const orderType = String(form.get("order_type") || "pickup");

    const address = String(form.get("address") || "").trim();

    if (orderType === "delivery" && !address) {

      setNotice("Yetkazib berish uchun manzilingizni kiriting.");

      return;

    }

    setOrderSubmitting(true);

    setNotice("");

    try {

      const response = await fetch(`${API}/api/orders`, {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({

          customer_name: customerName,

          phone,

          telegram_init_data: window.Telegram?.WebApp?.initData || null,

          order_type: orderType,

          address: orderType === "delivery" ? address : null,

          items: cartItems.map((item) => ({

            product_id: item.id,

            quantity: item.quantity,

          })),

        }),

      });

      const data = await response.json();

      if (!response.ok) {

        throw new Error(data.detail || "Buyurtmani yuborib bo‘lmadi.");

      }

      // Backend turli versiyalarda order_id yoki order.id qaytarishi mumkin.

      const orderData = data.order || data;

      const orderId = data.order_id ?? orderData.id ?? orderData.order_id;

      const trackingToken =

        data.tracking_token ?? orderData.tracking_token ?? null;

      if (!orderId) {

        throw new Error(

          "Buyurtma yaratildi, lekin server buyurtma raqamini qaytarmadi."

        );

      }

      setOrderSuccess({

        orderId,

        trackingToken,

        total: data.total_price ?? orderData.total_price ?? total,

        customerName,

        orderType,

      });

      setSavedOrders((previous) => {

        const nextOrder = {

          orderId,

          trackingToken,

          total: data.total_price ?? orderData.total_price ?? total,

          customerName,

          orderType,

          status: orderData.status || data.status || "Yangi",

          createdAt: new Date().toISOString(),

        };

        return [nextOrder, ...previous.filter((item) => String(item.orderId) !== String(orderId))].slice(0, 20);

      });

      setNotice("");

      setCart({});

      event.currentTarget.reset();

      setOrderType("pickup");
      setDeliveryAddress("");
      setDeliveryLocation(null);

      setActiveTab("orders");

    } catch (error) {

      setNotice(error.message || "Server bilan bog‘lanib bo‘lmadi.");

    } finally {

      setOrderSubmitting(false);

    }

  }

  return (

    <div className="store-page premium-store">

      <header className="store-header premium-header">

        <a href="/" className="store-brand" aria-label="TezTaom bosh sahifa">

          <img src="/logo.png" alt="TezTaom logotipi" className="store-brand-logo" />

          <span className="store-brand-name">TezTaom</span>

        </a>

        <div className="store-header-right">

          <span className="store-open-status">

            <span className="store-status-dot" />

            Hozir ochiq

          </span>

          <a href="/admin/login" className="admin-link">

            <ShieldCheck size={17} />

            Admin

          </a>

        </div>

      </header>

      <main className="premium-main">

        <section className="premium-welcome">

          <div>

            <span className="store-kicker">TEZTAOM CLUB</span>

            <h2 className="premium-welcome-title">
  Bugun nima yeymiz?
  <span className="premium-welcome-emoji" aria-hidden="true">
    <Flame size={22} />
  </span>
</h2>

            <p>Kayfiyatingizga mos taomni tanlang — qolganini biz hal qilamiz.</p>

          </div>

          <div className="premium-welcome-icon"><Flame size={23} /></div>

        </section>

        <section className="premium-promo" aria-label="Maxsus taklif">

          <div className="premium-promo-copy">

            <span className="premium-promo-label">BUGUNGI TANLOV / 01</span>

            <h1>SMASH<br /><span>IT.</span></h1>

            <p>Yangi avlod burgeri.</p>

            <button

              className="premium-cta"

              type="button"

              onClick={() => {

                setActiveCategory("Barchasi");

                setSearch("burger");

                setActiveTab("menu");

                document.getElementById("store-menu")?.scrollIntoView({ behavior: "smooth" });

              }}

            >

              BUYURTMA BERISH <ArrowRight size={16} />

            </button>

          </div>

          <div className="premium-promo-art">

            <img

              src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=85"

              alt="Mazali burger"

              className="premium-promo-image"

            />

            <div className="premium-promo-shade" />

            <span className="premium-promo-stamp">FRESH<br />& HOT</span>

          </div>

          <div className="premium-promo-footer">

            <span>01 — 01</span>

            <span>TezTaom original</span>

          </div>

        </section>

        <section className="premium-menu-section" id="store-menu">

          <div className="premium-section-heading">

            <div>

              <span className="store-kicker">O‘ZINGIZ TANLANG</span>

              <h2>Kayfiyatingizga mos</h2>

            </div>

            <span className="store-product-count">{products.length} ta mahsulot</span>

          </div>

          <div className="premium-search">

            <Search size={18} />

            <input

              type="search"

              value={search}

              onChange={(event) => setSearch(event.target.value)}

              placeholder="Taom qidirish..."

              aria-label="Taom qidirish"

            />

            {search && (

              <button type="button" onClick={() => setSearch("")} aria-label="Qidiruvni tozalash">

                <X size={16} />

              </button>

            )}

          </div>

          <div className="premium-categories" aria-label="Mahsulot kategoriyalari">

            {categories.map((category) => (

              <button

                type="button"

                key={category}

                className={`premium-category ${activeCategory === category ? "is-active" : ""}`}

                onClick={() => setActiveCategory(category)}

              >

                {category}

              </button>

            ))}

          </div>

          {loading ? (

            <div className="premium-state">Mahsulotlar yuklanmoqda...</div>

          ) : visibleProducts.length === 0 ? (

            <div className="premium-state">

              Bu bo‘limda mahsulot topilmadi. Boshqa kategoriya yoki qidiruvni tanlang.

            </div>

          ) : (

            <div className="store-products premium-products">

              {visibleProducts.map((product) => (

                <article className="store-product premium-product" key={product.id}>

                  <div className="store-product-emoji premium-product-media">

                    <ProductImage product={product} />

                    <span className="premium-product-category">{product.category || "TezTaom"}</span>

                  </div>

                  <div className="premium-product-info">

                    <h3>{product.name}</h3>

                    {product.description && <p>{product.description}</p>}

                    <div className="store-product-bottom">

                      <strong>{money(product.price)}</strong>

                      <button

                        className="store-add-button premium-add-button"

                        type="button"

                        onClick={() => changeQuantity(product.id, 1)}

                        aria-label={`${product.name} savatga qo‘shish`}

                      >

                        {cart[product.id] > 0 ? <Plus size={18} /> : <Plus size={20} />}

                      </button>

                    </div>

                    {cart[product.id] > 0 && (

                      <div className="store-quantity premium-quantity">

                        <button type="button" onClick={() => changeQuantity(product.id, -1)} aria-label="Kamaytirish">

                          <Minus size={15} />

                        </button>

                        <span>{cart[product.id]} ta</span>

                        <button type="button" onClick={() => changeQuantity(product.id, 1)} aria-label="Ko‘paytirish">

                          <Plus size={15} />

                        </button>

                      </div>

                    )}

                  </div>

                </article>

              ))}

            </div>

          )}

        </section>

        <section className="premium-cart-section" id="store-cart">

          <div className="store-cart premium-cart">

            <div className="store-cart-title">

              <ShoppingBag size={21} />

              <h2>Savatcha</h2>

              <span>{cartCount}</span>

            </div>

            {cartItems.length === 0 ? (

              <p className="store-empty-cart">Taom tanlang — buyurtmangiz shu yerda ko‘rinadi.</p>

            ) : (

              <div className="store-cart-items">

                {cartItems.map((item) => (

                  <div className="store-cart-item" key={item.id}>

                    <div>

                      <strong>{item.name}</strong>

                      <p>{item.quantity} × {money(item.price)}</p>

                    </div>

                    <div className="premium-cart-item-right">

                      <b>{money(item.quantity * item.price)}</b>

                      <div className="premium-cart-quantity">

                        <button type="button" onClick={() => changeQuantity(item.id, -1)} aria-label="Kamaytirish"><Minus size={13} /></button>

                        <span>{item.quantity}</span>

                        <button type="button" onClick={() => changeQuantity(item.id, 1)} aria-label="Ko‘paytirish"><Plus size={13} /></button>

                      </div>

                    </div>

                  </div>

                ))}

              </div>

            )}

            <div className="store-total">

              <span>Jami</span>

              <strong>{money(total)}</strong>

            </div>

            <form className="store-checkout" onSubmit={submitOrder}>

              <label>

                Ismingiz

                <input name="customer_name" required minLength="2" placeholder="Ismingizni kiriting" />

              </label>

              <label>

                Telefon raqami

                <input name="phone" type="tel" required minLength="7" placeholder="+998..." />

              </label>

              <label>

                Buyurtma turi

                <select

                  name="order_type"

                  value={orderType}

                  onChange={(event) => setOrderType(event.target.value)}

                >

                  <option value="pickup">O‘zim olib ketaman</option>

                  <option value="delivery">Yetkazib berish</option>

                </select>

              </label>

              {orderType === "delivery" && (

                <div className="store-address-field" style={{ gridColumn: "1 / -1", width: "100%", minWidth: 0 }}>

                  <label htmlFor="delivery-address-input">Yetkazib berish manzili</label>

                  <input
                    id="delivery-address-input"
                    name="address"

                    required

                    minLength="5"

                    placeholder="Ko‘cha, uy, mo‘ljal"

                    autoComplete="street-address"
                    value={deliveryAddress}
                    onChange={(event) => setDeliveryAddress(event.target.value)}

                  />
                  <LocationPicker
                    onSelect={(point) => {
                      setDeliveryLocation(point);
                      const coords = `${Number(point.lat).toFixed(6)}, ${Number(point.lng).toFixed(6)}`;
                      const addressText = point.label
                        ? `${point.label} (GPS: ${coords})`
                        : `GPS: ${coords}`;
                      setDeliveryAddress(addressText);
                    }}
                  />
                  {deliveryLocation && (
                    <small style={{ display: "block", marginTop: 8, color: "#a1a1aa" }}>
                      Tanlangan GPS: {deliveryLocation.lat.toFixed(6)}, {deliveryLocation.lng.toFixed(6)}
                    </small>
                  )}

                </div>

              )}

              <button

                className="store-order-button"

                type="submit"

                disabled={loading || cartItems.length === 0 || orderSubmitting}

              >

                {orderSubmitting ? "Yuborilmoqda..." : <>Buyurtma berish · {money(total)}</>}

              </button>

            </form>

            {notice && (

              <div className="store-notice" role="status">

                {notice}

                <button type="button" onClick={() => setNotice("")} aria-label="Xabarni yopish"><X size={15} /></button>

              </div>

            )}

          </div>

        </section>

        <section className="premium-cart-section" id="store-orders">

          <div className="store-cart premium-cart">

            <div className="store-cart-title">

              <ClipboardList size={21} />

              <h2>Buyurtmalarim</h2>

              <span>{savedOrders.length}</span>

            </div>

            {savedOrders.length === 0 ? (

              <p className="store-empty-cart">Hozircha buyurtmalaringiz yo‘q. Menyudan taom tanlab buyurtma bering.</p>

            ) : (

              <div className="store-cart-items">

                {savedOrders.map((order) => (

                  <article className="store-cart-item" key={String(order.orderId)}>

                    <div>

                      <strong>Buyurtma #{order.orderId}</strong>

                      <p>{order.orderType === "delivery" ? "Yetkazib berish" : "O‘zim olib ketaman"} · {money(order.total)}</p>

                      <p>Holati: {String(order.orderId) === String(orderSuccess?.orderId) ? (trackingOrder?.status || trackingOrder?.order_status || order.status || "Tekshirilmoqda") : (order.status || "Yangi")}</p>

                      {order.trackingToken ? (

                        <p style={{ overflowWrap: "anywhere" }}>Kuzatuv tokeni: <code>{order.trackingToken}</code></p>

                      ) : (

                        <p>Token server javobida kelmadi. Backend POST /api/orders javobida tracking_token qaytarishi kerak.</p>

                      )}

                    </div>

                    <div className="store-order-actions">

                      {order.trackingToken && (

                        <button

                          type="button"

                          className="store-copy-button"

                          onClick={async () => {

                            try {

                              await navigator.clipboard.writeText(order.trackingToken);

                              setNotice("Kuzatuv tokeni nusxalandi.");

                            } catch {

                              setNotice("Nusxalash ishlamadi. Brauzer ruxsatini tekshiring.");

                            }

                          }}

                        >

                          <Copy size={15} aria-hidden="true" />

                          <span>Nusxalash</span>

                        </button>

                      )}

                      <button

                        type="button"

                        className="store-track-button"

                        onClick={() => {

                          setOrderSuccess(order);

                          setActiveTab("orders");

                          document.getElementById("store-orders")?.scrollIntoView({ behavior: "smooth" });

                        }}

                      >

                        <ExternalLink size={15} aria-hidden="true" />

                        <span>Kuzatish</span>

                      </button>

                    </div>

                  </article>

                ))}

              </div>

            )}

          </div>

        </section>

      </main>

      {orderSuccess && (

        <div className="order-success-backdrop" role="presentation" onClick={() => setOrderSuccess(null)}>

          <section

            className="order-success-modal"

            role="dialog"

            aria-modal="true"

            aria-labelledby="order-success-title"

            onClick={(event) => event.stopPropagation()}

          >

            <button className="order-success-close" type="button" onClick={() => setOrderSuccess(null)} aria-label="Oynani yopish">

              <X size={18} />

            </button>

            <div className="order-success-check">✓</div>

            <span className="store-kicker">TEZTAOM BUYURTMASI</span>

            <h2 id="order-success-title">Buyurtmangiz qabul qilindi!</h2>

            <p className="order-success-description">

              {orderSuccess.customerName}, buyurtmangiz muvaffaqiyatli yuborildi.

            </p>

            <div className="order-success-details">

              <div><span>Buyurtma raqami</span><strong>#{orderSuccess.orderId}</strong></div>

              <div><span>Buyurtma turi</span><strong>{orderSuccess.orderType === "delivery" ? "Yetkazib berish" : "O‘zim olib ketaman"}</strong></div>

              <div><span>Jami summa</span><strong>{money(orderSuccess.total)}</strong></div>

            </div>

            {orderSuccess.orderId && (

              <div className="order-tracking-panel" aria-live="polite">

                <div className="order-tracking-heading">

                  <strong>Buyurtma holati</strong>

                  <span className="order-tracking-live"><i /> Jonli kuzatuv</span>

                </div>

                {(() => {

                  const currentStatus = trackingOrder?.status || trackingOrder?.order_status || "Yangi";

                  const currentStage = getTrackingStage(currentStatus);

                  return (

                    <div className="order-tracking-timeline" style={{ marginTop: 14, display: "grid", gap: 14 }}>

                      <div className="order-tracking-current-status" style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255, 100, 31, 0.10)", border: "1px solid rgba(255, 100, 31, 0.25)", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>

                        <span>Joriy holat</span>

                        <strong>{trackingError ? "Holatni olishda xatolik" : TRACKING_STEPS[currentStage].title}</strong>

                      </div>

                      <div className="order-tracking-steps" style={{ display: "grid", gap: 12 }}>

                        {TRACKING_STEPS.map((step, index) => (

                          <div className={`order-tracking-step ${index < currentStage ? "is-complete" : ""} ${index === currentStage ? "is-current" : ""}`} key={step.title} style={{ display: "flex", alignItems: "flex-start", gap: 12, opacity: index <= currentStage ? 1 : 0.55 }}>

                            <div className="order-tracking-step-marker" style={{ width: 30, height: 30, minWidth: 30, borderRadius: "50%", display: "grid", placeItems: "center", background: index <= currentStage ? "#ff641f" : "#292929", color: "white", fontWeight: 800, border: index === currentStage ? "2px solid #ffb18b" : "2px solid transparent" }}>{index < currentStage ? "✓" : index + 1}</div>

                            <div className="order-tracking-step-copy" style={{ display: "grid", gap: 3, paddingTop: 2 }}>

                              <strong>{step.title}</strong>

                              <span style={{ fontSize: 12, color: "#a1a1aa", lineHeight: 1.45 }}>{step.description}</span>

                            </div>

                          </div>

                        ))}

                      </div>

                    </div>

                  );

                })()}

                {orderSuccess.orderType === "delivery" &&
                  getTrackingStage(trackingOrder?.status || trackingOrder?.order_status || "Yangi") === 2 && (
                    <CourierLiveMap location={courierLocation} />
                  )}

                {trackingOrder?.items?.length > 0 && (

                  <div className="order-tracking-items">

                    {trackingOrder.items.map((item, index) => (

                      <div key={`${item.product_id || item.name || "item"}-${index}`}>

                        <span>{item.name || item.product_name || "Taom"}</span>

                        <span>{item.quantity} ta</span>

                      </div>

                    ))}

                  </div>

                )}

                {trackingError && <p className="order-tracking-error">{trackingError}</p>}

                <small>Holat har 5 soniyada avtomatik yangilanadi.</small>

              </div>

            )}

            <button

              className="store-order-button"

              type="button"

              onClick={() => {

                setOrderSuccess(null);

                setActiveTab("menu");

                document.getElementById("store-menu")?.scrollIntoView({ behavior: "smooth" });

              }}

            >

              Menyuga qaytish <ArrowRight size={16} />

            </button>

          </section>

        </div>

      )}

      {cartCount > 0 && (

        <button

          type="button"

          className="premium-floating-cart"

          onClick={() => {

            setActiveTab("cart");

            document.getElementById("store-cart")?.scrollIntoView({

              behavior: "smooth",

              block: "start",

            });

          }}

          aria-label={`Savatcha, ${cartCount} ta mahsulot, jami ${money(total)}`}

        >

          <span className="premium-floating-cart-icon">

            <ShoppingBag size={20} />

            <i>{cartCount}</i>

          </span>

          <span className="premium-floating-cart-copy">

            <strong>Savatchaga o‘tish</strong>

            <small>{cartCount} ta mahsulot</small>

          </span>

          <strong className="premium-floating-cart-total">{money(total)}</strong>

          <ArrowRight size={18} />

        </button>

      )}

      <nav className="premium-bottom-nav" aria-label="Asosiy navigatsiya">

        <button type="button" className={activeTab === "menu" ? "is-active" : ""} onClick={() => {

          setActiveTab("menu");

          document.getElementById("store-menu")?.scrollIntoView({ behavior: "smooth" });

        }}>

          <Home size={19} /><span>Bosh sahifa</span>

        </button>

        <button type="button" className={activeTab === "categories" ? "is-active" : ""} onClick={() => {

          setActiveTab("categories");

          document.querySelector(".premium-categories")?.scrollIntoView({ behavior: "smooth", block: "center" });

        }}>

          <Grid2X2 size={19} /><span>Menyu</span>

        </button>

        <button type="button" className={activeTab === "cart" ? "is-active" : ""} onClick={() => {

          setActiveTab("cart");

          document.getElementById("store-cart")?.scrollIntoView({ behavior: "smooth" });

        }}>

          <span className="premium-nav-icon"><ShoppingBag size={19} />{cartCount > 0 && <i>{cartCount}</i>}</span>

          <span>Savatcha</span>

        </button>

        <button type="button" className={activeTab === "orders" ? "is-active" : ""} onClick={() => {

          setActiveTab("orders");

          document.getElementById("store-orders")?.scrollIntoView({ behavior: "smooth" });

        }}>

          <ClipboardList size={19} /><span>Buyurtmalarim</span>

        </button>

      </nav>

      <footer className="store-footer premium-footer">

        <span>© TezTaom</span>

        <span>Har luqmada maza.</span>

      </footer>

    </div>

  );

}
