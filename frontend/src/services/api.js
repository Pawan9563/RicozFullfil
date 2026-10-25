import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request Interceptor: Attach Authorization Bearer token if stored in localStorage
api.interceptors.request.use(
  (config) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: 401 Unauthorized handling with silent refresh token rotation
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;

    // Check if error is 401 Unauthorized and not already retried
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      if (originalRequest.url?.includes("/auth/login") || originalRequest.url?.includes("/auth/refresh-token")) {
        return Promise.reject(error.response?.data || error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await axios.post(
          `${API_BASE_URL}/auth/refresh-token`,
          {},
          { withCredentials: true }
        );

        const newAccessToken =
          refreshResponse.data?.data?.accessToken ||
          refreshResponse.data?.accessToken;

        if (!newAccessToken) throw new Error("Refresh endpoint did not return an access token");
        localStorage.setItem("accessToken", newAccessToken);
        api.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        processQueue(null, newAccessToken);
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.removeItem("accessToken");
        localStorage.removeItem("user");
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
        return Promise.reject(refreshErr.response?.data || refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error.response?.data || error);
  }
);

// API Service Endpoint Stubs
export const authAPI = {
  login: (credentials) => api.post("/auth/login", credentials),
  register: (userData) => api.post("/auth/register", userData),
  logout: () => api.post("/auth/logout"),
  getCurrentUser: () => api.get("/auth/me"),
  refreshToken: () => api.post("/auth/refresh-token"),
};

export const userAPI = {
  getAll: (params) => api.get("/users", { params }),
  getById: (id) => api.get(`/users/${id}`),
  updateRole: (id, role) => api.patch(`/users/${id}/role`, { role }),
  toggleStatus: (id) => api.patch(`/users/${id}/toggle-status`),
};

export const productAPI = {
  getAll: (params) => api.get("/products", { params }),
  getById: (id) => api.get(`/products/${id}`),
  create: (data) => api.post("/products", data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
};

export const inventoryAPI = {
  getLevels: (params) => api.get("/inventory", { params }),
  adjustStock: (id, data) => api.patch(`/inventory/${id}/adjust`, data),
  reserveStock: (data) => api.post("/inventory/reserve", data),
  releaseStock: (data) => api.post("/inventory/release", data),
  transferStock: (data) => api.post("/inventory/transfer", data),
};

export const warehouseAPI = {
  getAll: () => api.get("/warehouses"),
  getById: (id) => api.get(`/warehouses/${id}`),
  create: (data) => api.post("/warehouses", data),
  update: (id, data) => api.put(`/warehouses/${id}`, data),
  delete: (id) => api.delete(`/warehouses/${id}`),
  getLocations: (warehouseId, params) => api.get(`/warehouses/${warehouseId}/locations`, { params }),
  createLocation: (warehouseId, data) => api.post(`/warehouses/${warehouseId}/locations`, data),
};

export const orderAPI = {
  getAll: (params) => api.get("/orders", { params }),
  getById: (id) => api.get(`/orders/${id}`),
  create: (data) => api.post("/orders", data),
  updateStatus: (id, data) => api.patch(`/orders/${id}/status`, data),
  cancel: (id, reason) => api.post(`/orders/${id}/cancel`, { reason }),
};

export const pickListAPI = {
  getEligibleOrders: () => api.get("/pick-lists/eligible-orders"),
  getEligiblePickers: (params) => api.get("/pick-lists/eligible-pickers", { params }),
  getAll: (params) => api.get("/pick-lists", { params }),
  getById: (id) => api.get(`/pick-lists/${id}`),
  create: (data) => api.post("/pick-lists", data),
  assignPicker: (id, pickerId) => api.patch(`/pick-lists/${id}/assign`, { pickerId }),
  pickItem: (id, itemId, data) => api.patch(`/pick-lists/${id}/items/${itemId}/pick`, data),
  complete: (id) => api.post(`/pick-lists/${id}/complete`),
};

export const packageAPI = {
  create: (data) => api.post("/packages", data),
  getById: (id) => api.get(`/packages/${id}`),
  getAll: (params) => api.get("/packages", { params }),
  getPackableOrders: () => api.get("/packages/packable-orders"),
  getPackingSlip: (id) => api.get(`/packages/${id}/packing-slip`),
};

export const shipmentAPI = {
  getCarriers: () => api.get("/shipments/carriers"),
  getAll: (params) => api.get("/shipments", { params }),
  getById: (id) => api.get(`/shipments/${id}`),
  create: (data) => api.post("/shipments", data),
  updateStatus: (id, data) => api.patch(`/shipments/${id}/status`, data),
  assignCarrier: (id, data) => api.patch(`/shipments/${id}/carrier`, data),
  getTracking: (id) => api.get(`/shipments/${id}/tracking`),
  simulateNextEvent: (id) => api.post(`/shipments/${id}/simulate-next-event`),
};

export const returnAPI = {
  getAll: (params) => api.get("/returns", { params }),
  getById: (id) => api.get(`/returns/${id}`),
  initiate: (data) => api.post("/returns", data),
  approve: (id, data) => api.patch(`/returns/${id}/approve`, data),
  pickup: (id, data) => api.patch(`/returns/${id}/pickup`, data),
  receive: (id, data) => api.patch(`/returns/${id}/receive`, data),
  inspect: (id, data) => api.patch(`/returns/${id}/inspect`, data),
  resolve: (id, data) => api.patch(`/returns/${id}/resolve`, data),
};

export const analyticsAPI = {
  getDashboard: () => api.get("/analytics/dashboard"),
  getOverview: () => api.get("/analytics/overview"),
  getThroughput: (params) => api.get("/analytics/throughput", { params }),
  getFulfillmentTimes: () => api.get("/analytics/fulfillment-times"),
};

export default api;
