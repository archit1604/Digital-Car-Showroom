const API_BASE_URL = "http://localhost:8000";

// Helper function to get auth token from localStorage
const getAuthToken = () => {
  return localStorage.getItem("access_token");
};

const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "An error occurred" }));
    throw new Error(error.detail || `HTTP error! status: ${response.status}`);
  }
  return response.json();
};

export const authAPI = {
  signup: async (username, password, isAdmin = false) => {
    const response = await fetch(`${API_BASE_URL}/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        password,
        is_admin: isAdmin,
      }),
    });
    return handleResponse(response);
  },

  login: async (username, password) => {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        password,
      }),
    });
    const data = await handleResponse(response);
    
    // Store token in localStorage
    if (data.access_token) {
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));
    }
    
    return data;
  },

  logout: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
  },

  getCurrentUser: () => {
    const userStr = localStorage.getItem("user");
    return userStr ? JSON.parse(userStr) : null;
  },

  isAuthenticated: () => {
    return !!getAuthToken();
  },
};

// Cars API calls
export const carsAPI = {
  getAllCars: async () => {
    const response = await fetch(`${API_BASE_URL}/cars`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    return handleResponse(response);
  },

  getCarById: async (id) => {
    const cars = await carsAPI.getAllCars();
    const car = cars.find((c) => c.id === parseInt(id));
    if (!car) {
      throw new Error("Vehicle not found");
    }
    return car;
  },

  getBodyStyles: async () => {
    const response = await fetch(`${API_BASE_URL}/cars/body-styles`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    return handleResponse(response);
  },

  addCar: async (carData) => {
    const token = getAuthToken();
    if (!token) {
      throw new Error("Authentication required");
    }

    const response = await fetch(`${API_BASE_URL}/admin/cars`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(carData),
    });
    return handleResponse(response);
  },

  deleteCar: async (carId) => {
    const token = getAuthToken();
    if (!token) {
      throw new Error("Authentication required");
    }

    const response = await fetch(`${API_BASE_URL}/admin/cars/${carId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },
  generateAISummaryStream: async (carId, onChunk) => {

  const response = await fetch(
    `${API_BASE_URL}/ai/vehicle-summary-stream/${carId}`
  );

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    onChunk(chunk);
  }
},
};

// Protected route example
export const protectedAPI = {
  getProtectedData: async () => {
    const token = getAuthToken();
    if (!token) {
      throw new Error("Authentication required");
    }

    const response = await fetch(`${API_BASE_URL}/protected`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },
};