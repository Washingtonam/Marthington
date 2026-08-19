import request from "./client.js";


// 🔥 CREATE PRODUCT
export const createProduct = async (payload) => {
  return request("/products", {
    method: "POST",
    body: JSON.stringify(payload)
  });
};


// 🔥 GET PRODUCTS
export const getProducts = async (params = {}) => {
  const query = new URLSearchParams(params).toString();
  const data = await request(`/products${query ? `?${query}` : ""}`);
  
  // Handle both array and paginated response formats
  const productsList = Array.isArray(data) ? data : (data?.products || []);

  return productsList.map((product) => ({
    ...product,
    price: product.sellingPrice || product.price || 0,
    stock: product.stock || 0
  }));
};


// 🔥 UPDATE PRODUCT
export const updateProduct = async (
  id,
  payload
) => {
  return request(`/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
};


// 🔥 DELETE PRODUCT
export const deleteProduct = async (
  id
) => {
  return request(`/products/${id}`, {
    method: "DELETE"
  });
};