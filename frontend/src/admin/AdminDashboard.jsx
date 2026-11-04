

import { useCallback, useEffect, useState } from "react";

import {

  LayoutDashboard, ShoppingBasket, Bike, ClipboardList, Tags,

  LogOut, Plus, Pencil, Trash2, RefreshCw, X,

  TrendingUp, Package, Users, Clock, Search, Bell, ArrowUpRight, Activity, Sparkles, CalendarDays

} from "lucide-react";



const API = "http://127.0.0.1:8000";



const emptyProduct = {

  name: "",

  category: "Burger",

  price: "",

  image: "🍔",

  description: "",

  is_active: true,

};



const PRODUCT_PHOTOS = {
  burger: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=85",
  lavash: "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=900&q=85",
  "hot-dog": "https://images.unsplash.com/photo-1612392062798-2dbaa5a3e3f4?auto=format&fit=crop&w=900&q=85",
  snacks: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=900&q=85",
  drinks: "https://images.unsplash.com/photo-1554866585-cd94860890b7?auto=format&fit=crop&w=900&q=85",
  pizza: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=85",
  dessert: "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=85",
  other: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85",
};

function productPhoto(product) {
  const value = String(product?.image || "").trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/uploads/")) return `${API}${value}`;
  const category = String(product?.category || "").toLowerCase();
  const name = String(product?.name || "").toLowerCase();
  if (name.includes("burger")) return PRODUCT_PHOTOS.burger;
  if (name.includes("lavash") || name.includes("shawarma")) return PRODUCT_PHOTOS.lavash;
  if (name.includes("hot dog") || name.includes("hot-dog")) return PRODUCT_PHOTOS["hot-dog"];
  if (name.includes("fries") || name.includes("kartosh")) return PRODUCT_PHOTOS.snacks;
  if (name.includes("cola") || name.includes("drink") || name.includes("suv")) return PRODUCT_PHOTOS.drinks;
  return PRODUCT_PHOTOS[category] || PRODUCT_PHOTOS.other;
}

function money(value) {

  return `${Number(value || 0).toLocaleString("uz-UZ")} so‘m`;

}



