import { useState, useEffect, useRef, useCallback } from 'react';
import { db, storage, auth } from './firebase.js';
import {
  collection, onSnapshot, doc,
  addDoc, updateDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import {
  ref as sRef, uploadBytes, getDownloadURL, deleteObject,
} from 'firebase/storage';
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
} from 'firebase/auth';

/* ── BRAND TOKENS ─────────────────────────────────────── */
const B = {
  bgDark:  '#0a0806',
  bgCard:  '#13100d',
  bgMid:   '#1c1810',
  bgLight: '#261e14',
  gold:    '#d4a520',
  goldL:   '#e8c97a',
  goldD:   '#9a7010',
  goldDim: 'rgba(212,165,32,0.11)',
  goldBdr: 'rgba(212,165,32,0.22)',
  text:    '#fdf6ee',
  textM:   'rgba(253,246,238,0.52)',
  textD:   'rgba(253,246,238,0.28)',
  danger:  '#c04040',
};

const WA = '233245594900';

const CATS = [
  { id: 'all',         label: 'All Items',        emoji: '✨' },
  { id: 'earrings',    label: 'Earrings',          emoji: '💎' },
  { id: 'necklaces',   label: 'Necklaces',         emoji: '📿' },
  { id: 'bracelets',   label: 'Bracelets',         emoji: '💫' },
  { id: 'waist-beads', label: 'Waist Beads',       emoji: '🌟' },
  { id: 'watches',     label: 'Wrist Watches',     emoji: '⌚' },
  { id: 'hair',        label: 'Hair Accessories',  emoji: '🌸' },
  { id: 'aesthetics',  label: 'Aesthetics',        emoji: '🪞' },
  { id: 'perfumes',    label: 'Perfumes',          emoji: '🌺' },
];

const EMOJIS = ['💎','📿','💫','🌟','⌚','🌸','🪞','🌺','✨','👑','💍','🎀','🛍️','🌹','🦋','🌙'];

/* ── IMAGE COMPRESSION ────────────────────────────────── */
const compressToBlob = (file, maxW = 700, q = 0.80) =>
  new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const r = Math.min(maxW / img.width, maxW / img.height, 1);
        const c = document.createElement('canvas');
        c.width  = Math.round(img.width  * r);
        c.height = Math.round(img.height * r);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(blob => res(blob), 'image/jpeg', q);
      };
      img.onerror = rej;
      img.src = e.target.result;
    };
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });

