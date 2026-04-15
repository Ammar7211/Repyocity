import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  FileText, ShoppingBag, Plus, Trash2, Save, Download,
  CheckCircle, XCircle, ChevronDown, Menu, X, Loader2, Truck
} from "lucide-react";

const TAX_RATE = 0.0675;
const SHIPPING = 8.00;

function generateInvoiceNumber() {
  const now = new Date();
  return `RYC-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}-${Math.floor(Math.random()*9000)+1000}`;
}

const SIZES = ["XS","S","M","L","XL","2XL","3XL","4XL"];
const SIZE_EXTRA = { XS:0,S:0,M:0,L:0,XL:0,"2XL":0,"3XL":0,"4XL":0 };

const emptyItem = () => ({
  id: Date.now() + Math.random(),
  item: "", color: "", size: "XL", qty: 1, unitPrice: 25, extraForSize: 0,
});

export default function App() {
  const [page, setPage] = useState("invoice");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [customer, setCustomer] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [invoiceNo] = useState(generateInvoiceNumber());
  const [items, setItems] = useState([emptyItem()]);
  const [discount, setDiscount] = useState(0);
  const [paid, setPaid] = useState(false);
  const [addShipping, setAddShipping] = useState(false); // New Shipping State
  const [sales, setSales] = useState([]);
  const [loadingSales, setLoadingSales] = useState(false);
  const [hoveredSale, setHoveredSale] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Calculation order: subtotal → +shipping → -discount → tax on result → total
  const currentShipping = addShipping ? SHIPPING : 0;
  const itemsSubtotal = items.reduce((acc,it) => acc + it.qty*(Number(it.unitPrice)+Number(it.extraForSize)), 0);
  const subtotalWithShipping = itemsSubtotal;
  const discountAmount = Math.max(0, Number(discount) || 0);
  const afterDiscount = Math.max(0, subtotalWithShipping - discountAmount);
  const taxAmount = afterDiscount * TAX_RATE;
  const totalDue = afterDiscount + taxAmount + currentShipping;

  const showToast = (msg, type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };
  const addItem = () => setItems([...items, emptyItem()]);
  const removeItem = (id) => setItems(items.filter(i=>i.id!==id));
  const updateItem = (id, field, value) => {
    setItems(items.map(it => {
      if (it.id!==id) return it;
      const u = {...it,[field]:value};
      if (field==="size") u.extraForSize = SIZE_EXTRA[value]??0;
      return u;
    }));
  };

  const saveInvoice = async () => {
    if (!customer.trim()) return showToast("Please enter customer name","error");
    if (items.some(i=>!i.item.trim())) return showToast("Fill all item names","error");
    setSaving(true);
    const {error} = await supabase.from("invoices").insert([{
      customer_name: customer, invoice_date: invoiceDate,
      items: items.map(({id,...rest})=>rest),
      subtotal: itemsSubtotal, shipping: currentShipping, discount: discountAmount,
      sales_tax: taxAmount, total_due: totalDue, paid,
    }]);
    setSaving(false);
    if (error) return showToast("Error: "+error.message,"error");
    showToast("Invoice saved!");
  };

  const fetchSales = async () => {
    setLoadingSales(true);
    const {data,error} = await supabase.from("invoices").select("*").order("created_at",{ascending:false});
    setLoadingSales(false);
    if (!error) setSales(data||[]);
  };

  useEffect(()=>{ if(page==="sales") fetchSales(); },[page]);

  const deleteSale = async (id) => {
    setDeletingId(id);
    await supabase.from("invoices").delete().eq("id",id);
    setSales(sales.filter(s=>s.id!==id));
    setDeletingId(null);
    showToast("Sale deleted");
  };

  const downloadPDF = async (sale) => {
    const container = document.createElement("div");
    container.style.cssText = "position:fixed;left:-9999px;top:0;width:794px;background:#fff;";
    document.body.appendChild(container);
    const saleItems = typeof sale.items==="string"?JSON.parse(sale.items):sale.items;
    const GREEN="#8db33a", DARK="#2b2b2b";
    const sShipping=Number(sale.shipping??8), sDiscount=Number(sale.discount??0);
    const sSubtotal=Number(sale.subtotal??0), sTax=Number(sale.sales_tax??0), sTotal=Number(sale.total_due??0);

    container.innerHTML = `
      <div style="font-family:Arial,sans-serif;background:#fff;color:#000;width:794px;min-height:1123px;position:relative;overflow:hidden;">
        <div style="position:relative;height:108px;">
          <svg style="position:absolute;top:0;left:0;width:100%;height:108px;" viewBox="0 0 794 108" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,0 L430,0 Q475,0 475,54 Q475,108 430,108 L0,108 Z" fill="${DARK}"/>
          </svg>
          <div style="position:absolute;top:0;left:0;width:430px;height:108px;display:flex;align-items:center;padding-left:28px;gap:14px;z-index:2;">
            <img src="/logo.png" style="width:66px;height:66px;object-fit:contain;" onerror="this.style.display='none';" />
            <span style="color:#fff;font-size:26px;font-weight:900;letter-spacing:3px;">REPYOCITY</span>
          </div>
          <div style="position:absolute;top:0;right:0;width:330px;height:108px;display:flex;align-items:center;justify-content:flex-end;padding-right:10px;padding-top:5px;z-index:2;">
            <span style="color:#000;font-size:56px;font-weight:900;letter-spacing:5px;">INVOICE</span>
          </div>
        </div>
        <div style="padding:32px 48px 0;">
          <div style="margin-bottom:24px;">
            <p style="margin:4px 0;font-weight:700;font-size:14px;color:#000;">Customer: ${sale.customer_name}</p>
            <p style="margin:4px 0;font-weight:700;font-size:14px;color:#000;">Item: ${saleItems.map(i=>i.item).join(" & ")}</p>
            <p style="margin:4px 0;font-weight:700;font-size:14px;color:#000;">Color: ${saleItems.map(i=>i.color||"—").join(" & ")}</p>
            <p style="margin:4px 0;font-weight:700;font-size:14px;color:#000;">Dated: ${new Date(sale.invoice_date).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})}</p>
          </div>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:${GREEN};">
                <th style="padding:10px;text-align:left;font-size:11px;letter-spacing:1px;color:#000;font-weight:800;text-transform:uppercase;">NO</th>
                <th style="padding:10px;text-align:left;font-size:11px;letter-spacing:1px;color:#000;font-weight:800;text-transform:uppercase;">ITEM</th>
                <th style="padding:10px;text-align:left;font-size:11px;letter-spacing:1px;color:#000;font-weight:800;text-transform:uppercase;">COLOR</th>
                <th style="padding:10px;text-align:left;font-size:11px;letter-spacing:1px;color:#000;font-weight:800;text-transform:uppercase;">SIZE</th>
                <th style="padding:10px;text-align:left;font-size:11px;letter-spacing:1px;color:#000;font-weight:800;text-transform:uppercase;">QTY</th>
                <th style="padding:10px;text-align:left;font-size:11px;letter-spacing:1px;color:#000;font-weight:800;text-transform:uppercase;">UNIT PRICE</th>
                <th style="padding:10px;text-align:left;font-size:11px;letter-spacing:1px;color:#000;font-weight:800;text-transform:uppercase;">EXTRA FOR SIZE</th>
              </tr>
            </thead>
            <tbody>
              ${saleItems.map((it,idx)=>`
                <tr style="background:${idx%2===0?"#f2f2f2":"#fff"};border-bottom:1px solid #ddd;">
                  <td style="padding:11px 10px;font-weight:600;color:#000;font-size:13px;">${idx+1}</td>
                  <td style="padding:11px 10px;font-weight:600;color:#000;font-size:13px;">${it.item}</td>
                  <td style="padding:11px 10px;font-weight:600;color:#000;font-size:13px;">${it.color||"—"}</td>
                  <td style="padding:11px 10px;font-weight:600;color:#000;font-size:13px;">${it.size}</td>
                  <td style="padding:11px 10px;font-weight:600;color:#000;font-size:13px;">${it.qty}</td>
                  <td style="padding:11px 10px;font-weight:600;color:#000;font-size:13px;">$${Number(it.unitPrice).toFixed(2)}</td>
                  <td style="padding:11px 10px;font-weight:600;color:#000;font-size:13px;">$${Number(it.extraForSize).toFixed(2)}</td>
                </tr>`).join("")}
              <tr style="background:#f2f2f2;border-bottom:1px solid #ddd;"><td colspan="7" style="padding:11px 10px;">&nbsp;</td></tr>
              <tr style="background:#fff;border-bottom:1px solid #ddd;"><td colspan="7" style="padding:11px 10px;">&nbsp;</td></tr>
            </tbody>
          </table>
          <div style="display:flex;justify-content:flex-end;margin:18px 0 24px;">
            <div style="width:340px;border:1px solid #ddd;">
              <div style="display:flex;justify-content:space-between;padding:9px 14px;border-bottom:1px solid #ddd;">
                <span style="font-weight:700;font-size:13px;color:#000;">SUB-TOTAL</span>
                <span style="font-weight:700;font-size:13px;color:#000;">$${sSubtotal.toFixed(2)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;padding:9px 14px;border-bottom:1px solid #ddd;">
                <span style="font-weight:700;font-size:13px;color:#000;">SHIPPING</span>
                <span style="font-weight:700;font-size:13px;color:#000;">$${sShipping.toFixed(2)}</span>
              </div>
              ${sDiscount>0?`<div style="display:flex;justify-content:space-between;padding:9px 14px;border-bottom:1px solid #ddd;">
                <span style="font-weight:700;font-size:13px;color:#c0392b;">DISCOUNT</span>
                <span style="font-weight:700;font-size:13px;color:#c0392b;">-$${sDiscount.toFixed(2)}</span>
              </div>`:""}
              <div style="display:flex;justify-content:space-between;padding:9px 14px;border-bottom:1px solid #ddd;">
                <span style="font-weight:700;font-size:13px;color:#000;">SALES TAX (6.75%)</span>
                <span style="font-weight:700;font-size:13px;color:#000;">$${sTax.toFixed(2)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;padding:13px 14px;background:${GREEN};">
                <span style="font-weight:900;font-size:15px;color:#000;">Total Due</span>
                <span style="font-weight:900;font-size:15px;color:#000;">$${sTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <div style="margin-bottom:36px;">
            <p style="font-weight:900;font-size:13px;letter-spacing:1px;margin-bottom:8px;color:#000;text-transform:uppercase;">Payment Method</p>
            <table style="border-collapse:collapse;">
              <tr><td style="font-size:13px;color:#000;padding:3px 0;font-weight:700;">CashApp:</td><td style="font-size:13px;color:#000;padding:3px 0 3px 10px;">@RepYoCityUS</td></tr>
              <tr><td style="font-size:13px;color:#000;padding:3px 0;font-weight:700;">Venmo:</td><td style="font-size:13px;color:#000;padding:3px 0 3px 10px;">@Repyocity</td></tr>
              <tr><td style="font-size:13px;color:#000;padding:3px 0;font-weight:700;">Zelle:</td><td style="font-size:13px;color:#000;padding:3px 0 3px 10px;">Repyocityusa@gmail.com</td></tr>
            </table>
          </div>
          ${sale.paid?`<div style="position:absolute;top:330px;right:72px;transform:rotate(-18deg);border:5px solid #2e7d32;border-radius:6px;padding:10px 24px;opacity:0.82;"><span style="color:#2e7d32;font-size:54px;font-weight:900;letter-spacing:4px;">PAID</span></div>`:""}
          <div style="text-align:center;padding:12px 0 80px;font-weight:900;font-size:13px;letter-spacing:2px;color:#000;text-transform:uppercase;">Thank You For Your Business!</div>
        </div>
        <div style="background:${DARK};padding:14px 32px;text-align:center;position:absolute;bottom:0;width:100%;box-sizing:border-box;">
          <span style="color:#ccc;font-size:13px;">FB: repyocity &nbsp;·&nbsp; 980.494.0739 &nbsp;·&nbsp; repyocityusa@gmail.com</span>
        </div>
      </div>`;
    await new Promise(r=>setTimeout(r,200));
    const canvas = await html2canvas(container,{scale:2,useCORS:true});
    const pdf = new jsPDF({orientation:"portrait",unit:"px",format:[794,1123]});
    pdf.addImage(canvas.toDataURL("image/png"),"PNG",0,0,794,1123);
    pdf.save(`RepYoCity-${sale.customer_name.replace(/\s+/g,"_")}.pdf`);
    document.body.removeChild(container);
  };

  return (
    <div className="app-root">
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type==="success"?<CheckCircle size={16}/>:<XCircle size={16}/>} {toast.msg}
        </div>
      )}

      {sidebarOpen && <div className="sidebar-overlay" onClick={()=>setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen?"open":""}`}>
        <div className="sidebar-logo">
          <img src="/logo.png" alt="RYC" className="sidebar-logo-img" onError={e=>{e.target.style.display="none";e.target.nextSibling.style.display="flex";}} />
          <div className="logo-badge" style={{display:"none"}}>RYC</div>
          <span className="logo-text">REPYOCITY</span>
          <button className="sidebar-close" onClick={()=>setSidebarOpen(false)}><X size={18}/></button>
        </div>
        <nav className="sidebar-nav">
          <button className={`nav-btn ${page==="invoice"?"active":""}`} onClick={()=>{setPage("invoice");setSidebarOpen(false);}}>
            <FileText size={20}/><span>Invoice Generator</span>
          </button>
          <button className={`nav-btn ${page==="sales"?"active":""}`} onClick={()=>{setPage("sales");setSidebarOpen(false);}}>
            <ShoppingBag size={20}/><span>Sales</span>
          </button>
        </nav>
        <div className="sidebar-footer">
          <span>980.494.0739</span><br/><span>repyocityusa@gmail.com</span>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <button className="menu-btn" onClick={()=>setSidebarOpen(!sidebarOpen)}><Menu size={22}/></button>
          <div className="topbar-brand">
            <img src="/logo.png" alt="" className="topbar-logo" onError={e=>e.target.style.display="none"} />
            <span className="topbar-title">REPYOCITY ERP</span>
          </div>
          <div className="topbar-badge">ERP</div>
        </header>

        <div className="content-area">
          {page==="invoice" && (
            <div className="invoice-page fade-in">
              <div className="card invoice-header-card">
                <div className="inv-header-left">
                  <img src="/logo.png" alt="RepYoCity" className="inv-logo-img" onError={e=>{e.target.style.display="none";e.target.nextSibling.style.display="flex";}} />
                  <div className="inv-logo-mark" style={{display:"none"}}>RYC</div>
                  <div>
                    <h2 className="inv-brand">REPYOCITY</h2>
                    <p className="inv-sub">Invoice Generator</p>
                  </div>
                </div>
                <div className="inv-meta">
                  <div className="inv-no-badge">#{invoiceNo}</div>
                  <div className="inv-date-field">
                    <label>Date</label>
                    <input type="date" value={invoiceDate} onChange={e=>setInvoiceDate(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="card">
                <label className="field-label">Customer Name</label>
                <input className="field-input" placeholder="e.g. Jibril Muhaymin-Rashid" value={customer} onChange={e=>setCustomer(e.target.value)} />
              </div>

              <div className="card items-card">
                <div className="items-header">
                  <h3 className="section-title">Order Items</h3>
                  <button className="btn-add" onClick={addItem}><Plus size={16}/> Add Item</button>
                </div>
                <div className="table-wrap">
                  <table className="items-table">
                    <thead>
                      <tr>
                        <th>#</th><th>ITEM</th><th>COLOR</th><th>SIZE</th>
                        <th>QTY</th><th>UNIT $</th><th>+SIZE $</th><th>TOTAL</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it,idx)=>(
                        <tr key={it.id} className="item-row">
                          <td className="row-num">{idx+1}</td>
                          <td><input className="cell-input" placeholder="Item name" value={it.item} onChange={e=>updateItem(it.id,"item",e.target.value)}/></td>
                          <td><input className="cell-input" placeholder="Color" value={it.color} onChange={e=>updateItem(it.id,"color",e.target.value)}/></td>
                          <td>
                            <div className="select-wrap">
                              <select className="cell-select" value={it.size} onChange={e=>updateItem(it.id,"size",e.target.value)}>
                                {SIZES.map(s=><option key={s}>{s}</option>)}
                              </select>
                              <ChevronDown size={12} className="select-icon"/>
                            </div>
                          </td>
                          <td><input type="number" className="cell-input num" min={1} value={it.qty} onChange={e=>updateItem(it.id,"qty",Number(e.target.value))}/></td>
                          <td><div className="price-input-wrap"><span className="currency">$</span><input type="number" className="cell-input num" min={0} value={it.unitPrice} onChange={e=>updateItem(it.id,"unitPrice",e.target.value)}/></div></td>
                          <td><div className="price-input-wrap"><span className="currency">$</span><input type="number" className="cell-input num" min={0} value={it.extraForSize} onChange={e=>updateItem(it.id,"extraForSize",e.target.value)}/></div></td>
                          <td className="line-total">${(it.qty*(Number(it.unitPrice)+Number(it.extraForSize))).toFixed(2)}</td>
                          <td>{items.length>1&&<button className="btn-remove" onClick={()=>removeItem(it.id)}><Trash2 size={15}/></button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bottom-row">
                <div className="card paid-card">
                  <label className="field-label">Payment Status</label>
                  <div className="paid-toggle" onClick={()=>setPaid(!paid)}>
                    <div className={`toggle-track ${paid?"paid":""}`}><div className="toggle-thumb"/></div>
                    <span className={`paid-label ${paid?"paid-text":"unpaid-text"}`}>{paid?"✓ PAID":"✗ UNPAID"}</span>
                  </div>

                  <label className="field-label" style={{marginTop: "16px"}}>Shipping Charges</label>
                  <div className="paid-toggle" onClick={()=>setAddShipping(!addShipping)}>
                    <div className={`toggle-track ${addShipping?"paid":""}`}><div className="toggle-thumb"/></div>
                    <span className={`paid-label ${addShipping?"paid-text":"unpaid-text"}`}>{addShipping?"✓ $8.00 ADDED":"✗ NO SHIPPING"}</span>
                  </div>
                </div>

                <div className="card totals-card">
                  <div className="totals-grid">
                    <div className="totals-row"><span>Items Subtotal</span><span>${itemsSubtotal.toFixed(2)}</span></div>
                    <div className="totals-row"><span>Shipping</span><span className="shipping-val">+${currentShipping.toFixed(2)}</span></div>
                    <div className="totals-row discount-row">
                      <span>Discount</span>
                      <div className="discount-input-wrap">
                        <span className="currency">$</span>
                        <input type="number" min={0} value={discount} className="discount-input" onChange={e=>setDiscount(e.target.value)} placeholder="0.00"/>
                      </div>
                    </div>
                    <div className="totals-row muted-row"><span>After Discount</span><span>${afterDiscount.toFixed(2)}</span></div>
                    <div className="totals-row"><span>Sales Tax (6.75%)</span><span>${taxAmount.toFixed(2)}</span></div>
                    <div className="totals-divider"/>
                    <div className="totals-row total-due-row">
                      <span>TOTAL DUE</span>
                      <span className="total-amount">${totalDue.toFixed(2)}</span>
                    </div>
                  </div>
                  <button className="btn-save" onClick={saveInvoice} disabled={saving}>
                    {saving?<Loader2 size={18} className="spin"/>:<Save size={18}/>}
                    {saving?"Saving...":"Save Invoice"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {page==="sales" && (
            <div className="sales-page fade-in">
              <div className="sales-header">
                <h2 className="sales-title">All Sales</h2>
                <button className="btn-refresh" onClick={fetchSales}>
                  {loadingSales?<Loader2 size={16} className="spin"/>:"Refresh"}
                </button>
              </div>
              {loadingSales?(
                <div className="loading-state"><Loader2 size={40} className="spin"/><p>Loading sales...</p></div>
              ):(sales.length===0?(
                <div className="empty-state"><ShoppingBag size={56} opacity={0.3}/><p>No sales yet.</p></div>
              ):(
                <div className="sales-grid">
                  {sales.map(sale=>{
                    const saleItems = typeof sale.items==="string"?JSON.parse(sale.items):sale.items;
                    return (
                      <div key={sale.id} className={`sale-card ${sale.paid?"paid-card-border":""}`}
                        onMouseEnter={()=>setHoveredSale(sale)} onMouseLeave={()=>setHoveredSale(null)}>
                        {sale.paid&&<div className="paid-stamp">PAID</div>}
                        <div className="sale-card-top">
                          <div>
                            <div className="sale-customer">{sale.customer_name}</div>
                            <div className="sale-date">{new Date(sale.invoice_date).toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"})}</div>
                          </div>
                          <div className="sale-total">${Number(sale.total_due).toFixed(2)}</div>
                        </div>
                        <div className="sale-items-preview">
                          {saleItems.map((it,i)=>(
                            <span key={i} className="item-chip">{it.item}{it.color?` · ${it.color}`:""} ({it.size})</span>
                          ))}
                        </div>
                        {hoveredSale?.id===sale.id&&(
                          <div className="sale-popup-inline">
                            <div className="popup-title">{sale.customer_name}</div>
                            <table className="popup-table">
                              <thead><tr><th>Item</th><th>Color</th><th>Size</th><th>Qty</th><th>$</th></tr></thead>
                              <tbody>
                                {saleItems.map((it,i)=>(
                                  <tr key={i}>
                                    <td>{it.item}</td><td>{it.color||"—"}</td><td>{it.size}</td><td>{it.qty}</td>
                                    <td>${(it.qty*(Number(it.unitPrice)+Number(it.extraForSize))).toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <div className="popup-totals">
                              <span>Subtotal: ${Number(sale.subtotal).toFixed(2)}</span>
                              <span>Shipping: ${Number(sale.shipping??8).toFixed(2)}</span>
                              {sale.discount>0&&<span>Discount: -${Number(sale.discount).toFixed(2)}</span>}
                              <span>Tax: ${Number(sale.sales_tax).toFixed(2)}</span>
                              <strong>Total: ${Number(sale.total_due).toFixed(2)}</strong>
                            </div>
                            <div className={`popup-status ${sale.paid?"popup-paid":"popup-unpaid"}`}>
                              {sale.paid?"✓ PAID":"✗ UNPAID"}
                            </div>
                          </div>
                        )}
                        <div className="sale-actions">
                          <button className="btn-download" onClick={()=>downloadPDF(sale)}><Download size={15}/> PDF</button>
                          <button className="btn-delete" onClick={()=>deleteSale(sale.id)} disabled={deletingId===sale.id}>
                            {deletingId===sale.id?<Loader2 size={15} className="spin"/>:<Trash2 size={15}/>} Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}