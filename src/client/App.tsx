import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout.js";
import { RunConfig } from "./pages/RunConfig.js";
import { RunProgress } from "./pages/RunProgress.js";
import { Results } from "./pages/Results.js";
import { RunDetail } from "./pages/RunDetail.js";
import { ABCompare } from "./pages/ABCompare.js";
import { Prompts } from "./pages/Prompts.js";
import { Settings } from "./pages/Settings.js";
import { Research } from "./pages/Research.js";
import { ResearchDetail } from "./pages/ResearchDetail.js";
import { ResearchCompare } from "./pages/ResearchCompare.js";
import { CreativeBuildConfig } from "./pages/CreativeBuildConfig.js";
import { CreativeBuildProgress } from "./pages/CreativeBuildProgress.js";

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
          <Route path="/research" element={<Research />} />
          <Route path="/research/new" element={<CreativeBuildConfig />} />
          <Route path="/research/run/:id" element={<CreativeBuildProgress />} />
          <Route path="/research/compare" element={<ResearchCompare />} />
          <Route path="/research/:id" element={<ResearchDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
