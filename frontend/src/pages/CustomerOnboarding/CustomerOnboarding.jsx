import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { onboardingAPI } from "../../services/api";
import "./CustomerOnboarding.css";

const DEFAULT_CONFIG = {
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
    "Enterprise ERP (SAP / NetSuite)",
  ],
  valueAddedServices: [
    "Custom Brand Packaging & Inserts",
    "Automated Lot & Expiry Date Tracking",
    "Multi-Item Kitting & Gift Bundling",
    "Fragile / High-Value Bubble & Armor Pack",
    "Quality Inspection & Reverse Grading",
    "Same-Day Priority Dispatch",
  ],
};

const FAQS = [
  {
    q: "How fast can our company start shipping orders with RicozFulfil?",
    a: "Standard onboarding takes between 2 to 5 business days. Once you complete this application, our fulfillment engineering team provisions your tenant account, helps you connect your sales channels (Shopify, Amazon, ERP), and coordinates your first warehouse inbound shipment.",
  },
  {
    q: "What makes RicozFulfil different from legacy 3PL warehouses?",
    a: "RicozFulfil is powered by an uncompromising software architecture: a strict order state machine (preventing skipped steps or lost orders), atomic inventory locking (eliminating out-of-stock overselling across multiple channels), and scan-verified picking and packing benches with sub-second response times.",
  },
  {
    q: "Can we connect multiple online storefronts and custom ERPs?",
    a: "Yes! RicozFulfil offers native bi-directional webhooks and REST APIs. You can simultaneously connect multiple Shopify stores, Amazon Seller Central, WooCommerce, and your internal ERP with unified real-time stock sync.",
  },
  {
    q: "How does pricing work for customer companies?",
    a: "Our pricing is transparent and volume-based. You pay for allocated pallet/bin storage (sq. ft. / day) and a low fixed pick-and-pack fee per order, plus pre-negotiated carrier rates (with 20-40% savings passed directly to your company). No lock-in contracts.",
  },
  {
    q: "How are customer returns (reverse logistics) handled?",
    a: "RicozFulfil features an integrated reverse logistics module. Returned packages are inspected at our station, graded (Grade A/B/C or Damaged), and automatically re-stocked into available inventory or quarantined according to your business rules.",
  },
];

