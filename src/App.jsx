import React, { useState, useEffect, useMemo } from 'react';
import { LayoutDashboard, Package, Users, Truck, ShoppingCart, BarChart3, Plus, Search, X, AlertTriangle, TrendingUp, Wallet, Trash2, Edit2, LogOut } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabase } from './supabaseClient';
import Login from './Login';

function formatSom(n) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n || 0)) + " so'm";
}
function formatDate(ts) {
  return new Date(ts).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function StatCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: accent + '1a', color: accent }}><Icon size={20} /></div>
      <div className="stat-body">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  );
}
function Modal({ title, onClose, children, width }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: width || 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h3>{title}</h3><button className="icon-btn" onClick={onClose}><X size={18} /></button></div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
function EmptyState({ text }) { return <div className="empty-state">{text}</div>; }

// ---------- Main App ----------
export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = logged out
  const [data, setData] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [view, setView] = useState('dashboard');
  const [search, setSearch] = useState('');

  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [showNewSale, setShowNewSale] = useState(false);
  const [showPayDebt, setShowPayDebt] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) fetchAll();
  }, [session]);

  async function fetchAll() {
    setLoadingData(true);
    const userId = session.user.id;
    const [products, customers, suppliers, sales] = await Promise.all([
      supabase.from('products').select('*').eq('user_id', userId).order('created_at'),
      supabase.from('customers').select('*').eq('user_id', userId).order('created_at'),
      supabase.from('suppliers').select('*').eq('user_id', userId).order('created_at'),
      supabase.from('sales').select('*').eq('user_id', userId).order('date', { ascending: false }),
    ]);
    setData({
      products: products.data || [],
      customers: customers.data || [],
      suppliers: suppliers.data || [],
      sales: sales.data || [],
    });
    setLoadingData(false);
  }

  const chartData = useMemo(() => {
    if (!data) return [];
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - i);
      const next = d.getTime() + 24*60*60*1000;
      const total = data.sales.filter(s => new Date(s.date).getTime() >= d.getTime() && new Date(s.date).getTime() < next)
        .reduce((sum, s) => sum + s.total, 0);
      days.push({ name: d.toLocaleDateString('uz-UZ', { weekday: 'short' }), total });
    }
    return days;
  }, [data]);

  if (session === undefined) return <FullScreenLoader />;
  if (session === null) return <Login />;
  if (loadingData || !data) return <FullScreenLoader />;

  const today = new Date(); today.setHours(0,0,0,0);
  const todaySales = data.sales.filter(s => new Date(s.date).getTime() >= today.getTime());
  const todayTotal = todaySales.reduce((sum, s) => sum + s.total, 0);
  const totalDebt = data.customers.reduce((sum, c) => sum + c.debt, 0);
  const inventoryValue = data.products.reduce((sum, p) => sum + p.qty * p.buy_price, 0);
  const lowStock = data.products.filter(p => p.qty <= p.min_qty);
  const totalProfit = data.sales.reduce((sum, s) => {
    const profit = (s.items || []).reduce((isum, it) => {
      const prod = data.products.find(p => p.id === it.productId);
      const cost = prod ? prod.buy_price * it.qty : 0;
      return isum + (it.price * it.qty - cost);
    }, 0);
    return sum + profit;
  }, 0);

  const userId = session.user.id;

  // ---------- CRUD ----------
  async function addProduct(p) {
    const { data: row } = await supabase.from('products').insert({ ...p, user_id: userId, min_qty: p.minQty, buy_price: p.buyPrice, sell_price: p.sellPrice }).select().single();
    if (row) setData(d => ({ ...d, products: [...d.products, row] }));
  }
  async function updateProduct(id, patch) {
    const dbPatch = { name: patch.name, unit: patch.unit, qty: patch.qty, buy_price: patch.buyPrice, sell_price: patch.sellPrice, min_qty: patch.minQty };
    await supabase.from('products').update(dbPatch).eq('id', id);
    setData(d => ({ ...d, products: d.products.map(p => p.id === id ? { ...p, ...dbPatch } : p) }));
  }
  async function deleteProduct(id) {
    await supabase.from('products').delete().eq('id', id);
    setData(d => ({ ...d, products: d.products.filter(p => p.id !== id) }));
  }
  async function addCustomer(c) {
    const { data: row } = await supabase.from('customers').insert({ ...c, user_id: userId, debt: 0 }).select().single();
    if (row) setData(d => ({ ...d, customers: [...d.customers, row] }));
  }
  async function addSupplier(s) {
    const { data: row } = await supabase.from('suppliers').insert({ ...s, user_id: userId, balance: 0 }).select().single();
    if (row) setData(d => ({ ...d, suppliers: [...d.suppliers, row] }));
  }
  async function addSale(sale) {
    const { data: row } = await supabase.from('sales').insert({
      user_id: userId, customer_id: sale.customerId, items: sale.items, paid: sale.paid, total: sale.total, date: new Date().toISOString(),
    }).select().single();
    if (!row) return;

    // update product quantities
    for (const item of sale.items) {
      const prod = data.products.find(p => p.id === item.productId);
      if (prod) {
        const newQty = Math.max(0, prod.qty - item.qty);
        await supabase.from('products').update({ qty: newQty }).eq('id', prod.id);
      }
    }
    // update customer debt
    const cust = data.customers.find(c => c.id === sale.customerId);
    if (cust) {
      const owedDelta = sale.total - sale.paid;
      const newDebt = cust.debt + owedDelta;
      await supabase.from('customers').update({ debt: newDebt }).eq('id', cust.id);
    }

    setData(d => ({
      ...d,
      sales: [row, ...d.sales],
      products: d.products.map(p => {
        const item = sale.items.find(it => it.productId === p.id);
        return item ? { ...p, qty: Math.max(0, p.qty - item.qty) } : p;
      }),
      customers: d.customers.map(c => c.id === sale.customerId ? { ...c, debt: c.debt + (sale.total - sale.paid) } : c),
    }));
  }
  async function payDebt(customerId, amount) {
    const cust = data.customers.find(c => c.id === customerId);
    const newDebt = Math.max(0, cust.debt - amount);
    await supabase.from('customers').update({ debt: newDebt }).eq('id', customerId);
    setData(d => ({ ...d, customers: d.customers.map(c => c.id === customerId ? { ...c, debt: newDebt } : c) }));
  }
  async function handleLogout() {
    await supabase.auth.signOut();
  }

  const nav = [
    { key: 'dashboard', label: 'Bosh sahifa', icon: LayoutDashboard },
    { key: 'inventory', label: 'Ombor', icon: Package },
    { key: 'customers', label: 'Mijozlar', icon: Users },
    { key: 'suppliers', label: "Ta'minotchilar", icon: Truck },
    { key: 'sales', label: 'Savdo', icon: ShoppingCart },
    { key: 'reports', label: 'Hisobotlar', icon: BarChart3 },
  ];

  return (
    <div className="app">
      <style>{baseStyles}</style>

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">O</div>
          <div className="brand-text"><div className="brand-name">OptoBoard</div><div className="brand-sub">Ulgurji savdo</div></div>
        </div>
        <nav className="nav">
          {nav.map(n => (
            <button key={n.key} className={`nav-item ${view === n.key ? 'active' : ''}`} onClick={() => setView(n.key)}>
              <n.icon size={18} /><span>{n.label}</span>
            </button>
          ))}
        </nav>
        {lowStock.length > 0 && (
          <div className="sidebar-alert" onClick={() => setView('inventory')}>
            <AlertTriangle size={16} /><span>{lowStock.length} ta tovar kam qoldi</span>
          </div>
        )}
        <button className="nav-item logout" onClick={handleLogout}><LogOut size={18} /><span>Chiqish</span></button>
      </aside>

      <main className="main">
        {view === 'dashboard' && (
          <div className="page">
            <div className="page-header"><h1>Bosh sahifa</h1><button className="btn-primary" onClick={() => setShowNewSale(true)}><Plus size={16} /> Yangi savdo</button></div>
            <div className="stats-grid">
              <StatCard icon={ShoppingCart} label="Bugungi savdo" value={formatSom(todayTotal)} sub={`${todaySales.length} ta sotuv`} accent="#2563eb" />
              <StatCard icon={Wallet} label="Umumiy qarzdorlik" value={formatSom(totalDebt)} sub={`${data.customers.filter(c=>c.debt>0).length} ta mijoz`} accent="#dc2626" />
              <StatCard icon={Package} label="Ombor qiymati" value={formatSom(inventoryValue)} sub={`${data.products.length} xil tovar`} accent="#059669" />
              <StatCard icon={TrendingUp} label="Umumiy foyda" value={formatSom(totalProfit)} sub="barcha davr" accent="#7c3aed" />
            </div>
            <div className="dash-grid">
              <div className="card">
                <h3 className="card-title">So'nggi 7 kun savdosi</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#8a8f98' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#8a8f98' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v} />
                    <Tooltip formatter={v => formatSom(v)} contentStyle={{ borderRadius: 10, border: '1px solid #eef0f3', fontSize: 13 }} />
                    <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="card">
                <h3 className="card-title">Kam qolgan tovarlar</h3>
                {lowStock.length === 0 ? <EmptyState text="Hammasi yetarli miqdorda ✅" /> : (
                  <div className="mini-list">
                    {lowStock.map(p => (
                      <div className="mini-row" key={p.id}>
                        <div><div className="mini-row-title">{p.name}</div><div className="mini-row-sub">Min: {p.min_qty} {p.unit}</div></div>
                        <div className="badge-warning">{p.qty} {p.unit}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="card">
              <h3 className="card-title">So'nggi savdolar</h3>
              {data.sales.length === 0 ? <EmptyState text="Hali savdo qilinmagan" /> : (
                <table className="table">
                  <thead><tr><th>Sana</th><th>Mijoz</th><th>Summa</th><th>To'langan</th><th>Holat</th></tr></thead>
                  <tbody>
                    {data.sales.slice(0,5).map(s => {
                      const cust = data.customers.find(c => c.id === s.customer_id);
                      const isPaid = s.paid >= s.total;
                      return (
                        <tr key={s.id}>
                          <td>{formatDate(s.date)}</td><td>{cust ? cust.name : '—'}</td><td>{formatSom(s.total)}</td><td>{formatSom(s.paid)}</td>
                          <td>{isPaid ? <span className="badge-success">To'langan</span> : <span className="badge-danger">Qarzga</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {view === 'inventory' && (
          <InventoryView products={data.products} search={search} setSearch={setSearch}
            onAdd={() => setShowAddProduct(true)} onEdit={p => setEditProduct(p)} onDelete={deleteProduct} />
        )}
        {view === 'customers' && (
          <CustomersView customers={data.customers} search={search} setSearch={setSearch}
            onAdd={() => setShowAddCustomer(true)} onPay={c => setShowPayDebt(c)} />
        )}
        {view === 'suppliers' && <SuppliersView suppliers={data.suppliers} onAdd={() => setShowAddSupplier(true)} />}
        {view === 'sales' && <SalesView sales={data.sales} customers={data.customers} products={data.products} onNew={() => setShowNewSale(true)} />}
        {view === 'reports' && <ReportsView data={data} totalProfit={totalProfit} totalDebt={totalDebt} inventoryValue={inventoryValue} />}
      </main>

      {showAddProduct && <ProductModal title="Yangi tovar qo'shish" onClose={() => setShowAddProduct(false)} onSave={p => { addProduct(p); setShowAddProduct(false); }} />}
      {editProduct && <ProductModal title="Tovarni tahrirlash" initial={{ name: editProduct.name, unit: editProduct.unit, qty: editProduct.qty, buyPrice: editProduct.buy_price, sellPrice: editProduct.sell_price, minQty: editProduct.min_qty }} onClose={() => setEditProduct(null)} onSave={p => { updateProduct(editProduct.id, p); setEditProduct(null); }} />}
      {showAddCustomer && <CustomerModal onClose={() => setShowAddCustomer(false)} onSave={c => { addCustomer(c); setShowAddCustomer(false); }} />}
      {showAddSupplier && <SupplierModal onClose={() => setShowAddSupplier(false)} onSave={s => { addSupplier(s); setShowAddSupplier(false); }} />}
      {showNewSale && <NewSaleModal products={data.products} customers={data.customers} onClose={() => setShowNewSale(false)} onSave={sale => { addSale(sale); setShowNewSale(false); }} />}
      {showPayDebt && <PayDebtModal customer={showPayDebt} onClose={() => setShowPayDebt(null)} onSave={amount => { payDebt(showPayDebt.id, amount); setShowPayDebt(null); }} />}
    </div>
  );
}

function FullScreenLoader() {
  return (
    <div className="loading-screen">
      <div className="spinner" /><div>Yuklanmoqda...</div>
      <style>{baseStyles}</style>
    </div>
  );
}

// ---------- Inventory ----------
function InventoryView({ products, search, setSearch, onAdd, onEdit, onDelete }) {
  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="page">
      <div className="page-header"><h1>Ombor</h1><button className="btn-primary" onClick={onAdd}><Plus size={16} /> Tovar qo'shish</button></div>
      <div className="search-bar"><Search size={16} /><input placeholder="Tovar qidirish..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      <div className="card">
        {filtered.length === 0 ? <EmptyState text="Tovar topilmadi" /> : (
          <table className="table">
            <thead><tr><th>Nomi</th><th>Miqdor</th><th>Kelish narxi</th><th>Sotish narxi</th><th>Qiymati</th><th></th></tr></thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className={p.qty <= p.min_qty ? 'text-danger' : ''}>{p.qty} {p.unit}</td>
                  <td>{formatSom(p.buy_price)}</td><td>{formatSom(p.sell_price)}</td><td>{formatSom(p.qty * p.buy_price)}</td>
                  <td className="row-actions"><button className="icon-btn" onClick={() => onEdit(p)}><Edit2 size={15} /></button><button className="icon-btn danger" onClick={() => onDelete(p.id)}><Trash2 size={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
function ProductModal({ title, initial, onClose, onSave }) {
  const [form, setForm] = useState(initial || { name: '', unit: 'dona', qty: 0, buyPrice: 0, sellPrice: 0, minQty: 10 });
  return (
    <Modal title={title} onClose={onClose}>
      <div className="form">
        <label>Tovar nomi<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Masalan: Coca-Cola 1.5L" /></label>
        <div className="form-row">
          <label>O'lchov birligi<input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} /></label>
          <label>Miqdor<input type="number" value={form.qty} onChange={e => setForm({ ...form, qty: +e.target.value })} /></label>
        </div>
        <div className="form-row">
          <label>Kelish narxi<input type="number" value={form.buyPrice} onChange={e => setForm({ ...form, buyPrice: +e.target.value })} /></label>
          <label>Sotish narxi<input type="number" value={form.sellPrice} onChange={e => setForm({ ...form, sellPrice: +e.target.value })} /></label>
        </div>
        <label>Minimal qoldiq (ogohlantirish uchun)<input type="number" value={form.minQty} onChange={e => setForm({ ...form, minQty: +e.target.value })} /></label>
        <button className="btn-primary full" disabled={!form.name} onClick={() => onSave(form)}>Saqlash</button>
      </div>
    </Modal>
  );
}

// ---------- Customers ----------
function CustomersView({ customers, search, setSearch, onAdd, onPay }) {
  const filtered = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="page">
      <div className="page-header"><h1>Mijozlar</h1><button className="btn-primary" onClick={onAdd}><Plus size={16} /> Mijoz qo'shish</button></div>
      <div className="search-bar"><Search size={16} /><input placeholder="Mijoz qidirish..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      <div className="card-grid">
        {filtered.length === 0 ? <EmptyState text="Mijoz topilmadi" /> : filtered.map(c => (
          <div className="customer-card" key={c.id}>
            <div className="customer-avatar">{c.name.charAt(0).toUpperCase()}</div>
            <div className="customer-info"><div className="customer-name">{c.name}</div><div className="customer-phone">{c.phone}</div></div>
            <div className="customer-debt">
              {c.debt > 0 ? (<><div className="debt-amount">{formatSom(c.debt)}</div><button className="btn-small" onClick={() => onPay(c)}>To'lov qilish</button></>) : <span className="badge-success">Qarzi yo'q</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
function CustomerModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', phone: '' });
  return (
    <Modal title="Yangi mijoz qo'shish" onClose={onClose}>
      <div className="form">
        <label>Ism / do'kon nomi<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Masalan: Akmal aka (Chorsu market)" /></label>
        <label>Telefon raqami<input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+998 90 123 45 67" /></label>
        <button className="btn-primary full" disabled={!form.name} onClick={() => onSave(form)}>Saqlash</button>
      </div>
    </Modal>
  );
}
function PayDebtModal({ customer, onClose, onSave }) {
  const [amount, setAmount] = useState(customer.debt);
  return (
    <Modal title={`${customer.name} — to'lov`} onClose={onClose}>
      <div className="form">
        <div className="debt-banner">Joriy qarz: <strong>{formatSom(customer.debt)}</strong></div>
        <label>To'lov summasi<input type="number" value={amount} onChange={e => setAmount(+e.target.value)} /></label>
        <button className="btn-primary full" disabled={amount <= 0} onClick={() => onSave(amount)}>To'lovni qabul qilish</button>
      </div>
    </Modal>
  );
}

// ---------- Suppliers ----------
function SuppliersView({ suppliers, onAdd }) {
  return (
    <div className="page">
      <div className="page-header"><h1>Ta'minotchilar</h1><button className="btn-primary" onClick={onAdd}><Plus size={16} /> Ta'minotchi qo'shish</button></div>
      <div className="card">
        {suppliers.length === 0 ? <EmptyState text="Ta'minotchi yo'q" /> : (
          <table className="table">
            <thead><tr><th>Nomi</th><th>Telefon</th><th>Balans</th></tr></thead>
            <tbody>
              {suppliers.map(s => (
                <tr key={s.id}><td>{s.name}</td><td>{s.phone}</td><td className={s.balance < 0 ? 'text-danger' : 'text-success'}>{formatSom(Math.abs(s.balance))} {s.balance < 0 ? '(qarzdormiz)' : ''}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
function SupplierModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', phone: '' });
  return (
    <Modal title="Yangi ta'minotchi" onClose={onClose}>
      <div className="form">
        <label>Kompaniya nomi<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
        <label>Telefon raqami<input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
        <button className="btn-primary full" disabled={!form.name} onClick={() => onSave(form)}>Saqlash</button>
      </div>
    </Modal>
  );
}
// ---------- Sales ----------
function SalesView({ sales, customers, products, onNew }) {
  return (
    <div className="page">
      <div className="page-header"><h1>Savdo tarixi</h1><button className="btn-primary" onClick={onNew}><Plus size={16} /> Yangi savdo</button></div>
      <div className="card">
        {sales.length === 0 ? <EmptyState text="Hali savdo qilinmagan" /> : (
          <table className="table">
            <thead><tr><th>Sana</th><th>Mijoz</th><th>Tovarlar</th><th>Summa</th><th>To'langan</th><th>Qarz</th></tr></thead>
            <tbody>
              {sales.map(s => {
                const cust = customers.find(c => c.id === s.customer_id);
                const itemNames = (s.items || []).map(it => { const p = products.find(pp => pp.id === it.productId); return p ? `${p.name} x${it.qty}` : ''; }).join(', ');
                const debt = s.total - s.paid;
                return (
                  <tr key={s.id}>
                    <td>{formatDate(s.date)}</td><td>{cust ? cust.name : '—'}</td><td className="small-text">{itemNames}</td>
                    <td>{formatSom(s.total)}</td><td>{formatSom(s.paid)}</td><td className={debt > 0 ? 'text-danger' : ''}>{debt > 0 ? formatSom(debt) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
function NewSaleModal({ products, customers, onClose, onSave }) {
  const [customerId, setCustomerId] = useState(customers[0]?.id || '');
  const [items, setItems] = useState([]);
  const [productId, setProductId] = useState(products[0]?.id || '');
  const [qty, setQty] = useState(1);
  const [paid, setPaid] = useState(0);
  const total = items.reduce((sum, it) => sum + it.qty * it.price, 0);

  function addItem() {
    const prod = products.find(p => p.id === productId);
    if (!prod || qty <= 0) return;
    setItems([...items, { productId, qty, price: prod.sell_price, name: prod.name }]);
    setQty(1);
  }
  function removeItem(idx) { setItems(items.filter((_, i) => i !== idx)); }

  return (
    <Modal title="Yangi savdo" onClose={onClose} width={560}>
      <div className="form">
        <label>Mijoz<select value={customerId} onChange={e => setCustomerId(e.target.value)}>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <div className="add-item-row">
          <select value={productId} onChange={e => setProductId(e.target.value)}>{products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.qty} {p.unit})</option>)}</select>
          <input type="number" min="1" value={qty} onChange={e => setQty(+e.target.value)} style={{ width: 80 }} />
          <button className="btn-secondary" onClick={addItem}>Qo'shish</button>
        </div>
        {items.length > 0 && (
          <div className="cart-list">
            {items.map((it, idx) => (
              <div className="cart-row" key={idx}><span>{it.name} x{it.qty}</span><span>{formatSom(it.qty * it.price)}</span><button className="icon-btn danger" onClick={() => removeItem(idx)}><X size={14} /></button></div>
            ))}
          </div>
        )}
        <div className="cart-total">Jami: <strong>{formatSom(total)}</strong></div>
        <label>To'langan summa<input type="number" value={paid} onChange={e => setPaid(+e.target.value)} /></label>
        {paid < total && <div className="hint-text">Qolgan {formatSom(total - paid)} mijoz qarziga yoziladi</div>}
        <button className="btn-primary full" disabled={items.length === 0 || !customerId} onClick={() => onSave({ customerId, items, paid, total })}>Savdoni saqlash</button>
      </div>
    </Modal>
  );
}

// ---------- Reports ----------
function ReportsView({ data, totalProfit, totalDebt, inventoryValue }) {
  const productSales = useMemo(() => {
    const map = {};
    data.sales.forEach(s => (s.items || []).forEach(it => {
      const prod = data.products.find(p => p.id === it.productId);
      const name = prod ? prod.name : "Noma'lum";
      map[name] = (map[name] || 0) + it.qty * it.price;
    }));
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 6);
  }, [data]);
  const COLORS = ['#2563eb', '#059669', '#7c3aed', '#dc2626', '#d97706', '#0891b2'];

  return (
    <div className="page">
      <div className="page-header"><h1>Hisobotlar</h1></div>
      <div className="stats-grid">
        <StatCard icon={TrendingUp} label="Umumiy foyda" value={formatSom(totalProfit)} accent="#059669" />
        <StatCard icon={Wallet} label="Umumiy qarzdorlik" value={formatSom(totalDebt)} accent="#dc2626" />
        <StatCard icon={Package} label="Ombor qiymati" value={formatSom(inventoryValue)} accent="#2563eb" />
      </div>
      <div className="dash-grid">
        <div className="card">
          <h3 className="card-title">Eng ko'p sotilgan tovarlar</h3>
          {productSales.length === 0 ? <EmptyState text="Ma'lumot yo'q" /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={productSales} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#8a8f98' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12, fill: '#3a3f47' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={v => formatSom(v)} contentStyle={{ borderRadius: 10, border: '1px solid #eef0f3', fontSize: 13 }} />
                <Bar dataKey="value" fill="#2563eb" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="card">
          <h3 className="card-title">Mijozlar qarzdorligi taqsimoti</h3>
          {data.customers.filter(c => c.debt > 0).length === 0 ? <EmptyState text="Qarzdor mijozlar yo'q" /> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={data.customers.filter(c => c.debt > 0)} dataKey="debt" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name }) => name.split(' ')[0]}>
                  {data.customers.filter(c => c.debt > 0).map((c, i) => <Cell key={c.id} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => formatSom(v)} contentStyle={{ borderRadius: 10, border: '1px solid #eef0f3', fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

const baseStyles = `
* { box-sizing: border-box; }
body { margin: 0; }
.app { display: flex; min-height: 100vh; background: #f7f8fa; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1d23; }
.loading-screen { height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: #8a8f98; font-family: 'Inter', sans-serif; }
.spinner { width: 28px; height: 28px; border: 3px solid #e5e7eb; border-top-color: #2563eb; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.sidebar { width: 240px; background: #161a23; color: #fff; display: flex; flex-direction: column; padding: 20px 14px; flex-shrink: 0; }
.brand { display: flex; align-items: center; gap: 10px; padding: 8px 10px 24px; }
.brand-mark { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #2563eb, #7c3aed); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px; }
.brand-name { font-weight: 700; font-size: 15px; }
.brand-sub { font-size: 11px; color: #8a8f98; }
.nav { display: flex; flex-direction: column; gap: 2px; }
.nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; border: none; background: transparent; color: #b4b8c2; font-size: 13.5px; font-weight: 500; cursor: pointer; text-align: left; transition: background 0.15s, color 0.15s; }
.nav-item:hover { background: #1f2430; color: #fff; }
.nav-item.active { background: #2563eb; color: #fff; }
.nav-item.logout { margin-top: 10px; color: #f87171; }
.sidebar-alert { margin-top: auto; display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 8px; background: #2a1d1d; color: #f87171; font-size: 12.5px; cursor: pointer; }
.main { flex: 1; overflow-y: auto; padding: 28px 32px; }
.page { max-width: 1100px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; }
.page-header h1 { font-size: 22px; font-weight: 700; margin: 0; }
.btn-primary { display: inline-flex; align-items: center; gap: 6px; background: #2563eb; color: #fff; border: none; padding: 9px 16px; border-radius: 8px; font-size: 13.5px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
.btn-primary:hover { background: #1d4ed8; }
.btn-primary:disabled { background: #c7d2fe; cursor: not-allowed; }
.btn-primary.full { width: 100%; justify-content: center; margin-top: 6px; }
.btn-secondary { background: #eef2ff; color: #2563eb; border: none; padding: 9px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
.btn-small { background: #2563eb; color: #fff; border: none; padding: 5px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; margin-top: 4px; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 22px; }
.stat-card { background: #fff; border-radius: 14px; padding: 16px; display: flex; gap: 12px; align-items: center; border: 1px solid #eef0f3; }
.stat-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.stat-label { font-size: 12px; color: #8a8f98; font-weight: 500; }
.stat-value { font-size: 18px; font-weight: 700; margin-top: 2px; }
.stat-sub { font-size: 11.5px; color: #8a8f98; margin-top: 2px; }
.dash-grid { display: grid; grid-template-columns: 1.3fr 1fr; gap: 16px; margin-bottom: 16px; }
@media (max-width: 900px) { .dash-grid { grid-template-columns: 1fr; } .sidebar { width: 200px; } }
@media (max-width: 700px) { .app { flex-direction: column; } .sidebar { width: 100%; flex-direction: row; align-items: center; padding: 12px 16px; overflow-x: auto; } .nav { flex-direction: row; } .sidebar-alert, .nav-item span { display: none; } .brand { padding: 0; margin-right: 8px; } }
.card { background: #fff; border-radius: 14px; padding: 20px; border: 1px solid #eef0f3; margin-bottom: 16px; }
.card-title { font-size: 14px; font-weight: 700; margin: 0 0 14px; }
.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
.table { width: 100%; border-collapse: collapse; font-size: 13px; }
.table th { text-align: left; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.03em; color: #8a8f98; padding: 8px 10px; border-bottom: 1px solid #eef0f3; }
.table td { padding: 11px 10px; border-bottom: 1px solid #f4f5f7; }
.table tr:last-child td { border-bottom: none; }
.small-text { font-size: 12px; color: #6b7280; max-width: 220px; }
.row-actions { display: flex; gap: 4px; }
.text-danger { color: #dc2626; font-weight: 600; }
.text-success { color: #059669; font-weight: 600; }
.badge-success { background: #dcfce7; color: #16a34a; padding: 3px 10px; border-radius: 20px; font-size: 11.5px; font-weight: 600; }
.badge-danger { background: #fee2e2; color: #dc2626; padding: 3px 10px; border-radius: 20px; font-size: 11.5px; font-weight: 600; }
.badge-warning { background: #fef3c7; color: #d97706; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; }
.mini-list { display: flex; flex-direction: column; gap: 10px; }
.mini-row { display: flex; justify-content: space-between; align-items: center; }
.mini-row-title { font-size: 13px; font-weight: 600; }
.mini-row-sub { font-size: 11.5px; color: #8a8f98; }
.empty-state { text-align: center; padding: 30px 10px; color: #8a8f98; font-size: 13px; }
.search-bar { display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid #eef0f3; border-radius: 10px; padding: 9px 14px; margin-bottom: 16px; max-width: 360px; color: #8a8f98; }
.search-bar input { border: none; outline: none; font-size: 13.5px; flex: 1; }
.icon-btn { background: #f4f5f7; border: none; width: 30px; height: 30px; border-radius: 7px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #4b5563; }
.icon-btn.danger { color: #dc2626; }
.icon-btn:hover { background: #e5e7eb; }
.customer-card { background: #fff; border: 1px solid #eef0f3; border-radius: 12px; padding: 14px; display: flex; align-items: center; gap: 12px; }
.customer-avatar { width: 42px; height: 42px; border-radius: 50%; background: #eef2ff; color: #2563eb; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0; }
.customer-info { flex: 1; min-width: 0; }
.customer-name { font-size: 13.5px; font-weight: 600; }
.customer-phone { font-size: 11.5px; color: #8a8f98; }
.customer-debt { text-align: right; }
.debt-amount { font-size: 13px; font-weight: 700; color: #dc2626; }
.modal-overlay { position: fixed; inset: 0; background: rgba(15,18,25,0.5); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 16px; }
.modal { background: #fff; border-radius: 16px; width: 100%; max-height: 90vh; overflow-y: auto; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 18px 20px; border-bottom: 1px solid #eef0f3; }
.modal-header h3 { margin: 0; font-size: 15px; font-weight: 700; }
.modal-body { padding: 20px; }
.form { display: flex; flex-direction: column; gap: 14px; }
.form label { display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; font-weight: 600; color: #4b5563; }
.form input, .form select { padding: 9px 11px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 13.5px; font-family: inherit; outline: none; }
.form input:focus, .form select:focus { border-color: #2563eb; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.add-item-row { display: flex; gap: 8px; }
.add-item-row select { flex: 1; padding: 9px 11px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 13px; }
.add-item-row input { padding: 9px 11px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 13px; }
.cart-list { display: flex; flex-direction: column; gap: 6px; background: #f7f8fa; border-radius: 10px; padding: 10px; }
.cart-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; padding: 4px 0; }
.cart-total { display: flex; justify-content: space-between; font-size: 14px; padding: 8px 0; border-top: 1px dashed #e5e7eb; }
.hint-text { font-size: 11.5px; color: #d97706; }
.debt-banner { background: #fef3c7; color: #92400e; padding: 10px 12px; border-radius: 8px; font-size: 13px; }
`;
