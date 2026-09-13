import { useState, useEffect, useCallback } from "react";
import { FaDownload, FaPrint, FaRupeeSign, FaShoppingCart, FaUserPlus, FaWallet } from "react-icons/fa";
import { API_URL } from "../config";

const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Reports() {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const authHeaders = () => {
    const u = JSON.parse(localStorage.getItem("userInfo"));
    return { Authorization: `Bearer ${u?.token}` };
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/stats/monthly?month=${month}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`Failed to load report (${res.status})`);
      setData(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const downloadCsv = () => {
    if (!data) return;
    const lines = [];
    lines.push(`TowelCrafts — Monthly Report,${data.monthLabel}`);
    lines.push("");
    lines.push("Metric,Value");
    lines.push(`Revenue,${data.kpis.revenue}`);
    lines.push(`Collected,${data.kpis.collected}`);
    lines.push(`Outstanding,${data.kpis.outstanding}`);
    lines.push(`Orders,${data.kpis.orderCount}`);
    lines.push(`Valid orders,${data.kpis.validOrders}`);
    lines.push(`Cancelled,${data.kpis.cancelledCount}`);
    lines.push(`Avg order value,${data.kpis.avgOrderValue}`);
    lines.push(`New customers,${data.kpis.newCustomers}`);
    lines.push("");
    lines.push("Top Products,Units,Revenue");
    data.topProducts.forEach((p) => lines.push(`${csv(p.name)},${p.units},${p.revenue}`));
    lines.push("");
    lines.push("Order Status,Count");
    data.statusBreakdown.forEach((s) => lines.push(`${s.name},${s.value}`));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `towelcrafts-report-${data.month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    if (!data) return;
    const rows = data.topProducts.map((p) => `<tr><td>${csv(p.name)}</td><td class="num">${p.units}</td><td class="num">${inr(p.revenue)}</td></tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Report ${data.monthLabel}</title>
    <style>body{font-family:-apple-system,Segoe UI,Arial,sans-serif;color:#24281f;padding:48px;max-width:760px;margin:0 auto}
    h1{font-family:Georgia,serif;color:#33402b}.sub{color:#9b7b4a;letter-spacing:.15em;text-transform:uppercase;font-size:12px}
    .kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin:24px 0}
    .kpi{border:1px solid #dcd7c8;border-radius:6px;padding:14px}.kpi b{display:block;font-size:22px;color:#33402b}
    table{width:100%;border-collapse:collapse;margin-top:12px}th,td{padding:8px;border-bottom:1px solid #eceadf;font-size:14px;text-align:left}
    .num{text-align:right}@media print{body{padding:0}}</style></head><body>
    <p class="sub">TowelCrafts — Monthly Report</p><h1>${data.monthLabel}</h1>
    <div class="kpis">
      <div class="kpi"><span>Revenue</span><b>${inr(data.kpis.revenue)}</b></div>
      <div class="kpi"><span>Collected</span><b>${inr(data.kpis.collected)}</b></div>
      <div class="kpi"><span>Orders (valid)</span><b>${data.kpis.validOrders}</b></div>
      <div class="kpi"><span>Avg order value</span><b>${inr(data.kpis.avgOrderValue)}</b></div>
      <div class="kpi"><span>New customers</span><b>${data.kpis.newCustomers}</b></div>
      <div class="kpi"><span>Outstanding</span><b>${inr(data.kpis.outstanding)}</b></div>
    </div>
    <h3>Top Products</h3>
    <table><thead><tr><th>Product</th><th class="num">Units</th><th class="num">Revenue</th></tr></thead><tbody>${rows || '<tr><td colspan=3>No sales</td></tr>'}</tbody></table>
    <script>window.onload=function(){window.print()}</script></body></html>`;
    const w = window.open("", "_blank", "width=820,height=900");
    if (w) { w.document.open(); w.document.write(html); w.document.close(); }
  };

  return (
    <div className="reports">
      <div className="admin__toolbar">
        <label className="admin__filter">
          <span>Month</span>
          <input type="month" className="admin__select" value={month} max={currentMonth()} onChange={(e) => setMonth(e.target.value)} />
        </label>
        <div className="admin__toolbar-actions">
          <button className="admin__btn admin__btn--ghost admin__btn--sm" onClick={downloadCsv} disabled={!data}><FaDownload /> CSV</button>
          <button className="admin__btn admin__btn--primary admin__btn--sm" onClick={printReport} disabled={!data}><FaPrint /> Print / PDF</button>
        </div>
      </div>

      {loading ? (
        <div className="admin__panel"><div className="admin__loading"><div className="admin__spinner" />Building report…</div></div>
      ) : error ? (
        <div className="admin__error">{error}</div>
      ) : (
        <div className="reports__body">
          <div className="admin__report-head">
            <h2>{data.monthLabel}</h2>
            <p>Monthly performance summary</p>
          </div>

          <div className="overview__kpis">
            <Kpi label="Revenue" value={inr(data.kpis.revenue)} icon={<FaRupeeSign />} accent="green" />
            <Kpi label="Collected" value={inr(data.kpis.collected)} sub={`${inr(data.kpis.outstanding)} outstanding`} icon={<FaWallet />} accent="gold" />
            <Kpi label="Orders" value={data.kpis.validOrders} sub={`${data.kpis.cancelledCount} cancelled`} icon={<FaShoppingCart />} accent="blue" />
            <Kpi label="Avg Order Value" value={inr(data.kpis.avgOrderValue)} icon={<FaRupeeSign />} accent="green" />
            <Kpi label="New Customers" value={data.kpis.newCustomers} icon={<FaUserPlus />} accent="gold" />
          </div>

          <div className="overview__grid">
            <div className="overview__panel">
              <div className="overview__panel-head"><h3>Top Products</h3><span className="overview__panel-note">by revenue</span></div>
              {data.topProducts.length ? (
                <table className="admin__table admin__table--cards">
                  <thead><tr><th>Product</th><th>Units</th><th>Revenue</th></tr></thead>
                  <tbody>
                    {data.topProducts.map((p) => (
                      <tr key={p.name}>
                        <td data-label="Product">{p.name}</td>
                        <td data-label="Units">{p.units}</td>
                        <td data-label="Revenue"><span className="admin__price">{inr(p.revenue)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="overview__empty">No sales this month</div>}
            </div>

            <div className="overview__panel">
              <div className="overview__panel-head"><h3>Order Status</h3></div>
              {data.statusBreakdown.length ? (
                <div className="overview__list">
                  {data.statusBreakdown.map((s) => (
                    <div className="overview__list-row" key={s.name}>
                      <span className={`admin__badge admin__badge--${s.name}`}>{s.name}</span>
                      <span className="overview__list-amount">{s.value}</span>
                    </div>
                  ))}
                </div>
              ) : <div className="overview__empty">No orders this month</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, icon, accent }) {
  return (
    <div className={`kpi kpi--${accent}`}>
      <div className="kpi__icon">{icon}</div>
      <div className="kpi__body">
        <span className="kpi__label">{label}</span>
        <span className="kpi__value">{value}</span>
        {sub && <span className="kpi__sub">{sub}</span>}
      </div>
    </div>
  );
}

function csv(v) {
  const s = String(v == null ? "" : v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
