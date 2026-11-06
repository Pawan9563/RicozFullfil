import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Onboarding, ONBOARDING_STATUS } from "../models/onboarding.model.js";
import { Customer } from "../models/customer.model.js";

/**
 * Public endpoint: Submit a customer company onboarding application
 * Route: POST /api/v1/onboarding
 */
export const submitOnboarding = asyncHandler(async (req, res) => {
  const {
    companyName,
    companyWebsite,
    contactName,
    contactEmail,
    contactPhone,
    industry,
    monthlyOrderVolume,
    skuCount,
    currentFulfillment,
    preferredWarehouses,
    salesChannels,
    valueAddedServices,
    notes,
  } = req.body;

  // Validation
  if (!companyName || !companyName.trim()) {
    throw new ApiError(400, "Company name is required");
  }
  if (!contactName || !contactName.trim()) {
    throw new ApiError(400, "Primary contact name is required");
  }
  if (!contactEmail || !contactEmail.trim()) {
    throw new ApiError(400, "Official business email is required");
  }
  if (!contactPhone || !contactPhone.trim()) {
    throw new ApiError(400, "Phone number is required");
  }

  // Generate distinct reference number (e.g. ONB-8M9K2-5421)
  const codeFragment = Math.random().toString(36).substring(2, 6).toUpperCase();
  const numFragment = Math.floor(1000 + Math.random() * 9000);
  const referenceNumber = `ONB-${codeFragment}-${numFragment}`;

  // Optionally find or create a Customer record for this company
  let linkedCustomer = await Customer.findOne({ email: contactEmail.toLowerCase().trim() });
  if (!linkedCustomer) {
    linkedCustomer = await Customer.create({
      name: `${companyName.trim()} (${contactName.trim()})`,
      email: contactEmail.toLowerCase().trim(),
      phone: contactPhone.trim(),
      shippingAddresses: [
        {
          street: "Corporate Office",
          city: "Metro City",
          state: "State",
          postalCode: "100001",
          country: "India",
          isDefault: true,
        },
      ],
      tags: ["ENTERPRISE_CLIENT", "ONBOARDING_PROSPECT", industry || "E-Commerce"],
    });
  }

  // Create Onboarding application record
  const onboarding = await Onboarding.create({
    referenceNumber,
    companyName: companyName.trim(),
    companyWebsite: companyWebsite ? companyWebsite.trim() : "",
    contactName: contactName.trim(),
    contactEmail: contactEmail.toLowerCase().trim(),
    contactPhone: contactPhone.trim(),
    industry: industry || "E-Commerce / D2C",
    monthlyOrderVolume: monthlyOrderVolume || "500 - 2,000 orders/mo",
    skuCount: skuCount || "50 - 200 SKUs",
    currentFulfillment: currentFulfillment || "In-house / Self-fulfilled",
    preferredWarehouses: Array.isArray(preferredWarehouses) ? preferredWarehouses : [],
    salesChannels: Array.isArray(salesChannels) ? salesChannels : [],
    valueAddedServices: Array.isArray(valueAddedServices) ? valueAddedServices : [],
    notes: notes ? notes.trim() : "",
    status: ONBOARDING_STATUS.PENDING_REVIEW,
    customer: linkedCustomer ? linkedCustomer._id : null,
  });

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        onboarding,
        referenceNumber,
        estimatedReviewHours: 24,
        nextSteps: [
          "Fulfillment specialist review & SLA proposal",
          "Catalog & SKU barcode mapping audit",
          "Warehouse slotting & inbound logistics setup",
          "API keys & sales channel integration go-live",
        ],
      },
      "Customer company onboarding application received successfully"
    )
  );
});

/**
 * Public endpoint: Return onboarding platform configurations & available options
 * Route: GET /api/v1/onboarding/config
 */