export default function AdminDashboard({ token, onLogout }) {

  const [section, setSection] = useState("dashboard");
  const [searchQuery, setSearchQuery] = useState("");

  const [stats, setStats] = useState({});

  const [products, setProducts] = useState([]);

  const [categories, setCategories] = useState([]);
  const [categoryModal, setCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryName, setCategoryName] = useState("");

  const [couriers, setCouriers] = useState([]);

  const [orders, setOrders] = useState([]);

  const [loading, setLoading] = useState(false);

  const [notice, setNotice] = useState("");

  const [error, setError] = useState("");



  const [productModal, setProductModal] = useState(false);

  const [editingProduct, setEditingProduct] = useState(null);

  const [productForm, setProductForm] = useState(emptyProduct);
  const [imageUploading, setImageUploading] = useState(false);



  const [courierModal, setCourierModal] = useState(false);

  const [courierForm, setCourierForm] = useState({

    username: "",

    password: "",

  });



  const request = useCallback(async (path, options = {}) => {

    const response = await fetch(`${API}${path}`, {

      ...options,

      headers: {

        Authorization: `Bearer ${token}`,

        ...(options.body ? { "Content-Type": "application/json" } : {}),

        ...options.headers,

      },

    });



    const data = await response.json().catch(() => ({}));



    if (response.status === 401) {

      onLogout();

      throw new Error("Sessiya tugadi. Qayta tizimga kiring.");

    }



    if (!response.ok) {

      throw new Error(

        typeof data.detail === "string"

          ? data.detail

          : "So‘rovni bajarib bo‘lmadi."

      );

    }



    return data;

  }, [token, onLogout]);



  const loadSection = useCallback(async () => {

    setLoading(true);

    setError("");



    try {

      if (section === "dashboard") {

        const data = await request("/api/admin/dashboard");

        setStats(data.stats || {});

        setOrders(data.recent_orders || []);

      } else if (section === "products") {

        const data = await request("/api/admin/products");

        setProducts(data.products || []);

      } else if (section === "categories") {

        const data = await request("/api/admin/categories");

        setCategories(data.categories || []);

      } else if (section === "couriers") {

        const data = await request("/api/admin/couriers");

        setCouriers(data.couriers || []);

      } else if (section === "orders") {
        const [ordersData, couriersData] = await Promise.all([
          request("/api/admin/orders"),
          request("/api/admin/couriers"),
        ]);
        setOrders(ordersData.orders || []);
        setCouriers(couriersData.couriers || []);
      }

    } catch (err) {

      setError(err.message);

    } finally {

      setLoading(false);

    }

  }, [section, request]);



  useEffect(() => {

    loadSection();

  }, [loadSection]);



  function showNotice(message) {

    setNotice(message);

    window.setTimeout(() => setNotice(""), 3500);

  }



  function openNewProduct() {

    setEditingProduct(null);

    setProductForm(emptyProduct);

    setProductModal(true);

  }



  function openEditProduct(product) {

    setEditingProduct(product);

    setProductForm({

      name: product.name,

      category: product.category,

      price: String(product.price),

      image: product.image || "",

      description: product.description || "",

      is_active: Boolean(product.is_active),

    });

    setProductModal(true);

  }



  async function handleImageUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setError("Faqat JPG, PNG yoki WEBP formatidagi rasmni tanlang.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Rasm hajmi 5 MB dan oshmasin.");
      event.target.value = "";
      return;
    }

    setError("");
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${API}/api/admin/upload-image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        onLogout();
        throw new Error("Sessiya tugadi. Qayta tizimga kiring.");
      }
      if (!response.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : "Rasm yuklanmadi.");
      }
      setProductForm((current) => ({ ...current, image: data.image_url }));
      showNotice("Mahsulot rasmi yuklandi. Saqlashni bosing.");
    } catch (err) {
      setError(err.message || "Rasm yuklashda xatolik yuz berdi.");
    } finally {
      setImageUploading(false);
      event.target.value = "";
    }
  }

  async function saveProduct(event) {

    event.preventDefault();

    setError("");
    if (categories.length === 0) {
      setError("Avval kamida bitta kategoriya qo‘shing.");
      return;
    }

    try {

      const payload = {

        ...productForm,

        name: productForm.name.trim(),

        category: productForm.category.trim(),

        price: Number(productForm.price),

        image: productForm.image.trim(),

        description: productForm.description.trim(),

      };



      const path = editingProduct

        ? `/api/admin/products/${editingProduct.id}`

        : "/api/admin/products";



      await request(path, {

        method: editingProduct ? "PUT" : "POST",

        body: JSON.stringify(payload),

      });



      setProductModal(false);

      showNotice(editingProduct ? "Mahsulot yangilandi." : "Mahsulot qo‘shildi.");

      await loadSection();

    } catch (err) {

      setError(err.message);

    }

  }



  async function removeProduct(product) {

    if (!window.confirm(`“${product.name}” katalogdan olib tashlansinmi?`)) {

      return;

    }



    try {

      await request(`/api/admin/products/${product.id}`, {

        method: "DELETE",

      });

      showNotice("Mahsulot katalogdan olib tashlandi.");

      await loadSection();

    } catch (err) {

      setError(err.message);

    }

  }



  function openNewCategory() {
    setEditingCategory(null);
    setCategoryName("");
    setCategoryModal(true);
  }

  function openEditCategory(category) {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryModal(true);
  }

  async function saveCategory(event) {
    event.preventDefault();
    setError("");
    try {
      const path = editingCategory ? `/api/admin/categories/${editingCategory.id}` : "/api/admin/categories";
      await request(path, {
        method: editingCategory ? "PUT" : "POST",
        body: JSON.stringify({ name: categoryName.trim() }),
      });
      setCategoryModal(false);
      showNotice(editingCategory ? "Kategoriya yangilandi." : "Kategoriya qo‘shildi.");
      await loadSection();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeCategory(category) {
    if (!window.confirm(`“${category.name}” kategoriyasi o‘chirilsinmi?`)) return;
    setError("");
    try {
      await request(`/api/admin/categories/${category.id}`, { method: "DELETE" });
      showNotice("Kategoriya o‘chirildi.");
      await loadSection();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createCourier(event) {

    event.preventDefault();



    try {

      await request("/api/admin/couriers", {

        method: "POST",

        body: JSON.stringify(courierForm),

      });



      setCourierModal(false);

      setCourierForm({ username: "", password: "" });

      showNotice("Kuryer akkaunti yaratildi.");

      await loadSection();

    } catch (err) {

      setError(err.message);

    }

  }



  async function toggleCourier(courier) {

    const nextActive = !courier.is_active;



    try {

      await request(

        `/api/admin/couriers/${courier.id}/active?is_active=${nextActive}`,

        { method: "PATCH" }

      );

      showNotice(nextActive ? "Kuryer faollashtirildi." : "Kuryer bloklandi.");

      await loadSection();

    } catch (err) {

      setError(err.message);

    }

  }



  async function assignCourier(orderId, courierId) {
    if (!courierId) {
      setError("Avval kuryerni tanlang.");
      return;
    }

    setError("");
    try {
      await request(`/api/admin/orders/${orderId}/assign`, {
        method: "PATCH",
        body: JSON.stringify({ courier_id: Number(courierId) }),
      });
      showNotice("Buyurtma kuryerga biriktirildi.");
      await loadSection();
    } catch (err) {
      setError(err.message);
    }
  }

  const searchText = searchQuery.trim().toLowerCase();
  const filteredProducts = products.filter((item) =>
    [item.name, item.category, item.description, item.id].some((value) =>
      String(value ?? "").toLowerCase().includes(searchText)
    )
  );
  const filteredOrders = orders.filter((item) =>
    [item.id, item.customer_name, item.phone, item.status, item.order_type].some((value) =>
      String(value ?? "").toLowerCase().includes(searchText)
    )
  );
  const filteredCouriers = couriers.filter((item) =>
    [item.username, item.id, item.is_active ? "faol" : "bloklangan"].some((value) =>
      String(value ?? "").toLowerCase().includes(searchText)
    )
  );
  const orderAverage = orders.length
    ? Math.round(orders.reduce((sum, order) => sum + Number(order.total_price || 0), 0) / orders.length)
    : 0;

  const menu = [

    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },

    { id: "products", label: "Mahsulotlar", icon: ShoppingBasket },

    { id: "categories", label: "Kategoriyalar", icon: Tags },

    { id: "orders", label: "Buyurtmalar", icon: ClipboardList },

    { id: "couriers", label: "Kuryerlar", icon: Bike },

  ];



  return (

    <div className="admin-shell">

      <aside className="admin-sidebar">

        <a className="admin-brand" href="/admin">
          <img
            src="/logo.png"
            alt="TezTaom"
            className="admin-brand-logo"
          />
          <span>TezTaom<small>ADMIN PANEL</small></span>
        </a>



        <div className="admin-menu-caption">ASOSIY MENYU</div>



        <nav className="admin-nav">

          {menu.map((item) => {

            const Icon = item.icon;

            return (

              <button

                key={item.id}

                className={section === item.id ? "active" : ""}

                onClick={() => {

                  setSection(item.id);

                  setError("");

                }}

              >

                <Icon size={19} />

                <span>{item.label}</span>

                {section === item.id && <span className="admin-nav-dot" />}

              </button>

            );

          })}

        </nav>



        <div className="admin-sidebar-bottom">

          <div className="admin-online-dot" />

          <span>Admin tizimi faol</span>

          <button title="Tizimdan chiqish" onClick={onLogout}>

            <LogOut size={18} />

          </button>

        </div>

      </aside>



      <main className="admin-main">

        <header className="admin-topbar futuristic-topbar">
          <div className="admin-page-title">
            <span className="admin-breadcrumb">TEZTAOM <span className="admin-crumb-separator">/</span> OPERATSION MARKAZ</span>
            <h1>{menu.find((item) => item.id === section)?.label}</h1>
            <p className="admin-page-subtitle">Restoran faoliyatini bir joydan boshqaring.</p>
          </div>
          <div className="admin-topbar-actions">
            <label className="admin-global-search">
              <Search size={17} />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={section === "products" ? "Mahsulot qidirish..." : section === "orders" ? "Buyurtma qidirish..." : section === "couriers" ? "Kuryer qidirish..." : "Bo‘lim ma’lumotlarini qidirish..."}
                aria-label="Joriy bo‘lim bo‘yicha qidirish"
              />
              {searchQuery && <button type="button" onClick={() => setSearchQuery("")} title="Qidiruvni tozalash"><X size={15} /></button>}
            </label>
            <span className="admin-live-indicator"><i /> Tizim faol</span>
            <button className="admin-refresh" onClick={loadSection}><RefreshCw size={16} /> Yangilash</button>
          </div>
        </header>



        {notice && <div className="admin-notice">{notice}</div>}

        {error && <div className="admin-error">{error}</div>}



        {loading ? (

          <div className="admin-loading">Ma’lumotlar yuklanmoqda...</div>

        ) : (

          <>

            {section === "dashboard" && (
              <div className="fp-dashboard">
                <section className="fp-hero">
                  <div className="fp-hero-orb fp-orb-one" />
                  <div className="fp-hero-orb fp-orb-two" />
                  <div className="fp-hero-content">
                    <span className="fp-eyebrow"><Sparkles size={13} /> RESTORAN ANALITIKASI</span>
                    <h2>Bugungi biznesingiz<br /><em>bir qarashda.</em></h2>
                    <p>Buyurtmalar, mahsulotlar va yetkazib berish jarayonini real vaqtdagi ma’lumotlar asosida boshqaring.</p>
                    <div className="fp-hero-actions">
                      <button className="fp-hero-primary" onClick={() => setSection("orders")}><ClipboardList size={16} /> Buyurtmalarni ko‘rish <ArrowUpRight size={15} /></button>
                      <button className="fp-hero-secondary" onClick={openNewProduct}><Plus size={16} /> Mahsulot qo‘shish</button>
                    </div>
                  </div>
                  <div className="fp-hero-art" aria-hidden="true">
                    <div className="fp-art-ring ring-a" /><div className="fp-art-ring ring-b" />
                    <div className="fp-art-glow" />
                    <div className="fp-art-label"><span className="fp-live-pulse" /> TEZTAOM <small>FAST • FRESH • HOT</small></div>
                    <div className="fp-art-orbit"><ZapIcon /></div>
                  </div>
                  <div className="fp-hero-foot"><span><i /> API bilan ulangan</span><span><CalendarDays size={13} /> Jonli ko‘rsatkichlar</span></div>
                </section>

                <div className="fp-section-heading">
                  <div><span className="fp-eyebrow">ASOSIY KO‘RSATKICHLAR</span><h2>Operatsiyalar paneli</h2></div>
                  <span className="fp-data-note"><Activity size={14} /> Backend ma’lumotlari</span>
                </div>

                <div className="fp-metrics-grid">
                  <MetricCard icon={Package} label="Faol mahsulotlar" value={stats.products ?? 0} tone="orange" note="Katalogda mavjud" />
                  <MetricCard icon={ClipboardList} label="Jami buyurtmalar" value={stats.orders ?? 0} tone="blue" note="Bazadagi buyurtmalar" />
                  <MetricCard icon={Clock} label="Yangi buyurtmalar" value={stats.new_orders ?? 0} tone="purple" note="Ko‘rib chiqishni kutmoqda" />
                  <MetricCard icon={Users} label="Faol kuryerlar" value={stats.couriers ?? 0} tone="green" note="Ishga tayyor kuryerlar" />
                </div>

                <div className="fp-analysis-grid">
                  <section className="fp-glass-card fp-revenue-panel">
                    <div className="fp-card-heading">
                      <div><span className="fp-eyebrow">SAVDO KO‘RSATKICHI</span><h3>Buyurtmalar qiymati</h3></div>
                      <span className="fp-icon-bubble green"><TrendingUp size={18} /></span>
                    </div>
                    <strong className="fp-revenue-number">{money(stats.revenue)}</strong>
                    <p className="fp-muted">Barcha buyurtmalar umumiy summasi — backenddan olingan.</p>
                    <div className="fp-revenue-bottom">
                      <div><span>Ko‘rsatilgan buyurtmalar</span><strong>{orders.length}</strong></div>
                      <div><span>O‘rtacha summa</span><strong>{money(orderAverage)}</strong></div>
                    </div>
                    <div className="fp-revenue-spectrum"><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /></div>
                  </section>
                  <section className="fp-glass-card fp-ops-panel">
                    <div className="fp-card-heading">
                      <div><span className="fp-eyebrow">TEZKOR HARAKATLAR</span><h3>Boshqaruv markazi</h3></div>
                      <span className="fp-icon-bubble orange"><ZapIcon /></span>
                    </div>
                    <button className="fp-operation-link" onClick={() => setSection("products")}><span className="fp-operation-icon orange"><ShoppingBasket size={17} /></span><span><strong>Katalogni boshqarish</strong><small>Mahsulot va narxlarni yangilash</small></span><ArrowUpRight size={16} /></button>
                    <button className="fp-operation-link" onClick={() => setSection("orders")}><span className="fp-operation-icon blue"><ClipboardList size={17} /></span><span><strong>Buyurtmalar markazi</strong><small>Holatlarni tekshirish va kuryer biriktirish</small></span><ArrowUpRight size={16} /></button>
                    <button className="fp-operation-link" onClick={() => setSection("couriers")}><span className="fp-operation-icon green"><Bike size={17} /></span><span><strong>Kuryerlar</strong><small>Hisoblar va faollikni boshqarish</small></span><ArrowUpRight size={16} /></button>
                  </section>
                </div>

                <section className="admin-panel fp-recent-panel">
                  <div className="admin-panel-heading">
                    <div><span className="fp-eyebrow">OXIRGI FAOLLIK</span><h2>So‘nggi buyurtmalar</h2><p>Backend qaytargan eng so‘nggi buyurtmalar</p></div>
                    <button className="admin-secondary-button" onClick={() => setSection("orders")}>Barchasini ko‘rish <ArrowUpRight size={15} /></button>
                  </div>
                  <OrderTable orders={orders.slice(0, 8)} />
                </section>
              </div>
            )}

            {section === "products" && (

              <section className="admin-panel">

                <div className="admin-panel-heading">

                  <div><h2>Mahsulotlar katalogi</h2><p>Mahsulotlarni qo‘shing va boshqaring</p></div>

                  <button className="admin-primary-button" onClick={openNewProduct}>

                    <Plus size={18} /> Mahsulot qo‘shish

                  </button>

                </div>



                <div className="admin-table-wrap">

                  <table className="admin-table">

                    <thead><tr>

                      <th>Mahsulot</th><th>Kategoriya</th><th>Narxi</th><th>Holati</th><th>Amallar</th>

                    </tr></thead>

                    <tbody>

                      {filteredProducts.map((product) => (

                        <tr key={product.id}>

                          <td>
  <div className="admin-product-cell">
    <img
      className="admin-product-photo"
      src={productPhoto(product)}
      alt={product.name}
      loading="lazy"
      onError={(event) => {
        event.currentTarget.onerror = null;
        event.currentTarget.src = PRODUCT_PHOTOS.other;
      }}
    />
    <div><strong>{product.name}</strong><small>ID: {product.id}</small></div>
  </div>
</td>

                          <td>{product.category}</td>

                          <td><strong>{money(product.price)}</strong></td>

                          <td><span className={`admin-status ${product.is_active ? "success" : "muted"}`}>{product.is_active ? "Faol" : "Yashirilgan"}</span></td>

                          <td><div className="admin-actions">

                            <button title="Tahrirlash" onClick={() => openEditProduct(product)}><Pencil size={16} /></button>

                            <button title="O‘chirish" className="danger" onClick={() => removeProduct(product)}><Trash2 size={16} /></button>

                          </div></td>

                        </tr>

                      ))}

                      {filteredProducts.length === 0 && <tr><td colSpan="5">Qidiruvga mos mahsulot topilmadi.</td></tr>}

                    </tbody>

                  </table>

                </div>

              </section>

            )}



            {section === "categories" && (
              <section className="admin-panel">
                <div className="admin-panel-heading">
                  <div><h2>Kategoriyalar boshqaruvi</h2><p>Kategoriyalarni qo‘shing, nomini o‘zgartiring va mahsulotlarga biriktiring.</p></div>
                  <button className="admin-primary-button" onClick={openNewCategory}><Plus size={18} /> Kategoriya qo‘shish</button>
                </div>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>Kategoriya</th><th>Mahsulotlar soni</th><th>Yaratilgan sana</th><th>Amallar</th></tr></thead>
                    <tbody>
                      {categories.filter((item) => [item.name, item.id].some((value) => String(value ?? "").toLowerCase().includes(searchText))).map((category) => (
                        <tr key={category.id}>
                          <td><strong>{category.name}</strong><small className="admin-block">ID: {category.id}</small></td>
                          <td><span className="admin-status success">{category.product_count ?? 0} ta mahsulot</span></td>
                          <td>{category.created_at || "—"}</td>
                          <td><div className="admin-actions"><button title="Tahrirlash" onClick={() => openEditCategory(category)}><Pencil size={16} /></button><button title="O‘chirish" className="danger" onClick={() => removeCategory(category)}><Trash2 size={16} /></button></div></td>
                        </tr>
                      ))}
                      {categories.filter((item) => [item.name, item.id].some((value) => String(value ?? "").toLowerCase().includes(searchText))).length === 0 && <tr><td colSpan="4">Kategoriya topilmadi. Yangi kategoriya qo‘shing.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {section === "couriers" && (

              <section className="admin-panel">

                <div className="admin-panel-heading">

                  <div><h2>Kuryerlar</h2><p>Login va parol orqali yangi kuryer yarating</p></div>

                  <button className="admin-primary-button" onClick={() => setCourierModal(true)}>

                    <Plus size={18} /> Kuryer qo‘shish

                  </button>

                </div>

                <div className="admin-table-wrap">

                  <table className="admin-table">

                    <thead><tr><th>Foydalanuvchi</th><th>Rol</th><th>Yaratilgan sana</th><th>Holati</th><th>Amal</th></tr></thead>

                    <tbody>

                      {filteredCouriers.map((courier) => (

                        <tr key={courier.id}>

                          <td><strong>{courier.username}</strong><small className="admin-block">ID: {courier.id}</small></td>

                          <td>Kuryer</td>

                          <td>{courier.created_at || "—"}</td>

                          <td><span className={`admin-status ${courier.is_active ? "success" : "muted"}`}>{courier.is_active ? "Faol" : "Bloklangan"}</span></td>

                          <td><button className="admin-secondary-button" onClick={() => toggleCourier(courier)}>{courier.is_active ? "Bloklash" : "Faollashtirish"}</button></td>

                        </tr>

                      ))}

                      {filteredCouriers.length === 0 && <tr><td colSpan="5">Qidiruvga mos kuryer topilmadi.</td></tr>}

                    </tbody>

                  </table>

                </div>

              </section>

            )}



            {section === "orders" && (

              <section className="admin-panel">

                <div className="admin-panel-heading">

                  <div><h2>Barcha buyurtmalar</h2><p>Buyurtmalar tarixi va holati</p></div>

                </div>

                <OrderTable orders={filteredOrders} detailed couriers={couriers} onAssign={assignCourier} />

              </section>

            )}

          </>

        )}

      </main>



      {categoryModal && (
        <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCategoryModal(false); }}>
          <form className="admin-modal" onSubmit={saveCategory}>
            <div className="admin-modal-heading">
              <div><h2>{editingCategory ? "Kategoriyani tahrirlash" : "Yangi kategoriya"}</h2><p>Kategoriya nomini kiriting</p></div>
              <button type="button" onClick={() => setCategoryModal(false)}><X /></button>
            </div>
            <label>Kategoriya nomi<input required minLength="2" maxLength="100" autoFocus value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Masalan: Burgerlar" /></label>
            <p className="admin-modal-hint">Kategoriyani o‘chirish uchun unga biriktirilgan mahsulotlar avval boshqa kategoriyaga o‘tkazilishi kerak.</p>
            <div className="admin-modal-buttons">
              <button type="button" className="admin-secondary-button" onClick={() => setCategoryModal(false)}>Bekor qilish</button>
              <button className="admin-primary-button" type="submit">{editingCategory ? "Saqlash" : "Kategoriya yaratish"}</button>
            </div>
          </form>
        </div>
      )}

      {productModal && (

        <div className="admin-modal-backdrop" onMouseDown={(event) => {

          if (event.target === event.currentTarget) setProductModal(false);

        }}>

          <form className="admin-modal" onSubmit={saveProduct}>

            <div className="admin-modal-heading">

              <div><h2>{editingProduct ? "Mahsulotni tahrirlash" : "Yangi mahsulot"}</h2><p>Mahsulot ma’lumotlarini kiriting</p></div>

              <button type="button" onClick={() => setProductModal(false)}><X /></button>

            </div>



            <label>Mahsulot nomi<input required minLength="2" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} /></label>

            <label>Kategoriya

              <select required value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}>
                {categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}
              </select>
              {categories.length === 0 && <span className="admin-modal-hint">Avval “Kategoriyalar” bo‘limidan kategoriya qo‘shing.</span>}

            </label>

            <label>Narxi (so‘m)<input type="number" min="0" required value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} /></label>

            <label>Mahsulot rasmini kompyuterdan yuklash
  <input
    type="file"
    accept="image/jpeg,image/png,image/webp"
    onChange={handleImageUpload}
    disabled={imageUploading}
  />
</label>
<p className="admin-modal-hint">
  {imageUploading ? "Rasm yuklanmoqda..." : "JPG, PNG yoki WEBP • maksimal 5 MB. Rasm yuklangach, mahsulotni saqlang."}
</p>
<label>Yoki rasm URL manzili
  <input
    value={productForm.image}
    onChange={(e) => setProductForm({ ...productForm, image: e.target.value })}
    placeholder="https://... yoki /uploads/..."
  />
</label>
<div className="admin-image-preview">
  <img
    src={productPhoto({ ...productForm, image: productForm.image })}
    alt="Mahsulot rasmi ko‘rinishi"
    onError={(event) => {
      event.currentTarget.onerror = null;
      event.currentTarget.src = PRODUCT_PHOTOS.other;
    }}
  />
  <div>
    <strong>Rasm ko‘rinishi</strong>
    <small>Rasm URL manzilini kiriting. Bo‘sh yoki emoji bo‘lsa, kategoriya uchun namuna rasm ko‘rsatiladi.</small>
  </div>
</div>

            <label>Tavsif<textarea rows="3" value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} /></label>

            <label className="admin-checkbox"><input type="checkbox" checked={productForm.is_active} onChange={(e) => setProductForm({ ...productForm, is_active: e.target.checked })} /> Katalogda faol ko‘rsatish</label>

            <div className="admin-modal-buttons">

              <button type="button" className="admin-secondary-button" onClick={() => setProductModal(false)}>Bekor qilish</button>

              <button className="admin-primary-button" type="submit">{editingProduct ? "Saqlash" : "Mahsulot qo‘shish"}</button>

            </div>

          </form>

        </div>

      )}



      {courierModal && (

        <div className="admin-modal-backdrop">

          <form className="admin-modal" onSubmit={createCourier}>

            <div className="admin-modal-heading">

              <div><h2>Yangi kuryer</h2><p>Kuryer uchun alohida login va parol belgilang</p></div>

              <button type="button" onClick={() => setCourierModal(false)}><X /></button>

            </div>

            <label>Login<input required minLength="3" maxLength="50" autoComplete="off" value={courierForm.username} onChange={(e) => setCourierForm({ ...courierForm, username: e.target.value })} /></label>

            <label>Parol<input required minLength="8" maxLength="128" type="password" autoComplete="new-password" value={courierForm.password} onChange={(e) => setCourierForm({ ...courierForm, password: e.target.value })} /></label>

            <p className="admin-modal-hint">Parol kamida 8 ta belgidan iborat bo‘lsin. Uni kuryerga xavfsiz usulda yetkazing.</p>

            <div className="admin-modal-buttons">

              <button type="button" className="admin-secondary-button" onClick={() => setCourierModal(false)}>Bekor qilish</button>

              <button className="admin-primary-button" type="submit">Akkaunt yaratish</button>

            </div>

          </form>

        </div>

      )}

    </div>

  );

}



