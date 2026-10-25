import mongoose from "mongoose";
import { Product, PRODUCT_STATUS } from "../models/product.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Create a new product in the catalog
 * Role-gate: Admin / Super Admin only
 */
export const createProduct = asyncHandler(async (req, res) => {
  const {
    name,
    sku,
    description,
    category,
    price,
    unitPrice,
    weight,
    dimensions,
    imageUrl,
    status,
    barcode,
    costPrice,
  } = req.body;

  const targetPrice = price !== undefined ? price : unitPrice;

  // Basic validation
  if (!name || !name.trim()) {
    throw new ApiError(400, "Product name is required");
  }

  if (!sku || !sku.trim()) {
    throw new ApiError(400, "Product SKU is required");
  }

  if (targetPrice === undefined || Number(targetPrice) < 0) {
    throw new ApiError(400, "A valid non-negative product price is required");
  }

  // Check SKU uniqueness
  const formattedSku = sku.trim().toUpperCase();
  const existingProduct = await Product.findOne({ sku: formattedSku });
  if (existingProduct) {
    throw new ApiError(409, `Product with SKU '${formattedSku}' already exists`);
  }

  // Handle image upload from multer or direct imageUrl
  let finalImageUrl = (imageUrl || "").trim();
  if (req.files && req.files.length > 0) {
    finalImageUrl = req.files[0].path;
  } else if (req.file) {
    finalImageUrl = req.file.path;
  }

  const product = await Product.create({
    sku: formattedSku,
    name: name.trim(),
    description: (description || "").trim(),
    category: (category || "General").trim(),
    price: Number(targetPrice),
    weight: weight !== undefined ? Math.max(0, Number(weight)) : 0,
    dimensions: dimensions || { length: 0, width: 0, height: 0, unit: "cm" },
    imageUrl: finalImageUrl,
    status: status || PRODUCT_STATUS.ACTIVE,
    barcode: (barcode || "").trim(),
    costPrice: costPrice !== undefined ? Math.max(0, Number(costPrice)) : 0,
    images: req.files ? req.files.map((f) => f.path) : (finalImageUrl ? [finalImageUrl] : []),
  });

  return res.status(201).json(
    new ApiResponse(201, product, "Product created successfully")
  );
});

/**
 * Get all products with search, category filtering, status, and pagination
 */
export const getAllProducts = asyncHandler(async (req, res) => {
  const { search, category, status, page = 1, limit = 10 } = req.query;

  const filter = {};

  if (status) {
    filter.status = status;
  }

  if (category) {
    filter.category = category;
  }

  if (search && search.trim()) {
    const query = search.trim();
    filter.$or = [
      { name: { $regex: query, $options: "i" } },
      { sku: { $regex: query, $options: "i" } },
      { barcode: { $regex: query, $options: "i" } },
      { category: { $regex: query, $options: "i" } },
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, parseInt(limit, 10) || 10);
  const skip = (pageNum - 1) * limitNum;

  const [products, totalCount] = await Promise.all([
    Product.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    Product.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalCount / limitNum);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        products,
        pagination: {
          total: totalCount,
          page: pageNum,
          limit: limitNum,
          totalPages,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
        page: pageNum,
        limit: limitNum,
        total: totalCount,
      },
      "Products fetched successfully"
    )
  );
});

/**
 * Get single product by ID
 */
export const getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid product ID format");
  }

  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  return res.status(200).json(
    new ApiResponse(200, product, "Product retrieved successfully")
  );
});

/**
 * Update product details
 * Role-gate: Admin / Super Admin only
 */
export const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid product ID format");
  }

  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  const {
    name,
    sku,
    description,
    category,
    price,
    unitPrice,
    weight,
    dimensions,
    imageUrl,
    status,
    barcode,
    costPrice,
  } = req.body;

  // If SKU is being updated, ensure it's not taken by another product
  if (sku && sku.trim().toUpperCase() !== product.sku) {
    const formattedSku = sku.trim().toUpperCase();
    const existing = await Product.findOne({ sku: formattedSku });
    if (existing && existing._id.toString() !== id) {
      throw new ApiError(409, `Product with SKU '${formattedSku}' already exists`);
    }
    product.sku = formattedSku;
  }

  if (name !== undefined) product.name = name.trim();
  if (description !== undefined) product.description = description.trim();
  if (category !== undefined) product.category = category.trim();

  const targetPrice = price !== undefined ? price : unitPrice;
  if (targetPrice !== undefined) {
    if (Number(targetPrice) < 0) throw new ApiError(400, "Price cannot be negative");
    product.price = Number(targetPrice);
  }

  if (weight !== undefined) product.weight = Math.max(0, Number(weight));
  if (dimensions !== undefined) product.dimensions = { ...product.dimensions, ...dimensions };
  if (imageUrl !== undefined) product.imageUrl = imageUrl.trim();
  if (status !== undefined) product.status = status;
  if (barcode !== undefined) product.barcode = barcode.trim();
  if (costPrice !== undefined) product.costPrice = Math.max(0, Number(costPrice));

  if (req.files && req.files.length > 0) {
    product.images = req.files.map((f) => f.path);
    product.imageUrl = req.files[0].path;
  }

  await product.save();

  return res.status(200).json(
    new ApiResponse(200, product, "Product updated successfully")
  );
});

/**
 * Delete or soft-delete a product
 * Role-gate: Admin / Super Admin only
 */
export const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid product ID format");
  }

  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  // Soft-deactivate by setting status to ARCHIVED / INACTIVE
  product.status = PRODUCT_STATUS.ARCHIVED;
  await product.save();

  return res.status(200).json(
    new ApiResponse(200, { _id: id, status: product.status }, "Product archived successfully")
  );
});
