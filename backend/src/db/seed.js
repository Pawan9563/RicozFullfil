import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Models
import { User, USER_ROLES } from "../models/user.model.js";
import { Warehouse, WAREHOUSE_STATUS } from "../models/warehouse.model.js";
import { WarehouseLocation, LOCATION_TYPES } from "../models/warehouseLocation.model.js";
import { Product, PRODUCT_STATUS } from "../models/product.model.js";
import { Inventory } from "../models/inventory.model.js";
import { Carrier, CARRIER_STATUS } from "../models/carrier.model.js";
import { Customer } from "../models/customer.model.js";
import { Order, PAYMENT_STATUS } from "../models/order.model.js";
import { PickList, PICKLIST_STATUS, PICK_ITEM_STATUS } from "../models/pickList.model.js";
import { Package, PACKAGE_STATUS } from "../models/package.model.js";
import { Shipment, SHIPMENT_STATUS } from "../models/shipment.model.js";
import { TrackingEvent } from "../models/trackingEvent.model.js";
import { Return } from "../models/return.model.js";
import { Notification } from "../models/notification.model.js";
import { ORDER_STATUS } from "../utils/orderStateMachine.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ricoz_fulfil";
const TEST_PASSWORD = "Password123!";

async function runSeed() {
  console.log("🌱 Starting RicozFulfil database seeding...");
  console.log(`🔌 Connecting to MongoDB: ${MONGO_URI}`);

  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB connected successfully.\n");

    // 1. Clean existing database collections
    console.log("🧹 Purging existing collections...");
    await Promise.all([
      User.deleteMany({}),
      Warehouse.deleteMany({}),
      WarehouseLocation.deleteMany({}),
      Product.deleteMany({}),
      Inventory.deleteMany({}),
      Carrier.deleteMany({}),
      Customer.deleteMany({}),
      Order.deleteMany({}),
      PickList.deleteMany({}),
      Package.deleteMany({}),
      Shipment.deleteMany({}),
      TrackingEvent.deleteMany({}),
      Return.deleteMany({}),
      Notification.deleteMany({}),
    ]);
    console.log("✅ Collections cleared.\n");

    // 2. Create Warehouses
    console.log("🏢 Seeding 3 Warehouses...");
    const warehouseData = [
      {
        name: "Bengaluru Central Hub",
        code: "WH-BLR",
        location: "Whitefield, Bengaluru",
        address: {
          street: "Plot 42, Export Promotion Industrial Park, Whitefield",
          city: "Bengaluru",
          state: "Karnataka",
          postalCode: "560066",
          country: "India",
        },
        capacity: 25000,
        status: WAREHOUSE_STATUS.ACTIVE,
      },
      {
        name: "Mumbai West Fulfillment Center",
        code: "WH-BOM",
        location: "Bhiwandi, Mumbai",
        address: {
          street: "Shed 7B, Indian Logistics Park, Mankoli, Bhiwandi",
          city: "Thane",
          state: "Maharashtra",
          postalCode: "421302",
          country: "India",
        },
        capacity: 35000,
        status: WAREHOUSE_STATUS.ACTIVE,
      },
      {
        name: "Delhi NCR Mega Logistics",
        code: "WH-DEL",
        location: "Manesar, Gurgaon",
        address: {
          street: "Sector 8, IMT Manesar Industrial Zone",
          city: "Gurugram",
          state: "Haryana",
          postalCode: "122051",
          country: "India",
        },
        capacity: 40000,
        status: WAREHOUSE_STATUS.ACTIVE,
      },
    ];

    const warehouses = await Warehouse.create(warehouseData);
    const [whBLR, whBOM, whDEL] = warehouses;
    console.log(`✅ Created 3 Warehouses (${whBLR.code}, ${whBOM.code}, ${whDEL.code}).`);

    // 3. Seed Users across all 6 roles
    console.log("👥 Seeding users across all 6 roles...");
    const usersData = [
      {
        name: "Devina Roy (Super Admin)",
        email: "superadmin@ricoz.com",
        password: TEST_PASSWORD,
        role: USER_ROLES.SUPER_ADMIN,
        phone: "+91 9800000001",
        isActive: true,
      },
      {
        name: "Aakash Mehta (Admin)",
        email: "admin@ricoz.com",
        password: TEST_PASSWORD,
        role: USER_ROLES.ADMIN,
        phone: "+91 9800000002",
        isActive: true,
      },
      {
        name: "Rohan Iyer (Ops Manager)",
        email: "ops@ricoz.com",
        password: TEST_PASSWORD,
        role: USER_ROLES.OPERATIONS_MANAGER,
        phone: "+91 9800000003",
        isActive: true,
      },
      {
        name: "Suresh Patil (WH Manager)",
        email: "whmanager@ricoz.com",
        password: TEST_PASSWORD,
        role: USER_ROLES.WAREHOUSE_MANAGER,
        phone: "+91 9800000004",
        assignedWarehouse: whBLR._id,
        isActive: true,
      },
      {
        name: "Karan Singh (Picker)",
        email: "picker@ricoz.com",
        password: TEST_PASSWORD,
        role: USER_ROLES.PICKER,
        phone: "+91 9800000005",
        assignedWarehouse: whBLR._id,
        isActive: true,
      },
      {
        name: "Meera Nair (Packer)",
        email: "packer@ricoz.com",
        password: TEST_PASSWORD,
        role: USER_ROLES.PACKER,
        phone: "+91 9800000006",
        assignedWarehouse: whBLR._id,
        isActive: true,
      },
    ];

    const createdUsers = await User.create(usersData);
    const superAdmin = createdUsers.find((u) => u.role === USER_ROLES.SUPER_ADMIN);
    const whManager = createdUsers.find((u) => u.role === USER_ROLES.WAREHOUSE_MANAGER);
    const picker = createdUsers.find((u) => u.role === USER_ROLES.PICKER);
    const packer = createdUsers.find((u) => u.role === USER_ROLES.PACKER);

    // Link warehouse managers
    whBLR.manager = whManager._id;
    await whBLR.save();
    console.log("✅ Created 6 platform users with known credentials.");

    // 4. Create Warehouse Locations for each warehouse
    console.log("📍 Seeding warehouse storage locations...");
    const locationTypes = [
      LOCATION_TYPES.PICKING,
      LOCATION_TYPES.PICKING,
      LOCATION_TYPES.PICKING,
      LOCATION_TYPES.BULK,
      LOCATION_TYPES.PACKING,
    ];

    const locationsToInsert = [];
    for (const wh of warehouses) {
      for (const aisle of ["A", "B"]) {
        for (const rack of ["01", "02"]) {
          for (const bin of ["01", "02"]) {
            locationsToInsert.push({
              warehouse: wh._id,
              aisle,
              rack,
              bin,
              shelf: "01",
              zone: aisle === "A" ? "ZONE-NORTH" : "ZONE-SOUTH",
              code: `${wh.code}-${aisle}-${rack}-${bin}`,
              locationType: LOCATION_TYPES.PICKING,
              isActive: true,
            });
          }
        }
      }
      // Add packing & receiving bench
      locationsToInsert.push(
        {
          warehouse: wh._id,
          aisle: "P",
          rack: "01",
          bin: "01",
          code: `${wh.code}-BENCH-PACK`,
          locationType: LOCATION_TYPES.PACKING,
          isActive: true,
        },
        {
          warehouse: wh._id,
          aisle: "R",
          rack: "01",
          bin: "01",
          code: `${wh.code}-DOCK-RECV`,
          locationType: LOCATION_TYPES.RECEIVING,
          isActive: true,
        }
      );
    }

    const createdLocations = await WarehouseLocation.create(locationsToInsert);
    console.log(`✅ Created ${createdLocations.length} warehouse locations across 3 facilities.`);

    // 5. Create 10 Products
    console.log("📦 Seeding 10 Products...");
    const productsData = [
      {
        sku: "KB-MECH-RGB",
        name: "Ergonomic Mechanical Keyboard (RGB Brown Switches)",
        description: "Hot-swappable mechanical keyboard with PBT keycaps and dampening foam.",
        category: "Electronics",
        price: 3499,
        costPrice: 2100,
        weight: 0.95,
        dimensions: { length: 36, width: 14, height: 4, unit: "cm" },
        status: PRODUCT_STATUS.ACTIVE,
        barcode: "890123456001",
      },
      {
        sku: "MS-WIRELESS-BLK",
        name: "Ultra-Light Wireless Gaming Mouse",
        description: "65g lightweight wireless mouse with 26K DPI optical sensor and PTFE feet.",
        category: "Electronics",
        price: 1899,
        costPrice: 950,
        weight: 0.08,
        dimensions: { length: 12, width: 6.5, height: 3.8, unit: "cm" },
        status: PRODUCT_STATUS.ACTIVE,
        barcode: "890123456002",
      },
      {
        sku: "HP-ANC-BT5",
        name: "Wireless ANC Over-Ear Headphones",
        description: "Active Noise Cancelling Bluetooth 5.3 headphones with 40h battery playback.",
        category: "Audio",
        price: 5499,
        costPrice: 3200,
        weight: 0.28,
        dimensions: { length: 20, width: 18, height: 8, unit: "cm" },
        status: PRODUCT_STATUS.ACTIVE,
        barcode: "890123456003",
      },
      {
        sku: "DK-USBC-4K",
        name: "USB-C Aluminum Dual 4K Docking Station",
        description: "11-in-1 dock with Dual HDMI 4K@60Hz, 100W Power Delivery, and Gigabit Ethernet.",
        category: "Accessories",
        price: 4299,
        costPrice: 2400,
        weight: 0.45,
        dimensions: { length: 15, width: 8, height: 2, unit: "cm" },
        status: PRODUCT_STATUS.ACTIVE,
        barcode: "890123456004",
      },
      {
        sku: "CB-USBC-100W",
        name: "Braided 100W USB-C Fast Charging Cable (2m)",
        description: "E-marker chipset with braided nylon cord supporting 5A fast charging.",
        category: "Accessories",
        price: 499,
        costPrice: 180,
        weight: 0.06,
        dimensions: { length: 10, width: 8, height: 2, unit: "cm" },
        status: PRODUCT_STATUS.ACTIVE,
        barcode: "890123456005",
      },
      {
        sku: "ST-LAPTOP-ALUM",
        name: "Ergonomic Aluminum Laptop Riser Stand",
        description: "Foldable desktop riser with cooling ventilation slots for up to 17-inch laptops.",
        category: "Office",
        price: 1299,
        costPrice: 620,
        weight: 0.65,
        dimensions: { length: 26, width: 23, height: 5, unit: "cm" },
        status: PRODUCT_STATUS.ACTIVE,
        barcode: "890123456006",
      },
      {
        sku: "DM-MAT-9040",
        name: "Micro-Weave Desk Mat Extended Pad (90x40cm)",
        description: "Water-resistant stitched-edge gaming desk pad with natural rubber base.",
        category: "Office",
        price: 799,
        costPrice: 310,
        weight: 0.52,
        dimensions: { length: 42, width: 8, height: 8, unit: "cm" },
        status: PRODUCT_STATUS.ACTIVE,
        barcode: "890123456007",
      },
      {
        sku: "CAM-FHD-60FPS",
        name: "Full HD 1080p 60fps Pro Stream Webcam",
        description: "Autofocus webcam with stereo microphone and magnetic privacy lens shutter.",
        category: "Electronics",
        price: 2799,
        costPrice: 1450,
        weight: 0.18,
        dimensions: { length: 10, width: 5, height: 6, unit: "cm" },
        status: PRODUCT_STATUS.ACTIVE,
        barcode: "890123456008",
      },
      {
        sku: "MIC-USB-STUDIO",
        name: "Cardioid Studio USB Condenser Microphone",
        description: "Zero-latency monitoring USB microphone with metal shock mount and pop filter.",
        category: "Audio",
        price: 3699,
        costPrice: 1950,
        weight: 0.72,
        dimensions: { length: 22, width: 12, height: 10, unit: "cm" },
        status: PRODUCT_STATUS.ACTIVE,
        barcode: "890123456009",
      },
      {
        sku: "LT-MONITOR-LED",
        name: "Smart Screen Light Bar with Auto-Dimming",
        description: "Asymmetric optical monitor bar with touch color-temperature controls.",
        category: "Lighting",
        price: 2199,
        costPrice: 1100,
        weight: 0.40,
        dimensions: { length: 46, width: 5, height: 4, unit: "cm" },
        status: PRODUCT_STATUS.ACTIVE,
        barcode: "890123456010",
      },
    ];

    const products = await Product.create(productsData);
    console.log(`✅ Created ${products.length} catalog products.`);

    // 6. Seed Inventory across Warehouses
    console.log("📊 Distributing inventory across warehouses...");
    const inventoryDocs = [];
    const blrLocations = createdLocations.filter(
      (loc) => loc.warehouse.toString() === whBLR._id.toString() && loc.locationType === LOCATION_TYPES.PICKING
    );

    let locIdx = 0;
    for (const prod of products) {
      // Warehouse 1 (BLR) - High stock with location assignment
      inventoryDocs.push({
        product: prod._id,
        warehouse: whBLR._id,
        available: 120,
        reserved: 10,
        damaged: 2,
        returned: 1,
        lowStockThreshold: 15,
        location: blrLocations[locIdx % blrLocations.length]._id,
        maxCapacity: 500,
      });

      // Warehouse 2 (BOM) - Medium stock
      inventoryDocs.push({
        product: prod._id,
        warehouse: whBOM._id,
        available: 75,
        reserved: 5,
        damaged: 0,
        returned: 0,
        lowStockThreshold: 15,
        maxCapacity: 400,
      });

      // Warehouse 3 (DEL) - Varied stock (one low stock item for testing alerts)
      const isLowStock = prod.sku === "CB-USBC-100W";
      inventoryDocs.push({
        product: prod._id,
        warehouse: whDEL._id,
        available: isLowStock ? 4 : 50,
        reserved: 2,
        damaged: 1,
        returned: 0,
        lowStockThreshold: 10,
        maxCapacity: 300,
      });

      locIdx++;
    }

    await Inventory.create(inventoryDocs);
    console.log(`✅ Created ${inventoryDocs.length} inventory records with balanced stock levels.`);

    // 7. Seed 3 Logistics Carriers
    console.log("🚚 Seeding 3 Carriers...");
    const carriersData = [
      {
        name: "BlueDart Express",
        code: "BLUEDART",
        status: CARRIER_STATUS.ACTIVE,
        serviceTypes: ["Domestic Priority", "Apex Air Cargo", "Surface Cargo"],
        accountId: "BD-ACC-9921",
        trackingUrlTemplate: "https://www.bluedart.com/tracking?trackNumber={TRACKING_NUMBER}",
        contactInfo: {
          phone: "+91 1860 233 1234",
          email: "support@bluedart.com",
          contactPerson: "Rajesh Varma",
        },
      },
      {
        name: "Delhivery Logistics",
        code: "DELHIVERY",
        status: CARRIER_STATUS.ACTIVE,
        serviceTypes: ["Surface Express", "Same-Day Delivery", "Next-Day Prime"],
        accountId: "DLV-ENT-4412",
        trackingUrlTemplate: "https://www.delhivery.com/track/package/{TRACKING_NUMBER}",
        contactInfo: {
          phone: "+91 8069 856 100",
          email: "enterprise@delhivery.com",
          contactPerson: "Ananya Sen",
        },
      },
      {
        name: "Shiprocket Premier",
        code: "SHIPROCKET",
        status: CARRIER_STATUS.ACTIVE,
        serviceTypes: ["Standard Ground", "Hyperlocal", "B2B Logistics"],
        accountId: "SR-PRIME-8820",
        trackingUrlTemplate: "https://shiprocket.co/tracking/{TRACKING_NUMBER}",
        contactInfo: {
          phone: "+91 9266 623 006",
          email: "help@shiprocket.com",
          contactPerson: "Vikas Aggarwal",
        },
      },
    ];

    const carriers = await Carrier.create(carriersData);
    const [blueDart, delhivery] = carriers;
    console.log(`✅ Created 3 Carriers (${carriers.map((c) => c.name).join(", ")}).`);

    // 8. Seed Sample Customers
    console.log("🛒 Seeding customers...");
    const customersData = [
      {
        name: "Rahul Sharma",
        email: "rahul.sharma@example.com",
        phone: "+91 9876543210",
        shippingAddresses: [
          {
            street: "Flat 402, Shanti Heights, Koramangala 4th Block",
            city: "Bengaluru",
            state: "Karnataka",
            postalCode: "560034",
            country: "India",
            isDefault: true,
          },
        ],
      },
      {
        name: "Priya Patel",
        email: "priya.patel@example.com",
        phone: "+91 9812345678",
        shippingAddresses: [
          {
            street: "B-12, Green Acres, Lokhandwala, Andheri West",
            city: "Mumbai",
            state: "Maharashtra",
            postalCode: "400053",
            country: "India",
            isDefault: true,
          },
        ],
      },
      {
        name: "Amit Verma",
        email: "amit.verma@example.com",
        phone: "+91 9823456789",
        shippingAddresses: [
          {
            street: "House 18, Block C, Vasant Vihar",
            city: "New Delhi",
            state: "Delhi",
            postalCode: "110057",
            country: "India",
            isDefault: true,
          },
        ],
      },
    ];

    const customers = await Customer.create(customersData);
    const [cust1, cust2, cust3] = customers;
    console.log(`✅ Created ${customers.length} sample customers.`);

    // 9. Seed Sample Orders across fulfillment lifecycle stages
    console.log("📋 Seeding sample orders across lifecycle stages...");

    // Helper timestamps
    const now = new Date();
    const minAgo = (m) => new Date(now.getTime() - m * 60 * 1000);
    const hrAgo = (h) => new Date(now.getTime() - h * 60 * 60 * 1000);
    const dayAgo = (d) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

    // --- Order 1: CONFIRMED ---
    const order1Item = {
      product: products[0]._id,
      sku: products[0].sku,
      name: products[0].name,
      quantity: 1,
      unitPrice: products[0].price,
      totalPrice: products[0].price,
      isReserved: true,
    };
    const order1 = await Order.create({
      orderNumber: "ORD-2026-CONFIRMED",
      customer: cust1._id,
      warehouse: whBLR._id,
      items: [order1Item],
      totalAmount: products[0].price,
      paymentStatus: PAYMENT_STATUS.PAID,
      status: ORDER_STATUS.CONFIRMED,
      deliveryAddress: cust1.shippingAddresses[0],
      statusHistory: [
        {
          status: ORDER_STATUS.ORDER_CREATED,
          timestamp: hrAgo(3),
          changedBy: superAdmin._id,
          note: "Order placed online via storefront",
        },
        {
          status: ORDER_STATUS.CONFIRMED,
          timestamp: hrAgo(2),
          changedBy: superAdmin._id,
          note: "Payment received, order confirmed for fulfillment",
        },
      ],
    });

    // --- Order 2: PICKED ---
    const order2Items = [
      {
        product: products[1]._id,
        sku: products[1].sku,
        name: products[1].name,
        quantity: 2,
        unitPrice: products[1].price,
        totalPrice: products[1].price * 2,
        isReserved: true,
      },
      {
        product: products[4]._id,
        sku: products[4].sku,
        name: products[4].name,
        quantity: 1,
        unitPrice: products[4].price,
        totalPrice: products[4].price,
        isReserved: true,
      },
    ];
    const order2Total = products[1].price * 2 + products[4].price;

    const order2 = await Order.create({
      orderNumber: "ORD-2026-PICKED",
      customer: cust2._id,
      warehouse: whBLR._id,
      items: order2Items,
      totalAmount: order2Total,
      paymentStatus: PAYMENT_STATUS.PAID,
      status: ORDER_STATUS.PICKED,
      deliveryAddress: cust2.shippingAddresses[0],
      statusHistory: [
        { status: ORDER_STATUS.ORDER_CREATED, timestamp: hrAgo(5), changedBy: superAdmin._id, note: "Order received" },
        { status: ORDER_STATUS.CONFIRMED, timestamp: hrAgo(4), changedBy: superAdmin._id, note: "Confirmed" },
        { status: ORDER_STATUS.INVENTORY_CHECK, timestamp: hrAgo(3.5), changedBy: superAdmin._id, note: "Stock verified" },
        { status: ORDER_STATUS.WAREHOUSE_ALLOCATION, timestamp: hrAgo(3), changedBy: whManager._id, note: "Assigned to BLR Hub" },
        { status: ORDER_STATUS.PICK_LIST_CREATED, timestamp: hrAgo(2), changedBy: whManager._id, note: "Pick list generated" },
        { status: ORDER_STATUS.PICKING, timestamp: hrAgo(1.5), changedBy: picker._id, note: "Picker scanning items" },
        { status: ORDER_STATUS.PICKED, timestamp: hrAgo(1), changedBy: picker._id, note: "All items picked and brought to staging" },
      ],
    });

    // PickList for Order 2
    const pickList2 = await PickList.create({
      pickListNumber: "PL-2026-0002",
      order: order2._id,
      orderIds: [order2._id],
      warehouse: whBLR._id,
      assignedPicker: picker._id,
      status: PICKLIST_STATUS.PICKED,
      items: [
        {
          product: products[1]._id,
          sku: products[1].sku,
          quantity: 2,
          location: blrLocations[0]._id,
          pickedQuantity: 2,
          status: PICK_ITEM_STATUS.PICKED,
        },
        {
          product: products[4]._id,
          sku: products[4].sku,
          quantity: 1,
          location: blrLocations[1]._id,
          pickedQuantity: 1,
          status: PICK_ITEM_STATUS.PICKED,
        },
      ],
      startedAt: hrAgo(1.5),
      completedAt: hrAgo(1),
    });
    order2.pickList = pickList2._id;
    await order2.save();

    // --- Order 3: SHIPPED (DISPATCHED) ---
    const order3Item = {
      product: products[2]._id,
      sku: products[2].sku,
      name: products[2].name,
      quantity: 1,
      unitPrice: products[2].price,
      totalPrice: products[2].price,
      isReserved: true,
    };
    const order3 = await Order.create({
      orderNumber: "ORD-2026-SHIPPED",
      customer: cust3._id,
      warehouse: whBLR._id,
      items: [order3Item],
      totalAmount: products[2].price,
      paymentStatus: PAYMENT_STATUS.PAID,
      status: ORDER_STATUS.DISPATCHED,
      deliveryAddress: cust3.shippingAddresses[0],
      statusHistory: [
        { status: ORDER_STATUS.ORDER_CREATED, timestamp: dayAgo(1), changedBy: superAdmin._id, note: "Order placed" },
        { status: ORDER_STATUS.CONFIRMED, timestamp: hrAgo(20), changedBy: superAdmin._id, note: "Confirmed" },
        { status: ORDER_STATUS.INVENTORY_CHECK, timestamp: hrAgo(18), changedBy: superAdmin._id, note: "Inventory allocated" },
        { status: ORDER_STATUS.WAREHOUSE_ALLOCATION, timestamp: hrAgo(16), changedBy: whManager._id, note: "Routed to BLR" },
        { status: ORDER_STATUS.PICK_LIST_CREATED, timestamp: hrAgo(12), changedBy: whManager._id, note: "Pick list created" },
        { status: ORDER_STATUS.PICKING, timestamp: hrAgo(10), changedBy: picker._id, note: "Picking in progress" },
        { status: ORDER_STATUS.PICKED, timestamp: hrAgo(8), changedBy: picker._id, note: "Picked items handed to packing" },
        { status: ORDER_STATUS.PACKING, timestamp: hrAgo(6), changedBy: packer._id, note: "Packaging in progress" },
        { status: ORDER_STATUS.PACKED, timestamp: hrAgo(5), changedBy: packer._id, note: "Package sealed in carton" },
        { status: ORDER_STATUS.SHIPMENT_CREATED, timestamp: hrAgo(4), changedBy: whManager._id, note: "Shipment registered" },
        { status: ORDER_STATUS.CARRIER_ASSIGNED, timestamp: hrAgo(3), changedBy: whManager._id, note: "Assigned to BlueDart" },
        { status: ORDER_STATUS.DISPATCHED, timestamp: hrAgo(2), changedBy: whManager._id, note: "Dispatched from warehouse dock" },
      ],
    });

    const package3 = await Package.create({
      packageNumber: "PKG-2026-0003",
      order: order3._id,
      warehouse: whBLR._id,
      packedBy: packer._id,
      boxSize: "Standard Box",
      weight: 0.85,
      dimensions: { length: 25, width: 20, height: 12, unit: "cm" },
      status: PACKAGE_STATUS.SHIPPED,
      packedAt: hrAgo(5),
    });

    const shipment3 = await Shipment.create({
      shipmentNumber: "SHP-2026-0003",
      order: order3._id,
      package: package3._id,
      carrier: blueDart._id,
      trackingId: "BD-TRACK-7829104",
      status: SHIPMENT_STATUS.DISPATCHED,
      expectedDeliveryDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
      dispatchedAt: hrAgo(2),
      originWarehouse: whBLR._id,
      destination: {
        city: cust3.shippingAddresses[0].city,
        state: cust3.shippingAddresses[0].state,
        postalCode: cust3.shippingAddresses[0].postalCode,
        country: "India",
      },
    });

    await TrackingEvent.create([
      {
        shipment: shipment3._id,
        eventType: "PACKAGE_SEALED",
        timestamp: hrAgo(5),
        location: "Bengaluru Central Hub",
        description: "Package sealed and shipping label printed.",
      },
      {
        shipment: shipment3._id,
        eventType: "CARRIER_PICKUP",
        timestamp: hrAgo(2),
        location: "Whitefield, Bengaluru",
        description: "Package picked up by BlueDart courier vehicle.",
      },
    ]);

    order3.package = package3._id;
    order3.shipment = shipment3._id;
    await order3.save();

    // --- Order 4: DELIVERED ---
    const order4Item = {
      product: products[3]._id,
      sku: products[3].sku,
      name: products[3].name,
      quantity: 1,
      unitPrice: products[3].price,
      totalPrice: products[3].price,
      isReserved: true,
    };
    const order4 = await Order.create({
      orderNumber: "ORD-2026-DELIVERED",
      customer: cust1._id,
      warehouse: whBLR._id,
      items: [order4Item],
      totalAmount: products[3].price,
      paymentStatus: PAYMENT_STATUS.PAID,
      status: ORDER_STATUS.DELIVERED,
      deliveryAddress: cust1.shippingAddresses[0],
      statusHistory: [
        { status: ORDER_STATUS.ORDER_CREATED, timestamp: dayAgo(3), changedBy: superAdmin._id, note: "Order placed" },
        { status: ORDER_STATUS.CONFIRMED, timestamp: dayAgo(3), changedBy: superAdmin._id, note: "Confirmed" },
        { status: ORDER_STATUS.INVENTORY_CHECK, timestamp: dayAgo(2.8), changedBy: superAdmin._id, note: "Checked" },
        { status: ORDER_STATUS.WAREHOUSE_ALLOCATION, timestamp: dayAgo(2.5), changedBy: whManager._id, note: "Allocated" },
        { status: ORDER_STATUS.PICK_LIST_CREATED, timestamp: dayAgo(2.2), changedBy: whManager._id, note: "Pick list created" },
        { status: ORDER_STATUS.PICKING, timestamp: dayAgo(2), changedBy: picker._id, note: "Picking" },
        { status: ORDER_STATUS.PICKED, timestamp: dayAgo(1.8), changedBy: picker._id, note: "Picked" },
        { status: ORDER_STATUS.PACKING, timestamp: dayAgo(1.5), changedBy: packer._id, note: "Packing" },
        { status: ORDER_STATUS.PACKED, timestamp: dayAgo(1.4), changedBy: packer._id, note: "Packed" },
        { status: ORDER_STATUS.SHIPMENT_CREATED, timestamp: dayAgo(1.2), changedBy: whManager._id, note: "Shipment created" },
        { status: ORDER_STATUS.CARRIER_ASSIGNED, timestamp: dayAgo(1.1), changedBy: whManager._id, note: "Assigned" },
        { status: ORDER_STATUS.DISPATCHED, timestamp: dayAgo(1), changedBy: whManager._id, note: "Dispatched" },
        { status: ORDER_STATUS.IN_TRANSIT, timestamp: hrAgo(18), changedBy: whManager._id, note: "In transit linehaul" },
        { status: ORDER_STATUS.OUT_FOR_DELIVERY, timestamp: hrAgo(4), changedBy: whManager._id, note: "Out for final delivery" },
        { status: ORDER_STATUS.DELIVERED, timestamp: hrAgo(1), changedBy: whManager._id, note: "Delivered to customer" },
      ],
    });

    const package4 = await Package.create({
      packageNumber: "PKG-2026-0004",
      order: order4._id,
      warehouse: whBLR._id,
      packedBy: packer._id,
      boxSize: "Small Box",
      weight: 0.60,
      dimensions: { length: 20, width: 15, height: 8, unit: "cm" },
      status: PACKAGE_STATUS.SHIPPED,
      packedAt: dayAgo(1.4),
    });

    const shipment4 = await Shipment.create({
      shipmentNumber: "SHP-2026-0004",
      order: order4._id,
      package: package4._id,
      carrier: delhivery._id,
      trackingId: "DLV-TRACK-5544332",
      status: SHIPMENT_STATUS.DELIVERED,
      expectedDeliveryDate: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 h in the future → delivered well on time
      dispatchedAt: dayAgo(1),
      deliveredAt: hrAgo(1),
      originWarehouse: whBLR._id,
      destination: {
        city: cust1.shippingAddresses[0].city,
        state: cust1.shippingAddresses[0].state,
        postalCode: cust1.shippingAddresses[0].postalCode,
        country: "India",
      },
    });

    await TrackingEvent.create([
      {
        shipment: shipment4._id,
        eventType: "DISPATCHED",
        timestamp: dayAgo(1),
        location: "Whitefield, Bengaluru",
        description: "Package departed Bengaluru Central facility.",
      },
      {
        shipment: shipment4._id,
        eventType: "IN_TRANSIT",
        timestamp: hrAgo(18),
        location: "South Hub Sorting Center, Bengaluru",
        description: "Processed through sorting hub facility.",
      },
      {
        shipment: shipment4._id,
        eventType: "OUT_FOR_DELIVERY",
        timestamp: hrAgo(4),
        location: "Koramangala Delivery Center",
        description: "Out with delivery agent for doorstep drop-off.",
      },
      {
        shipment: shipment4._id,
        eventType: "DELIVERED",
        timestamp: hrAgo(1),
        location: "Koramangala 4th Block, Bengaluru",
        description: "Package delivered and signed by customer Rahul Sharma.",
      },
    ]);

    order4.package = package4._id;
    order4.shipment = shipment4._id;
    await order4.save();

    console.log("✅ Seeded 4 sample lifecycle orders (CONFIRMED, PICKED, DISPATCHED/SHIPPED, DELIVERED).\n");

    // Print summary table to console
    console.log("=".repeat(80));
    console.log("🎉 RICOZFULFIL DATABASE SEEDING COMPLETED SUCCESSFULLY!");
    console.log("=".repeat(80));
    console.log("\n🔑 TEST USER CREDENTIALS (All accounts use password: " + TEST_PASSWORD + ")\n");
    console.table(
      usersData.map((u) => ({
        Role: u.role,
        Email: u.email,
        Password: TEST_PASSWORD,
        Name: u.name,
      }))
    );

    console.log("\n📦 SEEDED TEST ORDERS\n");
    console.table([
      {
        "Order Number": order1.orderNumber,
        Status: order1.status,
        Customer: cust1.name,
        Amount: `₹${order1.totalAmount}`,
      },
      {
        "Order Number": order2.orderNumber,
        Status: order2.status,
        Customer: cust2.name,
        Amount: `₹${order2.totalAmount}`,
      },
      {
        "Order Number": order3.orderNumber,
        Status: order3.status,
        Customer: cust3.name,
        Amount: `₹${order3.totalAmount}`,
      },
      {
        "Order Number": order4.orderNumber,
        Status: order4.status,
        Customer: cust1.name,
        Amount: `₹${order4.totalAmount}`,
      },
    ]);

    console.log("=".repeat(80));
    process.exit(0);
  } catch (err) {
    console.error("❌ Seeding failed with error:", err);
    process.exit(1);
  }
}

runSeed();
