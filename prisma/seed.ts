import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function hash(password: string) {
  return bcrypt.hash(password, 10);
}

async function main() {
  console.log("Seeding ElectroFine database...");

  // ---------------------------------------------------------------------
  // Admin
  // ---------------------------------------------------------------------
  const admin = await prisma.user.upsert({
    where: { email: "admin@electrofine.com" },
    update: {},
    create: {
      name: "ElectroFine Admin",
      email: "admin@electrofine.com",
      passwordHash: await hash("Admin@123"),
      role: "ADMIN",
    },
  });
  console.log(`Admin ready: ${admin.email}`);

  // ---------------------------------------------------------------------
  // Categories + Pricing
  // ---------------------------------------------------------------------
  const categorySeed = [
    { name: "Electronics", description: "TVs, monitors, and electronic devices", pricePerKg: 18 },
    { name: "Mobile Phones", description: "Smartphones and feature phones", pricePerKg: 45 },
    { name: "Batteries", description: "Dry cell and rechargeable batteries", pricePerKg: 12 },
    { name: "Cables & Wires", description: "Copper wires, chargers, cables", pricePerKg: 25 },
    { name: "Home Appliances", description: "Mixers, irons, small appliances", pricePerKg: 15 },
    { name: "Computer Parts", description: "Motherboards, RAM, hard drives", pricePerKg: 30 },
  ];

  const categories = [];
  for (const c of categorySeed) {
    const category = await prisma.category.upsert({
      where: { name: c.name },
      update: {},
      create: { name: c.name, description: c.description },
    });
    const existingPricing = await prisma.pricing.findFirst({
      where: { categoryId: category.id, isActive: true },
    });
    if (!existingPricing) {
      await prisma.pricing.create({
        data: {
          categoryId: category.id,
          pricePerKg: c.pricePerKg,
          minimumWeight: 0.5,
          bonusAmount: 5,
          isActive: true,
        },
      });
    }
    categories.push(category);
  }
  console.log(`Seeded ${categories.length} categories with pricing`);

  // ---------------------------------------------------------------------
  // Customers + Addresses
  // ---------------------------------------------------------------------
  const customerSeed = [
    { name: "Ananya Sharma", phone: "9876543210", email: "ananya@example.com", city: "Pune", pincode: "411001" },
    { name: "Rohan Mehta", phone: "9876543211", email: "rohan@example.com", city: "Pune", pincode: "411014" },
    { name: "Priya Nair", phone: "9876543212", email: "priya@example.com", city: "Mumbai", pincode: "400001" },
    { name: "Vikram Singh", phone: "9876543213", email: "vikram@example.com", city: "Mumbai", pincode: "400021" },
    { name: "Sneha Kulkarni", phone: "9876543214", email: "sneha@example.com", city: "Pune", pincode: "411045" },
  ];

  const customers = [];
  for (const c of customerSeed) {
    const customer = await prisma.customer.upsert({
      where: { phone: c.phone },
      update: {},
      create: {
        name: c.name,
        phone: c.phone,
        email: c.email,
        passwordHash: await hash("Customer@123"),
        isActive: true,
      },
    });

    const existingAddress = await prisma.address.findFirst({ where: { customerId: customer.id } });
    if (!existingAddress) {
      await prisma.address.create({
        data: {
          customerId: customer.id,
          label: "HOME",
          line1: `${Math.floor(Math.random() * 200) + 1}, Green Society`,
          city: c.city,
          state: c.city === "Mumbai" ? "Maharashtra" : "Maharashtra",
          pincode: c.pincode,
        },
      });
    }
    customers.push(customer);
  }
  console.log(`Seeded ${customers.length} customers`);

  // ---------------------------------------------------------------------
  // Kabadiwalas
  // ---------------------------------------------------------------------
  const kabadiwalaSeed = [
    { name: "Ramesh Kabadiwala", phone: "9123456780", area: "Pune Central", vehicle: "MH12AB1234", availability: "AVAILABLE" as const },
    { name: "Suresh Recyclers", phone: "9123456781", area: "Pune East", vehicle: "MH12CD5678", availability: "AVAILABLE" as const },
    { name: "Mahesh Scrap Co.", phone: "9123456782", area: "Mumbai South", vehicle: "MH01EF9012", availability: "BUSY" as const },
    { name: "Ganesh E-Waste", phone: "9123456783", area: "Mumbai West", vehicle: "MH01GH3456", availability: "AVAILABLE" as const },
    { name: "Dinesh Traders", phone: "9123456784", area: "Pune West", vehicle: "MH12IJ7890", availability: "OFFLINE" as const },
  ];

  const kabadiwalas = [];
  for (const k of kabadiwalaSeed) {
    const kabadiwala = await prisma.kabadiwala.upsert({
      where: { phone: k.phone },
      update: {},
      create: {
        name: k.name,
        phone: k.phone,
        vehicleNumber: k.vehicle,
        serviceArea: k.area,
        availability: k.availability,
        isActive: true,
      },
    });
    kabadiwalas.push(kabadiwala);
  }
  console.log(`Seeded ${kabadiwalas.length} kabadiwalas`);

  // ---------------------------------------------------------------------
  // Pickup Requests + Items (+ Payments + Feedback for completed ones)
  // ---------------------------------------------------------------------
  const statuses: Array<"PENDING" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"> = [
    "PENDING",
    "PENDING",
    "ASSIGNED",
    "IN_PROGRESS",
    "COMPLETED",
    "COMPLETED",
    "COMPLETED",
    "COMPLETED",
    "COMPLETED",
    "CANCELLED",
  ];

  let pickupCount = 0;
  let paymentCount = 0;
  let feedbackCount = 0;

  for (let i = 0; i < statuses.length; i++) {
    const status = statuses[i];
    const customer = customers[i % customers.length];
    const address = await prisma.address.findFirst({ where: { customerId: customer.id } });
    if (!address) continue;

    const kabadiwala =
      status === "PENDING" ? null : kabadiwalas[i % kabadiwalas.length];

    const category = categories[i % categories.length];
    const pricing = await prisma.pricing.findFirst({
      where: { categoryId: category.id, isActive: true },
    });
    const unitPrice = pricing ? Number(pricing.pricePerKg) : 15;
    const weight = Number((2 + Math.random() * 8).toFixed(2));
    const subtotal = Number((weight * unitPrice).toFixed(2));

    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + (status === "PENDING" ? 3 : -i));

    const completedAt = status === "COMPLETED" ? new Date(scheduledDate) : null;

    const pickup = await prisma.pickupRequest.create({
      data: {
        customerId: customer.id,
        addressId: address.id,
        kabadiwalaId: kabadiwala?.id ?? null,
        status,
        scheduledDate,
        completedAt,
        totalWeight: weight,
        totalAmount: subtotal,
        items: {
          create: [
            {
              categoryId: category.id,
              description: `${category.name} items for pickup`,
              weight,
              unitPrice,
              subtotal,
            },
          ],
        },
      },
    });
    pickupCount++;

    if (status === "COMPLETED") {
      await prisma.payment.create({
        data: {
          pickupRequestId: pickup.id,
          customerId: customer.id,
          amount: subtotal,
          method: ["CASH", "UPI", "BANK_TRANSFER"][i % 3] as
            | "CASH"
            | "UPI"
            | "BANK_TRANSFER",
          status: "COMPLETED",
          paidAt: completedAt,
        },
      });
      paymentCount++;

      if (i % 2 === 0 && kabadiwala) {
        await prisma.feedback.create({
          data: {
            pickupRequestId: pickup.id,
            customerId: customer.id,
            kabadiwalaId: kabadiwala.id,
            rating: 4 + (i % 2),
            comment: "Prompt and courteous service.",
          },
        });
        feedbackCount++;
      }
    }
  }
  console.log(`Seeded ${pickupCount} pickup requests, ${paymentCount} payments, ${feedbackCount} feedback entries`);

  // ---------------------------------------------------------------------
  // Notifications
  // ---------------------------------------------------------------------
  const sampleCustomer = customers[0];
  const sampleKabadiwala = kabadiwalas[0];

  await prisma.notification.createMany({
    data: [
      {
        type: "SYSTEM",
        channel: "IN_APP",
        title: "Welcome to ElectroFine",
        message: "Thanks for joining ElectroFine. Schedule your first pickup today!",
        customerId: sampleCustomer.id,
      },
      {
        type: "PICKUP_UPDATE",
        channel: "IN_APP",
        title: "New Pickup Assigned",
        message: "You have a new pickup request assigned to you.",
        kabadiwalaId: sampleKabadiwala.id,
      },
      {
        type: "PROMOTION",
        channel: "EMAIL",
        title: "Refer & Earn",
        message: "Refer a friend and earn bonus rewards on your next pickup.",
        customerId: sampleCustomer.id,
      },
    ],
  });
  console.log("Seeded notifications");

  console.log("Seeding complete.");
}

main()
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