export const getOnboardingConfig = asyncHandler(async (req, res) => {
  const config = {
    industries: [
      "E-Commerce & D2C Brands",
      "Fashion & Apparel",
      "Consumer Electronics & Gadgets",
      "Health, Beauty & Cosmetics",
      "FMCG, Food & Nutrition",
      "Home, Kitchen & Furniture",
      "Sports & Fitness",
      "B2B Wholesale & Industrial",
    ],
    volumeTiers: [
      { id: "tier_starter", label: "Under 500 orders / mo", recommendedTier: "Starter Hub" },
      { id: "tier_growth", label: "500 - 2,000 orders / mo", recommendedTier: "Growth Tier" },
      { id: "tier_scale", label: "2,000 - 10,000 orders / mo", recommendedTier: "Scale Tier" },
      { id: "tier_enterprise", label: "10,000 - 50,000 orders / mo", recommendedTier: "Enterprise Hub" },
      { id: "tier_hyper", label: "50,000+ orders / mo", recommendedTier: "HyperScale Dedicated" },
    ],
    warehouseHubs: [
      { id: "blr_central", name: "Bengaluru Central Hub", region: "South India", capacity: "45,000 sq ft" },
      { id: "bom_west", name: "Mumbai Logistics Park", region: "West India", capacity: "60,000 sq ft" },
      { id: "del_ncr", name: "Delhi-NCR Mega Terminal", region: "North India", capacity: "80,000 sq ft" },
      { id: "ccu_east", name: "Kolkata Distribution Center", region: "East India", capacity: "35,000 sq ft" },
    ],
    supportedChannels: [
      "Shopify & Shopify Plus",
      "Amazon Seller / Easy Ship",
      "WooCommerce",
      "Magento / Adobe Commerce",
      "Flipkart Omnichannel",
      "Custom REST API / Webhooks",
      "ERP (SAP / Oracle NetSuite / Zoho)",
    ],
    valueAddedServices: [
      "Custom Brand Packaging & Inserts",
      "Automated Lot & Expiry Date Tracking",
      "Multi-Item Kitting & Gift Bundling",
      "Fragile / High-Value Bubble & Armor Pack",
      "Quality Inspection & Reverse Grading",
      "Same-Day Expedited Dispatch",
    ],
  };

  return res.status(200).json(new ApiResponse(200, config, "Onboarding configuration fetched"));
});

/**
 * Admin endpoint: Get all onboarding applications with filters & pagination
 * Route: GET /api/v1/onboarding
 */
export const getOnboardings = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, search } = req.query;

  const query = {};
  if (status && Object.values(ONBOARDING_STATUS).includes(status)) {
    query.status = status;
  }

  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), "i");
    query.$or = [
      { companyName: searchRegex },
      { contactName: searchRegex },
      { contactEmail: searchRegex },
      { referenceNumber: searchRegex },
    ];
  }

  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 20;
  const skip = (pageNum - 1) * limitNum;

  const [onboardings, total] = await Promise.all([
    Onboarding.find(query)
      .populate("customer", "name email phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    Onboarding.countDocuments(query),
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        onboardings,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
      "Customer onboarding applications fetched"
    )
  );
});

/**
 * Admin endpoint: Get single onboarding record
 * Route: GET /api/v1/onboarding/:id
 */
export const getOnboardingById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const query = id.startsWith("ONB-") ? { referenceNumber: id.toUpperCase() } : { _id: id };
  const onboarding = await Onboarding.findOne(query).populate("customer");

  if (!onboarding) {
    throw new ApiError(404, "Onboarding application not found");
  }

  return res.status(200).json(new ApiResponse(200, onboarding, "Onboarding details fetched"));
});

/**
 * Admin endpoint: Update status of onboarding request
 * Route: PATCH /api/v1/onboarding/:id/status
 */
export const updateOnboardingStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  if (!status || !Object.values(ONBOARDING_STATUS).includes(status)) {
    throw new ApiError(400, "Valid onboarding status is required");
  }

  const updateFields = { status };
  if (notes !== undefined) {
    updateFields.notes = notes;
  }

  const onboarding = await Onboarding.findByIdAndUpdate(id, updateFields, {
    new: true,
    runValidators: true,
  });

  if (!onboarding) {
    throw new ApiError(404, "Onboarding application not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, onboarding, `Onboarding status updated to ${status}`));
});
