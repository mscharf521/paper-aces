import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { Layout } from "./routes/Layout";
import { Home } from "./routes/Home";
import { LocalGame } from "./routes/LocalGame";
import { OnlineHub } from "./routes/OnlineHub";
import { OnlineGame } from "./routes/OnlineGame";
import { HowToPlay, NotFound } from "./routes/HowToPlay";
import "./styles/global.css";

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/play/:mode", element: <LocalGame /> },
      { path: "/online", element: <OnlineHub /> },
      { path: "/g/:code", element: <OnlineGame /> },
      { path: "/how-to-play", element: <HowToPlay /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
