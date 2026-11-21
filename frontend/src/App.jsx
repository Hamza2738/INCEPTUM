import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import Layout from "./components/Layout";
import { Spinner } from "./components/ui";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Plots from "./pages/Plots";
import PlotDetail from "./pages/PlotDetail";
import MapPage from "./pages/MapPage";
import Economics from "./pages/Economics";
import Scanner from "./pages/Scanner";
import Advisor from "./pages/Advisor";
import About from "./pages/About";
import Report from "./pages/Report";

export default function App() {
  const { user, region, booting } = useAuth();
  if (booting) return <Spinner />;
  if (!user || !region) return <Login />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="plots" element={<Plots />} />
        <Route path="plots/:id" element={<PlotDetail />} />
        <Route path="plots/:id/report" element={<Report />} />
        <Route path="map" element={<MapPage />} />
        <Route path="economics" element={<Economics />} />
        <Route path="scanner" element={<Scanner />} />
        <Route path="advisor" element={<Advisor />} />
        <Route path="about" element={<About />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
