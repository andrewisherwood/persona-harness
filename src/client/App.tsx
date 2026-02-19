import { BrowserRouter, Routes, Route } from "react-router-dom";

export function App() {
  return (
    <BrowserRouter>
      <div style={{ padding: 24 }}>
        <h1>BirthBuild Test Harness</h1>
        <Routes>
          <Route path="/" element={<p>Dashboard coming soon...</p>} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
