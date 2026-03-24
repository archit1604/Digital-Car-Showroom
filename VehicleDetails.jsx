import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  Card,
  CardMedia,
  Box,
  CircularProgress,
  Alert,
} from "@mui/material";
import { carsAPI } from "../Api";



const VehicleDetails = () => {
  const { id } = useParams();
  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [aiSummary, setAiSummary] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const handleGenerateSummary = async () => {

    if (!vehicle) return;

    setAiSummary("");
    setAiLoading(true);

    try {
      await carsAPI.generateAISummaryStream(vehicle.id, (chunk) => {
        setAiSummary((prev) => prev + chunk);
      });
    } catch (err) {
      console.error(err);
    }

    setAiLoading(false);
  };

  useEffect(() => {
    const fetchVehicle = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await carsAPI.getCarById(id);
        setVehicle(data);
      } catch (err) {
        setError(err.message || "Failed to load vehicle details");
        console.error("Error fetching vehicle:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchVehicle();
  }, [id]);

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
      <Box sx={{ maxWidth: 1000, mx: "auto", mt: 4 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <Button component={Link} to="/" variant="outlined">
          Back to Catalog
        </Button>
      </Box>
    );
  }

  // Vehicle not found
  if (!vehicle) {
    return (
      <Box sx={{ maxWidth: 1000, mx: "auto", mt: 4 }}>
        <Alert severity="warning" sx={{ mb: 3 }}>
          Vehicle not found
        </Alert>
        <Button component={Link} to="/" variant="outlined">
          Back to Catalog
        </Button>
      </Box>
    );
  }

  // Parse features if it's a string (from backend)
  const features = typeof vehicle.features === "string" 
    ? JSON.parse(vehicle.features) 
    : vehicle.features || [];

  return (
    <Card sx={{ maxWidth: 1000, mx: "auto", mt: 4, p: 2 }}>
      {/* MAIN CONTAINER */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          gap: 4,
        }}
      >
        {/* IMAGE CONTAINER */}
        <Box sx={{ flex: 1 }}>
          <CardMedia
            component="img"
            image={vehicle.image}
            alt={vehicle.model}
            sx={{
              width: "100%",
              borderRadius: 2,
              objectFit: "cover",
            }}
          />
        </Box>

        {/* CONTENT CONTAINER */}
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" gutterBottom>
            {vehicle.make} {vehicle.model}
          </Typography>

          <Typography>
            <strong>Year:</strong> {vehicle.year}
          </Typography>
          <Typography>
            <strong>Body Style:</strong> {vehicle.body_style}
          </Typography>
          <Typography>
            <strong>Price:</strong> {vehicle.price}
          </Typography>
          <Typography>
            <strong>Mileage:</strong> {vehicle.mileage}
          </Typography>
          <Typography>
            <strong>Engine:</strong> {vehicle.engine}
          </Typography>

          {features.length > 0 && (
            <>
              <Typography variant="h6" sx={{ mt: 2 }}>
                Features:
              </Typography>

              <List dense>
                {features.map((feature, index) => (
                  <ListItem key={index}>
                    <ListItemText primary={feature} />
                  </ListItem>
                ))}
              </List>
            </>
          )}

          <Button component={Link} to="/" variant="outlined" sx={{ mt: 2 }}>
            Back to Catalog
          </Button>
          <Button
            variant="contained"
            sx={{ mt: 2 }}
            onClick={handleGenerateSummary}
            disabled={aiLoading}
          >
            {aiLoading ? "AI is typing..." : "Ask AI Assistant"}
          </Button>
          {aiSummary && (
            <Box sx={{ mt: 3, p: 2, backgroundColor: "#f5f5f5", borderRadius: 2 }}>
              <Typography variant="h6">AI Assistant</Typography>

              <Typography sx={{ whiteSpace: "pre-line" }}>
                {aiSummary}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Card>
  );
};

export default VehicleDetails;