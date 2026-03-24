import { useState, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Grid,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { carsAPI, authAPI } from "../Api";
import { useNavigate } from "react-router-dom";

const AdminPanel = () => {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState({
    make: "",
    model: "",
    year: "",
    body_style: "",
    price: "",
    mileage: "",
    engine: "",
    image: "",
  });

  // Check if user is admin
  useEffect(() => {
    const user = authAPI.getCurrentUser();
    if (!user || !user.is_admin) {
      navigate("/");
    }
  }, [navigate]);

  // Fetch cars
  useEffect(() => {
    fetchCars();
  }, []);

  const fetchCars = async () => {
    try {
      setLoading(true);
      const data = await carsAPI.getAllCars();
      setCars(data);
    } catch (err) {
      setError("Failed to load cars");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddCar = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      setLoading(true);
      
      // Convert year to integer
      const carData = {
        ...formData,
        year: parseInt(formData.year),
      };

      await carsAPI.addCar(carData);
      
      setSuccess("Car added successfully!");
      
      // Reset form
      setFormData({
        make: "",
        model: "",
        year: "",
        body_style: "",
        price: "",
        mileage: "",
        engine: "",
        image: "",
      });

      await fetchCars();
    } catch (err) {
      setError(err.message || "Failed to add car");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCar = async (carId) => {
    if (!window.confirm("Are you sure you want to delete this car?")) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      await carsAPI.deleteCar(carId);
      
      setSuccess("Car deleted successfully!");
      
      await fetchCars();
    } catch (err) {
      setError(err.message || "Failed to delete car");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Admin Panel
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Add Car Form */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Add New Car
          </Typography>

          <form onSubmit={handleAddCar}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Make"
                  name="make"
                  value={formData.make}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Model"
                  name="model"
                  value={formData.model}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Year"
                  name="year"
                  type="number"
                  value={formData.year}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Body Style"
                  name="body_style"
                  value={formData.body_style}
                  onChange={handleInputChange}
                  placeholder="e.g., Sedan, SUV, Truck"
                  required
                  disabled={loading}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Price"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  placeholder="e.g., $45,000"
                  required
                  disabled={loading}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Mileage"
                  name="mileage"
                  value={formData.mileage}
                  onChange={handleInputChange}
                  placeholder="e.g., 15,000 miles"
                  required
                  disabled={loading}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Engine"
                  name="engine"
                  value={formData.engine}
                  onChange={handleInputChange}
                  placeholder="e.g., 3.5L V6"
                  required
                  disabled={loading}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Image URL"
                  name="image"
                  value={formData.image}
                  onChange={handleInputChange}
                  placeholder="https://example.com/image.jpg"
                  required
                  disabled={loading}
                />
              </Grid>

              <Grid item xs={12}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  fullWidth
                >
                  {loading ? <CircularProgress size={24} /> : "Add Car"}
                </Button>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>

      {/* Car List */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Manage Cars
          </Typography>

          {loading && cars.length === 0 ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Make</TableCell>
                    <TableCell>Model</TableCell>
                    <TableCell>Year</TableCell>
                    <TableCell>Body Style</TableCell>
                    <TableCell>Price</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cars.map((car) => (
                    <TableRow key={car.id}>
                      <TableCell>{car.id}</TableCell>
                      <TableCell>{car.make}</TableCell>
                      <TableCell>{car.model}</TableCell>
                      <TableCell>{car.year}</TableCell>
                      <TableCell>{car.body_style}</TableCell>
                      <TableCell>{car.price}</TableCell>
                      <TableCell>
                        <IconButton
                          color="error"
                          onClick={() => handleDeleteCar(car.id)}
                          disabled={loading}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default AdminPanel;