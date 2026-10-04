import { Link, NavLink, Outlet } from "react-router";

export function Layout() {
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Paper Aces home">Paper <span>Aces</span></Link>
        <nav className="nav" aria-label="Main">
          <NavLink to="/" end>Play</NavLink>
          <NavLink to="/online">Online</NavLink>
          <NavLink to="/how-to-play">How to play</NavLink>
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
