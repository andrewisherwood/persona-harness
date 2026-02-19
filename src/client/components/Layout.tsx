import { NavLink, Outlet } from "react-router-dom";
import "./Layout.css";

const NAV_ITEMS = [
  { to: "/", label: "Run", icon: "\u25B6" },
  { to: "/results", label: "Results", icon: "\u2630" },
  { to: "/compare", label: "A/B Compare", icon: "\u21C4" },
  { to: "/prompts", label: "Prompts", icon: "\u270E" },
  { to: "/settings", label: "Settings", icon: "\u2699" },
];

export function Layout() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="logo">BirthBuild</h1>
          <span className="logo-sub">Test Harness</span>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
