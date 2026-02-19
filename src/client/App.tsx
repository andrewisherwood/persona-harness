import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout.js";
import { RunConfig } from "./pages/RunConfig.js";
import { RunProgress } from "./pages/RunProgress.js";
import { Results } from "./pages/Results.js";
import { RunDetail } from "./pages/RunDetail.js";
import { ABCompare } from "./pages/ABCompare.js";
import { Prompts } from "./pages/Prompts.js";
import { Settings } from "./pages/Settings.js";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<RunConfig />} />
          <Route path="/progress/:runId" element={<RunProgress />} />
          <Route path="/results" element={<Results />} />
          <Route path="/results/:runId" element={<RunDetail />} />
          <Route path="/compare" element={<ABCompare />} />
          <Route path="/prompts" element={<Prompts />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
