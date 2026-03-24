import { useState, useEffect } from "react";
import VehicleCard from "./VehicleCard";
import Filter from "./Filter";
import { Grid, CircularProgress, Alert, Box, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { carsAPI, authAPI } from "../Api";

const VehicleList = () => {
  const [filter, setFilter] = useState("All");
  const [activeId, setActiveId] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useNavigate();
  const user = authAPI.getCurrentUser();
  const isAuthenticated = authAPI.isAuthenticated();

  // Fetch vehicles from backend
  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await carsAPI.getAllCars();
        setVehicles(data);
      } catch (err) {
        setError(err.message || "Failed to load vehicles");
        console.error("Error fetching vehicles:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchVehicles();
  }, []);

  // Case-insensitive filtering
  const filteredVehicles =
    filter === "All"
      ? vehicles
      : vehicles.filter((v) => 
          v.body_style && 
          v.body_style.toLowerCase() === filter.toLowerCase()
        );

  const handleCardClick = (id) => {
    setActiveId(id);

    setTimeout(() => {
      navigate(`/vehicle/${id}`);
    }, 350);
  };

  // Loading state
  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "400px",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        {error}
      </Alert>
    );
  }

  // Empty state
  if (vehicles.length === 0) {
    return (
      <Alert severity="info" sx={{ mb: 3 }}>
        No vehicles available in the showroom.
      </Alert>
    );
  }

  return (
    <>
      {isAuthenticated && user && (
        <Box sx={{ textAlign: "center", mb: 3 }}>
          <Typography variant="h5" color="primary">
            Welcome, {user.username}
            {user.is_admin && " (Admin)"}!
          </Typography>
        </Box>
      )}
      <Filter 
        filter={filter} 
        setFilter={setFilter} 
        totalVehicles={vehicles.length} 
      />

      {filteredVehicles.length === 0 ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          No vehicles found for the selected filter.
        </Alert>
      ) : (
        <Grid container spacing={3} justifyContent="center">
          {filteredVehicles.map((vehicle) => (
            <Grid item key={vehicle.id}>
              <VehicleCard
                vehicle={vehicle}
                isActive={activeId === vehicle.id}
                isFaded={activeId && activeId !== vehicle.id}
                onClick={() => handleCardClick(vehicle.id)}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </>
  );
};

export default VehicleList;