const uploadImg = async (file, id) => {
  const blob = await compressToBlob(file);
  const ref  = sRef(storage, `products/${id}.jpg`);
  await uploadBytes(ref, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(ref);
};

const emptyForm = () => ({ name: '', category: 'earrings', price: '', emoji: '💎', description: '' });
const catLabel  = id => CATS.find(c => c.id === id)?.label || id;

/* ── SPINNER ──────────────────────────────────────────── */
const Spinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>
    <div style={{ fontFamily: 'serif', fontSize: '32px', color: '#d4a520', animation: 'spin 1.5s linear infinite' }}>✦</div>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

/* ══════════════════════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════════════════════ */
export default function App() {
  /* state */
  const [products,  setProducts]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [cart,      setCart]      = useState({});
  const [cat,       setCat]       = useState('all');
  const [search,    setSearch]    = useState('');
  const [view,      setView]      = useState('shop'); // shop | checkout | admin
  const [adminUser, setAdminUser] = useState(null);
  const [authInit,  setAuthInit]  = useState(false);

  /* login modal */
  const [showLogin,  setShowLogin]  = useState(false);
  const [lEmail,     setLEmail]     = useState('');
  const [lPw,        setLPw]        = useState('');
  const [lErr,       setLErr]       = useState('');
  const [lLoading,   setLLoading]   = useState(false);

  /* product form */
  const [showForm,  setShowForm]  = useState(false);
  const [editProd,  setEditProd]  = useState(null);
  const [form,      setForm]      = useState(emptyForm());
  const [imgFile,   setImgFile]   = useState(null);
  const [imgPrev,   setImgPrev]   = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(null);

  /* checkout */
  const [address,  setAddress]  = useState('');
  const [note,     setNote]     = useState('');

  /* misc */
  const [toast,   setToast]   = useState({ m: '', t: 'ok' });
  const [detail,  setDetail]  = useState(null);
  const [fontsOk, setFontsOk] = useState(false);
  const fileRef = useRef();

  /* ── fonts ── */
  useEffect(() => {
    const l = document.createElement('link');
    l.rel  = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Jost:wght@300;400;500;600;700&display=swap';
    document.head.appendChild(l);
    l.onload = () => setFontsOk(true);
  }, []);

  /* ── auth listener ── */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      setAdminUser(user);
      setAuthInit(true);
    });
    return unsub;
  }, []);

  /* ── products listener (real-time) ── */
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'products'),
      snap => {
        const prods = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        prods.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setProducts(prods);
        setLoading(false);
      },
      err => { console.error(err); setLoading(false); },
    );
    return unsub;
  }, []);

  /* ── toast ── */
  const toast$ = useCallback((m, t = 'ok') => {
    setToast({ m, t });
    setTimeout(() => setToast({ m: '', t: 'ok' }), 2800);
  }, []);

  /* ── auth ── */
  const doLogin = async () => {
    if (!lEmail || !lPw) return;
    setLLoading(true); setLErr('');
    try {
      await signInWithEmailAndPassword(auth, lEmail, lPw);
      setShowLogin(false); setLEmail(''); setLPw(''); setView('admin');
    } catch {
      setLErr('Incorrect email or password. Please try again.');
    }
    setLLoading(false);
  };

  const doLogout = async () => { await signOut(auth); setView('shop'); };

  /* ── cart ── */
  const addCart = id => { setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 })); toast$('Added to cart ✓'); };
  const inc     = id => setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const dec     = id => setCart(c => { const n = { ...c }; n[id] > 1 ? n[id]-- : delete n[id]; return n; });
  const remC    = id => setCart(c => { const n = { ...c }; delete n[id]; return n; });

  const cartItems = Object.entries(cart)
    .map(([id, qty]) => { const p = products.find(x => x.id === id); return p ? { ...p, qty } : null; })
    .filter(Boolean);
  const cartTotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const cartCount = Object.values(cart).reduce((s, v) => s + v, 0);

  /* ── order submit ── */
  const submitOrder = () => {
    if (!cartItems.length) return;
    const lines = cartItems.map(i => `• ${i.emoji} ${i.name} x${i.qty} — ₵${(i.price * i.qty).toFixed(2)}`).join('\n');
    const msg = `Hello ENORA EMBER! 🛍️\n\nI'd like to place an order:\n\n${lines}\n\n*Total: ₵${cartTotal.toFixed(2)}*\n\n📍 Delivery Address:\n${address || 'To be confirmed'}${note ? `\n\n📝 Note: ${note}` : ''}\n\nThank you! ✨`;
    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(msg)}`, '_blank');
    setCart({}); setAddress(''); setNote(''); setView('shop');
    toast$('Order sent via WhatsApp! 🎉');
  };

  /* ── product CRUD ── */
  const pickImg = async file => {
    if (!file) return;
    const r = new FileReader();
    r.onload = e => setImgPrev(e.target.result);
    r.readAsDataURL(file);
    setImgFile(file);
  };

  const saveProd = async () => {
    if (!form.name.trim() || !form.price) { toast$('Name and price required', 'err'); return; }
    setSaving(true);
    try {
      const data = {
        name:        form.name.trim(),
        category:    form.category,
        price:       parseFloat(form.price),
        emoji:       form.emoji,
        description: form.description.trim(),
        updatedAt:   serverTimestamp(),
      };
      if (editProd) {
        await updateDoc(doc(db, 'products', editProd.id), data);
        if (imgFile) {
          const url = await uploadImg(imgFile, editProd.id);
          await updateDoc(doc(db, 'products', editProd.id), { imageUrl: url });
        }
        toast$('Product updated ✓');
      } else {
        data.createdAt = serverTimestamp();
        const ref = await addDoc(collection(db, 'products'), data);
        if (imgFile) {
          const url = await uploadImg(imgFile, ref.id);
          await updateDoc(ref, { imageUrl: url });
        }
        toast$('Product added ✓');
      }
      closeForm();
    } catch (e) {
      console.error(e);
      toast$('Error saving product. Check console.', 'err');
    }
    setSaving(false);
  };

  const delProd = async (id, imageUrl) => {
    if (!window.confirm('Delete this product? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await deleteDoc(doc(db, 'products', id));
      if (imageUrl) {
        try { await deleteObject(sRef(storage, `products/${id}.jpg`)); } catch {}
      }
      toast$('Product deleted');
    } catch { toast$('Error deleting product', 'err'); }
    setDeleting(null);
  };

  const startEdit = p => {
    setEditProd(p);
    setForm({ name: p.name, category: p.category, price: p.price.toString(), emoji: p.emoji, description: p.description || '' });
    setImgPrev(p.imageUrl || null);
    setImgFile(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false); setEditProd(null); setForm(emptyForm()); setImgFile(null); setImgPrev(null);
  };

  const closeLogin = () => { setShowLogin(false); setLErr(''); setLEmail(''); setLPw(''); };

  const filtered = products.filter(p => {
    const cok = cat === 'all' || p.category === cat;
    const q   = search.trim().toLowerCase();
    return cok && (!q || p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
  });

  /* ── style atoms ── */
  const FF  = fontsOk ? "'Playfair Display', serif" : 'serif';
  const FJ  = fontsOk ? "'Jost', sans-serif"        : 'sans-serif';
  const LBL = { display: 'block', fontFamily: FJ, fontSize: '10px', fontWeight: '600', letterSpacing: '1.5px', textTransform: 'uppercase', color: B.textM, marginBottom: '5px' };
  const INP = { width: '100%', padding: '11px 13px', border: `1.5px solid ${B.goldBdr}`, borderRadius: '10px', fontFamily: FJ, fontSize: '13px', color: B.text, background: B.bgMid, outline: 'none', boxSizing: 'border-box', marginBottom: '12px' };
  const SEL = { ...INP, appearance: 'auto' };
  const TXA = { ...INP, minHeight: '70px', resize: 'vertical' };
  const BTN = { width: '100%', background: `linear-gradient(135deg,${B.gold},${B.goldD})`, color: B.bgDark, border: 'none', borderRadius: '11px', padding: '13px', fontFamily: FJ, fontWeight: '700', fontSize: '14px', cursor: 'pointer', marginTop: '4px', letterSpacing: '0.5px' };
  const QB  = { background: B.gold, border: 'none', borderRadius: '6px', fontWeight: '700', fontSize: '16px', cursor: 'pointer', color: B.bgDark, display: 'flex', alignItems: 'center', justifyContent: 'center' };

  /* ── wait for auth init ── */
  if (!authInit) return (
    <div style={{ minHeight: '100vh', background: B.bgDark, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner />
    </div>
  );

  /* ════════════════ ADMIN VIEW ════════════════ */
  if (view === 'admin' && adminUser) return (
    <div style={{ minHeight: '100vh', background: B.bgDark, fontFamily: FJ, color: B.text, paddingBottom: '30px' }}>
      <Toast toast={toast} FJ={FJ} B={B} />

      {/* Admin header */}
      <div style={{ background: `linear-gradient(135deg,${B.bgDark},${B.bgMid})`, padding: '15px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${B.goldBdr}`, position: 'sticky', top: 0, zIndex: 50 }}>
        <div>
          <div style={{ fontSize: '8px', letterSpacing: '2px', color: B.textD, textTransform: 'uppercase', marginBottom: '1px' }}>Admin Panel</div>
          <div style={{ fontFamily: FF, fontSize: '18px', fontWeight: '700', color: B.goldL, letterSpacing: '2px' }}>ENORA EMBER</div>
        </div>
        <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button onClick={() => setView('shop')} style={adminBtn(B, FJ)}>← Shop</button>
          <button onClick={() => { setAdminUser(null); doLogout(); }} style={adminBtn(B, FJ, true)}>Logout</button>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: '10px', padding: '14px 14px 8px' }}>
        {[
          { label: 'Total Products', val: products.length },
          { label: 'Categories',     val: [...new Set(products.map(p => p.category))].length },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: B.bgCard, border: `1px solid ${B.goldBdr}`, borderRadius: '10px', padding: '10px 12px' }}>
            <div style={{ fontFamily: FF, fontSize: '22px', fontWeight: '700', color: B.gold }}>{s.val}</div>
            <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: B.textD, marginTop: '2px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Add button */}
      <button onClick={() => { setEditProd(null); setForm(emptyForm()); setImgFile(null); setImgPrev(null); setShowForm(true); }}
        style={{ display: 'flex', alignItems: 'center', gap: '7px', background: `linear-gradient(135deg,${B.gold},${B.goldD})`, color: B.bgDark, border: 'none', borderRadius: '10px', padding: '11px 18px', fontFamily: FJ, fontWeight: '700', fontSize: '13px', cursor: 'pointer', margin: '6px 14px 10px' }}>
        <span style={{ fontSize: '18px', lineHeight: 1 }}>+</span> Add New Product
      </button>

      {/* Product list */}
      <div style={{ margin: '0 14px', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${B.goldBdr}` }}>
        {loading
          ? <Spinner />
          : products.length === 0
            ? <div style={{ padding: '40px', textAlign: 'center', color: B.textM, fontFamily: FF, fontSize: '18px' }}>No products yet. Add your first one!</div>
            : products.map((p, i) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderBottom: i < products.length - 1 ? `1px solid ${B.goldBdr}` : 'none', background: B.bgCard }}>
                  {p.imageUrl
                    ? <img src={p.imageUrl} alt={p.name} style={{ width: '52px', height: '52px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0, border: `1px solid ${B.goldBdr}` }} />
                    : <div style={{ width: '52px', height: '52px', borderRadius: '8px', flexShrink: 0, background: B.bgMid, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', border: `1px solid ${B.goldBdr}` }}>{p.emoji}</div>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FF, fontSize: '14px', fontWeight: '600', color: B.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: B.textD }}>{catLabel(p.category)}</div>
                    {p.description && <div style={{ fontSize: '10px', color: B.textM, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description}</div>}
                  </div>
                  <div style={{ fontFamily: FF, fontSize: '16px', fontWeight: '700', color: B.gold, marginRight: '6px', flexShrink: 0 }}>₵{p.price}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <button onClick={() => startEdit(p)} style={{ background: B.goldDim, border: `1px solid ${B.goldBdr}`, color: B.goldL, borderRadius: '6px', padding: '5px 9px', fontFamily: FJ, fontSize: '10px', cursor: 'pointer', fontWeight: '600' }}>Edit</button>
                    <button onClick={() => delProd(p.id, p.imageUrl)} disabled={deleting === p.id}
                      style={{ background: 'rgba(192,64,64,0.1)', border: '1px solid rgba(192,64,64,0.25)', color: '#e08080', borderRadius: '6px', padding: '5px 9px', fontFamily: FJ, fontSize: '10px', cursor: 'pointer', fontWeight: '600' }}>
                      {deleting === p.id ? '…' : 'Del'}
                    </button>
                  </div>
                </div>
              ))
        }
      </div>

      {/* Product form sheet */}
      {showForm && (
        <Sheet onClose={closeForm} B={B}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontFamily: FF, fontSize: '20px', fontWeight: '700', color: B.goldL }}>{editProd ? 'Edit Product' : 'Add Product'}</div>
            <button onClick={closeForm} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: B.textM, lineHeight: 1 }}>×</button>
          </div>

          {/* Image upload */}
          <label style={LBL}>Product Photo</label>
          {imgPrev && <img src={imgPrev} alt="preview" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '12px', marginBottom: '10px', border: `1px solid ${B.goldBdr}`, display: 'block' }} />}
          <div onClick={() => fileRef.current?.click()} style={{ border: `2px dashed ${B.goldBdr}`, borderRadius: '12px', padding: '20px', textAlign: 'center', cursor: 'pointer', marginBottom: '14px', background: B.goldDim }}>
            <div style={{ fontSize: '28px', marginBottom: '5px' }}>📷</div>
            <div style={{ fontFamily: FJ, fontSize: '12px', color: B.textM, fontWeight: '500' }}>{imgPrev ? 'Tap to change photo' : 'Tap to upload photo'}</div>
            <div style={{ fontFamily: FJ, fontSize: '10px', color: B.textD, marginTop: '3px' }}>JPG · PNG · WEBP — auto-compressed & uploaded to cloud</div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => pickImg(e.target.files[0])} />

          {/* Emoji fallback */}
          <label style={LBL}>Fallback Icon (shown if no photo)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginBottom: '14px' }}>
            {EMOJIS.map(e => (
              <button key={e} onClick={() => setForm(f => ({ ...f, emoji: e }))}
                style={{ fontSize: '20px', background: form.emoji === e ? B.goldDim : 'transparent', border: `1.5px solid ${form.emoji === e ? B.gold : 'transparent'}`, borderRadius: '7px', padding: '4px 7px', cursor: 'pointer' }}>
                {e}
              </button>
            ))}
          </div>

          <label style={LBL}>Product Name *</label>
          <input style={INP} placeholder="e.g. Gold Waist Beads" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />

          <label style={LBL}>Description</label>
          <textarea style={TXA} placeholder="Short description of this item…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />

          <label style={LBL}>Category</label>
          <select style={SEL} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {CATS.filter(c => c.id !== 'all').map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
          </select>

          <label style={LBL}>Price (GHS ₵) *</label>
          <input style={INP} type="number" min="0" step="0.01" placeholder="e.g. 85" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />

          <button style={BTN} onClick={saveProd} disabled={saving}>{saving ? 'Saving…' : editProd ? 'Update Product' : 'Add Product'}</button>
          <span style={{ display: 'block', textAlign: 'center', marginTop: '10px', color: B.textD, fontFamily: FJ, fontSize: '12px', cursor: 'pointer' }} onClick={closeForm}>Cancel</span>
        </Sheet>
      )}
    </div>
  );

  /* ════════════════ SHOP VIEW ════════════════ */
  return (
    <div style={{ minHeight: '100vh', background: B.bgDark, fontFamily: FJ, color: B.text, overflowX: 'hidden' }}>
      <Toast toast={toast} FJ={FJ} B={B} />

      {/* ── Header ── */}
      <div style={{ background: `linear-gradient(160deg,#1c1408 0%,${B.bgDark} 100%)`, padding: '20px 16px 16px', textAlign: 'center', position: 'sticky', top: 0, zIndex: 50, borderBottom: `1px solid ${B.goldBdr}` }}>
        {/* Logo mark */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '5px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', border: `2px solid ${B.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(212,165,32,0.07)', flexShrink: 0 }}>
            <span style={{ fontFamily: FF, fontSize: '22px', fontWeight: '700', color: B.gold, lineHeight: 1 }}>E</span>
          </div>
          <div style={{ fontFamily: FF, fontSize: 'clamp(20px,7vw,36px)', fontWeight: '700', color: B.gold, letterSpacing: '4px', textShadow: '0 2px 20px rgba(212,165,32,0.35)', lineHeight: 1 }}>ENORA EMBER</div>
        </div>
        <div style={{ color: B.textD, fontSize: '9px', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '12px' }}>
          Elegant &nbsp;•&nbsp; Luxurious &nbsp;•&nbsp; Timeless
        </div>
        {/* Cart button */}
        <button onClick={() => cartCount > 0 && setView('checkout')}
          style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: `linear-gradient(135deg,${B.gold},${B.goldD})`, border: 'none', borderRadius: '50px', padding: '8px 14px', cursor: 'pointer', fontFamily: FJ, fontWeight: '700', fontSize: '12px', color: B.bgDark, display: 'flex', alignItems: 'center', gap: '5px', boxShadow: '0 2px 14px rgba(212,165,32,0.3)' }}>
          🛍️
          {cartCount > 0
            ? <span style={{ background: B.bgDark, color: B.goldL, borderRadius: '50%', width: '18px', height: '18px', fontSize: '10px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{cartCount}</span>
            : <span style={{ fontSize: '11px' }}>Cart</span>
          }
        </button>
      </div>

      {/* ── Category filters ── */}
      <div style={{ display: 'flex', gap: '7px', overflowX: 'auto', padding: '12px 14px 8px', scrollbarWidth: 'none' }}>
        {CATS.map(c => (
          <button key={c.id} onClick={() => setCat(c.id)}
            style={{ flexShrink: 0, padding: '6px 12px', borderRadius: '50px', border: `1.5px solid ${cat === c.id ? B.gold : B.goldBdr}`, background: cat === c.id ? B.gold : 'transparent', color: cat === c.id ? B.bgDark : B.textM, fontFamily: FJ, fontWeight: cat === c.id ? '600' : '400', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.18s' }}>
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      {/* ── Search ── */}
      <div style={{ padding: '0 14px 12px', position: 'relative' }}>
        <span style={{ position: 'absolute', left: '26px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', opacity: 0.3 }}>🔍</span>
        <input
          style={{ width: '100%', padding: '9px 16px 9px 38px', border: `1.5px solid ${B.goldBdr}`, borderRadius: '50px', background: B.bgCard, fontFamily: FJ, fontSize: '13px', color: B.text, outline: 'none', boxSizing: 'border-box' }}
          placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* ── Product grid ── */}
      {loading
        ? <Spinner />
        : filtered.length === 0
          ? <div style={{ textAlign: 'center', padding: '60px 24px', color: B.textM }}>
              <div style={{ fontFamily: FF, fontSize: '44px', color: B.gold, marginBottom: '10px' }}>✦</div>
              <div style={{ fontFamily: FF, fontSize: '20px', fontWeight: '600', color: B.text }}>No products found</div>
              <div style={{ fontSize: '12px', marginTop: '5px' }}>Try a different category or search</div>
            </div>
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '12px', padding: '0 12px 110px' }}>
              {filtered.map(p => {
                const inCart = cart[p.id] || 0;
                return (
                  <div key={p.id} style={{ background: B.bgCard, borderRadius: '14px', overflow: 'hidden', border: `1px solid ${B.goldBdr}`, display: 'flex', flexDirection: 'column' }}>
                    {/* image */}
                    <div style={{ width: '100%', paddingTop: '100%', position: 'relative', background: B.bgMid, overflow: 'hidden', cursor: 'pointer' }} onClick={() => setDetail(p)}>
                      {p.imageUrl
                        ? <img src={p.imageUrl} alt={p.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '52px' }}>{p.emoji}</div>
                      }
                    </div>
                    {/* body */}
                    <div style={{ padding: '10px 11px 12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ fontSize: '8px', letterSpacing: '2px', textTransform: 'uppercase', color: B.gold, fontWeight: '600', marginBottom: '3px' }}>{catLabel(p.category)}</div>
                      <div style={{ fontFamily: FF, fontSize: '14px', fontWeight: '600', color: B.text, marginBottom: '3px', lineHeight: 1.3, cursor: 'pointer' }} onClick={() => setDetail(p)}>{p.name}</div>
                      {p.description && <div style={{ fontSize: '11px', color: B.textM, lineHeight: 1.45, marginBottom: '8px', flex: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.description}</div>}
                      <div style={{ fontFamily: FF, fontSize: '20px', fontWeight: '700', color: B.gold, marginBottom: '10px' }}>₵{p.price.toFixed(2)}</div>
                      {inCart
                        ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: B.goldDim, borderRadius: '9px', padding: '5px 10px', border: `1px solid ${B.goldBdr}` }}>
                            <button style={{ ...QB, width: '26px', height: '26px' }} onClick={() => dec(p.id)}>−</button>
                            <span style={{ fontFamily: FF, fontSize: '17px', fontWeight: '700', color: B.goldL }}>{inCart}</span>
                            <button style={{ ...QB, width: '26px', height: '26px' }} onClick={() => inc(p.id)}>+</button>
                          </div>
                        : <button style={{ width: '100%', background: `linear-gradient(135deg,${B.gold},${B.goldD})`, color: B.bgDark, border: 'none', borderRadius: '9px', padding: '9px', fontFamily: FJ, fontWeight: '700', fontSize: '11px', cursor: 'pointer', letterSpacing: '0.5px' }} onClick={() => addCart(p.id)}>
                            + ADD TO CART
                          </button>
                      }
                    </div>
                  </div>
                );
              })}
            </div>
      }

      {/* ── Footer ── */}
      <div style={{ textAlign: 'center', padding: '18px 14px', color: B.textD, fontSize: '11px', fontFamily: FJ, borderTop: `1px solid ${B.goldBdr}` }}>
        <div style={{ color: B.textM, letterSpacing: '1px', marginBottom: '3px' }}>📍 Ho, Ghana &nbsp;·&nbsp; Delivery & Pickup Available</div>
        <div>📞 +233 24 559 4900 &nbsp;·&nbsp; www.enoraember.com</div>
        <div style={{ marginTop: '3px', fontSize: '10px' }}>@ENORA EMBER on TikTok & Instagram</div>
        <div style={{ marginTop: '12px' }}>
          <span style={{ cursor: 'pointer', opacity: 0.3, fontSize: '10px', letterSpacing: '1px' }} onClick={() => adminUser ? setView('admin') : setShowLogin(true)}>
            {adminUser ? '⚙️ Admin' : 'Admin'}
          </span>
        </div>
      </div>

      {/* ── Product detail sheet ── */}
      {detail && (
        <Sheet onClose={() => setDetail(null)} B={B} noScroll>
          {detail.imageUrl
            ? <img src={detail.imageUrl} alt={detail.name} style={{ width: '100%', maxHeight: '320px', objectFit: 'cover' }} />
            : <div style={{ width: '100%', height: '220px', background: B.bgCard, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '72px' }}>{detail.emoji}</div>
          }
          <div style={{ padding: '18px 18px 32px' }}>
            <div style={{ fontSize: '9px', letterSpacing: '2.5px', textTransform: 'uppercase', color: B.gold, fontWeight: '600', marginBottom: '4px' }}>{catLabel(detail.category)}</div>
            <div style={{ fontFamily: FF, fontSize: '26px', fontWeight: '700', color: B.text, marginBottom: '6px', lineHeight: 1.2 }}>{detail.name}</div>
            {detail.description && <div style={{ fontSize: '14px', color: B.textM, lineHeight: 1.6, marginBottom: '16px' }}>{detail.description}</div>}
            <div style={{ fontFamily: FF, fontSize: '34px', fontWeight: '700', color: B.gold, marginBottom: '20px' }}>₵{detail.price.toFixed(2)}</div>
            {(cart[detail.id] || 0) > 0
              ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: B.goldDim, borderRadius: '12px', padding: '10px 16px', marginBottom: '12px', border: `1px solid ${B.goldBdr}` }}>
                  <button style={{ ...QB, width: '34px', height: '34px' }} onClick={() => dec(detail.id)}>−</button>
                  <span style={{ fontFamily: FF, fontSize: '22px', fontWeight: '700', color: B.goldL }}>{cart[detail.id]}</span>
                  <button style={{ ...QB, width: '34px', height: '34px' }} onClick={() => inc(detail.id)}>+</button>
                </div>
              : <button style={{ width: '100%', background: `linear-gradient(135deg,${B.gold},${B.goldD})`, color: B.bgDark, border: 'none', borderRadius: '12px', padding: '13px', fontFamily: FJ, fontWeight: '700', fontSize: '14px', cursor: 'pointer', marginBottom: '12px' }} onClick={() => addCart(detail.id)}>
                  + ADD TO CART
                </button>
            }
            <span style={{ display: 'block', textAlign: 'center', color: B.textD, fontFamily: FJ, fontSize: '12px', cursor: 'pointer' }} onClick={() => setDetail(null)}>← Back to shop</span>
          </div>
        </Sheet>
      )}

      {/* ── Checkout sheet ── */}
      {view === 'checkout' && (
        <Sheet onClose={() => setView('shop')} B={B}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0 14px', borderBottom: `1px solid ${B.goldBdr}`, marginBottom: '4px' }}>
            <div style={{ fontFamily: FF, fontSize: '20px', fontWeight: '700', color: B.goldL }}>Your Order</div>
            <button onClick={() => setView('shop')} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: B.textM }}>×</button>
          </div>

          {cartItems.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 0', borderBottom: `1px solid rgba(212,165,32,0.08)` }}>
              {item.imageUrl
                ? <img src={item.imageUrl} alt={item.name} style={{ width: '54px', height: '54px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0, border: `1px solid ${B.goldBdr}` }} />
                : <div style={{ width: '54px', height: '54px', borderRadius: '10px', flexShrink: 0, background: B.bgCard, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', border: `1px solid ${B.goldBdr}` }}>{item.emoji}</div>
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: FF, fontSize: '14px', fontWeight: '600', color: B.text, marginBottom: '5px' }}>{item.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <button style={{ ...QB, width: '22px', height: '22px', fontSize: '14px' }} onClick={() => dec(item.id)}>−</button>
                  <span style={{ fontFamily: FF, fontSize: '14px', fontWeight: '700', color: B.goldL }}>{item.qty}</span>
                  <button style={{ ...QB, width: '22px', height: '22px', fontSize: '14px' }} onClick={() => inc(item.id)}>+</button>
                  <span style={{ fontSize: '10px', color: B.textD }}>× ₵{item.price}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: FF, fontSize: '14px', fontWeight: '700', color: B.gold }}>₵{(item.price * item.qty).toFixed(2)}</div>
                <button onClick={() => remC(item.id)} style={{ background: 'none', border: 'none', fontSize: '10px', color: B.danger, cursor: 'pointer', fontFamily: FJ }}>Remove</button>
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 14px', background: B.goldDim, margin: '10px 0', borderRadius: '10px', border: `1px solid ${B.goldBdr}` }}>
            <div style={{ fontFamily: FF, fontSize: '17px', fontWeight: '600', color: B.textM }}>Total</div>
            <div style={{ fontFamily: FF, fontSize: '26px', fontWeight: '700', color: B.gold }}>₵{cartTotal.toFixed(2)}</div>
          </div>

          <label style={LBL}>Delivery Address *</label>
          <input style={INP} placeholder="Your full address or delivery location in Ho" value={address} onChange={e => setAddress(e.target.value)} />

          <label style={LBL}>Order Note (optional)</label>
          <textarea style={TXA} placeholder="Any special requests?" value={note} onChange={e => setNote(e.target.value)} />

          <button onClick={submitOrder}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#25d366', color: '#fff', border: 'none', borderRadius: '12px', padding: '14px', width: '100%', fontFamily: FJ, fontWeight: '700', fontSize: '15px', cursor: 'pointer' }}>
            <WaIcon /> Send Order via WhatsApp
          </button>
          <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '10px', color: B.textD, fontFamily: FJ }}>You'll be redirected to WhatsApp to confirm</div>
        </Sheet>
      )}

      {/* ── Admin login sheet ── */}
      {showLogin && (
        <Sheet onClose={closeLogin} B={B}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>🔐</div>
            <div style={{ fontFamily: FF, fontSize: '22px', fontWeight: '700', color: B.goldL }}>Admin Access</div>
            <div style={{ fontFamily: FJ, fontSize: '12px', color: B.textD, marginTop: '4px' }}>Sign in with your admin credentials</div>
          </div>
          <label style={LBL}>Email</label>
          <input style={INP} type="email" placeholder="admin@enoraember.com" value={lEmail} onChange={e => setLEmail(e.target.value)} />
          <label style={LBL}>Password</label>
          <input style={{ ...INP, marginBottom: '8px' }} type="password" placeholder="Your password" value={lPw} onChange={e => setLPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && doLogin()} />
          {lErr && <div style={{ fontSize: '12px', color: '#e08080', fontFamily: FJ, marginBottom: '8px' }}>{lErr}</div>}
          <button style={{ ...BTN, marginTop: '6px' }} onClick={doLogin} disabled={lLoading}>{lLoading ? 'Signing in…' : 'Sign In'}</button>
          <span style={{ display: 'block', textAlign: 'center', marginTop: '10px', color: B.textD, fontFamily: FJ, fontSize: '12px', cursor: 'pointer' }} onClick={closeLogin}>Cancel</span>
        </Sheet>
      )}
    </div>
  );
}

/* ── Helper components ─────────────────────────── */
function Sheet({ children, onClose, B }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: B.bgMid, borderRadius: '22px 22px 0 0', maxHeight: '93vh', overflowY: 'auto', border: `1px solid ${B.goldBdr}`, borderBottom: 'none', padding: '0 0 0' }}>
        <div style={{ width: '38px', height: '4px', background: B.goldBdr, borderRadius: '2px', margin: '12px auto 0' }} />
        <div style={{ padding: '14px 18px 28px' }}>{children}</div>
      </div>
    </div>
  );
}

function Toast({ toast, FJ, B }) {
  if (!toast.m) return null;
  return (
    <div style={{ position: 'fixed', bottom: '90px', left: '50%', transform: 'translateX(-50%)', background: toast.t === 'err' ? B.danger : B.bgLight, color: toast.t === 'err' ? '#fff' : B.goldL, padding: '10px 22px', borderRadius: '50px', fontFamily: FJ, fontSize: '13px', fontWeight: '500', zIndex: 999, whiteSpace: 'nowrap', boxShadow: '0 4px 24px rgba(0,0,0,0.5)', border: `1px solid ${toast.t === 'err' ? 'rgba(192,64,64,0.4)' : B.goldBdr}`, pointerEvents: 'none' }}>
      {toast.m}
    </div>
  );
}

function WaIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.117 1.524 5.847L.057 23.943l6.274-1.44A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.891 0-3.66-.497-5.188-1.365l-.37-.219-3.826.877.913-3.73-.24-.385A9.946 9.946 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
    </svg>
  );
}

function adminBtn(B, FJ, danger = false) {
  return {
    background: 'transparent',
    border: `1px solid ${danger ? 'rgba(192,64,64,0.4)' : B.goldBdr}`,
    color: danger ? '#e08080' : B.textM,
    borderRadius: '8px', padding: '7px 12px',
    fontFamily: FJ, fontSize: '11px', cursor: 'pointer',
  };
}
