import { useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  FaRupeeSign, FaShoppingCart, FaUsers, FaBox,
  FaStar, FaChartLine, FaExclamationTriangle,
} from "react-icons/fa";
import { API_URL } from "../config";

// Theme palette for charts
const COLORS = ["#566A4B", "#9B7B4A", "#7C8E6E", "#7C6138", "#33402B", "#B89A6B"];
const STATUS_COLORS = {
  placed: "#5A7A8C",
  confirmed: "#9B7B4A",
  processing: "#B89A6B",
  shipped: "#7C8E6E",
  delivered: "#4A7C59",
  cancelled: "#A24B47",
  returned: "#A24B47",
};

const inr = (n) => "₹" + (n || 0).toLocaleString("en-IN");

export default function Overview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const userInfo = JSON.parse(localStorage.getItem("userInfo"));
        const res = await fetch(`${API_URL}/api/stats/overview`, {
          headers: { Authorization: `Bearer ${userInfo?.token}` },
        });
        if (!res.ok) throw new Error(`Failed to load analytics (${res.status})`);
        setData(await res.json());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="admin__panel">
        <div className="admin__loading">
          <div className="admin__spinner" />
          Loading analytics...
        </div>
      </div>
    );
  }

  if (error) return <div className="admin__error">{error}</div>;

  const { kpis, salesSeries, statusBreakdown, topProducts, categoryDistribution, lowStock, recentOrders } = data;

  const kpiCards = [
    { label: "Total Revenue", value: inr(kpis.totalRevenue), icon: <FaRupeeSign />, accent: "green" },
    { label: "This Month", value: inr(kpis.monthRevenue), sub: `${kpis.monthOrders} orders`, icon: <FaChartLine />, accent: "gold" },
    { label: "Total Orders", value: kpis.totalOrders, sub: `Avg ${inr(kpis.avgOrderValue)}`, icon: <FaShoppingCart />, accent: "blue" },
    { label: "Customers", value: kpis.totalCustomers, icon: <FaUsers />, accent: "green" },
    { label: "Products", value: kpis.totalProducts, icon: <FaBox />, accent: "gold" },
    { label: "Avg Rating", value: kpis.avgRating || "—", sub: `${kpis.ratingCount} reviews`, icon: <FaStar />, accent: "gold" },
  ];

  return (
    <div className="overview">
      {/* KPI CARDS */}
      <div className="overview__kpis">
        {kpiCards.map((k) => (
          <div key={k.label} className={`kpi kpi--${k.accent}`}>
            <div className="kpi__icon">{k.icon}</div>
            <div className="kpi__body">
              <span className="kpi__label">{k.label}</span>
              <span className="kpi__value">{k.value}</span>
              {k.sub && <span className="kpi__sub">{k.sub}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* REVENUE TREND */}
      <div className="overview__panel">
        <div className="overview__panel-head">
          <h3>Revenue — Last 30 Days</h3>
          <span className="overview__panel-note">Daily revenue (excludes cancelled)</span>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={salesSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#566A4B" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#566A4B" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8EBE6" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94A391" }} interval={4} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#94A391" }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
            <Tooltip
              formatter={(v) => [inr(v), "Revenue"]}
              contentStyle={{ borderRadius: 12, border: "1px solid #E8EBE6", fontSize: 13 }}
            />
            <Area type="monotone" dataKey="revenue" stroke="#566A4B" strokeWidth={2.5} fill="url(#revGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* TWO COLUMN: Orders trend + Status pie */}
      <div className="overview__grid">
        <div className="overview__panel">
          <div className="overview__panel-head">
            <h3>Orders — Last 30 Days</h3>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={salesSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8EBE6" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94A391" }} interval={4} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94A391" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                formatter={(v) => [v, "Orders"]}
                contentStyle={{ borderRadius: 12, border: "1px solid #E8EBE6", fontSize: 13 }}
                cursor={{ fill: "rgba(93,112,82,0.06)" }}
              />
              <Bar dataKey="orders" fill="#9B7B4A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="overview__panel">
          <div className="overview__panel-head">
            <h3>Order Status</h3>
          </div>
          {statusBreakdown.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={statusBreakdown}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {statusBreakdown.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || "#94A391"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E8EBE6", fontSize: 13 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, textTransform: "capitalize" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="overview__empty">No order data yet</div>
          )}
        </div>
      </div>

      {/* TWO COLUMN: Top products + Category distribution */}
      <div className="overview__grid">
        <div className="overview__panel">
          <div className="overview__panel-head">
            <h3>Top Products</h3>
            <span className="overview__panel-note">By units sold</span>
          </div>
          {topProducts.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topProducts} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8EBE6" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#94A391" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#4A5548" }} width={120} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v, n) => (n === "units" ? [v, "Units"] : [inr(v), "Revenue"])}
                  contentStyle={{ borderRadius: 12, border: "1px solid #E8EBE6", fontSize: 13 }}
                  cursor={{ fill: "rgba(93,112,82,0.06)" }}
                />
                <Bar dataKey="units" fill="#566A4B" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="overview__empty">No sales yet</div>
          )}
        </div>

        <div className="overview__panel">
          <div className="overview__panel-head">
            <h3>Catalog by Category</h3>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={categoryDistribution}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={(e) => e.value}
              >
                {categoryDistribution.map((entry, i) => (
                  <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E8EBE6", fontSize: 13 }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* TWO COLUMN: Recent orders + Low stock */}
      <div className="overview__grid">
        <div className="overview__panel">
          <div className="overview__panel-head">
            <h3>Recent Orders</h3>
          </div>
          {recentOrders.length ? (
            <div className="overview__list">
              {recentOrders.map((o) => (
                <div key={o._id} className="overview__list-row">
                  <div>
                    <span className="overview__list-title">{o.user?.name || "Customer"}</span>
                    <span className="overview__list-sub">{o.orderNumber || o._id.slice(-8)}</span>
                  </div>
                  <div className="overview__list-right">
                    <span className="overview__list-amount">{inr(o.totalPrice)}</span>
                    <span className={`admin__badge admin__badge--${o.orderStatus}`}>{o.orderStatus}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overview__empty">No orders yet</div>
          )}
        </div>

        <div className="overview__panel">
          <div className="overview__panel-head">
            <h3>
              <FaExclamationTriangle style={{ color: "var(--color-warning)", marginRight: 8 }} />
              Low Stock Alert
            </h3>
            <span className="overview__panel-note">≤ 20 units</span>
          </div>
          {lowStock.length ? (
            <div className="overview__list">
              {lowStock.map((p) => (
                <div key={p._id} className="overview__list-row">
                  <div>
                    <span className="overview__list-title">{p.title}</span>
                    <span className="overview__list-sub">{p.category}</span>
                  </div>
                  <span className={`admin__badge ${p.stockQuantity <= 5 ? "admin__badge--cancelled" : "admin__badge--pending"}`}>
                    {p.stockQuantity} left
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="overview__empty">All products well stocked ✓</div>
          )}
        </div>
      </div>
    </div>
  );
}
