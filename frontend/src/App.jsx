import { Route, Routes } from "react-router-dom";

import { AuthProvider } from "./state/auth";
import Layout from "./components/Layout";
import Analytics from "./routes/Analytics";
import Chat from "./routes/Chat";
import Compare from "./routes/Compare";
import Dashboard from "./routes/Dashboard";
import History from "./routes/History";
import Login from "./routes/Login";
import ModelingAdvisor from "./routes/ModelingAdvisor";
import Profile from "./routes/Profile";
import SchemaDetail from "./routes/SchemaDetail";
import SchemaEvolution from "./routes/SchemaEvolution";
import Signup from "./routes/Signup";

const App = () => {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/history" element={<History />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/advisor" element={<ModelingAdvisor />} />
          <Route path="/evolution" element={<SchemaEvolution />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/schema/:id" element={<SchemaDetail />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
};

export default App;
