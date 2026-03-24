import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import VehicleList from "./components/VehicleList";
import VehicleDetails from "./components/VehicleDetails";
import Login from "./components/Login";
import Signup from "./components/Signup";
import AdminPanel from "./components/AdminPanel";
import { AppBar, Toolbar, Typography, Container, Button, Box } from "@mui/material";
import { authAPI } from "./Api";
import { useNavigate } from "react-router-dom";

function NavBar() {
  const navigate = useNavigate();
  const user = authAPI.getCurrentUser();
  const isAuthenticated = authAPI.isAuthenticated();

  const handleLogout = () => {
    authAPI.logout();
    navigate("/login");
  };

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h4" sx={{ flexGrow: 1, cursor: "pointer" }} onClick={() => navigate("/")}>
          Digital Car Showroom 🏎️
        </Typography>

        <Box>
          {isAuthenticated ? (
            <>
              {/* <Typography component="span" sx={{ mr: 2 }}>
                Welcome, {user?.username}
                {user?.is_admin && " (Admin)"}
              </Typography> */}
              
              {user?.is_admin && (
                <Button color="inherit" variant="outlined" sx={{ mr: 1 }} onClick={() => navigate("/admin")}>
                  Admin Panel
                </Button>
              )}
              
              <Button color="inherit" variant="outlined" onClick={handleLogout}>
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button color="inherit" variant="outlined" sx={{ mr: 1 }} onClick={() => navigate("/login")}>
                Login
              </Button>
              <Button color="inherit" variant="outlined" onClick={() => navigate("/signup")}>
                Sign Up
              </Button>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}

function App() {
  return (
    <Router>
      <NavBar />

      <Container sx={{ mt: 4 }}>
        <Routes>
          <Route path="/" element={<VehicleList />} />
          <Route path="/vehicle/:id" element={<VehicleDetails />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/admin" element={<AdminPanel />} />
        </Routes>
      </Container>
    </Router>
  );
}

export default App;