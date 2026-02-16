import { NavLink } from "react-router-dom";

const NavItem = ({ to, label }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-4 py-2 rounded-full text-sm font-medium transition ${
          isActive
            ? "bg-wave text-white shadow-soft"
            : "text-slate hover:bg-white/70 hover:text-ink"
        }`
      }
    >
      {label}
    </NavLink>
  );
};

export default NavItem;
