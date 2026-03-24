import {
  Card,
  CardContent,
  CardMedia,
  Typography,
  Button,
} from "@mui/material";

const VehicleCard = ({ vehicle, isActive, isFaded, onClick }) => {
  return (
    <Card
      sx={{
        width: 245,
        transition: "all 0.35s ease",
        opacity: isFaded ? 0.3 : 1,
        transform: isActive ? "scale(1.05)" : "scale(1)",
        boxShadow: isActive ? 8 : 1,
        cursor: "pointer",
        "&:hover": {
          transform: isActive ? "scale(1.05)" : "scale(1.03)",
          boxShadow: 6,
        },
      }}
      onClick={onClick}
    >
      <CardMedia
        component="img"
        height="140"
        image={vehicle.image}
        alt={vehicle.model}
      />

      <CardContent>
        <Typography variant="subtitle1">
          {vehicle.make} {vehicle.model}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {vehicle.year} • {vehicle.body_style}
        </Typography>
      </CardContent>

      <Button size="small">View Details</Button>
    </Card>
  );
};

export default VehicleCard;