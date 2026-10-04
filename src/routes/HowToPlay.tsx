import { Link } from "react-router";
import { MAN, ORDER } from "../../shared/rules";
import { ManeuverGlyph } from "../components/ManeuverPicker";

export function HowToPlay() {
  return (
    <div className="prose-page">
      <h1>How to play</h1>
      <p>Each pilot sees only their own page: the view from the cockpit, with the enemy wherever your last move left him. Both pilots choose a maneuver in secret. When both are in, the two aircraft move at the same time and you turn to a new page.</p>
      <h2>Scoring hits</h2>
      <ul>
        <li>One hit when the enemy is within about 15° of your nose, under 180 m away, and within one altitude band.</li>
        <li>Two hits at point-blank range: under 70 m and inside 22°.</li>
        <li>Pass too close and you collide. Both aircraft take a hit.</li>
        <li>Eight hits brings an aircraft down. If both go down on the same turn, nobody wins.</li>
        <li>If the aircraft drift more than 400 m apart, both wheel around and close head-on again.</li>
      </ul>
      <h2>Maneuvers</h2>
      <div className="man-table">
        {ORDER.map((id, i) => (
          <div key={id} className="man-row">
            <ManeuverGlyph id={id} />
            <b>{MAN[id].long}</b>
            <kbd>{"QWERTASDFG"[i]}</kbd>
          </div>
        ))}
      </div>
      <h2>Locked moves</h2>
      <p>Some moves can't follow others. Locked cards are struck through on your turn.</p>
      <ul>
        <li>After an Immelmann: no dive and no second Immelmann.</li>
        <li>After a dive: no tight turns.</li>
        <li>After a tight turn: no dive.</li>
        <li>After throttling back: no Immelmann.</li>
      </ul>
      <h2>Online games</h2>
      <p>One pilot presses <b>Host a game</b> and gets a four-letter code. The other enters it under <b>Join</b>, or opens the link the host shares. The host flies Blue and the joiner flies Red. Moves stay hidden on the server until both pilots have chosen.</p>
      <p><Link to="/" className="btn btn-primary">Pick a mode</Link></p>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="prose-page">
      <h1>Off the map</h1>
      <p>There's nothing at this address.</p>
      <p><Link to="/" className="btn btn-primary">Back to the airfield</Link></p>
    </div>
  );
}