function ZapIcon() {
  return <span className="fp-zap-icon">ϟ</span>;
}

function MetricCard({ icon: Icon, label, value, tone, note }) {
  return (
    <article className={`fp-metric-card tone-${tone}`}>
      <div className="fp-metric-top"><span className="fp-metric-icon"><Icon size={19} /></span><span className="fp-metric-status"><i /> LIVE</span></div>
      <span className="fp-metric-label">{label}</span>
      <strong className="fp-metric-value">{Number(value || 0).toLocaleString("uz-UZ")}</strong>
      <span className="fp-metric-note">{note}</span>
      <div className="fp-metric-line"><span /></div>
    </article>
  );
}

function StatCard({ icon: Icon, label, value }) {

  return (

    <div className="admin-stat-card">

      <div className="admin-stat-icon"><Icon size={20} /></div>

      <span>{label}</span>

      <strong>{Number(value).toLocaleString("uz-UZ")}</strong>

    </div>

  );

}



function OrderTable({
  orders,
  detailed = false,
  couriers = [],
  onAssign,
}) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Buyurtma</th>
            <th>Mijoz</th>
            {detailed && <th>Telefon</th>}
            <th>Turi</th>
            <th>Jami</th>
            <th>Holati</th>
            <th>Sana</th>
            {detailed && <th>Kuryer biriktirish</th>}
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td><strong>#{order.id}</strong></td>
              <td>{order.customer_name}</td>
              {detailed && <td>{order.phone || "—"}</td>}
              <td>{order.order_type === "delivery" ? "Yetkazish" : "Olib ketish"}</td>
              <td><strong>{money(order.total_price)}</strong></td>
              <td>
                <span className={`admin-status ${order.status === "Yangi" ? "warning" : "success"}`}>
                  {order.status}
                </span>
              </td>
              <td>{order.created_at || "—"}</td>
              {detailed && (
                <td>
                  {order.order_type === "delivery" ? (
                    <CourierAssignment
                      order={order}
                      couriers={couriers}
                      onAssign={onAssign}
                    />
                  ) : (
                    <span className="admin-status muted">Olib ketish</span>
                  )}
                </td>
              )}
            </tr>
          ))}
          {orders.length === 0 && (
            <tr>
              <td colSpan={detailed ? 8 : 6}>Hozircha buyurtmalar yo‘q.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function CourierAssignment({ order, couriers, onAssign }) {
  const [selectedCourier, setSelectedCourier] = useState(
    order.courier_id ? String(order.courier_id) : ""
  );
  const [saving, setSaving] = useState(false);

  async function handleAssign() {
    if (!selectedCourier || !onAssign) return;
    setSaving(true);
    try {
      await onAssign(order.id, selectedCourier);
    } finally {
      setSaving(false);
    }
  }

  const activeCouriers = couriers.filter((courier) => courier.is_active);
  const assignedCourier = couriers.find(
    (courier) => Number(courier.id) === Number(order.courier_id)
  );

  return (
    <div className="admin-courier-assignment">
      {assignedCourier && (
        <small className="admin-block">
          Biriktirilgan: {assignedCourier.username}
        </small>
      )}
      <select
        aria-label={`#${order.id} buyurtma uchun kuryer`}
        value={selectedCourier}
        onChange={(event) => setSelectedCourier(event.target.value)}
        disabled={saving || activeCouriers.length === 0}
      >
        <option value="">Kuryerni tanlang</option>
        {activeCouriers.map((courier) => (
          <option key={courier.id} value={courier.id}>
            {courier.username}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="admin-secondary-button"
        onClick={handleAssign}
        disabled={saving || !selectedCourier}
      >
        {saving ? "Saqlanmoqda..." : "Biriktirish"}
      </button>
      {activeCouriers.length === 0 && (
        <small className="admin-block">Faol kuryer yo‘q.</small>
      )}
    </div>
  );
}