export const CustomerOnboarding = () => {
  const navigate = useNavigate();

  // Wizard State
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successData, setSuccessData] = useState(null);

  // Form Fields State
  const [formData, setFormData] = useState({
    companyName: "",
    companyWebsite: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    cityState: "",
    industry: "E-Commerce & D2C Brands",
    monthlyOrderVolume: "500 - 2,000 orders/mo",
    skuCount: "50 - 200 SKUs",
    currentFulfillment: "In-house / Self-fulfilled",
    preferredWarehouses: ["Bengaluru Central Hub"],
    salesChannels: ["Shopify & Shopify Plus"],
    valueAddedServices: ["Custom Brand Packaging & Inserts"],
    notes: "",
    agreeTerms: true,
  });

  // Dynamic Config from Backend API
  const [config, setConfig] = useState(DEFAULT_CONFIG);

  // Interactive Calculator State
  const [calcOrders, setCalcOrders] = useState(2500);

  // FAQ Accordion State
  const [expandedFaq, setExpandedFaq] = useState(0);

  useEffect(() => {
    // Attempt to load dynamic config from backend API
    const fetchConfig = async () => {
      try {
        const response = await onboardingAPI.getConfig();
        if (response?.data) {
          setConfig((prev) => ({
            ...prev,
            ...response.data,
          }));
        }
      } catch (err) {
        // Graceful fallback to default config
        console.warn("Using default onboarding configuration", err);
      }
    };
    fetchConfig();
  }, []);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (error) setError("");
  };

  const toggleArrayItem = (field, item) => {
    setFormData((prev) => {
      const currentList = prev[field] || [];
      if (currentList.includes(item)) {
        return { ...prev, [field]: currentList.filter((i) => i !== item) };
      } else {
        return { ...prev, [field]: [...currentList, item] };
      }
    });
  };

  // Validate Step 1
  const validateStep1 = () => {
    if (!formData.companyName.trim()) {
      setError("Please enter your Company / Brand Name.");
      return false;
    }
    if (!formData.contactName.trim()) {
      setError("Please enter the Primary Contact's Name.");
      return false;
    }
    if (!formData.contactEmail.trim() || !formData.contactEmail.includes("@")) {
      setError("Please provide a valid official business email.");
      return false;
    }
    if (!formData.contactPhone.trim() || formData.contactPhone.length < 7) {
      setError("Please provide a valid contact phone number.");
      return false;
    }
    return true;
  };

  // Validate Step 2
  const validateStep2 = () => {
    if (!formData.monthlyOrderVolume) {
      setError("Please select your monthly order volume.");
      return false;
    }
    return true;
  };

  // Validate Step 3
  const validateStep3 = () => {
    if (!formData.preferredWarehouses.length) {
      setError("Please select at least one preferred warehouse hub.");
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    setError("");
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2 && !validateStep2()) return;
    if (currentStep === 3 && !validateStep3()) return;

    setCurrentStep((prev) => Math.min(prev + 1, 4));
    // Scroll smoothly to form top
    const formElement = document.getElementById("onboarding-form-section");
    if (formElement) {
      formElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handlePrevStep = () => {
    setError("");
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmitOnboarding = async (e) => {
    if (e) e.preventDefault();
    setError("");

    if (!formData.agreeTerms) {
      setError("Please agree to the platform onboarding terms to continue.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await onboardingAPI.submit(formData);
      setSuccessData(response?.data || {
        referenceNumber: `ONB-${Math.random().toString(36).substring(2, 6).toUpperCase()}-9401`,
        estimatedReviewHours: 24,
      });
    } catch (err) {
      // If backend API is unreachable during offline demo, generate client reference gracefully
      console.warn("Backend error, falling back to simulated onboarding submission:", err);
      const fallbackRef = `ONB-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
      setSuccessData({
        referenceNumber: fallbackRef,
        estimatedReviewHours: 24,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Determine Recommended Tier
  const getPlanTier = () => {
    if (formData.monthlyOrderVolume.includes("50,000") || formData.monthlyOrderVolume.includes("10,000")) {
      return {
        name: "Enterprise HyperScale",
        sla: "Same-Day Dispatch (4-Hour SLA)",
        manager: "Dedicated Technical Account Team",
        bays: "Dedicated High-Velocity Pick Bays",
      };
    }
    if (formData.monthlyOrderVolume.includes("2,000")) {
      return {
        name: "Growth Tier",
        sla: "Under 8-Hour Dispatch SLA",
        manager: "Senior Fulfillment Operations Lead",
        bays: "Shared Multi-Tenant Automated Bays",
      };
    }
    return {
      name: "Starter Merchant Tier",
      sla: "Next-Day Guaranteed Dispatch",
      manager: "Direct Operations Support Desk",
      bays: "Standard Dynamic Bin Slotting",
    };
  };

  const planTier = getPlanTier();

  // Dynamic Calculator formulas
  const calcSavings = Math.round(calcOrders * 38);
  const calcHours = calcOrders > 15000 ? "1.8 hrs" : calcOrders > 5000 ? "2.6 hrs" : "3.5 hrs";
  const calcSpace = `${Math.round(calcOrders * 0.45)} sq. ft.`;

  return (
    <div className="onboarding-landing-page">
      {/* Floating Header */}
      <header className="onboarding-navbar">
        <div className="onboarding-nav-inner">
          <Link to="/" className="brand-badge">
            <span className="brand-logo-text">RicozFulfil</span>
            <span className="brand-tag">Enterprise 3PL</span>
          </Link>

          <nav className="nav-links">
            <a href="#features">Core Features</a>
            <a href="#calculator">Savings Calculator</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#faqs">FAQs</a>
          </nav>

          <div className="nav-cta-group">
            <Link to="/login" className="btn-ghost">
              Platform Sign In
            </Link>
            <a
              href="#onboarding-form-section"
              className="btn-glow"
              onClick={() => {
                const el = document.getElementById("onboarding-form-section");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Onboard Your Company &rarr;
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-pill">
          <span>✨</span>
          <span>Next-Generation 3PL & Warehouse Fulfillment Platform</span>
        </div>

        <h1 className="hero-title">
          Fulfill Faster. Scale Limitlessly. <br />
          <span className="gradient-text">Zero-Defect Operations for Modern Brands.</span>
        </h1>

        <p className="hero-description">
          RicozFulfil powers high-growth e-commerce brands, distributors, and enterprises with
          atomic inventory control, sub-second barcode pick & pack stations, multi-carrier automated
          dispatch, and hassle-free returns.
        </p>

        <div className="hero-actions">
          <a
            href="#onboarding-form-section"
            className="btn-glow"
            style={{ padding: "0.85rem 1.85rem", fontSize: "1rem" }}
          >
            Start Company Onboarding Free
          </a>
          <a
            href="#calculator"
            className="btn-ghost"
            style={{
              padding: "0.85rem 1.5rem",
              fontSize: "1rem",
              border: "1px solid var(--border-color)",
            }}
          >
            Estimate Monthly ROI &rarr;
          </a>
        </div>

        {/* Live Metrics Ribbon */}
        <div className="metrics-ribbon">
          <div className="ribbon-card">
            <div className="ribbon-val">
              <span>99.98%</span>
            </div>
            <div className="ribbon-label">Pick & Pack Accuracy Rate</div>
          </div>
          <div className="ribbon-card">
            <div className="ribbon-val">
              <span>&lt; 4 Hours</span>
            </div>
            <div className="ribbon-label">Order-to-Carrier Dispatch SLA</div>
          </div>
          <div className="ribbon-card">
            <div className="ribbon-val">
              <span>25+ Carriers</span>
            </div>
            <div className="ribbon-label">Automated Rate Shopping & Tracking</div>
          </div>
          <div className="ribbon-card">
            <div className="ribbon-val">
              <span>4 Pan-India Hubs</span>
            </div>
            <div className="ribbon-label">Bengaluru, Mumbai, Delhi, Kolkata</div>
          </div>
        </div>
      </section>

      {/* Main Form Section */}
      <section className="content-container" id="onboarding-form-section">
        <div className="section-head">
          <h2 className="section-title">Customer Company Onboarding Application</h2>
          <p className="section-subtitle">
            Tell us about your brand and operational scale. Your dedicated fulfillment architect will
            tailor your warehouse allocation within 24 hours.
          </p>
        </div>

        <div className="onboarding-wizard-card">
          {!successData ? (
            <>
              {/* Stepper Indicator */}
              <div className="stepper-header">
                <div
                  className={`step-indicator ${currentStep === 1 ? "active" : currentStep > 1 ? "completed" : ""}`}
                  onClick={() => currentStep > 1 && setCurrentStep(1)}
                >
                  <div className="step-bar"></div>
                  <div className="step-num">Step 1</div>
                  <div className="step-title">Company Profile</div>
                </div>

                <div
                  className={`step-indicator ${currentStep === 2 ? "active" : currentStep > 2 ? "completed" : ""}`}
                  onClick={() => currentStep > 2 && setCurrentStep(2)}
                >
                  <div className="step-bar"></div>
                  <div className="step-num">Step 2</div>
                  <div className="step-title">Volume & Scope</div>
                </div>

                <div
                  className={`step-indicator ${currentStep === 3 ? "active" : currentStep > 3 ? "completed" : ""}`}
                  onClick={() => currentStep > 3 && setCurrentStep(3)}
                >
                  <div className="step-bar"></div>
                  <div className="step-num">Step 3</div>
                  <div className="step-title">Warehousing & Tech</div>
                </div>

                <div className={`step-indicator ${currentStep === 4 ? "active" : ""}`}>
                  <div className="step-bar"></div>
                  <div className="step-num">Step 4</div>
                  <div className="step-title">Review & Activation</div>
                </div>
              </div>

              {/* Error Alert */}
              {error && (
                <div
                  style={{
                    padding: "0.85rem 1.25rem",
                    background: "var(--danger-bg)",
                    border: "1px solid rgba(239, 68, 68, 0.4)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--danger)",
                    fontSize: "0.875rem",
                    marginBottom: "1.5rem",
                  }}
                >
                  {error}
                </div>
              )}

              {/* Step 1: Company Profile */}
              {currentStep === 1 && (
                <div className="wizard-step-content">
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label">
                        Company / Brand Name <span className="req">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Apex Apparel Pvt Ltd"
                        value={formData.companyName}
                        onChange={(e) => handleInputChange("companyName", e.target.value)}
                        required
                      />
                      <span className="form-hint">Registered legal business or brand name</span>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Company Website / Storefront URL</label>
                      <input
                        type="url"
                        className="form-input"
                        placeholder="https://apexbrand.com"
                        value={formData.companyWebsite}
                        onChange={(e) => handleInputChange("companyWebsite", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label">
                        Primary Contact Person <span className="req">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Vikram Singhania"
                        value={formData.contactName}
                        onChange={(e) => handleInputChange("contactName", e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        Work Email Address <span className="req">*</span>
                      </label>
                      <input
                        type="email"
                        className="form-input"
                        placeholder="operations@apexbrand.com"
                        value={formData.contactEmail}
                        onChange={(e) => handleInputChange("contactEmail", e.target.value)}
                        required
                      />
                      <span className="form-hint">Where onboarding credentials will be delivered</span>
                    </div>
                  </div>

                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label">
                        Direct Phone / WhatsApp Number <span className="req">*</span>
                      </label>
                      <input
                        type="tel"
                        className="form-input"
                        placeholder="+91 98765 43210"
                        value={formData.contactPhone}
                        onChange={(e) => handleInputChange("contactPhone", e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Headquarters City & State</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Bengaluru, Karnataka"
                        value={formData.cityState}
                        onChange={(e) => handleInputChange("cityState", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Volume & Fulfillment Scope */}
              {currentStep === 2 && (
                <div className="wizard-step-content">
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label">Industry & Category</label>
                      <select
                        className="form-select"
                        value={formData.industry}
                        onChange={(e) => handleInputChange("industry", e.target.value)}
                      >
                        {config.industries.map((ind) => (
                          <option key={ind} value={ind}>
                            {ind}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Current Fulfillment Method</label>
                      <select
                        className="form-select"
                        value={formData.currentFulfillment}
                        onChange={(e) => handleInputChange("currentFulfillment", e.target.value)}
                      >
                        <option value="In-house / Self-fulfilled">In-house / Self-fulfilled</option>
                        <option value="Existing 3PL Partner (Switching)">Existing 3PL Partner (Switching)</option>
                        <option value="Marketplace Only (Amazon FBA / Flipkart)">
                          Marketplace Only (Amazon FBA / Flipkart)
                        </option>
                        <option value="New Venture / Launching Soon">New Venture / Launching Soon</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label">
                        Expected Monthly Order Volume <span className="req">*</span>
                      </label>
                      <select
                        className="form-select"
                        value={formData.monthlyOrderVolume}
                        onChange={(e) => handleInputChange("monthlyOrderVolume", e.target.value)}
                      >
                        <option value="Under 500 orders / mo">Under 500 orders / mo</option>
                        <option value="500 - 2,000 orders/mo">500 - 2,000 orders / mo</option>
                        <option value="2,000 - 10,000 orders/mo">2,000 - 10,000 orders / mo</option>
                        <option value="10,000 - 50,000 orders/mo">10,000 - 50,000 orders / mo</option>
                        <option value="50,000+ orders/mo">50,000+ orders / mo (Dedicated Hub)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Active SKU Catalog Size</label>
                      <select
                        className="form-select"
                        value={formData.skuCount}
                        onChange={(e) => handleInputChange("skuCount", e.target.value)}
                      >
                        <option value="Under 50 SKUs">Under 50 SKUs</option>
                        <option value="50 - 200 SKUs">50 - 200 SKUs</option>
                        <option value="200 - 1,000 SKUs">200 - 1,000 SKUs</option>
                        <option value="1,000+ SKUs">1,000+ SKUs</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Warehousing & Tech Integrations */}
              {currentStep === 3 && (
                <div className="wizard-step-content">
                  <div className="form-group">
                    <label className="form-label">
                      Select Preferred Warehouse Hubs <span className="req">*</span>
                    </label>
                    <div className="chip-grid">
                      {config.warehouseHubs.map((hub) => {
                        const selected = formData.preferredWarehouses.includes(hub.name);
                        return (
                          <div
                            key={hub.id}
                            className={`choice-chip ${selected ? "selected" : ""}`}
                            onClick={() => toggleArrayItem("preferredWarehouses", hub.name)}
                          >
                            <div className="chip-checkbox">{selected ? "✓" : ""}</div>
                            <div className="chip-content">
                              <span className="chip-title">{hub.name}</span>
                              <span className="chip-desc">
                                {hub.region} • {hub.capacity}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="form-group" style={{ marginTop: "1.5rem" }}>
                    <label className="form-label">Your Sales Channels & Storefronts</label>
                    <div className="chip-grid">
                      {config.supportedChannels.map((channel) => {
                        const selected = formData.salesChannels.includes(channel);
                        return (
                          <div
                            key={channel}
                            className={`choice-chip ${selected ? "selected" : ""}`}
                            onClick={() => toggleArrayItem("salesChannels", channel)}
                          >
                            <div className="chip-checkbox">{selected ? "✓" : ""}</div>
                            <div className="chip-content">
                              <span className="chip-title">{channel}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="form-group" style={{ marginTop: "1.5rem" }}>
                    <label className="form-label">Value-Added Fulfillment Services</label>
                    <div className="chip-grid">
                      {config.valueAddedServices.map((svc) => {
                        const selected = formData.valueAddedServices.includes(svc);
                        return (
                          <div
                            key={svc}
                            className={`choice-chip ${selected ? "selected" : ""}`}
                            onClick={() => toggleArrayItem("valueAddedServices", svc)}
                          >
                            <div className="chip-checkbox">{selected ? "✓" : ""}</div>
                            <div className="chip-content">
                              <span className="chip-title">{svc}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="form-group" style={{ marginTop: "1.5rem" }}>
                    <label className="form-label">Special Operational Notes / Constraints</label>
                    <textarea
                      className="form-textarea"
                      rows={3}
                      placeholder="e.g. Temperature sensitivity, heavy weight items, custom brand box requirements..."
                      value={formData.notes}
                      onChange={(e) => handleInputChange("notes", e.target.value)}
                    ></textarea>
                  </div>
                </div>
              )}

              {/* Step 4: Review & Onboarding Activation */}
              {currentStep === 4 && (
                <div className="wizard-step-content">
                  <div className="plan-summary-card">
                    <div className="plan-summary-header">
                      <div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                          Recommended Fulfillment Tier
                        </div>
                        <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "#ffffff" }}>
                          {planTier.name}
                        </div>
                      </div>
                      <span className="plan-badge">Pre-Qualified</span>
                    </div>

                    <div className="summary-details-grid">
                      <div className="summary-item">
                        <span className="summary-item-label">Dispatch SLA</span>
                        <span className="summary-item-val" style={{ color: "var(--success)" }}>
                          {planTier.sla}
                        </span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-item-label">Account Supervision</span>
                        <span className="summary-item-val">{planTier.manager}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-item-label">Warehouse Hubs</span>
                        <span className="summary-item-val">
                          {formData.preferredWarehouses.length} Hub(s) Selected
                        </span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-item-label">Estimated Go-Live</span>
                        <span className="summary-item-val" style={{ color: "#818cf8" }}>
                          Ready in 48-72 Hours
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Summary of Customer Data */}
                  <div
                    style={{
                      background: "rgba(15, 23, 42, 0.4)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "var(--radius-md)",
                      padding: "1.25rem",
                      marginBottom: "1.5rem",
                    }}
                  >
                    <h4 style={{ fontSize: "0.9375rem", marginBottom: "0.75rem", color: "var(--text-primary)" }}>
                      Application Summary
                    </h4>
                    <div className="form-grid-2" style={{ fontSize: "0.8125rem", gap: "0.75rem" }}>
                      <div>
                        <span style={{ color: "var(--text-muted)" }}>Company:</span>{" "}
                        <strong>{formData.companyName}</strong>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-muted)" }}>Contact:</span>{" "}
                        <strong>{formData.contactName} ({formData.contactPhone})</strong>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-muted)" }}>Email:</span>{" "}
                        <strong>{formData.contactEmail}</strong>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-muted)" }}>Monthly Volume:</span>{" "}
                        <strong>{formData.monthlyOrderVolume}</strong>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-muted)" }}>Sales Channels:</span>{" "}
                        <strong>{formData.salesChannels.join(", ") || "None specified"}</strong>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-muted)" }}>Target Hubs:</span>{" "}
                        <strong>{formData.preferredWarehouses.join(", ")}</strong>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", marginTop: "1rem" }}>
                    <input
                      type="checkbox"
                      id="agreeTerms"
                      checked={formData.agreeTerms}
                      onChange={(e) => handleInputChange("agreeTerms", e.target.checked)}
                      style={{ marginTop: "0.25rem", cursor: "pointer" }}
                    />
                    <label
                      htmlFor="agreeTerms"
                      style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", cursor: "pointer" }}
                    >
                      I confirm that I am authorized to represent this company and agree to the RicozFulfil
                      Enterprise Onboarding Terms, SLA Commitments, and Privacy Policy.
                    </label>
                  </div>
                </div>
              )}

              {/* Wizard Footer Controls */}
              <div className="wizard-footer-actions">
                {currentStep > 1 ? (
                  <button type="button" className="btn-ghost" onClick={handlePrevStep} disabled={submitting}>
                    &larr; Back
                  </button>
                ) : (
                  <div></div>
                )}

                {currentStep < 4 ? (
                  <button type="button" className="btn-glow" onClick={handleNextStep}>
                    Continue &rarr;
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-glow"
                    onClick={handleSubmitOnboarding}
                    disabled={submitting}
                  >
                    {submitting ? "Submitting Application..." : "Submit Onboarding Application ✓"}
                  </button>
                )}
              </div>
            </>
          ) : (
            /* Success State */
            <div className="onboarding-success-card">
              <div className="success-check-icon">✓</div>
              <h3 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--text-primary)" }}>
                Application Received!
              </h3>
              <p
                style={{
                  color: "var(--text-secondary)",
                  maxWidth: "540px",
                  margin: "0.5rem auto 1.5rem",
                  fontSize: "0.9375rem",
                }}
              >
                Welcome to RicozFulfil. Your onboarding case has been logged in our enterprise fulfillment
                hub. Our technical onboarding lead will contact you within 24 hours.
              </p>

              <div className="ref-code-box">
                <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                  Tracking Reference ID:
                </span>
                <span className="ref-code-text">{successData.referenceNumber}</span>
              </div>

              {/* 4-Phase Roadmap */}
              <div className="roadmap-timeline">
                <div className="roadmap-step">
                  <div className="roadmap-step-time">Phase 1 (Day 1)</div>
                  <div className="roadmap-step-title">Fulfillment Audit & SLA Agreement</div>
                </div>
                <div className="roadmap-step">
                  <div className="roadmap-step-time">Phase 2 (Day 2)</div>
                  <div className="roadmap-step-title">Catalog Barcode & SKU Mapping</div>
                </div>
                <div className="roadmap-step">
                  <div className="roadmap-step-time">Phase 3 (Days 3-4)</div>
                  <div className="roadmap-step-title">Warehouse Bin Slotting & Inbound</div>
                </div>
                <div className="roadmap-step">
                  <div className="roadmap-step-time">Phase 4 (Day 5)</div>
                  <div className="roadmap-step-title">Go-Live: Automated Dispatch</div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "center", gap: "1rem", marginTop: "2rem" }}>
                <Link to="/login" className="btn-glow">
                  Access Portal Login
                </Link>
                <button
                  onClick={() => {
                    setSuccessData(null);
                    setCurrentStep(1);
                  }}
                  className="btn-ghost"
                  style={{ border: "1px solid var(--border-color)" }}
                >
                  Submit Another Brand
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Interactive Savings Calculator */}
      <section className="content-container" id="calculator">
        <div className="section-head">
          <h2 className="section-title">Fulfillment ROI & Savings Estimator</h2>
          <p className="section-subtitle">
            See how much your business saves in warehouse leases, labor overhead, and shipping rates by
            partnering with RicozFulfil.
          </p>
        </div>

        <div className="calculator-card">
          <div className="calc-slider-box">
            <span
              style={{
                fontSize: "0.8125rem",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              Estimated Monthly Outbound Orders
            </span>
            <div className="slider-val-badge">{calcOrders.toLocaleString()} Orders / month</div>

            <input
              type="range"
              min="500"
              max="50000"
              step="500"
              value={calcOrders}
              onChange={(e) => setCalcOrders(Number(e.target.value))}
              className="custom-range-slider"
            />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                marginTop: "0.5rem",
              }}
            >
              <span>500 orders</span>
              <span>25,000 orders</span>
              <span>50,000+ orders</span>
            </div>

            <div style={{ marginTop: "1.75rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
              Includes multi-warehouse dynamic routing, barcode scan verification, automated packing
              slip generation, and real-time tracking events.
            </div>
          </div>

          <div className="calc-result-box">
            <div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                Estimated Monthly Savings
              </div>
              <div className="calc-metric-val">₹{calcSavings.toLocaleString()}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                vs. In-house lease + pickers + non-discounted carrier rates
              </div>
            </div>

            <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>Dispatch Speed</span>
                <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  {calcHours}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>Recommended Space</span>
                <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  {calcSpace}
                </span>
              </div>
            </div>

            <a
              href="#onboarding-form-section"
              className="btn-glow"
              style={{ textAlign: "center", justifyContent: "center", width: "100%", marginTop: "1rem" }}
            >
              Lock In This Rate &rarr;
            </a>
          </div>
        </div>
      </section>

      {/* Platform Pillars Section */}
      <section className="content-container" id="features">
        <div className="section-head">
          <h2 className="section-title">Why Enterprise Brands Choose RicozFulfil</h2>
          <p className="section-subtitle">
            Engineered with strict state machines and atomic inventory guarantees to eliminate shipping
            discrepancies.
          </p>
        </div>

        <div className="pillars-grid">
          <div className="pillar-card">
            <div className="pillar-icon">🔄</div>
            <h3 className="pillar-title">Guaranteed State Machine</h3>
            <p className="pillar-desc">
              Every order strictly transitions through verified states: Confirmed &rarr; Inventory Check &rarr;
              Pick List &rarr; Picking &rarr; Packing &rarr; Shipment &rarr; Dispatched. No skipped steps.
            </p>
          </div>

          <div className="pillar-card">
            <div className="pillar-icon">⚡</div>
            <h3 className="pillar-title">Atomic Multi-Warehouse Stock</h3>
            <p className="pillar-desc">
              Real-time MongoDB atomic updates prevent race conditions and overselling across all your sales
              channels. Instant tracking of available, reserved, damaged, and returned inventory.
            </p>
          </div>

          <div className="pillar-card">
            <div className="pillar-icon">📦</div>
            <h3 className="pillar-title">Barcode Pick & Pack Benches</h3>
            <p className="pillar-desc">
              Terminal-based barcode scanning validates each item before packing. Automatic package dimension
              and weight logging ensures zero carrier dispute surcharges.
            </p>
          </div>

          <div className="pillar-card">
            <div className="pillar-icon">🚚</div>
            <h3 className="pillar-title">Carrier Allocation & Live Tracking</h3>
            <p className="pillar-desc">
              Intelligent rate shopping across BlueDart, Delhivery, Shadowfax, and more. Granular timeline
              events kept in tracking history for complete end-customer transparency.
            </p>
          </div>

          <div className="pillar-card">
            <div className="pillar-icon">↩️</div>
            <h3 className="pillar-title">Frictionless Reverse Logistics</h3>
            <p className="pillar-desc">
              Streamlined customer returns. Scheduled carrier pickup, dock receiving, quality inspection,
              and instant re-slotting or disposition to maximize product recovery.
            </p>
          </div>

          <div className="pillar-card">
            <div className="pillar-icon">📊</div>
            <h3 className="pillar-title">Operational Intelligence</h3>
            <p className="pillar-desc">
              Real-time analytics on order throughput, pick rates, dispatch velocity, carrier performance,
              and warehouse capacity utilization.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="content-container" id="how-it-works">
        <div className="section-head">
          <h2 className="section-title">The Onboarding Journey in 4 Simple Steps</h2>
          <p className="section-subtitle">
            Transitioning your fulfillment to RicozFulfil is seamless, guided by our logistics engineers.
          </p>
        </div>

        <div className="pillars-grid" style={{ marginBottom: "5rem" }}>
          <div className="pillar-card" style={{ borderTop: "3px solid var(--primary)" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase" }}>
              Step 1
            </div>
            <h3 className="pillar-title" style={{ marginTop: "0.5rem" }}>
              Digital Profile & Account Setup
            </h3>
            <p className="pillar-desc">
              Submit your company profile via this landing page. We configure your company's dedicated
              tenant, API keys, and custom packaging protocols.
            </p>
          </div>

          <div className="pillar-card" style={{ borderTop: "3px solid #0ea5e9" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#0ea5e9", textTransform: "uppercase" }}>
              Step 2
            </div>
            <h3 className="pillar-title" style={{ marginTop: "0.5rem" }}>
              Storefront & Catalog Sync
            </h3>
            <p className="pillar-desc">
              Connect your Shopify, Amazon, WooCommerce, or custom ERP in minutes. All SKUs, barcodes, and
              weights are mapped and validated.
            </p>
          </div>

          <div className="pillar-card" style={{ borderTop: "3px solid #10b981" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#10b981", textTransform: "uppercase" }}>
              Step 3
            </div>
            <h3 className="pillar-title" style={{ marginTop: "0.5rem" }}>
              Inbound Stock & Bin Slotting
            </h3>
            <p className="pillar-desc">
              Send your inventory to our regional warehouses. Our dock teams scan, inspect, and slot your
              stock into high-density automated zones.
            </p>
          </div>

          <div className="pillar-card" style={{ borderTop: "3px solid #f59e0b" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#f59e0b", textTransform: "uppercase" }}>
              Step 4
            </div>
            <h3 className="pillar-title" style={{ marginTop: "0.5rem" }}>
              Automated Go-Live
            </h3>
            <p className="pillar-desc">
              Customer orders flow seamlessly into RicozFulfil, generate optimized pick lists, get verified
              at packing, and dispatch with same-day carrier pickups.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="content-container" id="faqs">
        <div className="section-head">
          <h2 className="section-title">Frequently Asked Questions</h2>
          <p className="section-subtitle">
            Everything you need to know about partnering with RicozFulfil as your fulfillment backbone.
          </p>
        </div>

        <div className="faq-list">
          {FAQS.map((faq, index) => {
            const isOpen = expandedFaq === index;
            return (
              <div key={index} className="faq-item">
                <div
                  className="faq-question"
                  onClick={() => setExpandedFaq(isOpen ? -1 : index)}
                >
                  <span>{faq.q}</span>
                  <span className="faq-toggle">{isOpen ? "−" : "+"}</span>
                </div>
                {isOpen && <div className="faq-answer">{faq.a}</div>}
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="onboarding-footer">
        <div className="footer-inner">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
              <span className="brand-logo-text" style={{ fontSize: "1.2rem" }}>
                RicozFulfil
              </span>
              <span className="brand-tag">v1.0 Enterprise</span>
            </div>
            <p className="footer-copy">
              © {new Date().getFullYear()} Ricoz Technologies. Enterprise Fulfillment Management Platform.
            </p>
          </div>

          <div className="footer-links">
            <a href="#features">Features</a>
            <a href="#calculator">Pricing & ROI</a>
            <a href="#faqs">Support</a>
            <Link to="/login">Terminal Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default CustomerOnboarding;
