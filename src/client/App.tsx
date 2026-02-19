import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout.js";
import { RunConfig } from "./pages/RunConfig.js";
import { RunProgress } from "./pages/RunProgress.js";
import { Results } from "./pages/Results.js";
import { RunDetail } from "./pages/RunDetail.js";

function Placeholder({ title }: { title: string }) {
  return <div className="card"><h2>{title}</h2><p>Coming soon...</p></div>;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<RunConfig />} />
          <Route path="/progress/:runId" element={<RunProgress />} />
          <Route path="/results" element={<Results />} />
          <Route path="/results/:runId" element={<RunDetail />} />
          <Route path="/compare" element={<Placeholder title="A/B Compare" />} />
          <Route path="/prompts" element={<Placeholder title="Prompts" />} />
          <Route path="/settings" element={<Placeholder title="Settings" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
