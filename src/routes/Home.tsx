import { Link } from "react-router";

const MODES = [
  { to: "/play/rookie", title: "Versus a rookie", body: "A computer pilot who flies by instinct and makes mistakes. Good for learning the maneuvers.", tag: "1 player" },
  { to: "/play/ace", title: "Versus an ace", body: "A computer pilot who weighs every possible move before choosing.", tag: "1 player" },
  { to: "/play/local", title: "Same screen", body: "Pass the device between turns. A hand-off screen hides each pilot's choice.", tag: "2 players" },
  { to: "/online", title: "Online", body: "Host a game and share a four-letter code, or join a friend's game from any device.", tag: "2 players", featured: true },
];

export function Home() {
  return (
    <div className="home">
      <section className="hero">
        <p className="eyebrow">Two pilots · one sky · turn to the page</p>
        <h1>Both pilots pick a maneuver in secret. Then you turn to the page that shows what you see.</h1>
        <p className="lede">Line the enemy up in your ring sight, close enough and at your height, and your guns hit. Eight hits brings him down.</p>
      </section>
      <section aria-label="Game modes" className="modes">
        {MODES.map(m => (
          <Link key={m.to} to={m.to} className={`mode-card${m.featured ? " is-featured" : ""}`}>
            <span className="mode-tag">{m.tag}</span>
            <b>{m.title}</b>
            <span>{m.body}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
