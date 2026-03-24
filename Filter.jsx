import { useEffect, useState } from "react";
import { FormControl, InputLabel, Select, MenuItem, CircularProgress } from "@mui/material";
import { carsAPI } from "../Api";

const Filter = ({ filter, setFilter,totalVehicles}) => {
  const [bodyStyles, setBodyStyles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBodyStyles = async () => {
      try {
        setLoading(true);
        const styles = await carsAPI.getBodyStyles();
        setBodyStyles(styles);
      } catch (error) {
        console.error("Error fetching body styles:", error);
        setBodyStyles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBodyStyles();
  }, []);

  if (loading) {
    return (
      <FormControl fullWidth sx={{ mb: 3 }}>
        <InputLabel>Body Style</InputLabel>
        <Select value="" label="Body Style" disabled>
          <MenuItem value="">
            <CircularProgress size={20} />
          </MenuItem>
        </Select>
      </FormControl>
    );
  }

  return (
    <FormControl fullWidth sx={{ mb: 3 }}>
      <InputLabel>Body Style</InputLabel>
      <Select
        value={filter}
        label="Body Style"
        onChange={(e) => setFilter(e.target.value)}
      >
        <MenuItem value="All">
          All
        </MenuItem>
        {bodyStyles.map((style) => (
          <MenuItem key={style.name} value={style.name}>
            {style.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default Filter;