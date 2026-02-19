import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout.js";

function Placeholder({ title }: { title: string }) {
  return <div className="card"><h2>{title}</h2><p>Coming soon...</p></div>;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Placeholder title="Run Configuration" />} />
          <Route path="/progress/:runId" element={<Placeholder title="Run Progress" />} />
          <Route path="/results" element={<Placeholder title="Results" />} />
          <Route path="/results/:runId" element={<Placeholder title="Run Detail" />} />
          <Route path="/compare" element={<Placeholder title="A/B Compare" />} />
          <Route path="/prompts" element={<Placeholder title="Prompts" />} />
          <Route path="/settings" element={<Placeholder title="Settings" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
